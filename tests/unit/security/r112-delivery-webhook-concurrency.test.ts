// ============================================
// R112 — DELIVERY WEBHOOK HARDENING (idempotenca + tenant scope + status CAS)
//        — CONCURRENCY & ERROR KONTRAKT (TOCTOU razred R100–R111)
// ============================================
//
// Forenzika (glej bolt/route.ts, wolt/_helpers/wolt-mapping.ts,
// glovo/_helpers/*, delivery-tracking/_helpers/tracking-actions.ts,
// delivery/[id]/route.ts, delivery/_helpers/status-transitions.ts R112 headerje):
//
//   WEBHOOK-1 (MED-HIGH, Bolt dedup TOCTOU): dedup (order.findFirst
//     customerName CONTAINS 'Bolt:<id>') je bil izven tx, order.create pa
//     sekundo kasneje — sočasna provider redeliverija je obšla oba pregleda
//     → DVE plačani naročili. Fix: ENA Serializable tx — advisory lock
//     'delivery-webhook:{integrationId}:{externalOrderId}' + tx-fresh dedup
//     re-check + create pod istim snapshot-om; P2034 → 409; izgubljena tekma
//     → idempotenten 200 z obstoječim naročilom.
//   WEBHOOK-2 (MED, Wolt/Glovo dedup): dedup scan integrationLog.requestData
//     izven tx, log zapisan ŠELE PO create → isti TOCTOU. Fix: isti lock + tx
//     re-check okoli dedup → create.
//   WEBHOOK-3 (MED, cross-tenant item mapping): menuItem lookup NESCOPEPAN
//     (OR[id, name] brez lokacije) → tuja cena/DDV. Fix: MODEL A veriga
//     category → menu → locationId (obvezen locationId param).
//   WEBHOOK-4 (MED, Bolt wire-price fallback): prej menuItems[0] fallback +
//     wire cena iz payloada. Fix: brez scoped ujemanja → 400 'Neznana
//     pozicija' (tx abort, NI delnega naročila).
//   WEBHOOK-5 (MED, delivery status last-writer-wins): 3 nepovezani writerji
//     (voznik, ročna UI pot, dodelitev) → regresija delivered → picked_up.
//     Fix: skupna mapa prehodov + tx-fresh read + CAS updateMany (count 0 →
//     409 'Status dostave je v medčasom spremenjen — osvežite').
//
// Pokritje: A Bolt kanon · B Wolt kanon · C Glovo kanon ·
// D status CAS kanon · E fs-pini (vir pini).
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { createHmac } from 'crypto'
import { Prisma } from '@prisma/client'

const LOC_A = 'loc-1'

// --- Mocki (vi.hoisted) ---
const mocks = vi.hoisted(() => ({
  // db + tx
  transaction: vi.fn(),
  integrationFindFirst: vi.fn(),
  integrationUpdate: vi.fn(),
  integrationLogCreate: vi.fn(),
  integrationLogFindMany: vi.fn(),
  orderFindFirst: vi.fn(),
  menuItemFindMany: vi.fn(),
  menuItemFindFirst: vi.fn(),
  infoFindUnique: vi.fn(),
  // tx klient
  txExecuteRaw: vi.fn(),
  txIntegrationLogFindMany: vi.fn(),
  txOrderFindFirst: vi.fn(),
  txMenuItemFindMany: vi.fn(),
  txMenuItemFindFirst: vi.fn(),
  txOrderCreate: vi.fn(),
  txTrackingFindUnique: vi.fn(),
  txTrackingUpdateMany: vi.fn(),
  txInfoFindUnique: vi.fn(),
  txInfoUpdateMany: vi.fn(),
  txInfoFindFirst: vi.fn(),
  // route depi
  getNextOrderNumber: vi.fn(),
  emitOrderCreated: vi.fn(),
  emitEvent: vi.fn(),
  checkRateLimitAsync: vi.fn(),
  getClientIp: vi.fn(),
  rateLimitedResponse: vi.fn(),
  parseWebhookEnvelope: vi.fn(),
  broadcastWSEvent: vi.fn(),
  deductInventoryWolt: vi.fn(),
  logAndSyncWolt: vi.fn(),
  deductInventoryGlovo: vi.fn(),
  logAndSyncGlovo: vi.fn(),
  // delivery-tracking / delivery/[id]
  trackingFindUnique: vi.fn(),
  isTrackingInScope: vi.fn(),
  requireAuth: vi.fn(),
  resolveTenantScope: vi.fn(),
  notInScopeResponse: vi.fn(),
}))

// Privzeti tx klient (deljen A/B/C/D — ločene mock funkcije)
const txClient = {
  $executeRaw: mocks.txExecuteRaw,
  integrationLog: { findMany: mocks.txIntegrationLogFindMany },
  menuItem: { findMany: mocks.txMenuItemFindMany, findFirst: mocks.txMenuItemFindFirst },
  order: { findFirst: mocks.txOrderFindFirst, create: mocks.txOrderCreate },
  deliveryTracking: { findUnique: mocks.txTrackingFindUnique, updateMany: mocks.txTrackingUpdateMany },
  deliveryInfo: { findUnique: mocks.txInfoFindUnique, updateMany: mocks.txInfoUpdateMany, findFirst: mocks.txInfoFindFirst },
}

vi.mock('@/lib/db', () => ({
  db: {
    $transaction: mocks.transaction,
    integration: { findFirst: mocks.integrationFindFirst, update: mocks.integrationUpdate },
    integrationLog: { create: mocks.integrationLogCreate, findMany: mocks.integrationLogFindMany },
    menuItem: { findMany: mocks.menuItemFindMany, findFirst: mocks.menuItemFindFirst },
    order: { findFirst: mocks.orderFindFirst },
    // R124 (P0-03): availability kanon — prazna zaloga = ne-sledeni artikli
    // (checkStockAvailability / computeMenuStockMap vrneta brez opozoril/vnosov)
    inventoryItem: { findMany: vi.fn().mockResolvedValue([]) },
    recipeItem: { findMany: vi.fn().mockResolvedValue([]) },
    deliveryTracking: { findUnique: mocks.trackingFindUnique },
    deliveryInfo: { findUnique: mocks.infoFindUnique },
  },
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/counters', () => ({
  getNextOrderNumber: mocks.getNextOrderNumber,
}))

vi.mock('@/lib/event-emitter', () => ({
  emitOrderCreated: mocks.emitOrderCreated,
  emitEvent: mocks.emitEvent,
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.checkRateLimitAsync,
  getClientIp: mocks.getClientIp,
  DELIVERY_WEBHOOK_LIMIT: { windowMs: 60000, max: 60 },
}))

vi.mock('@/lib/rate-limit/response', () => ({
  rateLimitedResponse: mocks.rateLimitedResponse,
}))

vi.mock('@/lib/ordering-token', () => ({
  isOrderingSecretConfigured: vi.fn(() => true),
  parseWebhookEnvelope: mocks.parseWebhookEnvelope,
}))

vi.mock('@/lib/websocket-client', () => ({
  broadcastWSEvent: mocks.broadcastWSEvent,
}))

vi.mock('@/lib/webhook-engine', () => ({
  verifySignature: vi.fn(() => true),
}))

vi.mock('@/app/api/delivery/webhook/wolt/_helpers/wolt-inventory', () => ({
  deductInventoryForOrder: mocks.deductInventoryWolt,
  logAndSyncIntegration: mocks.logAndSyncWolt,
}))

vi.mock('@/app/api/delivery/webhook/glovo/_helpers/glovo-inventory', () => ({
  deductInventoryForOrder: mocks.deductInventoryGlovo,
}))

vi.mock('@/app/api/delivery/webhook/glovo/_helpers/glovo-logging', () => ({
  broadcastWS: vi.fn(),
  logAndSyncIntegration: mocks.logAndSyncGlovo,
}))

vi.mock('@/app/api/delivery-tracking/_helpers/tracking-queries', () => ({
  isTrackingInScope: mocks.isTrackingInScope,
}))

vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: mocks.requireAuth,
  resolveTenantLocationIdOrThrow: mocks.resolveTenantScope,
}))

vi.mock('@/lib/tenant-scope', () => ({
  notInScopeResponse: mocks.notInScopeResponse,
}))

// Utišaj logger
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

import { POST as boltPOST } from '@/app/api/delivery/webhook/bolt/route'
import { POST as woltPOST } from '@/app/api/delivery/webhook/wolt/route'
import { POST as glovoPOST } from '@/app/api/delivery/webhook/glovo/route'
import { handleStatusUpdate } from '@/app/api/delivery-tracking/_helpers/tracking-actions'
import { PUT as deliveryPUT } from '@/app/api/delivery/[id]/route'
import {
  canTransitionDeliveryStatus,
  DELIVERY_STATUS_TRANSITIONS,
  STALE_DELIVERY_STATUS_MESSAGE,
} from '@/app/api/delivery/_helpers/status-transitions'

const INT_BOLT = { id: 'int-bolt-1', provider: 'bolt', isActive: true, locationId: LOC_A, apiSecret: 'bolt-secret' }
const INT_WOLT = { id: 'int-wolt-1', provider: 'wolt', isActive: true, locationId: LOC_A, apiSecret: 'wolt-secret' }
const INT_GLOVO = { id: 'int-glovo-1', provider: 'glovo', isActive: true, locationId: LOC_A, apiSecret: 'glovo-secret' }

const BOLT_PAYLOAD = (orderId: string) => ({
  order_id: orderId,
  status: 'pending',
  customer: { name: 'Metka Novak', phone: '+38640123456' },
  delivery_address: 'Ulica 1, Ljubljana',
  delivery_notes: 'zvonec pri vrati',
  delivery_fee: 1.5,
  items: [{ id: 'b1', name: 'Pica Margherita', quantity: 2, price: 9.9, notes: '', options: [] }],
  total_price: 21.3,
  currency: 'EUR',
})

const WOLT_PAYLOAD = (orderId: string) => ({
  order_id: orderId,
  status: 'pending',
  delivery: {
    location: { formatted_address: 'Cesta 2, Ljubljana' },
    recipient: { name: 'Janez Kranjski', phone: '+38641111222' },
  },
  items: [{ item_id: 'mi-1', name: 'Pica Margherita', count: 1 }],
  payment: { method: 'card', total: 10.6 },
})

const GLOVO_PAYLOAD = (orderId: string) => ({
  order_id: orderId,
  status: 'pending',
  delivery_address: { street: 'Ulica 3', city: 'Maribor' },
  customer: { name: 'Mojca Pokrajculja', phone: '+38641222333' },
  products: [{ product_id: 'mi-1', name: 'Pica Margherita', quantity: 2, price: 9.5 }],
  payment: { method: 'card' },
})

const MENU_ITEM = { id: 'mi-1', name: 'Pica Margherita', price: 9.5, vatRate: 9.5 }
const CREATED_ORDER = { id: 'ord-new-1', orderNumber: 42, locationId: LOC_A, total: 21.3, orderItems: [], deliveryInfo: {} }
const TRACKING = { id: 'tr-1', deliveryInfoId: 'di-1', status: 'assigned', locationId: LOC_A, driverName: 'Peter Kolesar', estimatedArrival: null }

function boltRequest(orderId: string): Request {
  const body = JSON.stringify(BOLT_PAYLOAD(orderId))
  const sig = createHmac('sha256', 'bolt-secret').update(body).digest('hex')
  return new Request('http://localhost/api/delivery/webhook/bolt?t=env-1:hmac', {
    method: 'POST',
    headers: { 'x-bolt-signature': sig, 'content-type': 'application/json' },
    body,
  })
}

function webhookRequest(url: string, payload: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'x-wolt-signature': 'sig', 'x-glovo-signature': 'sig', 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

function jsonPut(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(txClient))
  // route depi
  mocks.checkRateLimitAsync.mockResolvedValue({ allowed: true, retryAfterMs: 1000 })
  mocks.getClientIp.mockReturnValue('203.0.113.9')
  mocks.parseWebhookEnvelope.mockReturnValue({ ok: true, integrationId: 'env-1' })
  mocks.integrationFindFirst.mockImplementation(async ({ where }: { where: { provider: string } }) => {
    const map: Record<string, unknown> = { bolt: { ...INT_BOLT }, wolt: { ...INT_WOLT }, glovo: { ...INT_GLOVO } }
    return map[where.provider] ?? null
  })
  mocks.integrationLogCreate.mockResolvedValue({})
  mocks.integrationUpdate.mockResolvedValue({})
  mocks.getNextOrderNumber.mockResolvedValue(42)
  mocks.emitOrderCreated.mockResolvedValue(undefined)
  mocks.emitEvent.mockResolvedValue(undefined)
  mocks.deductInventoryWolt.mockResolvedValue(undefined)
  mocks.logAndSyncWolt.mockResolvedValue(undefined)
  mocks.deductInventoryGlovo.mockResolvedValue(undefined)
  mocks.logAndSyncGlovo.mockResolvedValue(undefined)
  // db defaults
  mocks.orderFindFirst.mockResolvedValue(null)
  mocks.integrationLogFindMany.mockResolvedValue([])
  mocks.menuItemFindMany.mockResolvedValue([MENU_ITEM])
  mocks.menuItemFindFirst.mockResolvedValue(MENU_ITEM)
  mocks.infoFindUnique.mockResolvedValue({ id: 'di-1', order: { id: 'ord-1', orderNumber: 5, locationId: LOC_A } })
  // tx defaults
  mocks.txExecuteRaw.mockResolvedValue(1)
  mocks.txIntegrationLogFindMany.mockResolvedValue([])
  mocks.txOrderFindFirst.mockResolvedValue(null)
  mocks.txMenuItemFindMany.mockResolvedValue([MENU_ITEM])
  mocks.txMenuItemFindFirst.mockResolvedValue(MENU_ITEM)
  mocks.txOrderCreate.mockResolvedValue({ ...CREATED_ORDER })
  // tracking defaults
  mocks.trackingFindUnique.mockResolvedValue({ ...TRACKING })
  mocks.isTrackingInScope.mockResolvedValue(true)
  mocks.txTrackingFindUnique.mockResolvedValue({ ...TRACKING })
  mocks.txTrackingUpdateMany.mockResolvedValue({ count: 1 })
  mocks.txInfoFindUnique.mockResolvedValue({ id: 'di-1', status: 'pending' })
  mocks.txInfoUpdateMany.mockResolvedValue({ count: 1 })
  // delivery/[id] defaults
  mocks.requireAuth.mockResolvedValue({ session: { employeeId: 'emp-1', role: 'waiter', locationId: LOC_A }, error: null })
  mocks.resolveTenantScope.mockReturnValue({ locationId: LOC_A })
  mocks.txInfoFindFirst.mockResolvedValue({ id: 'di-1', status: 'picked_up', deliveryFee: 2.5, order: { id: 'ord-1' } })
  mocks.txInfoUpdateMany.mockResolvedValue({ count: 1 })
})

// ══════════════════════════════════════════════════════════════════
// A. WEBHOOK-1 — Bolt dedup: advisory lock + Serializable tx + tx-fresh re-check
// ══════════════════════════════════════════════════════════════════
describe('R112 A: POST /api/delivery/webhook/bolt — WEBHOOK-1 dedup kanon', () => {
  it('srečna pot: 201 + advisory lock delivery-webhook:{int}:{order} + scoped menu + create v tx', async () => {
    const res = await boltPOST(boltRequest('bolt-123'))
    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toMatchObject({ success: true, orderNumber: 42, orderId: 'ord-new-1' })
    // advisory lock ključ (tagged-template: values[0])
    expect(mocks.txExecuteRaw).toHaveBeenCalledTimes(1)
    expect(mocks.txExecuteRaw.mock.calls[0][1]).toBe('delivery-webhook:int-bolt-1:bolt-123')
    // WEBHOOK-3: menu fetch scoped prek category → menu → locationId
    const menuWhere = mocks.txMenuItemFindMany.mock.calls[0][0].where
    expect(menuWhere.category.menu.locationId).toBe(LOC_A)
    expect(menuWhere.isAvailable).toBe(true)
    // counter ZNOTRAJ tx + create pod istim snapshot-om
    expect(mocks.getNextOrderNumber).toHaveBeenCalledWith(LOC_A, txClient)
    expect(mocks.txOrderCreate.mock.calls[0][0].data.customerName).toContain('Bolt:bolt-123')
  })

  it('tx-fresh dedup re-check najde duplikat → idempotenten 200 z obstoječim naročilom, NI create-a', async () => {
    mocks.txOrderFindFirst.mockResolvedValue({ id: 'ord-existing', orderNumber: 77, status: 'pending' })
    const res = await boltPOST(boltRequest('bolt-123'))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      message: 'Naročilo že obstaja',
      orderNumber: 77,
      orderId: 'ord-existing',
    })
    // lock JE bil pridobljen (avtoritativna preverba pod ključavnico), create NE
    expect(mocks.txExecuteRaw).toHaveBeenCalledTimes(1)
    expect(mocks.txOrderCreate).not.toHaveBeenCalled()
  })

  it('fast-path duplikat (db) → 200 brez tx (isti kontrakt kot prej)', async () => {
    mocks.orderFindFirst.mockResolvedValue({ id: 'ord-existing', orderNumber: 77, status: 'pending' })
    const res = await boltPOST(boltRequest('bolt-123'))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ message: 'Naročilo že obstaja', orderId: 'ord-existing' })
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.txOrderCreate).not.toHaveBeenCalled()
  })

  it('P2034 Serializable konflikt → 409 (prej 500)', async () => {
    mocks.transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('conflict', { code: 'P2034', clientVersion: 'test' }),
    )
    const res = await boltPOST(boltRequest('bolt-123'))
    expect(res.status).toBe(409)
  })

  it('Serializable izolacija: $transaction options { isolationLevel: Serializable }', async () => {
    await boltPOST(boltRequest('bolt-123'))
    expect(mocks.transaction.mock.calls[0][1]).toMatchObject({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })
  })

  it('WEBHOOK-4: neznana pozicija → 400 Neznana pozicija (NI menuItems[0] fallbacka, NI wire cene)', async () => {
    mocks.txMenuItemFindMany.mockResolvedValue([{ id: 'mi-x', name: 'Burger', price: 5, vatRate: 22 }])
    const res = await boltPOST(boltRequest('bolt-123'))
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining('Neznana pozicija: Pica Margherita') })
    expect(mocks.txOrderCreate).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// B. WEBHOOK-2 — Wolt dedup: lock + tx re-check; WEBHOOK-3 scoped mapping
// ══════════════════════════════════════════════════════════════════
describe('R112 B: POST /api/delivery/webhook/wolt — WEBHOOK-2/3 kanon', () => {
  it('srečna pot: accepted + lock ključ + scoped menuItem lookup (category → menu → locationId)', async () => {
    const res = await woltPOST(webhookRequest('http://localhost/api/delivery/webhook/wolt?t=env-1:hmac', WOLT_PAYLOAD('wolt-77')))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ status: 'accepted', orderId: 'ord-new-1', orderNumber: 42 })
    expect(mocks.txExecuteRaw.mock.calls[0][1]).toBe('delivery-webhook:int-wolt-1:wolt-77')
    const where = mocks.txMenuItemFindFirst.mock.calls[0][0].where
    expect(where.category.menu.locationId).toBe(LOC_A)
    expect(where.OR).toEqual([{ id: 'mi-1' }, { name: 'Pica Margherita' }])
    expect(mocks.txOrderCreate).toHaveBeenCalledTimes(1)
    expect(mocks.deductInventoryWolt).toHaveBeenCalledTimes(1)
    expect(mocks.logAndSyncWolt).toHaveBeenCalledTimes(1)
  })

  it('tx-fresh dedup re-check (log scan) → 200 accepted z obstoječim orderId, NI create/deduction', async () => {
    mocks.txIntegrationLogFindMany.mockResolvedValue([
      { requestData: '{"order_id":"wolt-77"}', responseData: '{"orderId":"ord-existing"}' },
    ])
    const res = await woltPOST(webhookRequest('http://localhost/api/delivery/webhook/wolt?t=env-1:hmac', WOLT_PAYLOAD('wolt-77')))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ status: 'accepted', orderId: 'ord-existing' })
    expect(mocks.txOrderCreate).not.toHaveBeenCalled()
    expect(mocks.deductInventoryWolt).not.toHaveBeenCalled()
    expect(mocks.logAndSyncWolt).not.toHaveBeenCalled()
  })

  it('P2034 Serializable konflikt → 409', async () => {
    mocks.transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('conflict', { code: 'P2034', clientVersion: 'test' }),
    )
    const res = await woltPOST(webhookRequest('http://localhost/api/delivery/webhook/wolt?t=env-1:hmac', WOLT_PAYLOAD('wolt-77')))
    expect(res.status).toBe(409)
  })

  it('ni preslikavih artiklov (nescopecan/neznan) → 400 Artikli niso najdeni, NI create-a', async () => {
    mocks.txMenuItemFindFirst.mockResolvedValue(null)
    const res = await woltPOST(webhookRequest('http://localhost/api/delivery/webhook/wolt?t=env-1:hmac', WOLT_PAYLOAD('wolt-77')))
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: 'Artikli niso najdeni' })
    expect(mocks.txOrderCreate).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// C. WEBHOOK-2 — Glovo dedup: lock + tx re-check; WEBHOOK-3 scoped mapping
// ══════════════════════════════════════════════════════════════════
describe('R112 C: POST /api/delivery/webhook/glovo — WEBHOOK-2/3 kanon', () => {
  it('srečna pot: accepted + lock ključ + scoped product lookup', async () => {
    const res = await glovoPOST(webhookRequest('http://localhost/api/delivery/webhook/glovo?t=env-1:hmac', GLOVO_PAYLOAD('glovo-9')))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ status: 'accepted', orderId: 'ord-new-1', orderNumber: 42 })
    expect(mocks.txExecuteRaw.mock.calls[0][1]).toBe('delivery-webhook:int-glovo-1:glovo-9')
    const where = mocks.txMenuItemFindFirst.mock.calls[0][0].where
    expect(where.category.menu.locationId).toBe(LOC_A)
    expect(where.OR).toEqual([{ id: 'mi-1' }, { name: 'Pica Margherita' }])
    expect(mocks.txOrderCreate).toHaveBeenCalledTimes(1)
    expect(mocks.deductInventoryGlovo).toHaveBeenCalledTimes(1)
  })

  it('tx-fresh dedup re-check → 200 accepted z obstoječim orderId, NI create-a', async () => {
    mocks.txIntegrationLogFindMany.mockResolvedValue([
      { requestData: '{"order_id": "glovo-9"}', responseData: '{"orderId":"ord-existing"}' },
    ])
    const res = await glovoPOST(webhookRequest('http://localhost/api/delivery/webhook/glovo?t=env-1:hmac', GLOVO_PAYLOAD('glovo-9')))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ status: 'accepted', orderId: 'ord-existing' })
    expect(mocks.txOrderCreate).not.toHaveBeenCalled()
  })

  it('P2034 Serializable konflikt → 409', async () => {
    mocks.transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('conflict', { code: 'P2034', clientVersion: 'test' }),
    )
    const res = await glovoPOST(webhookRequest('http://localhost/api/delivery/webhook/glovo?t=env-1:hmac', GLOVO_PAYLOAD('glovo-9')))
    expect(res.status).toBe(409)
  })
})

// ══════════════════════════════════════════════════════════════════
// D. WEBHOOK-5 — status dostave: skupna mapa prehodov + CAS (obe pisalni poti)
// ══════════════════════════════════════════════════════════════════
describe('R112 D: WEBHOOK-5 — voznikova pot (handleStatusUpdate) CAS kanon', () => {
  it('srečna pot: assigned → picked_up, CAS updateMany { id, status: fresh } na tracking + info', async () => {
    const res = await handleStatusUpdate('di-1', 'picked_up', undefined, undefined, LOC_A)
    expect(res.status).toBe(200)
    expect(mocks.txTrackingUpdateMany).toHaveBeenCalledTimes(1)
    const trackingCall = mocks.txTrackingUpdateMany.mock.calls[0][0]
    expect(trackingCall.where).toEqual({ id: 'tr-1', status: 'assigned' })
    expect(trackingCall.data.status).toBe('picked_up')
    expect(trackingCall.data.pickedUpAt).toBeInstanceOf(Date)
    // info preslikava (picked_up → picked_up) prav tako CAS z tx-fresh statusom
    const infoCall = mocks.txInfoUpdateMany.mock.calls[0][0]
    expect(infoCall.where).toEqual({ id: 'di-1', status: 'pending' })
    expect(infoCall.data.status).toBe('picked_up')
  })

  it('tx-fresh preverba blokira regresijo: pre-read assigned, tx-fresh delivered → 400 Neveljaven prehod', async () => {
    mocks.txTrackingFindUnique.mockResolvedValue({ ...TRACKING, status: 'delivered' })
    const res = await handleStatusUpdate('di-1', 'picked_up', undefined, undefined, LOC_A)
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringContaining('delivered → picked_up'),
    })
    expect(mocks.txTrackingUpdateMany).not.toHaveBeenCalled()
  })

  it('CAS izgubljena tekma (count 0) → 409 Status dostave je v medčasom spremenjen — osvežite', async () => {
    mocks.txTrackingUpdateMany.mockResolvedValue({ count: 0 })
    const res = await handleStatusUpdate('di-1', 'picked_up', undefined, undefined, LOC_A)
    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toMatchObject({ error: STALE_DELIVERY_STATUS_MESSAGE })
    expect(mocks.txInfoUpdateMany).not.toHaveBeenCalled()
  })

  it('info regresija zaščita: tracking ok, info že delivered → 409 (NI info regresije na picked_up)', async () => {
    mocks.txInfoFindUnique.mockResolvedValue({ id: 'di-1', status: 'delivered' })
    const res = await handleStatusUpdate('di-1', 'picked_up', undefined, undefined, LOC_A)
    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toMatchObject({ error: STALE_DELIVERY_STATUS_MESSAGE })
    expect(mocks.txInfoUpdateMany).not.toHaveBeenCalled()
  })
})

describe('R112 D: WEBHOOK-5 — ročna UI pot (PUT /api/delivery/[id]) CAS kanon', () => {
  it('srečna pot: picked_up → delivered, CAS updateMany { id, status: fresh } + nespremenjen odgovor', async () => {
    mocks.txInfoFindFirst
      .mockResolvedValueOnce({ id: 'di-1', status: 'picked_up', deliveryFee: 2.5, order: { id: 'ord-1' } })
      .mockResolvedValueOnce({ id: 'di-1', status: 'delivered', deliveryFee: 2.5, order: { id: 'ord-1' } })
    const res = await deliveryPUT(jsonPut('http://localhost/api/delivery/di-1', { status: 'delivered' }), { params: Promise.resolve({ id: 'di-1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('delivered')
    expect(body.deliveryFee).toBe(2.5)
    const casCall = mocks.txInfoUpdateMany.mock.calls[0][0]
    expect(casCall.where).toEqual({ id: 'di-1', status: 'picked_up' })
    expect(casCall.data.status).toBe('delivered')
  })

  it('neveljaven prehod delivered → picked_up → 400 z currentStatus/requestedStatus (nespremenjen kontrakt)', async () => {
    mocks.txInfoFindFirst.mockResolvedValue({ id: 'di-1', status: 'delivered', deliveryFee: 2.5, order: { id: 'ord-1' } })
    const res = await deliveryPUT(jsonPut('http://localhost/api/delivery/di-1', { status: 'picked_up' }), { params: Promise.resolve({ id: 'di-1' }) })
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({
      error: 'Neveljaven prehod statusa: delivered → picked_up',
      currentStatus: 'delivered',
      requestedStatus: 'picked_up',
    })
    expect(mocks.txInfoUpdateMany).not.toHaveBeenCalled()
  })

  it('CAS izgubljena tekma (count 0) → 409 Status dostave je v medčasom spremenjen — osvežite', async () => {
    mocks.txInfoUpdateMany.mockResolvedValue({ count: 0 })
    const res = await deliveryPUT(jsonPut('http://localhost/api/delivery/di-1', { status: 'delivered' }), { params: Promise.resolve({ id: 'di-1' }) })
    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toMatchObject({ error: STALE_DELIVERY_STATUS_MESSAGE })
  })

  it('skupna mapa: delivered terminalen, same→same dovoljen, voznikova veriga + failed re-dispatch delujeta', () => {
    expect(DELIVERY_STATUS_TRANSITIONS.delivered).toEqual([])
    expect(canTransitionDeliveryStatus('delivered', 'picked_up')).toBe(false)
    expect(canTransitionDeliveryStatus('delivered', 'delivered')).toBe(true)
    expect(canTransitionDeliveryStatus('assigned', 'picked_up')).toBe(true)
    expect(canTransitionDeliveryStatus('picked_up', 'on_the_way')).toBe(true)
    expect(canTransitionDeliveryStatus('on_the_way', 'arriving')).toBe(true)
    expect(canTransitionDeliveryStatus('arriving', 'delivered')).toBe(true)
    expect(canTransitionDeliveryStatus('pending', 'preparing')).toBe(true)
    expect(canTransitionDeliveryStatus('ready', 'picked_up')).toBe(true)
    expect(canTransitionDeliveryStatus('picked_up', 'failed')).toBe(true)
    expect(canTransitionDeliveryStatus('failed', 'assigned')).toBe(true)
    expect(canTransitionDeliveryStatus('on_the_way', 'picked_up')).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════
// E. fs-pini — vir pini (regresija zaščita)
// ══════════════════════════════════════════════════════════════════
describe('R112 E: fs-pini — kanon pini v viru', () => {
  const boltRouteSrc = readFileSync(join(process.cwd(), 'src/app/api/delivery/webhook/bolt/route.ts'), 'utf-8')
  const boltHelpersSrc = readFileSync(join(process.cwd(), 'src/app/api/delivery/webhook/bolt/_helpers/index.ts'), 'utf-8')
  const woltRouteSrc = readFileSync(join(process.cwd(), 'src/app/api/delivery/webhook/wolt/route.ts'), 'utf-8')
  const woltMappingSrc = readFileSync(join(process.cwd(), 'src/app/api/delivery/webhook/wolt/_helpers/wolt-mapping.ts'), 'utf-8')
  const glovoRouteSrc = readFileSync(join(process.cwd(), 'src/app/api/delivery/webhook/glovo/route.ts'), 'utf-8')
  const glovoMappingSrc = readFileSync(join(process.cwd(), 'src/app/api/delivery/webhook/glovo/_helpers/glovo-mapping.ts'), 'utf-8')
  const statusTransitionsSrc = readFileSync(join(process.cwd(), 'src/app/api/delivery/_helpers/status-transitions.ts'), 'utf-8')
  const trackingActionsSrc = readFileSync(join(process.cwd(), 'src/app/api/delivery-tracking/_helpers/tracking-actions.ts'), 'utf-8')
  const deliveryIdSrc = readFileSync(join(process.cwd(), 'src/app/api/delivery/[id]/route.ts'), 'utf-8')

  it('Bolt: advisory lock + Serializable + scoped menu + P2034/structuredErrorResponse pini; brez fallbacka', () => {
    expect(boltRouteSrc).toContain('pg_advisory_xact_lock')
    expect(boltRouteSrc).toContain('delivery-webhook:')
    expect(boltRouteSrc).toContain('TransactionIsolationLevel.Serializable')
    expect(boltRouteSrc).toContain("'P2034'")
    expect(boltRouteSrc).toContain('category: { menu: { locationId: webhookLocationId } }')
    expect(boltRouteSrc).toContain('structuredErrorResponse')
    // WEBHOOK-4: fallback in wire cena sta ODSTRANJENA
    expect(boltHelpersSrc).not.toContain('menuItems[0]?.id')
    expect(boltHelpersSrc).not.toContain('item.price')
    expect(boltHelpersSrc).toContain('Neznana pozicija')
  })

  it('Wolt: lock + Serializable + P2034 + scoped mapping (MODEL A veriga) pini', () => {
    expect(woltRouteSrc).toContain('pg_advisory_xact_lock')
    expect(woltRouteSrc).toContain('delivery-webhook:')
    expect(woltRouteSrc).toContain('TransactionIsolationLevel.Serializable')
    expect(woltRouteSrc).toContain("'P2034'")
    expect(woltMappingSrc).toContain('category: { menu: { locationId } }')
    expect(woltMappingSrc).toContain('locationId: string')
  })

  it('Glovo: lock + Serializable + P2034 + scoped mapping (MODEL A veriga) pini', () => {
    expect(glovoRouteSrc).toContain('pg_advisory_xact_lock')
    expect(glovoRouteSrc).toContain('delivery-webhook:')
    expect(glovoRouteSrc).toContain('TransactionIsolationLevel.Serializable')
    expect(glovoRouteSrc).toContain("'P2034'")
    expect(glovoMappingSrc).toContain('category: { menu: { locationId } }')
    expect(glovoMappingSrc).toContain('locationId: string')
  })

  it('WEBHOOK-5: skupna mapa prehodov + CAS updateMany + 409 stale pini v obeh writerjih', () => {
    expect(statusTransitionsSrc).toContain('export const DELIVERY_STATUS_TRANSITIONS')
    expect(statusTransitionsSrc).toContain('delivered: [],')
    expect(statusTransitionsSrc).toContain('Status dostave je v medčasom spremenjen — osvežite')
    expect(trackingActionsSrc).toContain('canTransitionDeliveryStatus')
    expect(trackingActionsSrc).toContain('status: fresh.status')
    expect(deliveryIdSrc).toContain('canTransitionDeliveryStatus')
    expect(deliveryIdSrc).toContain('STATUS_CONFLICT')
    expect(deliveryIdSrc).toContain('updateMany(')
  })
})
