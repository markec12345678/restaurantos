// ============================================
// R124 / EPIC #115 P0-03 — SOLD-OUT ENFORCEMENT (strežniška blokada)
// ============================================
// Pokritje (P0-03 kanon + §32 minimalni dokaz):
//  • POST /api/orders: premalo zaloge + allowOutOfStock=false (privzeto,
//    fail-closed) → 409 { error, soldOutItems[] } in naročilo NI ustvarjeno;
//    dedup po menuItemId z najslabšo (najmanjšo) zalogo
//  • allowOutOfStock=true → naročilo ustvarjeno (odobritev prodaje),
//    opozorila tolerirana v _stockInfo
//  • ne-sledeni artikli (brez recepture in direktnega linka) → brez
//    opozoril, naročilo normalno (regresijski zaščitni test)
//  • add-items: isti 409 kontrakt PRED pisnim kanonom (addItemsToOrder NI
//    poklican); z allowOutOfStock=true se pisni tok nadaljuje
//  • cancelOrderForInsufficientStock: CAS pending→cancelled + notes
//    (provider + razlog) + postavke cancelled + revizija; count 0 → false
//    brez stranskih učinkov (phantom-cancel varnost)
//  • public/menu: stockStatus/stockAvailable/stockUnit propagacija v QR
//    meni (sleden out → 'out', ne-sleden → 'ok' + null)
//  • Zod: allowOutOfStock default false v obeh shemah (fail-closed)
//
// Trap DB (hišni stil R119–R123): in-memory model z REALNIMI semantikami
// (idempotency lookup, MODEL A scope veriga menuItem→category→menu,
// nested create, $transaction s snapshot-rollback, CAS updateMany) —
// klicane so PRODUKCIJSKE funkcije (handlePostOrder, add-items route,
// cancelOrderForInsufficientStock, public/menu GET). Razknjižba zaloge
// (_helpers/stock) je mockana — ni predmet teh testov.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const LOC_1 = 'loc0001'
const MENU_ID = 'menu-1'
const CAT_1 = 'cat-1'
const MI_BURGER = 'mi-burger'
const MI_PIZZA = 'mi-pizza'
const MI_FREE = 'mi-free'
const MI_OUT = 'mi-out'
const MI_LOW = 'mi-low'
const MI_HIDDEN = 'mi-hidden'
const INV_BEEF = 'inv-beef'
const INV_CHEESE = 'inv-cheese'
const INV_PIZZA = 'inv-pizza'
const ORDER_1 = 'order-1'

// ---------- Vrstice ----------
interface LocationRow {
  id: string; isActive: boolean; name: string; address: string; postCode: string
  city: string; phone: string; businessId: string; taxId: string
  registerNumber: string; currency: string; locale: string
}
interface TableRow { id: string; number: number; capacity: number; status: string; locationId: string }
interface MenuRow { id: string; name: string; icon: string; color: string; sortOrder: number; isActive: boolean; locationId: string }
interface CategoryRow { id: string; name: string; icon: string; color: string; sortOrder: number; menuId: string }
interface MenuItemRow {
  id: string; name: string; description: string; price: number; vatRate: number
  allergens: string[]; image: string | null; sortOrder: number; isAvailable: boolean; categoryId: string
}
interface InvRow {
  id: string; name: string; unit: string; quantity: number; minQuantity: number
  servingsPerUnit: number; menuItemId: string | null; costPerUnit: number; locationId: string | null
}
interface RecipeRow { id: string; menuItemId: string; inventoryItemId: string; quantityPerServing: number; yieldPercent: number | null }
interface OrderRow {
  id: string; orderNumber: number; idempotencyKey: string | null; type: string; status: string
  locationId: string | null; tableId: string | null; diningOptionId: string | null; revenueCenterId: string | null
  customerName: string; customerPhone: string; customerEmail: string
  subtotal: number; tax: number; discount: number; total: number; tip: number; totalWithTip: number
  paymentStatus: string; paymentMethod: string; notes: string | null; employeeId: string | null
  inventoryDeducted: boolean; firedAt: Date; updatedAt: Date; createdAt: Date
}
interface OrderItemRow {
  id: string; orderId: string; menuItemId: string; quantity: number; price: number
  vatRate: number; vatAmount: number; discountAmount: number; notes: string; modifiersJson: string; status: string
}

function createDb() {
  const idCounter = { n: 0 }
  const id = (p: string) => `${p}-${++idCounter.n}`

  const locations: LocationRow[] = []
  const tables: TableRow[] = []
  const menus: MenuRow[] = []
  const categories: CategoryRow[] = []
  const menuItems: MenuItemRow[] = []
  const inv: InvRow[] = []
  const recipes: RecipeRow[] = []
  const orders: OrderRow[] = []
  const orderItems: OrderItemRow[] = []
  const audit: Record<string, unknown>[] = []

  // MODEL A veriga: MenuItem → Category → Menu.locationId
  function menuLocationIdOf(menuItemId: string): string | null {
    const mi = menuItems.find(m => m.id === menuItemId)
    const cat = mi ? categories.find(c => c.id === mi.categoryId) : undefined
    const menu = cat ? menus.find(m => m.id === cat.menuId) : undefined
    return menu ? menu.locationId : null
  }

  function hydrateOrder(
    row: OrderRow,
    include?: { table?: unknown; orderItems?: unknown },
  ): Record<string, unknown> {
    const out: Record<string, unknown> = { ...row }
    if (include?.table) {
      const t = tables.find(x => x.id === row.tableId)
      out.table = t ? { ...t } : null
    }
    if (include?.orderItems) {
      out.orderItems = orderItems
        .filter(oi => oi.orderId === row.id)
        .map(oi => ({
          ...oi,
          menuItem: menuItems.find(mi => mi.id === oi.menuItemId) ?? { id: oi.menuItemId },
        }))
    }
    return out
  }

  const clients = {
    location: {
      findFirst: async ({ where }: { where?: { id?: string; isActive?: boolean } }) => {
        const row = locations.find(l =>
          (where?.id === undefined || l.id === where.id) &&
          (where?.isActive === undefined || l.isActive === where.isActive))
        return row ? { ...row } : null
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = locations.find(l => l.id === where.id)
        return row ? { ...row } : null
      },
    },
    table: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = tables.find(t => t.id === where.id)
        return row ? { ...row } : null
      },
      findMany: async ({ where }: { where?: { status?: string; locationId?: string } }) => {
        return tables
          .filter(t =>
            (where?.status === undefined || t.status === where.status) &&
            (where?.locationId === undefined || t.locationId === where.locationId))
          .map(t => ({ id: t.id, number: t.number, capacity: t.capacity }))
      },
    },
    menu: {
      // nested select/where iz public/menu: kategorije z vsaj enim
      // isAvailable artiklom, artikli isAvailable=true, orderBy sortOrder
      findMany: async ({ where }: { where?: { isActive?: boolean; locationId?: string } }) => {
        return menus
          .filter(m =>
            (where?.isActive === undefined || m.isActive === where.isActive) &&
            (where?.locationId === undefined || m.locationId === where.locationId))
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(m => ({
            id: m.id, name: m.name, icon: m.icon, color: m.color, sortOrder: m.sortOrder,
            categories: categories
              .filter(c => c.menuId === m.id && menuItems.some(mi => mi.categoryId === c.id && mi.isAvailable))
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map(c => ({
                id: c.id, name: c.name, icon: c.icon, color: c.color, sortOrder: c.sortOrder,
                menuItems: menuItems
                  .filter(mi => mi.categoryId === c.id && mi.isAvailable)
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map(mi => ({
                    id: mi.id, name: mi.name, description: mi.description, price: mi.price,
                    vatRate: mi.vatRate, allergens: mi.allergens, image: mi.image, sortOrder: mi.sortOrder,
                    modifierGroups: [],
                  })),
              })),
          }))
      },
    },
    menuItem: {
      findMany: async ({
        where,
      }: {
        where?: { id?: { in: string[] }; category?: { menu?: { locationId?: string } } }
      }) => {
        return menuItems
          .filter(mi => {
            if (where?.id?.in && !where.id.in.includes(mi.id)) return false
            const want = where?.category?.menu?.locationId
            if (want !== undefined && menuLocationIdOf(mi.id) !== want) return false
            return true
          })
          .map(mi => ({ id: mi.id, vatRate: mi.vatRate, price: mi.price }))
      },
    },
    // FIX BUG-13 cena modifierjev — v testih brez modifierjev = prazna mapa
    menuItemModifierGroup: {
      findMany: async () => [] as Array<Record<string, never>>,
    },
    diningOption: { findFirst: async () => null },
    revenueCenter: { findFirst: async () => null },
    recipeItem: {
      findMany: async ({
        where,
        include,
      }: {
        where?: { menuItemId?: { in: string[] } }
        include?: { inventoryItem?: unknown; menuItem?: unknown }
      }) => {
        return recipes
          .filter(r => !where?.menuItemId?.in || where.menuItemId.in.includes(r.menuItemId))
          .map(r => {
            const out: Record<string, unknown> = { ...r }
            if (include?.inventoryItem) {
              const row = inv.find(i => i.id === r.inventoryItemId)
              out.inventoryItem = row ? { ...row } : null
            }
            if (include?.menuItem) {
              const mi = menuItems.find(m => m.id === r.menuItemId)
              out.menuItem = mi ? { name: mi.name } : null
            }
            return out
          })
      },
    },
    inventoryItem: {
      findMany: async ({
        where,
        include,
      }: {
        where?: { menuItemId?: { in: string[] } }
        include?: { menuItem?: unknown }
      }) => {
        return inv
          .filter(i => !where?.menuItemId?.in || (i.menuItemId !== null && where.menuItemId.in.includes(i.menuItemId)))
          .map(row => {
            const out: Record<string, unknown> = { ...row }
            if (include?.menuItem) {
              const mi = menuItems.find(m => m.id === row.menuItemId)
              out.menuItem = mi ? { name: mi.name } : null
            }
            return out
          })
      },
    },
    order: {
      findFirst: async ({
        where,
        include,
      }: {
        where?: { id?: string; idempotencyKey?: string; locationId?: string | null; status?: string }
        include?: { table?: unknown; orderItems?: unknown }
      }) => {
        const row = orders.find(o =>
          (where?.id === undefined || o.id === where.id) &&
          (where?.idempotencyKey === undefined || o.idempotencyKey === where.idempotencyKey) &&
          (where?.locationId === undefined || o.locationId === where.locationId) &&
          (where?.status === undefined || o.status === where.status))
        return row ? hydrateOrder(row, include) : null
      },
      create: async ({
        data,
        include,
      }: {
        data: Record<string, unknown>
        include?: { table?: unknown; orderItems?: unknown }
      }) => {
        const d = data as Partial<OrderRow> & { orderItems?: { create?: Array<Partial<OrderItemRow>> } }
        const row: OrderRow = {
          id: id('ord'),
          orderNumber: d.orderNumber ?? 0,
          idempotencyKey: d.idempotencyKey ?? null,
          type: d.type ?? 'dine-in',
          status: d.status ?? 'pending',
          locationId: d.locationId ?? null,
          tableId: d.tableId ?? null,
          diningOptionId: d.diningOptionId ?? null,
          revenueCenterId: d.revenueCenterId ?? null,
          customerName: d.customerName ?? '',
          customerPhone: d.customerPhone ?? '',
          customerEmail: d.customerEmail ?? '',
          subtotal: d.subtotal ?? 0,
          tax: d.tax ?? 0,
          discount: d.discount ?? 0,
          total: d.total ?? 0,
          tip: d.tip ?? 0,
          totalWithTip: d.totalWithTip ?? 0,
          paymentStatus: d.paymentStatus ?? 'unpaid',
          paymentMethod: d.paymentMethod ?? '',
          notes: d.notes ?? null,
          employeeId: d.employeeId ?? null,
          inventoryDeducted: d.inventoryDeducted ?? false,
          firedAt: d.firedAt ?? new Date(),
          updatedAt: new Date(),
          createdAt: new Date(),
        }
        orders.push(row)
        for (const it of d.orderItems?.create ?? []) {
          orderItems.push({
            id: id('oi'),
            orderId: row.id,
            menuItemId: it.menuItemId ?? '',
            quantity: it.quantity ?? 1,
            price: it.price ?? 0,
            vatRate: it.vatRate ?? 0,
            vatAmount: it.vatAmount ?? 0,
            discountAmount: it.discountAmount ?? 0,
            notes: it.notes ?? '',
            modifiersJson: it.modifiersJson ?? '[]',
            status: it.status ?? 'pending',
          })
        }
        return hydrateOrder(row, include)
      },
      // CAS updateMany (phantom-cancel): status pogoj v where = atomarni claim
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; status?: string }
        data: { status?: string; notes?: string }
      }) => {
        let count = 0
        for (const o of orders) {
          if (o.id !== where.id) continue
          if (where.status !== undefined && o.status !== where.status) continue
          if (data.status !== undefined) o.status = data.status
          if (data.notes !== undefined) o.notes = data.notes
          count++
        }
        return { count }
      },
    },
    orderItem: {
      updateMany: async ({
        where,
        data,
      }: {
        where: { orderId: string }
        data: { status: string }
      }) => {
        let count = 0
        for (const oi of orderItems) {
          if (oi.orderId !== where.orderId) continue
          oi.status = data.status
          count++
        }
        return { count }
      },
    },
  }

  // tx = isti trap (isti array-i); snapshot-rollback = pariteta z realno DB
  const tx = { ...clients }
  const db = {
    ...clients,
    $transaction: async <T>(fn: (txClient: typeof tx) => Promise<T>): Promise<T> => {
      const snapOrders = orders.map(o => ({ ...o }))
      const snapItems = orderItems.map(i => ({ ...i }))
      const snapTables = tables.map(t => ({ ...t }))
      try {
        return await fn(tx)
      } catch (e) {
        orders.splice(0, orders.length, ...snapOrders)
        orderItems.splice(0, orderItems.length, ...snapItems)
        tables.splice(0, tables.length, ...snapTables)
        throw e
      }
    },
  }

  return {
    db, tx, locations, tables, menus, categories, menuItems, inv, recipes, orders, orderItems, audit,
  }
}

// ---------- Mocki (vi.hoisted ref + getter, hišni stil) ----------
const ref = vi.hoisted(() => ({ current: null as unknown as ReturnType<typeof createDb> }))
ref.current = createDb()

const m = vi.hoisted(() => ({
  getNextOrderNumber: vi.fn(),
  handleStockDeduction: vi.fn(),
  handlePostCreationEffects: vi.fn(),
  addItemsToOrder: vi.fn(),
  computeMenuStockMap: vi.fn(),
  requireAuth: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  get db() {
    return ref.current.db
  },
  createAuditLog: async (entry: Record<string, unknown>) => {
    ref.current.audit.push(entry)
  },
}))
vi.mock('@/lib/counters', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/counters')>()
  return {
    ...actual,
    getNextOrderNumber: (...args: unknown[]) => m.getNextOrderNumber(...args),
  }
})
// Razknjižba + stranski učinki po kreaciji niso predmet teh testov
vi.mock('@/app/api/orders/_helpers/stock', () => ({
  handleStockDeduction: (...args: unknown[]) => m.handleStockDeduction(...args),
  handlePostCreationEffects: (...args: unknown[]) => m.handlePostCreationEffects(...args),
}))
// Pisni kanon add-items (R108) — spodaj assertiramo SAMO ali je bil poklican.
// Pot je [id]/_helpers: route uvaža '../_helpers/order-mutations' relativno na
// [id]/add-items/ → src/app/api/orders/[id]/_helpers/order-mutations.ts
vi.mock('@/app/api/orders/[id]/_helpers/order-mutations', () => ({
  addItemsToOrder: (...args: unknown[]) => m.addItemsToOrder(...args),
}))
vi.mock('@/lib/auth-middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-middleware')>()
  return {
    ...actual,
    requireAuth: (...args: unknown[]) => m.requireAuth(...args),
    // resolveTenantLocationIdOrThrow ostane REALNA (pure) — tenant semantika zares
  }
})
// public/menu: availability kanon je pokrit v tests/unit/lib/menu-availability.test.ts —
// tukaj mockamo mapo in testiramo ROUTE mapping (stockStatus/stockAvailable/stockUnit)
vi.mock('@/lib/availability/menu-availability', () => ({
  computeMenuStockMap: (...args: unknown[]) => m.computeMenuStockMap(...args),
}))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: async () => ({ allowed: true, remaining: 10 }),
  checkRateLimit: () => ({ allowed: true, remaining: 10 }),
  getClientIp: () => '127.0.0.1',
  PUBLIC_MENU_LIMIT: { maxRequests: 100, windowMs: 60000 },
  AUTHENTICATED_LIMIT: { maxRequests: 120, windowMs: 60000 },
}))
vi.mock('@/lib/rate-limit/response', () => ({
  rateLimitedResponse: () => new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 }),
}))

import { handlePostOrder } from '@/app/api/orders/_helpers/post-handler'
import { POST as addItemsPost } from '@/app/api/orders/[id]/add-items/route'
import { cancelOrderForInsufficientStock } from '@/lib/stock-deduction/cancel-on-insufficient-stock'
import { GET as publicMenuGet } from '@/app/api/public/menu/route'
import { createOrderSchema, addOrderItemsSchema } from '@/lib/validations/orders'

const state = ref.current

// ---------- Helperji ----------
function seedBase() {
  state.locations.length = 0
  state.tables.length = 0
  state.menus.length = 0
  state.categories.length = 0
  state.menuItems.length = 0
  state.inv.length = 0
  state.recipes.length = 0
  state.orders.length = 0
  state.orderItems.length = 0
  state.audit.length = 0
  state.locations.push({
    id: LOC_1, isActive: true, name: 'Gostilna Demo', address: 'Cesta 1', postCode: '1000',
    city: 'Ljubljana', phone: '+386 1 234 5678', businessId: 'BIZ-1', taxId: 'SI12345678',
    registerNumber: 'REG-1', currency: 'EUR', locale: 'sl-SI',
  })
  state.tables.push({ id: 'table-1', number: 1, capacity: 4, status: 'available', locationId: LOC_1 })
  state.menus.push({ id: MENU_ID, name: 'Hrana', icon: '', color: '', sortOrder: 0, isActive: true, locationId: LOC_1 })
  state.categories.push({ id: CAT_1, name: 'Glavne jedi', icon: '', color: '', sortOrder: 0, menuId: MENU_ID })
  state.menuItems.push(
    { id: MI_BURGER, name: 'Hišni burger', description: '', price: 10, vatRate: 9.5, allergens: [], image: null, sortOrder: 0, isAvailable: true, categoryId: CAT_1 },
    { id: MI_PIZZA, name: 'Študentska pica', description: '', price: 12, vatRate: 9.5, allergens: [], image: null, sortOrder: 1, isAvailable: true, categoryId: CAT_1 },
    { id: MI_FREE, name: 'Ne-sleden artikel', description: '', price: 5, vatRate: 9.5, allergens: [], image: null, sortOrder: 2, isAvailable: true, categoryId: CAT_1 },
    { id: MI_OUT, name: 'Izprodan artikel', description: '', price: 8, vatRate: 9.5, allergens: [], image: null, sortOrder: 3, isAvailable: true, categoryId: CAT_1 },
    { id: MI_LOW, name: 'Omejen artikel', description: '', price: 7, vatRate: 9.5, allergens: [], image: null, sortOrder: 4, isAvailable: true, categoryId: CAT_1 },
    { id: MI_HIDDEN, name: 'Skrit artikel', description: '', price: 6, vatRate: 9.5, allergens: [], image: null, sortOrder: 5, isAvailable: false, categoryId: CAT_1 },
  )
}

function addRecipeLine(menuItemId: string, inventoryItemId: string, quantityPerServing: number, yieldPercent: number | null = 100) {
  state.recipes.push({ id: `ri-${state.recipes.length + 1}`, menuItemId, inventoryItemId, quantityPerServing, yieldPercent })
}

function addInv(over: Partial<InvRow> & { id: string; quantity: number }) {
  state.inv.push({ name: 'Sestavina', unit: 'kos', minQuantity: 0, servingsPerUnit: 0, menuItemId: null, costPerUnit: 1, locationId: LOC_1, ...over })
}

/** Zalogovno stanje "prodajno polje": burger po recepturi (2 sestavini), pizza direktno */
function seedSoldOutState() {
  addInv({ id: INV_BEEF, name: 'Goveja mleta', unit: 'kg', quantity: 0.8, minQuantity: 0.2, costPerUnit: 8 })
  addInv({ id: INV_CHEESE, name: 'Sir chedar', unit: 'kg', quantity: 0.1, minQuantity: 0.5, costPerUnit: 10 })
  addInv({ id: INV_PIZZA, name: 'Pizza 33cm', unit: 'kos', quantity: 1, minQuantity: 1, servingsPerUnit: 2, menuItemId: MI_PIZZA, costPerUnit: 3 })
  addRecipeLine(MI_BURGER, INV_BEEF, 0.5)
  addRecipeLine(MI_BURGER, INV_CHEESE, 0.2)
}

function seedPendingOrder() {
  state.orders.push({
    id: ORDER_1, orderNumber: 7, idempotencyKey: 'key-7', type: 'dine-in', status: 'pending',
    locationId: LOC_1, tableId: null, diningOptionId: null, revenueCenterId: null,
    customerName: '', customerPhone: '', customerEmail: '',
    subtotal: 5, tax: 0.48, discount: 0, total: 5.48, tip: 0, totalWithTip: 5.48,
    paymentStatus: 'unpaid', paymentMethod: '', notes: null, employeeId: 'emp-9',
    inventoryDeducted: false, firedAt: new Date(), updatedAt: new Date(), createdAt: new Date(),
  })
  state.orderItems.push({
    id: 'oi-1', orderId: ORDER_1, menuItemId: MI_FREE, quantity: 1, price: 5,
    vatRate: 9.5, vatAmount: 0.48, discountAmount: 0, notes: '', modifiersJson: '[]', status: 'pending',
  })
}

function postReq(body: unknown) {
  return new Request('http://localhost:3000/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function orderBody(over: Record<string, unknown> = {}) {
  return { type: 'dine-in', idempotencyKey: 'key-1', orderItems: [{ menuItemId: MI_BURGER, quantity: 2 }], ...over }
}

function authSession() {
  return {
    session: { employeeId: 'emp-9', locationId: LOC_1, role: 'waiter' },
    scope: { locationId: LOC_1 },
    searchParams: new URL('http://localhost:3000/api/orders').searchParams,
  }
}

function addReq(orderId: string, body: unknown) {
  return new Request(`http://localhost:3000/api/orders/${orderId}/add-items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const ID_PARAMS = (pid: string) => ({ params: Promise.resolve({ id: pid }) })

function resetMocks() {
  m.getNextOrderNumber.mockResolvedValue(101)
  m.handleStockDeduction.mockResolvedValue({ stockDeducted: true })
  m.handlePostCreationEffects.mockResolvedValue(undefined)
  m.addItemsToOrder.mockResolvedValue({
    created: [{ id: 'oi-new' }],
    stockResult: { deducted: [], lowStockAlerts: [] },
    orderNumber: 7,
    orderLocationId: LOC_1,
  })
  m.computeMenuStockMap.mockResolvedValue({})
  m.requireAuth.mockResolvedValue({
    session: { employeeId: 'emp-9', locationId: LOC_1, role: 'waiter' },
    error: null,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  seedBase()
  resetMocks()
})

// ============================================
// POST /api/orders — 409 sold-out enforcement
// ============================================
describe('POST /api/orders — strežniška blokada izprodanih artiklov', () => {
  it('premalo zaloge + allowOutOfStock false (privzeto) → 409 z soldOutItems, naročilo NI ustvarjeno', async () => {
    seedSoldOutState()
    const res = await handlePostOrder(
      postReq(orderBody({
        orderItems: [
          { menuItemId: MI_BURGER, quantity: 2 }, // recept: needed 1.0 kg / 0.4 kg, zaloga 0.8 / 0.1
          { menuItemId: MI_PIZZA, quantity: 3 },  // direktno: needed 3 servisa, zaloga 2
        ],
      })),
      authSession(),
    )
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toContain('Artikli brez zadostne zaloge')
    expect(data.error).toContain('Hišni burger')
    expect(data.error).toContain('Študentska pica')

    // dedup po menuItemId + najslabša (najmanjša) sestavina zmaga
    expect(data.soldOutItems).toHaveLength(2)
    const burger = data.soldOutItems.find((i: { menuItemId: string }) => i.menuItemId === MI_BURGER)
    expect(burger).toEqual({
      menuItemId: MI_BURGER, itemName: 'Hišni burger', ingredientName: 'Sir chedar',
      needed: 0.4, available: 0.1, unit: 'kg',
    })
    const pizza = data.soldOutItems.find((i: { menuItemId: string }) => i.menuItemId === MI_PIZZA)
    expect(pizza).toEqual({
      menuItemId: MI_PIZZA, itemName: 'Študentska pica', ingredientName: 'Pizza 33cm',
      needed: 3, available: 2, unit: 'kos',
    })

    // kanon P0-03: oversell NI več mogoč — order + postavke ne obstajata
    expect(state.orders).toHaveLength(0)
    expect(state.orderItems).toHaveLength(0)
    expect(m.handleStockDeduction).not.toHaveBeenCalled()
  })

  it('allowOutOfStock=true → naročilo ustvarjeno (201), opozorila tolerirana v _stockInfo', async () => {
    seedSoldOutState()
    const items = [
      { menuItemId: MI_BURGER, quantity: 2 },
      { menuItemId: MI_PIZZA, quantity: 3 },
    ]
    const res = await handlePostOrder(postReq(orderBody({ allowOutOfStock: true, orderItems: items })), authSession())
    expect(res.status).toBe(201)
    expect(state.orders).toHaveLength(1)

    const order = state.orders[0]
    expect(order).toMatchObject({
      status: 'pending', locationId: LOC_1, orderNumber: 101, employeeId: 'emp-9',
      subtotal: 56, tax: 5.32, total: 61.32, // burger 2×10 + pizza 3×12 @ 9.5% DDV
    })
    expect(state.orderItems.map(i => i.menuItemId).sort()).toEqual([MI_BURGER, MI_PIZZA].sort())

    const data = await res.json()
    expect(data._stockInfo.deducted).toBe(true)
    expect(data._stockInfo.lowStockWarnings).toHaveLength(3) // 2 burger + 1 pizza opozorila

    // razknjižba je bila sprožena z istimi vrsticami (invarianta needed == deducted)
    expect(m.handleStockDeduction).toHaveBeenCalledTimes(1)
    const call = m.handleStockDeduction.mock.calls[0] as unknown[]
    expect(call[1]).toBe(101)
    expect(call[2]).toEqual(items)
    expect(call[0]).toBe(order.id)
  })

  it('artikli brez recepture in direktnega linka → brez opozoril, naročilo ustvarjeno (regresija ne-sledenih)', async () => {
    const res = await handlePostOrder(
      postReq(orderBody({ orderItems: [{ menuItemId: MI_FREE, quantity: 5 }] })),
      authSession(),
    )
    expect(res.status).toBe(201)
    expect(state.orders).toHaveLength(1)
    const data = await res.json()
    expect(data._stockInfo.lowStockWarnings).toEqual([])
    expect(data._stockInfo.deducted).toBe(true)
  })
})

// ============================================
// POST /api/orders/[id]/add-items — 409 pred pisnim kanonom
// ============================================
describe('POST /api/orders/[id]/add-items — preverba zaloge pred R108 kanonom', () => {
  it('premalo zaloge + privzeto → 409 z soldOutItems; addItemsToOrder NI poklican, brez pisnih učinkov', async () => {
    addInv({ id: INV_BEEF, name: 'Goveja mleta', unit: 'kg', quantity: 0.3, minQuantity: 0, costPerUnit: 8 })
    addRecipeLine(MI_BURGER, INV_BEEF, 0.5) // needed 0.5 > zaloga 0.3
    seedPendingOrder()

    const res = await addItemsPost(
      addReq(ORDER_1, { orderItems: [{ menuItemId: MI_BURGER, quantity: 1 }] }),
      ID_PARAMS(ORDER_1),
    )
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.soldOutItems).toHaveLength(1)
    expect(data.soldOutItems[0]).toEqual({
      menuItemId: MI_BURGER, itemName: 'Hišni burger', ingredientName: 'Goveja mleta',
      needed: 0.5, available: 0.3, unit: 'kg',
    })
    expect(m.addItemsToOrder).not.toHaveBeenCalled()
    expect(state.audit.some(a => a.action === 'ADD_ITEMS_TO_ORDER')).toBe(false)
  })

  it('allowOutOfStock=true → pisni tok se nadaljuje (addItemsToOrder poklican, 200)', async () => {
    addInv({ id: INV_BEEF, name: 'Goveja mleta', unit: 'kg', quantity: 0.3, minQuantity: 0, costPerUnit: 8 })
    addRecipeLine(MI_BURGER, INV_BEEF, 0.5)
    seedPendingOrder()

    const res = await addItemsPost(
      addReq(ORDER_1, { orderItems: [{ menuItemId: MI_BURGER, quantity: 1 }], allowOutOfStock: true }),
      ID_PARAMS(ORDER_1),
    )
    expect(res.status).toBe(200)
    expect(m.addItemsToOrder).toHaveBeenCalledTimes(1)
    // route posreduje ZOD-parsane postavke (z defaulti notes/modifiersJson)
    expect(m.addItemsToOrder.mock.calls[0]?.[0]).toEqual({
      orderId: ORDER_1,
      locationId: LOC_1,
      orderItems: [{ menuItemId: MI_BURGER, quantity: 1, notes: '', modifiersJson: '[]' }],
    })
    const data = await res.json()
    expect(data.addedItems).toBe(1)
    expect(state.audit.some(a => a.action === 'ADD_ITEMS_TO_ORDER')).toBe(true)
  })
})

// ============================================
// cancelOrderForInsufficientStock — phantom-cancel (Glovo/Wolt)
// ============================================
describe('cancelOrderForInsufficientStock — CAS phantom-cancel', () => {
  it('pending → cancelled (CAS) + postavke cancelled + revizija z providerjem in razlogom', async () => {
    seedPendingOrder()
    const ok = await cancelOrderForInsufficientStock(ORDER_1, 42, 'glovo', 'INSUFFICIENT_STOCK: Goveja mleta')
    expect(ok).toBe(true)
    expect(state.orders[0].status).toBe('cancelled')
    expect(state.orders[0].notes).toContain('PREKLICANO (glovo — nezadostna zaloga)')
    expect(state.orders[0].notes).toContain('INSUFFICIENT_STOCK: Goveja mleta')
    expect(state.orderItems).toHaveLength(1)
    expect(state.orderItems[0].status).toBe('cancelled') // KDS item-level filter
    const audit = state.audit.find(a => a.action === 'AUTO_CANCEL_INSUFFICIENT_STOCK')
    expect(audit).toBeDefined()
    expect(audit?.entityType).toBe('Order')
    expect(audit?.entityId).toBe(ORDER_1)
    expect(audit?.details).toMatchObject({
      provider: 'glovo',
      orderNumber: 42,
      reason: 'INSUFFICIENT_STOCK: Goveja mleta',
      automated: true,
    })
  })

  it('order ni več pending (count 0) → false; postavke in notes nespremenjeni, brez revizije', async () => {
    seedPendingOrder()
    state.orders[0].status = 'accepted' // operater je že prevzel naročilo
    const ok = await cancelOrderForInsufficientStock(ORDER_1, 42, 'wolt', 'INSUFFICIENT_STOCK')
    expect(ok).toBe(false)
    expect(state.orders[0].status).toBe('accepted')
    expect(state.orders[0].notes).toBeNull()
    expect(state.orderItems.every(i => i.status === 'pending')).toBe(true)
    expect(state.audit).toHaveLength(0)
  })
})

// ============================================
// GET /api/public/menu — stock propagation za QR meni
// ============================================
describe('GET /api/public/menu — sold-out propagacija v javni payload', () => {
  it('sleden artikel out/low dobi stockStatus + številčni stockAvailable; ne-sleden → ok + null', async () => {
    m.computeMenuStockMap.mockResolvedValue({
      [MI_OUT]: { status: 'out', available: 0, unit: 'kg', source: 'recipe' },
      [MI_LOW]: { status: 'low', available: 3, unit: 'kos', source: 'direct' },
    })
    const res = await publicMenuGet(new Request('http://localhost:3000/api/public/menu?locationId=loc0001'))
    expect(res.status).toBe(200)
    const data = await res.json()

    const items: Array<{ id: string; stockStatus: string; stockAvailable: number | null; stockUnit: string | null }> =
      data.menus[0].categories[0].menuItems
    // skriti artikel (isAvailable false) sploh ni v javnem meniju
    expect(items.some(i => i.id === MI_HIDDEN)).toBe(false)

    const out = items.find(i => i.id === MI_OUT)
    expect(out).toMatchObject({ stockStatus: 'out', stockAvailable: 0, stockUnit: 'kg' })
    const low = items.find(i => i.id === MI_LOW)
    expect(low).toMatchObject({ stockStatus: 'low', stockAvailable: 3, stockUnit: 'kos' })
    // ne-sleden artikel: back-compat 'ok' + null available/unit
    const free = items.find(i => i.id === MI_FREE)
    expect(free).toMatchObject({ stockStatus: 'ok', stockAvailable: null, stockUnit: null })

    // scope: computeMenuStockMap dobi ID-je VSEH javnih artiklov (izključno te)
    expect(m.computeMenuStockMap).toHaveBeenCalledTimes(1)
    expect(m.computeMenuStockMap).toHaveBeenCalledWith({
      menuItemIds: expect.arrayContaining([MI_OUT, MI_LOW, MI_FREE]),
    })
  })

  it('manjkajoč ?locationId → 404, brez availability izračuna (R90 kanon)', async () => {
    const res = await publicMenuGet(new Request('http://localhost:3000/api/public/menu'))
    expect(res.status).toBe(404)
    expect(m.computeMenuStockMap).not.toHaveBeenCalled()
  })
})

// ============================================
// Zod — allowOutOfStock (fail-closed)
// ============================================
describe('Zod shemi — allowOutOfStock default false', () => {
  it('createOrderSchema: manjkajoče polje → privzeto false (fail-closed)', () => {
    const parsed = createOrderSchema.parse({ orderItems: [{ menuItemId: 'cuid-1', quantity: 1 }] })
    expect(parsed.allowOutOfStock).toBe(false)
  })

  it('createOrderSchema: eksplicitno true preide skozi (odobritev prodaje)', () => {
    const parsed = createOrderSchema.parse({
      orderItems: [{ menuItemId: 'cuid-1', quantity: 1 }],
      allowOutOfStock: true,
    })
    expect(parsed.allowOutOfStock).toBe(true)
  })

  it('addOrderItemsSchema: privzeto false; eksplicitno true ohranjeno', () => {
    expect(addOrderItemsSchema.parse({ orderItems: [{ menuItemId: 'cuid-1', quantity: 2 }] }).allowOutOfStock).toBe(false)
    expect(addOrderItemsSchema.parse({ orderItems: [{ menuItemId: 'cuid-1', quantity: 2 }], allowOutOfStock: true }).allowOutOfStock).toBe(true)
  })
})
