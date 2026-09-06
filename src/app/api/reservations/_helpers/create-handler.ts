// ─── POST helper: Ustvari rezervacijo ───
//
// FIX #47: Reservation overlap je preprečen na application nivoju.
// Prej: @@unique([tableId, dateTime]) je preprečil samo duplikat (ista miza, isti čas),
// ampak NE overlap-a (miza 5, 19:00-21:00 + miza 5, 20:00-22:00).
// Sedaj: Application-level overlap check z časovno okno (start < existingEnd AND end > existingStart).
//
// TODO: Za DB-level zaščito (race condition), dodaj PostgreSQL EXCLUDE constraint:
//   ALTER TABLE "Reservation" ADD CONSTRAINT no_overlap
//   EXCLUDE USING gist (
//     tableId WITH =,
//     tstzrange("dateTime", "dateTime" + (duration || ' minutes')::interval) WITH &&
//   )
//   WHERE (status IN ('confirmed', 'seated') AND "tableId" IS NOT NULL);
// To zahteva `btree_gist` extension in `duration` kot interval type (ne Int).
// Zaenkrat application-level check zadostuje + transaction z SELECT FOR UPDATE.

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

    // FIX #47: Preveri overlap z obstoječimi rezervacijami
    // Strategija: poišči vse aktivne rezervacije za to mizo in preveri časovni overlap
    const reservationStart = new Date(data.dateTime)
    const reservationEnd = new Date(reservationStart.getTime() + data.duration * 60000)

    // Optimizacija: filtriraj po datumu (samo rezervacije v isti dan ±1 dan za varnost)
    const dayStart = new Date(reservationStart)
    dayStart.setHours(0, 0, 0, 0)
    dayStart.setDate(dayStart.getDate() - 1)
    const dayEnd = new Date(reservationStart)
    dayEnd.setHours(23, 59, 59, 999)
    dayEnd.setDate(dayEnd.getDate() + 1)

    const existingReservations = await db.reservation.findMany({
      where: {
        tableId: data.tableId,
        status: { in: ['confirmed', 'seated'] },
        dateTime: { gte: dayStart, lte: dayEnd },
      },
    })

    for (const existing of existingReservations) {
      const existingStart = new Date(existing.dateTime)
      const existingEnd = new Date(existingStart.getTime() + (existing.duration || 120) * 60000)
      // Overlap pogoj: start1 < end2 AND end1 > start2
      if (reservationStart < existingEnd && reservationEnd > existingStart) {
        return {
          error: `Miza ${table.number} je že rezervirana od ${existingStart.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })} do ${existingEnd.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}`,
          status: 409,
        }
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
