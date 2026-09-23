// ============================================
// /api/wallet-payment — Wallet Payments (Apple/Google Pay, NFC)
// ============================================
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { endOfDayParam, handleApiError, parsePaginationParams } from '@/lib/api-utils'
// FIX R112 (RL-2): rate-limit importi — helper po hišnem kanonu DIREKTNO iz
// rate-limit/response (NE prek barrela; barrel mockajo testi brez helperja).
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { z } from 'zod'
import {
  initiateWalletPayment,
  getWalletPaymentStats,
  SUPPORTED_WALLETS,
  SUPPORTED_CURRENCIES,
  type WalletType,
} from '@/lib/wallet-payment'

export const dynamic = 'force-dynamic'

const initiateSchema = z.object({
  walletType: z.enum(SUPPORTED_WALLETS as [WalletType, ...WalletType[]]),
  amount: z.number().positive().max(10000),
  currency: z.enum(SUPPORTED_CURRENCIES as [string, ...string[]]).default('EUR'),
  checkId: z.string().max(100).optional(),
  paymentId: z.string().max(100).optional(),
  deviceId: z.string().max(200).optional(),
  paymentToken: z.string().min(10).max(10000),
  tokenType: z.string().max(50).optional(),
  cardBrand: z.string().max(50).optional(),
  cardLast4: z.string().max(4).optional(),
})

// GET — statistika + seznam plačil
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const stats = searchParams.get('stats') === '1'
    const walletType = searchParams.get('walletType')
    const status = searchParams.get('status')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    // P1-16: centralna pagination validacija (limit max, search dolžina)
    const { limit } = parsePaginationParams(searchParams, { defaultLimit: 50 })

    // R84 fix: ENOKORAČNI scope prek locationId stolpca (schema round) — prej
    // dvokoračen prek checkIds (take 10000, PG bind limit). Legacy NULL zapisi
    // so nevidni lokacijskemu uporabniku (fail-closed) — pozeni
    // scripts/backfill-wallet-outbox-location.ts. Super-admin (brez lokacije)
    // = globalni pogled (nikoli { locationId: null }).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/wallet-payment',
    })
    if ('error' in scope) return scope.error

    if (stats) {
      const from = dateFrom ? new Date(dateFrom) : undefined
      const to = dateTo ? new Date(dateTo) : undefined
      const result = await getWalletPaymentStats(from, to, scope.locationId)
      return NextResponse.json({ stats: result })
    }

    const where: Record<string, unknown> = {}
    if (walletType) where.walletType = walletType
    if (status) where.status = status
    // R84: tenant filter na lastnem stolpcu (enokoračno)
    if (scope.locationId) where.locationId = scope.locationId
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom)
      if (dateTo) (where.createdAt as Record<string, unknown>).lte = endOfDayParam(dateTo) // FIX r35: konec dneva
    }

    const payments = await db.walletPayment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        walletType: true,
        amount: true,
        currency: true,
        status: true,
        transactionId: true,
        cardBrand: true,
        cardLast4: true,
        capturedAt: true,
        refundedAmount: true,
        createdAt: true,
        // paymentToken NAMERNO izpustimo — PCI DSS!
      },
    })

    return NextResponse.json({ payments, count: payments.length })
  } catch (err) {
    return handleApiError(err, 'wallet-payment GET')
  }
}

// POST — iniciiraj plačilo
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    // FIX R112 (RL-2): finančni zapis (iniciacija wallet plačila) —
    // AUTHENTICATED_LIMIT kvota takoj za uspešno avtentikacijo, PRED body parse.
    const rl = await checkRateLimitAsync('authenticated-write', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtev. Poskusite znova čez nekaj časa.')

    const body = await req.json().catch(() => ({}))
    const input = initiateSchema.parse(body)

    // R83 fix: checkId ownership — prej je bil checkId zapisan RAW (brez
    // preverjanja) → wallet plačilo je bilo mogoče povezati s tujim čekom
    // (cross-tenant atribucija prihodkov). Lokacijsko vezan klicatelj: ček
    // MORA biti na njegovi lokaciji; super-admin: samo obstoj.
    // FIX R86-2a (M2 fail-open): centralni resolver — prej raw spread
    // `session?.locationId ?? null` (:115) je regularno NULL-location sejo pustil
    // do globalnega check lookup-a, :132 pa je žigosal NULL lokacijo na plačilo.
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'POST /api/wallet-payment',
    })
    if ('error' in scope) return scope.error

    if (input.checkId) {
      const check = await db.check.findFirst({
        where: {
          id: input.checkId,
          ...(scope.locationId ? { order: { locationId: scope.locationId } } : {}),
        },
        select: { id: true },
      })
      if (!check) {
        return NextResponse.json({ error: 'Ček ni najden ali ni na vaši lokaciji' }, { status: 404 })
      }
    }

    const result = await initiateWalletPayment({
      ...input,
      // R84: tenant stamping — resolver scope (checkId-derived lokacija ima
      // prioriteto v lib; to je fallback za plačila brez čeka). Super-admin brez
      // čeka ostane NULL žig (legacy, viden samo globalnemu pogledu — R85 vzorec).
      locationId: scope.locationId ?? null,
    })

    return NextResponse.json({ success: true, ...result }, { status: 201 })
  } catch (err) {
    return handleApiError(err, 'wallet-payment POST')
  }
}
