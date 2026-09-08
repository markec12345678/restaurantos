
import { db, createAuditLog } from '@/lib/db'
import { deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth, resolveTenantLocationId, tenantScopeToWhere } from '@/lib/auth-middleware'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/api-utils'
import { handlePostOrder } from './_helpers/post-handler'


export const dynamic = 'force-dynamic'
// FIX NAPAKA 5 (HTTP 503): Orders z orderItems include je lahko počasen pri velikih bazah.
export const maxDuration = 30

export async function GET(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = await checkRateLimitAsync('orders', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

    // FIX HIGH: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const paymentStatus = searchParams.get('paymentStatus')
    const virtualBrandId = searchParams.get('virtualBrandId')
    // FIX: Paginacija — prepreči nalaganje 100.000+ zapisov
    const rawLimit = parseInt(searchParams.get('limit') || '100')
    const rawOffset = parseInt(searchParams.get('offset') || '0')
    const limit = Math.min(Number.isNaN(rawLimit) ? 100 : rawLimit, 500)
    const offset = Number.isNaN(rawOffset) ? 0 : rawOffset

    // FIX P0-C2: Centralni tenant scope resolver — fail-closed za regular user brez locationId
    // Prejšnja koda je imela bypass: regular user z locationId=null je lahko poslal ?locationId=loc-b
    const scope = resolveTenantLocationId(authResult.session, searchParams, {
      endpoint: 'GET /api/orders',
      auditLogger: async (entry) => {
        const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
        await createAuditLog({
          userId: entry.employeeId,
          action: 'CROSS_BRANCH_ACCESS',
          entityType: 'Order',
          details: {
            requestedLocationId: entry.requestedLocationId,
            sessionLocationId: entry.sessionLocationId,
            endpoint: entry.endpoint,
            filterParams: { status, type, paymentStatus },
          },
          ipAddress: clientIp,
        })
      },
    })
    if (!scope.ok) return scope.error

    const where: Record<string, unknown> = {
      ...tenantScopeToWhere(scope),
    }
    if (status) where.status = status
    if (type) where.type = type
    if (paymentStatus) where.paymentStatus = paymentStatus
    if (virtualBrandId) where.virtualBrandId = virtualBrandId

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          table: true,
          virtualBrand: { select: { id: true, name: true, code: true, color: true } },
          orderItems: { include: { menuItem: { include: { prepStation: true, category: { include: { menu: true } } } } } },  // FIX FASE 2: prepStation za DB-driven KDS routing
        },
      }),
      db.order.count({ where }),
    ])
    return NextResponse.json({ orders: deepToNumbers(orders), total, limit, offset })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/orders', 'Napaka pri pridobivanju naročil')
  }
}

export async function POST(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = await checkRateLimitAsync('orders', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

    // FIX C-05: Zahtevaj avtentikacijo za ustvarjanje naročil
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    // FIX SECURITY (PII leak): aktivni status-check zaposlenega je ostal, DEBUG headerji
    // (X-Auth-Check/EmployeeId/EmployeeName/EmployeeStatus) so ODSTRANJENI — razkrivali so
    // identiteto in status zaposlenega vsakemu klicatelju (PII + info disclosure).
    if (authResult.session?.employeeId) {
      const emp = await db.employee.findUnique({
        where: { id: authResult.session.employeeId },
        select: { status: true },
      })

      if (!emp || emp.status !== 'active') {
        return NextResponse.json(
          { error: 'Dostop zavrnjen — račun ni več aktiven' },
          { status: 401 }
        )
      }
    }

    return await handlePostOrder(req, authResult as { session?: { employeeId?: string; locationId?: string | null; role?: string } | null })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/orders', 'Napaka pri ustvarjanju naročila')
  }
}
