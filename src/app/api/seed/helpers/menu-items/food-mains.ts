import { CategoryRef, ModifierRef, MenuItemSeed } from './types'

// =====================================================================
// HRANA - Glavne jedi, testenine/njoki, rižote
// =====================================================================

export function getFoodMains(
  cats: Record<string, CategoryRef>,
  mods: Record<string, ModifierRef>
): MenuItemSeed[] {
  return [
    // --- GLAVNE JEDI ---
    { name: 'Polnjena telečja prsa', description: 'Zelenjavna priloga, slan krompir', price: 16.00, categoryId: cats.glavneJedi.id, sortOrder: 0, image: '/menu-images/glavne-jedi/polnjena-telecja-prsa.png', modifierGroupIds: [mods.sideChoice.id] },
    { name: 'Pečena svinjska krača', description: 'Pommes frites, ajvar, gorčica, čebula, hren (1500g)', price: 24.00, categoryId: cats.glavneJedi.id, sortOrder: 1, image: '/menu-images/glavne-jedi/pecena-svinjska-kraca.png', modifierGroupIds: [] },
    { name: 'Svinjska pečenka', description: 'Zelenjavna priloga, slan krompir (450g)', price: 14.00, categoryId: cats.glavneJedi.id, sortOrder: 2, image: '/menu-images/glavne-jedi/svinjska-pecenka.png', modifierGroupIds: [mods.sideChoice.id] },
    { name: 'Telečja pečenka', description: 'Zelenjavna priloga, slan krompir (450g)', price: 17.00, categoryId: cats.glavneJedi.id, sortOrder: 3, image: '/menu-images/glavne-jedi/telecja-pecenka.png', modifierGroupIds: [mods.sideChoice.id] },
    { name: 'Rumpsteak', description: 'Zelenjavna priloga, ajvar, gorčica, čebula (250g)', price: 26.00, categoryId: cats.glavneJedi.id, sortOrder: 4, image: '/menu-images/glavne-jedi/rumpsteak.png', modifierGroupIds: [mods.cookingLevel.id, mods.sideChoice.id] },
    { name: 'BBQ rebrca', description: 'Konfitirana, nato pečena svinjska rebrca (baby ribs) – s parmezanom, pečen krompir, BBQ omaka (500g)', price: 16.00, categoryId: cats.glavneJedi.id, sortOrder: 5, image: '/menu-images/glavne-jedi/bbq-rebrca.png', modifierGroupIds: [] },
    { name: 'Beefsteak v poprovi omaki', description: 'Zelenjavna priloga, pečen krompir (250g)', price: 30.00, categoryId: cats.glavneJedi.id, sortOrder: 6, image: '/menu-images/glavne-jedi/beefsteak-poprova.png', modifierGroupIds: [mods.cookingLevel.id, mods.sideChoice.id, mods.sauceChoice.id] },
    { name: 'Beefsteak žar na rukoli', description: 'Zelenjavna priloga, pečen krompir (250g)', price: 30.00, categoryId: cats.glavneJedi.id, sortOrder: 7, image: '/menu-images/glavne-jedi/beefsteak-zar-rukoli.png', modifierGroupIds: [mods.cookingLevel.id, mods.sideChoice.id] },
    { name: 'Kraški beefsteak', description: 'Pršut, sir, zelenjavna priloga (250g)', price: 30.00, categoryId: cats.glavneJedi.id, sortOrder: 8, image: '/menu-images/glavne-jedi/kraski-beefsteak.png', modifierGroupIds: [mods.cookingLevel.id, mods.sideChoice.id] },
    { name: 'Bograč v kotličku', description: 'Bograč v kotličku (200g)', price: 14.00, categoryId: cats.glavneJedi.id, sortOrder: 9, image: '/menu-images/glavne-jedi/bograc.png', modifierGroupIds: [] },
    { name: 'Goveji golaž v kotličku', description: 'S kruhovo rezino (200g)', price: 15.00, categoryId: cats.glavneJedi.id, sortOrder: 10, image: '/menu-images/glavne-jedi/goveji-golaz.png', modifierGroupIds: [] },
    { name: 'Dunajski zrezek', description: 'Dunajski zrezek (250g)', price: 12.00, categoryId: cats.glavneJedi.id, sortOrder: 11, image: '/menu-images/glavne-jedi/dunajski-zrezek.png', modifierGroupIds: [mods.sideChoice.id] },
    { name: 'Pariški zrezek', description: 'Pariški zrezek (250g)', price: 12.00, categoryId: cats.glavneJedi.id, sortOrder: 12, image: '/menu-images/glavne-jedi/pariski-zrezek.png', modifierGroupIds: [mods.sideChoice.id] },
    { name: 'Hišni zrezek', description: 'Smetanova omaka, sir, šampinjoni, česen, zelenjavna priloga (250g)', price: 16.00, categoryId: cats.glavneJedi.id, sortOrder: 13, image: '/menu-images/glavne-jedi/hisni-zrezek.png', modifierGroupIds: [mods.sideChoice.id] },
    { name: 'Kraški zrezek', description: 'Pršut, sir, česen, zelenjavna priloga (250g)', price: 16.00, categoryId: cats.glavneJedi.id, sortOrder: 14, image: '/menu-images/glavne-jedi/kraski-zrezek.png', modifierGroupIds: [mods.sideChoice.id] },
    { name: 'Naravni zrezek', description: 'Zelenjavna priloga (250g)', price: 15.00, categoryId: cats.glavneJedi.id, sortOrder: 15, image: '/menu-images/glavne-jedi/naravni-zrezek.png', modifierGroupIds: [mods.sideChoice.id] },
    { name: 'Zrezek z gobami', description: 'Zelenjavna priloga (250g)', price: 16.00, categoryId: cats.glavneJedi.id, sortOrder: 16, image: '/menu-images/glavne-jedi/zrezek-gobe.png', modifierGroupIds: [mods.sideChoice.id] },
    { name: 'Ljubljanski zrezek', description: 'Šunka, sir (250g)', price: 15.50, categoryId: cats.glavneJedi.id, sortOrder: 17, image: '/menu-images/glavne-jedi/ljubljanski-zrezek.png', modifierGroupIds: [mods.sideChoice.id] },
    { name: 'Zrezek v curry omaki', description: 'Zelenjavna priloga (250g)', price: 16.00, categoryId: cats.glavneJedi.id, sortOrder: 18, image: '/menu-images/glavne-jedi/zrezek-curry.png', modifierGroupIds: [mods.sideChoice.id] },
    { name: 'Sirov zrezek', description: 'Sirova omaka, sirov štrukelj, zelenjavna priloga (250g)', price: 16.00, categoryId: cats.glavneJedi.id, sortOrder: 19, image: '/menu-images/glavne-jedi/sirov-zrezek.png', modifierGroupIds: [mods.sideChoice.id] },
    { name: 'Zrezek v smetanovi omaki', description: 'Zelenjavna priloga (250g)', price: 15.00, categoryId: cats.glavneJedi.id, sortOrder: 20, image: '/menu-images/glavne-jedi/zrezek-smetanova.png', modifierGroupIds: [mods.sideChoice.id] },
    { name: 'Zrezek v gorgonzolni omaki z gobami', description: 'Zelenjavna priloga (250g)', price: 16.00, categoryId: cats.glavneJedi.id, sortOrder: 21, image: '/menu-images/glavne-jedi/zrezek-gorgonzola.png', modifierGroupIds: [mods.sideChoice.id] },
    { name: 'Zrezek žar na rukoli', description: 'Pečen krompir, čebulni obročki, omaka (250g)', price: 16.00, categoryId: cats.glavneJedi.id, sortOrder: 22, image: '/menu-images/glavne-jedi/zrezek-zar-rukoli.png', modifierGroupIds: [mods.sideChoice.id, mods.sauceChoice.id] },
    { name: 'Zrezek v smetanovi omaki s pehtranom', description: 'Zelenjavna priloga (250g)', price: 16.00, categoryId: cats.glavneJedi.id, sortOrder: 23, image: '/menu-images/glavne-jedi/zrezek-pehtran.png', modifierGroupIds: [mods.sideChoice.id] },
    { name: 'Hawaii zrezek', description: 'Zelenjavna priloga, smetanova omaka, ananas, sir (250g)', price: 16.00, categoryId: cats.glavneJedi.id, sortOrder: 24, image: '/menu-images/glavne-jedi/hawaii-zrezek.png', modifierGroupIds: [mods.sideChoice.id] },
    { name: 'Tagliata na rukoli', description: 'Pljučna goveja, pečen krompir in zelenjava (250g)', price: 30.00, categoryId: cats.glavneJedi.id, sortOrder: 25, image: '/menu-images/glavne-jedi/tagliata.png', modifierGroupIds: [mods.sideChoice.id] },
    { name: 'Rostbeef', description: 'Pečen krompir in zelenjava (250g)', price: 26.00, categoryId: cats.glavneJedi.id, sortOrder: 26, image: '/menu-images/glavne-jedi/rostbeef.png', modifierGroupIds: [mods.sideChoice.id] },
    { name: 'Žar tris', description: 'Svinjski kare, piščančja prsa, roastbeef, pečen krompir, čebulni obročki, omaka (350g)', price: 19.00, categoryId: cats.glavneJedi.id, sortOrder: 27, image: '/menu-images/glavne-jedi/zar-tris.png', modifierGroupIds: [mods.sauceChoice.id] },
    { name: 'Ocvrt pišanec', description: 'Ocvrt pišanec (12 kosov, 1500g)', price: 27.00, categoryId: cats.glavneJedi.id, sortOrder: 28, image: '/menu-images/glavne-jedi/ocvrt-pisanec.png', modifierGroupIds: [] },
    { name: 'Pohančki', description: 'Svinjski, puranji ali piščančji pohančki (250g)', price: 13.00, categoryId: cats.glavneJedi.id, sortOrder: 29, image: '/menu-images/glavne-jedi/pohancki.png', modifierGroupIds: [mods.sideChoice.id] },
    { name: 'Hišna plošča', description: 'Svinjski dunajski, puranji pariški, žar puran, gobova ali smetanova omaka, zelenjavna priloga, pommes frites, krompirjevi ocvrtki, ocvrti njoki, pražen krompir (za 2 osebi, 600g)', price: 38.00, categoryId: cats.glavneJedi.id, sortOrder: 30, image: '/menu-images/glavne-jedi/hisna-plosca.png', modifierGroupIds: [] },
    { name: 'Kmečka plošča', description: 'Svinjska pečenka, polnjena telečja prsa, pečena rebra, slan krompir, pražen krompir, njoki, zelenjava, sirov štrukelj (za 2 osebi, 800g)', price: 40.00, categoryId: cats.glavneJedi.id, sortOrder: 31, image: '/menu-images/glavne-jedi/kmecka-plosca.png', modifierGroupIds: [] },
    { name: 'Kmečki krožnik', description: 'Svinjska pečenka, njoki, polnjena telečja prsa, pečena rebra, slan krompir, zelenjava, sirov štrukelj (400g)', price: 20.00, categoryId: cats.glavneJedi.id, sortOrder: 32, image: '/menu-images/glavne-jedi/kmecki-kroznik.png', modifierGroupIds: [] },
    { name: 'Kmečka plošča - zimska', description: 'Svinjska pečenka, pečenica, krvavica, pečena rebra, repa, zelje, matevž, ajdovi žganci, slan krompir (za 2 osebi, 800g)', price: 40.00, categoryId: cats.glavneJedi.id, sortOrder: 33, image: '/menu-images/glavne-jedi/kmecka-zimska.png', modifierGroupIds: [] },
    { name: 'Kmečki krožnik - zimski', description: 'Svinjska pečenka, pečenica, krvavica, pečena rebra, repa, zelje, matevž, ajdovi žganci, slan krompir (400g)', price: 20.00, categoryId: cats.glavneJedi.id, sortOrder: 34, image: '/menu-images/glavne-jedi/kmecki-zimski.png', modifierGroupIds: [] },
    { name: 'Pečenica s prilogo', description: 'Zelje ali repa, matevž, slan krompir (300g)', price: 13.00, categoryId: cats.glavneJedi.id, sortOrder: 35, image: '/menu-images/glavne-jedi/pecenica.png', modifierGroupIds: [mods.sideChoice.id] },
    { name: 'Krvavica s prilogo', description: 'Zelje ali repa, matevž, slan krompir (300g)', price: 13.00, categoryId: cats.glavneJedi.id, sortOrder: 36, image: '/menu-images/glavne-jedi/krvavica.png', modifierGroupIds: [mods.sideChoice.id] },

    // --- TESTENINE, NJOKI ---
    { name: 'Bolognese', description: 'Omaka z mletnim mesom - špageti, rezanci ali njoki', price: 10.90, categoryId: cats.testenine.id, sortOrder: 0, image: '/menu-images/testenine-njoki/bolognese.png', modifierGroupIds: [] },
    { name: 'Milanese', description: 'Paradižnikova omaka z grahom in šunko - špageti, rezanci ali njoki', price: 10.90, categoryId: cats.testenine.id, sortOrder: 1, image: '/menu-images/testenine-njoki/milanese.png', modifierGroupIds: [] },
    { name: 'Z morskimi sadeži', description: 'Paradižnikova omaka, morski sadeži - špageti, rezanci ali njoki', price: 12.50, categoryId: cats.testenine.id, sortOrder: 2, image: '/menu-images/testenine-njoki/morski-sadezi.png', modifierGroupIds: [] },
    { name: 'Carbonara', description: 'Smetanova omaka s pršutom - špageti, rezanci ali njoki', price: 12.50, categoryId: cats.testenine.id, sortOrder: 3, image: '/menu-images/testenine-njoki/carbonara.png', modifierGroupIds: [] },
    { name: 'Napoli', description: 'Paradižnikova omaka - špageti, rezanci ali njoki', price: 9.90, categoryId: cats.testenine.id, sortOrder: 4, image: '/menu-images/testenine-njoki/napoli.png', modifierGroupIds: [] },
    { name: 'Z gobami', description: 'Mešane gobe - špageti, rezanci ali njoki', price: 10.50, categoryId: cats.testenine.id, sortOrder: 5, image: '/menu-images/testenine-njoki/gobe.png', modifierGroupIds: [] },
    { name: 'Z morskimi sadeži v smetanovi omaki', description: 'Smetanova omaka, morski sadeži - špageti, rezanci ali njoki', price: 12.50, categoryId: cats.testenine.id, sortOrder: 6, image: '/menu-images/testenine-njoki/morski-smetanova.png', modifierGroupIds: [] },
    { name: 'S pljučno pečenko in zelenjavo', description: 'Pljučna pečenka, zelenjava - špageti, rezanci ali njoki', price: 15.50, categoryId: cats.testenine.id, sortOrder: 7, image: '/menu-images/testenine-njoki/pljucna-pecenka.png', modifierGroupIds: [] },
    { name: 'V gorgonzolini omaki', description: 'Gorgonzolna omaka - špageti, rezanci ali njoki', price: 11.00, categoryId: cats.testenine.id, sortOrder: 8, image: '/menu-images/testenine-njoki/gorgonzola.png', modifierGroupIds: [] },
    { name: 'S tartufi', description: 'Smetanova omaka, tartufi - špageti, rezanci ali njoki', price: 13.50, categoryId: cats.testenine.id, sortOrder: 9, image: '/menu-images/testenine-njoki/tartufi.png', modifierGroupIds: [] },
    { name: 'S puranom v curry omaki', description: 'Puranje ali piščančje meso, curry, smetanova omaka - špageti, rezanci ali njoki', price: 13.00, categoryId: cats.testenine.id, sortOrder: 10, image: '/menu-images/testenine-njoki/puran-curry.png', modifierGroupIds: [] },
    { name: 'S puranom v smetanovi omaki', description: 'Puranje meso, smetanova omaka - špageti, rezanci ali njoki', price: 13.00, categoryId: cats.testenine.id, sortOrder: 11, image: '/menu-images/testenine-njoki/puran-smetanova.png', modifierGroupIds: [] },
    { name: 'V smetanovi omaki', description: 'Smetanova omaka - špageti, rezanci ali njoki', price: 9.50, categoryId: cats.testenine.id, sortOrder: 12, image: '/menu-images/testenine-njoki/smetanova.png', modifierGroupIds: [] },
    { name: 'Sicilijana', description: 'Češnjev paradižnik, melancani, moccarela - špageti, rezanci ali njoki', price: 12.00, categoryId: cats.testenine.id, sortOrder: 13, image: '/menu-images/testenine-njoki/sicilijana.png', modifierGroupIds: [] },
    { name: 'Z gamberi na rdeče ali belo', description: 'Gamberi, omaka po izbiri - špageti, rezanci ali njoki', price: 14.50, categoryId: cats.testenine.id, sortOrder: 14, image: '/menu-images/testenine-njoki/gamberi.png', modifierGroupIds: [] },
    { name: 'S piščancem', description: 'Moccarela, češnjev paradižnik - špageti, rezanci ali njoki', price: 14.00, categoryId: cats.testenine.id, sortOrder: 15, image: '/menu-images/testenine-njoki/piscanec.png', modifierGroupIds: [] },
    { name: 'Pad Thai z zelenjavo', description: 'Riževi rezanci, bučke, korenje, mlada čebula, por, jajce, pad thai omaka, sveži kalčki, arašidi, limeta', price: 10.90, categoryId: cats.testenine.id, sortOrder: 16, image: '/menu-images/testenine-njoki/padthai-zelenjava.png', modifierGroupIds: [] },
    { name: 'Pad Thai s piščancem', description: 'Riževi rezanci, piščanec, bučke, korenje, mlada čebula, por, jajce, pad thai omaka, sveži kalčki, arašidi, limeta', price: 13.90, categoryId: cats.testenine.id, sortOrder: 17, image: '/menu-images/testenine-njoki/padthai-piscanec.png', modifierGroupIds: [] },

    // --- RIŽOTE ---
    { name: 'Morska rižota', description: 'Morski sadeži', price: 12.00, categoryId: cats.rizote.id, sortOrder: 0, image: '/menu-images/rizote/morska.png', modifierGroupIds: [] },
    { name: 'Rižota z gobami', description: 'Mešane gobe', price: 11.00, categoryId: cats.rizote.id, sortOrder: 1, image: '/menu-images/rizote/gobe.png', modifierGroupIds: [] },
    { name: 'Rižota s puranom in papriko', description: 'Puranje meso, paprika', price: 13.00, categoryId: cats.rizote.id, sortOrder: 2, image: '/menu-images/rizote/puran-paprika.png', modifierGroupIds: [] },
    { name: 'Zelenjavna rižota', description: 'Mešana zelenjava', price: 9.90, categoryId: cats.rizote.id, sortOrder: 3, image: '/menu-images/rizote/zelenjavna.png', modifierGroupIds: [] },
  ]
}
