// ============================================
// POST /api/cis/test-invoice — Testna oddaja računa na CIS (Hrvaška)
// ============================================
// Runda 28: wiring sendRacunZahtjev (runda 27) v admin UI. Zrcali
// GET /api/cis/echo (auth + rate limit), ampak izvede POLNO oddajo:
//   RestaurantSettings (P12 path + geslo + okolje) → loadCisP12 →
//   sendRacunZahtjev (build ZKI + XML-dsig + SOAP POST + JIR parsing).
//
// Namen: diagnostika konfiguracije — admin v CisTab klikne "Oddaj testni
// račun" in vidi realen odgovor Porezne uprave (JIR ali SifraGreske).
// Podatki so SYNTHETIC (testni znesek 10.00 €, račun 1/POS1/1) — endpoint
// NE piše v Receipt/fiskalni tok; audit trail je v server logu (idPoruke).
//
// Odgovori:
//   200 { ok, jir?, zki?, idPoruke?, httpStatus?, responseTime?,
//         serverErrorCode?, errorMessage?, signedEnvelope?, environment }
//       — oddaja je bila IZVEDENA (ok=false je veljaven izid: npr. b001)
//   400 { error } — konfiguracijska napaka (P12 ni nastavljen / ne berljiv)
//   401/429 — auth/rate-limit (enako kot echo)
// ============================================

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { logger } from '@/lib/logger'
import { db } from '@/lib/db'
import { sendRacunZahtjev, loadCisP12 } from '@/lib/cis'
import type { CisEnvironment, CisRacunData } from '@/lib/cis'

export const dynamic = 'force-dynamic'

const testInvoiceSchema = z.object({
  environment: z.enum(['test', 'production']).optional(),
  oib: z.string().regex(/^\d{11}$/, 'OIB mora imeti točno 11 števk').optional(),
  iznosUkupno: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Znesek kot decimalni niz (npr. 10.00)').optional(),
  oznPosPr: z.string().max(20).optional(),
  oznNapUr: z.string().max(20).optional(),
  brOznRac: z.string().max(20).optional(),
})

/** Izlušči samo števke iz taxId ("SI12345678" → "12345678", OIB z presledki …). */
function digitsOf(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}

export async function POST(req: Request) {
  try {
    const rl = await checkRateLimitAsync('cis-test-invoice', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) {
      return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')
    }

    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    // Body je opcijski — vsa polja imajo razumne privzete vrednosti
    let body: z.infer<typeof testInvoiceSchema> = {}
    try {
      const raw = await req.json()
      const parsed = testInvoiceSchema.safeParse(raw ?? {})
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
      }
      body = parsed.data
    } catch {
      // prazno telo je OK
    }

    const settings = await db.restaurantSettings.findFirst({ where: { isActive: true } })
    if (!settings) {
      return NextResponse.json({ error: 'Nastavitve restavracije ne obstajajo' }, { status: 400 })
    }

    const environment: CisEnvironment =
      body.environment ?? ((settings.cisEnvironment as CisEnvironment) || 'test')

    // P12 config iz globalnih nastavitev (CIS ima za zdaj le globalni scope,
    // za razliko od FURS ki ima tudi per-Location override)
    if (!settings.cisCertPath || !settings.cisCertPassword) {
      return NextResponse.json(
        { error: 'FINA P12 certifikat ni nastavljen — vnesi pot in geslo v nastavitvah CIS' },
        { status: 400 }
      )
    }

    const pems = loadCisP12(settings.cisCertPath, settings.cisCertPassword)
    if (!pems) {
      return NextResponse.json(
        { error: 'P12 certifikata ni mogoče prebrati — preveri pot in geslo (openssl pkcs12)' },
        { status: 400 }
      )
    }

    const oib = body.oib ?? digitsOf(settings.taxId)
    const data: CisRacunData = {
      oib,
      usustPdv: true,
      datumVrijeme: new Date(),
      oznSlijed: 'P',
      brOznRac: body.brOznRac ?? '1',
      oznPosPr: body.oznPosPr ?? 'POS1',
      oznNapUr: body.oznNapUr ?? '1',
      iznosUkupno: body.iznosUkupno ?? '10.00',
      nacinPlac: 'G',
      // Operater: za testno oddajo uporabimo isti OIB (davčni zavezanec) —
      // pravi natakarji pridejo iz Employee modela ob produkcijski vezavi
      oibOper: oib,
      nakDost: false,
    }

    const result = await sendRacunZahtjev(environment, data, pems)

    // Log: brez signedEnvelope (cert veriga je javna, ampak ne spamaj loga)
    logger.info(
      'CIS',
      `Testna oddaja (${environment}) → ok=${result.ok}` +
        (result.jir ? ` JIR=${result.jir}` : '') +
        (result.serverErrorCode ? ` napaka=${result.serverErrorCode}` : '') +
        ` [${result.idPoruke ?? '—'}]`
    )

    return NextResponse.json({
      environment,
      ...result,
      testedAt: new Date().toISOString(),
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/cis/test-invoice', 'Napaka pri testni oddaji računa na CIS')
  }
}
