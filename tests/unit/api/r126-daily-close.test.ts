// ============================================
// R126 / EPIC #115 P0-02 — DAILY CLOSE (dnevni zaključek / reconciliation)
// ============================================
// Pokritje (kanon R126-a):
//  • POST happy path znotraj praga → CLOSED + samodejna odobritev
//    (approvedBy = closedBy) + Z-report finalize (finalize:true,
//    actualCash = countedCash) + audit DAILY_CLOSE_CREATED
//  • POST nad pragom → PENDING_APPROVAL, Z finalize NI klican (ostane draft)
//  • Idempotencija: replay isti idempotencyKey → 200 replay:true BREZ
//    transakcijskih stranskih učinkov (brez Z-report upserta, brez audita)
//  • P2002 (unique race na businessDate) → 409
//  • CLOSED → ponoven POST → 409 DAILY_CLOSE_ALREADY_CLOSED
//  • REOPENED → re-close: overwrite + reopenCount OHRANJEN + audit RECLOSED
//  • PENDING_APPROVAL → re-count: update + audit RECOUNT
//  • OPEN_SHIFTS:n → 400 z openShifts extra; Z_REPORT_CONFLICT → 409 passthrough
//  • MODEL A: 403 staff brez lokacije (tudi z body.locationId); super-admin
//    body.locationId deluje; brez obeh → 400; LOCATION_NOT_FOUND → 404
//  • GET seznam: scope + date (businessDate bounds) / from/to / status filtri
//  • GET detail: tuja lokacija → 404
//  • approve: CAS uspeh → CLOSED + Z finalize + audit; CAS 0 → 409; 403 brez admin
//  • reject: → REOPENED + rejectedNote + reopenCount++ + audit; razlog obvezen;
//    409 ni pending; Z-report nedotaknjen
//  • reopen: → REOPENED + reopenCount+1 + Z-report nazaj draft (CAS where
//    finalized/approved) + 2 audita v vrstnem redu; razlog obvezen; 409 ni
//    CLOSED; tuja lokacija → 404
//  • Variance matematika: manjkajoč denar (negativna) IN višek (pozitivna);
//    prag točno na meji (variance == threshold → CLOSED; +0.01 → PENDING)
//  • Z_REPORT_FINALIZED pri finalize → toleriran kot idempotentno OK
//
// Trap DB (hišni stil R124/R121/R125): vi.hoisted trap + getter; klicane so
// PRODUKCIJSKE route funkcije direktno; mockana MEJA je samo requireAuth +
// createAuditLog + upsertZReportForDay (strukturirane napake) + rate-limit;
// resolveTenantLocationId/OrThrow + isWithinScope ostanejo REALNI (pure).
// Decimal → number v trapu (route dela prek toNum/round2).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { ljubljanaDayBounds } from '@/lib/timezone-sl'

const LOC_1 = 'loc-1'
const LOC_2 = 'loc-2'
const EMP_1 = 'emp-1'
const EMP_NAME = 'Ana Novak'
const DATE = '2026-08-05'
const DAY_START = ljubljanaDayBounds(DATE).start
const DAY_END = ljubljanaDayBounds(DATE).end

// ---------- Vrstice ----------
interface DailyCloseRow {
  id: string
  locationId: string
  businessDate: Date
  status: string
  expectedCash: number
  countedCash: number
  cashVariance: number
  varianceThreshold: number
  totalSales: number
  cashSales: number
  cardSales: number
  mobileSales: number
  alternateSales: number
  totalOrders: number
  totalDiscounts: number
  totalTips: number
  totalVoided: number
  totalRefunds: number
  closedById: string | null
  closedByName: string
  closedAt: Date | null
  approvedById: string | null
  approvedByName: string
  approvedAt: Date | null
  approvalNote: string
  rejectedNote: string
  reopenCount: number
  reopenedById: string | null
  reopenedByName: string
  reopenedAt: Date | null
  reopenReason: string
  notes: string
  zReportId: string | null
  idempotencyKey: string
  createdAt: Date
  updatedAt: Date
}
interface LocationRow { id: string; dailyCloseVarianceThreshold: number }
interface ShiftRow { id: string; locationId: string | null; status: string; openedAt: Date; closedAt: Date | null }
interface ZReportRow { id: string; reportDate: Date; locationId: string | null; status: string }
interface EmployeeRow { id: string; name: string; locationId: string | null }

// ---------- Trap DB ----------
function createDb() {
  let seq = 0
  const id = (p: string) => `${p}-${++seq}`

  const closes: DailyCloseRow[] = []
  const locations: LocationRow[] = []
  const shifts: ShiftRow[] = []
  const zReports: ZReportRow[] = []
  const employees: EmployeeRow[] = []
  const audit: Array<Record<string, unknown>> = []
  const captured = {
    closeFindUnique: [] as Array<Record<string, unknown>>,
    closeFindMany: [] as Array<Record<string, unknown>>,
    closeCreate: [] as Array<Record<string, unknown>>,
    closeUpdate: [] as Array<Record<string, unknown>>,
    closeUpdateMany: [] as Array<Record<string, unknown>>,
    shiftCount: [] as Array<Record<string, unknown>>,
    zReportUpdateMany: [] as Array<Record<string, unknown>>,
  }
  let createThrowsP2002Next = false

  // Z-report helper mock stanje (upsertZReportForDay je mockan na meji)
  const z = {
    calls: [] as Array<Record<string, unknown>>,
    draftError: null as unknown,
    finalizeError: null as unknown,
    reportId: 'zr-1',
    expectedCash: 100,
    paidOrdersCount: 7,
    stats: {
      totalSales: 500,
      cashSales: 300,
      cardSales: 150,
      mobileSales: 50,
      alternateSales: 0,
      totalDiscounts: 10,
      totalTips: 20,
      totalVoided: 5,
      totalRefunds: 2,
    },
  }

  function closeMatches(row: DailyCloseRow, where?: Record<string, unknown>): boolean {
    if (!where) return true
    if (where.id !== undefined && row.id !== where.id) return false
    if (where.locationId !== undefined && row.locationId !== where.locationId) return false
    if (where.idempotencyKey !== undefined && row.idempotencyKey !== where.idempotencyKey) return false
    if (where.status !== undefined && row.status !== where.status) return false
    const bd = where.businessDate as { gte?: Date; lte?: Date; lt?: Date } | undefined
    if (bd) {
      if (bd.gte && row.businessDate < bd.gte) return false
      if (bd.lte && row.businessDate > bd.lte) return false
      if (bd.lt && row.businessDate >= bd.lt) return false
    }
    return true
  }

  const makeClients = () => ({
    dailyClose: {
      findUnique: async ({ where }: { where: Record<string, unknown> }) => {
        captured.closeFindUnique.push(where)
        if (where.id !== undefined) {
          const row = closes.find(r => r.id === where.id)
          return row ? { ...row } : null
        }
        const byKey = where.locationId_idempotencyKey as { locationId: string; idempotencyKey: string } | undefined
        if (byKey) {
          const row = closes.find(r => r.locationId === byKey.locationId && r.idempotencyKey === byKey.idempotencyKey)
          return row ? { ...row } : null
        }
        const byDay = where.locationId_businessDate as { locationId: string; businessDate: Date } | undefined
        if (byDay) {
          const t = new Date(byDay.businessDate).getTime()
          const row = closes.find(r => r.locationId === byDay.locationId && r.businessDate.getTime() === t)
          return row ? { ...row } : null
        }
        return null
      },
      findMany: async (args: { where?: Record<string, unknown>; orderBy?: Record<string, string>; take?: number }) => {
        captured.closeFindMany.push(args as Record<string, unknown>)
        const rows = closes
          .filter(r => closeMatches(r, args.where))
          .sort((a, b) => b.businessDate.getTime() - a.businessDate.getTime())
        const limited = args.take ? rows.slice(0, args.take) : rows
        return limited.map(r => ({ ...r }))
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        captured.closeCreate.push(data)
        if (createThrowsP2002Next) {
          createThrowsP2002Next = false
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' })
        }
        const d = data as Record<string, unknown>
        const row: DailyCloseRow = {
          id: id('dc'),
          locationId: (d.locationId as string) ?? '',
          businessDate: (d.businessDate as Date) ?? new Date(),
          status: (d.status as string) ?? 'PENDING_APPROVAL',
          expectedCash: (d.expectedCash as number) ?? 0,
          countedCash: (d.countedCash as number) ?? 0,
          cashVariance: (d.cashVariance as number) ?? 0,
          varianceThreshold: (d.varianceThreshold as number) ?? 0,
          totalSales: (d.totalSales as number) ?? 0,
          cashSales: (d.cashSales as number) ?? 0,
          cardSales: (d.cardSales as number) ?? 0,
          mobileSales: (d.mobileSales as number) ?? 0,
          alternateSales: (d.alternateSales as number) ?? 0,
          totalOrders: (d.totalOrders as number) ?? 0,
          totalDiscounts: (d.totalDiscounts as number) ?? 0,
          totalTips: (d.totalTips as number) ?? 0,
          totalVoided: (d.totalVoided as number) ?? 0,
          totalRefunds: (d.totalRefunds as number) ?? 0,
          closedById: (d.closedById as string | null) ?? null,
          closedByName: (d.closedByName as string) ?? '',
          closedAt: (d.closedAt as Date | null) ?? null,
          approvedById: (d.approvedById as string | null) ?? null,
          approvedByName: (d.approvedByName as string) ?? '',
          approvedAt: (d.approvedAt as Date | null) ?? null,
          approvalNote: (d.approvalNote as string) ?? '',
          rejectedNote: (d.rejectedNote as string) ?? '',
          reopenCount: (d.reopenCount as number) ?? 0,
          reopenedById: (d.reopenedById as string | null) ?? null,
          reopenedByName: (d.reopenedByName as string) ?? '',
          reopenedAt: (d.reopenedAt as Date | null) ?? null,
          reopenReason: (d.reopenReason as string) ?? '',
          notes: (d.notes as string) ?? '',
          zReportId: (d.zReportId as string | null) ?? null,
          idempotencyKey: (d.idempotencyKey as string) ?? '',
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        closes.push(row)
        return { ...row }
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        captured.closeUpdate.push({ where, data })
        const row = closes.find(r => r.id === where.id)
        if (!row) {
          throw new Prisma.PrismaClientKnownRequestError('Not found', { code: 'P2025', clientVersion: 'test' })
        }
        Object.assign(row, data, { updatedAt: new Date() })
        return { ...row }
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        captured.closeUpdateMany.push({ where, data })
        let count = 0
        for (const row of closes) {
          if (!closeMatches(row, where)) continue
          for (const [k, v] of Object.entries(data)) {
            if (v !== null && typeof v === 'object' && 'increment' in (v as Record<string, unknown>)) {
              const cur = (row as unknown as Record<string, unknown>)[k] as number
              ;(row as unknown as Record<string, unknown>)[k] = cur + (v as { increment: number }).increment
            } else {
              ;(row as unknown as Record<string, unknown>)[k] = v
            }
          }
          row.updatedAt = new Date()
          count++
        }
        return { count }
      },
    },
    location: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const loc = locations.find(l => l.id === where.id)
        return loc ? { ...loc } : null
      },
    },
    cashRegisterShift: {
      count: async ({ where }: { where: Record<string, unknown> }) => {
        captured.shiftCount.push(where)
        return shifts.filter(s => {
          if (where.locationId !== undefined && s.locationId !== where.locationId) return false
          if (where.status !== undefined && s.status !== where.status) return false
          const opened = where.openedAt as { lt?: Date } | undefined
          if (opened?.lt && !(s.openedAt < opened.lt)) return false
          const or = where.OR as Array<{ closedAt?: { gte?: Date } | null }> | undefined
          if (or) {
            const ok = or.some(o => {
              if (o.closedAt === null) return s.closedAt === null
              if (o.closedAt && typeof o.closedAt === 'object' && o.closedAt.gte) {
                return s.closedAt !== null && s.closedAt >= o.closedAt.gte
              }
              return true
            })
            if (!ok) return false
          }
          return true
        }).length
      },
    },
    zReport: {
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        captured.zReportUpdateMany.push({ where, data })
        let count = 0
        for (const r of zReports) {
          if (where.locationId !== undefined && r.locationId !== where.locationId) continue
          // reportDate je v rute goli Date (enakost dneva)
          const rd = where.reportDate as Date | undefined
          if (rd instanceof Date && r.reportDate.getTime() !== rd.getTime()) continue
          const st = where.status
          if (st !== undefined) {
            if (typeof st === 'string') {
              if (r.status !== st) continue
            } else if (st && typeof st === 'object' && 'in' in (st as Record<string, unknown>)) {
              const list = (st as { in: string[] }).in
              if (!list.includes(r.status)) continue
            }
          }
          r.status = data.status as string
          count++
        }
        return { count }
      },
    },
    employee: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const e = employees.find(x => x.id === where.id)
        return e ? { id: e.id, name: e.name } : null
      },
    },
  })

  const tx = makeClients()
  const db = {
    ...makeClients(),
    $transaction: async <T>(fn: (t: typeof tx) => Promise<T>) => fn(tx),
  }

  return {
    db, closes, locations, shifts, zReports, employees, audit, captured, z,
    forceP2002Next: () => { createThrowsP2002Next = true },
  }
}

// ---------- Mocki (vi.hoisted ref + getter, hišni stil) ----------
const ref = vi.hoisted(() => ({ current: null as unknown as ReturnType<typeof createDb> }))
ref.current = createDb()

const m = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  upsertZReportForDay: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  get db() {
    return ref.current.db
  },
  createAuditLog: async (entry: Record<string, unknown>) => {
    ref.current.audit.push(entry)
  },
}))

vi.mock('@/lib/auth-middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-middleware')>()
  return {
    ...actual,
    requireAuth: (...args: unknown[]) => m.requireAuth(...args),
    // resolveTenantLocationId / resolveTenantLocationIdOrThrow ostanejo REALNI
    // (pure) — tenant semantika zares
  }
})

// upsertZReportForDay je mockan na meji (strukturirane napake: Z_REPORT_CONFLICT,
// OPEN_SHIFTS:n, Z_REPORT_FINALIZED) — notranja tx/advisory-lock semantika ni
// predmet tega testa (pokrita v z-report testih).
vi.mock('@/app/api/z-report/_helpers', () => ({
  upsertZReportForDay: (...args: unknown[]) => m.upsertZReportForDay(...args),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: async () => ({ allowed: true, remaining: 10, retryAfterMs: 0 }),
  getClientIp: () => '127.0.0.1',
  AUTHENTICATED_LIMIT: { maxRequests: 120, windowMs: 60000 },
}))
vi.mock('@/lib/rate-limit/response', () => ({
  rateLimitedResponse: () => new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 }),
}))

import { GET as dailyCloseGet, POST as dailyClosePost } from '@/app/api/daily-close/route'
import { GET as dailyCloseDetailGet } from '@/app/api/daily-close/[id]/route'
import { POST as approvePost } from '@/app/api/daily-close/[id]/approve/route'
import { POST as rejectPost } from '@/app/api/daily-close/[id]/reject/route'
import { POST as reopenPost } from '@/app/api/daily-close/[id]/reopen/route'

const state = ref.current

// ---------- Helperji ----------
function seedBase() {
  state.closes.length = 0
  state.locations.length = 0
  state.shifts.length = 0
  state.zReports.length = 0
  state.employees.length = 0
  state.audit.length = 0
  for (const key of Object.keys(state.captured) as Array<keyof typeof state.captured>) {
    state.captured[key].length = 0
  }
  state.z.calls.length = 0
  state.z.draftError = null
  state.z.finalizeError = null
  state.z.reportId = 'zr-1'
  state.z.expectedCash = 100
  state.z.paidOrdersCount = 7
  state.z.stats = {
    totalSales: 500, cashSales: 300, cardSales: 150, mobileSales: 50,
    alternateSales: 0, totalDiscounts: 10, totalTips: 20, totalVoided: 5, totalRefunds: 2,
  }

  state.locations.push(
    { id: LOC_1, dailyCloseVarianceThreshold: 5 },
    { id: LOC_2, dailyCloseVarianceThreshold: 5 },
  )
  state.employees.push({ id: EMP_1, name: EMP_NAME, locationId: LOC_1 })
}

function seedClose(over: Partial<DailyCloseRow> & { id: string }): DailyCloseRow {
  const row: DailyCloseRow = {
    locationId: LOC_1,
    businessDate: DAY_START,
    status: 'CLOSED',
    expectedCash: 100,
    countedCash: 100,
    cashVariance: 0,
    varianceThreshold: 5,
    totalSales: 500,
    cashSales: 300,
    cardSales: 150,
    mobileSales: 50,
    alternateSales: 0,
    totalOrders: 7,
    totalDiscounts: 10,
    totalTips: 20,
    totalVoided: 5,
    totalRefunds: 2,
    closedById: EMP_1,
    closedByName: EMP_NAME,
    closedAt: new Date(),
    approvedById: EMP_1,
    approvedByName: EMP_NAME,
    approvedAt: new Date(),
    approvalNote: 'Samodejno: razlika znotraj praga',
    rejectedNote: '',
    reopenCount: 0,
    reopenedById: null,
    reopenedByName: '',
    reopenedAt: null,
    reopenReason: '',
    notes: '',
    zReportId: 'zr-1',
    idempotencyKey: `key-${over.id}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }
  state.closes.push(row)
  return row
}

type ZUpsertParams = {
  date: string
  locationId?: string
  actualCash?: number
  notes?: string
  employeeId?: string | null
  finalize?: boolean
}

function resetMocks() {
  m.requireAuth.mockResolvedValue({
    session: { employeeId: EMP_1, locationId: LOC_1, role: 'manager' },
    error: null,
  })
  m.upsertZReportForDay.mockImplementation(async (params: ZUpsertParams) => {
    state.z.calls.push(params as Record<string, unknown>)
    if (!params.finalize && state.z.draftError) throw state.z.draftError
    if (params.finalize && state.z.finalizeError) throw state.z.finalizeError
    const { start } = ljubljanaDayBounds(params.date)
    const status = params.finalize ? 'finalized' : 'draft'
    const row = state.zReports.find(r => r.reportDate.getTime() === start.getTime() && r.locationId === params.locationId)
    if (row) row.status = status
    return {
      report: {
        id: state.z.reportId,
        reportDate: start,
        locationId: params.locationId ?? null,
        status,
        expectedCash: state.z.expectedCash,
        ...state.z.stats,
      },
      stats: { ...state.z.stats },
      paidOrdersCount: state.z.paidOrdersCount,
    }
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  seedBase()
  resetMocks()
})

function authSession(role = 'manager', locationId: string | null = LOC_1, employeeId = EMP_1) {
  m.requireAuth.mockResolvedValue({ session: { employeeId, locationId, role }, error: null })
}

function authError(status: number) {
  m.requireAuth.mockResolvedValue({
    session: null,
    error: new Response(JSON.stringify({ error: 'Dostop zavrnjen' }), { status }),
  })
}

function post(body: unknown, query = '') {
  return new Request(`http://localhost:3000/api/daily-close${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function postTo(path: string, body: unknown) {
  return new Request(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const baseBody = () => ({ date: DATE, countedCash: 100, notes: 'popis', idempotencyKey: 'idem-key-1' })

// ============================================
// POST /api/daily-close — happy path + prag + workflow
// ============================================
describe('POST /api/daily-close — zaključek dneva', () => {
  it('znotraj praga → 201 CLOSED + samodejna odobritev + Z finalize(actualCash=countedCash) + audit', async () => {
    const res = await dailyClosePost(post(baseBody()))

    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.replay).toBe(false)
    expect(data.requiresApproval).toBe(false)
    expect(data.zReportFinalized).toBe(true)
    expect(data.threshold).toBe(5)
    expect(data.variance).toBe(0)
    expect(data.close.status).toBe('CLOSED')
    expect(data.close.countedCash).toBe(100)
    expect(data.close.expectedCash).toBe(100)
    expect(data.close.cashVariance).toBe(0)
    expect(data.close.varianceThreshold).toBe(5)
    expect(data.close.closedByName).toBe(EMP_NAME)
    // samo-dokumentirana samodejna odobritev
    expect(data.close.approvedById).toBe(EMP_1)
    expect(data.close.approvedByName).toBe(EMP_NAME)
    expect(data.close.approvalNote).toBe('Samodejno: razlika znotraj praga')
    // snapshot Z-paritete
    expect(data.close.totalSales).toBe(500)
    expect(data.close.cashSales).toBe(300)
    expect(data.close.totalOrders).toBe(7)
    expect(data.close.totalRefunds).toBe(2)
    expect(data.close.zReportId).toBe('zr-1')
    expect(data.close.businessDate).toBe(DAY_START.toISOString())

    // vrstica v trapu na canonical day-start ključu
    expect(state.closes).toHaveLength(1)
    expect(state.closes[0].businessDate.getTime()).toBe(DAY_START.getTime())
    expect(state.closes[0].idempotencyKey).toBe('idem-key-1')

    // Z-report: DRAFT klic + finalize klic z actualCash = countedCash
    expect(state.z.calls).toHaveLength(2)
    expect(state.z.calls[0]).toMatchObject({ date: DATE, locationId: LOC_1, finalize: false, actualCash: 0, employeeId: EMP_1 })
    expect(state.z.calls[1]).toMatchObject({ date: DATE, locationId: LOC_1, finalize: true, actualCash: 100, notes: 'popis' })

    // audit
    expect(state.audit).toHaveLength(1)
    expect(state.audit[0]).toMatchObject({
      action: 'DAILY_CLOSE_CREATED',
      entityType: 'daily_close',
      details: { date: DATE, countedCash: 100, variance: 0, status: 'CLOSED', threshold: 5 },
    })
  })

  it('nad pragom → 201 PENDING_APPROVAL, Z finalize NI klican (ostane draft)', async () => {
    const res = await dailyClosePost(post({ date: DATE, countedCash: 120, idempotencyKey: 'idem-key-2' }))

    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.close.status).toBe('PENDING_APPROVAL')
    expect(data.requiresApproval).toBe(true)
    expect(data.zReportFinalized).toBe(false)
    expect(data.variance).toBe(20)
    expect(data.close.approvedById).toBeNull()
    expect(data.close.approvalNote).toBe('')

    // samo DRAFT upsert (finalize:false) — finalize NI klican
    expect(state.z.calls).toHaveLength(1)
    expect(state.z.calls[0].finalize).toBe(false)

    expect(state.audit).toHaveLength(1)
    expect(state.audit[0].action).toBe('DAILY_CLOSE_CREATED')
  })

  it('replay isti idempotencyKey → 200 replay:true BREZ transakcijskih stranskih učinkov', async () => {
    const first = await dailyClosePost(post(baseBody()))
    expect(first.status).toBe(201)
    const zCallsAfterFirst = state.z.calls.length
    const auditAfterFirst = state.audit.length
    const closeId = (await first.json()).close.id

    const second = await dailyClosePost(post(baseBody()))
    expect(second.status).toBe(200)
    const data = await second.json()
    expect(data.replay).toBe(true)
    expect(data.close.id).toBe(closeId)
    expect(data.close.status).toBe('CLOSED')

    // brez ponovnega izračuna: ni novega Z upserta, ni audita, ni duplikata
    expect(state.z.calls).toHaveLength(zCallsAfterFirst)
    expect(state.audit).toHaveLength(auditAfterFirst)
    expect(state.closes).toHaveLength(1)
  })

  it('P2002 (unique race na businessDate create) → 409', async () => {
    state.forceP2002Next()
    const res = await dailyClosePost(post(baseBody()))

    expect(res.status).toBe(409)
    expect(state.closes).toHaveLength(0)
  })

  it('CLOSED + drug idempotencyKey → 409 DAILY_CLOSE_ALREADY_CLOSED (brez overwrite-a)', async () => {
    seedClose({ id: 'dc-existing', status: 'CLOSED', idempotencyKey: 'other-key' })
    const res = await dailyClosePost(post({ ...baseBody(), idempotencyKey: 'new-key-12' }))

    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toBe('DAILY_CLOSE_ALREADY_CLOSED')
    // vrstica NI prepisana, nove NI
    expect(state.closes).toHaveLength(1)
    expect(state.closes[0].countedCash).toBe(100)
  })

  // R126-d E2E najdba: produkcija je vrnila 400 Z_REPORT_FINALIZED, ker je bil
  // Z-draft upsert (realen helper) klican PRED CLOSED 409 checkom. Early check
  // mora prekiniti PRED klicem Z upserta — sicer zakrije pravi poslovni vzrok.
  it('CLOSED + drug idempotencyKey → 409 brez klica Z upserta (early check PRED Z-draft)', async () => {
    seedClose({ id: 'dc-early', status: 'CLOSED', idempotencyKey: 'other-key-2' })
    m.upsertZReportForDay.mockClear()
    const res = await dailyClosePost(post({ ...baseBody(), idempotencyKey: 'new-key-34' }))

    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toBe('DAILY_CLOSE_ALREADY_CLOSED')
    // Z-draft upsert se NE SME zgoditi (produkcionalno bi vrgel Z_REPORT_FINALIZED 400)
    expect(m.upsertZReportForDay).not.toHaveBeenCalled()
  })

  it('REOPENED → re-close: overwrite + reopenCount OHRANJEN + audit RECLOSED + Z finalize', async () => {
    seedClose({ id: 'dc-ro', status: 'REOPENED', reopenCount: 2, rejectedNote: 'popis sporen', countedCash: 90 })
    const res = await dailyClosePost(post({ date: DATE, countedCash: 101, idempotencyKey: 'idem-key-3' }))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.close.id).toBe('dc-ro')
    expect(data.close.status).toBe('CLOSED')
    expect(data.close.countedCash).toBe(101)
    expect(data.close.closedByName).toBe(EMP_NAME)
    // reopen metadata NE resetiran
    expect(data.close.reopenCount).toBe(2)
    expect(data.close.rejectedNote).toBe('popis sporen')
    // znotraj praga → finalize
    expect(data.zReportFinalized).toBe(true)
    expect(state.z.calls[1]).toMatchObject({ finalize: true, actualCash: 101 })
    expect(state.audit[0]).toMatchObject({ action: 'DAILY_CLOSE_RECLOSED' })
  })

  it('PENDING_APPROVAL → re-count: update + audit RECOUNT (in Z finalize pri zaključku)', async () => {
    seedClose({ id: 'dc-pa', status: 'PENDING_APPROVAL', countedCash: 130 })
    const res = await dailyClosePost(post({ date: DATE, countedCash: 99, idempotencyKey: 'idem-key-4' }))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.close.id).toBe('dc-pa')
    expect(data.close.status).toBe('CLOSED')
    expect(data.close.countedCash).toBe(99)
    expect(data.close.cashVariance).toBe(-1)
    expect(state.audit[0]).toMatchObject({ action: 'DAILY_CLOSE_RECOUNT' })
    expect(state.z.calls[1].finalize).toBe(true)
  })

  it('odprte blagajniške izmene, ki sekajo dan → 400 OPEN_SHIFTS:n z openShifts extra', async () => {
    state.shifts.push({ id: 'sh-1', locationId: LOC_1, status: 'open', openedAt: new Date('2026-08-05T10:00:00Z'), closedAt: null })
    const res = await dailyClosePost(post(baseBody()))

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.openShifts).toBe(1)
    expect(state.closes).toHaveLength(0)
    // gate je tx-znotraj — Z draft upsert je bil, create NI
    expect(state.captured.closeCreate).toHaveLength(0)
  })

  it('Z_REPORT_CONFLICT (strukturirana napaka Z upserta) → 409 passthrough', async () => {
    state.z.draftError = { error: 'Z_REPORT_CONFLICT', status: 409 }
    const res = await dailyClosePost(post(baseBody()))

    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('Z_REPORT_CONFLICT')
    expect(state.closes).toHaveLength(0)
  })

  it('Z_REPORT_FINALIZED pri finalize → toleriran kot idempotentno OK (odgovor 201)', async () => {
    state.z.finalizeError = new Error('Z_REPORT_FINALIZED')
    const res = await dailyClosePost(post(baseBody()))

    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.zReportFinalized).toBe(true)
    expect(data.close.status).toBe('CLOSED')
  })
})

// ============================================
// POST /api/daily-close — MODEL A lokacijska vrata
// ============================================
describe('POST /api/daily-close — lokacijski gate (fail-closed)', () => {
  it('staff BREZ session lokacije → 403, NEODVISNO od body.locationId', async () => {
    authSession('staff', null)
    const res = await dailyClosePost(post({ ...baseBody(), locationId: LOC_1 }))

    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('Dnevni zaključek zahteva dodeljeno lokacijo.')
    expect(state.z.calls).toHaveLength(0)
    expect(state.closes).toHaveLength(0)
  })

  it('super-admin z body.locationId → zaključek na podani lokaciji', async () => {
    authSession('super_admin', null)
    const res = await dailyClosePost(post({ ...baseBody(), locationId: LOC_2 }))

    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.close.locationId).toBe(LOC_2)
    expect(state.z.calls[0].locationId).toBe(LOC_2)
  })

  it('super-admin BREZ obeh (session in body) → 400', async () => {
    authSession('super_admin', null)
    const res = await dailyClosePost(post(baseBody()))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Ni mogoče določiti lokacije za dnevni zaključek.')
  })

  it('neobstoječa lokacija (super-admin body.locationId) → 404 LOCATION_NOT_FOUND', async () => {
    authSession('super_admin', null)
    const res = await dailyClosePost(post({ ...baseBody(), locationId: 'loc-GONE' }))

    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('LOCATION_NOT_FOUND')
  })
})

// ============================================
// GET /api/daily-close — seznam (scope + filtri)
// ============================================
describe('GET /api/daily-close — seznam', () => {
  it('scope + date filter → businessDate bounds, orderBy desc, take 60, total', async () => {
    seedClose({ id: 'dc-a', businessDate: DAY_START })
    seedClose({ id: 'dc-b', businessDate: ljubljanaDayBounds('2026-08-06').start, idempotencyKey: 'k-b' })
    seedClose({ id: 'dc-x', locationId: LOC_2, businessDate: DAY_START, idempotencyKey: 'k-x' })

    const res = await dailyCloseGet(new Request('http://localhost:3000/api/daily-close?date=2026-08-05'))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.total).toBe(1)
    expect(data.closes).toHaveLength(1)
    expect(data.closes[0].id).toBe('dc-a')

    const args = state.captured.closeFindMany[0] as {
      where: { locationId?: string; businessDate?: { gte: Date; lt: Date } }
      orderBy: Record<string, string>
      take: number
    }
    expect(args.where.locationId).toBe(LOC_1)
    expect(args.where.businessDate?.gte).toEqual(DAY_START)
    expect(args.where.businessDate?.lt).toEqual(DAY_END)
    expect(args.orderBy).toEqual({ businessDate: 'desc' })
    expect(args.take).toBe(60)
  })

  it('from/to + status filtri (businessDate je day-start → lte = polnoč dneva to)', async () => {
    seedClose({ id: 'dc-1', businessDate: ljubljanaDayBounds('2026-08-02').start, status: 'CLOSED', idempotencyKey: 'k1' })
    seedClose({ id: 'dc-2', businessDate: ljubljanaDayBounds('2026-08-20').start, status: 'PENDING_APPROVAL', idempotencyKey: 'k2' })

    const res = await dailyCloseGet(new Request('http://localhost:3000/api/daily-close?from=2026-08-01&to=2026-08-31&status=CLOSED'))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.closes.map((c: { id: string }) => c.id)).toEqual(['dc-1'])

    const args = state.captured.closeFindMany[0] as {
      where: { businessDate?: { gte: Date; lte: Date }; status?: string }
    }
    expect(args.where.businessDate?.gte).toEqual(ljubljanaDayBounds('2026-08-01').start)
    expect(args.where.businessDate?.lte).toEqual(ljubljanaDayBounds('2026-08-31').start)
    expect(args.where.status).toBe('CLOSED')
  })

  it('super-admin brez ?locationId → globalni pogled (brez locationId v where)', async () => {
    authSession('super_admin', null)
    seedClose({ id: 'dc-a' })
    seedClose({ id: 'dc-b', locationId: LOC_2, idempotencyKey: 'k-b' })

    const res = await dailyCloseGet(new Request('http://localhost:3000/api/daily-close'))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.total).toBe(2)
    const args = state.captured.closeFindMany[0] as { where: { locationId?: string } }
    expect(args.where.locationId).toBeUndefined()
  })
})

// ============================================
// GET /api/daily-close/[id] — detail (scope)
// ============================================
describe('GET /api/daily-close/[id] — detail', () => {
  it('vrne zaključek (deepToNumbers)', async () => {
    seedClose({ id: 'dc-a', countedCash: 94.5, cashVariance: -5.5 })

    const res = await dailyCloseDetailGet(
      new Request('http://localhost:3000/api/daily-close/dc-a'),
      { params: Promise.resolve({ id: 'dc-a' }) },
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe('dc-a')
    expect(data.countedCash).toBe(94.5)
    expect(data.cashVariance).toBe(-5.5)
    expect(typeof data.countedCash).toBe('number')
  })

  it('tuja lokacija → 404 (isti odgovor kot neobstoječa)', async () => {
    seedClose({ id: 'dc-x', locationId: LOC_2, idempotencyKey: 'k-x' })

    const res = await dailyCloseDetailGet(
      new Request('http://localhost:3000/api/daily-close/dc-x'),
      { params: Promise.resolve({ id: 'dc-x' }) },
    )

    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('Dnevni zaključek ni najden')
  })
})

// ============================================
// POST /api/daily-close/[id]/approve
// ============================================
describe('POST /api/daily-close/[id]/approve', () => {
  it('CAS uspeh → CLOSED + snapshot odobritelja + Z finalize(actualCash=countedCash) + audit', async () => {
    authSession('admin')
    seedClose({ id: 'dc-pa', status: 'PENDING_APPROVAL', countedCash: 94.5, expectedCash: 100, cashVariance: -5.5 })

    const res = await approvePost(
      postTo('/api/daily-close/dc-pa/approve', { approvalNote: 'OK — razlika pokrita' }),
      { params: Promise.resolve({ id: 'dc-pa' }) },
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.close.status).toBe('CLOSED')
    expect(data.close.approvedById).toBe(EMP_1)
    expect(data.close.approvedByName).toBe(EMP_NAME)
    expect(data.close.approvalNote).toBe('OK — razlika pokrita')

    // Z finalize: actualCash = countedCash, datum = poslovni dan (LJ string)
    expect(state.z.calls).toHaveLength(1)
    expect(state.z.calls[0]).toMatchObject({
      date: DATE,
      locationId: LOC_1,
      finalize: true,
      actualCash: 94.5,
    })

    expect(state.audit).toHaveLength(1)
    expect(state.audit[0]).toMatchObject({ action: 'DAILY_CLOSE_APPROVED', entityType: 'daily_close' })
  })

  it('CAS count 0 (ni PENDING_APPROVAL) → 409 DAILY_CLOSE_NOT_PENDING', async () => {
    authSession('admin')
    seedClose({ id: 'dc-c', status: 'CLOSED' })

    const res = await approvePost(
      postTo('/api/daily-close/dc-c/approve', {}),
      { params: Promise.resolve({ id: 'dc-c' }) },
    )

    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('DAILY_CLOSE_NOT_PENDING')
  })

  it('403 za manage_cash brez admin permissiona', async () => {
    authError(403)
    const res = await approvePost(
      postTo('/api/daily-close/dc-pa/approve', {}),
      { params: Promise.resolve({ id: 'dc-pa' }) },
    )

    expect(res.status).toBe(403)
    expect(state.audit).toHaveLength(0)
  })
})

// ============================================
// POST /api/daily-close/[id]/reject
// ============================================
describe('POST /api/daily-close/[id]/reject', () => {
  it('PENDING_APPROVAL → REOPENED + rejectedNote + reopenCount++ + audit (Z-report nedotaknjen)', async () => {
    authSession('admin')
    seedClose({ id: 'dc-pa', status: 'PENDING_APPROVAL', countedCash: 120, cashVariance: 20 })

    const res = await rejectPost(
      postTo('/api/daily-close/dc-pa/reject', { rejectedNote: 'Popis ne ustreza' }),
      { params: Promise.resolve({ id: 'dc-pa' }) },
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.close.status).toBe('REOPENED')
    expect(data.close.rejectedNote).toBe('Popis ne ustreza')
    expect(data.close.reopenCount).toBe(1)
    expect(data.close.reopenedByName).toBe(EMP_NAME)
    expect(data.close.reopenedById).toBe(EMP_1)

    expect(state.audit).toHaveLength(1)
    expect(state.audit[0]).toMatchObject({ action: 'DAILY_CLOSE_REJECTED' })

    // Z-poročilo ostane draft — NIČ ne spreminja
    expect(state.z.calls).toHaveLength(0)
    expect(state.captured.zReportUpdateMany).toHaveLength(0)
  })

  it('razlog je obvezen (min 3) → 400', async () => {
    authSession('admin')
    seedClose({ id: 'dc-pa', status: 'PENDING_APPROVAL' })

    const res = await rejectPost(
      postTo('/api/daily-close/dc-pa/reject', { rejectedNote: 'no' }),
      { params: Promise.resolve({ id: 'dc-pa' }) },
    )

    expect(res.status).toBe(400)
  })

  it('ni PENDING_APPROVAL → 409 DAILY_CLOSE_NOT_PENDING', async () => {
    authSession('admin')
    seedClose({ id: 'dc-c', status: 'CLOSED' })

    const res = await rejectPost(
      postTo('/api/daily-close/dc-c/reject', { rejectedNote: 'razlog' }),
      { params: Promise.resolve({ id: 'dc-c' }) },
    )

    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('DAILY_CLOSE_NOT_PENDING')
  })
})

// ============================================
// POST /api/daily-close/[id]/reopen
// ============================================
describe('POST /api/daily-close/[id]/reopen', () => {
  it('CLOSED → REOPENED + reopenCount+1 + Z-report nazaj draft (CAS finalized/approved) + 2 audita', async () => {
    authSession('admin')
    seedClose({ id: 'dc-c', status: 'CLOSED' })
    state.zReports.push({ id: 'zr-1', reportDate: DAY_START, locationId: LOC_1, status: 'finalized' })

    const res = await reopenPost(
      postTo('/api/daily-close/dc-c/reopen', { reopenReason: 'Najdena napaka v popisu' }),
      { params: Promise.resolve({ id: 'dc-c' }) },
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.close.status).toBe('REOPENED')
    expect(data.close.reopenCount).toBe(1)
    expect(data.close.reopenReason).toBe('Najdena napaka v popisu')
    expect(data.close.reopenedByName).toBe(EMP_NAME)

    // Z-report CAS where status { in: ['finalized','approved'] } → draft
    expect(state.captured.zReportUpdateMany).toHaveLength(1)
    const zArgs = state.captured.zReportUpdateMany[0] as {
      where: { reportDate: Date; locationId: string; status: unknown }
      data: { status: string }
    }
    expect(zArgs.where.reportDate).toEqual(DAY_START)
    expect(zArgs.where.locationId).toBe(LOC_1)
    expect(zArgs.where.status).toEqual({ in: ['finalized', 'approved'] })
    expect(zArgs.data).toEqual({ status: 'draft' })
    expect(state.zReports[0].status).toBe('draft')

    // dva audit vnosa v oglednem vrstnem redu dogodkov
    expect(state.audit.map(a => a.action)).toEqual(['DAILY_CLOSE_REOPENED', 'Z_REPORT_REOPENED'])
  })

  it('razlog je obvezen (min 3, max 500) → 400', async () => {
    authSession('admin')
    seedClose({ id: 'dc-c', status: 'CLOSED' })

    const res = await reopenPost(
      postTo('/api/daily-close/dc-c/reopen', { reopenReason: 'no' }),
      { params: Promise.resolve({ id: 'dc-c' }) },
    )

    expect(res.status).toBe(400)
    expect(state.captured.zReportUpdateMany).toHaveLength(0)
  })

  it('ni CLOSED → 409 DAILY_CLOSE_NOT_CLOSED', async () => {
    authSession('admin')
    seedClose({ id: 'dc-pa', status: 'PENDING_APPROVAL' })

    const res = await reopenPost(
      postTo('/api/daily-close/dc-pa/reopen', { reopenReason: 'razlog' }),
      { params: Promise.resolve({ id: 'dc-pa' }) },
    )

    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('DAILY_CLOSE_NOT_CLOSED')
  })

  it('tuja lokacija → 404', async () => {
    authSession('admin')
    seedClose({ id: 'dc-x', locationId: LOC_2, status: 'CLOSED', idempotencyKey: 'k-x' })

    const res = await reopenPost(
      postTo('/api/daily-close/dc-x/reopen', { reopenReason: 'razlog' }),
      { params: Promise.resolve({ id: 'dc-x' }) },
    )

    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('Dnevni zaključek ni najden')
    expect(state.captured.zReportUpdateMany).toHaveLength(0)
  })
})

// ============================================
// Variance matematika + prag na meji
// ============================================
describe('POST /api/daily-close — variance matematika in prag', () => {
  it('counted < expected (manjkajoč denar) → negativna variance, nad pragom → PENDING_APPROVAL', async () => {
    state.z.expectedCash = 100
    const res = await dailyClosePost(post({ date: DATE, countedCash: 93, idempotencyKey: 'idem-key-9' }))

    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.variance).toBe(-7)
    expect(data.close.cashVariance).toBe(-7)
    expect(data.close.status).toBe('PENDING_APPROVAL')
    expect(data.requiresApproval).toBe(true)
    expect(data.zReportFinalized).toBe(false)
  })

  it('counted > expected (višek) → pozitivna variance, znotraj praga → CLOSED + finalize', async () => {
    state.z.expectedCash = 100
    const res = await dailyClosePost(post({ date: DATE, countedCash: 103, idempotencyKey: 'idem-key-10' }))

    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.variance).toBe(3)
    expect(data.close.cashVariance).toBe(3)
    expect(data.close.status).toBe('CLOSED')
    expect(data.zReportFinalized).toBe(true)
    expect(state.z.calls[1]).toMatchObject({ finalize: true, actualCash: 103 })
  })

  it('variance == threshold (točno na meji) → CLOSED', async () => {
    state.z.expectedCash = 95
    const res = await dailyClosePost(post({ date: DATE, countedCash: 100, idempotencyKey: 'idem-key-11' }))

    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.variance).toBe(5)
    expect(data.threshold).toBe(5)
    expect(data.close.status).toBe('CLOSED')
    expect(data.close.approvalNote).toBe('Samodejno: razlika znotraj praga')
  })

  it('variance = threshold + 0.01 → PENDING_APPROVAL', async () => {
    state.z.expectedCash = 95
    const res = await dailyClosePost(post({ date: DATE, countedCash: 100.01, idempotencyKey: 'idem-key-12' }))

    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.variance).toBe(5.01)
    expect(data.close.status).toBe('PENDING_APPROVAL')
    expect(data.close.approvedById).toBeNull()
    expect(data.zReportFinalized).toBe(false)
  })
})
