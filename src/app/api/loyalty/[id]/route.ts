import { db } from '@/lib/db'
import { deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { updateLoyaltySchema } from '@/lib/validations'
import { parseJsonBody, validateBody } from '@/lib/api-utils'
import { canDeleteLoyaltyAccount } from '@/lib/loyalty-guard'
import { structuredErrorResponse } from '@/lib/structured-error'
import { triggerTierUpgrade } from '@/lib/loyalty-automation'
import { updateLoyaltyAccountWithLock } from '../_helpers/points-mutations'
import { logger } from '@/lib/logger'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error
    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error
    // FIX R86-5 (HIGH, M2 razred): raw `session?.locationId ?? undefined` je bil
    // fail-OPEN za regular uporabnika brez lokacije (prazen filter = globalni
    // findFirst → cross-tenant branje/pisanje točk, tier + SMS). Canonical
    // resolver: regular-null → 403, super-admin (null) = globalni pogled.
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'PUT /api/loyalty/[id]',
    })
    if ('error' in scope) return scope.error
    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(updateLoyaltySchema, bodyResult.data)
    if (validationError) return validationError
    // FIX IDOR (tenant scope): findUnique → findFirst z locationId scope (cross-tenant zaščita).
    // R107: fast-path 404 stopnica — avtoritativni pisalni tok je kanon
    // (updateLoyaltyAccountWithLock) s tx-fresh scoped re-read.
    const existing = await db.loyaltyAccount.findFirst({
      where: { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Zvestobni račun ni najden' }, { status: 404 })
    }

    // R107 LO-1/LO-2/LO-3 (HIGH, kanon R106/R105/R104): ročna prilagoditev
    // točk pod pg_advisory_xact_lock('loyalty-points:' + id) + Serializable +
    // tx-fresh re-read — diff izračunan IZ SVEŽEGA stanja (prej stale read
    // izven tx: dva sočasna "nastavi na 100" = dvojna delta / lost update);
    // unovčenje ima atomarni gte guard; audit zapis + tier upgrade s svežimi
    // vrednostmi; strukturirani { error, status } throw-i.
    const { tierUpgrade } = await updateLoyaltyAccountWithLock({
      loyaltyAccountId: id,
      sessionLocationId: scope.locationId,
      data,
    })

    // RUNDA 61: SMS o napredovanju — šele PO commitu (nikoli znotraj
    // transakcije: HTTP klic ne sme blokirati/zapreti DB transakcije) in
    // fire-and-forget: spodleteli SMS NIKOLI ne pokvari uspešnega adjusta.
    if (tierUpgrade) {
      void triggerTierUpgrade(id, tierUpgrade.from, tierUpgrade.to).catch((err: unknown) => {
        logger.warn('LOYALTY', `Nivo-upgrade SMS spodletel (ne kritično): ${err instanceof Error ? err.message : String(err)}`)
      })
    }

    // Re-fetch z transakcijami (FIX IDOR: tudi tukaj locationId scope)
    const account = await db.loyaltyAccount.findFirst({
      where: { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
      include: { transactions: { orderBy: { createdAt: 'desc' }, take: 10 } },
    })
    if (!account) {
      return NextResponse.json({ error: 'Zvestobni račun ni najden' }, { status: 404 })
    }
    // RUNDA 61: klient dobi flag za celebrate toast ("stranka napredovala!")
    const response = deepToNumbers(account) as Record<string, unknown>
    if (tierUpgrade) response.tierUpgrade = tierUpgrade
    return NextResponse.json(response)
  } catch (error: unknown) {
    // R107 (error kontrakt): P2002/P2034 race-pathi → 409 (nikoli 500);
    // strukturirani { error, status } throw-i iz tx teles (404/400) → pravi
    // statusi (prej: string-matching na error sporočilih).
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2002' || error.code === 'P2034')
    ) {
      return NextResponse.json(
        { error: 'Prilagoditev točk je v obdelavi (sočasen dostop) — poskusite znova' },
        { status: 409 }
      )
    }
    return structuredErrorResponse(error, 'PUT /api/loyalty/[id]', 'Napaka pri posodobitvi zvestobnega računa')
  }
}

// ============================================
// RUNDA 69: DELETE /api/loyalty/[id] — brisanje zvestobnega računa
// Zaščita (loyalty-guard, ENOTEN VIR z UI dialogom): račun z transakcijami
// (zgodovina točk, FK Restrict) ali točkami > 0 je BLOKIRAN (409) s predlogom
// deaktivacije (isActive=false prek PUT); prazen račun se izbriše.
// Prej: endpoint ni obstajal → UI delete gumb = vedno 405, dialog pa je
// LAŽNO trdil, da "bodo transakcije izbrisane".
// ============================================
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Brisanje računa z zgodovino točk je admin akcija
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error
    // FIX R86-5 (HIGH, M2 razred): raw `?? undefined` fail-open za regular-null
    // seja → cross-tenant DELETE. Canonical resolver (isti vzorec kot PUT).
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'DELETE /api/loyalty/[id]',
    })
    if ('error' in scope) return scope.error
    const { id } = await params
    // IDOR zaščita: isti scope vzorec kot PUT zgoraj (session location)
    const existing = await db.loyaltyAccount.findFirst({
      where: { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Zvestobni račun ni najden' }, { status: 404 })
    }
    const txnCount = await db.loyaltyTransaction.count({ where: { loyaltyAccountId: id } })
    const decision = canDeleteLoyaltyAccount(txnCount, existing.pointsBalance)
    if (!decision.allowed) {
      return NextResponse.json({ error: decision.messageSl }, { status: decision.status })
    }
    await db.loyaltyAccount.delete({ where: { id } })
    return NextResponse.json({ ok: true, id })
  } catch (error: unknown) {
    return structuredErrorResponse(error, 'DELETE /api/loyalty/[id]', 'Napaka pri brisanju zvestobnega računa')
  }
}
