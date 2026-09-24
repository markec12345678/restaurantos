// ============================================
// R119 / EPIC #115 §3 — WASTE LEDGER TESTI (/api/waste + kanon)
// ============================================
// Pokritje:
//  • W-1 happy path: atomarna zabeležba = odpis zaloge + StockTransaction
//    ('write-off') + WasteRecord snapshot v eni transakciji + audit
//  • W-2 nezadostna zaloga → 400, NIČ ne nastane (fail-closed)
//  • W-3 idempotency: fast-path replay (200, enkraten odpis) + P2002 race → 409
//  • W-4 tenant/location isolation: tuj artikel → 404; user brez lokacije → 403;
//    skupna (NULL) zaloga → dovoljena na lokaciji (dokumentirana semantika)
//  • W-5 validacija: neznan razlog / negativna količina → 400; brez seje → 401
//  • W-6 reversal: kompenzacijski 'return', dvojni reverse → 409, tuj zapis → 404
//  • W-7 GET summary: scope, izključitev razveljavljenih, poštene metrike
//    (wasteRate = odpad/COGS, foodCost = COGS/prihodek)
//  • W-8 strukturni pins: SKUPNI advisory lock ključ + pogojni decrement guard
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'

// ---------- In-memory trap DB (realne semantike: OR scope, guard decrement, unique) ----------

interface InvRow {
  id: string
  name: string
  unit: string
  category: string
  quantity: number
  costPerUnit: number
  locationId: string | null
}
interface WasteRow {
  id: string
  locationId: string
  inventoryItemId: string
  quantity: number
  unit: string
  reason: string
  note: string
  costPerUnit: number
  totalCost: number
  stockTransactionId: string | null
  reversalStockTransactionId: string | null
  reversedAt: Date | null
  idempotencyKey: string | null
  recordedByUserId: string | null
  createdAt: Date
}
interface StockTxRow {
  id: string
  inventoryItemId: string
  type: string
  quantity: number
  previousQty: number
  newQty: number
  costPerUnit: number
  totalCost: number
  reason: string
  note: string
  employeeName: string
  createdAt: Date
}
interface OrderRow {
  id: string
  locationId: string
  total: number
  paymentStatus: string
  createdAt: Date
}

function createDb() {
  let seq = 0
  const id = (p: string) => `${p}-${++seq}`
  const inv: InvRow[] = []
  const waste: WasteRow[] = []
  const stockTx: StockTxRow[] = []
  const orders: OrderRow[] = []
  const audit: Record<string, unknown>[] = []
  const lockKeys: string[] = []
  const updateManyCalls: unknown[] = []
  let createThrowsP2002Next = false

  /** Emulacija wasteItemWhere: id + (locationId = cilj OR NULL skupni vir) */
  function findInv(where: { id: string; OR?: { locationId: string | null }[] }): InvRow | null {
    const row = inv.find(i => i.id === where.id)
    if (!row) return null
    if (where.OR && !where.OR.some(o => o.locationId === row.locationId)) return null
    return row
  }

  const makeClients = () => ({
    wasteRecord: {
      findFirst: async ({ where }: { where: { locationId?: string; idempotencyKey?: string | null; id?: string } }) =>
        waste.find(w =>
          (where.id ? w.id === where.id : true) &&
          (where.locationId ? w.locationId === where.locationId : true) &&
          (where.idempotencyKey !== undefined ? w.idempotencyKey === where.idempotencyKey : true),
        ) ?? null,
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        waste
          .filter(w => {
            if (where.locationId && w.locationId !== where.locationId) return false
            const range = where.createdAt as { gte?: Date; lte?: Date } | undefined
            if (range?.gte && w.createdAt < range.gte) return false
            if (range?.lte && w.createdAt > range.lte) return false
            if (where.reason && w.reason !== where.reason) return false
            if (where.inventoryItemId && w.inventoryItemId !== where.inventoryItemId) return false
            return true
          })
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        // unique (locationId, idempotencyKey) trap — kot prava baza
        if (data.idempotencyKey && waste.some(w => w.locationId === data.locationId && w.idempotencyKey === data.idempotencyKey)) {
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' })
        }
        if (createThrowsP2002Next) {
          createThrowsP2002Next = false
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' })
        }
        const row: WasteRow = {
          id: id('wr'),
          locationId: data.locationId as string,
          inventoryItemId: data.inventoryItemId as string,
          quantity: data.quantity as number,
          unit: data.unit as string,
          reason: data.reason as string,
          note: data.note as string,
          costPerUnit: data.costPerUnit as number,
          totalCost: data.totalCost as number,
          stockTransactionId: (data.stockTransactionId as string) ?? null,
          reversalStockTransactionId: null,
          reversedAt: null,
          idempotencyKey: (data.idempotencyKey as string) ?? null,
          recordedByUserId: (data.recordedByUserId as string) ?? null,
          createdAt: new Date(),
        }
        waste.push(row)
        return { ...row }
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = waste.find(w => w.id === where.id)
        if (!row) throw new Prisma.PrismaClientKnownRequestError('Not found', { code: 'P2025', clientVersion: 'test' })
        Object.assign(row, data)
        return { ...row }
      },
    },
    inventoryItem: {
      findFirst: async ({ where }: { where: { id: string; OR?: { locationId: string | null }[] } }) => findInv(where),
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = inv.find(i => i.id === where.id)
        return row ? { ...row } : null
      },
      updateMany: async ({ where, data }: { where: { id: string; quantity?: { gte: number } }; data: { quantity: { decrement: number } } }) => {
        updateManyCalls.push({ where, data })
        const row = inv.find(i => i.id === where.id)
        if (!row) return { count: 0 }
        if (where.quantity?.gte !== undefined && row.quantity < where.quantity.gte) return { count: 0 }
        row.quantity -= data.quantity.decrement
        return { count: 1 }
      },
      update: async ({ where, data }: { where: { id: string }; data: { quantity?: { increment: number } } }) => {
        const row = inv.find(i => i.id === where.id)
        if (!row) throw new Prisma.PrismaClientKnownRequestError('Not found', { code: 'P2025', clientVersion: 'test' })
        if (data.quantity?.increment) row.quantity += data.quantity.increment
        return { ...row }
      },
    },
    stockTransaction: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row: StockTxRow = {
          id: id('stx'),
          inventoryItemId: data.inventoryItemId as string,
          type: data.type as string,
          quantity: data.quantity as number,
          previousQty: data.previousQty as number,
          newQty: data.newQty as number,
          costPerUnit: data.costPerUnit as number,
          totalCost: data.totalCost as number,
          reason: data.reason as string,
          note: data.note as string,
          employeeName: data.employeeName as string,
          createdAt: new Date(),
        }
        stockTx.push(row)
        return { ...row }
      },
      aggregate: async ({ where }: { where: { type: string; createdAt?: { gte?: Date; lte?: Date }; inventoryItem?: { locationId?: string } } }) => {
        const rows = stockTx.filter(t => {
          if (t.type !== where.type) return false
          const item = inv.find(i => i.id === t.inventoryItemId)
          if (where.inventoryItem?.locationId && item?.locationId !== where.inventoryItem.locationId) return false
          const range = where.createdAt
          if (range?.gte && t.createdAt < range.gte) return false
          if (range?.lte && t.createdAt > range.lte) return false
          return true
        })
        return { _sum: { totalCost: rows.reduce((s, t) => s + t.totalCost, 0) } }
      },
    },
    order: {
      aggregate: async ({ where }: { where: { paymentStatus: string; createdAt?: { gte?: Date; lte?: Date }; locationId?: string } }) => {
        const rows = orders.filter(o => {
          if (o.paymentStatus !== where.paymentStatus) return false
          if (where.locationId && o.locationId !== where.locationId) return false
          const range = where.createdAt
          if (range?.gte && o.createdAt < range.gte) return false
          if (range?.lte && o.createdAt > range.lte) return false
          return true
        })
        return { _sum: { total: rows.reduce((s, o) => s + o.total, 0) } }
      },
    },
  })

  const tx = {
    ...makeClients(),
    $executeRaw: async (_strings: TemplateStringsArray, lockKey: string) => {
      lockKeys.push(lockKey)
      return 0
    },
  }

  const db = {
    ...makeClients(),
    $transaction: async <T>(fn: (txClient: typeof tx) => Promise<T>) => fn(tx),
  }

  return { db, tx, inv, waste, stockTx, orders, audit, lockKeys, updateManyCalls, forceP2002Next: () => { createThrowsP2002Next = true } }
}

// vi.hoisted: mock factory se izvede PRED modulskim scope-om — dostop prek ref.
// createDb je function declaration (hoisted) → klic takoj tukaj je varen.
const ref = vi.hoisted(() => ({ current: null as unknown as ReturnType<typeof createDb> }))
ref.current = createDb()

vi.mock('@/lib/db', () => ({
  get db() {
    return ref.current.db
  },
  createAuditLog: async (entry: Record<string, unknown>) => {
    ref.current.audit.push(entry)
  },
}))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: async () => ({ allowed: true, remaining: 10, retryAfterMs: 0 }),
  getClientIp: () => '127.0.0.1',
  AUTHENTICATED_LIMIT: { maxRequests: 120, windowMs: 60000 },
}))
vi.mock('@/lib/rate-limit/response', () => ({
  rateLimitedResponse: () => new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 }),
}))
const requireAuthMock = vi.fn()
vi.mock('@/lib/auth-middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-middleware')>()
  return {
    ...actual,
    requireAuth: (...args: unknown[]) => requireAuthMock(...args),
    // resolveTenantLocationIdOrThrow ostane REALNA (pure) — tenant semantika se testira zares
  }
})

import { POST as wastePost, GET as wasteGet } from '@/app/api/waste/route'
import { POST as reversePost } from '@/app/api/waste/[id]/reverse/route'

const state = ref.current

// ---------- Helperji ----------
function session(s: { locationId?: string | null; role?: string; employeeId?: string | null } | null) {
  requireAuthMock.mockResolvedValue(
    s
      ? { session: { employeeId: 'emp-9', ...s }, error: null }
      : { session: null, error: new Response('unauth', { status: 401 }) },
  )
}

function post(body: unknown) {
  return new Request('http://localhost:3000/api/waste', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function reverseReq(id: string) {
  return new Request(`http://localhost:3000/api/waste/${id}/reverse`, { method: 'POST' })
}

beforeEach(() => {
  vi.clearAllMocks()
  state.inv.length = 0
  state.waste.length = 0
  state.stockTx.length = 0
  state.orders.length = 0
  state.audit.length = 0
  state.lockKeys.length = 0
  state.updateManyCalls.length = 0
  state.inv.push(
    { id: 'inv-1', name: 'Mozzarella', unit: 'kg', category: 'Mlečni izdelki', quantity: 10, costPerUnit: 2.5, locationId: 'loc-1' },
    { id: 'inv-2', name: 'Testo', unit: 'kg', category: 'Ostalo', quantity: 5, costPerUnit: 1, locationId: 'loc-2' },
    { id: 'inv-shared', name: 'Olje', unit: 'L', category: 'Ostalo', quantity: 8, costPerUnit: 6, locationId: null },
  )
})

// ============================================
// W-1 HAPPY PATH
// ============================================
describe('POST /api/waste — happy path', () => {
  it('odpiše zalogo + ustvari write-off tx + WasteRecord snapshot + audit', async () => {
    session({ locationId: 'loc-1', role: 'waiter' })
    const res = await wastePost(post({ inventoryItemId: 'inv-1', quantity: 2.5, reason: 'SPOILED', note: 'plesen', idempotencyKey: 'k-1' }))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.replay).toBe(false)
    expect(data.record.locationId).toBe('loc-1')
    expect(data.record.quantity).toBe(2.5)
    expect(data.record.totalCost).toBe(6.25)
    expect(data.record.unit).toBe('kg')
    expect(data.record.costPerUnit).toBe(2.5)
    expect(data.record.reason).toBe('SPOILED')
    expect(state.inv.find(i => i.id === 'inv-1')!.quantity).toBe(7.5)
    expect(state.stockTx).toHaveLength(1)
    const stx = state.stockTx[0]
    expect(stx.type).toBe('write-off')
    expect(stx.quantity).toBe(-2.5)
    expect(stx.previousQty).toBe(10)
    expect(stx.newQty).toBe(7.5)
    expect(stx.totalCost).toBe(6.25)
    expect(data.record.stockTransactionId).toBe(stx.id)
    expect(state.audit).toHaveLength(1)
    expect(state.audit[0]).toMatchObject({ action: 'WASTE_CREATE', entityType: 'WasteRecord', locationId: 'loc-1' })
  })
})

// ============================================
// W-2 NEZADOSTNA ZALOGA
// ============================================
describe('POST /api/waste — nezadostna zaloga', () => {
  it('400, brez zapisa, brez transakcije, zaloga nespremenjena (fail-closed)', async () => {
    session({ locationId: 'loc-1', role: 'waiter' })
    const res = await wastePost(post({ inventoryItemId: 'inv-1', quantity: 99, reason: 'SPOILED' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('presega razpoložljivo zalogo')
    expect(state.waste).toHaveLength(0)
    expect(state.stockTx).toHaveLength(0)
    expect(state.inv.find(i => i.id === 'inv-1')!.quantity).toBe(10)
    expect(state.audit).toHaveLength(0)
  })
})

// ============================================
// W-3 IDEMPOTENCA
// ============================================
describe('POST /api/waste — idempotency', () => {
  it('retry z istim ključem → 200 replay + enkraten odpis', async () => {
    session({ locationId: 'loc-1', role: 'waiter' })
    const body = { inventoryItemId: 'inv-1', quantity: 2, reason: 'EXPIRED', idempotencyKey: 'same-key' }
    const firstRes = await wastePost(post(body))
    expect(firstRes.status).toBe(201)
    const firstJson = await firstRes.json()
    const retryRes = await wastePost(post(body))
    expect(retryRes.status).toBe(200)
    const retryJson = await retryRes.json()
    expect(retryJson.replay).toBe(true)
    expect(retryJson.record.id).toBe(firstJson.record.id)
    expect(state.waste).toHaveLength(1)
    expect(state.stockTx).toHaveLength(1)
    expect(state.inv.find(i => i.id === 'inv-1')!.quantity).toBe(8)
  })

  it('P2002 race (dva vzporedna istoključna) → 409 z nagovorom za retry, ne 500', async () => {
    session({ locationId: 'loc-1', role: 'waiter' })
    state.forceP2002Next()
    const res = await wastePost(post({ inventoryItemId: 'inv-1', quantity: 1, reason: 'BROKEN', idempotencyKey: 'race-1' }))
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toContain('idempotencyKey')
  })
})

// ============================================
// W-4 TENANT / LOCATION ISOLATION
// ============================================
describe('POST /api/waste — tenant/location isolation', () => {
  it('tuj artikel (loc-2 prek seje loc-1) → 404, nič ne nastane', async () => {
    session({ locationId: 'loc-1', role: 'waiter' })
    const res = await wastePost(post({ inventoryItemId: 'inv-2', quantity: 1, reason: 'SPOILED' }))
    expect(res.status).toBe(404)
    expect(state.waste).toHaveLength(0)
    expect(state.stockTx).toHaveLength(0)
    expect(state.inv.find(i => i.id === 'inv-2')!.quantity).toBe(5)
  })

  it('regular user brez lokacije → 403 (fail-closed)', async () => {
    session({ locationId: null, role: 'waiter' })
    const res = await wastePost(post({ inventoryItemId: 'inv-1', quantity: 1, reason: 'SPOILED' }))
    expect(res.status).toBe(403)
    expect(state.waste).toHaveLength(0)
  })

  it('skupna (NULL) zaloga je odpisljiva na lokaciji — zapis nosi lokacijo dogodka', async () => {
    session({ locationId: 'loc-2', role: 'waiter' })
    const res = await wastePost(post({ inventoryItemId: 'inv-shared', quantity: 1, reason: 'BROKEN' }))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.record.locationId).toBe('loc-2')
    expect(state.inv.find(i => i.id === 'inv-shared')!.quantity).toBe(7)
  })
})

// ============================================
// W-5 VALIDACIJA
// ============================================
describe('POST /api/waste — validacija', () => {
  it('neznani razlog → 400', async () => {
    session({ locationId: 'loc-1', role: 'waiter' })
    const res = await wastePost(post({ inventoryItemId: 'inv-1', quantity: 1, reason: 'KRIVDA_ZAPALENCA' }))
    expect(res.status).toBe(400)
  })
  it('negativna količina → 400', async () => {
    session({ locationId: 'loc-1', role: 'waiter' })
    const res = await wastePost(post({ inventoryItemId: 'inv-1', quantity: -3, reason: 'SPOILED' }))
    expect(res.status).toBe(400)
  })
  it('401 brez seje', async () => {
    session(null)
    const res = await wastePost(post({ inventoryItemId: 'inv-1', quantity: 1, reason: 'SPOILED' }))
    expect(res.status).toBe(401)
  })
})

// ============================================
// W-6 REVERSAL
// ============================================
describe('POST /api/waste/[id]/reverse', () => {
  it('kompenzacijski return vrne zalogo + označi reversedAt; dvojni reverse → 409', async () => {
    session({ locationId: 'loc-1', role: 'waiter' })
    const createRes = await wastePost(post({ inventoryItemId: 'inv-1', quantity: 3, reason: 'SPOILED', idempotencyKey: 'rev-1' }))
    const created = await createRes.json()
    expect(state.inv.find(i => i.id === 'inv-1')!.quantity).toBe(7)

    const rev = await reversePost(reverseReq(created.record.id), { params: Promise.resolve({ id: created.record.id }) })
    expect(rev.status).toBe(200)
    expect(state.inv.find(i => i.id === 'inv-1')!.quantity).toBe(10)
    const back = state.stockTx.filter(t => t.type === 'return')
    expect(back).toHaveLength(1)
    expect(back[0].quantity).toBe(3)
    expect(back[0].totalCost).toBe(7.5)

    const again = await reversePost(reverseReq(created.record.id), { params: Promise.resolve({ id: created.record.id }) })
    expect(again.status).toBe(409)
    expect(state.inv.find(i => i.id === 'inv-1')!.quantity).toBe(10)
    expect(state.stockTx.filter(t => t.type === 'return')).toHaveLength(1)
  })

  it('tuj zapis (loc-2 prek seje loc-1) → 404', async () => {
    session({ locationId: 'loc-2', role: 'waiter' })
    const created = await (await wastePost(post({ inventoryItemId: 'inv-2', quantity: 1, reason: 'SPOILED' }))).json()
    session({ locationId: 'loc-1', role: 'waiter' })
    const rev = await reversePost(reverseReq(created.record.id), { params: Promise.resolve({ id: created.record.id }) })
    expect(rev.status).toBe(404)
  })

  it('WASTE_REVERSE audit dogodek', async () => {
    session({ locationId: 'loc-1', role: 'waiter' })
    const created = await (await wastePost(post({ inventoryItemId: 'inv-1', quantity: 1, reason: 'EXPIRED', idempotencyKey: 'rev-a' }))).json()
    state.audit.length = 0
    await reversePost(reverseReq(created.record.id), { params: Promise.resolve({ id: created.record.id }) })
    expect(state.audit.some(a => a.action === 'WASTE_REVERSE')).toBe(true)
  })
})

// ============================================
// W-7 GET SUMMARY
// ============================================
describe('GET /api/waste — scoped seznam + pošten summary', () => {
  beforeEach(() => {
    state.waste.push(
      { id: 'w1', locationId: 'loc-1', inventoryItemId: 'inv-1', quantity: 2, unit: 'kg', reason: 'SPOILED', note: '', costPerUnit: 2.5, totalCost: 5, stockTransactionId: null, reversalStockTransactionId: null, reversedAt: null, idempotencyKey: null, recordedByUserId: 'emp-9', createdAt: new Date('2026-01-15T12:00:00Z') },
      { id: 'w2', locationId: 'loc-2', inventoryItemId: 'inv-2', quantity: 3, unit: 'kg', reason: 'EXPIRED', note: '', costPerUnit: 1, totalCost: 3, stockTransactionId: null, reversalStockTransactionId: null, reversedAt: null, idempotencyKey: null, recordedByUserId: 'emp-9', createdAt: new Date('2026-01-16T12:00:00Z') },
      { id: 'w3', locationId: 'loc-1', inventoryItemId: 'inv-1', quantity: 1, unit: 'kg', reason: 'BROKEN', note: '', costPerUnit: 2, totalCost: 2, stockTransactionId: null, reversalStockTransactionId: null, reversedAt: new Date('2026-01-17T12:00:00Z'), idempotencyKey: null, recordedByUserId: 'emp-9', createdAt: new Date('2026-01-17T12:00:00Z') },
    )
    state.stockTx.push(
      { id: 's1', inventoryItemId: 'inv-1', type: 'sale', quantity: -4, previousQty: 10, newQty: 6, costPerUnit: 2.5, totalCost: 10, reason: 'Prodaja', note: '', employeeName: '', createdAt: new Date('2026-01-15T12:00:00Z') },
    )
    state.orders.push(
      { id: 'o1', locationId: 'loc-1', total: 200, paymentStatus: 'paid', createdAt: new Date('2026-01-15T12:00:00Z') },
    )
  })

  it('scope na lokacijo seje; reversed izključen iz agregacij; metrike iz resnice', async () => {
    session({ locationId: 'loc-1', role: 'waiter' })
    const res = await wasteGet(new Request('http://localhost:3000/api/waste?from=2026-01-01T00:00:00Z&to=2026-02-01T00:00:00Z'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.entries).toHaveLength(2)
    expect(data.entries.map((e: { id: string }) => e.id).sort()).toEqual(['w1', 'w3'])
    expect(data.summary.totalWasteCost).toBe(5)
    expect(data.summary.reversedCount).toBe(1)
    expect(data.summary.count).toBe(2)
    expect(data.summary.wasteByReason).toHaveLength(1)
    expect(data.summary.wasteByReason[0]).toMatchObject({ reason: 'Pokvarjeno', cost: 5, count: 1, percentage: 100 })
    expect(data.summary.currentWasteRate).toBe(50)
    expect(data.summary.foodCostPercentage).toBe(5)
  })

  it('lokacijska izolacija: loc-2 seja vidi samo svoje zapise', async () => {
    session({ locationId: 'loc-2', role: 'waiter' })
    const res = await wasteGet(new Request('http://localhost:3000/api/waste?from=2026-01-01T00:00:00Z&to=2026-02-01T00:00:00Z'))
    const data = await res.json()
    expect(data.entries.map((e: { id: string }) => e.id)).toEqual(['w2'])
    expect(data.summary.totalWasteCost).toBe(3)
  })

  it('401 brez seje', async () => {
    session(null)
    const res = await wasteGet(new Request('http://localhost:3000/api/waste'))
    expect(res.status).toBe(401)
  })
})

// ============================================
// W-8 STRUKTURNI PINS (kanon)
// ============================================
describe('waste kanon — strukturne varovalke', () => {
  it('uporablja SKUPNI advisory lock ključ (inv-stock:itemId) pri create in reverse', async () => {
    session({ locationId: 'loc-1', role: 'waiter' })
    const created = await (await wastePost(post({ inventoryItemId: 'inv-1', quantity: 1, reason: 'SPOILED', idempotencyKey: 'lock-1' }))).json()
    expect(state.lockKeys).toContain('inv-stock:inv-1')
    state.lockKeys.length = 0
    await reversePost(reverseReq(created.record.id), { params: Promise.resolve({ id: created.record.id }) })
    expect(state.lockKeys).toContain('inv-stock:inv-1')
  })

  it('decrement je POGOJEN (quantity >= qty guard) — negativna zaloga nemogoča', async () => {
    session({ locationId: 'loc-1', role: 'waiter' })
    await wastePost(post({ inventoryItemId: 'inv-1', quantity: 1, reason: 'SPOILED', idempotencyKey: 'guard-1' }))
    expect(state.updateManyCalls.length).toBeGreaterThan(0)
    for (const call of state.updateManyCalls) {
      const c = call as { where: { quantity?: { gte: number } }; data: { quantity: { decrement: number } } }
      expect(c.where.quantity?.gte).toBe(c.data.quantity.decrement)
    }
  })
})
