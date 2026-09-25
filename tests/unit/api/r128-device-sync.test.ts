// ============================================
// R128 / EPIC #115 P0-5 — DEVICE SYNC (batch push + server ack)
// ============================================
// Trap DB (hišni stil R124/R121/R125/R126): vi.hoisted trap + getter;
// testirane so PRODUKCIJSKE route funkcije direktno (device-sync POST/GET,
// handlePostOrder, payments POST). Mockane MEJE (strukturirane enote z
// lastno tx semantiko, pokrite v svojih testih):
//   - requireAuth (auth-middleware importOriginal — resolverji REALNI)
//   - performOrderSoftDelete (Serializable tx + advisory lock kanon)
//   - '@/lib/stock-deduction' + orders/_helpers/stock (zaloga + stranski
//     učinki post-kreacije) + '@/lib/counters' (števec)
//   - rate-limit + createAuditLog (trap)
// resolveTenantLocationId/OrThrow ostanejo REALNI (pure).
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'

const LOC_1 = 'loc-1'
const LOC_2 = 'loc-2'
const EMP_1 = 'emp-1'
const EMP_2 = 'emp-2'
const DEVICE_1 = 'pos-device-0001'
const OP_1 = 'op-00000001'
const OP_2 = 'op-00000002'
const MENU_ITEM_1 = 'menuitem-1'
const MENU_ITEM_2 = 'menuitem-2'
const IDEM_KEY_1 = 'offline-key-0001'

// ---------- Vrstice ----------
interface DeviceRow {
  id: string
  deviceId: string
  name: string
  type: string
  locationId: string | null
  status: string
  lastSeenAt: Date | null
  appVersion: string
}
interface LedgerRow {
  id: string
  deviceId: string
  locationId: string
  clientOperationId: string
  operationType: string
  payload: unknown
  clientRetryCount: number
  status: string
  orderId: string | null
  ack: unknown
  lastError: string | null
  employeeId: string | null
  receivedAt: Date
  processedAt: Date | null
}
interface OrderItemRow {
  id: string
  orderId: string
  menuItemId: string
  quantity: number
  price: number
  status: string
}
interface OrderRow {
  id: string
  orderNumber: number
  idempotencyKey: string
  type: string
  status: string
  firedAt: Date | null
  tableId: string | null
  locationId: string
  subtotal: number
  tax: number
  discount: number
  total: number
  paymentStatus: string
  employeeId: string | null
  inventoryDeducted: boolean
  cancelReason?: string
  orderItems: OrderItemRow[]
  receipt: unknown[]
}
interface MenuItemRow { id: string; vatRate: number; price: number }

// ---------- Trap DB ----------
function createDb() {
  let seq = 0
  const id = (p: string) => `${p}-${++seq}`

  const devices: DeviceRow[] = []
  const ledger: LedgerRow[] = []
  const orders: OrderRow[] = []
  const tables: Array<{ id: string; locationId: string; status: string }> = []
  const menuItems: MenuItemRow[] = []
  const audit: Array<Record<string, unknown>> = []
  const captured = {
    deviceCreate: [] as Array<Record<string, unknown>>,
    deviceUpdate: [] as Array<Record<string, unknown>>,
    ledgerCreate: [] as Array<Record<string, unknown>>,
    ledgerFindUnique: [] as Array<Record<string, unknown>>,
    orderCreate: [] as Array<Record<string, unknown>>,
    softDeleteCalls: [] as Array<Record<string, unknown>>,
  }
  let ledgerCreateThrowsP2002Next = false

  const tx = {
    deviceRegistry: {
      findUnique: async ({ where }: { where: { deviceId?: string; id?: string } }) => {
        if (where.deviceId !== undefined) {
          const row = devices.find((d) => d.deviceId === where.deviceId)
          return row ? { ...row } : null
        }
        if (where.id !== undefined) {
          const row = devices.find((d) => d.id === where.id)
          return row ? { ...row } : null
        }
        return null
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        captured.deviceCreate.push(data)
        const row: DeviceRow = {
          id: id('dev'),
          deviceId: (data.deviceId as string) ?? '',
          name: (data.name as string) ?? '',
          type: (data.type as string) ?? 'pos',
          locationId: (data.locationId as string | null) ?? null,
          status: (data.status as string) ?? 'offline',
          lastSeenAt: (data.lastSeenAt as Date | null) ?? null,
          appVersion: (data.appVersion as string) ?? '',
        }
        devices.push(row)
        return { ...row }
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        captured.deviceUpdate.push({ where, data })
        const row = devices.find((d) => d.id === where.id)
        if (!row) {
          throw new Prisma.PrismaClientKnownRequestError('Not found', { code: 'P2025', clientVersion: 'test' })
        }
        Object.assign(row, data)
        return { ...row }
      },
    },
    deviceSyncOperation: {
      findUnique: async ({ where }: { where: { deviceId_clientOperationId?: { deviceId: string; clientOperationId: string }; id?: string } }) => {
        captured.ledgerFindUnique.push(where as Record<string, unknown>)
        const key = where.deviceId_clientOperationId
        if (key) {
          const row = ledger.find(
            (l) => l.deviceId === key.deviceId && l.clientOperationId === key.clientOperationId,
          )
          return row ? { ...row } : null
        }
        if (where.id !== undefined) {
          const row = ledger.find((l) => l.id === where.id)
          return row ? { ...row } : null
        }
        return null
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        captured.ledgerCreate.push(data)
        if (ledgerCreateThrowsP2002Next) {
          ledgerCreateThrowsP2002Next = false
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
            code: 'P2002',
            clientVersion: 'test',
          })
        }
        const row: LedgerRow = {
          id: id('dso'),
          deviceId: (data.deviceId as string) ?? '',
          locationId: (data.locationId as string) ?? '',
          clientOperationId: (data.clientOperationId as string) ?? '',
          operationType: (data.operationType as string) ?? '',
          payload: data.payload,
          clientRetryCount: (data.clientRetryCount as number) ?? 0,
          status: (data.status as string) ?? 'applied',
          orderId: (data.orderId as string | null) ?? null,
          ack: data.ack,
          lastError: (data.lastError as string | null) ?? null,
          employeeId: (data.employeeId as string | null) ?? null,
          receivedAt: new Date(),
          processedAt: (data.processedAt as Date | null) ?? null,
        }
        ledger.push(row)
        return { ...row }
      },
      findMany: async (args: { where?: Record<string, unknown>; orderBy?: Record<string, string>; take?: number; select?: Record<string, unknown> }) => {
        let rows = [...ledger]
        const where = args.where ?? {}
        if (where.locationId !== undefined) rows = rows.filter((r) => r.locationId === where.locationId)
        rows.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())
        if (args.take) rows = rows.slice(0, args.take)
        if (args.select) {
          const keys = Object.keys(args.select).filter((k) => args.select?.[k])
          return rows.map((r) => Object.fromEntries(keys.map((k) => [k, (r as unknown as Record<string, unknown>)[k]])))
        }
        return rows.map((r) => ({ ...r }))
      },
      groupBy: async (args: { by: string[]; _count?: Record<string, boolean>; where?: Record<string, unknown> }) => {
        let rows = [...ledger]
        if (args.where?.locationId !== undefined) rows = rows.filter((r) => r.locationId === args.where?.locationId)
        const tally = new Map<string, number>()
        for (const r of rows) tally.set(r.status, (tally.get(r.status) ?? 0) + 1)
        return Array.from(tally.entries()).map(([status, count]) => ({ status, _count: { _all: count } }))
      },
    },
    order: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const rows = orders.filter((o) => {
          if (where.id !== undefined && o.id !== where.id) return false
          if (where.locationId !== undefined && o.locationId !== where.locationId) return false
          if (where.idempotencyKey !== undefined && o.idempotencyKey !== where.idempotencyKey) return false
          return true
        })
        const row = rows[0]
        return row ? { ...row, receipt: [...row.receipt], orderItems: row.orderItems.map((i) => ({ ...i })) } : null
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = orders.find((o) => o.id === where.id)
        return row ? { ...row, receipt: [...row.receipt], orderItems: row.orderItems.map((i) => ({ ...i })) } : null
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        captured.orderCreate.push(data)
        const items = ((data.orderItems as { create: Array<Record<string, unknown>> })?.create ?? []) as Array<Record<string, unknown>>
        const orderId = id('ord')
        const row: OrderRow = {
          id: orderId,
          orderNumber: (data.orderNumber as number) ?? 0,
          idempotencyKey: (data.idempotencyKey as string) ?? '',
          type: (data.type as string) ?? 'dine-in',
          status: (data.status as string) ?? 'pending',
          firedAt: (data.firedAt as Date | null) ?? null,
          tableId: (data.tableId as string | null) ?? null,
          locationId: (data.locationId as string) ?? '',
          subtotal: (data.subtotal as number) ?? 0,
          tax: (data.tax as number) ?? 0,
          discount: (data.discount as number) ?? 0,
          total: (data.total as number) ?? 0,
          paymentStatus: (data.paymentStatus as string) ?? 'unpaid',
          employeeId: (data.employeeId as string | null) ?? null,
          inventoryDeducted: (data.inventoryDeducted as boolean) ?? false,
          orderItems: items.map((it, idx) => ({
            id: `${orderId}-item-${idx + 1}`,
            orderId,
            menuItemId: (it.menuItemId as string) ?? '',
            quantity: (it.quantity as number) ?? 1,
            price: (it.price as number) ?? 0,
            status: 'pending',
          })),
          receipt: [],
        }
        orders.push(row)
        return {
          ...row,
          orderItems: row.orderItems.map((i) => ({ ...i, menuItem: menuItems.find((m) => m.id === i.menuItemId) ?? null })),
        }
      },
    },
    table: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = tables.find((t) => t.id === where.id)
        return row ? { ...row } : null
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        let count = 0
        for (const t of tables) {
          if (where.id !== undefined && t.id !== where.id) continue
          if (where.status !== undefined) {
            const st = where.status as { in?: string[] }
            if (st.in && !st.in.includes(t.status)) continue
          }
          Object.assign(t, data)
          count++
        }
        return { count }
      },
    },
    menuItem: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        const ids = (where.id as { in?: string[] })?.in
        return menuItems.filter((m) => !ids || ids.includes(m.id)).map((m) => ({ ...m }))
      },
    },
    menuItemModifierGroup: {
      findMany: async () => [],
    },
    location: {
      findFirst: async () => null,
    },
  }

  const db = {
    ...tx,
    $transaction: async <T>(fn: (t: typeof tx) => Promise<T>) => fn(tx),
  }

  return {
    db, devices, ledger, orders, tables, menuItems, audit, captured,
    forceLedgerP2002Next: () => { ledgerCreateThrowsP2002Next = true },
  }
}

// ---------- Mocki (vi.hoisted ref + getter, hišni stil) ----------
const ref = vi.hoisted(() => ({ current: null as unknown as ReturnType<typeof createDb> }))
ref.current = createDb()

const m = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  performOrderSoftDelete: vi.fn(),
  getNextOrderNumber: vi.fn(),
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
  }
})

vi.mock('@/app/api/orders/[id]/webhooks/perform-soft-delete', () => ({
  performOrderSoftDelete: (...args: unknown[]) => {
    ref.current.captured.softDeleteCalls.push({ args })
    return m.performOrderSoftDelete(...args)
  },
}))

// Zaloga + stranski učinki post-kreacije so mockani na meji (lastna tx
// semantika, pokrita v r120/r124 testih) — predmet tega testa je sync kanon.
vi.mock('@/lib/stock-deduction', () => ({
  checkStockAvailability: async () => ({ warnings: [], deductions: [] }),
}))
vi.mock('@/app/api/orders/_helpers/stock', () => ({
  handleStockDeduction: async () => ({ stockDeducted: false }),
  handlePostCreationEffects: async () => {},
}))
vi.mock('@/lib/counters', () => ({
  getNextOrderNumber: (...args: unknown[]) => m.getNextOrderNumber(...args),
  getNextCounter: async () => 1,
  scopedCounterName: (name: string) => name,
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: async () => ({ allowed: true, remaining: 10, retryAfterMs: 0 }),
  getClientIp: () => '127.0.0.1',
  DEVICE_SYNC_LIMIT: { maxRequests: 60, windowMs: 60_000 },
  AUTHENTICATED_LIMIT: { maxRequests: 120, windowMs: 60_000 },
}))
vi.mock('@/lib/rate-limit/response', () => ({
  rateLimitedResponse: () => new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 }),
}))

import { POST as deviceSyncPost, GET as deviceSyncGet } from '@/app/api/device-sync/route'
import { handlePostOrder } from '@/app/api/orders/_helpers/post-handler'
import { POST as paymentsPost } from '@/app/api/payments/route'

const state = ref.current

// ---------- Helperji ----------
function seedBase() {
  state.devices.length = 0
  state.ledger.length = 0
  state.orders.length = 0
  state.tables.length = 0
  state.menuItems.length = 0
  state.audit.length = 0
  for (const key of Object.keys(state.captured) as Array<keyof typeof state.captured>) {
    state.captured[key].length = 0
  }

  state.menuItems.push(
    { id: MENU_ITEM_1, vatRate: 9.5, price: 10 },
    { id: MENU_ITEM_2, vatRate: 22, price: 8 },
  )
  m.getNextOrderNumber.mockResolvedValue(101)
}

function resetMocks() {
  m.requireAuth.mockResolvedValue({
    session: { employeeId: EMP_1, locationId: LOC_1, role: 'manager', permissions: ['take_orders'] },
    error: null,
  })
  m.performOrderSoftDelete.mockResolvedValue({ ok: true })
}

beforeEach(() => {
  vi.clearAllMocks()
  seedBase()
  resetMocks()
})

function authSession(role = 'manager', locationId: string | null = LOC_1, employeeId = EMP_1) {
  m.requireAuth.mockResolvedValue({
    session: { employeeId, locationId, role, permissions: ['take_orders'] },
    error: null,
  })
}

function createOpPayload(over: Record<string, unknown> = {}) {
  return {
    type: 'dine-in',
    orderItems: [{ menuItemId: MENU_ITEM_1, quantity: 2 }],
    idempotencyKey: IDEM_KEY_1,
    ...over,
  }
}

function deviceSyncRequest(body: unknown) {
  return new Request('http://local/api/device-sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer test-token' },
    body: JSON.stringify(body),
  })
}

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

// ============================================
// A. POST — batch happy path (order.create)
// ============================================
describe('R128 device-sync POST — order.create happy path', () => {
  it('aplicira naročilo, avto-registrira napravo, zapiše ledger + batch audit', async () => {
    const res = await deviceSyncPost(
      deviceSyncRequest({
        deviceId: DEVICE_1,
        operations: [
          { clientOperationId: OP_1, type: 'order.create', payload: createOpPayload(), retryCount: 0 },
        ],
      }),
    )
    expect(res.status).toBe(200)
    const body = await parseJson(res)
    expect(body.appliedCount).toBe(1)
    expect(body.duplicateCount).toBe(0)
    expect(body.rejectedCount).toBe(0)

    const results = body.results as Array<Record<string, unknown>>
    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('applied')
    expect(typeof results[0].orderId).toBe('string')

    // Naročilo res ustvarjeno (1×)
    expect(state.orders).toHaveLength(1)
    expect(state.orders[0].idempotencyKey).toBe(IDEM_KEY_1)
    expect(state.orders[0].locationId).toBe(LOC_1)
    expect(state.orders[0].employeeId).toBe(EMP_1)

    // Samodejna registracija naprave (online + heartbeat)
    expect(state.devices).toHaveLength(1)
    expect(state.devices[0].deviceId).toBe(DEVICE_1)
    expect(state.devices[0].name).toBe(`POS-${DEVICE_1.slice(0, 8)}`)
    expect(state.devices[0].locationId).toBe(LOC_1)
    expect(state.devices[0].status).toBe('online')

    // Ledger vrstica (exactly-once dokaz)
    expect(state.ledger).toHaveLength(1)
    const row = state.ledger[0]
    expect(row.deviceId).toBe(DEVICE_1)
    expect(row.clientOperationId).toBe(OP_1)
    expect(row.operationType).toBe('order.create')
    expect(row.status).toBe('applied')
    expect(row.orderId).toBe(state.orders[0].id)
    expect(row.locationId).toBe(LOC_1)
    expect(row.employeeId).toBe(EMP_1)
    expect(row.processedAt).not.toBeNull()

    // Batch audit — TOČNO en vnos
    expect(state.audit).toHaveLength(1)
    expect(state.audit[0].action).toBe('DEVICE_SYNC')
    expect(state.audit[0].details).toMatchObject({ deviceId: DEVICE_1, total: 1, applied: 1, duplicate: 0, rejected: 0 })
  })

  it('neznana naprava se registrira tudi za super-admina (null scope → locationId null)', async () => {
    authSession('admin', null, EMP_2)
    const res = await deviceSyncPost(
      deviceSyncRequest({
        deviceId: DEVICE_1,
        operations: [{ clientOperationId: OP_1, type: 'order.create', payload: createOpPayload() }],
      }),
    )
    expect(res.status).toBe(200)
    // Super-admin brez ?locationId: lokacija naročila iz payloada NI ugibana →
    // post-handler fail-closed 400 (brez mize/izrecnega ?locationId)
    const body = await parseJson(res)
    expect(body.rejectedCount).toBe(1)
    const results = body.results as Array<Record<string, unknown>>
    expect(results[0].status).toBe('rejected')
    // Naprava vseeno registrirana (globalna, locationId null)
    expect(state.devices).toHaveLength(1)
    expect(state.devices[0].locationId).toBeNull()
    // Ledger: rejected brez znane lokacije → vrstica izpuščena (NOT NULL constraint)
    expect(state.ledger).toHaveLength(0)
  })

  it('obstoječa naprava dobi heartbeat (status online + lastSeenAt), ne duplikata', async () => {
    state.devices.push({
      id: 'dev-1', deviceId: DEVICE_1, name: 'POS-stara', type: 'pos',
      locationId: LOC_1, status: 'offline', lastSeenAt: null, appVersion: '',
    })
    const res = await deviceSyncPost(
      deviceSyncRequest({
        deviceId: DEVICE_1,
        operations: [{ clientOperationId: OP_1, type: 'order.create', payload: createOpPayload() }],
      }),
    )
    expect(res.status).toBe(200)
    expect(state.devices).toHaveLength(1)
    expect(state.devices[0].status).toBe('online')
    expect(state.devices[0].lastSeenAt).not.toBeNull()
    expect(state.captured.deviceUpdate).toHaveLength(1)
    expect(state.captured.deviceCreate).toHaveLength(0)
  })
})

// ============================================
// B. EXACTLY-ONCE: replay istega clientOperationId
// ============================================
describe('R128 device-sync — exactly-once replay', () => {
  it('isti clientOperationId 2× → drugič duplicate BREZ re-aplikacije (order.create count nespremenjen)', async () => {
    const batch = {
      deviceId: DEVICE_1,
      operations: [{ clientOperationId: OP_1, type: 'order.create', payload: createOpPayload() }],
    }
    const first = await deviceSyncPost(deviceSyncRequest(batch))
    expect((await parseJson(first)).appliedCount).toBe(1)
    expect(state.orders).toHaveLength(1)
    expect(state.ledger).toHaveLength(1)

    const second = await deviceSyncPost(deviceSyncRequest(batch))
    expect(second.status).toBe(200)
    const body2 = await parseJson(second)
    expect(body2.appliedCount).toBe(0)
    expect(body2.duplicateCount).toBe(1)
    const results = body2.results as Array<Record<string, unknown>>
    expect(results[0].status).toBe('duplicate')
    expect(results[0].replay).toBe(true)
    expect(results[0].orderId).toBe(state.orders[0].id)

    // NIKOLI re-aplikacija: order count + ledger count nespremenjena
    expect(state.orders).toHaveLength(1)
    expect(state.ledger).toHaveLength(1)
    // Ledger pre-check je bil res izveden (composite findUnique)
    expect(state.captured.ledgerFindUnique.length).toBeGreaterThanOrEqual(2)
  })

  it('različna naprava, ISTI clientOperationId → ni replay-a (composite ključ je per-device)', async () => {
    await deviceSyncPost(deviceSyncRequest({
      deviceId: DEVICE_1,
      operations: [{ clientOperationId: OP_1, type: 'order.create', payload: createOpPayload() }],
    }))
    const res = await deviceSyncPost(deviceSyncRequest({
      deviceId: 'pos-device-9999',
      operations: [{ clientOperationId: OP_1, type: 'order.create', payload: createOpPayload({ idempotencyKey: 'offline-key-0002' }) }],
    }))
    const body = await parseJson(res)
    // Druga naprava = druga operacija → aplicirana (idempotencyKey različen)
    expect(body.appliedCount).toBe(1)
    expect(state.orders).toHaveLength(2)
    expect(state.ledger).toHaveLength(2)
  })

  it('isti idempotencyKey, RAZLIČNA naprava → delegat replay (200) → status duplicate', async () => {
    await deviceSyncPost(deviceSyncRequest({
      deviceId: DEVICE_1,
      operations: [{ clientOperationId: OP_1, type: 'order.create', payload: createOpPayload() }],
    }))
    const res = await deviceSyncPost(deviceSyncRequest({
      deviceId: 'pos-device-9999',
      operations: [{ clientOperationId: OP_2, type: 'order.create', payload: createOpPayload() }],
    }))
    const body = await parseJson(res)
    expect(body.duplicateCount).toBe(1)
    expect(state.orders).toHaveLength(1)
    const results = body.results as Array<Record<string, unknown>>
    expect(results[0].status).toBe('duplicate')
    expect(results[0].orderId).toBe(state.orders[0].id)
  })
})

// ============================================
// C. order.cancel — delegacija + preslikava razlogov
// ============================================
describe('R128 device-sync — order.cancel', () => {
  function seedOrder(over: Partial<OrderRow> = {}): OrderRow {
    const row: OrderRow = {
      id: 'ord-1',
      orderNumber: 101,
      idempotencyKey: 'srv-key-0001',
      type: 'dine-in',
      status: 'pending',
      firedAt: new Date(),
      tableId: null,
      locationId: LOC_1,
      subtotal: 20,
      tax: 1.9,
      discount: 0,
      total: 21.9,
      paymentStatus: 'unpaid',
      employeeId: EMP_1,
      inventoryDeducted: true,
      orderItems: [],
      receipt: [],
      ...over,
    }
    state.orders.push(row)
    return row
  }

  it('uspešen preklic delegira na performOrderSoftDelete z (id, order, employeeId) → applied', async () => {
    seedOrder()
    m.performOrderSoftDelete.mockResolvedValue({ ok: true })

    const res = await deviceSyncPost(deviceSyncRequest({
      deviceId: DEVICE_1,
      operations: [{ clientOperationId: OP_1, type: 'order.cancel', payload: { orderId: 'ord-1', reason: 'Netakar preklical offline' } }],
    }))
    const body = await parseJson(res)
    expect(body.appliedCount).toBe(1)
    const results = body.results as Array<Record<string, unknown>>
    expect(results[0].status).toBe('applied')
    expect(results[0].orderId).toBe('ord-1')

    // Delegacija: prvi argument id, tretji employeeId iz seje
    expect(m.performOrderSoftDelete).toHaveBeenCalledTimes(1)
    const [callId, callOrder, callEmployee] = m.performOrderSoftDelete.mock.calls[0] as [string, Record<string, unknown>, string | undefined]
    expect(callId).toBe('ord-1')
    expect(callOrder.tableId).toBeNull()
    expect(callOrder.locationId).toBe(LOC_1)
    expect(callEmployee).toBe(EMP_1)

    // Ledger applied
    expect(state.ledger).toHaveLength(1)
    expect(state.ledger[0].status).toBe('applied')
    expect(state.ledger[0].operationType).toBe('order.cancel')
  })

  it('already_cancelled → duplicate (in NE again preklic)', async () => {
    const order = seedOrder()
    order.status = 'cancelled'
    m.performOrderSoftDelete.mockResolvedValue({ ok: false, reason: 'already_cancelled' })

    const res = await deviceSyncPost(deviceSyncRequest({
      deviceId: DEVICE_1,
      operations: [{ clientOperationId: OP_1, type: 'order.cancel', payload: { orderId: 'ord-1' } }],
    }))
    const body = await parseJson(res)
    expect(body.duplicateCount).toBe(1)
    const results = body.results as Array<Record<string, unknown>>
    expect(results[0].status).toBe('duplicate')
    expect(results[0].orderId).toBe('ord-1')
    expect(state.ledger[0].status).toBe('duplicate')
  })

  it('razlogi: paid → PAID_ORDER_CANCEL, completed → ORDER_COMPLETED, conflict → SYNC_CONFLICT (rejected)', async () => {
    const cases: Array<{ reason: string; error: string }> = [
      { reason: 'paid', error: 'PAID_ORDER_CANCEL' },
      { reason: 'completed', error: 'ORDER_COMPLETED' },
      { reason: 'conflict', error: 'SYNC_CONFLICT' },
      { reason: 'not_found', error: 'ORDER_NOT_FOUND' },
    ]
    for (const c of cases) {
      seedBase()
      resetMocks()
      seedOrder()
      m.performOrderSoftDelete.mockResolvedValue({ ok: false, reason: c.reason })
      const res = await deviceSyncPost(deviceSyncRequest({
        deviceId: DEVICE_1,
        operations: [{ clientOperationId: OP_1, type: 'order.cancel', payload: { orderId: 'ord-1' } }],
      }))
      const body = await parseJson(res)
      expect(body.rejectedCount).toBe(1)
      const results = body.results as Array<Record<string, unknown>>
      expect(results[0].error).toBe(c.error)
      expect(state.ledger[0].status).toBe('rejected')
      expect(state.ledger[0].lastError).toBe(c.error)
    }
  })

  it('naročilo druge lokacije → ORDER_NOT_FOUND (tenant scope fail-closed)', async () => {
    seedOrder({ locationId: LOC_2 })
    const res = await deviceSyncPost(deviceSyncRequest({
      deviceId: DEVICE_1,
      operations: [{ clientOperationId: OP_1, type: 'order.cancel', payload: { orderId: 'ord-1' } }],
    }))
    const body = await parseJson(res)
    expect(body.rejectedCount).toBe(1)
    const results = body.results as Array<Record<string, unknown>>
    expect(results[0].error).toBe('ORDER_NOT_FOUND')
    expect(m.performOrderSoftDelete).not.toHaveBeenCalled()
  })

  it('neveljaven cancel payload → INVALID_CANCEL_PAYLOAD', async () => {
    const res = await deviceSyncPost(deviceSyncRequest({
      deviceId: DEVICE_1,
      operations: [{ clientOperationId: OP_1, type: 'order.cancel', payload: { reason: 'brez orderId' } }],
    }))
    const body = await parseJson(res)
    const results = body.results as Array<Record<string, unknown>>
    expect(results[0].status).toBe('rejected')
    expect(results[0].error).toBe('INVALID_CANCEL_PAYLOAD')
  })
})

// ============================================
// D. Fail-closed varnost
// ============================================
describe('R128 device-sync — fail-closed', () => {
  it('DEVICE_LOCATION_MISMATCH: naprava vezana na drugo lokacijo → 403, nič ne se aplicira', async () => {
    state.devices.push({
      id: 'dev-2', deviceId: DEVICE_1, name: 'POS-tuja', type: 'pos',
      locationId: LOC_2, status: 'offline', lastSeenAt: null, appVersion: '',
    })
    const res = await deviceSyncPost(deviceSyncRequest({
      deviceId: DEVICE_1,
      operations: [{ clientOperationId: OP_1, type: 'order.create', payload: createOpPayload() }],
    }))
    expect(res.status).toBe(403)
    const body = await parseJson(res)
    expect(body.error).toBe('DEVICE_LOCATION_MISMATCH')
    expect(state.orders).toHaveLength(0)
    expect(state.ledger).toHaveLength(0)
    expect(state.audit).toHaveLength(0)
  })

  it('regularna seja brez lokacije → 403 (resolveTenantLocationIdOrThrow REALNI)', async () => {
    authSession('manager', null, EMP_1)
    const res = await deviceSyncPost(deviceSyncRequest({
      deviceId: DEVICE_1,
      operations: [{ clientOperationId: OP_1, type: 'order.create', payload: createOpPayload() }],
    }))
    expect(res.status).toBe(403)
    expect(state.orders).toHaveLength(0)
  })

  it('Zod: slab deviceId → 400', async () => {
    const res = await deviceSyncPost(deviceSyncRequest({
      deviceId: 'kratki!%', // <8 znakov + neveljavni znaki
      operations: [{ clientOperationId: OP_1, type: 'order.create', payload: createOpPayload() }],
    }))
    expect(res.status).toBe(400)
  })

  it('Zod: več kot 50 operacij → 400', async () => {
    const operations = Array.from({ length: 51 }, (_, i) => ({
      clientOperationId: `op-${String(i).padStart(8, '0')}`,
      type: 'order.cancel' as const,
      payload: { orderId: 'ord-x' },
    }))
    const res = await deviceSyncPost(deviceSyncRequest({ deviceId: DEVICE_1, operations }))
    expect(res.status).toBe(400)
  })

  it('Zod: neznan tip operacije → 400 (whitelist enum)', async () => {
    const res = await deviceSyncPost(deviceSyncRequest({
      deviceId: DEVICE_1,
      operations: [{ clientOperationId: OP_1, type: 'payment.create', payload: {} }],
    }))
    expect(res.status).toBe(400)
    expect(state.orders).toHaveLength(0)
  })
})

// ============================================
// E. Payments offline guard (fail-closed 422)
// ============================================
describe('R128 payments — offline guard', () => {
  it('x-offline-sync: true → 422 PAYMENT_OFFLINE_NOT_ALLOWED ŠE PRED auth', async () => {
    const res = await paymentsPost(
      new Request('http://local/api/payments', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-offline-sync': 'true' },
        body: '{}',
      }),
    )
    expect(res.status).toBe(422)
    const body = await parseJson(res)
    expect(body.error).toBe('PAYMENT_OFFLINE_NOT_ALLOWED')
    // Poceni header check je PRVI — requireAuth se ni niti poklical
    expect(m.requireAuth).not.toHaveBeenCalled()
  })
})

// ============================================
// F. Orders one-by-one pot — offline ledger ob headerjih
// ============================================
describe('R128 orders — recordOfflineOrderLedger (x-offline-sync headerji)', () => {
  function offlineOrderRequest(headers: Record<string, string>, payload: Record<string, unknown>) {
    return new Request('http://local/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(payload),
    })
  }

  it('s headerji: 201 → ledger applied (orderId + employeeId + payload snapshot)', async () => {
    const res = await handlePostOrder(
      offlineOrderRequest(
        {
          'x-offline-sync': 'true',
          'x-device-id': DEVICE_1,
          'x-client-operation-id': OP_1,
        },
        createOpPayload(),
      ),
      {
        session: { employeeId: EMP_1, locationId: LOC_1, role: 'manager' },
        scope: { locationId: LOC_1 },
        searchParams: null,
      },
    )
    expect(res.status).toBe(201)
    expect(state.orders).toHaveLength(1)
    expect(state.ledger).toHaveLength(1)
    expect(state.ledger[0].status).toBe('applied')
    expect(state.ledger[0].operationType).toBe('order.create')
    expect(state.ledger[0].orderId).toBe(state.orders[0].id)
    expect(state.ledger[0].employeeId).toBe(EMP_1)
    expect(state.ledger[0].deviceId).toBe(DEVICE_1)
    expect(state.ledger[0].clientOperationId).toBe(OP_1)
    // payload snapshot
    expect((state.ledger[0].payload as Record<string, unknown>).idempotencyKey).toBe(IDEM_KEY_1)
  })

  it('brez headerjev: 201, vendar NO ledger vrstice', async () => {
    const res = await handlePostOrder(
      offlineOrderRequest({}, createOpPayload()),
      {
        session: { employeeId: EMP_1, locationId: LOC_1, role: 'manager' },
        scope: { locationId: LOC_1 },
        searchParams: null,
      },
    )
    expect(res.status).toBe(201)
    expect(state.orders).toHaveLength(1)
    expect(state.ledger).toHaveLength(0)
  })

  it('replay (200 fast-path) s headerji → ledger duplicate; headerji z neveljavnim formatom → brez ledgerja', async () => {
    // Pre-seedan replay: isti idempotencyKey
    state.orders.push({
      id: 'ord-existing', orderNumber: 5, idempotencyKey: IDEM_KEY_1, type: 'dine-in',
      status: 'pending', firedAt: null, tableId: null, locationId: LOC_1,
      subtotal: 20, tax: 1.9, discount: 0, total: 21.9, paymentStatus: 'unpaid',
      employeeId: EMP_1, inventoryDeducted: false, orderItems: [], receipt: [],
    })

    const replay = await handlePostOrder(
      offlineOrderRequest(
        { 'x-offline-sync': 'true', 'x-device-id': DEVICE_1, 'x-client-operation-id': OP_1 },
        createOpPayload(),
      ),
      { session: { employeeId: EMP_1, locationId: LOC_1, role: 'manager' }, scope: { locationId: LOC_1 }, searchParams: null },
    )
    expect(replay.status).toBe(200)
    expect(state.ledger).toHaveLength(1)
    expect(state.ledger[0].status).toBe('duplicate')

    // Neveljaven header format → brez ledgerja (fail-closed skip)
    const bad = await handlePostOrder(
      offlineOrderRequest(
        { 'x-offline-sync': 'true', 'x-device-id': 'XX', 'x-client-operation-id': OP_2 },
        createOpPayload({ idempotencyKey: 'offline-key-0999' }),
      ),
      { session: { employeeId: EMP_1, locationId: LOC_1, role: 'manager' }, scope: { locationId: LOC_1 }, searchParams: null },
    )
    expect(bad.status).toBe(201)
    expect(state.ledger).toHaveLength(1) // še vedno samo replay vrstica
  })
})

// ============================================
// G. GET — monitoring
// ============================================
describe('R128 device-sync GET — monitoring', () => {
  it('vrne zadnjih 50 operacij BREZ payload/ack teles + stats groupBy status', async () => {
    const now = Date.now()
    state.ledger.push(
      {
        id: 'dso-1', deviceId: DEVICE_1, locationId: LOC_1, clientOperationId: OP_1,
        operationType: 'order.create', payload: { secret: 'velik-body' }, clientRetryCount: 0,
        status: 'applied', orderId: 'ord-1', ack: { status: 'applied', orderId: 'ord-1' },
        lastError: null, employeeId: EMP_1, receivedAt: new Date(now), processedAt: new Date(now),
      },
      {
        id: 'dso-2', deviceId: DEVICE_1, locationId: LOC_1, clientOperationId: OP_2,
        operationType: 'order.cancel', payload: { orderId: 'ord-2' }, clientRetryCount: 3,
        status: 'rejected', orderId: 'ord-2', ack: { status: 'rejected', error: 'PAID_ORDER_CANCEL' },
        lastError: 'PAID_ORDER_CANCEL', employeeId: EMP_1, receivedAt: new Date(now + 1), processedAt: new Date(now + 1),
      },
      {
        id: 'dso-3', deviceId: 'pos-device-9999', locationId: LOC_2, clientOperationId: OP_1,
        operationType: 'order.create', payload: {}, clientRetryCount: 0,
        status: 'rejected', orderId: null, ack: null, lastError: 'ORDER_CREATE_FAILED',
        employeeId: EMP_2, receivedAt: new Date(now + 2), processedAt: new Date(now + 2),
      },
    )

    const res = await deviceSyncGet(
      new Request('http://local/api/device-sync', { headers: { authorization: 'Bearer t' } }),
    )
    expect(res.status).toBe(200)
    const body = await parseJson(res)
    const operations = body.operations as Array<Record<string, unknown>>
    // Scope LOC_1: samo 2 vrstici; LOC_2 izključena
    expect(operations).toHaveLength(2)
    // Brez payload/ack teles (monitoring privacy)
    for (const op of operations) {
      expect(op).not.toHaveProperty('payload')
      expect(op).not.toHaveProperty('ack')
      expect(op).toHaveProperty('clientOperationId')
      expect(op).toHaveProperty('status')
      expect(op).toHaveProperty('receivedAt')
    }
    // Stats groupBy status (scoped)
    expect(body.stats).toEqual([
      { status: 'applied', count: 1 },
      { status: 'rejected', count: 1 },
    ])
  })
})
