// ============================================
// R86-2a — MONEY/ORDERS SCOPE WAVE (M2 fail-open razred)
// ============================================
// REGRESIJA za raw spread `session?.locationId ?? undefined/null/|| null` v
// money/orders domeni (R85-FINAL-2 M2: session-store/session-lifecycle.ts:114-117
// sprejme NULL locationId za KATEROKOLI vlogo → ročni spread = fail-OPEN).
//
// Pokrite endpointne klase (file:line pre-fix):
//   A. orders/[id] GET/PUT   — globalni findFirst + update (IDOR + cross-tenant WRITE)
//   B. GET /api/payments     — "worst member" (R85-FINAL-2): globalni seznam plačil
//   C. POST /api/payments    — plačilo na tujem čeku
//   D. POST /api/payments/[id]/refund — cross-tenant povračilo
//   E. PUT /api/checks/[id]  — cross-tenant ček (appliedDiscountId guard R85-FINAL
//                              ostaja nedotaknjen — testiramo samo raw spread)
//   F. cash-register POST (openShift) + PUT [id] (close) — izmena tuje lokacije /
//                              legacy NULL izmena / globalni fallback žig
//   G. POST /api/qr-pay (init) — QR token za tuj ček
//   H. POST /api/wallet-payment — tuji checkId + NULL-stamp na create
//   I. POST /api/end-of-day  — pogojen 403 → globalni close izmene (staff-null)
//   J. PUT /api/tip-pool     — isWithinScope z raw `?? null` → prepis tujih distribucij
//
// Vzorec: realen tenant-scope resolver (re-export iz auth-middleware barrela),
// pinanje where-clavzov. null scope (super-admin) = PRAZEN filter, NIKOLI
// { locationId: null }. mockResolvedValue (nikoli .Once — preživi clearAllMocks).
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  orderFindFirst: vi.fn(),
  orderUpdateMany: vi.fn(),
  orderItemUpdateMany: vi.fn(),
  paymentFindFirst: vi.fn(),
  paymentFindMany: vi.fn(),
  paymentCount: vi.fn(),
  paymentCreate: vi.fn(),
  checkFindFirst: vi.fn(),
  shiftFindUnique: vi.fn(),
  shiftFindFirst: vi.fn(),
  shiftCreate: vi.fn(),
  shiftUpdate: vi.fn(),
  shiftUpdateMany: vi.fn(), // R104: CAS close (where status: 'open')
  employeeFindUnique: vi.fn(),
  orderCount: vi.fn(),
  orderFindMany: vi.fn(),
  tipPoolFindUnique: vi.fn(),
  tipPoolUpdate: vi.fn(),
  tipDistDeleteMany: vi.fn(),
  auditLogCreate: vi.fn(),
  transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
  emitEvent: vi.fn(),
  rateLimit: vi.fn(async () => ({ allowed: true })),
  initiateWalletPayment: vi.fn(),
  closeShift: vi.fn(),
  upsertZReportForDay: vi.fn(),
  getRestaurantInfo: vi.fn(),
  createTipDistChain: vi.fn(),
}))

// Skupni tx objekt — iste funkcije kot db top-level (vzorec r85-final-scope)
const tx = {
  order: { findFirst: mocks.orderFindFirst, updateMany: mocks.orderUpdateMany, count: mocks.orderCount, findMany: mocks.orderFindMany },
  orderItem: { updateMany: mocks.orderItemUpdateMany },
  payment: { findFirst: mocks.paymentFindFirst, aggregate: vi.fn().mockResolvedValue({ _sum: { amount: null } }) },
  check: { findFirst: mocks.checkFindFirst, findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
  cashRegisterShift: { findUnique: mocks.shiftFindUnique, findFirst: mocks.shiftFindFirst, create: mocks.shiftCreate, update: mocks.shiftUpdate, updateMany: mocks.shiftUpdateMany },
  employee: { findUnique: mocks.employeeFindUnique },
  tipPool: { findUnique: mocks.tipPoolFindUnique, update: mocks.tipPoolUpdate },
  tipDistribution: { deleteMany: mocks.tipDistDeleteMany },
  auditLog: { create: mocks.auditLogCreate },
  $executeRaw: vi.fn(),
}

// Auth middleware: mock requireAuth, REALNI tenant-scope resolver
vi.mock('@/lib/auth-middleware', async () => {
  const tenantScope = await import('@/lib/auth-middleware/tenant-scope')
  return {
    requireAuth: mocks.requireAuth,
    optionalAuth: vi.fn(),
    resolveTenantLocationId: tenantScope.resolveTenantLocationId,
    resolveTenantLocationIdOrThrow: tenantScope.resolveTenantLocationIdOrThrow,
    tenantScopeToWhere: tenantScope.tenantScopeToWhere,
  }
})

vi.mock('@/lib/db', () => ({
  db: {
    order: { findFirst: mocks.orderFindFirst, updateMany: mocks.orderUpdateMany, count: mocks.orderCount, findMany: mocks.orderFindMany },
    orderItem: { updateMany: mocks.orderItemUpdateMany },
    payment: {
      findFirst: mocks.paymentFindFirst,
      findMany: mocks.paymentFindMany,
      count: mocks.paymentCount,
      create: mocks.paymentCreate,
      update: vi.fn(),
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: null } }),
    },
    check: { findFirst: mocks.checkFindFirst, findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    cashRegisterShift: { findUnique: mocks.shiftFindUnique, findFirst: mocks.shiftFindFirst, create: mocks.shiftCreate, update: mocks.shiftUpdate, updateMany: mocks.shiftUpdateMany },
    employee: { findUnique: mocks.employeeFindUnique },
    tipPool: { findUnique: mocks.tipPoolFindUnique, update: mocks.tipPoolUpdate },
    tipDistribution: { deleteMany: mocks.tipDistDeleteMany },
    auditLog: { create: mocks.auditLogCreate },
    $transaction: mocks.transaction,
  },
  // createAuditLog je TOP-LEVEL export iz '@/lib/db' (ne lastnost db klienta)
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/event-emitter', () => ({ emitEvent: mocks.emitEvent }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.rateLimit,
  getClientIp: () => '127.0.0.1',
  AUTHENTICATED_LIMIT: { maxRequests: 100, windowMs: 60000 },
  QR_PAY_LIMIT: { maxRequests: 10, windowMs: 60000 },
}))
vi.mock('@/lib/wallet-payment', () => ({
  initiateWalletPayment: mocks.initiateWalletPayment,
  getWalletPaymentStats: vi.fn().mockResolvedValue({}),
  SUPPORTED_WALLETS: ['qr_pay'],
  SUPPORTED_CURRENCIES: ['EUR'],
}))
vi.mock('@/app/api/end-of-day/_helpers', () => ({
  fetchEodData: vi.fn().mockResolvedValue({}),
  computeEodMetrics: vi.fn().mockResolvedValue({}),
  closeShift: mocks.closeShift,
}))
vi.mock('@/app/api/z-report/_helpers', () => ({
  upsertZReportForDay: mocks.upsertZReportForDay,
}))
vi.mock('@/app/api/z-report/_helpers/refresh-draft', () => ({
  refreshZDraftForPayment: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/accounting/journal-generator', () => ({
  generateJournalForPayment: vi.fn().mockResolvedValue(undefined),
  generateJournalForRefund: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/loyalty-automation', () => ({ triggerTierUpgrade: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/tip-distribution-chain', () => ({ createTipDistributionWithChain: mocks.createTipDistChain.mockResolvedValue(undefined) }))
vi.mock('@/lib/furs/config-resolver', () => ({
  getRestaurantInfoForLocation: mocks.getRestaurantInfo.mockResolvedValue({ name: 'Test', address: 'X', postCode: '1000', city: 'Y', phone: '', businessId: 'SI1', taxId: 'SI1', registerNumber: 'R1', source: 'location' }),
}))
vi.mock('@/app/api/orders/[id]/webhooks', () => ({
  emitOrderWebhooks: vi.fn().mockResolvedValue(undefined),
  handleFireAction: vi.fn(),
  handleItemStatusUpdate: vi.fn(),
  performOrderSoftDelete: vi.fn(),
}))
vi.mock('@/lib/stock-deduction', () => ({
  deductStockForAddedItems: vi.fn().mockResolvedValue({ deducted: [], lowStockAlerts: [] }),
  broadcastLowStockAlert: vi.fn(),
  returnStockForOrder: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/ws-server-broadcast', () => ({ wsBroadcastEvent: vi.fn() }))
vi.mock('@/lib/webhook-engine', () => ({ processRetryQueue: vi.fn(), emitWebhookEvent: vi.fn() }))

import { GET as orderGET } from '@/app/api/orders/[id]/route'
import { handlePutOrder } from '@/app/api/orders/[id]/_helpers/put-handler'
import { GET as paymentsGET, POST as paymentsPOST } from '@/app/api/payments/route'
import { POST as refundPOST } from '@/app/api/payments/[id]/refund/route'
import { PUT as checkPUT } from '@/app/api/checks/[id]/route'
import { POST as cashRegisterPOST } from '@/app/api/cash-register/route'
import { PUT as cashRegisterClosePUT } from '@/app/api/cash-register/[id]/route'
import { POST as qrPayInit } from '@/app/api/qr-pay/route'
import { POST as walletPOST } from '@/app/api/wallet-payment/route'
import { POST as eodPOST } from '@/app/api/end-of-day/route'
import { PUT as tipPoolPUT } from '@/app/api/tip-pool/route'

// Utišaj logger
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

const LOC_A = 'loc-tenant-a'
const LOC_B = 'loc-tenant-b'

function mockSession(overrides: Record<string, unknown> = {}) {
  mocks.requireAuth.mockResolvedValue({
    session: { employeeId: 'emp-1', role: 'staff', locationId: LOC_A, ...overrides },
    error: null,
  })
}

function jsonReq(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const PAYMENT_BODY = {
  checkId: 'chk-1',
  amount: 40,
  tipAmount: 0,
  type: 'cash',
  alternatePaymentTypeId: null,
  cardType: '',
  cardLast4: '',
  authorizationCode: '',
  giftCardId: null,
  loyaltyAccountId: null,
  loyaltyPointsUsed: 0,
  employeeId: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.transaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) => fn(tx))
  mocks.orderFindFirst.mockResolvedValue(null)
  mocks.orderUpdateMany.mockResolvedValue({ count: 1 })
  mocks.orderItemUpdateMany.mockResolvedValue({ count: 0 })
  mocks.paymentFindFirst.mockResolvedValue(null)
  mocks.paymentFindMany.mockResolvedValue([])
  mocks.paymentCount.mockResolvedValue(0)
  mocks.checkFindFirst.mockResolvedValue(null)
  mocks.shiftFindUnique.mockResolvedValue(null)
  mocks.shiftFindFirst.mockResolvedValue(null)
  mocks.shiftCreate.mockResolvedValue({ id: 'shift-1', locationId: LOC_A })
  mocks.shiftUpdate.mockResolvedValue({ id: 'shift-1' })
  mocks.shiftUpdateMany.mockResolvedValue({ count: 1 }) // R104: CAS close privzeti uspeh
  mocks.employeeFindUnique.mockResolvedValue({ locationId: LOC_A })
  mocks.orderCount.mockResolvedValue(0)
  mocks.orderFindMany.mockResolvedValue([])
  mocks.tipPoolFindUnique.mockResolvedValue(null)
  mocks.tipPoolUpdate.mockResolvedValue({ id: 'tp-1' })
  mocks.tipDistDeleteMany.mockResolvedValue({ count: 0 })
  mocks.auditLogCreate.mockResolvedValue({ id: 'al-1' })
  mocks.closeShift.mockResolvedValue(null)
  mocks.upsertZReportForDay.mockResolvedValue(undefined)
  mocks.initiateWalletPayment.mockResolvedValue({ id: 'wp-1', status: 'initiated' })
  mocks.emitEvent.mockResolvedValue(undefined)
})

// ══════════════════════════════════════════════════════════════════
// A. ORDERS [id] — GET + PUT
// ══════════════════════════════════════════════════════════════════
describe('R86-2a A: /api/orders/[id] — M2 fail-open (raw spread `?? undefined`)', () => {
  it('GET: regular user brez lokacije → 403, NI poizvedb', async () => {
    mockSession({ role: 'staff', locationId: null })
    const res = await orderGET(jsonReq('http://localhost:3000/api/orders/ord-1', 'GET'), { params: Promise.resolve({ id: 'ord-1' }) })
    expect(res.status).toBe(403)
    expect(mocks.orderFindFirst).not.toHaveBeenCalled()
  })

  it('GET: lokacijski user → where.locationId pripet (query bypass ignoriran)', async () => {
    mockSession({ role: 'staff', locationId: LOC_A })
    mocks.orderFindFirst.mockResolvedValue({ id: 'ord-1', locationId: LOC_A })
    await orderGET(jsonReq(`http://localhost:3000/api/orders/ord-1?locationId=${LOC_B}`, 'GET'), { params: Promise.resolve({ id: 'ord-1' }) })
    expect(mocks.orderFindFirst.mock.calls[0][0].where).toEqual({ id: 'ord-1', locationId: LOC_A })
  })

  it('GET: super-admin → brez locationId ključa (nikoli { locationId: null })', async () => {
    mockSession({ role: 'admin', locationId: null })
    mocks.orderFindFirst.mockResolvedValue({ id: 'ord-1' })
    await orderGET(jsonReq('http://localhost:3000/api/orders/ord-1', 'GET'), { params: Promise.resolve({ id: 'ord-1' }) })
    expect(Object.prototype.hasOwnProperty.call(mocks.orderFindFirst.mock.calls[0][0].where, 'locationId')).toBe(false)
  })

  it('PUT: regular user brez lokacije → 403, NI branja NI update-a (prej globalni update!)', async () => {
    mockSession({ role: 'waiter', locationId: null })
    const res = await handlePutOrder(jsonReq('http://localhost:3000/api/orders/ord-1', 'PUT', { status: 'in-progress' }), Promise.resolve({ id: 'ord-1' }))
    expect(res.status).toBe(403)
    expect(mocks.orderFindFirst).not.toHaveBeenCalled()
    expect(mocks.orderUpdateMany).not.toHaveBeenCalled()
  })

  it('PUT: cross-tenant order → 404 + NI pisnih operacij', async () => {
    mockSession({ role: 'waiter', locationId: LOC_A })
    mocks.orderFindFirst.mockResolvedValue(null) // scoped lookup → ni najden
    const res = await handlePutOrder(jsonReq('http://localhost:3000/api/orders/ord-b', 'PUT', { status: 'in-progress' }), Promise.resolve({ id: 'ord-b' }))
    expect(res.status).toBe(404)
    expect(mocks.orderUpdateMany).not.toHaveBeenCalled()
    expect(mocks.orderItemUpdateMany).not.toHaveBeenCalled()
  })

  it('PUT: lokacijski user → where pripet + updateMany se izvede', async () => {
    mockSession({ role: 'waiter', locationId: LOC_A })
    mocks.orderFindFirst
      .mockResolvedValueOnce({ id: 'ord-1', status: 'pending', paymentStatus: 'unpaid', subtotal: 100, discount: 0, tax: 22, total: 122, tip: 0, orderItems: [], deliveryInfo: null, updatedAt: new Date(), tableId: null, orderNumber: 1, type: 'dine-in', paymentMethod: '', locationId: LOC_A, employeeId: null, customerName: null, notes: null, cancelledBy: null, totalWithTip: 122 })
      .mockResolvedValueOnce({ id: 'ord-1', status: 'in-progress', locationId: LOC_A })
    const res = await handlePutOrder(jsonReq('http://localhost:3000/api/orders/ord-1', 'PUT', { status: 'in-progress' }), Promise.resolve({ id: 'ord-1' }))
    expect(res.status).toBe(200)
    expect(mocks.orderFindFirst.mock.calls[0][0].where.locationId).toBe(LOC_A)
    expect(mocks.orderUpdateMany).toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// B. GET /api/payments — "worst member" (R85-FINAL-2)
// ══════════════════════════════════════════════════════════════════
describe('R86-2a B: GET /api/payments — globalni seznam plačil', () => {
  it('regular user brez lokacije → 403, NI poizvedb (prej GLOBALNI seznam)', async () => {
    mockSession({ role: 'staff', locationId: null })
    const res = await paymentsGET(jsonReq('http://localhost:3000/api/payments', 'GET'))
    expect(res.status).toBe(403)
    expect(mocks.paymentFindMany).not.toHaveBeenCalled()
    expect(mocks.paymentCount).not.toHaveBeenCalled()
  })

  it('lokacijski user → where.check.order.locationId pripet', async () => {
    mockSession({ role: 'staff', locationId: LOC_A })
    const res = await paymentsGET(jsonReq('http://localhost:3000/api/payments', 'GET'))
    expect(res.status).toBe(200)
    const where = mocks.paymentFindMany.mock.calls[0][0].where
    expect(where.check).toEqual({ order: { locationId: LOC_A } })
    expect(mocks.paymentCount.mock.calls[0][0].where).toEqual(where)
  })

  it('super-admin → brez check ključa (hasOwnProperty false)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    await paymentsGET(jsonReq('http://localhost:3000/api/payments', 'GET'))
    const where = mocks.paymentFindMany.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(where, 'check')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(where, 'locationId')).toBe(false)
  })

  it('?locationId bypass ignoriran za lokacijskega userja', async () => {
    mockSession({ role: 'staff', locationId: LOC_A })
    await paymentsGET(jsonReq(`http://localhost:3000/api/payments?locationId=${LOC_B}`, 'GET'))
    expect(mocks.paymentFindMany.mock.calls[0][0].where.check).toEqual({ order: { locationId: LOC_A } })
  })
})

// ══════════════════════════════════════════════════════════════════
// C. POST /api/payments — plačilo na tujem čeku
// ══════════════════════════════════════════════════════════════════
describe('R86-2a C: POST /api/payments — cross-tenant check lookup', () => {
  it('regular user brez lokacije → 403, NI poizvedb NI create', async () => {
    mockSession({ role: 'staff', locationId: null })
    const res = await paymentsPOST(jsonReq('http://localhost:3000/api/payments', 'POST', PAYMENT_BODY))
    expect(res.status).toBe(403)
    expect(mocks.paymentFindFirst).not.toHaveBeenCalled()
    expect(mocks.checkFindFirst).not.toHaveBeenCalled()
    expect(mocks.paymentCreate).not.toHaveBeenCalled()
  })

  it('cross-tenant checkId → 404 + NI create (where.order.locationId pripet)', async () => {
    mockSession({ role: 'staff', locationId: LOC_A })
    mocks.checkFindFirst.mockResolvedValue(null) // tuj ček → scoped lookup nič
    const res = await paymentsPOST(jsonReq('http://localhost:3000/api/payments', 'POST', PAYMENT_BODY))
    expect(res.status).toBe(404)
    expect(mocks.checkFindFirst.mock.calls[0][0].where.order).toEqual({ locationId: LOC_A })
    expect(mocks.paymentCreate).not.toHaveBeenCalled()
  })

  it('super-admin → check lookup brez order ključa', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    mocks.checkFindFirst.mockResolvedValue(null)
    await paymentsPOST(jsonReq('http://localhost:3000/api/payments', 'POST', PAYMENT_BODY))
    const where = mocks.checkFindFirst.mock.calls[0][0].where
    expect(where.id).toBe('chk-1')
    expect(Object.prototype.hasOwnProperty.call(where, 'order')).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════
// D. POST /api/payments/[id]/refund — cross-tenant povračilo
// ══════════════════════════════════════════════════════════════════
describe('R86-2a D: POST /api/payments/[id]/refund — cross-tenant', () => {
  it('regular user brez lokacije → 403, NI poizvedb', async () => {
    mockSession({ role: 'staff', locationId: null })
    const res = await refundPOST(jsonReq('http://localhost:3000/api/payments/pay-1/refund', 'POST', { amount: 10, reason: 'x' }), { params: Promise.resolve({ id: 'pay-1' }) })
    expect(res.status).toBe(403)
    expect(mocks.paymentFindFirst).not.toHaveBeenCalled()
  })

  it('lokacijski user → where.check.order.locationId pripet', async () => {
    mockSession({ role: 'staff', locationId: LOC_A })
    mocks.paymentFindFirst.mockResolvedValue(null)
    const res = await refundPOST(jsonReq('http://localhost:3000/api/payments/pay-b/refund', 'POST', { amount: 10, reason: 'x' }), { params: Promise.resolve({ id: 'pay-b' }) })
    expect(res.status).toBe(404)
    expect(mocks.paymentFindFirst.mock.calls[0][0].where.check.order.locationId).toBe(LOC_A)
  })
})

// ══════════════════════════════════════════════════════════════════
// E. PUT /api/checks/[id] — raw spread (discount guard R85-FINAL ostaja)
// ══════════════════════════════════════════════════════════════════
describe('R86-2a E: PUT /api/checks/[id] — M2 fail-open', () => {
  it('regular user brez lokacije → 403, NI poizvedb', async () => {
    mockSession({ role: 'staff', locationId: null })
    const res = await checkPUT(jsonReq('http://localhost:3000/api/checks/chk-1', 'PUT', { paymentMethod: 'cash' }), { params: Promise.resolve({ id: 'chk-1' }) })
    expect(res.status).toBe(403)
    expect(mocks.checkFindFirst).not.toHaveBeenCalled()
  })

  it('cross-tenant ček → 404 (where.order.locationId pripet)', async () => {
    mockSession({ role: 'staff', locationId: LOC_A })
    mocks.checkFindFirst.mockResolvedValue(null)
    const res = await checkPUT(jsonReq('http://localhost:3000/api/checks/chk-b', 'PUT', { paymentMethod: 'cash' }), { params: Promise.resolve({ id: 'chk-b' }) })
    expect(res.status).toBe(404)
    // Check nima lastnega locationId — scope gre prek relacije order.locationId
    expect(mocks.checkFindFirst.mock.calls[0][0].where.order).toEqual({ locationId: LOC_A })
  })

  it('super-admin → brez order ključa v where', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    mocks.checkFindFirst.mockResolvedValue(null)
    await checkPUT(jsonReq('http://localhost:3000/api/checks/chk-1', 'PUT', { paymentMethod: 'cash' }), { params: Promise.resolve({ id: 'chk-1' }) })
    expect(Object.prototype.hasOwnProperty.call(mocks.checkFindFirst.mock.calls[0][0].where, 'order')).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════
// F. CASH-REGISTER — openShift (POST) + close (PUT [id])
// ══════════════════════════════════════════════════════════════════
describe('R86-2a F: /api/cash-register — openShift + close', () => {
  it('POST: regular user brez lokacije → 403, NI transakcije NI create', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await cashRegisterPOST(jsonReq('http://localhost:3000/api/cash-register', 'POST', { employeeId: 'emp-9', employeeName: 'X', startingCash: 100 }))
    expect(res.status).toBe(403)
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.shiftCreate).not.toHaveBeenCalled()
  })

  it('POST: super-admin brez session lokacije + zaposleni brez lokacije → 400 SHIFT_LOCATION_REQUIRED (brez globalnega fallback žiga)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    mocks.employeeFindUnique.mockResolvedValue({ locationId: null })
    const res = await cashRegisterPOST(jsonReq('http://localhost:3000/api/cash-register', 'POST', { employeeId: 'emp-9', employeeName: 'X', startingCash: 100 }))
    expect(res.status).toBe(400)
    expect(mocks.shiftCreate).not.toHaveBeenCalled()
  })

  it('POST: super-admin + zaposleni z lokacijo → žig data-derived lokacije zaposlenega', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    mocks.employeeFindUnique.mockResolvedValue({ locationId: LOC_B })
    mocks.shiftFindFirst.mockResolvedValue(null)
    await cashRegisterPOST(jsonReq('http://localhost:3000/api/cash-register', 'POST', { employeeId: 'emp-9', employeeName: 'X', startingCash: 100 }))
    expect(mocks.shiftCreate.mock.calls[0][0].data.locationId).toBe(LOC_B)
  })

  it('PUT [id]: regular user brez lokacije → 403, NI transakcije (prej globalni close!)', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await cashRegisterClosePUT(jsonReq('http://localhost:3000/api/cash-register/shift-1', 'PUT', { notes: 'x' }), { params: Promise.resolve({ id: 'shift-1' }) })
    expect(res.status).toBe(403)
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.shiftUpdateMany).not.toHaveBeenCalled()
  })

  it('PUT [id]: tuja izmena (LOC_B) → 404 + NI update-a', async () => {
    mockSession({ role: 'manager', locationId: LOC_A })
    mocks.shiftFindUnique.mockResolvedValue({ id: 'shift-1', locationId: LOC_B, status: 'open', startingCash: 100, openedAt: new Date() })
    const res = await cashRegisterClosePUT(jsonReq('http://localhost:3000/api/cash-register/shift-1', 'PUT', { notes: 'x' }), { params: Promise.resolve({ id: 'shift-1' }) })
    expect(res.status).toBe(404)
    expect(mocks.shiftUpdateMany).not.toHaveBeenCalled()
  })

  it('PUT [id]: legacy NULL-location izmena → 404 fail-closed za lokacijsko vezano sejo', async () => {
    mockSession({ role: 'manager', locationId: LOC_A })
    mocks.shiftFindUnique.mockResolvedValue({ id: 'shift-1', locationId: null, status: 'open', startingCash: 100, openedAt: new Date() })
    const res = await cashRegisterClosePUT(jsonReq('http://localhost:3000/api/cash-register/shift-1', 'PUT', { notes: 'x' }), { params: Promise.resolve({ id: 'shift-1' }) })
    expect(res.status).toBe(404)
    expect(mocks.shiftUpdateMany).not.toHaveBeenCalled()
  })

  it('PUT [id]: super-admin zapre tujo izmeno (globalni nadzor)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    mocks.shiftFindUnique.mockResolvedValue({ id: 'shift-1', locationId: LOC_B, status: 'open', startingCash: 100, openedAt: new Date() })
    const res = await cashRegisterClosePUT(jsonReq('http://localhost:3000/api/cash-register/shift-1', 'PUT', { notes: 'x' }), { params: Promise.resolve({ id: 'shift-1' }) })
    expect(res.status).toBe(200)
    // R104: CAS updateMany (where { id, status: 'open' }) — nepogojen update je bil double-close vrata
    expect(mocks.shiftUpdateMany).toHaveBeenCalled()
    expect(mocks.shiftUpdateMany.mock.calls[0][0].where).toEqual({ id: 'shift-1', status: 'open' })
  }, 10000)
})

// ══════════════════════════════════════════════════════════════════
// G. POST /api/qr-pay (init) — QR token za tuj ček
// ══════════════════════════════════════════════════════════════════
describe('R86-2a G: POST /api/qr-pay — init token scope', () => {
  it('regular user brez lokacije → 403, NI poizvedb', async () => {
    mockSession({ role: 'staff', locationId: null })
    const res = await qrPayInit(jsonReq('http://localhost:3000/api/qr-pay', 'POST', { checkId: 'chk-1' }))
    expect(res.status).toBe(403)
    expect(mocks.checkFindFirst).not.toHaveBeenCalled()
  })

  it('lokacijski user → check lookup where.order.locationId pripet', async () => {
    vi.stubEnv('QR_PAY_SECRET', 'test-secret-value-1234567890')
    try {
      mockSession({ role: 'staff', locationId: LOC_A })
      mocks.checkFindFirst.mockResolvedValue(null) // tuj ček
      const res = await qrPayInit(jsonReq(`http://localhost:3000/api/qr-pay?locationId=${LOC_B}`, 'POST', { checkId: 'chk-b' }))
      expect(res.status).toBe(404)
      expect(mocks.checkFindFirst.mock.calls[0][0].where.order).toEqual({ locationId: LOC_A })
    } finally {
      vi.unstubAllEnvs()
    }
  })
})

// ══════════════════════════════════════════════════════════════════
// H. POST /api/wallet-payment — tuji checkId + NULL-stamp
// ══════════════════════════════════════════════════════════════════
describe('R86-2a H: POST /api/wallet-payment — ownership + stamping', () => {
  const walletBody = { walletType: 'qr_pay', amount: 30, paymentToken: 'tok_qr_pay_1234567890' }

  it('regular user brez lokacije → 403, NI check lookup-a NI initiate', async () => {
    mockSession({ role: 'staff', locationId: null })
    const res = await walletPOST(jsonReq('http://localhost:3000/api/wallet-payment', 'POST', walletBody))
    expect(res.status).toBe(403)
    expect(mocks.checkFindFirst).not.toHaveBeenCalled()
    expect(mocks.initiateWalletPayment).not.toHaveBeenCalled()
  })

  it('cross-tenant checkId → 404 + NI initiate (where.order.locationId pripet)', async () => {
    mockSession({ role: 'staff', locationId: LOC_A })
    mocks.checkFindFirst.mockResolvedValue(null)
    const res = await walletPOST(jsonReq('http://localhost:3000/api/wallet-payment', 'POST', { ...walletBody, checkId: 'chk-b' }))
    expect(res.status).toBe(404)
    expect(mocks.checkFindFirst.mock.calls[0][0].where.order).toEqual({ locationId: LOC_A })
    expect(mocks.initiateWalletPayment).not.toHaveBeenCalled()
  })

  it('brez checkId → žig scope.locationId v initiate input (ne raw session)', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await walletPOST(jsonReq('http://localhost:3000/api/wallet-payment', 'POST', walletBody))
    expect(res.status).toBe(201)
    expect(mocks.initiateWalletPayment.mock.calls[0][0].locationId).toBe(LOC_A)
  })
})

// ══════════════════════════════════════════════════════════════════
// I. POST /api/end-of-day — pogojen 403 (staff-null brez body.locationId)
// ══════════════════════════════════════════════════════════════════
describe('R86-2a I: POST /api/end-of-day — globalni close izmene', () => {
  it('staff brez lokacije BREZ body.locationId → 403 + closeShift NI klican (prej globalni close!)', async () => {
    mockSession({ role: 'staff', locationId: null })
    const res = await eodPOST(jsonReq('http://localhost:3000/api/end-of-day', 'POST', { date: '2026-01-15' }))
    expect(res.status).toBe(403)
    expect(mocks.closeShift).not.toHaveBeenCalled()
    expect(mocks.upsertZReportForDay).not.toHaveBeenCalled()
  })

  it('lokacijski staff → closeShift dobi session lokacijo (tuji body.locationId strip)', async () => {
    mockSession({ role: 'staff', locationId: LOC_A })
    mocks.closeShift.mockResolvedValue({ cashDifference: 0, shiftId: 'shift-1' })
    await eodPOST(jsonReq('http://localhost:3000/api/end-of-day', 'POST', { date: '2026-01-15', locationId: LOC_B }))
    expect(mocks.closeShift.mock.calls[0][3]).toBe(LOC_A)
  })
})

// ══════════════════════════════════════════════════════════════════
// J. PUT /api/tip-pool — isWithinScope z raw `?? null`
// ══════════════════════════════════════════════════════════════════
describe('R86-2a J: PUT /api/tip-pool — cross-tenant distribucije', () => {
  const distBody = {
    tipPoolId: 'tp-1',
    distributions: [{ employeeId: 'emp-1', employeeName: 'Ana', hoursWorked: 8, points: 1, amount: 10 }],
  }

  it('regular user brez lokacije → 403 + NI branja poola (prej isWithinScope(null)=true!)', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await tipPoolPUT(jsonReq('http://localhost:3000/api/tip-pool', 'PUT', distBody))
    expect(res.status).toBe(403)
    expect(mocks.tipPoolFindUnique).not.toHaveBeenCalled()
    expect(mocks.tipDistDeleteMany).not.toHaveBeenCalled()
  })

  it('tuj pool (LOC_B) → 404 "Tipski bazen ni najden" + NI mutacij', async () => {
    mockSession({ role: 'manager', locationId: LOC_A })
    mocks.tipPoolFindUnique.mockResolvedValue({ id: 'tp-1', locationId: LOC_B, status: 'pending', totalTips: 100 })
    const res = await tipPoolPUT(jsonReq('http://localhost:3000/api/tip-pool', 'PUT', distBody))
    expect(res.status).toBe(404)
    expect(mocks.tipDistDeleteMany).not.toHaveBeenCalled()
    expect(mocks.createTipDistChain).not.toHaveBeenCalled()
  })

  it('super-admin (scope null) → globalni nadzor, distribucije se zapišejo', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    mocks.tipPoolFindUnique
      .mockResolvedValueOnce({ id: 'tp-1', locationId: LOC_B, status: 'pending', totalTips: 100 })
      .mockResolvedValueOnce({ status: 'pending' })
      .mockResolvedValueOnce({ id: 'tp-1', locationId: LOC_B, status: 'distributed', distributions: [] })
    const res = await tipPoolPUT(jsonReq('http://localhost:3000/api/tip-pool', 'PUT', distBody))
    expect(res.status).toBe(200)
    expect(mocks.tipDistDeleteMany).toHaveBeenCalledWith({ where: { tipPoolId: 'tp-1' } })
    expect(mocks.createTipDistChain).toHaveBeenCalled()
  })
})
