// ============================================
// R82-F — Maintenance endpoints sweep — fix wave regression tests
// ============================================
// R82-F read-only sweep (216 auth-gated datotek) odkril 5 LEAK-HIGH +
// 2 PLATFORM-GATE-NEEDS + 2 cron fail-open buga + webhooks/deliveries
// cross-tenant payload. Ta test fajl zaklene popravke:
//   1. end-of-day GET/POST — lokacijski scope (prej globalni agregati +
//      raw body.locationId = zapiranje TUJE izmene)
//   2. menu-items/bulk-vat — updateMany scoped (prej DDV sprememba čez
//      VSE tenante)
//   3. tables/qr-batch — QR URL-ji samo lastne lokacije
//   4. opening-hours batch POST + [id] PATCH/DELETE — body strip + scope
//      guard (prej deleteMany+recreate tuje lokacije, bare update/delete)
//   5. reports/export — izvoz scoped (prej PII vseh tenantov)
//   6. receipts/regenerate + accounting/journal/regenerate +
//      webhooks/deliveries POST — platformAdminGate
//   7. cron/data-retention + cron/outbox — fail-open guard bug
//      (brez CRON_SECRET = anonimni dostop) → fail-closed
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  eodCloseShift: vi.fn(),
  eodFetch: vi.fn(),
  eodUpsertZ: vi.fn(),
  menuItemUpdateMany: vi.fn(),
  tableFindMany: vi.fn(),
  openingHoursDeleteMany: vi.fn(),
  openingHoursCreateMany: vi.fn(),
  openingHoursCreate: vi.fn(),
  openingHoursFindUnique: vi.fn(),
  openingHoursUpdate: vi.fn(),
  openingHoursDelete: vi.fn(),
  orderFindMany: vi.fn(),
  employeeFindMany: vi.fn(),
  cashRegisterShiftFindMany: vi.fn(),
  inventoryItemFindMany: vi.fn(),
  receiptFindMany: vi.fn(),
  paymentFindMany: vi.fn(),
  webhookDeliveryFindMany: vi.fn(),
  webhookDeliveryCount: vi.fn(),
  processRetryQueue: vi.fn(),
  // R92-a: rate-limit mock (webhooks/deliveries POST zdaj troši vedro)
  rateLimitCheck: vi.fn(),
  getClientIp: vi.fn(),
}))

vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: mocks.requireAuth,
}))

// R92-a: rate-limit modul mockan — webhooks/deliveries POST zdaj kliče
// checkRateLimitAsync (fiksni ključ 'webhooks-deliveries-retry'). Privzeto
// dovoljeno → obstoječi testi ostanejo deterministični (realen fail-closed
// modul bi bil nedeterminističen).
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.rateLimitCheck,
  getClientIp: mocks.getClientIp,
  AUTHENTICATED_LIMIT: { maxRequests: 120, windowMs: 60000 },
}))

vi.mock('@/lib/db', () => ({
  db: {
    menuItem: { updateMany: mocks.menuItemUpdateMany },
    table: { findMany: mocks.tableFindMany },
    openingHours: {
      deleteMany: mocks.openingHoursDeleteMany,
      createMany: mocks.openingHoursCreateMany,
      create: mocks.openingHoursCreate,
      findUnique: mocks.openingHoursFindUnique,
      update: mocks.openingHoursUpdate,
      delete: mocks.openingHoursDelete,
    },
    order: { findMany: mocks.orderFindMany },
    employee: { findMany: mocks.employeeFindMany },
    cashRegisterShift: { findMany: mocks.cashRegisterShiftFindMany, findFirst: vi.fn() },
    inventoryItem: { findMany: mocks.inventoryItemFindMany },
    receipt: { findMany: mocks.receiptFindMany, update: vi.fn() },
    payment: { findMany: mocks.paymentFindMany },
    webhookDelivery: { findMany: mocks.webhookDeliveryFindMany, count: mocks.webhookDeliveryCount },
    auditLog: { findMany: vi.fn(), findFirst: vi.fn(), groupBy: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: object) => unknown) => fn({})),
  },
  createAuditLog: vi.fn(),
}))

// EOD helperji — mockani (scope testiramo na meji route↔helper)
vi.mock('@/app/api/end-of-day/_helpers', () => ({
  fetchEodData: mocks.eodFetch,
  computeEodMetrics: vi.fn(() => ({
    eodCompleted: false, totalOrders: 0, completedOrders: [], totalRevenue: 0,
    avgOrderValue: 0, paymentsByMethod: {}, totalTips: 0, vatBreakdown: [],
    fursVerified: 0, fursQueued: 0, fursFailed: 0, totalReservations: 0,
    confirmedReservations: 0, noShowReservations: 0, totalExpenses: 0,
    netProfit: 0, topItems: [],
  })),
  closeShift: mocks.eodCloseShift,
}))

vi.mock('@/app/api/z-report/_helpers', () => ({
  upsertZReportForDay: mocks.eodUpsertZ,
}))

vi.mock('@/lib/webhook-engine', () => ({
  processRetryQueue: mocks.processRetryQueue,
}))

import { GET as eodGET, POST as eodPOST } from '@/app/api/end-of-day/route'
import { POST as bulkVatPOST } from '@/app/api/menu-items/bulk-vat/route'
import { GET as qrBatchGET } from '@/app/api/tables/qr-batch/route'
import { POST as openingHoursPOST } from '@/app/api/opening-hours/route'
import { PATCH as openingHoursPATCH, DELETE as openingHoursDELETE } from '@/app/api/opening-hours/[id]/route'
import { GET as exportGET } from '@/app/api/reports/export/route'
import { POST as receiptsRegenPOST } from '@/app/api/receipts/regenerate/route'
import { POST as journalRegenPOST } from '@/app/api/accounting/journal/regenerate/route'
import { GET as deliveriesGET, POST as deliveriesPOST } from '@/app/api/webhooks/deliveries/route'
import { POST as dataRetentionPOST } from '@/app/api/cron/data-retention/route'
import { POST as outboxPOST } from '@/app/api/cron/outbox/route'

function mockAuth(locationId: string | null, role = 'admin') {
  mocks.requireAuth.mockResolvedValue({
    session: { employeeId: 'emp-1', role, locationId, permissions: ['admin'] },
    error: null,
  })
}

function authError() {
  mocks.requireAuth.mockResolvedValue({ session: null, error: { status: 401 } as never })
}

beforeEach(() => {
  vi.clearAllMocks()
  // R92-a: privzeto dovoljen rate limit — deliveries POST test nadaljuje do
  // platformAdminGate (403) kot prej.
  mocks.rateLimitCheck.mockResolvedValue({ allowed: true, remaining: 5 })
  mocks.getClientIp.mockReturnValue('198.51.100.77')
  mocks.eodFetch.mockResolvedValue({
    orders: [], cancelledOrdersCount: 0, periodPayments: [], activeShift: null,
    fursStats: [], reservationStats: [], newGuestsCount: 0, expenseEntries: [], existingEOD: null,
  })
  mocks.eodUpsertZ.mockResolvedValue(undefined)
})

// ============================================
// 1) end-of-day — lokacijski scope
// ============================================
describe('R82-F: end-of-day scope', () => {
  it('GET: staff brez lokacije → 403, fetch NI klican', async () => {
    mockAuth(null, 'staff')

    const res = await eodGET(new Request('http://localhost:3000/api/end-of-day'))

    expect(res.status).toBe(403)
    expect(mocks.eodFetch).not.toHaveBeenCalled()
  })

  it('GET: lokacijski staff → fetchEodData prejme session lokacijo', async () => {
    mockAuth('loc-1', 'staff')

    await eodGET(new Request('http://localhost:3000/api/end-of-day'))

    expect(mocks.eodFetch).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'loc-1')
  })

  it('GET: super-admin (brez lokacije) → global fetch (null scope)', async () => {
    mockAuth(null, 'super_admin')

    await eodGET(new Request('http://localhost:3000/api/end-of-day'))

    expect(mocks.eodFetch).toHaveBeenCalledWith(expect.anything(), expect.anything(), null)
  })

  it('POST: lokacijski admin + TUJ body.locationId → closeShift dobi SESSION lokacijo (strip)', async () => {
    mockAuth('loc-1')
    mocks.eodCloseShift.mockResolvedValue(null)

    const req = new Request('http://localhost:3000/api/end-of-day', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ date: '2026-01-15', actualCash: 100, locationId: 'loc-foreign' }),
    })
    const res = await eodPOST(req)

    expect(res.status).toBe(200)
    expect(mocks.eodCloseShift).toHaveBeenCalledWith(
      '2026-01-15', 100, '', 'loc-1', 'emp-1',
    )
  })

  it('POST: super-admin sme izrecen body.locationId', async () => {
    mockAuth(null, 'super_admin')
    mocks.eodCloseShift.mockResolvedValue(null)

    const req = new Request('http://localhost:3000/api/end-of-day', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ date: '2026-01-15', actualCash: 100, locationId: 'loc-9' }),
    })
    await eodPOST(req)

    expect(mocks.eodCloseShift).toHaveBeenCalledWith(
      '2026-01-15', 100, '', 'loc-9', 'emp-1',
    )
  })
})

// ============================================
// 2) menu-items/bulk-vat — masovni updateMany scope
// ============================================
describe('R82-F: menu-items/bulk-vat scope', () => {
  it('staff brez lokacije → 403, updateMany NI klican', async () => {
    mockAuth(null, 'manager')

    const res = await bulkVatPOST(new Request('http://localhost:3000/api/menu-items/bulk-vat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fromRate: 22, toRate: 9.5 }),
    }))

    expect(res.status).toBe(403)
    expect(mocks.menuItemUpdateMany).not.toHaveBeenCalled()
  })

  it('lokacijski admin → updateMany scoped na category.menu.locationId', async () => {
    mockAuth('loc-1')
    mocks.menuItemUpdateMany.mockResolvedValue({ count: 3 })

    const res = await bulkVatPOST(new Request('http://localhost:3000/api/menu-items/bulk-vat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fromRate: 22, toRate: 9.5 }),
    }))

    expect(res.status).toBe(200)
    expect(mocks.menuItemUpdateMany).toHaveBeenCalledWith({
      where: {
        vatRate: 22,
        category: { menu: { locationId: 'loc-1' } },
      },
      data: { vatRate: 9.5 },
    })
  })

  it('super-admin → global updateMany (brez lokacijskega filtra)', async () => {
    mockAuth(null, 'super_admin')
    mocks.menuItemUpdateMany.mockResolvedValue({ count: 10 })

    await bulkVatPOST(new Request('http://localhost:3000/api/menu-items/bulk-vat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fromRate: 22, toRate: 9.5 }),
    }))

    const where = mocks.menuItemUpdateMany.mock.calls[0][0].where
    expect(where.category).toBeUndefined()
  })
})

// ============================================
// 3) tables/qr-batch — QR URL-ji lastne lokacije
// ============================================
describe('R82-F: tables/qr-batch scope', () => {
  it('staff brez lokacije → 403', async () => {
    mockAuth(null, 'staff')

    const res = await qrBatchGET(new Request('http://localhost:3000/api/tables/qr-batch'))

    expect(res.status).toBe(403)
    expect(mocks.tableFindMany).not.toHaveBeenCalled()
  })

  it('lokacijski staff → findMany scoped na svojo lokacijo', async () => {
    mockAuth('loc-1', 'staff')
    mocks.tableFindMany.mockResolvedValue([])

    const res = await qrBatchGET(new Request('http://localhost:3000/api/tables/qr-batch'))

    expect(res.status).toBe(200)
    expect(mocks.tableFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { not: 'out-of-service' }, locationId: 'loc-1' },
      }),
    )
  })

  it('super-admin → global (pogojni spread — nikoli { locationId: null })', async () => {
    mockAuth(null, 'super_admin')
    mocks.tableFindMany.mockResolvedValue([])

    await qrBatchGET(new Request('http://localhost:3000/api/tables/qr-batch'))

    const where = mocks.tableFindMany.mock.calls[0][0].where
    expect(where.locationId).toBeUndefined()
  })
})

// ============================================
// 4) opening-hours — batch strip + [id] scope guard
// ============================================
describe('R82-F: opening-hours scope', () => {
  it('batch POST: lokacijski admin + tuji body.locationId → deleteMany na SESSION lokaciji', async () => {
    mockAuth('loc-1')
    mocks.openingHoursDeleteMany.mockResolvedValue({ count: 0 })
    mocks.openingHoursCreateMany.mockResolvedValue({ count: 7 })

    const req = new Request('http://localhost:3000/api/opening-hours', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        locationId: 'loc-foreign',
        hours: [{ dayOfWeek: 1, openTime: '08:00', closeTime: '22:00' }],
      }),
    })
    const res = await openingHoursPOST(req)

    expect(res.status).toBe(201)
    expect(mocks.openingHoursDeleteMany).toHaveBeenCalledWith({ where: { locationId: 'loc-1' } })
  })

  it('PATCH [id]: tuj zapis → 404, update NI klican', async () => {
    mockAuth('loc-1')
    mocks.openingHoursFindUnique.mockResolvedValue({ id: 'oh-1', locationId: 'loc-2' })

    const req = new Request('http://localhost:3000/api/opening-hours/oh-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ openTime: '09:00' }),
    })
    const res = await openingHoursPATCH(req, { params: Promise.resolve({ id: 'oh-1' }) })

    expect(res.status).toBe(404)
    expect(mocks.openingHoursUpdate).not.toHaveBeenCalled()
  })

  it('DELETE [id]: lasten zapis → 200', async () => {
    mockAuth('loc-1')
    mocks.openingHoursFindUnique.mockResolvedValue({ id: 'oh-1', locationId: 'loc-1' })
    mocks.openingHoursDelete.mockResolvedValue({ id: 'oh-1' })

    const res = await openingHoursDELETE(new Request('http://localhost:3000/api/opening-hours/oh-1', { method: 'DELETE' }), { params: Promise.resolve({ id: 'oh-1' }) })

    expect(res.status).toBe(200)
    expect(mocks.openingHoursDelete).toHaveBeenCalledWith({ where: { id: 'oh-1' } })
  })
})

// ============================================
// 5) reports/export — izvoz scope
// ============================================
describe('R82-F: reports/export scope', () => {
  it('view_reports staff brez lokacije → 403', async () => {
    mockAuth(null, 'staff')

    const res = await exportGET(new Request('http://localhost:3000/api/reports/export?type=orders&format=csv&startDate=2026-01-01&endDate=2026-01-31'))

    expect(res.status).toBe(403)
    expect(mocks.orderFindMany).not.toHaveBeenCalled()
  })

  it('lokacijski staff → orders CSV scoped na lokacijo', async () => {
    mockAuth('loc-1', 'staff')
    mocks.orderFindMany.mockResolvedValue([])

    const res = await exportGET(new Request('http://localhost:3000/api/reports/export?type=orders&format=csv&startDate=2026-01-01&endDate=2026-01-31'))

    expect(res.status).toBe(200)
    const where = mocks.orderFindMany.mock.calls[0][0].where
    expect(where.locationId).toBe('loc-1')
  })

  it('employees CSV: tudi employees.findMany je scoped (PII)', async () => {
    mockAuth('loc-1', 'staff')
    mocks.orderFindMany.mockResolvedValue([])
    mocks.employeeFindMany.mockResolvedValue([])

    await exportGET(new Request('http://localhost:3000/api/reports/export?type=employees&format=csv&startDate=2026-01-01&endDate=2026-01-31'))

    expect(mocks.employeeFindMany).toHaveBeenCalledWith({ where: { locationId: 'loc-1' } })
  })
})

// ============================================
// 6) platform gates — regenerate ×2 + webhook retry
// ============================================
describe('R82-F: platform gates (regenerate ×2, webhook retry)', () => {
  it('receipts/regenerate: lokacijski admin → 403, findMany NI klican', async () => {
    mockAuth('loc-1')

    const res = await receiptsRegenPOST(new Request('http://localhost:3000/api/receipts/regenerate', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    }))

    expect(res.status).toBe(403)
    expect(mocks.orderFindMany).not.toHaveBeenCalled()
    expect(mocks.receiptFindMany).not.toHaveBeenCalled()
  })

  it('receipts/regenerate: platform admin → prehode naprej (gate mimo)', async () => {
    mockAuth(null, 'super_admin')
    mocks.orderFindMany.mockResolvedValue([])

    const res = await receiptsRegenPOST(new Request('http://localhost:3000/api/receipts/regenerate', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    }))

    expect(res.status).not.toBe(403)
  })

  it('accounting/journal/regenerate: lokacijski admin → 403', async () => {
    mockAuth('loc-1')

    const res = await journalRegenPOST(new Request('http://localhost:3000/api/accounting/journal/regenerate', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    }))

    expect(res.status).toBe(403)
    expect(mocks.paymentFindMany).not.toHaveBeenCalled()
  })

  it('webhooks/deliveries GET: lokacijski admin → webhook.locationId scope', async () => {
    mockAuth('loc-1')
    mocks.webhookDeliveryFindMany.mockResolvedValue([])
    mocks.webhookDeliveryCount.mockResolvedValue(0)

    const res = await deliveriesGET(new Request('http://localhost:3000/api/webhooks/deliveries'))

    expect(res.status).toBe(200)
    const where = mocks.webhookDeliveryFindMany.mock.calls[0][0].where
    expect(where.webhook).toEqual({ locationId: 'loc-1' })
  })

  it('webhooks/deliveries POST (global retry): lokacijski admin → 403, engine NI klican', async () => {
    mockAuth('loc-1')

    const res = await deliveriesPOST(new Request('http://localhost:3000/api/webhooks/deliveries', { method: 'POST' }))

    expect(res.status).toBe(403)
    expect(mocks.processRetryQueue).not.toHaveBeenCalled()
  })
})

// ============================================
// 7) cron fail-open → fail-closed
// ============================================
describe('R82-F: cron guards fail-closed', () => {

  it('data-retention: brez CRON_SECRET + anonimen klic → 401 (prej: anonimni GDPR deleteMany!)', async () => {
    vi.stubEnv('CRON_SECRET', '')
    authError()

    const res = await dataRetentionPOST(new Request('http://localhost:3000/api/cron/data-retention', { method: 'POST' }))

    expect(res.status).toBe(401)
    vi.unstubAllEnvs()
  })

  it('data-retention: pravi CRON_SECRET → dostop (cron path)', async () => {
    vi.stubEnv('CRON_SECRET', 'sekret')

    const res = await dataRetentionPOST(new Request('http://localhost:3000/api/cron/data-retention', {
      method: 'POST',
      headers: { authorization: 'Bearer sekret' },
    }))

    // 200 (ali vsaj ne 401) — auth je mimo
    expect(res.status).not.toBe(401)
    vi.unstubAllEnvs()
  })

  it('outbox: brez CRON_SECRET + anonimen klic → 401 (prej: anonimni SMS batchi!)', async () => {
    vi.stubEnv('CRON_SECRET', '')
    authError()

    const res = await outboxPOST(new Request('http://localhost:3000/api/cron/outbox', { method: 'POST' }))

    expect(res.status).toBe(401)
    vi.unstubAllEnvs()
  })

  it('outbox: pravi CRON_SECRET → dostop', async () => {
    vi.stubEnv('CRON_SECRET', 'sekret')

    const res = await outboxPOST(new Request('http://localhost:3000/api/cron/outbox', {
      method: 'POST',
      headers: { authorization: 'Bearer sekret' },
    }))

    expect(res.status).not.toBe(401)
    vi.unstubAllEnvs()
  })
})
