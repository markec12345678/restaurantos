import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'

// =====================================================================
// OPENING HOURS API — CRUD za delovni čas lokacij
// Podpora za urnike po dnevih s premori
// =====================================================================

const openingHoursSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  openTime: z.string().max(10).default('08:00'),
  closeTime: z.string().max(10).default('22:00'),
  breakStart: z.string().max(10).default(''),
  breakEnd: z.string().max(10).default(''),
  isClosed: z.boolean().default(false),
  locationId: z.string().nullable().optional(),
})

const batchSchema = z.object({
  hours: z.array(openingHoursSchema).min(1).max(7),
  locationId: z.string().nullable().optional(),
})

// GET /api/opening-hours
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const url = new URL(req.url)
    const locationId = url.searchParams.get('locationId')

    const where = locationId ? { locationId } : {}
    const hours = await db.openingHours.findMany({
      where,
      orderBy: { dayOfWeek: 'asc' },
    })

    return NextResponse.json({ hours })
  } catch (error) {
    console.error('Opening hours GET error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju delovnega časa' }, { status: 500 })
  }
}

// POST /api/opening-hours — Ustvari en dan ali batch 7 dni
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    // Batch creation (7 days at once)
    if (body.hours && Array.isArray(body.hours)) {
      const parsed = batchSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: 'Neveljavni podatki', validationErrors: parsed.error.issues }, { status: 400 })
      }

      // Delete existing hours for this location and recreate
      const locId = parsed.data.locationId
      if (locId) {
        await db.openingHours.deleteMany({ where: { locationId: locId } })
      } else {
        await db.openingHours.deleteMany({ where: { locationId: null } })
      }

      const created = await db.openingHours.createMany({
        data: parsed.data.hours.map(h => ({
          ...h,
          locationId: locId,
        })),
      })

      return NextResponse.json({ created: created.count }, { status: 201 })
    }

    // Single day creation
    const parsed = openingHoursSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Neveljavni podatki', validationErrors: parsed.error.issues }, { status: 400 })
    }

    const hours = await db.openingHours.create({ data: parsed.data })
    return NextResponse.json(hours, { status: 201 })
  } catch (error) {
    console.error('Opening hours POST error:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju delovnega časa' }, { status: 500 })
  }
}
