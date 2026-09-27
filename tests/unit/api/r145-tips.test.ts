// ============================================
// R145-b — EPIC #115 #32 TIPS / GRATUITY — trap-DB uniti
// ============================================
// Vzorec r144-gift-cards (vi.hoisted + vi.mock('@/lib/db') z $transaction
// passthrough na ISTI mock objekt + vi.mock('@/lib/auth-middleware') z
// importOriginal spreadom — requireAuth na meji z REALEN hasPermission
// (403 kanon), tenant resolverji REALNI).
// rateLimitedResponse ostane REALen (rute ga uvažajo direktno iz
// '@/lib/rate-limit/response' — 429 shape gre čez pravi helper).
// createTipDistributionWithChain je mockan (r81/r86 kanon — hash veriga;
// payout chain-safety se pina prek entry statusa + tx argumenta).
//
// Pokritje (kontrakt R145-b):
//   GET /api/tip-pool
//    1. 401 zero-DB + rate bucket 'tip-pool' + manage_employees permission
//    2. no-store header + bare-array shape + scope where kompozicija
//    3. status/datum filter kompozicija (realen resolver)
//    4. regularna seja brez lokacije → 403 fail-closed zero-DB (MODEL A)
//    5. rate limit 429 (realen rateLimitedResponse)
//   POST /api/tip-pool (generacija)
//    6. in-tx audit TIP_POOL_GENERATED točno 1× — details = števci/zneski
//       (datum/metoda/total/cash/card/employeeCount/locationId), NIKOLI
//       per-employee imena; chain entries 'pending'; 201; bucket pin
//    7. regeneracija obstoječega poola → 200 + audit ŠE VEDNO 1× (ni diff-only)
//    8. 401 zero-DB
//   PUT /api/tip-pool (regresija — obstoječi audit nespremenjen)
//    9. tip_pool_distributed točno 1× V tx, 200 (r81/r86/r125 pini ostanejo)
//   POST /api/tip-pool/[id]/payout (NOV izplačilni ciklus)
//    10. 401 zero-DB + permission pin
//    11. non-manage_employees → 403 (realen hasPermission)
//    12. zero-oracle: nonexistent ≡ tuja lokacija → IDENTIČEN 404 body
//        = notInScopeResponse('Tipski bazen') + zero pisnih sledi
//    13. pending pool → 400 'Distribucija še ni shranjena' + zero tx
//    14. že izplačan → 409 idempotenca
//    15. happy path: chain-safe recreate (status 'paid' skozi
//        createTipDistributionWithChain), paidAt updateMany, pool → 'paid',
//        TIP_POOL_PAID audit counters-only, Serializable, payoutSummary
//    16. in-tx race ALREADY_PAID → 409 'medtem izplačan'
//    17. 429 rate limited
// ============================================
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import { hasPermission } from '@/lib/auth-middleware/permissions'

const LOC_A = 'loc-tenant-a'
const LOC_B = 'loc-tenant-b'

const mocks = vi.hoisted(() => ({
  // db.tipPool
  tipPoolFindMany: vi.fn(),
  tipPoolFindUnique: vi.fn(),
  tipPoolFindFirst: vi.fn(),
  tipPoolCreate: vi.fn(),
  tipPoolUpdate: vi.fn(),
  // db.tipDistribution (top-level — payout ne uporablja,endar za varnost)
  tipDistUpdateManyTop: vi.fn(),
  // db.payment / db.staffShift (POST vir)
  paymentFindMany: vi.fn(),
  staffShiftFindMany: vi.fn(),
  // infra
  transaction: vi.fn(),
  requireAuth: vi.fn(),
  createAuditLog: vi.fn(),
  checkRateLimitAsync: vi.fn(),
  createTipDistChain: vi.fn(),
  // tx-level mocki (ločeni od top-level, da se pina kje piše)
  txTipPoolFindUnique: vi.fn(),
  txTipPoolCreate: vi.fn(),
  txTipPoolUpdate: vi.fn(),
  txTipDistFindMany: vi.fn(),
  txTipDistDeleteMany: vi.fn(),
  txTipDistUpdateMany: vi.fn(),
}))

vi.mock('@/lib/db', () => {
  // $transaction passthrough na tx mock objekt (r142/r143/r144 kanon)
  const dbMock = {
    tipPool: {
      findMany: mocks.tipPoolFindMany,
      findUnique: mocks.tipPoolFindUnique,
      findFirst: mocks.tipPoolFindFirst,
      create: mocks.tipPoolCreate,
      update: mocks.tipPoolUpdate,
    },
    tipDistribution: {
      updateMany: mocks.tipDistUpdateManyTop,
    },
    payment: { findMany: mocks.paymentFindMany },
    staffShift: { findMany: mocks.staffShiftFindMany },
    $transaction: mocks.transaction,
  }
  return { db: dbMock, createAuditLog: mocks.createAuditLog }
})

// tx klient — isti objekt za vse $transaction klice
const txObj = {
  tipPool: {
    findUnique: mocks.txTipPoolFindUnique,
    create: mocks.txTipPoolCreate,
    update: mocks.txTipPoolUpdate,
  },
  tipDistribution: {
    findMany: mocks.txTipDistFindMany,
    deleteMany: mocks.txTipDistDeleteMany,
    updateMany: mocks.txTipDistUpdateMany,
  },
}

// requireAuth mockan na meji, ampak z REALEN hasPermission (403 kanon —
// integration canon adaptiran na trap-DB); tenant resolverji ostanejo REALNI
vi.mock('@/lib/auth-middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-middleware')>()
  return {
    ...actual,
    requireAuth: mocks.requireAuth,
  }
})

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.checkRateLimitAsync,
  getClientIp: vi.fn(() => '203.0.113.7'),
  AUTHENTICATED_LIMIT: { maxRequests: 120, windowMs: 60_000 },
}))

// hash veriga mockana (r81/r86 kanon) — payout chain-safety se pina prek
// entry statusa + tx argumenta, ne prek realnega crypto
vi.mock('@/lib/tip-distribution-chain', () => ({
  createTipDistributionWithChain: mocks.createTipDistChain,
}))

vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

import { GET as tipPoolGET, POST as tipPoolPOST, PUT as tipPoolPUT } from '@/app/api/tip-pool/route'
import { POST as payoutPOST } from '@/app/api/tip-pool/[id]/payout/route'

// ---------- Fixture tipi + helperji ----------

interface PoolRow {
  id: string
  date: Date
  totalTips: number | Prisma.Decimal
  cashTips: number | Prisma.Decimal
  cardTips: number | Prisma.Decimal
  distributionMethod: string
  status: string
  locationId: string | null
  distributions?: Array<Record<string, unknown>>
}

function poolRow(overrides: Partial<PoolRow> = {}): PoolRow {
  return {
    id: 'tp-1',
    date: new Date('2026-03-15T00:00:00.000Z'),
    totalTips: new Prisma.Decimal('100.00'),
    cashTips: new Prisma.Decimal('50.00'),
    cardTips: new Prisma.Decimal('50.00'),
    distributionMethod: 'equal',
    status: 'distributed',
    locationId: LOC_A,
    distributions: [],
    ...overrides,
  }
}

function distRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'td-1',
    tipPoolId: 'tp-1',
    employeeId: 'emp-1',
    employeeName: 'Ana Novak',
    hoursWorked: new Prisma.Decimal('8.0'),
    points: new Prisma.Decimal('1.0'),
    amount: new Prisma.Decimal('50.00'),
    status: 'pending',
    paidAt: null,
    ...overrides,
  }
}

type SessionOverrides = Record<string, unknown>

function session(overrides: SessionOverrides = {}) {
  return {
    token: 'tok-1',
    employeeId: 'emp-1',
    role: 'manager',
    permissions: ['manage_employees'],
    locationId: LOC_A,
    createdAt: Date.now(),
    expiresAt: Date.now() + 3_600_000,
    absoluteExpiry: Date.now() + 86_400_000,
    ...overrides,
  }
}

const locStaffSession = () => session()

function getReq(url: string) {
  return new Request(url, { method: 'GET' })
}

function jsonReq(url: string, body: unknown, method = 'POST') {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const payoutCtx = (id: string) => ({ params: Promise.resolve({ id }) })

const unauthorized = () => ({
  session: null,
  error: new Response(JSON.stringify({ error: 'Avtentikacija je obvezna.' }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  }),
})

const forbidden = () => ({
  session: null,
  error: new Response(JSON.stringify({ error: 'Nimate dovoljenja za to operacijo.' }), {
    status: 403,
    headers: { 'content-type': 'application/json' },
  }),
})

beforeEach(() => {
  vi.clearAllMocks()
  // requireAuth na meji z REALEN hasPermission — ruta mora sama zahtevati
  // pravi permission ('manage_employees'), sicer 401/403 kanon
  mocks.requireAuth.mockImplementation(async (_req: Request, opts?: { permission?: string | string[] }) => {
    if (!sessionRef.current) return unauthorized()
    const required = !opts?.permission ? [] : Array.isArray(opts.permission) ? opts.permission : [opts.permission]
    if (!hasPermission(sessionRef.current as never, required as never)) return forbidden()
    return { session: sessionRef.current, error: null }
  })
  mocks.checkRateLimitAsync.mockResolvedValue({ allowed: true, retryAfterMs: 0 })
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(txObj))
  mocks.createAuditLog.mockResolvedValue(undefined)
  mocks.createTipDistChain.mockResolvedValue(['td-1', 'td-2'])
  mocks.tipPoolFindMany.mockResolvedValue([])
  mocks.tipPoolFindUnique.mockResolvedValue(null)
  mocks.tipPoolFindFirst.mockResolvedValue(null)
  mocks.tipPoolCreate.mockResolvedValue(poolRow())
  mocks.tipPoolUpdate.mockResolvedValue(poolRow())
  mocks.paymentFindMany.mockResolvedValue([])
  mocks.staffShiftFindMany.mockResolvedValue([])
  mocks.txTipPoolFindUnique.mockResolvedValue({ status: 'distributed' })
  mocks.txTipPoolCreate.mockResolvedValue(poolRow())
  mocks.txTipPoolUpdate.mockResolvedValue(poolRow())
  mocks.txTipDistFindMany.mockResolvedValue([distRow(), distRow({ id: 'td-2', employeeId: 'emp-2', employeeName: 'Borut Kos' })])
  mocks.txTipDistDeleteMany.mockResolvedValue({ count: 2 })
  mocks.txTipDistUpdateMany.mockResolvedValue({ count: 2 })
})

// mutable session ref za requireAuth mock
const sessionRef = { current: null as unknown }

// ---------- Fixture: POST vir (plačila + izmene) ----------

function seedDayPayments() {
  mocks.paymentFindMany.mockResolvedValue([
    { tipAmount: 50, type: 'cash' },
    { tipAmount: new Prisma.Decimal('50.00'), type: 'card' },
  ])
}

function seedShifts() {
  mocks.staffShiftFindMany.mockResolvedValue([
    { employeeId: 'emp-1', employee: { name: 'Ana Novak' }, startTime: '09:00', endTime: '17:00' },
    { employeeId: 'emp-2', employee: { name: 'Borut Kos' }, startTime: '09:00', endTime: '17:00' },
  ])
}

// ════════════════════════════════════════════════════════════════
// GET /api/tip-pool — hardening (rate limit + no-store + scope)
// ════════════════════════════════════════════════════════════════
describe('R145 GET /api/tip-pool — hardening', () => {
  it('1. 401 zero-DB; rate bucket "tip-pool" + permission manage_employees', async () => {
    sessionRef.current = null

    const res = await tipPoolGET(getReq('http://localhost:3000/api/tip-pool'))

    expect(res.status).toBe(401)
    // zero-DB: nobenega dostopa do baze brez seje
    expect(mocks.tipPoolFindMany).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
    // R112 kanon: bucket 'tip-pool', AUTHENTICATED_LIMIT, PRED auth
    expect(mocks.checkRateLimitAsync).toHaveBeenCalledWith(
      'tip-pool',
      expect.any(String),
      { maxRequests: 120, windowMs: 60_000 },
    )
    expect(mocks.requireAuth.mock.calls[0][1]).toEqual({ permission: 'manage_employees' })
    // rl PRED auth: bucket pin velja tudi na 401 poti (klic se je zgodil)
    expect(mocks.checkRateLimitAsync).toHaveBeenCalledTimes(1)
  })

  it('2. no-store header + bare-array shape + scope where kompozicija', async () => {
    sessionRef.current = locStaffSession()
    mocks.tipPoolFindMany.mockResolvedValue([poolRow()])

    const res = await tipPoolGET(getReq('http://localhost:3000/api/tip-pool'))

    expect(res.status).toBe(200)
    // R142/R143/R144 kanon: denarni podatki nikoli cache-friendly
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    const json = await res.json()
    // bare-array shape 1:1 (TipManager bere data[0]) — NI ovoja
    expect(Array.isArray(json)).toBe(true)
    expect(json[0].status).toBe('distributed')
    // Decimal → number na meji odgovora
    expect(json[0].totalTips).toBe(100)
    // realen resolver: lokacijsko vezana seja → where.locationId = LOC_A
    expect(mocks.tipPoolFindMany.mock.calls[0][0].where).toEqual({ locationId: LOC_A })
  })

  it('3. ?status filter kompozicija (realen resolver + scope)', async () => {
    sessionRef.current = locStaffSession()

    await tipPoolGET(getReq('http://localhost:3000/api/tip-pool?status=paid'))

    expect(mocks.tipPoolFindMany.mock.calls[0][0].where).toEqual({ locationId: LOC_A, status: 'paid' })
  })

  it('4. regularna seja brez lokacije → 403 fail-closed zero-DB (MODEL A)', async () => {
    sessionRef.current = session({ locationId: null })

    const res = await tipPoolGET(getReq('http://localhost:3000/api/tip-pool'))

    expect(res.status).toBe(403)
    expect(mocks.tipPoolFindMany).not.toHaveBeenCalled()
  })

  it('5. presežen rate limit → 429 (realen rateLimitedResponse), zero-DB', async () => {
    sessionRef.current = locStaffSession()
    mocks.checkRateLimitAsync.mockResolvedValue({ allowed: false, retryAfterMs: 30_000 })

    const res = await tipPoolGET(getReq('http://localhost:3000/api/tip-pool'))

    expect(res.status).toBe(429)
    expect(mocks.requireAuth).not.toHaveBeenCalled()
    expect(mocks.tipPoolFindMany).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════
// POST /api/tip-pool — in-tx audit TIP_POOL_GENERATED
// ════════════════════════════════════════════════════════════════
describe('R145 POST /api/tip-pool — TIP_POOL_GENERATED', () => {
  it('6. audit točno 1× V tx — details števci/zneski SAMO (nikoli imena), chain entries pending, 201', async () => {
    sessionRef.current = locStaffSession()
    seedDayPayments()
    seedShifts()
    mocks.txTipPoolCreate.mockResolvedValue(poolRow({ id: 'tp-new', status: 'pending' }))
    mocks.tipPoolFindUnique.mockResolvedValue(poolRow({ id: 'tp-new', status: 'pending' }))

    const res = await tipPoolPOST(jsonReq('http://localhost:3000/api/tip-pool', { date: '2026-03-15' }))

    expect(res.status).toBe(201)
    // persist v Serializable tx
    expect(mocks.transaction).toHaveBeenCalledTimes(1)
    expect(mocks.transaction.mock.calls[0][1]).toEqual({ isolationLevel: 'Serializable', timeout: 10000 })

    // chain helper v tx, entries 'pending' (hash veriga kanon — nikoli createMany)
    expect(mocks.createTipDistChain).toHaveBeenCalledTimes(1)
    const [entries, txArg] = mocks.createTipDistChain.mock.calls[0]
    expect(entries).toHaveLength(2)
    expect(entries.map((e: { status: string }) => e.status)).toEqual(['pending', 'pending'])
    expect(txArg).toBeDefined()

    // audit: točno en klic, znotraj tx (drugi argument definiran)
    expect(mocks.createAuditLog).toHaveBeenCalledTimes(1)
    const [entry, auditTxArg] = mocks.createAuditLog.mock.calls[0]
    expect(entry.action).toBe('TIP_POOL_GENERATED')
    expect(entry.entityType).toBe('TipPool')
    expect(entry.entityId).toBe('tp-new')
    expect(entry.userId).toBe('emp-1')
    expect(entry.locationId).toBe(LOC_A)
    expect(auditTxArg).toBeDefined()

    // details = datum/metoda/zneski/števci/lokacija (kontrakt R145-a)
    const d = new Date('2026-03-15')
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    expect(entry.details).toEqual({
      date: dayStart.toISOString(),
      distributionMethod: 'equal',
      totalTips: 100,
      cashTips: 50,
      cardTips: 50,
      employeeCount: 2,
      locationId: LOC_A,
    })
    // PII kanon: NIKOLI per-employee imena oz. per-employee zneski v auditu
    const detailsJson = JSON.stringify(entry.details)
    expect(detailsJson).not.toContain('Ana Novak')
    expect(detailsJson).not.toContain('Borut Kos')
    expect(detailsJson).not.toContain('distributions')
  })

  it('7. regeneracija obstoječega poola → 200 + audit ŠE VEDNO 1× (ni diff-only)', async () => {
    sessionRef.current = locStaffSession()
    seedDayPayments()
    seedShifts()
    mocks.tipPoolFindFirst.mockResolvedValue(poolRow({ id: 'tp-ex', status: 'distributed' }))
    mocks.txTipPoolFindUnique.mockResolvedValue({ status: 'distributed' })
    // update-return določa pool.id v persist (existing veja)
    mocks.txTipPoolUpdate.mockResolvedValue(poolRow({ id: 'tp-ex', status: 'pending' }))
    mocks.tipPoolFindUnique.mockResolvedValue(poolRow({ id: 'tp-ex', status: 'pending' }))

    const res = await tipPoolPOST(jsonReq('http://localhost:3000/api/tip-pool', { date: '2026-03-15' }))

    expect(res.status).toBe(200)
    expect(mocks.txTipPoolUpdate).toHaveBeenCalledTimes(1)
    expect(mocks.createAuditLog).toHaveBeenCalledTimes(1)
    expect(mocks.createAuditLog.mock.calls[0][0].action).toBe('TIP_POOL_GENERATED')
    expect(mocks.createAuditLog.mock.calls[0][0].entityId).toBe('tp-ex')
  })

  it('8. 401 zero-DB', async () => {
    sessionRef.current = null

    const res = await tipPoolPOST(jsonReq('http://localhost:3000/api/tip-pool', { date: '2026-03-15' }))

    expect(res.status).toBe(401)
    expect(mocks.tipPoolFindFirst).not.toHaveBeenCalled()
    expect(mocks.paymentFindMany).not.toHaveBeenCalled()
    expect(mocks.staffShiftFindMany).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════
// PUT /api/tip-pool — regresija: obstoječi audit nespremenjen
// ════════════════════════════════════════════════════════════════
describe('R145 PUT /api/tip-pool — regresija audit trail', () => {
  it('9. tip_pool_distributed točno 1× V tx (obstoječe vedenje pinsano)', async () => {
    sessionRef.current = locStaffSession()
    mocks.tipPoolFindUnique.mockImplementation(async (args: { include?: unknown } = {}) =>
      args.include ? poolRow() : poolRow(),
    )
    mocks.txTipPoolFindUnique.mockResolvedValue({ status: 'pending' })

    const res = await tipPoolPUT(jsonReq('http://localhost:3000/api/tip-pool', {
      tipPoolId: 'tp-1',
      distributions: [
        { employeeId: 'emp-1', employeeName: 'Ana Novak', hoursWorked: 8, points: 1, amount: 100 },
      ],
    }, 'PUT'))

    expect(res.status).toBe(200)
    // audit nespremenjen: en klic, v tx, akcija lowercase (historično)
    expect(mocks.createAuditLog).toHaveBeenCalledTimes(1)
    const [entry, auditTxArg] = mocks.createAuditLog.mock.calls[0]
    expect(entry.action).toBe('tip_pool_distributed')
    expect(auditTxArg).toBeDefined()
    // veriga: deleteMany + chain helper + pool update status 'distributed'
    expect(mocks.txTipDistDeleteMany).toHaveBeenCalledWith({ where: { tipPoolId: 'tp-1' } })
    expect(mocks.txTipPoolUpdate).toHaveBeenCalledWith({ where: { id: 'tp-1' }, data: { status: 'distributed' } })
  })
})

// ════════════════════════════════════════════════════════════════
// POST /api/tip-pool/[id]/payout — NOV izplačilni ciklus
// ════════════════════════════════════════════════════════════════
describe('R145 POST /api/tip-pool/[id]/payout — state machine + chain-safe', () => {
  it('10. 401 zero-DB + permission manage_employees + bucket pin', async () => {
    sessionRef.current = null

    const res = await payoutPOST(getReq('http://localhost:3000/api/tip-pool/tp-1/payout'), payoutCtx('tp-1'))

    expect(res.status).toBe(401)
    expect(mocks.checkRateLimitAsync).toHaveBeenCalledWith(
      'tip-pool',
      expect.any(String),
      { maxRequests: 120, windowMs: 60_000 },
    )
    expect(mocks.requireAuth.mock.calls[0][1]).toEqual({ permission: 'manage_employees' })
    expect(mocks.tipPoolFindUnique).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('11. non-manage_employees → 403 (realen hasPermission), zero-DB', async () => {
    // waiter z take_orders: hasPermission realen → manage_employees NI izpolnjen
    sessionRef.current = session({ role: 'waiter', permissions: ['take_orders'] })

    const res = await payoutPOST(getReq('http://localhost:3000/api/tip-pool/tp-1/payout'), payoutCtx('tp-1'))

    expect(res.status).toBe(403)
    expect(mocks.tipPoolFindUnique).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('12. zero-oracle: nonexistent ≡ tuja lokacija → IDENTIČEN 404 body = notInScopeResponse("Tipski bazen")', async () => {
    sessionRef.current = locStaffSession()
    // 1. klic: id ne obstaja (null)
    mocks.tipPoolFindUnique.mockResolvedValueOnce(null)
    const resA = await payoutPOST(getReq('http://localhost:3000/api/tip-pool/tp-missing/payout'), payoutCtx('tp-missing'))
    // 2. klic: id obstaja, ampak na TUJI lokaciji
    mocks.tipPoolFindUnique.mockResolvedValueOnce(poolRow({ id: 'tp-foreign', locationId: LOC_B }))
    const resB = await payoutPOST(getReq('http://localhost:3000/api/tip-pool/tp-foreign/payout'), payoutCtx('tp-foreign'))

    expect(resA.status).toBe(404)
    expect(resB.status).toBe(404)
    // R144-d lekcija: EXACT isti body na obeh poteh (ni ID-enumeration oracla)
    const bodyA = await resA.text()
    const bodyB = await resB.text()
    expect(bodyB).toBe(bodyA)
    expect(JSON.parse(bodyA)).toEqual({ error: 'Tipski bazen ni najden' })
    // zero pisnih sledi
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })

  it('13. pending pool → 400 "Distribucija še ni shranjena" + zero tx', async () => {
    sessionRef.current = locStaffSession()
    mocks.tipPoolFindUnique.mockResolvedValue(poolRow({ status: 'pending' }))

    const res = await payoutPOST(getReq('http://localhost:3000/api/tip-pool/tp-1/payout'), payoutCtx('tp-1'))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Distribucija še ni shranjena' })
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('14. že izplačan pool → 409 idempotenca', async () => {
    sessionRef.current = locStaffSession()
    mocks.tipPoolFindUnique.mockResolvedValue(poolRow({ status: 'paid' }))

    const res = await payoutPOST(getReq('http://localhost:3000/api/tip-pool/tp-1/payout'), payoutCtx('tp-1'))

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'Tip pool je že izplačan' })
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('15. happy path: chain-safe recreate (status "paid"), paidAt updateMany, pool "paid", TIP_POOL_PAID counters-only, Serializable, payoutSummary', async () => {
    sessionRef.current = locStaffSession()
    // pre-check (plain) → payout re-fetch (include)
    mocks.tipPoolFindUnique.mockImplementation(async (args: { include?: unknown } = {}) =>
      args.include
        ? poolRow({
            status: 'paid',
            distributions: [
              distRow({ status: 'paid', paidAt: new Date() }),
              distRow({ id: 'td-2', employeeId: 'emp-2', employeeName: 'Borut Kos', status: 'paid', paidAt: new Date() }),
            ],
          })
        : poolRow({ status: 'distributed' }),
    )

    const res = await payoutPOST(getReq('http://localhost:3000/api/tip-pool/tp-1/payout'), payoutCtx('tp-1'))

    expect(res.status).toBe(200)
    expect(mocks.transaction).toHaveBeenCalledTimes(1)
    // Serializable tx (pariteta PUT/persist)
    expect(mocks.transaction.mock.calls[0][1]).toEqual({ isolationLevel: 'Serializable', timeout: 10000 })
    // in-tx optimistic lock: fresh status re-read
    expect(mocks.txTipPoolFindUnique).toHaveBeenCalledWith({ where: { id: 'tp-1' }, select: { status: true } })

    // CHAIN-SAFE payout: status JE del hash payloada → recreate skozi chain
    // helper (nikoli updateMany status flipa), entries 'paid', v tx
    expect(mocks.txTipDistDeleteMany).toHaveBeenCalledWith({ where: { tipPoolId: 'tp-1' } })
    expect(mocks.createTipDistChain).toHaveBeenCalledTimes(1)
    const [entries, chainTxArg] = mocks.createTipDistChain.mock.calls[0]
    expect(entries).toHaveLength(2)
    expect(entries.map((e: { status: string }) => e.status)).toEqual(['paid', 'paid'])
    expect(entries.map((e: { employeeId: string }) => e.employeeId)).toEqual(['emp-1', 'emp-2'])
    expect(entries[0]).toMatchObject({ employeeName: 'Ana Novak', hoursWorked: 8, points: 1, amount: 50 })
    expect(chainTxArg).toBe(txObj)

    // paidAt NI del hash payloada → ločen updateMany na novih id-jih je chain-varen
    expect(mocks.txTipDistUpdateMany).toHaveBeenCalledTimes(1)
    const paidAtCall = mocks.txTipDistUpdateMany.mock.calls[0][0]
    expect(paidAtCall.where).toEqual({ id: { in: ['td-1', 'td-2'] } })
    expect(paidAtCall.data.paidAt).toBeInstanceOf(Date)

    // pool → 'paid'
    expect(mocks.txTipPoolUpdate).toHaveBeenCalledWith({ where: { id: 'tp-1' }, data: { status: 'paid' } })

    // audit: točno 1×, v tx, counters/amounts SAMO — NIKOLI per-employee detail
    expect(mocks.createAuditLog).toHaveBeenCalledTimes(1)
    const [entry, auditTxArg] = mocks.createAuditLog.mock.calls[0]
    expect(entry.action).toBe('TIP_POOL_PAID')
    expect(entry.entityType).toBe('TipPool')
    expect(entry.entityId).toBe('tp-1')
    expect(entry.userId).toBe('emp-1')
    expect(entry.locationId).toBe(LOC_A)
    expect(auditTxArg).toBe(txObj)
    expect(entry.details).toEqual({
      tipPoolId: 'tp-1',
      date: '2026-03-15T00:00:00.000Z',
      totalTips: 100,
      distributionCount: 2,
      paidBy: 'emp-1',
    })
    const detailsJson = JSON.stringify(entry.details)
    expect(detailsJson).not.toContain('Ana Novak')
    expect(detailsJson).not.toContain('Borut Kos')

    // odgovor: poln pool (PUT pariteta) + DODATNO payoutSummary
    const json = await res.json()
    expect(json.status).toBe('paid')
    expect(json.totalTips).toBe(100)
    expect(json.payoutSummary).toEqual({ distributionCount: 2, totalPaid: 100 })
    // Decimal → number; paidAt propoten odgovor (UI R145-c)
    expect(json.distributions[0].amount).toBe(50)
    expect(json.distributions[0].status).toBe('paid')
  })

  it('16. in-tx race ALREADY_PAID → 409 "medtem izplačan"', async () => {
    sessionRef.current = locStaffSession()
    mocks.tipPoolFindUnique.mockResolvedValue(poolRow({ status: 'distributed' }))
    mocks.txTipPoolFindUnique.mockResolvedValue({ status: 'paid' })

    const res = await payoutPOST(getReq('http://localhost:3000/api/tip-pool/tp-1/payout'), payoutCtx('tp-1'))

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'Tip pool je bil medtem izplačan — osvežite stran' })
    // rollback semantika: deleteMany sicer klican (znotraj tx), ampak tx je
    // failal → audit NIKOLI (in-tx audit kanon)
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })

  it('17. presežen rate limit → 429, zero-DB', async () => {
    sessionRef.current = locStaffSession()
    mocks.checkRateLimitAsync.mockResolvedValue({ allowed: false, retryAfterMs: 30_000 })

    const res = await payoutPOST(getReq('http://localhost:3000/api/tip-pool/tp-1/payout'), payoutCtx('tp-1'))

    expect(res.status).toBe(429)
    expect(mocks.requireAuth).not.toHaveBeenCalled()
    expect(mocks.tipPoolFindUnique).not.toHaveBeenCalled()
  })
})
