// ============================================
// R86-4 — CARRY-OVER ENDPOINTS (R84-FINAL-2/R85-FINAL-2 deferred)
// ============================================
// REGRESIJA za 11 prenašanih endpointov (vsi VULNERABLE→FIXED, razen
// izrecno dokumentiranih global-by-design):
//   A. courses GET/POST        — scope prek Order.locationId (Course brez stolpca)
//   B. print                   — order ownership + Printer.locationId scope
//   C. outbox GET + [id]/retry — OutboxEvent.locationId (R84 stolpec)
//   D. accounting/send-report-email — fetchReportData scope param
//   E. cis/submit-invoice      — Receipt scope prek order.locationId (obe poti)
//   F. predictive-ordering     — lib scope + session-wins nad body.locationId
//   G. ai/forecast             — order zgodovina scoped
//   H. daily-checklist         — AuditLog.locationId read + write žig
//   I. loyalty-automation      — batch/stats locationId (SMS čez tenantе)
//   J. fraud-detection         — 4 detektorji scoped
//   K. debug/env               — platformAdminGate + maskiran preview
//
// Vzorec (po r85-final-scope.test.ts): realen tenant-scope resolver (rute ga
// importirajo iz '@/lib/tenant-scope' — REALNI modul, brez mocka) +
// vi.hoisted mocki + mockResolvedValue (nikoli .Once). null scope (super-admin)
// = PRAZEN filter, NIKOLI { locationId: null } (hasOwnProperty pin).
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  courseFindMany: vi.fn(),
  courseCreate: vi.fn(),
  orderFindFirst: vi.fn(),
  orderFindUnique: vi.fn(),
  printerFindUnique: vi.fn(),
  printerFindMany: vi.fn(),
  outboxEventFindMany: vi.fn(),
  outboxEventFindFirst: vi.fn(),
  outboxEventUpdate: vi.fn(),
  outboxEventGroupBy: vi.fn(),
  receiptFindFirst: vi.fn(),
  submitReceiptToCis: vi.fn(),
  auditLogFindFirst: vi.fn(),
  createAuditLog: vi.fn(),
  loyaltyAccountFindMany: vi.fn(),
  loyaltyAccountCount: vi.fn(),
  loyaltyAccountGroupBy: vi.fn(),
  orderItemFindMany: vi.fn(),
  orderFindMany: vi.fn(),
  cashRegisterShiftFindMany: vi.fn(),
  menuItemFindMany: vi.fn(),
  reorderRuleFindMany: vi.fn(),
  inventoryItemFindMany: vi.fn(),
  purchaseOrderFindFirst: vi.fn(),
  scheduledEmailLogCreate: vi.fn(),
  isEmailEnabled: vi.fn(),
  getReportRecipients: vi.fn(),
  fetchReportData: vi.fn(),
  generateReportPdf: vi.fn(),
  sendZReportEmail: vi.fn(),
  sendSms: vi.fn(),
  checkRateLimitAsync: vi.fn(),
}))

// Auth middleware: mock requireAuth (realni resolver teče v '@/lib/tenant-scope')
vi.mock('@/lib/auth-middleware', async () => {
  const tenantScope = await import('@/lib/auth-middleware/tenant-scope')
  return {
    requireAuth: mocks.requireAuth,
    // pattern parity: realni resolver re-export (rute ga ne tukaj uporabljajo,
    // ampak iz canonical '@/lib/tenant-scope' — ki ostane NE-mockan)
    resolveTenantLocationId: tenantScope.resolveTenantLocationId,
    resolveTenantLocationIdOrThrow: tenantScope.resolveTenantLocationIdOrThrow,
  }
})

vi.mock('@/lib/db', () => ({
  db: {
    course: { findMany: mocks.courseFindMany, create: mocks.courseCreate },
    order: { findFirst: mocks.orderFindFirst, findUnique: mocks.orderFindUnique, findMany: mocks.orderFindMany },
    printer: { findUnique: mocks.printerFindUnique, findMany: mocks.printerFindMany },
    outboxEvent: {
      findMany: mocks.outboxEventFindMany,
      findFirst: mocks.outboxEventFindFirst,
      update: mocks.outboxEventUpdate,
      groupBy: mocks.outboxEventGroupBy,
    },
    receipt: { findFirst: mocks.receiptFindFirst },
    auditLog: { findFirst: mocks.auditLogFindFirst },
    loyaltyAccount: {
      findMany: mocks.loyaltyAccountFindMany,
      count: mocks.loyaltyAccountCount,
      groupBy: mocks.loyaltyAccountGroupBy,
    },
    orderItem: { findMany: mocks.orderItemFindMany },
    cashRegisterShift: { findMany: mocks.cashRegisterShiftFindMany },
    menuItem: { findMany: mocks.menuItemFindMany },
    reorderRule: { findMany: mocks.reorderRuleFindMany },
    inventoryItem: { findMany: mocks.inventoryItemFindMany, fields: { minQuantity: 'minQuantity' } },
    purchaseOrder: { findFirst: mocks.purchaseOrderFindFirst },
    scheduledEmailLog: { create: mocks.scheduledEmailLogCreate },
  },
  // createAuditLog je TOP-LEVEL export iz '@/lib/db'
  createAuditLog: mocks.createAuditLog,
}))

vi.mock('@/lib/cis', () => ({
  submitReceiptToCis: mocks.submitReceiptToCis,
}))

vi.mock('@/lib/email', () => ({
  sendZReportEmail: mocks.sendZReportEmail,
  isEmailEnabled: mocks.isEmailEnabled,
  getReportRecipients: mocks.getReportRecipients,
}))

vi.mock('@/app/api/reports/export/_helpers', () => ({
  fetchReportData: mocks.fetchReportData,
  generateReportPdf: mocks.generateReportPdf,
}))

vi.mock('@/lib/sms', () => ({
  sendSms: mocks.sendSms,
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.checkRateLimitAsync,
  getClientIp: vi.fn(() => '127.0.0.1'),
  AUTHENTICATED_LIMIT: 60,
  AI_ASSISTANT_LIMIT: 20,
}))

vi.mock('@/lib/forecast', () => ({
  autoForecast: vi.fn((series: unknown[], days: number) => ({
    forecast: Array.from({ length: days }, (_v, i) => ({ period: `d${i}`, value: 0 })),
    confidence: 'low' as const,
    slope: 0,
    method: 'moving_average',
    confidenceNote: 'mock',
    metrics: {},
  })),
}))

vi.mock('@/lib/furs', () => ({
  generateFursQRContent: vi.fn(() => undefined),
}))

vi.mock('@/lib/furs/config-resolver', () => ({
  getRestaurantInfoForLocation: vi.fn(async () => ({ name: 'Test', address: '', city: '', postCode: '', phone: '', businessId: '', taxId: '', registerNumber: '' })),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { GET as coursesGET, POST as coursesPOST } from '@/app/api/courses/route'
import { POST as printPOST } from '@/app/api/print/route'
import { GET as outboxGET } from '@/app/api/outbox/route'
import { POST as outboxRetryPOST } from '@/app/api/outbox/[id]/retry/route'
import { POST as sendReportEmailPOST } from '@/app/api/accounting/send-report-email/route'
import { POST as cisSubmitPOST } from '@/app/api/cis/submit-invoice/route'
import { GET as predictiveGET, POST as predictivePOST } from '@/app/api/predictive-ordering/route'
import { POST as forecastPOST } from '@/app/api/ai/forecast/route'
import { GET as checklistGET, POST as checklistPOST } from '@/app/api/daily-checklist/route'
import { GET as loyaltyAutoGET, POST as loyaltyAutoPOST } from '@/app/api/loyalty-automation/route'
import { POST as fraudPOST } from '@/app/api/fraud-detection/route'
import { GET as debugEnvGET } from '@/app/api/debug/env/route'

// Utišaj logger/consoles
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

const LOC_A = 'loc-tenant-a'
const LOC_B = 'loc-tenant-b'

function mockSession(overrides: Record<string, unknown> = {}) {
  mocks.requireAuth.mockResolvedValue({
    session: { employeeId: 'emp-1', role: 'admin', locationId: LOC_A, ...overrides },
    error: null,
  })
}

function jsonReq(url: string, body?: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.checkRateLimitAsync.mockResolvedValue({ allowed: true, remaining: 59, retryAfterMs: 0 })
  mocks.courseFindMany.mockResolvedValue([])
  mocks.courseCreate.mockResolvedValue({ id: 'c-1' })
  mocks.orderFindFirst.mockResolvedValue({ id: 'o-1' })
  mocks.orderFindUnique.mockResolvedValue(null)
  mocks.printerFindUnique.mockResolvedValue(null)
  mocks.printerFindMany.mockResolvedValue([])
  mocks.outboxEventFindMany.mockResolvedValue([])
  mocks.outboxEventFindFirst.mockResolvedValue(null)
  mocks.outboxEventUpdate.mockResolvedValue({ id: 'ev-1' })
  mocks.outboxEventGroupBy.mockResolvedValue([])
  mocks.receiptFindFirst.mockResolvedValue({ id: 'rcpt-1' })
  mocks.submitReceiptToCis.mockResolvedValue({ ok: true, cisStatus: 'submitted', jir: 'JIR-1', zki: 'z'.repeat(32) })
  mocks.auditLogFindFirst.mockResolvedValue(null)
  mocks.createAuditLog.mockResolvedValue(undefined)
  mocks.loyaltyAccountFindMany.mockResolvedValue([])
  mocks.loyaltyAccountCount.mockResolvedValue(0)
  mocks.loyaltyAccountGroupBy.mockResolvedValue([])
  mocks.orderItemFindMany.mockResolvedValue([])
  mocks.orderFindMany.mockResolvedValue([])
  mocks.cashRegisterShiftFindMany.mockResolvedValue([])
  mocks.menuItemFindMany.mockResolvedValue([])
  mocks.reorderRuleFindMany.mockResolvedValue([])
  mocks.inventoryItemFindMany.mockResolvedValue([])
  mocks.purchaseOrderFindFirst.mockResolvedValue(null)
  mocks.scheduledEmailLogCreate.mockResolvedValue({ id: 'log-1' })
  mocks.isEmailEnabled.mockResolvedValue(true)
  mocks.getReportRecipients.mockResolvedValue(['admin@loc-a.si'])
  mocks.fetchReportData.mockResolvedValue({
    summary: { totalRevenue: 100, totalTax: 22, totalOrders: 3 },
    orders: [],
  })
  mocks.generateReportPdf.mockResolvedValue(Buffer.alloc(8))
  mocks.sendZReportEmail.mockResolvedValue({ success: true })
})

// ══════════════════════════════════════════════════════════════════
// A. COURSES GET/POST
// ══════════════════════════════════════════════════════════════════
describe('R86-4 A: /api/courses — scope prek Order.locationId', () => {
  it('GET: regular user brez lokacije → 403, NI poizvedb', async () => {
    mockSession({ role: 'waiter', locationId: null })
    const res = await coursesGET(new Request(`http://localhost:3000/api/courses?orderId=o-1`))
    expect(res.status).toBe(403)
    expect(mocks.courseFindMany).not.toHaveBeenCalled()
  })

  it('GET: lokacijski admin → where.order.locationId pripet (tuji ?locationId ignoriran)', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await coursesGET(new Request(`http://localhost:3000/api/courses?orderId=o-1&locationId=${LOC_B}`))
    expect(res.status).toBe(200)
    expect(mocks.courseFindMany.mock.calls[0][0].where.order.locationId).toBe(LOC_A)
  })

  it('POST: tuj orderId → 404 "Naročilo ni najden", course.create NI klican', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.orderFindFirst.mockResolvedValue(null) // naročilo na drugi lokaciji
    const res = await coursesPOST(jsonReq('http://localhost:3000/api/courses', {
      orderId: 'o-foreign', courseNumber: 1,
    }))
    expect(res.status).toBe(404)
    expect(mocks.orderFindFirst.mock.calls[0][0].where.locationId).toBe(LOC_A)
    expect(mocks.courseCreate).not.toHaveBeenCalled()
  })

  it('POST: super-admin → where BREZ locationId ključa, create izveden', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    const res = await coursesPOST(jsonReq('http://localhost:3000/api/courses', {
      orderId: 'o-1', courseNumber: 2, name: 'Glavna',
    }))
    expect(res.status).toBe(201)
    expect(Object.prototype.hasOwnProperty.call(mocks.orderFindFirst.mock.calls[0][0].where, 'locationId')).toBe(false)
    expect(mocks.courseCreate).toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// B. PRINT
// ══════════════════════════════════════════════════════════════════
describe('R86-4 B: POST /api/print — cross-tenant tiskanje', () => {
  it('regular user brez lokacije → 403, NI order poizvedbe', async () => {
    mockSession({ role: 'waiter', locationId: null })
    const res = await printPOST(jsonReq('http://localhost:3000/api/print', { type: 'order', orderId: 'o-1' }))
    expect(res.status).toBe(403)
    expect(mocks.orderFindUnique).not.toHaveBeenCalled()
  })

  it('order na LOC_B, uporabnik LOC_A → 404 (isti odgovor kot neobstoječ), NI tiskalniških poizvedb', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.orderFindUnique.mockResolvedValue({ id: 'o-b', locationId: LOC_B, orderNumber: 1, table: null, createdAt: new Date(), orderItems: [] })
    const res = await printPOST(jsonReq('http://localhost:3000/api/print', { type: 'order', orderId: 'o-b' }))
    expect(res.status).toBe(404)
    expect(mocks.printerFindMany).not.toHaveBeenCalled()
  })

  it('lasten order → printer.findMany where.locationId pripet (tiskalnik svoje lokacije)', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.orderFindUnique.mockResolvedValue({ id: 'o-a', locationId: LOC_A, orderNumber: 1, table: null, createdAt: new Date(), orderItems: [] })
    await printPOST(jsonReq('http://localhost:3000/api/print', { type: 'order', orderId: 'o-a' }))
    expect(mocks.printerFindMany).toHaveBeenCalled()
    for (const call of mocks.printerFindMany.mock.calls) {
      expect(call[0].where.locationId).toBe(LOC_A)
    }
  })

  it('super-admin → printer where BREZ locationId ključa (globalni nadzor)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    mocks.orderFindUnique.mockResolvedValue({ id: 'o-a', locationId: LOC_B, orderNumber: 1, table: null, createdAt: new Date(), orderItems: [] })
    await printPOST(jsonReq('http://localhost:3000/api/print', { type: 'order', orderId: 'o-a' }))
    for (const call of mocks.printerFindMany.mock.calls) {
      expect(Object.prototype.hasOwnProperty.call(call[0].where, 'locationId')).toBe(false)
    }
  })
})

// ══════════════════════════════════════════════════════════════════
// C. OUTBOX GET + [id]/retry
// ══════════════════════════════════════════════════════════════════
describe('R86-4 C: /api/outbox — OutboxEvent.locationId scope', () => {
  it('GET: regular user brez lokacije → 403, NI poizvedb', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await outboxGET(new Request('http://localhost:3000/api/outbox'))
    expect(res.status).toBe(403)
    expect(mocks.outboxEventFindMany).not.toHaveBeenCalled()
    expect(mocks.outboxEventGroupBy).not.toHaveBeenCalled()
  })

  it('GET: lokacijski admin → findMany + groupBy where.locationId pripeta (stats tudi scoped)', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await outboxGET(new Request('http://localhost:3000/api/outbox'))
    expect(res.status).toBe(200)
    expect(mocks.outboxEventFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
    expect(mocks.outboxEventGroupBy.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('GET: super-admin → where brez locationId ključa (nikoli { locationId: null })', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    await outboxGET(new Request('http://localhost:3000/api/outbox'))
    expect(Object.prototype.hasOwnProperty.call(mocks.outboxEventFindMany.mock.calls[0][0].where, 'locationId')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(mocks.outboxEventGroupBy.mock.calls[0][0].where, 'locationId')).toBe(false)
  })

  it('retry: tuj event (locationId LOC_B) → 404, retryOutboxEvent update NI klican', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await outboxRetryPOST(
      jsonReq('http://localhost:3000/api/outbox/ev-foreign/retry'),
      { params: Promise.resolve({ id: 'ev-foreign' }) },
    )
    expect(res.status).toBe(404)
    expect(mocks.outboxEventFindFirst.mock.calls[0][0].where).toMatchObject({ id: 'ev-foreign', locationId: LOC_A })
    expect(mocks.outboxEventUpdate).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// D. ACCOUNTING / SEND-REPORT-EMAIL
// ══════════════════════════════════════════════════════════════════
describe('R86-4 D: POST /api/accounting/send-report-email', () => {
  it('regular user brez lokacije → 403, NI email/report klicev', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await sendReportEmailPOST(new Request('http://localhost:3000/api/accounting/send-report-email', { method: 'POST' }))
    expect(res.status).toBe(403)
    expect(mocks.isEmailEnabled).not.toHaveBeenCalled()
    expect(mocks.fetchReportData).not.toHaveBeenCalled()
  })

  it('lokovani admin → fetchReportData dobi scope.locationId (Z-report samo svoja lokacija)', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await sendReportEmailPOST(new Request('http://localhost:3000/api/accounting/send-report-email', { method: 'POST' }))
    expect(res.status).toBe(200)
    expect(mocks.fetchReportData.mock.calls[0][1]).toBe(LOC_A)
  })
})

// ══════════════════════════════════════════════════════════════════
// E. CIS / SUBMIT-INVOICE
// ══════════════════════════════════════════════════════════════════
describe('R86-4 E: POST /api/cis/submit-invoice — Receipt scope prek order.locationId', () => {
  it('regular user brez lokacije → 403, NI receipt/CIS klicev', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await cisSubmitPOST(jsonReq('http://localhost:3000/api/cis/submit-invoice', { orderId: 'o-1' }))
    expect(res.status).toBe(403)
    expect(mocks.receiptFindFirst).not.toHaveBeenCalled()
    expect(mocks.submitReceiptToCis).not.toHaveBeenCalled()
  })

  it('orderId path: where vključuje order.locationId (lokovani admin)', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await cisSubmitPOST(jsonReq('http://localhost:3000/api/cis/submit-invoice', { orderId: 'o-1' }))
    expect(res.status).toBe(200)
    expect(mocks.receiptFindFirst.mock.calls[0][0].where).toEqual({
      orderId: 'o-1',
      isStorno: false,
      order: { locationId: LOC_A },
    })
  })

  it('receiptId path: tuj račun → 400 "Račun ni najden", submitReceiptToCis NI klican', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.receiptFindFirst.mockResolvedValue(null) // lastniška preverba pade
    const res = await cisSubmitPOST(jsonReq('http://localhost:3000/api/cis/submit-invoice', { receiptId: 'rcpt-foreign' }))
    expect(res.status).toBe(400)
    expect(mocks.receiptFindFirst.mock.calls[0][0].where).toEqual({ id: 'rcpt-foreign', order: { locationId: LOC_A } })
    expect(mocks.submitReceiptToCis).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// F. PREDICTIVE-ORDERING
// ══════════════════════════════════════════════════════════════════
describe('R86-4 F: /api/predictive-ordering — zaloga/pravila scope + session-wins', () => {
  it('GET: regular user brez lokacije → 403, NI poizvedb', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await predictiveGET(new Request('http://localhost:3000/api/predictive-ordering'))
    expect(res.status).toBe(403)
    expect(mocks.reorderRuleFindMany).not.toHaveBeenCalled()
    expect(mocks.inventoryItemFindMany).not.toHaveBeenCalled()
  })

  it('GET: lokacijski admin → reorderRule (prek inventoryItem) + inventoryItem where pripeta', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await predictiveGET(new Request(`http://localhost:3000/api/predictive-ordering?locationId=${LOC_B}`))
    expect(res.status).toBe(200)
    expect(mocks.reorderRuleFindMany.mock.calls[0][0].where.inventoryItem.locationId).toBe(LOC_A)
    expect(mocks.inventoryItemFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('POST: super-admin brez body.locationId → 400 fail-closed, NI PO poizvedbe', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    const res = await predictivePOST(jsonReq('http://localhost:3000/api/predictive-ordering', {
      supplierId: 'sup-1', inventoryItemIds: ['iv-1'],
    }))
    expect(res.status).toBe(400)
    expect(mocks.purchaseOrderFindFirst).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// G. AI / FORECAST
// ══════════════════════════════════════════════════════════════════
describe('R86-4 G: POST /api/ai/forecast — order zgodovina scoped', () => {
  it('regular user brez lokacije → 403, NI poizvedb', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await forecastPOST(jsonReq('http://localhost:3000/api/ai/forecast', { days: 7 }))
    expect(res.status).toBe(403)
    expect(mocks.orderFindMany).not.toHaveBeenCalled()
  })

  it('lokovani admin → order.findMany where.locationId pripet + menuItem lookup scoped', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const now = new Date()
    mocks.orderFindMany.mockResolvedValue([
      { paidAt: now, total: 100, tip: 5, orderItems: [{ menuItemId: 'mi-1', quantity: 2 }] },
    ])
    mocks.menuItemFindMany.mockResolvedValue([{ id: 'mi-1', name: 'Kava' }])
    const res = await forecastPOST(jsonReq('http://localhost:3000/api/ai/forecast', { days: 3 }))
    expect(res.status).toBe(200)
    expect(mocks.orderFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
    expect(mocks.menuItemFindMany.mock.calls[0][0].where.category.menu.locationId).toBe(LOC_A)
  })
})

// ══════════════════════════════════════════════════════════════════
// H. DAILY-CHECKLIST
// ══════════════════════════════════════════════════════════════════
describe('R86-4 H: /api/daily-checklist — AuditLog.locationId', () => {
  it('GET: regular user brez lokacije → 403, NI poizvedb', async () => {
    mockSession({ role: 'waiter', locationId: null })
    const res = await checklistGET(new Request('http://localhost:3000/api/daily-checklist'))
    expect(res.status).toBe(403)
    expect(mocks.auditLogFindFirst).not.toHaveBeenCalled()
  })

  it('GET: lokacijski admin → auditLog.findFirst where.locationId pripet', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await checklistGET(new Request('http://localhost:3000/api/daily-checklist?type=opening'))
    expect(res.status).toBe(200)
    expect(mocks.auditLogFindFirst.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('POST: žig session lokacije na createAuditLog vnos', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await checklistPOST(jsonReq('http://localhost:3000/api/daily-checklist', {
      type: 'opening',
      checklist: [{ id: 'opening-x-0', task: 'Vklopi POS', category: 'sistemi', completed: true }],
    }))
    expect(res.status).toBe(200)
    expect(mocks.createAuditLog.mock.calls[0][0].locationId).toBe(LOC_A)
  })
})

// ══════════════════════════════════════════════════════════════════
// I. LOYALTY-AUTOMATION
// ══════════════════════════════════════════════════════════════════
describe('R86-4 I: /api/loyalty-automation — batch/stats scope (SMS čez tenantе)', () => {
  it('GET: regular user brez lokacije → 403, NI poizvedb', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await loyaltyAutoGET(new Request('http://localhost:3000/api/loyalty-automation'))
    expect(res.status).toBe(403)
    expect(mocks.loyaltyAccountCount).not.toHaveBeenCalled()
  })

  it('POST birthday_batch: lokacijski admin → findMany where.locationId pripet', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await loyaltyAutoPOST(jsonReq('http://localhost:3000/api/loyalty-automation', { action: 'birthday_batch' }))
    expect(res.status).toBe(200)
    expect(mocks.loyaltyAccountFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
    expect(mocks.sendSms).not.toHaveBeenCalled() // prazen batch
  })

  it('POST all: super-admin → where BREZ locationId ključa (globalni batch)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    const res = await loyaltyAutoPOST(jsonReq('http://localhost:3000/api/loyalty-automation', {}))
    expect(res.status).toBe(200)
    expect(mocks.loyaltyAccountFindMany.mock.calls.length).toBe(2) // birthday + winback
    for (const call of mocks.loyaltyAccountFindMany.mock.calls) {
      expect(Object.prototype.hasOwnProperty.call(call[0].where, 'locationId')).toBe(false)
    }
  })
})

// ══════════════════════════════════════════════════════════════════
// J. FRAUD-DETECTION
// ══════════════════════════════════════════════════════════════════
describe('R86-4 J: POST /api/fraud-detection — detektorji scoped', () => {
  it('regular user brez lokacije → 403, NI detekcijskih poizvedb', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await fraudPOST(jsonReq('http://localhost:3000/api/fraud-detection', { action: 'run_checks' }))
    expect(res.status).toBe(403)
    expect(mocks.orderItemFindMany).not.toHaveBeenCalled()
    expect(mocks.orderFindMany).not.toHaveBeenCalled()
    expect(mocks.cashRegisterShiftFindMany).not.toHaveBeenCalled()
  })

  it('run_checks: lokacijski admin → vse 4 poizvedbe scoped (orderItem prek order relacije)', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await fraudPOST(jsonReq('http://localhost:3000/api/fraud-detection', { action: 'run_checks' }))
    expect(res.status).toBe(200)
    expect(mocks.orderItemFindMany.mock.calls[0][0].where.order.locationId).toBe(LOC_A)
    expect(mocks.orderFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A) // high discounts
    expect(mocks.orderFindMany.mock.calls[1][0].where.locationId).toBe(LOC_A) // after hours
    expect(mocks.cashRegisterShiftFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('run_checks: super-admin → where BREZ locationId ključa (globalni audit)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    await fraudPOST(jsonReq('http://localhost:3000/api/fraud-detection', { action: 'run_checks' }))
    for (const call of mocks.orderFindMany.mock.calls) {
      expect(Object.prototype.hasOwnProperty.call(call[0].where, 'locationId')).toBe(false)
    }
    expect(Object.prototype.hasOwnProperty.call(mocks.cashRegisterShiftFindMany.mock.calls[0][0].where, 'locationId')).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════
// K. DEBUG/ENV — platformAdminGate + maskiran preview
// ══════════════════════════════════════════════════════════════════
describe('R86-4 K: GET /api/debug/env — platform gate (information disclosure)', () => {
  it('lokovani admin (role admin Z lokacijo) → 403 platform gate', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await debugEnvGET(new Request('http://localhost:3000/api/debug/env'))
    expect(res.status).toBe(403)
  })

  it('platform admin (brez lokacije) → 200, preview je MASKIRAN (brez gesla)', async () => {
    mockSession({ role: 'admin', locationId: null })
    vi.stubEnv('DATABASE_URL', 'postgresql://dbuser:supersecret@db.host:5432/resto')
    try {
      const res = await debugEnvGET(new Request('http://localhost:3000/api/debug/env'))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.DATABASE_URL_set).toBe(true)
      expect(data.FULL_MASKED).toContain('****')
      expect(data.FULL_MASKED).not.toContain('supersecret')
      expect(data.DATABASE_URL_preview).not.toContain('supersecret')
      expect(data.DATABASE_URL_preview).toContain('db.host') // legit config debug ostane
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
