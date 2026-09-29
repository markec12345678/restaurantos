// ============================================
// R158-2 — legacy POST /api/z-report finalize gate (issue #124)
// ============================================
// Legacy finalize (manage_cash, finalize:true) NE SME obiti R126 admin
// odobritve: ko DailyClose za ta dan obstaja (PENDING_APPROVAL / REOPENED /
// CLOSED), gate vrne 409 PRED upsertZReportForDay (brez upserta, brez
// audita). Brez DailyClose vrstice je legacy obna\u0161anje 1:1; finalize:false
// (draft) pot ostane vedno odprta; brez lokacije ostane fail-closed 403.
// Hišni kanon: produkcione route funkcije klicane DIREKTNO z new Request();
// lahek trap — mockana je samo meja (requireAuth, rate-limit,
// db.dailyClose.findUnique, upsertZReportForDay, email, createAuditLog).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ljubljanaDayBounds } from '@/lib/timezone-sl'

const LOC_1 = 'loc-1'
const EMP_1 = 'emp-1'
const DATE = '2026-08-05'
const DAY_START = ljubljanaDayBounds(DATE).start

// ---------- Lahek trap (vi.hoisted, hi\u0161ni stil) ----------
const m = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  upsertZReportForDay: vi.fn(),
  createAuditLog: vi.fn(),
  dailyCloseFindUnique: vi.fn(),
  isEmailEnabled: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    // R158-2 gate bere DailyClose po compound unique klju\u010du
    // locationId_businessDate; drugi modeli v POST poti niso doseženi
    // (email flow je izklopljen prek isEmailEnabled=false).
    dailyClose: {
      findUnique: (...args: unknown[]) => m.dailyCloseFindUnique(...args),
    },
  },
  createAuditLog: (...args: unknown[]) => m.createAuditLog(...args),
}))

vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: (...args: unknown[]) => m.requireAuth(...args),
  resolveTenantLocationId: vi.fn(),
  tenantScopeToWhere: vi.fn(() => ({})),
}))

vi.mock('@/app/api/z-report/_helpers', () => ({
  upsertZReportForDay: (...args: unknown[]) => m.upsertZReportForDay(...args),
  calculateReportStats: vi.fn(),
  buildReportData: vi.fn(),
}))

vi.mock('@/lib/email', () => ({
  isEmailEnabled: (...args: unknown[]) => m.isEmailEnabled(...args),
  sendZReportEmail: vi.fn(),
  getReportRecipients: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/app/api/reports/export/_helpers', () => ({
  fetchReportData: vi.fn(),
  generateReportPdf: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: async () => ({ allowed: true, remaining: 10, retryAfterMs: 0 }),
  getClientIp: () => '127.0.0.1',
  AUTHENTICATED_LIMIT: { maxRequests: 120, windowMs: 60000 },
}))
vi.mock('@/lib/rate-limit/response', () => ({
  rateLimitedResponse: () => new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 }),
}))

import { POST as zReportPost } from '@/app/api/z-report/route'

const LEGACY_REPORT = {
  id: 'zr-legacy',
  reportDate: DAY_START,
  locationId: LOC_1,
  status: 'finalized',
  totalSales: 500,
  totalTax: 85,
  createdAt: new Date(),
}

function seedDailyClose(status: string | null) {
  m.dailyCloseFindUnique.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
    const key = where.locationId_businessDate as { locationId: string; businessDate: Date } | undefined
    if (!key || status === null) return null
    if (key.locationId !== LOC_1) return null
    if (new Date(key.businessDate).getTime() !== DAY_START.getTime()) return null
    return {
      id: 'dc-1',
      locationId: LOC_1,
      businessDate: DAY_START,
      status,
      zReportId: 'zr-1',
      idempotencyKey: 'legacy-dc-key',
    }
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  m.requireAuth.mockResolvedValue({
    session: { employeeId: EMP_1, locationId: LOC_1, role: 'manager' },
    error: null,
  })
  m.isEmailEnabled.mockResolvedValue(false)
  m.upsertZReportForDay.mockResolvedValue({
    report: { ...LEGACY_REPORT },
    stats: { totalSales: 500, totalTax: 85 },
    paidOrdersCount: 1,
  })
  m.createAuditLog.mockResolvedValue(undefined)
  seedDailyClose(null)
})

function post(body: unknown) {
  return new Request('http://localhost:3000/api/z-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ============================================
// Gate: finalize=true na danu z DailyClose
// ============================================
describe('R158-2 — legacy z-report finalize gate (DailyClose odobritev)', () => {
  it('finalize=true + DailyClose PENDING_APPROVAL \u2192 409 DAILY_CLOSE_PENDING_APPROVAL, brez upserta in audita', async () => {
    seedDailyClose('PENDING_APPROVAL')
    const res = await zReportPost(post({ date: DATE, finalize: true, actualCash: 100 }))

    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('DAILY_CLOSE_PENDING_APPROVAL')
    // gate bere DailyClose po compound unique klju\u010du (day-start)
    expect(m.dailyCloseFindUnique).toHaveBeenCalledTimes(1)
    expect(m.dailyCloseFindUnique.mock.calls[0][0]).toMatchObject({
      where: { locationId_businessDate: { locationId: LOC_1, businessDate: DAY_START } },
    })
    expect(m.upsertZReportForDay).not.toHaveBeenCalled()
    expect(m.createAuditLog).not.toHaveBeenCalled()
  })

  it('finalize=true + DailyClose REOPENED \u2192 409 DAILY_CLOSE_REOPENED, brez upserta', async () => {
    seedDailyClose('REOPENED')
    const res = await zReportPost(post({ date: DATE, finalize: true }))

    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('DAILY_CLOSE_REOPENED')
    expect(m.upsertZReportForDay).not.toHaveBeenCalled()
    expect(m.createAuditLog).not.toHaveBeenCalled()
  })

  it('finalize=true + DailyClose CLOSED \u2192 409 DAILY_CLOSE_ALREADY_CLOSED, brez upserta', async () => {
    seedDailyClose('CLOSED')
    const res = await zReportPost(post({ date: DATE, finalize: true }))

    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('DAILY_CLOSE_ALREADY_CLOSED')
    expect(m.upsertZReportForDay).not.toHaveBeenCalled()
    expect(m.createAuditLog).not.toHaveBeenCalled()
  })

  it('finalize=true + brez DailyClose \u2192 legacy 1:1: 200/201, upsert klican, audit zapisan', async () => {
    seedDailyClose(null)
    const res = await zReportPost(post({ date: DATE, finalize: true, actualCash: 100, notes: 'popis' }))

    expect([200, 201]).toContain(res.status)
    // upsert z finalize:true in izrecno lokacijo (legacy podpis nespremenjen)
    expect(m.upsertZReportForDay).toHaveBeenCalledTimes(1)
    expect(m.upsertZReportForDay.mock.calls[0][0]).toMatchObject({ date: DATE, locationId: LOC_1, finalize: true })
    // audit je zapisan (legacy pot nespremenjena)
    expect(m.createAuditLog).toHaveBeenCalledTimes(1)
    expect(m.createAuditLog.mock.calls[0][0]).toMatchObject({ action: 'z_report_finalized', entityType: 'z_report' })
  })

  it('finalize=false + DailyClose PENDING_APPROVAL \u2192 gate NE blokira (draft pot odprta)', async () => {
    seedDailyClose('PENDING_APPROVAL')
    const res = await zReportPost(post({ date: DATE, finalize: false }))

    expect(res.status).toBe(200)
    expect(m.upsertZReportForDay).toHaveBeenCalledTimes(1)
    expect(m.upsertZReportForDay.mock.calls[0][0]).toMatchObject({ finalize: false })
    // gate sploh ni pogleval DailyClose (finalize=false)
    expect(m.dailyCloseFindUnique).not.toHaveBeenCalled()
    expect(m.createAuditLog).toHaveBeenCalledTimes(1)
  })

  it('brez lokacije (fail-closed) \u2192 403, pred gate-om in upsertom', async () => {
    m.requireAuth.mockResolvedValue({
      session: { employeeId: EMP_1, locationId: null, role: 'manager' },
      error: null,
    })
    const res = await zReportPost(post({ date: DATE, finalize: true }))

    expect(res.status).toBe(403)
    expect(m.dailyCloseFindUnique).not.toHaveBeenCalled()
    expect(m.upsertZReportForDay).not.toHaveBeenCalled()
  })
})
