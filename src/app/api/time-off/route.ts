// ============================================
// /api/time-off — CRUD za prošnje za dopust
// ============================================
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  employeeId: z.string().min(1).max(100),
  type: z.enum(['vacation', 'sick', 'personal', 'holiday', 'unpaid']).default('vacation'),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  reason: z.string().max(500).default(''),
})

// GET — pridobi prošnje (filter po employeeId, status, datum)
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const employeeId = searchParams.get('employeeId')
    const status = searchParams.get('status')
    const upcoming = searchParams.get('upcoming') === '1'

    const where: Record<string, unknown> = {}
    if (employeeId) where.employeeId = employeeId
    if (status) where.status = status
    if (upcoming) where.endDate = { gte: new Date() }

    const requests = await db.timeOffRequest.findMany({
      where,
      include: { employee: { select: { id: true, name: true } } },
      orderBy: { startDate: 'desc' },
    })

    return NextResponse.json({ requests })
  } catch (err) {
    return handleApiError(err, 'time-off GET')
  }
}

// POST — kreiraj prošnjo
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    const body = await req.json().catch(() => ({}))
    const input = createSchema.parse(body)

    // Validacija: endDate >= startDate
    const start = new Date(input.startDate)
    const end = new Date(input.endDate)
    if (end < start) {
      return NextResponse.json({ error: 'endDate mora biti po startDate' }, { status: 400 })
    }

    const request = await db.timeOffRequest.create({
      data: {
        employeeId: input.employeeId,
        type: input.type,
        startDate: start,
        endDate: end,
        reason: input.reason,
        status: 'pending',
      },
      include: { employee: { select: { id: true, name: true } } },
    })

    return NextResponse.json({ success: true, request })
  } catch (err) {
    return handleApiError(err, 'time-off POST')
  }
}
