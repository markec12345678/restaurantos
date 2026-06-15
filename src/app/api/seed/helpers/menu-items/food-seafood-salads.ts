import { CategoryRef, ModifierRef, MenuItemSeed } from './types'

// =====================================================================
// HRANA - Kalamari, ribje jedi, solate
// =====================================================================

export function getFoodSeafoodSalads(
  cats: Record<string, CategoryRef>,
  mods: Record<string, ModifierRef>
): MenuItemSeed[] {
  return [
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
  ]
}
