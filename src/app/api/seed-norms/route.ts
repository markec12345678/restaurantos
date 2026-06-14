// =====================================================================
// SEED NORMATIVOV - Inventarne postavke + Recepti za pijače
// =====================================================================
// Ta endpoint doda obsežen inventar sestavin pijač in recepture (normative)
// za vse standardne pijace v barih, restavracijah in lokalih.
// Uporabnik mora samo vnesti svoje količine zaloge in lahko začne delati.
// =====================================================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { checkRateLimit, getClientIp, SEED_LIMIT } from '@/lib/rate-limit'
import { createBeverageInventory } from './helpers/create-beverage-inventory'
import { createFoodInventory } from './helpers/create-food-inventory'
import { buildSpiritsRecipes } from './helpers/build-spirits-recipes'
import { buildWineBeerRecipes } from './helpers/build-wine-beer-recipes'
import { buildFoodRecipes } from './helpers/build-food-recipes'
import { buildRestorantosRecipes } from './helpers/build-restorantos-recipes'
import type { MiFn, RecipeEntry } from './helpers/types'

export async function POST(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = checkRateLimit('seed-norms', getClientIp(req), SEED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    // Pobriši stare inventarne postavke in recepte
    await db.recipeItem.deleteMany()
    await db.inventoryItem.deleteMany()

    // Pridobi vse menu iteme za mapiranje po imenu
    const menuItems = await db.menuItem.findMany()
    const menuByName = new Map<string, typeof menuItems[0]>()
    for (const m of menuItems) {
      menuByName.set(m.name, m)
    }

    // Helper funkcija za iskanje menu itema po imenu
    const mi: MiFn = (name: string) => menuByName.get(name)

    // =====================================================================
    // 1. USTVARI INVENTARNE POSTAVKE - Pijače in sestavine
    // =====================================================================
    const bevInv = await createBeverageInventory()

    // =====================================================================
    // 2. ZGRADI RECEPTE - Pijače in hrana
    // =====================================================================
    const recipes: RecipeEntry[] = []
    recipes.push(...buildSpiritsRecipes(bevInv, mi))
    recipes.push(...buildWineBeerRecipes(bevInv, mi))
    recipes.push(...buildFoodRecipes(bevInv, mi))

    // =====================================================================
    // 3. SHRANI RECEPTE V BAZO
    // =====================================================================
    let createdCount = 0
    const errors: string[] = []

    for (const recipe of recipes) {
      const menuItem = mi(recipe.menuItemName)
      if (!menuItem) {
        errors.push(`Menu item "${recipe.menuItemName}" ni bil najden`)
        continue
      }
      try {
        await db.recipeItem.create({
          data: {
            menuItemId: menuItem.id,
            inventoryItemId: recipe.ingredientId,
            quantityPerServing: recipe.quantityPerServing,
            unit: recipe.unit,
            notes: recipe.notes || '',
          }
        })
        createdCount++
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e)
        if (!errMsg.includes('Unique')) {
          errors.push(`Napaka pri "${recipe.menuItemName}": ${errMsg}`)
        }
      }
    }

    // =====================================================================
    // 4. USTVARI INVENTARNE POSTAVKE ZA HRANO - RestorantOS
    // =====================================================================
    const foodInv = await createFoodInventory()

    // Združi inventarne postavke za referenco
    const allInv = { ...bevInv, ...foodInv }

    // =====================================================================
    // 5. ZGRADI IN SHRANI RECEPTE ZA HRANO - RestorantOS
    // =====================================================================
    const foodRecipes = buildRestorantosRecipes(allInv)

    for (const recipe of foodRecipes) {
      const menuItem = mi(recipe.menuItemName)
      if (!menuItem) {
        errors.push(`HRANA: Menu item "${recipe.menuItemName}" ni bil najden`)
        continue
      }
      try {
        await db.recipeItem.create({
          data: {
            menuItemId: menuItem.id,
            inventoryItemId: recipe.ingredientId,
            quantityPerServing: recipe.quantityPerServing,
            unit: recipe.unit,
            notes: recipe.notes || '',
          }
        })
        createdCount++
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e)
        if (!errMsg.includes('Unique')) {
          errors.push(`HRANA: Napaka pri "${recipe.menuItemName}": ${errMsg}`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Normativi uspešno naloženi! ${createdCount} receptov ustvarjenih (vključno s hrano).`,
      stats: {
        inventoryItems: await db.inventoryItem.count(),
        recipeItems: await db.recipeItem.count(),
        menuItemsWithRecipe: (await db.recipeItem.groupBy({ by: ['menuItemId'] })).length,
      },
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/seed-norms', 'Napaka pri nalaganju normativov')
  }
}
