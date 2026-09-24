// ============================================
// R123 / EPIC #115 P0-05 — RECIPE YIELD (izguba priprave)
// ============================================
// Pokritje (P0-05 kanon + §32 minimalni dokaz):
//  • Y-1 POST validacija: yieldPercent 0 / 101 / 150 → 400 (fail-closed);
//    manjkajoč → default 100 zapisan; 85 → 85 zapisan
//  • Y-2 PUT: yieldPercent 50 → posodobljen; 0 → 400 (staro ostane);
//    izpuščen → ohrani staro vrednost
//  • Y-3 GET enriched: costPerServing = usable × cena / (yield/100),
//    rawQuantityPerServing = usable / (yield/100); yield 100 → identiteta;
//    legacy null yield → tretan kot 100
//  • Y-4 DEDUKCIJA (deductRecipeItems): yield 50 → RAW odvod 2×
//    quantityPerServing + 'sale' ledger −2×; yield 100 → 1× (back-compat);
//    količina 2 množi RAW; premalo zaloge → "Premalo zaloge" + success=false
//    (zaloga nespremenjena, poskus z 0 odvodom v ledgerju)
//  • Y-5 availability (checkStockAvailability): yield 50 → needed = 2×
//    quantityPerServing; dovolj zaloge → brez opozoril
//  • Y-6 INVARIANTA deduction ↔ availability: isti yield → needed ==
//    deducted (vključno z legacy null yieldom)
//
// Trap DB (hišni stil R119/R120/R121/R122): in-memory model z REALNIMI
// semantikami (nested where menuItem → category → menu.locationId, include
// hydracija, atomarni pogojni updateMany, 'sale' ledger) — klicane so
// PRODUKCIJSKE route handler funkcije IZ direktne produkcijske poti
// deduction/availability (vi.mock('@/lib/db') na ravni modula).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'

const LOC_1 = 'loc-1'
const LOC_2 = 'loc-2'
const MENU_ID = 'mi-burger'
const INV_ID = 'inv-beef'
const INV_CHEESE_ID = 'inv-cheese'

// ---------- Vrstice ----------
interface MenuRow {
  id: string
  locationId: string
}
interface CategoryRow {
  id: string
  menuId: string
}
interface MenuItemRow {
  id: string
  name: string
  price: number
  categoryId: string
}
interface RecipeRow {
  id: string
  menuItemId: string
  inventoryItemId: string
  quantityPerServing: number
  yieldPercent: number | null // null = legacy vrstica (DB default 100)
  unit: string
  notes: string
  createdAt: Date
}
interface InvRow {
  id: string
  name: string
  unit: string
  quantity: number
  costPerUnit: number
  minQuantity: number
  locationId: string | null
  menuItemId: string | null
  servingsPerUnit: number
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
  orderId?: string
}

function createDb() {
  const idCounter = { n: 0 }
  const id = (p: string) => `${p}-${++idCounter.n}`

  const menus: MenuRow[] = [
    { id: 'menu-1', locationId: LOC_1 },
    { id: 'menu-2', locationId: LOC_2 },
  ]
  const categories: CategoryRow[] = [
    { id: 'cat-1', menuId: 'menu-1' },
    { id: 'cat-2', menuId: 'menu-2' },
  ]
  const menuItems: MenuItemRow[] = [
    { id: MENU_ID, name: 'Hišni burger', price: 12, categoryId: 'cat-1' },
    { id: 'mi-other', name: 'Tuja pica', price: 9, categoryId: 'cat-2' },
  ]
  const recipeItems: RecipeRow[] = []
  const inv: InvRow[] = []
  const stockTx: StockTxRow[] = []

  // ---------- resolverji verige menuItem → category → menu ----------
  function menuLocationIdOf(menuItemId: string): string | null {
    const mi = menuItems.find(m => m.id === menuItemId)
    const cat = mi ? categories.find(c => c.id === mi.categoryId) : undefined
    const menu = cat ? menus.find(m => m.id === cat.menuId) : undefined
    return menu ? menu.locationId : null
  }

  function hydrateRecipe(
    r: RecipeRow,
    include?: { menuItem?: unknown; inventoryItem?: unknown },
  ): Record<string, unknown> {
    const out: Record<string, unknown> = { ...r }
    if (include?.menuItem) {
      const mi = menuItems.find(m => m.id === r.menuItemId)
      out.menuItem = mi ? { ...mi } : null
    }
    if (include?.inventoryItem) {
      const row = inv.find(i => i.id === r.inventoryItemId)
      out.inventoryItem = row ? { ...row } : null
    }
    return out
  }

  function recipeMatches(r: RecipeRow, where: Record<string, unknown>): boolean {
    const w = where as {
      id?: string
      menuItemId?: string | { in: string[] }
      inventoryItemId?: string
      menuItem?: { category?: { menu?: { locationId?: string } } }
    }
    if (w.id !== undefined && r.id !== w.id) return false
    if (w.menuItemId !== undefined) {
      if (typeof w.menuItemId === 'object' && w.menuItemId !== null && 'in' in w.menuItemId) {
        if (!w.menuItemId.in.includes(r.menuItemId)) return false
      } else if (r.menuItemId !== w.menuItemId) return false
    }
    if (w.inventoryItemId !== undefined && r.inventoryItemId !== w.inventoryItemId) return false
    if (w.menuItem !== undefined) {
      const want = w.menuItem?.category?.menu?.locationId
      if (want !== undefined && menuLocationIdOf(r.menuItemId) !== want) return false
    }
    return true
  }

  function makeClients() {
    return {
      menuItem: {
        findFirst: async ({ where }: { where: { id: string; category?: { menu?: { locationId?: string } } } }) => {
          const mi = menuItems.find(m => m.id === where.id)
          if (!mi) return null
          const want = where.category?.menu?.locationId
          if (want !== undefined && menuLocationIdOf(mi.id) !== want) return null
          return { ...mi }
        },
      },
      recipeItem: {
        findMany: async (args: {
          where?: Record<string, unknown>
          include?: { menuItem?: unknown; inventoryItem?: unknown }
          orderBy?: { createdAt?: string }
          take?: number
          skip?: number
        }) => {
          let rows = recipeItems.filter(r => (args.where ? recipeMatches(r, args.where) : true))
          if (args.orderBy?.createdAt === 'desc') {
            rows = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          }
          const skip = args.skip ?? 0
          rows = args.take !== undefined ? rows.slice(skip, skip + args.take) : rows.slice(skip)
          return rows.map(r => hydrateRecipe(r, args.include))
        },
        count: async ({ where }: { where?: Record<string, unknown> }) =>
          recipeItems.filter(r => (where ? recipeMatches(r, where) : true)).length,
        create: async ({
          data,
          include,
        }: {
          data: Record<string, unknown>
          include?: { menuItem?: unknown; inventoryItem?: unknown }
        }) => {
          const d = data as {
            menuItemId: string
            inventoryItemId: string
            quantityPerServing: number
            yieldPercent: number
            unit?: string
            notes?: string
          }
          const row: RecipeRow = {
            id: id('ri'),
            menuItemId: d.menuItemId,
            inventoryItemId: d.inventoryItemId,
            quantityPerServing: d.quantityPerServing,
            yieldPercent: d.yieldPercent,
            unit: d.unit ?? '',
            notes: d.notes ?? '',
            createdAt: new Date(),
          }
          recipeItems.push(row)
          return hydrateRecipe(row, include)
        },
        findUnique: async ({
          where,
          select,
        }: {
          where: { id: string }
          select?: Record<string, unknown>
        }) => {
          const r = recipeItems.find(x => x.id === where.id)
          if (!r) return null
          if (select?.menuItem) {
            // scope check pot (nested select id → menuItem.category.menu.locationId)
            return { id: r.id, menuItem: { category: { menu: { locationId: menuLocationIdOf(r.menuItemId) } } } }
          }
          return { ...r }
        },
        update: async ({
          where,
          data,
          include,
        }: {
          where: { id: string }
          data: Record<string, unknown>
          include?: { menuItem?: unknown; inventoryItem?: unknown }
        }) => {
          const r = recipeItems.find(x => x.id === where.id)
          if (!r) throw new Prisma.PrismaClientKnownRequestError('Not found', { code: 'P2025', clientVersion: 'test' })
          Object.assign(r, data)
          return hydrateRecipe(r, include)
        },
      },
      inventoryItem: {
        findUnique: async ({ where }: { where: { id: string } }) => {
          const row = inv.find(i => i.id === where.id)
          return row ? { ...row } : null
        },
        findMany: async ({
          where,
          include,
        }: {
          where?: { menuItemId?: { in: string[] } }
          include?: { menuItem?: unknown }
        }) => {
          const rows = inv.filter(i => {
            if (where?.menuItemId?.in && !where.menuItemId.in.includes(i.menuItemId ?? '')) return false
            return true
          })
          return rows.map(row => {
            const out: Record<string, unknown> = { ...row }
            if (include?.menuItem) {
              const mi = menuItems.find(m => m.id === row.menuItemId)
              out.menuItem = mi ? { ...mi } : null
            }
            return out
          })
        },
        updateMany: async ({
          where,
          data,
        }: {
          where: { id: string; quantity?: { gte: number } }
          data: { quantity?: { decrement: number } }
        }) => {
          const row = inv.find(i => i.id === where.id)
          if (!row) return { count: 0 }
          if (where.quantity && row.quantity < where.quantity.gte) return { count: 0 } // atomarni guard (FIX P2)
          if (data.quantity?.decrement !== undefined) row.quantity -= data.quantity.decrement
          return { count: 1 }
        },
      },
      stockTransaction: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const d = data as {
            inventoryItemId: string
            type: string
            quantity: number
            previousQty: number
            newQty: number
            costPerUnit: number
            totalCost: number
            reason?: string
            orderId?: string
          }
          const row: StockTxRow = {
            id: id('tx'),
            inventoryItemId: d.inventoryItemId,
            type: d.type,
            quantity: d.quantity,
            previousQty: d.previousQty,
            newQty: d.newQty,
            costPerUnit: d.costPerUnit,
            totalCost: d.totalCost,
            reason: d.reason ?? '',
            orderId: d.orderId,
          }
          stockTx.push(row)
          return { ...row }
        },
      },
      // R120 FEFO stubi: brez serij = no-op alokacija (unbatched preostanek dovoljen)
      inventoryBatch: {
        findMany: async () => [],
        findFirst: async () => null,
        updateMany: async () => ({ count: 1 }),
      },
      stockBatchAllocation: {
        create: async ({ data }: { data: Record<string, unknown> }) => ({ id: 'al-stub', ...data }),
        findMany: async () => [],
      },
    }
  }

  const clients = makeClients()
  const db = { ...clients }

  return {
    db,
    tx: db as unknown as Prisma.TransactionClient,
    menus,
    categories,
    menuItems,
    recipeItems,
    inv,
    stockTx,
  }
}

// vi.hoisted — mock factory se izvede PRED modulskim scope-om
const ref = vi.hoisted(() => ({ current: null as unknown as ReturnType<typeof createDb> }))
ref.current = createDb()

vi.mock('@/lib/db', () => ({
  get db() {
    return ref.current.db
  },
  createAuditLog: async () => undefined,
}))
const requireAuthMock = vi.fn()
vi.mock('@/lib/auth-middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-middleware')>()
  return {
    ...actual,
    requireAuth: (...args: unknown[]) => requireAuthMock(...args),
    // resolveTenantLocationIdOrThrow ostane REALNA (pure) — tenant semantika zares
  }
})

import { GET as recipesGet, POST as recipesPost, PUT as recipesPut } from '@/app/api/recipes/route'
import { deductRecipeItems } from '@/lib/stock-deduction/deduct-recipe'
import { checkStockAvailability } from '@/lib/stock-deduction/check-availability'
import type { StockDeductionItem, StockDeductionResult } from '@/lib/stock-deduction/types'

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
  return new Request('http://localhost:3000/api/recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function put(body: unknown) {
  return new Request('http://localhost:3000/api/recipes', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function get(query = '') {
  return new Request(`http://localhost:3000/api/recipes${query}`)
}

function recipeBody(over: Record<string, unknown> = {}) {
  return { menuItemId: MENU_ID, inventoryItemId: INV_ID, quantityPerServing: 0.2, ...over }
}

function seedInventory() {
  state.inv.push(
    { id: INV_ID, name: 'Goveja mleta', unit: 'kg', quantity: 10, costPerUnit: 8, minQuantity: 2, locationId: LOC_1, menuItemId: null, servingsPerUnit: 0 },
    { id: INV_CHEESE_ID, name: 'Sir chedar', unit: 'kg', quantity: 5, costPerUnit: 10, minQuantity: 1, locationId: LOC_1, menuItemId: null, servingsPerUnit: 0 },
    { id: 'inv-bun', name: 'Burger žemlja', unit: 'kos', quantity: 20, costPerUnit: 0.5, minQuantity: 5, locationId: LOC_1, menuItemId: null, servingsPerUnit: 0 },
  )
}

function addRecipe(opts: {
  menuItemId?: string
  inventoryItemId?: string
  quantityPerServing: number
  yieldPercent: number | null
  unit?: string
}) {
  const row: RecipeRow = {
    id: `ri-${state.recipeItems.length + 1}`,
    menuItemId: opts.menuItemId ?? MENU_ID,
    inventoryItemId: opts.inventoryItemId ?? INV_ID,
    quantityPerServing: opts.quantityPerServing,
    yieldPercent: opts.yieldPercent,
    unit: opts.unit ?? 'kg',
    notes: '',
    createdAt: new Date(),
  }
  state.recipeItems.push(row)
  return row
}

function emptyResult(): StockDeductionResult {
  return { success: true, deducted: [], lowStockAlerts: [], errors: [] }
}

function resetState() {
  state.recipeItems.length = 0
  state.inv.length = 0
  state.stockTx.length = 0
  seedInventory()
}

beforeEach(() => {
  vi.clearAllMocks()
  resetState()
})

// ============================================
// Y-1 POST — yield validacija (fail-closed)
// ============================================
describe('POST /api/recipes — yieldPercent validacija', () => {
  it('yieldPercent 0 → 400, nič ni zapisano', async () => {
    session({ locationId: LOC_1, role: 'admin' })
    const res = await recipesPost(post(recipeBody({ yieldPercent: 0 })))
    expect(res.status).toBe(400)
    expect(state.recipeItems).toHaveLength(0)
  })

  it('yieldPercent 101 → 400', async () => {
    session({ locationId: LOC_1, role: 'admin' })
    const res = await recipesPost(post(recipeBody({ yieldPercent: 101 })))
    expect(res.status).toBe(400)
    expect(state.recipeItems).toHaveLength(0)
  })

  it('yieldPercent 150 → 400 (nad 100 je fizično nemogoč)', async () => {
    session({ locationId: LOC_1, role: 'admin' })
    const res = await recipesPost(post(recipeBody({ yieldPercent: 150 })))
    expect(res.status).toBe(400)
    expect(state.recipeItems).toHaveLength(0)
  })

  it('manjkajoč yieldPercent → default 100 zapisan', async () => {
    session({ locationId: LOC_1, role: 'admin' })
    const res = await recipesPost(post(recipeBody()))
    expect(res.status).toBe(200)
    const created = await res.json()
    expect(created.yieldPercent).toBe(100)
    expect(state.recipeItems[0].yieldPercent).toBe(100)
  })

  it('yieldPercent 85 → 85 zapisan', async () => {
    session({ locationId: LOC_1, role: 'admin' })
    const res = await recipesPost(post(recipeBody({ yieldPercent: 85 })))
    expect(res.status).toBe(200)
    const created = await res.json()
    expect(created.yieldPercent).toBe(85)
    expect(state.recipeItems[0].yieldPercent).toBe(85)
  })
})

// ============================================
// Y-2 PUT — yield posodobitve
// ============================================
describe('PUT /api/recipes — yieldPercent posodobitev', () => {
  it('yieldPercent 50 → posodobljen', async () => {
    const ri = addRecipe({ quantityPerServing: 0.25, yieldPercent: 100 })
    session({ locationId: LOC_1, role: 'admin' })
    const res = await recipesPut(put({ id: ri.id, yieldPercent: 50 }))
    expect(res.status).toBe(200)
    const updated = await res.json()
    expect(updated.yieldPercent).toBe(50)
    expect(state.recipeItems.find(x => x.id === ri.id)?.yieldPercent).toBe(50)
  })

  it('yieldPercent 0 → 400, stara vrednost ostane', async () => {
    const ri = addRecipe({ quantityPerServing: 0.25, yieldPercent: 100 })
    session({ locationId: LOC_1, role: 'admin' })
    const res = await recipesPut(put({ id: ri.id, yieldPercent: 0 }))
    expect(res.status).toBe(400)
    expect(state.recipeItems.find(x => x.id === ri.id)?.yieldPercent).toBe(100)
  })

  it('yieldPercent izpuščen → ohrani staro vrednost (posodobi se le notes)', async () => {
    const ri = addRecipe({ quantityPerServing: 0.25, yieldPercent: 85 })
    session({ locationId: LOC_1, role: 'admin' })
    const res = await recipesPut(put({ id: ri.id, notes: 'brez kože' }))
    expect(res.status).toBe(200)
    const row = state.recipeItems.find(x => x.id === ri.id)
    expect(row?.yieldPercent).toBe(85)
    expect(row?.notes).toBe('brez kože')
  })
})

// ============================================
// Y-3 GET — enriched stroški (yieldAdjustedLineCost + rawFromUsable)
// ============================================
describe('GET /api/recipes — enriched costPerServing / rawQuantityPerServing', () => {
  it('yield 50: costPerServing = 0.5/0.5×10 = 10, rawQuantityPerServing = 1', async () => {
    addRecipe({ inventoryItemId: INV_CHEESE_ID, quantityPerServing: 0.5, yieldPercent: 50 })
    session({ locationId: LOC_1, role: 'admin' })
    const res = await recipesGet(get(`?menuItemId=${MENU_ID}`))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.recipes).toHaveLength(1)
    expect(data.recipes[0].costPerServing).toBe(10)
    expect(data.recipes[0].rawQuantityPerServing).toBe(1)
  })

  it('yield 100 (back-compat): costPerServing = 5, rawQuantityPerServing = 0.5', async () => {
    addRecipe({ inventoryItemId: INV_CHEESE_ID, quantityPerServing: 0.5, yieldPercent: 100 })
    session({ locationId: LOC_1, role: 'admin' })
    const res = await recipesGet(get(`?menuItemId=${MENU_ID}`))
    const data = await res.json()
    expect(data.recipes[0].costPerServing).toBe(5)
    expect(data.recipes[0].rawQuantityPerServing).toBe(0.5)
  })

  it('legacy null yield → tretan kot 100 (obrambni kanon)', async () => {
    addRecipe({ inventoryItemId: INV_CHEESE_ID, quantityPerServing: 0.5, yieldPercent: null })
    session({ locationId: LOC_1, role: 'admin' })
    const res = await recipesGet(get(`?menuItemId=${MENU_ID}`))
    const data = await res.json()
    expect(data.recipes[0].costPerServing).toBe(5)
    expect(data.recipes[0].rawQuantityPerServing).toBe(0.5)
  })
})

// ============================================
// Y-4 DEDUKCIJA — deductRecipeItems (produkcijska funkcija, trap tx)
// ============================================
describe('deductRecipeItems — RAW kanon po yieldu', () => {
  it('yield 50 → deductira 2× quantityPerServing + sale ledger −2×', async () => {
    addRecipe({ quantityPerServing: 0.25, yieldPercent: 50 }) // RAW = 0.5
    const result = emptyResult()
    const items: StockDeductionItem[] = [{ menuItemId: MENU_ID, quantity: 1, voided: false }]
    await deductRecipeItems(state.tx, items, 'ord-1', 42, result)

    expect(result.errors).toHaveLength(0)
    expect(result.success).toBe(true)
    expect(state.inv[0].quantity).toBeCloseTo(9.5, 10) // 10 → 10 − 0.5
    expect(result.deducted[0].inventoryItemId).toBe(INV_ID)
    expect(result.deducted[0].quantityDeducted).toBeCloseTo(0.5, 10) // 2 × 0.25

    const tx = state.stockTx[0]
    expect(tx.type).toBe('sale')
    expect(tx.inventoryItemId).toBe(INV_ID)
    expect(tx.quantity).toBeCloseTo(-0.5, 10) // −2× quantityPerServing
    expect(tx.previousQty).toBe(10)
    expect(tx.newQty).toBeCloseTo(9.5, 10)
    expect(tx.totalCost).toBeCloseTo(0.5 * 8, 8) // RAW × nabavna cena
  })

  it('yield 100 → deductira 1× quantityPerServing (back-compat identiteta)', async () => {
    addRecipe({ quantityPerServing: 0.25, yieldPercent: 100 })
    const result = emptyResult()
    await deductRecipeItems(
      state.tx,
      [{ menuItemId: MENU_ID, quantity: 1, voided: false }],
      'ord-1', 42, result,
    )

    expect(result.errors).toHaveLength(0)
    expect(state.inv[0].quantity).toBeCloseTo(9.75, 10)
    expect(result.deducted[0].quantityDeducted).toBeCloseTo(0.25, 10)
    expect(state.stockTx[0].quantity).toBeCloseTo(-0.25, 10)
  })

  it('naročena količina 2 množi RAW (2 × 0.5 = 1 @ yield 50)', async () => {
    addRecipe({ quantityPerServing: 0.25, yieldPercent: 50 })
    const result = emptyResult()
    await deductRecipeItems(
      state.tx,
      [{ menuItemId: MENU_ID, quantity: 2, voided: false }],
      'ord-1', 42, result,
    )

    expect(result.errors).toHaveLength(0)
    expect(state.inv[0].quantity).toBeCloseTo(9, 10) // 10 − 1
    expect(state.stockTx[0].quantity).toBeCloseTo(-1, 10)
  })

  it('premalo zaloge pri yield 50 → "Premalo zaloge" + success=false, zaloga nespremenjena', async () => {
    addRecipe({ quantityPerServing: 0.25, yieldPercent: 50 }) // potrebno 0.5
    state.inv[0].quantity = 0.4 // manj od potrebnih RAW
    const result = emptyResult()
    await deductRecipeItems(
      state.tx,
      [{ menuItemId: MENU_ID, quantity: 1, voided: false }],
      'ord-1', 42, result,
    )

    expect(result.success).toBe(false)
    expect(result.errors[0].error).toContain('Premalo zaloge')
    expect(state.inv[0].quantity).toBeCloseTo(0.4, 10) // atomarni guard: nič odšteto
    // poskus prodaje se zabeleži z 0 odvodom (sledljivost neuspešnih poskusov)
    expect(state.stockTx).toHaveLength(1)
    expect(state.stockTx[0].type).toBe('sale')
    expect(state.stockTx[0].quantity).toBe(0)
  })

  it('legacy null yield → dedukcija kot yield 100 (obrambni kanon)', async () => {
    addRecipe({ quantityPerServing: 0.25, yieldPercent: null })
    const result = emptyResult()
    await deductRecipeItems(
      state.tx,
      [{ menuItemId: MENU_ID, quantity: 1, voided: false }],
      'ord-1', 42, result,
    )

    expect(result.errors).toHaveLength(0)
    expect(result.deducted[0].quantityDeducted).toBeCloseTo(0.25, 10)
    expect(state.stockTx[0].quantity).toBeCloseTo(-0.25, 10)
  })
})

// ============================================
// Y-5 AVAILABILITY — checkStockAvailability
// ============================================
describe('checkStockAvailability — RAW needed po yieldu', () => {
  it('yield 50 → warnings[0].needed = 2× quantityPerServing', async () => {
    addRecipe({ quantityPerServing: 0.25, yieldPercent: 50 })
    state.inv[0].quantity = 0.4 // manj od potrebnih 0.5 RAW
    const res = await checkStockAvailability([{ menuItemId: MENU_ID, quantity: 1, voided: false }])

    expect(res.available).toBe(false)
    expect(res.warnings).toHaveLength(1)
    expect(res.warnings[0].menuItemId).toBe(MENU_ID)
    expect(res.warnings[0].needed).toBeCloseTo(0.5, 10) // 2 × 0.25
    expect(res.warnings[0].available).toBeCloseTo(0.4, 10)
    expect(res.warnings[0].ingredientName).toBe('Goveja mleta')
    expect(res.warnings[0].unit).toBe('kg')
  })

  it('dovolj zaloge pri yield 50 → available brez opozoril', async () => {
    addRecipe({ quantityPerServing: 0.25, yieldPercent: 50 })
    const res = await checkStockAvailability([{ menuItemId: MENU_ID, quantity: 1, voided: false }])
    expect(res.available).toBe(true)
    expect(res.warnings).toHaveLength(0)
  })
})

// ============================================
// Y-6 INVARIANTA — deduction ↔ availability konsistenca
// ============================================
describe('INVARIANTA: isti yield → needed == deducted', () => {
  it.each([50, 80, 100, null])('yield %s: availability needed == deduction quantityDeducted', async (y) => {
    // 1. availability pri premalo zalogi → warning razkriva needed
    resetState()
    addRecipe({ quantityPerServing: 0.25, yieldPercent: y })
    state.inv[0].quantity = 0.1
    const avail = await checkStockAvailability([{ menuItemId: MENU_ID, quantity: 1, voided: false }])
    expect(avail.warnings).toHaveLength(1)
    const needed = avail.warnings[0].needed

    // 2. deduction pri dovolj zaloge → dejansko deductirana količina
    resetState()
    addRecipe({ quantityPerServing: 0.25, yieldPercent: y })
    const result = emptyResult()
    await deductRecipeItems(
      state.tx,
      [{ menuItemId: MENU_ID, quantity: 1, voided: false }],
      'ord-inv', 7, result,
    )
    expect(result.errors).toHaveLength(0)
    expect(result.deducted).toHaveLength(1)
    // SKLADNOST LEDGER ↔ PREVERJANJA: enaka formula, enak izid
    expect(result.deducted[0].quantityDeducted).toBeCloseTo(needed, 10)
  })
})
