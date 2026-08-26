import { CategoryRef, ModifierRef, MenuItemSeed } from './types'

// =====================================================================
// PIJAČA - Žgane pijače (viski, gin, likerji, grenčice, destilati)
// =====================================================================

export function getDrinksSpirits(
  cats: Record<string, CategoryRef>,
  mods: Record<string, ModifierRef>
): MenuItemSeed[] {
  return [
    // --- VISKI ---
    { name: 'Chivas 12yo', description: 'Škotski, blended | 0.03L', price: 5.20, image: '/menu-images/viski/chivas-12.png', categoryId: cats.viski.id, sortOrder: 0, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Johnnie Walker Black', description: 'Škotska, blended | 0.03L', price: 6.50, image: '/menu-images/viski/johnnie-walker-black.png', categoryId: cats.viski.id, sortOrder: 1, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Jack Daniels', description: 'Tennessee, blended | 0.03L', price: 4.50, image: '/menu-images/viski/jack-daniels.png', categoryId: cats.viski.id, sortOrder: 2, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Jameson', description: 'Irska, blended | 0.03L', price: 4.50, image: '/menu-images/viski/jameson.png', categoryId: cats.viski.id, sortOrder: 3, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Lagavulin 16yo', description: 'Škotska, Islay single malt | 0.03L', price: 15.00, image: '/menu-images/viski/lagavulin-16.png', categoryId: cats.viski.id, sortOrder: 4, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Laphroaig 10yo', description: 'Škotska, Islay, single malt | 0.03L', price: 12.00, image: '/menu-images/viski/laphroaig-10.png', categoryId: cats.viski.id, sortOrder: 5, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Glenmorangie Lasanta 12yo', description: 'Škotska, single malt, sherry cask finish | 0.03L', price: 10.00, image: '/menu-images/viski/glenmorangie-lasanta.png', categoryId: cats.viski.id, sortOrder: 6, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Glenmorangie 18yo', description: 'Škotska, Highland, single malt | 0.03L', price: 20.00, image: '/menu-images/viski/glenmorangie-18.png', categoryId: cats.viski.id, sortOrder: 7, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Whisky Nikka Miyagikyo', description: 'Japonska, single malt | 0.03L', price: 15.00, image: '/menu-images/viski/nikka-miyagikyo.png', categoryId: cats.viski.id, sortOrder: 8, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Whisky Nikka From the Barrel', description: 'Japonska, blended | 0.03L', price: 10.50, image: '/menu-images/viski/nikka-barrel.png', categoryId: cats.viski.id, sortOrder: 9, modifierGroupIds: [mods.iceChoice.id] },

    // --- GIN ---
    { name: 'Gin Kristal London Dry', description: 'Slovenija, London dry | 0.03L', price: 5.00, image: '/menu-images/gin/gin-kristal.png', categoryId: cats.gin.id, sortOrder: 0, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Gin Monolog', description: 'Slovenija | 0.03L', price: 4.50, image: '/menu-images/gin/gin-monolog.png', categoryId: cats.gin.id, sortOrder: 1, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Gin Hendrick\'s', description: 'Škotska | 0.03L', price: 6.50, image: '/menu-images/gin/gin-hendricks.png', categoryId: cats.gin.id, sortOrder: 2, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Gin Mare', description: 'Španija | 0.03L', price: 7.00, image: '/menu-images/gin/gin-mare.png', categoryId: cats.gin.id, sortOrder: 3, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Gin Tanqueray', description: 'London dry | 0.03L', price: 4.50, image: '/menu-images/gin/gin-tanqueray.png', categoryId: cats.gin.id, sortOrder: 4, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Gin Monkey 47', description: 'Nemčija | 0.03L', price: 8.50, image: '/menu-images/gin/gin-monkey47.png', categoryId: cats.gin.id, sortOrder: 5, modifierGroupIds: [mods.iceChoice.id] },

    // --- LIKERJI ---
    { name: 'Liker Malibu Rum', description: '0.03L', price: 4.50, image: '/menu-images/likerji/malibu.png', categoryId: cats.likerji.id, sortOrder: 0, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Liker Canella', description: '0.03L', price: 5.50, image: '/menu-images/likerji/canella.png', categoryId: cats.likerji.id, sortOrder: 1, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Liker Rum Bumbu Cream', description: '0.03L', price: 5.50, image: '/menu-images/likerji/bumbu-cream.png', categoryId: cats.likerji.id, sortOrder: 2, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Liker Carolans', description: '0.03L', price: 4.50, image: '/menu-images/likerji/carolans.png', categoryId: cats.likerji.id, sortOrder: 3, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Liker Medica Kejžar', description: '0.03L', price: 4.20, image: '/menu-images/likerji/medica-kejzar.png', categoryId: cats.likerji.id, sortOrder: 4, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Liker Borovnica Kejžar', description: '0.03L', price: 4.20, image: '/menu-images/likerji/borovnica-kejzar.png', categoryId: cats.likerji.id, sortOrder: 5, modifierGroupIds: [mods.iceChoice.id] },

    // --- GRENČICE ---
    { name: 'Pelinkovec Badel Antique', description: '0.03L', price: 4.20, image: '/menu-images/grencice/pelinkovec.png', categoryId: cats.grencice.id, sortOrder: 0, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Cynar', description: '0.03L', price: 3.80, image: '/menu-images/grencice/cynar.png', categoryId: cats.grencice.id, sortOrder: 1, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Jägermeister', description: '0.03L', price: 3.80, image: '/menu-images/grencice/jagermeister.png', categoryId: cats.grencice.id, sortOrder: 2, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Amaro', description: '0.03L', price: 3.80, image: '/menu-images/grencice/amaro.png', categoryId: cats.grencice.id, sortOrder: 3, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Campari Bitter', description: '0.03L', price: 3.80, image: '/menu-images/grencice/campari.png', categoryId: cats.grencice.id, sortOrder: 4, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Aperol', description: '0.03L', price: 3.80, image: '/menu-images/grencice/aperol.png', categoryId: cats.grencice.id, sortOrder: 5, modifierGroupIds: [mods.iceChoice.id] },

    // --- DESTILATI, KONJAK IN RUM ---
    { name: 'Viljamovka', description: '0.03L', price: 5.00, image: '/menu-images/destilati/viljamovka.png', categoryId: cats.destilati.id, sortOrder: 0, modifierGroupIds: [] },
    { name: 'Slivovka', description: '0.03L', price: 5.50, image: '/menu-images/destilati/slivovka.png', categoryId: cats.destilati.id, sortOrder: 1, modifierGroupIds: [] },
    { name: 'Brinjevec', description: '0.03L', price: 5.50, image: '/menu-images/destilati/brinjevec.png', categoryId: cats.destilati.id, sortOrder: 2, modifierGroupIds: [] },
    { name: 'Grappa Sofija Rebula', description: 'Jakončič | 0.03L', price: 5.50, image: '/menu-images/destilati/grappa-sofija.png', categoryId: cats.destilati.id, sortOrder: 3, modifierGroupIds: [] },
    { name: 'Travarica Rossi', description: 'Istra | 0.03L', price: 5.00, image: '/menu-images/destilati/travarica-rossi.png', categoryId: cats.destilati.id, sortOrder: 4, modifierGroupIds: [] },
    { name: 'Hennessy V.S.', description: 'Konjak | 0.03L', price: 6.50, image: '/menu-images/destilati/hennessy-vs.png', categoryId: cats.destilati.id, sortOrder: 5, modifierGroupIds: [] },
    { name: 'Hennessy X.O.', description: 'Konjak | 0.03L', price: 25.00, image: '/menu-images/destilati/hennessy-xo.png', categoryId: cats.destilati.id, sortOrder: 6, modifierGroupIds: [] },
    { name: 'Cognac Delamaine X.O.', description: 'Konjak | 0.03L', price: 25.00, image: '/menu-images/destilati/delamaine-xo.png', categoryId: cats.destilati.id, sortOrder: 7, modifierGroupIds: [] },
    { name: 'Ararat 6yo', description: 'Vinjak | 0.03L', price: 5.50, image: '/menu-images/destilati/ararat-6.png', categoryId: cats.destilati.id, sortOrder: 8, modifierGroupIds: [] },
    { name: 'Ararat 15yo', description: 'Vinjak | 0.03L', price: 12.50, image: '/menu-images/destilati/ararat-15.png', categoryId: cats.destilati.id, sortOrder: 9, modifierGroupIds: [] },
    { name: 'Ararat 20yo', description: 'Vinjak | 0.03L', price: 17.50, image: '/menu-images/destilati/ararat-20.png', categoryId: cats.destilati.id, sortOrder: 10, modifierGroupIds: [] },
    { name: 'Rum Bumbu Original', description: '0.03L', price: 6.50, image: '/menu-images/destilati/rum-bumbu.png', categoryId: cats.destilati.id, sortOrder: 11, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Rum Zacapa Solera 23yo', description: 'Guatemala | 0.03L', price: 15.00, image: '/menu-images/destilati/rum-zacapa.png', categoryId: cats.destilati.id, sortOrder: 12, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Rum Diplomatico Reserva Exclusiva', description: 'Venezuela | 0.03L', price: 7.50, image: '/menu-images/destilati/rum-diplomatico.png', categoryId: cats.destilati.id, sortOrder: 13, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Rum La Hechicera Reserva Familiar 21yo', description: 'Kolumbija | 0.03L', price: 8.00, image: '/menu-images/destilati/rum-hechicera.png', categoryId: cats.destilati.id, sortOrder: 14, modifierGroupIds: [mods.iceChoice.id] },
  ]
}
