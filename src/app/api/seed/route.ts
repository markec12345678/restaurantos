
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { toNum, round2 } from '@/lib/decimal'
import { handleApiError } from '@/lib/api-utils'
import { checkRateLimit, getClientIp, SEED_LIMIT } from '@/lib/rate-limit'
import { getMenuItemsData } from './helpers/menu-items'
import { seedAllConfig } from './helpers/config-data'
import { seedDemoData } from './helpers/demo-data'

export async function POST(req: Request) {
  try {
    // FIX C-01: Zahtevaj admin avtentikacijo za seed
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    // FIX: Omejitev hitrosti — seed je destruktiven, omejimo na 3x na uro
    const ip = getClientIp(req)
    const rateLimit = checkRateLimit('seed', ip, SEED_LIMIT)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Preveč zahtevkov. Seed je omejen na 3 zahtevke na uro.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.retryAfterMs || 3600000) / 1000)) } }
      )
    }
    // Clean up existing data (respecting foreign keys)
    await db.orderItem.deleteMany()
    await db.order.deleteMany()
    await db.shift.deleteMany()
    await db.inventoryItem.deleteMany()
    await db.menuItemModifierGroup.deleteMany()
    await db.modifier.deleteMany()
    await db.modifierGroup.deleteMany()
    await db.menuItem.deleteMany()
    await db.category.deleteMany()
    await db.menu.deleteMany()
    await db.table.deleteMany()
    await db.employee.deleteMany()
    // Configuration tables (respecting foreign keys: DiningOption → ServiceCharge)
    await db.diningOption.deleteMany()
    await db.serviceCharge.deleteMany()
    await db.taxRate.deleteMany()
    await db.revenueCenter.deleteMany()
    await db.salesCategory.deleteMany()
    await db.priceGroup.deleteMany()
    await db.prepStation.deleteMany()
    await db.voidReason.deleteMany()
    await db.noSaleReason.deleteMany()
    await db.alternatePaymentType.deleteMany()
    await db.discount.deleteMany()
    await db.printer.deleteMany()
    await db.webhook.deleteMany()
    await db.job.deleteMany()

    // ============================================
    // MENIJI (Menu - top level)
    // ============================================
    const [foodMenu, drinksMenu] = await Promise.all([
      db.menu.create({ data: { name: 'Hrana', icon: '🍽️', color: '#f59e0b', sortOrder: 0 } }),
      db.menu.create({ data: { name: 'Pijača', icon: '🥤', color: '#3b82f6', sortOrder: 1 } }),
    ])

    // ============================================
    // KATEGORIJE (pod meniji)
    // ============================================
    // Hrana kategorije - RestorantOS
    const [hladnePredjedi, toplePredjedi, juhe, glavneJedi, testenine, rizote, kalamari, ribjeJedi, solate, pizza, burgerji, vegetarijanske, palacinke, sladice, outroskeJedi, malice, priloge, omake] = await Promise.all([
      db.category.create({ data: { name: 'Hladne predjedi', icon: '🥗', color: '#10b981', sortOrder: 0, menuId: foodMenu.id } }),
      db.category.create({ data: { name: 'Tople predjedi', icon: '🍲', color: '#f97316', sortOrder: 1, menuId: foodMenu.id } }),
      db.category.create({ data: { name: 'Juhe', icon: '🥣', color: '#a78bfa', sortOrder: 2, menuId: foodMenu.id } }),
      db.category.create({ data: { name: 'Glavne jedi', icon: '🥩', color: '#ef4444', sortOrder: 3, menuId: foodMenu.id } }),
      db.category.create({ data: { name: 'Testenine, njoki', icon: '🍝', color: '#eab308', sortOrder: 4, menuId: foodMenu.id } }),
      db.category.create({ data: { name: 'Rižote', icon: '🍚', color: '#a3e635', sortOrder: 5, menuId: foodMenu.id } }),
      db.category.create({ data: { name: 'Kalamari', icon: '🦑', color: '#6366f1', sortOrder: 6, menuId: foodMenu.id } }),
      db.category.create({ data: { name: 'Ribje jedi', icon: '🐟', color: '#0ea5e9', sortOrder: 7, menuId: foodMenu.id } }),
      db.category.create({ data: { name: 'Solate', icon: '🥬', color: '#22c55e', sortOrder: 8, menuId: foodMenu.id } }),
      db.category.create({ data: { name: 'Pizze', icon: '🍕', color: '#8b5cf6', sortOrder: 9, menuId: foodMenu.id } }),
      db.category.create({ data: { name: 'Burgerji', icon: '🍔', color: '#ec4899', sortOrder: 10, menuId: foodMenu.id } }),
      db.category.create({ data: { name: 'Vegetarijanske jedi', icon: '🥦', color: '#14b8a6', sortOrder: 11, menuId: foodMenu.id } }),
      db.category.create({ data: { name: 'Palačinke', icon: '🥞', color: '#f59e0b', sortOrder: 12, menuId: foodMenu.id } }),
      db.category.create({ data: { name: 'Sladice', icon: '🍰', color: '#06b6d4', sortOrder: 13, menuId: foodMenu.id } }),
      db.category.create({ data: { name: 'Otroške jedi', icon: '🧒', color: '#a78bfa', sortOrder: 14, menuId: foodMenu.id } }),
      db.category.create({ data: { name: 'Malice', icon: '📋', color: '#059669', sortOrder: 15, menuId: foodMenu.id } }),
      db.category.create({ data: { name: 'Priloge', icon: '🍟', color: '#84cc16', sortOrder: 16, menuId: foodMenu.id } }),
      db.category.create({ data: { name: 'Omake', icon: '🫙', color: '#dc2626', sortOrder: 17, menuId: foodMenu.id } }),
    ])

    // Pijača kategorije (Wine Card & Drinks Price List)
    const drinkCategories = await Promise.all([
      db.category.create({ data: { name: 'Penine in Šampanjci', icon: '🥂', color: '#f59e0b', sortOrder: 0, menuId: drinksMenu.id } }),
      db.category.create({ data: { name: 'Bela Vina', icon: '🥂', color: '#fbbf24', sortOrder: 1, menuId: drinksMenu.id } }),
      db.category.create({ data: { name: 'Rosé Vino', icon: '🌸', color: '#f472b6', sortOrder: 2, menuId: drinksMenu.id } }),
      db.category.create({ data: { name: 'Rdeča Vina', icon: '🍷', color: '#7c2d12', sortOrder: 3, menuId: drinksMenu.id } }),
      db.category.create({ data: { name: 'Tuja Vina', icon: '🌍', color: '#6366f1', sortOrder: 4, menuId: drinksMenu.id } }),
      db.category.create({ data: { name: 'Likersko Vino', icon: '🍷', color: '#a855f7', sortOrder: 5, menuId: drinksMenu.id } }),
      db.category.create({ data: { name: 'Točeno Pivo', icon: '🍺', color: '#d97706', sortOrder: 6, menuId: drinksMenu.id } }),
      db.category.create({ data: { name: 'Pivo', icon: '🍻', color: '#ea580c', sortOrder: 7, menuId: drinksMenu.id } }),
      db.category.create({ data: { name: 'Craft Piva', icon: '🍻', color: '#65a30d', sortOrder: 8, menuId: drinksMenu.id } }),
      db.category.create({ data: { name: 'Brezalkoholno Pivo', icon: '🍺', color: '#14b8a6', sortOrder: 9, menuId: drinksMenu.id } }),
      db.category.create({ data: { name: 'Viski', icon: '🥃', color: '#92400e', sortOrder: 10, menuId: drinksMenu.id } }),
      db.category.create({ data: { name: 'Gin', icon: '🍸', color: '#0ea5e9', sortOrder: 11, menuId: drinksMenu.id } }),
      db.category.create({ data: { name: 'Likerji', icon: '🍹', color: '#a855f7', sortOrder: 12, menuId: drinksMenu.id } }),
      db.category.create({ data: { name: 'Grenčice', icon: '🫒', color: '#4d7c0f', sortOrder: 13, menuId: drinksMenu.id } }),
      db.category.create({ data: { name: 'Destilati, Konjak in Rum', icon: '🥃', color: '#6b21a8', sortOrder: 14, menuId: drinksMenu.id } }),
      db.category.create({ data: { name: 'Topli Napitki', icon: '☕', color: '#92400e', sortOrder: 15, menuId: drinksMenu.id } }),
      db.category.create({ data: { name: 'Mešane Pijače', icon: '🍹', color: '#ec4899', sortOrder: 16, menuId: drinksMenu.id } }),
      db.category.create({ data: { name: 'Vode', icon: '💧', color: '#0ea5e9', sortOrder: 17, menuId: drinksMenu.id } }),
      db.category.create({ data: { name: 'Naravni Sokovi', icon: '🧃', color: '#84cc16', sortOrder: 18, menuId: drinksMenu.id } }),
      db.category.create({ data: { name: 'Sokovi', icon: '🧃', color: '#22c55e', sortOrder: 19, menuId: drinksMenu.id } }),
      db.category.create({ data: { name: 'Gazirane Pijače', icon: '🥤', color: '#ef4444', sortOrder: 20, menuId: drinksMenu.id } }),
    ])

    const [penine, belaVina, roseVino, rdecaVina, tujaVina, likerskoVino,
      tocenoPivo, pivo, craftPiva, brezalkPivo, viski, gin, likerji,
      grencice, destilati, topliNapitki, mesanePijace, vode, naravniSokovi, sokovi, gaziranePijace
    ] = drinkCategories

    // ============================================
    // MODIFIER SKUPINE (skupne, se delijo med artikli)
    // ============================================
    const [cookingLevel, sideChoice, sauceChoice, cheeseChoice, milkChoice, sweetenerChoice, alcoholAdd, pizzaSize, burgerSize, iceChoice] = await Promise.all([
      // Način pečenja - za zrezke
      db.modifierGroup.create({ data: { name: 'Način pečenja', required: true, minSelect: 1, maxSelect: 1, sortOrder: 0, modifiers: { create: [
        { name: 'Srednje redko', price: 0, sortOrder: 0 },
        { name: 'Srednje', price: 0, sortOrder: 1 },
        { name: 'Srednje pečeno', price: 0, sortOrder: 2 },
        { name: 'Dobro pečeno', price: 0, sortOrder: 3 },
      ] } } }),
      // Priloga - za glavne jedi
      db.modifierGroup.create({ data: { name: 'Priloga', required: false, minSelect: 0, maxSelect: 2, sortOrder: 1, modifiers: { create: [
        { name: 'Pomfri', price: 0, sortOrder: 0 },
        { name: 'Pečen krompir', price: 0, sortOrder: 1 },
        { name: 'Solata', price: 0, sortOrder: 2 },
        { name: 'Zelenjavna priloga', price: 0, sortOrder: 3 },
        { name: 'Riž', price: 0, sortOrder: 4 },
      ] } } }),
      // Omaka
      db.modifierGroup.create({ data: { name: 'Omaka', required: false, minSelect: 0, maxSelect: 1, sortOrder: 2, modifiers: { create: [
        { name: 'BBQ omaka', price: 0, sortOrder: 0 },
        { name: 'Česnova omaka', price: 0, sortOrder: 1 },
        { name: 'Gobična omaka', price: 1.50, sortOrder: 2 },
        { name: 'Pepper omaka', price: 1.50, sortOrder: 3 },
        { name: 'Tatarska omaka', price: 0, sortOrder: 4 },
      ] } } }),
      // Sir
      db.modifierGroup.create({ data: { name: 'Dodatni sir', required: false, minSelect: 0, maxSelect: 2, sortOrder: 3, modifiers: { create: [
        { name: 'Cheddar', price: 1.50, sortOrder: 0 },
        { name: 'Švicarski', price: 1.50, sortOrder: 1 },
        { name: 'Mocarela', price: 1.50, sortOrder: 2 },
        { name: 'Gorgonzola', price: 2.00, sortOrder: 3 },
      ] } } }),
      // Mleko - za kavo
      db.modifierGroup.create({ data: { name: 'Vrsta mleka', required: false, minSelect: 0, maxSelect: 1, sortOrder: 4, modifiers: { create: [
        { name: 'Kravje mleko', price: 0, sortOrder: 0 },
        { name: 'Ovseno mleko', price: 0.50, sortOrder: 1 },
        { name: 'Mandljevo mleko', price: 0.50, sortOrder: 2 },
        { name: 'Sojino mleko', price: 0.50, sortOrder: 3 },
      ] } } }),
      // Sladilo - za kavo/čaj
      db.modifierGroup.create({ data: { name: 'Sladilo', required: false, minSelect: 0, maxSelect: 1, sortOrder: 5, modifiers: { create: [
        { name: 'Sladkor', price: 0, sortOrder: 0 },
        { name: 'Med', price: 0.30, sortOrder: 1 },
        { name: 'Stevia', price: 0.30, sortOrder: 2 },
      ] } } }),
      // Alkoholni dodatek - za kavo
      db.modifierGroup.create({ data: { name: 'Alkoholni dodatek', required: false, minSelect: 0, maxSelect: 1, sortOrder: 6, modifiers: { create: [
        { name: 'Amaretto', price: 2.50, sortOrder: 0 },
        { name: 'Baileys', price: 2.50, sortOrder: 1 },
        { name: 'Kahlua', price: 2.50, sortOrder: 2 },
      ] } } }),
      // Velikost pice
      db.modifierGroup.create({ data: { name: 'Velikost', required: true, minSelect: 1, maxSelect: 1, sortOrder: 7, modifiers: { create: [
        { name: 'Mala (25cm)', price: 0, sortOrder: 0 },
        { name: 'Srednja (30cm)', price: 3.00, sortOrder: 1 },
        { name: 'Velika (35cm)', price: 5.00, sortOrder: 2 },
      ] } } }),
      // Velikost burgerja
      db.modifierGroup.create({ data: { name: 'Velikost', required: true, minSelect: 1, maxSelect: 1, sortOrder: 8, modifiers: { create: [
        { name: 'Običajen (150g)', price: 0, sortOrder: 0 },
        { name: 'Velik (250g)', price: 3.50, sortOrder: 1 },
      ] } } }),
      // Led za pijačo
      db.modifierGroup.create({ data: { name: 'Led', required: false, minSelect: 0, maxSelect: 1, sortOrder: 9, modifiers: { create: [
        { name: 'Z ledom', price: 0, sortOrder: 0 },
        { name: 'Brez ledu', price: 0, sortOrder: 1 },
      ] } } }),
    ])

    // ============================================
    // MENU ARTIKLI
    // ============================================
    const cats = { hladnePredjedi, toplePredjedi, juhe, glavneJedi, testenine, rizote, kalamari, ribjeJedi, solate, pizza, burgerji, vegetarijanske, palacinke, sladice, outroskeJedi, malice, priloge, omake, penine, belaVina, roseVino, rdecaVina, tujaVina, likerskoVino, tocenoPivo, pivo, craftPiva, brezalkPivo, viski, gin, likerji, grencice, destilati, topliNapitki, mesanePijace, vode, naravniSokovi, sokovi, gaziranePijace }
    const mods = { cookingLevel, sideChoice, sauceChoice, cheeseChoice, milkChoice, sweetenerChoice, alcoholAdd, pizzaSize, burgerSize, iceChoice }

    const menuItemsData = getMenuItemsData(cats, mods)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma MenuItem return type with dynamic fields
    const menuItems: any[] = []
    for (const itemData of menuItemsData) {
      const { modifierGroupIds, ...itemFields } = itemData
      const item = await db.menuItem.create({ data: itemFields })
      // Poveži modifier skupine z artiklom
      for (let i = 0; i < modifierGroupIds.length; i++) {
        await db.menuItemModifierGroup.create({
          data: { menuItemId: item.id, modifierGroupId: modifierGroupIds[i], sortOrder: i }
        })
      }
      menuItems.push(item)
    }

    // ============================================
    // DEMO PODATKI (mize, zaposleni, smene, naročila)
    // ============================================
    await seedDemoData(menuItems)

    // ============================================
    // KONFIGURACIJSKI PODATKI (Toast POS)
    // ============================================
    await seedAllConfig()

    return NextResponse.json({ success: true, message: 'Podatki so bili uspešno naloženi s slovensko ponudbo, vinsko kartico in konfiguracijo' })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/seed', 'Napaka pri nalaganju podatkov')
  }
}
