// ============================================
// REZERVACIJA — Posodobi / Izbriši
// Avtentikacija + Zod validacija
// ============================================

// PUT - Posodobi rezervacijo
import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { updateReservationSchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // FIX C-05: Zahtevaj avtentikacijo za posodabljanje rezervacije
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX H-01: Zod validacija
    const { data, error: validationError } = validateBody(updateReservationSchema, bodyResult.data)
    if (validationError) return validationError

    const existing = await db.reservation.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Rezervacija ne obstaja' }, { status: 404 })
    }

    // FIX HIGH: Preveri veljavne statusne prehode (state machine)
    if (data.status) {
      const validTransitions: Record<string, string[]> = {
        confirmed: ['seated', 'no_show', 'cancelled'],
        seated: ['completed', 'cancelled'],
        completed: [], // terminal
        no_show: [],   // terminal
        cancelled: [],  // terminal
      }
      const allowed = validTransitions[existing.status] || []
      if (!allowed.includes(data.status)) {
        return NextResponse.json(
          { error: `Prehod iz '${existing.status}' v '${data.status}' ni dovoljen` },
          { status: 400 }
        )
      }
    }

    // FIX HIGH: Conflict detection ob spremembi tableId ali dateTime
    if (data.tableId && data.dateTime) {
      const newDateTime = new Date(data.dateTime)
      const duration = data.duration || existing.duration || 120 // minut
      const newEnd = new Date(newDateTime.getTime() + duration * 60000)

      const conflicting = await db.reservation.findFirst({
        where: {
          id: { not: id }, // izključi trenutno rezervacijo
          tableId: data.tableId,
          status: { in: ['confirmed', 'seated'] },
          dateTime: { lte: newEnd },
        },
      })

      if (conflicting) {
        const conflictEnd = new Date(new Date(conflicting.dateTime).getTime() + (conflicting.duration || 120) * 60000)
        if (conflictEnd > newDateTime) {
          return NextResponse.json(
            { error: `Miza je že rezervirana ob tem času (${conflicting.customerName}, ${new Date(conflicting.dateTime).toLocaleTimeString('sl-SI')})` },
            { status: 409 }
          )
        }
      }
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
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/reservations/[id]', 'Napaka pri posodabljanju rezervacije')
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
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/reservations/[id]', 'Napaka pri preklicu rezervacije')
  }
}
