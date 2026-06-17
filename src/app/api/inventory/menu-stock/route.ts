
// GET /api/inventory/menu-stock — Hitri pregled zaloge za meni artikle (za POS indikatorje)
// Vrne mapo menuItemId → { status, available, unit } za prikaz na POS zaslonu
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { toNum, isPositive, greaterThan, multiply, divide } from '@/lib/decimal'
import { handleApiError } from '@/lib/api-utils'


export async function GET(req: Request) {
  try {
    // Auth check — requires manage_inventory permission
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    // Pridobi vse inventarne artikle s povezavo na meni
    const inventoryItems = await db.inventoryItem.findMany({
      where: { menuItemId: { not: null } },
      select: {
        id: true,
        name: true,
        quantity: true,
        minQuantity: true,
        unit: true,
        servingsPerUnit: true,
        menuItemId: true,
      },
    })

    // Pridobi vse receptne sestavine
    const recipeItems = await db.recipeItem.findMany({
      select: {
        menuItemId: true,
        inventoryItemId: true,
        quantityPerServing: true,
        inventoryItem: {
          select: {
            id: true,
            quantity: true,
            minQuantity: true,
            unit: true,
          },
        },
      },
    })

    // Zgradi mapo po menuItemId
    const stockMap: Record<string, {
      status: 'ok' | 'low' | 'out'
      available: number
      unit: string
      source: 'direct' | 'recipe'
    }> = {}

    // 1. Direktne povezave (InventoryItem → MenuItem)
    for (const inv of inventoryItems) {
      if (!inv.menuItemId) continue

      const availableServings = isPositive(inv.servingsPerUnit)
        ? Math.floor(toNum(multiply(inv.quantity, inv.servingsPerUnit)))
        : Math.floor(toNum(inv.quantity))

      let status: 'ok' | 'low' | 'out' = 'ok'
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
    const recipeByMenuItem = new Map<string, typeof recipeItems>()
    for (const r of recipeItems) {
      if (!recipeByMenuItem.has(r.menuItemId)) {
        recipeByMenuItem.set(r.menuItemId, [])
      }
      recipeByMenuItem.get(r.menuItemId)!.push(r)
    }

    for (const [menuItemId, recipes] of recipeByMenuItem) {
      let minServings = Infinity
      let worstStatus: 'ok' | 'low' | 'out' = 'ok'
      const units = new Set<string>()

      for (const recipe of recipes) {
        const inv = recipe.inventoryItem
        units.add(inv.unit)

        if (toNum(recipe.quantityPerServing) <= 0) continue

        const possibleServings = Math.floor(toNum(divide(inv.quantity, recipe.quantityPerServing)))
        minServings = Math.min(minServings, possibleServings)

        if (!isPositive(inv.quantity)) worstStatus = 'out'
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

    return NextResponse.json(stockMap)
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/inventory/menu-stock', 'Napaka pri pridobivanju zaloge menija')
  }
}
