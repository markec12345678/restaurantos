// ============================================
// REZERVACIJA — Posodobi / Izbriši
// Avtentikacija + Zod validacija
// ============================================

// PUT - Posodobi rezervacijo
import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { requireAuth } from '@/lib/auth-middleware'
import { updateReservationSchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'
import { intervalsOverlap, formatLjubljanaTime } from '@/lib/reservation-timeline'
import { notInScopeResponse, resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'

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

    // FIX IDOR (tenant scope): findUnique → findFirst z locationId scope
    // (natakar lokacije A ne more urejati rezervacij lokacije B)
    // FIX R85-4a M2: resolveTenantLocationIdOrThrow — prej je bil ročni spread
    // `session?.locationId ?? undefined` FAIL-OPEN za regularnega uporabnika
    // brez dodeljene lokacije (prazen filter = globalni findFirst + update
    // čez tenant-e). Zdaj: 403 fail-closed; super-admin (null) = globalni.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'PUT /api/reservations/[id]',
    })
    if ('error' in scope) return scope.error
    const existing = await db.reservation.findFirst({
      where: { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Rezervacija ne obstaja' }, { status: 404 })
    }

    // FIX R81-G (LEAK-MEDIUM, cross-tenant): data.tableId ni bil validiran —
    // natakar lokacije A je lahko rezervacijo premaknil na MIZO lokacije B
    // (cross-tenant table.status flip ob 'seated'). Ko je tableId podan,
    // mora biti miza v session scopu (Table.locationId NOT NULL); tuja ali
    // neznana → 404 notInScopeResponse.
    if (data.tableId) {
      const targetTable = await db.table.findFirst({
        where: { id: data.tableId, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
        select: { id: true },
      })
      if (!targetTable) {
        return notInScopeResponse('Miza')
      }
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

    // RUNDA 53 FIX (2 loženi ranljivosti):
    // (1) Conflict detection je tekel SAMO, če sta bila poslana OBA polja
    //     (tableId + dateTime) — hitri premik časa (samo dateTime) je
    //     popolnoma PRESKOČIL preverjanje zasedenosti mize!
    // (2) findFirst brez orderBy vrne arbitrarno vrstico — lahko "poišče"
    //     neprekrivajočo rezervacijo (lažni pozitiv/NEGATIV). Pravo
    //     prekrivanje intervalov preverimo eksplicitno (intervalsOverlap)
    //     nad VSEMI aktivnimi rezervacijami mize, ki se začnejo pred
    //     našim koncem.
    if (data.dateTime !== undefined && Number.isNaN(new Date(data.dateTime).getTime())) {
      return NextResponse.json({ error: 'Neveljaven datum/čas' }, { status: 400 })
    }
    if (data.dateTime !== undefined || data.tableId !== undefined) {
      // Efektivne vrednosti: poslano polje ali obstoječe (prej samo "oba ali nič")
      const effTableId = data.tableId !== undefined ? (data.tableId || null) : existing.tableId
      if (effTableId) {
        const newDateTime = data.dateTime !== undefined ? new Date(data.dateTime) : new Date(existing.dateTime)
        const duration = data.duration ?? existing.duration ?? 120 // minut
        const newEnd = new Date(newDateTime.getTime() + duration * 60000)

        // Prekrivanje zahteva start kandidata < naš konec (polodprti intervali)
        const candidates = await db.reservation.findMany({
          where: {
            id: { not: id }, // izključi trenutno rezervacijo
            tableId: effTableId,
            status: { in: ['confirmed', 'seated'] },
            dateTime: { lt: newEnd },
          },
          select: { id: true, dateTime: true, duration: true },
        })

        const conflicting = candidates.find(c =>
          intervalsOverlap(
            newDateTime.getTime(),
            newEnd.getTime(),
            new Date(c.dateTime).getTime(),
            new Date(c.dateTime).getTime() + (c.duration || 120) * 60000,
          ),
        )

        if (conflicting) {
          // RUNDA 54: čas v sporočilu v LJ coni (prej toLocaleTimeString na
          // strežniku = UTC → "17:00:00" namesto "19:00" + sekundni šum)
          // FIX R81-G (LEAK-MEDIUM): 409 odgovor NE razkriva več customerName
          // (možna tujih rezervacij PII pri zgodovinskih cross-tenant mizah) —
          // generično sporočilo, konfliktna semantika + status 409 ostaneta.
          const conflictHm = formatLjubljanaTime(conflicting.dateTime)
          return NextResponse.json(
            { error: `Miza je že rezervirana ob tem času${conflictHm ? ` (${conflictHm})` : ''}` },
            { status: 409 },
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
    // RUNDA 54: opomnik gostu (reminderSent flag — UI "Pošlji opomnik")
    // RUNDA 57: ob poslanem opomniku se zapiše tudi časovni žig
    // (reminderSentAt → značka "poslan ob HH:MM"); ponastavitev flaga
    // (reminderSent=false) ga počisti — flag in timestamp ostajata skladna.
    if (data.reminderSent !== undefined) {
      updateData.reminderSent = data.reminderSent
      updateData.reminderSentAt = data.reminderSent ? new Date() : null
    }

    const reservation = await db.reservation.update({
      where: { id },
      data: updateData,
      include: {
        table: { select: { id: true, number: true, capacity: true, area: true } },
      },
    })

    // FIX R44: posedanje mora povišati status mize v 'occupied', zaključek jo sprosti.
    // Prej je UI assignal tableId + status seated, DB status mize pa je ostal 'available' →
    // KPI "Proste mize" napačen, tloris pokazal zasedeno mizo kot prosto.
    // R95-c: viri razširjeni z 'reserved' — miza, ki jo drži DB flip iz
    // create-handlerja, se ob posedanju pravilno povzdigne v 'occupied'
    // (prej je seated na reserved mizi zamudil flip → mrtva reserved).
    const effectiveTableId = data.tableId !== undefined ? (data.tableId || null) : existing.tableId
    if (data.status === 'seated' && effectiveTableId) {
      await db.table.updateMany({
        where: { id: effectiveTableId, status: { in: ['available', 'occupied', 'reserved'] } },
        data: { status: 'occupied' },
      })
    } else if (data.status === 'completed' && existing.tableId) {
      // Sprosti mizo SAMO če nima odprtega naročila (isti vzorec kot /api/tables).
      // R95-c: reset je OMEJEN na 'occupied' — DB 'reserved' (druga prihodnja
      // rezervacija na isti mizi) MORA preživeti completed te rezervacije;
      // samo takojšnja zasedenost se sprosti.
      const activeOrder = await db.order.findFirst({
        where: { tableId: existing.tableId, status: { in: ['pending', 'in-progress', 'ready'] } },
        select: { id: true },
      })
      if (!activeOrder) {
        await db.table.updateMany({
          where: { id: existing.tableId, status: 'occupied' },
          data: { status: 'available' },
        })
      }
    } else if (data.status === 'no_show' || data.status === 'cancelled') {
      // R95-c: no_show/cancelled — prej sta pustili mizo v DB 'reserved'
      // (mrtva reserved: tloris kaže rezervirano, resnične rezervacije ni).
      // Count-guard: če ima miza ŠE katerokoli drugo aktivno rezervacijo
      // (confirmed/seated — brez datumskega filtra: katerakoli prihodnja
      // aktivna upravičuje ostanek 'reserved'), miza ostane reserved;
      // sicer gre nazaj v 'available'. Reset je no-op, če miza ni reserved
      // (status filter v where — nikoli ne clobberaj occupied/blocked/...).
      if (effectiveTableId) {
        const activeOthers = await db.reservation.count({
          where: {
            tableId: effectiveTableId,
            id: { not: id },
            status: { in: ['confirmed', 'seated'] },
          },
        })
        if (activeOthers === 0) {
          await db.table.updateMany({
            where: { id: effectiveTableId, status: 'reserved' },
            data: { status: 'available' },
          })
        }
      }
    }

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

    // FIX IDOR (tenant scope): prekliči SAMO rezervacijo znotraj session lokacije
    // FIX R85-4a M2: resolver namesto ročnega fail-open spreada (403 brez lokacije)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'DELETE /api/reservations/[id]',
    })
    if ('error' in scope) return scope.error
    const existing = await db.reservation.findFirst({
      where: { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Rezervacija ne obstaja' }, { status: 404 })
    }

    // Namesto brisanja — prekličemo
    const reservation = await db.reservation.update({
      where: { id },
      data: { status: 'cancelled' },
    })

    // R95-c: mirror PUT no_show/cancelled — preklic NE sme pustiti mrtve
    // DB 'reserved' mize. Count-guard: druga aktivna rezervacija (confirmed/
    // seated) na mizi pusti 'reserved'; sicer reset v 'available' (no-op,
    // če miza ni reserved — status filter v where).
    if (existing.tableId) {
      const activeOthers = await db.reservation.count({
        where: {
          tableId: existing.tableId,
          id: { not: id },
          status: { in: ['confirmed', 'seated'] },
        },
      })
      if (activeOthers === 0) {
        await db.table.updateMany({
          where: { id: existing.tableId, status: 'reserved' },
          data: { status: 'available' },
        })
      }
    }

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
