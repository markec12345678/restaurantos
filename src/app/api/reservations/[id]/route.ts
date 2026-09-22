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
// R102: handleApiError → structuredErrorResponse (strukturirani tx throw-i
// 404/400/409/P2034 morajo doseči klienta s pravim statusom, ne 500).
import { parseJsonBody, validateBody } from '@/lib/api-utils'
import { intervalsOverlap, formatLjubljanaTime } from '@/lib/reservation-timeline'
import { notInScopeResponse, resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'
import { structuredErrorResponse } from '../_helpers'

export const dynamic = 'force-dynamic'

// FIX R102 (TOCTOU double-booking, R100 vzorec): state machine validacija,
// conflict check, update in table flip-i so zdaj ATOMARNO v ENI Serializable
// transakciji (mirror create-handler FIX #3 — prej je bil zaščiten SAMO create
// tok, PUT je ostal check-then-act):
//   (1) dva sočasna PUT-a premakneta RAZLIČNI rezervaciji na isto mizo/čas →
//       oba prebereta prazne kandidate → oba zapišeta → DOUBLE-BOOKING;
//   (2) dva sočasna status prehoda iz istega stale statusa ('confirmed') →
//       oba padeta state machine → neveljaven prehod (npr. seated → no_show)
//       prek race-a;
//   (3) table flip-i so se izvajali LOČENO od update-a (prekinjen lifecycle).
// Znotraj tx: tx-fresh re-read (mid-flight brisanje → 404), validacije proti
// fresh vrednostim, update + flip-i skupaj; P2034 → 409 "poskusite znova".

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

    // Fast-fail (pred tx): neveljaven datum je VEDNO klientova napaka —
    // brez nepotrebnega tx overheada.
    if (data.dateTime !== undefined && Number.isNaN(new Date(data.dateTime).getTime())) {
      return NextResponse.json({ error: 'Neveljaven datum/čas' }, { status: 400 })
    }

    // updateData čisto funkcija telesa zahtevka (stale-read varno — polja so
    // eksplicitna, ne odvisna od obstoječega stanja).
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

    const reservation = await db.$transaction(async (tx) => {
      // tx-fresh re-read: stale 'existing' ne sme biti podlaga za validacije
      // (mid-flight brisanje → 404; stale status → pravilen state machine).
      const fresh = await tx.reservation.findFirst({
        where: { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
      })
      if (!fresh) {
        throw { error: 'Rezervacija ne obstaja', status: 404 }
      }

      // FIX HIGH: State machine validacija — proti FRESH statusu
      if (data.status) {
        const validTransitions: Record<string, string[]> = {
          confirmed: ['seated', 'no_show', 'cancelled'],
          seated: ['completed', 'cancelled'],
          completed: [], // terminal
          no_show: [],   // terminal
          cancelled: [],  // terminal
        }
        const allowed = validTransitions[fresh.status] || []
        if (!allowed.includes(data.status)) {
          throw {
            error: `Prehod iz '${fresh.status}' v '${data.status}' ni dovoljen`,
            status: 400,
          }
        }
      }

      // RUNDA 53 FIX (2 loženi ranljivosti) — conflict check nad FRESH vrednostmi:
      // (1) teče tudi, če je bil poslan samo ENO polje (tableId ALI dateTime);
      // (2) pravo prekrivanje intervalov (intervalsOverlap) nad VSEMI aktivnimi
      //     rezervacijami mize (polodprti intervali).
      if (data.dateTime !== undefined || data.tableId !== undefined) {
        const effTableId = data.tableId !== undefined ? (data.tableId || null) : fresh.tableId
        if (effTableId) {
          const newDateTime = data.dateTime !== undefined ? new Date(data.dateTime) : new Date(fresh.dateTime)
          const duration = data.duration ?? fresh.duration ?? 120 // minut
          const newEnd = new Date(newDateTime.getTime() + duration * 60000)

          // Prekrivanje zahteva start kandidata < naš konec (polodprti intervali)
          const candidates = await tx.reservation.findMany({
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
            // FIX R81-G (LEAK-MEDIUM): 409 odgovor NE razkriva customerName
            // (možna tujih rezervacij PII pri zgodovinskih cross-tenant mizah) —
            // generično sporočilo, konfliktna semantika + status 409 ostaneta.
            const conflictHm = formatLjubljanaTime(conflicting.dateTime)
            throw {
              error: `Miza je že rezervirana ob tem času${conflictHm ? ` (${conflictHm})` : ''}`,
              status: 409,
            }
          }
        }
      }

      const updated = await tx.reservation.update({
        where: { id },
        data: updateData,
        include: {
          table: { select: { id: true, number: true, capacity: true, area: true } },
        },
      })

      // FIX R44 + R95-c: table flip-i zdaj ZNOTRAJ iste tx (atomarni lifecycle).
      // posedanje → 'occupied' (viri razširjeni z 'reserved'); completed →
      // sprostitev SAMO brez odprtega naročila, reset OMEJEN na 'occupied';
      // no_show/cancelled → count-guard, reset SAMO 'reserved' (nikoli clobberaj
      // occupied/blocked/...).
      const effectiveTableId = data.tableId !== undefined ? (data.tableId || null) : fresh.tableId
      if (data.status === 'seated' && effectiveTableId) {
        await tx.table.updateMany({
          where: { id: effectiveTableId, status: { in: ['available', 'occupied', 'reserved'] } },
          data: { status: 'occupied' },
        })
      } else if (data.status === 'completed' && fresh.tableId) {
        // Sprosti mizo SAMO če nima odprtega naročila (isti vzorec kot /api/tables).
        // R95-c: reset je OMEJEN na 'occupied' — DB 'reserved' (druga prihodnja
        // rezervacija na isti mizi) MORA preživeti completed te rezervacije;
        // samo takojšnja zasedenost se sprosti.
        const activeOrder = await tx.order.findFirst({
          where: { tableId: fresh.tableId, status: { in: ['pending', 'in-progress', 'ready'] } },
          select: { id: true },
        })
        if (!activeOrder) {
          await tx.table.updateMany({
            where: { id: fresh.tableId, status: 'occupied' },
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
          const activeOthers = await tx.reservation.count({
            where: {
              tableId: effectiveTableId,
              id: { not: id },
              status: { in: ['confirmed', 'seated'] },
            },
          })
          if (activeOthers === 0) {
            await tx.table.updateMany({
              where: { id: effectiveTableId, status: 'reserved' },
              data: { status: 'available' },
            })
          }
        }
      }

      return updated
    }, {
      isolationLevel: 'Serializable',
    }).catch(err => {
      // Re-throw structured errors (404/400/409 iz tx telesa)
      if (err && typeof err === 'object' && 'error' in err) throw err
      // Prisma serialization error — concurrent update won (R102)
      if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'P2034') {
        throw { error: 'Posodobitev ni mogoča — drug uporabnik je hkrati spreminjal to rezervacijo. Poskusite znova.', status: 409 }
      }
      throw err
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
    // FIX R102: strukturirani tx throw-i (404/400/409/P2034) → pravi status
    // (prej handleApiError → 500 '[object Object]').
    return structuredErrorResponse(error, 'PUT /api/reservations/[id]', 'Napaka pri posodabljanju rezervacije')
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

    // FIX R102 (state machine bypass + atomarnost): DELETE je bil edini WRITE
    // tok BREZ state machine validacije — completed/no_show/cancelled (terminali)
    // so se tiho "preklicali" (update data { status: 'cancelled' } brez pogoja).
    // Zdaj: ATOMARNI CAS (check-and-set, R100 counter-guard vzorec) — updateMany
    // { status: { in: ['confirmed','seated'] } }; count 0 → 400 terminal. CAS +
    // count-guard + table reset so v ENI Serializable tx (dva sočasna preklica
    // dveh rezervacij iste mize: prej sta oba count-a videla drugo kot aktivno →
    // oba skipa reset → MRTVA 'reserved' miza; zdaj tx serializira — drugi vidi
    // prvi preklic in reseta).
    const reservation = await db.$transaction(async (tx) => {
      const fresh = await tx.reservation.findFirst({
        where: { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
      })
      if (!fresh) {
        throw { error: 'Rezervacija ne obstaja', status: 404 }
      }

      const cas = await tx.reservation.updateMany({
        where: { id, status: { in: ['confirmed', 'seated'] } },
        data: { status: 'cancelled' },
      })
      if (cas.count === 0) {
        throw {
          error: `Rezervacija je že v končnem stanju ('${fresh.status}') — preklic ni mogoč`,
          status: 400,
        }
      }

      // R95-c mirror: preklic NE sme pustiti mrtve DB 'reserved' mize.
      // Count-guard: druga aktivna rezervacija (confirmed/seated) pusti
      // 'reserved'; sicer reset v 'available' (no-op, če miza ni reserved).
      if (fresh.tableId) {
        const activeOthers = await tx.reservation.count({
          where: {
            tableId: fresh.tableId,
            id: { not: id },
            status: { in: ['confirmed', 'seated'] },
          },
        })
        if (activeOthers === 0) {
          await tx.table.updateMany({
            where: { id: fresh.tableId, status: 'reserved' },
            data: { status: 'available' },
          })
        }
      }

      return tx.reservation.findUnique({ where: { id } })
    }, {
      isolationLevel: 'Serializable',
    }).catch(err => {
      // Re-throw structured errors (404/400 iz tx telesa)
      if (err && typeof err === 'object' && 'error' in err) throw err
      if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'P2034') {
        throw { error: 'Preklic ni mogoč — drug uporabnik je hkrati spreminjal to rezervacijo. Poskusite znova.', status: 409 }
      }
      throw err
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
    // FIX R102: strukturirani tx throw-i (404/400/P2034) → pravi status
    return structuredErrorResponse(error, 'DELETE /api/reservations/[id]', 'Napaka pri preklicu rezervacije')
  }
}
