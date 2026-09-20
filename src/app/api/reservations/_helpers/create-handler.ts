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
import { resolveWriteLocationId } from '@/lib/tenant-scope'
import { logger } from '@/lib/logger'
import { emitEvent } from '@/lib/event-emitter'
// RUNDA 58 FIX (živa QA): konfliktno sporočilo POST ustvarjanja je pokazovalo
// UTC čas ("od 18:00 do 20:00" namesto LJ "od 20:00 do 22:00") — toLocaleTimeString
// brez timeZone uporabi strežniško cono (UTC). formatLjubljanaTime vsadi
// eksplicitno Europe/Ljubljana (isti vzorec kot R54 fix v [id]/route.ts).
import { formatLjubljanaTime } from '@/lib/reservation-timeline'
import { slCount, OSEBA_TOZILNIK_FORMS } from '@/lib/sl-plural'

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
  scope: { locationId: string | null },
) {
  let tableLocationId: string | null = null
  // Preveri, da miza obstaja in je primerne velikosti
  if (data.tableId) {
    const table = await db.table.findUnique({ where: { id: data.tableId } })
    if (!table) {
      return { error: 'Miza ne obstaja', status: 404 }
    }
    // FIX R85-4a M2 (cross-tenant WRITE): prej je tableId prešel nevalidiran —
    // natakar lokacije A je lahko rezerviral MIZO lokacije B (tuja FK referenca;
    // 'seated' prek PUT [id] bi nato preklopil status tuje mize). Miza mora biti
    // v session scopu (Table.locationId NOT NULL); tuja ali neznana → 404
    // (sporočilo enako notInScopeResponse('Miza') — ne razkrije obstoja).
    if (scope.locationId && table.locationId !== scope.locationId) {
      return { error: 'Miza ni najden', status: 404 }
    }
    tableLocationId = table.locationId
    if (table.capacity < data.partySize) {
      return { error: `Miza ${table.number} ima kapaciteto ${table.capacity}, premajhna za ${slCount(data.partySize, OSEBA_TOZILNIK_FORMS)}`, status: 400 }
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
          error: `Miza ${table.number} je že rezervirana od ${formatLjubljanaTime(existingStart) ?? '--:--'} do ${formatLjubljanaTime(existingEnd) ?? '--:--'}`,
          status: 409,
        }
      }
    }
  }

  // FIX #3: Race condition — wrap overlap check + create v transakcijo
  // Prej: SELECT (overlap check) in INSERT (create) sta bila ločena —
  // dva sočasna requesta lahko oba opravita overlap check in oba kreirata rezervacijo.
  // Sedaj: $transaction s SERIALIZABLE isolationLevel atomarno izvede check + create.

  // FIX QA runda 40 + FIX R85-4a M2: DB stolpec Reservation.locationId je
  // NOT NULL (Phase 2 iz admin/migrate) — žig PRED tx. Žig je zdaj scope-zaveden:
  //   1. data-derived table.locationId (miza nosi svojo lokacijo — pravilno tudi
  //      za super-admina, ki rezervira mizo na drugi lokaciji),
  //   2. sicer scope.locationId (session lokacija),
  //   3. super-admin brez lokacije IN brez mize → 400 fail-closed. Prej je
  //      resolveLocationId fallback žigal PRVO lokacijo v DB (createdAt asc) —
  //      možen tuji-tenant žig brez vednosti klicatelja.
  const writeLoc = resolveWriteLocationId(scope.locationId, tableLocationId)
  if (!writeLoc.ok) {
    return {
      error:
        'locationId je obvezen: seja nima dodeljene lokacije — rezervacijo brez mize ustvari zaposleni z dodeljeno lokacijo ali podaj mizo.',
      status: 400,
    }
  }
  const locationId = writeLoc.locationId

  const reservation = await db.$transaction(async (tx) => {
    if (data.tableId) {
      const table = await tx.table.findUnique({ where: { id: data.tableId } })
      if (!table) {
        throw { error: 'Miza ne obstaja', status: 404 }
      }
      if (table.capacity < data.partySize) {
        throw { error: `Miza ${table.number} ima kapaciteto ${table.capacity}, premajhna za ${slCount(data.partySize, OSEBA_TOZILNIK_FORMS)}`, status: 400 }
      }

      const reservationStart = new Date(data.dateTime)
      const reservationEnd = new Date(reservationStart.getTime() + data.duration * 60000)

      const dayStart = new Date(reservationStart)
      dayStart.setHours(0, 0, 0, 0)
      dayStart.setDate(dayStart.getDate() - 1)
      const dayEnd = new Date(reservationStart)
      dayEnd.setHours(23, 59, 59, 999)
      dayEnd.setDate(dayEnd.getDate() + 1)

      const existingReservations = await tx.reservation.findMany({
        where: {
          tableId: data.tableId,
          status: { in: ['confirmed', 'seated'] },
          dateTime: { gte: dayStart, lte: dayEnd },
        },
      })

      for (const existing of existingReservations) {
        const existingStart = new Date(existing.dateTime)
        const existingEnd = new Date(existingStart.getTime() + (existing.duration || 120) * 60000)
        if (reservationStart < existingEnd && reservationEnd > existingStart) {
          throw {
            error: `Miza ${table.number} je že rezervirana od ${formatLjubljanaTime(existingStart) ?? '--:--'} do ${formatLjubljanaTime(existingEnd) ?? '--:--'}`,
            status: 409,
          }
        }
      }
    }

    return tx.reservation.create({
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
        locationId,
      },
      include: {
        table: { select: { id: true, number: true, capacity: true, area: true } },
      },
    })
  }, {
    isolationLevel: 'Serializable',
  }).catch(err => {
    // Re-throw structured errors
    if (err && typeof err === 'object' && 'error' in err) throw err
    // Prisma serialization error — concurrent reservation won
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2034') {
      throw { error: 'Rezervacija ni mogoča — drug uporabnik je rezerviral to mizo v istem trenutku. Poskusite znova.', status: 409 }
    }
    throw err
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
  // R83: locationId pass-through — tenant isolation v webhook delivery
  emitEvent('reservation.created', {
    reservationId: reservation.id,
    customerName: data.customerName,
    dateTime: data.dateTime,
    partySize: data.partySize,
  }, reservation.locationId).catch(err => logger.error('API', '[Webhook] reservation.created napaka:', err))

  return { reservation }
}
