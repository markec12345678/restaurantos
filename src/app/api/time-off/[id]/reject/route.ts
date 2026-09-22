// ============================================
// POST /api/time-off/[id]/reject — zavrn prošnjo
// ============================================
// R107 TO-1: NEPOGOJEN update zamenjan s CAS state machine kanonom
// (reviewTimeOffRequest v ../_helpers.ts): samo pending → rejected; replay
// (že zavrnjena) → 200 brez overwrite-a revizijskih polj; konflikt (approved/
// cancelled) → 409; reviewedBy je sedaj zapisan (revizijska vrzel).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { isWithinScope, notInScopeResponse } from '@/lib/tenant-scope'
import { structuredErrorResponse } from '@/lib/structured-error'
import { reviewTimeOffRequest } from '../_helpers'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    // FIX R85-4b MEDIUM: cross-tenant write guard (pariteta z approve ruto).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'POST /api/time-off/[id]/reject',
    })
    if ('error' in scope) return scope.error

    const { id } = await params

    const request = await db.timeOffRequest.findUnique({
      where: { id },
      select: { id: true, employee: { select: { locationId: true } } },
    })
    if (!request || !isWithinScope(scope.locationId, request.employee.locationId)) {
      return notInScopeResponse('Prošnja za dopust')
    }

    // R107 TO-1: CAS pending → rejected (+reviewedBy) — replay 200 / konflikt 409
    const result = await reviewTimeOffRequest({
      id,
      decision: 'reject',
      sessionLocationId: scope.locationId,
      reviewedBy: authResult.session?.employeeId ?? null,
    })

    return NextResponse.json({
      success: true,
      request: result.request,
      ...(result.replay ? { replay: true } : {}),
    })
  } catch (err) {
    return structuredErrorResponse(err, 'POST /api/time-off/[id]/reject', 'Napaka pri zavrnitvi prošnje')
  }
}
