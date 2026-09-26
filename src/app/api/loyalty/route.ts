
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
// odstranjen prazen import (runda 12 lint cleanup)
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { resolveWriteLocationId } from '@/lib/tenant-scope'
import { createLoyaltySchema } from '@/lib/validations'
import { handleApiError, parsePaginationParams, validateRequest } from '@/lib/api-utils'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = await checkRateLimitAsync('loyalty', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')

    // FIX C-07: Zahtevaj avtentikacijo za zvestobne račune
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error
    const { searchParams } = new URL(req.url)
    const tier = searchParams.get('tier')
    const isActive = searchParams.get('isActive')
    const customerPhone = searchParams.get('customerPhone')

    const where: Record<string, unknown> = {}
    // FIX Test 7.2 + R76 (centralizacija): centralni tenant scope namesto ročnega pogoja
    // (fail-open: session.locationId=null → globalni seznam zvestobnih računov vseh tenantov).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/loyalty',
    })
    if ('error' in scope) return scope.error
    if (scope.locationId) {
      where.locationId = scope.locationId
    }
    if (tier) where.tier = tier
    if (isActive !== null) where.isActive = isActive === 'true'
    if (customerPhone) where.customerPhone = customerPhone

    // FIX HIGH: Paginacija z NaN varnostjo — prepreči nalaganje preveč zapisov
    // P1-16: centralna pagination validacija (limit max, offset, search dolžina)
    const { limit, offset, search } = parsePaginationParams(searchParams)

    // R143-b (epic #115 #30, kontrakt (a)): `search` je bil prej parsan a
    // IGNORIRAN → iskanje v plačilnem dialogu (usePaymentQueries pošilja
    // GET /api/loyalty?search=…) je vračalo NEFILTRIRAN seznam. Zdaj: OR
    // contains (insensitive) na imenu/telefonu/e-pošti, KOMPOZIBILNO z
    // obstoječimi filtri tier/isActive/customerPhone in scope-om zgoraj.
    // Trim ≥ 1 znak; dolžina je že omejena na 100 (P1-16 MAX_SEARCH_LENGTH).
    const trimmedSearch = search.trim()
    if (trimmedSearch.length > 0) {
      where.OR = [
        { customerName: { contains: trimmedSearch, mode: 'insensitive' } },
        { customerPhone: { contains: trimmedSearch, mode: 'insensitive' } },
        { customerEmail: { contains: trimmedSearch, mode: 'insensitive' } },
      ]
    }

    const [accounts, total] = await Promise.all([
      db.loyaltyAccount.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          transactions: { orderBy: { createdAt: 'desc' }, take: 10 },
        },
      }),
      db.loyaltyAccount.count({ where }),
    ])

    // R143-b: no-store — živi podatki o točkah (plačilni dialog attach),
    // nikoli cache-friendly (kanon briefing/loyalty-lifecycle).
    return NextResponse.json(
      { accounts, total, limit, offset },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/loyalty', 'Napaka pri pridobivanju zvestobnih računov')
  }
}

export async function POST(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = await checkRateLimitAsync('loyalty', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')

    // FIX C-07: Zahtevaj avtentikacijo za ustvarjanje zvestobnega računa
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    // FIX R86-5 (MEDIUM, M2 razred): raw `session?.locationId || null` je bil
    // NULL-stamp za regular uporabnika brez lokacije (globalni račun + preskočen
    // duplikat check). Canonical resolver: regular-null → 403, super-admin
    // ?locationId → izrecna lokacija, brez → 400 fail-closed (MODEL A vzorec
    // expenses R85-FINAL).
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'POST /api/loyalty',
    })
    if ('error' in scope) return scope.error
    const locRes = resolveWriteLocationId(scope.locationId)
    if (!locRes.ok) return locRes.response

    // FIX SECURITY: validateRequest() prepreči DoS z oversized payload
    const { data, error: validationError } = await validateRequest(req, createLoyaltySchema)
    if (validationError) return validationError

    // P1-6/P1-7: račun zvestobe je VEZAN NA LOKACIJO (P0-C4 per-location loyalty) —
    // lokacija izpeljana iz scope-a (regular/admin s lokacijo) ali izrecnega
    // super-admin ?locationId (zgornji resolver + resolveWriteLocationId).
    const loyaltyLocationId = locRes.locationId

    // P1-7: telefon je unikaten PO LOKACIJI (ne globalno) — isti gost ima lahko
    // račun na več lokacijah. Preveri duplikat pred create (pregnosen P2002 → 400).
    const duplicate = await db.loyaltyAccount.findFirst({
      where: { customerPhone: data.customerPhone, locationId: loyaltyLocationId },
      select: { id: true },
    })
    if (duplicate) {
      return NextResponse.json({ error: 'Račun zvestobe s to telefonsko številko že obstaja na tej lokaciji' }, { status: 409 })
    }

    // FIX HIGH: Server nadzoruje začetne točke — klient NE more nastaviti pointsBalance/lifetimePoints
    const account = await db.loyaltyAccount.create({
      data: {
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail || '',
        pointsBalance: 0, // FIX: Vedno začni z 0 — pridobivanje točk gre skozi loyalty earn API
        lifetimePoints: 0, // FIX: Vedno začni z 0
        tier: 'bronze', // FIX: Nov račun vedno začne kot bronze
        isActive: data.isActive,
        locationId: loyaltyLocationId,
      },
      include: {
        transactions: true,
      },
    })

    return NextResponse.json(account, { status: 201 })
  } catch (error: unknown) {
    // R107 (PO-2 parity): duplikat check-then-act race — dva sočasna POST-a
    // z istim telefonom na isti lokaciji oba preženeta findFirst pregled,
    // DB delni unique indeks (customerPhone <> '' AND locationId IS NOT NULL)
    // strese P2002 → prej 500, sedaj 409 (nikoli 500 na race-pathu).
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Račun zvestobe s to telefonsko številko že obstaja na tej lokaciji' },
        { status: 409 }
      )
    }
    return handleApiError(error, 'POST /api/loyalty', 'Napaka pri ustvarjanju zvestobnega računa')
  }
}
