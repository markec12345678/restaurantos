// ============================================
// R141 — P2-28 MANAGER DAILY BRIEFING (epic #115) — trap-DB uniti
// ============================================
// Vzorec r140-feedback-resolution / r133-kds-metrics (vi.hoisted +
// vi.mock('@/lib/db')). Pokritje:
//   1. 401 brez seje (fail-closed, zero DB dotikov)
//   2. 403 regularna vloga brez lokacije (resolveTenantLocationIdOrThrow
//      kanon — 1:1 status/body z obstoječimi rutami)
//   3. 400 neveljaven format datuma ('nonsense' in '2026-13-99')
//   4. LJ bounds pravilnost (P2-08 past): reservation.groupBy (danes),
//      order.aggregate paidAt (včeraj + predvčerajšnjim), wasteRecord
//      createdAt, orderItem readyAt — vse meje = ljubljanaDayBounds;
//      StaffShift.shiftDate = UTC-polnočno okno (write-path pariteta)
//   5. Degradirana sekcija: ena Prisma poizvedba rejecta → 200, sekcija =
//      nevtralni fallback, ostale sekcije celote (dashboard kanon) + log
//   6. Lokacijska seja IGNORIRA ?locationId (scope ostane session lokacija)
//   7. Super-admin global: locationId null, zReportStatus/dailyCloseStatus
//      null (ne izmišljen 'none'), brez per-location lookupov
//   8. Nerešena mnenja (R141-d popavek): new šteje SAMO {status:'new',
//      responded:false} (legacy resolved — responded=true — izključen);
//      mrtvi {status:null} branch je odstranjen (Prisma validacija na NOT NULL)
//   9. Happy-path oblika: top-level + sekcija ključi (pin kontrakta za
//      R141-c UI), PII (telefon/e-pošta) nikoli v odgovoru, no-store
// '@/lib/auth-middleware' je mockan z importOriginal (r133 vzorec) —
// requireAuth na meji, resolveTenantLocationIdOrThrow ostane REALEN
// (fail-closed pravilnik se testira na pravem modulu).
// ============================================
import { describe, it, expect, beforeEach, vi } from 'vitest'

const LOC_A = 'loc-tenant-a'
const LOC_B = 'loc-tenant-b'
// Determinističen poslovni dan (CEST, UTC+2 — LJ polnoč = 22:00 UTC prejšnjega)
const DATE = '2026-07-15'

const mocks = vi.hoisted(() => ({
  // reservation
  resGroupBy: vi.fn(),
  resFindMany: vi.fn(),
  resAggregate: vi.fn(),
  guestFindMany: vi.fn(),
  // staff
  shiftFindMany: vi.fn(),
  timeOffCount: vi.fn(),
  // inventory
  itemFindMany: vi.fn(),
  itemCount: vi.fn(),
  batchFindMany: vi.fn(),
  batchCount: vi.fn(),
  // purchasing
  poFindMany: vi.fn(),
  poCount: vi.fn(),
  // yesterday
  orderAggregate: vi.fn(),
  orderCount: vi.fn(),
  oiFindMany: vi.fn(),
  wasteAggregate: vi.fn(),
  wasteGroupBy: vi.fn(),
  zrFindFirst: vi.fn(),
  dcFindFirst: vi.fn(),
  // issues
  fbCount: vi.fn(),
  fbAggregate: vi.fn(),
  dcCount: vi.fn(),
  stocktakeCount: vi.fn(),
  // infra
  requireAuth: vi.fn(),
  checkRateLimitAsync: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    reservation: {
      groupBy: mocks.resGroupBy,
      findMany: mocks.resFindMany,
      aggregate: mocks.resAggregate,
    },
    guest: { findMany: mocks.guestFindMany },
    staffShift: { findMany: mocks.shiftFindMany },
    timeOffRequest: { count: mocks.timeOffCount },
    inventoryItem: {
      findMany: mocks.itemFindMany,
      count: mocks.itemCount,
      // field-reference kanon (operational-alerts pariteta) — mock rabi obliko
      fields: { minQuantity: 'minQuantity' },
    },
    inventoryBatch: { findMany: mocks.batchFindMany, count: mocks.batchCount },
    purchaseOrder: { findMany: mocks.poFindMany, count: mocks.poCount },
    order: { aggregate: mocks.orderAggregate, count: mocks.orderCount },
    orderItem: { findMany: mocks.oiFindMany },
    wasteRecord: { aggregate: mocks.wasteAggregate, groupBy: mocks.wasteGroupBy },
    guestFeedback: { count: mocks.fbCount, aggregate: mocks.fbAggregate },
    zReport: { findFirst: mocks.zrFindFirst },
    dailyClose: { findFirst: mocks.dcFindFirst, count: mocks.dcCount },
    stocktake: { count: mocks.stocktakeCount },
  },
}))

// requireAuth mockan na meji; resolver ostane REALen (r133 vzorec)
vi.mock('@/lib/auth-middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-middleware')>()
  return {
    ...actual,
    requireAuth: mocks.requireAuth,
  }
})

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.checkRateLimitAsync,
  getClientIp: vi.fn(() => '1.2.3.4'),
  AUTHENTICATED_LIMIT: { maxRequests: 120, windowMs: 60_000 },
}))

vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

import { GET as briefingGET } from '@/app/api/reports/briefing/route'
import { ljubljanaDayBounds } from '@/lib/timezone-sl'

function session(overrides: Record<string, unknown> = {}) {
  return {
    token: 'tok-1',
    employeeId: 'emp-1',
    role: 'manager',
    permissions: ['view_reports'],
    locationId: LOC_A,
    ...overrides,
  }
}

function getReq(url: string) {
  return new Request(url, { method: 'GET' })
}

// LJ meje testnega dne in sosedov (realni helper — P2-08 kanon)
const todayBounds = ljubljanaDayBounds(DATE)
const yBounds = ljubljanaDayBounds('2026-07-14')
const d2Bounds = ljubljanaDayBounds('2026-07-13')

// ---------- Deterministični seedi (dispatch po where obliki, ker sekcije
// tečejo vzporedno — vrstni red klicev čez sekcije NI determinističen) ----------

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuth.mockResolvedValue({ session: session(), error: null })
  mocks.checkRateLimitAsync.mockResolvedValue({ allowed: true, retryAfterMs: 0 })

  // reservations
  mocks.resGroupBy.mockResolvedValue([])
  mocks.resFindMany.mockResolvedValue([])
  mocks.resAggregate.mockResolvedValue({ _sum: { partySize: null } })
  mocks.guestFindMany.mockResolvedValue([])
  // staff
  mocks.shiftFindMany.mockResolvedValue([])
  mocks.timeOffCount.mockResolvedValue(0)
  // inventory
  mocks.itemFindMany.mockResolvedValue([])
  mocks.itemCount.mockResolvedValue(0)
  mocks.batchFindMany.mockResolvedValue([])
  mocks.batchCount.mockResolvedValue(0)
  // purchasing
  mocks.poFindMany.mockResolvedValue([])
  mocks.poCount.mockResolvedValue(0)
  // yesterday — sales agg (ima tip v _sum) vs day-2 agg (samo total)
  mocks.orderAggregate.mockImplementation(async (args: { _sum?: Record<string, boolean> } = {}) =>
    args?._sum?.tip
      ? { _sum: { total: null, tip: null }, _count: 0 }
      : { _sum: { total: null }, _count: 0 },
  )
  mocks.orderCount.mockResolvedValue(0)
  // orderItem.findMany: topItems (where.order) vs KDS (where.readyAt)
  mocks.oiFindMany.mockImplementation(async (args: { where?: Record<string, unknown> } = {}) =>
    'readyAt' in (args?.where ?? {}) ? [] : [],
  )
  mocks.wasteAggregate.mockResolvedValue({ _sum: { totalCost: null }, _count: 0 })
  mocks.wasteGroupBy.mockResolvedValue([])
  mocks.zrFindFirst.mockResolvedValue(null)
  mocks.dcFindFirst.mockResolvedValue(null)
  // issues
  mocks.fbCount.mockResolvedValue(0)
  mocks.fbAggregate.mockResolvedValue({ _min: { createdAt: null } })
  mocks.dcCount.mockResolvedValue(0)
  mocks.stocktakeCount.mockResolvedValue(0)
})

// ════════════════════════════════════════════════════════════════
describe('R141 briefing: auth + validacija', () => {
  it('1. brez seje → 401 fail-closed, ZERO DB dotikov', async () => {
    mocks.requireAuth.mockResolvedValue({
      session: null,
      error: new Response(JSON.stringify({ error: 'Avtentikacija je obvezna.' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    })

    const res = await briefingGET(getReq(`http://x/api/reports/briefing?date=${DATE}`))
    expect(res.status).toBe(401)
    expect(mocks.requireAuth).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ permission: 'view_reports' }),
    )
    expect(mocks.resGroupBy).not.toHaveBeenCalled()
    expect(mocks.orderAggregate).not.toHaveBeenCalled()
    expect(mocks.itemFindMany).not.toHaveBeenCalled()
  })

  it('2. regularna vloga brez lokacije → 403 (resolver kanon, 1:1 z obstoječimi rutami), zero DB', async () => {
    mocks.requireAuth.mockResolvedValue({
      session: session({ role: 'staff', locationId: null }),
      error: null,
    })

    const res = await briefingGET(getReq(`http://x/api/reports/briefing?date=${DATE}`))
    expect(res.status).toBe(403)
    const body = await res.json()
    // točno isti fail-closed body kot druge rute (NO_LOCATION_MESSAGE)
    expect(body).toEqual({ error: 'Vaš račun nima dodeljene lokacije. Kontaktirajte administratorja.' })
    expect(mocks.resGroupBy).not.toHaveBeenCalled()
    expect(mocks.shiftFindMany).not.toHaveBeenCalled()
  })

  it('3. neveljaven format datuma → 400 ("nonsense" in semantično neveljaven "2026-13-99")', async () => {
    const resNonsense = await briefingGET(getReq('http://x/api/reports/briefing?date=nonsense'))
    expect(resNonsense.status).toBe(400)

    const resMonth = await briefingGET(getReq('http://x/api/reports/briefing?date=2026-13-99'))
    expect(resMonth.status).toBe(400)

    expect(mocks.resGroupBy).not.toHaveBeenCalled()
    expect(mocks.orderAggregate).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════
describe('R141 briefing: LJ bounds (P2-08 past) + scope kanon', () => {
  it('4. datumski meje = ljubljanaDayBounds: danes / včeraj / predvčerajšnjim + UTC-polnoč shiftDate', async () => {
    const res = await briefingGET(getReq(`http://x/api/reports/briefing?date=${DATE}`))
    expect(res.status).toBe(200)

    // danes — reservations (groupBy = 1. klic te sekcije)
    const resWhere = mocks.resGroupBy.mock.calls[0][0].where
    expect((resWhere.dateTime.gte as Date).getTime()).toBe(todayBounds.start.getTime())
    expect((resWhere.dateTime.lt as Date).getTime()).toBe(todayBounds.end.getTime())
    expect(resWhere.locationId).toBe(LOC_A)

    // včeraj — order.aggregate paidAt (1. klic = sales, 2. = day-2)
    const salesWhere = mocks.orderAggregate.mock.calls[0][0].where
    expect((salesWhere.paidAt.gte as Date).getTime()).toBe(yBounds.start.getTime())
    expect((salesWhere.paidAt.lt as Date).getTime()).toBe(yBounds.end.getTime())
    const d2Where = mocks.orderAggregate.mock.calls[1][0].where
    expect((d2Where.paidAt.gte as Date).getTime()).toBe(d2Bounds.start.getTime())
    expect((d2Where.paidAt.lt as Date).getTime()).toBe(d2Bounds.end.getTime())

    // včeraj — waste createdAt + KDS readyAt
    const wasteWhere = mocks.wasteAggregate.mock.calls[0][0].where
    expect((wasteWhere.createdAt.gte as Date).getTime()).toBe(yBounds.start.getTime())
    expect((wasteWhere.createdAt.lt as Date).getTime()).toBe(yBounds.end.getTime())
    const kdsCall = mocks.oiFindMany.mock.calls.find((c) => 'readyAt' in (c[0]?.where ?? {}))
    expect(kdsCall).toBeDefined()
    expect((kdsCall![0].where.readyAt.gte as Date).getTime()).toBe(yBounds.start.getTime())
    expect((kdsCall![0].where.readyAt.lt as Date).getTime()).toBe(yBounds.end.getTime())

    // StaffShift.shiftDate — UTC-polnočno okno (write-path: new Date('YYYY-MM-DD'))
    const shiftWhere = mocks.shiftFindMany.mock.calls[0][0].where
    expect((shiftWhere.shiftDate.gte as Date).toISOString()).toBe(`${DATE}T00:00:00.000Z`)
    expect((shiftWhere.shiftDate.lt as Date).toISOString()).toBe('2026-07-16T00:00:00.000Z')
  })

  it('6. lokacijska seja IGNORIRA ?locationId (resolver kanon) — scope ostane session lokacija', async () => {
    const res = await briefingGET(
      getReq(`http://x/api/reports/briefing?date=${DATE}&locationId=${LOC_B}`),
    )
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.locationId).toBe(LOC_A)
    expect(mocks.shiftFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
    expect(mocks.poFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
    // NE sme vsebovati tuje lokacije v where
    expect(mocks.resFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('7. super-admin global (null scope): zReportStatus/dailyCloseStatus null, brez per-location lookupov', async () => {
    mocks.requireAuth.mockResolvedValue({
      session: session({ role: 'super_admin', locationId: null }),
      error: null,
    })

    const res = await briefingGET(getReq(`http://x/api/reports/briefing?date=${DATE}`))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.locationId).toBeNull()
    // unikata per-(dan, lokacija) — globalni scope NE fabricira statusa
    expect(body.yesterday.zReportStatus).toBeNull()
    expect(body.yesterday.dailyCloseStatus).toBeNull()
    expect(mocks.zrFindFirst).not.toHaveBeenCalled()
    expect(mocks.dcFindFirst).not.toHaveBeenCalled()
    // števci delujejo globalno — where BREZ locationId filtra
    const dcWhere = mocks.dcCount.mock.calls[0][0].where
    expect('locationId' in dcWhere).toBe(false)
    const toWhere = mocks.timeOffCount.mock.calls[0][0].where
    expect('employee' in toWhere).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════
describe('R141 briefing: degradacija + legacy mnenja', () => {
  it('5. ena Prisma poizvedba rejecta → 200, sekcija = nevtralni fallback, ostale sekcije celote + log', async () => {
    // inventory sekcija pade (itemFindMany rejecta) — preostanek ima smiselne podatke
    mocks.itemFindMany.mockRejectedValue(new Error('db trap: inventory down'))
    mocks.resGroupBy.mockResolvedValue([
      { status: 'confirmed', _count: 3 },
      { status: 'seated', _count: 1 },
    ])
    mocks.resAggregate.mockResolvedValue({ _sum: { partySize: 12 } })
    mocks.orderAggregate.mockImplementation(async (args: { _sum?: Record<string, boolean> } = {}) =>
      args?._sum?.tip
        ? { _sum: { total: 1000, tip: 50 }, _count: 10 }
        : { _sum: { total: 800 }, _count: 5 },
    )

    const res = await briefingGET(getReq(`http://x/api/reports/briefing?date=${DATE}`))
    expect(res.status).toBe(200)

    const body = await res.json()
    // padla sekcija = nevtralni fallback (dashboard kanon)
    expect(body.inventory).toEqual({ lowStock: [], lowStockCount: 0, expiring: [], expiredCount: 0 })
    // ostale sekcije celote
    expect(body.reservations.summary).toEqual({ confirmed: 3, seated: 1, cancelled: 0, noShow: 0, totalGuests: 12 })
    expect(body.yesterday.sales.revenue).toBe(1000)
    expect(body.yesterday.sales.ordersCount).toBe(10)
    // napaka je logirana server-side (section + ime), NE v odgovoru
    const flat = (console.error as ReturnType<typeof vi.fn>).mock.calls
      .map((c) => c.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
      .join('\n')
    expect(flat).toContain('BRIEFING_SECTION_FALLBACK')
    expect(flat).toContain('inventory')
    expect(JSON.stringify(body)).not.toContain('db trap')
  })

  it('8. nerešena mnenja (R141-d popavek): new šteje SAMO status=new+responded=false; responded=true izključen; mrtvi status:null branch odstranjen', async () => {
    // klicni red znotraj issues sekcije: [0] new, [1] in_review, [2] aggregate oldest
    mocks.fbCount.mockImplementation(async (args: { where?: Record<string, unknown> } = {}) => {
      const where = args?.where ?? {}
      if (where.status === 'new') return 3
      if (where.status === 'in_review') return 4
      return 0
    })
    mocks.fbAggregate.mockResolvedValue({ _min: { createdAt: new Date('2026-07-13T10:00:00.000Z') } })

    const res = await briefingGET(getReq(`http://x/api/reports/briefing?date=${DATE}`))
    expect(res.status).toBe(200)

    const body = await res.json()
    // new = 3 (status 'new' + responded:false); legacy seštevka NIČ več —
    // 0021 backfill pomeni, da NULL-status vrstica fizično ne more obstajati
    expect(body.issues.unresolvedFeedback.new).toBe(3)
    expect(body.issues.unresolvedFeedback.inReview).toBe(4)
    expect(body.issues.unresolvedFeedback.oldest).toBe('2026-07-13T10:00:00.000Z')

    // responded=false pin: 'new' count izključuje legacy resolved (responded=true, backfill 'new')
    const newCall = mocks.fbCount.mock.calls.find((c) => c[0]?.where?.status === 'new')
    expect(newCall).toBeDefined()
    expect(newCall![0].where.responded).toBe(false)
    // mrtvi legacy branch (status:null) je ODSTRANJEN — noben klic ne nosi null filtra
    const nullCall = mocks.fbCount.mock.calls.find((c) => c[0]?.where?.status === null)
    expect(nullCall).toBeUndefined()
    // oldest agregat: ista popravljena semantika (in ['new','in_review'] + responded:false)
    const aggCall = mocks.fbAggregate.mock.calls[0][0] as { where: Record<string, unknown> }
    expect(aggCall.where.status).toEqual({ in: ['new', 'in_review'] })
    expect(aggCall.where.responded).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════
describe('R141 briefing: happy-path oblika (pin kontrakta za R141-c)', () => {
  function seedHappyPath() {
    // reservations: 1 prihajajoča (VIP, miza 5)
    mocks.resGroupBy.mockResolvedValue([
      { status: 'confirmed', _count: 3 },
      { status: 'seated', _count: 1 },
      { status: 'cancelled', _count: 1 },
      { status: 'no_show', _count: 1 },
    ])
    mocks.resFindMany.mockResolvedValue([
      {
        id: 'res-1',
        customerName: 'Ana Novak',
        customerPhone: '+38640123456',
        dateTime: new Date(todayBounds.start.getTime() + 17 * 3600_000),
        partySize: 4,
        status: 'confirmed',
        notes: 'Rojstni dan',
        specialRequests: 'Otroški stol',
        table: { number: 5 },
      },
    ])
    mocks.resAggregate.mockResolvedValue({ _sum: { partySize: 4 } })
    mocks.guestFindMany.mockResolvedValue([{ phone: '+38640123456', isVip: true }])

    // staff: 2 izmeni (scheduled + confirmed) + 1 preklicana (ne gre v byRole)
    mocks.shiftFindMany.mockResolvedValue([
      { employee: { name: 'Miha Kuhar' }, role: 'chef', shiftType: 'morning', startTime: '07:00', endTime: '15:00', status: 'confirmed' },
      { employee: { name: 'Nina Natakar' }, role: 'server', shiftType: 'afternoon', startTime: '15:00', endTime: '23:00', status: 'scheduled' },
      { employee: { name: 'Odpovedani' }, role: 'server', shiftType: 'evening', startTime: '17:00', endTime: '22:00', status: 'cancelled' },
    ])
    mocks.timeOffCount.mockResolvedValue(2)

    // inventory: kritičen (qty 0) + nizek (qty 3 < min 5); 1 pretečena, 1 potekajoča
    mocks.itemFindMany.mockResolvedValue([
      { id: 'item-1', name: 'Moka', quantity: 0, minQuantity: 5, unit: 'kg', safetyStock: null },
      { id: 'item-2', name: 'Olje', quantity: 3, minQuantity: 5, unit: 'L', safetyStock: null },
    ])
    mocks.itemCount.mockResolvedValue(2)
    mocks.batchCount.mockResolvedValue(1)
    mocks.batchFindMany.mockResolvedValue([
      {
        lotNumber: 'LOT-2026-001',
        expiryDate: new Date(todayBounds.start.getTime() + 3 * 86_400_000),
        quantityRemaining: 2,
        unit: 'kg',
        inventoryItem: { name: 'Moka' },
      },
    ])

    // purchasing: 1 naročilnica pričakovana danes + 1 brez datuma
    mocks.poFindMany.mockResolvedValue([
      {
        poNumber: 'ND-2026-000001',
        status: 'approved',
        expectedDate: new Date(todayBounds.start.getTime() + 10 * 3600_000),
        totalAmount: 250.5,
        supplier: { name: 'Kruh d.o.o.' },
      },
      {
        poNumber: 'ND-2026-000002',
        status: 'draft',
        expectedDate: null,
        totalAmount: 99,
        supplier: { name: 'Zelenjava d.o.o.' },
      },
    ])
    mocks.poCount.mockResolvedValue(2)

    // yesterday sales (agg s tip = včeraj, drugi = day-2): 1000/10 vs 800/5
    mocks.orderAggregate.mockImplementation(async (args: { _sum?: Record<string, boolean> } = {}) =>
      args?._sum?.tip
        ? { _sum: { total: 1000, tip: 50 }, _count: 10 }
        : { _sum: { total: 800 }, _count: 5 },
    )
    // topItems + KDS vrstice (dispatch po where obliki)
    const firedAt = (readyAt: Date, minutes: number) => new Date(readyAt.getTime() - minutes * 60_000)
    const ready1 = new Date(yBounds.start.getTime() + 6 * 3600_000)
    const ready2 = new Date(yBounds.start.getTime() + 7 * 3600_000)
    mocks.oiFindMany.mockImplementation(async (args: { where?: Record<string, unknown> } = {}) => {
      if ('readyAt' in (args?.where ?? {})) {
        return [
          {
            readyAt: ready1,
            firedAt: firedAt(ready1, 5), // 5 min ≤ target 10 → on-time
            createdAt: firedAt(ready1, 5),
            orderId: 'ord-1',
            menuItem: { prepStation: { avgPrepTime: 10, type: 'kitchen' } },
          },
          {
            readyAt: ready2,
            firedAt: firedAt(ready2, 15), // 15 min > 10 → late
            createdAt: firedAt(ready2, 15),
            orderId: 'ord-2',
            menuItem: { prepStation: { avgPrepTime: 10, type: 'kitchen' } },
          },
        ]
      }
      return [
        { menuItemName: 'Pizza Margherita', quantity: 1, price: 10 },
        { menuItemName: 'Pizza Margherita', quantity: 2, price: 10 },
        { menuItemName: 'Pivo', quantity: 2, price: 5 },
      ]
    })
    mocks.orderCount.mockResolvedValue(3) // živi aktivni ticketi

    // waste: 42.5 skupaj, top razloga
    mocks.wasteAggregate.mockResolvedValue({ _sum: { totalCost: 42.5 }, _count: 3 })
    mocks.wasteGroupBy.mockResolvedValue([
      { reason: 'SPOILED', _sum: { totalCost: 30 }, _count: 2 },
      { reason: 'EXPIRED', _sum: { totalCost: 12.5 }, _count: 1 },
    ])

    // Z/DailyClose: včeraj finaliziran + zaprt
    mocks.zrFindFirst.mockResolvedValue({ status: 'finalized' })
    mocks.dcFindFirst.mockResolvedValue({ status: 'CLOSED' })

    // issues
    mocks.fbCount.mockImplementation(async (args: { where?: Record<string, unknown> } = {}) => {
      const where = args?.where ?? {}
      if (where.status === null) return 0
      if (where.status === 'new') return 3
      if (where.status === 'in_review') return 2
      return 0
    })
    mocks.fbAggregate.mockResolvedValue({ _min: { createdAt: new Date('2026-07-13T10:00:00.000Z') } })
    mocks.dcCount.mockResolvedValue(1)
    mocks.stocktakeCount.mockResolvedValue(2)
  }

  it('9. oblika odgovora: top-level + sekcija ključi točno po kontraktu; brez PII; no-store', async () => {
    seedHappyPath()

    const res = await briefingGET(getReq(`http://x/api/reports/briefing?date=${DATE}`))
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')

    const body = await res.json()

    // top-level ključi (točno)
    expect(Object.keys(body).sort()).toEqual(
      ['date', 'generatedAt', 'inventory', 'issues', 'kds', 'locationId', 'purchasing', 'reservations', 'staff', 'yesterday'],
    )
    expect(body.date).toBe(DATE)
    expect(typeof body.generatedAt).toBe('string')
    expect(body.locationId).toBe(LOC_A)

    // reservations
    expect(Object.keys(body.reservations).sort()).toEqual(['summary', 'upcoming'])
    expect(Object.keys(body.reservations.summary).sort()).toEqual(
      ['cancelled', 'confirmed', 'noShow', 'seated', 'totalGuests'],
    )
    expect(body.reservations.summary).toEqual({ confirmed: 3, seated: 1, cancelled: 1, noShow: 1, totalGuests: 4 })
    expect(body.reservations.upcoming).toHaveLength(1)
    expect(Object.keys(body.reservations.upcoming[0]).sort()).toEqual(
      ['customerName', 'dateTime', 'id', 'isVip', 'notes', 'partySize', 'specialRequests', 'status', 'tableNumber'],
    )
    expect(body.reservations.upcoming[0]).toEqual({
      id: 'res-1',
      customerName: 'Ana Novak',
      dateTime: new Date(todayBounds.start.getTime() + 17 * 3600_000).toISOString(),
      partySize: 4,
      status: 'confirmed',
      tableNumber: 5,
      notes: 'Rojstni dan',
      specialRequests: 'Otroški stol',
      isVip: true,
    })
    // PII: telefon/e-pošta nikoli ne zapustita strežnika
    const upcomingStr = JSON.stringify(body.reservations.upcoming)
    expect(upcomingStr).not.toContain('+38640123456')
    expect('customerPhone' in body.reservations.upcoming[0]).toBe(false)
    expect('customerEmail' in body.reservations.upcoming[0]).toBe(false)

    // staff
    expect(Object.keys(body.staff).sort()).toEqual(['coverage', 'pendingTimeOff', 'shifts'])
    expect(Object.keys(body.staff.coverage).sort()).toEqual(['byRole', 'confirmed', 'scheduled'])
    // seznam izmen je read-through (vsi statusi — UI jih badge-ira), cap 20;
    // coverage pa šteje SAMO izmene, ki dejansko pokrivajo dan
    expect(body.staff.shifts).toHaveLength(3)
    expect(body.staff.shifts[0]).toEqual({ employeeName: 'Miha Kuhar', role: 'chef', shiftType: 'morning', startTime: '07:00', endTime: '15:00', status: 'confirmed' })
    expect(body.staff.coverage).toEqual({ scheduled: 1, confirmed: 1, byRole: { chef: 1, server: 1 } })
    expect(body.staff.pendingTimeOff).toBe(2)

    // inventory
    expect(Object.keys(body.inventory).sort()).toEqual(['expiredCount', 'expiring', 'lowStock', 'lowStockCount'])
    expect(body.inventory.lowStock).toEqual([
      { id: 'item-1', name: 'Moka', quantity: 0, minQuantity: 5, unit: 'kg', status: 'critical' },
      { id: 'item-2', name: 'Olje', quantity: 3, minQuantity: 5, unit: 'L', status: 'low' },
    ])
    expect(body.inventory.lowStockCount).toBe(2)
    expect(body.inventory.expiring).toEqual([
      {
        lotNumber: 'LOT-2026-001',
        itemName: 'Moka',
        expiryDate: new Date(todayBounds.start.getTime() + 3 * 86_400_000).toISOString(),
        daysToExpiry: 3,
        quantityRemaining: 2,
        unit: 'kg',
      },
    ])
    expect(body.inventory.expiredCount).toBe(1)

    // purchasing
    expect(Object.keys(body.purchasing).sort()).toEqual(['arrivingToday', 'openCount', 'openPos'])
    expect(body.purchasing.openCount).toBe(2)
    expect(body.purchasing.openPos[0]).toEqual({
      poNumber: 'ND-2026-000001',
      supplierName: 'Kruh d.o.o.',
      status: 'approved',
      expectedDate: new Date(todayBounds.start.getTime() + 10 * 3600_000).toISOString(),
      totalAmount: 250.5,
    })
    expect(body.purchasing.arrivingToday).toEqual([{ poNumber: 'ND-2026-000001', supplierName: 'Kruh d.o.o.' }])

    // yesterday
    expect(Object.keys(body.yesterday).sort()).toEqual(
      ['dailyCloseStatus', 'sales', 'topItems', 'waste', 'zReportStatus'],
    )
    expect(body.yesterday.sales).toEqual({
      revenue: 1000,
      ordersCount: 10,
      avgTicket: 100,
      tips: 50,
      revenueChangePct: 25, // (1000-800)/800 → 25 %
    })
    expect(body.yesterday.topItems).toEqual([
      { name: 'Pizza Margherita', quantity: 3, revenue: 30 },
      { name: 'Pivo', quantity: 2, revenue: 10 },
    ])
    expect(body.yesterday.waste).toEqual({
      totalCost: 42.5,
      topReasons: [
        { reason: 'SPOILED', cost: 30, count: 2 },
        { reason: 'EXPIRED', cost: 12.5, count: 1 },
      ],
    })
    expect(body.yesterday.zReportStatus).toBe('finalized')
    expect(body.yesterday.dailyCloseStatus).toBe('CLOSED')

    // issues (vključno z operational izpeljavo iz inventory sekcije)
    expect(Object.keys(body.issues).sort()).toEqual(['operational', 'pendingApprovals', 'unresolvedFeedback'])
    expect(body.issues.unresolvedFeedback).toEqual({ new: 3, inReview: 2, oldest: '2026-07-13T10:00:00.000Z' })
    expect(body.issues.pendingApprovals).toEqual({ dailyCloses: 1, stocktakes: 2 })
    expect(body.issues.operational).toEqual({ critical: 2, warning: 1 }) // critical = 1 kritičen artikel + 1 pretečena serija; warning = 1 potekajoča

    // kds
    expect(Object.keys(body.kds).sort()).toEqual(['activeTickets', 'avgFiredToReadyMinutes', 'lateCount', 'onTimeRate'])
    expect(body.kds).toEqual({ lateCount: 1, onTimeRate: 50, avgFiredToReadyMinutes: 10, activeTickets: 3 })
  })
})
