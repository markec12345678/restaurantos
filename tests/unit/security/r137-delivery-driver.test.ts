// ============================================
// R137-b — DELIVERY DRIVER WORKFLOW (epic #115 P1-13)
// ============================================
// Pokritje (trap-DB, vzorec 1:1 r112-delivery-webhook-concurrency):
//   A. GET /api/delivery/assignments — scope fail-closed, mine/ready filtriranje
//      (where pin: driverEmployeeId + status in-list + order.locationId +
//      type delivery + tracking brez voznika), whitelist (PII ne uhaja),
//      empty employeeId → mine = [], super-admin null scope.
//   B. SELF-CLAIM (POST /api/delivery-tracking brez driverName) — ime iz
//      Employee seje, driverEmployeeId izključno iz seje (nikoli od klienta),
//      400 brez veljavne voznikove identitete.
//   C. SELF-CLAIM idempotencija — ista oseba → 200 update; druga oseba →
//      409 DRIVER_ALREADY_ASSIGNED; dva različna zaposlena z istim imenom →
//      409 (nov driverEmployeeId guard, ime-guard ne zadošča).
//   D. DELIVERED CLOSE-OUT — order pending/in-progress/ready → completed
//      (CAS guard in-list), cashCollected → Check/Order unpaid → paid,
//      podNotes zapisan, audit 'delivery_delivered' SAMO po uspeli tx;
//      completed/cancelled order → NI updateMany (guard); standalone
//      dostava (brez ordera) → close-out skip, audit ostane.
//   E. Regresija rute — schema union: prazen body z deliveryInfoId → assign
//      veja; delivered body s podNotes/cashCollected preko rute.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextResponse } from 'next/server'

const LOC_A = 'loc-tenant-a'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  // db raven (rute + pre-branja helperjev)
  dbTrackingFindMany: vi.fn(),
  dbTrackingFindUnique: vi.fn(),
  dbTrackingUpdate: vi.fn(),
  dbTrackingCreate: vi.fn(),
  dbInfoFindMany: vi.fn(),
  dbInfoFindUnique: vi.fn(),
  employeeFindUnique: vi.fn(),
  // tx raven (status CAS + assign + close-out)
  txTrackingFindUnique: vi.fn(),
  txTrackingUpdateMany: vi.fn(),
  txTrackingUpdate: vi.fn(),
  txTrackingCreate: vi.fn(),
  txInfoFindUnique: vi.fn(),
  txInfoUpdateMany: vi.fn(),
  txInfoUpdate: vi.fn(),
  txOrderFindUnique: vi.fn(),
  txOrderUpdateMany: vi.fn(),
  txCheckUpdateMany: vi.fn(),
  // route deps
  requireAuth: vi.fn(),
  resolveTenantScope: vi.fn(),
  notInScopeResponse: vi.fn(),
  isTrackingInScope: vi.fn(),
  createAuditLog: vi.fn(),
  emitEvent: vi.fn(),
}))

// Privzeti tx klient (r112 vzorec: $transaction pošlje fn(txClient))
const txClient = {
  deliveryTracking: {
    findUnique: mocks.txTrackingFindUnique,
    updateMany: mocks.txTrackingUpdateMany,
    update: mocks.txTrackingUpdate,
    create: mocks.txTrackingCreate,
  },
  deliveryInfo: { findUnique: mocks.txInfoFindUnique, updateMany: mocks.txInfoUpdateMany, update: mocks.txInfoUpdate },
  order: { findUnique: mocks.txOrderFindUnique, updateMany: mocks.txOrderUpdateMany },
  check: { updateMany: mocks.txCheckUpdateMany },
}

vi.mock('@/lib/db', () => ({
  db: {
    $transaction: mocks.transaction,
    deliveryTracking: {
      findMany: mocks.dbTrackingFindMany,
      findUnique: mocks.dbTrackingFindUnique,
      update: mocks.dbTrackingUpdate,
      create: mocks.dbTrackingCreate,
    },
    deliveryInfo: { findMany: mocks.dbInfoFindMany, findUnique: mocks.dbInfoFindUnique },
    employee: { findUnique: mocks.employeeFindUnique },
  },
  // createAuditLog je TOP-LEVEL export iz '@/lib/db' (r85/r112 vzorec)
  createAuditLog: mocks.createAuditLog,
}))

vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: mocks.requireAuth,
  resolveTenantLocationIdOrThrow: mocks.resolveTenantScope,
}))

vi.mock('@/lib/tenant-scope', () => ({
  notInScopeResponse: mocks.notInScopeResponse,
}))

// Barrel src/app/api/delivery-tracking/_helpers/index.ts re-exporta tudi
// handleGetTrackings/handleLocationUpdate — mock mora pokriti vse imena.
vi.mock('@/app/api/delivery-tracking/_helpers/tracking-queries', () => ({
  isTrackingInScope: mocks.isTrackingInScope,
  handleGetTrackings: vi.fn(),
  handleLocationUpdate: vi.fn(),
}))

vi.mock('@/lib/event-emitter', () => ({
  emitEvent: mocks.emitEvent,
}))

// Utišaj logger
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

import { GET as assignmentsGET } from '@/app/api/delivery/assignments/route'
import { POST as trackingPOST } from '@/app/api/delivery-tracking/route'
import { handleStatusUpdate } from '@/app/api/delivery-tracking/_helpers/tracking-actions'

function trackingJsonPost(body: unknown): Request {
  return new Request('http://localhost:3000/api/delivery-tracking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function session(overrides: Record<string, unknown> = {}) {
  return { token: 'tok-1', employeeId: 'emp-1', role: 'staff', permissions: ['take_orders'], locationId: LOC_A, ...overrides }
}

const INFO_MIN = {
  id: 'di-1', address: 'Ulica 1', city: 'Ljubljana', postCode: '1000',
  recipientName: 'Janez Prejemnik', recipientPhone: '+38641111222',
  deliveryInstructions: '3. nadstropje', status: 'picked_up', estimatedTime: null,
  order: {
    id: 'ord-1', orderNumber: 7, status: 'ready', paymentStatus: 'unpaid',
    type: 'delivery', locationId: LOC_A, createdAt: new Date('2026-01-01T10:00:00Z'),
    checks: [{ total: 21.3, paymentStatus: 'unpaid' }],
  },
}

const INFO_READY = {
  ...INFO_MIN,
  id: 'di-3',
  order: { ...INFO_MIN.order, id: 'ord-3', orderNumber: 9 },
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
  // db defaults
  mocks.dbInfoFindUnique.mockResolvedValue({ id: 'di-1', order: { id: 'ord-1', orderNumber: 7, locationId: LOC_A } })
  mocks.employeeFindUnique.mockResolvedValue({ name: 'Peter Kolesar', phone: '040123456' })
  // tx defaults (status CAS kanon)
  mocks.txTrackingFindUnique.mockResolvedValue({ id: 'tr-1', deliveryInfoId: 'di-1', status: 'assigned', locationId: LOC_A, driverName: 'Peter Kolesar', driverEmployeeId: null })
  mocks.txTrackingUpdateMany.mockResolvedValue({ count: 1 })
  mocks.txInfoFindUnique.mockResolvedValue({ id: 'di-1', status: 'pending', order: null })
  mocks.txInfoUpdateMany.mockResolvedValue({ count: 1 })
  mocks.txInfoUpdate.mockResolvedValue({ id: 'di-1' })
  mocks.txOrderFindUnique.mockResolvedValue(null)
  mocks.txOrderUpdateMany.mockResolvedValue({ count: 1 })
  mocks.txCheckUpdateMany.mockResolvedValue({ count: 1 })
})

// ══════════════════════════════════════════════════════════════════
// A. GET /api/delivery/assignments
// ══════════════════════════════════════════════════════════════════
describe('R137 A: GET /api/delivery/assignments — scope + filtriranje + whitelist', () => {
  it('scope napaka (fail-closed) → notInScopeResponse, ZERO db', async () => {
    mocks.resolveTenantScope.mockReturnValue({ error: mocks.notInScopeResponse('Lokacija') })
    const res = await assignmentsGET(new Request('http://localhost:3000/api/delivery/assignments'))
    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toMatchObject({ error: 'Lokacija ni najden' })
    expect(mocks.dbTrackingFindMany).not.toHaveBeenCalled()
    expect(mocks.dbInfoFindMany).not.toHaveBeenCalled()
  })

  it('happy path: mine (po driverEmployeeId) + ready (brez voznika), standalone izključen', async () => {
    const assignedAt = new Date('2026-01-01T09:00:00Z')
    // klicni red: 1× tracking.findMany (mine) → 1× info.findMany (mine batch)
    //             → 2× info.findMany (ready) → 2× tracking.findMany (ready preverba)
    mocks.dbTrackingFindMany
      .mockResolvedValueOnce([
        { deliveryInfoId: 'di-1', status: 'on_the_way', assignedAt, pickedUpAt: assignedAt, onTheWayAt: assignedAt, estimatedArrival: null, driverName: 'Peter Kolesar', podNotes: null },
        { deliveryInfoId: 'di-standalone', status: 'assigned', assignedAt, pickedUpAt: null, onTheWayAt: null, estimatedArrival: null, driverName: 'Peter Kolesar', podNotes: null },
      ])
      .mockResolvedValueOnce([
        { deliveryInfoId: 'di-2', driverName: 'Marko Zaseden', driverEmployeeId: 'emp-9' },
        { deliveryInfoId: 'di-3', driverName: '', driverEmployeeId: null },
      ])
    let mineWhere: unknown
    let readyWhere: unknown
    let readyArgs: Record<string, unknown> = {}
    let mineInfoArgs: Record<string, unknown> = {}
    mocks.dbInfoFindMany
      .mockImplementationOnce(async (args: Record<string, unknown>) => {
        mineInfoArgs = args
        mineWhere = (args.where as Record<string, unknown>)
        return [INFO_MIN]
      })
      .mockImplementationOnce(async (args: Record<string, unknown>) => {
        readyArgs = args
        readyWhere = (args.where as Record<string, unknown>)
        return [INFO_READY]
      })

    const res = await assignmentsGET(new Request('http://localhost:3000/api/delivery/assignments'))
    expect(res.status).toBe(200)
    const body = await res.json()

    // mine where: identiteta IZ SEJE + aktivni statusi + take/orderBy
    expect(mocks.dbTrackingFindMany.mock.calls[0][0]).toMatchObject({
      where: { driverEmployeeId: 'emp-1', status: { in: ['assigned', 'picked_up', 'on_the_way', 'arriving'] } },
      orderBy: { assignedAt: 'asc' },
      take: 50,
    })
    // mine batch: standalone (order null) izključen prek order.isNot
    expect((mineWhere as Record<string, unknown>).order).toEqual({ isNot: null })
    expect((mineWhere as Record<string, unknown>).id).toEqual({ in: ['di-1', 'di-standalone'] })
    // ready where: scope + type + odprti statusi + FIFO + take
    expect(readyWhere).toEqual({
      order: { locationId: LOC_A, type: 'delivery', status: { in: ['pending', 'in-progress', 'ready'] } },
    })
    expect(readyArgs.orderBy).toEqual({ order: { createdAt: 'asc' } })
    expect(readyArgs.take).toBe(50)

    // mine: samo z orderom (di-standalone odpade); shape = tracking whitelist + deliveryInfo
    expect(body.mine).toHaveLength(1)
    expect(body.mine[0].deliveryInfoId).toBe('di-1')
    expect(body.mine[0].deliveryInfo.order.orderNumber).toBe(7)
    expect(Object.keys(body.mine[0]).sort()).toEqual([
      'assignedAt', 'deliveryInfo', 'deliveryInfoId', 'driverName',
      'estimatedArrival', 'onTheWayAt', 'pickedUpAt', 'podNotes', 'status',
    ])
    // ready: di-2 ima voznika (izključen), di-3 brez voznika (vključen)
    expect(body.ready).toHaveLength(1)
    expect(body.ready[0].id).toBe('di-3')
    expect(typeof body.timestamp).toBe('string')
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false)
  })

  it('whitelist: customerName/email/notes/totals ne uhajajo (vrednost IN ključ)', async () => {
    mocks.dbTrackingFindMany
      .mockResolvedValueOnce([{ deliveryInfoId: 'di-1', status: 'assigned', assignedAt: new Date(), pickedUpAt: null, onTheWayAt: null, estimatedArrival: null, driverName: 'Peter Kolesar', podNotes: null }])
      .mockResolvedValueOnce([])
    mocks.dbInfoFindMany.mockResolvedValueOnce([INFO_MIN]).mockResolvedValueOnce([])

    const res = await assignmentsGET(new Request('http://localhost:3000/api/delivery/assignments'))
    const raw = JSON.stringify(await res.json())
    for (const banned of ['customerName', 'customerEmail', 'customerPhone', '"email"', 'notes', 'subtotal', '"tip"', 'totalWithTip']) {
      expect(raw).not.toContain(banned)
    }
  })

  it('empty employeeId (sistemski rob) → mine = [], ready deluje naprej', async () => {
    mocks.requireAuth.mockResolvedValue({ session: session({ employeeId: undefined }), error: null })
    // brez driverId: mine poizvedba NI izvedena → edini info.findMany = ready
    mocks.dbTrackingFindMany.mockResolvedValue([])
    mocks.dbInfoFindMany.mockResolvedValueOnce([INFO_READY])

    const res = await assignmentsGET(new Request('http://localhost:3000/api/delivery/assignments'))
    const body = await res.json()
    expect(body.mine).toEqual([])
    expect(body.ready).toHaveLength(1)
    // tracking.findOnly za ready preverbo (1×), NI mine poizvedbe po driverEmployeeId
    expect(mocks.dbTrackingFindMany).toHaveBeenCalledTimes(1)
  })

  it('super-admin (null scope) → ready brez locationId filtra (globalni pogled)', async () => {
    mocks.resolveTenantScope.mockReturnValue({ locationId: null })
    mocks.dbTrackingFindMany.mockResolvedValue([]) // mine + ready preverba
    // mine batch odpade (0 trackings) → edini info.findMany = ready
    mocks.dbInfoFindMany.mockResolvedValueOnce([])

    await assignmentsGET(new Request('http://localhost:3000/api/delivery/assignments'))
    const readyWhere = mocks.dbInfoFindMany.mock.calls[0][0].where
    expect(readyWhere.order.locationId).toBeUndefined()
    expect(readyWhere.order.type).toBe('delivery')
  })
})

// ══════════════════════════════════════════════════════════════════
// B. SELF-CLAIM — POST brez driverName
// ══════════════════════════════════════════════════════════════════
describe('R137 B: self-claim — dodelitev iz seje (brez driverName)', () => {
  it('prazen body z deliveryInfoId → assign veja: ime iz Employee, driverEmployeeId iz seje, 201', async () => {
    mocks.dbInfoFindUnique.mockResolvedValue({ id: 'di-1', order: { locationId: LOC_A } })
    mocks.txTrackingFindUnique.mockResolvedValue(null)
    mocks.txTrackingCreate.mockResolvedValue({ id: 'tr-new', deliveryInfoId: 'di-1', status: 'assigned' })

    const res = await trackingPOST(trackingJsonPost({ deliveryInfoId: 'di-1' }))
    expect(res.status).toBe(201)
    expect(mocks.employeeFindUnique).toHaveBeenCalledWith({ where: { id: 'emp-1' }, select: { name: true, phone: true } })
    const data = mocks.txTrackingCreate.mock.calls[0][0].data
    expect(data.driverName).toBe('Peter Kolesar')
    expect(data.driverPhone).toBe('040123456')
    expect(data.driverEmployeeId).toBe('emp-1')
    // audit dopolnjen z driverEmployeeId
    expect(mocks.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'driver_assigned',
      details: expect.objectContaining({ driverEmployeeId: 'emp-1', driverName: 'Peter Kolesar' }),
    }))
  })

  it('brez employeeId v seji → 400 Voznik ni najden, NI tx', async () => {
    mocks.requireAuth.mockResolvedValue({ session: session({ employeeId: undefined }), error: null })
    const res = await trackingPOST(trackingJsonPost({ deliveryInfoId: 'di-1' }))
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: 'Voznik ni najden' })
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.dbTrackingCreate).not.toHaveBeenCalled()
  })

  it('zaposleni ne obstaja (pokvarjena seja) → 400 Voznik ni najden', async () => {
    mocks.employeeFindUnique.mockResolvedValue(null)
    const res = await trackingPOST(trackingJsonPost({ deliveryInfoId: 'di-1' }))
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: 'Voznik ni najden' })
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('legacy dispatcher pot: expliciten driverName → NI employee lookupa, driverEmployeeId žige klicatelj', async () => {
    mocks.dbInfoFindUnique.mockResolvedValue({ id: 'di-1', order: { locationId: LOC_A } })
    mocks.txTrackingFindUnique.mockResolvedValue(null)
    mocks.txTrackingCreate.mockResolvedValue({ id: 'tr-new' })

    const res = await trackingPOST(trackingJsonPost({ deliveryInfoId: 'di-1', driverName: 'Marko Prostotekst', driverPhone: '041' }))
    expect(res.status).toBe(201)
    expect(mocks.employeeFindUnique).not.toHaveBeenCalled()
    const data = mocks.txTrackingCreate.mock.calls[0][0].data
    expect(data.driverName).toBe('Marko Prostotekst')
    // driverEmployeeId IZKLJUČNO iz seje (nikoli od klienta) — legacy žig = klicatelj
    expect(data.driverEmployeeId).toBe('emp-1')
  })
})

// ══════════════════════════════════════════════════════════════════
// C. SELF-CLAIM idempotencija
// ══════════════════════════════════════════════════════════════════
describe('R137 C: self-claim idempotencija — ista oseba 200, druga 409', () => {
  it('ista oseba ponovno self-claim → 200 update (brez create)', async () => {
    mocks.dbInfoFindUnique.mockResolvedValue({ id: 'di-1', order: { locationId: LOC_A } })
    mocks.txTrackingFindUnique.mockResolvedValue({ id: 'tr-1', deliveryInfoId: 'di-1', status: 'assigned', locationId: LOC_A, driverName: 'Peter Kolesar', driverEmployeeId: 'emp-1' })
    mocks.txTrackingUpdate.mockResolvedValue({ id: 'tr-1' })

    const res = await trackingPOST(trackingJsonPost({ deliveryInfoId: 'di-1' }))
    expect(res.status).toBe(200)
    expect(mocks.txTrackingUpdate).toHaveBeenCalledTimes(1)
    expect(mocks.txTrackingUpdate.mock.calls[0][0].data.driverEmployeeId).toBe('emp-1')
    expect(mocks.txTrackingCreate).not.toHaveBeenCalled()
  })

  it('druga oseba na zasedeno dostavo → 409 DRIVER_ALREADY_ASSIGNED', async () => {
    mocks.dbInfoFindUnique.mockResolvedValue({ id: 'di-1', order: { locationId: LOC_A } })
    mocks.txTrackingFindUnique.mockResolvedValue({ id: 'tr-1', deliveryInfoId: 'di-1', status: 'assigned', locationId: LOC_A, driverName: 'Drugi Voznik', driverEmployeeId: 'emp-2' })

    const res = await trackingPOST(trackingJsonPost({ deliveryInfoId: 'di-1' }))
    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toMatchObject({ error: 'Dostava že ima dodeljenega voznika. Kontaktrajte voznika za predajo.' })
    expect(mocks.txTrackingUpdate).not.toHaveBeenCalled()
  })

  it('dva različna zaposlena z ISTIM imenom → 409 (nov employeeId guard)', async () => {
    mocks.employeeFindUnique.mockResolvedValue({ name: 'Peter Kolesar', phone: '' })
    mocks.dbInfoFindUnique.mockResolvedValue({ id: 'di-1', order: { locationId: LOC_A } })
    mocks.txTrackingFindUnique.mockResolvedValue({ id: 'tr-1', deliveryInfoId: 'di-1', status: 'assigned', locationId: LOC_A, driverName: 'Peter Kolesar', driverEmployeeId: 'emp-2' })

    const res = await trackingPOST(trackingJsonPost({ deliveryInfoId: 'di-1' }))
    expect(res.status).toBe(409)
    expect(mocks.txTrackingUpdate).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// D. DELIVERED CLOSE-OUT (handleStatusUpdate, isti tx kot CAS kanon)
// ══════════════════════════════════════════════════════════════════
describe('R137 D: delivered close-out — order/check zaprtje + POD', () => {
  function mockDeliveredTracking() {
    const tracking = { id: 'tr-1', deliveryInfoId: 'di-1', status: 'arriving', locationId: LOC_A, driverName: 'Peter Kolesar' }
    mocks.dbTrackingFindUnique.mockResolvedValue({ ...tracking })
    mocks.txTrackingFindUnique.mockResolvedValue({ ...tracking })
    mocks.dbInfoFindUnique.mockResolvedValue({ id: 'di-1', order: { id: 'ord-1', orderNumber: 7, locationId: LOC_A } })
    mocks.txInfoFindUnique.mockResolvedValue({
      id: 'di-1', status: 'picked_up',
      order: { id: 'ord-1', status: 'ready', paymentStatus: 'unpaid', locationId: LOC_A, type: 'delivery' },
    })
  }

  it('delivered + cashCollected → order completed (guard in-list) + check/order paid + podNotes + audit', async () => {
    mockDeliveredTracking()
    const res = await handleStatusUpdate('di-1', 'delivered', undefined, undefined, LOC_A, 'Pustljeno pri vrati', true)
    expect(res.status).toBe(200)

    // 1. Order.status → completed (CAS-ovski guard in-list)
    expect(mocks.txOrderUpdateMany.mock.calls[0][0]).toEqual({
      where: { id: 'ord-1', status: { in: ['pending', 'in-progress', 'ready'] } },
      data: { status: 'completed' },
    })
    // 2. gotovina pobrana → Check + Order unpaid → paid
    expect(mocks.txCheckUpdateMany).toHaveBeenCalledTimes(1)
    expect(mocks.txCheckUpdateMany.mock.calls[0][0]).toEqual({
      where: { orderId: 'ord-1', paymentStatus: 'unpaid' },
      data: { paymentStatus: 'paid' },
    })
    expect(mocks.txOrderUpdateMany.mock.calls[1][0]).toEqual({
      where: { id: 'ord-1', paymentStatus: 'unpaid' },
      data: { paymentStatus: 'paid' },
    })
    // 3. podNotes zapisan na tracking CAS
    expect(mocks.txTrackingUpdateMany.mock.calls[0][0].data.podNotes).toBe('Pustljeno pri vrati')
    // 4. audit delivery_delivered s forenziko — ZNOTRAJ tx (2. argument = tx)
    expect(mocks.createAuditLog).toHaveBeenCalledTimes(1)
    expect(mocks.createAuditLog.mock.calls[0][1]).toBe(txClient)
    expect(mocks.createAuditLog.mock.calls[0][0]).toMatchObject({
      action: 'delivery_delivered',
      entityType: 'delivery',
      details: {
        podNotes: 'Pustljeno pri vrati', cashCollected: true, orderId: 'ord-1', locationId: LOC_A,
      },
    })
  })

  it('delivered BREZ cashCollected → NI check klicev, order close-out ostane', async () => {
    mockDeliveredTracking()
    const res = await handleStatusUpdate('di-1', 'delivered', undefined, undefined, LOC_A, undefined, undefined)
    expect(res.status).toBe(200)
    expect(mocks.txCheckUpdateMany).not.toHaveBeenCalled()
    expect(mocks.txOrderUpdateMany).toHaveBeenCalledTimes(1)
    expect(mocks.txOrderUpdateMany.mock.calls[0][0].data).toEqual({ status: 'completed' })
    expect(mocks.createAuditLog.mock.calls[0][0]).toMatchObject({
      details: { cashCollected: false, podNotes: null },
    })
  })

  it('order že completed (tx-fresh) → NI order.updateMany (guard, nikoli downgrade)', async () => {
    mockDeliveredTracking()
    mocks.txInfoFindUnique.mockResolvedValue({
      id: 'di-1', status: 'picked_up',
      order: { id: 'ord-1', status: 'completed', paymentStatus: 'paid', locationId: LOC_A, type: 'delivery' },
    })
    const res = await handleStatusUpdate('di-1', 'delivered', undefined, undefined, LOC_A, undefined, undefined)
    expect(res.status).toBe(200)
    expect(mocks.txOrderUpdateMany).not.toHaveBeenCalled()
    expect(mocks.txCheckUpdateMany).not.toHaveBeenCalled()
  })

  it('order cancelled → NI order.updateMany (terminalno stanje)', async () => {
    mockDeliveredTracking()
    mocks.txInfoFindUnique.mockResolvedValue({
      id: 'di-1', status: 'picked_up',
      order: { id: 'ord-1', status: 'cancelled', paymentStatus: 'unpaid', locationId: LOC_A, type: 'delivery' },
    })
    const res = await handleStatusUpdate('di-1', 'delivered', undefined, undefined, LOC_A, undefined, undefined)
    expect(res.status).toBe(200)
    expect(mocks.txOrderUpdateMany).not.toHaveBeenCalled()
  })

  it('standalone dostava (brez ordera) → close-out skip, audit ostane z orderId null', async () => {
    mockDeliveredTracking()
    mocks.txInfoFindUnique.mockResolvedValue({ id: 'di-1', status: 'picked_up', order: null })
    const res = await handleStatusUpdate('di-1', 'delivered', undefined, undefined, LOC_A, 'opomba', true)
    expect(res.status).toBe(200)
    expect(mocks.txOrderUpdateMany).not.toHaveBeenCalled()
    expect(mocks.txCheckUpdateMany).not.toHaveBeenCalled()
    expect(mocks.createAuditLog.mock.calls[0][0]).toMatchObject({
      details: { orderId: null, podNotes: 'opomba', cashCollected: true },
    })
  })

  it('CAS izgubljena tekma (tracking count 0) → 409, NI close-outa, NI audita', async () => {
    mockDeliveredTracking()
    mocks.txTrackingUpdateMany.mockResolvedValue({ count: 0 })
    const res = await handleStatusUpdate('di-1', 'delivered', undefined, undefined, LOC_A, 'x', true)
    expect(res.status).toBe(409)
    expect(mocks.txOrderUpdateMany).not.toHaveBeenCalled()
    expect(mocks.txCheckUpdateMany).not.toHaveBeenCalled()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })

  it('ne-delivered status (picked_up) → NI close-outa, NI audita (regresija r112 kanona)', async () => {
    const tracking = { id: 'tr-1', deliveryInfoId: 'di-1', status: 'assigned', locationId: LOC_A, driverName: 'Peter Kolesar' }
    mocks.dbTrackingFindUnique.mockResolvedValue({ ...tracking })
    mocks.txTrackingFindUnique.mockResolvedValue({ ...tracking })
    const res = await handleStatusUpdate('di-1', 'picked_up', undefined, undefined, LOC_A)
    expect(res.status).toBe(200)
    expect(mocks.txOrderUpdateMany).not.toHaveBeenCalled()
    expect(mocks.txCheckUpdateMany).not.toHaveBeenCalled()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })

  it('ruta prenaša podNotes/cashCollected (schema + pass-through) v close-out', async () => {
    mockDeliveredTracking()
    const res = await trackingPOST(trackingJsonPost({ deliveryInfoId: 'di-1', status: 'delivered', podNotes: 'Vratar prevzel', cashCollected: true }))
    expect(res.status).toBe(200)
    expect(mocks.txTrackingUpdateMany.mock.calls[0][0].data.podNotes).toBe('Vratar prevzel')
    expect(mocks.txCheckUpdateMany).toHaveBeenCalledTimes(1)
  })
})
