// ============================================
// R133 / EPIC #115 P1-09 — KDS METRIKE + READYAT STAMPING (trap DB)
// ============================================
// Trap DB (hišni stil, vzorec r132-grn-receive): createDb + vi.hoisted +
// vi.mock('@/lib/db'). Testira:
//   A. handleItemStatusUpdate (PATCH item_status kanon R112 — enrichment R133):
//      status='ready' → readyAt/readyById/readyByName v CAS updateMany data;
//      status='preparing' → data BREZ readyAt polj; ponovni vstop ready →
//      OVERWRITE; void CAS count 0 → 409; brez actora → back-compat R112.
//   B. PUT /api/order-items/[id] status branch: isti enrichment + actor lookup.
//   C. GET /api/kitchen/metrics: window parsing (today/24h/7d + default +
//      neznana vrednost), NULL target izključen iz onTimeRate, scope fail-closed
//      403 brez lokacije, capped flag @ 20.000, live agregati
//      (oldest/avg/queueByStation).
// requireAuth je mockan na MEJI; resolveTenantLocationIdOrThrow ostane REALEN
// (scope/fail-closed testiranje na pravem pravilniku).
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'

const LOC_1 = 'loc-1'
const LOC_2 = 'loc-2'
const ORD = 'ord-r133'
const ORD_2 = 'ord-r133-b'
const ITEM = 'oi-r133'
const EMP_1 = 'emp-1'
const EMP_NAME = 'Miha Kuhar'

// ---------- Trap stanje ----------
interface ItemRow {
  id: string
  orderId: string
  status: string
  voided: boolean
  readyAt: Date | null
  readyById: string | null
  readyByName: string
  firedAt: Date | null
  createdAt: Date
  quantity: number
  menuItemId: string
  checkId: string | null
  notes: string
  name: string
  orderLocationId: string
  menuItem: { prepStation: { avgPrepTime: number; type: string } | null } | null
}
interface OrderRow {
  id: string
  status: string
  orderNumber: number
  locationId: string
  firedAt: Date | null
  createdAt: Date
  table: { number: number } | null
}

// Realm-varna globoka kopija (structuredClone v vmThreads vrača HOST-realm
// objekte → instanceof/duck-tip Date v modulih in deepToNumbers odpove; ta
// helper uporablja konstruktore testnega konteksta).
function deepCopy<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value
  const like = value as unknown as { getTime?: () => number }
  if (typeof like.getTime === 'function') return new Date(like.getTime()) as unknown as T
  if (Array.isArray(value)) return value.map(v => deepCopy(v)) as T
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = deepCopy(v)
  return out as T
}

function createDb() {
  const orders: OrderRow[] = []
  const items: ItemRow[] = []
  const employees = new Map<string, string>()
  // R133 D-blok: menu-items PUT prepStation vezava
  const menuItems = [
    { id: 'mi-1', categoryId: 'cat-1', locationId: LOC_1 },
  ]
  const prepStations = [
    { id: 'ps-kitchen', locationId: LOC_1 },
  ]
  let failEmployeeLookup = false
  // Simulacija race-a: findFirst pravi voided:false, updateMany pa teče proti
  // že voidani vrstici (count 0 — void je pravkar zmagal)
  let voidRace = false
  const captured = {
    itemUpdates: [] as Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>,
    orderUpdates: [] as Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>,
    liveWhere: [] as Array<Record<string, unknown>>,
    throughputWhere: [] as Array<Record<string, unknown>>,
    menuItemUpdates: [] as Array<{ where: { id: string }; data: Record<string, unknown> }>,
  }

  const db = {
    $executeRaw: async () => 1,

    employee: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        if (failEmployeeLookup) throw new Error('db lookdown down (trap)')
        const name = employees.get(where.id)
        return name !== undefined ? { name } : null
      },
    },

    menuItem: {
      findFirst: async (args: { where?: Record<string, unknown> } = {}) => {
        const where = args?.where ?? {}
        const menuLoc = (where.category as { menu?: { locationId?: string } } | undefined)?.menu?.locationId
        const row = menuItems.find(mi =>
          (where.id === undefined || mi.id === where.id) &&
          (menuLoc === undefined || mi.locationId === menuLoc))
        return row
          ? { id: row.id, categoryId: row.categoryId, category: { menu: { locationId: row.locationId } } }
          : null
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        captured.menuItemUpdates.push(args)
        return { id: args.where.id, ...args.data }
      },
    },

    prepStation: {
      findUnique: async (args: { where: { id: string } }) =>
        prepStations.find(ps => ps.id === args.where.id) ?? null,
    },

    order: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const ord = orders.find(o => o.id === where.id)
        return ord ? deepCopy(ord) : null
      },
      findMany: async (args: { where?: Record<string, unknown> } = {}) => {
        const where = args?.where ?? {}
        captured.liveWhere.push(where)
        const statusIn = (where.status as { in?: string[] } | undefined)?.in
        const loc = where.locationId as string | undefined
        const someWhere = (where.orderItems as { some?: { status?: { in?: string[] } } } | undefined)?.some
        const someStatusIn = someWhere?.status?.in
        const out: Array<Record<string, unknown>> = []
        for (const ord of orders) {
          if (statusIn && !statusIn.includes(ord.status)) continue
          if (loc !== undefined && ord.locationId !== loc) continue
          const active = items.filter(i =>
            i.orderId === ord.id &&
            !i.voided &&
            (someStatusIn ? someStatusIn.includes(i.status) : true))
          if (someWhere && active.length === 0) continue
          out.push({
            id: ord.id,
            firedAt: ord.firedAt,
            createdAt: ord.createdAt,
            orderItems: active.map(i => ({
              firedAt: i.firedAt,
              createdAt: i.createdAt,
              menuItem: i.menuItem
                ? { prepStation: i.menuItem.prepStation ? { type: i.menuItem.prepStation.type } : null }
                : null,
            })),
          })
        }
        return deepCopy(out)
      },
      updateMany: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        captured.orderUpdates.push(args)
        let count = 0
        const statusIn = (args.where.status as { in?: string[] } | undefined)?.in
        for (const ord of orders) {
          if (args.where.id !== undefined && ord.id !== args.where.id) continue
          if (statusIn && !statusIn.includes(ord.status)) continue
          if (args.data.status !== undefined) ord.status = args.data.status as string
          count += 1
        }
        return { count }
      },
    },

    orderItem: {
      findFirst: async (args: { where?: Record<string, unknown> } = {}) => {
        const where = args?.where ?? {}
        const orderWhere = where.order as { locationId?: string } | undefined
        const item = items.find(i =>
          (where.id === undefined || i.id === where.id) &&
          (where.orderId === undefined || i.orderId === where.orderId) &&
          (where.voided === undefined || i.voided === where.voided) &&
          (orderWhere?.locationId === undefined || i.orderLocationId === orderWhere.locationId))
        return item ? deepCopy(item) : null
      },
      findUnique: async (args: { where?: { id?: string } } = {}) => {
        const item = items.find(i => i.id === args?.where?.id)
        if (!item) return null
        return deepCopy({
          id: item.id,
          orderId: item.orderId,
          status: item.status,
          voided: item.voided,
          readyAt: item.readyAt,
          readyById: item.readyById,
          readyByName: item.readyByName,
          firedAt: item.firedAt,
          createdAt: item.createdAt,
          quantity: item.quantity,
          menuItemId: item.menuItemId,
          checkId: item.checkId,
          menuItem: { name: item.name },
          order: {
            status: orders.find(o => o.id === item.orderId)?.status ?? 'pending',
            locationId: item.orderLocationId,
            table: null,
            inventoryDeducted: false,
          },
        })
      },
      findMany: async (args: { where?: Record<string, unknown> } = {}) => {
        const where = args?.where ?? {}
        if (where.readyAt) {
          // THROUGHPUT (metrics) — readyAt okno + voided:false + tenant scope
          captured.throughputWhere.push(where)
          const range = where.readyAt as { gte?: Date; lte?: Date }
          const loc = (where.order as { locationId?: string } | undefined)?.locationId
          const rows = items
            .filter(i =>
              !i.voided &&
              i.readyAt !== null &&
              (range.gte === undefined || i.readyAt >= range.gte) &&
              (range.lte === undefined || i.readyAt <= range.lte) &&
              (loc === undefined || i.orderLocationId === loc))
            .map(i => ({
              readyAt: i.readyAt,
              firedAt: i.firedAt,
              createdAt: i.createdAt,
              orderId: i.orderId,
              menuItem: i.menuItem,
            }))
          return deepCopy(rows)
        }
        // Status scan (allReady / broadcastItems)
        const orderId = where.orderId as string | undefined
        return items.filter(i => orderId === undefined || i.orderId === orderId).map(i => ({ status: i.status }))
      },
      updateMany: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        captured.itemUpdates.push(args)
        const where = args.where
        const orderWhere = where.order as { status?: { not?: string } } | undefined
        let count = 0
        for (const item of items) {
          if (where.id !== undefined && item.id !== where.id) continue
          if (where.orderId !== undefined && item.orderId !== where.orderId) continue
          if (where.voided === false && (item.voided || voidRace)) continue
          const notStatus = orderWhere?.status?.not
          if (notStatus !== undefined) {
            const ord = orders.find(o => o.id === item.orderId)
            if (ord && ord.status === notStatus) continue
          }
          if (args.data.status !== undefined) item.status = args.data.status as string
          if (args.data.voided !== undefined) item.voided = args.data.voided as boolean
          if (args.data.notes !== undefined) item.notes = args.data.notes as string
          if (args.data.readyAt !== undefined) item.readyAt = args.data.readyAt as Date
          if (args.data.readyById !== undefined) item.readyById = args.data.readyById as string | null
          if (args.data.readyByName !== undefined) item.readyByName = args.data.readyByName as string
          count += 1
        }
        return { count }
      },
    },

    $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(db),
  }

  return {
    db, orders, items, employees, captured, prepStations,
    setEmployeeFail: (v: boolean) => { failEmployeeLookup = v },
    setVoidRace: (v: boolean) => { voidRace = v },
  }
}

// ---------- Mocki (vi.hoisted ref + getter, hišni stil) ----------
type DbState = ReturnType<typeof createDb>
const ref = vi.hoisted(() => ({ current: null as unknown as DbState }))
ref.current = createDb()

const m = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  broadcastWS: vi.fn(),
  wsBroadcastEvent: vi.fn(),
  recalcVoid: vi.fn(),
  returnStock: vi.fn(),
  createAuditLog: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  get db() {
    return ref.current.db
  },
  createAuditLog: m.createAuditLog,
}))

vi.mock('@/lib/auth-middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-middleware')>()
  return {
    ...actual,
    requireAuth: (...args: unknown[]) => m.requireAuth(...args),
    // resolveTenantLocationIdOrThrow ostane REALEN (fail-closed pravilnik)
  }
})

// webhooks/handle-item-status → '../_helpers' (parent barrel)
vi.mock('@/app/api/orders/[id]/_helpers', () => ({
  broadcastWS: m.broadcastWS,
}))
vi.mock('@/lib/ws-server-broadcast', () => ({
  wsBroadcastEvent: m.wsBroadcastEvent,
}))
// PUT /api/order-items/[id] → './_helpers'
vi.mock('@/app/api/order-items/[id]/_helpers', () => ({
  broadcastWS: m.broadcastWS,
  recalculateOrderAndCheckAfterVoid: m.recalcVoid,
  returnStockForVoidedItem: m.returnStock,
}))

import { handleItemStatusUpdate } from '@/app/api/orders/[id]/webhooks/handle-item-status'
import { PUT as orderItemPut } from '@/app/api/order-items/[id]/route'
import { GET as metricsGet } from '@/app/api/kitchen/metrics/route'
import { PUT as menuItemPut } from '@/app/api/menu-items/[id]/route'

const state = ref.current

// ---------- Seed ----------
const NOW = () => new Date()

function seedBase() {
  state.orders.length = 0
  state.items.length = 0
  state.employees.clear()
  state.setEmployeeFail(false)
  state.setVoidRace(false)
  state.captured.itemUpdates.length = 0
  state.captured.orderUpdates.length = 0
  state.captured.liveWhere.length = 0
  state.captured.throughputWhere.length = 0
  state.captured.menuItemUpdates.length = 0
  m.broadcastWS.mockClear()
  m.wsBroadcastEvent.mockClear()

  state.employees.set(EMP_1, EMP_NAME)
  state.orders.push({
    id: ORD, status: 'in-progress', orderNumber: 133, locationId: LOC_1,
    firedAt: new Date(Date.now() - 15 * 60_000), createdAt: new Date(Date.now() - 20 * 60_000),
    table: { number: 5 },
  })
}

function seedItem(over: Partial<ItemRow> = {}): ItemRow {
  const item: ItemRow = {
    id: ITEM,
    orderId: ORD,
    status: 'fired',
    voided: false,
    readyAt: null,
    readyById: null,
    readyByName: '',
    firedAt: new Date(Date.now() - 12 * 60_000),
    createdAt: new Date(Date.now() - 20 * 60_000),
    quantity: 1,
    menuItemId: 'mi-1',
    checkId: null,
    notes: '',
    name: 'Test Pizza',
    orderLocationId: LOC_1,
    menuItem: { prepStation: { avgPrepTime: 10, type: 'kitchen' } },
    ...over,
  }
  state.items.push(item)
  return item
}

function authSession(opts?: { role?: string; locationId?: string | null; employeeId?: string | null; authed?: boolean }) {
  if (opts?.authed === false) {
    m.requireAuth.mockResolvedValue({
      session: null,
      error: new Response(JSON.stringify({ error: 'Avtentikacija je obvezna.' }), { status: 401 }),
    })
    return
  }
  m.requireAuth.mockResolvedValue({
    session: {
      employeeId: opts?.employeeId !== undefined ? opts.employeeId : EMP_1,
      locationId: opts?.locationId !== undefined ? opts.locationId : LOC_1,
      role: opts?.role ?? 'manager',
      permissions: ['take_orders'],
    },
    error: null,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  seedBase()
  authSession()
})

const STALE_ORDER = { id: ORD, status: 'in-progress', orderNumber: 133, locationId: LOC_1 }

function metricsReq(query = ''): Request {
  return new Request(`http://local/api/kitchen/metrics${query}`)
}

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

// ============================================
// A. handleItemStatusUpdate — readyAt stamping (PATCH item_status)
// ============================================
describe('R133 item_status stamping — CAS enrichment', () => {
  it('(A1) status="ready" + actor → CAS data { status, readyAt, readyById, readyByName }, where nespremenjen', async () => {
    seedItem()
    const result = await handleItemStatusUpdate(ORD, ITEM, 'ready', STALE_ORDER, { employeeId: EMP_1, employeeName: EMP_NAME })
    expect(result).toMatchObject({ success: true })

    expect(state.captured.itemUpdates).toHaveLength(1)
    const call = state.captured.itemUpdates[0]
    // CAS where (voided:false) BIT-FOR-BIT nespremenjen (R112 kanon)
    expect(call.where).toEqual({ id: ITEM, orderId: ORD, voided: false })
    expect(call.data.status).toBe('ready')
    expect(call.data.readyAt).toBeInstanceOf(Date)
    expect(call.data.readyById).toBe(EMP_1)
    expect(call.data.readyByName).toBe(EMP_NAME)

    // Trap store: enrichment res zapisan
    const stored = state.items.find(i => i.id === ITEM)!
    expect(stored.readyAt).toBeInstanceOf(Date)
    expect(stored.readyById).toBe(EMP_1)
    expect(stored.readyByName).toBe(EMP_NAME)
  })

  it('(A2) status="preparing" → data BREZ readyAt/readyById/readyByName polj', async () => {
    seedItem()
    const result = await handleItemStatusUpdate(ORD, ITEM, 'preparing', STALE_ORDER, { employeeId: EMP_1, employeeName: EMP_NAME })
    expect(result).toMatchObject({ success: true })
    expect(state.captured.itemUpdates[0].data).toEqual({ status: 'preparing' })
    expect(state.items.find(i => i.id === ITEM)!.readyAt).toBeNull()
  })

  it('(A3) ponovni vstop ready→preparing→ready: non-ready NE počisti readyAt, drugi ready OVERWRITE', async () => {
    const t0 = new Date('2026-01-01T00:00:00.000Z')
    seedItem({ status: 'ready', readyAt: t0, readyById: 'emp-old', readyByName: 'Stari Kuhar' })

    // ready → preparing: readyAt ostane (nikoli počiščen)
    await handleItemStatusUpdate(ORD, ITEM, 'preparing', STALE_ORDER)
    const afterPreparing = state.items.find(i => i.id === ITEM)!
    expect(afterPreparing.status).toBe('preparing')
    expect(afterPreparing.readyAt).toEqual(t0)

    // preparing → ready (drugi kuhar): OVERWRITE — čas zadnje priprave
    await handleItemStatusUpdate(ORD, ITEM, 'ready', STALE_ORDER, { employeeId: EMP_1, employeeName: EMP_NAME })
    const afterReady = state.items.find(i => i.id === ITEM)!
    expect(afterReady.readyAt).not.toEqual(t0)
    expect(afterReady.readyAt!.getTime()).toBeGreaterThan(t0.getTime())
    expect(afterReady.readyById).toBe(EMP_1) // actor posodobljen atomarno z readyAt
    expect(afterReady.readyByName).toBe(EMP_NAME)
  })

  it('(A4) void CAS count 0 (void pravkar zmagal race) → 409, enrichment NE pokvari obstoječega vedenja', async () => {
    seedItem()
    state.setVoidRace(true)
    const result = await handleItemStatusUpdate(ORD, ITEM, 'ready', STALE_ORDER, { employeeId: EMP_1, employeeName: EMP_NAME })
    expect(result).toMatchObject({ status: 409 })
    // CAS where je VEDNO poslan (voided:false) — count 0 je odločil trap
    expect(state.captured.itemUpdates[0].where).toEqual({ id: ITEM, orderId: ORD, voided: false })
    expect(state.captured.itemUpdates[0].data.readyAt).toBeInstanceOf(Date) // data enrichment nespremenjen
  })

  it('(A5) brez actora (izpuščen — R112 klicatelji) → readyById null, readyByName ""', async () => {
    seedItem()
    const result = await handleItemStatusUpdate(ORD, ITEM, 'ready', STALE_ORDER)
    expect(result).toMatchObject({ success: true })
    const data = state.captured.itemUpdates[0].data
    expect(data.readyAt).toBeInstanceOf(Date)
    expect(data.readyById).toBeNull()
    expect(data.readyByName).toBe('')
  })
})

// ============================================
// B. PUT /api/order-items/[id] — status branch enrichment
// ============================================
describe('R133 PUT order-items — readyAt stamping', () => {
  function putReq(body: Record<string, unknown>): Request {
    return new Request(`http://local/api/order-items/${ITEM}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('(B1) status="ready" → CAS updateData z readyAt + actor iz seje (ime via lookup)', async () => {
    seedItem()
    const res = await orderItemPut(putReq({ status: 'ready' }), { params: Promise.resolve({ id: ITEM }) })
    expect(res.status).toBe(200)

    const statusClaim = state.captured.itemUpdates.find(c => c.where.order !== undefined)
    expect(statusClaim).toBeTruthy()
    expect(statusClaim!.where).toEqual({ id: ITEM, voided: false, order: { status: { not: 'cancelled' } } })
    expect(statusClaim!.data.status).toBe('ready')
    expect(statusClaim!.data.readyAt).toBeInstanceOf(Date)
    expect(statusClaim!.data.readyById).toBe(EMP_1)
    expect(statusClaim!.data.readyByName).toBe(EMP_NAME)

    // Response: deepToNumbers — readyAt ISO string
    const body = await parseJson(res)
    expect(typeof body.readyAt).toBe('string')
  })

  it('(B2) status="preparing" → updateData BREZ readyAt polj', async () => {
    seedItem()
    const res = await orderItemPut(putReq({ status: 'preparing' }), { params: Promise.resolve({ id: ITEM }) })
    expect(res.status).toBe(200)
    const statusClaim = state.captured.itemUpdates.find(c => c.where.order !== undefined)
    expect(statusClaim!.data).toEqual({ status: 'preparing' })
  })

  it('(B3) employee lookup spodleti → readyByName "" (best-effort), update vseeno uspešen', async () => {
    seedItem()
    state.setEmployeeFail(true)
    const res = await orderItemPut(putReq({ status: 'ready' }), { params: Promise.resolve({ id: ITEM }) })
    expect(res.status).toBe(200)
    const statusClaim = state.captured.itemUpdates.find(c => c.where.order !== undefined)
    expect(statusClaim!.data.readyAt).toBeInstanceOf(Date)
    expect(statusClaim!.data.readyById).toBe(EMP_1)
    expect(statusClaim!.data.readyByName).toBe('')
  })
})

// ============================================
// C. GET /api/kitchen/metrics — okna, scope, cap, live
// ============================================
describe('R133 metrics route — window parsing', () => {
  it('(C1) default (brez ?window) → kind "today", from = lokalna polnoč, to ≈ now', async () => {
    seedItem({ readyAt: new Date(Date.now() - 1_000) })
    const res = await metricsGet(metricsReq())
    expect(res.status).toBe(200)
    const body = await parseJson(res)
    expect(body.window).toMatchObject({ kind: 'today' })

    const gte = (state.captured.throughputWhere[0].readyAt as { gte: Date; lte: Date }).gte
    expect(gte.getHours()).toBe(0)
    expect(gte.getMinutes()).toBe(0)
    expect(gte.getSeconds()).toBe(0)
    expect((body.window as Record<string, string>).from).toBe(gte.toISOString())

    const lte = (state.captured.throughputWhere[0].readyAt as { lte: Date }).lte
    expect(Math.abs(lte.getTime() - Date.now())).toBeLessThan(5_000)
  })

  it('(C2) ?window=24h / 7d → from ≈ now − 24h / 7d; neznana vrednost → defenzivno today', async () => {
    seedItem({ readyAt: new Date(Date.now() - 1_000) })

    await metricsGet(metricsReq('?window=24h'))
    const gte24 = (state.captured.throughputWhere[0].readyAt as { gte: Date }).gte
    expect(Math.abs(gte24.getTime() - (Date.now() - 24 * 3_600_000))).toBeLessThan(5_000)

    await metricsGet(metricsReq('?window=7d'))
    const gte7d = (state.captured.throughputWhere[1].readyAt as { gte: Date }).gte
    expect(Math.abs(gte7d.getTime() - (Date.now() - 7 * 24 * 3_600_000))).toBeLessThan(5_000)

    const resBad = await metricsGet(metricsReq('?window=bogus'))
    expect(resBad.status).toBe(200)
    expect(((await parseJson(resBad)).window as Record<string, unknown>).kind).toBe('today')
  })
})

describe('R133 metrics route — throughput agregati', () => {
  it('(C3) NULL target (brez prepStation) izključen iz onTimeRate, ampak v itemsBumped', async () => {
    const readyAt = new Date(Date.now() - 1_000)
    seedItem({
      id: 'oi-target', readyAt, firedAt: new Date(readyAt.getTime() - 5 * 60_000),
      menuItem: { prepStation: { avgPrepTime: 10, type: 'kitchen' } },
    })
    seedItem({
      id: 'oi-notarget', readyAt, firedAt: new Date(readyAt.getTime() - 60 * 60_000),
      menuItem: null, // brez postaje → brez tarče
    })

    const res = await metricsGet(metricsReq('?window=24h'))
    expect(res.status).toBe(200)
    const body = await parseJson(res)
    const throughput = body.throughput as Record<string, unknown>
    expect(throughput.itemsBumped).toBe(2)
    expect(throughput.ordersTouched).toBe(1)
    expect(throughput.onTimeRate).toBe(100) // samo target vzorec (1/1)
    expect(throughput.lateCount).toBe(0)
    expect(throughput.avgFiredToReadyMinutes).toBeGreaterThan(0)

    // stations: kitchen (target vzorec) + 'other' (brez postaje, onTimeRate null)
    const stations = body.stations as Array<Record<string, unknown>>
    expect(stations).toHaveLength(2)
    const other = stations.find(s => s.station === 'other')!
    expect(other.itemsBumped).toBe(1)
    expect(other.onTimeRate).toBeNull()
  })

  it('(C4) capped flag ob 20.000 vrsticah (rowsAnalyzed = cap)', async () => {
    const readyAt = new Date(Date.now() - 1_000)
    for (let i = 0; i < 20_000; i += 1) {
      seedItem({ id: `oi-cap-${i}`, readyAt, firedAt: new Date(readyAt.getTime() - 4 * 60_000) })
    }
    const res = await metricsGet(metricsReq('?window=24h'))
    expect(res.status).toBe(200)
    const body = await parseJson(res)
    expect(body.caps).toEqual({ rowsAnalyzed: 20_000, capped: true })
    expect((body.throughput as Record<string, unknown>).itemsBumped).toBe(20_000)
  })

  it('(C5) scope fail-closed: regularna vloga brez lokacije → 403 (realen resolver)', async () => {
    seedItem()
    authSession({ locationId: null, role: 'manager' })
    const res = await metricsGet(metricsReq())
    expect(res.status).toBe(403)
    expect(state.captured.throughputWhere).toHaveLength(0)
  })

  it('(C6) cross-tenant: items tuje lokacije NISO v vzorcu (order.locationId scope)', async () => {
    const readyAt = new Date(Date.now() - 1_000)
    seedItem({ id: 'oi-mine', readyAt, firedAt: new Date(readyAt.getTime() - 5 * 60_000) })
    seedItem({ id: 'oi-theirs', readyAt, firedAt: new Date(readyAt.getTime() - 5 * 60_000), orderLocationId: LOC_2 })

    const res = await metricsGet(metricsReq('?window=24h'))
    expect(res.status).toBe(200)
    const body = await parseJson(res)
    expect((body.throughput as Record<string, unknown>).itemsBumped).toBe(1)
  })
})

describe('R133 metrics route — live agregati', () => {
  it('(C7) activeTickets/oldest/avg/queueByStation nad aktivnimi naročili', async () => {
    const nowMs = Date.now()
    // o1: 2 aktivna artikla (kitchen fired −12min, bar fired −4min)
    seedItem({ id: 'oi-live-1', status: 'fired', firedAt: new Date(nowMs - 12 * 60_000), menuItem: { prepStation: { avgPrepTime: 10, type: 'kitchen' } } })
    seedItem({ id: 'oi-live-2', status: 'preparing', firedAt: new Date(nowMs - 4 * 60_000), menuItem: { prepStation: { avgPrepTime: 5, type: 'bar' } } })
    // o2: 1 aktivni artikel brez firedAt → base = order.createdAt (−6min), station null → 'other'
    state.orders.push({
      id: ORD_2, status: 'in-progress', orderNumber: 134, locationId: LOC_1,
      firedAt: null, createdAt: new Date(nowMs - 6 * 60_000), table: null,
    })
    seedItem({ id: 'oi-live-3', orderId: ORD_2, status: 'pending', firedAt: null, menuItem: null })

    const res = await metricsGet(metricsReq())
    expect(res.status).toBe(200)
    const body = await parseJson(res)
    const live = body.live as Record<string, unknown>
    // Ticket age = now − (order.firedAt ?? order.createdAt) — o1: −15min,
    // o2: −6min (item-level časi so SAMO za queueByStation)
    expect(live.activeTickets).toBe(2)
    expect(Number(live.oldestTicketMinutes)).toBeGreaterThanOrEqual(15)
    expect(Number(live.avgTicketAgeMinutes)).toBeCloseTo((15 + 6) / 2, 0)

    const queue = live.queueByStation as Array<Record<string, unknown>>
    expect(queue.map(q => q.station)).toEqual(['kitchen', 'bar', 'other'])
    expect(queue.find(q => q.station === 'kitchen')).toMatchObject({ items: 1 })
    expect(Number(queue.find(q => q.station === 'other')!.oldestMinutes)).toBeGreaterThanOrEqual(6)
  })
})

// ============================================
// D. PUT /api/menu-items/[id] — prepStationId vezava (R133 drill odkritje:
//    PUT whitelist je polje izpuščal — postaja-routing + metrike target sta
//    v produkciji bila nedosegljiva; guard = postaja na lokaciji artikla)
// ============================================
describe('R133 PUT menu-items — prepStationId vezava + lokacijski guard', () => {
  function menuItemReq(body: unknown): Request {
    return new Request('http://local/api/menu-items/mi-1', {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
  }

  beforeEach(() => {
    authSession({ role: 'admin' })
  })

  it('(D1) postaja na lokaciji artikla → updateData.prepStationId zapisan (200)', async () => {
    const res = await menuItemPut(menuItemReq({ prepStationId: 'ps-kitchen' }), { params: Promise.resolve({ id: 'mi-1' }) })
    expect(res.status).toBe(200)
    const upd = state.captured.menuItemUpdates.at(-1)
    expect(upd?.data.prepStationId).toBe('ps-kitchen')
  })

  it('(D2) postaja TUJE lokacije → 400, update NI zapisan (fail-closed)', async () => {
    state.prepStations.push({ id: 'ps-other', locationId: LOC_2 })
    const res = await menuItemPut(menuItemReq({ prepStationId: 'ps-other' }), { params: Promise.resolve({ id: 'mi-1' }) })
    expect(res.status).toBe(400)
    expect(state.captured.menuItemUpdates.length).toBe(0)
  })

  it('(D3) prepStationId: null → odvezava, brez findUnique (200)', async () => {
    const res = await menuItemPut(menuItemReq({ prepStationId: null }), { params: Promise.resolve({ id: 'mi-1' }) })
    expect(res.status).toBe(200)
    const upd = state.captured.menuItemUpdates.at(-1)
    expect(upd?.data.prepStationId).toBeNull()
  })

  it('(D4) neznana postaja → 400 (fail-closed)', async () => {
    const res = await menuItemPut(menuItemReq({ prepStationId: 'ps-neznana' }), { params: Promise.resolve({ id: 'mi-1' }) })
    expect(res.status).toBe(400)
    expect(state.captured.menuItemUpdates.length).toBe(0)
  })
})
