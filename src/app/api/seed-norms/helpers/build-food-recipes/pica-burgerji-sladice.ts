// =====================================================================
// GRADNJA RECEPTOV - Hrana: pica, burgerji, sladice, priloge, koktajli
// =====================================================================

import type { InvItem, MiFn, RecipeEntry } from '../types'

export function buildPicaBurgerjiSladiceRecipes(
  inv: Record<string, InvItem>,
  mi: MiFn
): RecipeEntry[] {
  const {
    invAnanasovSok,
    invBBQOmaka,
    invBrinoveJagode,
    invCebula,
    invCesn,
    invCheddarSir,
    invCokolada,
    invGobe,
    invGovedinaMleta,
    invJackDaniels,
    invJajca,
    invKakavPrašek,
    invKavaZaTiramisu,
    invKorenje,
    invKrompir,
    invKruh,
    invKruhoveDrobtine,
    invLimone,
    invMalibu,
    invMascarpone,
    invMaslo,
    invMocarela,
    invMoka,
    invOlive,
    invOljcnoOlje,
    invPaprika,
    invParadiznik,
    invParadiznikovaOmaka,
    invPiskoti,
    invPivskoTesto,
    invPomarance,
    invRicotta,
    invRumHavana,
    invSladkor,
    invSlanina,
    invSmetana,
    invSolata,
    invSvicarskiSir,
    invTestoZaPico,
    invZelje,
    invAvokado,
    invBazilika,
  } = inv

  const recipes: RecipeEntry[] = []

  // --- PICA ---
  const margherita = mi('Margherita')
  if (margherita) {
    recipes.push({ menuItemName: 'Margherita', ingredientId: invTestoZaPico.id, quantityPerServing: 1, unit: 'servings', notes: '1 testo' })
    recipes.push({ menuItemName: 'Margherita', ingredientId: invParadiznikovaOmaka.id, quantityPerServing: 1, unit: 'servings', notes: 'Paradižnikova omaka' })
    recipes.push({ menuItemName: 'Margherita', ingredientId: invMocarela.id, quantityPerServing: 1, unit: 'servings', notes: 'Mocarela' })
    recipes.push({ menuItemName: 'Margherita', ingredientId: invBazilika.id, quantityPerServing: 1, unit: 'servings', notes: 'Bazilika' })
  }
  const pepperoni = mi('Pepperoni')
  if (pepperoni) {
    recipes.push({ menuItemName: 'Pepperoni', ingredientId: invTestoZaPico.id, quantityPerServing: 1, unit: 'servings', notes: '1 testo' })
    recipes.push({ menuItemName: 'Pepperoni', ingredientId: invParadiznikovaOmaka.id, quantityPerServing: 1, unit: 'servings', notes: 'Paradižnikova omaka' })
    recipes.push({ menuItemName: 'Pepperoni', ingredientId: invMocarela.id, quantityPerServing: 1, unit: 'servings', notes: 'Mocarela' })
    recipes.push({ menuItemName: 'Pepperoni', ingredientId: invGovedinaMleta.id, quantityPerServing: 0.5, unit: 'servings', notes: 'Pepperoni' })
  }
  const bbqPiscanec = mi('BBQ piščanec')
  if (bbqPiscanec) {
    recipes.push({ menuItemName: 'BBQ piščanec', ingredientId: invTestoZaPico.id, quantityPerServing: 1, unit: 'servings', notes: '1 testo' })
    recipes.push({ menuItemName: 'BBQ piščanec', ingredientId: invBBQOmaka.id, quantityPerServing: 2, unit: 'servings', notes: 'BBQ omaka' })
    recipes.push({ menuItemName: 'BBQ piščanec', ingredientId: invMocarela.id, quantityPerServing: 1, unit: 'servings', notes: 'Mocarela' })
    recipes.push({ menuItemName: 'BBQ piščanec', ingredientId: invCebula.id, quantityPerServing: 1, unit: 'servings', notes: 'Rdeča čebula' })
  }
  const vegetarijanska = mi('Vegetarijanska')
  if (vegetarijanska) {
    recipes.push({ menuItemName: 'Vegetarijanska', ingredientId: invTestoZaPico.id, quantityPerServing: 1, unit: 'servings', notes: '1 testo' })
    recipes.push({ menuItemName: 'Vegetarijanska', ingredientId: invParadiznikovaOmaka.id, quantityPerServing: 1, unit: 'servings', notes: 'Paradižnikova omaka' })
    recipes.push({ menuItemName: 'Vegetarijanska', ingredientId: invMocarela.id, quantityPerServing: 1, unit: 'servings', notes: 'Mocarela' })
    recipes.push({ menuItemName: 'Vegetarijanska', ingredientId: invPaprika.id, quantityPerServing: 1, unit: 'servings', notes: 'Paprika' })
    recipes.push({ menuItemName: 'Vegetarijanska', ingredientId: invGobe.id, quantityPerServing: 1, unit: 'servings', notes: 'Gobe' })
    recipes.push({ menuItemName: 'Vegetarijanska', ingredientId: invOlive.id, quantityPerServing: 1, unit: 'servings', notes: 'Olive' })
  }

  // --- BURGERJI ---
  const klasicenBurger = mi('Klasičen burger')
  if (klasicenBurger) {
    recipes.push({ menuItemName: 'Klasičen burger', ingredientId: invGovedinaMleta.id, quantityPerServing: 1, unit: 'servings', notes: '150g goveji patty' })
    recipes.push({ menuItemName: 'Klasičen burger', ingredientId: invKruh.id, quantityPerServing: 1, unit: 'servings', notes: 'Burger bun' })
    recipes.push({ menuItemName: 'Klasičen burger', ingredientId: invSolata.id, quantityPerServing: 1, unit: 'servings', notes: 'Solata' })
    recipes.push({ menuItemName: 'Klasičen burger', ingredientId: invParadiznik.id, quantityPerServing: 1, unit: 'servings', notes: 'Paradižnik' })
    recipes.push({ menuItemName: 'Klasičen burger', ingredientId: invCebula.id, quantityPerServing: 1, unit: 'servings', notes: 'Čebula' })
  }
  const baconCheeseburger = mi('Bacon cheeseburger')
  if (baconCheeseburger) {
    recipes.push({ menuItemName: 'Bacon cheeseburger', ingredientId: invGovedinaMleta.id, quantityPerServing: 1, unit: 'servings', notes: '150g goveji patty' })
    recipes.push({ menuItemName: 'Bacon cheeseburger', ingredientId: invSlanina.id, quantityPerServing: 3, unit: 'servings', notes: '150g slanine' })
    recipes.push({ menuItemName: 'Bacon cheeseburger', ingredientId: invCheddarSir.id, quantityPerServing: 1, unit: 'servings', notes: 'Cheddar' })
    recipes.push({ menuItemName: 'Bacon cheeseburger', ingredientId: invKruh.id, quantityPerServing: 1, unit: 'servings', notes: 'Burger bun' })
  }
  const gobeSvicar = mi('Gobe in švicar')
  if (gobeSvicar) {
    recipes.push({ menuItemName: 'Gobe in švicar', ingredientId: invGovedinaMleta.id, quantityPerServing: 1, unit: 'servings', notes: '150g goveji patty' })
    recipes.push({ menuItemName: 'Gobe in švicar', ingredientId: invGobe.id, quantityPerServing: 2, unit: 'servings', notes: '200g gob' })
    recipes.push({ menuItemName: 'Gobe in švicar', ingredientId: invSvicarskiSir.id, quantityPerServing: 1, unit: 'servings', notes: 'Švicarski sir' })
    recipes.push({ menuItemName: 'Gobe in švicar', ingredientId: invKruh.id, quantityPerServing: 1, unit: 'servings', notes: 'Burger bun' })
  }
  const zelenjavniBurger = mi('Zelenjavni burger')
  if (zelenjavniBurger) {
    recipes.push({ menuItemName: 'Zelenjavni burger', ingredientId: invKruh.id, quantityPerServing: 1, unit: 'servings', notes: 'Burger bun' })
    recipes.push({ menuItemName: 'Zelenjavni burger', ingredientId: invAvokado.id, quantityPerServing: 1, unit: 'servings', notes: 'Avokado' })
    recipes.push({ menuItemName: 'Zelenjavni burger', ingredientId: invSolata.id, quantityPerServing: 1, unit: 'servings', notes: 'Solata' })
  }

  // --- SLADICE ---
  const tiramisu = mi('Tiramisu')
  if (tiramisu) {
    recipes.push({ menuItemName: 'Tiramisu', ingredientId: invMascarpone.id, quantityPerServing: 1, unit: 'servings', notes: '200g mascarpone' })
    recipes.push({ menuItemName: 'Tiramisu', ingredientId: invPiskoti.id, quantityPerServing: 1, unit: 'servings', notes: '100g piškotov' })
    recipes.push({ menuItemName: 'Tiramisu', ingredientId: invKavaZaTiramisu.id, quantityPerServing: 1, unit: 'servings', notes: '0.10L kave' })
    recipes.push({ menuItemName: 'Tiramisu', ingredientId: invKakavPrašek.id, quantityPerServing: 1, unit: 'servings', notes: 'Kakav za posip' })
    recipes.push({ menuItemName: 'Tiramisu', ingredientId: invJajca.id, quantityPerServing: 1, unit: 'servings', notes: '1 jajce' })
  }
  const cokoladniLava = mi('Čokoladni lava cake')
  if (cokoladniLava) {
    recipes.push({ menuItemName: 'Čokoladni lava cake', ingredientId: invCokolada.id, quantityPerServing: 1, unit: 'servings', notes: '80g čokolade' })
    recipes.push({ menuItemName: 'Čokoladni lava cake', ingredientId: invMaslo.id, quantityPerServing: 1, unit: 'servings', notes: 'Maslo' })
    recipes.push({ menuItemName: 'Čokoladni lava cake', ingredientId: invJajca.id, quantityPerServing: 2, unit: 'servings', notes: '2 jajci' })
    recipes.push({ menuItemName: 'Čokoladni lava cake', ingredientId: invMoka.id, quantityPerServing: 1, unit: 'servings', notes: 'Moka' })
  }
  const cheesecake = mi('Cheesecake')
  if (cheesecake) {
    recipes.push({ menuItemName: 'Cheesecake', ingredientId: invRicotta.id, quantityPerServing: 1, unit: 'servings', notes: '100g ricotte' })
    recipes.push({ menuItemName: 'Cheesecake', ingredientId: invMascarpone.id, quantityPerServing: 1, unit: 'servings', notes: '100g mascarpone' })
    recipes.push({ menuItemName: 'Cheesecake', ingredientId: invPiskoti.id, quantityPerServing: 1, unit: 'servings', notes: 'Podloga iz piškotov' })
    recipes.push({ menuItemName: 'Cheesecake', ingredientId: invMaslo.id, quantityPerServing: 1, unit: 'servings', notes: 'Maslo za podlogo' })
  }
  const cremeBrulee = mi('Crème brûlée')
  if (cremeBrulee) {
    recipes.push({ menuItemName: 'Crème brûlée', ingredientId: invSmetana.id, quantityPerServing: 3, unit: 'servings', notes: '0.15L sladke smetane' })
    recipes.push({ menuItemName: 'Crème brûlée', ingredientId: invJajca.id, quantityPerServing: 2, unit: 'servings', notes: '2 rumenjaka' })
    recipes.push({ menuItemName: 'Crème brûlée', ingredientId: invSladkor.id, quantityPerServing: 3, unit: 'servings', notes: 'Sladkor + karamela' })
  }

  // --- PRILOGE ---
  const pomfri = mi('Pomfri')
  if (pomfri) {
    recipes.push({ menuItemName: 'Pomfri', ingredientId: invKrompir.id, quantityPerServing: 1, unit: 'servings', notes: '200g krompirja' })
    recipes.push({ menuItemName: 'Pomfri', ingredientId: invOljcnoOlje.id, quantityPerServing: 3, unit: 'servings', notes: 'Za cvrtje' })
  }
  const cesnovKruh = mi('Česnov kruh')
  if (cesnovKruh) {
    recipes.push({ menuItemName: 'Česnov kruh', ingredientId: invKruh.id, quantityPerServing: 3, unit: 'servings', notes: '3 rezine kruha' })
    recipes.push({ menuItemName: 'Česnov kruh', ingredientId: invCesn.id, quantityPerServing: 3, unit: 'servings', notes: 'Česen' })
    recipes.push({ menuItemName: 'Česnov kruh', ingredientId: invMaslo.id, quantityPerServing: 2, unit: 'servings', notes: 'Česnovo maslo' })
  }
  const coleslaw = mi('Coleslaw')
  if (coleslaw) {
    recipes.push({ menuItemName: 'Coleslaw', ingredientId: invZelje.id, quantityPerServing: 1, unit: 'servings', notes: '250g zelja' })
    recipes.push({ menuItemName: 'Coleslaw', ingredientId: invKorenje.id, quantityPerServing: 1, unit: 'servings', notes: 'Korenje' })
    recipes.push({ menuItemName: 'Coleslaw', ingredientId: invSmetana.id, quantityPerServing: 1, unit: 'servings', notes: 'Kremni preliv' })
  }
  const cebljniObročki = mi('Čebulni obročki')
  if (cebljniObročki) {
    recipes.push({ menuItemName: 'Čebulni obročki', ingredientId: invCebula.id, quantityPerServing: 3, unit: 'servings', notes: '150g čebule' })
    recipes.push({ menuItemName: 'Čebulni obročki', ingredientId: invPivskoTesto.id, quantityPerServing: 1, unit: 'servings', notes: 'Pivsko testo' })
    recipes.push({ menuItemName: 'Čebulni obročki', ingredientId: invOljcnoOlje.id, quantityPerServing: 3, unit: 'servings', notes: 'Za cvrtje' })
  }

  // --- MANJKAJOČI KOKTAJLI ---
  const oldFashioned = mi('Old Fashioned')
  if (oldFashioned) {
    recipes.push({ menuItemName: 'Old Fashioned', ingredientId: invJackDaniels.id, quantityPerServing: 2, unit: 'servings', notes: '0.06L viskija' })
    recipes.push({ menuItemName: 'Old Fashioned', ingredientId: invSladkor.id, quantityPerServing: 1, unit: 'servings', notes: 'Kocka sladkorja' })
    recipes.push({ menuItemName: 'Old Fashioned', ingredientId: invBrinoveJagode.id, quantityPerServing: 1, unit: 'servings', notes: 'Brinove jagode' })
    recipes.push({ menuItemName: 'Old Fashioned', ingredientId: invPomarance.id, quantityPerServing: 1, unit: 'servings', notes: 'Lupina pomaranče' })
  }
  const pinaColada = mi('Pina Colada')
  if (pinaColada) {
    recipes.push({ menuItemName: 'Pina Colada', ingredientId: invRumHavana.id, quantityPerServing: 2, unit: 'servings', notes: '0.06L rum' })
    recipes.push({ menuItemName: 'Pina Colada', ingredientId: invMalibu.id, quantityPerServing: 1, unit: 'servings', notes: '0.03L kokosov liker' })
    recipes.push({ menuItemName: 'Pina Colada', ingredientId: invAnanasovSok.id, quantityPerServing: 1, unit: 'servings', notes: 'Ananasov sok' })
  }

  return recipes
}
