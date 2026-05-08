import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/haccp — Pridobi HACCP vnose
export async function GET(req: Request) {
  try {
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
    const body = await req.json()

    const entry = await db.haccpEntry.create({
      data: {
        date: body.date ? new Date(body.date) : new Date(),
        category: body.category,       // temperature, cleaning, delivery, cooling, training
        title: body.title,
        description: body.description || '',
        value: body.value || '',        // Meritev (npr. "4.2°C", "Čiščenje opravljeno")
        status: body.status || 'ok',    // ok, warning, critical
        correctiveAction: body.correctiveAction || '',
        employeeName: body.employeeName || '',
      },
    })

    return NextResponse.json(entry)
  } catch (error) {
    console.error('HACCP POST error:', error)
    return NextResponse.json({ error: 'Napaka pri dodajanju HACCP vnosa' }, { status: 500 })
  }
}

// PUT /api/haccp — Posodobi HACCP vnos
export async function PUT(req: Request) {
  try {
    const body = await req.json()

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
