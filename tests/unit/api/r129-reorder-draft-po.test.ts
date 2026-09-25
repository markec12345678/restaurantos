// ============================================
// R129 / EPIC #115 P1-07 — POST /api/reorder/draft-po (trap DB)
// ============================================
// Trap DB (hišni stil R124/R121/R125/R126/R128): vi.hoisted trap + getter;
// testirana je PRODUKCIJSKA route funkcija direktno. Mockane MEJE:
//   - requireAuth (auth-middleware importOriginal — tenant resolverji REALNI)
//   - rate-limit (AUTHENTICATED_LIMIT trap)
// REALNO: canon kanon (usage/open-PO/delivery bralci nad trap DB),
// tenant scope, counter števec (getNextCounter nad trap counter.upsert),
// Zod validacija, supplier fail-closed preverjanja, PO kreacija.
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'

const LOC_1 = 'loc-1'
const LOC_2 = 'loc-2'
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
interface StockTxRow { inventoryItemId: string; type: string; quantity: number; createdAt: Date }
interface RuleRow { inventoryItemId: string; leadTimeDays: number; isActive: boolean }
interface SupplierRow { id: string; name: string }
interface OpenPoItemRow {
  inventoryItemId: string
  quantityOrdered: number
  quantityReceived: number
  poNumber: string
  poStatus: string
  expectedDate: Date | null
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
}
interface PoRow {
  id: string
  poNumber: string
  supplierId: string
  locationId: string
  status: string
  orderDate: Date
  expectedDate: Date | null
  subtotal: number
  vatAmount: number
  totalAmount: number
  deliveryNotes: string
  notes: string
  items: PoItemCreated[]
}

const DAY = 86_400_000

// ---------- Trap DB ----------
function createDb() {
  let seq = 0
  const id = (p: string) => `${p}-${++seq}`

  const inventoryItems: InvRow[] = []
  const stockTxs: StockTxRow[] = []
  const rules: RuleRow[] = []
  const openPoItems: OpenPoItemRow[] = []
  const suppliers: SupplierRow[] = []
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
        // Prisma where.type: string ENOTA ali { in: [...] } — trap mora oba filtra
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
          orderDate: (data.orderDate as Date) ?? new Date(),
          expectedDate: (data.expectedDate as Date | null) ?? null,
          subtotal: (data.subtotal as number) ?? 0,
          vatAmount: (data.vatAmount as number) ?? 0,
          totalAmount: (data.totalAmount as number) ?? 0,
          deliveryNotes: (data.deliveryNotes as string) ?? '',
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

  return {
    db, inventoryItems, stockTxs, rules, openPoItems, suppliers, purchaseOrders, counters, captured,
  }
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
    // resolveTenantLocationIdOrThrow ostane REALen (pure resolver)
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

const state = ref.current

// ---------- Seed ----------
const ITEM_A = 'inv-a' // low, sufficient data → suggested 8
const ITEM_B = 'inv-b' // low, insufficient data → suggested 7 (2×min − qty)
const ITEM_OK = 'inv-ok'
const ITEM_COVERED = 'inv-covered'
const ITEM_OUT = 'inv-out'
const ITEM_NOSUP = 'inv-nosup'

function seedBase() {
  state.inventoryItems.length = 0
  state.stockTxs.length = 0
  state.rules.length = 0
  state.openPoItems.length = 0
  state.suppliers.length = 0
  state.purchaseOrders.length = 0
  state.counters.clear()
  state.captured.poCreate.length = 0

  state.suppliers.push({ id: SUP_X_ID, name: SUP_X })

  state.inventoryItems.push(
    { id: ITEM_A, name: 'Brusni papir', unit: 'pcs', supplier: SUP_X, quantity: 4, minQuantity: 10, costPerUnit: 2, category: 'general', locationId: LOC_1, reorderPoint: null, safetyStock: null, leadTimeDays: null },
    { id: ITEM_B, name: 'Kuhinjska sol', unit: 'kg', supplier: SUP_X, quantity: 3, minQuantity: 5, costPerUnit: 1, category: 'general', locationId: LOC_1, reorderPoint: null, safetyStock: null, leadTimeDays: null },
    { id: ITEM_OK, name: 'Zdrav artikel', unit: 'pcs', supplier: SUP_X, quantity: 100, minQuantity: 10, costPerUnit: 3, category: 'general', locationId: LOC_1, reorderPoint: null, safetyStock: null, leadTimeDays: null },
    { id: ITEM_COVERED, name: 'Pokrit artikel', unit: 'pcs', supplier: SUP_X, quantity: 5, minQuantity: 5, costPerUnit: 1, category: 'general', locationId: LOC_1, reorderPoint: null, safetyStock: null, leadTimeDays: null },
    { id: ITEM_OUT, name: 'Tuj artikel', unit: 'pcs', supplier: SUP_X, quantity: 0, minQuantity: 5, costPerUnit: 1, category: 'general', locationId: LOC_2, reorderPoint: null, safetyStock: null, leadTimeDays: null },
    { id: ITEM_NOSUP, name: 'Brez dobavitelja', unit: 'pcs', supplier: '', quantity: 1, minQuantity: 5, costPerUnit: 1, category: 'general', locationId: LOC_1, reorderPoint: null, safetyStock: null, leadTimeDays: null },
  )

  // ITEM_A poraba: 2× sale po −2 (4/30 ≈ 0.133/dan) → suggested 8
  state.stockTxs.push(
    { inventoryItemId: ITEM_A, type: 'sale', quantity: -2, createdAt: new Date(Date.now() - 10 * DAY) },
    { inventoryItemId: ITEM_A, type: 'sale', quantity: -2, createdAt: new Date(Date.now() - 3 * DAY) },
  )

  // ITEM_COVERED: odprta draft PO z 10 ne-prejetimi
  state.openPoItems.push({
    inventoryItemId: ITEM_COVERED, quantityOrdered: 10, quantityReceived: 0,
    poNumber: 'ND-2026-000001', poStatus: 'draft', expectedDate: new Date(Date.now() + 3 * DAY),
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
// A. Happy path — 2 artikla istega dobavitelja → 1 draft PO
// ============================================
describe('R129 draft-po — happy path', () => {
  it('ustvari 1 draft PO z ND-YYYY-NNNNNN, kanonskimi količinami in preskočenim ok artikelom', async () => {
    const res = await draftPoPost(draftRequest({ itemIds: [ITEM_A, ITEM_B, ITEM_OK] }))
    expect(res.status).toBe(201)
    const body = await parseJson(res)

    const orders = body.orders as Array<Record<string, unknown>>
    expect(orders).toHaveLength(1)
    const order = orders[0]

    // Številka po obstoječem kanonu (getNextCounter → ND-YYYY-NNNNNN)
    const year = new Date().getFullYear()
    expect(order.poNumber).toBe(`ND-${year}-000001`)
    expect(order.poNumber).toMatch(/^ND-\d{4}-\d{6}$/)
    expect(order.supplierName).toBe(SUP_X)
    expect(order.itemCount).toBe(2)

    // expectedDate = now + max(leadTimeDays) dni (default 2)
    const expectedMs = new Date(order.expectedDate as string).getTime()
    expect(Math.abs(expectedMs - (Date.now() + 2 * DAY))).toBeLessThan(60_000)

    // Preskočen ok artikel
    const skipped = body.skipped as Array<Record<string, unknown>>
    expect(skipped).toEqual([{ itemId: ITEM_OK, name: 'Zdrav artikel', reason: 'ok' }])

    // PO vrstica v trap DB
    expect(state.purchaseOrders).toHaveLength(1)
    const po = state.purchaseOrders[0]
    expect(po.status).toBe('draft')
    expect(po.locationId).toBe(LOC_1)
    expect(po.supplierId).toBe(SUP_X_ID)
    expect(po.deliveryNotes).toBe('R129 reorder center — razložljiv predlog (factors v opombi)')
    // faktorji v opombi (razložljivost)
    expect(po.notes).toContain('Brusni papir')
    expect(po.notes).toContain('Predlog: naroči')

    // Postavki: A suggested 8 (rP 10 + safety 1 + ADU×lead 0.27 − 4), B insufficient 7 (2×5 − 3)
    const itemA = po.items.find(i => i.inventoryItemId === ITEM_A)!
    expect(itemA.quantityOrdered).toBe(8)
    expect(itemA.unitPrice).toBe(2)
    expect(itemA.unit).toBe('pcs')
    expect(itemA.vatRate).toBe(22)
    expect(itemA.status).toBe('pending')
    const itemB = po.items.find(i => i.inventoryItemId === ITEM_B)!
    expect(itemB.quantityOrdered).toBe(7)
    expect(itemB.unitPrice).toBe(1)

    // Zneski: subtotal 8×2 + 7×1 = 23; DDV 22 % → 5.06; total 28.06
    expect(po.subtotal).toBe(23)
    expect(po.vatAmount).toBeCloseTo(5.06, 2)
    expect(po.totalAmount).toBeCloseTo(28.06, 2)
    expect(order.totalAmount).toBeCloseTo(28.06, 2)

    // Counter kanon — 1 klic na PO
    expect(state.counters.get(`purchaseOrderNumber-${year}`)).toBe(1)
  })

  it('skupni dobavitelj = skupna PO; krajišče: insufficient z suggestedQty 0 → insufficient-demand', async () => {
    // Artikel z 2×min − qty ≤ 0 (zaloga nad 2×min, a pod rP): quantity 8, min 5 → rP 5, 8 > 5 → ok
    state.inventoryItems.push(
      { id: 'inv-zero', name: 'Zero predlog', unit: 'pcs', supplier: SUP_X, quantity: 9, minQuantity: 5, costPerUnit: 1, category: 'general', locationId: LOC_1, reorderPoint: null, safetyStock: null, leadTimeDays: null },
    )
    // quantity 9, min 5 → status ok → 'ok' skip. Za 'insufficient-demand' potrebujemo
    // status low z suggested 0: ekspliciten reorderPoint visoko + velik openPo odbitek.
    state.inventoryItems.push(
      { id: 'inv-zero2', name: 'Zero predlog 2', unit: 'pcs', supplier: SUP_X, quantity: 50, minQuantity: 2, costPerUnit: 1, category: 'general', locationId: LOC_1, reorderPoint: 60, safetyStock: null, leadTimeDays: null },
    )
    state.openPoItems.push({
      inventoryItemId: 'inv-zero2', quantityOrdered: 5, quantityReceived: 0,
      poNumber: 'ND-2026-000009', poStatus: 'submitted', expectedDate: null,
    })
    // 50+5 = 55 < rP 60 → low; suggested = ceil(60 + 0 + 0 − 50 − 5) = ceil(5) = 5 … ne 0.
    // Popravi: openPo 15 → 50+15=65 ≥ 60 → covered … namesto tega: rP 60, openPo 9 →
    // 50+9=59 < 60 → low; suggested = ceil(60−50−9)=1 … še vedno > 0.
    // suggestedQty 0 pri statusu low: quantity ENAKO rP in openPo=0 → ceil(0)=0.
    state.inventoryItems.push(
      { id: 'inv-zero3', name: 'Zero predlog 3', unit: 'pcs', supplier: SUP_X, quantity: 60, minQuantity: 2, costPerUnit: 1, category: 'general', locationId: LOC_1, reorderPoint: 60, safetyStock: null, leadTimeDays: null },
    )
    const res = await draftPoPost(draftRequest({ itemIds: ['inv-zero3', 'inv-zero', 'inv-zero2'] }))
    expect(res.status).toBe(201)
    const body = await parseJson(res)
    const reasons = new Map(
      (body.skipped as Array<Record<string, unknown>>).map(s => [s.itemId as string, s.reason]),
    )
    expect(reasons.get('inv-zero3')).toBe('insufficient-demand') // 60 ≤ rP 60, suggested 0
    expect(reasons.get('inv-zero')).toBe('ok')
    // inv-zero2: brez porabnih tx → insufficient → MIN-formula (ne rP!):
    // suggested = max(0, ceil(2×2 − 50 − 5)) = 0 → 'insufficient-demand'
    // (kanon: brez podatkov o porabi se rP NE uporablja za predlog)
    expect(reasons.get('inv-zero2')).toBe('insufficient-demand')
    const orders = body.orders as Array<Record<string, unknown>>
    expect(orders).toHaveLength(0)
  })
})

// ============================================
// B. Fail-closed: manjkajoč dobavitelj → 400 SUPPLIER_MISSING
// ============================================
describe('R129 draft-po — supplier fail-closed', () => {
  it('prazen dobavitelj → 400 SUPPLIER_MISSING z imeni, BREZ kreacije PO', async () => {
    const res = await draftPoPost(draftRequest({ itemIds: [ITEM_NOSUP, ITEM_A] }))
    expect(res.status).toBe(400)
    const body = await parseJson(res)
    expect(body.error).toBe('SUPPLIER_MISSING')
    expect(body.items).toEqual(['Brez dobavitelja'])
    // fail-closed: NIč PO kreacij
    expect(state.captured.poCreate).toHaveLength(0)
    expect(state.purchaseOrders).toHaveLength(0)
  })

  it('neobstoječ Supplier zapis → 400 SUPPLIER_NOT_FOUND (ne fabrikiramo FK)', async () => {
    state.inventoryItems.push(
      { id: 'inv-ghost', name: 'Ghost artikel', unit: 'pcs', supplier: 'Neobstoječi d.o.o.', quantity: 1, minQuantity: 5, costPerUnit: 1, category: 'general', locationId: LOC_1, reorderPoint: null, safetyStock: null, leadTimeDays: null },
    )
    const res = await draftPoPost(draftRequest({ itemIds: ['inv-ghost'] }))
    expect(res.status).toBe(400)
    const body = await parseJson(res)
    expect(body.error).toBe('SUPPLIER_NOT_FOUND')
    expect(state.purchaseOrders).toHaveLength(0)
  })
})

// ============================================
// C. Validacija in scope
// ============================================
describe('R129 draft-po — validacija + tenant scope', () => {
  it('prazen selection → 400 (Zod min 1)', async () => {
    const res = await draftPoPost(draftRequest({ itemIds: [] }))
    expect(res.status).toBe(400)
  })

  it('artikel izven scope-a se tiho preskoči (reason not-found, brez PO postavke)', async () => {
    const res = await draftPoPost(draftRequest({ itemIds: [ITEM_A, ITEM_OUT] }))
    expect(res.status).toBe(201)
    const body = await parseJson(res)
    const skipped = body.skipped as Array<Record<string, unknown>>
    expect(skipped).toContainEqual({ itemId: ITEM_OUT, name: '', reason: 'not-found' })
    const orders = body.orders as Array<Record<string, unknown>>
    expect(orders).toHaveLength(1)
    expect(orders[0].itemCount).toBe(1)
    expect(state.purchaseOrders[0].items.map(i => i.inventoryItemId)).toEqual([ITEM_A])
  })

  it('covered-by-po artikel se preskoči (brez dodatnega naročila)', async () => {
    const res = await draftPoPost(draftRequest({ itemIds: [ITEM_COVERED] }))
    expect(res.status).toBe(201)
    const body = await parseJson(res)
    expect(body.orders).toEqual([])
    expect(body.skipped).toEqual([{ itemId: ITEM_COVERED, name: 'Pokrit artikel', reason: 'covered-by-po' }])
    expect(state.purchaseOrders).toHaveLength(0)
  })
})
