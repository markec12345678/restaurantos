// ============================================
// REZERVACIJA — Posodobi / Izbriši
// Avtentikacija + Zod validacija
// ============================================

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, updateReservationSchema } from '@/lib/validations'

// PUT - Posodobi rezervacijo
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // FIX C-05: Zahtevaj avtentikacijo za posodabljanje rezervacije
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const body = await req.json()

    // FIX H-01: Zod validacija
    const { data, error: validationError } = validateBody(updateReservationSchema, body)
    if (validationError) return validationError

    const existing = await db.reservation.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Rezervacija ne obstaja' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (data.status) {
      updateData.status = data.status

      // Samodejne spremembe glede na status
      if (data.status === 'seated') {
        updateData.actualArrival = new Date()
      } else if (data.status === 'completed') {
        updateData.actualDeparture = new Date()
      } else if (data.status === 'confirmed') {
        updateData.confirmedAt = new Date()
      }
    }

    if (data.customerName !== undefined) updateData.customerName = data.customerName
    if (data.customerPhone !== undefined) updateData.customerPhone = data.customerPhone
    if (data.customerEmail !== undefined) updateData.customerEmail = data.customerEmail
    if (data.tableId !== undefined) updateData.tableId = data.tableId || null
    if (data.dateTime !== undefined) updateData.dateTime = new Date(data.dateTime)
    if (data.partySize !== undefined) updateData.partySize = data.partySize
    if (data.duration !== undefined) updateData.duration = data.duration
    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.specialRequests !== undefined) updateData.specialRequests = data.specialRequests

    const reservation = await db.reservation.update({
      where: { id },
      data: updateData,
      include: {
        table: { select: { id: true, number: true, capacity: true, area: true } },
      },
    })

    await createAuditLog({
      userId: authResult.session?.employeeId,
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

// DELETE - Prekliči rezervacijo
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // FIX C-05: Zahtevaj avtentikacijo za preklic rezervacije
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

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
      userId: authResult.session?.employeeId,
      action: 'CANCEL_RESERVATION',
      entityType: 'Reservation',
      entityId: id,
      details: { customerName: existing.customerName, dateTime: existing.dateTime },
    })

    return NextResponse.json({ success: true, reservation })
  } catch (error) {
    console.error('Napaka pri preklicu rezervacije:', error)
    return NextResponse.json({ error: 'Napaka pri preklicu rezervacije' }, { status: 500 })
  }
}
