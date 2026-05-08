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

    // Pijača kategorije
    const [hotDrinks, coldDrinks, beer, wine, spirits, cocktails] = await Promise.all([
      db.category.create({ data: { name: 'Vroče pijače', icon: '☕', color: '#92400e', sortOrder: 0, menuId: drinksMenu.id } }),
      db.category.create({ data: { name: 'Hladne pijače', icon: '🧊', color: '#0ea5e9', sortOrder: 1, menuId: drinksMenu.id } }),
      db.category.create({ data: { name: 'Pivo', icon: '🍺', color: '#d97706', sortOrder: 2, menuId: drinksMenu.id } }),
      db.category.create({ data: { name: 'Vino', icon: '🍷', color: '#7c2d12', sortOrder: 3, menuId: drinksMenu.id } }),
      db.category.create({ data: { name: 'Žgane pijače', icon: '🥃', color: '#6b21a8', sortOrder: 4, menuId: drinksMenu.id } }),
      db.category.create({ data: { name: 'Koktajli', icon: '🍸', color: '#a855f7', sortOrder: 5, menuId: drinksMenu.id } }),
    ])

    // ============================================
    // MODIFIER SKUPINE (skupne, se delijo med artikli)
    // ============================================
    const [cookingLevel, sideChoice, sauceChoice, cheeseChoice, milkChoice, sweetenerChoice, alcoholAdd, pizzaSize, burgerSize, drinkSize, beerSize, wineSize, iceChoice] = await Promise.all([
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
      // Velikost pijače
      db.modifierGroup.create({ data: { name: 'Velikost', required: true, minSelect: 1, maxSelect: 1, sortOrder: 9, modifiers: { create: [
        { name: 'Mala (2dl)', price: 0, sortOrder: 0 },
        { name: 'Srednja (3dl)', price: 1.00, sortOrder: 1 },
        { name: 'Velika (5dl)', price: 2.00, sortOrder: 2 },
      ] } } }),
      // Velikost piva
      db.modifierGroup.create({ data: { name: 'Velikost piva', required: true, minSelect: 1, maxSelect: 1, sortOrder: 10, modifiers: { create: [
        { name: '0.33L', price: 0, sortOrder: 0 },
        { name: '0.5L', price: 1.50, sortOrder: 1 },
      ] } } }),
      // Vrsta vina
      db.modifierGroup.create({ data: { name: 'Vrsta vina', required: true, minSelect: 1, maxSelect: 1, sortOrder: 11, modifiers: { create: [
        { name: 'Kozarec (1.5dl)', price: 0, sortOrder: 0 },
        { name: 'Kozarec (2.5dl)', price: 2.00, sortOrder: 1 },
        { name: 'Steklenica (0.75L)', price: 8.00, sortOrder: 2 },
      ] } } }),
      // Led za pijačo
      db.modifierGroup.create({ data: { name: 'Led', required: false, minSelect: 0, maxSelect: 1, sortOrder: 12, modifiers: { create: [
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

      // --- VROČE PIJAČE ---
      { name: 'Kava', description: 'Klasičen espresso', price: 2.50, image: '/menu-images/kava-espresso.png', categoryId: hotDrinks.id, sortOrder: 0, modifierGroupIds: [milkChoice.id, sweetenerChoice.id, alcoholAdd.id] },
      { name: 'Kava z mlekom', description: 'Espresso s kapljico mleka', price: 3.00, image: '/menu-images/kava-z-mlekom.png', categoryId: hotDrinks.id, sortOrder: 1, modifierGroupIds: [milkChoice.id, sweetenerChoice.id, alcoholAdd.id] },
      { name: 'Bela kava', description: 'Espresso z veliko mlekom in peno', price: 3.50, image: '/menu-images/bela-kava.png', categoryId: hotDrinks.id, sortOrder: 2, modifierGroupIds: [milkChoice.id, sweetenerChoice.id, alcoholAdd.id] },
      { name: 'Cappuccino', description: 'Espresso s toplo mlečno peno', price: 3.50, image: '/menu-images/cappuccino.png', categoryId: hotDrinks.id, sortOrder: 3, modifierGroupIds: [milkChoice.id, sweetenerChoice.id] },
      { name: 'Čaj', description: 'Izbor čajev po izbiri', price: 3.00, image: '/menu-images/tea.png', categoryId: hotDrinks.id, sortOrder: 4, modifierGroupIds: [sweetenerChoice.id, milkChoice.id] },
      { name: 'Vroča čokolada', description: 'Gosta čokolada s smetano', price: 4.00, image: '/menu-images/hot-chocolate.png', categoryId: hotDrinks.id, sortOrder: 5, modifierGroupIds: [milkChoice.id, sweetenerChoice.id] },

      // --- HLADNE PIJAČE ---
      { name: 'Coca-Cola 0.33L', description: 'Klasična Coca-Cola', price: 3.00, image: '/menu-images/coca-cola-033.png', categoryId: coldDrinks.id, sortOrder: 0, modifierGroupIds: [iceChoice.id] },
      { name: 'Coca-Cola 0.5L', description: 'Klasična Coca-Cola, večja steklenica', price: 3.50, image: '/menu-images/coca-cola-05.png', categoryId: coldDrinks.id, sortOrder: 1, modifierGroupIds: [iceChoice.id] },
      { name: 'Fanta 0.33L', description: 'Pomarančni osvežilni napitek', price: 3.00, image: '/menu-images/fanta-033.png', categoryId: coldDrinks.id, sortOrder: 2, modifierGroupIds: [iceChoice.id] },
      { name: 'Sprite 0.33L', description: 'Limonin osvežilni napitek', price: 3.00, image: '/menu-images/sprite-033.png', categoryId: coldDrinks.id, sortOrder: 3, modifierGroupIds: [iceChoice.id] },
      { name: 'Radenska 0.5L', description: 'Radenska naravna mineralna voda', price: 2.50, image: '/menu-images/radenska-05.png', categoryId: coldDrinks.id, sortOrder: 4, modifierGroupIds: [iceChoice.id] },
      { name: 'Sveža limonada', description: 'Domača limonada', price: 4.50, image: '/menu-images/fresh-lemonade.png', categoryId: coldDrinks.id, sortOrder: 5, modifierGroupIds: [drinkSize.id] },
      { name: 'Ledena kava', description: 'Cold brew s smetano', price: 4.50, image: '/menu-images/iced-coffee.png', categoryId: coldDrinks.id, sortOrder: 6, modifierGroupIds: [milkChoice.id, sweetenerChoice.id, iceChoice.id] },
      { name: 'Sok pomaranča', description: 'Sveže stisnjen pomarančni sok', price: 3.50, image: '/menu-images/orange-juice.png', categoryId: coldDrinks.id, sortOrder: 7, modifierGroupIds: [] },
      { name: 'Jabolčni sok', description: 'Naravni jabolčni sok', price: 3.00, image: '/menu-images/apple-juice.png', categoryId: coldDrinks.id, sortOrder: 8, modifierGroupIds: [] },

      // --- PIVO ---
      { name: 'Laško Zlatorog 0.5L', description: 'Slovenski premium lagar, točeno', price: 4.50, image: '/menu-images/lasko-zlatorog-05.png', categoryId: beer.id, sortOrder: 0, modifierGroupIds: [] },
      { name: 'Laško Zlatorog 0.33L', description: 'Slovenski premium lagar', price: 3.50, image: '/menu-images/lasko-zlatorog-033.png', categoryId: beer.id, sortOrder: 1, modifierGroupIds: [] },
      { name: 'Laško Pivo 0.5L', description: 'Klasično Laško pivo, točeno', price: 4.00, image: '/menu-images/lasko-pivo-05.png', categoryId: beer.id, sortOrder: 2, modifierGroupIds: [] },
      { name: 'Laško Pivo 0.33L', description: 'Klasično Laško pivo', price: 3.20, image: '/menu-images/lasko-pivo-033.png', categoryId: beer.id, sortOrder: 3, modifierGroupIds: [] },
      { name: 'Union 0.5L', description: 'Ljubljansko Union pivo, točeno', price: 4.00, image: '/menu-images/union-pivo-05.png', categoryId: beer.id, sortOrder: 4, modifierGroupIds: [] },
      { name: 'Union 0.33L', description: 'Ljubljansko Union pivo', price: 3.20, image: '/menu-images/union-pivo-033.png', categoryId: beer.id, sortOrder: 5, modifierGroupIds: [] },
      { name: 'Temno pivo 0.5L', description: 'Temno pivo iz toča', price: 5.00, image: '/menu-images/temno-pivo-05.png', categoryId: beer.id, sortOrder: 6, modifierGroupIds: [] },
      { name: 'Craft pivo', description: 'Lokalno IPA pivo iz toča', price: 5.50, image: '/menu-images/craft-beer.png', categoryId: beer.id, sortOrder: 7, modifierGroupIds: [beerSize.id] },

      // --- VINO ---
      { name: 'Hišno rdeče vino', description: 'Slovensko rdeče vino, kozarec', price: 3.50, image: '/menu-images/hisno-rdece-vino.png', categoryId: wine.id, sortOrder: 0, modifierGroupIds: [wineSize.id] },
      { name: 'Hišno belo vino', description: 'Slovensko belo vino, kozarec', price: 3.50, image: '/menu-images/hisno-belo-vino.png', categoryId: wine.id, sortOrder: 1, modifierGroupIds: [wineSize.id] },
      { name: 'Malvazija', description: 'Primorska malvazija, kozarec', price: 4.50, image: '/menu-images/malvazija.png', categoryId: wine.id, sortOrder: 2, modifierGroupIds: [wineSize.id] },
      { name: 'Refošk', description: 'Primorski refošk, kozarec', price: 4.50, image: '/menu-images/refosk.png', categoryId: wine.id, sortOrder: 3, modifierGroupIds: [wineSize.id] },
      { name: 'Modra Frankinja', description: 'Prekmurska modra frankinja, kozarec', price: 5.00, image: '/menu-images/modra-frankinja.png', categoryId: wine.id, sortOrder: 4, modifierGroupIds: [wineSize.id] },
      { name: 'Laski Rizling', description: 'Podravski laški rizling, kozarec', price: 4.00, image: '/menu-images/laski-rizling.png', categoryId: wine.id, sortOrder: 5, modifierGroupIds: [wineSize.id] },

      // --- ŽGANE PIJAČE ---
      { name: 'Slivovka', description: 'Slovenska slivovka, 4cl', price: 3.50, image: '/menu-images/slivovka.png', categoryId: spirits.id, sortOrder: 0, modifierGroupIds: [] },
      { name: 'Pelinkovac', description: 'Tradicionalni pelinkovec, 4cl', price: 3.00, image: '/menu-images/pelinkovac.png', categoryId: spirits.id, sortOrder: 1, modifierGroupIds: [] },
      { name: 'Jägermeister', description: 'Zeliščni liker, 4cl', price: 4.00, image: '/menu-images/jagermeister.png', categoryId: spirits.id, sortOrder: 2, modifierGroupIds: [iceChoice.id] },
      { name: 'Whisky', description: 'Premium škotski whisky, 4cl', price: 6.00, image: '/menu-images/whisky.png', categoryId: spirits.id, sortOrder: 3, modifierGroupIds: [iceChoice.id] },
      { name: 'Rakija', description: 'Domača rakija, 4cl', price: 3.50, image: '/menu-images/rakija.png', categoryId: spirits.id, sortOrder: 4, modifierGroupIds: [] },
      { name: 'Vodka', description: 'Premium vodka, 4cl', price: 4.50, image: '/menu-images/vodka.png', categoryId: spirits.id, sortOrder: 5, modifierGroupIds: [iceChoice.id] },

      // --- KOKTAJLI ---
      { name: 'Aperol Spritz', description: 'Aperol, prosecco in soda', price: 8.00, image: '/menu-images/aperol-spritz.png', categoryId: cocktails.id, sortOrder: 0, modifierGroupIds: [iceChoice.id] },
      { name: 'Mojito', description: 'Rum, meta, limeta, soda', price: 9.00, image: '/menu-images/mojito.png', categoryId: cocktails.id, sortOrder: 1, modifierGroupIds: [iceChoice.id] },
      { name: 'Margarita', description: 'Tekila, triple sec, limeta', price: 9.50, image: '/menu-images/margarita.png', categoryId: cocktails.id, sortOrder: 2, modifierGroupIds: [iceChoice.id] },
      { name: 'Gin Tonic', description: 'Gin, tonik, limeta', price: 8.50, image: '/menu-images/gin-tonic.png', categoryId: cocktails.id, sortOrder: 3, modifierGroupIds: [iceChoice.id] },
      { name: 'Old Fashioned', description: 'Bourbon, sladkor, bitter, pomaranča', price: 10.00, image: '/menu-images/old-fashioned.png', categoryId: cocktails.id, sortOrder: 4, modifierGroupIds: [iceChoice.id] },
      { name: 'Piña Colada', description: 'Rum, kokosovo mleko, ananas', price: 9.00, image: '/menu-images/pina-colada.png', categoryId: cocktails.id, sortOrder: 5, modifierGroupIds: [iceChoice.id] },
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

    return NextResponse.json({ success: true, message: 'Podatki so bili uspešno naloženi s slovensko ponudbo' })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({ error: 'Napaka pri nalaganju podatkov: ' + String(error) }, { status: 500 })
  }
}
