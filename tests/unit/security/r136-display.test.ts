// ============================================
// R136 — EPIC #115 P1-12 CUSTOMER-FACING DISPLAY: javna statusna tabla
// ============================================
// Regresijsko zaklene GET /api/public/display (gost-VARNA READ pot):
//   1. Manjkajoč ?locationId → 404 notInScope PRED vsakim db klicem
//      (ZERO db — kiosk kanon :110-114).
//   2. Neveljavna oblika locationId (regex /^[a-z0-9]{5,50}$/i) → isti
//      404 brez db (ni oraklja).
//   3. Fail-closed lokacija: neznana/neaktivna → 404 + ZERO order klicev
//      (vzorec resolveKioskLocation :76-88).
//   4. Happy path shape: tableNumber izvlečen, table objekt NE uhaja,
//      timestamp ISO prisoten.
//   5. PII kanon: select WHITELIST — PII/polja cene NIKOLI v selectu.
//   6. Where filter: status in ['pending','in-progress','ready'] + 2h okno.
//   7. take 50 + orderBy createdAt asc (stabilen FIFO prikaz).
//   8. Rate limit blokiran → 429 (rateLimitedResponse, ZERO db).
//   9. Cache-Control: no-store (R124b kanon — realno-časovni statusi).
//  10. db napaka → handleApiError('GET /api/public/display').
// Vzorec: trap-DB (vi.hoisted + vi.mock), 1:1 kot r135-kiosk-workflow
// (tenant-scope ostane REALEN — isti 404 kanon kot v produkciji).
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  locationFindFirst: vi.fn(),
  orderFindMany: vi.fn(),
  rateLimitedResponse: vi.fn(),
  handleApiError: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    location: { findFirst: mocks.locationFindFirst },
    order: { findMany: mocks.orderFindMany },
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.checkRateLimit,
  getClientIp: vi.fn(() => '1.2.3.4'),
  PUBLIC_MENU_LIMIT: { maxRequests: 30, windowMs: 60000 },
}))

vi.mock('@/lib/rate-limit/response', () => ({
  rateLimitedResponse: mocks.rateLimitedResponse,
}))

vi.mock('@/lib/api-utils', () => ({
  handleApiError: mocks.handleApiError,
}))

// Route import (PO mockih)
import { GET as displayGET } from '@/app/api/public/display/route'

const LOC = 'locKioskA'
const ISO_A = '2026-01-01T10:00:00.000Z'
const ISO_B = '2026-01-01T10:02:00.000Z'
const ISO_C = '2026-01-01T10:05:00.000Z'

function makeReq(query = `?locationId=${LOC}`) {
  return new Request(`http://x/api/public/display${query}`)
}

beforeEach(() => {
  vi.clearAllMocks()
  // Točen return shape checkRateLimitAsync (rate-limit/core.ts:29-33)
  mocks.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 30 })
  mocks.locationFindFirst.mockResolvedValue({ id: LOC })
  mocks.orderFindMany.mockResolvedValue([])
  mocks.rateLimitedResponse.mockImplementation(
    () => new Response(JSON.stringify({ error: 'Preveč zahtevkov' }), { status: 429 })
  )
  mocks.handleApiError.mockImplementation(
    () => new Response(JSON.stringify({ error: 'Napaka' }), { status: 500 })
  )
})

// ─── 1-3. Fail-closed vhodna validacija (zero-oracle kanon) ───
describe('R136 display: fail-closed lokacijska validacija', () => {
  it('(1) manjkajoč locationId → 404 + ZERO db klicev (kiosk kanon)', async () => {
    const res = await displayGET(new Request('http://x/api/public/display'))
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Lokacija ni najden')
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
    expect(mocks.orderFindMany).not.toHaveBeenCalled()
  })

  it('(2) neveljavna oblika locationId (vezaj/prehkratka) → 404 brez db', async () => {
    const res = await displayGET(makeReq('?locationId=loc-1')) // vezaj ni v /^[a-z0-9]{5,50}$/i
    expect(res.status).toBe(404)
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
    expect(mocks.orderFindMany).not.toHaveBeenCalled()
  })

  it('(3) neznana / neaktivna lokacija → 404 + ZERO order klicev (fail-closed)', async () => {
    mocks.locationFindFirst.mockResolvedValue(null)
    const res = await displayGET(makeReq())
    expect(res.status).toBe(404)
    // scope poizvedba: id + isActive (resolveKioskLocation vzorec)
    expect(mocks.locationFindFirst.mock.calls[0][0].where).toEqual({ id: LOC, isActive: true })
    expect(mocks.orderFindMany).not.toHaveBeenCalled()
  })
})

// ─── 4. Happy path shape ───
describe('R136 display: happy path (guest-safe payload)', () => {
  it('(4) 3 naročila različnih statusov → 200, tableNumber izvlečen, table objekt NI v odgovoru + ISO timestamp', async () => {
    mocks.orderFindMany.mockResolvedValue([
      { orderNumber: 12, status: 'pending', type: 'dine-in', createdAt: new Date(ISO_A), table: { number: 5 } },
      { orderNumber: 13, status: 'in-progress', type: 'takeout', createdAt: new Date(ISO_B), table: null },
      { orderNumber: 14, status: 'ready', type: 'dine-in', createdAt: new Date(ISO_C), table: { number: 12 } },
    ])
    const res = await displayGET(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json() as { orders: Array<Record<string, unknown>>; timestamp: string }
    expect(body.orders).toEqual([
      { orderNumber: 12, status: 'pending', type: 'dine-in', tableNumber: 5, createdAt: ISO_A },
      { orderNumber: 13, status: 'in-progress', type: 'takeout', tableNumber: null, createdAt: ISO_B },
      { orderNumber: 14, status: 'ready', type: 'dine-in', tableNumber: 12, createdAt: ISO_C },
    ])
    // table objekt ne uhaja (samo flat tableNumber)
    for (const o of body.orders) expect(o).not.toHaveProperty('table')
    // timestamp ISO prisoten
    expect(typeof body.timestamp).toBe('string')
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false)
  })
})

// ─── 5-7. Prisma poizvedba (whitelist + where + zajem) ───
describe('R136 display: Prisma select whitelist + where + zajem', () => {
  it('(5) select whitelist: PII/cena polja NIKOLI v select objektu', async () => {
    await displayGET(makeReq())
    const arg = mocks.orderFindMany.mock.calls[0][0]
    // točen whitelist (tableNumber gre prek relacije table.number)
    expect(Object.keys(arg.select).sort()).toEqual(['createdAt', 'orderNumber', 'status', 'table', 'type'])
    expect(arg.select.table).toEqual({ select: { number: true } })
    // belt-and-braces: nobeno PII/polje cene ni nikoli v selectu
    const flat = JSON.stringify(arg.select)
    const banned = [
      'customerName', 'customerPhone', 'customerEmail', 'guestId', 'notes',
      'total', 'subtotal', 'tax', 'tip', 'totalWithTip',
      'paymentStatus', 'paymentMethod', 'deliveryInfo', 'employeeId',
      'idempotencyKey', 'cancelledBy', 'cancelReason',
    ]
    for (const key of banned) expect(flat).not.toContain(`"${key}"`)
  })

  it('(6) where filter: status in [pending, in-progress, ready] + 2h časovno okno', async () => {
    await displayGET(makeReq())
    const where = mocks.orderFindMany.mock.calls[0][0].where
    expect(where.locationId).toBe(LOC)
    expect(where.status).toEqual({ in: ['pending', 'in-progress', 'ready'] })
    expect(where.createdAt.gte).toBeInstanceOf(Date)
    const ageMs = Date.now() - where.createdAt.gte.getTime()
    expect(ageMs).toBeGreaterThanOrEqual(2 * 60 * 60 * 1000 - 1000)
    expect(ageMs).toBeLessThanOrEqual(2 * 60 * 60 * 1000 + 1000)
  })

  it('(7) take 50 + orderBy createdAt asc (stabilen FIFO prikaz)', async () => {
    await displayGET(makeReq())
    const arg = mocks.orderFindMany.mock.calls[0][0]
    expect(arg.take).toBe(50)
    expect(arg.orderBy).toEqual([{ createdAt: 'asc' }])
  })
})

// ─── 8-10. Preostali kanoni (429, no-store, error handling) ───
describe('R136 display: rate limit, cache glava, error handling', () => {
  it('(8) rate limit blokiran → 429 prek rateLimitedResponse + ZERO db', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 45000, remaining: 0 })
    const res = await displayGET(makeReq())
    expect(res.status).toBe(429)
    expect(mocks.rateLimitedResponse).toHaveBeenCalledTimes(1)
    expect(mocks.rateLimitedResponse.mock.calls[0][0]).toBe(45000)
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
    expect(mocks.orderFindMany).not.toHaveBeenCalled()
  })

  it('(9) Cache-Control: no-store glava na 200 odgovoru (R124b kanon)', async () => {
    const res = await displayGET(makeReq())
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('(10) db napaka → handleApiError s kontekstom "GET /api/public/display"', async () => {
    mocks.orderFindMany.mockRejectedValue(new Error('db down'))
    const res = await displayGET(makeReq())
    expect(res.status).toBe(500)
    expect(mocks.handleApiError).toHaveBeenCalledTimes(1)
    const [err, ctx] = mocks.handleApiError.mock.calls[0]
    expect(err).toBeInstanceOf(Error)
    expect(ctx).toBe('GET /api/public/display')
  })
})
