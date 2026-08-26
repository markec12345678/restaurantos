import { CategoryRef, ModifierRef, MenuItemSeed } from './types'

// =====================================================================
// HRANA - Palačinke, sladice, otroške jedi
// =====================================================================

export function getFoodPancakesDessertsKids(
  cats: Record<string, CategoryRef>,
  _mods: Record<string, ModifierRef>
): MenuItemSeed[] {
  return [
    // --- PALAČINKE ---
    { name: 'Jurmačinka', description: 'Klasika: jagodni pire, Kinder krema, Lino Lada, napojeni Plazma biskvit. Dekoracija: krema bele čokolade, krema pistacije, jagodni pire, mleta Plazma, sveže jagode', price: 9.90, categoryId: cats.palacinke.id, sortOrder: 0, image: '/menu-images/palacinke/jurmacinka.png', modifierGroupIds: [] },
    { name: 'Raffaello', description: 'Klasika: krema bele čokolade, Lino Lada, mleti mandlji, kokosova krema, napojeni Plazma biskvit. Dekoracija: krema bele čokolade, kokosova moka, mleti mandlji, Raffaello kroglica', price: 9.70, categoryId: cats.palacinke.id, sortOrder: 1, image: '/menu-images/palacinke/raffaello.png', modifierGroupIds: [] },
    { name: 'Babičina poslastica', description: 'Klasika: jabolčna marmelada, vanilijeva desertna krema, cimetovi piškoti. Dekoracija: vanilijeva desertna krema, jabolko, cimetovi piškoti, cimet', price: 9.90, categoryId: cats.palacinke.id, sortOrder: 2, image: '/menu-images/palacinke/babicina-poslastica.png', modifierGroupIds: [] },
    { name: 'Cheesecake oreo z jagodo', description: 'Klasika: Oreo cheesecake krema, jagodni pire, drobljen Oreo piškot, Oreo krema. Dekoracija: Oreo piškot, jagodni pire, Oreo krema, bela čokolada, sveže jagode', price: 9.90, categoryId: cats.palacinke.id, sortOrder: 3, image: '/menu-images/palacinke/cheesecake-oreo-jagoda.png', modifierGroupIds: [] },
    { name: 'Cheesecake masleni piškot z banano', description: 'Klasika: Cheesecake krema maslenega piškota, mleti plazma piškoti, rezine banane. Dekoracija: krema maslenega piškota, mleti plazma piškoti, rezine banane', price: 9.90, categoryId: cats.palacinke.id, sortOrder: 4, image: '/menu-images/palacinke/cheesecake-masleni-banana.png', modifierGroupIds: [] },
    { name: 'Kinder Bueno', description: 'Kakavova: čokoladno-lešnikova krema, lešnikova krema, drobljen biskvit, napojeni Plazma biskvit. Dekoracija: čokoladno-lešnikova krema, lešnikova krema, drobljeni biskvit, Kinder Bueno čokolada', price: 9.90, categoryId: cats.palacinke.id, sortOrder: 5, image: '/menu-images/palacinke/kinder-bueno.png', modifierGroupIds: [] },
    { name: 'Pink dreams', description: 'Red Velvet: krema ruby čokolade, malinov preliv, vanilijev puding. Dekoracija: krema in koščki ruby čokolade, krema bele čokolade, drobljen rdeč masleni kornet, koščki bele čokolade, maline', price: 9.90, categoryId: cats.palacinke.id, sortOrder: 6, image: '/menu-images/palacinke/pink-dreams.png', modifierGroupIds: [] },
    { name: 'White pistachio', description: 'Klasika: krema pistacije, krema bele čokolade, mascarpone krema, napojeni Plazma biskvit. Dekoracija: krema bele čokolade, krema pistacije, mleta pistacija, crumble z belo čokolado', price: 10.50, categoryId: cats.palacinke.id, sortOrder: 7, image: '/menu-images/palacinke/white-pistachio.png', modifierGroupIds: [] },
    { name: 'Snickers', description: 'Kakavova: krema mlečne čokolade, krema karamele z arašidovim maslom, čokoladni puding. Dekoracija: krema mlečne čokolade, crumble z mlečno čokolado, mleti arašidi, mleti čokoladni piškoti, Snickers', price: 9.90, categoryId: cats.palacinke.id, sortOrder: 8, image: '/menu-images/palacinke/snickers.png', modifierGroupIds: [] },
    { name: 'Ferrero Rocher', description: 'Kakavova: čokoladno-lešnikova krema, Lino Lada Golci, mleti lešniki, čokoladni puding. Dekoracija: čokoladno-lešnikova krema, mleti čokoladni piškoti, mleti lešniki, Ferrero Rocher kroglica', price: 9.70, categoryId: cats.palacinke.id, sortOrder: 9, image: '/menu-images/palacinke/ferrero-rocher.png', modifierGroupIds: [] },
    { name: 'Fruty njam', description: 'Kakavova: preliv gozdnih sadežev, vanilijev puding, rezine banane. Dekoracija: krema bele čokolade, preliv gozdnih sadežev, sveže borovnice, maline in jagode, koščki ruby čokolade', price: 9.70, categoryId: cats.palacinke.id, sortOrder: 10, image: '/menu-images/palacinke/fruty-njam.png', modifierGroupIds: [] },
    { name: 'Sweet strawberry', description: 'Red Velvet: jagodni preliv, Lino Lada, vanilijev puding, mascarpone krema. Dekoracija: jagodni preliv, krema bele čokolade, sveže jagode, koščki bele čokolade', price: 9.70, categoryId: cats.palacinke.id, sortOrder: 11, image: '/menu-images/palacinke/sweet-strawberry.png', modifierGroupIds: [] },
    { name: "M&M's", description: 'Kakavova: Nutella, čokoladni puding, vanilijev puding, crumble z belo čokolado. Dekoracija: Nutella, mleti baby in čokoladni piškoti, M&M bonboni', price: 9.70, categoryId: cats.palacinke.id, sortOrder: 12, image: '/menu-images/palacinke/mms.png', modifierGroupIds: [] },

    // --- SLADICE ---
    { name: 'Hišna sladica', description: 'Priljubljena hišna sladica', price: 9.90, categoryId: cats.sladice.id, sortOrder: 0, image: '/menu-images/sladice/hisna-sladica.png', modifierGroupIds: [] },
    { name: 'Panna cotta z jagodnim prelivom', description: 'Kremna panna cotta s svežim jagodnim prelivom', price: 4.90, categoryId: cats.sladice.id, sortOrder: 1, image: '/menu-images/sladice/panna-cotta.png', modifierGroupIds: [] },
    { name: 'Palačinke s čokolado', description: 'Palačinke s čokoladnim prelivom', price: 4.50, categoryId: cats.sladice.id, sortOrder: 2, image: '/menu-images/sladice/palacinke-cokolada.png', modifierGroupIds: [] },
    { name: 'Palačinke z orehi', description: 'Palačinke z orehi in smetano', price: 4.50, categoryId: cats.sladice.id, sortOrder: 3, image: '/menu-images/sladice/palacinke-orehi.png', modifierGroupIds: [] },
    { name: 'Palačinke z marmelado', description: 'Palačinke z marmelado po izbiri', price: 4.50, categoryId: cats.sladice.id, sortOrder: 4, image: '/menu-images/sladice/palacinke-marmelada.png', modifierGroupIds: [] },
    { name: 'Palačinke z brusnicami', description: 'Palačinke z brusničnim prelivom', price: 4.50, categoryId: cats.sladice.id, sortOrder: 5, image: '/menu-images/sladice/palacinke-brusnice.png', modifierGroupIds: [] },
    { name: 'Palačinke z Nutello', description: 'Palačinke s Nutello', price: 4.50, categoryId: cats.sladice.id, sortOrder: 6, image: '/menu-images/sladice/palacinke-nutella.png', modifierGroupIds: [] },
    { name: 'Palačinke z Nutello in banano', description: 'Palačinke s Nutello in svežo banano', price: 5.50, categoryId: cats.sladice.id, sortOrder: 7, image: '/menu-images/sladice/palacinke-nutella-banana.png', modifierGroupIds: [] },
    { name: 'Palačinke z Nutello in orehi', description: 'Palačinke s Nutello in orehovim prelivom', price: 5.50, categoryId: cats.sladice.id, sortOrder: 8, image: '/menu-images/sladice/palacinke-nutella-orehi.png', modifierGroupIds: [] },
    { name: 'Pehtranove palačinke', description: 'Pehtranove palačinke', price: 4.50, categoryId: cats.sladice.id, sortOrder: 9, image: '/menu-images/sladice/palacinke-pehtran.png', modifierGroupIds: [] },
    { name: 'Skutine palačinke', description: 'Palačinke s skutnim nadevom', price: 4.50, categoryId: cats.sladice.id, sortOrder: 10, image: '/menu-images/sladice/palacinke-skuta.png', modifierGroupIds: [] },
    { name: 'Hišna grmada', description: 'Hišna sladica grmada', price: 4.50, categoryId: cats.sladice.id, sortOrder: 11, image: '/menu-images/sladice/hisna-grmada.png', modifierGroupIds: [] },
    { name: 'Sladoled kepica', description: 'Ena kepica sladoleda', price: 1.50, categoryId: cats.sladice.id, sortOrder: 12, image: '/menu-images/sladice/sladoled-kepica.png', modifierGroupIds: [] },
    { name: 'Sladoled porcija', description: 'Porcija sladoleda z izbiro okusov', price: 4.50, categoryId: cats.sladice.id, sortOrder: 13, image: '/menu-images/sladice/sladoled-porcija.png', modifierGroupIds: [] },
    { name: 'Sadna kupa', description: 'Sadna kupa s svežim sadjem', price: 5.20, categoryId: cats.sladice.id, sortOrder: 14, image: '/menu-images/sladice/sadna-kupa.png', modifierGroupIds: [] },
    { name: 'Banana split', description: 'Banana split s sladoledom in prelivom', price: 4.50, categoryId: cats.sladice.id, sortOrder: 15, image: '/menu-images/sladice/banana-split.png', modifierGroupIds: [] },
    { name: 'Vroče višnje s sladoledom', description: 'Vroče višnje z vaniljevim sladoledom', price: 4.50, categoryId: cats.sladice.id, sortOrder: 16, image: '/menu-images/sladice/vroce-visnje.png', modifierGroupIds: [] },
    { name: 'Vroči gozdni sadeži s sladoledom', description: 'Vroči gozdni sadeži z vaniljevim sladoledom', price: 5.00, categoryId: cats.sladice.id, sortOrder: 17, image: '/menu-images/sladice/vroci-gozdni-sadezi.png', modifierGroupIds: [] },
    { name: 'Nutelina torta z banano', description: 'Nutelina torta z banano', price: 5.50, categoryId: cats.sladice.id, sortOrder: 18, image: '/menu-images/sladice/nutelina-torta.png', modifierGroupIds: [] },
    { name: 'Torte Hana', description: 'Torte Hana z različnimi okusi', price: 5.50, categoryId: cats.sladice.id, sortOrder: 19, image: '/menu-images/sladice/torte-hana.png', modifierGroupIds: [] },
    { name: 'Linolada torta z banano', description: 'Linolada torta z banano', price: 5.50, categoryId: cats.sladice.id, sortOrder: 20, image: '/menu-images/sladice/linolada-torta.png', modifierGroupIds: [] },
    { name: 'Čokoladni souffle', description: 'Čokoladni souffle s sladoledom in prelivom', price: 5.30, categoryId: cats.sladice.id, sortOrder: 21, image: '/menu-images/sladice/cokoladni-souffle.png', modifierGroupIds: [] },
    { name: 'Tiramisu', description: 'Klasična italijanska kavnana sladica', price: 9.50, categoryId: cats.sladice.id, sortOrder: 22, image: '/menu-images/sladice/tiramisu.png', modifierGroupIds: [] },
    { name: 'Sirovi štrukelj', description: 'Topel sirovi štrukelj s smetano', price: 7.90, categoryId: cats.sladice.id, sortOrder: 23, image: '/menu-images/sladice/sirovi-strukelj.png', modifierGroupIds: [] },

    // --- OTROŠKE JEDI ---
    { name: 'Juha s palačinkami', description: 'Otroški meni - juha s palačinkami', price: 4.20, categoryId: cats.outroskeJedi.id, sortOrder: 0, image: '/menu-images/otroske-jedi/juha-palacinke.png', modifierGroupIds: [] },
    { name: 'Krožnik Miškolin', description: 'Ocvrti sir, pommes frites, tatarska omaka', price: 9.00, categoryId: cats.outroskeJedi.id, sortOrder: 1, image: '/menu-images/otroske-jedi/miskolin.png', modifierGroupIds: [] },
    { name: 'Krožnik Gusar Berto', description: 'Ocvrti oslič, pommes frites, tatarska omaka', price: 9.00, categoryId: cats.outroskeJedi.id, sortOrder: 2, image: '/menu-images/otroske-jedi/gusar-berto.png', modifierGroupIds: [] },
    { name: 'Otroški pohančki', description: 'Ocvrto puranje ali piščančje meso, pommes frites, tatarska omaka', price: 9.00, categoryId: cats.outroskeJedi.id, sortOrder: 3, image: '/menu-images/otroske-jedi/otroski-pohancki.png', modifierGroupIds: [] },
    { name: 'Krožnik Pingvinček', description: 'Ocvrti kalamari, pommes frites, tatarska omaka', price: 9.00, categoryId: cats.outroskeJedi.id, sortOrder: 4, image: '/menu-images/otroske-jedi/pingvincek.png', modifierGroupIds: [] },
    { name: 'Krožnik Korenjak', description: 'Dunajski zrezek, pommes frites', price: 9.00, categoryId: cats.outroskeJedi.id, sortOrder: 5, image: '/menu-images/otroske-jedi/korenjak.png', modifierGroupIds: [] },
    { name: 'Krožnik Špagetek', description: 'Špageti bolognese', price: 9.00, categoryId: cats.outroskeJedi.id, sortOrder: 6, image: '/menu-images/otroske-jedi/spagetek.png', modifierGroupIds: [] },
    { name: 'Pizza Malček', description: 'Pelati, mozzarela, kuhan pršut, gobe, origano', price: 9.00, categoryId: cats.outroskeJedi.id, sortOrder: 7, image: '/menu-images/otroske-jedi/pizza-malcek.png', modifierGroupIds: [] },
    { name: 'Pizza Jurček', description: 'Pelati, mozzarela, gobe, origano', price: 9.00, categoryId: cats.outroskeJedi.id, sortOrder: 8, image: '/menu-images/otroske-jedi/pizza-jurcek.png', modifierGroupIds: [] },
    { name: 'Palačinke Metuljček', description: 'Sladke palačinke za otroke', price: 4.70, categoryId: cats.outroskeJedi.id, sortOrder: 9, image: '/menu-images/otroske-jedi/metuljcek.png', modifierGroupIds: [] },
    { name: 'Kepica sladoleda', description: 'Kepica sladoleda s smetano', price: 1.90, categoryId: cats.outroskeJedi.id, sortOrder: 10, image: '/menu-images/otroske-jedi/sladoled-otroski.png', modifierGroupIds: [] },
    { name: 'Sadna kupa s smetano', description: 'Sadna kupa s smetano', price: 4.80, categoryId: cats.outroskeJedi.id, sortOrder: 11, image: '/menu-images/otroske-jedi/sadna-kupa-otroski.png', modifierGroupIds: [] },
  ]
}
