
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { toNum, round2 } from '@/lib/decimal'
import { handleApiError } from '@/lib/api-utils'
import { checkRateLimit, getClientIp, SEED_LIMIT } from '@/lib/rate-limit'

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
    const menuItemsData = [
      // ============================================
      // HRANA - RestorantOS
      // ============================================

      // --- HLAĐNE PREDJEDI ---
      { name: 'Domači narezek', description: 'Domače sušene kraške mesnine, sir (300g)', price: 25.00, categoryId: hladnePredjedi.id, sortOrder: 0, image: '/menu-images/hladne-predjedi/domaci-narezek.png', modifierGroupIds: [] },
      { name: 'Pršut z olivami', description: 'Kraški pršut z olivami (300g)', price: 25.00, categoryId: hladnePredjedi.id, sortOrder: 1, image: '/menu-images/hladne-predjedi/prsut-olive.png', modifierGroupIds: [] },
      { name: 'Sirova plošča', description: 'Izbira domačih sirov (300g)', price: 25.00, categoryId: hladnePredjedi.id, sortOrder: 2, image: '/menu-images/hladne-predjedi/sirova-plosca.png', modifierGroupIds: [] },

      // --- TOPLE PREDJEDI ---
      { name: 'Ocvrti šampinjoni', description: 'Ocvrti šampinjoni s tatarsko omako', price: 8.50, categoryId: toplePredjedi.id, sortOrder: 0, image: '/menu-images/tople-predjedi/ocvrti-sampinjoni.png', modifierGroupIds: [sauceChoice.id] },
      { name: 'Šampinjoni na žaru z gorgonzolo', description: 'Šampinjoni na žaru z gorgonzola sirom', price: 10.50, categoryId: toplePredjedi.id, sortOrder: 1, image: '/menu-images/tople-predjedi/sampinjoni-zar-gorgonzola.png', modifierGroupIds: [] },
      { name: 'Šampinjoni v gorgonzolni omaki', description: 'Šampinjoni v gorgonzolni omaki', price: 11.50, categoryId: toplePredjedi.id, sortOrder: 2, image: '/menu-images/tople-predjedi/sampinjoni-gorgonzolna-omaka.png', modifierGroupIds: [] },
      { name: 'Šampinjoni na žaru tržaška omaka', description: 'Šampinjoni na žaru s tržaško omako', price: 8.50, categoryId: toplePredjedi.id, sortOrder: 3, image: '/menu-images/tople-predjedi/sampinjoni-zar-trzaska.png', modifierGroupIds: [] },
      { name: 'Ocvrti sir s tatarsko omako', description: 'Ocvrti sir s tatarsko omako', price: 9.50, categoryId: toplePredjedi.id, sortOrder: 4, image: '/menu-images/tople-predjedi/ocvrti-sir.png', modifierGroupIds: [sauceChoice.id] },
      { name: 'Sirovi štruklji', description: 'Sirovi štruklji 3 kosi', price: 9.00, categoryId: toplePredjedi.id, sortOrder: 5, image: '/menu-images/tople-predjedi/sirovi-struklji.png', modifierGroupIds: [] },
      { name: 'Popečena slanina na rukoli', description: 'Popečena slanina na rukoli', price: 6.00, categoryId: toplePredjedi.id, sortOrder: 6, image: '/menu-images/tople-predjedi/slanina-rukola.png', modifierGroupIds: [] },
      // --- JUHE ---
      { name: 'Dnevna kremna gobova juha', description: 'Dnevna kremna gobova juha', price: 4.50, categoryId: juhe.id, sortOrder: 0, image: '/menu-images/juhe/kremna-gobova.png', modifierGroupIds: [] },
      { name: 'Dnevna kremna zelenjavna juha', description: 'Dnevna kremna zelenjavna juha', price: 4.50, categoryId: juhe.id, sortOrder: 1, image: '/menu-images/juhe/kremna-zelenjavna.png', modifierGroupIds: [] },
      { name: 'Goveja juha', description: 'Tradicionalna goveja juha', price: 4.00, categoryId: juhe.id, sortOrder: 2, image: '/menu-images/juhe/goveja-klasicna.png', modifierGroupIds: [] },

      // --- GLAVNE JEDI ---
      { name: 'Polnjena telečja prsa', description: 'Zelenjavna priloga, slan krompir', price: 16.00, categoryId: glavneJedi.id, sortOrder: 0, image: '/menu-images/glavne-jedi/polnjena-telecja-prsa.png', modifierGroupIds: [sideChoice.id] },
      { name: 'Pečena svinjska krača', description: 'Pommes frites, ajvar, gorčica, čebula, hren (1500g)', price: 24.00, categoryId: glavneJedi.id, sortOrder: 1, image: '/menu-images/glavne-jedi/pecena-svinjska-kraca.png', modifierGroupIds: [] },
      { name: 'Svinjska pečenka', description: 'Zelenjavna priloga, slan krompir (450g)', price: 14.00, categoryId: glavneJedi.id, sortOrder: 2, image: '/menu-images/glavne-jedi/svinjska-pecenka.png', modifierGroupIds: [sideChoice.id] },
      { name: 'Telečja pečenka', description: 'Zelenjavna priloga, slan krompir (450g)', price: 17.00, categoryId: glavneJedi.id, sortOrder: 3, image: '/menu-images/glavne-jedi/telecja-pecenka.png', modifierGroupIds: [sideChoice.id] },
      { name: 'Rumpsteak', description: 'Zelenjavna priloga, ajvar, gorčica, čebula (250g)', price: 26.00, categoryId: glavneJedi.id, sortOrder: 4, image: '/menu-images/glavne-jedi/rumpsteak.png', modifierGroupIds: [cookingLevel.id, sideChoice.id] },
      { name: 'BBQ rebrca', description: 'Konfitirana, nato pečena svinjska rebrca (baby ribs) – s parmezanom, pečen krompir, BBQ omaka (500g)', price: 16.00, categoryId: glavneJedi.id, sortOrder: 5, image: '/menu-images/glavne-jedi/bbq-rebrca.png', modifierGroupIds: [] },
      { name: 'Beefsteak v poprovi omaki', description: 'Zelenjavna priloga, pečen krompir (250g)', price: 30.00, categoryId: glavneJedi.id, sortOrder: 6, image: '/menu-images/glavne-jedi/beefsteak-poprova.png', modifierGroupIds: [cookingLevel.id, sideChoice.id, sauceChoice.id] },
      { name: 'Beefsteak žar na rukoli', description: 'Zelenjavna priloga, pečen krompir (250g)', price: 30.00, categoryId: glavneJedi.id, sortOrder: 7, image: '/menu-images/glavne-jedi/beefsteak-zar-rukoli.png', modifierGroupIds: [cookingLevel.id, sideChoice.id] },
      { name: 'Kraški beefsteak', description: 'Pršut, sir, zelenjavna priloga (250g)', price: 30.00, categoryId: glavneJedi.id, sortOrder: 8, image: '/menu-images/glavne-jedi/kraski-beefsteak.png', modifierGroupIds: [cookingLevel.id, sideChoice.id] },
      { name: 'Bograč v kotličku', description: 'Bograč v kotličku (200g)', price: 14.00, categoryId: glavneJedi.id, sortOrder: 9, image: '/menu-images/glavne-jedi/bograc.png', modifierGroupIds: [] },
      { name: 'Goveji golaž v kotličku', description: 'S kruhovo rezino (200g)', price: 15.00, categoryId: glavneJedi.id, sortOrder: 10, image: '/menu-images/glavne-jedi/goveji-golaz.png', modifierGroupIds: [] },
      { name: 'Dunajski zrezek', description: 'Dunajski zrezek (250g)', price: 12.00, categoryId: glavneJedi.id, sortOrder: 11, image: '/menu-images/glavne-jedi/dunajski-zrezek.png', modifierGroupIds: [sideChoice.id] },
      { name: 'Pariški zrezek', description: 'Pariški zrezek (250g)', price: 12.00, categoryId: glavneJedi.id, sortOrder: 12, image: '/menu-images/glavne-jedi/pariski-zrezek.png', modifierGroupIds: [sideChoice.id] },
      { name: 'Hišni zrezek', description: 'Smetanova omaka, sir, šampinjoni, česen, zelenjavna priloga (250g)', price: 16.00, categoryId: glavneJedi.id, sortOrder: 13, image: '/menu-images/glavne-jedi/hisni-zrezek.png', modifierGroupIds: [sideChoice.id] },
      { name: 'Kraški zrezek', description: 'Pršut, sir, česen, zelenjavna priloga (250g)', price: 16.00, categoryId: glavneJedi.id, sortOrder: 14, image: '/menu-images/glavne-jedi/kraski-zrezek.png', modifierGroupIds: [sideChoice.id] },
      { name: 'Naravni zrezek', description: 'Zelenjavna priloga (250g)', price: 15.00, categoryId: glavneJedi.id, sortOrder: 15, image: '/menu-images/glavne-jedi/naravni-zrezek.png', modifierGroupIds: [sideChoice.id] },
      { name: 'Zrezek z gobami', description: 'Zelenjavna priloga (250g)', price: 16.00, categoryId: glavneJedi.id, sortOrder: 16, image: '/menu-images/glavne-jedi/zrezek-gobe.png', modifierGroupIds: [sideChoice.id] },
      { name: 'Ljubljanski zrezek', description: 'Šunka, sir (250g)', price: 15.50, categoryId: glavneJedi.id, sortOrder: 17, image: '/menu-images/glavne-jedi/ljubljanski-zrezek.png', modifierGroupIds: [sideChoice.id] },
      { name: 'Zrezek v curry omaki', description: 'Zelenjavna priloga (250g)', price: 16.00, categoryId: glavneJedi.id, sortOrder: 18, image: '/menu-images/glavne-jedi/zrezek-curry.png', modifierGroupIds: [sideChoice.id] },
      { name: 'Sirov zrezek', description: 'Sirova omaka, sirov štrukelj, zelenjavna priloga (250g)', price: 16.00, categoryId: glavneJedi.id, sortOrder: 19, image: '/menu-images/glavne-jedi/sirov-zrezek.png', modifierGroupIds: [sideChoice.id] },
      { name: 'Zrezek v smetanovi omaki', description: 'Zelenjavna priloga (250g)', price: 15.00, categoryId: glavneJedi.id, sortOrder: 20, image: '/menu-images/glavne-jedi/zrezek-smetanova.png', modifierGroupIds: [sideChoice.id] },
      { name: 'Zrezek v gorgonzolni omaki z gobami', description: 'Zelenjavna priloga (250g)', price: 16.00, categoryId: glavneJedi.id, sortOrder: 21, image: '/menu-images/glavne-jedi/zrezek-gorgonzola.png', modifierGroupIds: [sideChoice.id] },
      { name: 'Zrezek žar na rukoli', description: 'Pečen krompir, čebulni obročki, omaka (250g)', price: 16.00, categoryId: glavneJedi.id, sortOrder: 22, image: '/menu-images/glavne-jedi/zrezek-zar-rukoli.png', modifierGroupIds: [sideChoice.id, sauceChoice.id] },
      { name: 'Zrezek v smetanovi omaki s pehtranom', description: 'Zelenjavna priloga (250g)', price: 16.00, categoryId: glavneJedi.id, sortOrder: 23, image: '/menu-images/glavne-jedi/zrezek-pehtran.png', modifierGroupIds: [sideChoice.id] },
      { name: 'Hawaii zrezek', description: 'Zelenjavna priloga, smetanova omaka, ananas, sir (250g)', price: 16.00, categoryId: glavneJedi.id, sortOrder: 24, image: '/menu-images/glavne-jedi/hawaii-zrezek.png', modifierGroupIds: [sideChoice.id] },
      { name: 'Tagliata na rukoli', description: 'Pljučna goveja, pečen krompir in zelenjava (250g)', price: 30.00, categoryId: glavneJedi.id, sortOrder: 25, image: '/menu-images/glavne-jedi/tagliata.png', modifierGroupIds: [sideChoice.id] },
      { name: 'Rostbeef', description: 'Pečen krompir in zelenjava (250g)', price: 26.00, categoryId: glavneJedi.id, sortOrder: 26, image: '/menu-images/glavne-jedi/rostbeef.png', modifierGroupIds: [sideChoice.id] },
      { name: 'Žar tris', description: 'Svinjski kare, piščančja prsa, roastbeef, pečen krompir, čebulni obročki, omaka (350g)', price: 19.00, categoryId: glavneJedi.id, sortOrder: 27, image: '/menu-images/glavne-jedi/zar-tris.png', modifierGroupIds: [sauceChoice.id] },
      { name: 'Ocvrt pišanec', description: 'Ocvrt pišanec (12 kosov, 1500g)', price: 27.00, categoryId: glavneJedi.id, sortOrder: 28, image: '/menu-images/glavne-jedi/ocvrt-pisanec.png', modifierGroupIds: [] },
      { name: 'Pohančki', description: 'Svinjski, puranji ali piščančji pohančki (250g)', price: 13.00, categoryId: glavneJedi.id, sortOrder: 29, image: '/menu-images/glavne-jedi/pohancki.png', modifierGroupIds: [sideChoice.id] },
      { name: 'Hišna plošča', description: 'Svinjski dunajski, puranji pariški, žar puran, gobova ali smetanova omaka, zelenjavna priloga, pommes frites, krompirjevi ocvrtki, ocvrti njoki, pražen krompir (za 2 osebi, 600g)', price: 38.00, categoryId: glavneJedi.id, sortOrder: 30, image: '/menu-images/glavne-jedi/hisna-plosca.png', modifierGroupIds: [] },
      { name: 'Kmečka plošča', description: 'Svinjska pečenka, polnjena telečja prsa, pečena rebra, slan krompir, pražen krompir, njoki, zelenjava, sirov štrukelj (za 2 osebi, 800g)', price: 40.00, categoryId: glavneJedi.id, sortOrder: 31, image: '/menu-images/glavne-jedi/kmecka-plosca.png', modifierGroupIds: [] },
      { name: 'Kmečki krožnik', description: 'Svinjska pečenka, njoki, polnjena telečja prsa, pečena rebra, slan krompir, zelenjava, sirov štrukelj (400g)', price: 20.00, categoryId: glavneJedi.id, sortOrder: 32, image: '/menu-images/glavne-jedi/kmecki-kroznik.png', modifierGroupIds: [] },
      { name: 'Kmečka plošča - zimska', description: 'Svinjska pečenka, pečenica, krvavica, pečena rebra, repa, zelje, matevž, ajdovi žganci, slan krompir (za 2 osebi, 800g)', price: 40.00, categoryId: glavneJedi.id, sortOrder: 33, image: '/menu-images/glavne-jedi/kmecka-zimska.png', modifierGroupIds: [] },
      { name: 'Kmečki krožnik - zimski', description: 'Svinjska pečenka, pečenica, krvavica, pečena rebra, repa, zelje, matevž, ajdovi žganci, slan krompir (400g)', price: 20.00, categoryId: glavneJedi.id, sortOrder: 34, image: '/menu-images/glavne-jedi/kmecki-zimski.png', modifierGroupIds: [] },
      { name: 'Pečenica s prilogo', description: 'Zelje ali repa, matevž, slan krompir (300g)', price: 13.00, categoryId: glavneJedi.id, sortOrder: 35, image: '/menu-images/glavne-jedi/pecenica.png', modifierGroupIds: [sideChoice.id] },
      { name: 'Krvavica s prilogo', description: 'Zelje ali repa, matevž, slan krompir (300g)', price: 13.00, categoryId: glavneJedi.id, sortOrder: 36, image: '/menu-images/glavne-jedi/krvavica.png', modifierGroupIds: [sideChoice.id] },

      // --- TESTENINE, NJOKI ---
      { name: 'Bolognese', description: 'Omaka z mletnim mesom - špageti, rezanci ali njoki', price: 10.90, categoryId: testenine.id, sortOrder: 0, image: '/menu-images/testenine-njoki/bolognese.png', modifierGroupIds: [] },
      { name: 'Milanese', description: 'Paradižnikova omaka z grahom in šunko - špageti, rezanci ali njoki', price: 10.90, categoryId: testenine.id, sortOrder: 1, image: '/menu-images/testenine-njoki/milanese.png', modifierGroupIds: [] },
      { name: 'Z morskimi sadeži', description: 'Paradižnikova omaka, morski sadeži - špageti, rezanci ali njoki', price: 12.50, categoryId: testenine.id, sortOrder: 2, image: '/menu-images/testenine-njoki/morski-sadezi.png', modifierGroupIds: [] },
      { name: 'Carbonara', description: 'Smetanova omaka s pršutom - špageti, rezanci ali njoki', price: 12.50, categoryId: testenine.id, sortOrder: 3, image: '/menu-images/testenine-njoki/carbonara.png', modifierGroupIds: [] },
      { name: 'Napoli', description: 'Paradižnikova omaka - špageti, rezanci ali njoki', price: 9.90, categoryId: testenine.id, sortOrder: 4, image: '/menu-images/testenine-njoki/napoli.png', modifierGroupIds: [] },
      { name: 'Z gobami', description: 'Mešane gobe - špageti, rezanci ali njoki', price: 10.50, categoryId: testenine.id, sortOrder: 5, image: '/menu-images/testenine-njoki/gobe.png', modifierGroupIds: [] },
      { name: 'Z morskimi sadeži v smetanovi omaki', description: 'Smetanova omaka, morski sadeži - špageti, rezanci ali njoki', price: 12.50, categoryId: testenine.id, sortOrder: 6, image: '/menu-images/testenine-njoki/morski-smetanova.png', modifierGroupIds: [] },
      { name: 'S pljučno pečenko in zelenjavo', description: 'Pljučna pečenka, zelenjava - špageti, rezanci ali njoki', price: 15.50, categoryId: testenine.id, sortOrder: 7, image: '/menu-images/testenine-njoki/pljucna-pecenka.png', modifierGroupIds: [] },
      { name: 'V gorgonzolini omaki', description: 'Gorgonzolna omaka - špageti, rezanci ali njoki', price: 11.00, categoryId: testenine.id, sortOrder: 8, image: '/menu-images/testenine-njoki/gorgonzola.png', modifierGroupIds: [] },
      { name: 'S tartufi', description: 'Smetanova omaka, tartufi - špageti, rezanci ali njoki', price: 13.50, categoryId: testenine.id, sortOrder: 9, image: '/menu-images/testenine-njoki/tartufi.png', modifierGroupIds: [] },
      { name: 'S puranom v curry omaki', description: 'Puranje ali piščančje meso, curry, smetanova omaka - špageti, rezanci ali njoki', price: 13.00, categoryId: testenine.id, sortOrder: 10, image: '/menu-images/testenine-njoki/puran-curry.png', modifierGroupIds: [] },
      { name: 'S puranom v smetanovi omaki', description: 'Puranje meso, smetanova omaka - špageti, rezanci ali njoki', price: 13.00, categoryId: testenine.id, sortOrder: 11, image: '/menu-images/testenine-njoki/puran-smetanova.png', modifierGroupIds: [] },
      { name: 'V smetanovi omaki', description: 'Smetanova omaka - špageti, rezanci ali njoki', price: 9.50, categoryId: testenine.id, sortOrder: 12, image: '/menu-images/testenine-njoki/smetanova.png', modifierGroupIds: [] },
      { name: 'Sicilijana', description: 'Češnjev paradižnik, melancani, moccarela - špageti, rezanci ali njoki', price: 12.00, categoryId: testenine.id, sortOrder: 13, image: '/menu-images/testenine-njoki/sicilijana.png', modifierGroupIds: [] },
      { name: 'Z gamberi na rdeče ali belo', description: 'Gamberi, omaka po izbiri - špageti, rezanci ali njoki', price: 14.50, categoryId: testenine.id, sortOrder: 14, image: '/menu-images/testenine-njoki/gamberi.png', modifierGroupIds: [] },
      { name: 'S piščancem', description: 'Moccarela, češnjev paradižnik - špageti, rezanci ali njoki', price: 14.00, categoryId: testenine.id, sortOrder: 15, image: '/menu-images/testenine-njoki/piscanec.png', modifierGroupIds: [] },
      { name: 'Pad Thai z zelenjavo', description: 'Riževi rezanci, bučke, korenje, mlada čebula, por, jajce, pad thai omaka, sveži kalčki, arašidi, limeta', price: 10.90, categoryId: testenine.id, sortOrder: 16, image: '/menu-images/testenine-njoki/padthai-zelenjava.png', modifierGroupIds: [] },
      { name: 'Pad Thai s piščancem', description: 'Riževi rezanci, piščanec, bučke, korenje, mlada čebula, por, jajce, pad thai omaka, sveži kalčki, arašidi, limeta', price: 13.90, categoryId: testenine.id, sortOrder: 17, image: '/menu-images/testenine-njoki/padthai-piscanec.png', modifierGroupIds: [] },

      // --- RIŽOTE ---
      { name: 'Morska rižota', description: 'Morski sadeži', price: 12.00, categoryId: rizote.id, sortOrder: 0, image: '/menu-images/rizote/morska.png', modifierGroupIds: [] },
      { name: 'Rižota z gobami', description: 'Mešane gobe', price: 11.00, categoryId: rizote.id, sortOrder: 1, image: '/menu-images/rizote/gobe.png', modifierGroupIds: [] },
      { name: 'Rižota s puranom in papriko', description: 'Puranje meso, paprika', price: 13.00, categoryId: rizote.id, sortOrder: 2, image: '/menu-images/rizote/puran-paprika.png', modifierGroupIds: [] },
      { name: 'Zelenjavna rižota', description: 'Mešana zelenjava', price: 9.90, categoryId: rizote.id, sortOrder: 3, image: '/menu-images/rizote/zelenjavna.png', modifierGroupIds: [] },
      { name: 'Rižota z gamberi in mešanimi gobami', description: 'Gamberi, mešane gobe', price: 14.50, categoryId: rizote.id, sortOrder: 4, image: '/menu-images/rizote/gamberi-gobe.png', modifierGroupIds: [] },

      // --- KALAMARI ---
      { name: 'Mešani kalamari', description: 'Ocvrti, na žaru, polnjeni po dunajsko, repki škampov po pariško, pommes frites, slan krompir z blitvo, tatarska omaka (za 3 osebe, 750g)', price: 60.00, categoryId: kalamari.id, sortOrder: 0, image: '/menu-images/kalamari/mesani.png', modifierGroupIds: [] },
      { name: 'Ocvrti kalamari', description: 'Tatarska omaka (200g)', price: 13.90, categoryId: kalamari.id, sortOrder: 1, image: '/menu-images/kalamari/ocvrti.png', modifierGroupIds: [sauceChoice.id] },
      { name: 'Kalamari po mornarsko', description: 'Tatarska omaka (200g)', price: 13.90, categoryId: kalamari.id, sortOrder: 2, image: '/menu-images/kalamari/mornarsko.png', modifierGroupIds: [sauceChoice.id] },
      { name: 'Polnjeni kalamari po dunajsko', description: 'S sirom in pršutom, tatarska omaka (250g)', price: 14.50, categoryId: kalamari.id, sortOrder: 3, image: '/menu-images/kalamari/polnjeni-dunajsko.png', modifierGroupIds: [sauceChoice.id] },
      { name: 'Kalamari na žaru', description: 'Slan krompir z blitvo (300g)', price: 14.50, categoryId: kalamari.id, sortOrder: 4, image: '/menu-images/kalamari/na-zaru.png', modifierGroupIds: [] },
      { name: 'Kalamari žar na rukoli', description: 'Slan krompir z blitvo, parmezan (300g)', price: 14.50, categoryId: kalamari.id, sortOrder: 5, image: '/menu-images/kalamari/zar-rukoli.png', modifierGroupIds: [] },
      { name: 'Polnjeni kalamari na žaru', description: 'S sirom in pršutom, slan krompir z blitvo (300g)', price: 14.90, categoryId: kalamari.id, sortOrder: 6, image: '/menu-images/kalamari/polnjeni-zar.png', modifierGroupIds: [] },

      // --- RIBJE JEDI ---
      { name: 'Ribja plošča', description: 'File brancina, file orade, polnjeni kalamari po dunajsko, gamberi po pariško, pečena zelenjava, slan krompir z blitvo, tržaška omaka (za 2 osebi, 1100g)', price: 40.00, categoryId: ribjeJedi.id, sortOrder: 0, image: '/menu-images/ribje-jedi/ribja-plosca.png', modifierGroupIds: [] },
      { name: 'Gamberi po pariško', description: 'Tatarska omaka (200g)', price: 18.00, categoryId: ribjeJedi.id, sortOrder: 1, image: '/menu-images/ribje-jedi/gamberi-parisko.png', modifierGroupIds: [sauceChoice.id] },
      { name: 'Ocvrt oslič s prilogo', description: 'Tatarska omaka, pommes frites (300g)', price: 12.00, categoryId: ribjeJedi.id, sortOrder: 2, image: '/menu-images/ribje-jedi/ocvrt-oslic.png', modifierGroupIds: [sauceChoice.id] },
      { name: 'Losos', description: 'Tržaška omaka, zelenjavna priloga, slan krompir z blitvo (300g)', price: 18.00, categoryId: ribjeJedi.id, sortOrder: 3, image: '/menu-images/ribje-jedi/losos.png', modifierGroupIds: [] },
      { name: 'File postrvi', description: 'Po tržaško, po dunajsko ali v koruzni moki, zelenjavna priloga, slan krompir z blitvo (300g)', price: 15.00, categoryId: ribjeJedi.id, sortOrder: 4, image: '/menu-images/ribje-jedi/file-postrvi.png', modifierGroupIds: [] },
      { name: 'File orade', description: 'Tržaška omaka, zelenjavna priloga, slan krompir z blitvo (300g)', price: 18.00, categoryId: ribjeJedi.id, sortOrder: 5, image: '/menu-images/ribje-jedi/file-orade.png', modifierGroupIds: [] },
      { name: 'File brancina na žaru', description: 'Tržaška omaka, zelenjavna priloga, slan krompir z blitvo (300g)', price: 18.00, categoryId: ribjeJedi.id, sortOrder: 6, image: '/menu-images/ribje-jedi/file-brancina.png', modifierGroupIds: [] },

      // --- SOLATE ---
      { name: 'Solata Kraljica', description: 'Dvojna mešana solata, sir, tatarska omaka', price: 9.50, categoryId: solate.id, sortOrder: 0, image: '/menu-images/solate/kraljica.png', modifierGroupIds: [sauceChoice.id] },
      { name: 'Solata Kraljica s šunko', description: 'Dvojna mešana solata, sir, tatarska omaka, šunka (150g)', price: 11.50, categoryId: solate.id, sortOrder: 1, image: '/menu-images/solate/kraljica-sunka.png', modifierGroupIds: [sauceChoice.id] },
      { name: 'Solata Kraljica z jajci', description: 'Dvojna mešana solata, sir, tatarska omaka, 2 jajci', price: 10.50, categoryId: solate.id, sortOrder: 2, image: '/menu-images/solate/kraljica-jajca.png', modifierGroupIds: [sauceChoice.id] },
      { name: 'Solata Kraljica s puranom', description: 'Dvojna mešana solata, sir, tatarska omaka, puran ali piščanec (150g)', price: 12.00, categoryId: solate.id, sortOrder: 3, image: '/menu-images/solate/kraljica-puran.png', modifierGroupIds: [sauceChoice.id] },
      { name: 'Solata Kraljica s tuno', description: 'Dvojna mešana solata, sir, tatarska omaka, tuna (150g)', price: 12.00, categoryId: solate.id, sortOrder: 4, image: '/menu-images/solate/kraljica-tuna.png', modifierGroupIds: [sauceChoice.id] },
      { name: 'Cezarjeva solata', description: 'Ocvrt piščanec, mozzarela, parmezan, zelena solata, riban korenček, češnjev paradižnik, krotoni, cezar preliv', price: 13.50, categoryId: solate.id, sortOrder: 5, image: '/menu-images/solate/cezarjeva.png', modifierGroupIds: [] },
      { name: 'Solatni krožnik s feta sirom', description: 'Zelena solata, radič, koruza, kumare, paradižnik, korenček, jajce, pinjole, feta sir', price: 10.00, categoryId: solate.id, sortOrder: 6, image: '/menu-images/solate/kroznik-feta.png', modifierGroupIds: [] },
      { name: 'Solatni krožnik s puranom', description: 'Zelena solata, radič, koruza, kumare, paradižnik, korenček, jajce, pinjole, puran ali piščanec (150g)', price: 11.50, categoryId: solate.id, sortOrder: 7, image: '/menu-images/solate/kroznik-puran.png', modifierGroupIds: [] },
      { name: 'Solatni krožnik s tuno', description: 'Zelena solata, radič, koruza, kumare, paradižnik, korenček, jajce, pinjole, tuna (150g)', price: 11.50, categoryId: solate.id, sortOrder: 8, image: '/menu-images/solate/kroznik-tuna.png', modifierGroupIds: [] },
      { name: 'Solatni krožnik s popečeno slanino', description: 'Zelena solata, radič, koruza, kumare, paradižnik, korenček, jajce, pinjole, popečena slanina (150g)', price: 11.50, categoryId: solate.id, sortOrder: 9, image: '/menu-images/solate/kroznik-slanina.png', modifierGroupIds: [] },
      { name: 'Grška solata', description: 'Paradižnik, kumare, paprika, zelena solata, olive, feta sir', price: 10.00, categoryId: solate.id, sortOrder: 10, image: '/menu-images/solate/grska.png', modifierGroupIds: [] },
      { name: 'Solata rukola s parmezanom', description: 'Rukola, parmezan', price: 5.00, categoryId: solate.id, sortOrder: 11, image: '/menu-images/solate/rukola-parmezan.png', modifierGroupIds: [] },
      { name: 'Mešana solata s tuno', description: 'Dvojna mešana solata, tuna, tatarska omaka', price: 11.00, categoryId: solate.id, sortOrder: 12, image: '/menu-images/solate/mesana-tuna.png', modifierGroupIds: [] },
      // Posamezne solate
      { name: 'Zelena solata', description: 'Zelena solata', price: 3.90, categoryId: solate.id, sortOrder: 13, image: '/menu-images/solate/zelena.png', modifierGroupIds: [] },
      { name: 'Motovilec', description: 'Motovilec', price: 3.90, categoryId: solate.id, sortOrder: 14, image: '/menu-images/solate/motovilec.png', modifierGroupIds: [] },
      { name: 'Zeljnata solata', description: 'Zeljnata solata', price: 3.90, categoryId: solate.id, sortOrder: 15, image: '/menu-images/solate/zeljnata.png', modifierGroupIds: [] },
      { name: 'Kumare', description: 'Kumare', price: 3.90, categoryId: solate.id, sortOrder: 16, image: '/menu-images/solate/kumare.png', modifierGroupIds: [] },
      { name: 'Paradižnikova solata', description: 'Paradižnikova solata', price: 3.90, categoryId: solate.id, sortOrder: 17, image: '/menu-images/solate/paradiznikova.png', modifierGroupIds: [] },
      { name: 'Fižolova solata', description: 'Fižolova solata', price: 4.40, categoryId: solate.id, sortOrder: 18, image: '/menu-images/solate/fizolova.png', modifierGroupIds: [] },
      { name: 'Koruzna solata', description: 'Koruzna solata', price: 4.40, categoryId: solate.id, sortOrder: 19, image: '/menu-images/solate/koruzna.png', modifierGroupIds: [] },
      { name: 'Mešana solata', description: 'Mešana solata', price: 4.40, categoryId: solate.id, sortOrder: 20, image: '/menu-images/solate/mesana-solata-2.png', modifierGroupIds: [] },
      { name: 'Rukola', description: 'Rukola', price: 4.20, categoryId: solate.id, sortOrder: 21, image: '/menu-images/solate/rukola.png', modifierGroupIds: [] },
      { name: 'Pečena paprika', description: 'Pečena paprika', price: 5.00, categoryId: solate.id, sortOrder: 22, image: '/menu-images/solate/pecena-paprika.png', modifierGroupIds: [] },

      // --- PIZZE ---
      { name: 'Margerita', description: 'Pelati, mozzarella, origano, oliva', price: 11.30, categoryId: pizza.id, sortOrder: 0, image: '/menu-images/pizze/margerita.png', modifierGroupIds: [pizzaSize.id] },
      { name: 'Kraljica', description: 'Pelati, mozzarella, kuhan pršut, gobe, origano, oliva', price: 11.90, categoryId: pizza.id, sortOrder: 1, image: '/menu-images/pizze/kraljica.png', modifierGroupIds: [pizzaSize.id] },
      { name: 'Hišna pica', description: 'Pelati, mozzarella, kuhan pršut, domača šunka, suha goveja salama, hrenovka, slanina, gobe, origano, oliva', price: 12.30, categoryId: pizza.id, sortOrder: 2, image: '/menu-images/pizze/hisna.png', modifierGroupIds: [pizzaSize.id] },
      { name: 'Kraška', description: 'Pelati, mozzarella, pršut, gobe, origano, oliva', price: 12.60, categoryId: pizza.id, sortOrder: 3, image: '/menu-images/pizze/kraska.png', modifierGroupIds: [pizzaSize.id] },
      { name: '4. Letni časi', description: 'Pelati, mozzarella, kuhan pršut, goveja suha salama, gobe, origano, oliva', price: 12.30, categoryId: pizza.id, sortOrder: 4, image: '/menu-images/pizze/4-letni-casi.png', modifierGroupIds: [pizzaSize.id] },
      { name: 'Pikant', description: 'Pelati, mozzarella, kuhan pršut, pikantna suha salama, feferoni, gobe, origano, oliva', price: 12.30, categoryId: pizza.id, sortOrder: 5, image: '/menu-images/pizze/pikant.png', modifierGroupIds: [pizzaSize.id] },
      { name: 'Kmečka', description: 'Pelati, mozzarella, domača šunka, gobe, hren s kislo smetano, origano, oliva', price: 12.30, categoryId: pizza.id, sortOrder: 6, image: '/menu-images/pizze/kmecka.png', modifierGroupIds: [pizzaSize.id] },
      { name: 'Lovska', description: 'Pelati, mozzarella, divjačinska salama, kisle kumarice, origano, čebula', price: 12.30, categoryId: pizza.id, sortOrder: 7, image: '/menu-images/pizze/lovska.png', modifierGroupIds: [pizzaSize.id] },
      { name: 'Romana', description: 'Pelati, mozzarella, kuhan pršut, origano, oliva', price: 11.90, categoryId: pizza.id, sortOrder: 8, image: '/menu-images/pizze/romana.png', modifierGroupIds: [pizzaSize.id] },
      { name: 'S slanino', description: 'Pelati, mozzarella, slanina, gobe, origano, oliva', price: 12.30, categoryId: pizza.id, sortOrder: 9, image: '/menu-images/pizze/s-slanino.png', modifierGroupIds: [pizzaSize.id] },
      { name: 'Študentska', description: 'Pelati, mozzarella, kuhan pršut, hrenovke, gobe, origano, oliva', price: 12.10, categoryId: pizza.id, sortOrder: 10, image: '/menu-images/pizze/studentska.png', modifierGroupIds: [pizzaSize.id] },
      { name: 'Bolognese', description: 'Pelati, mozzarella, bolognese omaka, čebula, origano, oliva', price: 12.50, categoryId: pizza.id, sortOrder: 11, image: '/menu-images/pizze/bolognese.png', modifierGroupIds: [pizzaSize.id] },
      { name: 'Morska', description: 'Pelati, mozzarella, školjke, gambere, lignji, česen, origano, oliva', price: 12.70, categoryId: pizza.id, sortOrder: 12, image: '/menu-images/pizze/morska.png', modifierGroupIds: [pizzaSize.id] },
      { name: 'S tuno', description: 'Pelati, mozzarella, tuna, čebula, origano, oliva', price: 12.70, categoryId: pizza.id, sortOrder: 13, image: '/menu-images/pizze/s-tuno.png', modifierGroupIds: [pizzaSize.id] },
      { name: 'Ribiška', description: 'Pelati, mozzarella, slaniki, origano, oliva', price: 12.30, categoryId: pizza.id, sortOrder: 14, image: '/menu-images/pizze/ribiska.png', modifierGroupIds: [pizzaSize.id] },
      { name: 'S suho salamo', description: 'Pelati, mozzarella, goveja suha salama, gobe, origano, oliva', price: 12.30, categoryId: pizza.id, sortOrder: 15, image: '/menu-images/pizze/suha-salama.png', modifierGroupIds: [pizzaSize.id] },
      { name: 'Štirje siri', description: 'Pelati, mozzarella, gauda, edamec, gorgonzola, kisla smetana, origano, oliva', price: 11.90, categoryId: pizza.id, sortOrder: 16, image: '/menu-images/pizze/4-siri.png', modifierGroupIds: [pizzaSize.id] },
      { name: 'Vegetarijanska', description: 'Pelati, mozzarella, bučke, češnjev paradižnik, čebula, koruza, origano, olive', price: 11.90, categoryId: pizza.id, sortOrder: 17, image: '/menu-images/pizze/vegetarijanska.png', modifierGroupIds: [pizzaSize.id] },
      { name: 'S svežo zelenjavo', description: 'Pelati, mozzarella, paradižnik, melancani, sveža paprika, gobe, origano, oliva', price: 11.90, categoryId: pizza.id, sortOrder: 18, image: '/menu-images/pizze/svezja-zelenjava.png', modifierGroupIds: [pizzaSize.id] },
      { name: 'S svežimi šampinjoni', description: 'Pelati, mozzarella, sveži šampinjoni, origano, oliva', price: 11.90, categoryId: pizza.id, sortOrder: 19, image: '/menu-images/pizze/sampinjoni.png', modifierGroupIds: [pizzaSize.id] },
      { name: 'Z melancani', description: 'Pelati, mozzarella, melancani, gobe, origano, oliva', price: 11.90, categoryId: pizza.id, sortOrder: 20, image: '/menu-images/pizze/melancani.png', modifierGroupIds: [pizzaSize.id] },
      { name: 'Z rukolo', description: 'Pelati, mozzarella, rukola, origano, oliva', price: 11.90, categoryId: pizza.id, sortOrder: 21, image: '/menu-images/pizze/z-rukolo.png', modifierGroupIds: [pizzaSize.id] },
      { name: 'Napoli', description: 'Pelati, mozzarella, češnjev paradižnik, origano, bazilika', price: 11.50, categoryId: pizza.id, sortOrder: 22, image: '/menu-images/pizze/napoli.png', modifierGroupIds: [pizzaSize.id] },
      { name: 'Z gamberi', description: 'Pelati, mozzarella, gamberi, origano, bazilika', price: 13.10, categoryId: pizza.id, sortOrder: 23, image: '/menu-images/pizze/z-gamberi.png', modifierGroupIds: [pizzaSize.id] },
      { name: 'Kebab', description: 'Pelati, mozzarella, piščančji kebab, sveža paprika, bazilika, origano, kisla smetana', price: 12.30, categoryId: pizza.id, sortOrder: 24, image: '/menu-images/pizze/kebab.png', modifierGroupIds: [pizzaSize.id] },
      { name: 'Mehiška', description: 'Pelati, mozzarella, bolognese, čebula, češnjev paradižnik, koruza, nacho, origano, feferon', price: 12.30, categoryId: pizza.id, sortOrder: 25, image: '/menu-images/pizze/mehiska.png', modifierGroupIds: [pizzaSize.id] },
      { name: 'Mortadela', description: 'Mozzarella, kisla smetana, mortadela, pistacija, bazilika', price: 12.40, categoryId: pizza.id, sortOrder: 26, image: '/menu-images/pizze/mortadela.png', modifierGroupIds: [pizzaSize.id] },

      // --- BURGERJI ---
      { name: 'Hišni burger', description: "Hišna bombeta, 100% govedina slovenskega porekla 170g, medena majoneza z Dijon gorčico, kozji sir, hrustljava slanina, karamelizirana čebula, american style zeljnata solatka, ocvrti čebulni obročki", price: 10.20, categoryId: burgerji.id, sortOrder: 0, image: '/menu-images/burgerji/hisni-burger.png', modifierGroupIds: [] },
      { name: "Jamie's italian burger", description: "Hišna bombeta, 100% govedina slovenskega porekla 170g, hišna omaka, cheddar sir, hrustljava slanina, karamelizirana čebula, rezine paradižnika, rezine kislih kumaric", price: 9.90, categoryId: burgerji.id, sortOrder: 1, image: '/menu-images/burgerji/jamies-italian.png', modifierGroupIds: [] },
      { name: 'Cheese please', description: 'Hišna bombeta, 100% govedina slovenskega porekla 170g, omaka 3 vrst sira cheddar-nacho-le brie, rezine paradižnika, koktajl omaka, svež list solate ledenke', price: 9.70, categoryId: burgerji.id, sortOrder: 2, image: '/menu-images/burgerji/cheese-please.png', modifierGroupIds: [] },
      { name: 'Big BOSS', description: 'Hišna bombeta, 100% govedina slovenskega porekla 170g, rezine roastbeefa, koščki hrustljave čebule, tartufina majoneza, rezina popečenega jabolka', price: 12.90, categoryId: burgerji.id, sortOrder: 3, image: '/menu-images/burgerji/big-boss.png', modifierGroupIds: [] },
      { name: 'The classic', description: 'Hišna bombeta, 100% govedina slovenskega porekla 170g, svež list solate ledenke, rezine paradižnika, cheddar sir, hišna omaka', price: 9.50, categoryId: burgerji.id, sortOrder: 4, image: '/menu-images/burgerji/the-classic.png', modifierGroupIds: [] },
      { name: 'Green garden', description: 'Hišna bombeta, bazilični pesto s koščki sušenega češnjevega paradižnika, popečena marinirana bučka in melancan, koščki hrustljave čebule, svež list solate ledenke, rezine paradižnika', price: 8.50, categoryId: burgerji.id, sortOrder: 5, image: '/menu-images/burgerji/green-garden.png', modifierGroupIds: [] },
      { name: 'Big smash burger', description: 'Hišna bombeta, 100% govedina slovenskega porekla 2x90g – smash, mac omaka, rezine topljenega sira, cheddar sir, kisle kumarice, sveža sladka čebula, svež list solate ledenke', price: 9.90, categoryId: burgerji.id, sortOrder: 6, image: '/menu-images/burgerji/big-smash.png', modifierGroupIds: [] },
      { name: 'Crispy chicken burger', description: 'Hišna bombeta, ocvrta piščančja prsa (marinirana, panirana v koruznih kosmičih) 180g, kremna česnova majoneza s kislo smetano, rezine topljenega sira, svež list solate ledenke', price: 9.90, categoryId: burgerji.id, sortOrder: 7, image: '/menu-images/burgerji/crispy-chicken.png', modifierGroupIds: [] },
      { name: 'Fit burger', description: 'Hišna bombeta, piščančja prsa (marinirana, pečena na žaru) 180g, avokado omaka, pečene bučke na žaru, jajce na oko, rezine paradižnika', price: 9.90, categoryId: burgerji.id, sortOrder: 8, image: '/menu-images/burgerji/fit-burger.png', modifierGroupIds: [] },

      // --- VEGETARIJANSKE JEDI ---
      { name: 'Zelenjavni zrezki', description: 'Zelenjavni zrezki', price: 8.50, categoryId: vegetarijanske.id, sortOrder: 0, image: '/menu-images/vegetarijanske-jedi/zelenjavni-zrezki.png', modifierGroupIds: [] },
      { name: 'Zelenjavni krožnik', description: 'Kuhana zelenjava, zelenjavni zrezek, ocvrt šampinjon', price: 8.50, categoryId: vegetarijanske.id, sortOrder: 1, image: '/menu-images/vegetarijanske-jedi/zelenjavni-kroznik.png', modifierGroupIds: [] },
      { name: 'Sojini polpeti', description: 'Sojini polpeti', price: 8.50, categoryId: vegetarijanske.id, sortOrder: 2, image: '/menu-images/vegetarijanske-jedi/sojini-polpeti.png', modifierGroupIds: [] },
      { name: 'Vegetarijanska plošča', description: 'Kuhana zelenjava, zelenjavni zrezek, sojin polpet, ocvrta cvetača, ocvrti šampinjoni', price: 11.00, categoryId: vegetarijanske.id, sortOrder: 3, image: '/menu-images/vegetarijanske-jedi/vegetarijanska-plosca.png', modifierGroupIds: [] },
      { name: 'Bučke na žaru', description: 'Česen, olivno olje', price: 8.50, categoryId: vegetarijanske.id, sortOrder: 4, image: '/menu-images/vegetarijanske-jedi/bucke-na-zaru.png', modifierGroupIds: [] },
      { name: 'Ocvrte bučke', description: 'Ocvrte bučke', price: 8.50, categoryId: vegetarijanske.id, sortOrder: 5, image: '/menu-images/vegetarijanske-jedi/ocvrte-bucke.png', modifierGroupIds: [] },
      { name: 'Ocvrti melancani', description: 'Ocvrti melancani', price: 8.50, categoryId: vegetarijanske.id, sortOrder: 6, image: '/menu-images/vegetarijanske-jedi/ocvrti-melancani.png', modifierGroupIds: [] },
      { name: 'Pečena sveža zelenjava na rukoli', description: 'Pečena sveža zelenjava na rukoli', price: 11.00, categoryId: vegetarijanske.id, sortOrder: 7, image: '/menu-images/vegetarijanske-jedi/pecena-zelenjava-rukola.png', modifierGroupIds: [] },

      // --- PALAČINKE ---
      { name: 'Jurmačinka', description: 'Klasika: jagodni pire, Kinder krema, Lino Lada, napojeni Plazma biskvit. Dekoracija: krema bele čokolade, krema pistacije, jagodni pire, mleta Plazma, sveže jagode', price: 9.90, categoryId: palacinke.id, sortOrder: 0, image: '/menu-images/palacinke/jurmacinka.png', modifierGroupIds: [] },
      { name: 'Raffaello', description: 'Klasika: krema bele čokolade, Lino Lada, mleti mandlji, kokosova krema, napojeni Plazma biskvit. Dekoracija: krema bele čokolade, kokosova moka, mleti mandlji, Raffaello kroglica', price: 9.70, categoryId: palacinke.id, sortOrder: 1, image: '/menu-images/palacinke/raffaello.png', modifierGroupIds: [] },
      { name: 'Babičina poslastica', description: 'Klasika: jabolčna marmelada, vanilijeva desertna krema, cimetovi piškoti. Dekoracija: vanilijeva desertna krema, jabolko, cimetovi piškoti, cimet', price: 9.90, categoryId: palacinke.id, sortOrder: 2, image: '/menu-images/palacinke/babicina-poslastica.png', modifierGroupIds: [] },
      { name: 'Cheesecake oreo z jagodo', description: 'Klasika: Oreo cheesecake krema, jagodni pire, drobljen Oreo piškot, Oreo krema. Dekoracija: Oreo piškot, jagodni pire, Oreo krema, bela čokolada, sveže jagode', price: 9.90, categoryId: palacinke.id, sortOrder: 3, image: '/menu-images/palacinke/cheesecake-oreo-jagoda.png', modifierGroupIds: [] },
      { name: 'Cheesecake masleni piškot z banano', description: 'Klasika: Cheesecake krema maslenega piškota, mleti plazma piškoti, rezine banane. Dekoracija: krema maslenega piškota, mleti plazma piškoti, rezine banane', price: 9.90, categoryId: palacinke.id, sortOrder: 4, image: '/menu-images/palacinke/cheesecake-masleni-banana.png', modifierGroupIds: [] },
      { name: 'Kinder Bueno', description: 'Kakavova: čokoladno-lešnikova krema, lešnikova krema, drobljen biskvit, napojeni Plazma biskvit. Dekoracija: čokoladno-lešnikova krema, lešnikova krema, drobljeni biskvit, Kinder Bueno čokolada', price: 9.90, categoryId: palacinke.id, sortOrder: 5, image: '/menu-images/palacinke/kinder-bueno.png', modifierGroupIds: [] },
      { name: 'Pink dreams', description: 'Red Velvet: krema ruby čokolade, malinov preliv, vanilijev puding. Dekoracija: krema in koščki ruby čokolade, krema bele čokolade, drobljen rdeč masleni kornet, koščki bele čokolade, maline', price: 9.90, categoryId: palacinke.id, sortOrder: 6, image: '/menu-images/palacinke/pink-dreams.png', modifierGroupIds: [] },
      { name: 'White pistachio', description: 'Klasika: krema pistacije, krema bele čokolade, mascarpone krema, napojeni Plazma biskvit. Dekoracija: krema bele čokolade, krema pistacije, mleta pistacija, crumble z belo čokolado', price: 10.50, categoryId: palacinke.id, sortOrder: 7, image: '/menu-images/palacinke/white-pistachio.png', modifierGroupIds: [] },
      { name: 'Snickers', description: 'Kakavova: krema mlečne čokolade, krema karamele z arašidovim maslom, čokoladni puding. Dekoracija: krema mlečne čokolade, crumble z mlečno čokolado, mleti arašidi, mleti čokoladni piškoti, Snickers', price: 9.90, categoryId: palacinke.id, sortOrder: 8, image: '/menu-images/palacinke/snickers.png', modifierGroupIds: [] },
      { name: 'Ferrero Rocher', description: 'Kakavova: čokoladno-lešnikova krema, Lino Lada Golci, mleti lešniki, čokoladni puding. Dekoracija: čokoladno-lešnikova krema, mleti čokoladni piškoti, mleti lešniki, Ferrero Rocher kroglica', price: 9.70, categoryId: palacinke.id, sortOrder: 9, image: '/menu-images/palacinke/ferrero-rocher.png', modifierGroupIds: [] },
      { name: 'Fruty njam', description: 'Kakavova: preliv gozdnih sadežev, vanilijev puding, rezine banane. Dekoracija: krema bele čokolade, preliv gozdnih sadežev, sveže borovnice, maline in jagode, koščki ruby čokolade', price: 9.70, categoryId: palacinke.id, sortOrder: 10, image: '/menu-images/palacinke/fruty-njam.png', modifierGroupIds: [] },
      { name: 'Sweet strawberry', description: 'Red Velvet: jagodni preliv, Lino Lada, vanilijev puding, mascarpone krema. Dekoracija: jagodni preliv, krema bele čokolade, sveže jagode, koščki bele čokolade', price: 9.70, categoryId: palacinke.id, sortOrder: 11, image: '/menu-images/palacinke/sweet-strawberry.png', modifierGroupIds: [] },
      { name: "M&M's", description: 'Kakavova: Nutella, čokoladni puding, vanilijev puding, crumble z belo čokolado. Dekoracija: Nutella, mleti baby in čokoladni piškoti, M&M bonboni', price: 9.70, categoryId: palacinke.id, sortOrder: 12, image: '/menu-images/palacinke/mms.png', modifierGroupIds: [] },

      // --- SLADICE ---
      { name: 'Hišna sladica', description: 'Priljubljena hišna sladica', price: 9.90, categoryId: sladice.id, sortOrder: 0, image: '/menu-images/sladice/hisna-sladica.png', modifierGroupIds: [] },
      { name: 'Panna cotta z jagodnim prelivom', description: 'Kremna panna cotta s svežim jagodnim prelivom', price: 4.90, categoryId: sladice.id, sortOrder: 1, image: '/menu-images/sladice/panna-cotta.png', modifierGroupIds: [] },
      { name: 'Palačinke s čokolado', description: 'Palačinke s čokoladnim prelivom', price: 4.50, categoryId: sladice.id, sortOrder: 2, image: '/menu-images/sladice/palacinke-cokolada.png', modifierGroupIds: [] },
      { name: 'Palačinke z orehi', description: 'Palačinke z orehi in smetano', price: 4.50, categoryId: sladice.id, sortOrder: 3, image: '/menu-images/sladice/palacinke-orehi.png', modifierGroupIds: [] },
      { name: 'Palačinke z marmelado', description: 'Palačinke z marmelado po izbiri', price: 4.50, categoryId: sladice.id, sortOrder: 4, image: '/menu-images/sladice/palacinke-marmelada.png', modifierGroupIds: [] },
      { name: 'Palačinke z brusnicami', description: 'Palačinke z brusničnim prelivom', price: 4.50, categoryId: sladice.id, sortOrder: 5, image: '/menu-images/sladice/palacinke-brusnice.png', modifierGroupIds: [] },
      { name: 'Palačinke z Nutello', description: 'Palačinke s Nutello', price: 4.50, categoryId: sladice.id, sortOrder: 6, image: '/menu-images/sladice/palacinke-nutella.png', modifierGroupIds: [] },
      { name: 'Palačinke z Nutello in banano', description: 'Palačinke s Nutello in svežo banano', price: 5.50, categoryId: sladice.id, sortOrder: 7, image: '/menu-images/sladice/palacinke-nutella-banana.png', modifierGroupIds: [] },
      { name: 'Palačinke z Nutello in orehi', description: 'Palačinke s Nutello in orehovim prelivom', price: 5.50, categoryId: sladice.id, sortOrder: 8, image: '/menu-images/sladice/palacinke-nutella-orehi.png', modifierGroupIds: [] },
      { name: 'Pehtranove palačinke', description: 'Pehtranove palačinke', price: 4.50, categoryId: sladice.id, sortOrder: 9, image: '/menu-images/sladice/palacinke-pehtran.png', modifierGroupIds: [] },
      { name: 'Skutine palačinke', description: 'Palačinke s skutnim nadevom', price: 4.50, categoryId: sladice.id, sortOrder: 10, image: '/menu-images/sladice/palacinke-skuta.png', modifierGroupIds: [] },
      { name: 'Hišna grmada', description: 'Hišna sladica grmada', price: 4.50, categoryId: sladice.id, sortOrder: 11, image: '/menu-images/sladice/hisna-grmada.png', modifierGroupIds: [] },
      { name: 'Sladoled kepica', description: 'Ena kepica sladoleda', price: 1.50, categoryId: sladice.id, sortOrder: 12, image: '/menu-images/sladice/sladoled-kepica.png', modifierGroupIds: [] },
      { name: 'Sladoled porcija', description: 'Porcija sladoleda z izbiro okusov', price: 4.50, categoryId: sladice.id, sortOrder: 13, image: '/menu-images/sladice/sladoled-porcija.png', modifierGroupIds: [] },
      { name: 'Sadna kupa', description: 'Sadna kupa s svežim sadjem', price: 5.20, categoryId: sladice.id, sortOrder: 14, image: '/menu-images/sladice/sadna-kupa.png', modifierGroupIds: [] },
      { name: 'Banana split', description: 'Banana split s sladoledom in prelivom', price: 4.50, categoryId: sladice.id, sortOrder: 15, image: '/menu-images/sladice/banana-split.png', modifierGroupIds: [] },
      { name: 'Vroče višnje s sladoledom', description: 'Vroče višnje z vaniljevim sladoledom', price: 4.50, categoryId: sladice.id, sortOrder: 16, image: '/menu-images/sladice/vroce-visnje.png', modifierGroupIds: [] },
      { name: 'Vroči gozdni sadeži s sladoledom', description: 'Vroči gozdni sadeži z vaniljevim sladoledom', price: 5.00, categoryId: sladice.id, sortOrder: 17, image: '/menu-images/sladice/vroci-gozdni-sadezi.png', modifierGroupIds: [] },
      { name: 'Nutelina torta z banano', description: 'Nutelina torta z banano', price: 5.50, categoryId: sladice.id, sortOrder: 18, image: '/menu-images/sladice/nutelina-torta.png', modifierGroupIds: [] },
      { name: 'Torte Hana', description: 'Torte Hana z različnimi okusi', price: 5.50, categoryId: sladice.id, sortOrder: 19, image: '/menu-images/sladice/torte-hana.png', modifierGroupIds: [] },
      { name: 'Linolada torta z banano', description: 'Linolada torta z banano', price: 5.50, categoryId: sladice.id, sortOrder: 20, image: '/menu-images/sladice/linolada-torta.png', modifierGroupIds: [] },
      { name: 'Čokoladni souffle', description: 'Čokoladni souffle s sladoledom in prelivom', price: 5.30, categoryId: sladice.id, sortOrder: 21, image: '/menu-images/sladice/cokoladni-souffle.png', modifierGroupIds: [] },
      { name: 'Tiramisu', description: 'Klasična italijanska kavnana sladica', price: 9.50, categoryId: sladice.id, sortOrder: 22, image: '/menu-images/sladice/tiramisu.png', modifierGroupIds: [] },
      { name: 'Sirovi štrukelj', description: 'Topel sirovi štrukelj s smetano', price: 7.90, categoryId: sladice.id, sortOrder: 23, image: '/menu-images/sladice/sirovi-strukelj.png', modifierGroupIds: [] },

      // --- OTROŠKE JEDI ---
      { name: 'Juha s palačinkami', description: 'Otroški meni - juha s palačinkami', price: 4.20, categoryId: outroskeJedi.id, sortOrder: 0, image: '/menu-images/otroske-jedi/juha-palacinke.png', modifierGroupIds: [] },
      { name: 'Krožnik Miškolin', description: 'Ocvrti sir, pommes frites, tatarska omaka', price: 9.00, categoryId: outroskeJedi.id, sortOrder: 1, image: '/menu-images/otroske-jedi/miskolin.png', modifierGroupIds: [] },
      { name: 'Krožnik Gusar Berto', description: 'Ocvrti oslič, pommes frites, tatarska omaka', price: 9.00, categoryId: outroskeJedi.id, sortOrder: 2, image: '/menu-images/otroske-jedi/gusar-berto.png', modifierGroupIds: [] },
      { name: 'Otroški pohančki', description: 'Ocvrto puranje ali piščančje meso, pommes frites, tatarska omaka', price: 9.00, categoryId: outroskeJedi.id, sortOrder: 3, image: '/menu-images/otroske-jedi/otroski-pohancki.png', modifierGroupIds: [] },
      { name: 'Krožnik Pingvinček', description: 'Ocvrti kalamari, pommes frites, tatarska omaka', price: 9.00, categoryId: outroskeJedi.id, sortOrder: 4, image: '/menu-images/otroske-jedi/pingvincek.png', modifierGroupIds: [] },
      { name: 'Krožnik Korenjak', description: 'Dunajski zrezek, pommes frites', price: 9.00, categoryId: outroskeJedi.id, sortOrder: 5, image: '/menu-images/otroske-jedi/korenjak.png', modifierGroupIds: [] },
      { name: 'Krožnik Špagetek', description: 'Špageti bolognese', price: 9.00, categoryId: outroskeJedi.id, sortOrder: 6, image: '/menu-images/otroske-jedi/spagetek.png', modifierGroupIds: [] },
      { name: 'Pizza Malček', description: 'Pelati, mozzarela, kuhan pršut, gobe, origano', price: 9.00, categoryId: outroskeJedi.id, sortOrder: 7, image: '/menu-images/otroske-jedi/pizza-malcek.png', modifierGroupIds: [] },
      { name: 'Pizza Jurček', description: 'Pelati, mozzarela, gobe, origano', price: 9.00, categoryId: outroskeJedi.id, sortOrder: 8, image: '/menu-images/otroske-jedi/pizza-jurcek.png', modifierGroupIds: [] },
      { name: 'Palačinke Metuljček', description: 'Sladke palačinke za otroke', price: 4.70, categoryId: outroskeJedi.id, sortOrder: 9, image: '/menu-images/otroske-jedi/metuljcek.png', modifierGroupIds: [] },
      { name: 'Kepica sladoleda', description: 'Kepica sladoleda s smetano', price: 1.90, categoryId: outroskeJedi.id, sortOrder: 10, image: '/menu-images/otroske-jedi/sladoled-otroski.png', modifierGroupIds: [] },
      { name: 'Sadna kupa s smetano', description: 'Sadna kupa s smetano', price: 4.80, categoryId: outroskeJedi.id, sortOrder: 11, image: '/menu-images/otroske-jedi/sadna-kupa-otroski.png', modifierGroupIds: [] },

      // --- MALICE (Dnevno kosilo) ---
      { name: 'Malica - Dunajski zrezek', description: 'Svinjski/puranji/piščančji dunajski zrezek, pommes frites, solata (200g)', price: 9.90, categoryId: malice.id, sortOrder: 0, image: '/menu-images/malice/malica-dunajski.png', modifierGroupIds: [] },
      { name: 'Malica - Pariški zrezek', description: 'Svinjski/puranji/piščančji pariški zrezek, pommes frites, solata (200g)', price: 9.90, categoryId: malice.id, sortOrder: 1, image: '/menu-images/malice/malica-pariski.png', modifierGroupIds: [] },
      { name: 'Malica - Pečena rebra', description: 'Pražen krompir, solata (400g)', price: 9.90, categoryId: malice.id, sortOrder: 2, image: '/menu-images/malice/malica-pecena-rebra.png', modifierGroupIds: [] },
      { name: 'Malica - BBQ perutničke', description: 'Pommes frites (400g)', price: 9.90, categoryId: malice.id, sortOrder: 3, image: '/menu-images/malice/malica-bbq-perutnicke.png', modifierGroupIds: [] },
      { name: 'Malica - Svinjska pečenka', description: 'Pražen krompir, solata (400g)', price: 10.20, categoryId: malice.id, sortOrder: 4, image: '/menu-images/malice/malica-svinjska-pecenka.png', modifierGroupIds: [] },
      { name: 'Malica - Ocvrti oslič', description: 'Krompirjeva solata, ob petkih s francosko solato (400g)', price: 10.20, categoryId: malice.id, sortOrder: 5, image: '/menu-images/malice/malica-ocvrti-oslic.png', modifierGroupIds: [] },
      { name: 'Malica - Ocvrti oslič s pomfrijem', description: 'Pommes frites, tatarska omaka, solata (300g)', price: 9.90, categoryId: malice.id, sortOrder: 6, image: '/menu-images/malice/malica-oslic-pomfri.png', modifierGroupIds: [] },
      { name: 'Malica - Ocvrti sir', description: 'Solata (200g)', price: 8.90, categoryId: malice.id, sortOrder: 7, image: '/menu-images/malice/malica-ocvrti-sir.png', modifierGroupIds: [] },
      { name: 'Malica - Špageti bolognese', description: 'Špageti z bolognese omako (200g)', price: 8.90, categoryId: malice.id, sortOrder: 8, image: '/menu-images/malice/malica-spageti-bolognese.png', modifierGroupIds: [] },
      { name: 'Malica - Mesni sir', description: 'Polnjen s sirom in šampinjoni, kruhova rezina, solata (200g)', price: 9.90, categoryId: malice.id, sortOrder: 9, image: '/menu-images/malice/malica-mesni-sir.png', modifierGroupIds: [] },
      { name: 'Malica - Bograč', description: 'Bograč v kotličku', price: 9.00, categoryId: malice.id, sortOrder: 10, image: '/menu-images/malice/malica-bograc.png', modifierGroupIds: [] },
      { name: 'Malica - Goveji golaž', description: 'Goveji golaž s kruhovo rezino', price: 10.00, categoryId: malice.id, sortOrder: 11, image: '/menu-images/malice/malica-goveji-golaz.png', modifierGroupIds: [] },

      // --- PRILOGE ---
      { name: 'Krompirjev čips', description: 'Hrustljavi čips', price: 4.00, categoryId: priloge.id, sortOrder: 0, image: '/menu-images/priloge/krompirjev-cips.png', modifierGroupIds: [] },
      { name: 'Pommes frites', description: 'Hrustljavi pomfri', price: 4.00, categoryId: priloge.id, sortOrder: 1, image: '/menu-images/priloge/pommes-frites.png', modifierGroupIds: [sauceChoice.id] },
      { name: 'Žlebasti krompirček', description: 'Žlebasti krompirček', price: 4.00, categoryId: priloge.id, sortOrder: 2, image: '/menu-images/priloge/zlebasti-krompircek.png', modifierGroupIds: [] },
      { name: 'Krompirjevi ocvrtki', description: 'Krompirjevi ocvrtki', price: 4.00, categoryId: priloge.id, sortOrder: 3, image: '/menu-images/priloge/krompirjevi-ocvrtki.png', modifierGroupIds: [] },
      { name: 'Slan krompir', description: 'Slan krompir', price: 4.00, categoryId: priloge.id, sortOrder: 4, image: '/menu-images/priloge/slan-krompir.png', modifierGroupIds: [] },
      { name: 'Pražen krompir', description: 'Pražen krompir', price: 4.00, categoryId: priloge.id, sortOrder: 5, image: '/menu-images/priloge/prazen-krompir.png', modifierGroupIds: [] },
      { name: 'Pečen krompir', description: 'Pečen krompir', price: 4.00, categoryId: priloge.id, sortOrder: 6, image: '/menu-images/priloge/pecen-krompir.png', modifierGroupIds: [] },
      { name: 'Kuhan popečen krompir', description: 'Kuhan popečen krompir', price: 4.00, categoryId: priloge.id, sortOrder: 7, image: '/menu-images/priloge/kuhan-popecen-krompir.png', modifierGroupIds: [] },
      { name: 'Riž', description: 'Riž', price: 3.50, categoryId: priloge.id, sortOrder: 8, image: '/menu-images/priloge/riz.png', modifierGroupIds: [] },
      { name: 'Kuhana zelenjava', description: 'Kuhana zelenjava', price: 3.90, categoryId: priloge.id, sortOrder: 9, image: '/menu-images/priloge/kuhana-zelenjava.png', modifierGroupIds: [] },
      { name: 'Ocvrti njoki', description: 'Ocvrti njoki', price: 4.50, categoryId: priloge.id, sortOrder: 10, image: '/menu-images/priloge/ocvrti-njoki.png', modifierGroupIds: [] },
      { name: 'Kuhani njoki', description: 'Kuhani njoki', price: 4.50, categoryId: priloge.id, sortOrder: 11, image: '/menu-images/priloge/kuhani-njoki.png', modifierGroupIds: [] },
      { name: 'Sirov štrukelj', description: 'Sirov štrukelj', price: 3.70, categoryId: priloge.id, sortOrder: 12, image: '/menu-images/priloge/sirov-strukelj.png', modifierGroupIds: [] },
      { name: 'Široki rezanci', description: 'Široki rezanci', price: 3.50, categoryId: priloge.id, sortOrder: 13, image: '/menu-images/priloge/siroki-rezanci.png', modifierGroupIds: [] },
      { name: 'Bučke na žaru s česnom', description: 'Bučke na žaru s česnom in olivnim oljem', price: 4.90, categoryId: priloge.id, sortOrder: 14, image: '/menu-images/priloge/bucke-zar-cesen.png', modifierGroupIds: [] },
      { name: 'Ocvrte bučke', description: 'Ocvrte bučke', price: 4.90, categoryId: priloge.id, sortOrder: 15, image: '/menu-images/priloge/ocvrte-bucke.png', modifierGroupIds: [] },
      { name: 'Pečena sveža zelenjava', description: 'Pečena sveža zelenjava', price: 4.90, categoryId: priloge.id, sortOrder: 16, image: '/menu-images/priloge/pecena-zelenjava.png', modifierGroupIds: [] },
      { name: 'Trdi sir Grana Padano', description: 'Trdi sir Grana Padano', price: 2.50, categoryId: priloge.id, sortOrder: 17, image: '/menu-images/priloge/grana-padano.png', modifierGroupIds: [] },

      // --- OMAKE ---
      { name: 'Poprova omaka', description: 'Poprova omaka', price: 3.90, categoryId: omake.id, sortOrder: 0, image: '/menu-images/omake/poprova-omaka.png', modifierGroupIds: [] },
      { name: 'Gobova omaka', description: 'Gobova omaka', price: 3.90, categoryId: omake.id, sortOrder: 1, image: '/menu-images/omake/gobova-omaka.png', modifierGroupIds: [] },
      { name: 'Smetanova omaka', description: 'Smetanova omaka', price: 3.90, categoryId: omake.id, sortOrder: 2, image: '/menu-images/omake/smetanova-omaka.png', modifierGroupIds: [] },
      { name: 'Orehova omaka', description: 'Orehova omaka', price: 3.90, categoryId: omake.id, sortOrder: 3, image: '/menu-images/omake/orehova-omaka.png', modifierGroupIds: [] },
      { name: 'Gorgonzolna omaka', description: 'Gorgonzolna omaka', price: 3.90, categoryId: omake.id, sortOrder: 4, image: '/menu-images/omake/gorgonzolna-omaka.png', modifierGroupIds: [] },
      { name: 'Gozdarska omaka', description: 'Gozdarska omaka', price: 3.90, categoryId: omake.id, sortOrder: 5, image: '/menu-images/omake/gozdarska-omaka.png', modifierGroupIds: [] },
      { name: 'Sirova omaka', description: 'Sirova omaka', price: 3.90, categoryId: omake.id, sortOrder: 6, image: '/menu-images/omake/sirova-omaka.png', modifierGroupIds: [] },
      { name: 'Curry omaka', description: 'Curry omaka', price: 3.90, categoryId: omake.id, sortOrder: 7, image: '/menu-images/omake/curry-omaka.png', modifierGroupIds: [] },
      { name: 'Gorčična omaka', description: 'Gorčična omaka', price: 3.90, categoryId: omake.id, sortOrder: 8, image: '/menu-images/omake/gorcicna-omaka.png', modifierGroupIds: [] },

      // ============================================
      // PIJAČA - WINE CARD & DRINKS PRICE LIST
      // ============================================

      // --- PENINE IN ŠAMPANJCI ---
      { name: 'No.1 Brut', description: 'Chardonnay, rumeni plavec | Istenič, Bizeljsko-Sremič, Posavje | Zelo suho', price: 40.00, image: '/menu-images/penine/no1-brut.png', categoryId: penine.id, sortOrder: 0, modifierGroupIds: [] },
      { name: 'Domaine Slapšak Brut Reserve', description: 'Žametna črnina, modri pinot | Domaine Slapšak, Dolenjska, Posavje | Zelo suho', price: 45.00, image: '/menu-images/penine/slapsak-brut-reserve.png', categoryId: penine.id, sortOrder: 1, modifierGroupIds: [] },
      { name: 'Domaine Slapšak Brut Rosé', description: '100% žametna črnina | Domaine Slapšak, Dolenjska, Posavje | Zelo suho', price: 45.00, image: '/menu-images/penine/slapsak-brut-rose.png', categoryId: penine.id, sortOrder: 2, modifierGroupIds: [] },
      { name: 'Penina Gourmet Rosé', description: '100% modri pinot | Klet Istenič, Bizeljsko-Sremič, Posavje | Suho', price: 40.00, image: '/menu-images/penine/gourmet-rose.png', categoryId: penine.id, sortOrder: 3, modifierGroupIds: [] },
      { name: 'Zlata Radgonska Penina Brut Selection', description: 'Chardonnay | Radgonske gorice, Gornja radgona, Štajerska, Podravje | Zelo suho', price: 36.00, image: '/menu-images/penine/zlata-radgonska.png', categoryId: penine.id, sortOrder: 4, modifierGroupIds: [] },
      { name: 'Maria Brut 2020', description: 'Chardonnay, rumeni plavec, kraljevina | Vinarstvo Kerin, Dolenjska, Posavje | Zelo suho', price: 35.00, image: '/menu-images/penine/maria-brut.png', categoryId: penine.id, sortOrder: 5, modifierGroupIds: [] },
      { name: 'Penina Boemme Rumeni Muškat', description: 'Hiša vin Emino, Štajerska Slovenija | Polsuho', price: 35.00, image: '/menu-images/penine/boemme-rumeni-muskat.png', categoryId: penine.id, sortOrder: 6, modifierGroupIds: [] },
      { name: 'Bjana Brut', description: 'Chardonnay, modri pinot | Bjana, Miran Sirk, Goriška Brda, Primorska | Zelo suho', price: 55.00, image: '/menu-images/penine/bjana-brut.png', categoryId: penine.id, sortOrder: 7, modifierGroupIds: [] },
      { name: 'Mufi Pet Nat Brut Nature 2023', description: 'Rumeni muškat, rumeni plavec | Ekološko, Keltis, Bizeljsko-Sremič, Posavje | Izredno suho', price: 35.00, image: '/menu-images/penine/mufi-pet-nat.png', categoryId: penine.id, sortOrder: 8, modifierGroupIds: [] },
      { name: 'Champagne Louis Roederer Collection 244 Brut', description: 'Chardonnay, pinot noir, pinot meunier | Louis Roederer, Reims, Francija | Zelo suho', price: 102.00, image: '/menu-images/penine/louis-roederer.png', categoryId: penine.id, sortOrder: 9, modifierGroupIds: [] },
      { name: 'Champagne Pol Roger Brut Reserve', description: 'Chardonnay, modri pinot, pinot meunier | Epernay, Francija | Zelo suho', price: 102.00, image: '/menu-images/penine/pol-roger.png', categoryId: penine.id, sortOrder: 10, modifierGroupIds: [] },
      { name: 'Moët & Chandon Imperial Brut', description: 'Pinot noir, pinot meunier, chardonnay | Moët&Chandon, Epernay, Francija | Zelo suho', price: 95.00, image: '/menu-images/penine/moet-chandon.png', categoryId: penine.id, sortOrder: 11, modifierGroupIds: [] },
      { name: 'Dom Pérignon Brut 2013', description: 'Chardonnay, modri pinot | Epernay, Francija | Zelo suho', price: 390.00, image: '/menu-images/penine/dom-perignon.png', categoryId: penine.id, sortOrder: 12, modifierGroupIds: [] },

      // --- BELA VINA ---
      { name: 'Cuvee Emino 2022 (kozarec)', description: 'Laški rizling, chardonnay, sauvignon | Hiša vin Emino, Šmarje pri Jelšah, Štajerska | Suho | 0.10L', price: 3.00, image: '/menu-images/bela-vina/cuvee-emino-kozarec.png', categoryId: belaVina.id, sortOrder: 0, modifierGroupIds: [] },
      { name: 'Cuvee Emino 2022 (steklenica)', description: 'Laški rizling, chardonnay, sauvignon | Hiša vin Emino, Šmarje pri Jelšah, Štajerska | Suho | 0.75L', price: 21.00, image: '/menu-images/bela-vina/cuvee-emino-steklenica.png', categoryId: belaVina.id, sortOrder: 1, modifierGroupIds: [] },
      { name: 'Chardonnay Verus 2023', description: 'Verus, Štajerska Slovenija, Podravje | Suho | 0.75L', price: 35.00, image: '/menu-images/bela-vina/chardonnay-verus.png', categoryId: belaVina.id, sortOrder: 2, modifierGroupIds: [] },
      { name: 'Sauvignon Blanc Cru Veliki Vrh 2023', description: 'Familija Brodnjak, Haloze, Štajerska Slovenija, Podravje | Suho | 0.75L', price: 42.00, image: '/menu-images/bela-vina/sauvignon-blanc-cru.png', categoryId: belaVina.id, sortOrder: 3, modifierGroupIds: [] },
      { name: 'Laški Rizling 2021', description: 'Janez Colnar, Dolenjska | Suho | 0.75L', price: 35.00, image: '/menu-images/bela-vina/laski-rizling.png', categoryId: belaVina.id, sortOrder: 4, modifierGroupIds: [] },
      { name: 'Traminec 2023', description: 'Butična klet Keltis, Bizeljsko-Sremič, Posavje | Suho | 0.75L', price: 39.00, image: '/menu-images/bela-vina/traminec.png', categoryId: belaVina.id, sortOrder: 5, modifierGroupIds: [] },
      { name: 'Rebula 2022', description: 'Borut Blažič, Goriška Brda, Primorska | Suho | 0.75L', price: 35.00, image: '/menu-images/bela-vina/rebula.png', categoryId: belaVina.id, sortOrder: 6, modifierGroupIds: [] },
      { name: 'Chardonnay Dular 2022', description: 'Ekološko vino | Klet Dular, Bizeljsko-Sremič, Posavje | Suho | 0.75L', price: 50.00, image: '/menu-images/bela-vina/chardonnay-dular.png', categoryId: belaVina.id, sortOrder: 7, modifierGroupIds: [] },
      { name: 'Chardonnay Domaine Vicomte de Noue 2020', description: 'Marinčič Tejca, Vedrignano II Cru, Goriška Brda, Primorska | Suho | 0.75L', price: 120.00, image: '/menu-images/bela-vina/chardonnay-vicomte.png', categoryId: belaVina.id, sortOrder: 8, modifierGroupIds: [] },
      { name: 'Šipon Verus 2022', description: 'Verus, Štajerska Slovenija, Podravje | Suho | 0.75L', price: 35.00, image: '/menu-images/bela-vina/sipon-verus.png', categoryId: belaVina.id, sortOrder: 9, modifierGroupIds: [] },
      { name: 'Sivi Pinot Jamertal 2021', description: 'Valdhuber, Štajerska Slovenija, Podravje | Suho | 0.75L', price: 38.00, image: '/menu-images/bela-vina/sivi-pinot-jamertal.png', categoryId: belaVina.id, sortOrder: 10, modifierGroupIds: [] },
      { name: 'Renski Rizling Stare Trte 2015', description: 'Dveri-Pax, Štajerska Slovenija, Podravje | Suho | 0.75L', price: 39.00, image: '/menu-images/bela-vina/renski-rizling-stare.png', categoryId: belaVina.id, sortOrder: 11, modifierGroupIds: [] },
      { name: 'Renski Rizling Keltis 2021', description: 'Ekološko vino | Keltis, Bizeljsko-Sremič, Posavje | Suho | 0.75L', price: 44.00, image: '/menu-images/bela-vina/renski-rizling-keltis.png', categoryId: belaVina.id, sortOrder: 12, modifierGroupIds: [] },
      { name: 'Alter 2021', description: 'Ekološko vino | Renski rizling, laški rizling, sivi pinot | Kmetija Šumenjak, Štajerska, Podravje | Suho | 0.75L', price: 42.00, image: '/menu-images/bela-vina/alter.png', categoryId: belaVina.id, sortOrder: 13, modifierGroupIds: [] },
      { name: 'Malvazija Malval Movia 2023', description: 'Movia, Goriška Brda, Primorska | Suho | 0.75L', price: 36.00, image: '/menu-images/bela-vina/malvazija-movia.png', categoryId: belaVina.id, sortOrder: 14, modifierGroupIds: [] },
      { name: 'Rebula Cru Selection 2021', description: 'Marjan Simčič, Goriška Brda, Primorska | Suho | 0.75L', price: 55.00, image: '/menu-images/bela-vina/rebula-cru.png', categoryId: belaVina.id, sortOrder: 15, modifierGroupIds: [] },
      { name: 'Burja Bela 2022', description: 'Ekološko Demeter | Malvazija, laški rizling, rebula | Posestvo Burja, Vipavska dolina, Primorska | Suho | 0.75L', price: 40.00, image: '/menu-images/bela-vina/burja-bela.png', categoryId: belaVina.id, sortOrder: 16, modifierGroupIds: [] },
      { name: 'Angel Belo Grande Cuvee 2021', description: 'Ekološko vino | Chardonnay, sauvignon, pinela, laški rizling, sivi pinot | Klet Batič, Vipavska dolina, Primorska | Suho | 0.75L', price: 66.00, image: '/menu-images/bela-vina/angel-belo-2021.png', categoryId: belaVina.id, sortOrder: 17, modifierGroupIds: [] },
      { name: 'Angel Belo Grande Cuvee 2019', description: 'Ekološko vino | Chardonnay, sauvignon, pinela, laški rizling, sivi pinot | Klet Batič, Vipavska dolina, Primorska | Suho | 3.00L', price: 280.00, image: '/menu-images/bela-vina/angel-belo-2019.png', categoryId: belaVina.id, sortOrder: 18, modifierGroupIds: [] },
      { name: 'Rumeni Muškat 2023 (kozarec)', description: 'Klet Dular, Bizeljsko-Sremič, Posavje | Polsladko | 0.10L', price: 4.50, image: '/menu-images/bela-vina/rumeni-muskat-kozarec.png', categoryId: belaVina.id, sortOrder: 19, modifierGroupIds: [] },
      { name: 'Rumeni Muškat 2023 (steklenica)', description: 'Klet Dular, Bizeljsko-Sremič, Posavje | Polsladko | 0.75L', price: 30.00, image: '/menu-images/bela-vina/rumeni-muskat-steklenica.png', categoryId: belaVina.id, sortOrder: 20, modifierGroupIds: [] },
      { name: 'Rumeni Muškat Pozna Trgatev 2019 (kozarec)', description: 'Klet Prus, Metlika, Bela Krajina, Posavje | Sladko | 0.10L', price: 6.50, image: '/menu-images/bela-vina/rumeni-muskat-pozna-kozarec.png', categoryId: belaVina.id, sortOrder: 21, modifierGroupIds: [] },
      { name: 'Rumeni Muškat Pozna Trgatev 2019 (steklenica)', description: 'Klet Prus, Metlika, Bela Krajina, Posavje | Sladko | 0.75L', price: 38.00, image: '/menu-images/bela-vina/rumeni-muskat-pozna-steklenica.png', categoryId: belaVina.id, sortOrder: 22, modifierGroupIds: [] },
      { name: 'Bela Frankinja 2023 (kozarec)', description: 'Klet Dular, Bizeljsko-Sremič, Posavje | Polsladko | 0.10L', price: 5.00, image: '/menu-images/bela-vina/bela-frankinja-kozarec.png', categoryId: belaVina.id, sortOrder: 23, modifierGroupIds: [] },
      { name: 'Bela Frankinja 2023 (steklenica)', description: 'Klet Dular, Bizeljsko-Sremič, Posavje | Polsladko | 0.75L', price: 35.00, image: '/menu-images/bela-vina/bela-frankinja-steklenica.png', categoryId: belaVina.id, sortOrder: 24, modifierGroupIds: [] },

      // --- ROSÉ VINO ---
      { name: 'Rosé Batič 2024', description: 'Cabernet sauvignon | Batič, Vipavska dolina, Primorska | Polsuho | 0.75L', price: 43.00, image: '/menu-images/rose-vino/rose-batic.png', categoryId: roseVino.id, sortOrder: 0, modifierGroupIds: [] },
      { name: 'Rosé Verstovšek Estate 2024 (kozarec)', description: 'Modra frankinja | Verstovšek Estate, Bizeljsko-Sremič, Posavje | Suho | 0.10L', price: 4.80, image: '/menu-images/rose-vino/rose-verstovsek-kozarec.png', categoryId: roseVino.id, sortOrder: 1, modifierGroupIds: [] },
      { name: 'Rosé Verstovšek Estate 2024 (steklenica)', description: 'Modra frankinja | Verstovšek Estate, Bizeljsko-Sremič, Posavje | Suho | 0.75L', price: 35.00, image: '/menu-images/rose-vino/rose-verstovsek-steklenica.png', categoryId: roseVino.id, sortOrder: 2, modifierGroupIds: [] },

      // --- RDEČA VINA ---
      { name: 'Modra Frankinja Emino 2023 (kozarec)', description: 'Hiša vin Emino, Šmarje pri Jelšah, Štajerska | Suho | 0.10L', price: 3.00, image: '/menu-images/rdeca-vina/modra-frankinja-emino-kozarec.png', categoryId: rdecaVina.id, sortOrder: 0, modifierGroupIds: [] },
      { name: 'Modra Frankinja Emino 2023 (steklenica)', description: 'Hiša vin Emino, Šmarje pri Jelšah, Štajerska | Suho | 0.75L', price: 21.00, image: '/menu-images/rdeca-vina/modra-frankinja-emino-steklenica.png', categoryId: rdecaVina.id, sortOrder: 1, modifierGroupIds: [] },
      { name: 'Modra Frankinja Dular 2023', description: 'Klet Dular, Bizeljsko-Sremič, Posavje | Suho | 0.75L', price: 30.00, image: '/menu-images/rdeca-vina/modra-frankinja-dular.png', categoryId: rdecaVina.id, sortOrder: 2, modifierGroupIds: [] },
      { name: 'Modra Frankinja Luna 2021', description: 'Kmetija Kobal, Bizeljsko-Sremič, Posavje | Suho | 0.75L', price: 68.00, image: '/menu-images/rdeca-vina/modra-frankinja-luna.png', categoryId: rdecaVina.id, sortOrder: 3, modifierGroupIds: [] },
      { name: 'Modri Pinot Verus 2019', description: 'Verus, Ormož, Štajerska Slovenija, Podravje | Suho | 0.75L', price: 38.00, image: '/menu-images/rdeca-vina/modri-pinot-verus.png', categoryId: rdecaVina.id, sortOrder: 4, modifierGroupIds: [] },
      { name: 'Modri Pinot Opoka 2020', description: 'Marjan Simčič, Goriška Brda, Primorska | Suho | 0.75L', price: 95.00, image: '/menu-images/rdeca-vina/modri-pinot-opoka.png', categoryId: rdecaVina.id, sortOrder: 5, modifierGroupIds: [] },
      { name: 'Merlot Keltis 2018', description: 'Butična klet Keltis, Bizeljsko-Sremič, Posavje | Suho | 0.75L', price: 48.00, image: '/menu-images/rdeca-vina/merlot-keltis.png', categoryId: rdecaVina.id, sortOrder: 6, modifierGroupIds: [] },
      { name: 'Merlot Opoka 2019', description: 'Marjan Simčič, Goriška Brda, Primorska | Suho | 0.75L', price: 112.00, image: '/menu-images/rdeca-vina/merlot-opoka.png', categoryId: rdecaVina.id, sortOrder: 7, modifierGroupIds: [] },
      { name: 'Cabernet Sauvignon Keltis 2018', description: 'Butična klet Keltis, Bizeljsko-Sremič, Posavje | Suho | 0.75L', price: 48.00, image: '/menu-images/rdeca-vina/cabernet-keltis.png', categoryId: rdecaVina.id, sortOrder: 8, modifierGroupIds: [] },
      { name: 'Cabernet Sauvignon Pavo Limited Edition 2021', description: 'Dušan Kristančič, Goriška Brda, Primorska | Suho | 0.75L', price: 87.00, image: '/menu-images/rdeca-vina/cabernet-pavo.png', categoryId: rdecaVina.id, sortOrder: 9, modifierGroupIds: [] },
      { name: 'Guerila Retro Selection 2020', description: 'Merlot, cabernet sauvignon, barbera | Klet Guerila, Vipavska dolina, Primorska | Suho | 0.75L', price: 50.00, image: '/menu-images/rdeca-vina/guerila-retro.png', categoryId: rdecaVina.id, sortOrder: 10, modifierGroupIds: [] },
      { name: 'Duet Edi Simčič 2021', description: 'Merlot, cabernet sauvignon, cabernet franc | Edi Simčič, Goriška Brda, Primorska | Suho | 0.75L', price: 64.00, image: '/menu-images/rdeca-vina/duet-edi-simcic.png', categoryId: rdecaVina.id, sortOrder: 11, modifierGroupIds: [] },
      { name: 'Duet Lex Edi Simčič 2018', description: 'Merlot, cabernet sauvignon, cabernet franc | Edi Simčič, Goriška Brda, Primorska | Suho | 1.50L', price: 200.00, image: '/menu-images/rdeca-vina/duet-lex-2018.png', categoryId: rdecaVina.id, sortOrder: 12, modifierGroupIds: [] },
      { name: 'Duet Lex Edi Simčič 2020', description: 'Merlot, cabernet sauvignon, cabernet franc | Edi Simčič, Goriška Brda, Primorska | Suho | 0.75L', price: 95.00, image: '/menu-images/rdeca-vina/duet-lex-2020.png', categoryId: rdecaVina.id, sortOrder: 13, modifierGroupIds: [] },
      { name: 'Carolina Rdeča 2018', description: 'Cabernet sauvignon, cabernet franc, merlot | Kmetija Jakončič, Goriška Brda, Primorska | Suho | 0.75L', price: 71.00, image: '/menu-images/rdeca-vina/carolina-rdeca.png', categoryId: rdecaVina.id, sortOrder: 14, modifierGroupIds: [] },
      { name: 'Veliko Rdeče Movia 2015', description: 'Merlot, cabernet sauvignin, modri pinot | Klet Movia, Goriška Brda, Primorska | Suho | 0.75L', price: 93.00, image: '/menu-images/rdeca-vina/veliko-rdece-movia.png', categoryId: rdecaVina.id, sortOrder: 15, modifierGroupIds: [] },

      // --- TUJA VINA ---
      { name: 'Pošip Premium Terra Madre 2021', description: 'Belo | Terra Madre, Južna Dalmacija, Hrvaška | Suho | 0.75L', price: 30.00, image: '/menu-images/tuja-vina/posip-terra-madre.png', categoryId: tujaVina.id, sortOrder: 0, modifierGroupIds: [] },
      { name: 'Andreis Vinasmora 2020', description: 'Rdeče | Babič, Vinasmora, Primošten, Hrvaška | Suho | 0.75L', price: 30.00, image: '/menu-images/tuja-vina/andreis-vinasmora.png', categoryId: tujaVina.id, sortOrder: 1, modifierGroupIds: [] },
      { name: 'Plavac Mali Premium Terra Madre 2017', description: 'Rdeče | Terra Madre, Južna Dalmacija, Hrvaška | Suho | 0.75L', price: 48.00, image: '/menu-images/tuja-vina/plavac-mali-terra-madre.png', categoryId: tujaVina.id, sortOrder: 2, modifierGroupIds: [] },
      { name: 'Vranec Instinct 2019', description: 'Rdeče | Puklavec Family, Makedonija | Suho | 0.75L', price: 30.00, image: '/menu-images/tuja-vina/vranec-instinct.png', categoryId: tujaVina.id, sortOrder: 3, modifierGroupIds: [] },
      { name: 'Chardonnay Where Dreams Have No End 2021', description: 'Belo | Jermann, Friuli Venezia Giulia, Italija | Suho | 0.75L', price: 110.00, image: '/menu-images/tuja-vina/jermann-dreams.png', categoryId: tujaVina.id, sortOrder: 4, modifierGroupIds: [] },
      { name: 'Vintage Tunina 2022', description: 'Belo | Sauvignon, chardonnay, rebula gialla, malvazija | Jermann, Friuli Venezia Giulia, Italija | Suho | 0.75L', price: 110.00, image: '/menu-images/tuja-vina/vintage-tunina.png', categoryId: tujaVina.id, sortOrder: 5, modifierGroupIds: [] },

      // --- LIKERSKO VINO ---
      { name: 'Keros Belo 2020 (0.05L)', description: 'Traminec | Vinarstvo Kerin, Straža nad Krškim, Dolenjska, Posavje | Sladko', price: 4.50, image: '/menu-images/likersko-vino/keros-belo-005.png', categoryId: likerskoVino.id, sortOrder: 0, modifierGroupIds: [] },
      { name: 'Keros Belo 2020 (0.50L)', description: 'Traminec | Vinarstvo Kerin, Straža nad Krškim, Dolenjska, Posavje | Sladko', price: 45.00, image: '/menu-images/likersko-vino/keros-belo-050.png', categoryId: likerskoVino.id, sortOrder: 1, modifierGroupIds: [] },
      { name: 'Keros Rdeče 2018 (0.05L)', description: 'Modra frankinja | Vinarstvo Kerin, Straža nad Krškim, Dolenjska, Posavje | Sladko', price: 4.50, image: '/menu-images/likersko-vino/keros-rdece-005.png', categoryId: likerskoVino.id, sortOrder: 2, modifierGroupIds: [] },
      { name: 'Keros Rdeče 2018 (0.50L)', description: 'Modra frankinja | Vinarstvo Kerin, Straža nad Krškim, Dolenjska, Posavje | Sladko', price: 45.00, image: '/menu-images/likersko-vino/keros-rdece-050.png', categoryId: likerskoVino.id, sortOrder: 3, modifierGroupIds: [] },
      { name: 'Veliko Rdeče Movia 2012', description: 'Merlot, cabernet sauvignin, modri pinot | Klet Movia, Goriška Brda, Primorska | Suho | 3.00L', price: 360.00, image: '/menu-images/likersko-vino/veliko-rdece-2012.png', categoryId: likerskoVino.id, sortOrder: 4, modifierGroupIds: [] },
      { name: 'Sladki Refošk (kozarec)', description: 'Vina Koper, Slovenska Istra, Primorska | Sladko | 0.10L', price: 5.00, image: '/menu-images/likersko-vino/sladki-refosk-kozarec.png', categoryId: likerskoVino.id, sortOrder: 5, modifierGroupIds: [] },
      { name: 'Sladki Refošk (0.50L)', description: 'Vina Koper, Slovenska Istra, Primorska | Sladko | 0.50L', price: 25.00, image: '/menu-images/likersko-vino/sladki-refosk-050.png', categoryId: likerskoVino.id, sortOrder: 6, modifierGroupIds: [] },

      // --- TOČENO PIVO ---
      { name: 'Pivo Haler Lager Nefiltriran (0.30L)', description: 'Pivovarna Haler | 0.30L', price: 3.70, image: '/menu-images/toceno-pivo/haler-nefiltriran-03.png', categoryId: tocenoPivo.id, sortOrder: 0, modifierGroupIds: [] },
      { name: 'Pivo Haler Lager Nefiltriran (0.50L)', description: 'Pivovarna Haler | 0.50L', price: 4.00, image: '/menu-images/toceno-pivo/haler-nefiltriran-05.png', categoryId: tocenoPivo.id, sortOrder: 1, modifierGroupIds: [] },
      { name: 'Pivo Laško Lager (0.30L)', description: 'Pivovarna Laško | 0.30L', price: 3.70, image: '/menu-images/toceno-pivo/lasko-lager-03.png', categoryId: tocenoPivo.id, sortOrder: 2, modifierGroupIds: [] },
      { name: 'Pivo Laško Lager (0.50L)', description: 'Pivovarna Laško | 0.50L', price: 4.00, image: '/menu-images/toceno-pivo/lasko-lager-05.png', categoryId: tocenoPivo.id, sortOrder: 3, modifierGroupIds: [] },
      { name: 'Pivo Union Lager (0.30L)', description: 'Pivovarna Union | 0.30L', price: 3.70, image: '/menu-images/toceno-pivo/union-lager-03.png', categoryId: tocenoPivo.id, sortOrder: 4, modifierGroupIds: [] },
      { name: 'Pivo Union Lager (0.50L)', description: 'Pivovarna Union | 0.50L', price: 4.00, image: '/menu-images/toceno-pivo/union-lager-05.png', categoryId: tocenoPivo.id, sortOrder: 5, modifierGroupIds: [] },
      { name: 'Pelicon 3rd Pill IPA (0.30L)', description: 'Indian Pale Ale | Pivovarna Pelicon | 0.30L', price: 4.50, image: '/menu-images/toceno-pivo/pelicon-ipa-03.png', categoryId: tocenoPivo.id, sortOrder: 6, modifierGroupIds: [] },
      { name: 'Pelicon 3rd Pill IPA (0.50L)', description: 'Indian Pale Ale | Pivovarna Pelicon | 0.50L', price: 5.90, image: '/menu-images/toceno-pivo/pelicon-ipa-05.png', categoryId: tocenoPivo.id, sortOrder: 7, modifierGroupIds: [] },
      { name: 'Radler Grenivka (0.30L)', description: 'Grapefruit | Samo poleti | Pivovarna Union | 0.30L', price: 3.70, image: '/menu-images/toceno-pivo/radler-03.png', categoryId: tocenoPivo.id, sortOrder: 8, modifierGroupIds: [] },
      { name: 'Radler Grenivka (0.50L)', description: 'Grapefruit | Samo poleti | Pivovarna Union | 0.50L', price: 4.00, image: '/menu-images/toceno-pivo/radler-05.png', categoryId: tocenoPivo.id, sortOrder: 9, modifierGroupIds: [] },

      // --- PIVO ---
      { name: 'Reset Lagerish Cream Ale (0.50L)', description: 'Pivovarna Reset, Brežice | 0.50L', price: 5.90, image: '/menu-images/pivo/reset-lagerish.png', categoryId: pivo.id, sortOrder: 0, modifierGroupIds: [] },
      { name: 'Reset Froggy IPA (0.50L)', description: 'Indian Pale Ale | Pivovarna Reset, Brežice | 0.50L', price: 5.90, image: '/menu-images/pivo/reset-froggy.png', categoryId: pivo.id, sortOrder: 1, modifierGroupIds: [] },
      { name: 'Reset Irish Extra Stout (0.50L)', description: 'Temno | Pivovarna Reset, Brežice | 0.50L', price: 5.90, image: '/menu-images/pivo/reset-stout.png', categoryId: pivo.id, sortOrder: 2, modifierGroupIds: [] },

      // --- CRAFT PIVA ---
      { name: 'Pelicon Winter (0.75L)', description: 'Temno | Pivovarna Pelicon | 0.75L', price: 15.00, image: '/menu-images/craft-piva/pelicon-winter.png', categoryId: craftPiva.id, sortOrder: 0, modifierGroupIds: [] },
      { name: 'Zeleni Haler Lager s Konopljo (0.50L)', description: 'Pivovarna Haler | 0.50L', price: 5.90, image: '/menu-images/craft-piva/zeleni-haler.png', categoryId: craftPiva.id, sortOrder: 1, modifierGroupIds: [] },
      { name: 'Bevog Tak Pale Ale (0.33L)', description: 'Pivovarna Bevog | 0.33L', price: 5.00, image: '/menu-images/craft-piva/bevog-tak.png', categoryId: craftPiva.id, sortOrder: 2, modifierGroupIds: [] },

      // --- BREZALKOHOLNO PIVO ---
      { name: 'Heineken 0.0 (0.33L)', description: 'Brezalkoholno | Pivovarna Heineken | 0.33L', price: 4.20, image: '/menu-images/brezalk-pivo/heineken-00.png', categoryId: brezalkPivo.id, sortOrder: 0, modifierGroupIds: [] },
      { name: 'Daura Lager (0.33L)', description: 'Brezglutensko | Estrella Damm, Španija | 0.33L', price: 4.90, image: '/menu-images/brezalk-pivo/daura.png', categoryId: brezalkPivo.id, sortOrder: 1, modifierGroupIds: [] },

      // --- VISKI ---
      { name: 'Chivas 12yo', description: 'Škotski, blended | 0.03L', price: 5.20, image: '/menu-images/viski/chivas-12.png', categoryId: viski.id, sortOrder: 0, modifierGroupIds: [iceChoice.id] },
      { name: 'Johnnie Walker Black', description: 'Škotska, blended | 0.03L', price: 6.50, image: '/menu-images/viski/johnnie-walker-black.png', categoryId: viski.id, sortOrder: 1, modifierGroupIds: [iceChoice.id] },
      { name: 'Jack Daniels', description: 'Tennessee, blended | 0.03L', price: 4.50, image: '/menu-images/viski/jack-daniels.png', categoryId: viski.id, sortOrder: 2, modifierGroupIds: [iceChoice.id] },
      { name: 'Jameson', description: 'Irska, blended | 0.03L', price: 4.50, image: '/menu-images/viski/jameson.png', categoryId: viski.id, sortOrder: 3, modifierGroupIds: [iceChoice.id] },
      { name: 'Lagavulin 16yo', description: 'Škotska, Islay single malt | 0.03L', price: 15.00, image: '/menu-images/viski/lagavulin-16.png', categoryId: viski.id, sortOrder: 4, modifierGroupIds: [iceChoice.id] },
      { name: 'Laphroaig 10yo', description: 'Škotska, Islay, single malt | 0.03L', price: 12.00, image: '/menu-images/viski/laphroaig-10.png', categoryId: viski.id, sortOrder: 5, modifierGroupIds: [iceChoice.id] },
      { name: 'Glenmorangie Lasanta 12yo', description: 'Škotska, single malt, sherry cask finish | 0.03L', price: 10.00, image: '/menu-images/viski/glenmorangie-lasanta.png', categoryId: viski.id, sortOrder: 6, modifierGroupIds: [iceChoice.id] },
      { name: 'Glenmorangie 18yo', description: 'Škotska, Highland, single malt | 0.03L', price: 20.00, image: '/menu-images/viski/glenmorangie-18.png', categoryId: viski.id, sortOrder: 7, modifierGroupIds: [iceChoice.id] },
      { name: 'Whisky Nikka Miyagikyo', description: 'Japonska, single malt | 0.03L', price: 15.00, image: '/menu-images/viski/nikka-miyagikyo.png', categoryId: viski.id, sortOrder: 8, modifierGroupIds: [iceChoice.id] },
      { name: 'Whisky Nikka From the Barrel', description: 'Japonska, blended | 0.03L', price: 10.50, image: '/menu-images/viski/nikka-barrel.png', categoryId: viski.id, sortOrder: 9, modifierGroupIds: [iceChoice.id] },

      // --- GIN ---
      { name: 'Gin Kristal London Dry', description: 'Slovenija, London dry | 0.03L', price: 5.00, image: '/menu-images/gin/gin-kristal.png', categoryId: gin.id, sortOrder: 0, modifierGroupIds: [iceChoice.id] },
      { name: 'Gin Monolog', description: 'Slovenija | 0.03L', price: 4.50, image: '/menu-images/gin/gin-monolog.png', categoryId: gin.id, sortOrder: 1, modifierGroupIds: [iceChoice.id] },
      { name: 'Gin Hendrick\'s', description: 'Škotska | 0.03L', price: 6.50, image: '/menu-images/gin/gin-hendricks.png', categoryId: gin.id, sortOrder: 2, modifierGroupIds: [iceChoice.id] },
      { name: 'Gin Mare', description: 'Španija | 0.03L', price: 7.00, image: '/menu-images/gin/gin-mare.png', categoryId: gin.id, sortOrder: 3, modifierGroupIds: [iceChoice.id] },
      { name: 'Gin Tanqueray', description: 'London dry | 0.03L', price: 4.50, image: '/menu-images/gin/gin-tanqueray.png', categoryId: gin.id, sortOrder: 4, modifierGroupIds: [iceChoice.id] },
      { name: 'Gin Monkey 47', description: 'Nemčija | 0.03L', price: 8.50, image: '/menu-images/gin/gin-monkey47.png', categoryId: gin.id, sortOrder: 5, modifierGroupIds: [iceChoice.id] },

      // --- LIKERJI ---
      { name: 'Liker Malibu Rum', description: '0.03L', price: 4.50, image: '/menu-images/likerji/malibu.png', categoryId: likerji.id, sortOrder: 0, modifierGroupIds: [iceChoice.id] },
      { name: 'Liker Canella', description: '0.03L', price: 5.50, image: '/menu-images/likerji/canella.png', categoryId: likerji.id, sortOrder: 1, modifierGroupIds: [iceChoice.id] },
      { name: 'Liker Rum Bumbu Cream', description: '0.03L', price: 5.50, image: '/menu-images/likerji/bumbu-cream.png', categoryId: likerji.id, sortOrder: 2, modifierGroupIds: [iceChoice.id] },
      { name: 'Liker Carolans', description: '0.03L', price: 4.50, image: '/menu-images/likerji/carolans.png', categoryId: likerji.id, sortOrder: 3, modifierGroupIds: [iceChoice.id] },
      { name: 'Liker Medica Kejžar', description: '0.03L', price: 4.20, image: '/menu-images/likerji/medica-kejzar.png', categoryId: likerji.id, sortOrder: 4, modifierGroupIds: [iceChoice.id] },
      { name: 'Liker Borovnica Kejžar', description: '0.03L', price: 4.20, image: '/menu-images/likerji/borovnica-kejzar.png', categoryId: likerji.id, sortOrder: 5, modifierGroupIds: [iceChoice.id] },

      // --- GRENČICE ---
      { name: 'Pelinkovec Badel Antique', description: '0.03L', price: 4.20, image: '/menu-images/grencice/pelinkovec.png', categoryId: grencice.id, sortOrder: 0, modifierGroupIds: [iceChoice.id] },
      { name: 'Cynar', description: '0.03L', price: 3.80, image: '/menu-images/grencice/cynar.png', categoryId: grencice.id, sortOrder: 1, modifierGroupIds: [iceChoice.id] },
      { name: 'Jägermeister', description: '0.03L', price: 3.80, image: '/menu-images/grencice/jagermeister.png', categoryId: grencice.id, sortOrder: 2, modifierGroupIds: [iceChoice.id] },
      { name: 'Amaro', description: '0.03L', price: 3.80, image: '/menu-images/grencice/amaro.png', categoryId: grencice.id, sortOrder: 3, modifierGroupIds: [iceChoice.id] },
      { name: 'Campari Bitter', description: '0.03L', price: 3.80, image: '/menu-images/grencice/campari.png', categoryId: grencice.id, sortOrder: 4, modifierGroupIds: [iceChoice.id] },
      { name: 'Aperol', description: '0.03L', price: 3.80, image: '/menu-images/grencice/aperol.png', categoryId: grencice.id, sortOrder: 5, modifierGroupIds: [iceChoice.id] },

      // --- DESTILATI, KONJAK IN RUM ---
      { name: 'Viljamovka', description: '0.03L', price: 5.00, image: '/menu-images/destilati/viljamovka.png', categoryId: destilati.id, sortOrder: 0, modifierGroupIds: [] },
      { name: 'Slivovka', description: '0.03L', price: 5.50, image: '/menu-images/destilati/slivovka.png', categoryId: destilati.id, sortOrder: 1, modifierGroupIds: [] },
      { name: 'Brinjevec', description: '0.03L', price: 5.50, image: '/menu-images/destilati/brinjevec.png', categoryId: destilati.id, sortOrder: 2, modifierGroupIds: [] },
      { name: 'Grappa Sofija Rebula', description: 'Jakončič | 0.03L', price: 5.50, image: '/menu-images/destilati/grappa-sofija.png', categoryId: destilati.id, sortOrder: 3, modifierGroupIds: [] },
      { name: 'Travarica Rossi', description: 'Istra | 0.03L', price: 5.00, image: '/menu-images/destilati/travarica-rossi.png', categoryId: destilati.id, sortOrder: 4, modifierGroupIds: [] },
      { name: 'Hennessy V.S.', description: 'Konjak | 0.03L', price: 6.50, image: '/menu-images/destilati/hennessy-vs.png', categoryId: destilati.id, sortOrder: 5, modifierGroupIds: [] },
      { name: 'Hennessy X.O.', description: 'Konjak | 0.03L', price: 25.00, image: '/menu-images/destilati/hennessy-xo.png', categoryId: destilati.id, sortOrder: 6, modifierGroupIds: [] },
      { name: 'Cognac Delamaine X.O.', description: 'Konjak | 0.03L', price: 25.00, image: '/menu-images/destilati/delamaine-xo.png', categoryId: destilati.id, sortOrder: 7, modifierGroupIds: [] },
      { name: 'Ararat 6yo', description: 'Vinjak | 0.03L', price: 5.50, image: '/menu-images/destilati/ararat-6.png', categoryId: destilati.id, sortOrder: 8, modifierGroupIds: [] },
      { name: 'Ararat 15yo', description: 'Vinjak | 0.03L', price: 12.50, image: '/menu-images/destilati/ararat-15.png', categoryId: destilati.id, sortOrder: 9, modifierGroupIds: [] },
      { name: 'Ararat 20yo', description: 'Vinjak | 0.03L', price: 17.50, image: '/menu-images/destilati/ararat-20.png', categoryId: destilati.id, sortOrder: 10, modifierGroupIds: [] },
      { name: 'Rum Bumbu Original', description: '0.03L', price: 6.50, image: '/menu-images/destilati/rum-bumbu.png', categoryId: destilati.id, sortOrder: 11, modifierGroupIds: [iceChoice.id] },
      { name: 'Rum Zacapa Solera 23yo', description: 'Guatemala | 0.03L', price: 15.00, image: '/menu-images/destilati/rum-zacapa.png', categoryId: destilati.id, sortOrder: 12, modifierGroupIds: [iceChoice.id] },
      { name: 'Rum Diplomatico Reserva Exclusiva', description: 'Venezuela | 0.03L', price: 7.50, image: '/menu-images/destilati/rum-diplomatico.png', categoryId: destilati.id, sortOrder: 13, modifierGroupIds: [iceChoice.id] },
      { name: 'Rum La Hechicera Reserva Familiar 21yo', description: 'Kolumbija | 0.03L', price: 8.00, image: '/menu-images/destilati/rum-hechicera.png', categoryId: destilati.id, sortOrder: 14, modifierGroupIds: [iceChoice.id] },

      // --- TOPLI NAPITKI ---
      { name: 'Kava Espresso', description: 'Espresso kava', price: 2.00, image: '/menu-images/topli-napitki/kava-espresso.png', categoryId: topliNapitki.id, sortOrder: 0, modifierGroupIds: [milkChoice.id, sweetenerChoice.id, alcoholAdd.id] },
      { name: 'Kava Macchiato', description: 'Espresso s kapljico mleka', price: 2.10, image: '/menu-images/topli-napitki/kava-macchiato.png', categoryId: topliNapitki.id, sortOrder: 1, modifierGroupIds: [milkChoice.id, sweetenerChoice.id, alcoholAdd.id] },
      { name: 'Cappuccino', description: 'Espresso s toplo mlečno peno', price: 2.30, image: '/menu-images/topli-napitki/cappuccino.png', categoryId: topliNapitki.id, sortOrder: 2, modifierGroupIds: [milkChoice.id, sweetenerChoice.id] },
      { name: 'Kava z Mlekom', description: 'Kava z mlekom', price: 2.30, image: '/menu-images/topli-napitki/kava-z-mlekom.png', categoryId: topliNapitki.id, sortOrder: 3, modifierGroupIds: [milkChoice.id, sweetenerChoice.id, alcoholAdd.id] },
      { name: 'Kava s Smetano', description: 'Kava s smetano', price: 2.50, image: '/menu-images/topli-napitki/kava-s-smetano.png', categoryId: topliNapitki.id, sortOrder: 4, modifierGroupIds: [sweetenerChoice.id, alcoholAdd.id] },
      { name: 'Bela Kava', description: 'Kava z veliko mlekom', price: 2.80, image: '/menu-images/topli-napitki/bela-kava.png', categoryId: topliNapitki.id, sortOrder: 5, modifierGroupIds: [milkChoice.id, sweetenerChoice.id, alcoholAdd.id] },
      { name: 'Kava Espresso Brez Kofeina', description: 'Dekofeinizirana espresso kava', price: 2.30, image: '/menu-images/topli-napitki/kava-brez-kofeina.png', categoryId: topliNapitki.id, sortOrder: 6, modifierGroupIds: [milkChoice.id, sweetenerChoice.id] },
      { name: 'Kava z Mlekom Brez Kofeina', description: 'Dekofeinizirana kava z mlekom', price: 2.50, image: '/menu-images/topli-napitki/kava-mleko-brez-kofeina.png', categoryId: topliNapitki.id, sortOrder: 7, modifierGroupIds: [milkChoice.id, sweetenerChoice.id] },
      { name: 'Cappuccino Brez Kofeina', description: 'Dekofeinizirani cappuccino', price: 2.60, image: '/menu-images/topli-napitki/cappuccino-brez-kofeina.png', categoryId: topliNapitki.id, sortOrder: 8, modifierGroupIds: [milkChoice.id, sweetenerChoice.id] },
      { name: 'Kava Macchiato Brez Kofeina', description: 'Dekofeinizirana kava macchiato', price: 2.20, image: '/menu-images/topli-napitki/macchiato-brez-kofeina.png', categoryId: topliNapitki.id, sortOrder: 9, modifierGroupIds: [milkChoice.id, sweetenerChoice.id] },
      { name: 'Bela Kava Brez Kofeina', description: 'Dekofeinizirana bela kava', price: 3.00, image: '/menu-images/topli-napitki/bela-kava-brez-kofeina.png', categoryId: topliNapitki.id, sortOrder: 10, modifierGroupIds: [milkChoice.id, sweetenerChoice.id] },
      { name: 'Kava z Riževim Mlekom', description: 'Kava z riževim mlekom', price: 3.00, image: '/menu-images/topli-napitki/kava-rizevo-mleko.png', categoryId: topliNapitki.id, sortOrder: 11, modifierGroupIds: [sweetenerChoice.id] },
      { name: 'Kakav', description: 'Topla čokoladna pijača', price: 3.00, image: '/menu-images/topli-napitki/kakav.png', categoryId: topliNapitki.id, sortOrder: 12, modifierGroupIds: [milkChoice.id, sweetenerChoice.id] },
      { name: 'Kakav s Smetano', description: 'Kakav s smetano', price: 3.50, image: '/menu-images/topli-napitki/kakav-smetana.png', categoryId: topliNapitki.id, sortOrder: 13, modifierGroupIds: [sweetenerChoice.id] },
      { name: 'Babyccino', description: 'Otroška kava', price: 1.00, image: '/menu-images/topli-napitki/babyccino.png', categoryId: topliNapitki.id, sortOrder: 14, modifierGroupIds: [] },
      { name: 'Vroča Čokolada', description: 'Gosta čokolada s smetano', price: 4.50, image: '/menu-images/topli-napitki/vroca-cokolada.png', categoryId: topliNapitki.id, sortOrder: 15, modifierGroupIds: [milkChoice.id, sweetenerChoice.id] },
      { name: 'Čaj z Limono in Medom', description: 'Topel čaj z limono in medom', price: 3.00, image: '/menu-images/topli-napitki/caj-skodelica.png', categoryId: topliNapitki.id, sortOrder: 16, modifierGroupIds: [sweetenerChoice.id, milkChoice.id] },
      { name: 'Ledena Kava Olimia', description: 'Kava, sladoled, čokolada, smetana', price: 6.50, image: '/menu-images/topli-napitki/ledena-kava-olimia.png', categoryId: topliNapitki.id, sortOrder: 17, modifierGroupIds: [iceChoice.id] },

      // --- MEŠANE PIJAČE ---
      { name: 'Aperol Spritz', description: 'Aperol, prosecco, soda, pomaranča', price: 7.50, image: '/menu-images/mesane-pijace/aperol-spritz.png', categoryId: mesanePijace.id, sortOrder: 0, modifierGroupIds: [iceChoice.id] },
      { name: 'Martini Spritz', description: 'Martini bianco, prosecco, soda, limeta', price: 8.00, image: '/menu-images/mesane-pijace/martini-spritz.png', categoryId: mesanePijace.id, sortOrder: 1, modifierGroupIds: [iceChoice.id] },
      { name: 'Negroni', description: 'Gin, vermut, campari, pomaranča', price: 7.50, image: '/menu-images/mesane-pijace/negroni.png', categoryId: mesanePijace.id, sortOrder: 2, modifierGroupIds: [iceChoice.id] },
      { name: 'Cuba Libre', description: 'Rum Havana, Coca-Cola, limeta', price: 8.00, image: '/menu-images/mesane-pijace/cuba-libre.png', categoryId: mesanePijace.id, sortOrder: 3, modifierGroupIds: [iceChoice.id] },
      { name: 'Mojito', description: 'Rum, soda, sladkor, meta, limeta', price: 8.50, image: '/menu-images/mesane-pijace/mojito.png', categoryId: mesanePijace.id, sortOrder: 4, modifierGroupIds: [iceChoice.id] },
      { name: 'Mango Mojito', description: 'Rum, soda, mango Monin, meta, limeta', price: 8.50, image: '/menu-images/mesane-pijace/mango-mojito.png', categoryId: mesanePijace.id, sortOrder: 5, modifierGroupIds: [iceChoice.id] },
      { name: 'Strawberry Mojito', description: 'Rum, soda, jagoda Monin, meta, limeta', price: 8.50, image: '/menu-images/mesane-pijace/strawberry-mojito.png', categoryId: mesanePijace.id, sortOrder: 6, modifierGroupIds: [iceChoice.id] },
      { name: 'London Dry Gin Tonic', description: 'Gin Kristal London dry, Fever Tree tonic water, limeta', price: 8.00, image: '/menu-images/mesane-pijace/london-dry-gin-tonic.png', categoryId: mesanePijace.id, sortOrder: 7, modifierGroupIds: [iceChoice.id] },
      { name: 'Monologue Gin Tonic', description: 'Slovenija | Tonic water, brinove jagode, limeta', price: 8.00, image: '/menu-images/mesane-pijace/monolog-gin-tonic.png', categoryId: mesanePijace.id, sortOrder: 8, modifierGroupIds: [iceChoice.id] },
      { name: 'Hendrick\'s Gin Tonic', description: 'Škotska | Tonic water, kumara', price: 8.50, image: '/menu-images/mesane-pijace/hendricks-gin-tonic.png', categoryId: mesanePijace.id, sortOrder: 9, modifierGroupIds: [iceChoice.id] },
      { name: 'Gin Mare Tonic', description: 'Španija | Mediterranean tonik, limeta, rožmarin', price: 8.50, image: '/menu-images/mesane-pijace/gin-mare-tonic.png', categoryId: mesanePijace.id, sortOrder: 10, modifierGroupIds: [iceChoice.id] },
      { name: 'Monkey 47 Gin Tonic', description: 'Nemčija | Tonic water, brinove jagode, rožmarin, limona', price: 9.00, image: '/menu-images/mesane-pijace/monkey47-gin-tonic.png', categoryId: mesanePijace.id, sortOrder: 11, modifierGroupIds: [iceChoice.id] },
      { name: 'Orange & Ginger Gin Tonic', description: 'Gin Kristal Orange&Ginger, Ginger Ale tonic, pomaranča', price: 8.00, image: '/menu-images/mesane-pijace/orange-ginger-gin-tonic.png', categoryId: mesanePijace.id, sortOrder: 12, modifierGroupIds: [iceChoice.id] },
      { name: 'Raspberry Pink Gin Tonic', description: 'Gin Kristal Raspberry, Rhubarb&Raspberry tonic, meta', price: 8.00, image: '/menu-images/mesane-pijace/raspberry-pink-gin-tonic.png', categoryId: mesanePijace.id, sortOrder: 13, modifierGroupIds: [iceChoice.id] },

      // --- VODE ---
      { name: 'Mineralna Voda (0.25L)', description: 'Mineralna voda | 0.25L', price: 2.50, image: '/menu-images/vode/mineralna-voda-025.png', categoryId: vode.id, sortOrder: 0, modifierGroupIds: [] },
      { name: 'Mineralna Voda (0.50L)', description: 'Mineralna voda | 0.50L', price: 3.50, image: '/menu-images/vode/mineralna-voda-050.png', categoryId: vode.id, sortOrder: 1, modifierGroupIds: [] },
      { name: 'Mineralna Voda (1.00L)', description: 'Mineralna voda | 1.00L', price: 5.00, image: '/menu-images/vode/mineralna-voda-100.png', categoryId: vode.id, sortOrder: 2, modifierGroupIds: [] },
      { name: 'Naravna Voda (0.25L)', description: 'Naravna voda | 0.25L', price: 2.50, image: '/menu-images/vode/naravna-voda-025.png', categoryId: vode.id, sortOrder: 3, modifierGroupIds: [] },
      { name: 'Naravna Voda (0.50L)', description: 'Naravna voda | 0.50L', price: 3.50, image: '/menu-images/vode/naravna-voda-050.png', categoryId: vode.id, sortOrder: 4, modifierGroupIds: [] },
      { name: 'Naravna Voda (1.00L)', description: 'Naravna voda | 1.00L', price: 5.00, image: '/menu-images/vode/naravna-voda-100.png', categoryId: vode.id, sortOrder: 5, modifierGroupIds: [] },
      { name: 'Naravna Voda z Okusom (0.50L)', description: 'Okusna naravna voda | PVC 0.50L', price: 3.50, image: '/menu-images/vode/voda-z-okusom.png', categoryId: vode.id, sortOrder: 6, modifierGroupIds: [] },
      { name: 'Voda Radenska FunctionALL (0.50L)', description: 'Funkcionalna voda | PVC 0.50L', price: 3.50, image: '/menu-images/vode/radenska-functionall.png', categoryId: vode.id, sortOrder: 7, modifierGroupIds: [] },

      // --- NARAVNI SOKOVI ---
      { name: 'Limonada (0.35L)', description: 'Klasična limonada | 0.35L', price: 3.80, image: '/menu-images/naravni-sokovi/limonada.png', categoryId: naravniSokovi.id, sortOrder: 0, modifierGroupIds: [iceChoice.id] },
      { name: 'Limonada z Okusom (0.35L)', description: 'Meta, bezeg, ingver | 0.35L', price: 4.50, image: '/menu-images/naravni-sokovi/limonada-okus.png', categoryId: naravniSokovi.id, sortOrder: 1, modifierGroupIds: [iceChoice.id] },
      { name: 'Hišni Sok Meta (0.35L)', description: 'Domač metin sok | 0.35L', price: 3.80, image: '/menu-images/naravni-sokovi/hisni-sok-meta.png', categoryId: naravniSokovi.id, sortOrder: 2, modifierGroupIds: [iceChoice.id] },
      { name: 'Hišni Ledeni Čaj (0.35L)', description: 'Domač ledeni čaj | 0.35L', price: 3.80, image: '/menu-images/naravni-sokovi/hisni-ledeni-caj.png', categoryId: naravniSokovi.id, sortOrder: 3, modifierGroupIds: [iceChoice.id] },
      { name: 'Naravni Pomarančni Sok (0.10L)', description: 'Sveže stisnjen pomarančni sok | 0.10L', price: 2.00, image: '/menu-images/naravni-sokovi/pomarancni-sok.png', categoryId: naravniSokovi.id, sortOrder: 4, modifierGroupIds: [] },

      // --- SOKOVI ---
      { name: 'Marelični Sok (0.20L)', description: '0.20L', price: 3.50, image: '/menu-images/sokovi/marelicni-sok.png', categoryId: sokovi.id, sortOrder: 0, modifierGroupIds: [] },
      { name: 'Naravni Jabolčni Sok 100% (0.20L)', description: '100% naravni | 0.20L', price: 3.80, image: '/menu-images/sokovi/jabolcni-sok.png', categoryId: sokovi.id, sortOrder: 1, modifierGroupIds: [] },
      { name: 'Ribezov Sok (0.20L)', description: '0.20L', price: 3.50, image: '/menu-images/sokovi/ribezov-sok.png', categoryId: sokovi.id, sortOrder: 2, modifierGroupIds: [] },
      { name: 'Ananasov Sok (0.20L)', description: '0.20L', price: 3.50, image: '/menu-images/sokovi/ananasov-sok.png', categoryId: sokovi.id, sortOrder: 3, modifierGroupIds: [] },
      { name: 'Pomarančni Sok (0.20L)', description: '0.20L', price: 3.50, image: '/menu-images/sokovi/pomarancni-sok.png', categoryId: sokovi.id, sortOrder: 4, modifierGroupIds: [] },
      { name: 'Jagodni Sok (0.20L)', description: '0.20L', price: 3.50, image: '/menu-images/sokovi/jagodni-sok.png', categoryId: sokovi.id, sortOrder: 5, modifierGroupIds: [] },
      { name: 'Ledeni Čaj (0.25L)', description: '0.25L', price: 3.50, image: '/menu-images/sokovi/ledeni-caj.png', categoryId: sokovi.id, sortOrder: 6, modifierGroupIds: [iceChoice.id] },
      { name: 'Cedevita (0.30L)', description: '0.30L', price: 3.50, image: '/menu-images/sokovi/cedevita.png', categoryId: sokovi.id, sortOrder: 7, modifierGroupIds: [] },
      { name: 'Bubble Tea (0.36L)', description: '0.36L', price: 6.50, image: '/menu-images/sokovi/bubble-tea.png', categoryId: sokovi.id, sortOrder: 8, modifierGroupIds: [iceChoice.id] },

      // --- GAZIRANE PIJAČE ---
      { name: 'Coca Cola (0.25L)', description: '0.25L', price: 3.50, image: '/menu-images/gazirane-pijace/coca-cola.png', categoryId: gaziranePijace.id, sortOrder: 0, modifierGroupIds: [iceChoice.id] },
      { name: 'Coca Cola Zero (0.25L)', description: '0.25L', price: 3.50, image: '/menu-images/gazirane-pijace/coca-cola-zero.png', categoryId: gaziranePijace.id, sortOrder: 1, modifierGroupIds: [iceChoice.id] },
      { name: 'Fanta (0.25L)', description: '0.25L', price: 3.50, image: '/menu-images/gazirane-pijace/fanta.png', categoryId: gaziranePijace.id, sortOrder: 2, modifierGroupIds: [iceChoice.id] },
      { name: 'Cockta (0.275L)', description: 'Slovenska originalna | 0.275L', price: 3.50, image: '/menu-images/gazirane-pijace/cockta.png', categoryId: gaziranePijace.id, sortOrder: 3, modifierGroupIds: [iceChoice.id] },
      { name: 'Sprite (0.25L)', description: '0.25L', price: 3.50, image: '/menu-images/gazirane-pijace/sprite.png', categoryId: gaziranePijace.id, sortOrder: 4, modifierGroupIds: [iceChoice.id] },
      { name: 'Schweppes Tonic Water (0.25L)', description: '0.25L', price: 3.50, image: '/menu-images/gazirane-pijace/schweppes-tonic.png', categoryId: gaziranePijace.id, sortOrder: 5, modifierGroupIds: [iceChoice.id] },
      { name: 'Schweppes Bitter Lemon (0.25L)', description: '0.25L', price: 3.50, image: '/menu-images/gazirane-pijace/schweppes-bitter.png', categoryId: gaziranePijace.id, sortOrder: 6, modifierGroupIds: [iceChoice.id] },
      { name: 'Fever Tree Tonic Water (0.20L)', description: 'Premium tonik | 0.20L', price: 4.00, image: '/menu-images/gazirane-pijace/fever-tree-tonic.png', categoryId: gaziranePijace.id, sortOrder: 7, modifierGroupIds: [iceChoice.id] },
      { name: 'Fever Tree Mediterranean Tonic (0.20L)', description: 'Premium mediteranski tonik | 0.20L', price: 4.00, image: '/menu-images/gazirane-pijace/fever-tree-med.png', categoryId: gaziranePijace.id, sortOrder: 8, modifierGroupIds: [iceChoice.id] },
      { name: 'Fever Tree Rhubarb & Raspberry Tonic (0.20L)', description: 'Premium rabarbara & malina tonik | 0.20L', price: 4.00, image: '/menu-images/gazirane-pijace/fever-tree-rhubarb.png', categoryId: gaziranePijace.id, sortOrder: 9, modifierGroupIds: [iceChoice.id] },
      { name: 'Red Bull (0.20L)', description: '0.20L', price: 4.00, image: '/menu-images/gazirane-pijace/red-bull.png', categoryId: gaziranePijace.id, sortOrder: 10, modifierGroupIds: [iceChoice.id] },
    ]

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
    // MIZE
    // ============================================
    const tableAreas = ['main', 'main', 'main', 'main', 'main', 'patio', 'patio', 'patio', 'bar', 'bar', 'bar', 'private', 'private', 'main', 'patio']
    const tables = await Promise.all(
      tableAreas.map((area, i) =>
        db.table.create({ data: { number: i + 1, capacity: [2, 4, 4, 6, 8, 4, 4, 2, 2, 2, 2, 8, 10, 4, 6][i], status: 'available', area } })
      )
    )

    // ============================================
    // ZAPOSLENI
    // ============================================
    const employees = await Promise.all([
      db.employee.create({ data: { name: 'Ana Novak', email: 'ana@restaurant.com', phone: '040-123-456', role: 'admin', status: 'active', pin: '1234' } }),
      db.employee.create({ data: { name: 'Marko Horvat', email: 'marko@restaurant.com', phone: '041-234-567', role: 'manager', status: 'active', pin: '5678' } }),
      db.employee.create({ data: { name: 'Maja Kovač', email: 'maja@restaurant.com', phone: '042-345-678', role: 'staff', status: 'active', pin: '9012' } }),
      db.employee.create({ data: { name: 'Luka Zupan', email: 'luka@restaurant.com', phone: '043-456-789', role: 'chef', status: 'active', pin: '3456' } }),
      db.employee.create({ data: { name: 'Eva Krajnc', email: 'eva@restaurant.com', phone: '044-567-890', role: 'staff', status: 'active', pin: '7890' } }),
      db.employee.create({ data: { name: 'Peter Mlakar', email: 'peter@restaurant.com', phone: '045-678-901', role: 'chef', status: 'inactive', pin: '' } }),
    ])

    // ============================================
    // INVENTAR
    // ============================================
    await Promise.all([
      db.inventoryItem.create({ data: { name: 'File lososa', unit: 'kg', quantity: 15, minQuantity: 5, costPerUnit: 18.50, supplier: 'Ocean Fresh', category: 'meat', menuItemId: menuItems[8].id } }),
      db.inventoryItem.create({ data: { name: 'Ribeye zrezek', unit: 'kg', quantity: 20, minQuantity: 8, costPerUnit: 22.00, supplier: 'Prime Meats', category: 'meat', menuItemId: menuItems[9].id } }),
      db.inventoryItem.create({ data: { name: 'Piščančji file', unit: 'kg', quantity: 25, minQuantity: 10, costPerUnit: 8.50, supplier: 'Farm Fresh', category: 'meat', menuItemId: menuItems[10].id } }),
      db.inventoryItem.create({ data: { name: 'Penne testenine', unit: 'kg', quantity: 30, minQuantity: 5, costPerUnit: 3.50, supplier: 'Italian Imports', category: 'dry-goods' } }),
      db.inventoryItem.create({ data: { name: 'Špageti', unit: 'kg', quantity: 25, minQuantity: 5, costPerUnit: 2.80, supplier: 'Italian Imports', category: 'dry-goods' } }),
      db.inventoryItem.create({ data: { name: 'Testo za pico', unit: 'kos', quantity: 40, minQuantity: 15, costPerUnit: 1.50, supplier: 'Hišna priprava', category: 'dry-goods' } }),
      db.inventoryItem.create({ data: { name: 'Mocarela', unit: 'kg', quantity: 8, minQuantity: 3, costPerUnit: 12.00, supplier: 'Dairy Direct', category: 'dairy' } }),
      db.inventoryItem.create({ data: { name: 'Parmezan', unit: 'kg', quantity: 4, minQuantity: 2, costPerUnit: 20.00, supplier: 'Dairy Direct', category: 'dairy' } }),
      db.inventoryItem.create({ data: { name: 'Rimski ohrovt', unit: 'kos', quantity: 12, minQuantity: 5, costPerUnit: 2.50, supplier: 'Green Valley', category: 'produce' } }),
      db.inventoryItem.create({ data: { name: 'Paradižnik', unit: 'kg', quantity: 10, minQuantity: 5, costPerUnit: 4.00, supplier: 'Green Valley', category: 'produce' } }),
      db.inventoryItem.create({ data: { name: 'Sveža bazilika', unit: 'šen', quantity: 3, minQuantity: 3, costPerUnit: 3.50, supplier: 'Green Valley', category: 'produce' } }),
      db.inventoryItem.create({ data: { name: 'Goveji patty', unit: 'kos', quantity: 50, minQuantity: 20, costPerUnit: 2.50, supplier: 'Prime Meats', category: 'meat' } }),
      db.inventoryItem.create({ data: { name: 'Burger žemlje', unit: 'kos', quantity: 60, minQuantity: 20, costPerUnit: 0.80, supplier: 'Pekarna', category: 'dry-goods' } }),
      db.inventoryItem.create({ data: { name: 'Kavna zrna', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 25.00, supplier: 'Roast Masters', category: 'beverages' } }),
      db.inventoryItem.create({ data: { name: 'Limone', unit: 'kg', quantity: 4, minQuantity: 2, costPerUnit: 3.00, supplier: 'Green Valley', category: 'produce' } }),
      db.inventoryItem.create({ data: { name: 'Oljčno olje', unit: 'L', quantity: 10, minQuantity: 3, costPerUnit: 8.00, supplier: 'Italian Imports', category: 'dry-goods' } }),
      db.inventoryItem.create({ data: { name: 'Moka', unit: 'kg', quantity: 20, minQuantity: 5, costPerUnit: 1.50, supplier: 'Pekarna', category: 'dry-goods' } }),
      db.inventoryItem.create({ data: { name: 'Sladkor', unit: 'kg', quantity: 15, minQuantity: 5, costPerUnit: 2.00, supplier: 'Dobavitelj', category: 'dry-goods' } }),
      db.inventoryItem.create({ data: { name: 'Rdeče vino', unit: 'steklenica', quantity: 12, minQuantity: 4, costPerUnit: 15.00, supplier: 'Vinska klet', category: 'beverages' } }),
      db.inventoryItem.create({ data: { name: 'Belo vino', unit: 'steklenica', quantity: 10, minQuantity: 4, costPerUnit: 14.00, supplier: 'Vinska klet', category: 'beverages' } }),
      db.inventoryItem.create({ data: { name: 'Laško pivo keg', unit: 'keg', quantity: 3, minQuantity: 2, costPerUnit: 85.00, supplier: 'Laško Pivovarna', category: 'beverages' } }),
      db.inventoryItem.create({ data: { name: 'Union pivo keg', unit: 'keg', quantity: 2, minQuantity: 2, costPerUnit: 80.00, supplier: 'Pivovarna Union', category: 'beverages' } }),
      db.inventoryItem.create({ data: { name: 'Coca-Cola', unit: 'steklenica', quantity: 48, minQuantity: 12, costPerUnit: 1.20, supplier: 'Coca-Cola CPC', category: 'beverages' } }),
      db.inventoryItem.create({ data: { name: 'Radenska', unit: 'steklenica', quantity: 36, minQuantity: 12, costPerUnit: 0.90, supplier: 'Radenska', category: 'beverages' } }),
      db.inventoryItem.create({ data: { name: 'Krompir', unit: 'kg', quantity: 20, minQuantity: 8, costPerUnit: 2.00, supplier: 'Green Valley', category: 'produce' } }),
      db.inventoryItem.create({ data: { name: 'Čebula', unit: 'kg', quantity: 8, minQuantity: 3, costPerUnit: 1.80, supplier: 'Green Valley', category: 'produce' } }),
    ])

    // ============================================
    // IZMENE
    // ============================================
    const today = new Date()
    for (let i = 0; i < 7; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() + i)
      for (const emp of employees) {
        if (emp.status === 'inactive') continue
        const isWeekend = date.getDay() === 0 || date.getDay() === 6
        if (isWeekend && emp.role === 'staff') continue
        await db.shift.create({
          data: {
            employeeId: emp.id,
            date,
            startTime: emp.role === 'chef' ? '07:00' : '09:00',
            endTime: emp.role === 'chef' ? '15:00' : '17:00',
            status: i === 0 ? 'completed' : 'scheduled',
          },
        })
      }
    }

    // ============================================
    // PRIMERNI NAROČILA
    // ============================================
    const customerNames = ['Jože N.', 'Maja S.', 'Miha R.', 'Ana L.', 'Tomaž V.', 'Ema B.', 'Aleš K.', 'Lidija M.']
    const orderTypes = ['dine-in', 'takeout', 'delivery']
    const paymentMethods = ['cash', 'card', 'valuto']

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const ordersPerDay = Math.floor(Math.random() * 6) + 5
      for (let i = 0; i < ordersPerDay; i++) {
        const date = new Date()
        date.setDate(date.getDate() - dayOffset)
        date.setHours(Math.floor(Math.random() * 10) + 8, Math.floor(Math.random() * 60))

        const numItems = Math.floor(Math.random() * 4) + 1
        const selectedItems: { menuItemId: string; price: number; quantity: number; vatRate: number }[] = []
        for (let j = 0; j < numItems; j++) {
          const item = menuItems[Math.floor(Math.random() * menuItems.length)]
          const existing = selectedItems.find(s => s.menuItemId === item.id)
          if (existing) {
            existing.quantity += 1
          } else {
            selectedItems.push({ menuItemId: item.id, price: toNum(item.price), quantity: Math.floor(Math.random() * 2) + 1, vatRate: toNum(item.vatRate ?? 22.0) })
          }
        }

        const subtotal = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
        const tax = selectedItems.reduce((sum, item) => sum + item.price * item.quantity * (item.vatRate / 100), 0)
        const discount = Math.random() > 0.8 ? round2(subtotal * 0.1) : 0
        const total = round2(subtotal + tax - discount)

        const type = orderTypes[Math.floor(Math.random() * 3)]
        const statuses = ['pending', 'in-progress', 'ready', 'completed']
        const statusIdx = dayOffset === 0 ? Math.floor(Math.random() * 3) : 3
        const status = statuses[statusIdx]

        const maxOrder = await db.order.findFirst({ orderBy: { orderNumber: 'desc' }, select: { orderNumber: true } })
        const orderNumber = (maxOrder?.orderNumber || 0) + 1

        const tableId = type === 'dine-in' && tables.length > 0 ? tables[Math.floor(Math.random() * tables.length)].id : null

        await db.order.create({
          data: {
            orderNumber,
            type,
            status,
            tableId,
            customerName: customerNames[Math.floor(Math.random() * customerNames.length)],
            customerPhone: '',
            subtotal: round2(subtotal),
            tax: round2(tax),
            discount,
            total: round2(total),
            paymentStatus: status === 'completed' ? 'paid' : (Math.random() > 0.5 ? 'paid' : 'unpaid'),
            paymentMethod: status === 'completed' ? paymentMethods[Math.floor(Math.random() * 3)] : '',
            createdAt: date,
            orderItems: {
              create: selectedItems.map(item => ({
                menuItemId: item.menuItemId,
                quantity: item.quantity,
                price: item.price,
                vatRate: item.vatRate ?? 22.0,
                vatAmount: round2(item.price * item.quantity * (item.vatRate / 100)),
                notes: '',
                modifiersJson: '[]',
                status: status === 'completed' ? 'served' : 'pending',
              })),
            },
          },
        })
      }
    }

    // ============================================
    // KONFIGURACIJSKI PODATKI (Toast POS)
    // ============================================
    // DDV stopnje
    await Promise.all([
      db.taxRate.create({ data: { name: 'DDV 22%', rate: 22.0, code: 'S', isActive: true } }),
      db.taxRate.create({ data: { name: 'DDV 9.5%', rate: 9.5, code: 'R', isActive: true } }),
      db.taxRate.create({ data: { name: 'DDV 0%', rate: 0.0, code: 'Z', isActive: true } }),
    ])
    // Service charges (must be before DiningOptions due to FK)
    const terraceServiceCharge = await db.serviceCharge.create({ data: { name: 'Postrežba na terasi', type: 'percentage', amount: 10, isAutoApply: false } })
    // Dining options
    await Promise.all([
      db.diningOption.create({ data: { name: 'Na mestu', type: 'dine-in', prepTimeMinutes: 15, serviceChargeId: null } }),
      db.diningOption.create({ data: { name: 'Za s seboj', type: 'takeout', prepTimeMinutes: 10, serviceChargeId: null } }),
      db.diningOption.create({ data: { name: 'Dostava', type: 'delivery', prepTimeMinutes: 30, serviceChargeId: terraceServiceCharge.id } }),
    ])
    // Revenue centers
    await Promise.all([
      db.revenueCenter.create({ data: { name: 'Glavna dvorana', code: 'MAIN', isActive: true } }),
      db.revenueCenter.create({ data: { name: 'Terasa', code: 'TERRACE', isActive: true } }),
      db.revenueCenter.create({ data: { name: 'Bar', code: 'BAR', isActive: true } }),
      db.revenueCenter.create({ data: { name: 'Dostava', code: 'DELIVERY', isActive: true } }),
    ])
    // Sales categories
    await Promise.all([
      db.salesCategory.create({ data: { name: 'Hrana', code: 'FOOD', isActive: true } }),
      db.salesCategory.create({ data: { name: 'Pijača', code: 'DRINKS', isActive: true } }),
      db.salesCategory.create({ data: { name: 'Alkoholne pijače', code: 'ALCOHOL', isActive: true } }),
      db.salesCategory.create({ data: { name: 'Sladice', code: 'DESSERTS', isActive: true } }),
      db.salesCategory.create({ data: { name: 'Prigrizki', code: 'SNACKS', isActive: true } }),
    ])
    // Price groups
    await Promise.all([
      db.priceGroup.create({ data: { name: 'Redna cena', description: 'Standardni cenik', isActive: true } }),
      db.priceGroup.create({ data: { name: 'Kosilo menu', description: 'Dnevno kosilo 11-14h', isActive: true } }),
      db.priceGroup.create({ data: { name: 'Happy Hour', description: 'Popoldanski popust 15-17h', isActive: true } }),
      db.priceGroup.create({ data: { name: 'Catering', description: 'Cenik za catering', isActive: false } }),
    ])
    // Prep stations
    await Promise.all([
      db.prepStation.create({ data: { name: 'Vroča kuhinja', type: 'kitchen', avgPrepTime: 15 } }),
      db.prepStation.create({ data: { name: 'Hladna kuhinja', type: 'cold', avgPrepTime: 5 } }),
      db.prepStation.create({ data: { name: 'Bar', type: 'bar', avgPrepTime: 3 } }),
      db.prepStation.create({ data: { name: 'Žar', type: 'grill', avgPrepTime: 12 } }),
      db.prepStation.create({ data: { name: 'Slaščičarna', type: 'pastry', avgPrepTime: 8 } }),
    ])
    // Void reasons
    await Promise.all([
      db.voidReason.create({ data: { name: 'Napaka natakarja', isActive: true, sortOrder: 1 } }),
      db.voidReason.create({ data: { name: 'Nezadovoljstvo stranke', isActive: true, sortOrder: 2 } }),
      db.voidReason.create({ data: { name: 'Napaka v kuhinji', isActive: true, sortOrder: 3 } }),
      db.voidReason.create({ data: { name: 'Alergija', isActive: true, sortOrder: 4 } }),
      db.voidReason.create({ data: { name: 'Menjava artikla', isActive: true, sortOrder: 5 } }),
      db.voidReason.create({ data: { name: 'Naročilo po pomoti', isActive: true, sortOrder: 6 } }),
      db.voidReason.create({ data: { name: 'Ni na zalogi', isActive: true, sortOrder: 7 } }),
    ])
    // No-sale reasons
    await Promise.all([
      db.noSaleReason.create({ data: { name: 'Odprt fižek', isActive: true } }),
      db.noSaleReason.create({ data: { name: 'Menjava', isActive: true } }),
      db.noSaleReason.create({ data: { name: 'Preverjanje', isActive: true } }),
    ])
    // Alternate payment types
    await Promise.all([
      db.alternatePaymentType.create({ data: { name: 'Boni', code: 'BON', type: 'voucher' } }),
      db.alternatePaymentType.create({ data: { name: 'Kupon', code: 'COUPON', type: 'coupon' } }),
      db.alternatePaymentType.create({ data: { name: 'Studentski bon', code: 'STUDENT', type: 'voucher' } }),
      db.alternatePaymentType.create({ data: { name: 'Malica', code: 'MALICA', type: 'voucher' } }),
    ])
    // Discounts
    await Promise.all([
      db.discount.create({ data: { name: 'Zgodnja ptica', type: 'percentage', amount: 10, appliesTo: 'all', triggerType: 'manual', isActive: true } }),
      db.discount.create({ data: { name: '10% na celotno naročilo', type: 'percentage', amount: 10, appliesTo: 'order', triggerType: 'manual', isActive: true } }),
      db.discount.create({ data: { name: '5€ popust na pijačo', type: 'fixed', amount: 5, appliesTo: 'categories', triggerType: 'manual', isActive: true } }),
    ])
    // Printers
    await Promise.all([
      db.printer.create({ data: { name: 'Kuhinja', type: 'thermal', location: 'Kuhinja', ipAddress: '192.168.1.100' } }),
      db.printer.create({ data: { name: 'Bar', type: 'thermal', location: 'Bar', ipAddress: '192.168.1.101' } }),
      db.printer.create({ data: { name: 'Blagajna', type: 'receipt', location: 'Blagajna', ipAddress: '192.168.1.102' } }),
    ])
    // Webhooks — generiramo naključen secret če WEBHOOK_SECRET ni nastavljen
    const webhookSecret = process.env.WEBHOOK_SECRET || (() => { const b = new Uint8Array(32); crypto.getRandomValues(b); return `whsec_${Array.from(b, x => x.toString(16).padStart(2, '0')).join('')}` })()
    await db.webhook.create({ data: { name: 'Test webhook', url: 'https://hooks.example.com/pos', events: 'order.created,order.completed,payment.received', isActive: false, secret: webhookSecret } })
    // Jobs
    await Promise.all([
      db.job.create({ data: { name: 'Natakar', code: 'WAIT', basePayRate: 9.50, overtimeRate: 14.25, permissions: JSON.stringify(['take_orders', 'void_items', 'apply_discounts']) } }),
      db.job.create({ data: { name: 'Kuhar', code: 'CHEF', basePayRate: 10.50, overtimeRate: 15.75, permissions: JSON.stringify(['manage_kitchen', 'view_inventory']) } }),
      db.job.create({ data: { name: 'Barman', code: 'BAR', basePayRate: 9.80, overtimeRate: 14.70, permissions: JSON.stringify(['take_orders', 'manage_bar']) } }),
      db.job.create({ data: { name: 'Vodja smene', code: 'LEAD', basePayRate: 13.00, overtimeRate: 19.50, permissions: JSON.stringify(['take_orders', 'manage_cash', 'void_items', 'apply_discounts', 'view_reports']) } }),
      db.job.create({ data: { name: 'Upravljalec', code: 'ADMIN', basePayRate: 16.00, overtimeRate: 24.00, permissions: JSON.stringify(['admin']) } }),
    ])

    return NextResponse.json({ success: true, message: 'Podatki so bili uspešno naloženi s slovensko ponudbo, vinsko kartico in konfiguracijo' })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/seed', 'Napaka pri nalaganju podatkov')
  }
}
