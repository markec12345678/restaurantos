// ============================================
// R124 / EPIC #115 P0-03 — MENU AVAILABILITY KANON (enoten vir resnice)
// ============================================
// Pokritje (P0-03 kanon + §32 minimalni dokaz):
//  • DIREKTNA POT (InventoryItem → MenuItem 1:1): available =
//    floor(quantity × servingsPerUnit); status ok / low (quantity ≤
//    minQuantity) / out (available ≤ 0)
//  • RECEPTNA POT (RecipeItem, R123 RAW semantika): rawPerServing =
//    usable / (yield/100) → možne porcije = floor(zaloga / RAW);
//    yield 100 = back-compat identiteta; recept PREGLASI direktni vnos
//  • NAJSLABŠA SESTAVINA zmaga (min možnih porcij, status out > low)
//  • SCOPE menuItemIds filtrira obe poizvedbi (javni payloadi); artikel
//    brez povezave z zalogo NI v mapi (ne-sleden = vedno na voljo)
//  • effectiveAvailability: združitev stock mape z ročnim 86 flagom
//    (isAvailable=false → 'unavailable', out → 'sold_out', low → 'limited')
//
// Trap DB (hišni stil R123): vi.mock('@/lib/db') z getter + vi.hoisted ref,
// filtroma menuItemId { in } / { not: null }, hydracija recipe.inventoryItem.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const MI_A = 'mi-izdelek-a'
const MI_B = 'mi-izdelek-b'
const MI_C = 'mi-izdelek-c'
const MI_D = 'mi-izdelek-d'
const MI_E = 'mi-izdelek-e'

// ---------- Vrstice ----------
interface InvRow {
  id: string
  name: string
  unit: string
  quantity: number
  minQuantity: number
  servingsPerUnit: number
  menuItemId: string | null
}
interface RecipeRow {
  id: string
  menuItemId: string
  inventoryItemId: string
  quantityPerServing: number
  yieldPercent: number | null // null = legacy vrstica (DB default 100)
}

function createDb() {
  const inv: InvRow[] = []
  const recipes: RecipeRow[] = []
  // Zajem where pogojev — dokaz, da scope filtrira OBE poizvedbi
  const captured = {
    inventoryWhere: [] as unknown[],
    recipeWhere: [] as unknown[],
  }

  function invMatches(row: InvRow, where?: { menuItemId?: unknown }): boolean {
    const mw = where?.menuItemId
    if (mw === undefined) return true
    if (mw === null) return row.menuItemId === null
    if (typeof mw === 'object' && mw !== null) {
      const w = mw as { in?: string[]; not?: string | null }
      if (Array.isArray(w.in) && (row.menuItemId === null || !w.in.includes(row.menuItemId))) return false
      if (w.not === null && row.menuItemId === null) return false
      return true
    }
    return row.menuItemId === mw
  }

  function makeClients() {
    return {
      inventoryItem: {
        findMany: async (args: { where?: { menuItemId?: unknown } }) => {
          captured.inventoryWhere.push(args.where ?? {})
          return inv.filter(i => invMatches(i, args.where)).map(r => ({ ...r }))
        },
      },
      recipeItem: {
        findMany: async (args: { where?: { menuItemId?: { in?: string[] } } }) => {
          captured.recipeWhere.push(args.where ?? {})
          return recipes
            .filter(r => {
              const mw = args.where?.menuItemId
              if (mw && Array.isArray(mw.in) && !mw.in.includes(r.menuItemId)) return false
              return true
            })
            .map(r => {
              const row = inv.find(i => i.id === r.inventoryItemId)
              return { ...r, inventoryItem: row ? { ...row } : null }
            })
        },
      },
    }
  }

  return { db: makeClients(), inv, recipes, captured }
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

import {
  computeMenuStockMap,
  effectiveAvailability,
  type MenuStockEntry,
} from '@/lib/availability/menu-availability'

const state = ref.current

// ---------- Helperji ----------
function addInv(over: Partial<InvRow> & { id: string }) {
  state.inv.push({
    name: 'Sestavina',
    unit: 'kg',
    quantity: 10,
    minQuantity: 0,
    servingsPerUnit: 0,
    menuItemId: null,
    ...over,
  })
}

function addRecipe(o: {
  menuItemId: string
  inventoryItemId: string
  quantityPerServing: number
  yieldPercent?: number | null
}) {
  state.recipes.push({
    id: `ri-${state.recipes.length + 1}`,
    yieldPercent: 100,
    ...o,
  })
}

function resetState() {
  state.inv.length = 0
  state.recipes.length = 0
  state.captured.inventoryWhere.length = 0
  state.captured.recipeWhere.length = 0
}

beforeEach(() => {
  vi.clearAllMocks()
  resetState()
})

// ============================================
// DIREKTNA POT (InventoryItem → MenuItem 1:1)
// ============================================
describe('computeMenuStockMap — direktna pot (1:1 link)', () => {
  it('quantity 5 × servingsPerUnit 2 → available 10, status ok, source direct', async () => {
    addInv({ id: 'inv-a', menuItemId: MI_A, quantity: 5, servingsPerUnit: 2, unit: 'kos', minQuantity: 2 })
    const map = await computeMenuStockMap()
    expect(map[MI_A]).toEqual({ status: 'ok', available: 10, unit: 'kos', source: 'direct' })
  })

  it('quantity 0 → status out, available 0 (izprodano)', async () => {
    addInv({ id: 'inv-a', menuItemId: MI_A, quantity: 0, servingsPerUnit: 2, unit: 'kos', minQuantity: 0 })
    const map = await computeMenuStockMap()
    expect(map[MI_A].status).toBe('out')
    expect(map[MI_A].available).toBe(0)
  })

  it('quantity ≤ minQuantity → status low (omejena količina)', async () => {
    addInv({ id: 'inv-a', menuItemId: MI_A, quantity: 2, servingsPerUnit: 3, unit: 'kos', minQuantity: 2 })
    const map = await computeMenuStockMap()
    expect(map[MI_A].status).toBe('low')
    expect(map[MI_A].available).toBe(6) // 2 × 3 — še vedno pozitivno
  })

  // R124-b FIX (kanon v novem libu): greaterThan(x, 0) namesto decimal.js
  // isPositive (ki je "ne-negativen": isPositive(0) === true). servingsPerUnit 0
  // pade na floor(quantity) — prej je izračunalo 0 × quantity → false 'out'.
  it('servingsPerUnit 0 pade na floor(quantity) (greaterThan fix)', async () => {
    addInv({ id: 'inv-a', menuItemId: MI_A, quantity: 2.7, servingsPerUnit: 0, unit: 'kg', minQuantity: 0 })
    const map = await computeMenuStockMap()
    expect(map[MI_A].available).toBe(2)
    expect(map[MI_A].status).toBe('ok')
  })
})

// ============================================
// RECEPTNA POT (R123 RAW semantika)
// ============================================
describe('computeMenuStockMap — receptna pot (RAW yield semantika)', () => {
  it('recipe qtyPerServing 0.5 @ yield 50 → RAW 1.0 → 3 kg zaloge = 3 porcije (source recipe)', async () => {
    addInv({ id: 'inv-r', quantity: 3, unit: 'kg', minQuantity: 0 })
    addRecipe({ menuItemId: MI_B, inventoryItemId: 'inv-r', quantityPerServing: 0.5, yieldPercent: 50 })
    const map = await computeMenuStockMap()
    expect(map[MI_B]).toEqual({ status: 'ok', available: 3, unit: 'kg', source: 'recipe' })
  })

  it('yield 100 (back-compat) → RAW = usable → 3 kg / 0.5 = 6 porcij', async () => {
    addInv({ id: 'inv-r', quantity: 3, unit: 'kg', minQuantity: 0 })
    addRecipe({ menuItemId: MI_B, inventoryItemId: 'inv-r', quantityPerServing: 0.5, yieldPercent: 100 })
    const map = await computeMenuStockMap()
    expect(map[MI_B].available).toBe(6)
    expect(map[MI_B].source).toBe('recipe')
  })

  it('recipe: zaloga ≤ minQuantity → low (available ostane pozitiven)', async () => {
    addInv({ id: 'inv-low', quantity: 1, unit: 'kg', minQuantity: 1 })
    addRecipe({ menuItemId: MI_B, inventoryItemId: 'inv-low', quantityPerServing: 0.5 })
    const map = await computeMenuStockMap()
    expect(map[MI_B].status).toBe('low')
    expect(map[MI_B].available).toBe(2) // floor(1 / 0.5)
  })

  // R124-b FIX (kanon v novem libu): zaloga TOČNO 0 → 'out' (greaterThan fix).
  // Prej (isPositive footgun): status 'low' namesto 'out' — sold-out propagation
  // bi prodajal artikla z nič zaloge kot "omejeno količino".
  it('recipe zaloga točno 0 → status out po kanonu (možnih porcij ≤ 0)', async () => {
    addInv({ id: 'inv-out', quantity: 0, unit: 'kg', minQuantity: 0 })
    addRecipe({ menuItemId: MI_E, inventoryItemId: 'inv-out', quantityPerServing: 0.5 })
    const map = await computeMenuStockMap()
    expect(map[MI_E].status).toBe('out')
    expect(map[MI_E].available).toBe(0)
  })
})

// ============================================
// PREGLAS + NAJSLABŠA SESTAVINA
// ============================================
describe('computeMenuStockMap — preglas in najslabša sestavina', () => {
  it('recept preglasi direktni vnos, ko obstajata oba (recept = vir resnice za porabo)', async () => {
    addInv({ id: 'inv-direct', menuItemId: MI_C, quantity: 5, servingsPerUnit: 2, unit: 'kos', minQuantity: 0 })
    addInv({ id: 'inv-r', quantity: 2, unit: 'kg', minQuantity: 0 })
    addRecipe({ menuItemId: MI_C, inventoryItemId: 'inv-r', quantityPerServing: 1 })
    const map = await computeMenuStockMap()
    expect(map[MI_C].source).toBe('recipe')
    expect(map[MI_C].available).toBe(2) // ne 10 (direktna vrednost)
    expect(map[MI_C].unit).toBe('kg')
  })

  it('najslabša sestavina določi available (min možnih porcij) + enoti združene', async () => {
    addInv({ id: 'inv-d1', quantity: 10, unit: 'kg', minQuantity: 0 })
    addRecipe({ menuItemId: MI_D, inventoryItemId: 'inv-d1', quantityPerServing: 1 })
    addInv({ id: 'inv-d2', quantity: 3, unit: 'L', minQuantity: 0 })
    addRecipe({ menuItemId: MI_D, inventoryItemId: 'inv-d2', quantityPerServing: 1 })
    const map = await computeMenuStockMap()
    expect(map[MI_D].available).toBe(3) // min(10, 3)
    expect(map[MI_D].status).toBe('ok')
    expect(map[MI_D].unit).toBe('kg/L') // različni enoti združeni (Set deduplika enakih)
  })

  it('ena sestavina pod minQuantity → agregirani status low, četudi je druga dovolj', async () => {
    addInv({ id: 'inv-e1', quantity: 10, unit: 'kg', minQuantity: 0 })
    addRecipe({ menuItemId: MI_E, inventoryItemId: 'inv-e1', quantityPerServing: 1 })
    addInv({ id: 'inv-e2', quantity: 1, unit: 'L', minQuantity: 2 })
    addRecipe({ menuItemId: MI_E, inventoryItemId: 'inv-e2', quantityPerServing: 0.5 })
    const map = await computeMenuStockMap()
    expect(map[MI_E].status).toBe('low') // najslabši status med sestavinami
    expect(map[MI_E].available).toBe(2) // min(10, floor(1 / 0.5))
    expect(map[MI_E].unit).toBe('kg/L')
  })
})

// ============================================
// SCOPE + NE-SLEDENI ARTIKLI
// ============================================
describe('computeMenuStockMap — scope menuItemIds', () => {
  it('menuItemIds filtrira OBE poizvedbi (inventoryItem + recipeItem)', async () => {
    addInv({ id: 'inv-a', menuItemId: MI_A, quantity: 5, servingsPerUnit: 2, unit: 'kos', minQuantity: 0 })
    addInv({ id: 'inv-r', quantity: 3, unit: 'kg', minQuantity: 0 })
    addRecipe({ menuItemId: MI_B, inventoryItemId: 'inv-r', quantityPerServing: 0.5 })
    const map = await computeMenuStockMap({ menuItemIds: [MI_A] })
    expect(state.captured.inventoryWhere[0]).toEqual({ menuItemId: { in: [MI_A] } })
    expect(state.captured.recipeWhere[0]).toEqual({ menuItemId: { in: [MI_A] } })
    expect(Object.keys(map)).toEqual([MI_A]) // MI_B (recept) je izven scope-a
  })

  it('brez scope-a: inventory poizvedba po { not: null }, receptna brez filtra', async () => {
    addInv({ id: 'inv-a', menuItemId: MI_A, quantity: 5, servingsPerUnit: 2, unit: 'kos', minQuantity: 0 })
    await computeMenuStockMap()
    expect(state.captured.inventoryWhere[0]).toEqual({ menuItemId: { not: null } })
    expect(state.captured.recipeWhere[0]).toEqual({})
  })

  it('artikel brez recepture in brez direktnega linka NI v mapi (ne-sleden = vedno na voljo)', async () => {
    addInv({ id: 'inv-a', menuItemId: MI_A, quantity: 5, servingsPerUnit: 2, unit: 'kos', minQuantity: 0 })
    const map = await computeMenuStockMap({ menuItemIds: ['mi-ne-sleden'] })
    expect(map).toEqual({})
  })
})

// ============================================
// EFFECTIVE AVAILABILITY (86 flag + stock mapa)
// ============================================
describe('effectiveAvailability — združitev stock mape z ročnim flagom', () => {
  const entry = (status: MenuStockEntry['status']): MenuStockEntry => ({
    status,
    available: status === 'out' ? 0 : 5,
    unit: 'kg',
    source: 'recipe',
  })

  it('brez stock vnosa + isAvailable true → in_stock (ne-sleden artikel)', () => {
    expect(effectiveAvailability(undefined, true)).toBe('in_stock')
  })

  it('status out + isAvailable true → sold_out', () => {
    expect(effectiveAvailability(entry('out'), true)).toBe('sold_out')
  })

  it('status low + isAvailable true → limited', () => {
    expect(effectiveAvailability(entry('low'), true)).toBe('limited')
  })

  it('status ok + isAvailable true → in_stock', () => {
    expect(effectiveAvailability(entry('ok'), true)).toBe('in_stock')
  })

  it('isAvailable false → unavailable (ročni 86 premaga vsak status)', () => {
    expect(effectiveAvailability(undefined, false)).toBe('unavailable')
    expect(effectiveAvailability(entry('ok'), false)).toBe('unavailable')
    expect(effectiveAvailability(entry('low'), false)).toBe('unavailable')
    expect(effectiveAvailability(entry('out'), false)).toBe('unavailable')
  })
})
