// ============================================
// R124 (epic #115, P0-03): ENOTEN AVAILABILITY KANON
// ============================================
// Edini vir resnice za sold-out propagation čez kanale:
//   POS (menu-stock indikatorji) → QR meni (public/menu) → kiosk → online
//
// Kanonske zahteve P0-03:
//   - POS kaže sold-out ⇒ QR ne sme sprejemati naročil za isti artikel
//   - availability map MORA biti skladen z DEDUKCIJO zaloge (invarianta
//     R123: needed == deducted) — zato se računa nad ISTIMI vrsticami,
//     ki jih odšteje deductInventoryInTx / deduct-recipe (recipe vrstice
//     + direktni 1:1 link, brez lokacijskega filtra)
//
// Statusna semantika (back-compat z obstoječim POS stockMap):
//   'ok'   = na zalogi (vse sestavine nad minQuantity)
//   'low'  = omejena količina (katera sestavina ≤ minQuantity)
//   'out'  = izprodano (možnih porcij ≤ 0)
//
// R123 (P0-05): RAW semantika — možne porcije = floor(quantity / rawPerServing)
// kjer rawPerServing = quantityPerServing / (yieldPercent / 100).
//
// Artikli BREZ recepture in BREZ direktnega povezave z zalogo NISO v mapi
// (ne-sledeni artikli so vedno "na voljo" — ista semantika kot check-availability,
// ki za njih ne vrne opozoril).

import { db } from '../db'
import { toNum, greaterThan, multiply, divide } from '../decimal'
import { rawFromUsable } from '../recipes/yield'

export type MenuStockStatus = 'ok' | 'low' | 'out'
export type MenuStockSource = 'direct' | 'recipe'

export interface MenuStockEntry {
  status: MenuStockStatus
  /** Možne porcije (floor, najslabša sestavina) oz. servisi pri direktnem linku */
  available: number
  unit: string
  source: MenuStockSource
}

export type MenuStockMap = Record<string, MenuStockEntry>

/**
 * Izračunaj stock map za meni artikle.
 *
 * @param opts.menuItemIds — opcionalen scope na konkretne artikle (javni
 *   payloadi: QR meni, kiosk). Brez scope-a = vsi artikli s povezavo na
 *   zalogo (POS menu-stock endpoint).
 */
export async function computeMenuStockMap(opts?: {
  menuItemIds?: string[]
}): Promise<MenuStockMap> {
  const idScope = opts?.menuItemIds?.length
    ? { menuItemId: { in: opts.menuItemIds } }
    : { menuItemId: { not: null } }

  const [inventoryItems, recipeItems] = await Promise.all([
    db.inventoryItem.findMany({
      where: idScope,
      select: {
        id: true,
        name: true,
        quantity: true,
        minQuantity: true,
        unit: true,
        servingsPerUnit: true,
        menuItemId: true,
      },
    }),
    db.recipeItem.findMany({
      where: opts?.menuItemIds?.length ? { menuItemId: { in: opts.menuItemIds } } : {},
      select: {
        menuItemId: true,
        inventoryItemId: true,
        quantityPerServing: true,
        yieldPercent: true,
        inventoryItem: {
          select: {
            id: true,
            quantity: true,
            minQuantity: true,
            unit: true,
          },
        },
      },
    }),
  ])

  const stockMap: MenuStockMap = {}

  // 1. Direktne povezave (InventoryItem → MenuItem 1:1)
  for (const inv of inventoryItems) {
    if (!inv.menuItemId) continue

    // R124-b fix: greaterThan(x, 0) namesto isPositive — decimal.js
    // isPositive(0) === true ("ne-negativen")! servingsPerUnit 0 mora pasti
    // na floor(quantity), ne izračunati 0 × quantity.
    const availableServings = greaterThan(inv.servingsPerUnit, 0)
      ? Math.floor(toNum(multiply(inv.quantity, inv.servingsPerUnit)))
      : Math.floor(toNum(inv.quantity))

    let status: MenuStockStatus = 'ok'
    if (availableServings <= 0) status = 'out'
    else if (!greaterThan(inv.quantity, inv.minQuantity)) status = 'low'

    stockMap[inv.menuItemId] = {
      status,
      available: availableServings,
      unit: inv.unit,
      source: 'direct',
    }
  }

  // 2. Receptne povezave (RecipeItem) — preglasijo direktne če obstajajo
  //    (ista semantika kot deduct-recipe: recept je vir resnice za porabo)
  const recipeByMenuItem = new Map<string, typeof recipeItems>()
  for (const r of recipeItems) {
    if (!recipeByMenuItem.has(r.menuItemId)) {
      recipeByMenuItem.set(r.menuItemId, [])
    }
    recipeByMenuItem.get(r.menuItemId)!.push(r)
  }

  for (const [menuItemId, recipes] of recipeByMenuItem) {
    let minServings = Infinity
    let worstStatus: MenuStockStatus = 'ok'
    const units = new Set<string>()

    for (const recipe of recipes) {
      const inv = recipe.inventoryItem
      units.add(inv.unit)

      // R123 (P0-05): možne porcije glede na RAW potrebo (usable / yield%)
      const rawPerServing = rawFromUsable(toNum(recipe.quantityPerServing), toNum(recipe.yieldPercent))
      if (rawPerServing <= 0) continue

      const possibleServings = Math.floor(toNum(divide(inv.quantity, rawPerServing)))
      minServings = Math.min(minServings, possibleServings)

      // R124-b fix: greaterThan(namesto isPositive) — zaloga TOČNO 0 je
      // 'out' (kanon: 'out' = možnih porcij ≤ 0), ne 'low'
      if (!greaterThan(inv.quantity, 0)) worstStatus = 'out'
      else if (!greaterThan(inv.quantity, inv.minQuantity)) worstStatus = worstStatus === 'out' ? 'out' : 'low'
    }

    if (minServings === Infinity) minServings = 0

    stockMap[menuItemId] = {
      status: worstStatus,
      available: minServings,
      unit: Array.from(units).join('/'),
      source: 'recipe',
    }
  }

  return stockMap
}

/**
 * R124 (P0-03): Združi stock map z ročnim 86 flagom (MenuItem.isAvailable)
 * v učinkovit status za javne kanale:
 *   'in_stock'    — na zalogi
 *   'limited'     — omejena količina (status 'low' + available count)
 *   'sold_out'    — izprodano (status 'out')
 *   'unavailable' — ročno označen kot nedobavljiv (86 — skrit v meniju)
 *
 * Opomba: artikli, ki jih NI v stock map, so ne-sledeni ⇒ 'in_stock'
 * (ista semantika kot check-availability: brez povezave = brez opozoril).
 */
export type EffectiveAvailability = 'in_stock' | 'limited' | 'sold_out' | 'unavailable'

export function effectiveAvailability(
  stockEntry: MenuStockEntry | undefined,
  isAvailable: boolean,
): EffectiveAvailability {
  if (!isAvailable) return 'unavailable'
  if (!stockEntry) return 'in_stock'
  if (stockEntry.status === 'out') return 'sold_out'
  if (stockEntry.status === 'low') return 'limited'
  return 'in_stock'
}
