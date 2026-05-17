import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, createHaccpSchema } from '@/lib/validations'
import { z } from 'zod'

// GET /api/haccp — Pridobi HACCP vnose
export async function GET(req: Request) {
  try {
    // FIX BUG 12: Zahtevaj avtentikacijo za HACCP
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const where: Record<string, unknown> = {}
    if (category) where.category = category
    if (dateFrom || dateTo) {
      where.date = {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo && { lte: new Date(dateTo) }),
      }
    }

    // FIX MEDIUM: Paginacija za HACCP vnose — prepreči nalaganje vseh zapisov
    const rawLimit = parseInt(searchParams.get('limit') || '200')
    const rawOffset = parseInt(searchParams.get('offset') || '0')
    const limit = Math.min(Number.isNaN(rawLimit) ? 200 : rawLimit, 1000)
    const offset = Number.isNaN(rawOffset) ? 0 : rawOffset

    const [entries, total] = await Promise.all([
      db.haccpEntry.findMany({
        where,
        orderBy: { date: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.haccpEntry.count({ where }),
    ])

    return NextResponse.json({ entries, total, limit, offset })
  } catch (error) {
    console.error('HACCP GET error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju HACCP vnosov' }, { status: 500 })
  }
}

// POST /api/haccp — Dodaj HACCP vnos
export async function POST(req: Request) {
  try {
    // FIX BUG 12: Zahtevaj avtentikacijo za HACCP (admin)
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    // FIX BUG 12: Zod validacija
    const { data, error: validationError } = validateBody(createHaccpSchema, body)
    if (validationError) return validationError

    const entry = await db.haccpEntry.create({
      data: {
        date: data.date ? new Date(data.date) : new Date(),
        category: data.category,
        title: data.title,
        description: data.description,
        value: data.value,
        status: data.status,
        correctiveAction: data.correctiveAction,
        employeeName: data.employeeName || authResult.session?.employeeId || '',
      },
    })

    return NextResponse.json(entry, { status: 201 })
  } catch (error) {
    console.error('HACCP POST error:', error)
    return NextResponse.json({ error: 'Napaka pri dodajanju HACCP vnosa' }, { status: 500 })
  }
}

// PUT /api/haccp — Posodobi HACCP vnos
export async function PUT(req: Request) {
  try {
    // FIX BUG 12: Zahtevaj avtentikacijo za HACCP (admin)
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    // FIX HIGH: Zod validacija za HACCP PUT — prepreči injection
    const haccpUpdateSchema = z.object({
      id: z.string().min(1, 'ID je obvezen'),
      title: z.string().max(200).optional(),
      description: z.string().max(1000).optional(),
      value: z.string().max(200).optional(),
      status: z.enum(['ok', 'warning', 'critical']).optional(),
      correctiveAction: z.string().max(1000).optional(),
      employeeName: z.string().max(100).optional(),
    })
    const parsed = haccpUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({
        error: 'Neveljavni podatki',
        validationErrors: parsed.error.issues.map(e => ({ field: e.path.join('.'), message: e.message })),
      }, { status: 400 })
    }
    const data = parsed.data

    // Preveri, da vnos obstaja
    const existing = await db.haccpEntry.findUnique({ where: { id: data.id } })
    if (!existing) {
      return NextResponse.json({ error: 'HACCP vnos ni najden' }, { status: 404 })
    }

    const entry = await db.haccpEntry.update({
      where: { id: data.id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.value !== undefined && { value: data.value }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.correctiveAction !== undefined && { correctiveAction: data.correctiveAction }),
        ...(data.employeeName !== undefined && { employeeName: data.employeeName }),
      },
    })

    return NextResponse.json(entry)
  } catch (error) {
    console.error('HACCP PUT error:', error)
    return NextResponse.json({ error: 'Napaka pri posodabljanju HACCP vnosa' }, { status: 500 })
  }
}

// DELETE /api/haccp — Izbriši HACCP vnos
export async function DELETE(req: Request) {
  try {
    // FIX BUG 12: Zahtevaj avtentikacijo za HACCP (admin)
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Potreben je ID vnosa' }, { status: 400 })
    }

    await db.haccpEntry.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('HACCP DELETE error:', error)
    return NextResponse.json({ error: 'Napaka pri brisanju HACCP vnosa' }, { status: 500 })
  }
}
