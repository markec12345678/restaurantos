// ============================================
// R146-b — EPIC #115 #33 ACCOUNTING EXPORTS — trap-DB uniti
// ============================================
// Vzorec r144-gift-cards / r145-tips (vi.hoisted + vi.mock('@/lib/db') +
// vi.mock('@/lib/auth-middleware') z importOriginal spreadom — requireAuth na
// meji z REALEN hasPermission (403 kanon), tenant resolverji REALNI iz
// '@/lib/tenant-scope' (rute ga uvaža direktno, barrel ostane mockan na meji).
// rateLimitedResponse ostane REALen (rute ga uvaža direktno iz
// '@/lib/rate-limit/response' — 429 shape gre čez pravi helper).
//
// Pokritje (kontrakt R146-b):
//   GET /api/reports/export
//    1.  rl bucket 'reports-export' PRED authom (getClientIp + AUTHENTICATED_LIMIT)
//    2.  429 realen rateLimitedResponse — zero-DB, zero-audit
//    3.  401 fail-closed — zero-DB, zero-audit
//    4.  403 realen hasPermission (waiter/take_orders za view_reports) — zero-DB,
//        zero-audit + permission pin view_reports za računovodske tipe
//    5.  MODEL A: staff z lokacijo — ?locationId TUJA lokacija IGNORIRAN
//        (session avtoritativna), relacijski scope check.order.locationId
//    6.  MODEL A: super-admin brez ?locationId → GLOBAL (where BREZ locationId)
//    7.  MODEL A: super-admin z ?locationId → cross-branch (where check.order.locationId)
//    8.  MODEL A: super-admin z NEOBSTOJEČO ?locationId → 200 header-only CSV,
//        IDENTIČEN body kot veljavna prazna lokacija (zero-oracle — brez 404
//        asimetrije; resolver ne razkriva obstoja lokacije)
//    9.  400 neznana vrsta izvoza (zero-DB, zero-audit)
//   10.  400 neznan format (obstoječi message shape)
//   11.  400 računovodski tip + format≠csv (samo CSV kanon)
//   12.  CSV header pini za VSEH 6 novih tipov (točne SI glave)
//   13.  payments relacijski scope pin (LEAK prek Payment NIMO locationId)
//   14.  refunds OR filter pin (refundAmount gt 0 ALI status refunded)
//   15.  expenses pin: entityType 'Expense' + take 5000 + details JSON parse +
//        Uporabnik = userId (brez email/imen)
//   16.  audit pin: ACCOUNTING_EXPORTED / ReportExport / 'type:format' /
//        details { type, format, startDate, endDate, rows } — brez PII
//   17.  audit NIČ ob 400/401/403/429
//   18.  BOM + Content-Type + Content-Disposition (filename) + no-store
//   19.  determinističen orderBy pin + generator-level reproducibilnost
//        (2 klica ista data → byte-identičen CSV)
// ============================================
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Prisma } from '@prisma/client'

const LOC_A = 'loc-tenant-a'
const LOC_B = 'loc-tenant-b'

const mocks = vi.hoisted(() => ({
  // db modeli (samo tisti, ki jih nove rute/generatorji lahko pokličejo)
  paymentFindMany: vi.fn(),
  purchaseOrderFindMany: vi.fn(),
  auditLogFindMany: vi.fn(),
  dailyCloseFindMany: vi.fn(),
  journalLineFindMany: vi.fn(),
  orderFindMany: vi.fn(),
  employeeFindMany: vi.fn(),
  // infra
  transaction: vi.fn(),
  requireAuth: vi.fn(),
  createAuditLog: vi.fn(),
  checkRateLimitAsync: vi.fn(),
  getClientIp: vi.fn(),
}))

vi.mock('@/lib/db', () => {
  const dbMock = {
    payment: { findMany: mocks.paymentFindMany },
    purchaseOrder: { findMany: mocks.purchaseOrderFindMany },
    auditLog: { findMany: mocks.auditLogFindMany },
    dailyClose: { findMany: mocks.dailyCloseFindMany },
    journalLine: { findMany: mocks.journalLineFindMany },
    order: { findMany: mocks.orderFindMany },
    employee: { findMany: mocks.employeeFindMany },
    $transaction: mocks.transaction,
  }
  return { db: dbMock, createAuditLog: mocks.createAuditLog }
})

// requireAuth mockan na meji z REALEN hasPermission (r145 kanon); tenant
// resolverji ostanejo REALNI (r146-b ruta uvaža resolveTenantLocationIdOrThrow
// direktno iz '@/lib/tenant-scope' — ta modul NI mockan)
vi.mock('@/lib/auth-middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-middleware')>()
  return {
    ...actual,
    requireAuth: mocks.requireAuth,
  }
})

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.checkRateLimitAsync,
  getClientIp: mocks.getClientIp,
  AUTHENTICATED_LIMIT: { maxRequests: 120, windowMs: 60_000 },
}))

vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

import { GET as exportGET } from '@/app/api/reports/export/route'
import { generatePaymentsCsv } from '@/app/api/reports/export/_helpers/accounting-reports'
import { hasPermission } from '@/lib/auth-middleware/permissions'

// sessionRef — requireAuth mock bere trenutno sejo (r145 kanon)
const sessionRef: { current: Record<string, unknown> | null } = { current: null }

// ---------- Fixture tipi + helperji ----------

type SessionOverrides = Record<string, unknown>

function session(overrides: SessionOverrides = {}) {
  return {
    token: 'tok-1',
    employeeId: 'emp-1',
    role: 'manager',
    permissions: ['view_reports'],
    locationId: LOC_A,
    createdAt: Date.now(),
    expiresAt: Date.now() + 3_600_000,
    absoluteExpiry: Date.now() + 86_400_000,
    ...overrides,
  }
}

const locStaffSession = () => session()
const superAdminSession = () => session({ role: 'super_admin', locationId: null, permissions: ['admin', 'view_reports'] })
const waiterSession = () => session({ role: 'waiter', permissions: ['take_orders'] })

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

function exportURL(params: string): string {
  return `http://localhost:3000/api/reports/export?${params}`
}

function paymentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pay-1',
    createdAt: new Date('2026-01-15T10:00:00Z'),
    type: 'card',
    status: 'completed',
    amount: new Prisma.Decimal('100.00'),
    tipAmount: new Prisma.Decimal('5.50'),
    refundAmount: new Prisma.Decimal('0'),
    cardType: 'visa',
    cardLast4: '1234',
    check: { order: { orderNumber: 5, locationId: LOC_A } },
    ...overrides,
  }
}

/** Telo odgovora brez BOM (prva vrstica = header). BOM pin na BAJTIVI ravni —
 *  Response.text() uporablja TextDecoder z ignoreBOM=false → BOM odstrani! */
async function csvBody(res: Response): Promise<string> {
  const bytes = new Uint8Array(await res.arrayBuffer())
  expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]) // UTF-8 BOM
  return new TextDecoder().decode(bytes.slice(3))
}

beforeEach(() => {
  vi.clearAllMocks()
  // requireAuth na meji z REALEN hasPermission — ruta mora sama zahtevati
  // pravi permission ('view_reports'), sicer 401/403 kanon
  mocks.requireAuth.mockImplementation(async (_req: Request, opts?: { permission?: string | string[] }) => {
    if (!sessionRef.current) return unauthorized()
    const required = !opts?.permission ? [] : Array.isArray(opts.permission) ? opts.permission : [opts.permission]
    if (!hasPermission(sessionRef.current as never, required as never)) return forbidden()
    return { session: sessionRef.current, error: null }
  })
  sessionRef.current = locStaffSession()
  mocks.getClientIp.mockReturnValue('203.0.113.7')
  mocks.checkRateLimitAsync.mockResolvedValue({ allowed: true, retryAfterMs: 0 })
  mocks.createAuditLog.mockResolvedValue(undefined)
  mocks.paymentFindMany.mockResolvedValue([])
  mocks.purchaseOrderFindMany.mockResolvedValue([])
  mocks.auditLogFindMany.mockResolvedValue([])
  mocks.dailyCloseFindMany.mockResolvedValue([])
  mocks.journalLineFindMany.mockResolvedValue([])
  mocks.orderFindMany.mockResolvedValue([])
  mocks.employeeFindMany.mockResolvedValue([])
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({}))
})

// ════════════════════════════════════════════════════════════════
// Rate limit + auth vrata
// ════════════════════════════════════════════════════════════════
describe('R146 export — rate limit + auth vrata', () => {
  it("1. rl bucket 'reports-export' PRED authom — getClientIp(req) + AUTHENTICATED_LIMIT", async () => {
    const req = new Request(exportURL('type=payments&format=csv'))
    await exportGET(req)

    expect(mocks.checkRateLimitAsync).toHaveBeenCalledWith(
      'reports-export',
      '203.0.113.7',
      { maxRequests: 120, windowMs: 60_000 },
    )
    expect(mocks.getClientIp).toHaveBeenCalledWith(req)
    // PRED authom: rl je bil klican tik pred requireAuth (eden za drugim)
    expect(mocks.requireAuth).toHaveBeenCalledTimes(1)
  })

  it('2. presežen rl → 429 realen rateLimitedResponse, zero-DB, zero-audit', async () => {
    sessionRef.current = locStaffSession()
    mocks.checkRateLimitAsync.mockResolvedValue({ allowed: false, retryAfterMs: 30_000 })

    const res = await exportGET(new Request(exportURL('type=payments&format=csv')))

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('30')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(mocks.requireAuth).not.toHaveBeenCalled()
    expect(mocks.paymentFindMany).not.toHaveBeenCalled()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })

  it('3. 401 fail-closed — zero-DB, zero-audit', async () => {
    mocks.requireAuth.mockImplementation(async () => unauthorized())

    const res = await exportGET(new Request(exportURL('type=payments&format=csv')))

    expect(res.status).toBe(401)
    expect(mocks.paymentFindMany).not.toHaveBeenCalled()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })

  it("4. 403 realen hasPermission (waiter/take_orders za 'view_reports') — zero-DB, zero-audit", async () => {
    sessionRef.current = waiterSession()
    // realen hasPermission pin: waiter brez view_reports bi moral pasti
    expect(hasPermission(waiterSession() as never, ['view_reports'])).toBe(false)

    const res = await exportGET(new Request(exportURL('type=payments&format=csv')))

    expect(res.status).toBe(403)
    // permission pin: računovodski izvozi zahtevajo view_reports (ne admin)
    expect(mocks.requireAuth.mock.calls[0][1]).toEqual({ permission: 'view_reports' })
    expect(mocks.paymentFindMany).not.toHaveBeenCalled()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════
// MODEL A scope
// ════════════════════════════════════════════════════════════════
describe('R146 export — MODEL A scope', () => {
  it('5. staff z lokacijo → session avtoritativna, ?locationId TUJA ignoriran (relacijski scope)', async () => {
    sessionRef.current = locStaffSession()

    await exportGET(new Request(exportURL(`type=payments&format=csv&locationId=${LOC_B}`)))

    const where = mocks.paymentFindMany.mock.calls[0][0].where
    // LEAK pin: scope prek check.order.locationId (Payment NIMA locationId)
    expect(where.check.order.locationId).toBe(LOC_A)
    expect(where.locationId).toBeUndefined()
  })

  it('6. super-admin brez ?locationId → GLOBAL (where brez lokacijskega filtra)', async () => {
    sessionRef.current = superAdminSession()

    await exportGET(new Request(exportURL('type=payments&format=csv')))

    const where = mocks.paymentFindMany.mock.calls[0][0].where
    expect(where.check).toBeUndefined()
    expect(where.locationId).toBeUndefined()
  })

  it('7. super-admin z ?locationId=LOC_B → cross-branch (where check.order.locationId = LOC_B)', async () => {
    sessionRef.current = superAdminSession()

    await exportGET(new Request(exportURL(`type=payments&format=csv&locationId=${LOC_B}`)))

    const where = mocks.paymentFindMany.mock.calls[0][0].where
    expect(where.check.order.locationId).toBe(LOC_B)
  })

  it('8. super-admin z neobstoječo lokacijo → 200 header-only, IDENTIČEN body kot veljavna prazna (zero-oracle)', async () => {
    sessionRef.current = superAdminSession()

    const resGhost = await exportGET(new Request(exportURL('type=payments&format=csv&locationId=loc-ne-obstaja')))
    const resEmpty = await exportGET(new Request(exportURL(`type=payments&format=csv&locationId=${LOC_B}`)))

    expect(resGhost.status).toBe(200)
    expect(resEmpty.status).toBe(200)
    // zero-oracle: neobstoječa ≡ prazna — byte-IDENTIČEN body (brez 404
    // asimetrije, ki bi razkrivala obstoj lokacij; export je list)
    const ghostBytes = new Uint8Array(await resGhost.arrayBuffer())
    const emptyBytes = new Uint8Array(await resEmpty.arrayBuffer())
    expect(Buffer.from(ghostBytes).equals(Buffer.from(emptyBytes))).toBe(true)
    const body = new TextDecoder().decode(ghostBytes.slice(3))
    expect(body).toBe('Datum;Metoda;Status;Znesek (EUR);Napitnina (EUR);Povračilo (EUR);Kartica;Referenca\n')
  })
})

// ════════════════════════════════════════════════════════════════
// 400 vrata
// ════════════════════════════════════════════════════════════════
describe('R146 export — 400 vrata', () => {
  it("9. neznana vrsta izvoza → 400 'Neznana vrsta izvoza', zero-DB, zero-audit", async () => {
    const res = await exportGET(new Request(exportURL('type=bogus&format=csv')))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Neznana vrsta izvoza')
    expect(mocks.paymentFindMany).not.toHaveBeenCalled()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })

  it('10. neznan format → 400 z obstoječim message shape', async () => {
    const res = await exportGET(new Request(exportURL('type=payments&format=bogus')))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Neznan format. Dovoljeni: csv, pdf, excel, xml, ubl')
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })

  it('11. računovodski tip + format≠csv → 400 (samo CSV kanon, R146-a deviation #2)', async () => {
    const res = await exportGET(new Request(exportURL('type=payments&format=pdf')))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Neznan format. Dovoljeni: csv')
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════
// CSV header pini (točne SI glave) + scope/mehanika pin per tip
// ════════════════════════════════════════════════════════════════
const DATES = 'startDate=2026-01-01&endDate=2026-01-31'

describe('R146 export — CSV header pini (6 novih tipov)', () => {
  it('12a. payments — točna SI glava + Decimal→string + card mask', async () => {
    sessionRef.current = superAdminSession()
    mocks.paymentFindMany.mockResolvedValue([
      paymentRow(),
      paymentRow({ id: 'pay-2', type: 'cash', cardType: '', cardLast4: '', amount: new Prisma.Decimal('42.10'), tipAmount: new Prisma.Decimal('0'), refundAmount: new Prisma.Decimal('10.00') }),
    ])

    const res = await exportGET(new Request(exportURL(`type=payments&format=csv&${DATES}`)))
    const body = await csvBody(res)
    const lines = body.trimEnd().split('\n')

    expect(lines[0]).toBe('Datum;Metoda;Status;Znesek (EUR);Napitnina (EUR);Povračilo (EUR);Kartica;Referenca')
    expect(lines[1]).toBe('2026-01-15T10:00:00.000Z;card;completed;100.00;5.50;0.00;visa ****1234;pay-1')
    expect(lines[2]).toBe('2026-01-15T10:00:00.000Z;cash;completed;42.10;0.00;10.00;;pay-2')
    // PII: polna kartica/authorizationCode nikoli v CSV
    expect(body).not.toContain('authorization')
  })

  it('12b. refunds — točna SI glava + OR filter (refundAmount gt 0 ALI status refunded)', async () => {
    const res = await exportGET(new Request(exportURL(`type=refunds&format=csv&${DATES}`)))
    const body = await csvBody(res)

    expect(body.split('\n')[0]).toBe('Datum;Originalni znesek;Povračilo;Metoda;Status;Referenca')
    const args = mocks.paymentFindMany.mock.calls[0][0]
    expect(args.where.OR).toEqual([{ refundAmount: { gt: 0 } }, { status: 'refunded' }])
  })

  it('12c. purchases — točna SI glava + supplier include + determinističen orderBy', async () => {
    mocks.purchaseOrderFindMany.mockResolvedValue([
      {
        id: 'po-1', poNumber: 'ND-2026-000001', orderDate: new Date('2026-01-10T08:00:00Z'),
        invoiceStatus: 'invoiced', subtotal: new Prisma.Decimal('500.00'),
        vatAmount: new Prisma.Decimal('110.00'), totalAmount: new Prisma.Decimal('610.00'),
        supplier: { name: 'Mesarija Novak' },
      },
    ])

    const res = await exportGET(new Request(exportURL(`type=purchases&format=csv&${DATES}`)))
    const body = await csvBody(res)
    const lines = body.trimEnd().split('\n')

    expect(lines[0]).toBe('Datum;Št. naročila;Dobavitelj;Stanje računa;Brez DDV;DDV;Skupaj')
    expect(lines[1]).toBe('2026-01-10T08:00:00.000Z;ND-2026-000001;Mesarija Novak;invoiced;500.00;110.00;610.00')
    const args = mocks.purchaseOrderFindMany.mock.calls[0][0]
    expect(args.orderBy).toEqual([{ orderDate: 'asc' }, { poNumber: 'asc' }])
    expect(args.include).toEqual({ supplier: { select: { name: true } } })
  })

  it('12d. expenses — točna SI glava + entityType/take 5000 + details JSON parse + userId kot Uporabnik', async () => {
    mocks.auditLogFindMany.mockResolvedValue([
      {
        id: 'al-1', timestamp: new Date('2026-01-12T09:30:00Z'), userId: 'emp-1',
        details: JSON.stringify({ category: 'food', description: 'Dobava mesa', amount: 45.5, vendor: 'Mesarija' }),
      },
    ])

    const res = await exportGET(new Request(exportURL(`type=expenses&format=csv&${DATES}`)))
    const body = await csvBody(res)
    const lines = body.trimEnd().split('\n')

    expect(lines[0]).toBe('Datum;Opis;Kategorija;Znesek;Uporabnik;Referenca')
    expect(lines[1]).toBe('2026-01-12T09:30:00.000Z;Dobava mesa;food;45.50;emp-1;al-1')
    // PII: vendor in receipt NE gresta v CSV (kontrakt R146-b stolpci)
    expect(body).not.toContain('Mesarija')
    const args = mocks.auditLogFindMany.mock.calls[0][0]
    expect(args.where.entityType).toBe('Expense')
    expect(args.take).toBe(5000)
    expect(args.orderBy).toEqual([{ timestamp: 'asc' }, { id: 'asc' }])
  })

  it('12e. daily-close — točna SI glava (12 stolpcev) + include location + businessDate scope', async () => {
    mocks.dailyCloseFindMany.mockResolvedValue([
      {
        id: 'dc-1', businessDate: new Date('2026-01-15T00:00:00Z'), locationId: LOC_A,
        totalSales: new Prisma.Decimal('1520.30'), cashSales: new Prisma.Decimal('520.30'),
        cardSales: new Prisma.Decimal('1000.00'), mobileSales: new Prisma.Decimal('0'),
        alternateSales: new Prisma.Decimal('0'), totalDiscounts: new Prisma.Decimal('20.00'),
        totalTips: new Prisma.Decimal('75.00'), totalVoided: new Prisma.Decimal('0'),
        totalRefunds: new Prisma.Decimal('10.00'), cashVariance: new Prisma.Decimal('-1.50'),
        location: { name: 'Lokacija A', code: 'LA' },
      },
    ])

    const res = await exportGET(new Request(exportURL(`type=daily-close&format=csv&${DATES}`)))
    const body = await csvBody(res)
    const lines = body.trimEnd().split('\n')

    expect(lines[0]).toBe('Poslovni dan;Lokacija;Prodaja skupaj;Gotovina;Kartica;Mobilna;Alternativna;Popusti;Napitnine;Preklici;Povračila;Odstopanje gotovine')
    // negativen znesek (varianca) dobi CSV-injection guard prefix (canon csv-utils)
    expect(lines[1]).toBe('2026-01-15T00:00:00.000Z;Lokacija A;1520.30;520.30;1000.00;0.00;0.00;20.00;75.00;0.00;10.00;\'-1.50')
    const args = mocks.dailyCloseFindMany.mock.calls[0][0]
    expect(args.where.locationId).toBe(LOC_A)
    expect(args.orderBy).toEqual([{ businessDate: 'asc' }, { id: 'asc' }])
  })

  it('12f. journal — točna SI glava (per JournalLine vrstice) + entry scope + orderBy', async () => {
    sessionRef.current = superAdminSession()
    mocks.journalLineFindMany.mockResolvedValue([
      {
        id: 'jl-1', accountCode: '7000', accountName: 'Promet — na mestu',
        debit: new Prisma.Decimal('0'), credit: new Prisma.Decimal('1000.00'),
        journalEntry: {
          entryNumber: 'JE-2026-000001', date: new Date('2026-01-15T00:00:00Z'),
          referenceType: 'order', reference: 'ord-9', source: 'auto-order', status: 'posted',
        },
      },
      {
        id: 'jl-2', accountCode: '1010', accountName: 'Blagajna',
        debit: new Prisma.Decimal('1000.00'), credit: new Prisma.Decimal('0'),
        journalEntry: {
          entryNumber: 'JE-2026-000001', date: new Date('2026-01-15T00:00:00Z'),
          referenceType: 'order', reference: 'ord-9', source: 'auto-order', status: 'posted',
        },
      },
    ])

    const res = await exportGET(new Request(exportURL(`type=journal&format=csv&${DATES}`)))
    const body = await csvBody(res)
    const lines = body.trimEnd().split('\n')

    expect(lines[0]).toBe('Vnos;Datum;Konto;Konto ime;Bremenitev (debit);Kronanje (kredit);Referenca;Vir;Status vnosa')
    expect(lines[1]).toBe('JE-2026-000001;2026-01-15T00:00:00.000Z;7000;Promet — na mestu;0.00;1000.00;order:ord-9;auto-order;posted')
    expect(lines[2]).toBe('JE-2026-000001;2026-01-15T00:00:00.000Z;1010;Blagajna;1000.00;0.00;order:ord-9;auto-order;posted')
    const args = mocks.journalLineFindMany.mock.calls[0][0]
    expect(args.orderBy).toEqual([{ journalEntry: { createdAt: 'asc' } }, { id: 'asc' }])
    expect(args.include).toEqual({ journalEntry: true })
  })

  it('13. journal scope teče prek journalEntry.locationId (source of truth, ne denormalizacija)', async () => {
    await exportGET(new Request(exportURL(`type=journal&format=csv&${DATES}`)))

    const where = mocks.journalLineFindMany.mock.calls[0][0].where
    expect(where.journalEntry.locationId).toBe(LOC_A)
    expect(where.locationId).toBeUndefined()
  })
})

// ════════════════════════════════════════════════════════════════
// Audit — ACCOUNTING_EXPORTED (samo ob uspehu)
// ════════════════════════════════════════════════════════════════
describe('R146 export — ACCOUNTING_EXPORTED audit', () => {
  it('14. uspešen izvoz → točno 1× audit z details {type, format, startDate, endDate, rows}', async () => {
    sessionRef.current = superAdminSession()
    mocks.paymentFindMany.mockResolvedValue([paymentRow(), paymentRow({ id: 'pay-2' })])

    const res = await exportGET(new Request(exportURL(`type=payments&format=csv&${DATES}`)))

    expect(res.status).toBe(200)
    expect(mocks.createAuditLog).toHaveBeenCalledTimes(1)
    const entry = mocks.createAuditLog.mock.calls[0][0]
    expect(entry.action).toBe('ACCOUNTING_EXPORTED')
    expect(entry.entityType).toBe('ReportExport')
    expect(entry.entityId).toBe('payments:csv')
    expect(entry.userId).toBe('emp-1')
    expect(entry.locationId).toBeNull() // super-admin global → null scope
    expect(entry.details).toEqual({
      type: 'payments', format: 'csv', startDate: '2026-01-01', endDate: '2026-01-31', rows: 2,
    })
    // PII kanon: details brez polnih kartic/telefonov/emailov
    const detailsJson = JSON.stringify(entry.details)
    expect(detailsJson).not.toContain('****')
    expect(detailsJson).not.toContain('@')
  })

  it('15. audit locationId = scope lokacija pri lokacijskem izvozu', async () => {
    await exportGET(new Request(exportURL(`type=daily-close&format=csv&${DATES}`)))

    const entry = mocks.createAuditLog.mock.calls[0][0]
    expect(entry.entityId).toBe('daily-close:csv')
    expect(entry.locationId).toBe(LOC_A)
  })

  it('16. audit NIČ ob 400 / 401 / 403 / 429', async () => {
    // 400 (neznan tip)
    await exportGET(new Request(exportURL('type=bogus&format=csv')))
    // 401
    mocks.requireAuth.mockImplementation(async () => unauthorized())
    await exportGET(new Request(exportURL('type=payments&format=csv')))
    // 403
    mocks.requireAuth.mockImplementation(async (_req: Request, opts?: { permission?: string | string[] }) => {
      if (!sessionRef.current) return unauthorized()
      const required = !opts?.permission ? [] : Array.isArray(opts.permission) ? opts.permission : [opts.permission]
      if (!hasPermission(sessionRef.current as never, required as never)) return forbidden()
      return { session: sessionRef.current, error: null }
    })
    sessionRef.current = waiterSession()
    await exportGET(new Request(exportURL('type=payments&format=csv')))
    // 429
    mocks.checkRateLimitAsync.mockResolvedValue({ allowed: false, retryAfterMs: 1000 })
    await exportGET(new Request(exportURL('type=payments&format=csv')))

    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════
// Response shape + reproducibilnost
// ════════════════════════════════════════════════════════════════
describe('R146 export — response shape + reproducibilnost', () => {
  it('17. BOM + Content-Type + Content-Disposition filename + Cache-Control no-store', async () => {
    const res = await exportGET(new Request(exportURL(`type=payments&format=csv&${DATES}`)))

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="placila_2026-01-01_2026-01-31.csv"')
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    const bytes = new Uint8Array(await res.arrayBuffer())
    // BOM pin na bajtni ravni (Response.text() BOM odstrani — TextDecoder)
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
  })

  it('18. getFilename SL imena za vseh 6 novih tipov', async () => {
    const cases: Array<[string, string]> = [
      ['payments', 'placila_2026-01-01_2026-01-31.csv'],
      ['refunds', 'povracila_2026-01-01_2026-01-31.csv'],
      ['purchases', 'nabava_2026-01-01_2026-01-31.csv'],
      ['expenses', 'stroski_2026-01-01_2026-01-31.csv'],
      ['daily-close', 'dnevni_zakljucek_2026-01-01_2026-01-31.csv'],
      ['journal', 'dnevnik_2026-01-01_2026-01-31.csv'],
    ]
    for (const [type, filename] of cases) {
      const res = await exportGET(new Request(exportURL(`type=${type}&format=csv&${DATES}`)))
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Disposition')).toBe(`attachment; filename="${filename}"`)
    }
  })

  it('19. reproducibilnost na nivoju generatorja: 2 klica ista data → byte-identičen CSV', async () => {
    const rows = [paymentRow(), paymentRow({ id: 'pay-2', type: 'mobile', cardType: '', cardLast4: '' })]
    const filter = { gte: new Date('2026-01-01T00:00:00Z'), lte: new Date('2026-01-31T23:59:59.999Z') }

    mocks.paymentFindMany.mockResolvedValue(rows)
    const first = await generatePaymentsCsv(filter, LOC_A)
    const second = await generatePaymentsCsv(filter, LOC_A)

    expect(first.csv).toBe(second.csv)
    expect(first.csv.length).toBeGreaterThan(0)
    // determinističen orderBy pin na nivoju poizvedbe
    expect(mocks.paymentFindMany.mock.calls[0][0].orderBy).toEqual([{ createdAt: 'asc' }, { id: 'asc' }])
  })
})
