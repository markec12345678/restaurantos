// ============================================
// R85-4c — MEDIUM WAVE PART C: REORDER WRITE + NULL-STAMP + SCHEDULED-EMAILS
// ============================================
// REGRESIJA za R84-FINAL-2 MEDIUM najdbe (file:line dokazano):
//
//   M7  reorder WRITE  — /api/reorder-rules POST upsert po GLOBALNO unique
//                        inventoryItemId brez scope-a (cross-tenant WRITE),
//                        DELETE po id brez scope-a, GET brez filtra;
//                        /api/inventory/reorder POST createReorderOrder je
//                        povečal zalogo TUJEMU tenantu + tuj StockTransaction.
//   NULL-stamp pair    — POST /api/gift-cards + POST /api/inventory ustvarjata
//                        vrstice BREZ locationId žiga (legacy NULL = globalno
//                        vidne). Fix: resolveWriteLocationId MODEL A.
//   ScheduledEmailLog  — /api/scheduled-emails/* izpostavlja platformske
//                        podatke lokacijskim adminom. Fix: platformAdminGate
//                        (zrcali /api/reports/digest-send — brez schema migracije).
//
// Vzorec (R84-reports-scope): REALNI tenant-scope resolver + vi.mock auth
// barrel; createAuditLog je TOP-LEVEL export iz '@/lib/db'; uporabi
// mockResolvedValue (NE mockResolvedValueOnce — preživi clearAllMocks).
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  checkRateLimitAsync: vi.fn(),
  // reorder-rules
  reorderRuleFindMany: vi.fn(),
  reorderRuleUpsert: vi.fn(),
  reorderRuleFindUnique: vi.fn(),
  reorderRuleDelete: vi.fn(),
  // inventory (+ reorder)
  inventoryItemFindUnique: vi.fn(),
  inventoryItemFindMany: vi.fn(),
  inventoryItemCreate: vi.fn(),
  inventoryItemUpdate: vi.fn(),
  stockTransactionFindMany: vi.fn(),
  stockTransactionCreate: vi.fn(),
  // gift-cards
  giftCardCreate: vi.fn(),
  giftCardTransactionCreate: vi.fn(),
  giftCardFindUnique: vi.fn(),
  // scheduled-emails
  scheduledEmailLogFindFirst: vi.fn(),
  scheduledEmailLogCreate: vi.fn(),
  scheduledEmailLogFindMany: vi.fn(),
  scheduledEmailLogUpdate: vi.fn(),
  scheduledEmailLogCount: vi.fn(),
  // email / digest / export helpers
  isEmailEnabled: vi.fn(),
  getReportRecipients: vi.fn(),
  sendZReportEmail: vi.fn(),
  fetchDailyDigestData: vi.fn(),
  sendDailyDigestEmail: vi.fn(),
  ensureDailySummaryLog: vi.fn(),
  fetchReportData: vi.fn(),
  generateReportPdf: vi.fn(),
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

vi.mock('@/lib/db', () => ({
  db: {
    reorderRule: {
      findMany: mocks.reorderRuleFindMany,
      upsert: mocks.reorderRuleUpsert,
      findUnique: mocks.reorderRuleFindUnique,
      delete: mocks.reorderRuleDelete,
    },
    inventoryItem: {
      findUnique: mocks.inventoryItemFindUnique,
      findMany: mocks.inventoryItemFindMany,
      create: mocks.inventoryItemCreate,
      update: mocks.inventoryItemUpdate,
    },
    stockTransaction: {
      findMany: mocks.stockTransactionFindMany,
      create: mocks.stockTransactionCreate,
    },
    giftCard: {
      findUnique: mocks.giftCardFindUnique,
    },
    giftCardTransaction: {
      create: mocks.giftCardTransactionCreate,
    },
    scheduledEmailLog: {
      findFirst: mocks.scheduledEmailLogFindFirst,
      create: mocks.scheduledEmailLogCreate,
      findMany: mocks.scheduledEmailLogFindMany,
      update: mocks.scheduledEmailLogUpdate,
      count: mocks.scheduledEmailLogCount,
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        inventoryItem: {
          create: mocks.inventoryItemCreate,
          update: mocks.inventoryItemUpdate,
        },
        stockTransaction: { create: mocks.stockTransactionCreate },
        giftCard: { create: mocks.giftCardCreate },
        giftCardTransaction: { create: mocks.giftCardTransactionCreate },
      }),
    ),
    createAuditLog: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.checkRateLimitAsync,
  getClientIp: () => '127.0.0.1',
  AUTHENTICATED_LIMIT: {},
}))

vi.mock('@/lib/email', () => ({
  isEmailEnabled: mocks.isEmailEnabled,
  getReportRecipients: mocks.getReportRecipients,
  sendZReportEmail: mocks.sendZReportEmail,
}))

vi.mock('@/lib/email/daily-digest', () => ({
  fetchDailyDigestData: mocks.fetchDailyDigestData,
  sendDailyDigestEmail: mocks.sendDailyDigestEmail,
  ensureDailySummaryLog: mocks.ensureDailySummaryLog,
}))

vi.mock('@/app/api/reports/export/_helpers', () => ({
  fetchReportData: mocks.fetchReportData,
  generateReportPdf: mocks.generateReportPdf,
}))

import { GET as reorderRulesGET, POST as reorderRulesPOST, DELETE as reorderRulesDELETE } from '@/app/api/reorder-rules/route'
import { GET as reorderGET, POST as reorderPOST } from '@/app/api/inventory/reorder/route'
import { POST as giftCardsPOST } from '@/app/api/gift-cards/route'
import { POST as inventoryPOST } from '@/app/api/inventory/route'
import { POST as scheduledCreatePOST } from '@/app/api/scheduled-emails/create/route'
import { POST as scheduledProcessPOST, GET as scheduledProcessGET } from '@/app/api/scheduled-emails/process/route'

// Utišaj logger
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

function jsonReq(url: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const REORDER_RULE_BODY = {
  inventoryItemId: 'inv-1',
  orderQuantity: 10,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.checkRateLimitAsync.mockResolvedValue({ allowed: true })
  mocks.reorderRuleFindMany.mockResolvedValue([])
  mocks.reorderRuleUpsert.mockResolvedValue({ id: 'rule-1' })
  mocks.reorderRuleFindUnique.mockResolvedValue(null)
  mocks.inventoryItemFindUnique.mockResolvedValue(null)
  mocks.inventoryItemFindMany.mockResolvedValue([])
  mocks.stockTransactionFindMany.mockResolvedValue([])
  mocks.scheduledEmailLogFindFirst.mockResolvedValue(null)
  mocks.scheduledEmailLogCreate.mockResolvedValue({ id: 'log-1' })
  mocks.scheduledEmailLogFindMany.mockResolvedValue([])
  mocks.scheduledEmailLogCount.mockResolvedValue(0)
  mocks.giftCardCreate.mockResolvedValue({ id: 'gc-1', balance: 50, costPerUnit: 0 })
  mocks.giftCardFindUnique.mockResolvedValue({ id: 'gc-1', transactions: [] })
  mocks.inventoryItemCreate.mockResolvedValue({
    id: 'inv-new', name: 'Moka', quantity: 5, costPerUnit: 2, menuItem: null,
  })
  mocks.isEmailEnabled.mockResolvedValue(true)
  mocks.getReportRecipients.mockResolvedValue(['ops@resto.si'])
  mocks.ensureDailySummaryLog.mockResolvedValue({ success: true, created: 0, reportDate: '2026-01-01' })
  // Session-path determinističen: brez cron secretov
  process.env.CRON_SECRET = ''
  process.env.WS_BROADCAST_SECRET = ''
})

// ══════════════════════════════════════════════════════════════════
// A. /api/reorder-rules — READ scope + CROSS-TENANT WRITE guard
// ══════════════════════════════════════════════════════════════════
describe('R85-4c A: /api/reorder-rules — M7 reorder WRITE', () => {
  it('GET loc-bound admin: where.inventoryItem.locationId pinan (prej brez filtra)', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await reorderRulesGET(new Request('http://localhost:3000/api/reorder-rules'))
    expect(res.status).toBe(200)
    const where = mocks.reorderRuleFindMany.mock.calls[0][0].where
    expect(where.inventoryItem).toEqual({ locationId: LOC_A })
  })

  it('GET super-admin: brez inventoryItem filtra (globalni pregled, nikoli locationId: null)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    await reorderRulesGET(new Request('http://localhost:3000/api/reorder-rules'))
    const where = mocks.reorderRuleFindMany.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(where, 'inventoryItem')).toBe(false)
  })

  it('GET uporabnik brez lokacije → 403 fail-closed, NI poizvedb', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await reorderRulesGET(new Request('http://localhost:3000/api/reorder-rules'))
    expect(res.status).toBe(403)
    expect(mocks.reorderRuleFindMany).not.toHaveBeenCalled()
  })

  it('POST loc-bound admin na LASTNEM artiklu → upsert poteka', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.inventoryItemFindUnique.mockResolvedValue({ id: 'inv-1', locationId: LOC_A })
    const res = await reorderRulesPOST(jsonReq('http://localhost:3000/api/reorder-rules', REORDER_RULE_BODY))
    expect(res.status).toBe(200)
    expect(mocks.inventoryItemFindUnique).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      select: { id: true, locationId: true },
    })
    expect(mocks.reorderRuleUpsert).toHaveBeenCalledTimes(1)
  })

  it('POST loc-bound admin na TUJEM artiklu → 404 + NI upserta (cross-tenant WRITE zaprt)', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.inventoryItemFindUnique.mockResolvedValue({ id: 'inv-1', locationId: LOC_B })
    const res = await reorderRulesPOST(jsonReq('http://localhost:3000/api/reorder-rules', REORDER_RULE_BODY))
    expect(res.status).toBe(404)
    expect(mocks.reorderRuleUpsert).not.toHaveBeenCalled()
  })

  it('POST neznani inventoryItemId → 404 + NI upserta', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.inventoryItemFindUnique.mockResolvedValue(null)
    const res = await reorderRulesPOST(jsonReq('http://localhost:3000/api/reorder-rules', REORDER_RULE_BODY))
    expect(res.status).toBe(404)
    expect(mocks.reorderRuleUpsert).not.toHaveBeenCalled()
  })

  it('POST super-admin sme na tujem artiklu (cross-lokacijski nadzor)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    mocks.inventoryItemFindUnique.mockResolvedValue({ id: 'inv-1', locationId: LOC_B })
    const res = await reorderRulesPOST(jsonReq('http://localhost:3000/api/reorder-rules', REORDER_RULE_BODY))
    expect(res.status).toBe(200)
    expect(mocks.reorderRuleUpsert).toHaveBeenCalledTimes(1)
  })

  it('DELETE tujega pravila → 404 + NI delete-a', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.reorderRuleFindUnique.mockResolvedValue({ id: 'rule-9', inventoryItem: { locationId: LOC_B } })
    const res = await reorderRulesDELETE(new Request(`http://localhost:3000/api/reorder-rules?id=rule-9`))
    expect(res.status).toBe(404)
    expect(mocks.reorderRuleDelete).not.toHaveBeenCalled()
  })

  it('DELETE lastnega pravila → delete poteka', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.reorderRuleFindUnique.mockResolvedValue({ id: 'rule-1', inventoryItem: { locationId: LOC_A } })
    const res = await reorderRulesDELETE(new Request(`http://localhost:3000/api/reorder-rules?id=rule-1`))
    expect(res.status).toBe(200)
    expect(mocks.reorderRuleDelete).toHaveBeenCalledWith({ where: { id: 'rule-1' } })
  })
})

// ══════════════════════════════════════════════════════════════════
// B. /api/inventory/reorder — WRITE scope (zaloga tujega tenanta)
// ══════════════════════════════════════════════════════════════════
describe('R85-4c B: /api/inventory/reorder — M7 cross-tenant WRITE', () => {
  const reorderBody = { items: [{ inventoryItemId: 'inv-x', quantity: 5, costPerUnit: 2 }], employeeName: 'Test' }

  it('POST loc-bound admin: findMany where.locationId pinan; tuj artikel → 400 + NI pisnih operacij', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.inventoryItemFindMany.mockResolvedValue([]) // scoped lookup: tuji artikel "ni najden"
    const res = await reorderPOST(jsonReq('http://localhost:3000/api/inventory/reorder', reorderBody))
    expect(res.status).toBe(400)
    const where = mocks.inventoryItemFindMany.mock.calls[0][0].where
    expect(where.locationId).toBe(LOC_A)
    expect(where.id).toEqual({ in: ['inv-x'] })
    // NI pisnih operacij: transakcija se sploh ne sproži (validItems prazni)
    expect(mocks.inventoryItemUpdate).not.toHaveBeenCalled()
    expect(mocks.stockTransactionCreate).not.toHaveBeenCalled()
  })

  it('POST super-admin: where BREZ locationId (globalno dovoljeno)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    mocks.inventoryItemFindMany.mockResolvedValue([])
    await reorderPOST(jsonReq('http://localhost:3000/api/inventory/reorder', reorderBody))
    const where = mocks.inventoryItemFindMany.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(where, 'locationId')).toBe(false)
  })

  it('POST uporabnik brez lokacije → 403 fail-closed, NI poizvedb', async () => {
    mockSession({ role: 'staff', locationId: null })
    const res = await reorderPOST(jsonReq('http://localhost:3000/api/inventory/reorder', reorderBody))
    expect(res.status).toBe(403)
    expect(mocks.inventoryItemFindMany).not.toHaveBeenCalled()
  })

  it('GET loc-bound admin: predlogi scoped (zaloga samo lastne lokacije)', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await reorderGET(new Request('http://localhost:3000/api/inventory/reorder'))
    expect(res.status).toBe(200)
    expect(mocks.inventoryItemFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('GET super-admin: predlogi globalno (brez filtra)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    await reorderGET(new Request('http://localhost:3000/api/inventory/reorder'))
    const where = mocks.inventoryItemFindMany.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(where, 'locationId')).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════
// C. POST /api/gift-cards — NULL-stamp (locationId žig ob create)
// ══════════════════════════════════════════════════════════════════
describe('R85-4c C: POST /api/gift-cards — NULL-stamp', () => {
  it('loc-bound admin: create žiga session lokacijo; body.locationId TUJE lokacije se IGNORIRA', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await giftCardsPOST(jsonReq('http://localhost:3000/api/gift-cards', {
      cardNumber: 'GC-1', balance: 50, locationId: LOC_B, // poskus cross-tenant žiga
    }))
    expect(res.status).toBe(201)
    expect(mocks.giftCardCreate.mock.calls[0][0].data.locationId).toBe(LOC_A)
  })

  it('staff: žiga session lokacijo (regular user = session location)', async () => {
    mockSession({ role: 'staff', locationId: LOC_A })
    const res = await giftCardsPOST(jsonReq('http://localhost:3000/api/gift-cards', { cardNumber: 'GC-2', balance: 10 }))
    expect(res.status).toBe(201)
    expect(mocks.giftCardCreate.mock.calls[0][0].data.locationId).toBe(LOC_A)
  })

  it('super-admin BREZ body.locationId → 400 fail-closed + NI create-a (nikoli NULL kartica)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    const res = await giftCardsPOST(jsonReq('http://localhost:3000/api/gift-cards', { cardNumber: 'GC-3', balance: 5 }))
    expect(res.status).toBe(400)
    expect(mocks.giftCardCreate).not.toHaveBeenCalled()
  })

  it('super-admin z izrecnim body.locationId → žige podano lokacijo', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    const res = await giftCardsPOST(jsonReq('http://localhost:3000/api/gift-cards', {
      cardNumber: 'GC-4', balance: 5, locationId: LOC_B,
    }))
    expect(res.status).toBe(201)
    expect(mocks.giftCardCreate.mock.calls[0][0].data.locationId).toBe(LOC_B)
  })
})

// ══════════════════════════════════════════════════════════════════
// D. POST /api/inventory — NULL-stamp (locationId žig ob create)
// ══════════════════════════════════════════════════════════════════
describe('R85-4c D: POST /api/inventory — NULL-stamp', () => {
  const itemBody = { name: 'Moka', unit: 'kg', quantity: 5, minQuantity: 1, costPerUnit: 2, servingsPerUnit: 1 }

  it('loc-bound admin: create žiga session lokacijo (prej legacy NULL)', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await inventoryPOST(jsonReq('http://localhost:3000/api/inventory', itemBody))
    expect(res.status).toBe(201)
    expect(mocks.inventoryItemCreate.mock.calls[0][0].data.locationId).toBe(LOC_A)
    // začetna procurement transakcija ostaja
    expect(mocks.stockTransactionCreate).toHaveBeenCalledTimes(1)
  })

  it('loc-bound admin: body.locationId TUJE lokacije se ignorira (fail-closed žig)', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    await inventoryPOST(jsonReq('http://localhost:3000/api/inventory', { ...itemBody, locationId: LOC_B }))
    expect(mocks.inventoryItemCreate.mock.calls[0][0].data.locationId).toBe(LOC_A)
  })

  it('super-admin BREZ body.locationId → 400 fail-closed + NI create-a', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    const res = await inventoryPOST(jsonReq('http://localhost:3000/api/inventory', itemBody))
    expect(res.status).toBe(400)
    expect(mocks.inventoryItemCreate).not.toHaveBeenCalled()
  })

  it('super-admin z izrecnim body.locationId → žige podano lokacijo', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    const res = await inventoryPOST(jsonReq('http://localhost:3000/api/inventory', { ...itemBody, locationId: LOC_B }))
    expect(res.status).toBe(201)
    expect(mocks.inventoryItemCreate.mock.calls[0][0].data.locationId).toBe(LOC_B)
  })
})

// ══════════════════════════════════════════════════════════════════
// E. /api/scheduled-emails — platformAdminGate (mirror digest-send)
// ══════════════════════════════════════════════════════════════════
describe('R85-4c E: /api/scheduled-emails/create — platform gate', () => {
  it('lokacijski admin → 403 + ZERO db/email klicev', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await scheduledCreatePOST(jsonReq('http://localhost:3000/api/scheduled-emails/create', {}))
    expect(res.status).toBe(403)
    expect(mocks.scheduledEmailLogFindFirst).not.toHaveBeenCalled()
    expect(mocks.scheduledEmailLogCreate).not.toHaveBeenCalled()
    expect(mocks.isEmailEnabled).not.toHaveBeenCalled()
    expect(mocks.getReportRecipients).not.toHaveBeenCalled()
  })

  it('platform admin (brez lokacije) → 201, logi ustvarjeni', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    const res = await scheduledCreatePOST(jsonReq('http://localhost:3000/api/scheduled-emails/create', {}))
    expect(res.status).toBe(201)
    expect(mocks.scheduledEmailLogCreate).toHaveBeenCalledTimes(1)
    expect(mocks.scheduledEmailLogCreate.mock.calls[0][0].data.recipient).toBe('ops@resto.si')
    expect(mocks.scheduledEmailLogCreate.mock.calls[0][0].data.status).toBe('pending')
  })
})

describe('R85-4c F: /api/scheduled-emails/process — platform gate', () => {
  it('GET lokacijski admin → 403 + ZERO count/findMany', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await scheduledProcessGET(new Request('http://localhost:3000/api/scheduled-emails/process'))
    expect(res.status).toBe(403)
    expect(mocks.scheduledEmailLogCount).not.toHaveBeenCalled()
    expect(mocks.scheduledEmailLogFindMany).not.toHaveBeenCalled()
  })

  it('GET platform admin → 200 s statistiko', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    const res = await scheduledProcessGET(new Request('http://localhost:3000/api/scheduled-emails/process'))
    expect(res.status).toBe(200)
    expect(mocks.scheduledEmailLogCount).toHaveBeenCalledTimes(3)
    const body = await res.json()
    expect(body.stats).toEqual({ pending: 0, sentToday: 0, failedToday: 0 })
  })

  it('POST lokacijski admin (ročni klic seje) → 403 + zero read/write', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await scheduledProcessPOST(jsonReq('http://localhost:3000/api/scheduled-emails/process'))
    expect(res.status).toBe(403)
    expect(mocks.scheduledEmailLogFindMany).not.toHaveBeenCalled()
    expect(mocks.scheduledEmailLogUpdate).not.toHaveBeenCalled()
    expect(mocks.ensureDailySummaryLog).not.toHaveBeenCalled()
  })

  it('POST platform admin (seja) → 200 (ni čakajočih)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    const res = await scheduledProcessPOST(jsonReq('http://localhost:3000/api/scheduled-emails/process'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed).toBe(0)
  })

  it('POST cron (Bearer CRON_SECRET) ostane dovoljen brez seje — regresija AUD-13', async () => {
    process.env.CRON_SECRET = 'cron-test-secret'
    try {
      const res = await scheduledProcessPOST(jsonReq(
        'http://localhost:3000/api/scheduled-emails/process',
        undefined,
        { Authorization: 'Bearer cron-test-secret' },
      ))
      expect(res.status).toBe(200)
      expect(mocks.requireAuth).not.toHaveBeenCalled()
      expect(mocks.scheduledEmailLogFindMany).toHaveBeenCalledTimes(1)
    } finally {
      process.env.CRON_SECRET = ''
    }
  })
})
