import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, updateTableSchema } from '@/lib/validations'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(updateTableSchema, body)
    if (validationError) return validationError

    // Preveri, da miza obstaja
    const existing = await db.table.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Miza ni najdena' }, { status: 404 })
    }

    const table = await db.table.update({
      where: { id },
      data: {
        ...(data.number !== undefined && { number: data.number }),
        ...(data.capacity !== undefined && { capacity: data.capacity }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.area !== undefined && { area: data.area }),
      },
    })
    return NextResponse.json(table)
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Miza s to številko že obstaja' },
        { status: 409 }
      )
    }
    console.error('Napaka pri posodobitvi mize:', error)
    return NextResponse.json({ error: 'Napaka pri posodobitvi mize' }, { status: 500 })
  }
}

// FIX H-06: Soft-delete z preverjanjem aktivnih naročil
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const table = await db.table.findUnique({
      where: { id },
      include: { orders: { where: { status: { in: ['pending', 'in-progress', 'ready'] } } } },
    })

    if (!table) {
      return NextResponse.json({ error: 'Miza ni najdena' }, { status: 404 })
    }

    // Preveri, da nima aktivnih naročil
    if (table.orders.length > 0) {
      return NextResponse.json(
        { error: 'Miza ima aktivna naročila — je ni mogoče izbrisati. Najprej zaključite ali prekličite naročila.' },
        { status: 400 }
      )
    }

    // Hard-delete je varen, ker ni aktivnih naročil
    await db.table.delete({ where: { id } })

    return NextResponse.json({ success: true, message: 'Miza izbrisana' })
  } catch (error) {
    console.error('Napaka pri brisanju mize:', error)
    return NextResponse.json({ error: 'Napaka pri brisanju mize' }, { status: 500 })
  }
}
