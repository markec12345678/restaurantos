// ============================================
// R87-4 — LOW hygiene wave (tenant scope)
// ============================================
// REGRESIJA za R86-FINAL-AUDIT LOW preostanke + R87-4 dodela:
//   1. furs/cert-status — raw `session?.locationId`: regularna NULL-location
//      seja s permission 'admin' (PERMISSION ≠ vloga) je dobila globalni
//      RestaurantSettings FURS cert fallback (certPath/hasPassword/environment
//      tujega tenanta) + count-e računov VSEH tenantov. Zdaj: resolver takoj za
//      requireAuth (regular-null → 403; super-admin → dokumentiran globalni
//      pogled, P0-C3B/R77 CONFIG izključitev).
//   2. location-fallback consumers (8 klicateljev) — globalni prva-lokacija
//      fallback (prva lokacija KATEREGA KOLI tenanta) za NULL-location seje.
//      Zdaj: resolveTenantLocationIdOrThrow + resolveWriteLocationId
//      (regular-null → 403; super-admin brez izrecne lokacije → 400 fail-closed).
//      Modul '@/lib/location-fallback' je odstranjen — NIČ ga več uvaža.
//   3. ai-tools check_fraud — prej explicit `runAllFraudChecks(..., null)` =
//      AI fraud scan VSEH tenantov. Zdaj: lokacija iz konteksta
//      (locationId → employeeId lookup z vlogo) ali fail-closed.
//   4. body-parse-before-scope (orders PATCH/PUT, payments POST/refund,
//      cash-register POST/PUT, receipts post-handler) — resolver zdaj PRED
//      body parse (preverjeno posredno: 403 pri zlomu bodyja pomeni, da je
//      resolver tekel prej).
//
// Vzorec r85-final-scope: vi.hoisted, REALNI resolver re-export iz
// '@/lib/auth-middleware/tenant-scope', db mock s top-level createAuditLog,
// mockResolvedValue (nikoli .Once).
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  restaurantSettingsFindFirst: vi.fn(),
  locationFindUnique: vi.fn(),
  locationFindFirst: vi.fn(),
  receiptCount: vi.fn(),
  purchaseOrderCreate: vi.fn(),
  getNextCounter: vi.fn(),
  haccpChainCreate: vi.fn(),
  shiftCreate: vi.fn(),
  timeEntryFindFirst: vi.fn(),
  employeeFindUnique: vi.fn(),
  timeEntryCreate: vi.fn(),
  openingHoursDeleteMany: vi.fn(),
  openingHoursCreateMany: vi.fn(),
  openingHoursCreate: vi.fn(),
  guestFeedbackCreate: vi.fn(),
  zReportFindFirst: vi.fn(),
  txZReportFindFirst: vi.fn(),
  txZReportCreate: vi.fn(),
  buildReportData: vi.fn(),
  orderFindMany: vi.fn(),
  cashRegisterShiftFindMany: vi.fn(),
  runAllFraudChecks: vi.fn(),
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

// '@/lib/tenant-scope' NI mockan — routes, ki ga uvažajo direktno
// (resolveWriteLocationId, isWithinScope, notInScopeResponse, resolver),
// poganjajo realno logiko.

vi.mock('@/lib/counters', () => ({
  getNextCounter: mocks.getNextCounter,
}))

vi.mock('@/lib/haccp-chain', () => ({
  createHaccpEntryWithChain: mocks.haccpChainCreate,
}))

vi.mock('@/lib/fraud-detection', () => ({
  runAllFraudChecks: mocks.runAllFraudChecks,
}))

vi.mock('@/app/api/z-report/_helpers/stats', () => ({
  calculateReportStats: vi.fn().mockResolvedValue({ totalSales: 0, totalTax: 0 }),
}))

vi.mock('@/app/api/z-report/_helpers/build-report', () => ({
  buildReportData: mocks.buildReportData,
}))

vi.mock('@/lib/db', () => ({
  db: {
    restaurantSettings: { findFirst: mocks.restaurantSettingsFindFirst },
    location: { findUnique: mocks.locationFindUnique, findFirst: mocks.locationFindFirst },
    receipt: { count: mocks.receiptCount },
    purchaseOrder: { create: mocks.purchaseOrderCreate },
    shift: { create: mocks.shiftCreate },
    timeEntry: { findFirst: mocks.timeEntryFindFirst, create: mocks.timeEntryCreate },
    employee: { findUnique: mocks.employeeFindUnique },
    employeeJob: { findUnique: vi.fn().mockResolvedValue(null) },
    openingHours: {
      deleteMany: mocks.openingHoursDeleteMany,
      createMany: mocks.openingHoursCreateMany,
      create: mocks.openingHoursCreate,
    },
    guestFeedback: { create: mocks.guestFeedbackCreate },
    zReport: { findFirst: mocks.zReportFindFirst },
    order: { findMany: mocks.orderFindMany },
    cashRegisterShift: { findMany: mocks.cashRegisterShiftFindMany },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      zReport: { findFirst: mocks.txZReportFindFirst, create: mocks.txZReportCreate },
      // R103: time-entries POST tok v tx klientu (Serializable — fresh probe
      // + create atomarno); modeli delijo mocke z db klientom
      employee: { findUnique: mocks.employeeFindUnique },
      employeeJob: { findUnique: vi.fn().mockResolvedValue(null) },
      timeEntry: { findFirst: mocks.timeEntryFindFirst, create: mocks.timeEntryCreate },
    })),
  },
  // createAuditLog je TOP-LEVEL export iz '@/lib/db' (ne lastnost db klienta)
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

import { GET as certStatusGET } from '@/app/api/furs/cert-status/route'
import { POST as purchaseOrdersPOST } from '@/app/api/purchase-orders/route'
import { POST as haccpPOST } from '@/app/api/haccp/route'
import { POST as shiftsPOST } from '@/app/api/shifts/route'
import { POST as timeEntriesPOST } from '@/app/api/time-entries/route'
import { POST as openingHoursPOST } from '@/app/api/opening-hours/route'
import { POST as guestFeedbackPOST } from '@/app/api/guests/feedback/route'
import { resolveConfigWriteLocation } from '@/app/api/configuration/_helpers'
import { upsertZReportForDay } from '@/app/api/z-report/_helpers'
import { executeTool } from '@/lib/ai-tools'
import '@/lib/ai-tools/default-tools'

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

function jsonReq(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.restaurantSettingsFindFirst.mockResolvedValue({
    fursCertPath: '',
    fursCertPassword: 'global-pw',
    fursEnvironment: 'test',
  })
  mocks.locationFindUnique.mockResolvedValue(null)
  mocks.locationFindFirst.mockResolvedValue({ id: LOC_A })
  mocks.receiptCount.mockResolvedValue(0)
  mocks.getNextCounter.mockResolvedValue(1)
  mocks.purchaseOrderCreate.mockResolvedValue({ id: 'po-1', poNumber: 'ND-2026-000001' })
  mocks.haccpChainCreate.mockResolvedValue({ id: 'haccp-1' })
  mocks.shiftCreate.mockResolvedValue({ id: 'shift-1' })
  mocks.timeEntryFindFirst.mockResolvedValue(null)
  mocks.employeeFindUnique.mockResolvedValue({ id: 'emp-2', locationId: LOC_A, role: 'waiter' })
  mocks.timeEntryCreate.mockResolvedValue({ id: 'te-1', totalMinutes: 0 })
  mocks.openingHoursDeleteMany.mockResolvedValue({ count: 0 })
  mocks.openingHoursCreateMany.mockResolvedValue({ count: 7 })
  mocks.openingHoursCreate.mockResolvedValue({ id: 'oh-1' })
  mocks.guestFeedbackCreate.mockResolvedValue({ id: 'gf-1' })
  mocks.zReportFindFirst.mockResolvedValue(null)
  mocks.txZReportFindFirst.mockResolvedValue(null)
  mocks.txZReportCreate.mockResolvedValue({ id: 'z-1', createdAt: new Date() })
  mocks.orderFindMany.mockResolvedValue([])
  mocks.buildReportData.mockReturnValue({ totalSales: 0 })
  mocks.cashRegisterShiftFindMany.mockResolvedValue([])
  mocks.runAllFraudChecks.mockResolvedValue({
    alerts: [],
    summary: { total: 0, bySeverity: { critical: 0, high: 0, medium: 0, low: 0 }, byType: {} },
  })
})

// ══════════════════════════════════════════════════════════════════
// A. FURS CERT-STATUS (permission ≠ vloga vektor)
// ══════════════════════════════════════════════════════════════════
describe('R87-4 A: /api/furs/cert-status — resolver takoj za requireAuth', () => {
  it('regular user (permission admin) BREZ lokacije → 403 + ZERO db klicev', async () => {
    mockSession({ role: 'staff', locationId: null, permissions: ['admin'] })
    const res = await certStatusGET(new Request('http://localhost:3000/api/furs/cert-status'))
    expect(res.status).toBe(403)
    expect(mocks.restaurantSettingsFindFirst).not.toHaveBeenCalled()
    expect(mocks.locationFindUnique).not.toHaveBeenCalled()
    expect(mocks.receiptCount).not.toHaveBeenCalled()
  })

  it('loc-bound admin → location.findUnique pinned na LASTNO lokacijo + count-i scoped', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.locationFindUnique.mockResolvedValue({
      fursCertPath: '/certs/loc-a.p12',
      fursCertPassword: 'loc-pw',
      fursEnvironment: 'production',
    })
    const res = await certStatusGET(new Request('http://localhost:3000/api/furs/cert-status'))
    expect(res.status).toBe(200)
    expect(mocks.locationFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: LOC_A } }),
    )
    // oba receipt.count-a scoped na lastno lokacijo
    expect(mocks.receiptCount).toHaveBeenCalledTimes(2)
    for (const call of mocks.receiptCount.mock.calls) {
      expect(call[0].where.locationId).toBe(LOC_A)
    }
    // per-location override zmaga nad globalnimi settings
    const body = await res.json()
    expect(body.certificate.environment).toBe('production')
    expect(body.certificate.hasPassword).toBe(true)
  })

  it('super-admin (vloga, NULL lokacija) → dokumentiran globalni settings pogled (brez location override)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    const res = await certStatusGET(new Request('http://localhost:3000/api/furs/cert-status'))
    expect(res.status).toBe(200)
    expect(mocks.locationFindUnique).not.toHaveBeenCalled()
    // count-i brez locationId ključa (nikoli { locationId: null })
    expect(Object.prototype.hasOwnProperty.call(mocks.receiptCount.mock.calls[0][0].where, 'locationId')).toBe(false)
    const body = await res.json()
    expect(body.certificate.environment).toBe('test') // global settings fallback
  })
})

// ══════════════════════════════════════════════════════════════════
// B. LOCATION-FALLBACK CONSUMERS → resolver + resolveWriteLocationId
// ══════════════════════════════════════════════════════════════════
describe('R87-4 B1: POST /api/purchase-orders', () => {
  const validBody = {
    supplierId: 'sup-1',
    items: [{ description: 'Moka', quantityOrdered: 10, unitPrice: 1.5 }],
  }

  it('regular NULL-location seja → 403 + ZERO db (resolver pred body parse: neveljaven body ne povzroči 400)', async () => {
    mockSession({ role: 'staff', locationId: null })
    const res = await purchaseOrdersPOST(jsonReq('http://localhost:3000/api/purchase-orders', { bad: true }))
    expect(res.status).toBe(403)
    expect(mocks.getNextCounter).not.toHaveBeenCalled()
    expect(mocks.purchaseOrderCreate).not.toHaveBeenCalled()
  })

  it('loc-bound admin → create žigan z LASTNO lokacijo (tuji body vplivov ni)', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await purchaseOrdersPOST(jsonReq(`http://localhost:3000/api/purchase-orders?locationId=${LOC_B}`, validBody))
    expect(res.status).toBe(201)
    expect(mocks.purchaseOrderCreate.mock.calls[0][0].data.locationId).toBe(LOC_A)
  })

  it('super-admin brez ?locationId → 400 fail-closed (ne global-first stamp)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    const res = await purchaseOrdersPOST(jsonReq('http://localhost:3000/api/purchase-orders', validBody))
    expect(res.status).toBe(400)
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
    expect(mocks.purchaseOrderCreate).not.toHaveBeenCalled()
  })
})

describe('R87-4 B2: POST /api/haccp', () => {
  const validBody = { category: 'temperature', title: 'Hladilnik 4°C' }

  it('regular NULL-location seja s permission admin → 403 + chain helper NI klican', async () => {
    mockSession({ role: 'staff', locationId: null, permissions: ['admin'] })
    const res = await haccpPOST(jsonReq('http://localhost:3000/api/haccp', validBody))
    expect(res.status).toBe(403)
    expect(mocks.haccpChainCreate).not.toHaveBeenCalled()
  })

  it('loc-bound admin → HACCP vnos žigan z lastno lokacijo', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await haccpPOST(jsonReq('http://localhost:3000/api/haccp', validBody))
    expect(res.status).toBe(201)
    expect(mocks.haccpChainCreate.mock.calls[0][0].locationId).toBe(LOC_A)
  })

  it('super-admin brez ?locationId → 400 fail-closed', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    const res = await haccpPOST(jsonReq('http://localhost:3000/api/haccp', validBody))
    expect(res.status).toBe(400)
    expect(mocks.haccpChainCreate).not.toHaveBeenCalled()
  })
})

describe('R87-4 B3: POST /api/shifts', () => {
  const validBody = { employeeId: 'emp-2', date: '2026-01-05', startTime: '09:00', endTime: '17:00' }

  it('regular NULL-location seja → 403 + shift.create NI klican', async () => {
    mockSession({ role: 'staff', locationId: null })
    const res = await shiftsPOST(jsonReq('http://localhost:3000/api/shifts', validBody))
    expect(res.status).toBe(403)
    expect(mocks.shiftCreate).not.toHaveBeenCalled()
  })

  it('loc-bound admin → shift.create locationId = session lokacija (body employeeId ne premakne žiga)', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await shiftsPOST(jsonReq('http://localhost:3000/api/shifts', validBody))
    expect(res.status).toBe(201)
    expect(mocks.shiftCreate.mock.calls[0][0].data.locationId).toBe(LOC_A)
  })

  it('super-admin brez ?locationId → 400 fail-closed (prej: prva lokacija katerga koli tenanta)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    const res = await shiftsPOST(jsonReq('http://localhost:3000/api/shifts', validBody))
    expect(res.status).toBe(400)
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
    expect(mocks.shiftCreate).not.toHaveBeenCalled()
  })
})

describe('R87-4 B4: POST /api/time-entries', () => {
  const validBody = { employeeId: 'emp-2', clockIn: '2026-01-05T09:00:00Z' }

  it('super-admin brez ?locationId → 400 fail-closed + location.findFirst NI klican (prej payroll žig prve lokacije)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    const res = await timeEntriesPOST(jsonReq('http://localhost:3000/api/time-entries', validBody))
    expect(res.status).toBe(400)
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
    expect(mocks.timeEntryCreate).not.toHaveBeenCalled()
  })

  it('loc-bound admin → timeEntry.create locationId = session lokacija', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await timeEntriesPOST(jsonReq('http://localhost:3000/api/time-entries', validBody))
    expect(res.status).toBe(201)
    expect(mocks.timeEntryCreate.mock.calls[0][0].data.locationId).toBe(LOC_A)
  })
})

describe('R87-4 B5: POST /api/opening-hours (batch)', () => {
  const batchBody = { hours: [{ dayOfWeek: 1 }] }

  it('super-admin brez izrecne lokacije (query/body) → 400 + deleteMany/createMany NIČ (prej deleteMany+recreate prve lokacije)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    const res = await openingHoursPOST(jsonReq('http://localhost:3000/api/opening-hours', batchBody))
    expect(res.status).toBe(400)
    expect(mocks.openingHoursDeleteMany).not.toHaveBeenCalled()
    expect(mocks.openingHoursCreateMany).not.toHaveBeenCalled()
  })

  it('super-admin z izrecnim body.locationId → deleteMany + createMany na PODANI lokaciji (izrecna izbira ostane)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    const res = await openingHoursPOST(jsonReq('http://localhost:3000/api/opening-hours', { ...batchBody, locationId: LOC_B }))
    expect(res.status).toBe(201)
    expect(mocks.openingHoursDeleteMany).toHaveBeenCalledWith({ where: { locationId: LOC_B } })
    expect(mocks.openingHoursCreateMany.mock.calls[0][0].data[0].locationId).toBe(LOC_B)
  })
})

describe('R87-4 B6: POST /api/guests/feedback', () => {
  const validBody = { guestName: 'Ana', overallRating: 5, comment: 'Odlično' }

  it('regular NULL-location take_orders seja → 403 + guestFeedback.create NI klican', async () => {
    mockSession({ role: 'staff', locationId: null })
    const res = await guestFeedbackPOST(jsonReq('http://localhost:3000/api/guests/feedback', validBody))
    expect(res.status).toBe(403)
    expect(mocks.guestFeedbackCreate).not.toHaveBeenCalled()
  })

  it('loc-bound admin → PII povratna informacija žigana z lastno lokacijo', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await guestFeedbackPOST(jsonReq('http://localhost:3000/api/guests/feedback', validBody))
    expect(res.status).toBe(201)
    expect(mocks.guestFeedbackCreate.mock.calls[0][0].data.locationId).toBe(LOC_A)
  })
})

describe('R87-4 B7: resolveConfigWriteLocation (configuration/_helpers)', () => {
  // Poln Session objekt (AuthResultLike = Awaited<ReturnType<typeof requireAuth>>)
  const authLike = (overrides: Record<string, unknown>) => ({
    session: {
      token: 'tok-test',
      employeeId: 'emp-1',
      role: 'admin',
      permissions: ['admin'],
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
      absoluteExpiry: Date.now() + 60_000,
      ...overrides,
    },
    error: null,
  })

  it('super-admin brez ?locationId → 400 fail-closed + employee lookup / location.findFirst NIČ (global-first fallback odstranjen)', async () => {
    const req = new Request('http://localhost:3000/api/configuration')
    const res = await resolveConfigWriteLocation(authLike({ employeeId: 'emp-1', role: 'super_admin', locationId: null }), req)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.response.status).toBe(400)
    expect(mocks.employeeFindUnique).not.toHaveBeenCalled()
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
  })

  it('super-admin z ?locationId= → izrecna lokacija; loc-bound seja → lastna (query ignoriran)', async () => {
    const explicit = await resolveConfigWriteLocation(
      authLike({ employeeId: 'emp-1', role: 'super_admin', locationId: null }),
      new Request(`http://localhost:3000/api/configuration?locationId=${LOC_B}`),
    )
    expect(explicit.ok).toBe(true)
    if (explicit.ok) expect(explicit.locationId).toBe(LOC_B)

    const bound = await resolveConfigWriteLocation(
      authLike({ employeeId: 'emp-1', role: 'admin', locationId: LOC_A }),
      new Request(`http://localhost:3000/api/configuration?locationId=${LOC_B}`),
    )
    expect(bound.ok).toBe(true)
    if (bound.ok) expect(bound.locationId).toBe(LOC_A)
  })
})

// ══════════════════════════════════════════════════════════════════
// C. Z-REPORT UPSERT — locationId obvezen, NIČ internega globalnega fallback-a
// ══════════════════════════════════════════════════════════════════
describe('R87-4 C: upsertZReportForDay — fail-closed brez lokacije', () => {
  it('manjkajoča lokacija → Z_REPORT_NO_LOCATION + ZERO db klicev (prej: žig prve tuje lokacije)', async () => {
    await expect(
      upsertZReportForDay({ date: '2026-01-05', locationId: undefined, employeeId: 'emp-1' }),
    ).rejects.toThrow('Z_REPORT_NO_LOCATION')
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
    expect(mocks.zReportFindFirst).not.toHaveBeenCalled()
    expect(mocks.orderFindMany).not.toHaveBeenCalled()
  })

  it('podana lokacija → vse poizvedbe pinned na locationId', async () => {
    const { report } = await upsertZReportForDay({ date: '2026-01-05', locationId: LOC_A, employeeId: 'emp-1' })
    expect(mocks.zReportFindFirst.mock.calls[0][0].where.locationId).toBe(LOC_A)
    expect(mocks.orderFindMany).toHaveBeenCalledTimes(2)
    for (const call of mocks.orderFindMany.mock.calls) {
      expect(call[0].where.locationId).toBe(LOC_A)
    }
    expect(mocks.txZReportCreate).toHaveBeenCalled()
    // buildReportData je žigan z locationId kot 8. argumentom (report data nosi žig)
    expect(mocks.buildReportData.mock.calls[0][7]).toBe(LOC_A)
    expect(report).toBeDefined()
  })
})

// ══════════════════════════════════════════════════════════════════
// D. AI-TOOLS check_fraud — nikoli več implicitni globalni scan
// ══════════════════════════════════════════════════════════════════
describe('R87-4 D: ai-tools check_fraud — tenant scope iz konteksta', () => {
  it('context.locationId (klicatelj iz resolverja) → runAllFraudChecks z TA lokacijo', async () => {
    const result = await executeTool('check_fraud', {}, {
      permissions: ['admin'],
      locationId: LOC_A,
      dateFrom: new Date('2026-01-01'),
      dateTo: new Date('2026-01-02'),
    })
    expect(result.success).toBe(true)
    expect(mocks.runAllFraudChecks).toHaveBeenCalledTimes(1)
    expect(mocks.runAllFraudChecks.mock.calls[0][3]).toBe(LOC_A)
  })

  it('context brez locationId, employeeId ima lokacijo → lookup + žig na employee.locationId', async () => {
    mocks.employeeFindUnique.mockResolvedValue({ locationId: LOC_B, role: 'waiter' })
    const result = await executeTool('check_fraud', {}, { permissions: ['admin'], employeeId: 'emp-2' })
    expect(result.success).toBe(true)
    expect(mocks.employeeFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'emp-2' } }),
    )
    expect(mocks.runAllFraudChecks.mock.calls[0][3]).toBe(LOC_B)
  })

  it('employee super_admin brez lokacije → null (dokumentiran globalni pogled, admin-gated tool)', async () => {
    mocks.employeeFindUnique.mockResolvedValue({ locationId: null, role: 'super_admin' })
    const result = await executeTool('check_fraud', {}, { permissions: ['admin'], employeeId: 'emp-root' })
    expect(result.success).toBe(true)
    expect(mocks.runAllFraudChecks.mock.calls[0][3]).toBeNull()
  })

  it('employee regular brez lokacije → FAIL-CLOSED: runAllFraudChecks NI klican (prej: null = scan vseh tenantov)', async () => {
    mocks.employeeFindUnique.mockResolvedValue({ locationId: null, role: 'waiter' })
    const result = await executeTool('check_fraud', {}, { permissions: ['admin'], employeeId: 'emp-2' })
    expect(result.success).toBe(false)
    expect(mocks.runAllFraudChecks).not.toHaveBeenCalled()
  })

  it('context brez locationId in employeeId → FAIL-CLOSED (ne globalni scan)', async () => {
    const result = await executeTool('check_fraud', {}, { permissions: ['admin'] })
    expect(result.success).toBe(false)
    expect(mocks.employeeFindUnique).not.toHaveBeenCalled()
    expect(mocks.runAllFraudChecks).not.toHaveBeenCalled()
  })

  it('non-admin permissions → executeTool adminOnly vrata (handler NI klican)', async () => {
    const result = await executeTool('check_fraud', {}, { permissions: ['take_orders'], locationId: LOC_A })
    expect(result.success).toBe(false)
    expect(mocks.runAllFraudChecks).not.toHaveBeenCalled()
  })
})
