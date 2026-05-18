import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'

// =====================================================================
// OPENING HOURS [ID] — Posodobi/izbriši posamezen dan
// =====================================================================

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const body = await req.json()

    const hours = await db.openingHours.update({
      where: { id },
      data: {
        ...(body.openTime !== undefined && { openTime: body.openTime }),
        ...(body.closeTime !== undefined && { closeTime: body.closeTime }),
        ...(body.breakStart !== undefined && { breakStart: body.breakStart }),
        ...(body.breakEnd !== undefined && { breakEnd: body.breakEnd }),
        ...(body.isClosed !== undefined && { isClosed: body.isClosed }),
      },
    })

    return NextResponse.json(hours)
  } catch (error) {
    console.error('Opening hours PATCH error:', error)
    return NextResponse.json({ error: 'Napaka pri posodabljanju' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { id } = await params
    await db.openingHours.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Opening hours DELETE error:', error)
    return NextResponse.json({ error: 'Napaka pri brisanju' }, { status: 500 })
  }
}
