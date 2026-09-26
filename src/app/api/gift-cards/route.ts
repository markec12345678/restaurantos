
import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { resolveWriteLocationId } from '@/lib/tenant-scope'
import { createGiftCardSchema } from '@/lib/validations'
import { greaterThan, toNum, deepToNumbers } from '@/lib/decimal'
import { giftCardLast4 } from '@/lib/gift-cards/constants'
import { GIFT_CARD_SELECT, GIFT_CARD_TRANSACTION_SELECT } from './_helpers/gift-card-select'
import { logger } from '@/lib/logger'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { handleApiError, parsePaginationParams, validateRequest } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = await checkRateLimitAsync('gift-cards', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')

    // FIX C-07: Zahtevaj avtentikacijo za darilne kartice
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const cardNumber = searchParams.get('cardNumber')

    const where: Record<string, unknown> = {}
    // FIX Test 7.2 + R76 (centralizacija): centralni tenant scope namesto ročnega pogoja
    // (fail-open: session.locationId=null → globalni seznam darilnih kartic vseh tenantov).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/gift-cards',
    })
    if ('error' in scope) return scope.error
    if (scope.locationId) {
      where.locationId = scope.locationId
    }
    if (status) where.status = status
    if (cardNumber) where.cardNumber = cardNumber

    // FIX HIGH: Paginacija z NaN varnostjo — prepreči nalaganje preveč zapisov
    // P1-16: centralna pagination validacija (limit max, offset, search dolžina)
    const { limit, offset } = parsePaginationParams(searchParams)

    // R144-b: SELECT whitelist (GIFT_CARD_SELECT kanon R142-b/R140-b) — prej
    // include polnih vrstic; whitelist je edina obramba proti uhaju polj, ki
    // jih UI ne bere (payments relacija, prihodnji stolpci). Response shape
    // { giftCards, total, limit, offset } NESESPEMLJENA (UI/prefetch/plačilni
    // dialog konsumenti — polja ostanejo 1:1).
    const [giftCards, total] = await Promise.all([
      db.giftCard.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          ...GIFT_CARD_SELECT,
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: GIFT_CARD_TRANSACTION_SELECT,
          },
        },
      }),
      db.giftCard.count({ where }),
    ])

    // R144-b: Cache-Control no-store (denarni pregled, ni cache-friendly —
    // kanon R142/R143 za vse avtenticirane liste).
    return NextResponse.json(
      { giftCards: deepToNumbers(giftCards), total, limit, offset },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/gift-cards', 'Failed to fetch gift cards')
  }
}

export async function POST(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = await checkRateLimitAsync('gift-cards', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')

    // FIX C-07: Zahtevaj avtentikacijo za ustvarjanje darilne kartice
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    // FIX SECURITY: validateRequest() prepreči DoS z oversized payload
    const { data, error: validationError } = await validateRequest(req, createGiftCardSchema)
    if (validationError) return validationError

    // FIX R85-4c NULL-stamp: prej je create NIKOLI žigosal locationId → legacy NULL
    // vrstica = globalno vidna (GET filter je namesto nje slepa). Zdaj: MODEL A
    // resolveWriteLocationId — regular user / lokacijski admin = session lokacija
    // (body se ignorira); super-admin (scope null) MORA podati izrecen locationId,
    // sicer 400 fail-closed (nikoli več NULL kartice).
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'POST /api/gift-cards',
    })
    if ('error' in scope) return scope.error
    const writeLoc = resolveWriteLocationId(scope.locationId, data.locationId)
    if (!writeLoc.ok) return writeLoc.response

    // Atomna transakcija: ustvari kartico + začetno transakcijo
    const giftCard = await db.$transaction(async (tx) => {
      const card = await tx.giftCard.create({
        data: {
          cardNumber: data.cardNumber,
          balance: data.balance,
          initialBalance: data.initialBalance ?? data.balance,
          status: data.status,
          ownerName: data.ownerName,
          purchasedAt: new Date(),
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
          locationId: writeLoc.locationId,
        },
      })

      // Ustvari začetno transakcijo nalaganja
      // FIX R69: greaterThan namesto isPositive — decimal.js isPositive() je
      // true TUDI za 0 (preverja PREDZNAK, ne > 0)! Prej je kartica s stanjem 0
      // dobila lažno transakcijo "load, 0, Začetno nalaganje" → umazana
      // zgodovina + gift-card-guard jo je napačno blokiral pred brisanjem.
      if (greaterThan(card.balance, 0)) {
        await tx.giftCardTransaction.create({
          data: {
            giftCardId: card.id,
            type: 'load',
            amount: card.balance,
            balanceAfter: card.balance,
            note: 'Začetno nalaganje',
          },
        })
      }

      // R144-b: audit V ISTEM tx (createAuditLog(entry, tx) kanon — feedback
      // ruta; hash veriga bere/piše v isti transakciji, audit obstaja ⇔ kartica
      // obstaja). PII kanon: NIKOLI poln cardNumber (spendable secret) — samo
      // last4 prek giftCardLast4(); locationId iz entitete (R81 kanon).
      await createAuditLog({
        userId: authResult.session?.employeeId,
        action: 'GIFT_CARD_CREATED',
        entityType: 'GiftCard',
        entityId: card.id,
        details: {
          cardLast4: giftCardLast4(card.cardNumber),
          initialBalance: toNum(card.initialBalance),
          expiresAt: card.expiresAt ? card.expiresAt.toISOString() : null,
          ownerName: card.ownerName,
          // pariteta feedback rute: lokacija v detailsah IN kot entry polje
          locationId: card.locationId,
        },
        locationId: card.locationId,
      }, tx)

      return card
    })

    // Re-fetch z transakcijami
    const result = await db.giftCard.findUnique({
      where: { id: giftCard.id },
      include: { transactions: true },
    })

    return NextResponse.json(deepToNumbers(result), { status: 201 })
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json(
        { error: `Darilna kartica s to številko že obstaja` },
        { status: 409 }
      )
    }
    // FIX CRITICAL: Ne izpostavljaj error.message — interno stanje (Prisma, DB) ne sme biti vidno klientu
    logger.error('API', 'Failed to create gift card:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju darilne kartice' }, { status: 500 })
  }
}
