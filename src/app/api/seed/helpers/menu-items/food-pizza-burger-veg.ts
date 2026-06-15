import { CategoryRef, ModifierRef, MenuItemSeed } from './types'

// =====================================================================
// HRANA - Pizze, burgerji, vegetarijanske jedi
// =====================================================================

export function getFoodPizzaBurgerVeg(
  cats: Record<string, CategoryRef>,
  mods: Record<string, ModifierRef>
): MenuItemSeed[] {
  return [
    // --- PIZZE ---
    { name: 'Margerita', description: 'Pelati, mozzarella, origano, oliva', price: 11.30, categoryId: cats.pizza.id, sortOrder: 0, image: '/menu-images/pizze/margerita.png', modifierGroupIds: [mods.pizzaSize.id] },
    { name: 'Kraljica', description: 'Pelati, mozzarella, kuhan pršut, gobe, origano, oliva', price: 11.90, categoryId: cats.pizza.id, sortOrder: 1, image: '/menu-images/pizze/kraljica.png', modifierGroupIds: [mods.pizzaSize.id] },
    { name: 'Hišna pica', description: 'Pelati, mozzarella, kuhan pršut, domača šunka, suha goveja salama, hrenovka, slanina, gobe, origano, oliva', price: 12.30, categoryId: cats.pizza.id, sortOrder: 2, image: '/menu-images/pizze/hisna.png', modifierGroupIds: [mods.pizzaSize.id] },
    { name: 'Kraška', description: 'Pelati, mozzarella, pršut, gobe, origano, oliva', price: 12.60, categoryId: cats.pizza.id, sortOrder: 3, image: '/menu-images/pizze/kraska.png', modifierGroupIds: [mods.pizzaSize.id] },
    { name: '4. Letni časi', description: 'Pelati, mozzarella, kuhan pršut, goveja suha salama, gobe, origano, oliva', price: 12.30, categoryId: cats.pizza.id, sortOrder: 4, image: '/menu-images/pizze/4-letni-casi.png', modifierGroupIds: [mods.pizzaSize.id] },
    { name: 'Pikant', description: 'Pelati, mozzarella, kuhan pršut, pikantna suha salama, feferoni, gobe, origano, oliva', price: 12.30, categoryId: cats.pizza.id, sortOrder: 5, image: '/menu-images/pizze/pikant.png', modifierGroupIds: [mods.pizzaSize.id] },
    { name: 'Kmečka', description: 'Pelati, mozzarella, domača šunka, gobe, hren s kislo smetano, origano, oliva', price: 12.30, categoryId: cats.pizza.id, sortOrder: 6, image: '/menu-images/pizze/kmecka.png', modifierGroupIds: [mods.pizzaSize.id] },
    { name: 'Lovska', description: 'Pelati, mozzarella, divjačinska salama, kisle kumarice, origano, čebula', price: 12.30, categoryId: cats.pizza.id, sortOrder: 7, image: '/menu-images/pizze/lovska.png', modifierGroupIds: [mods.pizzaSize.id] },
    { name: 'Romana', description: 'Pelati, mozzarella, kuhan pršut, origano, oliva', price: 11.90, categoryId: cats.pizza.id, sortOrder: 8, image: '/menu-images/pizze/romana.png', modifierGroupIds: [mods.pizzaSize.id] },
    { name: 'S slanino', description: 'Pelati, mozzarella, slanina, gobe, origano, oliva', price: 12.30, categoryId: cats.pizza.id, sortOrder: 9, image: '/menu-images/pizze/s-slanino.png', modifierGroupIds: [mods.pizzaSize.id] },
    { name: 'Študentska', description: 'Pelati, mozzarella, kuhan pršut, hrenovke, gobe, origano, oliva', price: 12.10, categoryId: cats.pizza.id, sortOrder: 10, image: '/menu-images/pizze/studentska.png', modifierGroupIds: [mods.pizzaSize.id] },
    { name: 'Bolognese', description: 'Pelati, mozzarella, bolognese omaka, čebula, origano, oliva', price: 12.50, categoryId: cats.pizza.id, sortOrder: 11, image: '/menu-images/pizze/bolognese.png', modifierGroupIds: [mods.pizzaSize.id] },
    { name: 'Morska', description: 'Pelati, mozzarella, školjke, gambere, lignji, česen, origano, oliva', price: 12.70, categoryId: cats.pizza.id, sortOrder: 12, image: '/menu-images/pizze/morska.png', modifierGroupIds: [mods.pizzaSize.id] },
    { name: 'S tuno', description: 'Pelati, mozzarella, tuna, čebula, origano, oliva', price: 12.70, categoryId: cats.pizza.id, sortOrder: 13, image: '/menu-images/pizze/s-tuno.png', modifierGroupIds: [mods.pizzaSize.id] },
    { name: 'Ribiška', description: 'Pelati, mozzarella, slaniki, origano, oliva', price: 12.30, categoryId: cats.pizza.id, sortOrder: 14, image: '/menu-images/pizze/ribiska.png', modifierGroupIds: [mods.pizzaSize.id] },
    { name: 'S suho salamo', description: 'Pelati, mozzarella, goveja suha salama, gobe, origano, oliva', price: 12.30, categoryId: cats.pizza.id, sortOrder: 15, image: '/menu-images/pizze/suha-salama.png', modifierGroupIds: [mods.pizzaSize.id] },
    { name: 'Štirje siri', description: 'Pelati, mozzarella, gauda, edamec, gorgonzola, kisla smetana, origano, oliva', price: 11.90, categoryId: cats.pizza.id, sortOrder: 16, image: '/menu-images/pizze/4-siri.png', modifierGroupIds: [mods.pizzaSize.id] },
    { name: 'Vegetarijanska', description: 'Pelati, mozzarella, bučke, češnjev paradižnik, čebula, koruza, origano, olive', price: 11.90, categoryId: cats.pizza.id, sortOrder: 17, image: '/menu-images/pizze/vegetarijanska.png', modifierGroupIds: [mods.pizzaSize.id] },
    { name: 'S svežo zelenjavo', description: 'Pelati, mozzarella, paradižnik, melancani, sveža paprika, gobe, origano, oliva', price: 11.90, categoryId: cats.pizza.id, sortOrder: 18, image: '/menu-images/pizze/svezja-zelenjava.png', modifierGroupIds: [mods.pizzaSize.id] },
    { name: 'S svežimi šampinjoni', description: 'Pelati, mozzarella, sveži šampinjoni, origano, oliva', price: 11.90, categoryId: cats.pizza.id, sortOrder: 19, image: '/menu-images/pizze/sampinjoni.png', modifierGroupIds: [mods.pizzaSize.id] },
    { name: 'Z melancani', description: 'Pelati, mozzarella, melancani, gobe, origano, oliva', price: 11.90, categoryId: cats.pizza.id, sortOrder: 20, image: '/menu-images/pizze/melancani.png', modifierGroupIds: [mods.pizzaSize.id] },
    { name: 'Z rukolo', description: 'Pelati, mozzarella, rukola, origano, oliva', price: 11.90, categoryId: cats.pizza.id, sortOrder: 21, image: '/menu-images/pizze/z-rukolo.png', modifierGroupIds: [mods.pizzaSize.id] },
    { name: 'Napoli', description: 'Pelati, mozzarella, češnjev paradižnik, origano, bazilika', price: 11.50, categoryId: cats.pizza.id, sortOrder: 22, image: '/menu-images/pizze/napoli.png', modifierGroupIds: [mods.pizzaSize.id] },
    { name: 'Z gamberi', description: 'Pelati, mozzarella, gamberi, origano, bazilika', price: 13.10, categoryId: cats.pizza.id, sortOrder: 23, image: '/menu-images/pizze/z-gamberi.png', modifierGroupIds: [mods.pizzaSize.id] },
    { name: 'Kebab', description: 'Pelati, mozzarella, piščančji kebab, sveža paprika, bazilika, origano, kisla smetana', price: 12.30, categoryId: cats.pizza.id, sortOrder: 24, image: '/menu-images/pizze/kebab.png', modifierGroupIds: [mods.pizzaSize.id] },
    { name: 'Mehiška', description: 'Pelati, mozzarella, bolognese, čebula, češnjev paradižnik, koruza, nacho, origano, feferon', price: 12.30, categoryId: cats.pizza.id, sortOrder: 25, image: '/menu-images/pizze/mehiska.png', modifierGroupIds: [mods.pizzaSize.id] },
    { name: 'Mortadela', description: 'Mozzarella, kisla smetana, mortadela, pistacija, bazilika', price: 12.40, categoryId: cats.pizza.id, sortOrder: 26, image: '/menu-images/pizze/mortadela.png', modifierGroupIds: [mods.pizzaSize.id] },

    // --- BURGERJI ---
    { name: 'Hišni burger', description: "Hišna bombeta, 100% govedina slovenskega porekla 170g, medena majoneza z Dijon gorčico, kozji sir, hrustljava slanina, karamelizirana čebula, american style zeljnata solatka, ocvrti čebulni obročki", price: 10.20, categoryId: cats.burgerji.id, sortOrder: 0, image: '/menu-images/burgerji/hisni-burger.png', modifierGroupIds: [] },
    { name: "Jamie's italian burger", description: "Hišna bombeta, 100% govedina slovenskega porekla 170g, hišna omaka, cheddar sir, hrustljava slanina, karamelizirana čebula, rezine paradižnika, rezine kislih kumaric", price: 9.90, categoryId: cats.burgerji.id, sortOrder: 1, image: '/menu-images/burgerji/jamies-italian.png', modifierGroupIds: [] },
    { name: 'Cheese please', description: 'Hišna bombeta, 100% govedina slovenskega porekla 170g, omaka 3 vrst sira cheddar-nacho-le brie, rezine paradižnika, koktajl omaka, svež list solate ledenke', price: 9.70, categoryId: cats.burgerji.id, sortOrder: 2, image: '/menu-images/burgerji/cheese-please.png', modifierGroupIds: [] },
    { name: 'Big BOSS', description: 'Hišna bombeta, 100% govedina slovenskega porekla 170g, rezine roastbeefa, koščki hrustljave čebule, tartufina majoneza, rezina popečenega jabolka', price: 12.90, categoryId: cats.burgerji.id, sortOrder: 3, image: '/menu-images/burgerji/big-boss.png', modifierGroupIds: [] },
    { name: 'The classic', description: 'Hišna bombeta, 100% govedina slovenskega porekla 170g, svež list solate ledenke, rezine paradižnika, cheddar sir, hišna omaka', price: 9.50, categoryId: cats.burgerji.id, sortOrder: 4, image: '/menu-images/burgerji/the-classic.png', modifierGroupIds: [] },
    { name: 'Green garden', description: 'Hišna bombeta, bazilični pesto s koščki sušenega češnjevega paradižnika, popečena marinirana bučka in melancan, koščki hrustljave čebule, svež list solate ledenke, rezine paradižnika', price: 8.50, categoryId: cats.burgerji.id, sortOrder: 5, image: '/menu-images/burgerji/green-garden.png', modifierGroupIds: [] },
    { name: 'Big smash burger', description: 'Hišna bombeta, 100% govedina slovenskega porekla 2x90g – smash, mac omaka, rezine topljenega sira, cheddar sir, kisle kumarice, sveža sladka čebula, svež list solate ledenke', price: 9.90, categoryId: cats.burgerji.id, sortOrder: 6, image: '/menu-images/burgerji/big-smash.png', modifierGroupIds: [] },
    { name: 'Crispy chicken burger', description: 'Hišna bombeta, ocvrta piščančja prsa (marinirana, panirana v koruznih kosmičih) 180g, kremna česnova majoneza s kislo smetano, rezine topljenega sira, svež list solate ledenke', price: 9.90, categoryId: cats.burgerji.id, sortOrder: 7, image: '/menu-images/burgerji/crispy-chicken.png', modifierGroupIds: [] },
    { name: 'Fit burger', description: 'Hišna bombeta, piščančja prsa (marinirana, pečena na žaru) 180g, avokado omaka, pečene bučke na žaru, jajce na oko, rezine paradižnika', price: 9.90, categoryId: cats.burgerji.id, sortOrder: 8, image: '/menu-images/burgerji/fit-burger.png', modifierGroupIds: [] },

    // --- VEGETARIJANSKE JEDI ---
    { name: 'Zelenjavni zrezki', description: 'Zelenjavni zrezki', price: 8.50, categoryId: cats.vegetarijanske.id, sortOrder: 0, image: '/menu-images/vegetarijanske-jedi/zelenjavni-zrezki.png', modifierGroupIds: [] },
    { name: 'Zelenjavni krožnik', description: 'Kuhana zelenjava, zelenjavni zrezek, ocvrt šampinjon', price: 8.50, categoryId: cats.vegetarijanske.id, sortOrder: 1, image: '/menu-images/vegetarijanske-jedi/zelenjavni-kroznik.png', modifierGroupIds: [] },
    { name: 'Sojini polpeti', description: 'Sojini polpeti', price: 8.50, categoryId: cats.vegetarijanske.id, sortOrder: 2, image: '/menu-images/vegetarijanske-jedi/sojini-polpeti.png', modifierGroupIds: [] },
    { name: 'Vegetarijanska plošča', description: 'Kuhana zelenjava, zelenjavni zrezek, sojin polpet, ocvrta cvetača, ocvrti šampinjoni', price: 11.00, categoryId: cats.vegetarijanske.id, sortOrder: 3, image: '/menu-images/vegetarijanske-jedi/vegetarijanska-plosca.png', modifierGroupIds: [] },
    { name: 'Bučke na žaru', description: 'Česen, olivno olje', price: 8.50, categoryId: cats.vegetarijanske.id, sortOrder: 4, image: '/menu-images/vegetarijanske-jedi/bucke-na-zaru.png', modifierGroupIds: [] },
    { name: 'Ocvrte bučke', description: 'Ocvrte bučke', price: 8.50, categoryId: cats.vegetarijanske.id, sortOrder: 5, image: '/menu-images/vegetarijanske-jedi/ocvrte-bucke.png', modifierGroupIds: [] },
    { name: 'Ocvrti melancani', description: 'Ocvrti melancani', price: 8.50, categoryId: cats.vegetarijanske.id, sortOrder: 6, image: '/menu-images/vegetarijanske-jedi/ocvrti-melancani.png', modifierGroupIds: [] },
    { name: 'Pečena sveža zelenjava na rukoli', description: 'Pečena sveža zelenjava na rukoli', price: 11.00, categoryId: cats.vegetarijanske.id, sortOrder: 7, image: '/menu-images/vegetarijanske-jedi/pecena-zelenjava-rukola.png', modifierGroupIds: [] },
  ]
}
