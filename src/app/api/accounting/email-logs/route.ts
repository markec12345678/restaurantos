// GET /api/accounting/email-logs — Zgodovina poslanih email poročil
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'


export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const reportType = searchParams.get('reportType')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (reportType) where.reportType = reportType

    const rawLimit = parseInt(searchParams.get('limit') || '50')
    const limit = Math.min(Number.isNaN(rawLimit) ? 50 : rawLimit, 200)

    const [logs, total] = await Promise.all([
      db.scheduledEmailLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      db.scheduledEmailLog.count({ where }),
    ])

    return NextResponse.json({ logs, total, limit })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/accounting/email-logs', 'Napaka pri pridobivanju email logov')
  }
}
