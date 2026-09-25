// ============================================
// R131 / EPIC #115 P1-13 — REORDER GET PACK ENRICHMENT (trap DB)
// ============================================
// Trap DB (hišni stil, vzorec: r130-price-history-routes.test.ts reorder del):
//   - s katalog linijo (packQty veljaven IN pricePerPack > 0) → pack hint
//     polja na suggestion (packQty/packUnit/baseUnit/packsNeeded/pricePerPack/
//     packSource 'catalog') — batched lookup, brez N+1,
//   - brez linije / pricePerPack 0 / packQty 0 / brez modela v mocku → polja
//     NE obstajajo (čisto aditivno — KRITIČNA back-compat, pariteta R130-a2),
//   - odprta pack naročilnica se v kanonu šteje v OSNOVNIH enotah (R131).
// supplierPriceHistory model je NAMERNO odsoten → unitPriceSource 'item-cost'
// (R130 enrichment back-compat ostane nedotaknjen ob stranskem R131 brisanju).
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'

const LOC_1 = 'loc-1'
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
interface CatalogRow {
  supplierId: string
  inventoryItemId: string
  packQty: number
  packUnit: string
  pricePerPack: number
  minOrderPacks: number
  isActive: boolean
}

const inList = (v: unknown): string[] | null =>
  v && typeof v === 'object' && Array.isArray((v as { in?: string[] }).in) ? (v as { in: string[] }).in : null

// ---------- Trap DB ----------
function createDb(opts: { withCatalog?: boolean } = {}) {
  const withCatalog = opts.withCatalog !== false

  const inventoryItems: InvRow[] = []
  const suppliers: SupRow[] = []
  const catalog: CatalogRow[] = []
  const stockTxs: Array<{ inventoryItemId: string; type: string; quantity: number; createdAt: Date }> = []
  const rules: Array<{ inventoryItemId: string; leadTimeDays: number; isActive: boolean }> = []
  const openPoItems: Array<{
    inventoryItemId: string
    quantityOrdered: number
    quantityReceived: number
    poNumber: string
    poStatus: string
    expectedDate: Date | null
    packQty?: number | null
  }> = []

  const tx = {
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
      findMany: async ({ where }: {
        where?: { inventoryItemId?: { in?: string[] }; type?: unknown; createdAt?: { gte?: Date } }
      } = {}) => {
        const ids = where?.inventoryItemId ? inList(where.inventoryItemId) : null
        const typeFilter = where?.type
        const types =
          typeof typeFilter === 'string' ? [typeFilter]
          : typeFilter ? inList(typeFilter)
          : null
        return stockTxs
          .filter(r => {
            if (ids && !ids.includes(r.inventoryItemId)) return false
            if (types && !types.includes(r.type)) return false
            if (where?.createdAt?.gte && r.createdAt < where.createdAt.gte) return false
            return true
          })
          .map(r => ({ ...r }))
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
            packQty: r.packQty ?? null,
            purchaseOrder: { poNumber: r.poNumber, expectedDate: r.expectedDate },
          }))
      },
    },
    supplier: {
      findMany: async ({ where }: { where?: { name?: { in?: string[] } } } = {}) => {
        const names = where?.name?.in
        return suppliers.filter(s => !names || names.includes(s.name)).map(s => ({ ...s }))
      },
    },
    // R131: katalog — strukturni guard testira brez tega modela
    ...(withCatalog
      ? {
          supplierItem: {
            findMany: async ({ where }: {
              where?: { supplierId?: { in?: string[] }; inventoryItemId?: { in?: string[] }; isActive?: boolean }
            } = {}) => {
              const supIds = where?.supplierId ? inList(where.supplierId) : null
              const itemIds = where?.inventoryItemId ? inList(where.inventoryItemId) : null
              return catalog
                .filter(r => {
                  if (supIds && !supIds.includes(r.supplierId)) return false
                  if (itemIds && !itemIds.includes(r.inventoryItemId)) return false
                  if (where?.isActive !== undefined && r.isActive !== where.isActive) return false
                  return true
                })
                .map(r => ({ ...r }))
            },
          },
        }
      : {}),
  }

  return { db: tx, inventoryItems, suppliers, catalog, stockTxs, rules, openPoItems }
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

const S = () => ref.current

// ---------- Seed ----------
const SUP_1 = 'sup-1'
const SUP_1_NAME = 'Dobavitelj 1'
const ITEM_PACK = 'inv-pack'   // ima katalog linijo
const ITEM_NO = 'inv-no'       // brez katalog linije

function seedBase() {
  S().inventoryItems.length = 0
  S().suppliers.length = 0
  S().catalog.length = 0
  S().stockTxs.length = 0
  S().rules.length = 0
  S().openPoItems.length = 0

  S().suppliers.push({ id: SUP_1, name: SUP_1_NAME })
  // Insufficient poraba → suggested = 2 × min − zaloga.
  // ITEM_PACK: min 30, zaloga 10 → suggested 50 kg → packsNeeded 2 × 25 kg
  S().inventoryItems.push(
    { id: ITEM_PACK, name: 'Moka tip 500', unit: 'kg', supplier: SUP_1_NAME, quantity: 10, minQuantity: 30, costPerUnit: 2, category: 'kolonialna', locationId: LOC_1, reorderPoint: null, safetyStock: null, leadTimeDays: null },
    { id: ITEM_NO, name: 'Sladkor', unit: 'kg', supplier: SUP_1_NAME, quantity: 2, minQuantity: 8, costPerUnit: 3, category: 'kolonialna', locationId: LOC_1, reorderPoint: null, safetyStock: null, leadTimeDays: null },
  )
  S().catalog.push({
    supplierId: SUP_1, inventoryItemId: ITEM_PACK,
    packQty: 25, packUnit: 'vrečka', pricePerPack: 45, minOrderPacks: 1, isActive: true,
  })
}

function authSession() {
  m.requireAuth.mockResolvedValue({
    session: { employeeId: 'emp-1', locationId: LOC_1, role: 'admin', permissions: ['manage_inventory'] },
    error: null,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  seedBase()
  authSession()
})

async function getSuggestions(): Promise<Array<Record<string, unknown>>> {
  const res = await reorderGet(new Request('http://local/api/inventory/reorder'))
  expect(res.status).toBe(200)
  const body = (await res.json()) as Record<string, unknown>
  return body.suggestions as Array<Record<string, unknown>>
}

// ============================================
// A. Pack hint enrichment
// ============================================
describe('R131 reorder GET — pack hint (s katalogom)', () => {
  it('s katalog linijo → packQty/packUnit/baseUnit/packsNeeded/pricePerPack/packSource present', async () => {
    const suggestions = await getSuggestions()
    const row = suggestions.find(s => s.itemId === ITEM_PACK)
    expect(row).toBeTruthy()
    // suggested = 2×30 − 10 = 50 kg → packsNeeded = ceil(50/25) = 2
    expect(row!.packQty).toBe(25)
    expect(row!.packUnit).toBe('vrečka')
    expect(row!.baseUnit).toBe('kg')
    expect(row!.packsNeeded).toBe(2)
    expect(row!.pricePerPack).toBe(45)
    expect(row!.packSource).toBe('catalog')
    // R130 enrichment polja ostanejo (nespremenjena, brez price history → item-cost)
    expect(row!.unitPriceSource).toBe('item-cost')
    expect(row!.unitPrice).toBe(2) // costPerUnit
    expect(row!.suggestedQty).toBe(50) // osnovni kanon ostane kanonska številka
  })

  it('ne-deljiv predlog → packsNeeded ceil (advisory)', async () => {
    S().inventoryItems[0].quantity = 4 // suggested 56 → ceil(56/25) = 3
    const suggestions = await getSuggestions()
    const row = suggestions.find(s => s.itemId === ITEM_PACK)
    expect(row!.packsNeeded).toBe(3)
  })

  it('odprta pack naročilnica se šteje v osnovnih enotah: 2 paketa × 25 → openPoQty 50 (ne 2)', async () => {
    S().openPoItems.push({
      inventoryItemId: ITEM_PACK, quantityOrdered: 2, quantityReceived: 0,
      poNumber: 'ND-2026-000099', poStatus: 'submitted', expectedDate: null, packQty: 25,
    })
    const suggestions = await getSuggestions()
    const row = suggestions.find(s => s.itemId === ITEM_PACK)
    // 10 + 50 ≥ 2×30 → pokrito z naročilnico (base enote — brez dvojnega naročila)
    expect(row!.status).toBe('covered-by-po')
    expect(row!.openPoQty).toBe(50)
  })
})

// ============================================
// B. Back-compat: brez kataloga polja NE obstajajo
// ============================================
describe('R131 reorder GET — back-compat (brez kataloga)', () => {
  it('artikel brez katalog linije → pack polja NE obstajajo (not.toHaveProperty)', async () => {
    const suggestions = await getSuggestions()
    const row = suggestions.find(s => s.itemId === ITEM_NO)
    expect(row).toBeTruthy()
    expect(row!).not.toHaveProperty('packQty')
    expect(row!).not.toHaveProperty('packUnit')
    expect(row!).not.toHaveProperty('baseUnit')
    expect(row!).not.toHaveProperty('packsNeeded')
    expect(row!).not.toHaveProperty('pricePerPack')
    expect(row!).not.toHaveProperty('packSource')
  })

  it('pricePerPack 0 → polja odsotna (kanon #6: nikoli ne izmišljuj cene)', async () => {
    S().catalog[0].pricePerPack = 0
    const suggestions = await getSuggestions()
    const row = suggestions.find(s => s.itemId === ITEM_PACK)
    expect(row).toBeTruthy()
    expect(row!).not.toHaveProperty('packQty')
    expect(row!).not.toHaveProperty('packsNeeded')
    expect(row!).not.toHaveProperty('packSource')
  })

  it('packQty 0 (neveljaven) → polja odsotna (legacy semantika)', async () => {
    S().catalog[0].packQty = 0
    const suggestions = await getSuggestions()
    const row = suggestions.find(s => s.itemId === ITEM_PACK)
    expect(row!).not.toHaveProperty('packQty')
    expect(row!).not.toHaveProperty('packSource')
  })

  it('neaktiven katalog (isActive false) → polja odsotna', async () => {
    S().catalog[0].isActive = false
    const suggestions = await getSuggestions()
    const row = suggestions.find(s => s.itemId === ITEM_PACK)
    expect(row!).not.toHaveProperty('packSource')
  })

  it('strukturni guard: mock BREZ supplierItem modela → 200 brez crasha, polja odsotna (pariteta starejši mocki)', async () => {
    ref.current = createDb({ withCatalog: false })
    seedBase()
    try {
      const suggestions = await getSuggestions()
      const row = suggestions.find(s => s.itemId === ITEM_PACK)
      expect(row).toBeTruthy()
      expect(row!).not.toHaveProperty('packQty')
      expect(row!).not.toHaveProperty('packSource')
      // R130 enrichment še vedno deluje (item-cost, brez supplierPriceHistory modela)
      expect(row!.unitPriceSource).toBe('item-cost')
    } finally {
      ref.current = createDb()
      seedBase()
    }
  })
})
