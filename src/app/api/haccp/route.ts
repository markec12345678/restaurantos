import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, createHaccpSchema } from '@/lib/validations'

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

    const entries = await db.haccpEntry.findMany({
      where,
      orderBy: { date: 'desc' },
    })

    return NextResponse.json(entries)
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

    if (!body.id) {
      return NextResponse.json({ error: 'Potreben je ID vnosa' }, { status: 400 })
    }

    const entry = await db.haccpEntry.update({
      where: { id: body.id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.value !== undefined && { value: body.value }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.correctiveAction !== undefined && { correctiveAction: body.correctiveAction }),
        ...(body.employeeName !== undefined && { employeeName: body.employeeName }),
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
