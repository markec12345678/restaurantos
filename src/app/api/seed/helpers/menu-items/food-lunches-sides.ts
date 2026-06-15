import { CategoryRef, ModifierRef, MenuItemSeed } from './types'

// =====================================================================
// HRANA - Malice, priloge, omake
// =====================================================================

export function getFoodLunchesSides(
  cats: Record<string, CategoryRef>,
  mods: Record<string, ModifierRef>
): MenuItemSeed[] {
  return [
    // --- MALICE (Dnevno kosilo) ---
    { name: 'Malica - Dunajski zrezek', description: 'Svinjski/puranji/piščančji dunajski zrezek, pommes frites, solata (200g)', price: 9.90, categoryId: cats.malice.id, sortOrder: 0, image: '/menu-images/malice/malica-dunajski.png', modifierGroupIds: [] },
    { name: 'Malica - Pariški zrezek', description: 'Svinjski/puranji/piščančji pariški zrezek, pommes frites, solata (200g)', price: 9.90, categoryId: cats.malice.id, sortOrder: 1, image: '/menu-images/malice/malica-pariski.png', modifierGroupIds: [] },
    { name: 'Malica - Pečena rebra', description: 'Pražen krompir, solata (400g)', price: 9.90, categoryId: cats.malice.id, sortOrder: 2, image: '/menu-images/malice/malica-pecena-rebra.png', modifierGroupIds: [] },
    { name: 'Malica - BBQ perutničke', description: 'Pommes frites (400g)', price: 9.90, categoryId: cats.malice.id, sortOrder: 3, image: '/menu-images/malice/malica-bbq-perutnicke.png', modifierGroupIds: [] },
    { name: 'Malica - Svinjska pečenka', description: 'Pražen krompir, solata (400g)', price: 10.20, categoryId: cats.malice.id, sortOrder: 4, image: '/menu-images/malice/malica-svinjska-pecenka.png', modifierGroupIds: [] },
    { name: 'Malica - Ocvrti oslič', description: 'Krompirjeva solata, ob petkih s francosko solato (400g)', price: 10.20, categoryId: cats.malice.id, sortOrder: 5, image: '/menu-images/malice/malica-ocvrti-oslic.png', modifierGroupIds: [] },
    { name: 'Malica - Ocvrti oslič s pomfrijem', description: 'Pommes frites, tatarska omaka, solata (300g)', price: 9.90, categoryId: cats.malice.id, sortOrder: 6, image: '/menu-images/malice/malica-oslic-pomfri.png', modifierGroupIds: [] },
    { name: 'Malica - Ocvrti sir', description: 'Solata (200g)', price: 8.90, categoryId: cats.malice.id, sortOrder: 7, image: '/menu-images/malice/malica-ocvrti-sir.png', modifierGroupIds: [] },
    { name: 'Malica - Špageti bolognese', description: 'Špageti z bolognese omako (200g)', price: 8.90, categoryId: cats.malice.id, sortOrder: 8, image: '/menu-images/malice/malica-spageti-bolognese.png', modifierGroupIds: [] },
    { name: 'Malica - Mesni sir', description: 'Polnjen s sirom in šampinjoni, kruhova rezina, solata (200g)', price: 9.90, categoryId: cats.malice.id, sortOrder: 9, image: '/menu-images/malice/malica-mesni-sir.png', modifierGroupIds: [] },
    { name: 'Malica - Bograč', description: 'Bograč v kotličku', price: 9.00, categoryId: cats.malice.id, sortOrder: 10, image: '/menu-images/malice/malica-bograc.png', modifierGroupIds: [] },
    { name: 'Malica - Goveji golaž', description: 'Goveji golaž s kruhovo rezino', price: 10.00, categoryId: cats.malice.id, sortOrder: 11, image: '/menu-images/malice/malica-goveji-golaz.png', modifierGroupIds: [] },

    // --- PRILOGE ---
    { name: 'Krompirjev čips', description: 'Hrustljavi čips', price: 4.00, categoryId: cats.priloge.id, sortOrder: 0, image: '/menu-images/priloge/krompirjev-cips.png', modifierGroupIds: [] },
    { name: 'Pommes frites', description: 'Hrustljavi pomfri', price: 4.00, categoryId: cats.priloge.id, sortOrder: 1, image: '/menu-images/priloge/pommes-frites.png', modifierGroupIds: [mods.sauceChoice.id] },
    { name: 'Žlebasti krompirček', description: 'Žlebasti krompirček', price: 4.00, categoryId: cats.priloge.id, sortOrder: 2, image: '/menu-images/priloge/zlebasti-krompircek.png', modifierGroupIds: [] },
    { name: 'Krompirjevi ocvrtki', description: 'Krompirjevi ocvrtki', price: 4.00, categoryId: cats.priloge.id, sortOrder: 3, image: '/menu-images/priloge/krompirjevi-ocvrtki.png', modifierGroupIds: [] },
    { name: 'Slan krompir', description: 'Slan krompir', price: 4.00, categoryId: cats.priloge.id, sortOrder: 4, image: '/menu-images/priloge/slan-krompir.png', modifierGroupIds: [] },
    { name: 'Pražen krompir', description: 'Pražen krompir', price: 4.00, categoryId: cats.priloge.id, sortOrder: 5, image: '/menu-images/priloge/prazen-krompir.png', modifierGroupIds: [] },
    { name: 'Pečen krompir', description: 'Pečen krompir', price: 4.00, categoryId: cats.priloge.id, sortOrder: 6, image: '/menu-images/priloge/pecen-krompir.png', modifierGroupIds: [] },
    { name: 'Kuhan popečen krompir', description: 'Kuhan popečen krompir', price: 4.00, categoryId: cats.priloge.id, sortOrder: 7, image: '/menu-images/priloge/kuhan-popecen-krompir.png', modifierGroupIds: [] },
    { name: 'Riž', description: 'Riž', price: 3.50, categoryId: cats.priloge.id, sortOrder: 8, image: '/menu-images/priloge/riz.png', modifierGroupIds: [] },
    { name: 'Kuhana zelenjava', description: 'Kuhana zelenjava', price: 3.90, categoryId: cats.priloge.id, sortOrder: 9, image: '/menu-images/priloge/kuhana-zelenjava.png', modifierGroupIds: [] },
    { name: 'Ocvrti njoki', description: 'Ocvrti njoki', price: 4.50, categoryId: cats.priloge.id, sortOrder: 10, image: '/menu-images/priloge/ocvrti-njoki.png', modifierGroupIds: [] },
    { name: 'Kuhani njoki', description: 'Kuhani njoki', price: 4.50, categoryId: cats.priloge.id, sortOrder: 11, image: '/menu-images/priloge/kuhani-njoki.png', modifierGroupIds: [] },
    { name: 'Sirov štrukelj', description: 'Sirov štrukelj', price: 3.70, categoryId: cats.priloge.id, sortOrder: 12, image: '/menu-images/priloge/sirov-strukelj.png', modifierGroupIds: [] },
    { name: 'Široki rezanci', description: 'Široki rezanci', price: 3.50, categoryId: cats.priloge.id, sortOrder: 13, image: '/menu-images/priloge/siroki-rezanci.png', modifierGroupIds: [] },
    { name: 'Bučke na žaru s česnom', description: 'Bučke na žaru s česnom in olivnim oljem', price: 4.90, categoryId: cats.priloge.id, sortOrder: 14, image: '/menu-images/priloge/bucke-zar-cesen.png', modifierGroupIds: [] },
    { name: 'Ocvrte bučke', description: 'Ocvrte bučke', price: 4.90, categoryId: cats.priloge.id, sortOrder: 15, image: '/menu-images/priloge/ocvrte-bucke.png', modifierGroupIds: [] },
    { name: 'Pečena sveža zelenjava', description: 'Pečena sveža zelenjava', price: 4.90, categoryId: cats.priloge.id, sortOrder: 16, image: '/menu-images/priloge/pecena-zelenjava.png', modifierGroupIds: [] },
    { name: 'Trdi sir Grana Padano', description: 'Trdi sir Grana Padano', price: 2.50, categoryId: cats.priloge.id, sortOrder: 17, image: '/menu-images/priloge/grana-padano.png', modifierGroupIds: [] },

    // --- OMAKE ---
    { name: 'Poprova omaka', description: 'Poprova omaka', price: 3.90, categoryId: cats.omake.id, sortOrder: 0, image: '/menu-images/omake/poprova-omaka.png', modifierGroupIds: [] },
    { name: 'Gobova omaka', description: 'Gobova omaka', price: 3.90, categoryId: cats.omake.id, sortOrder: 1, image: '/menu-images/omake/gobova-omaka.png', modifierGroupIds: [] },
    { name: 'Smetanova omaka', description: 'Smetanova omaka', price: 3.90, categoryId: cats.omake.id, sortOrder: 2, image: '/menu-images/omake/smetanova-omaka.png', modifierGroupIds: [] },
    { name: 'Orehova omaka', description: 'Orehova omaka', price: 3.90, categoryId: cats.omake.id, sortOrder: 3, image: '/menu-images/omake/orehova-omaka.png', modifierGroupIds: [] },
    { name: 'Gorgonzolna omaka', description: 'Gorgonzolna omaka', price: 3.90, categoryId: cats.omake.id, sortOrder: 4, image: '/menu-images/omake/gorgonzolna-omaka.png', modifierGroupIds: [] },
    { name: 'Gozdarska omaka', description: 'Gozdarska omaka', price: 3.90, categoryId: cats.omake.id, sortOrder: 5, image: '/menu-images/omake/gozdarska-omaka.png', modifierGroupIds: [] },
    { name: 'Sirova omaka', description: 'Sirova omaka', price: 3.90, categoryId: cats.omake.id, sortOrder: 6, image: '/menu-images/omake/sirova-omaka.png', modifierGroupIds: [] },
    { name: 'Curry omaka', description: 'Curry omaka', price: 3.90, categoryId: cats.omake.id, sortOrder: 7, image: '/menu-images/omake/curry-omaka.png', modifierGroupIds: [] },
    { name: 'Gorčična omaka', description: 'Gorčična omaka', price: 3.90, categoryId: cats.omake.id, sortOrder: 8, image: '/menu-images/omake/gorcicna-omaka.png', modifierGroupIds: [] },
  ]
}
