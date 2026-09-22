// ============================================
// R110 — EOD ZAKLJUČEK DNEVA + Z-POROČILO FINALIZE KANON
//        — CONCURRENCY & ERROR KONTRAKT (TOCTOU razred R100–R109)
// ============================================
//
// Forenzika (bug-hunt val: "EOD zapiranje + Z-report finalize" —
// glej end-of-day/_helpers/close-shift.ts / z-report/_helpers/
// upsert-z-report.ts R110 headerje):
//
//   EOD-1 (HIGH, POST /api/end-of-day): closeShift je imel NEPOGOJEN
//     cashRegisterShift.update({ where: { id } }) za findFirst
//     { status: 'open' } znotraj READ COMMITTED tx — dva sočasna EOD-a =
//     obadva prebita do pisanja → last-writer-wins na finančnih agregatih
//     (cashSales/expectedCash/cashDifference iz različnih snapshotov) +
//     DUPLIKAT EOD_COMPLETED audit + DVAKRAT sprožena finalizacija
//     Z-poročila. Fix: CAS updateMany { id, status: 'open' }, count 0 →
//     return null (idempotentna veja rute; R104 C1 parity).
//   ZR-1 (HIGH, POST /api/z-report finalize ∥ EOD finalizeReport ∥
//     auto-draft): upsert tx re-check pod READ COMMITTED NE ščiti — dva
//     sočasna finalize-a = last-writer-wins na FINALIZIRANEM finančnem
//     poročilu (fiskalni žig brez zaščite); create∥create = P2002 → 500.
//     Fix: advisory lock 'z-report:{locationId}:{date}' + Serializable +
//     CAS updateMany { status: { not: 'finalized' } } + P2034 → 409.
//   ZR-2 (MEDIUM): statistike izven tx = stale snapshot → finalizirano
//     poročilo z zastarelo prodajo/DDV. Fix: vsa branja + calculateReportStats
//     ZNOTRAJ tx (stats sprejme opcionalen tx klient).
//
// Pokritje: A EOD closeShift CAS kanon · B Z-report upsert kanon ·
// C route kontrakt (structured passthrough + Z_REPORT_* mapping) ·
// D fs-pini (vir pini).
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { Prisma } from '@prisma/client'

const LOC_A = 'loc-tenant-a'
const SHIFT_ID = 'shift-1'

// --- Mocki (vi.hoisted) ---
const mocks = vi.hoisted(() => ({
  // A (EOD closeShift) + B (Z-report kanon): skupni $transaction mock
  transaction: vi.fn(),
  txExecuteRaw: vi.fn(),
  // A — EOD closeShift
  aShiftFindFirst: vi.fn(),
  aShiftUpdateMany: vi.fn(),
  aShiftUpdateForbidden: vi.fn(),
  aOrderFindMany: vi.fn(),
  // B — Z-report upsert
  bZReportFindFirst: vi.fn(), // tx re-check
  bZReportUpdateMany: vi.fn(),
  bZReportCreate: vi.fn(),
  bShiftCount: vi.fn(),
  bShiftFindMany: vi.fn(),
  bOrderFindMany: vi.fn(),
  dbZReportFindFirst: vi.fn(), // fast-exit pre-check
  calculateReportStats: vi.fn(),
  buildReportData: vi.fn(),
  // C — route kontrakt
  requireAuth: vi.fn(),
  zUpsert: vi.fn(),
}))

// Privzeti tx klient — kanon kliče db.$transaction(fn, options)
const txClient = {
  $executeRaw: mocks.txExecuteRaw,
  // A — EOD closeShift
  cashRegisterShift: {
    findFirst: mocks.aShiftFindFirst,
    updateMany: mocks.aShiftUpdateMany,
    update: mocks.aShiftUpdateForbidden, // NE SME biti klican (nepogojen update izničen)
    count: mocks.bShiftCount, // B finalize gate (isti model)
    findMany: mocks.bShiftFindMany, // B stats/cashShifts
  },
  // B — Z-report upsert
  zReport: {
    findFirst: mocks.bZReportFindFirst,
    updateMany: mocks.bZReportUpdateMany,
    create: mocks.bZReportCreate,
  },
  order: {
    findMany: mocks.aOrderFindMany, // A paid orders (isti model, ločena mocka od B)
  },
}


vi.mock('@/lib/db', () => ({
  db: {
    $transaction: mocks.transaction,
    zReport: { findFirst: mocks.dbZReportFindFirst },
  },
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/email', () => ({
  createScheduledEmailLog: vi.fn().mockResolvedValue({ success: true, skipped: true, reason: 'disabled' }),
  sendZReportEmail: vi.fn().mockResolvedValue(undefined),
  isEmailEnabled: vi.fn().mockResolvedValue(false),
  getReportRecipients: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/app/api/reports/export/_helpers', () => ({
  fetchReportData: vi.fn().mockResolvedValue({}),
  generateReportPdf: vi.fn().mockResolvedValue(Buffer.from('')),
}))

vi.mock('@/app/api/z-report/_helpers/stats', () => ({
  calculateReportStats: mocks.calculateReportStats,
}))

vi.mock('@/app/api/z-report/_helpers/build-report', () => ({
  buildReportData: mocks.buildReportData,
}))

vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: mocks.requireAuth,
  resolveTenantLocationId: vi.fn(),
  tenantScopeToWhere: vi.fn(),
}))

vi.mock('@/app/api/z-report/_helpers', () => ({
  upsertZReportForDay: mocks.zUpsert,
  calculateReportStats: vi.fn(),
  buildReportData: vi.fn(),
}))

// Utišaj logger
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

import { closeShift } from '@/app/api/end-of-day/_helpers/close-shift'
import { upsertZReportForDay } from '@/app/api/z-report/_helpers/upsert-z-report'
import { createAuditLog } from '@/lib/db'
import { POST as zReportPOST } from '@/app/api/z-report/route'

const ACTIVE_SHIFT = {
  id: SHIFT_ID,
  status: 'open',
  openedAt: new Date('2026-01-05T08:00:00Z'),
  startingCash: 50,
  locationId: LOC_A,
}

const PAID_ORDER_ONE_CASH = {
  discount: 0,
  checks: [{ payments: [{ type: 'cash', amount: 100, tipAmount: 10, refundAmount: 0 }] }],
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.txExecuteRaw.mockResolvedValue(1)
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(txClient))
  // A defaults
  mocks.aShiftFindFirst.mockResolvedValue({ ...ACTIVE_SHIFT })
  mocks.aOrderFindMany.mockResolvedValue([PAID_ORDER_ONE_CASH])
  mocks.aShiftUpdateMany.mockResolvedValue({ count: 1 })
  mocks.aShiftUpdateForbidden.mockRejectedValue(new Error('NEPOGOJEN update je prepovedan (R110 EOD-1) — uporabi updateMany CAS'))
  // B defaults
  mocks.dbZReportFindFirst.mockResolvedValue(null)
  mocks.bZReportFindFirst.mockResolvedValue(null)
  mocks.bZReportCreate.mockResolvedValue({ id: 'z-new', createdAt: new Date() })
  mocks.bZReportUpdateMany.mockResolvedValue({ count: 1 })
  mocks.bShiftCount.mockResolvedValue(0)
  mocks.bShiftFindMany.mockResolvedValue([])
  mocks.bOrderFindMany.mockResolvedValue([])
  mocks.calculateReportStats.mockResolvedValue({
    totalSales: 0, totalNetSales: 0, totalTax: 0, cashSales: 0, cardSales: 0, mobileSales: 0,
    alternateSales: 0, dineInSales: 0, takeoutSales: 0, deliverySales: 0, vatStandard: 0,
    vatStandardAmount: 0, vatReduced: 0, vatReducedAmount: 0, vatZero: 0, totalDiscounts: 0,
    totalTips: 0, totalVoided: 0, totalCost: 0, totalGuests: 0, totalStorno: 0,
    startingCash: 0, expectedCash: 0,
  })
  mocks.buildReportData.mockReturnValue({ reportDate: new Date('2026-01-04T23:00:00Z') })
  // C defaults
  mocks.requireAuth.mockResolvedValue({
    session: { employeeId: 'emp-1', role: 'admin', locationId: LOC_A },
    error: null,
  })
})

// ══════════════════════════════════════════════════════════════════
// A. EOD closeShift — CAS kanon (EOD-1, R104 C1 parity)
// ══════════════════════════════════════════════════════════════════
describe('R110 A: EOD closeShift — pogojna vrata namesto nepogojenega update-a', () => {
  it('CAS updateMany: where { id, status: \'open\' } — pogojna vrata na status', async () => {
    await closeShift('2026-01-05', 160, '', LOC_A, 'emp-1')
    expect(mocks.aShiftUpdateMany).toHaveBeenCalledTimes(1)
    const call = mocks.aShiftUpdateMany.mock.calls[0][0]
    expect(call.where).toMatchObject({ id: SHIFT_ID, status: 'open' })
    expect(call.data.status).toBe('closed')
  })

  it('count 0 (konkurenčni close je zmagal) → return null + NI EOD_COMPLETED audita + NI finalizacije sprožilca', async () => {
    mocks.aShiftUpdateMany.mockResolvedValue({ count: 0 })
    const result = await closeShift('2026-01-05', 160, '', LOC_A, 'emp-1')
    expect(result).toBeNull()
    expect(createAuditLog).not.toHaveBeenCalled()
  })

  it('count 1 (zmagovalec) → { cashDifference, shiftId } + EOD_COMPLETED audit + neto plačila', async () => {
    // actualCash 160 = expectedCash (50 starting + 100 cash + 10 cash tip) → diff 0
    const result = await closeShift('2026-01-05', 160, '', LOC_A, 'emp-1')
    expect(result).toMatchObject({ cashDifference: 0, shiftId: SHIFT_ID })
    expect(createAuditLog).toHaveBeenCalledTimes(1)
    expect((createAuditLog as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({
      action: 'EOD_COMPLETED',
      entityType: 'EndOfDay',
    })
    // neto cash sales (amount − refundAmount = 100) zapisan v shift agregate
    expect(mocks.aShiftUpdateMany.mock.calls[0][0].data.cashSales).toBe(100)
    expect(mocks.aShiftUpdateMany.mock.calls[0][0].data.expectedCash).toBe(160)
  })

  it('NEPOGOJEN update je izničen (fs-pin behavioral): tx.cashRegisterShift.update() se ne kliče', async () => {
    await closeShift('2026-01-05', 160, '', LOC_A, 'emp-1')
    expect(mocks.aShiftUpdateForbidden).not.toHaveBeenCalled()
  })

  it('ni odprte izmene → return null (obstoječa idempotentna pogodba neokrnjena)', async () => {
    mocks.aShiftFindFirst.mockResolvedValue(null)
    const result = await closeShift('2026-01-05', 160, '', LOC_A, 'emp-1')
    expect(result).toBeNull()
    expect(mocks.aShiftUpdateMany).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// B. Z-report upsert kanon (ZR-1/ZR-2)
// ══════════════════════════════════════════════════════════════════
describe('R110 B: Z-report upsert — advisory lock + Serializable + CAS + tx-fresh branja', () => {
  it('advisory lock: pg_advisory_xact_lock z ključem z-report:{locationId}:{date}', async () => {
    await upsertZReportForDay({ date: '2026-01-05', locationId: LOC_A, employeeId: 'emp-1' })
    expect(mocks.txExecuteRaw).toHaveBeenCalledTimes(1)
    // tagged template: (stringsArray, ...values) — 2. element = lock param
    const [sql, lockParam] = mocks.txExecuteRaw.mock.calls[0]
    expect(String(sql[0])).toContain('pg_advisory_xact_lock')
    expect(String(sql[0])).toContain('hashtext')
    expect(lockParam).toBe(`z-report:${LOC_A}:2026-01-05`)
  })

  it('Serializable izolacija: $transaction options { isolationLevel: Serializable }', async () => {
    await upsertZReportForDay({ date: '2026-01-05', locationId: LOC_A, employeeId: 'emp-1' })
    expect(mocks.transaction.mock.calls[0][1]).toMatchObject({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })
  })

  it('ZR-2: calculateReportStats prejme tx klienta (stats teče na istem snapshot-u)', async () => {
    await upsertZReportForDay({ date: '2026-01-05', locationId: LOC_A, employeeId: 'emp-1' })
    expect(mocks.calculateReportStats).toHaveBeenCalledTimes(1)
    // 6. argument = tx klient (isti objekt, ki ga je $transaction podal kanonu)
    expect(mocks.calculateReportStats.mock.calls[0][5]).toBe(txClient)
    // branja naročil tečejo na tx klientu (2× : paid + storno) —
    // skupni txClient: order.findMany je aOrderFindMany (deljen A/B)
    expect(mocks.aOrderFindMany).toHaveBeenCalledTimes(2)
    for (const call of mocks.aOrderFindMany.mock.calls) {
      expect(call[0].where.locationId).toBe(LOC_A)
    }
    // tudi cashShifts read je tx-fresh
    expect(mocks.bShiftFindMany).toHaveBeenCalledTimes(1)
  })

  it('finalize gate je tx-fresh: odprte izmene prešteje ZNOTRAJ tx (OPEN_SHIFTS:n)', async () => {
    mocks.bShiftCount.mockResolvedValue(2)
    await expect(
      upsertZReportForDay({ date: '2026-01-05', locationId: LOC_A, employeeId: 'emp-1', finalize: true }),
    ).rejects.toThrow('OPEN_SHIFTS:2')
    expect(mocks.bShiftCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'open', locationId: LOC_A }),
      }),
    )
    // gate fail → NI upserta
    expect(mocks.bZReportCreate).not.toHaveBeenCalled()
    expect(mocks.bZReportUpdateMany).not.toHaveBeenCalled()
  })

  it('CAS update: draft → updateMany { id, status: { not: \'finalized\' } } + združen report', async () => {
    mocks.bZReportFindFirst.mockResolvedValue({ id: 'z-1', status: 'draft', createdAt: new Date() })
    const { report } = await upsertZReportForDay({ date: '2026-01-05', locationId: LOC_A, employeeId: 'emp-1' })
    expect(mocks.bZReportUpdateMany).toHaveBeenCalledTimes(1)
    const call = mocks.bZReportUpdateMany.mock.calls[0][0]
    expect(call.where).toMatchObject({ id: 'z-1', status: { not: 'finalized' } })
    expect(report.id).toBe('z-1')
    expect(mocks.bZReportCreate).not.toHaveBeenCalled()
  })

  it('CAS count 0 (draft je med ključavnico postal finalized) → Z_REPORT_FINALIZED', async () => {
    mocks.bZReportFindFirst.mockResolvedValue({ id: 'z-1', status: 'draft', createdAt: new Date() })
    mocks.bZReportUpdateMany.mockResolvedValue({ count: 0 })
    await expect(
      upsertZReportForDay({ date: '2026-01-05', locationId: LOC_A, employeeId: 'emp-1', finalize: true }),
    ).rejects.toThrow('Z_REPORT_FINALIZED')
    expect(mocks.bZReportCreate).not.toHaveBeenCalled()
  })

  it('create pot: brez obstoječega poročila → tx.zReport.create (brez updateMany)', async () => {
    const { report } = await upsertZReportForDay({ date: '2026-01-05', locationId: LOC_A, employeeId: 'emp-1' })
    expect(mocks.bZReportCreate).toHaveBeenCalledTimes(1)
    expect(mocks.bZReportUpdateMany).not.toHaveBeenCalled()
    expect(report.id).toBe('z-new')
    // create data nosi lokacijski žig
    expect(mocks.buildReportData.mock.calls[0][7]).toBe(LOC_A)
  })

  it('P2034 Serializable konflikt → strukturiran { error: Z_REPORT_CONFLICT, status: 409 }', async () => {
    mocks.transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Transaction conflict, please retry', {
        code: 'P2034',
        clientVersion: 'test',
      }),
    )
    await expect(
      upsertZReportForDay({ date: '2026-01-05', locationId: LOC_A, employeeId: 'emp-1' }),
    ).rejects.toMatchObject({ error: 'Z_REPORT_CONFLICT', status: 409 })
  })

  it('hitri izhod: že-finalizirano poročilo (db pre-check) → Z_REPORT_FINALIZED brez tx', async () => {
    mocks.dbZReportFindFirst.mockResolvedValue({ id: 'z-9', status: 'finalized' })
    await expect(
      upsertZReportForDay({ date: '2026-01-05', locationId: LOC_A, employeeId: 'emp-1' }),
    ).rejects.toThrow('Z_REPORT_FINALIZED')
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('manjkajoča lokacija → Z_REPORT_NO_LOCATION (fail-closed pogodba neokrnjena)', async () => {
    await expect(
      upsertZReportForDay({ date: '2026-01-05', locationId: undefined, employeeId: 'emp-1' }),
    ).rejects.toThrow('Z_REPORT_NO_LOCATION')
    expect(mocks.dbZReportFindFirst).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// C. Route kontrakt — POST /api/z-report (structured passthrough + mapping)
// ══════════════════════════════════════════════════════════════════
describe('R110 C: POST /api/z-report — error kontrakt', () => {
  function postReq(body: unknown): Request {
    return new Request('http://localhost/api/z-report', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('strukturirana napaka (P2034 → Z_REPORT_CONFLICT/409) → 409 passthrough (prej 500)', async () => {
    mocks.zUpsert.mockRejectedValue({ error: 'Z_REPORT_CONFLICT', status: 409 })
    const res = await zReportPOST(postReq({ date: '2026-01-05', finalize: true }))
    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toMatchObject({ error: 'Z_REPORT_CONFLICT' })
  })

  it('Z_REPORT_FINALIZED Error → 400 (obstoječi mapping ohranjen)', async () => {
    mocks.zUpsert.mockRejectedValue(new Error('Z_REPORT_FINALIZED'))
    const res = await zReportPOST(postReq({ date: '2026-01-05', finalize: true }))
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: 'Z-poročilo za ta dan je že zaključeno' })
  })

  it('OPEN_SHIFTS Error → 400 (obstoječi mapping ohranjen)', async () => {
    mocks.zUpsert.mockRejectedValue(new Error('OPEN_SHIFTS:3'))
    const res = await zReportPOST(postReq({ date: '2026-01-05', finalize: true }))
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining('odprte blagajniške izmene') })
  })

  it('neznana napaka → 500 fallback (fallback neokrnjen)', async () => {
    mocks.zUpsert.mockRejectedValue(new Error('DB down'))
    const res = await zReportPOST(postReq({ date: '2026-01-05', finalize: true }))
    expect(res.status).toBe(500)
  })
})

// ══════════════════════════════════════════════════════════════════
// D. fs-pini — vir pini (regresija zaščita)
// ══════════════════════════════════════════════════════════════════
describe('R110 D: fs-pini — kanon pini v viru', () => {
  const closeShiftSrc = readFileSync(
    join(process.cwd(), 'src/app/api/end-of-day/_helpers/close-shift.ts'), 'utf-8')
  const upsertSrc = readFileSync(
    join(process.cwd(), 'src/app/api/z-report/_helpers/upsert-z-report.ts'), 'utf-8')
  const statsSrc = readFileSync(
    join(process.cwd(), 'src/app/api/z-report/_helpers/stats.ts'), 'utf-8')
  const routeSrc = readFileSync(
    join(process.cwd(), 'src/app/api/z-report/route.ts'), 'utf-8')

  it('EOD closeShift: CAS updateMany (status open) prisoten, nepogojen update() odsoten', () => {
    expect(closeShiftSrc).toContain("status: 'open'")
    expect(closeShiftSrc).toContain('updateMany')
    expect(closeShiftSrc).toContain('casClose.count === 0')
    // NEPOGOJEN update na izmeni ne sme obstajati (updateMany vsebuje ".update", 
    // zato pinamo točno ".update(" za shift modelom)
    expect(closeShiftSrc).not.toMatch(/cashRegisterShift\.update\(/)
  })

  it('Z-report upsert: advisory lock + Serializable + CAS + P2034 mapping pini', () => {
    expect(upsertSrc).toContain('pg_advisory_xact_lock')
    expect(upsertSrc).toContain('hashtext')
    expect(upsertSrc).toContain('TransactionIsolationLevel.Serializable')
    expect(upsertSrc).toContain("status: { not: 'finalized' }")
    expect(upsertSrc).toContain("'P2034'")
    expect(upsertSrc).toContain('Z_REPORT_CONFLICT')
    // nepogojen zReport.update() ne sme obstajati (CAS updateMany je edini update)
    expect(upsertSrc).not.toMatch(/zReport\.update\(/)
  })

  it('stats: opcionalen tx klient (interni cashRegisterShift.findMany prek client)', () => {
    expect(statsSrc).toContain("client: Pick<typeof db, 'cashRegisterShift'>")
    expect(statsSrc).toContain('client.cashRegisterShift.findMany')
  })

  it('z-report route: strukturirani passthrough pred pattern matchingom', () => {
    expect(routeSrc).toContain("typeof (error as { status: unknown }).status === 'number'")
    expect(routeSrc).toContain('Z_REPORT_FINALIZED')
  })
})
