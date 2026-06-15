import { CategoryRef, ModifierRef, MenuItemSeed } from './types'

// =====================================================================
// HRANA - Hladne predjedi, tople predjedi, juhe
// =====================================================================

export function getFoodStartersSoups(
  cats: Record<string, CategoryRef>,
  mods: Record<string, ModifierRef>
): MenuItemSeed[] {
  return [
    // --- HLAĐNE PREDJEDI ---
    { name: 'Domači narezek', description: 'Domače sušene kraške mesnine, sir (300g)', price: 25.00, categoryId: cats.hladnePredjedi.id, sortOrder: 0, image: '/menu-images/hladne-predjedi/domaci-narezek.png', modifierGroupIds: [] },
    { name: 'Pršut z olivami', description: 'Kraški pršut z olivami (300g)', price: 25.00, categoryId: cats.hladnePredjedi.id, sortOrder: 1, image: '/menu-images/hladne-predjedi/prsut-olive.png', modifierGroupIds: [] },
    { name: 'Sirova plošča', description: 'Izbira domačih sirov (300g)', price: 25.00, categoryId: cats.hladnePredjedi.id, sortOrder: 2, image: '/menu-images/hladne-predjedi/sirova-plosca.png', modifierGroupIds: [] },

    // --- TOPLE PREDJEDI ---
    { name: 'Ocvrti šampinjoni', description: 'Ocvrti šampinjoni s tatarsko omako', price: 8.50, categoryId: cats.toplePredjedi.id, sortOrder: 0, image: '/menu-images/tople-predjedi/ocvrti-sampinjoni.png', modifierGroupIds: [mods.sauceChoice.id] },
    { name: 'Šampinjoni na žaru z gorgonzolo', description: 'Šampinjoni na žaru z gorgonzola sirom', price: 10.50, categoryId: cats.toplePredjedi.id, sortOrder: 1, image: '/menu-images/tople-predjedi/sampinjoni-zar-gorgonzola.png', modifierGroupIds: [] },
    { name: 'Šampinjoni v gorgonzolni omaki', description: 'Šampinjoni v gorgonzolni omaki', price: 11.50, categoryId: cats.toplePredjedi.id, sortOrder: 2, image: '/menu-images/tople-predjedi/sampinjoni-gorgonzolna-omaka.png', modifierGroupIds: [] },
    { name: 'Šampinjoni na žaru tržaška omaka', description: 'Šampinjoni na žaru s tržaško omako', price: 8.50, categoryId: cats.toplePredjedi.id, sortOrder: 3, image: '/menu-images/tople-predjedi/sampinjoni-zar-trzaska.png', modifierGroupIds: [] },
    { name: 'Ocvrti sir s tatarsko omako', description: 'Ocvrti sir s tatarsko omako', price: 9.50, categoryId: cats.toplePredjedi.id, sortOrder: 4, image: '/menu-images/tople-predjedi/ocvrti-sir.png', modifierGroupIds: [mods.sauceChoice.id] },
    { name: 'Sirovi štruklji', description: 'Sirovi štruklji 3 kosi', price: 9.00, categoryId: cats.toplePredjedi.id, sortOrder: 5, image: '/menu-images/tople-predjedi/sirovi-struklji.png', modifierGroupIds: [] },
    { name: 'Popečena slanina na rukoli', description: 'Popečena slanina na rukoli', price: 6.00, categoryId: cats.toplePredjedi.id, sortOrder: 6, image: '/menu-images/tople-predjedi/slanina-rukola.png', modifierGroupIds: [] },

    // --- JUHE ---
    { name: 'Dnevna kremna gobova juha', description: 'Dnevna kremna gobova juha', price: 4.50, categoryId: cats.juhe.id, sortOrder: 0, image: '/menu-images/juhe/kremna-gobova.png', modifierGroupIds: [] },
    { name: 'Dnevna kremna zelenjavna juha', description: 'Dnevna kremna zelenjavna juha', price: 4.50, categoryId: cats.juhe.id, sortOrder: 1, image: '/menu-images/juhe/kremna-zelenjavna.png', modifierGroupIds: [] },
    { name: 'Goveja juha', description: 'Tradicionalna goveja juha', price: 4.00, categoryId: cats.juhe.id, sortOrder: 2, image: '/menu-images/juhe/goveja-klasicna.png', modifierGroupIds: [] },
  ]
}
