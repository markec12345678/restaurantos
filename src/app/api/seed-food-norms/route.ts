// =====================================================================
// SEED NORMATIVOV HRANE - Inventarne postavke + Recepti za hrano
// Podatki iz kombinacije Gostilna Pod Lipco + Favola restavracija
// =====================================================================
// Ta endpoint doda obsežen inventar sestavin hrane in recepture (normative)
// za vse standardne jedi v slovenskih restavracijah in gostilnah.
// NE briše obstoječih inventarnih postavk pijač - samo doda hrano.
// =====================================================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { checkRateLimit, getClientIp, SEED_LIMIT } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/api-utils'
import { createFoodInventoryItems } from './helpers/create-inventory'
import { seedFoodPart1 } from './helpers/seed-food-part1'
import { seedFoodPart2 } from './helpers/seed-food-part2'
import type { CatMap } from './helpers/types'


export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = checkRateLimit('seed-food-norms', getClientIp(req), SEED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    // Pridobi obstoječe menije in kategorije
    const menus = await db.menu.findMany()
    const menuHrana = menus.find(m => m.name === 'Hrana')
    const menuPijaca = menus.find(m => m.name === 'Pijača')
    const menuId = menuHrana?.id || menuPijaca?.id || menus[0]?.id

    if (!menuId) {
      return NextResponse.json({ error: 'Ni menija v bazi. Najprej poženi /api/seed' }, { status: 400 })
    }

    // Pridobi obstoječe kategorije
    const existingCats = await db.category.findMany({ where: { menuId } })
    const catByName = new Map<string, typeof existingCats[0]>()
    for (const c of existingCats) catByName.set(c.name, c)

    // Helper: poišči ali ustvari kategorijo
    const getOrCreateCat = async (name: string, icon: string, color: string, sortOrder: number) => {
      const existing = catByName.get(name)
      if (existing) return existing
      const cat = await db.category.create({ data: { name, icon, color, sortOrder, menuId } })
      catByName.set(name, cat)
      return cat
    }

    // =====================================================================
    // USTVARI KATEGORIJE ZA HRANO
    // =====================================================================
    const catPredjedi = await getOrCreateCat('Predjedi', '🥗', '#10b981', 0)
    const catJuhe = await getOrCreateCat('Juhe', '🍲', '#f59e0b', 1)
    const catTestenine = await getOrCreateCat('Testenine', '🍝', '#ef4444', 2)
    const catRizote = await getOrCreateCat('Rižote', '🍚', '#8b5cf6', 3)
    const catMesneJedi = await getOrCreateCat('Glavne jedi', '🥩', '#dc2626', 4)
    const catZar = await getOrCreateCat('Jedi z žara', '🔥', '#ea580c', 5)
    const catBurgerji = await getOrCreateCat('Burgerji', '🍔', '#b91c1c', 6)
    const catRibjeJedi = await getOrCreateCat('Ribje jedi', '🐟', '#0ea5e9', 7)
    const catPice = await getOrCreateCat('Pice', '🍕', '#e11d48', 8)
    const catSolate = await getOrCreateCat('Solate', '🥬', '#22c55e', 9)
    const catPriloge = await getOrCreateCat('Priloge', '🥔', '#a16207', 10)
    const catSladice = await getOrCreateCat('Sladice', '🍰', '#ec4899', 11)
    const catOtroški = await getOrCreateCat('Otroški meni', '🧒', '#6366f1', 12)

    const cat: CatMap = {
      catPredjedi, catJuhe, catTestenine, catRizote, catMesneJedi,
      catZar, catBurgerji, catRibjeJedi, catPice, catSolate,
      catPriloge, catSladice, catOtroški
    }

    // =====================================================================
    // 1. INVENTARNE POSTAVKE - Sestavine hrane
    // =====================================================================
    const inv = await createFoodInventoryItems()

    // =====================================================================
    // 2. MENU ITEMS + RECIPE ITEMS
    // =====================================================================
    await seedFoodPart1(inv, cat)
    await seedFoodPart2(inv, cat)

    // Get references to items created by beverage seed (if they exist)
    const existingKavnaZrna = await db.inventoryItem.findFirst({ where: { name: { contains: 'Kavna zrna' } } })
    const existingCokolada = await db.inventoryItem.findFirst({ where: { name: { contains: 'Čokolada za vročo' } } })
    const existingSladkor = await db.inventoryItem.findFirst({ where: { name: { contains: 'Sladkor' } } })
    const existingMed = await db.inventoryItem.findFirst({ where: { name: { contains: 'Med' } } })

    const menuItems = await db.menuItem.findMany()
    const menuByName = new Map<string, typeof menuItems[0]>()
    for (const mi of menuItems) menuByName.set(mi.name, mi)

    // Update tiramisu with coffee if available
    if (existingKavnaZrna) {
      const tiramisu = menuByName.get('Tiramisu')
      if (tiramisu) {
        await db.recipeItem.upsert({
          where: { menuItemId_inventoryItemId: { menuItemId: tiramisu.id, inventoryItemId: existingKavnaZrna.id } },
          create: { menuItemId: tiramisu.id, inventoryItemId: existingKavnaZrna.id, quantityPerServing: 0.01, unit: 'kg' },
          update: { quantityPerServing: 0.01, unit: 'kg' }
        })
      }
    }

    // Update lava cake with chocolate if available
    if (existingCokolada) {
      const lavaCake = menuByName.get('Lava cake')
      if (lavaCake) {
        await db.recipeItem.upsert({
          where: { menuItemId_inventoryItemId: { menuItemId: lavaCake.id, inventoryItemId: existingCokolada.id } },
          create: { menuItemId: lavaCake.id, inventoryItemId: existingCokolada.id, quantityPerServing: 0.06, unit: 'kg' },
          update: { quantityPerServing: 0.06, unit: 'kg' }
        })
      }
    }

    // Update creme brulee with sugar if available
    if (existingSladkor) {
      const brulee = menuByName.get('Limonin creme brulee')
      if (brulee) {
        await db.recipeItem.upsert({
          where: { menuItemId_inventoryItemId: { menuItemId: brulee.id, inventoryItemId: existingSladkor.id } },
          create: { menuItemId: brulee.id, inventoryItemId: existingSladkor.id, quantityPerServing: 0.02, unit: 'kg' },
          update: { quantityPerServing: 0.02, unit: 'kg' }
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Seed hrane uspešno dodan!`,
      stats: {
        inventoryItemsCreated: await db.inventoryItem.count(),
        foodItemsCreated: await db.menuItem.count(),
        categoriesCreated: [...catByName.keys()].filter(k => !existingCats.find(c => c.name === k)).length,
      }
    })

  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/seed-food-norms', 'Napaka pri seedu hrane')
  }
}
