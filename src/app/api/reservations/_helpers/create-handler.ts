// ─── POST helper: Ustvari rezervacijo ───

import { db, createAuditLog } from '@/lib/db'
import { logger } from '@/lib/logger'
import { emitEvent } from '@/lib/event-emitter'

export async function handleCreateReservation(
  data: {
    tableId?: string | null
    dateTime: string
    partySize: number
    duration: number
    customerName: string
    customerPhone?: string
    customerEmail?: string
    notes?: string
    specialRequests?: string
    source?: string
  },
  employeeId: string | undefined,
) {
  // Preveri, da miza obstaja in je primerne velikosti
  if (data.tableId) {
    const table = await db.table.findUnique({ where: { id: data.tableId } })
    if (!table) {
      return { error: 'Miza ne obstaja', status: 404 }
    }
    if (table.capacity < data.partySize) {
      return { error: `Miza ${table.number} ima kapaciteto ${table.capacity}, premajhna za ${data.partySize} oseb`, status: 400 }
    }

    // Preveri konflikte — ali je miza že rezervirana v tem času?
    const reservationStart = new Date(data.dateTime)
    const reservationEnd = new Date(reservationStart.getTime() + data.duration * 60000)

    const existingReservations = await db.reservation.findMany({
      where: {
        tableId: data.tableId,
        status: { in: ['confirmed', 'seated'] },
      },
    })

    for (const existing of existingReservations) {
      const existingStart = new Date(existing.dateTime)
      const existingEnd = new Date(existingStart.getTime() + (existing.duration || 120) * 60000)
      if (reservationStart < existingEnd && reservationEnd > existingStart) {
        return { error: `Miza ${table.number} je že rezervirana ob ${existingStart.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}`, status: 409 }
      }
    }
  }

  // Ustvari rezervacijo
  const reservation = await db.reservation.create({
    data: {
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerEmail: data.customerEmail,
      tableId: data.tableId || null,
      dateTime: new Date(data.dateTime),
      partySize: data.partySize,
      duration: data.duration,
      status: 'confirmed',
      notes: data.notes,
      specialRequests: data.specialRequests,
      source: data.source,
      confirmedAt: new Date(),
      employeeId: employeeId || null,
    },
    include: {
      table: { select: { id: true, number: true, capacity: true, area: true } },
    },
  })

  // Audit log
  await createAuditLog({
    userId: employeeId,
    action: 'CREATE_RESERVATION',
    entityType: 'Reservation',
    entityId: reservation.id,
    details: {
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      tableId: data.tableId,
      dateTime: data.dateTime,
      partySize: data.partySize,
    },
  })

  // Webhook: reservation.created
  emitEvent('reservation.created', {
    reservationId: reservation.id,
    customerName: data.customerName,
    dateTime: data.dateTime,
    partySize: data.partySize,
  }).catch(err => logger.error('API', '[Webhook] reservation.created napaka:', err))

  return { reservation }
}
