
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { updateTableSchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Auth check
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(updateTableSchema, bodyResult.data)
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
        // FIX BUG-01 HIGH: Vizualni tloris — uporabljaj validirane podatke iz Zod (data), ne raw body
        ...(data.posX !== undefined && { posX: data.posX }),
        ...(data.posY !== undefined && { posY: data.posY }),
        ...(data.width !== undefined && { width: data.width }),
        ...(data.height !== undefined && { height: data.height }),
        ...(data.shape !== undefined && { shape: data.shape }),
        ...(data.rotation !== undefined && { rotation: data.rotation }),
      },
    })
    return NextResponse.json(table)
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json(
        { error: 'Miza s to številko že obstaja' },
        { status: 409 }
      )
    }
    return handleApiError(error, 'PUT /api/tables/[id]', 'Napaka pri posodobitvi mize')
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
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/tables/[id]', 'Napaka pri brisanju mize')
  }
}
