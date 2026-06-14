// =====================================================================
// GRADNJA RECEPTOV - Hrana (predjedi, testenine, pica, burgerji, sladice)
// =====================================================================

import type { InvItem, MiFn, RecipeEntry } from './types'

export function buildFoodRecipes(inv: Record<string, InvItem>, mi: MiFn): RecipeEntry[] {
  const {
    invAnanasovSok,
    invAvokado,
    invBBQOmaka,
    invBazilika,
    invBechamel,
    invBrinoveJagode,
    invCebula,
    invCesn,
    invCheddarSir,
    invCokolada,
    invFettuccine,
    invGobe,
    invGovedinaMleta,
    invGovejaJuha,
    invJackDaniels,
    invJajca,
    invJanjetina,
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
    invPanceta,
    invPaprika,
    invParadiznik,
    invParadiznikovaOmaka,
    invPenneTestenine,
    invPeprikaChili,
    invPiskoti,
    invPivskoTesto,
    invPomarance,
    invRicotta,
    invRimskiOhrovt,
    invRumHavana,
    invSladkor,
    invSlanina,
    invSmetana,
    invSolata,
    invSvicarskiSir,
    invTestoZaPico,
    invZelje,
    invZrezki,
    invZrezkiRezanci
  } = inv

  const recipes: RecipeEntry[] = []

    // =====================================================================
    // HRANA - RECEPTI / NORMATIVI
    // =====================================================================

    // --- PREDJEDI ---
    const cezarjevaSolata = mi('Cezarjeva solata')
    if (cezarjevaSolata) {
      recipes.push({ menuItemName: 'Cezarjeva solata', ingredientId: invRimskiOhrovt.id, quantityPerServing: 2, unit: 'servings', notes: '200g rimskega ohrovta' })
      recipes.push({ menuItemName: 'Cezarjeva solata', ingredientId: invMocarela.id, quantityPerServing: 0.5, unit: 'servings', notes: 'Parmezan' })
      recipes.push({ menuItemName: 'Cezarjeva solata', ingredientId: invKruh.id, quantityPerServing: 2, unit: 'servings', notes: 'Krutoni' })
      recipes.push({ menuItemName: 'Cezarjeva solata', ingredientId: invOljcnoOlje.id, quantityPerServing: 2, unit: 'servings', notes: 'Preliv' })
    }
    const bruschetta = mi('Bruschetta')
    if (bruschetta) {
      recipes.push({ menuItemName: 'Bruschetta', ingredientId: invKruh.id, quantityPerServing: 3, unit: 'servings', notes: '3 rezine kruha' })
      recipes.push({ menuItemName: 'Bruschetta', ingredientId: invParadiznik.id, quantityPerServing: 2, unit: 'servings', notes: '200g paradižnika' })
      recipes.push({ menuItemName: 'Bruschetta', ingredientId: invBazilika.id, quantityPerServing: 2, unit: 'servings', notes: 'Bazilika' })
      recipes.push({ menuItemName: 'Bruschetta', ingredientId: invOljcnoOlje.id, quantityPerServing: 2, unit: 'servings', notes: 'Oljčno olje' })
      recipes.push({ menuItemName: 'Bruschetta', ingredientId: invCesn.id, quantityPerServing: 1, unit: 'servings', notes: 'Česen' })
    }
    const vijolicniZavitki = mi('Vijolični zavitki')
    if (vijolicniZavitki) {
      recipes.push({ menuItemName: 'Vijolični zavitki', ingredientId: invPivskoTesto.id, quantityPerServing: 1, unit: 'servings', notes: '100g testa' })
      recipes.push({ menuItemName: 'Vijolični zavitki', ingredientId: invZelje.id, quantityPerServing: 1, unit: 'servings', notes: 'Zelenjavno polnilo' })
      recipes.push({ menuItemName: 'Vijolični zavitki', ingredientId: invKorenje.id, quantityPerServing: 1, unit: 'servings', notes: 'Korenje' })
      recipes.push({ menuItemName: 'Vijolični zavitki', ingredientId: invOljcnoOlje.id, quantityPerServing: 2, unit: 'servings', notes: 'Cvrtje + preliv' })
    }
    const juhaDneva = mi('Juha dneva')
    if (juhaDneva) {
      recipes.push({ menuItemName: 'Juha dneva', ingredientId: invGovejaJuha.id, quantityPerServing: 1, unit: 'servings', notes: '0.50L jušne osnove' })
      recipes.push({ menuItemName: 'Juha dneva', ingredientId: invZrezkiRezanci.id, quantityPerServing: 1, unit: 'servings', notes: 'Rezanci' })
    }

    // --- JUHE ---
    const govejaJuha = mi('Goveja juha')
    if (govejaJuha) {
      recipes.push({ menuItemName: 'Goveja juha', ingredientId: invGovejaJuha.id, quantityPerServing: 1, unit: 'servings', notes: '0.50L jušne osnove' })
      recipes.push({ menuItemName: 'Goveja juha', ingredientId: invZrezkiRezanci.id, quantityPerServing: 1, unit: 'servings', notes: '100g rezancev' })
      recipes.push({ menuItemName: 'Goveja juha', ingredientId: invKorenje.id, quantityPerServing: 1, unit: 'servings', notes: 'Zelenjava' })
    }
    const paradiznikovaJuha = mi('Paradižnikova juha')
    if (paradiznikovaJuha) {
      recipes.push({ menuItemName: 'Paradižnikova juha', ingredientId: invParadiznik.id, quantityPerServing: 3, unit: 'servings', notes: '300g paradižnika' })
      recipes.push({ menuItemName: 'Paradižnikova juha', ingredientId: invBazilika.id, quantityPerServing: 1, unit: 'servings', notes: 'Bazilika' })
      recipes.push({ menuItemName: 'Paradižnikova juha', ingredientId: invMocarela.id, quantityPerServing: 0.5, unit: 'servings', notes: 'Sir za posip' })
    }
    const gobovaJuha = mi('Gobicna juha')
    if (gobovaJuha) {
      recipes.push({ menuItemName: 'Gobicna juha', ingredientId: invGobe.id, quantityPerServing: 3, unit: 'servings', notes: '300g gob' })
      recipes.push({ menuItemName: 'Gobicna juha', ingredientId: invMocarela.id, quantityPerServing: 0.5, unit: 'servings', notes: 'Truški' })
      recipes.push({ menuItemName: 'Gobicna juha', ingredientId: invCesn.id, quantityPerServing: 1, unit: 'servings', notes: 'Česen' })
    }

    // --- GLAVNE JEDI ---
    const zarLosos = mi('Žar losos')
    if (zarLosos) {
      recipes.push({ menuItemName: 'Žar losos', ingredientId: invLimone.id, quantityPerServing: 3, unit: 'servings', notes: 'Limona + maslo' })
      recipes.push({ menuItemName: 'Žar losos', ingredientId: invMaslo.id, quantityPerServing: 2, unit: 'servings', notes: 'Maslo za omako' })
      recipes.push({ menuItemName: 'Žar losos', ingredientId: invKrompir.id, quantityPerServing: 1, unit: 'servings', notes: 'Priloga' })
    }
    const ribeyeZrezek = mi('Ribeye zrezek')
    if (ribeyeZrezek) {
      recipes.push({ menuItemName: 'Ribeye zrezek', ingredientId: invOljcnoOlje.id, quantityPerServing: 2, unit: 'servings', notes: 'Za peko' })
      recipes.push({ menuItemName: 'Ribeye zrezek', ingredientId: invCesn.id, quantityPerServing: 1, unit: 'servings', notes: 'Česen' })
      recipes.push({ menuItemName: 'Ribeye zrezek', ingredientId: invMaslo.id, quantityPerServing: 2, unit: 'servings', notes: 'Maslo' })
    }
    const piscanecParmezan = mi('Piščanec parmezan')
    if (piscanecParmezan) {
      recipes.push({ menuItemName: 'Piščanec parmezan', ingredientId: invMocarela.id, quantityPerServing: 1, unit: 'servings', notes: 'Mocarela za posip' })
      recipes.push({ menuItemName: 'Piščanec parmezan', ingredientId: invParadiznikovaOmaka.id, quantityPerServing: 1, unit: 'servings', notes: 'Paradižnikova omaka' })
      recipes.push({ menuItemName: 'Piščanec parmezan', ingredientId: invKruhoveDrobtine.id, quantityPerServing: 2, unit: 'servings', notes: 'Paniranje' })
    }
    const janjeciKotleti = mi('Janječji kotleti')
    if (janjeciKotleti) {
      recipes.push({ menuItemName: 'Janječji kotleti', ingredientId: invJanjetina.id, quantityPerServing: 1, unit: 'servings', notes: '250g janjetine' })
      recipes.push({ menuItemName: 'Janječji kotleti', ingredientId: invOljcnoOlje.id, quantityPerServing: 1, unit: 'servings', notes: 'Za peko' })
      recipes.push({ menuItemName: 'Janječji kotleti', ingredientId: invCesn.id, quantityPerServing: 1, unit: 'servings', notes: 'Česen' })
    }

    // --- TESTENINE ---
    const spagetiKarbonara = mi('Špageti karbonara')
    if (spagetiKarbonara) {
      recipes.push({ menuItemName: 'Špageti karbonara', ingredientId: invZrezki.id, quantityPerServing: 1, unit: 'servings', notes: '100g špagetov' })
      recipes.push({ menuItemName: 'Špageti karbonara', ingredientId: invPanceta.id, quantityPerServing: 1, unit: 'servings', notes: '65g pancete' })
      recipes.push({ menuItemName: 'Špageti karbonara', ingredientId: invJajca.id, quantityPerServing: 2, unit: 'servings', notes: '2 jajci' })
      recipes.push({ menuItemName: 'Špageti karbonara', ingredientId: invMocarela.id, quantityPerServing: 0.5, unit: 'servings', notes: 'Parmezan' })
    }
    const fettuccineAlfredo = mi('Fettuccine alfredo')
    if (fettuccineAlfredo) {
      recipes.push({ menuItemName: 'Fettuccine alfredo', ingredientId: invFettuccine.id, quantityPerServing: 1, unit: 'servings', notes: '100g testenin' })
      recipes.push({ menuItemName: 'Fettuccine alfredo', ingredientId: invBechamel.id, quantityPerServing: 1, unit: 'servings', notes: '0.10L béchamel' })
      recipes.push({ menuItemName: 'Fettuccine alfredo', ingredientId: invMaslo.id, quantityPerServing: 1, unit: 'servings', notes: 'Maslo' })
      recipes.push({ menuItemName: 'Fettuccine alfredo', ingredientId: invMocarela.id, quantityPerServing: 0.5, unit: 'servings', notes: 'Parmezan' })
    }
    const penneArrabbiata = mi('Penne arrabbiata')
    if (penneArrabbiata) {
      recipes.push({ menuItemName: 'Penne arrabbiata', ingredientId: invPenneTestenine.id, quantityPerServing: 1, unit: 'servings', notes: '100g penne' })
      recipes.push({ menuItemName: 'Penne arrabbiata', ingredientId: invParadiznikovaOmaka.id, quantityPerServing: 1, unit: 'servings', notes: 'Paradižnikova omaka' })
      recipes.push({ menuItemName: 'Penne arrabbiata', ingredientId: invCesn.id, quantityPerServing: 2, unit: 'servings', notes: 'Česen' })
      recipes.push({ menuItemName: 'Penne arrabbiata', ingredientId: invPeprikaChili.id, quantityPerServing: 2, unit: 'servings', notes: 'Chili' })
    }
    const lazanja = mi('Lazanja')
    if (lazanja) {
      recipes.push({ menuItemName: 'Lazanja', ingredientId: invPenneTestenine.id, quantityPerServing: 1, unit: 'servings', notes: 'Testenine za lazanzo' })
      recipes.push({ menuItemName: 'Lazanja', ingredientId: invGovedinaMleta.id, quantityPerServing: 1, unit: 'servings', notes: '200g mlete govedine' })
      recipes.push({ menuItemName: 'Lazanja', ingredientId: invParadiznikovaOmaka.id, quantityPerServing: 1, unit: 'servings', notes: 'Paradižnikova omaka' })
      recipes.push({ menuItemName: 'Lazanja', ingredientId: invBechamel.id, quantityPerServing: 1, unit: 'servings', notes: 'Béchamel' })
      recipes.push({ menuItemName: 'Lazanja', ingredientId: invMocarela.id, quantityPerServing: 1, unit: 'servings', notes: 'Sir za posip' })
    }

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
