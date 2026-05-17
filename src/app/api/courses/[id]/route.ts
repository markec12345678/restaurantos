import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // FIX: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const body = await req.json()

    const updateData: Record<string, unknown> = {}

    if (body.action === 'fire') {
      updateData.status = 'fired'
      updateData.firedAt = new Date()
      await db.orderItem.updateMany({
        where: { courseId: id },
        data: { status: 'fired' },
      })
    } else if (body.action === 'ready') {
      updateData.status = 'ready'
      updateData.readyAt = new Date()
      await db.orderItem.updateMany({
        where: { courseId: id },
        data: { status: 'ready' },
      })
    } else if (body.action === 'served') {
      updateData.status = 'served'
      updateData.servedAt = new Date()
      await db.orderItem.updateMany({
        where: { courseId: id },
        data: { status: 'served' },
      })
    } else {
      if (body.name !== undefined) updateData.name = body.name
      if (body.courseNumber !== undefined) updateData.courseNumber = body.courseNumber
      if (body.pacingNote !== undefined) updateData.pacingNote = body.pacingNote
    }

    const course = await db.course.update({
      where: { id },
      data: updateData,
      include: { orderItems: { include: { menuItem: true } } },
    })

    return NextResponse.json(course)
  } catch (error) {
    console.error('Napaka pri posodabljanju kursa:', error)
    return NextResponse.json({ error: 'Napaka pri posodabljanju kursa' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // FIX: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { id } = await params
    // Remove course from order items
    await db.orderItem.updateMany({
      where: { courseId: id },
      data: { courseId: null },
    })
    await db.course.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Napaka pri brisanju kursa:', error)
    return NextResponse.json({ error: 'Napaka pri brisanju kursa' }, { status: 500 })
  }
}
