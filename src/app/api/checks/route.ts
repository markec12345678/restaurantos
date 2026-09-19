import { db } from '@/lib/db'
import { deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { handleApiError, parsePaginationParams } from '@/lib/api-utils'
import { handlePostCheck } from './_helpers/post-handler'


export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // FIX: Zahtevaj avtentikacijo za branje čekov
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get('orderId')
    const paymentStatus = searchParams.get('paymentStatus')

    // BUG-HUNT FIX 2026-09-19 (HIGH, cross-tenant): prej je where vseboval SAMO
    // orderId/paymentStatus — GET je vračal čeke VSEH lokacij (vključno s
    // plačili in popusti). Enak razred napake kot /api/payments (fix 2026-09-09).
    // FIX R80 (HIGH, fail-closed): prej raw `session?.locationId ?? undefined` —
    // ne-admin z NULL locationId (data-integrity edge) je dobil GLOBALNI pogled
    // (čeki + plačila vseh tenantov), kjer je tako postal nescopecan.
    // Centralni resolver: fail-closed 403 + ignorira ?locationId bypass.
    // Check NIMA lastnega locationId (schema.prisma) — scope gre prek relacije
    // order.locationId (isti relacijski vzorec kot plačila prek check.order).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/checks',
    })
    if ('error' in scope) return scope.error
    const where: Record<string, unknown> = {
      ...(scope.locationId ? { order: { locationId: scope.locationId } } : {}),
    }
    if (orderId) where.orderId = orderId
    if (paymentStatus) where.paymentStatus = paymentStatus

    // FIX HIGH: Paginacija za čeke — prepreči nalaganje tisočih zapisov
    // P1-16: centralna pagination validacija (limit max, offset, search dolžina)
    const { limit, offset } = parsePaginationParams(searchParams)

    const [checks, total] = await Promise.all([
      db.check.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          order: { select: { id: true, orderNumber: true, customerName: true } },
          orderItems: { include: { menuItem: { select: { id: true, name: true } } } },
          payments: true,
          appliedDiscount: true,
        },
      }),
      db.check.count({ where }),
    ])

    return NextResponse.json({ checks: deepToNumbers(checks), total, limit, offset })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/checks', 'Napaka pri pridobivanju čekov')
  }
}

export async function POST(req: Request) {
  try {
    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    return await handlePostCheck(req, authResult as { session?: { employeeId?: string } | null })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/checks', 'Napaka pri ustvarjanju čeka')
  }
}
