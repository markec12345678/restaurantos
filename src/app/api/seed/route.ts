import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
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
    // Hrana kategorije
    const [appetizers, soups, mainCourses, pasta, pizza, burgers, desserts, sides] = await Promise.all([
      db.category.create({ data: { name: 'Predjedi', icon: '🥗', color: '#10b981', sortOrder: 0, menuId: foodMenu.id } }),
      db.category.create({ data: { name: 'Juhe', icon: '🍲', color: '#f97316', sortOrder: 1, menuId: foodMenu.id } }),
      db.category.create({ data: { name: 'Glavne jedi', icon: '🥩', color: '#ef4444', sortOrder: 2, menuId: foodMenu.id } }),
      db.category.create({ data: { name: 'Testenine', icon: '🍝', color: '#eab308', sortOrder: 3, menuId: foodMenu.id } }),
      db.category.create({ data: { name: 'Pica', icon: '🍕', color: '#8b5cf6', sortOrder: 4, menuId: foodMenu.id } }),
      db.category.create({ data: { name: 'Burgerji', icon: '🍔', color: '#ec4899', sortOrder: 5, menuId: foodMenu.id } }),
      db.category.create({ data: { name: 'Sladice', icon: '🍰', color: '#06b6d4', sortOrder: 6, menuId: foodMenu.id } }),
      db.category.create({ data: { name: 'Priloge', icon: '🍟', color: '#84cc16', sortOrder: 7, menuId: foodMenu.id } }),
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
      // --- PREDJEDI ---
      { name: 'Cezarjeva solata', description: 'Hrustljav rimski ohrovt s parmezanom in krutoni', price: 9.99, image: '/menu-images/caesar-salad.png', categoryId: appetizers.id, sortOrder: 0, modifierGroupIds: [sauceChoice.id] },
      { name: 'Bruschetta', description: 'Opečen kruh s svežim paradižnikom in baziliko', price: 8.49, image: '/menu-images/bruschetta.png', categoryId: appetizers.id, sortOrder: 1, modifierGroupIds: [cheeseChoice.id] },
      { name: 'Vijolični zavitki', description: 'Hrustljavi zelenjavni zavitki s prelivom', price: 7.99, image: '/menu-images/spring-rolls.png', categoryId: appetizers.id, sortOrder: 2, modifierGroupIds: [sauceChoice.id] },
      { name: 'Juha dneva', description: 'Sveže pripravljena dnevna juha', price: 6.99, image: '/menu-images/soup-of-the-day.png', categoryId: appetizers.id, sortOrder: 3, modifierGroupIds: [] },

      // --- JUHE ---
      { name: 'Goveja juha', description: 'Tradicionalna goveja juha z rezanci in zelenjavo', price: 7.49, image: '/menu-images/beef-soup.png', categoryId: soups.id, sortOrder: 0, modifierGroupIds: [] },
      { name: 'Paradižnikova juha', description: 'Kremna paradižnikova juha s baziliko', price: 6.99, image: '/menu-images/tomato-soup.png', categoryId: soups.id, sortOrder: 1, modifierGroupIds: [cheeseChoice.id] },
      { name: 'Gobicna juha', description: 'Kremna gobova juha s truški', price: 7.99, image: '/menu-images/mushroom-soup.png', categoryId: soups.id, sortOrder: 2, modifierGroupIds: [] },

      // --- GLAVNE JEDI ---
      { name: 'Žar losos', description: 'Atlantski losos z omako iz limone in masla', price: 24.99, image: '/menu-images/grilled-salmon.png', categoryId: mainCourses.id, sortOrder: 0, modifierGroupIds: [sideChoice.id, sauceChoice.id] },
      { name: 'Ribeye zrezek', description: '12oz ribeye, pripravljen po vaši želji', price: 32.99, image: '/menu-images/ribeye-steak.png', categoryId: mainCourses.id, sortOrder: 1, modifierGroupIds: [cookingLevel.id, sideChoice.id, sauceChoice.id] },
      { name: 'Piščanec parmezan', description: 'Paniran piščanec s paradižnikovo omako in mocarelo', price: 18.99, image: '/menu-images/chicken-parmesan.png', categoryId: mainCourses.id, sortOrder: 2, modifierGroupIds: [sideChoice.id] },
      { name: 'Janječji kotleti', description: 'Zeliščno obloženi jagnječji kotleti z rožmarinom', price: 28.99, image: '/menu-images/lamb-chops.png', categoryId: mainCourses.id, sortOrder: 3, modifierGroupIds: [cookingLevel.id, sideChoice.id, sauceChoice.id] },

      // --- TESTENINE ---
      { name: 'Špageti karbonara', description: 'Klasična karbonara s panceto in jajcem', price: 16.99, image: '/menu-images/spaghetti-carbonara.png', categoryId: pasta.id, sortOrder: 0, modifierGroupIds: [cheeseChoice.id] },
      { name: 'Fettuccine alfredo', description: 'Kremna alfredo omaka s parmezanom', price: 15.99, image: '/menu-images/fettuccine-alfredo.png', categoryId: pasta.id, sortOrder: 1, modifierGroupIds: [cheeseChoice.id] },
      { name: 'Penne arrabbiata', description: 'Pikantna paradižnikova omaka s česnom in čilijem', price: 14.49, image: '/menu-images/penne-arrabbiata.png', categoryId: pasta.id, sortOrder: 2, modifierGroupIds: [] },
      { name: 'Lazanja', description: 'Plasti testenin, mesne omake in sira', price: 17.99, image: '/menu-images/lasagna.png', categoryId: pasta.id, sortOrder: 3, modifierGroupIds: [cheeseChoice.id] },

      // --- PICA ---
      { name: 'Margherita', description: 'Sveža mocarela, paradižnik in bazilika', price: 14.99, image: '/menu-images/margherita-pizza.png', categoryId: pizza.id, sortOrder: 0, modifierGroupIds: [pizzaSize.id, cheeseChoice.id] },
      { name: 'Pepperoni', description: 'Klasična pepperoni z mocarelo', price: 16.99, image: '/menu-images/pepperoni-pizza.png', categoryId: pizza.id, sortOrder: 1, modifierGroupIds: [pizzaSize.id, cheeseChoice.id] },
      { name: 'BBQ piščanec', description: 'BBQ omaka, piščanec in rdeča čebula', price: 18.49, image: '/menu-images/bbq-chicken-pizza.png', categoryId: pizza.id, sortOrder: 2, modifierGroupIds: [pizzaSize.id, sauceChoice.id] },
      { name: 'Vegetarijanska', description: 'Paprika, gobe, olive in čebula', price: 15.99, image: '/menu-images/vegetarian-pizza.png', categoryId: pizza.id, sortOrder: 3, modifierGroupIds: [pizzaSize.id, cheeseChoice.id] },

      // --- BURGERJI ---
      { name: 'Klasičen burger', description: 'Goveji patty s solato, paradižnikom in čebulo', price: 13.99, image: '/menu-images/classic-burger.png', categoryId: burgers.id, sortOrder: 0, modifierGroupIds: [burgerSize.id, cheeseChoice.id, sauceChoice.id] },
      { name: 'Bacon cheeseburger', description: 'Goveji patty s slanino in cheddarjem', price: 16.49, image: '/menu-images/bacon-cheeseburger.png', categoryId: burgers.id, sortOrder: 1, modifierGroupIds: [burgerSize.id, cheeseChoice.id, sauceChoice.id] },
      { name: 'Gobe in švicar', description: 'Goveji patty z dušenimi gobami in švicarskim sirom', price: 15.99, image: '/menu-images/mushroom-swiss-burger.png', categoryId: burgers.id, sortOrder: 2, modifierGroupIds: [burgerSize.id, sauceChoice.id] },
      { name: 'Zelenjavni burger', description: 'Rastlinski patty z avokadom', price: 14.49, image: '/menu-images/veggie-burger.png', categoryId: burgers.id, sortOrder: 3, modifierGroupIds: [burgerSize.id, cheeseChoice.id, sauceChoice.id] },

      // --- SLADICE ---
      { name: 'Tiramisu', description: 'Klasična italijanska kavnana sladica', price: 9.99, image: '/menu-images/tiramisu.png', categoryId: desserts.id, sortOrder: 0, modifierGroupIds: [] },
      { name: 'Čokoladni lava cake', description: 'Topla čokoladna torta s tekočim sredinskim delom', price: 10.99, image: '/menu-images/chocolate-lava-cake.png', categoryId: desserts.id, sortOrder: 1, modifierGroupIds: [] },
      { name: 'Cheesecake', description: 'New York style cheesecake', price: 8.99, image: '/menu-images/cheesecake.png', categoryId: desserts.id, sortOrder: 2, modifierGroupIds: [] },
      { name: 'Crème brûlée', description: 'Vaniljeva krema s karameliziranim sladkorjem', price: 9.49, image: '/menu-images/creme-brulee.png', categoryId: desserts.id, sortOrder: 3, modifierGroupIds: [] },

      // --- PRILOGE ---
      { name: 'Pomfri', description: 'Hrustljavi zlato rumeni pomfri', price: 5.49, image: '/menu-images/french-fries.png', categoryId: sides.id, sortOrder: 0, modifierGroupIds: [sauceChoice.id] },
      { name: 'Česnov kruh', description: 'Opečen s česnovim maslom', price: 4.99, image: '/menu-images/garlic-bread.png', categoryId: sides.id, sortOrder: 1, modifierGroupIds: [cheeseChoice.id] },
      { name: 'Coleslaw', description: 'Kremna solata iz zelja', price: 3.99, image: '/menu-images/coleslaw.png', categoryId: sides.id, sortOrder: 2, modifierGroupIds: [] },
      { name: 'Čebulni obročki', description: 'V pivskem testu ocvrti čebulni obročki', price: 5.99, image: '/menu-images/onion-rings.png', categoryId: sides.id, sortOrder: 3, modifierGroupIds: [sauceChoice.id] },

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
      { name: 'Cuvee Emino 2022 (kozarec)', description: 'Laški rizling, chardonnay, sauvignon | Hiša vin Emino, Šmarje pri Jelšah, Štajerska | Suho | 0.10L', price: 3.00, image: '/menu-images/bela-vina/cuvee-emino.png', categoryId: belaVina.id, sortOrder: 0, modifierGroupIds: [] },
      { name: 'Cuvee Emino 2022 (steklenica)', description: 'Laški rizling, chardonnay, sauvignon | Hiša vin Emino, Šmarje pri Jelšah, Štajerska | Suho | 0.75L', price: 21.00, image: '/menu-images/bela-vina/cuvee-emino.png', categoryId: belaVina.id, sortOrder: 1, modifierGroupIds: [] },
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
      { name: 'Rumeni Muškat 2023 (kozarec)', description: 'Klet Dular, Bizeljsko-Sremič, Posavje | Polsladko | 0.10L', price: 4.50, image: '/menu-images/bela-vina/rumeni-muskat.png', categoryId: belaVina.id, sortOrder: 19, modifierGroupIds: [] },
      { name: 'Rumeni Muškat 2023 (steklenica)', description: 'Klet Dular, Bizeljsko-Sremič, Posavje | Polsladko | 0.75L', price: 30.00, image: '/menu-images/bela-vina/rumeni-muskat.png', categoryId: belaVina.id, sortOrder: 20, modifierGroupIds: [] },
      { name: 'Rumeni Muškat Pozna Trgatev 2019 (kozarec)', description: 'Klet Prus, Metlika, Bela Krajina, Posavje | Sladko | 0.10L', price: 6.50, image: '/menu-images/bela-vina/rumeni-muskat-pozna.png', categoryId: belaVina.id, sortOrder: 21, modifierGroupIds: [] },
      { name: 'Rumeni Muškat Pozna Trgatev 2019 (steklenica)', description: 'Klet Prus, Metlika, Bela Krajina, Posavje | Sladko | 0.75L', price: 38.00, image: '/menu-images/bela-vina/rumeni-muskat-pozna.png', categoryId: belaVina.id, sortOrder: 22, modifierGroupIds: [] },
      { name: 'Bela Frankinja 2023 (kozarec)', description: 'Klet Dular, Bizeljsko-Sremič, Posavje | Polsladko | 0.10L', price: 5.00, image: '/menu-images/bela-vina/bela-frankinja.png', categoryId: belaVina.id, sortOrder: 23, modifierGroupIds: [] },
      { name: 'Bela Frankinja 2023 (steklenica)', description: 'Klet Dular, Bizeljsko-Sremič, Posavje | Polsladko | 0.75L', price: 35.00, image: '/menu-images/bela-vina/bela-frankinja.png', categoryId: belaVina.id, sortOrder: 24, modifierGroupIds: [] },

      // --- ROSÉ VINO ---
      { name: 'Rosé Batič 2024', description: 'Cabernet sauvignon | Batič, Vipavska dolina, Primorska | Polsuho | 0.75L', price: 43.00, image: '/menu-images/rose-vino/rose-batic.png', categoryId: roseVino.id, sortOrder: 0, modifierGroupIds: [] },
      { name: 'Rosé Verstovšek Estate 2024 (kozarec)', description: 'Modra frankinja | Verstovšek Estate, Bizeljsko-Sremič, Posavje | Suho | 0.10L', price: 4.80, image: '/menu-images/rose-vino/rose-verstovsek.png', categoryId: roseVino.id, sortOrder: 1, modifierGroupIds: [] },
      { name: 'Rosé Verstovšek Estate 2024 (steklenica)', description: 'Modra frankinja | Verstovšek Estate, Bizeljsko-Sremič, Posavje | Suho | 0.75L', price: 35.00, image: '/menu-images/rose-vino/rose-verstovsek.png', categoryId: roseVino.id, sortOrder: 2, modifierGroupIds: [] },

      // --- RDEČA VINA ---
      { name: 'Modra Frankinja Emino 2023 (kozarec)', description: 'Hiša vin Emino, Šmarje pri Jelšah, Štajerska | Suho | 0.10L', price: 3.00, image: '/menu-images/rdeca-vina/modra-frankinja-emino.png', categoryId: rdecaVina.id, sortOrder: 0, modifierGroupIds: [] },
      { name: 'Modra Frankinja Emino 2023 (steklenica)', description: 'Hiša vin Emino, Šmarje pri Jelšah, Štajerska | Suho | 0.75L', price: 21.00, image: '/menu-images/rdeca-vina/modra-frankinja-emino.png', categoryId: rdecaVina.id, sortOrder: 1, modifierGroupIds: [] },
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
      { name: 'Keros Belo 2020 (0.05L)', description: 'Traminec | Vinarstvo Kerin, Straža nad Krškim, Dolenjska, Posavje | Sladko', price: 4.50, image: '/menu-images/likersko-vino/keros-belo.png', categoryId: likerskoVino.id, sortOrder: 0, modifierGroupIds: [] },
      { name: 'Keros Belo 2020 (0.50L)', description: 'Traminec | Vinarstvo Kerin, Straža nad Krškim, Dolenjska, Posavje | Sladko', price: 45.00, image: '/menu-images/likersko-vino/keros-belo.png', categoryId: likerskoVino.id, sortOrder: 1, modifierGroupIds: [] },
      { name: 'Keros Rdeče 2018 (0.05L)', description: 'Modra frankinja | Vinarstvo Kerin, Straža nad Krškim, Dolenjska, Posavje | Sladko', price: 4.50, image: '/menu-images/likersko-vino/keros-rdece.png', categoryId: likerskoVino.id, sortOrder: 2, modifierGroupIds: [] },
      { name: 'Keros Rdeče 2018 (0.50L)', description: 'Modra frankinja | Vinarstvo Kerin, Straža nad Krškim, Dolenjska, Posavje | Sladko', price: 45.00, image: '/menu-images/likersko-vino/keros-rdece.png', categoryId: likerskoVino.id, sortOrder: 3, modifierGroupIds: [] },
      { name: 'Veliko Rdeče Movia 2012', description: 'Merlot, cabernet sauvignin, modri pinot | Klet Movia, Goriška Brda, Primorska | Suho | 3.00L', price: 360.00, image: '/menu-images/likersko-vino/veliko-rdece-2012.png', categoryId: likerskoVino.id, sortOrder: 4, modifierGroupIds: [] },
      { name: 'Sladki Refošk (kozarec)', description: 'Vina Koper, Slovenska Istra, Primorska | Sladko | 0.10L', price: 5.00, image: '/menu-images/likersko-vino/sladki-refosk.png', categoryId: likerskoVino.id, sortOrder: 5, modifierGroupIds: [] },
      { name: 'Sladki Refošk (0.50L)', description: 'Vina Koper, Slovenska Istra, Primorska | Sladko | 0.50L', price: 25.00, image: '/menu-images/likersko-vino/sladki-refosk.png', categoryId: likerskoVino.id, sortOrder: 6, modifierGroupIds: [] },

      // --- TOČENO PIVO ---
      { name: 'Pivo Haler Lager Nefiltriran (0.30L)', description: 'Pivovarna Haler | 0.30L', price: 3.70, image: '/menu-images/toceno-pivo/haler-nefiltriran.png', categoryId: tocenoPivo.id, sortOrder: 0, modifierGroupIds: [] },
      { name: 'Pivo Haler Lager Nefiltriran (0.50L)', description: 'Pivovarna Haler | 0.50L', price: 4.00, image: '/menu-images/toceno-pivo/haler-nefiltriran.png', categoryId: tocenoPivo.id, sortOrder: 1, modifierGroupIds: [] },
      { name: 'Pivo Laško Lager (0.30L)', description: 'Pivovarna Laško | 0.30L', price: 3.70, image: '/menu-images/toceno-pivo/lasko-lager.png', categoryId: tocenoPivo.id, sortOrder: 2, modifierGroupIds: [] },
      { name: 'Pivo Laško Lager (0.50L)', description: 'Pivovarna Laško | 0.50L', price: 4.00, image: '/menu-images/toceno-pivo/lasko-lager.png', categoryId: tocenoPivo.id, sortOrder: 3, modifierGroupIds: [] },
      { name: 'Pivo Union Lager (0.30L)', description: 'Pivovarna Union | 0.30L', price: 3.70, image: '/menu-images/toceno-pivo/union-lager.png', categoryId: tocenoPivo.id, sortOrder: 4, modifierGroupIds: [] },
      { name: 'Pivo Union Lager (0.50L)', description: 'Pivovarna Union | 0.50L', price: 4.00, image: '/menu-images/toceno-pivo/union-lager.png', categoryId: tocenoPivo.id, sortOrder: 5, modifierGroupIds: [] },
      { name: 'Pelicon 3rd Pill IPA (0.30L)', description: 'Indian Pale Ale | Pivovarna Pelicon | 0.30L', price: 4.50, image: '/menu-images/toceno-pivo/pelicon-ipa.png', categoryId: tocenoPivo.id, sortOrder: 6, modifierGroupIds: [] },
      { name: 'Pelicon 3rd Pill IPA (0.50L)', description: 'Indian Pale Ale | Pivovarna Pelicon | 0.50L', price: 5.90, image: '/menu-images/toceno-pivo/pelicon-ipa.png', categoryId: tocenoPivo.id, sortOrder: 7, modifierGroupIds: [] },
      { name: 'Radler Grenivka (0.30L)', description: 'Grapefruit | Samo poleti | Pivovarna Union | 0.30L', price: 3.70, image: '/menu-images/toceno-pivo/radler.png', categoryId: tocenoPivo.id, sortOrder: 8, modifierGroupIds: [] },
      { name: 'Radler Grenivka (0.50L)', description: 'Grapefruit | Samo poleti | Pivovarna Union | 0.50L', price: 4.00, image: '/menu-images/toceno-pivo/radler.png', categoryId: tocenoPivo.id, sortOrder: 9, modifierGroupIds: [] },

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
      { name: 'Čaj z Limono in Medom', description: 'Topel čaj z limono in medom', price: 3.00, image: '/menu-images/topli-napitki/caj-limona-med.png', categoryId: topliNapitki.id, sortOrder: 16, modifierGroupIds: [sweetenerChoice.id, milkChoice.id] },
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
      { name: 'Mineralna Voda (0.25L)', description: 'Mineralna voda | 0.25L', price: 2.50, image: '/menu-images/vode/mineralna-voda.png', categoryId: vode.id, sortOrder: 0, modifierGroupIds: [] },
      { name: 'Mineralna Voda (0.50L)', description: 'Mineralna voda | 0.50L', price: 3.50, image: '/menu-images/vode/mineralna-voda.png', categoryId: vode.id, sortOrder: 1, modifierGroupIds: [] },
      { name: 'Mineralna Voda (1.00L)', description: 'Mineralna voda | 1.00L', price: 5.00, image: '/menu-images/vode/mineralna-voda.png', categoryId: vode.id, sortOrder: 2, modifierGroupIds: [] },
      { name: 'Naravna Voda (0.25L)', description: 'Naravna voda | 0.25L', price: 2.50, image: '/menu-images/vode/naravna-voda.png', categoryId: vode.id, sortOrder: 3, modifierGroupIds: [] },
      { name: 'Naravna Voda (0.50L)', description: 'Naravna voda | 0.50L', price: 3.50, image: '/menu-images/vode/naravna-voda.png', categoryId: vode.id, sortOrder: 4, modifierGroupIds: [] },
      { name: 'Naravna Voda (1.00L)', description: 'Naravna voda | 1.00L', price: 5.00, image: '/menu-images/vode/naravna-voda.png', categoryId: vode.id, sortOrder: 5, modifierGroupIds: [] },
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

    const menuItems = []
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
      db.employee.create({ data: { name: 'Ana Novak', email: 'ana@restaurant.com', phone: '040-123-456', role: 'admin', status: 'active' } }),
      db.employee.create({ data: { name: 'Marko Horvat', email: 'marko@restaurant.com', phone: '041-234-567', role: 'manager', status: 'active' } }),
      db.employee.create({ data: { name: 'Maja Kovač', email: 'maja@restaurant.com', phone: '042-345-678', role: 'staff', status: 'active' } }),
      db.employee.create({ data: { name: 'Luka Zupan', email: 'luka@restaurant.com', phone: '043-456-789', role: 'chef', status: 'active' } }),
      db.employee.create({ data: { name: 'Eva Krajnc', email: 'eva@restaurant.com', phone: '044-567-890', role: 'staff', status: 'active' } }),
      db.employee.create({ data: { name: 'Peter Mlakar', email: 'peter@restaurant.com', phone: '045-678-901', role: 'chef', status: 'inactive' } }),
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
    const orderTypes = ['dine-in', 'takeaway', 'delivery']
    const paymentMethods = ['cash', 'card', 'valuto']

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const ordersPerDay = Math.floor(Math.random() * 6) + 5
      for (let i = 0; i < ordersPerDay; i++) {
        const date = new Date()
        date.setDate(date.getDate() - dayOffset)
        date.setHours(Math.floor(Math.random() * 10) + 8, Math.floor(Math.random() * 60))

        const numItems = Math.floor(Math.random() * 4) + 1
        const selectedItems: { menuItemId: string; price: number; quantity: number }[] = []
        for (let j = 0; j < numItems; j++) {
          const item = menuItems[Math.floor(Math.random() * menuItems.length)]
          const existing = selectedItems.find(s => s.menuItemId === item.id)
          if (existing) {
            existing.quantity += 1
          } else {
            selectedItems.push({ menuItemId: item.id, price: item.price, quantity: Math.floor(Math.random() * 2) + 1 })
          }
        }

        const subtotal = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
        const tax = subtotal * 0.1
        const discount = Math.random() > 0.8 ? Math.round(subtotal * 0.1 * 100) / 100 : 0
        const total = subtotal + tax - discount

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
            subtotal: Math.round(subtotal * 100) / 100,
            tax: Math.round(tax * 100) / 100,
            discount,
            total: Math.round(total * 100) / 100,
            paymentStatus: status === 'completed' ? 'paid' : (Math.random() > 0.5 ? 'paid' : 'unpaid'),
            paymentMethod: status === 'completed' ? paymentMethods[Math.floor(Math.random() * 3)] : '',
            createdAt: date,
            orderItems: {
              create: selectedItems.map(item => ({
                menuItemId: item.menuItemId,
                quantity: item.quantity,
                price: item.price,
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
      db.diningOption.create({ data: { name: 'Na mestu', type: 'dine-in', prepTimeMinutes: 15, linkedServiceChargeId: null } }),
      db.diningOption.create({ data: { name: 'Za s seboj', type: 'takeout', prepTimeMinutes: 10, linkedServiceChargeId: null } }),
      db.diningOption.create({ data: { name: 'Dostava', type: 'delivery', prepTimeMinutes: 30, linkedServiceChargeId: terraceServiceCharge.id } }),
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
      db.voidReason.create({ data: { name: 'Naročilo po pomoti', isActive: true } }),
      db.voidReason.create({ data: { name: 'Nezadovoljstvo stranke', isActive: true } }),
      db.voidReason.create({ data: { name: 'Napaka v kuhinji', isActive: true } }),
      db.voidReason.create({ data: { name: 'Alergija', isActive: true } }),
      db.voidReason.create({ data: { name: 'Menjava artikla', isActive: true } }),
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
    // Webhooks
    await db.webhook.create({ data: { name: 'Test webhook', url: 'https://hooks.example.com/pos', events: 'order.created,order.completed,payment.received', isActive: false, secret: 'whsec_test123' } })
    // Jobs
    await Promise.all([
      db.job.create({ data: { name: 'Natakar', permissions: JSON.stringify(['orders','payments','tables']), defaultPayRate: 9.50 } }),
      db.job.create({ data: { name: 'Kuhar', permissions: JSON.stringify(['kitchen','inventory']), defaultPayRate: 10.50 } }),
      db.job.create({ data: { name: 'Barman', permissions: JSON.stringify(['orders','kitchen']), defaultPayRate: 9.80 } }),
      db.job.create({ data: { name: 'Vodja smene', permissions: JSON.stringify(['orders','payments','kitchen','inventory','employees','reports']), defaultPayRate: 13.00 } }),
      db.job.create({ data: { name: 'Upravljalec', permissions: JSON.stringify(['all']), defaultPayRate: 16.00 } }),
    ])

    return NextResponse.json({ success: true, message: 'Podatki so bili uspešno naloženi s slovensko ponudbo, vinsko kartico in konfiguracijo' })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({ error: 'Napaka pri nalaganju podatkov: ' + String(error) }, { status: 500 })
  }
}
