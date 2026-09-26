// ============================================
// R139 — WS PUSH ZA VOZNIKA (epic #115 dopolnitev)
// ============================================
// Pokritje:
//   A. Čista klient wiring (brez mockov): shouldConnectWs — dev/Vercel/
//      flag/brez žetona → false (produkciski-only kanon, runda 12);
//      isDriverRelevantEvent — DELIVERY_UPDATED ✓, NEW_ORDER(type delivery) ✓,
//      dine-in NEW_ORDER ✗, tuji tipi/malformirano ✗.
//   B. Server broadcast payload whitelist (trap-DB, vzorec r137):
//      handleAssignDriver (self-claim IN legacy dispatcher) → DELIVERY_UPDATED
//      reason 'assigned'; handleStatusUpdate → reason 'status_changed';
//      PUT /api/delivery/[id] (dispečer) → reason 'dispatcher_update'.
//      Payload = TOČNO { deliveryInfoId, reason, status, locationId } —
//      NIKOLI PII (ime voznika/telefon/prejemnik/naslov stay v whitelist
//      assignments rute); standalone (order null) → locationId null.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextResponse } from 'next/server'

const LOC_A = 'loc-tenant-a'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  dbTrackingFindUnique: vi.fn(),
  dbInfoFindUnique: vi.fn(),
  employeeFindUnique: vi.fn(),
  txTrackingFindUnique: vi.fn(),
  txTrackingUpdateMany: vi.fn(),
  txTrackingCreate: vi.fn(),
  txInfoFindUnique: vi.fn(),
  txInfoFindFirst: vi.fn(),
  txInfoUpdateMany: vi.fn(),
  txInfoUpdate: vi.fn(),
  txOrderUpdateMany: vi.fn(),
  txCheckUpdateMany: vi.fn(),
  requireAuth: vi.fn(),
  resolveTenantScope: vi.fn(),
  notInScopeResponse: vi.fn(),
  isTrackingInScope: vi.fn(),
  createAuditLog: vi.fn(),
  emitEvent: vi.fn(),
  wsBroadcast: vi.fn(),
}))

const txClient = {
  deliveryTracking: {
    findUnique: mocks.txTrackingFindUnique,
    updateMany: mocks.txTrackingUpdateMany,
    create: mocks.txTrackingCreate,
  },
  deliveryInfo: { findUnique: mocks.txInfoFindUnique, findFirst: mocks.txInfoFindFirst, updateMany: mocks.txInfoUpdateMany, update: mocks.txInfoUpdate },
  order: { updateMany: mocks.txOrderUpdateMany },
  check: { updateMany: mocks.txCheckUpdateMany },
}

vi.mock('@/lib/db', () => ({
  db: {
    $transaction: mocks.transaction,
    deliveryTracking: { findUnique: mocks.dbTrackingFindUnique },
    deliveryInfo: { findUnique: mocks.dbInfoFindUnique },
    employee: { findUnique: mocks.employeeFindUnique },
  },
  createAuditLog: mocks.createAuditLog,
}))

vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: mocks.requireAuth,
  resolveTenantLocationIdOrThrow: mocks.resolveTenantScope,
}))

vi.mock('@/lib/tenant-scope', () => ({
  notInScopeResponse: mocks.notInScopeResponse,
}))

vi.mock('@/app/api/delivery-tracking/_helpers/tracking-queries', () => ({
  isTrackingInScope: mocks.isTrackingInScope,
  handleGetTrackings: vi.fn(),
  handleLocationUpdate: vi.fn(),
}))

vi.mock('@/lib/event-emitter', () => ({
  emitEvent: mocks.emitEvent,
}))

// KLJUČNI mock te runde: ulovimo vse servery-side broadcaste
vi.mock('@/lib/ws-server-broadcast', () => ({
  wsBroadcastEvent: mocks.wsBroadcast,
}))

vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

import { handleAssignDriver, handleStatusUpdate } from '@/app/api/delivery-tracking/_helpers/tracking-actions'
import { PUT as deliveryPUT } from '@/app/api/delivery/[id]/route'
import { shouldConnectWs, isDriverRelevantEvent, WS_RECONNECT_BASE_MS, WS_RECONNECT_MAX_MS } from '@/app/driver/useDriverWs'

function session(overrides: Record<string, unknown> = {}) {
  return { token: 'tok-1', employeeId: 'emp-1', role: 'staff', permissions: ['take_orders'], locationId: LOC_A, ...overrides }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(txClient))
  mocks.notInScopeResponse.mockImplementation(
    (what: string) => NextResponse.json({ error: `${what} ni najden` }, { status: 404 }),
  )
  mocks.requireAuth.mockResolvedValue({ session: session(), error: null })
  mocks.resolveTenantScope.mockReturnValue({ locationId: LOC_A })
  mocks.isTrackingInScope.mockResolvedValue(true)
  mocks.createAuditLog.mockResolvedValue(undefined)
  mocks.emitEvent.mockResolvedValue(undefined)
  mocks.dbInfoFindUnique.mockResolvedValue({ id: 'di-1', order: { id: 'ord-1', orderNumber: 7, locationId: LOC_A } })
  mocks.employeeFindUnique.mockResolvedValue({ name: 'Peter Kolesar', phone: '040123456' })
  mocks.txTrackingFindUnique.mockResolvedValue(null)
  mocks.txTrackingUpdateMany.mockResolvedValue({ count: 1 })
  mocks.txTrackingCreate.mockResolvedValue({ id: 'tr-1', deliveryInfoId: 'di-1', status: 'assigned', driverName: 'Peter Kolesar', estimatedArrival: null })
  mocks.txInfoFindUnique.mockResolvedValue({ id: 'di-1', status: 'pending', order: null })
  mocks.txInfoFindFirst.mockResolvedValue({ id: 'di-1', status: 'preparing', order: { id: 'ord-1', locationId: LOC_A, orderNumber: 7 } })
  mocks.txInfoUpdateMany.mockResolvedValue({ count: 1 })
  mocks.txInfoUpdate.mockResolvedValue({ id: 'di-1' })
  mocks.txOrderUpdateMany.mockResolvedValue({ count: 1 })
  mocks.txCheckUpdateMany.mockResolvedValue({ count: 1 })
})

// ════════════════════════════════════════════════════════════════
// A. Čista klient wiring
// ════════════════════════════════════════════════════════════════
describe('R139 A: shouldConnectWs — produkciski-only kanon', () => {
  const base = { nodeEnv: 'production', isVercelHostname: false, wsDisabledFlag: undefined, hasToken: true }

  it('dev build → false (next dev nima WS strežnika — runda 12)', () => {
    expect(shouldConnectWs({ ...base, nodeEnv: 'development' })).toBe(false)
    expect(shouldConnectWs({ ...base, nodeEnv: 'test' })).toBe(false)
    expect(shouldConnectWs({ ...base, nodeEnv: undefined })).toBe(false)
  })

  it('produkcija + žeton → true', () => {
    expect(shouldConnectWs(base)).toBe(true)
  })

  it('Vercel hostname → false (serverless, /ws ne obstaja)', () => {
    expect(shouldConnectWs({ ...base, isVercelHostname: true })).toBe(false)
  })

  it('NEXT_PUBLIC_WS_DISABLED=true → false (KDS izklop kanon)', () => {
    expect(shouldConnectWs({ ...base, wsDisabledFlag: 'true' })).toBe(false)
    expect(shouldConnectWs({ ...base, wsDisabledFlag: 'false' })).toBe(true)
  })

  it('brez žetona → false (brez AUTH ni smisla povezovati se)', () => {
    expect(shouldConnectWs({ ...base, hasToken: false })).toBe(false)
  })

  it('backoff konstante v kanonu (1 s baza, 30 s strop)', () => {
    expect(WS_RECONNECT_BASE_MS).toBe(1000)
    expect(WS_RECONNECT_MAX_MS).toBe(30_000)
  })
})

describe('R139 A: isDriverRelevantEvent — refetch signal whitelist', () => {
  it('DELIVERY_UPDATED → vedno true (payload se ne preverja — coarse signal)', () => {
    expect(isDriverRelevantEvent('DELIVERY_UPDATED', { deliveryInfoId: 'x' })).toBe(true)
    expect(isDriverRelevantEvent('DELIVERY_UPDATED', null)).toBe(true)
  })

  it('NEW_ORDER samo z type delivery (nova dostava za prevzem)', () => {
    expect(isDriverRelevantEvent('NEW_ORDER', { type: 'delivery', locationId: LOC_A })).toBe(true)
    expect(isDriverRelevantEvent('NEW_ORDER', { type: 'dine_in' })).toBe(false)
    expect(isDriverRelevantEvent('NEW_ORDER', { type: 'takeout' })).toBe(false)
    expect(isDriverRelevantEvent('NEW_ORDER', null)).toBe(false)
    expect(isDriverRelevantEvent('NEW_ORDER', 'malformiran')).toBe(false)
  })

  it('tuji tipi (KDS/NotificationCenter event) → false', () => {
    expect(isDriverRelevantEvent('ORDER_UPDATED', { type: 'delivery' })).toBe(false)
    expect(isDriverRelevantEvent('order_ready', {})).toBe(false)
    expect(isDriverRelevantEvent('STOCK_LOW', {})).toBe(false)
    expect(isDriverRelevantEvent('CALL_WAITER', {})).toBe(false)
    expect(isDriverRelevantEvent('AUTH_SUCCESS', {})).toBe(false)
    expect(isDriverRelevantEvent('CONNECTED', {})).toBe(false)
  })

  it('malformiran tip → false (tiho)', () => {
    expect(isDriverRelevantEvent(undefined, {})).toBe(false)
    expect(isDriverRelevantEvent(null, {})).toBe(false)
    expect(isDriverRelevantEvent(42, {})).toBe(false)
    expect(isDriverRelevantEvent({ type: 'DELIVERY_UPDATED' }, {})).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════
// B. Server broadcast payload whitelist (trap-DB)
// ════════════════════════════════════════════════════════════════
describe('R139 B: DELIVERY_UPDATED broadcast — payload whitelist brez PII', () => {
  it('self-claim (brez driverName) → točno { deliveryInfoId, reason assigned, status assigned, locationId }', async () => {
    const res = await handleAssignDriver('di-1', undefined, undefined, undefined, 'emp-1', LOC_A)
    expect(res.status).toBe(201)
    expect(mocks.wsBroadcast).toHaveBeenCalledTimes(1)
    expect(mocks.wsBroadcast.mock.calls[0][0]).toBe('DELIVERY_UPDATED')
    const payload = mocks.wsBroadcast.mock.calls[0][1]
    expect(payload).toEqual({ deliveryInfoId: 'di-1', reason: 'assigned', status: 'assigned', locationId: LOC_A })
    // WHITELIST: točno 4 ključi — ime/telefon voznika ne uhajajo po WS
    expect(Object.keys(payload).sort()).toEqual(['deliveryInfoId', 'locationId', 'reason', 'status'])
  })

  it('legacy dispatcher (z driverName) → enak signal (eno mesto pokrije obe poti)', async () => {
    const res = await handleAssignDriver('di-1', 'Marko Popotnik', '040999888', undefined, 'emp-9', LOC_A)
    expect(res.status).toBe(201)
    expect(mocks.wsBroadcast).toHaveBeenCalledTimes(1)
    expect(mocks.wsBroadcast.mock.calls[0][1]).toEqual({
      deliveryInfoId: 'di-1', reason: 'assigned', status: 'assigned', locationId: LOC_A,
    })
  })

  it('status_changed (voznikov prehod) → payload s svežim statusom + locationId iz ordera', async () => {
    // pre-read: tracking picked_up; tx-fresh enako; DeliveryInfo ready → picked_up
    mocks.dbTrackingFindUnique.mockResolvedValue({ id: 'tr-1', deliveryInfoId: 'di-1', status: 'picked_up', locationId: LOC_A, driverName: 'Peter Kolesar', driverEmployeeId: 'emp-1' })
    mocks.txTrackingFindUnique.mockResolvedValue({ id: 'tr-1', deliveryInfoId: 'di-1', status: 'picked_up' })
    mocks.txInfoFindUnique.mockResolvedValue({
      id: 'di-1', status: 'ready',
      order: { id: 'ord-1', status: 'ready', paymentStatus: 'unpaid', locationId: LOC_A, type: 'delivery' },
    })

    const res = await handleStatusUpdate('di-1', 'on_the_way', undefined, undefined, LOC_A, undefined, undefined)
    expect(res.status).toBe(200)
    expect(mocks.wsBroadcast).toHaveBeenCalledTimes(1)
    expect(mocks.wsBroadcast.mock.calls[0][0]).toBe('DELIVERY_UPDATED')
    const payload = mocks.wsBroadcast.mock.calls[0][1]
    expect(payload).toEqual({ deliveryInfoId: 'di-1', reason: 'status_changed', status: 'on_the_way', locationId: LOC_A })
    expect(Object.keys(payload).sort()).toEqual(['deliveryInfoId', 'locationId', 'reason', 'status'])
    // webhook emitEvent pot ostane nespremenjena (za WS push, isti deliveryInfo read)
    expect(mocks.emitEvent).toHaveBeenCalledTimes(1)
    expect(mocks.emitEvent.mock.calls[0][0]).toBe('delivery.status_changed')
  })

  it('standalone dostava (order null) → še vedno signal z locationId null (samo super-admin fan-out)', async () => {
    mocks.dbTrackingFindUnique.mockResolvedValue({ id: 'tr-1', deliveryInfoId: 'di-1', status: 'picked_up', locationId: LOC_A, driverName: 'Peter Kolesar', driverEmployeeId: 'emp-1' })
    mocks.txTrackingFindUnique.mockResolvedValue({ id: 'tr-1', deliveryInfoId: 'di-1', status: 'picked_up' })
    mocks.txInfoFindUnique.mockResolvedValue({ id: 'di-1', status: 'ready', order: null })
    mocks.dbInfoFindUnique.mockResolvedValue({ id: 'di-1', order: null })

    const res = await handleStatusUpdate('di-1', 'on_the_way', undefined, undefined, LOC_A, undefined, undefined)
    expect(res.status).toBe(200)
    expect(mocks.wsBroadcast).toHaveBeenCalledWith('DELIVERY_UPDATED', {
      deliveryInfoId: 'di-1', reason: 'status_changed', status: 'on_the_way', locationId: null,
    })
  })

  it('dispečerjeva ročna pot PUT /api/delivery/[id] → reason dispatcher_update', async () => {
    mocks.txInfoFindFirst
      .mockResolvedValueOnce({ id: 'di-1', status: 'preparing', order: { id: 'ord-1', locationId: LOC_A, orderNumber: 7 } }) // existing
      .mockResolvedValueOnce({ id: 'di-1', status: 'preparing', order: { id: 'ord-1', locationId: LOC_A, orderNumber: 7 } }) // updated (include order)

    const req = new Request('http://localhost:3000/api/delivery/di-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courierName: 'Novi Kurir' }),
    })
    const res = await deliveryPUT(req, { params: Promise.resolve({ id: 'di-1' }) })
    expect(res.status).toBe(200)

    expect(mocks.wsBroadcast).toHaveBeenCalledTimes(1)
    expect(mocks.wsBroadcast.mock.calls[0][0]).toBe('DELIVERY_UPDATED')
    const payload = mocks.wsBroadcast.mock.calls[0][1]
    expect(payload).toEqual({
      deliveryInfoId: 'di-1', reason: 'dispatcher_update', status: 'preparing', locationId: LOC_A,
    })
    expect(Object.keys(payload).sort()).toEqual(['deliveryInfoId', 'locationId', 'reason', 'status'])
  })

  it('CAS izgubljena tekma (409) → NOBENega broadcasta (samo uspešen prehod signalizira)', async () => {
    mocks.dbTrackingFindUnique.mockResolvedValue({ id: 'tr-1', deliveryInfoId: 'di-1', status: 'picked_up', locationId: LOC_A, driverName: 'Peter Kolesar', driverEmployeeId: 'emp-1' })
    mocks.txTrackingFindUnique.mockResolvedValue({ id: 'tr-1', deliveryInfoId: 'di-1', status: 'picked_up' })
    mocks.txInfoFindUnique.mockResolvedValue({ id: 'di-1', status: 'ready', order: null })
    // CAS lost race: drug writer je med read in updateMany spremenil vrstico
    mocks.txTrackingUpdateMany.mockResolvedValue({ count: 0 })

    const res = await handleStatusUpdate('di-1', 'on_the_way', undefined, undefined, LOC_A, undefined, undefined)
    expect(res.status).toBe(409)
    expect(mocks.wsBroadcast).not.toHaveBeenCalled()
  })
})
