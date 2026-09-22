// ============================================
// R84-2 — WALLET PAYMENT + OUTBOX: locationId TENANT BINDING (schema round)
// ============================================
// REGRESIJA za schema round (worklog R84 prioritet #3):
//   1. WalletPayment dobi locationId stolpec (+ relacija na Location, SetNull)
//      → getWalletPaymentStats je ENOKORAČEN (prej dvokoračen checkIds IN [...]
//      z take 10000 + PG bind limit fail-closed)
//   2. initiateWalletPayment stampira locationId: iz check.order.locationId
//      (data-derived, prioriteta) ali od klicatelja (session/api-key fallback)
//   3. OutboxEvent dobi locationId → internal replay poda emitEvent(..., loc)
//      (prej FAIL-CLOSED global-only, R83-DOC)
//   4. wallet route GET: where.locationId namesto checkIds; POST: stamping
//
// Pravila (MODEL A): null scope (super-admin) = PRAZEN filter, NIKOLI
// { locationId: null }. Legacy NULL = fail-closed (nevidno lokacijskemu
// uporabniku; pozeni scripts/backfill-wallet-outbox-location.ts).
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  walletPaymentCreate: vi.fn(),
  walletPaymentFindMany: vi.fn(),
  walletPaymentGroupBy: vi.fn(),
  walletPaymentAggregate: vi.fn(),
  checkFindUnique: vi.fn(),
  checkFindFirst: vi.fn(),
  checkFindMany: vi.fn(),
  outboxUpsert: vi.fn(),
  emitEvent: vi.fn(),
  loggerInfo: vi.fn(),
}))

vi.mock('@/lib/auth-middleware', async () => {
  const tenantScope = await import('@/lib/auth-middleware/tenant-scope')
  return {
    requireAuth: mocks.requireAuth,
    resolveTenantLocationId: tenantScope.resolveTenantLocationId,
    resolveTenantLocationIdOrThrow: tenantScope.resolveTenantLocationIdOrThrow,
    tenantScopeToWhere: tenantScope.tenantScopeToWhere,
  }
})

vi.mock('@/lib/db', () => ({
  db: {
    walletPayment: {
      create: mocks.walletPaymentCreate,
      findMany: mocks.walletPaymentFindMany,
      groupBy: mocks.walletPaymentGroupBy,
      aggregate: mocks.walletPaymentAggregate,
    },
    check: {
      findUnique: mocks.checkFindUnique,
      findFirst: mocks.checkFindFirst,
      findMany: mocks.checkFindMany,
    },
    outboxEvent: { upsert: mocks.outboxUpsert },
  },
}))

// event-emitter: zajemimo emitEvent klice (outbox internal processor)
vi.mock('@/lib/event-emitter', () => ({
  emitEvent: mocks.emitEvent,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: mocks.loggerInfo, warn: vi.fn(), error: vi.fn() },
}))

import { getWalletPaymentStats, initiateWalletPayment } from '@/lib/wallet-payment'
import { GET as walletGET, POST as walletPOST } from '@/app/api/wallet-payment/route'

// Utišaj logger
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

const LOC_A = 'loc-tenant-a'
const LOC_B = 'loc-tenant-b'

const groupByResult = [
  { walletType: 'apple_pay', _count: { walletType: 3 }, _sum: { amount: 100 } },
]
const aggregateResult = {
  _count: { id: 3 },
  _sum: { amount: 100, refundedAmount: 0 },
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.walletPaymentGroupBy.mockResolvedValue(groupByResult)
  mocks.walletPaymentAggregate.mockResolvedValue(aggregateResult)
  mocks.walletPaymentFindMany.mockResolvedValue([])
  mocks.walletPaymentCreate.mockResolvedValue({
    id: 'wp-1', status: 'pending', transactionId: 'wp-1', amount: 50,
  })
  mocks.outboxUpsert.mockResolvedValue({ id: 'outbox-1' })
  mocks.checkFindMany.mockResolvedValue([])
  mocks.loggerInfo.mockReturnValue(undefined)
})

// ══════════════════════════════════════════════════════════════════
// 1. getWalletPaymentStats — ENOKORAČNI scope
// ══════════════════════════════════════════════════════════════════
describe('R84-2: getWalletPaymentStats — single-step locationId scope', () => {
  it('locationId podan → where.locationId NA direktno, BREZ checkIds dvokoračnega scope-a', async () => {
    await getWalletPaymentStats(undefined, undefined, LOC_A)

    // ključna regresija: check.findMany se NE sme več klicati (stari dvokoračni scope)
    expect(mocks.checkFindMany).not.toHaveBeenCalled()
    // oba groupBy + aggregate dobijo where.locationId direktno
    expect(mocks.walletPaymentGroupBy.mock.calls[0][0].where.locationId).toBe(LOC_A)
    expect(mocks.walletPaymentGroupBy.mock.calls[1][0].where.locationId).toBe(LOC_A)
    expect(mocks.walletPaymentAggregate.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('locationId kombiniran z datumskim filtrom (createdAt se NE prepiše)', async () => {
    const from = new Date('2026-01-01T00:00:00Z')
    const to = new Date('2026-01-31T23:59:59Z')
    await getWalletPaymentStats(from, to, LOC_A)

    const where = mocks.walletPaymentAggregate.mock.calls[0][0].where
    expect(where.locationId).toBe(LOC_A)
    expect(where.createdAt.gte).toEqual(from)
    expect(where.createdAt.lte).toEqual(to)
  })

  it('super-admin (null) → PRAZEN where brez locationId ključa', async () => {
    await getWalletPaymentStats(undefined, undefined, null)
    const where = mocks.walletPaymentAggregate.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(where, 'locationId')).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════
// 2. initiateWalletPayment — locationId stamping
// ══════════════════════════════════════════════════════════════════
describe('R84-2: initiateWalletPayment — locationId stamping', () => {
  const baseInput = {
    walletType: 'apple_pay' as const,
    amount: 50,
    paymentToken: 'tok_apple_pay_1234567890',
  }

  it('checkId podan → locationId izpeljan iz check.order.locationId (prioriteta)', async () => {
    mocks.checkFindUnique.mockResolvedValue({ order: { locationId: LOC_A } })
    // klicatelj pošilja tudi svojo lokacijo — check-derived ima prioriteto
    await initiateWalletPayment({ ...baseInput, checkId: 'check-1', locationId: LOC_B })

    expect(mocks.checkFindUnique).toHaveBeenCalledWith({
      where: { id: 'check-1' },
      select: { order: { select: { locationId: true } } },
    })
    const data = mocks.walletPaymentCreate.mock.calls[0][0].data
    expect(data.locationId).toBe(LOC_A)
    // outbox event dobi locationId (tenant binding)
    const outboxInput = mocks.outboxUpsert.mock.calls[0][0].create
    expect(outboxInput.locationId).toBe(LOC_A)
    expect(outboxInput.payload.locationId).toBe(LOC_A)
  })

  it('checkId podan a ček brez order lokacije → fallback na klicateljevo lokacijo', async () => {
    mocks.checkFindUnique.mockResolvedValue({ order: { locationId: null } })
    await initiateWalletPayment({ ...baseInput, checkId: 'check-1', locationId: LOC_B })
    expect(mocks.walletPaymentCreate.mock.calls[0][0].data.locationId).toBe(LOC_B)
  })

  it('checkId NI podan → klicateljeva lokacija (session/api-key stamp)', async () => {
    await initiateWalletPayment({ ...baseInput, locationId: LOC_B })
    expect(mocks.checkFindUnique).not.toHaveBeenCalled()
    expect(mocks.walletPaymentCreate.mock.calls[0][0].data.locationId).toBe(LOC_B)
  })

  it('ni konteksta → NULL (globalno, fail-closed za lokacijske uporabnike)', async () => {
    await initiateWalletPayment({ ...baseInput })
    expect(mocks.walletPaymentCreate.mock.calls[0][0].data.locationId).toBeNull()
  })
})

// ══════════════════════════════════════════════════════════════════
// 3. wallet route GET/POST
// ══════════════════════════════════════════════════════════════════
describe('R84-2: /api/wallet-payment route — single-step scope + stamping', () => {
  it('GET loc-bound: findMany where.locationId, BREZ checkIds poizvedbe', async () => {
    mocks.requireAuth.mockResolvedValue({
      session: { employeeId: 'emp-1', role: 'admin', locationId: LOC_A },
      error: null,
    })
    const res = await walletGET(new Request('http://localhost:3000/api/wallet-payment'))
    expect(res.status).toBe(200)
    expect(mocks.checkFindMany).not.toHaveBeenCalled()
    expect(mocks.walletPaymentFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('GET ?locationId bypass je ignoriran za lokacijskega admina', async () => {
    mocks.requireAuth.mockResolvedValue({
      session: { employeeId: 'emp-1', role: 'admin', locationId: LOC_A },
      error: null,
    })
    await walletGET(new Request(`http://localhost:3000/api/wallet-payment?locationId=${LOC_B}`))
    expect(mocks.walletPaymentFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('GET super-admin: where brez locationId ključa', async () => {
    mocks.requireAuth.mockResolvedValue({
      session: { employeeId: 'emp-1', role: 'super_admin', locationId: null },
      error: null,
    })
    await walletGET(new Request('http://localhost:3000/api/wallet-payment'))
    expect(Object.prototype.hasOwnProperty.call(mocks.walletPaymentFindMany.mock.calls[0][0].where, 'locationId')).toBe(false)
  })

  it('POST loc-bound: stampira session lokacijo v initiate input', async () => {
    mocks.requireAuth.mockResolvedValue({
      session: { employeeId: 'emp-1', role: 'admin', locationId: LOC_A },
      error: null,
    })
    mocks.checkFindUnique.mockResolvedValue(null) // brez čeka
    const res = await walletPOST(new Request('http://localhost:3000/api/wallet-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletType: 'qr_pay',
        amount: 30,
        paymentToken: 'tok_qr_pay_1234567890',
      }),
    }))
    expect(res.status).toBe(201)
    // create data: session lokacija (brez checkId → klicateljeva lokacija)
    expect(mocks.walletPaymentCreate.mock.calls[0][0].data.locationId).toBe(LOC_A)
  })

  it('POST s tujim checkId → 404 (R83 ownership regresija ostane)', async () => {
    mocks.requireAuth.mockResolvedValue({
      session: { employeeId: 'emp-1', role: 'admin', locationId: LOC_A },
      error: null,
    })
    mocks.checkFindFirst.mockResolvedValue(null)
    const res = await walletPOST(new Request('http://localhost:3000/api/wallet-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletType: 'qr_pay',
        amount: 30,
        paymentToken: 'tok_qr_pay_1234567890',
        checkId: 'foreign-check',
      }),
    }))
    expect(res.status).toBe(404)
    expect(mocks.walletPaymentCreate).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// 4. Outbox internal processor — locationId pass-through
// ══════════════════════════════════════════════════════════════════
describe('R84-2: outbox internal processor — emitEvent(..., locationId)', () => {
  it('event z locationId → emitEvent(eventName, payload, locationId)', async () => {
    const { processors } = await import('@/lib/outbox')
    mocks.emitEvent.mockResolvedValue(undefined)

    const result = await processors.internal({
      id: 'evt-1',
      aggregateType: 'order',
      aggregateId: 'order-1',
      eventType: 'created',
      payload: { orderId: 'order-1' },
      targetEndpoint: '',
      locationId: LOC_A,
    })

    expect(result.success).toBe(true)
    expect(mocks.emitEvent).toHaveBeenCalledWith('order.created', { orderId: 'order-1' }, LOC_A)
  })

  it('legacy event brez locationId → emitEvent(..., undefined) (fail-closed global-only)', async () => {
    const { processors } = await import('@/lib/outbox')
    mocks.emitEvent.mockResolvedValue(undefined)

    await processors.internal({
      id: 'evt-2',
      aggregateType: 'order',
      aggregateId: 'order-2',
      eventType: 'updated',
      payload: { orderId: 'order-2' },
      targetEndpoint: '',
      locationId: undefined,
    })

    expect(mocks.emitEvent).toHaveBeenCalledWith('order.updated', { orderId: 'order-2' }, undefined)
  })
})

// ══════════════════════════════════════════════════════════════════
// 5. createOutboxEvent — locationId zapisan
// ══════════════════════════════════════════════════════════════════
describe('R84-2: createOutboxEvent — upsert create vsebuje locationId', () => {
  it('locationId podan → v create data', async () => {
    const { createOutboxEvent } = await import('@/lib/outbox')
    await createOutboxEvent({
      aggregateType: 'order',
      aggregateId: 'order-9',
      eventType: 'created',
      payload: { orderId: 'order-9' },
      target: 'internal',
      locationId: LOC_A,
    })
    expect(mocks.outboxUpsert.mock.calls[0][0].create.locationId).toBe(LOC_A)
  })

  it('locationId NI podan → NULL (fail-closed)', async () => {
    const { createOutboxEvent } = await import('@/lib/outbox')
    await createOutboxEvent({
      aggregateType: 'order',
      aggregateId: 'order-10',
      eventType: 'created',
      payload: { orderId: 'order-10' },
      target: 'internal',
    })
    expect(mocks.outboxUpsert.mock.calls[0][0].create.locationId).toBeNull()
  })
})
