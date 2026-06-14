// =====================================================================
// MENU ARTIKLI - Podatki za seed
// =====================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CategoryRef = { id: string; [key: string]: any }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ModifierRef = { id: string; [key: string]: any }

export interface MenuItemSeed {
  name: string
  description: string
  price: number
  categoryId: string
  sortOrder: number
  image: string
  modifierGroupIds: string[]
}

export function getMenuItemsData(
  cats: Record<string, CategoryRef>,
  mods: Record<string, ModifierRef>
): MenuItemSeed[] {
  return [
    // ============================================
    // HRANA - RestorantOS
    // ============================================

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
    { name: 'Rižota z gamberi in mešanimi gobami', description: 'Gamberi, mešane gobe', price: 14.50, categoryId: cats.rizote.id, sortOrder: 4, image: '/menu-images/rizote/gamberi-gobe.png', modifierGroupIds: [] },

    // --- KALAMARI ---
    { name: 'Mešani kalamari', description: 'Ocvrti, na žaru, polnjeni po dunajsko, repki škampov po pariško, pommes frites, slan krompir z blitvo, tatarska omaka (za 3 osebe, 750g)', price: 60.00, categoryId: cats.kalamari.id, sortOrder: 0, image: '/menu-images/kalamari/mesani.png', modifierGroupIds: [] },
    { name: 'Ocvrti kalamari', description: 'Tatarska omaka (200g)', price: 13.90, categoryId: cats.kalamari.id, sortOrder: 1, image: '/menu-images/kalamari/ocvrti.png', modifierGroupIds: [mods.sauceChoice.id] },
    { name: 'Kalamari po mornarsko', description: 'Tatarska omaka (200g)', price: 13.90, categoryId: cats.kalamari.id, sortOrder: 2, image: '/menu-images/kalamari/mornarsko.png', modifierGroupIds: [mods.sauceChoice.id] },
    { name: 'Polnjeni kalamari po dunajsko', description: 'S sirom in pršutom, tatarska omaka (250g)', price: 14.50, categoryId: cats.kalamari.id, sortOrder: 3, image: '/menu-images/kalamari/polnjeni-dunajsko.png', modifierGroupIds: [mods.sauceChoice.id] },
    { name: 'Kalamari na žaru', description: 'Slan krompir z blitvo (300g)', price: 14.50, categoryId: cats.kalamari.id, sortOrder: 4, image: '/menu-images/kalamari/na-zaru.png', modifierGroupIds: [] },
    { name: 'Kalamari žar na rukoli', description: 'Slan krompir z blitvo, parmezan (300g)', price: 14.50, categoryId: cats.kalamari.id, sortOrder: 5, image: '/menu-images/kalamari/zar-rukoli.png', modifierGroupIds: [] },
    { name: 'Polnjeni kalamari na žaru', description: 'S sirom in pršutom, slan krompir z blitvo (300g)', price: 14.90, categoryId: cats.kalamari.id, sortOrder: 6, image: '/menu-images/kalamari/polnjeni-zar.png', modifierGroupIds: [] },

    // --- RIBJE JEDI ---
    { name: 'Ribja plošča', description: 'File brancina, file orade, polnjeni kalamari po dunajsko, gamberi po pariško, pečena zelenjava, slan krompir z blitvo, tržaška omaka (za 2 osebi, 1100g)', price: 40.00, categoryId: cats.ribjeJedi.id, sortOrder: 0, image: '/menu-images/ribje-jedi/ribja-plosca.png', modifierGroupIds: [] },
    { name: 'Gamberi po pariško', description: 'Tatarska omaka (200g)', price: 18.00, categoryId: cats.ribjeJedi.id, sortOrder: 1, image: '/menu-images/ribje-jedi/gamberi-parisko.png', modifierGroupIds: [mods.sauceChoice.id] },
    { name: 'Ocvrt oslič s prilogo', description: 'Tatarska omaka, pommes frites (300g)', price: 12.00, categoryId: cats.ribjeJedi.id, sortOrder: 2, image: '/menu-images/ribje-jedi/ocvrt-oslic.png', modifierGroupIds: [mods.sauceChoice.id] },
    { name: 'Losos', description: 'Tržaška omaka, zelenjavna priloga, slan krompir z blitvo (300g)', price: 18.00, categoryId: cats.ribjeJedi.id, sortOrder: 3, image: '/menu-images/ribje-jedi/losos.png', modifierGroupIds: [] },
    { name: 'File postrvi', description: 'Po tržaško, po dunajsko ali v koruzni moki, zelenjavna priloga, slan krompir z blitvo (300g)', price: 15.00, categoryId: cats.ribjeJedi.id, sortOrder: 4, image: '/menu-images/ribje-jedi/file-postrvi.png', modifierGroupIds: [] },
    { name: 'File orade', description: 'Tržaška omaka, zelenjavna priloga, slan krompir z blitvo (300g)', price: 18.00, categoryId: cats.ribjeJedi.id, sortOrder: 5, image: '/menu-images/ribje-jedi/file-orade.png', modifierGroupIds: [] },
    { name: 'File brancina na žaru', description: 'Tržaška omaka, zelenjavna priloga, slan krompir z blitvo (300g)', price: 18.00, categoryId: cats.ribjeJedi.id, sortOrder: 6, image: '/menu-images/ribje-jedi/file-brancina.png', modifierGroupIds: [] },

    // --- SOLATE ---
    { name: 'Solata Kraljica', description: 'Dvojna mešana solata, sir, tatarska omaka', price: 9.50, categoryId: cats.solate.id, sortOrder: 0, image: '/menu-images/solate/kraljica.png', modifierGroupIds: [mods.sauceChoice.id] },
    { name: 'Solata Kraljica s šunko', description: 'Dvojna mešana solata, sir, tatarska omaka, šunka (150g)', price: 11.50, categoryId: cats.solate.id, sortOrder: 1, image: '/menu-images/solate/kraljica-sunka.png', modifierGroupIds: [mods.sauceChoice.id] },
    { name: 'Solata Kraljica z jajci', description: 'Dvojna mešana solata, sir, tatarska omaka, 2 jajci', price: 10.50, categoryId: cats.solate.id, sortOrder: 2, image: '/menu-images/solate/kraljica-jajca.png', modifierGroupIds: [mods.sauceChoice.id] },
    { name: 'Solata Kraljica s puranom', description: 'Dvojna mešana solata, sir, tatarska omaka, puran ali piščanec (150g)', price: 12.00, categoryId: cats.solate.id, sortOrder: 3, image: '/menu-images/solate/kraljica-puran.png', modifierGroupIds: [mods.sauceChoice.id] },
    { name: 'Solata Kraljica s tuno', description: 'Dvojna mešana solata, sir, tatarska omaka, tuna (150g)', price: 12.00, categoryId: cats.solate.id, sortOrder: 4, image: '/menu-images/solate/kraljica-tuna.png', modifierGroupIds: [mods.sauceChoice.id] },
    { name: 'Cezarjeva solata', description: 'Ocvrt piščanec, mozzarela, parmezan, zelena solata, riban korenček, češnjev paradižnik, krotoni, cezar preliv', price: 13.50, categoryId: cats.solate.id, sortOrder: 5, image: '/menu-images/solate/cezarjeva.png', modifierGroupIds: [] },
    { name: 'Solatni krožnik s feta sirom', description: 'Zelena solata, radič, koruza, kumare, paradižnik, korenček, jajce, pinjole, feta sir', price: 10.00, categoryId: cats.solate.id, sortOrder: 6, image: '/menu-images/solate/kroznik-feta.png', modifierGroupIds: [] },
    { name: 'Solatni krožnik s puranom', description: 'Zelena solata, radič, koruza, kumare, paradižnik, korenček, jajce, pinjole, puran ali piščanec (150g)', price: 11.50, categoryId: cats.solate.id, sortOrder: 7, image: '/menu-images/solate/kroznik-puran.png', modifierGroupIds: [] },
    { name: 'Solatni krožnik s tuno', description: 'Zelena solata, radič, koruza, kumare, paradižnik, korenček, jajce, pinjole, tuna (150g)', price: 11.50, categoryId: cats.solate.id, sortOrder: 8, image: '/menu-images/solate/kroznik-tuna.png', modifierGroupIds: [] },
    { name: 'Solatni krožnik s popečeno slanino', description: 'Zelena solata, radič, koruza, kumare, paradižnik, korenček, jajce, pinjole, popečena slanina (150g)', price: 11.50, categoryId: cats.solate.id, sortOrder: 9, image: '/menu-images/solate/kroznik-slanina.png', modifierGroupIds: [] },
    { name: 'Grška solata', description: 'Paradižnik, kumare, paprika, zelena solata, olive, feta sir', price: 10.00, categoryId: cats.solate.id, sortOrder: 10, image: '/menu-images/solate/grska.png', modifierGroupIds: [] },
    { name: 'Solata rukola s parmezanom', description: 'Rukola, parmezan', price: 5.00, categoryId: cats.solate.id, sortOrder: 11, image: '/menu-images/solate/rukola-parmezan.png', modifierGroupIds: [] },
    { name: 'Mešana solata s tuno', description: 'Dvojna mešana solata, tuna, tatarska omaka', price: 11.00, categoryId: cats.solate.id, sortOrder: 12, image: '/menu-images/solate/mesana-tuna.png', modifierGroupIds: [] },
    // Posamezne solate
    { name: 'Zelena solata', description: 'Zelena solata', price: 3.90, categoryId: cats.solate.id, sortOrder: 13, image: '/menu-images/solate/zelena.png', modifierGroupIds: [] },
    { name: 'Motovilec', description: 'Motovilec', price: 3.90, categoryId: cats.solate.id, sortOrder: 14, image: '/menu-images/solate/motovilec.png', modifierGroupIds: [] },
    { name: 'Zeljnata solata', description: 'Zeljnata solata', price: 3.90, categoryId: cats.solate.id, sortOrder: 15, image: '/menu-images/solate/zeljnata.png', modifierGroupIds: [] },
    { name: 'Kumare', description: 'Kumare', price: 3.90, categoryId: cats.solate.id, sortOrder: 16, image: '/menu-images/solate/kumare.png', modifierGroupIds: [] },
    { name: 'Paradižnikova solata', description: 'Paradižnikova solata', price: 3.90, categoryId: cats.solate.id, sortOrder: 17, image: '/menu-images/solate/paradiznikova.png', modifierGroupIds: [] },
    { name: 'Fižolova solata', description: 'Fižolova solata', price: 4.40, categoryId: cats.solate.id, sortOrder: 18, image: '/menu-images/solate/fizolova.png', modifierGroupIds: [] },
    { name: 'Koruzna solata', description: 'Koruzna solata', price: 4.40, categoryId: cats.solate.id, sortOrder: 19, image: '/menu-images/solate/koruzna.png', modifierGroupIds: [] },
    { name: 'Mešana solata', description: 'Mešana solata', price: 4.40, categoryId: cats.solate.id, sortOrder: 20, image: '/menu-images/solate/mesana-solata-2.png', modifierGroupIds: [] },
    { name: 'Rukola', description: 'Rukola', price: 4.20, categoryId: cats.solate.id, sortOrder: 21, image: '/menu-images/solate/rukola.png', modifierGroupIds: [] },
    { name: 'Pečena paprika', description: 'Pečena paprika', price: 5.00, categoryId: cats.solate.id, sortOrder: 22, image: '/menu-images/solate/pecena-paprika.png', modifierGroupIds: [] },

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

    // ============================================
    // PIJAČA - WINE CARD & DRINKS PRICE LIST
    // ============================================

    // --- PENINE IN ŠAMPANJCI ---
    { name: 'No.1 Brut', description: 'Chardonnay, rumeni plavec | Istenič, Bizeljsko-Sremič, Posavje | Zelo suho', price: 40.00, image: '/menu-images/penine/no1-brut.png', categoryId: cats.penine.id, sortOrder: 0, modifierGroupIds: [] },
    { name: 'Domaine Slapšak Brut Reserve', description: 'Žametna črnina, modri pinot | Domaine Slapšak, Dolenjska, Posavje | Zelo suho', price: 45.00, image: '/menu-images/penine/slapsak-brut-reserve.png', categoryId: cats.penine.id, sortOrder: 1, modifierGroupIds: [] },
    { name: 'Domaine Slapšak Brut Rosé', description: '100% žametna črnina | Domaine Slapšak, Dolenjska, Posavje | Zelo suho', price: 45.00, image: '/menu-images/penine/slapsak-brut-rose.png', categoryId: cats.penine.id, sortOrder: 2, modifierGroupIds: [] },
    { name: 'Penina Gourmet Rosé', description: '100% modri pinot | Klet Istenič, Bizeljsko-Sremič, Posavje | Suho', price: 40.00, image: '/menu-images/penine/gourmet-rose.png', categoryId: cats.penine.id, sortOrder: 3, modifierGroupIds: [] },
    { name: 'Zlata Radgonska Penina Brut Selection', description: 'Chardonnay | Radgonske gorice, Gornja radgona, Štajerska, Podravje | Zelo suho', price: 36.00, image: '/menu-images/penine/zlata-radgonska.png', categoryId: cats.penine.id, sortOrder: 4, modifierGroupIds: [] },
    { name: 'Maria Brut 2020', description: 'Chardonnay, rumeni plavec, kraljevina | Vinarstvo Kerin, Dolenjska, Posavje | Zelo suho', price: 35.00, image: '/menu-images/penine/maria-brut.png', categoryId: cats.penine.id, sortOrder: 5, modifierGroupIds: [] },
    { name: 'Penina Boemme Rumeni Muškat', description: 'Hiša vin Emino, Štajerska Slovenija | Polsuho', price: 35.00, image: '/menu-images/penine/boemme-rumeni-muskat.png', categoryId: cats.penine.id, sortOrder: 6, modifierGroupIds: [] },
    { name: 'Bjana Brut', description: 'Chardonnay, modri pinot | Bjana, Miran Sirk, Goriška Brda, Primorska | Zelo suho', price: 55.00, image: '/menu-images/penine/bjana-brut.png', categoryId: cats.penine.id, sortOrder: 7, modifierGroupIds: [] },
    { name: 'Mufi Pet Nat Brut Nature 2023', description: 'Rumeni muškat, rumeni plavec | Ekološko, Keltis, Bizeljsko-Sremič, Posavje | Izredno suho', price: 35.00, image: '/menu-images/penine/mufi-pet-nat.png', categoryId: cats.penine.id, sortOrder: 8, modifierGroupIds: [] },
    { name: 'Champagne Louis Roederer Collection 244 Brut', description: 'Chardonnay, pinot noir, pinot meunier | Louis Roederer, Reims, Francija | Zelo suho', price: 102.00, image: '/menu-images/penine/louis-roederer.png', categoryId: cats.penine.id, sortOrder: 9, modifierGroupIds: [] },
    { name: 'Champagne Pol Roger Brut Reserve', description: 'Chardonnay, modri pinot, pinot meunier | Epernay, Francija | Zelo suho', price: 102.00, image: '/menu-images/penine/pol-roger.png', categoryId: cats.penine.id, sortOrder: 10, modifierGroupIds: [] },
    { name: 'Moët & Chandon Imperial Brut', description: 'Pinot noir, pinot meunier, chardonnay | Moët&Chandon, Epernay, Francija | Zelo suho', price: 95.00, image: '/menu-images/penine/moet-chandon.png', categoryId: cats.penine.id, sortOrder: 11, modifierGroupIds: [] },
    { name: 'Dom Pérignon Brut 2013', description: 'Chardonnay, modri pinot | Epernay, Francija | Zelo suho', price: 390.00, image: '/menu-images/penine/dom-perignon.png', categoryId: cats.penine.id, sortOrder: 12, modifierGroupIds: [] },

    // --- BELA VINA ---
    { name: 'Cuvee Emino 2022 (kozarec)', description: 'Laški rizling, chardonnay, sauvignon | Hiša vin Emino, Šmarje pri Jelšah, Štajerska | Suho | 0.10L', price: 3.00, image: '/menu-images/bela-vina/cuvee-emino-kozarec.png', categoryId: cats.belaVina.id, sortOrder: 0, modifierGroupIds: [] },
    { name: 'Cuvee Emino 2022 (steklenica)', description: 'Laški rizling, chardonnay, sauvignon | Hiša vin Emino, Šmarje pri Jelšah, Štajerska | Suho | 0.75L', price: 21.00, image: '/menu-images/bela-vina/cuvee-emino-steklenica.png', categoryId: cats.belaVina.id, sortOrder: 1, modifierGroupIds: [] },
    { name: 'Chardonnay Verus 2023', description: 'Verus, Štajerska Slovenija, Podravje | Suho | 0.75L', price: 35.00, image: '/menu-images/bela-vina/chardonnay-verus.png', categoryId: cats.belaVina.id, sortOrder: 2, modifierGroupIds: [] },
    { name: 'Sauvignon Blanc Cru Veliki Vrh 2023', description: 'Familija Brodnjak, Haloze, Štajerska Slovenija, Podravje | Suho | 0.75L', price: 42.00, image: '/menu-images/bela-vina/sauvignon-blanc-cru.png', categoryId: cats.belaVina.id, sortOrder: 3, modifierGroupIds: [] },
    { name: 'Laški Rizling 2021', description: 'Janez Colnar, Dolenjska | Suho | 0.75L', price: 35.00, image: '/menu-images/bela-vina/laski-rizling.png', categoryId: cats.belaVina.id, sortOrder: 4, modifierGroupIds: [] },
    { name: 'Traminec 2023', description: 'Butična klet Keltis, Bizeljsko-Sremič, Posavje | Suho | 0.75L', price: 39.00, image: '/menu-images/bela-vina/traminec.png', categoryId: cats.belaVina.id, sortOrder: 5, modifierGroupIds: [] },
    { name: 'Rebula 2022', description: 'Borut Blažič, Goriška Brda, Primorska | Suho | 0.75L', price: 35.00, image: '/menu-images/bela-vina/rebula.png', categoryId: cats.belaVina.id, sortOrder: 6, modifierGroupIds: [] },
    { name: 'Chardonnay Dular 2022', description: 'Ekološko vino | Klet Dular, Bizeljsko-Sremič, Posavje | Suho | 0.75L', price: 50.00, image: '/menu-images/bela-vina/chardonnay-dular.png', categoryId: cats.belaVina.id, sortOrder: 7, modifierGroupIds: [] },
    { name: 'Chardonnay Domaine Vicomte de Noue 2020', description: 'Marinčič Tejca, Vedrignano II Cru, Goriška Brda, Primorska | Suho | 0.75L', price: 120.00, image: '/menu-images/bela-vina/chardonnay-vicomte.png', categoryId: cats.belaVina.id, sortOrder: 8, modifierGroupIds: [] },
    { name: 'Šipon Verus 2022', description: 'Verus, Štajerska Slovenija, Podravje | Suho | 0.75L', price: 35.00, image: '/menu-images/bela-vina/sipon-verus.png', categoryId: cats.belaVina.id, sortOrder: 9, modifierGroupIds: [] },
    { name: 'Sivi Pinot Jamertal 2021', description: 'Valdhuber, Štajerska Slovenija, Podravje | Suho | 0.75L', price: 38.00, image: '/menu-images/bela-vina/sivi-pinot-jamertal.png', categoryId: cats.belaVina.id, sortOrder: 10, modifierGroupIds: [] },
    { name: 'Renski Rizling Stare Trte 2015', description: 'Dveri-Pax, Štajerska Slovenija, Podravje | Suho | 0.75L', price: 39.00, image: '/menu-images/bela-vina/renski-rizling-stare.png', categoryId: cats.belaVina.id, sortOrder: 11, modifierGroupIds: [] },
    { name: 'Renski Rizling Keltis 2021', description: 'Ekološko vino | Keltis, Bizeljsko-Sremič, Posavje | Suho | 0.75L', price: 44.00, image: '/menu-images/bela-vina/renski-rizling-keltis.png', categoryId: cats.belaVina.id, sortOrder: 12, modifierGroupIds: [] },
    { name: 'Alter 2021', description: 'Ekološko vino | Renski rizling, laški rizling, sivi pinot | Kmetija Šumenjak, Štajerska, Podravje | Suho | 0.75L', price: 42.00, image: '/menu-images/bela-vina/alter.png', categoryId: cats.belaVina.id, sortOrder: 13, modifierGroupIds: [] },
    { name: 'Malvazija Malval Movia 2023', description: 'Movia, Goriška Brda, Primorska | Suho | 0.75L', price: 36.00, image: '/menu-images/bela-vina/malvazija-movia.png', categoryId: cats.belaVina.id, sortOrder: 14, modifierGroupIds: [] },
    { name: 'Rebula Cru Selection 2021', description: 'Marjan Simčič, Goriška Brda, Primorska | Suho | 0.75L', price: 55.00, image: '/menu-images/bela-vina/rebula-cru.png', categoryId: cats.belaVina.id, sortOrder: 15, modifierGroupIds: [] },
    { name: 'Burja Bela 2022', description: 'Ekološko Demeter | Malvazija, laški rizling, rebula | Posestvo Burja, Vipavska dolina, Primorska | Suho | 0.75L', price: 40.00, image: '/menu-images/bela-vina/burja-bela.png', categoryId: cats.belaVina.id, sortOrder: 16, modifierGroupIds: [] },
    { name: 'Angel Belo Grande Cuvee 2021', description: 'Ekološko vino | Chardonnay, sauvignon, pinela, laški rizling, sivi pinot | Klet Batič, Vipavska dolina, Primorska | Suho | 0.75L', price: 66.00, image: '/menu-images/bela-vina/angel-belo-2021.png', categoryId: cats.belaVina.id, sortOrder: 17, modifierGroupIds: [] },
    { name: 'Angel Belo Grande Cuvee 2019', description: 'Ekološko vino | Chardonnay, sauvignon, pinela, laški rizling, sivi pinot | Klet Batič, Vipavska dolina, Primorska | Suho | 3.00L', price: 280.00, image: '/menu-images/bela-vina/angel-belo-2019.png', categoryId: cats.belaVina.id, sortOrder: 18, modifierGroupIds: [] },
    { name: 'Rumeni Muškat 2023 (kozarec)', description: 'Klet Dular, Bizeljsko-Sremič, Posavje | Polsladko | 0.10L', price: 4.50, image: '/menu-images/bela-vina/rumeni-muskat-kozarec.png', categoryId: cats.belaVina.id, sortOrder: 19, modifierGroupIds: [] },
    { name: 'Rumeni Muškat 2023 (steklenica)', description: 'Klet Dular, Bizeljsko-Sremič, Posavje | Polsladko | 0.75L', price: 30.00, image: '/menu-images/bela-vina/rumeni-muskat-steklenica.png', categoryId: cats.belaVina.id, sortOrder: 20, modifierGroupIds: [] },
    { name: 'Rumeni Muškat Pozna Trgatev 2019 (kozarec)', description: 'Klet Prus, Metlika, Bela Krajina, Posavje | Sladko | 0.10L', price: 6.50, image: '/menu-images/bela-vina/rumeni-muskat-pozna-kozarec.png', categoryId: cats.belaVina.id, sortOrder: 21, modifierGroupIds: [] },
    { name: 'Rumeni Muškat Pozna Trgatev 2019 (steklenica)', description: 'Klet Prus, Metlika, Bela Krajina, Posavje | Sladko | 0.75L', price: 38.00, image: '/menu-images/bela-vina/rumeni-muskat-pozna-steklenica.png', categoryId: cats.belaVina.id, sortOrder: 22, modifierGroupIds: [] },
    { name: 'Bela Frankinja 2023 (kozarec)', description: 'Klet Dular, Bizeljsko-Sremič, Posavje | Polsladko | 0.10L', price: 5.00, image: '/menu-images/bela-vina/bela-frankinja-kozarec.png', categoryId: cats.belaVina.id, sortOrder: 23, modifierGroupIds: [] },
    { name: 'Bela Frankinja 2023 (steklenica)', description: 'Klet Dular, Bizeljsko-Sremič, Posavje | Polsladko | 0.75L', price: 35.00, image: '/menu-images/bela-vina/bela-frankinja-steklenica.png', categoryId: cats.belaVina.id, sortOrder: 24, modifierGroupIds: [] },

    // --- ROSÉ VINO ---
    { name: 'Rosé Batič 2024', description: 'Cabernet sauvignon | Batič, Vipavska dolina, Primorska | Polsuho | 0.75L', price: 43.00, image: '/menu-images/rose-vino/rose-batic.png', categoryId: cats.roseVino.id, sortOrder: 0, modifierGroupIds: [] },
    { name: 'Rosé Verstovšek Estate 2024 (kozarec)', description: 'Modra frankinja | Verstovšek Estate, Bizeljsko-Sremič, Posavje | Suho | 0.10L', price: 4.80, image: '/menu-images/rose-vino/rose-verstovsek-kozarec.png', categoryId: cats.roseVino.id, sortOrder: 1, modifierGroupIds: [] },
    { name: 'Rosé Verstovšek Estate 2024 (steklenica)', description: 'Modra frankinja | Verstovšek Estate, Bizeljsko-Sremič, Posavje | Suho | 0.75L', price: 35.00, image: '/menu-images/rose-vino/rose-verstovsek-steklenica.png', categoryId: cats.roseVino.id, sortOrder: 2, modifierGroupIds: [] },

    // --- RDEČA VINA ---
    { name: 'Modra Frankinja Emino 2023 (kozarec)', description: 'Hiša vin Emino, Šmarje pri Jelšah, Štajerska | Suho | 0.10L', price: 3.00, image: '/menu-images/rdeca-vina/modra-frankinja-emino-kozarec.png', categoryId: cats.rdecaVina.id, sortOrder: 0, modifierGroupIds: [] },
    { name: 'Modra Frankinja Emino 2023 (steklenica)', description: 'Hiša vin Emino, Šmarje pri Jelšah, Štajerska | Suho | 0.75L', price: 21.00, image: '/menu-images/rdeca-vina/modra-frankinja-emino-steklenica.png', categoryId: cats.rdecaVina.id, sortOrder: 1, modifierGroupIds: [] },
    { name: 'Modra Frankinja Dular 2023', description: 'Klet Dular, Bizeljsko-Sremič, Posavje | Suho | 0.75L', price: 30.00, image: '/menu-images/rdeca-vina/modra-frankinja-dular.png', categoryId: cats.rdecaVina.id, sortOrder: 2, modifierGroupIds: [] },
    { name: 'Modra Frankinja Luna 2021', description: 'Kmetija Kobal, Bizeljsko-Sremič, Posavje | Suho | 0.75L', price: 68.00, image: '/menu-images/rdeca-vina/modra-frankinja-luna.png', categoryId: cats.rdecaVina.id, sortOrder: 3, modifierGroupIds: [] },
    { name: 'Modri Pinot Verus 2019', description: 'Verus, Ormož, Štajerska Slovenija, Podravje | Suho | 0.75L', price: 38.00, image: '/menu-images/rdeca-vina/modri-pinot-verus.png', categoryId: cats.rdecaVina.id, sortOrder: 4, modifierGroupIds: [] },
    { name: 'Modri Pinot Opoka 2020', description: 'Marjan Simčič, Goriška Brda, Primorska | Suho | 0.75L', price: 95.00, image: '/menu-images/rdeca-vina/modri-pinot-opoka.png', categoryId: cats.rdecaVina.id, sortOrder: 5, modifierGroupIds: [] },
    { name: 'Merlot Keltis 2018', description: 'Butična klet Keltis, Bizeljsko-Sremič, Posavje | Suho | 0.75L', price: 48.00, image: '/menu-images/rdeca-vina/merlot-keltis.png', categoryId: cats.rdecaVina.id, sortOrder: 6, modifierGroupIds: [] },
    { name: 'Merlot Opoka 2019', description: 'Marjan Simčič, Goriška Brda, Primorska | Suho | 0.75L', price: 112.00, image: '/menu-images/rdeca-vina/merlot-opoka.png', categoryId: cats.rdecaVina.id, sortOrder: 7, modifierGroupIds: [] },
    { name: 'Cabernet Sauvignon Keltis 2018', description: 'Butična klet Keltis, Bizeljsko-Sremič, Posavje | Suho | 0.75L', price: 48.00, image: '/menu-images/rdeca-vina/cabernet-keltis.png', categoryId: cats.rdecaVina.id, sortOrder: 8, modifierGroupIds: [] },
    { name: 'Cabernet Sauvignon Pavo Limited Edition 2021', description: 'Dušan Kristančič, Goriška Brda, Primorska | Suho | 0.75L', price: 87.00, image: '/menu-images/rdeca-vina/cabernet-pavo.png', categoryId: cats.rdecaVina.id, sortOrder: 9, modifierGroupIds: [] },
    { name: 'Guerila Retro Selection 2020', description: 'Merlot, cabernet sauvignon, barbera | Klet Guerila, Vipavska dolina, Primorska | Suho | 0.75L', price: 50.00, image: '/menu-images/rdeca-vina/guerila-retro.png', categoryId: cats.rdecaVina.id, sortOrder: 10, modifierGroupIds: [] },
    { name: 'Duet Edi Simčič 2021', description: 'Merlot, cabernet sauvignon, cabernet franc | Edi Simčič, Goriška Brda, Primorska | Suho | 0.75L', price: 64.00, image: '/menu-images/rdeca-vina/duet-edi-simcic.png', categoryId: cats.rdecaVina.id, sortOrder: 11, modifierGroupIds: [] },
    { name: 'Duet Lex Edi Simčič 2018', description: 'Merlot, cabernet sauvignon, cabernet franc | Edi Simčič, Goriška Brda, Primorska | Suho | 1.50L', price: 200.00, image: '/menu-images/rdeca-vina/duet-lex-2018.png', categoryId: cats.rdecaVina.id, sortOrder: 12, modifierGroupIds: [] },
    { name: 'Duet Lex Edi Simčič 2020', description: 'Merlot, cabernet sauvignon, cabernet franc | Edi Simčič, Goriška Brda, Primorska | Suho | 0.75L', price: 95.00, image: '/menu-images/rdeca-vina/duet-lex-2020.png', categoryId: cats.rdecaVina.id, sortOrder: 13, modifierGroupIds: [] },
    { name: 'Carolina Rdeča 2018', description: 'Cabernet sauvignon, cabernet franc, merlot | Kmetija Jakončič, Goriška Brda, Primorska | Suho | 0.75L', price: 71.00, image: '/menu-images/rdeca-vina/carolina-rdeca.png', categoryId: cats.rdecaVina.id, sortOrder: 14, modifierGroupIds: [] },
    { name: 'Veliko Rdeče Movia 2015', description: 'Merlot, cabernet sauvignin, modri pinot | Klet Movia, Goriška Brda, Primorska | Suho | 0.75L', price: 93.00, image: '/menu-images/rdeca-vina/veliko-rdece-movia.png', categoryId: cats.rdecaVina.id, sortOrder: 15, modifierGroupIds: [] },

    // --- TUJA VINA ---
    { name: 'Pošip Premium Terra Madre 2021', description: 'Belo | Terra Madre, Južna Dalmacija, Hrvaška | Suho | 0.75L', price: 30.00, image: '/menu-images/tuja-vina/posip-terra-madre.png', categoryId: cats.tujaVina.id, sortOrder: 0, modifierGroupIds: [] },
    { name: 'Andreis Vinasmora 2020', description: 'Rdeče | Babič, Vinasmora, Primošten, Hrvaška | Suho | 0.75L', price: 30.00, image: '/menu-images/tuja-vina/andreis-vinasmora.png', categoryId: cats.tujaVina.id, sortOrder: 1, modifierGroupIds: [] },
    { name: 'Plavac Mali Premium Terra Madre 2017', description: 'Rdeče | Terra Madre, Južna Dalmacija, Hrvaška | Suho | 0.75L', price: 48.00, image: '/menu-images/tuja-vina/plavac-mali-terra-madre.png', categoryId: cats.tujaVina.id, sortOrder: 2, modifierGroupIds: [] },
    { name: 'Vranec Instinct 2019', description: 'Rdeče | Puklavec Family, Makedonija | Suho | 0.75L', price: 30.00, image: '/menu-images/tuja-vina/vranec-instinct.png', categoryId: cats.tujaVina.id, sortOrder: 3, modifierGroupIds: [] },
    { name: 'Chardonnay Where Dreams Have No End 2021', description: 'Belo | Jermann, Friuli Venezia Giulia, Italija | Suho | 0.75L', price: 110.00, image: '/menu-images/tuja-vina/jermann-dreams.png', categoryId: cats.tujaVina.id, sortOrder: 4, modifierGroupIds: [] },
    { name: 'Vintage Tunina 2022', description: 'Belo | Sauvignon, chardonnay, rebula gialla, malvazija | Jermann, Friuli Venezia Giulia, Italija | Suho | 0.75L', price: 110.00, image: '/menu-images/tuja-vina/vintage-tunina.png', categoryId: cats.tujaVina.id, sortOrder: 5, modifierGroupIds: [] },

    // --- LIKERSKO VINO ---
    { name: 'Keros Belo 2020 (0.05L)', description: 'Traminec | Vinarstvo Kerin, Straža nad Krškim, Dolenjska, Posavje | Sladko', price: 4.50, image: '/menu-images/likersko-vino/keros-belo-005.png', categoryId: cats.likerskoVino.id, sortOrder: 0, modifierGroupIds: [] },
    { name: 'Keros Belo 2020 (0.50L)', description: 'Traminec | Vinarstvo Kerin, Straža nad Krškim, Dolenjska, Posavje | Sladko', price: 45.00, image: '/menu-images/likersko-vino/keros-belo-050.png', categoryId: cats.likerskoVino.id, sortOrder: 1, modifierGroupIds: [] },
    { name: 'Keros Rdeče 2018 (0.05L)', description: 'Modra frankinja | Vinarstvo Kerin, Straža nad Krškim, Dolenjska, Posavje | Sladko', price: 4.50, image: '/menu-images/likersko-vino/keros-rdece-005.png', categoryId: cats.likerskoVino.id, sortOrder: 2, modifierGroupIds: [] },
    { name: 'Keros Rdeče 2018 (0.50L)', description: 'Modra frankinja | Vinarstvo Kerin, Straža nad Krškim, Dolenjska, Posavje | Sladko', price: 45.00, image: '/menu-images/likersko-vino/keros-rdece-050.png', categoryId: cats.likerskoVino.id, sortOrder: 3, modifierGroupIds: [] },
    { name: 'Veliko Rdeče Movia 2012', description: 'Merlot, cabernet sauvignin, modri pinot | Klet Movia, Goriška Brda, Primorska | Suho | 3.00L', price: 360.00, image: '/menu-images/likersko-vino/veliko-rdece-2012.png', categoryId: cats.likerskoVino.id, sortOrder: 4, modifierGroupIds: [] },
    { name: 'Sladki Refošk (kozarec)', description: 'Vina Koper, Slovenska Istra, Primorska | Sladko | 0.10L', price: 5.00, image: '/menu-images/likersko-vino/sladki-refosk-kozarec.png', categoryId: cats.likerskoVino.id, sortOrder: 5, modifierGroupIds: [] },
    { name: 'Sladki Refošk (0.50L)', description: 'Vina Koper, Slovenska Istra, Primorska | Sladko | 0.50L', price: 25.00, image: '/menu-images/likersko-vino/sladki-refosk-050.png', categoryId: cats.likerskoVino.id, sortOrder: 6, modifierGroupIds: [] },

    // --- TOČENO PIVO ---
    { name: 'Pivo Haler Lager Nefiltriran (0.30L)', description: 'Pivovarna Haler | 0.30L', price: 3.70, image: '/menu-images/toceno-pivo/haler-nefiltriran-03.png', categoryId: cats.tocenoPivo.id, sortOrder: 0, modifierGroupIds: [] },
    { name: 'Pivo Haler Lager Nefiltriran (0.50L)', description: 'Pivovarna Haler | 0.50L', price: 4.00, image: '/menu-images/toceno-pivo/haler-nefiltriran-05.png', categoryId: cats.tocenoPivo.id, sortOrder: 1, modifierGroupIds: [] },
    { name: 'Pivo Laško Lager (0.30L)', description: 'Pivovarna Laško | 0.30L', price: 3.70, image: '/menu-images/toceno-pivo/lasko-lager-03.png', categoryId: cats.tocenoPivo.id, sortOrder: 2, modifierGroupIds: [] },
    { name: 'Pivo Laško Lager (0.50L)', description: 'Pivovarna Laško | 0.50L', price: 4.00, image: '/menu-images/toceno-pivo/lasko-lager-05.png', categoryId: cats.tocenoPivo.id, sortOrder: 3, modifierGroupIds: [] },
    { name: 'Pivo Union Lager (0.30L)', description: 'Pivovarna Union | 0.30L', price: 3.70, image: '/menu-images/toceno-pivo/union-lager-03.png', categoryId: cats.tocenoPivo.id, sortOrder: 4, modifierGroupIds: [] },
    { name: 'Pivo Union Lager (0.50L)', description: 'Pivovarna Union | 0.50L', price: 4.00, image: '/menu-images/toceno-pivo/union-lager-05.png', categoryId: cats.tocenoPivo.id, sortOrder: 5, modifierGroupIds: [] },
    { name: 'Pelicon 3rd Pill IPA (0.30L)', description: 'Indian Pale Ale | Pivovarna Pelicon | 0.30L', price: 4.50, image: '/menu-images/toceno-pivo/pelicon-ipa-03.png', categoryId: cats.tocenoPivo.id, sortOrder: 6, modifierGroupIds: [] },
    { name: 'Pelicon 3rd Pill IPA (0.50L)', description: 'Indian Pale Ale | Pivovarna Pelicon | 0.50L', price: 5.90, image: '/menu-images/toceno-pivo/pelicon-ipa-05.png', categoryId: cats.tocenoPivo.id, sortOrder: 7, modifierGroupIds: [] },
    { name: 'Radler Grenivka (0.30L)', description: 'Grapefruit | Samo poleti | Pivovarna Union | 0.30L', price: 3.70, image: '/menu-images/toceno-pivo/radler-03.png', categoryId: cats.tocenoPivo.id, sortOrder: 8, modifierGroupIds: [] },
    { name: 'Radler Grenivka (0.50L)', description: 'Grapefruit | Samo poleti | Pivovarna Union | 0.50L', price: 4.00, image: '/menu-images/toceno-pivo/radler-05.png', categoryId: cats.tocenoPivo.id, sortOrder: 9, modifierGroupIds: [] },

    // --- PIVO ---
    { name: 'Reset Lagerish Cream Ale (0.50L)', description: 'Pivovarna Reset, Brežice | 0.50L', price: 5.90, image: '/menu-images/pivo/reset-lagerish.png', categoryId: cats.pivo.id, sortOrder: 0, modifierGroupIds: [] },
    { name: 'Reset Froggy IPA (0.50L)', description: 'Indian Pale Ale | Pivovarna Reset, Brežice | 0.50L', price: 5.90, image: '/menu-images/pivo/reset-froggy.png', categoryId: cats.pivo.id, sortOrder: 1, modifierGroupIds: [] },
    { name: 'Reset Irish Extra Stout (0.50L)', description: 'Temno | Pivovarna Reset, Brežice | 0.50L', price: 5.90, image: '/menu-images/pivo/reset-stout.png', categoryId: cats.pivo.id, sortOrder: 2, modifierGroupIds: [] },

    // --- CRAFT PIVA ---
    { name: 'Pelicon Winter (0.75L)', description: 'Temno | Pivovarna Pelicon | 0.75L', price: 15.00, image: '/menu-images/craft-piva/pelicon-winter.png', categoryId: cats.craftPiva.id, sortOrder: 0, modifierGroupIds: [] },
    { name: 'Zeleni Haler Lager s Konopljo (0.50L)', description: 'Pivovarna Haler | 0.50L', price: 5.90, image: '/menu-images/craft-piva/zeleni-haler.png', categoryId: cats.craftPiva.id, sortOrder: 1, modifierGroupIds: [] },
    { name: 'Bevog Tak Pale Ale (0.33L)', description: 'Pivovarna Bevog | 0.33L', price: 5.00, image: '/menu-images/craft-piva/bevog-tak.png', categoryId: cats.craftPiva.id, sortOrder: 2, modifierGroupIds: [] },

    // --- BREZALKOHOLNO PIVO ---
    { name: 'Heineken 0.0 (0.33L)', description: 'Brezalkoholno | Pivovarna Heineken | 0.33L', price: 4.20, image: '/menu-images/brezalk-pivo/heineken-00.png', categoryId: cats.brezalkPivo.id, sortOrder: 0, modifierGroupIds: [] },
    { name: 'Daura Lager (0.33L)', description: 'Brezglutensko | Estrella Damm, Španija | 0.33L', price: 4.90, image: '/menu-images/brezalk-pivo/daura.png', categoryId: cats.brezalkPivo.id, sortOrder: 1, modifierGroupIds: [] },

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

    // --- TOPLI NAPITKI ---
    { name: 'Kava Espresso', description: 'Espresso kava', price: 2.00, image: '/menu-images/topli-napitki/kava-espresso.png', categoryId: cats.topliNapitki.id, sortOrder: 0, modifierGroupIds: [mods.milkChoice.id, mods.sweetenerChoice.id, mods.alcoholAdd.id] },
    { name: 'Kava Macchiato', description: 'Espresso s kapljico mleka', price: 2.10, image: '/menu-images/topli-napitki/kava-macchiato.png', categoryId: cats.topliNapitki.id, sortOrder: 1, modifierGroupIds: [mods.milkChoice.id, mods.sweetenerChoice.id, mods.alcoholAdd.id] },
    { name: 'Cappuccino', description: 'Espresso s toplo mlečno peno', price: 2.30, image: '/menu-images/topli-napitki/cappuccino.png', categoryId: cats.topliNapitki.id, sortOrder: 2, modifierGroupIds: [mods.milkChoice.id, mods.sweetenerChoice.id] },
    { name: 'Kava z Mlekom', description: 'Kava z mlekom', price: 2.30, image: '/menu-images/topli-napitki/kava-z-mlekom.png', categoryId: cats.topliNapitki.id, sortOrder: 3, modifierGroupIds: [mods.milkChoice.id, mods.sweetenerChoice.id, mods.alcoholAdd.id] },
    { name: 'Kava s Smetano', description: 'Kava s smetano', price: 2.50, image: '/menu-images/topli-napitki/kava-s-smetano.png', categoryId: cats.topliNapitki.id, sortOrder: 4, modifierGroupIds: [mods.sweetenerChoice.id, mods.alcoholAdd.id] },
    { name: 'Bela Kava', description: 'Kava z veliko mlekom', price: 2.80, image: '/menu-images/topli-napitki/bela-kava.png', categoryId: cats.topliNapitki.id, sortOrder: 5, modifierGroupIds: [mods.milkChoice.id, mods.sweetenerChoice.id, mods.alcoholAdd.id] },
    { name: 'Kava Espresso Brez Kofeina', description: 'Dekofeinizirana espresso kava', price: 2.30, image: '/menu-images/topli-napitki/kava-brez-kofeina.png', categoryId: cats.topliNapitki.id, sortOrder: 6, modifierGroupIds: [mods.milkChoice.id, mods.sweetenerChoice.id] },
    { name: 'Kava z Mlekom Brez Kofeina', description: 'Dekofeinizirana kava z mlekom', price: 2.50, image: '/menu-images/topli-napitki/kava-mleko-brez-kofeina.png', categoryId: cats.topliNapitki.id, sortOrder: 7, modifierGroupIds: [mods.milkChoice.id, mods.sweetenerChoice.id] },
    { name: 'Cappuccino Brez Kofeina', description: 'Dekofeinizirani cappuccino', price: 2.60, image: '/menu-images/topli-napitki/cappuccino-brez-kofeina.png', categoryId: cats.topliNapitki.id, sortOrder: 8, modifierGroupIds: [mods.milkChoice.id, mods.sweetenerChoice.id] },
    { name: 'Kava Macchiato Brez Kofeina', description: 'Dekofeinizirana kava macchiato', price: 2.20, image: '/menu-images/topli-napitki/macchiato-brez-kofeina.png', categoryId: cats.topliNapitki.id, sortOrder: 9, modifierGroupIds: [mods.milkChoice.id, mods.sweetenerChoice.id] },
    { name: 'Bela Kava Brez Kofeina', description: 'Dekofeinizirana bela kava', price: 3.00, image: '/menu-images/topli-napitki/bela-kava-brez-kofeina.png', categoryId: cats.topliNapitki.id, sortOrder: 10, modifierGroupIds: [mods.milkChoice.id, mods.sweetenerChoice.id] },
    { name: 'Kava z Riževim Mlekom', description: 'Kava z riževim mlekom', price: 3.00, image: '/menu-images/topli-napitki/kava-rizevo-mleko.png', categoryId: cats.topliNapitki.id, sortOrder: 11, modifierGroupIds: [mods.sweetenerChoice.id] },
    { name: 'Kakav', description: 'Topla čokoladna pijača', price: 3.00, image: '/menu-images/topli-napitki/kakav.png', categoryId: cats.topliNapitki.id, sortOrder: 12, modifierGroupIds: [mods.milkChoice.id, mods.sweetenerChoice.id] },
    { name: 'Kakav s Smetano', description: 'Kakav s smetano', price: 3.50, image: '/menu-images/topli-napitki/kakav-smetana.png', categoryId: cats.topliNapitki.id, sortOrder: 13, modifierGroupIds: [mods.sweetenerChoice.id] },
    { name: 'Babyccino', description: 'Otroška kava', price: 1.00, image: '/menu-images/topli-napitki/babyccino.png', categoryId: cats.topliNapitki.id, sortOrder: 14, modifierGroupIds: [] },
    { name: 'Vroča Čokolada', description: 'Gosta čokolada s smetano', price: 4.50, image: '/menu-images/topli-napitki/vroca-cokolada.png', categoryId: cats.topliNapitki.id, sortOrder: 15, modifierGroupIds: [mods.milkChoice.id, mods.sweetenerChoice.id] },
    { name: 'Čaj z Limono in Medom', description: 'Topel čaj z limono in medom', price: 3.00, image: '/menu-images/topli-napitki/caj-skodelica.png', categoryId: cats.topliNapitki.id, sortOrder: 16, modifierGroupIds: [mods.sweetenerChoice.id, mods.milkChoice.id] },
    { name: 'Ledena Kava Olimia', description: 'Kava, sladoled, čokolada, smetana', price: 6.50, image: '/menu-images/topli-napitki/ledena-kava-olimia.png', categoryId: cats.topliNapitki.id, sortOrder: 17, modifierGroupIds: [mods.iceChoice.id] },

    // --- MEŠANE PIJAČE ---
    { name: 'Aperol Spritz', description: 'Aperol, prosecco, soda, pomaranča', price: 7.50, image: '/menu-images/mesane-pijace/aperol-spritz.png', categoryId: cats.mesanePijace.id, sortOrder: 0, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Martini Spritz', description: 'Martini bianco, prosecco, soda, limeta', price: 8.00, image: '/menu-images/mesane-pijace/martini-spritz.png', categoryId: cats.mesanePijace.id, sortOrder: 1, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Negroni', description: 'Gin, vermut, campari, pomaranča', price: 7.50, image: '/menu-images/mesane-pijace/negroni.png', categoryId: cats.mesanePijace.id, sortOrder: 2, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Cuba Libre', description: 'Rum Havana, Coca-Cola, limeta', price: 8.00, image: '/menu-images/mesane-pijace/cuba-libre.png', categoryId: cats.mesanePijace.id, sortOrder: 3, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Mojito', description: 'Rum, soda, sladkor, meta, limeta', price: 8.50, image: '/menu-images/mesane-pijace/mojito.png', categoryId: cats.mesanePijace.id, sortOrder: 4, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Mango Mojito', description: 'Rum, soda, mango Monin, meta, limeta', price: 8.50, image: '/menu-images/mesane-pijace/mango-mojito.png', categoryId: cats.mesanePijace.id, sortOrder: 5, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Strawberry Mojito', description: 'Rum, soda, jagoda Monin, meta, limeta', price: 8.50, image: '/menu-images/mesane-pijace/strawberry-mojito.png', categoryId: cats.mesanePijace.id, sortOrder: 6, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'London Dry Gin Tonic', description: 'Gin Kristal London dry, Fever Tree tonic water, limeta', price: 8.00, image: '/menu-images/mesane-pijace/london-dry-gin-tonic.png', categoryId: cats.mesanePijace.id, sortOrder: 7, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Monologue Gin Tonic', description: 'Slovenija | Tonic water, brinove jagode, limeta', price: 8.00, image: '/menu-images/mesane-pijace/monolog-gin-tonic.png', categoryId: cats.mesanePijace.id, sortOrder: 8, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Hendrick\'s Gin Tonic', description: 'Škotska | Tonic water, kumara', price: 8.50, image: '/menu-images/mesane-pijace/hendricks-gin-tonic.png', categoryId: cats.mesanePijace.id, sortOrder: 9, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Gin Mare Tonic', description: 'Španija | Mediterranean tonik, limeta, rožmarin', price: 8.50, image: '/menu-images/mesane-pijace/gin-mare-tonic.png', categoryId: cats.mesanePijace.id, sortOrder: 10, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Monkey 47 Gin Tonic', description: 'Nemčija | Tonic water, brinove jagode, rožmarin, limona', price: 9.00, image: '/menu-images/mesane-pijace/monkey47-gin-tonic.png', categoryId: cats.mesanePijace.id, sortOrder: 11, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Orange & Ginger Gin Tonic', description: 'Gin Kristal Orange&Ginger, Ginger Ale tonic, pomaranča', price: 8.00, image: '/menu-images/mesane-pijace/orange-ginger-gin-tonic.png', categoryId: cats.mesanePijace.id, sortOrder: 12, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Raspberry Pink Gin Tonic', description: 'Gin Kristal Raspberry, Rhubarb&Raspberry tonic, meta', price: 8.00, image: '/menu-images/mesane-pijace/raspberry-pink-gin-tonic.png', categoryId: cats.mesanePijace.id, sortOrder: 13, modifierGroupIds: [mods.iceChoice.id] },

    // --- VODE ---
    { name: 'Mineralna Voda (0.25L)', description: 'Mineralna voda | 0.25L', price: 2.50, image: '/menu-images/vode/mineralna-voda-025.png', categoryId: cats.vode.id, sortOrder: 0, modifierGroupIds: [] },
    { name: 'Mineralna Voda (0.50L)', description: 'Mineralna voda | 0.50L', price: 3.50, image: '/menu-images/vode/mineralna-voda-050.png', categoryId: cats.vode.id, sortOrder: 1, modifierGroupIds: [] },
    { name: 'Mineralna Voda (1.00L)', description: 'Mineralna voda | 1.00L', price: 5.00, image: '/menu-images/vode/mineralna-voda-100.png', categoryId: cats.vode.id, sortOrder: 2, modifierGroupIds: [] },
    { name: 'Naravna Voda (0.25L)', description: 'Naravna voda | 0.25L', price: 2.50, image: '/menu-images/vode/naravna-voda-025.png', categoryId: cats.vode.id, sortOrder: 3, modifierGroupIds: [] },
    { name: 'Naravna Voda (0.50L)', description: 'Naravna voda | 0.50L', price: 3.50, image: '/menu-images/vode/naravna-voda-050.png', categoryId: cats.vode.id, sortOrder: 4, modifierGroupIds: [] },
    { name: 'Naravna Voda (1.00L)', description: 'Naravna voda | 1.00L', price: 5.00, image: '/menu-images/vode/naravna-voda-100.png', categoryId: cats.vode.id, sortOrder: 5, modifierGroupIds: [] },
    { name: 'Naravna Voda z Okusom (0.50L)', description: 'Okusna naravna voda | PVC 0.50L', price: 3.50, image: '/menu-images/vode/voda-z-okusom.png', categoryId: cats.vode.id, sortOrder: 6, modifierGroupIds: [] },
    { name: 'Voda Radenska FunctionALL (0.50L)', description: 'Funkcionalna voda | PVC 0.50L', price: 3.50, image: '/menu-images/vode/radenska-functionall.png', categoryId: cats.vode.id, sortOrder: 7, modifierGroupIds: [] },

    // --- NARAVNI SOKOVI ---
    { name: 'Limonada (0.35L)', description: 'Klasična limonada | 0.35L', price: 3.80, image: '/menu-images/naravni-sokovi/limonada.png', categoryId: cats.naravniSokovi.id, sortOrder: 0, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Limonada z Okusom (0.35L)', description: 'Meta, bezeg, ingver | 0.35L', price: 4.50, image: '/menu-images/naravni-sokovi/limonada-okus.png', categoryId: cats.naravniSokovi.id, sortOrder: 1, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Hišni Sok Meta (0.35L)', description: 'Domač metin sok | 0.35L', price: 3.80, image: '/menu-images/naravni-sokovi/hisni-sok-meta.png', categoryId: cats.naravniSokovi.id, sortOrder: 2, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Hišni Ledeni Čaj (0.35L)', description: 'Domač ledeni čaj | 0.35L', price: 3.80, image: '/menu-images/naravni-sokovi/hisni-ledeni-caj.png', categoryId: cats.naravniSokovi.id, sortOrder: 3, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Naravni Pomarančni Sok (0.10L)', description: 'Sveže stisnjen pomarančni sok | 0.10L', price: 2.00, image: '/menu-images/naravni-sokovi/pomarancni-sok.png', categoryId: cats.naravniSokovi.id, sortOrder: 4, modifierGroupIds: [] },

    // --- SOKOVI ---
    { name: 'Marelični Sok (0.20L)', description: '0.20L', price: 3.50, image: '/menu-images/sokovi/marelicni-sok.png', categoryId: cats.sokovi.id, sortOrder: 0, modifierGroupIds: [] },
    { name: 'Naravni Jabolčni Sok 100% (0.20L)', description: '100% naravni | 0.20L', price: 3.80, image: '/menu-images/sokovi/jabolcni-sok.png', categoryId: cats.sokovi.id, sortOrder: 1, modifierGroupIds: [] },
    { name: 'Ribezov Sok (0.20L)', description: '0.20L', price: 3.50, image: '/menu-images/sokovi/ribezov-sok.png', categoryId: cats.sokovi.id, sortOrder: 2, modifierGroupIds: [] },
    { name: 'Ananasov Sok (0.20L)', description: '0.20L', price: 3.50, image: '/menu-images/sokovi/ananasov-sok.png', categoryId: cats.sokovi.id, sortOrder: 3, modifierGroupIds: [] },
    { name: 'Pomarančni Sok (0.20L)', description: '0.20L', price: 3.50, image: '/menu-images/sokovi/pomarancni-sok.png', categoryId: cats.sokovi.id, sortOrder: 4, modifierGroupIds: [] },
    { name: 'Jagodni Sok (0.20L)', description: '0.20L', price: 3.50, image: '/menu-images/sokovi/jagodni-sok.png', categoryId: cats.sokovi.id, sortOrder: 5, modifierGroupIds: [] },
    { name: 'Ledeni Čaj (0.25L)', description: '0.25L', price: 3.50, image: '/menu-images/sokovi/ledeni-caj.png', categoryId: cats.sokovi.id, sortOrder: 6, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Cedevita (0.30L)', description: '0.30L', price: 3.50, image: '/menu-images/sokovi/cedevita.png', categoryId: cats.sokovi.id, sortOrder: 7, modifierGroupIds: [] },
    { name: 'Bubble Tea (0.36L)', description: '0.36L', price: 6.50, image: '/menu-images/sokovi/bubble-tea.png', categoryId: cats.sokovi.id, sortOrder: 8, modifierGroupIds: [mods.iceChoice.id] },

    // --- GAZIRANE PIJAČE ---
    { name: 'Coca Cola (0.25L)', description: '0.25L', price: 3.50, image: '/menu-images/gazirane-pijace/coca-cola.png', categoryId: cats.gaziranePijace.id, sortOrder: 0, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Coca Cola Zero (0.25L)', description: '0.25L', price: 3.50, image: '/menu-images/gazirane-pijace/coca-cola-zero.png', categoryId: cats.gaziranePijace.id, sortOrder: 1, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Fanta (0.25L)', description: '0.25L', price: 3.50, image: '/menu-images/gazirane-pijace/fanta.png', categoryId: cats.gaziranePijace.id, sortOrder: 2, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Cockta (0.275L)', description: 'Slovenska originalna | 0.275L', price: 3.50, image: '/menu-images/gazirane-pijace/cockta.png', categoryId: cats.gaziranePijace.id, sortOrder: 3, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Sprite (0.25L)', description: '0.25L', price: 3.50, image: '/menu-images/gazirane-pijace/sprite.png', categoryId: cats.gaziranePijace.id, sortOrder: 4, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Schweppes Tonic Water (0.25L)', description: '0.25L', price: 3.50, image: '/menu-images/gazirane-pijace/schweppes-tonic.png', categoryId: cats.gaziranePijace.id, sortOrder: 5, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Schweppes Bitter Lemon (0.25L)', description: '0.25L', price: 3.50, image: '/menu-images/gazirane-pijace/schweppes-bitter.png', categoryId: cats.gaziranePijace.id, sortOrder: 6, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Fever Tree Tonic Water (0.20L)', description: 'Premium tonik | 0.20L', price: 4.00, image: '/menu-images/gazirane-pijace/fever-tree-tonic.png', categoryId: cats.gaziranePijace.id, sortOrder: 7, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Fever Tree Mediterranean Tonic (0.20L)', description: 'Premium mediteranski tonik | 0.20L', price: 4.00, image: '/menu-images/gazirane-pijace/fever-tree-med.png', categoryId: cats.gaziranePijace.id, sortOrder: 8, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Fever Tree Rhubarb & Raspberry Tonic (0.20L)', description: 'Premium rabarbara & malina tonik | 0.20L', price: 4.00, image: '/menu-images/gazirane-pijace/fever-tree-rhubarb.png', categoryId: cats.gaziranePijace.id, sortOrder: 9, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Red Bull (0.20L)', description: '0.20L', price: 4.00, image: '/menu-images/gazirane-pijace/red-bull.png', categoryId: cats.gaziranePijace.id, sortOrder: 10, modifierGroupIds: [mods.iceChoice.id] },
  ]
}
