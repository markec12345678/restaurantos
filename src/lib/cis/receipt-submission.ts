// ============================================
// CIS ODDAJA RAČUNA — produkcijska vezava na plačilni tok (runda 29)
// ============================================
// Povezuje Receipt (fiskalni zapis v bazi) s sendRacunZahtjev (runda 27):
//   Receipt + RestaurantSettings → CisRacunData → ZKI + XML-dsig →
//   SOAP POST → JIR → rezultat PERSISTIRAN nazaj na Receipt.
//
// ZASNOVA (zrcali FURS verify-invoice + non-throwing pravilo POS-a):
//   • NON-THROWING — fiskalizacija NIKOLI ne blokira prodaje. Vsak izid
//     (uspeh, poslovna napaka b001, transport down) je strukturiran rezultat.
//   • IDEMPOTENTNA — že submitted račun (JIR dodeljen) se ne pošilja ponovno.
//   • SKIP brez sledi — SI tenant / cert ni nastavljen → cisStatus OSTANE
//     'none', klicatelj dobi reason. Fiskalizacija se ne "pokvari" brez razloga.
//   • RETRY-FRIENDLY — neuspešna oddaja → cisStatus='pending' (index na
//     stolpcu omogoča batch retry); ZKI se shrani že ob neuspehu (račun je
//     konstrukcijsko podpisan, ponovna oddaja uporabi iste podatke).
//
// ODLOČITVE (dokumentirane):
//   • oibOper = OIB izdajatelja — Employee model še nima OIB polja (enako
//     kot test-invoice route); ko pride model, se zamenja z OIB-om operaterja.
//   • Storno računi se NE oddajajo (HR storno poteka po drugem mehanizmu —
//     naknadno potrdilo v spec v2.7) → reason 'storno-unsupported'.
//   • Račun brez številke (predračun) se ne oddaja — BrOznRac mora biti
//     zaporedni številki sekvence, ne '1' fallback.
// ============================================

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { toNum, type DecimalLike } from '@/lib/decimal'
import { sendRacunZahtjev } from './send'
import { loadCisP12 } from './p12'
import type { CisEnvironment, CisConfigValidation } from './types'
import type { CisPorezStopa, CisRacunData } from './invoice'

/** Minimum polj Receipt-a, ki jih oddaja bere (Prisma Receipt delegate). */
export interface ReceiptForCis {
  id: string
  receiptNumber: string
  taxId: string
  registerId: string
  totalWithTip: DecimalLike // Prisma Decimal | number | string
  paymentMethod: string
  vatBreakdown: string // JSON string
  isStorno: boolean
  createdAt: Date
  cisStatus: string
  cisJir: string
}

/** Minimum nastavitev, ki jih oddaja bere. */
export interface SettingsForCis {
  taxId: string | null
  cisEnvironment: string | null
  cisCertPath: string | null
  cisCertPassword: string | null
}

/** Izlušči samo števke ("SI12345678901" → "12345678901"). */
function digitsOf(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}

/**
 * Preslikaj plačilno metodo v CIS NacinPlac (spec v1.3+: G/K/T/O).
 *   G = gotovina, K = kartice in ostali e-instrumenti, T = tantieme/ček, O = ostalo.
 * Mobilna plačila so po spec e-instrumenti → K. Neznano → O (varnejše kot G).
 */
export function mapPaymentMethodToNacinPlac(paymentMethod: string | null | undefined): 'G' | 'K' | 'T' | 'O' {
  const m = (paymentMethod ?? '').toLowerCase()
  if (m === 'gotovina' || m === 'cash') return 'G'
  if (m === 'kartica' || m === 'card' || m === 'mobilno' || m === 'mobile') return 'K'
  if (m === 'cek' || m === 'check' || m === 'tantiema') return 'T'
  return 'O'
}

/**
 * 'R-2026-000123' → '123' (BrOznRac: samo številke, 1–20, brez vodilnih ničel).
 * Zadnja številčna skupina je SEVENCA računov (leto '2026' je predpona —
 * sekvenca se številči po poslovnem prostoru + letu, FURS model).
 * Neuporaben vnos → '1' (validacija tako ali tako zagradi, ampak ne smemo
 * poslati praznega niza, ki bi postal XML <tns:BrOznRac></tns:BrOznRac>).
 */
export function receiptNumberToBrOznRac(receiptNumber: string): string {
  const groups = receiptNumber.match(/\d+/g) ?? []
  const lastGroup = groups[groups.length - 1] ?? ''
  const stripped = lastGroup.replace(/^0+/, '')
  if (!stripped) return '1'
  return stripped.slice(0, 20)
}

/** Varno parseaj vatBreakdown JSON (Receipt.vatBreakdown je JSON string). */
function parseVatBreakdown(json: string): Record<string, { base: number; vat: number; total: number }> {
  try {
    const parsed: unknown = JSON.parse(json || '{}')
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, { base: number; vat: number; total: number }>
    }
    return {}
  } catch {
    return {}
  }
}

/**
 * Zgradi CisRacunData iz Receipt vrstice + nastavitev.
 * Čista funkcija (brez I/O) — validacija sledi v buildRacunZahtjev.
 */
export function buildCisRacunDataFromReceipt(
  receipt: ReceiptForCis,
  settings: Pick<SettingsForCis, 'taxId'>,
): CisRacunData {
  const oib = digitsOf(settings.taxId) || digitsOf(receipt.taxId)

  // PDV porazdelitev iz vatBreakdown (stopa → Osnovica/Iznos).
  // Stopa prejme format "22.00" (CIS pattern: do 3 števke + 2 decimalki).
  const breakdown = parseVatBreakdown(receipt.vatBreakdown)
  const pdv: CisPorezStopa[] = Object.entries(breakdown).map(([rate, v]) => ({
    stopa: Number(rate).toFixed(2),
    osnovica: toNum(v.base).toFixed(2),
    iznos: toNum(v.vat).toFixed(2),
  }))

  return {
    oib,
    usustPdv: true,
    datumVrijeme: receipt.createdAt,
    oznSlijed: 'P',
    brOznRac: receiptNumberToBrOznRac(receipt.receiptNumber),
    oznPosPr: receipt.registerId || 'POS1',
    oznNapUr: '1',
    ...(pdv.length > 0 ? { pdv } : {}),
    iznosUkupno: toNum(receipt.totalWithTip).toFixed(2),
    nacinPlac: mapPaymentMethodToNacinPlac(receipt.paymentMethod),
    // Odločitev: operater = izdajatelj, dokler Employee nima OIB polja
    oibOper: oib,
    nakDost: false,
  }
}

// ============================================
// Razlogi za izpust/skok (reason) — izčrpni union za tipno varnost
// ============================================
export type CisSkipReason =
  | 'already-submitted'
  | 'receipt-not-found'
  | 'receipt-number-missing'
  | 'storno-unsupported'
  | 'no-settings'
  | 'no-cert-config'
  | 'p12-unreadable'

/** Rezultat oddaje (non-throwing — vedno strukturiran). */
export interface CisSubmissionOutcome {
  /** true samo ob JIR (ali idempotentnem skipu že-submitted računa). */
  ok: boolean
  /** true, če oddaja sploh ni bila izvedena (skip). */
  skipped: boolean
  reason?: CisSkipReason
  /** Nov cisStatus Receipt-a po klicu ('none' = nespremenjen). */
  cisStatus?: 'none' | 'pending' | 'submitted' | 'failed'
  jir?: string
  zki?: string
  idPoruke?: string
  environment?: CisEnvironment
  serverErrorCode?: string
  errorMessage?: string
  validation?: CisConfigValidation
}

/** Deps za testiranje (default: pravi db + send + loadCisP12). */
export interface CisSubmissionDeps {
  dbClient?: {
    receipt: {
      findUnique: (args: { where: { id: string } }) => Promise<ReceiptForCis | null>
      update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>
    }
    restaurantSettings: {
      findFirst: (args: { where: { isActive: boolean } }) => Promise<SettingsForCis | null>
    }
  }
  send?: typeof sendRacunZahtjev
  loadP12?: typeof loadCisP12
  now?: Date
}

/**
 * Oddaj Receipt na CIS (FINA) in persistiraj rezultat.
 *
 * Potek: guard-i (idempotenza, storno, predračun, konfiguracija) →
 * buildCisRacunDataFromReceipt → sendRacunZahtjev → db.receipt.update.
 *
 * NON-THROWING: vse napake so v outcome; samo katastrofa pri db.update se
 * propagira (klicatelj — route/auto-trigger — ima .catch).
 */
export async function submitReceiptToCis(
  receiptId: string,
  deps: CisSubmissionDeps = {},
): Promise<CisSubmissionOutcome> {
  const dbClient = deps.dbClient ?? db
  const send = deps.send ?? sendRacunZahtjev
  const loadP12 = deps.loadP12 ?? loadCisP12

  // ── 1. Receipt ──
  const receipt = await dbClient.receipt.findUnique({ where: { id: receiptId } })
  if (!receipt) {
    return { ok: false, skipped: true, reason: 'receipt-not-found' }
  }

  // ── 2. Idempotenza: že fiskaliziran ──
  if (receipt.cisStatus === 'submitted' && receipt.cisJir) {
    return { ok: true, skipped: true, reason: 'already-submitted', jir: receipt.cisJir, cisStatus: 'submitted' }
  }

  // ── 3. Storno / predračun ──
  if (receipt.isStorno) {
    return { ok: false, skipped: true, reason: 'storno-unsupported' }
  }
  if (!receipt.receiptNumber) {
    return { ok: false, skipped: true, reason: 'receipt-number-missing' }
  }

  // ── 4. Konfiguracija (skip BREZ spremembe statusa — SI tenant) ──
  const settings = await dbClient.restaurantSettings.findFirst({ where: { isActive: true } })
  if (!settings) {
    return { ok: false, skipped: true, reason: 'no-settings' }
  }
  const environment: CisEnvironment =
    (settings.cisEnvironment as CisEnvironment | null) || 'test'
  if (!settings.cisCertPath || !settings.cisCertPassword) {
    return { ok: false, skipped: true, reason: 'no-cert-config', environment }
  }

  // ── 5. P12 (neberljiv cert = poskus, ki je padel → pending) ──
  const pems = loadP12(settings.cisCertPath, settings.cisCertPassword)
  if (!pems) {
    await dbClient.receipt.update({
      where: { id: receipt.id },
      data: { cisStatus: 'pending' },
    })
    logger.warn('CIS', `P12 neberljiv — Receipt ${receipt.receiptNumber} → pending`)
    return { ok: false, skipped: false, reason: 'p12-unreadable', cisStatus: 'pending', environment }
  }

  // ── 6. Build + send ──
  const data = buildCisRacunDataFromReceipt(receipt, settings)
  const result = await send(environment, data, pems)

  const submittedAt = deps.now ?? new Date()
  if (result.ok && result.jir) {
    await dbClient.receipt.update({
      where: { id: receipt.id },
      data: {
        cisStatus: 'submitted',
        cisZki: result.zki ?? '',
        cisJir: result.jir,
        cisSubmittedAt: submittedAt,
      },
    })
    logger.info(
      'CIS',
      `Receipt ${receipt.receiptNumber} fiskaliziran (${environment}) → JIR=${result.jir} [${result.idPoruke ?? '—'}]`
    )
    return {
      ok: true,
      skipped: false,
      cisStatus: 'submitted',
      jir: result.jir,
      zki: result.zki,
      idPoruke: result.idPoruke,
      environment,
    }
  }

  // Neuspeh (poslovna napaka / transport) → pending (retry), ZKI se shrani
  await dbClient.receipt.update({
    where: { id: receipt.id },
    data: {
      cisStatus: 'pending',
      cisZki: result.zki ?? '',
    },
  })
  logger.warn(
    'CIS',
    `Receipt ${receipt.receiptNumber} oddaja NI uspela (${environment})` +
      ` → pending` +
      (result.serverErrorCode ? ` napaka=${result.serverErrorCode}` : '') +
      (result.errorMessage ? ` — ${result.errorMessage}` : '') +
      ` [${result.idPoruke ?? '—'}]`
  )
  return {
    ok: false,
    skipped: false,
    cisStatus: 'pending',
    zki: result.zki,
    idPoruke: result.idPoruke,
    environment,
    serverErrorCode: result.serverErrorCode,
    errorMessage: result.errorMessage,
    validation: result.validation,
  }
}
