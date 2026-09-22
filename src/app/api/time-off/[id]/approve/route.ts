// ============================================
// POST /api/time-off/[id]/approve — odobri prošnjo
// ============================================
// R107 TO-1: NEPOGOJEN update zamenjan s CAS state machine kanonom
// (reviewTimeOffRequest v ../_helpers.ts): samo pending → approved; replay
// (že odobrena) → 200 brez overwrite-a revizijskih polj; konflikt (rejected/
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

    // FIX R85-4b MEDIUM: cross-tenant write guard — TimeOffRequest NIMA locationId,
    // scope se izpelje prek employee.locationId. Tuja/legacy-NULL prošnja → 404
    // (ne 403 — ne razkrivamo obstoja); super-admin (null scope) = globalni nadzor.
    // R107: fast-path 404 stopnica — avtoritativna prevrstava je CAS v helperju
    // (scope je znotraj where → scope drift med readom in pisanjem nemogoč).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'POST /api/time-off/[id]/approve',
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

    // R107 TO-1: CAS pending → approved (+reviewedBy) — replay 200 / konflikt 409
    const result = await reviewTimeOffRequest({
      id,
      decision: 'approve',
      sessionLocationId: scope.locationId,
      reviewedBy: authResult.session?.employeeId ?? null,
    })

    return NextResponse.json({
      success: true,
      request: result.request,
      ...(result.replay ? { replay: true } : {}),
    })
  } catch (err) {
    return structuredErrorResponse(err, 'POST /api/time-off/[id]/approve', 'Napaka pri odobritvi prošnje')
  }
}
