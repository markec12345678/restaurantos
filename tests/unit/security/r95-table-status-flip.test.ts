// ============================================
// R95-c — Table.status='reserved' FLIP NA REZERVACIJSKEM LIFECYCLE-U
// ============================================
// Toast-standard tloris: DB Table.status je avtoriteta za tloris/KPI.
// Pred R95-c je app DB status mize NIKOLI nastavila na 'reserved' —
// floorplan je sintetiziral reserved samo client-side nad 'available' mizami.
//
// Pokritje (unit, handler klici direktno — hišni stil r85-med-a-scope):
//
//   1. create-handler: create z tableId → tx.table.updateMany
//      { id, status:'available' } → { status:'reserved' } ZNOTRAJ
//      obstoječe serializable transakcije, PRED tx return
//      (invocationCallOrder: create → table.updateMany);
//      brez tableId → ni klica; miza medtem 'occupied' → where filter
//      status:'available' = no-op guard (nikoli ne clobberaj).
//
//   2. PUT seated: viri razširjeni ['available','occupied','reserved']
//      (exact array pin) — seated na DB-reserved mizi flipa v occupied.
//
//   3. PUT no_show / cancelled: count-guard (druge aktivne rezervacije
//      confirmed/seated na mizi) — 0 → reset reserved→available,
//      > 0 → miza ostane reserved; brez tableId → skip.
//
//   4. PUT completed: reset OMEJEN na status:'occupied' — DB 'reserved'
//      druge prihodnje rezervacije MORA preživetí (exact pin).
//
//   5. DELETE (cancel): isti count-guard reset kot PUT cancelled.
//
//   6. fs-guard: ReservationsList bookable filter vsebuje 'reserved'
//      (available || reserved) v OBEH kandidatskih filtrih.
//
// Lekcije R85 (hišni stil): vi.hoisted + vi.mock('@/lib/db') + mockResolvedValue
// (NIKOLI .Once — preživi clearAllMocks); createAuditLog je TOP-LEVEL export
// '@/lib/db'; tx klient ima ločene moke od db-level.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  // db models
  resFindFirst: vi.fn(),
  resFindMany: vi.fn(),
  resUpdate: vi.fn(),
  resCount: vi.fn(),
  tableFindFirst: vi.fn(),
  tableFindUnique: vi.fn(),
  tableUpdateMany: vi.fn(),
  orderFindFirst: vi.fn(),
  // $transaction tx-client (ločeni moki od db-level — LEKCIJA R85)
  transaction: vi.fn(),
  txTableFindUnique: vi.fn(),
  txTableUpdateMany: vi.fn(),
  txResFindMany: vi.fn(),
  txResCreate: vi.fn(),
  // R102: PUT/DELETE [id] tok je zdaj ATOMARNO v tx klientu (state machine +
  // conflict + update + flip-i) — flip/count/update pini so preklopljeni na
  // tx-level mocke (db-level ostanejo za create pre-tx validacijo).
  txResFindFirst: vi.fn(),
  txResUpdate: vi.fn(),
  txResUpdateMany: vi.fn(),
  txResCount: vi.fn(),
  txResFindUnique: vi.fn(),
  txOrderFindFirst: vi.fn(),
  // TOP-LEVEL export '@/lib/db' (LEKCIJA R85: ne gnezdi v db!)
  createAuditLog: vi.fn(),
  // ostalo
  emitEvent: vi.fn(),
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
      update: mocks.resUpdate,
      count: mocks.resCount,
    },
    table: {
      findFirst: mocks.tableFindFirst,
      findUnique: mocks.tableFindUnique,
      updateMany: mocks.tableUpdateMany,
    },
    order: { findFirst: mocks.orderFindFirst },
    $transaction: mocks.transaction,
  },
  createAuditLog: mocks.createAuditLog,
}))

vi.mock('@/lib/event-emitter', () => ({ emitEvent: mocks.emitEvent }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// Utišaj morebiten realen output (api-utils handleApiError itd.)
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

import { handleCreateReservation } from '@/app/api/reservations/_helpers/create-handler'
import { PUT as reservationsPUT, DELETE as reservationsDELETE } from '@/app/api/reservations/[id]/route'

const LOC_A = 'loc-tenant-a'
const RES_DT = '2026-06-01T18:00:00.000Z'

const tableA = { id: 'table-a', number: 5, capacity: 6, status: 'available', locationId: LOC_A }

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

beforeEach(() => {
  vi.clearAllMocks()
  // LEKCIJA R85: samo mockResolvedValue (Once preživi clearAllMocks)
  mocks.requireAuth.mockResolvedValue({
    session: { employeeId: 'emp-1', role: 'admin', locationId: LOC_A },
    error: null,
  })
  mocks.resFindFirst.mockResolvedValue(resExisting)
  mocks.resFindMany.mockResolvedValue([])
  mocks.resUpdate.mockResolvedValue(resExisting)
  mocks.resCount.mockResolvedValue(0)
  mocks.tableFindFirst.mockResolvedValue({ id: 'table-a' })
  mocks.tableFindUnique.mockResolvedValue(tableA)
  mocks.tableUpdateMany.mockResolvedValue({ count: 1 })
  mocks.orderFindFirst.mockResolvedValue(null)
  mocks.txTableFindUnique.mockResolvedValue(tableA)
  mocks.txTableUpdateMany.mockResolvedValue({ count: 1 })
  mocks.txResFindMany.mockResolvedValue([])
  mocks.txResCreate.mockResolvedValue({ id: 'res-new', locationId: LOC_A, customerName: 'Ana' })
  // R102 tx defaulti (PUT/DELETE [id] tok)
  mocks.txResFindFirst.mockResolvedValue(resExisting)
  mocks.txResUpdate.mockResolvedValue(resExisting)
  mocks.txResUpdateMany.mockResolvedValue({ count: 1 })
  mocks.txResCount.mockResolvedValue(0)
  mocks.txResFindUnique.mockResolvedValue(resExisting)
  mocks.txOrderFindFirst.mockResolvedValue(null)
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn({
      table: { findUnique: mocks.txTableFindUnique, updateMany: mocks.txTableUpdateMany },
      reservation: {
        findMany: mocks.txResFindMany,
        create: mocks.txResCreate,
        findFirst: mocks.txResFindFirst,
        update: mocks.txResUpdate,
        updateMany: mocks.txResUpdateMany,
        count: mocks.txResCount,
        findUnique: mocks.txResFindUnique,
      },
      order: { findFirst: mocks.txOrderFindFirst },
    }),
  )
  mocks.createAuditLog.mockResolvedValue(undefined)
  mocks.emitEvent.mockResolvedValue(undefined)
})

const jsonReq = (url: string, body: unknown, method = 'POST') =>
  new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

const PUT_PARAMS = { params: Promise.resolve({ id: 'res-1' }) }

// ══════════════════════════════════════════════════════════════════
// 1 — CREATE-HANDLER: flip znotraj serializable tx
// ══════════════════════════════════════════════════════════════════
describe('R95-c: create-handler — tx.table.updateMany available→reserved', () => {
  it('create z tableId → flip klican z where { id, status:\'available\' } data { status:\'reserved\' }, create PREJ (invocationCallOrder)', async () => {
    const result = await handleCreateReservation(
      { tableId: 'table-a', dateTime: RES_DT, partySize: 4, duration: 120, customerName: 'Ana' },
      'emp-1',
      { locationId: LOC_A },
    )

    expect('error' in result).toBe(false)
    expect(mocks.txResCreate).toHaveBeenCalledTimes(1)
    // Klicna oblika TOČNO (create-handler flip, znotraj tx klienta)
    expect(mocks.txTableUpdateMany).toHaveBeenCalledTimes(1)
    expect(mocks.txTableUpdateMany.mock.calls[0][0]).toEqual({
      where: { id: 'table-a', status: 'available' },
      data: { status: 'reserved' },
    })
    // RAZLOG za PO create: če create pade, flip ne sme ostati —
    // vrstni red create → table.updateMany (pred tx return) pinan.
    expect(mocks.txResCreate.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.txTableUpdateMany.mock.invocationCallOrder[0],
    )
  })

  it('create BREZ tableId (walk-in) → tx.table.updateMany NI klican', async () => {
    const result = await handleCreateReservation(
      { dateTime: RES_DT, partySize: 2, duration: 90, customerName: 'Bor' },
      'emp-1',
      { locationId: LOC_A },
    )

    expect('error' in result).toBe(false)
    expect(mocks.txResCreate).toHaveBeenCalledTimes(1)
    expect(mocks.txTableUpdateMany).not.toHaveBeenCalled()
  })

  it('miza v medtem \'occupied\' → updateMany kljub klicu no-op (where filter status:\'available\' — nikoli ne clobberaj)', async () => {
    // Pre-tx validacija in tx re-check vidita mizo, ki je medtem postala
    // occupied (race z naročilom) — handler ne gate-a na statusu (overlap
    // check ostane avtoriteta), ampak where filter status:'available'
    // naredi flip DB-side NO-OP za ne-available mizo.
    mocks.tableFindUnique.mockResolvedValue({ ...tableA, status: 'occupied' })
    mocks.txTableFindUnique.mockResolvedValue({ ...tableA, status: 'occupied' })

    const result = await handleCreateReservation(
      { tableId: 'table-a', dateTime: RES_DT, partySize: 4, duration: 120, customerName: 'Ana' },
      'emp-1',
      { locationId: LOC_A },
    )

    expect('error' in result).toBe(false)
    expect(mocks.txTableUpdateMany).toHaveBeenCalledTimes(1)
    // PIN: status:'available' MORA biti v where (no-op guard za occupied/
    // cleaning/blocked mizo) — klic SAM po sebi ne sme clobberati statusa.
    const call = mocks.txTableUpdateMany.mock.calls[0][0]
    expect(call.where.status).toBe('available')
    expect(call.where).toEqual({ id: 'table-a', status: 'available' })
    expect(call.data).toEqual({ status: 'reserved' })
  })
})

// ══════════════════════════════════════════════════════════════════
// 2 — PUT seated: viri ['available','occupied','reserved']
// ══════════════════════════════════════════════════════════════════
describe('R95-c: PUT seated — DB-reserved miza se posedanje v \'occupied\'', () => {
  it('seated flip: where.status in-lista TOČNO [available, occupied, reserved]', async () => {
    const res = await reservationsPUT(
      jsonReq('http://localhost:3000/api/reservations/res-1', { status: 'seated' }, 'PUT'),
      PUT_PARAMS,
    )

    expect(res.status).toBe(200)
    expect(mocks.txResUpdate).toHaveBeenCalledTimes(1)
    expect(mocks.txTableUpdateMany).toHaveBeenCalledTimes(1)
    // Exact array pin — 'reserved' MORA biti v virih (prej je manjal:
    // seated na reserved mizi bi zamudil flip → mrtva reserved).
    expect(mocks.txTableUpdateMany.mock.calls[0][0]).toEqual({
      where: { id: 'table-a', status: { in: ['available', 'occupied', 'reserved'] } },
      data: { status: 'occupied' },
    })
  })
})

// ══════════════════════════════════════════════════════════════════
// 3 — PUT no_show / cancelled: count-guard reset
// ══════════════════════════════════════════════════════════════════
describe('R95-c: PUT no_show/cancelled — reserved reset s count-guardom', () => {
  it.each(['no_show', 'cancelled'] as const)('%s: activeOthers 0 → reset reserved→available (count where pin)', async (status) => {
    const res = await reservationsPUT(
      jsonReq('http://localhost:3000/api/reservations/res-1', { status }, 'PUT'),
      PUT_PARAMS,
    )

    expect(res.status).toBe(200)
    // Count-guard: brez datumskega filtra — katerakoli prihodnja aktivna
    // rezervacija upravičuje ostanek 'reserved' (R102: zdaj v tx klientu)
    expect(mocks.txResCount).toHaveBeenCalledWith({
      where: {
        tableId: 'table-a',
        id: { not: 'res-1' },
        status: { in: ['confirmed', 'seated'] },
      },
    })
    expect(mocks.txTableUpdateMany).toHaveBeenCalledTimes(1)
    expect(mocks.txTableUpdateMany.mock.calls[0][0]).toEqual({
      where: { id: 'table-a', status: 'reserved' },
      data: { status: 'available' },
    })
  })

  it.each(['no_show', 'cancelled'] as const)('%s: activeOthers > 0 → miza ostane reserved (NI reset klica)', async (status) => {
    mocks.txResCount.mockResolvedValue(1) // druga aktivna rezervacija na mizi

    const res = await reservationsPUT(
      jsonReq('http://localhost:3000/api/reservations/res-1', { status }, 'PUT'),
      PUT_PARAMS,
    )

    expect(res.status).toBe(200)
    expect(mocks.txResCount).toHaveBeenCalledTimes(1)
    expect(mocks.txTableUpdateMany).not.toHaveBeenCalled()
  })

  it.each(['no_show', 'cancelled'] as const)('%s: brez tableId (rezervacija brez mize) → count + reset skip', async (status) => {
    mocks.txResFindFirst.mockResolvedValue({ ...resExisting, tableId: null })

    const res = await reservationsPUT(
      jsonReq('http://localhost:3000/api/reservations/res-1', { status }, 'PUT'),
      PUT_PARAMS,
    )

    expect(res.status).toBe(200)
    expect(mocks.txResCount).not.toHaveBeenCalled()
    expect(mocks.txTableUpdateMany).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// 4 — PUT completed: reset OMEJEN na 'occupied' (reserved preživi)
// ══════════════════════════════════════════════════════════════════
describe('R95-c: PUT completed — DB reserved druge rezervacije preživi', () => {
  it('completed: reset where status:\'occupied\' ONLY (ni reserved v where); count-guard NI klican', async () => {
    mocks.txResFindFirst.mockResolvedValue({ ...resExisting, status: 'seated' })

    const res = await reservationsPUT(
      jsonReq('http://localhost:3000/api/reservations/res-1', { status: 'completed' }, 'PUT'),
      PUT_PARAMS,
    )

    expect(res.status).toBe(200)
    expect(mocks.txOrderFindFirst).toHaveBeenCalledTimes(1) // active-order guard ohranjen (tx)
    expect(mocks.txTableUpdateMany).toHaveBeenCalledTimes(1)
    // PIN: 'occupied' kot STRING (ne in-lista) — DB 'reserved' (prihodnja
    // druga rezervacija) MORA preživetí completed te rezervacije.
    expect(mocks.txTableUpdateMany.mock.calls[0][0]).toEqual({
      where: { id: 'table-a', status: 'occupied' },
      data: { status: 'available' },
    })
    expect(mocks.txResCount).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// 5 — DELETE (cancel): isti count-guard reset kot PUT cancelled
// ══════════════════════════════════════════════════════════════════
describe('R95-c: DELETE — cancel reset (mirror PUT cancelled) — R102: CAS + tx', () => {
  it('activeOthers 0 → CAS cancelled + reset reserved→available (CAS + count where pin)', async () => {
    const res = await reservationsDELETE(
      new Request('http://localhost:3000/api/reservations/res-1', { method: 'DELETE' }),
      PUT_PARAMS,
    )

    expect(res.status).toBe(200)
    // R102: ATOMARNI CAS — updateMany { status: { in: ['confirmed','seated'] } }
    // (prej plain update brez pogoja = terminal state bypass)
    expect(mocks.txResUpdateMany).toHaveBeenCalledWith({
      where: { id: 'res-1', status: { in: ['confirmed', 'seated'] } },
      data: { status: 'cancelled' },
    })
    expect(mocks.txResCount).toHaveBeenCalledWith({
      where: {
        tableId: 'table-a',
        id: { not: 'res-1' },
        status: { in: ['confirmed', 'seated'] },
      },
    })
    expect(mocks.txTableUpdateMany).toHaveBeenCalledTimes(1)
    expect(mocks.txTableUpdateMany.mock.calls[0][0]).toEqual({
      where: { id: 'table-a', status: 'reserved' },
      data: { status: 'available' },
    })
  })

  it('activeOthers 1 → miza ostane reserved (NI reset klica)', async () => {
    mocks.txResCount.mockResolvedValue(1)

    const res = await reservationsDELETE(
      new Request('http://localhost:3000/api/reservations/res-1', { method: 'DELETE' }),
      PUT_PARAMS,
    )

    expect(res.status).toBe(200)
    expect(mocks.txTableUpdateMany).not.toHaveBeenCalled()
  })

  it('brez tableId → count + reset skip', async () => {
    mocks.txResFindFirst.mockResolvedValue({ ...resExisting, tableId: null })

    const res = await reservationsDELETE(
      new Request('http://localhost:3000/api/reservations/res-1', { method: 'DELETE' }),
      PUT_PARAMS,
    )

    expect(res.status).toBe(200)
    expect(mocks.txResCount).not.toHaveBeenCalled()
    expect(mocks.txTableUpdateMany).not.toHaveBeenCalled()
  })

  it('R102: terminal stanje (completed) → CAS count 0 → 400, NI reset klica', async () => {
    mocks.txResUpdateMany.mockResolvedValue({ count: 0 })

    const res = await reservationsDELETE(
      new Request('http://localhost:3000/api/reservations/res-1', { method: 'DELETE' }),
      PUT_PARAMS,
    )

    expect(res.status).toBe(400)
    expect(mocks.txResCount).not.toHaveBeenCalled()
    expect(mocks.txTableUpdateMany).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// 6 — FS-GUARD: ReservationsList bookable filter vključuje 'reserved'
// ══════════════════════════════════════════════════════════════════
describe('R95-c: fs-guard — ReservationsList bookable filter', () => {
  const readSrc = (relPath: string) =>
    readFileSync(join(process.cwd(), ...relPath.split('/')), 'utf-8')

  it('bestFit + fitting filtra vsebujeta (available || reserved) — server overlap check ostane avtoriteta', () => {
    const src = readSrc('src/components/pos/table-reservation/ReservationsList.tsx')
    const matches = src.match(/\(t\.status === 'available' \|\| t\.status === 'reserved'\)/g) || []
    // OBE kandidatski mesti: :bestFit (privzeti pick) + :fitting (select opcije)
    expect(matches.length).toBe(2)
  })
})
