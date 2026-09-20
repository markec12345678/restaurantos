// ============================================
// /api/labor-reports — Labor analytics
// ============================================
import { NextResponse } from 'next/server'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { z } from 'zod'
import {
  getScheduledVsActualReport,
  getOvertimeReport,
  getAttendanceReport,
} from '@/lib/labor-reports'

export const dynamic = 'force-dynamic'

const _querySchema = z.object({
  type: z.enum(['scheduled_vs_actual', 'overtime', 'attendance']),
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime(),
  employeeId: z.string().optional(),
})

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)

    // FIX R85-4b MEDIUM: Tenant scope — prej so helperji v '@/lib/labor-reports'
    // agregirali StaffShift/TimeEntry VSEH tenantov (plače, urni postavki in
    // PII zaposlenih čez tenant-e). Fail-closed za regular uporabnika brez
    // lokacije; null scope (super-admin) = globalni pogled.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/labor-reports',
    })
    if ('error' in scope) return scope.error

    const type = searchParams.get('type') || 'scheduled_vs_actual'
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const employeeId = searchParams.get('employeeId') || undefined

    if (!dateFrom || !dateTo) {
      return NextResponse.json({ error: 'dateFrom in dateTo sta obvezna' }, { status: 400 })
    }

    const from = new Date(dateFrom)
    const to = new Date(dateTo)

    let result
    switch (type) {
      case 'scheduled_vs_actual':
        result = await getScheduledVsActualReport(from, to, scope.locationId)
        break
      case 'overtime':
        result = await getOvertimeReport(from, to, scope.locationId)
        break
      case 'attendance':
        result = await getAttendanceReport(from, to, employeeId, scope.locationId)
        break
      default:
        return NextResponse.json({ error: 'Neznan tip poročila' }, { status: 400 })
    }

    return NextResponse.json({ type, ...result })
  } catch (err) {
    return handleApiError(err, 'labor-reports GET')
  }
}
