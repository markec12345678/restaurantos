// ============================================
// R86-2c2 — COMMS/MISC/REPORTING tenant-scope wave
// ============================================
// REGRESIJA za M2 klaso (R85-FINAL-2): raw spread `session?.locationId
// ?? undefined/null` je fail-OPEN za non-admin seja z NULL locationId
// (session-store/session-lifecycle.ts:114-117 sprejme null za KATEROKOLI
// vlogo — dokazan vektor). Zaprti endpointi (comms/misc domena):
//   webhooks GET/POST, webhooks/[id] PUT/DELETE, webhooks/deliveries GET,
//   notifications GET/POST/PUT, devices POST/DELETE, card-terminal GET,
//   virtual-brands GET/POST, accounting accounts-payable/receivable POST,
//   audit POST, furs GET, furs/batch GET+POST (platformAdminGate),
//   ai/staff-scheduler POST, cis/echo retryGuard.
// ALREADY-SAFE (samo verdikti, brez sprememb): kot (requireKotLocationScope
//   fail-closed), reports/export (explicit 403 gate), card-terminal POST
//   (R81-F gate), devices GET (P0-C2 resolver), audit GET (R81 resolver).
//
// Vzorec: realen tenant-scope resolver + pinanje where-clavzov. null scope
// (super-admin) = PRAZEN filter, NIKOLI { locationId: null }.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  webhookFindMany: vi.fn(),
  webhookFindFirst: vi.fn(),
  webhookCreate: vi.fn(),
  webhookUpdate: vi.fn(),
  webhookDeleteMany: vi.fn(),
  webhookDeliveryFindMany: vi.fn(),
  webhookDeliveryCount: vi.fn(),
  processRetryQueue: vi.fn(),
  auditLogFindMany: vi.fn(),
  auditLogCount: vi.fn(),
  auditLogCreate: vi.fn(),
  createAuditLog: vi.fn(),
  createAuditLogsBatch: vi.fn(),
  deviceRegistryUpdateMany: vi.fn(),
  deviceRegistryFindMany: vi.fn(),
  deviceRegistryUpsert: vi.fn(),
  deviceRegistryDeleteMany: vi.fn(),
  locationFindUnique: vi.fn(),
  virtualBrandFindMany: vi.fn(),
  virtualBrandFindUnique: vi.fn(),
  virtualBrandCreate: vi.fn(),
  counterUpsert: vi.fn(),
  accountsPayableFindMany: vi.fn(),
  accountsPayableCount: vi.fn(),
  accountsPayableCreate: vi.fn(),
  accountsReceivableFindMany: vi.fn(),
  accountsReceivableCount: vi.fn(),
  accountsReceivableCreate: vi.fn(),
  restaurantSettingsFindFirst: vi.fn(),
  receiptCount: vi.fn(),
  receiptFindFirst: vi.fn(),
  receiptFindMany: vi.fn(),
  fetchAndLockUnverifiedReceipts: vi.fn(),
  generateSchedule: vi.fn(),
  getRestaurantInfoForLocation: vi.fn(),
  checkTerminalStatus: vi.fn(),
  checkCisConnectivity: vi.fn(),
  submitReceiptToCis: vi.fn(),
  checkRateLimitAsync: vi.fn(),
  getClientIp: vi.fn(),
}))

// Auth middleware: mock requireAuth, REALNI tenant-scope resolver
vi.mock('@/lib/auth-middleware', async () => {
  const tenantScope = await import('@/lib/auth-middleware/tenant-scope')
  return {
    requireAuth: mocks.requireAuth,
    resolveTenantLocationId: tenantScope.resolveTenantLocationId,
    resolveTenantLocationIdOrThrow: tenantScope.resolveTenantLocationIdOrThrow,
    tenantScopeToWhere: tenantScope.tenantScopeToWhere,
  }
})

vi.mock('@/lib/webhook-engine', () => ({
  processRetryQueue: mocks.processRetryQueue,
}))

vi.mock('@/lib/db', () => ({
  db: {
    webhook: {
      findMany: mocks.webhookFindMany,
      findFirst: mocks.webhookFindFirst,
      create: mocks.webhookCreate,
      update: mocks.webhookUpdate,
      deleteMany: mocks.webhookDeleteMany,
    },
    webhookDelivery: { findMany: mocks.webhookDeliveryFindMany, count: mocks.webhookDeliveryCount },
    auditLog: { findMany: mocks.auditLogFindMany, count: mocks.auditLogCount, create: mocks.auditLogCreate },
    deviceRegistry: {
      updateMany: mocks.deviceRegistryUpdateMany,
      findMany: mocks.deviceRegistryFindMany,
      upsert: mocks.deviceRegistryUpsert,
      deleteMany: mocks.deviceRegistryDeleteMany,
    },
    location: { findUnique: mocks.locationFindUnique },
    virtualBrand: { findMany: mocks.virtualBrandFindMany, findUnique: mocks.virtualBrandFindUnique, create: mocks.virtualBrandCreate },
    counter: { upsert: mocks.counterUpsert },
    accountsPayable: { findMany: mocks.accountsPayableFindMany, count: mocks.accountsPayableCount, create: mocks.accountsPayableCreate },
    accountsReceivable: { findMany: mocks.accountsReceivableFindMany, count: mocks.accountsReceivableCount, create: mocks.accountsReceivableCreate },
    restaurantSettings: { findFirst: mocks.restaurantSettingsFindFirst },
    receipt: { count: mocks.receiptCount, findFirst: mocks.receiptFindFirst, findMany: mocks.receiptFindMany, update: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
  },
  // createAuditLog je TOP-LEVEL export iz '@/lib/db' (ne lastnost db klienta)
  createAuditLog: mocks.createAuditLog,
  createAuditLogsBatch: mocks.createAuditLogsBatch,
}))

vi.mock('@/lib/furs/config-resolver', () => ({
  getRestaurantInfoForLocation: mocks.getRestaurantInfoForLocation,
}))

vi.mock('@/app/api/card-terminal/_helpers', () => ({
  getTerminalConfig: vi.fn(() => ({ provider: 'test', ipAddress: '1.2.3.4', port: 1, terminalId: 'T1' })),
  checkTerminalStatus: mocks.checkTerminalStatus,
  processTerminalPayment: vi.fn(),
}))

vi.mock('@/lib/furs', () => ({
  validateFursConfig: vi.fn(() => ({ valid: true, errors: [], warnings: [] })),
  checkFursConnectivity: vi.fn(async () => ({ reachable: true, responseTime: 5 })),
  loadCertificatePrivateKey: vi.fn(),
}))

vi.mock('@/app/api/furs/helpers/build-config', () => ({
  buildFursConfigFromSettings: vi.fn(() => ({ environment: 'test' })),
}))

vi.mock('@/app/api/furs/batch/_helpers', () => ({
  buildFursConfig: vi.fn(() => ({})),
  fetchAndLockUnverifiedReceipts: mocks.fetchAndLockUnverifiedReceipts,
  processBatchReceipt: vi.fn(),
}))

vi.mock('@/lib/scheduler/generate', () => ({
  generateSchedule: mocks.generateSchedule,
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.checkRateLimitAsync,
  getClientIp: mocks.getClientIp,
  AUTHENTICATED_LIMIT: 10,
  CIS_BATCH_RETRY_LIMIT: 10,
}))

vi.mock('@/lib/cis', () => ({
  checkCisConnectivity: mocks.checkCisConnectivity,
  submitReceiptToCis: mocks.submitReceiptToCis,
}))

import { GET as webhooksGET, POST as webhooksPOST } from '@/app/api/webhooks/route'
import { PUT as webhookPUT, DELETE as webhookDELETE } from '@/app/api/webhooks/[id]/route'
import { GET as deliveriesGET } from '@/app/api/webhooks/deliveries/route'
import { GET as notificationsGET, POST as notificationsPOST, PUT as notificationsPUT } from '@/app/api/notifications/route'
import { POST as devicesPOST, DELETE as devicesDELETE } from '@/app/api/devices/route'
import { GET as cardTerminalGET } from '@/app/api/card-terminal/route'
import { POST as virtualBrandsPOST } from '@/app/api/virtual-brands/route'
import { POST as accountsPayablePOST } from '@/app/api/accounting/accounts-payable/route'
import { POST as auditPOST } from '@/app/api/audit/route'
import { GET as fursGET } from '@/app/api/furs/route'
import { POST as fursBatchPOST } from '@/app/api/furs/batch/route'
import { POST as staffSchedulerPOST } from '@/app/api/ai/staff-scheduler/route'
import { GET as cisEchoGET, POST as cisEchoPOST } from '@/app/api/cis/echo/route'

// Utišaj logger
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

const LOC_A = 'loc-tenant-a'
const LOC_B = 'loc-tenant-b'

function mockSession(overrides: Record<string, unknown> = {}) {
  mocks.requireAuth.mockResolvedValue({
    session: { employeeId: 'emp-1', role: 'admin', locationId: LOC_A, permissions: ['admin'], ...overrides },
    error: null,
  })
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.webhookFindMany.mockResolvedValue([])
  mocks.webhookFindFirst.mockResolvedValue(null)
  mocks.webhookCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'wh-1', ...data }))
  mocks.webhookUpdate.mockResolvedValue({ id: 'wh-1' })
  mocks.webhookDeleteMany.mockResolvedValue({ count: 0 })
  mocks.webhookDeliveryFindMany.mockResolvedValue([])
  mocks.webhookDeliveryCount.mockResolvedValue(0)
  mocks.auditLogFindMany.mockResolvedValue([])
  mocks.auditLogCount.mockResolvedValue(0)
  mocks.auditLogCreate.mockResolvedValue({ id: 'al-1' })
  mocks.createAuditLog.mockResolvedValue(undefined)
  mocks.createAuditLogsBatch.mockResolvedValue(undefined)
  mocks.deviceRegistryUpdateMany.mockResolvedValue({ count: 0 })
  mocks.deviceRegistryFindMany.mockResolvedValue([])
  mocks.deviceRegistryUpsert.mockResolvedValue({ id: 'dev-1' })
  mocks.deviceRegistryDeleteMany.mockResolvedValue({ count: 0 })
  mocks.locationFindUnique.mockResolvedValue({ id: LOC_B, isActive: true })
  mocks.virtualBrandFindMany.mockResolvedValue([])
  mocks.virtualBrandFindUnique.mockResolvedValue(null)
  mocks.virtualBrandCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'vb-1', ...data }))
  mocks.counterUpsert.mockResolvedValue({ value: 1 })
  mocks.accountsPayableCreate.mockResolvedValue({ id: 'ap-1' })
  mocks.accountsReceivableCreate.mockResolvedValue({ id: 'ar-1' })
  mocks.restaurantSettingsFindFirst.mockResolvedValue({ id: 'set-1', businessId: 'B', taxId: 'T', registerNumber: 'R', fursCertPath: 'p', fursCertPassword: 'pw', fursEnvironment: 'test' })
  mocks.receiptCount.mockResolvedValue(0)
  mocks.receiptFindFirst.mockResolvedValue(null)
  mocks.receiptFindMany.mockResolvedValue([])
  mocks.fetchAndLockUnverifiedReceipts.mockResolvedValue([])
  mocks.generateSchedule.mockResolvedValue({ generated: true, coverage: [], insights: [] })
  mocks.getRestaurantInfoForLocation.mockResolvedValue({ name: 'X', businessId: 'B', registerNumber: 'R', taxId: 'SI1' })
  mocks.checkTerminalStatus.mockResolvedValue({ connected: true, responseTime: 1 })
  mocks.checkCisConnectivity.mockResolvedValue({ ok: true })
  mocks.submitReceiptToCis.mockResolvedValue({ ok: true, jir: 'JIR-1' })
  mocks.checkRateLimitAsync.mockResolvedValue({ allowed: true, remaining: 9 })
  mocks.getClientIp.mockReturnValue('127.0.0.1')
  delete process.env.DEVICE_API_KEY
})

// ══════════════════════════════════════════════════════════════════
// A. WEBHOOKS (GET/POST + [id] PUT/DELETE + deliveries GET)
// ══════════════════════════════════════════════════════════════════
describe('R86-2c2 A: webhooks — tenant scope', () => {
  it('GET: regular user brez lokacije → 403, NI poizvedb', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await webhooksGET(new Request('http://localhost:3000/api/webhooks'))
    expect(res.status).toBe(403)
    expect(mocks.webhookFindMany).not.toHaveBeenCalled()
  })

  it('GET: loc-bound admin → where.locationId pin', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    await webhooksGET(new Request('http://localhost:3000/api/webhooks'))
    expect(mocks.webhookFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('POST: regular user brez lokacije → 403, NI create (prej: globalni webhook = dogodki vseh tenantov)', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await webhooksPOST(new Request('http://localhost:3000/api/webhooks', {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ name: 'H', url: 'https://x.example/hook' }),
    }))
    expect(res.status).toBe(403)
    expect(mocks.webhookCreate).not.toHaveBeenCalled()
  })

  it('POST: loc-bound admin → webhook žigosan na session lokacijo', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await webhooksPOST(new Request('http://localhost:3000/api/webhooks', {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ name: 'H', url: 'https://x.example/hook', locationId: LOC_B }),
    }))
    expect(res.status).toBe(201)
    expect(mocks.webhookCreate.mock.calls[0][0].data.locationId).toBe(LOC_A)
  })

  it('[id] PUT: regular user brez lokacije → 403, NI findFirst (prej: prazen filter = update tujega webhooka)', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await webhookPUT(new Request('http://localhost:3000/api/webhooks/wh-9', {
      method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ name: 'X' }),
    }), { params: Promise.resolve({ id: 'wh-9' }) })
    expect(res.status).toBe(403)
    expect(mocks.webhookFindFirst).not.toHaveBeenCalled()
    expect(mocks.webhookUpdate).not.toHaveBeenCalled()
  })

  it('[id] PUT: tuji webhook (loka B) → 404, update NE izvede (brez existence oracle-a)', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await webhookPUT(new Request('http://localhost:3000/api/webhooks/wh-b', {
      method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ name: 'X' }),
    }), { params: Promise.resolve({ id: 'wh-b' }) })
    expect(res.status).toBe(404)
    expect(mocks.webhookFindFirst).toHaveBeenCalledWith({
      where: { id: 'wh-b', locationId: LOC_A },
    })
    expect(mocks.webhookUpdate).not.toHaveBeenCalled()
  })

  it('[id] DELETE: deleteMany where pin { id, locationId }, count 0 → 404', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await webhookDELETE(new Request('http://localhost:3000/api/webhooks/wh-b', { method: 'DELETE' }), { params: Promise.resolve({ id: 'wh-b' }) })
    expect(res.status).toBe(404)
    expect(mocks.webhookDeleteMany).toHaveBeenCalledWith({
      where: { id: 'wh-b', locationId: LOC_A },
    })
  })

  it('deliveries GET: regular user brez lokacije → 403, NI poizvedb (prej: payload VSEH tenantov)', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await deliveriesGET(new Request('http://localhost:3000/api/webhooks/deliveries'))
    expect(res.status).toBe(403)
    expect(mocks.webhookDeliveryFindMany).not.toHaveBeenCalled()
    expect(mocks.webhookDeliveryCount).not.toHaveBeenCalled()
  })

  it('deliveries GET: loc-bound admin → where.webhook.locationId pin', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    await deliveriesGET(new Request('http://localhost:3000/api/webhooks/deliveries'))
    expect(mocks.webhookDeliveryFindMany.mock.calls[0][0].where.webhook).toEqual({ locationId: LOC_A })
  })
})

// ══════════════════════════════════════════════════════════════════
// B. NOTIFICATIONS (GET + POST NULL-žig + PUT batch)
// ══════════════════════════════════════════════════════════════════
describe('R86-2c2 B: notifications — tenant scope + NULL-žig', () => {
  it('GET: regular user brez lokacije → 403, NI poizvedb', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await notificationsGET(new Request('http://localhost:3000/api/notifications'))
    expect(res.status).toBe(403)
    expect(mocks.auditLogFindMany).not.toHaveBeenCalled()
    expect(mocks.auditLogCount).not.toHaveBeenCalled()
  })

  it('POST: regular user brez lokacije → 403, NI audit zapisa (prej: NULL žig)', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await notificationsPOST(new Request('http://localhost:3000/api/notifications', {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ channel: 'sms', recipient: '040123456', message: 'pozdrav' }),
    }))
    expect(res.status).toBe(403)
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })

  it('POST: staff z lokacijo → žig LOC_A (shema nima locationId — body ne more prepisati)', async () => {
    mockSession({ role: 'manager', locationId: LOC_A, permissions: ['take_orders'] })
    const res = await notificationsPOST(new Request('http://localhost:3000/api/notifications', {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ channel: 'sms', recipient: '040123456', message: 'pozdrav' }),
    }))
    expect(res.status).toBe(200)
    expect(mocks.createAuditLog.mock.calls[0][0].locationId).toBe(LOC_A)
  })

  it('POST: super-admin brez lokacije → NULL žig = legacy globalni vnos (R85-4a waitlist vzorec)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    const res = await notificationsPOST(new Request('http://localhost:3000/api/notifications', {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ channel: 'email', recipient: 'a@b.c', message: 'x' }),
    }))
    expect(res.status).toBe(200)
    expect(mocks.createAuditLog.mock.calls[0][0].locationId).toBeNull()
  })

  it('PUT batch: staff z lokacijo → vsi batch vnosi žigosani LOC_A', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await notificationsPUT(new Request('http://localhost:3000/api/notifications', {
      method: 'PUT', headers: JSON_HEADERS,
      body: JSON.stringify({ notifications: [{ channel: 'sms', recipient: '040', message: 'm' }] }),
    }))
    expect(res.status).toBe(200)
    const entries = mocks.createAuditLogsBatch.mock.calls[0][0]
    expect(entries).toHaveLength(1)
    expect(entries[0].locationId).toBe(LOC_A)
  })
})

// ══════════════════════════════════════════════════════════════════
// C. DEVICES (POST + DELETE) + CARD-TERMINAL GET
// ══════════════════════════════════════════════════════════════════
describe('R86-2c2 C: devices + card-terminal — tenant scope', () => {
  it('devices POST: regular user brez lokacije + body locationId B → 403, NI upsert (prej: prevzem tuje naprave)', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await devicesPOST(new Request('http://localhost:3000/api/devices', {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ deviceId: 'dev-b', name: 'TUJA', type: 'pos', locationId: LOC_B }),
    }))
    expect(res.status).toBe(403)
    expect(mocks.deviceRegistryUpsert).not.toHaveBeenCalled()
    expect(mocks.locationFindUnique).not.toHaveBeenCalled()
  })

  it('devices POST: admin z lokacijo A + body locationId B → upsert pod A (session zmagovalec)', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await devicesPOST(new Request('http://localhost:3000/api/devices', {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ deviceId: 'dev-1', name: 'POS', type: 'pos', locationId: LOC_B }),
    }))
    expect(res.status).toBe(200)
    const upsertCall = mocks.deviceRegistryUpsert.mock.calls[0][0]
    expect(upsertCall.create.locationId).toBe(LOC_A)
    expect(upsertCall.update.locationId).toBe(LOC_A)
    expect(mocks.locationFindUnique).not.toHaveBeenCalled()
  })

  it('devices DELETE: admin z lokacijo A → deleteMany where { id, locationId: A }, count 0 → 404', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await devicesDELETE(new Request(`http://localhost:3000/api/devices?id=dev-b`, { method: 'DELETE' }))
    expect(res.status).toBe(404)
    expect(mocks.deviceRegistryDeleteMany).toHaveBeenCalledWith({
      where: { id: 'dev-b', locationId: LOC_A },
    })
  })

  it('card-terminal GET: regular user brez lokacije → 403, NI config poizvedbe (prej: globalni RestaurantSettings fallback)', async () => {
    mockSession({ role: 'waiter', locationId: null, permissions: ['take_orders'] })
    const res = await cardTerminalGET(new Request('http://localhost:3000/api/card-terminal'))
    expect(res.status).toBe(403)
    expect(mocks.getRestaurantInfoForLocation).not.toHaveBeenCalled()
  })

  it('card-terminal GET: staff z lokacijo → config vezan na session lokacijo', async () => {
    mockSession({ role: 'waiter', locationId: LOC_A, permissions: ['take_orders'] })
    const res = await cardTerminalGET(new Request('http://localhost:3000/api/card-terminal'))
    expect(res.status).toBe(200)
    expect(mocks.getRestaurantInfoForLocation).toHaveBeenCalledWith(LOC_A)
  })
})

// ══════════════════════════════════════════════════════════════════
// D. VIRTUAL BRANDS (POST) + ACCOUNTING AP (POST)
// ══════════════════════════════════════════════════════════════════
describe('R86-2c2 D: virtual-brands + accounts-payable — write žig', () => {
  it('virtual-brands POST: regular user brez lokacije + body locationId B → 403, NI create', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await virtualBrandsPOST(new Request('http://localhost:3000/api/virtual-brands', {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ name: 'Znamka', code: 'ZB', locationId: LOC_B }),
    }))
    expect(res.status).toBe(403)
    expect(mocks.virtualBrandCreate).not.toHaveBeenCalled()
  })

  it('virtual-brands POST: admin z lokacijo A + body B → create pod A (body strip)', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await virtualBrandsPOST(new Request('http://localhost:3000/api/virtual-brands', {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ name: 'Znamka', code: 'ZB', locationId: LOC_B }),
    }))
    expect(res.status).toBe(201)
    expect(mocks.virtualBrandCreate.mock.calls[0][0].data.locationId).toBe(LOC_A)
  })

  it('virtual-brands POST: super-admin z izrecnim body locationId → žigosan B (nullable-by-design)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    const res = await virtualBrandsPOST(new Request('http://localhost:3000/api/virtual-brands', {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ name: 'Znamka', code: 'ZB', locationId: LOC_B }),
    }))
    expect(res.status).toBe(201)
    expect(mocks.virtualBrandCreate.mock.calls[0][0].data.locationId).toBe(LOC_B)
  })

  it('AP POST: regular user brez lokacije → 403, NI counter/create (prej: NULL žig obveznosti)', async () => {
    mockSession({ role: 'manager', locationId: null, permissions: ['manage_accounting'] })
    const res = await accountsPayablePOST(new Request('http://localhost:3000/api/accounting/accounts-payable', {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ supplierId: 'sup-1', dueDate: '2026-03-01', subtotal: 100, totalAmount: 122, locationId: LOC_B }),
    }))
    expect(res.status).toBe(403)
    expect(mocks.counterUpsert).not.toHaveBeenCalled()
    expect(mocks.accountsPayableCreate).not.toHaveBeenCalled()
  })

  it('AP POST: manager z lokacijo A + body B → create pod A (session avtoritativen)', async () => {
    mockSession({ role: 'manager', locationId: LOC_A, permissions: ['manage_accounting'] })
    const res = await accountsPayablePOST(new Request('http://localhost:3000/api/accounting/accounts-payable', {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ supplierId: 'sup-1', dueDate: '2026-03-01', subtotal: 100, totalAmount: 122, locationId: LOC_B }),
    }))
    expect(res.status).toBe(201)
    expect(mocks.accountsPayableCreate.mock.calls[0][0].data.locationId).toBe(LOC_A)
  })

  it('AP POST: super-admin brez body locationId → 400 fail-closed, NI create (vzorec R85-FINAL expenses)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    const res = await accountsPayablePOST(new Request('http://localhost:3000/api/accounting/accounts-payable', {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ supplierId: 'sup-1', dueDate: '2026-03-01', subtotal: 100, totalAmount: 122 }),
    }))
    expect(res.status).toBe(400)
    expect(mocks.accountsPayableCreate).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// E. AUDIT POST + FURS GET/BATCH + STAFF-SCHEDULER + CIS ECHO
// ══════════════════════════════════════════════════════════════════
describe('R86-2c2 E: audit / furs / scheduler / cis — tenant scope', () => {
  it('audit POST: regular user brez lokacije → 403, NI ročnega revizijskega vnosa', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await auditPOST(new Request('http://localhost:3000/api/audit', {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ action: 'MANUAL_AUDIT_NOTE', entityType: 'Order', entityId: 'ord-1' }),
    }))
    expect(res.status).toBe(403)
    expect(mocks.auditLogCreate).not.toHaveBeenCalled()
  })

  it('audit POST: admin z lokacijo → vnos pripada lokaciji seje', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await auditPOST(new Request('http://localhost:3000/api/audit', {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ action: 'MANUAL_AUDIT_NOTE', entityType: 'Order', entityId: 'ord-1' }),
    }))
    expect(res.status).toBe(201)
    expect(mocks.auditLogCreate.mock.calls[0][0].data.locationId).toBe(LOC_A)
  })

  it('furs GET: regular user brez lokacije → 403, NI receipt.count (prej: globalni count)', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await fursGET(new Request('http://localhost:3000/api/furs'))
    expect(res.status).toBe(403)
    expect(mocks.receiptCount).not.toHaveBeenCalled()
  })

  it('furs GET: admin z lokacijo → count scoped na lokacijo', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    await fursGET(new Request('http://localhost:3000/api/furs'))
    expect(mocks.receiptCount.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('furs/batch POST: lokacijski admin → 403 platformAdminGate, NI settings/db dostopa', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await fursBatchPOST(new Request('http://localhost:3000/api/furs/batch', { method: 'POST' }))
    expect(res.status).toBe(403)
    expect(mocks.restaurantSettingsFindFirst).not.toHaveBeenCalled()
    expect(mocks.fetchAndLockUnverifiedReceipts).not.toHaveBeenCalled()
  })

  it('furs/batch POST: platformni admin (brez lokacije) → operacija poteka', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    const res = await fursBatchPOST(new Request('http://localhost:3000/api/furs/batch', { method: 'POST' }))
    expect(res.status).toBe(200)
    expect(mocks.fetchAndLockUnverifiedReceipts).toHaveBeenCalled()
  })

  it('staff-scheduler POST: manager brez lokacije → 403, NI generateSchedule (prej: GLOBALNI razpored)', async () => {
    mockSession({ role: 'manager', locationId: null, permissions: ['manage_employees'] })
    const res = await staffSchedulerPOST(new Request('http://localhost:3000/api/ai/staff-scheduler', {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ startDate: '2026-03-02', days: 7, apply: true }),
    }))
    expect(res.status).toBe(403)
    expect(mocks.generateSchedule).not.toHaveBeenCalled()
  })

  it('staff-scheduler POST: manager z lokacijo A + body B → scope A je avtoritativen', async () => {
    mockSession({ role: 'manager', locationId: LOC_A, permissions: ['manage_employees'] })
    await staffSchedulerPOST(new Request('http://localhost:3000/api/ai/staff-scheduler', {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ startDate: '2026-03-02', days: 7, locationId: LOC_B }),
    }))
    expect(mocks.generateSchedule.mock.calls[0][0].locationId).toBe(LOC_A)
  })

  it('cis/echo POST retry: regular user brez lokacije → 403, NI receipt poizvedbe (prej: oddaja TUJIH računov na CIS)', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await cisEchoPOST(new Request('http://localhost:3000/api/cis/echo', {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ action: 'retry-pending', limit: 3 }),
    }))
    expect(res.status).toBe(403)
    expect(mocks.receiptFindMany).not.toHaveBeenCalled()
    expect(mocks.submitReceiptToCis).not.toHaveBeenCalled()
  })

  it('cis/echo POST retry: admin z lokacijo → findMany scoped na lokacijo', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await cisEchoPOST(new Request('http://localhost:3000/api/cis/echo', {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ action: 'retry-pending', limit: 3 }),
    }))
    expect(res.status).toBe(200)
    expect(mocks.receiptFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('cis/echo GET ?resource=pending: admin z lokacijo → števci scoped', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await cisEchoGET(new Request('http://localhost:3000/api/cis/echo?resource=pending'))
    expect(res.status).toBe(200)
    expect(mocks.receiptCount.mock.calls[0][0].where.locationId).toBe(LOC_A)
    expect(mocks.receiptCount.mock.calls[1][0].where.locationId).toBe(LOC_A)
  })
})
