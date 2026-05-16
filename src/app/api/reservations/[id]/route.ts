// ============================================
// REZERVACIJA — Posodobi / Izbriši
// ============================================

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'

// PUT - Posodobi rezervacijo
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    const existing = await db.reservation.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Rezervacija ne obstaja' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (body.status) {
      updateData.status = body.status

      // Samodejne spremembe glede na status
      if (body.status === 'seated') {
        updateData.actualArrival = new Date()
      } else if (body.status === 'completed') {
        updateData.actualDeparture = new Date()
      } else if (body.status === 'confirmed') {
        updateData.confirmedAt = new Date()
      }
    }

    if (body.customerName !== undefined) updateData.customerName = body.customerName
    if (body.customerPhone !== undefined) updateData.customerPhone = body.customerPhone
    if (body.customerEmail !== undefined) updateData.customerEmail = body.customerEmail
    if (body.tableId !== undefined) updateData.tableId = body.tableId || null
    if (body.dateTime !== undefined) updateData.dateTime = new Date(body.dateTime)
    if (body.partySize !== undefined) updateData.partySize = body.partySize
    if (body.duration !== undefined) updateData.duration = body.duration
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.specialRequests !== undefined) updateData.specialRequests = body.specialRequests

    const reservation = await db.reservation.update({
      where: { id },
      data: updateData,
      include: {
        table: { select: { id: true, number: true, capacity: true, area: true } },
      },
    })

    await createAuditLog({
      action: 'UPDATE_RESERVATION',
      entityType: 'Reservation',
      entityId: id,
      details: updateData,
    })

    return NextResponse.json({ success: true, reservation })
  } catch (error) {
    console.error('Napaka pri posodabljanju rezervacije:', error)
    return NextResponse.json({ error: 'Napaka pri posodabljanju rezervacije' }, { status: 500 })
  }
}

// DELETE - Izbriši rezervacijo
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const existing = await db.reservation.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Rezervacija ne obstaja' }, { status: 404 })
    }

    // Namesto brisanja — prekličemo
    const reservation = await db.reservation.update({
      where: { id },
      data: { status: 'cancelled' },
    })

    await createAuditLog({
      action: 'CANCEL_RESERVATION',
      entityType: 'Reservation',
      entityId: id,
      details: { customerName: existing.customerName, dateTime: existing.dateTime },
    })

    return NextResponse.json({ success: true, reservation })
  } catch (error) {
    console.error('Napaka pri brisanju rezervacije:', error)
    return NextResponse.json({ error: 'Napaka pri brisanju rezervacije' }, { status: 500 })
  }
}
