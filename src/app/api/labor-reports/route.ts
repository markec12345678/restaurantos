// ============================================
// /api/labor-reports — Labor analytics
// ============================================
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { z } from 'zod'
import {
  getScheduledVsActualReport,
  getOvertimeReport,
  getAttendanceReport,
} from '@/lib/labor-reports'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
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
        result = await getScheduledVsActualReport(from, to)
        break
      case 'overtime':
        result = await getOvertimeReport(from, to)
        break
      case 'attendance':
        result = await getAttendanceReport(from, to, employeeId)
        break
      default:
        return NextResponse.json({ error: 'Neznan tip poročila' }, { status: 400 })
    }

    return NextResponse.json({ type, ...result })
  } catch (err) {
    return handleApiError(err, 'labor-reports GET')
  }
}
