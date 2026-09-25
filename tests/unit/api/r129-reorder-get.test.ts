// ============================================
// R129 / EPIC #115 P1-07 — GET /api/inventory/reorder (trap DB)
// ============================================
// Trap DB (hišni stil): testira prepisani GET pipeline na kanonu:
//   - canon polja per predlog (status/dataStatus/factors/viri),
//   - batch-consumption ŠTEJE v ADU (sale + batch-consumption),
//     procurement/return NE štejeta,
//   - odprte naročilnice (OPEN_PO_STATUSES) → openPoQty + covered-by-po,
//   - ?status= in ?supplier= filtri.
// Mockane MEJE: requireAuth (tenant resolverji REALNI). Envelope
// { summary, suggestions } nespremenjen.
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'

const LOC_1 = 'loc-1'

interface InvRow {
  id: string
  name: string
  unit: string
  supplier: string
  quantity: number
  minQuantity: number
  costPerUnit: number
  category: string
  locationId: string
  reorderPoint: number | null
  safetyStock: number | null
  leadTimeDays: number | null
}
interface StockTxRow { inventoryItemId: string; type: string; quantity: number; createdAt: Date }
interface OpenPoItemRow {
  inventoryItemId: string
  quantityOrdered: number
  quantityReceived: number
  poNumber: string
  poStatus: string
  expectedDate: Date | null
}

const DAY = 86_400_000

// ---------- Trap DB ----------
function createDb() {
  const inventoryItems: InvRow[] = []
  const stockTxs: StockTxRow[] = []
  const rules: Array<{ inventoryItemId: string; leadTimeDays: number; isActive: boolean }> = []
  const openPoItems: OpenPoItemRow[] = []

  const inList = (v: unknown): string[] | null =>
    v && typeof v === 'object' && Array.isArray((v as { in?: string[] }).in) ? (v as { in: string[] }).in : null

  const db = {
    inventoryItem: {
      findMany: async ({ where }: { where?: { id?: unknown; locationId?: string } } = {}) => {
        const ids = where?.id ? inList(where.id) : null
        return inventoryItems
          .filter(r => {
            if (ids && !ids.includes(r.id)) return false
            if (where?.locationId !== undefined && r.locationId !== where.locationId) return false
            return true
          })
          .map(r => ({ ...r }))
      },
    },
    stockTransaction: {
      // R129 pipeline del 3 različne query oblike:
      //   1) usage: type { in: CONSUMPTION_TX_TYPES }
      //   2) delivery history: type 'procurement' + createdAt gte
      //   3) last procurement: type 'procurement' (brez createdAt)
      findMany: async ({ where }: {
        where?: { inventoryItemId?: { in?: string[] }; type?: unknown; createdAt?: { gte?: Date } }
      } = {}) => {
        const ids = where?.inventoryItemId ? inList(where.inventoryItemId) : null
        const typeFilter = where?.type
        const types =
          typeof typeFilter === 'string' ? [typeFilter]
          : typeFilter ? inList(typeFilter)
          : null
        const rows = stockTxs.filter(r => {
          if (ids && !ids.includes(r.inventoryItemId)) return false
          if (types && !types.includes(r.type)) return false
          if (where?.createdAt?.gte && r.createdAt < where.createdAt.gte) return false
          return true
        })
        if (types && where?.createdAt) {
          // 1) usage query — select inventoryItemId, quantity, createdAt
          return rows.map(r => ({ inventoryItemId: r.inventoryItemId, quantity: r.quantity, createdAt: r.createdAt }))
        }
        if (where?.createdAt) {
          // 2) delivery history (asc)
          return [...rows]
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            .map(r => ({ inventoryItemId: r.inventoryItemId, createdAt: r.createdAt }))
        }
        // 3) last procurement (desc + distinct) — vrni po ENEM per artikel
        const byItem = new Map<string, StockTxRow>()
        for (const r of [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())) {
          if (!byItem.has(r.inventoryItemId)) byItem.set(r.inventoryItemId, r)
        }
        return [...byItem.values()].map(r => ({ inventoryItemId: r.inventoryItemId, createdAt: r.createdAt }))
      },
    },
    reorderRule: {
      findMany: async ({ where }: { where?: { inventoryItemId?: { in?: string[] } } } = {}) => {
        const ids = where?.inventoryItemId ? inList(where.inventoryItemId) : null
        return rules.filter(r => !ids || ids.includes(r.inventoryItemId)).map(r => ({ ...r }))
      },
    },
    purchaseOrderItem: {
      findMany: async ({ where }: {
        where?: { inventoryItemId?: { in?: string[] }; purchaseOrder?: { status?: { in?: string[] } } }
      } = {}) => {
        const ids = where?.inventoryItemId ? inList(where.inventoryItemId) : null
        const statuses = where?.purchaseOrder?.status ? inList(where.purchaseOrder.status) : null
        return openPoItems
          .filter(r => {
            if (ids && !ids.includes(r.inventoryItemId)) return false
            if (statuses && !statuses.includes(r.poStatus)) return false
            return true
          })
          .map(r => ({
            inventoryItemId: r.inventoryItemId,
            quantityOrdered: r.quantityOrdered,
            quantityReceived: r.quantityReceived,
            purchaseOrder: { poNumber: r.poNumber, expectedDate: r.expectedDate },
          }))
      },
    },
    $transaction: async <T>(fn: (client: unknown) => Promise<T>) => fn(db),
  }
  return { db, inventoryItems, stockTxs, rules, openPoItems }
}

// ---------- Mocki ----------
type DbState = ReturnType<typeof createDb>
const ref = vi.hoisted(() => ({ current: null as unknown as DbState }))
ref.current = createDb()

const m = vi.hoisted(() => ({ requireAuth: vi.fn() }))

vi.mock('@/lib/db', () => ({
  get db() {
    return ref.current.db
  },
  createAuditLog: async () => {},
}))

vi.mock('@/lib/auth-middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-middleware')>()
  return {
    ...actual,
    requireAuth: (...args: unknown[]) => m.requireAuth(...args),
  }
})

import { GET as reorderGet } from '@/app/api/inventory/reorder/route'

const state = ref.current

// ---------- Seed ----------
const INV_SALE = 'inv-sale'      // sale-only, low
const INV_BATCH = 'inv-batch'    // sale + batch-consumption, low
const INV_PO = 'inv-po'          // covered-by-po (open draft PO 50)
const INV_CRIT = 'inv-crit'      // quantity 0 → critical
const INV_INSUF = 'inv-insuf'    // low, brez porabnih tx (insufficient)
const INV_OK = 'inv-ok'          // ok (izključen iz privzetega seznama)

function seedBase() {
  state.inventoryItems.length = 0
  state.stockTxs.length = 0
  state.rules.length = 0
  state.openPoItems.length = 0

  state.inventoryItems.push(
    { id: INV_SALE, name: 'Kolonialna Kafa', unit: 'kg', supplier: 'Dobavitelj 1', quantity: 8, minQuantity: 10, costPerUnit: 5, category: 'kava', locationId: LOC_1, reorderPoint: null, safetyStock: null, leadTimeDays: null },
    { id: INV_BATCH, name: 'Moka za priprave', unit: 'kg', supplier: 'Dobavitelj 2', quantity: 3, minQuantity: 4, costPerUnit: 3, category: 'kava', locationId: LOC_1, reorderPoint: null, safetyStock: null, leadTimeDays: null },
    { id: INV_PO, name: 'Pokrit artikel', unit: 'pcs', supplier: 'Dobavitelj 2', quantity: 20, minQuantity: 10, costPerUnit: 1, category: 'general', locationId: LOC_1, reorderPoint: null, safetyStock: null, leadTimeDays: null },
    { id: INV_CRIT, name: 'Kritičen artikel', unit: 'pcs', supplier: 'Dobavitelj 2', quantity: 0, minQuantity: 5, costPerUnit: 2, category: 'general', locationId: LOC_1, reorderPoint: null, safetyStock: null, leadTimeDays: null },
    { id: INV_INSUF, name: 'Brez podatkov', unit: 'pcs', supplier: 'Dobavitelj 2', quantity: 2, minQuantity: 6, costPerUnit: 2, category: 'general', locationId: LOC_1, reorderPoint: null, safetyStock: null, leadTimeDays: null },
    { id: INV_OK, name: 'Zdrav artikel', unit: 'pcs', supplier: 'Dobavitelj 2', quantity: 100, minQuantity: 5, costPerUnit: 1, category: 'general', locationId: LOC_1, reorderPoint: null, safetyStock: null, leadTimeDays: null },
  )

  state.stockTxs.push(
    // INV_SALE: samo sale (20 total) + šum (procurement/return NE smejo šteti)
    { inventoryItemId: INV_SALE, type: 'sale', quantity: -10, createdAt: new Date(Date.now() - 2 * DAY) },
    { inventoryItemId: INV_SALE, type: 'sale', quantity: -10, createdAt: new Date(Date.now() - 5 * DAY) },
    { inventoryItemId: INV_SALE, type: 'procurement', quantity: 50, createdAt: new Date(Date.now() - 6 * DAY) },
    { inventoryItemId: INV_SALE, type: 'return', quantity: 5, createdAt: new Date(Date.now() - 4 * DAY) },
    // INV_BATCH: sale −6 + batch-consumption −8 → 14 total
    { inventoryItemId: INV_BATCH, type: 'sale', quantity: -6, createdAt: new Date(Date.now() - 2 * DAY) },
    { inventoryItemId: INV_BATCH, type: 'batch-consumption', quantity: -8, createdAt: new Date(Date.now() - 1 * DAY) },
  )

  state.openPoItems.push({
    inventoryItemId: INV_PO, quantityOrdered: 50, quantityReceived: 0,
    poNumber: 'ND-2026-000200', poStatus: 'draft', expectedDate: new Date(Date.now() + 3 * DAY),
  })
}

function resetMocks() {
  m.requireAuth.mockResolvedValue({
    session: { employeeId: 'emp-1', locationId: LOC_1, role: 'manager', permissions: ['manage_inventory'] },
    error: null,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  seedBase()
  resetMocks()
})

function getRequest(query = '') {
  return new Request(`http://local/api/inventory/reorder${query}`, {
    method: 'GET',
    headers: { authorization: 'Bearer test-token' },
  })
}

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

function suggestionsOf(body: Record<string, unknown>): Array<Record<string, unknown>> {
  return body.suggestions as Array<Record<string, unknown>>
}

function findSug(body: Record<string, unknown>, id: string): Record<string, unknown> {
  const s = suggestionsOf(body).find(x => x.inventoryItemId === id)
  expect(s, `predlog za ${id} manjka`).toBeTruthy()
  return s!
}

// ============================================
// A. Canon polja + kompatibilna polja per predlog
// ============================================
describe('R129 reorder GET — canon polja', () => {
  it('predlog vsebuje canon polja z viri IN kompatibilna polja (UI tok)', async () => {
    const res = await reorderGet(getRequest())
    expect(res.status).toBe(200)
    const body = await parseJson(res)

    const s = findSug(body, INV_SALE)
    // canon polja
    expect(s.status).toBe('low')
    expect(s.dataStatus).toBe('sufficient')
    expect(Array.isArray(s.factors)).toBe(true)
    expect((s.factors as string[]).length).toBeGreaterThan(0)
    expect((s.factors as string[]).join('\n')).toContain('Zaloga: 8 kg')
    expect(s.reorderPoint).toBe(10)
    expect(s.reorderPointSource).toBe('derived')
    expect(s.safetyStock).toBe(2) // ceil(20/30 × 2) = ceil(1.33)
    expect(s.safetyStockSource).toBe('derived')
    expect(s.leadTimeDays).toBe(2)
    expect(s.leadTimeSource).toBe('default')
    expect(s.openPoQty).toBe(0)
    expect(s.itemId).toBe(INV_SALE)
    expect(s.name).toBe('Kolonialna Kafa')
    expect(s.unitPrice).toBe(5)
    expect(s.expectedDelivery).toBeNull()

    // kompatibilna polja (stari UI tok)
    expect(s.inventoryItemId).toBe(INV_SALE)
    expect(s.itemName).toBe('Kolonialna Kafa')
    expect(s.currentStock).toBe(8)
    expect(s.unit).toBe('kg')
    expect(s.supplier).toBe('Dobavitelj 1')
    expect(s.urgency).toBe('high') // status low → legacy high
    expect(typeof s.reason).toBe('string')
    expect(s.costPerUnit).toBe(5)
    expect(s.category).toBe('kava')

    // formula: ceil(10 + 2 + (20/30)×2 − 8 − 0) = ceil(5.33) = 6
    expect(s.suggestedQty).toBe(6)

    // envelope nespremenjen
    const summary = body.summary as Record<string, unknown>
    expect(summary.totalSuggestions).toBe(suggestionsOf(body).length)
    expect(summary).toHaveProperty('totalEstimatedCost')
    expect(summary).toHaveProperty('bySupplier')
  })

  it('insufficient artikel: predlog iz minimuma, brez izmišljenih porabnih števil', async () => {
    const res = await reorderGet(getRequest())
    const body = await parseJson(res)
    const s = findSug(body, INV_INSUF)
    expect(s.status).toBe('low')
    expect(s.dataStatus).toBe('insufficient')
    expect(s.suggestedQty).toBe(10) // 2×6 − 2
    expect(s.reorderPointSource).toBe('min-fallback')
    expect(s.safetyStock).toBeNull()
    const joined = (s.factors as string[]).join('\n')
    expect(joined).not.toContain('Povprečna poraba')
    expect(joined).toContain('brez izmišljanja napovedi')
  })

  it('ok artikel NI v privzetem seznamu', async () => {
    const res = await reorderGet(getRequest())
    const body = await parseJson(res)
    expect(suggestionsOf(body).some(x => x.inventoryItemId === INV_OK)).toBe(false)
  })
})

// ============================================
// B. Poraba: sale + batch-consumption; procurement/return NE
// ============================================
describe('R129 reorder GET — porabni tx tipi', () => {
  it('batch-consumption šteje v avgDailyUsage skupaj s sale', async () => {
    const res = await reorderGet(getRequest())
    const body = await parseJson(res)
    // 14 total / 30 dni
    expect(findSug(body, INV_BATCH).avgDailyUsage).toBeCloseTo(14 / 30, 10)
    // recent: obe tx v zadnjih 7 dneh → 14/7 = 2
    expect(findSug(body, INV_BATCH).recentUsage).toBeCloseTo(2, 10)
  })

  it('procurement in return NE štejeta v porabo', async () => {
    const res = await reorderGet(getRequest())
    const body = await parseJson(res)
    // samo sale 20/30 — procurement +50 in return +5 izključena
    expect(findSug(body, INV_SALE).avgDailyUsage).toBeCloseTo(20 / 30, 10)
  })
})

// ============================================
// C. Odprte naročilnice: openPoQty + covered-by-po
// ============================================
describe('R129 reorder GET — odprte naročilnice', () => {
  it('openPoQty se odraža in pokritost daje status covered-by-po', async () => {
    const res = await reorderGet(getRequest())
    const body = await parseJson(res)
    const s = findSug(body, INV_PO)
    expect(s.status).toBe('covered-by-po')
    expect(s.openPoQty).toBe(50)
    const openPos = s.openPos as Array<Record<string, unknown>>
    expect(openPos).toHaveLength(1)
    expect(openPos[0].poNumber).toBe('ND-2026-000200')
    expect(typeof openPos[0].expectedDate).toBe('string')
    expect(typeof s.expectedDelivery).toBe('string')
    expect((s.factors as string[]).join('\n')).toContain('Odprta naročilnica: 50 pcs')
    // legacy urgency mapiranje: covered → medium
    expect(s.urgency).toBe('medium')
  })

  it('stale PO statusi (sent/confirmed) NE štejejo kot odprti (kanon OPEN_PO_STATUSES)', async () => {
    state.openPoItems.length = 0
    state.openPoItems.push({
      inventoryItemId: INV_PO, quantityOrdered: 50, quantityReceived: 0,
      poNumber: 'ND-2026-000201', poStatus: 'sent', expectedDate: null,
    })
    const res = await reorderGet(getRequest())
    const body = await parseJson(res)
    // 20 > rP 10 brez PO → ok → izključen iz privzetega seznama (openPoQty 0)
    expect(suggestionsOf(body).some(x => x.inventoryItemId === INV_PO)).toBe(false)
  })
})

// ============================================
// D. Filtri: ?status= in ?supplier=
// ============================================
describe('R129 reorder GET — filtri', () => {
  it('?status=critical vrne samo kritične', async () => {
    const res = await reorderGet(getRequest('?status=critical'))
    const body = await parseJson(res)
    const list = suggestionsOf(body)
    expect(list).toHaveLength(1)
    expect(list[0].inventoryItemId).toBe(INV_CRIT)
    expect(list[0].status).toBe('critical')
  })

  it('?status=low,critical vključi obe skupini, izključi covered', async () => {
    const res = await reorderGet(getRequest('?status=low,critical'))
    const body = await parseJson(res)
    const ids = suggestionsOf(body).map(s => s.inventoryItemId).sort()
    expect(ids).toEqual([INV_BATCH, INV_CRIT, INV_INSUF, INV_SALE].sort())
  })

  it('?supplier= filtrira po dobavitelju (case-insensitive)', async () => {
    const res = await reorderGet(getRequest('?supplier=dobavitelj%201'))
    const body = await parseJson(res)
    const list = suggestionsOf(body)
    expect(list).toHaveLength(1)
    expect(list[0].inventoryItemId).toBe(INV_SALE)
  })

  it('privzeto (brez filtra) so vključeni critical + low + covered-by-po', async () => {
    const res = await reorderGet(getRequest())
    const body = await parseJson(res)
    const ids = suggestionsOf(body).map(s => s.inventoryItemId).sort()
    expect(ids).toEqual([INV_BATCH, INV_CRIT, INV_INSUF, INV_PO, INV_SALE].sort())
  })
})
