// ============================================
// R102 — REZERVACIJE/ČAKALNA VRSTA: koncurenčna strjevanje WRITE tokov
// ============================================
// Nadaljevanje R100 (atomarni WebAuthn counter guard) na poslovnem nivoju —
// isti razred napak (check-then-act / TOCTOU), isti vzorec popravkov.
//
// NAJDENE LUKNJE (vsi fixi v tej rundi):
//
//   F1 (BUG, error contract): create-handler meče iz $transaction telesa
//       strukturirane objekte { error, status } (404/400/409/P2034) — NISI
//       Error instance → handleApiError jih obravnava kot neznane → 500
//       '[object Object]' (dev) / generično sporočilo (produkcija). Klient
//       NIKOLI ni videl 409 "drug uporabnik je rezerviral to mizo" (sporočilo
//       je bilo sestavljeno in nato izgubljeno na ruti!). FIX:
//       structuredErrorResponse presliši strukturirane objekte PRED
//       handleApiError (route-level, POST/PUT/DELETE reservations).
//
//   F2 (HIGH, TOCTOU double-booking): PUT /api/reservations/[id] — conflict
//       check (findMany) + update STA bila LOČENA (create tok je imel od
//       FIX #3 Serializable tx, PUT NE). Dva sočasna PUT-a z različnima
//       rezervacijama na isto mizo/čas → oba prebereta prazne kandidate →
//       oba zapišeta → double-booking. FIX: state machine + conflict + update
//       + table flip-i ATOMARNO v $transaction(Serializable), P2034 → 409.
//
//   F3 (HIGH, state machine bypass): DELETE /api/reservations/[id] je bil
//       edini WRITE tok BREZ prehodne validacije — completed/no_show/cancelled
//       (terminali) so se tiho preklicali. FIX: atomarni CAS updateMany
//       { status: { in: ['confirmed','seated'] } }; count 0 → 400 terminal.
//       CAS + count-guard + table reset v ENI Serializable tx (dva sočasna
//       preklica na isti mizi → prej MRTVA 'reserved' — oba count-a sta
//       videla drugo rezervacijo kot aktivno → oba skipa reset).
//
//   F4 (MEDIUM, TOCTOU state machine): PUT /api/waitlist/[id] — validacija
//       preko stale existing.status + NEPOGOJEN update. Dva sočasna klica
//       (notify + seat) sta oba padla validacijo ('waiting') → oba zapisala.
//       FIX: atomarni CAS updateMany { id, status: existing.status }; count
//       0 → 409 (R100 check-and-set vzorec).
//
//   F5 (LOW): DELETE /api/waitlist/[id] — findFirst + delete z raw { id };
//       mid-flight brisanje → P2025 → 500 namesto 404. FIX: scoped deleteMany
//       (where { id, locationId }) — idempotentno, count 0 → 404.
//
// Pokritje (unit, handler klici direktno — hišni stil r85/r95/r100):
//   A: F1 error kontrakt — POST tx-notranji 409/404/400/P2034 dosežejo klienta
//      s PRAVIM statusom (prej 500); fallback ne-strukturirane napake → 500.
//   B: F2 PUT atomarnost — call-order pin (fresh → conflict → update → flip),
//      Serializable pin, state machine proti FRESH statusu, mid-flight brisanje,
//      P2034 → 409, conflict check tudi pri samo-dateTime (Runda 53 ohranjena).
//   C: F3 DELETE — terminal 400 s statusom v sporočilu, P2034 → 409.
//   D: F4 waitlist PUT CAS — where pin, count 0 → 409 (findUnique NI klican),
//      uspeh → re-fetch odgovor, direct-update veja prav tako CAS.
//   E: F5 waitlist DELETE — scoped deleteMany pin, mid-flight → 404.
//   F: fs-guard — structuredErrorResponse v vseh treh rutah, Serializable v
//      [id] ruti (PUT + DELETE), CAS pin v waitlist viru.
//
// LEKCIJE (r85/r95): vi.hoisted + vi.mock('@/lib/db') + mockResolvedValue
// (NIKOLI .Once); tx klient ločeni mocki od db-level; createAuditLog TOP-LEVEL
// export; logger mock MORA vsebovati generateRequestId (structuredErrorResponse
// fallback → handleApiError).
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  // db-level (pre-tx validacija)
  tableFindUnique: vi.fn(),
  tableFindFirst: vi.fn(),
  resFindFirst: vi.fn(),
  resFindMany: vi.fn(),
  waitlistFindFirst: vi.fn(),
  // tx klient (PUT/DELETE [id] tok — R102 atomarno)
  transaction: vi.fn(),
  txResFindFirst: vi.fn(),
  txResFindMany: vi.fn(),
  txResUpdate: vi.fn(),
  txResUpdateMany: vi.fn(),
  txResCount: vi.fn(),
  txResFindUnique: vi.fn(),
  txTableUpdateMany: vi.fn(),
  txOrderFindFirst: vi.fn(),
  // POST create tx (F1 kontrakt)
  txTableFindUnique: vi.fn(),
  txResCreate: vi.fn(),
  // waitlist CAS (F4/F5)
  waitlistUpdate: vi.fn(), // MORA ostati ne-klican (plain update izbran iz poti)
  waitlistUpdateMany: vi.fn(),
  waitlistFindUnique: vi.fn(),
  waitlistDeleteMany: vi.fn(),
  createAuditLog: vi.fn(),
}))

vi.mock('@/lib/auth-middleware', async () => {
  const tenantScope = await import('@/lib/tenant-scope')
  return {
    requireAuth: mocks.requireAuth,
    resolveTenantLocationId: tenantScope.resolveTenantLocationId,
    resolveTenantLocationIdOrThrow: tenantScope.resolveTenantLocationIdOrThrow,
    tenantScopeToWhere: tenantScope.tenantScopeToWhere,
  }
})

vi.mock('@/lib/db', () => ({
  db: {
    reservation: {
      findFirst: mocks.resFindFirst,
      findMany: mocks.resFindMany,
    },
    table: {
      findUnique: mocks.tableFindUnique,
      findFirst: mocks.tableFindFirst,
      updateMany: vi.fn(),
    },
    order: { findFirst: vi.fn() },
    waitlistEntry: {
      findFirst: mocks.waitlistFindFirst,
      update: mocks.waitlistUpdate,
      updateMany: mocks.waitlistUpdateMany,
      findUnique: mocks.waitlistFindUnique,
      deleteMany: mocks.waitlistDeleteMany,
    },
    $transaction: mocks.transaction,
  },
  createAuditLog: mocks.createAuditLog,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  // structuredErrorResponse fallback → handleApiError → generateRequestId
  generateRequestId: vi.fn(() => 'r102-test-req-id'),
}))

vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

import { PUT as reservationsPUT, DELETE as reservationsDELETE } from '@/app/api/reservations/[id]/route'
// POST /api/reservations je v kolektivni ruti (route.ts), ne [id]
import { POST as reservationsCreatePOST } from '@/app/api/reservations/route'
import { PUT as waitlistPUT, DELETE as waitlistDELETE } from '@/app/api/waitlist/[id]/route'

vi.mock('@/lib/event-emitter', () => ({ emitEvent: vi.fn() }))

const LOC_A = 'loc-tenant-a'
const RES_DT = '2026-06-01T18:00:00.000Z'
const CONFLICT_DT = '2026-06-01T19:00:00.000Z' // 18:00+120min → overlap

const resExisting = {
  id: 'res-1',
  customerName: 'Ana',
  status: 'confirmed',
  tableId: 'table-a',
  dateTime: new Date(RES_DT),
  duration: 120,
  partySize: 4,
  locationId: LOC_A,
}

const tableA = { id: 'table-a', number: 5, capacity: 6, status: 'available', locationId: LOC_A }

const waitlistRow = {
  id: 'wl-1',
  guestName: 'Marko',
  status: 'waiting',
  checkedInAt: new Date('2026-06-01T18:00:00Z'),
  tableId: null,
  locationId: LOC_A,
}

const RES_BODY = {
  customerName: 'Ana',
  tableId: 'table-a',
  dateTime: CONFLICT_DT,
  partySize: 4,
  duration: 120,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuth.mockResolvedValue({
    session: { employeeId: 'emp-1', role: 'admin', locationId: LOC_A },
    error: null,
  })
  // db-level (pre-tx)
  mocks.tableFindUnique.mockResolvedValue(tableA)
  mocks.tableFindFirst.mockResolvedValue({ id: 'table-a' })
  mocks.resFindFirst.mockResolvedValue(resExisting)
  mocks.resFindMany.mockResolvedValue([])
  mocks.waitlistFindFirst.mockResolvedValue(waitlistRow)
  // tx klient — privzeto srečna pot
  mocks.txResFindFirst.mockResolvedValue(resExisting)
  mocks.txResFindMany.mockResolvedValue([])
  mocks.txResUpdate.mockResolvedValue({ ...resExisting, table: { id: 'table-a', number: 5, capacity: 6, area: 'main' } })
  mocks.txResUpdateMany.mockResolvedValue({ count: 1 })
  mocks.txResCount.mockResolvedValue(0)
  mocks.txResFindUnique.mockResolvedValue({ ...resExisting, status: 'cancelled' })
  mocks.txTableUpdateMany.mockResolvedValue({ count: 1 })
  mocks.txOrderFindFirst.mockResolvedValue(null)
  mocks.txTableFindUnique.mockResolvedValue(tableA)
  mocks.txResCreate.mockResolvedValue({ id: 'res-new', locationId: LOC_A })
  // waitlist CAS
  mocks.waitlistUpdateMany.mockResolvedValue({ count: 1 })
  mocks.waitlistFindUnique.mockResolvedValue(waitlistRow)
  mocks.waitlistDeleteMany.mockResolvedValue({ count: 1 })
  // tx dispatcher — enoten tx klient za create + PUT + DELETE
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn({
      reservation: {
        findFirst: mocks.txResFindFirst,
        findMany: mocks.txResFindMany,
        update: mocks.txResUpdate,
        updateMany: mocks.txResUpdateMany,
        count: mocks.txResCount,
        findUnique: mocks.txResFindUnique,
        create: mocks.txResCreate,
      },
      table: {
        findUnique: mocks.txTableFindUnique,
        updateMany: mocks.txTableUpdateMany,
      },
      order: { findFirst: mocks.txOrderFindFirst },
    }),
  )
  mocks.createAuditLog.mockResolvedValue(undefined)
})

const jsonReq = (url: string, body: unknown, method = 'POST') =>
  new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

const PUT_PARAMS = { params: Promise.resolve({ id: 'res-1' }) }
const WL_PARAMS = { params: Promise.resolve({ id: 'wl-1' }) }

// ══════════════════════════════════════════════════════════════════
// A — F1: error kontrakt (POST tx-notranje napake dosežejo klienta)
// ══════════════════════════════════════════════════════════════════
describe('R102-A: POST /api/reservations — strukturirani tx throw → pravi HTTP status (prej 500)', () => {
  it('tx-notranji 409 overlap → 409 z sporočilom (prej 500 "[object Object]")', async () => {
    // pre-tx overlap check pade skozi (prazna baza), tx-notranji check zadane
    mocks.tableFindUnique.mockResolvedValue(tableA)
    mocks.txResFindMany.mockResolvedValue([
      { id: 'res-9', dateTime: new Date(RES_DT), duration: 120 },
    ])

    const res = await reservationsCreatePOST(jsonReq('http://localhost:3000/api/reservations', RES_BODY))

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('je že rezervirana')
    expect(mocks.txResCreate).not.toHaveBeenCalled()
  })

  it('tx-notranji 404 (miza izgubljena mid-flight) → 404, ne 500', async () => {
    mocks.tableFindUnique.mockResolvedValue(tableA)
    mocks.txTableFindUnique.mockResolvedValue(null) // miza deleted med pre-tx in tx

    const res = await reservationsCreatePOST(jsonReq('http://localhost:3000/api/reservations', RES_BODY))

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Miza ne obstaja')
  })

  it('tx-notranji 400 (kapaciteta) → 400, ne 500', async () => {
    mocks.tableFindUnique.mockResolvedValue(tableA)
    mocks.txTableFindUnique.mockResolvedValue({ ...tableA, capacity: 2 }) // partySize 4

    const res = await reservationsCreatePOST(jsonReq('http://localhost:3000/api/reservations', RES_BODY))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('kapaciteto 2')
  })

  it('P2034 serialization abort (sočasni create) → 409 "poskusite znova", ne 500', async () => {
    mocks.tableFindUnique.mockResolvedValue(tableA)
    // Prisma serialization error — tx dispatcher zavrne s { code: 'P2034' }
    mocks.transaction.mockRejectedValue({ code: 'P2034' })

    const res = await reservationsCreatePOST(jsonReq('http://localhost:3000/api/reservations', RES_BODY))

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('drug uporabnik je rezerviral to mizo')
  })

  it('fallback: NE-strukturirana napaka (Error) → ostane handleApiError 500', async () => {
    mocks.tableFindUnique.mockResolvedValue(tableA)
    mocks.transaction.mockRejectedValue(new Error('db connection lost'))

    const res = await reservationsCreatePOST(jsonReq('http://localhost:3000/api/reservations', RES_BODY))

    expect(res.status).toBe(500)
  })
})

// ══════════════════════════════════════════════════════════════════
// B — F2: PUT atomarnost (Serializable tx kontrakt)
// ══════════════════════════════════════════════════════════════════
describe('R102-B: PUT /api/reservations/[id] — state machine + conflict + update + flip atomarno', () => {
  it('Serializable isolationLevel pin (mirror create-handler FIX #3)', async () => {
    await reservationsPUT(
      jsonReq('http://localhost:3000/api/reservations/res-1', { status: 'seated' }, 'PUT'),
      PUT_PARAMS,
    )
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' })
  })

  it('call-order pin: tx-fresh re-read → conflict check → update → table flip (invocationCallOrder)', async () => {
    const res = await reservationsPUT(
      jsonReq('http://localhost:3000/api/reservations/res-1', { status: 'seated' }, 'PUT'),
      PUT_PARAMS,
    )

    expect(res.status).toBe(200)
    expect(mocks.txResFindFirst).toHaveBeenCalledTimes(1)
    expect(mocks.txResUpdate).toHaveBeenCalledTimes(1)
    expect(mocks.txTableUpdateMany).toHaveBeenCalledTimes(1)
    // RAZRED TOCTOU: fresh read je MORA biti pred validacijami/update/flip
    expect(mocks.txResFindFirst.mock.invocationCallOrder[0]).toBeLessThan(mocks.txResUpdate.mock.invocationCallOrder[0])
    expect(mocks.txResUpdate.mock.invocationCallOrder[0]).toBeLessThan(mocks.txTableUpdateMany.mock.invocationCallOrder[0])
  })

  it('TOCTOU state machine: stale db status "confirmed", tx-fresh "seated" → no_show REŽAN (400, ne zapis)', async () => {
    // simulacija race-a: db-level findFirst je prebral 'confirmed' (prehod
    // dovoljen), ampak medtem je druga seja zapisala 'seated' → tx-fresh
    // re-read to vidi → no_show iz seated NI dovoljen prehod.
    mocks.txResFindFirst.mockResolvedValue({ ...resExisting, status: 'seated' })

    const res = await reservationsPUT(
      jsonReq('http://localhost:3000/api/reservations/res-1', { status: 'no_show' }, 'PUT'),
      PUT_PARAMS,
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain("Prehod iz 'seated' v 'no_show' ni dovoljen")
    expect(mocks.txResUpdate).not.toHaveBeenCalled()
    expect(mocks.txTableUpdateMany).not.toHaveBeenCalled()
  })

  it('TOCTOU double-booking: tx-fresh candidates vsebujejo prekrivanje → 409 generično (PII varno)', async () => {
    mocks.txResFindMany.mockResolvedValue([
      { id: 'r-2', customerName: 'Tuj Gost PII', dateTime: new Date(RES_DT), duration: 120 },
    ])

    const res = await reservationsPUT(
      jsonReq('http://localhost:3000/api/reservations/res-1', { dateTime: CONFLICT_DT }, 'PUT'),
      PUT_PARAMS,
    )

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('že rezervirana')
    expect(body.error).not.toContain('Tuj Gost PII')
    expect(mocks.txResUpdate).not.toHaveBeenCalled()
  })

  it('conflict check teče tudi pri samo-dateTime (Runda 53 ohranjena v tx)', async () => {
    await reservationsPUT(
      jsonReq('http://localhost:3000/api/reservations/res-1', { dateTime: CONFLICT_DT }, 'PUT'),
      PUT_PARAMS,
    )
    // findMany MORA biti klican (prej Runda 53 bug: samo "oba polja")
    expect(mocks.txResFindMany).toHaveBeenCalledTimes(1)
    const where = mocks.txResFindMany.mock.calls[0][0].where
    expect(where.tableId).toBe('table-a')
    expect(where.status).toEqual({ in: ['confirmed', 'seated'] })
    expect(where.id).toEqual({ not: 'res-1' })
  })

  it('mid-flight brisanje: tx-fresh null → 404 + NI pisnih operacij', async () => {
    mocks.txResFindFirst.mockResolvedValue(null)

    const res = await reservationsPUT(
      jsonReq('http://localhost:3000/api/reservations/res-1', { notes: 'x' }, 'PUT'),
      PUT_PARAMS,
    )

    expect(res.status).toBe(404)
    expect(mocks.txResUpdate).not.toHaveBeenCalled()
    expect(mocks.txTableUpdateMany).not.toHaveBeenCalled()
  })

  it('P2034 serialization abort (sočasni PUT) → 409 "poskusite znova"', async () => {
    mocks.transaction.mockRejectedValue({ code: 'P2034' })

    const res = await reservationsPUT(
      jsonReq('http://localhost:3000/api/reservations/res-1', { notes: 'x' }, 'PUT'),
      PUT_PARAMS,
    )

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('hkrati spreminjal to rezervacijo')
  })
})

// ══════════════════════════════════════════════════════════════════
// C — F3: DELETE state machine (terminali so terminali)
// ══════════════════════════════════════════════════════════════════
describe('R102-C: DELETE /api/reservations/[id] — CAS state machine', () => {
  it('terminal completed → CAS count 0 → 400 s statusom v sporočilu (prej tiho "preklic")', async () => {
    mocks.resFindFirst.mockResolvedValue({ ...resExisting, status: 'completed' })
    mocks.txResFindFirst.mockResolvedValue({ ...resExisting, status: 'completed' })
    mocks.txResUpdateMany.mockResolvedValue({ count: 0 }) // CAS: completed ni v in-listi

    const res = await reservationsDELETE(
      new Request('http://localhost:3000/api/reservations/res-1', { method: 'DELETE' }),
      PUT_PARAMS,
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain("končnem stanju ('completed')")
    expect(mocks.txResCount).not.toHaveBeenCalled()
    expect(mocks.txTableUpdateMany).not.toHaveBeenCalled()
  })

  it('terminal no_show → 400; cancel nad cancelled → 400 (idempotenca z jasnim statusom)', async () => {
    for (const terminal of ['no_show', 'cancelled'] as const) {
      mocks.resFindFirst.mockResolvedValue({ ...resExisting, status: terminal })
      mocks.txResFindFirst.mockResolvedValue({ ...resExisting, status: terminal })
      mocks.txResUpdateMany.mockResolvedValue({ count: 0 })

      const res = await reservationsDELETE(
        new Request('http://localhost:3000/api/reservations/res-1', { method: 'DELETE' }),
        PUT_PARAMS,
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain(`'${terminal}'`)
    }
  })

  it('uspešen preklic confirmed → CAS pin + count-guard + reset (V tx klientu)', async () => {
    const res = await reservationsDELETE(
      new Request('http://localhost:3000/api/reservations/res-1', { method: 'DELETE' }),
      PUT_PARAMS,
    )

    expect(res.status).toBe(200)
    // CAS: SAMO confirmed/seated so preklicljivi (atomarno v where)
    expect(mocks.txResUpdateMany).toHaveBeenCalledWith({
      where: { id: 'res-1', status: { in: ['confirmed', 'seated'] } },
      data: { status: 'cancelled' },
    })
    expect(mocks.txResCount).toHaveBeenCalledWith({
      where: { tableId: 'table-a', id: { not: 'res-1' }, status: { in: ['confirmed', 'seated'] } },
    })
    expect(mocks.txTableUpdateMany).toHaveBeenCalledWith({
      where: { id: 'table-a', status: 'reserved' },
      data: { status: 'available' },
    })
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' })
  })

  it('P2034 (sočasni preklic dveh rezervacij iste mize) → 409', async () => {
    mocks.transaction.mockRejectedValue({ code: 'P2034' })

    const res = await reservationsDELETE(
      new Request('http://localhost:3000/api/reservations/res-1', { method: 'DELETE' }),
      PUT_PARAMS,
    )

    expect(res.status).toBe(409)
  })

  it('seated → preklic DOVOLJEN (CAS in-lista vključuje seated)', async () => {
    mocks.txResFindFirst.mockResolvedValue({ ...resExisting, status: 'seated' })

    const res = await reservationsDELETE(
      new Request('http://localhost:3000/api/reservations/res-1', { method: 'DELETE' }),
      PUT_PARAMS,
    )

    expect(res.status).toBe(200)
    expect(mocks.txResUpdateMany).toHaveBeenCalledTimes(1)
  })
})

// ══════════════════════════════════════════════════════════════════
// D — F4: waitlist PUT atomarni CAS (check-and-set)
// ══════════════════════════════════════════════════════════════════
describe('R102-D: PUT /api/waitlist/[id] — CAS namesto check-then-act', () => {
  it("CAS pin: updateMany where { id, status: existing.status } (action 'seat')", async () => {
    const res = await waitlistPUT(
      jsonReq('http://localhost:3000/api/waitlist/wl-1', { action: 'seat', tableId: 'table-a' }, 'PUT'),
      WL_PARAMS,
    )

    expect(res.status).toBe(200)
    expect(mocks.waitlistUpdate).not.toHaveBeenCalled() // plain update IZBRISAN iz poti
    expect(mocks.waitlistUpdateMany).toHaveBeenCalledTimes(1)
    expect(mocks.waitlistUpdateMany.mock.calls[0][0]).toEqual({
      where: { id: 'wl-1', status: 'waiting' },
      data: expect.objectContaining({ status: 'seated', tableId: 'table-a' }),
    })
  })

  it('CAS race: vnos medtem spremenjen (count 0) → 409 + NI re-fetcha', async () => {
    mocks.waitlistUpdateMany.mockResolvedValue({ count: 0 }) // status ni več 'waiting'

    const res = await waitlistPUT(
      jsonReq('http://localhost:3000/api/waitlist/wl-1', { action: 'notify' }, 'PUT'),
      WL_PARAMS,
    )

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('v medtem spremenjen')
    expect(mocks.waitlistFindUnique).not.toHaveBeenCalled()
  })

  it('uspeh → odgovor iz svežega re-fetcha (findUnique)', async () => {
    mocks.waitlistFindUnique.mockResolvedValue({ ...waitlistRow, status: 'notified' })

    const res = await waitlistPUT(
      jsonReq('http://localhost:3000/api/waitlist/wl-1', { action: 'notify' }, 'PUT'),
      WL_PARAMS,
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('notified')
  })

  it('direct-update veja (brez action) je prav tako CAS zaščitena', async () => {
    const res = await waitlistPUT(
      jsonReq('http://localhost:3000/api/waitlist/wl-1', { notes: 'x' }, 'PUT'),
      WL_PARAMS,
    )

    expect(res.status).toBe(200)
    expect(mocks.waitlistUpdateMany.mock.calls[0][0].where).toEqual({ id: 'wl-1', status: 'waiting' })
  })
})

// ══════════════════════════════════════════════════════════════════
// E — F5: waitlist DELETE scoped deleteMany
// ══════════════════════════════════════════════════════════════════
describe('R102-E: DELETE /api/waitlist/[id] — scoped deleteMany', () => {
  it('deleteMany where { id, locationId } pin (scope v where, ne samo v findFirst)', async () => {
    const res = await waitlistDELETE(
      new Request('http://localhost:3000/api/waitlist/wl-1', { method: 'DELETE' }),
      WL_PARAMS,
    )

    expect(res.status).toBe(200)
    expect(mocks.waitlistDeleteMany).toHaveBeenCalledWith({
      where: { id: 'wl-1', locationId: LOC_A },
    })
  })

  it('mid-flight brisanje (count 0) → 404, ne P2025/500', async () => {
    mocks.waitlistDeleteMany.mockResolvedValue({ count: 0 })

    const res = await waitlistDELETE(
      new Request('http://localhost:3000/api/waitlist/wl-1', { method: 'DELETE' }),
      WL_PARAMS,
    )

    expect(res.status).toBe(404)
  })
})

// ══════════════════════════════════════════════════════════════════
// F — fs-guardi (vir pini)
// ══════════════════════════════════════════════════════════════════
describe('R102-F: fs-guard — vir pini', () => {
  const readSrc = (relPath: string) =>
    readFileSync(join(process.cwd(), ...relPath.split('/')), 'utf-8')

  it('structuredErrorResponse je v vseh treh catch-blokih reservations rut', () => {
    const collective = readSrc('src/app/api/reservations/route.ts')
    const idRoute = readSrc('src/app/api/reservations/[id]/route.ts')
    // POST kolektivne rute + PUT + DELETE [id] (GET ostaja handleApiError — brez tx)
    expect(collective.match(/structuredErrorResponse\(error, 'POST \/api\/reservations'/g)?.length).toBe(1)
    expect(idRoute.match(/structuredErrorResponse\(error, 'PUT \/api\/reservations\/\[id\]'/g)?.length).toBe(1)
    expect(idRoute.match(/structuredErrorResponse\(error, 'DELETE \/api\/reservations\/\[id\]'/g)?.length).toBe(1)
  })

  it('PUT in DELETE [id] sta Serializable (2× isolationLevel pin)', () => {
    const idRoute = readSrc('src/app/api/reservations/[id]/route.ts')
    expect(idRoute.match(/isolationLevel: 'Serializable'/g)?.length).toBe(2)
  })

  it('waitlist PUT uporablja ATOMARNI CAS (updateMany z status pogojem), plain update izbran iz poti', () => {
    const src = readSrc('src/app/api/waitlist/[id]/route.ts')
    expect(src).toContain("where: { id, status: existing.status }")
    expect(src).toContain('db.waitlistEntry.updateMany(')
    expect(src).toContain('db.waitlistEntry.deleteMany(')
    // plain update/delete ne smeta več obstajati v PUT/DELETE tokovih
    expect(src).not.toContain('db.waitlistEntry.update({')
    expect(src).not.toContain('db.waitlistEntry.delete({')
  })

  it('create-handler structured throws ostajajo (sedaj preslikani na ruti)', () => {
    const src = readSrc('src/app/api/reservations/_helpers/create-handler.ts')
    expect(src.match(/throw \{/g)?.length).toBeGreaterThanOrEqual(3)
    // R103: implementacija povzignena v canonical src/lib/structured-error.ts;
    // reservations helper je re-export (isti kontrakt, en vir za 4 module)
    const helper = readSrc('src/app/api/reservations/_helpers/structured-error.ts')
    expect(helper).toContain("export { structuredErrorResponse } from '@/lib/structured-error'")
    const lib = readSrc('src/lib/structured-error.ts')
    expect(lib).toContain("typeof (error as { status: unknown }).status === 'number'")
    expect(lib).toContain('handleApiError(error, context, fallbackMessage)')
  })
})
