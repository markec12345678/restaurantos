// GET /api/accounting/journal-entries — seznam knjigovodskih vnosov
import { db } from '@/lib/db'
import { deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'


export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const referenceType = searchParams.get('referenceType')
    // FIX issue #31: opcijsko filtriranje po lokaciji za multi-location accounting
    const locationId = searchParams.get('locationId')

    const where: Record<string, unknown> = {}
    if (referenceType) where.referenceType = referenceType
    if (locationId) where.locationId = locationId
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, Date> = {}
      if (dateFrom) dateFilter.gte = new Date(dateFrom)
      if (dateTo) dateFilter.lte = new Date(dateTo + 'T23:59:59')
      where.date = dateFilter
    }

    const rawLimit = parseInt(searchParams.get('limit') || '100')
    const rawOffset = parseInt(searchParams.get('offset') || '0')
    const limit = Math.min(Number.isNaN(rawLimit) ? 100 : rawLimit, 500)
    const offset = Number.isNaN(rawOffset) ? 0 : rawOffset

    const [entries, total] = await Promise.all([
      db.journalEntry.findMany({
        where,
        orderBy: { date: 'desc' },
        take: limit,
        skip: offset,
        include: { lines: true, location: { select: { id: true, name: true, code: true } } },
      }),
      db.journalEntry.count({ where }),
    ])

    return NextResponse.json({ entries: deepToNumbers(entries), total, limit, offset })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/accounting/journal-entries', 'Napaka pri pridobivanju knjigovodskih vnosov')
  }
}
