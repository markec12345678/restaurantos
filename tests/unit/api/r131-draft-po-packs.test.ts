// ============================================
// R131 / EPIC #115 P1-13 — DRAFT-PO PACK ORDERING (trap DB)
// ============================================
// Trap DB (hišni stil, vzorec: r129-reorder-draft-po.test.ts + katalog model):
//   - s katalog linijo (packQty veljaven IN pricePerPack > 0) → PO vrstica v
//     CELIH paketih (max(ceil, minOrderPacks)), unit=packUnit,
//     unitPrice=pricePerPack, pack snapshot, pack razlaga v opombi PO,
//   - brez kataloga / pricePerPack 0 / packQty 0 / brez modela v mocku →
//     legacy base-unit vrstica (NESPREMENJENA — pariteta R129),
//   - response orders[].items: aditiven povzetek postavk.
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'

const LOC_1 = 'loc-1'
const EMP_1 = 'emp-1'
const SUP_X = 'Dobavitelj X'
const SUP_X_ID = 'sup-x'

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
interface RuleRow { inventoryItemId: string; leadTimeDays: number; isActive: boolean }
interface SupplierRow { id: string; name: string }
interface CatalogRow {
  supplierId: string
  inventoryItemId: string
  packQty: number
  packUnit: string
  pricePerPack: number
  minOrderPacks: number
  isActive: boolean
}
interface PoItemCreated {
  inventoryItemId: string
  description: string
  quantityOrdered: number
  quantityReceived: number
  unit: string
  unitPrice: number
  vatRate: number
  totalPrice: number
  status: string
  notes: string
  packQty: number | null
  packUnit: string | null
}
interface PoRow {
  id: string
  poNumber: string
  supplierId: string
  locationId: string
  status: string
  subtotal: number
  vatAmount: number
  totalAmount: number
  notes: string
  items: PoItemCreated[]
}

// ---------- Trap DB ----------
function createDb(opts: { withCatalog?: boolean } = {}) {
  const withCatalog = opts.withCatalog !== false
  let seq = 0
  const id = (p: string) => `${p}-${++seq}`

  const inventoryItems: InvRow[] = []
  const stockTxs: Array<{ inventoryItemId: string; type: string; quantity: number; createdAt: Date }> = []
  const rules: RuleRow[] = []
  const openPoItems: Array<{
    inventoryItemId: string
    quantityOrdered: number
    quantityReceived: number
    poNumber: string
    poStatus: string
    expectedDate: Date | null
    packQty?: number | null
  }> = []
  const suppliers: SupplierRow[] = []
  const catalog: CatalogRow[] = []
  const purchaseOrders: PoRow[] = []
  const counters = new Map<string, number>()
  const captured = { poCreate: [] as Array<Record<string, unknown>> }

  const inList = (v: unknown): string[] | null =>
    v && typeof v === 'object' && Array.isArray((v as { in?: string[] }).in) ? (v as { in: string[] }).in : null

  const tx = {
    inventoryItem: {
      findMany: async ({ where }: { where?: { id?: { in?: string[] }; locationId?: string } } = {}) =>
        inventoryItems
          .filter(r => {
            const ids = where?.id ? inList(where.id) : null
            if (ids && !ids.includes(r.id)) return false
            if (where?.locationId !== undefined && r.locationId !== where.locationId) return false
            return true
          })
          .map(r => ({ ...r })),
    },
    stockTransaction: {
      findMany: async ({ where }: { where?: { inventoryItemId?: { in?: string[] }; type?: unknown; createdAt?: { gte?: Date } } } = {}) => {
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
        const names = where?.name ? inList(where.name) : null
        return suppliers.filter(s => !names || names.includes(s.name)).map(s => ({ ...s }))
      },
    },
    // R131: katalog dobavitelja — strukturni guard testira brez tega modela
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
    purchaseOrder: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        captured.poCreate.push(data)
        const items = ((data.items as { create: PoItemCreated[] })?.create ?? []) as PoItemCreated[]
        const row: PoRow = {
          id: id('po'),
          poNumber: (data.poNumber as string) ?? '',
          supplierId: (data.supplierId as string) ?? '',
          locationId: (data.locationId as string) ?? '',
          status: (data.status as string) ?? 'draft',
          subtotal: (data.subtotal as number) ?? 0,
          vatAmount: (data.vatAmount as number) ?? 0,
          totalAmount: (data.totalAmount as number) ?? 0,
          notes: (data.notes as string) ?? '',
          items: items.map(i => ({ ...i })),
        }
        purchaseOrders.push(row)
        return { ...row, items: row.items.map(i => ({ ...i })) }
      },
    },
    counter: {
      upsert: async ({ where, update, create }: {
        where: { name: string }
        update: { value: { increment: number } }
        create: { name: string; value: number }
      }) => {
        const current = counters.get(where.name) ?? 0
        const next = current > 0 ? current + (update?.value?.increment ?? 1) : (create?.value ?? 1)
        counters.set(where.name, next)
        return { name: where.name, value: next }
      },
    },
  }

  const db = {
    ...tx,
    $transaction: async <T>(fn: (t: typeof tx) => Promise<T>) => fn(tx),
  }

  return { db, inventoryItems, stockTxs, rules, openPoItems, suppliers, catalog, purchaseOrders, counters, captured }
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

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: async () => ({ allowed: true, remaining: 10, retryAfterMs: 0 }),
  getClientIp: () => '127.0.0.1',
  AUTHENTICATED_LIMIT: { maxRequests: 120, windowMs: 60_000 },
}))
vi.mock('@/lib/rate-limit/response', () => ({
  rateLimitedResponse: () => new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 }),
}))

import { POST as draftPoPost } from '@/app/api/reorder/draft-po/route'

const S = () => ref.current

// ---------- Seed ----------
// Insufficient data (brez porabe) → suggested = 2 × min − zaloga.
const ITEM_A = 'inv-a' // min 30, zaloga 10 → suggested 50 → 2 paketa × 25 kg
const ITEM_B = 'inv-b' // brez kataloga → legacy base-unit vrstica

function seedBase() {
  S().inventoryItems.length = 0
  S().stockTxs.length = 0
  S().rules.length = 0
  S().openPoItems.length = 0
  S().suppliers.length = 0
  S().catalog.length = 0
  S().purchaseOrders.length = 0
  S().counters.clear()
  S().captured.poCreate.length = 0

  S().suppliers.push({ id: SUP_X_ID, name: SUP_X })
  S().inventoryItems.push(
    { id: ITEM_A, name: 'Moka tip 500', unit: 'kg', supplier: SUP_X, quantity: 10, minQuantity: 30, costPerUnit: 2, category: 'kolonialna', locationId: LOC_1, reorderPoint: null, safetyStock: null, leadTimeDays: null },
    { id: ITEM_B, name: 'Sladkor', unit: 'kg', supplier: SUP_X, quantity: 2, minQuantity: 8, costPerUnit: 3, category: 'kolonialna', locationId: LOC_1, reorderPoint: null, safetyStock: null, leadTimeDays: null },
  )
  // Katalog: Moka v vrečah 25 kg @ 45 €/vrečka
  S().catalog.push({
    supplierId: SUP_X_ID, inventoryItemId: ITEM_A,
    packQty: 25, packUnit: 'vrečka', pricePerPack: 45, minOrderPacks: 1, isActive: true,
  })
}

function resetMocks() {
  m.requireAuth.mockResolvedValue({
    session: { employeeId: EMP_1, locationId: LOC_1, role: 'manager', permissions: ['manage_inventory'] },
    error: null,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  seedBase()
  resetMocks()
})

function draftRequest(body: unknown) {
  return new Request('http://local/api/reorder/draft-po', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer test-token' },
    body: JSON.stringify(body),
  })
}

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

// ============================================
// A. Katalog → cele pakete
// ============================================
describe('R131 draft-po — katalog-driven pack naročanje', () => {
  it('suggested 50 kg @ packQty 25 → 2 cela paketa, unit vrečka, unitPrice pricePerPack, snapshot + razlaga', async () => {
    const res = await draftPoPost(draftRequest({ itemIds: [ITEM_A] }))
    expect(res.status).toBe(201)
    const body = await parseJson(res)

    const orders = body.orders as Array<Record<string, unknown>>
    expect(orders).toHaveLength(1)
    const order = orders[0]
    expect(order.itemCount).toBe(1)

    // PO vrstica v PAKETIH (pack snapshot kanon #3)
    expect(S().purchaseOrders).toHaveLength(1)
    const po = S().purchaseOrders[0]
    const line = po.items.find(i => i.inventoryItemId === ITEM_A)!
    expect(line.quantityOrdered).toBe(2) // packsForBaseQty(50, 25) = 2
    expect(line.unit).toBe('vrečka')
    expect(line.unitPrice).toBe(45) // QUOTED cena na PAKET (NE costPerUnit 2)
    expect(line.packQty).toBe(25)
    expect(line.packUnit).toBe('vrečka')
    expect(line.totalPrice).toBe(90) // 2 × 45 — denar na nivoju vrstice

    // Zneski PO: 90 + DDV 22 % (19.8)
    expect(po.subtotal).toBe(90)
    expect(po.vatAmount).toBeCloseTo(19.8, 2)
    expect(po.totalAmount).toBeCloseTo(109.8, 2)

    // Pack razlaga v opombi PO (ob faktorjih R129)
    expect(po.notes).toContain('Moka tip 500')
    expect(po.notes).toContain('Predlog: naroči') // factors ostanejo
    expect(po.notes).toContain('naročeno 2 × vrečka po 25 kg = 50 kg (predlog 50 kg)')

    // Response: aditiven povzetek postavk
    const items = order.items as Array<Record<string, unknown>>
    expect(items).toEqual([
      {
        name: 'Moka tip 500',
        packs: 2,
        packUnit: 'vrečka',
        packQty: 25,
        baseQty: 50,
        pricePerPack: 45,
        totalPrice: 90,
      },
    ])
    expect(order.totalAmount).toBeCloseTo(109.8, 2)
  })

  it('minOrderPacks 5 > ceil → naroči 5 paketov (pogodbeni minimum)', async () => {
    S().catalog[0].minOrderPacks = 5
    const res = await draftPoPost(draftRequest({ itemIds: [ITEM_A] }))
    expect(res.status).toBe(201)
    const line = S().purchaseOrders[0].items.find(i => i.inventoryItemId === ITEM_A)!
    expect(line.quantityOrdered).toBe(5) // max(ceil(50/25)=2, min 5)
    expect(line.totalPrice).toBe(225) // 5 × 45
    expect(S().purchaseOrders[0].notes).toContain('naročeno 5 × vrečka po 25 kg = 125 kg (predlog 50 kg)')
    const order = ((await parseJson(res)).orders as Array<Record<string, unknown>>)[0]
    expect((order.items as Array<Record<string, unknown>>)[0].packs).toBe(5)
  })

  it('ne-deljiv predlog → ceil: suggested 56 @ packQty 25 → 3 paketi (= 75 kg)', async () => {
    S().inventoryItems[0].quantity = 4 // 2×30 − 4 = 56 → ceil(56/25) = 3
    const res = await draftPoPost(draftRequest({ itemIds: [ITEM_A] }))
    expect(res.status).toBe(201)
    const line = S().purchaseOrders[0].items.find(i => i.inventoryItemId === ITEM_A)!
    expect(line.quantityOrdered).toBe(3)
    expect(line.totalPrice).toBe(135)
    expect(S().purchaseOrders[0].notes).toContain('naročeno 3 × vrečka po 25 kg = 75 kg (predlog 56 kg)')
  })
})

// ============================================
// B. Fallback na legacy base-unit vrstico (kanon #6)
// ============================================
describe('R131 draft-po — legacy fallback', () => {
  it('brez katalog linije → legacy vrstica (costPerUnit, base enota), summary z null pack polji', async () => {
    const res = await draftPoPost(draftRequest({ itemIds: [ITEM_B] }))
    expect(res.status).toBe(201)
    const po = S().purchaseOrders[0]
    const line = po.items.find(i => i.inventoryItemId === ITEM_B)!
    // suggested = 2×8 − 2 = 14 kg
    expect(line.quantityOrdered).toBe(14)
    expect(line.unit).toBe('kg')
    expect(line.unitPrice).toBe(3) // costPerUnit
    expect(line.packQty).toBeNull()
    expect(line.packUnit).toBeNull()
    expect(line.totalPrice).toBe(42)
    // Opomba: BREZ pack razlage
    expect(po.notes).not.toContain('naročeno')

    const order = ((await parseJson(res)).orders as Array<Record<string, unknown>>)[0]
    expect(order.items).toEqual([
      {
        name: 'Sladkor',
        packs: 14,
        packUnit: null,
        packQty: null,
        baseQty: 14,
        pricePerPack: null,
        totalPrice: 42,
      },
    ])
  })

  it('pricePerPack 0 → legacy (kanon #6: nikoli ne izmišljuj cene)', async () => {
    S().catalog[0].pricePerPack = 0
    const res = await draftPoPost(draftRequest({ itemIds: [ITEM_A] }))
    expect(res.status).toBe(201)
    const line = S().purchaseOrders[0].items.find(i => i.inventoryItemId === ITEM_A)!
    expect(line.quantityOrdered).toBe(50) // base enote
    expect(line.unit).toBe('kg')
    expect(line.unitPrice).toBe(2) // costPerUnit
    expect(line.packQty).toBeNull()
  })

  it('packQty 0 (neveljaven snapshot v katalogu) → legacy (fallback, nikoli crash)', async () => {
    S().catalog[0].packQty = 0
    const res = await draftPoPost(draftRequest({ itemIds: [ITEM_A] }))
    expect(res.status).toBe(201)
    const line = S().purchaseOrders[0].items.find(i => i.inventoryItemId === ITEM_A)!
    expect(line.quantityOrdered).toBe(50)
    expect(line.packQty).toBeNull()
    expect(line.packUnit).toBeNull()
  })

  it('neaktiven katalog (isActive false) → legacy', async () => {
    S().catalog[0].isActive = false
    const res = await draftPoPost(draftRequest({ itemIds: [ITEM_A] }))
    expect(res.status).toBe(201)
    const line = S().purchaseOrders[0].items.find(i => i.inventoryItemId === ITEM_A)!
    expect(line.packQty).toBeNull()
    expect(line.quantityOrdered).toBe(50)
  })

  it('strukturni guard: mock BREZ supplierItem modela → legacy vrstice (back-compat starejši mocki)', async () => {
    // Zamenjaj trap DB z varianto brez supplierItem modela (pariteta r129 mocka)
    ref.current = createDb({ withCatalog: false })
    seedBase()
    try {
      const res = await draftPoPost(draftRequest({ itemIds: [ITEM_A] }))
      expect(res.status).toBe(201)
      const line = S().purchaseOrders[0].items.find(i => i.inventoryItemId === ITEM_A)!
      expect(line.quantityOrdered).toBe(50)
      expect(line.unitPrice).toBe(2)
      expect(line.packQty).toBeNull()
      // Brez crasha — odgovor je 201 z legacy summary
      const order = ((await parseJson(res)).orders as Array<Record<string, unknown>>)[0]
      expect((order.items as Array<Record<string, unknown>>)[0].packQty).toBeNull()
    } finally {
      ref.current = createDb()
      seedBase()
    }
  })

  it('odprta pack PO se šteje v OSNOVNIH enotah (R131 open-PO konverzija): 2 paketa × 25 → pokritje 50', async () => {
    // Odprta pack PO z 2 ne-prejetimi paketi (50 kg) — suggested mora upoštevati 50, ne 2
    S().openPoItems.push({
      inventoryItemId: ITEM_A, quantityOrdered: 2, quantityReceived: 0,
      poNumber: 'ND-2026-000099', poStatus: 'submitted', expectedDate: null, packQty: 25,
    })
    const res = await draftPoPost(draftRequest({ itemIds: [ITEM_A] }))
    expect(res.status).toBe(201)
    // available 10 + open 50 ≥ 2×30 → pokrito z naročilnico → skipped 'covered-by-po'
    const skipped = (await parseJson(res)).skipped as Array<{ itemId: string; reason: string }>
    expect(skipped.find(s => s.itemId === ITEM_A)?.reason).toBe('covered-by-po')
  })
})
