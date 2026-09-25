// ============================================
// R130 / EPIC #115 P1-08 — PRICE HISTORY ROUTES + ENRICHMENT (trap DB)
// ============================================
// Trap DB (hišni stil, vzorca: r126-daily-close + r129-reorder-get):
//   GET  /api/inventory/price-history — anon 401, napačna vloga 403, admin po
//        artikel (rows + stats + item), po dobavitelj (grupirano + scope),
//        brez filtrov 400 PARAM_REQUIRED, artikel izven scope-a 404
//   POST /api/inventory/price-history — anon 401, PRICE_INVALID (0 / −5),
//        SUPPLIER_NOT_FOUND, ITEM_NOT_FOUND, uspeh 201 (source 'manual',
//        default unit iz artikla, backdated observedAt) + audit klic
//   GET  /api/inventory/reorder — R130 enrichment: zgodovina →
//        unitPriceSource 'supplier-history' + unitPrice = lastPrice;
//        brez zgodovine → 'item-cost' + costPerUnit (KRITIČNA back-compat);
//        manjkajoč model v mocku (strukturni guard) → pade nazaj brez crasha
//   GET  /api/recipes?priceSource=supplier — linija z zgodovino →
//        'supplier-history' + costPerServingSupplier + marginPercent;
//        brez → 'item-cost'; brez parametra → vedenje nespremenjeno
//
// Mockane MEJE: @/lib/db (trap), requireAuth (tenant resolverji REALNI),
// rate limit (allowed). Canon + price-history-db + api-utils REALNI.
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'

const LOC_1 = 'loc-1'
const LOC_2 = 'loc-2'
const DAY = 86_400_000

// ---------- Vrstice ----------
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
interface SupRow { id: string; name: string }
interface PriceRow {
  id: string
  supplierId: string
  supplierName: string
  inventoryItemId: string
  itemName: string
  itemUnit: string
  itemLocationId: string
  unitPrice: string
  vatRate: string | null
  unit: string
  source: string
  purchaseOrderId: string | null
  locationId: string | null
  observedAt: Date
  createdAt: Date
  note: string
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
interface RecipeRow {
  id: string
  menuItemId: string
  menuName: string
  menuPrice: number
  inventoryItemId: string
  quantityPerServing: number
  yieldPercent: number
  unit: string
}

const inList = (v: unknown): string[] | null =>
  v && typeof v === 'object' && Array.isArray((v as { in?: string[] }).in) ? (v as { in: string[] }).in : null

// ---------- Trap DB ----------
// `withHistory: false` simuliira STAREJŠE trap-DB mocke brez supplier/
// supplierPriceHistory modelov — strukturni guard v price-history-db kolektorjih
// mora enrichment mirno odpeljati nazaj na costPerUnit (brez crasha).
function createDb(opts: { withHistory?: boolean } = {}) {
  const withHistory = opts.withHistory !== false
  let seq = 0
  const id = (p: string) => `${p}-${++seq}`

  const inventoryItems: InvRow[] = []
  const suppliers: SupRow[] = []
  const priceRows: PriceRow[] = []
  const stockTxs: StockTxRow[] = []
  const openPoItems: OpenPoItemRow[] = []
  const recipeItems: RecipeRow[] = []
  const rules: Array<{ inventoryItemId: string; leadTimeDays: number; isActive: boolean }> = []
  const audit: Array<Record<string, unknown>> = []
  const captured = {
    phFindMany: [] as Array<Record<string, unknown>>,
    phCreate: [] as Array<Record<string, unknown>>,
  }

  const baseModels = {
    inventoryItem: {
      // price-history GET (mode A) + POST lookup: findFirst po id (+locationId)
      findFirst: async ({ where }: { where?: { id?: string; locationId?: string } } = {}) => {
        const row = inventoryItems.find(r =>
          (where?.id === undefined || r.id === where.id) &&
          (where?.locationId === undefined || r.locationId === where.locationId))
        return row
          ? { id: row.id, name: row.name, unit: row.unit, supplier: row.supplier, costPerUnit: row.costPerUnit, quantity: row.quantity }
          : null
      },
      // reorder pipeline: findMany po locationId (+ id in)
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
    // R129 reorder kanon — 3 oblike poizvedb (usage / delivery history / last procurement)
    stockTransaction: {
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
          return rows.map(r => ({ inventoryItemId: r.inventoryItemId, quantity: r.quantity, createdAt: r.createdAt }))
        }
        if (where?.createdAt) {
          return [...rows]
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            .map(r => ({ inventoryItemId: r.inventoryItemId, createdAt: r.createdAt }))
        }
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
    // recipes GET (paginiran + count)
    recipeItem: {
      findMany: async (args: { where?: { menuItemId?: string; inventoryItemId?: string } } = {}) =>
        recipeItems
          .filter(r =>
            (!args.where?.menuItemId || r.menuItemId === args.where.menuItemId) &&
            (!args.where?.inventoryItemId || r.inventoryItemId === args.where.inventoryItemId))
          .map(r => ({
            id: r.id,
            menuItemId: r.menuItemId,
            inventoryItemId: r.inventoryItemId,
            quantityPerServing: r.quantityPerServing,
            yieldPercent: r.yieldPercent,
            unit: r.unit,
            notes: '',
            menuItem: { id: r.menuItemId, name: r.menuName, price: r.menuPrice },
            inventoryItem: {
              id: r.inventoryItemId,
              name: inventoryItems.find(i => i.id === r.inventoryItemId)?.name ?? '',
              unit: inventoryItems.find(i => i.id === r.inventoryItemId)?.unit ?? '',
              costPerUnit: inventoryItems.find(i => i.id === r.inventoryItemId)?.costPerUnit ?? 0,
              quantity: inventoryItems.find(i => i.id === r.inventoryItemId)?.quantity ?? 0,
              supplier: inventoryItems.find(i => i.id === r.inventoryItemId)?.supplier ?? '',
            },
          })),
      count: async () => recipeItems.length,
    },
  }

  // Strukturni guard test: brez teh dveh modelov enrichment NE SME crkniti.
  const historyModels = withHistory
    ? {
        supplier: {
          findUnique: async ({ where }: { where: { id: string } }) => {
            const s = suppliers.find(x => x.id === where.id)
            return s ? { id: s.id, name: s.name } : null
          },
          findMany: async ({ where }: { where?: { name?: { in?: string[] } } } = {}) => {
            const names = where?.name?.in
            return suppliers.filter(s => !names || names.includes(s.name)).map(s => ({ ...s }))
          },
        },
        supplierPriceHistory: {
          findMany: async (args: {
            where?: { inventoryItemId?: { in?: string[] }; supplierId?: string | { in?: string[] } }
          } = {}) => {
            captured.phFindMany.push(args as Record<string, unknown>)
            // route pošlje inventoryItemId kot goli string (mode A) ALI { in } —
            // trap podpira obe obliki (pariteta s Prisma where semantiko)
            const itemFilter = args.where?.inventoryItemId
            const itemIds = typeof itemFilter === 'string' ? [itemFilter] : itemFilter ? inList(itemFilter) : null
            const supFilter = args.where?.supplierId
            const supIds = typeof supFilter === 'string' ? [supFilter] : supFilter ? inList(supFilter) : null
            // orderBy observedAt desc, createdAt desc (kanon zadnje cene)
            return [...priceRows]
              .filter(r => {
                if (itemIds && !itemIds.includes(r.inventoryItemId)) return false
                if (supIds && !supIds.includes(r.supplierId)) return false
                return true
              })
              .sort((a, b) =>
                b.observedAt.getTime() - a.observedAt.getTime() ||
                b.createdAt.getTime() - a.createdAt.getTime())
              .map(r => ({
                id: r.id,
                supplierId: r.supplierId,
                inventoryItemId: r.inventoryItemId,
                unitPrice: r.unitPrice,
                vatRate: r.vatRate,
                unit: r.unit,
                source: r.source,
                purchaseOrderId: r.purchaseOrderId,
                locationId: r.locationId,
                observedAt: new Date(r.observedAt),
                createdAt: new Date(r.createdAt),
                note: r.note,
                supplier: { name: r.supplierName },
                inventoryItem: { id: r.inventoryItemId, name: r.itemName, unit: r.itemUnit, locationId: r.itemLocationId },
              }))
          },
          create: async ({ data }: { data: Record<string, unknown> }) => {
            captured.phCreate.push(data)
            const supplierName = suppliers.find(s => s.id === data.supplierId)?.name ?? ''
            const item = inventoryItems.find(i => i.id === data.inventoryItemId)
            const row: PriceRow = {
              id: id('ph'),
              supplierId: data.supplierId as string,
              supplierName,
              inventoryItemId: data.inventoryItemId as string,
              itemName: item?.name ?? '',
              itemUnit: item?.unit ?? '',
              itemLocationId: item?.locationId ?? '',
              unitPrice: String(data.unitPrice),
              vatRate: (data.vatRate as string | null) ?? null,
              unit: (data.unit as string) ?? 'pcs',
              source: (data.source as string) ?? 'goods_receipt',
              purchaseOrderId: (data.purchaseOrderId as string | null) ?? null,
              locationId: (data.locationId as string | null) ?? null,
              observedAt: (data.observedAt as Date) ?? new Date(),
              createdAt: new Date(),
              note: (data.note as string) ?? '',
            }
            priceRows.push(row)
            return {
              id: row.id,
              supplierId: row.supplierId,
              inventoryItemId: row.inventoryItemId,
              unitPrice: row.unitPrice,
              vatRate: row.vatRate,
              unit: row.unit,
              source: row.source,
              purchaseOrderId: row.purchaseOrderId,
              observedAt: new Date(row.observedAt),
              createdAt: new Date(row.createdAt),
              note: row.note,
              supplier: { name: row.supplierName },
            }
          },
        },
      }
    : {}

  const db = { ...baseModels, ...historyModels }
  return { db, inventoryItems, suppliers, priceRows, stockTxs, openPoItems, recipeItems, rules, audit, captured }
}

// ---------- Mocki (vi.hoisted ref + getter, hišni stil) ----------
type DbState = ReturnType<typeof createDb>
const ref = vi.hoisted(() => ({ current: null as unknown as DbState }))
ref.current = createDb()

const m = vi.hoisted(() => ({ requireAuth: vi.fn() }))

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

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: async () => ({ allowed: true, remaining: 10, retryAfterMs: 0 }),
  getClientIp: () => '127.0.0.1',
  AUTHENTICATED_LIMIT: { maxRequests: 120, windowMs: 60000 },
  PRICE_HISTORY_MANUAL_LIMIT: { maxRequests: 30, windowMs: 60000 },
}))
vi.mock('@/lib/rate-limit/response', () => ({
  rateLimitedResponse: () => new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 }),
}))

import { GET as priceHistoryGet, POST as priceHistoryPost } from '@/app/api/inventory/price-history/route'
import { GET as reorderGet } from '@/app/api/inventory/reorder/route'
import { GET as recipesGet } from '@/app/api/recipes/route'

const state = ref.current

// ---------- Seed ----------
const SUP_1 = 'sup-1'
const SUP_2 = 'sup-2'
const SUP_1_NAME = 'Dobavitelj 1'
const SUP_2_NAME = 'Dobavitelj 2'
const ITEM_HIST = 'inv-hist'      // ima zgodovino (2 vrstici)
const ITEM_NOHIST = 'inv-nohist'  // dobavitelj obstaja, zgodovine NI
const ITEM_OTHER = 'inv-other'    // zgodovina, ampak artikel na LOC_2 (scope)
const ITEM_GHOST = 'inv-ghost'    // ne obstaja
const MI_1 = 'mi-1'
const MI_2 = 'mi-2'
const RI_1 = 'ri-1'
const RI_2 = 'ri-2'

const LATEST_AT = new Date(Date.now() - 1 * DAY)   // zadnja cena za ITEM_HIST
const OLDER_AT = new Date(Date.now() - 5 * DAY)

function seedBase(st: DbState = state) {
  st.inventoryItems.length = 0
  st.suppliers.length = 0
  st.priceRows.length = 0
  st.stockTxs.length = 0
  st.openPoItems.length = 0
  st.recipeItems.length = 0
  st.rules.length = 0
  st.audit.length = 0
  st.captured.phFindMany.length = 0
  st.captured.phCreate.length = 0

  st.suppliers.push(
    { id: SUP_1, name: SUP_1_NAME },
    { id: SUP_2, name: SUP_2_NAME },
  )

  st.inventoryItems.push(
    { id: ITEM_HIST, name: 'Moka tip 500', unit: 'kg', supplier: SUP_1_NAME, quantity: 4, minQuantity: 10, costPerUnit: 5, category: 'kolonialna', locationId: LOC_1, reorderPoint: null, safetyStock: null, leadTimeDays: null },
    { id: ITEM_NOHIST, name: 'Sladkor', unit: 'kg', supplier: SUP_2_NAME, quantity: 2, minQuantity: 6, costPerUnit: 2, category: 'kolonialna', locationId: LOC_1, reorderPoint: null, safetyStock: null, leadTimeDays: null },
    { id: ITEM_OTHER, name: 'Druga lokacija artikel', unit: 'pcs', supplier: SUP_1_NAME, quantity: 100, minQuantity: 5, costPerUnit: 1, category: 'general', locationId: LOC_2, reorderPoint: null, safetyStock: null, leadTimeDays: null },
  )

  // Zgodovina za (SUP_1, ITEM_HIST): starejša 4.50 + zadnja 4.25 (manual)
  st.priceRows.push(
    { id: 'ph-1', supplierId: SUP_1, supplierName: SUP_1_NAME, inventoryItemId: ITEM_HIST, itemName: 'Moka tip 500', itemUnit: 'kg', itemLocationId: LOC_1, unitPrice: '4.50', vatRate: '22.00', unit: 'kg', source: 'goods_receipt', purchaseOrderId: 'po-seed-1', locationId: LOC_1, observedAt: new Date(OLDER_AT), createdAt: new Date(OLDER_AT), note: '' },
    { id: 'ph-2', supplierId: SUP_1, supplierName: SUP_1_NAME, inventoryItemId: ITEM_HIST, itemName: 'Moka tip 500', itemUnit: 'kg', itemLocationId: LOC_1, unitPrice: '4.25', vatRate: null, unit: 'kg', source: 'manual', purchaseOrderId: null, locationId: LOC_1, observedAt: new Date(LATEST_AT), createdAt: new Date(LATEST_AT), note: 'popravek' },
    // Zgodovina za artikel na LOC_2 — v supplier načinu izven scope-a
    { id: 'ph-3', supplierId: SUP_1, supplierName: SUP_1_NAME, inventoryItemId: ITEM_OTHER, itemName: 'Druga lokacija artikel', itemUnit: 'pcs', itemLocationId: LOC_2, unitPrice: '9.99', vatRate: null, unit: 'pcs', source: 'manual', purchaseOrderId: null, locationId: LOC_2, observedAt: new Date(Date.now() - 2 * DAY), createdAt: new Date(Date.now() - 2 * DAY), note: '' },
  )

  st.recipeItems.push(
    { id: RI_1, menuItemId: MI_1, menuName: 'Pica Margherita', menuPrice: 9.5, inventoryItemId: ITEM_HIST, quantityPerServing: 0.2, yieldPercent: 100, unit: 'kg' },
    { id: RI_2, menuItemId: MI_2, menuName: 'Kava', menuPrice: 2.0, inventoryItemId: ITEM_NOHIST, quantityPerServing: 0.1, yieldPercent: 100, unit: 'kg' },
  )
}

function authSession(role = 'admin', locationId: string | null = LOC_1, employeeId = 'emp-1') {
  m.requireAuth.mockResolvedValue({ session: { employeeId, locationId, role, permissions: ['manage_inventory'] }, error: null })
}

function authError(status: number) {
  m.requireAuth.mockResolvedValue({
    session: null,
    error: new Response(JSON.stringify({ error: 'Dostop zavrnjen' }), { status }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  seedBase()
  authSession()
})

function getReq(path: string): Request {
  return new Request(`http://localhost:3000${path}`, {
    method: 'GET',
    headers: { authorization: 'Bearer test-token' },
  })
}

function postReq(path: string, body: unknown): Request {
  return new Request(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer test-token' },
    body: JSON.stringify(body),
  })
}

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

function findSug(body: Record<string, unknown>, id: string): Record<string, unknown> {
  const list = body.suggestions as Array<Record<string, unknown>>
  const s = list.find(x => x.inventoryItemId === id)
  expect(s, `predlog za ${id} manjka`).toBeTruthy()
  return s!
}

// ============================================
// A. GET /api/inventory/price-history
// ============================================
describe('R130 GET /api/inventory/price-history', () => {
  it('anon → 401', async () => {
    authError(401)
    const res = await priceHistoryGet(getReq(`/api/inventory/price-history?inventoryItemId=${ITEM_HIST}`))
    expect(res.status).toBe(401)
  })

  it('napačna vloga (brez manage_inventory) → 403', async () => {
    authError(403)
    const res = await priceHistoryGet(getReq(`/api/inventory/price-history?inventoryItemId=${ITEM_HIST}`))
    expect(res.status).toBe(403)
  })

  it('admin ?inventoryItemId=X → 200 rows + stats + item (časovnica cen)', async () => {
    const res = await priceHistoryGet(getReq(`/api/inventory/price-history?inventoryItemId=${ITEM_HIST}`))
    expect(res.status).toBe(200)
    const body = await parseJson(res)

    const rows = body.rows as Array<Record<string, unknown>>
    expect(rows).toHaveLength(2)
    // DESC po observedAt → zadnja cena prva; Decimal gre čez API mejo kot STRING
    expect(rows[0].unitPrice).toBe('4.25')
    expect(rows[0].source).toBe('manual')
    expect(rows[0].supplierName).toBe(SUP_1_NAME)
    expect(rows[0].inventoryItemId).toBe(ITEM_HIST)
    expect(typeof rows[0].observedAt).toBe('string')
    expect(rows[1].unitPrice).toBe('4.50')
    expect(rows[1].source).toBe('goods_receipt')
    expect(rows[1].purchaseOrderId).toBe('po-seed-1')
    // vatRate null varno serializiran; ne-null gre čez API mejo kot STRING
    // (trap hrani surovi string — realni Decimal(5,2) bi toString dal '22')
    expect(rows[0].vatRate).toBeNull()
    expect(rows[1].vatRate).toBe('22.00')
    expect(Number(rows[1].vatRate)).toBe(22)

    // stats iz čistega kanona: count 2, lastPrice 4.25,
    // trend: baseline 4.50 → probe 4.25 → −5.56% < −5% → 'down'
    const stats = body.stats as Record<string, unknown>
    expect(stats.count).toBe(2)
    expect(stats.lastPrice).toBe('4.25')
    expect(stats.avg30).toBe('4.3750')
    expect(stats.trend).toBe('down')

    // item snapshot
    const item = body.item as Record<string, unknown>
    expect(item.inventoryItemId).toBe(ITEM_HIST)
    expect(item.name).toBe('Moka tip 500')
    expect(item.unit).toBe('kg')
    expect(item.supplier).toBe(SUP_1_NAME)
  })

  it('admin ?supplierId=Y → 200 grupiran odgovor + tenant scope po lokaciji artikla', async () => {
    const res = await priceHistoryGet(getReq(`/api/inventory/price-history?supplierId=${SUP_1}`))
    expect(res.status).toBe(200)
    const body = await parseJson(res)

    // ph-3 je na LOC_2 → izven scope-a lokacijske seje → izključen
    const rows = body.rows as Array<Record<string, unknown>>
    expect(rows).toHaveLength(2)
    expect(rows.every(r => r.inventoryItemId === ITEM_HIST)).toBe(true)

    const items = body.items as Array<Record<string, unknown>>
    expect(items).toHaveLength(1)
    expect(items[0].inventoryItemId).toBe(ITEM_HIST)
    expect(items[0].name).toBe('Moka tip 500')
    expect(items[0].unit).toBe('kg')
    expect(items[0].count).toBe(2)
    expect(items[0].lastPrice).toBe('4.25')

    const stats = body.stats as Record<string, unknown>
    expect(stats.count).toBe(2)
  })

  it('brez filtrov → 400 PARAM_REQUIRED', async () => {
    const res = await priceHistoryGet(getReq('/api/inventory/price-history'))
    expect(res.status).toBe(400)
    const body = await parseJson(res)
    expect(body.error).toBe('PARAM_REQUIRED')
  })

  it('artikel izven scope-a / neobstoječ → 404 (fail-closed, brez razkritja)', async () => {
    const res = await priceHistoryGet(getReq(`/api/inventory/price-history?inventoryItemId=${ITEM_GHOST}`))
    expect(res.status).toBe(404)
    const body = await parseJson(res)
    expect(body.error).toBe('Artikel ni najden')
  })

  it('dobavitelj brez zgodovine → 200 s praznimi rows/items + stats count 0', async () => {
    const res = await priceHistoryGet(getReq(`/api/inventory/price-history?supplierId=${SUP_2}`))
    expect(res.status).toBe(200)
    const body = await parseJson(res)
    expect(body.rows).toHaveLength(0)
    expect(body.items).toHaveLength(0)
    const stats = body.stats as Record<string, unknown>
    expect(stats.count).toBe(0)
    expect(stats.trend).toBe('insufficient')
  })
})

// ============================================
// B. POST /api/inventory/price-history (ročni vnos, source 'manual')
// ============================================
describe('R130 POST /api/inventory/price-history', () => {
  it('anon → 401 (brez zapisa)', async () => {
    authError(401)
    const res = await priceHistoryPost(postReq('/api/inventory/price-history', {
      supplierId: SUP_1, inventoryItemId: ITEM_HIST, unitPrice: 4.5,
    }))
    expect(res.status).toBe(401)
    expect(state.captured.phCreate).toHaveLength(0)
  })

  it('unitPrice 0 in −5 → 400 PRICE_INVALID (darila ne smejo pokvariti povprečij)', async () => {
    for (const unitPrice of [0, -5]) {
      const res = await priceHistoryPost(postReq('/api/inventory/price-history', {
        supplierId: SUP_1, inventoryItemId: ITEM_HIST, unitPrice,
      }))
      expect(res.status).toBe(400)
      const body = await parseJson(res)
      expect(body.error).toBe('PRICE_INVALID')
    }
    expect(state.captured.phCreate).toHaveLength(0)
  })

  it('neobstoječ Supplier → 400 SUPPLIER_NOT_FOUND (fail-closed, brez fabrikacije FK)', async () => {
    const res = await priceHistoryPost(postReq('/api/inventory/price-history', {
      supplierId: 'sup-ghost', inventoryItemId: ITEM_HIST, unitPrice: 4.5,
    }))
    expect(res.status).toBe(400)
    const body = await parseJson(res)
    expect(body.error).toBe('SUPPLIER_NOT_FOUND')
    expect(state.captured.phCreate).toHaveLength(0)
  })

  it('neobstoječ artikel (ali izven lokacije) → 400 ITEM_NOT_FOUND', async () => {
    const res = await priceHistoryPost(postReq('/api/inventory/price-history', {
      supplierId: SUP_1, inventoryItemId: ITEM_GHOST, unitPrice: 4.5,
    }))
    expect(res.status).toBe(400)
    const body = await parseJson(res)
    expect(body.error).toBe('ITEM_NOT_FOUND')
    expect(state.captured.phCreate).toHaveLength(0)
  })

  it('uspeh → 201 source manual + vrstica zapisana (default unit iz artikla) + audit SUPPLIER_PRICE_MANUAL', async () => {
    const res = await priceHistoryPost(postReq('/api/inventory/price-history', {
      supplierId: SUP_1, inventoryItemId: ITEM_HIST, unitPrice: 4.5, vatRate: 22,
    }))
    expect(res.status).toBe(201)
    const body = await parseJson(res)
    expect(body.success).toBe(true)

    const row = body.row as Record<string, unknown>
    expect(row.source).toBe('manual')
    expect(row.unitPrice).toBe('4.5') // Decimal kontrakt: čez API mejo kot STRING
    expect(row.supplierId).toBe(SUP_1)
    expect(row.inventoryItemId).toBe(ITEM_HIST)
    expect(row.unit).toBe('kg') // default: enota artikla
    expect(row.vatRate).toBe('22')

    // vrstica v trapu
    expect(state.captured.phCreate).toHaveLength(1)
    expect(state.priceRows).toHaveLength(4) // 3 seed + 1 nova
    const written = state.priceRows[state.priceRows.length - 1]
    expect(written.supplierId).toBe(SUP_1)
    expect(written.locationId).toBe(LOC_1)

    // audit klic (kanon createAuditLog)
    expect(state.audit).toHaveLength(1)
    const audit = state.audit[0] as Record<string, unknown>
    expect(audit.action).toBe('SUPPLIER_PRICE_MANUAL')
    expect(audit.entityType).toBe('SupplierPriceHistory')
    expect(audit.entityId).toBe(row.id)
    expect(audit.locationId).toBe(LOC_1)
    const details = audit.details as Record<string, unknown>
    expect(details.supplierId).toBe(SUP_1)
    expect(details.supplierName).toBe(SUP_1_NAME)
    expect(details.inventoryItemId).toBe(ITEM_HIST)
    expect(details.unitPrice).toBe('4.5')
    expect(details.source).toBe('manual')
  })

  it('backdated observedAt → 201 z ISO časom iz zahteve', async () => {
    const iso = '2026-01-15T08:00:00.000Z'
    const res = await priceHistoryPost(postReq('/api/inventory/price-history', {
      supplierId: SUP_1, inventoryItemId: ITEM_HIST, unitPrice: 3.9, observedAt: iso,
    }))
    expect(res.status).toBe(201)
    const body = await parseJson(res)
    const row = body.row as Record<string, unknown>
    expect(row.observedAt).toBe(iso)
  })
})

// ============================================
// C. Reorder enrichment (GET /api/inventory/reorder)
// ============================================
describe('R130 reorder GET enrichment — vir enotne cene', () => {
  it('artikel z zgodovino → unitPriceSource supplier-history + unitPrice = lastPrice (costPerUnit ostane)', async () => {
    const res = await reorderGet(getReq('/api/inventory/reorder'))
    expect(res.status).toBe(200)
    const body = await parseJson(res)

    const s = findSug(body, ITEM_HIST)
    expect(s.unitPriceSource).toBe('supplier-history')
    expect(s.unitPrice).toBe(4.25) // zadnja cena iz zgodovine (ne costPerUnit 5)
    expect(s.unitPriceAsOf).toBe(new Date(LATEST_AT).toISOString())
    expect(s.costPerUnit).toBe(5) // back-compat polje NE spremeni
    // totalCost konsistenten z unitPrice: insufficient → 2×min − zaloga = 2×10−4 = 16 → 16 × 4.25 = 68
    expect(s.suggestedQty).toBe(16)
    expect(s.totalCost).toBe(68)
  })

  it('artikel brez zgodovine → item-cost + obstoječi costPerUnit (KRITIČNA back-compat asercija)', async () => {
    const res = await reorderGet(getReq('/api/inventory/reorder'))
    const body = await parseJson(res)
    const s = findSug(body, ITEM_NOHIST)
    expect(s.unitPriceSource).toBe('item-cost')
    expect(s.unitPrice).toBe(2) // = costPerUnit
    expect(s.unitPriceAsOf).toBeNull()
    expect(s.totalCost).toBe(20) // suggestedQty (2×6−2 = 10) × costPerUnit 2
  })

  it('manjkajoč model v mocku (strukturni guard) → enrichment pade nazaj na item-cost BREZ crasha', async () => {
    const prev = ref.current
    const legacy = createDb({ withHistory: false })
    seedBase(legacy)
    authSession()
    ref.current = legacy
    try {
      const res = await reorderGet(getReq('/api/inventory/reorder'))
      expect(res.status).toBe(200)
      const body = await parseJson(res)
      const s = findSug(body, ITEM_HIST)
      expect(s.unitPriceSource).toBe('item-cost')
      expect(s.unitPrice).toBe(5) // costPerUnit
      expect(s.unitPriceAsOf).toBeNull()
      const s2 = findSug(body, ITEM_NOHIST)
      expect(s2.unitPriceSource).toBe('item-cost')
    } finally {
      ref.current = prev
    }
  })
})

// ============================================
// D. Recipes ?priceSource=supplier
// ============================================
describe('R130 recipes GET — nabavna cena iz zgodovine', () => {
  it('?priceSource=supplier: linija z zgodovino → supplier-history + costPerServingSupplier + marginPercent', async () => {
    const res = await recipesGet(getReq('/api/recipes?priceSource=supplier'))
    expect(res.status).toBe(200)
    const body = await parseJson(res)
    const recipes = body.recipes as Array<Record<string, unknown>>

    const withHist = recipes.find(r => r.inventoryItemId === ITEM_HIST)
    expect(withHist).toBeTruthy()
    expect(withHist!.priceSource).toBe('supplier-history')
    expect(withHist!.priceAsOf).toBe(new Date(LATEST_AT).toISOString())
    // yield 100 → strošek = qty × lastPrice = 0.2 × 4.25 = 0.85
    expect(Number(withHist!.costPerServingSupplier)).toBeCloseTo(0.85, 10)
    // bazni costPerServing ostane iz costPerUnit (0.2 × 5)
    expect(Number(withHist!.costPerServing)).toBeCloseTo(1.0, 10)
    // marža: (9.5 − 0.85)/9.5 × 100 = 91.05…% → '91.1'
    expect(String(withHist!.marginPercent)).toBe('91.1')

    // linija brez zgodovine → item-cost, supplierCost = bazni strošek
    const noHist = recipes.find(r => r.inventoryItemId === ITEM_NOHIST)
    expect(noHist).toBeTruthy()
    expect(noHist!.priceSource).toBe('item-cost')
    expect(noHist!.priceAsOf).toBeNull()
    expect(Number(noHist!.costPerServingSupplier)).toBeCloseTo(0.2, 10)
    expect(Number(noHist!.costPerServingSupplier)).toBe(Number(noHist!.costPerServing))
    // marža: (2.0 − 0.2)/2.0 × 100 = '90.0'
    expect(String(noHist!.marginPercent)).toBe('90.0')
  })

  it('brez query parametra → vedenje nespremenjeno (brez novih polj, costPerServing iz costPerUnit)', async () => {
    const res = await recipesGet(getReq('/api/recipes'))
    expect(res.status).toBe(200)
    const body = await parseJson(res)
    const recipes = body.recipes as Array<Record<string, unknown>>

    const line = recipes.find(r => r.inventoryItemId === ITEM_HIST)
    expect(line).toBeTruthy()
    expect(Number(line!.costPerServing)).toBeCloseTo(1.0, 10)
    expect(line!).not.toHaveProperty('priceSource')
    expect(line!).not.toHaveProperty('priceAsOf')
    expect(line!).not.toHaveProperty('costPerServingSupplier')
    expect(line!).not.toHaveProperty('marginPercent')
  })
})
