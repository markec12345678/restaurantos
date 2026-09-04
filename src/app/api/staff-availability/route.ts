// ============================================
// /api/staff-availability — CRUD za razpoložljivost zaposlenih
// ============================================
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  employeeId: z.string().min(1).max(100),
  dayOfWeek: z.number().int().min(0).max(6), // 0=nedelja ... 6=sobota
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'HH:MM'),
  isPreferred: z.boolean().default(true),
  notes: z.string().max(500).default(''),
})

// GET — pridobi razpoložljivost (filter po employeeId)
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const employeeId = searchParams.get('employeeId')

    const where = employeeId ? { employeeId } : {}
    const availability = await db.staffAvailability.findMany({
      where,
      include: { employee: { select: { id: true, name: true } } },
      orderBy: [{ employeeId: 'asc' }, { dayOfWeek: 'asc' }, { startTime: 'asc' }],
    })

    return NextResponse.json({ availability })
  } catch (err) {
    return handleApiError(err, 'staff-availability GET')
  }
}

// POST — kreiraj / posodobi razpoložljivost
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    const body = await req.json().catch(() => ({}))

    // Podpira batch (array) ali single
    const items = Array.isArray(body) ? body : [body]
    const validated = z.array(createSchema).parse(items)

    const results: Array<unknown> = []
    for (const item of validated) {
      const created = await db.staffAvailability.upsert({
        where: {
          employeeId_dayOfWeek_startTime_endTime: {
            employeeId: item.employeeId,
            dayOfWeek: item.dayOfWeek,
            startTime: item.startTime,
            endTime: item.endTime,
          },
        },
        create: {
          employeeId: item.employeeId,
          dayOfWeek: item.dayOfWeek,
          startTime: item.startTime,
          endTime: item.endTime,
          isPreferred: item.isPreferred,
          notes: item.notes,
        },
        update: { isPreferred: item.isPreferred, notes: item.notes },
      })
      results.push(created)
    }

    return NextResponse.json({ success: true, count: results.length, availability: results })
  } catch (err) {
    return handleApiError(err, 'staff-availability POST')
  }
}

// DELETE — izbriši posamezen vnos
export async function DELETE(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id je obvezen' }, { status: 400 })

    await db.staffAvailability.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (err) {
    return handleApiError(err, 'staff-availability DELETE')
  }
}
