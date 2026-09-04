
import { db } from '@/lib/db'
import { deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/api-utils'
import { logger } from '@/lib/logger'
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
    // FIX Test 7.3: Cross-branch access parameter — super-admin can filter by specific locationId
    const requestedLocationId = searchParams.get('locationId') || searchParams.get('branchId')
    // FIX: Paginacija — prepreči nalaganje 100.000+ zapisov
    const rawLimit = parseInt(searchParams.get('limit') || '100')
    const rawOffset = parseInt(searchParams.get('offset') || '0')
    const limit = Math.min(Number.isNaN(rawLimit) ? 100 : rawLimit, 500)
    const offset = Number.isNaN(rawOffset) ? 0 : rawOffset

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (type) where.type = type
    if (paymentStatus) where.paymentStatus = paymentStatus
    if (virtualBrandId) where.virtualBrandId = virtualBrandId

    // FIX Test 7.1: Multi-tenant isolation — filtriraj po session.locationId
    // Če uporabnik ima locationId (non-admin), prikaži samo naročila iz te lokacije
    // Admin (locationId=null) vidi vse lokacije
    if (authResult.session?.locationId) {
      where.locationId = authResult.session.locationId
    } else if (requestedLocationId) {
      // FIX Test 7.3: Super-admin explicitly filtering by a specific branch
      // This is a cross-branch access — audit log it
      where.locationId = requestedLocationId

      // Audit log cross-branch access
      try {
        const { createAuditLog } = await import('@/lib/db')
        const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
        await createAuditLog({
          userId: authResult.session?.employeeId,
          action: 'CROSS_BRANCH_ACCESS',
          entityType: 'Order',
          details: {
            requestedLocationId,
            sessionLocationId: null, // super-admin has null
            endpoint: 'GET /api/orders',
            filterParams: { status, type, paymentStatus },
          },
          ipAddress: clientIp,
        })
      } catch (auditErr) {
        // Audit log failure should not block the request
        logger.warn('AUDIT', 'Failed to log cross-branch access:', auditErr)
      }
    }

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

    // FIX SECURITY v5: Triple-check statusa zaposlenega DIREKTNO v POST handler
    // DEBUG: X-Auth-Check header je dodan na VSE response-e (ne samo 401)
    // da lahko preverimo ali nova koda teče na Vercelu
    const debugHeaders: Record<string, string> = {
      'X-Auth-Check': 'v5-active',
      'X-Auth-EmployeeId': authResult.session?.employeeId || 'none',
    }

    if (authResult.session?.employeeId) {
      const emp = await db.employee.findUnique({
        where: { id: authResult.session.employeeId },
        select: { status: true, name: true },
      })
      debugHeaders['X-Auth-EmployeeStatus'] = emp?.status || 'not_found'
      debugHeaders['X-Auth-EmployeeName'] = emp?.name || 'unknown'

      if (!emp || emp.status !== 'active') {
        return NextResponse.json(
          { error: `Dostop zavrnjen — ${emp?.name || 'račun'} ni več aktiven (status: ${emp?.status || 'not_found'})` },
          { status: 401, headers: { ...debugHeaders, 'X-Auth-Check': 'v5-blocked' } }
        )
      }
    }

    // Dodaj debug headers na uspešen response
    const result = await handlePostOrder(req, authResult as { session?: { employeeId?: string } | null })
    // Kopiraj headers iz result response
    if (result instanceof NextResponse) {
      for (const [key, value] of Object.entries(debugHeaders)) {
        result.headers.set(key, value)
      }
    }
    return result
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/orders', 'Napaka pri ustvarjanju naročila')
  }
}
