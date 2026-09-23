
// GET /api/happy-hour — pridobi vse urnike + trenutno aktivni
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { createHappyHourSchema } from '@/lib/validations'
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
import { structuredErrorResponse } from '@/lib/structured-error'
import { parseDaysOfWeek } from '@/lib/json-fields'

export const dynamic = 'force-dynamic'

// FIX R81-F (LEAK-HIGH+MEDIUM): inline role-aware fail-closed gate (zrcali
// resolveCatalogScope semantiko; subscription platformAdminGate stil — brez
// tenant-scope helperjev). Ruta je take_orders dostopna — non-admin BREZ
// session.locationId = 403 (data integrity issue).
function requireHappyHourLocationScope(
  authResult: { session?: { role?: string; locationId?: string | null } | null },
): { sessionLocId: string | null } | { error: NextResponse } {
  const session = authResult.session
  const sessionLocId = session?.locationId ?? null
  const isRoleAdmin = session?.role === 'admin' || session?.role === 'super_admin'
  if (!sessionLocId && !isRoleAdmin) {
    return {
      error: NextResponse.json(
        { error: 'Vaš račun nima dodeljene lokacije. Kontaktirajte administratorja.' },
        { status: 403 },
      ),
    }
  }
  return { sessionLocId }
}

export async function GET(req: Request) {
  try {
    // FIX CRITICAL: Zahtevaj avtentikacijo za dostop do Happy Hour podatkov
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error
    // FIX R81-F: scope gate
    const scope = requireHappyHourLocationScope(authResult)
    if ('error' in scope) return scope.error
    const sessionLocId = scope.sessionLocId

    // RUNDA 69 FIX: vrni VSE urnike (tudi neaktivne) — prej je GET filtriral
    // isActive:true, kar je pomenilo, da je bil IZKLOP stikala ENOSMERNA VRATA:
    // neaktiven urnik je izginil iz seznama in ga NI več bilo mogoče vklopiti
    // nazaj prek UI. activeSchedules/currentlyActive se še vedno računata spodaj.
    // FIX R81-F (LEAK-MEDIUM): seznam je bil globalen — urniki VSEH tenantov
    // za take_orders staff. HappyHourSchedule nima lastnega locationId —
    // scope prek starša priceGroup.locationId (NOT NULL, schema :2085).
    const schedules = await db.happyHourSchedule.findMany({
      where: { ...(sessionLocId ? { priceGroup: { locationId: sessionLocId } } : {}) },
      include: { priceGroup: true },
      orderBy: [{ isActive: 'desc' }, { startTime: 'asc' }],
    })

    // Preveri, kateri so trenutno aktivni
    const now = new Date()
    const currentDay = now.getDay() === 0 ? 7 : now.getDay() // 1=pon, 7=ned
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

    const activeSchedules = schedules.filter((s) => {
      // P1-9: Zod-validiran parser — pokvarjen JSON ne sesuje GET happy-hour
      const days: number[] = parseDaysOfWeek(s.daysOfWeek)
      if (!days.includes(currentDay)) return false
      if (currentTime < s.startTime || currentTime >= s.endTime) return false
      if (s.validFrom && now < s.validFrom) return false
      if (s.validTo && now > s.validTo) return false
      return true
    })

    return NextResponse.json({
      schedules,
      activeSchedules,
      currentlyActive: activeSchedules.length > 0,
      activePriceGroupIds: activeSchedules.map((s) => s.priceGroupId),
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/happy-hour', 'Napaka pri pridobivanju Happy Hour')
  }
}

// FIX R112 (HH-1): presek polodprtih intervalov [start, end) v 'HH:MM' formatu
// (string primerjava je varna — Zod regex zagotavlja zero-padded obliko).
// Podpira tudi čeznočna okna (endTime < startTime → [start, 24:00) ∪ [00:00,
// end)): POST ruta sicer takšna okna že zavrne (startTime < endTime → 400),
// helper pa je obramben za legacy vrstice iz baze (seed / ročni vnosi).
function happyHourWindowsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const aOvernight = aEnd <= aStart
  const bOvernight = bEnd <= bStart
  if (aOvernight && bOvernight) return true // oba okna vsebujeta polnoč
  if (aOvernight) return bStart < aEnd || bEnd > aStart
  if (bOvernight) return aStart < bEnd || aEnd > bStart
  return aStart < bEnd && bStart < aEnd
}

// POST /api/happy-hour — ustvari nov urnik
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error
    // FIX R81-F: scope gate (isti kot GET)
    const scope = requireHappyHourLocationScope(authResult)
    if ('error' in scope) return scope.error
    const sessionLocId = scope.sessionLocId

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX CRITICAL: Zod validacija za Happy Hour urnik
    const { data, error: validationError } = validateBody(createHappyHourSchema, bodyResult.data)
    if (validationError) return validationError

    // FIX HIGH: Preveri, da startTime < endTime
    if (data.startTime >= data.endTime) {
      return NextResponse.json(
        { error: 'Začetni čas mora biti pred končnim časom' },
        { status: 400 }
      )
    }

    // FIX HIGH: Preveri, da priceGroupId obstaja
    // FIX R81-F (LEAK-HIGH, cross-tenant): priceGroup lookup je bil nescopecan
    // (findUnique po raw ID) — admin je lahko pripel urnik na TUJ cenik
    // (drug tenant bi dobil tuj popust na svojem ceniku). findFirst scoped;
    // izven scope-a ali neobstoječ = enak 404 (brez razkritja).
    // FIX R112 (HH-1): to je samo HITRI IZHOD — avtoritativna preverba je
    // tx-fresh ZNOTRAJ transakcije spodaj (z-report vzorec: fast-fail + re-check
    // pod zaklepanjem).
    if (data.priceGroupId) {
      const priceGroup = await db.priceGroup.findFirst({
        where: {
          id: data.priceGroupId,
          ...(sessionLocId ? { locationId: sessionLocId } : {}),
        },
      })
      if (!priceGroup) {
        return NextResponse.json({ error: 'Cenik ni najden' }, { status: 404 })
      }
    }

    // FIX R112 (HH-1, MED — TOCTOU razred iz R100–R111): prej NI bilo nobenega
    // preverjanja prekrivanja — neomejeno AKTIVNIH urnikov z istim cenikom in
    // prekrivajočimi okni je bilo mogoče ustvariti (nedeterminen popust —
    // zadnji zapis pri izračunu cene zmaguje). Prej tudi create BREZ tx:
    // preverba in zapis nista bila pod istim snapshot-om (check-then-act okno).
    // Fix: ENA Serializable transakcija —
    //   (a) tx-fresh re-read priceGroup scope-a (R81-F preverba pod istim
    //       snapshot-om — cenik izbrisan/izven scope-a med requestoma → 404),
    //   (b) advisory lock 'happy-hour:{locationId}' (izpeljan iz LOKACIJE
    //       cenika) — serializira vse kreacije istega cenika (vzorec
    //       upsert-z-report R110),
    //   (c) prekrivanje med AKTIVNIMI obstoječimi urniki ISTEGA cenika:
    //       overlap = existing.isActive (filter v where) AND existing.id !== new
    //       AND okni se sekata AND vsaj en skupen dan. 'existing.id !== new' je
    //       pri CREATE trivialno izpolnjen — nov zapis še nima ID-ja (edini
    //       pisatelj časovnih oken je ta ruta; PATCH toggle jih ne spreminja).
    //   Prekrivanje → strukturirani { error, status: 409 } throw (R103 kanon).
    const schedule = await db.$transaction(async (tx) => {
      // (a) tx-fresh re-read priceGroup scope-a
      const txPriceGroup = await tx.priceGroup.findFirst({
        where: {
          id: data.priceGroupId,
          ...(sessionLocId ? { locationId: sessionLocId } : {}),
        },
        select: { id: true, locationId: true },
      })
      if (!txPriceGroup) {
        throw { error: 'Cenik ni najden', status: 404 }
      }

      // (b) advisory lock — ključ izpeljan iz lokacije cenika
      const lockKey = `happy-hour:${txPriceGroup.locationId}`
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`

      // (c) prekrivanje z AKTIVNIMI urniki ISTEGA cenika
      const existingActive = await tx.happyHourSchedule.findMany({
        where: { priceGroupId: data.priceGroupId, isActive: true },
        select: { id: true, startTime: true, endTime: true, daysOfWeek: true },
      })
      for (const existing of existingActive) {
        if (!happyHourWindowsOverlap(data.startTime, data.endTime, existing.startTime, existing.endTime)) continue
        const existingDays = parseDaysOfWeek(existing.daysOfWeek)
        // vsaj en skupen dan — sicer se okna v praksi nikoli ne srečata
        if (!data.daysOfWeek.some((day) => existingDays.includes(day))) continue
        throw { error: 'Happy ura se prekriva z obstoječim urnikom (isti cenik).', status: 409 }
      }

      // create pod istim snapshot-om (isti podatki — API kontrakt nespremenjen)
      return tx.happyHourSchedule.create({
        data: {
          name: data.name,
          description: data.description || '',
          priceGroupId: data.priceGroupId,
          discountType: data.discountType || 'none',
          discountAmount: data.discountAmount || 0,
          daysOfWeek: JSON.stringify(data.daysOfWeek || [1, 2, 3, 4, 5]),
          startTime: data.startTime,
          endTime: data.endTime,
          validFrom: data.validFrom ? new Date(data.validFrom) : null,
          validTo: data.validTo ? new Date(data.validTo) : null,
          appliesTo: data.appliesTo || 'all',
          appliesToIds: JSON.stringify(data.appliesToIds || []),
          isActive: data.isActive ?? true,
          autoActivate: data.autoActivate ?? true,
        },
        include: { priceGroup: true },
      })
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })

    return NextResponse.json(schedule, { status: 201 })
  } catch (error: unknown) {
    // FIX R112 (HH-1): error kontrakt — P2034 Serializable konflikt / P2002 →
    // 409 (canonical mapping iz R107/R109/R111); strukturirani { error, status }
    // throw-i iz tx telesa → pravi 404/409 (prej bi handleApiError dal 500).
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2034' || error.code === 'P2002')) {
      return NextResponse.json({ error: 'Konflikt pri ustvarjanju Happy ura (sočasna sprememba urnika). Poskusite znova.' }, { status: 409 })
    }
    return structuredErrorResponse(error, 'POST /api/happy-hour', 'Napaka pri ustvarjanju Happy Hour')
  }
}
