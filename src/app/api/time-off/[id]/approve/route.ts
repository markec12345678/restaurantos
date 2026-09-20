// ============================================
// POST /api/time-off/[id]/approve — odobri prošnjo
// ============================================
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { isWithinScope, notInScopeResponse } from '@/lib/tenant-scope'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    // FIX R85-4b MEDIUM: cross-tenant write guard — TimeOffRequest NIMA locationId,
    // scope se izpelje prek employee.locationId. Prej je update({ where: { id } })
    // odobril TUJO prošnjo. Tuja/legacy-NULL prošnja → 404 (ne 403 — ne razkrivamo
    // obstoja); super-admin (null scope) ima globalni nadzor.
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

    const updated = await db.timeOffRequest.update({
      where: { id },
      data: {
        status: 'approved',
        reviewedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, request: updated })
  } catch (err) {
    return handleApiError(err, 'time-off approve')
  }
}
