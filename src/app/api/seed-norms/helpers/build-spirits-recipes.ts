// =====================================================================
// GRADNJA RECEPTOV - Kava, žgane pijače, koktajli, gin tonics
// =====================================================================

import type { InvItem, MiFn, RecipeEntry } from './types'

export function buildSpiritsRecipes(inv: Record<string, InvItem>, mi: MiFn): RecipeEntry[] {
  const {
    invAmaro,
    invAperol,
    invArarat15,
    invArarat20,
    invArarat6,
    invBorovnicaKejzar,
    invBrinjevec,
    invBrinoveJagode,
    invBumbuCream,
    invCajVrecice,
    invCampari,
    invCanella,
    invCarolans,
    invChivas,
    invCocaCola,
    invCokolada,
    invCynar,
    invDelamaineXO,
    invFeverTreeMedTonic,
    invFeverTreeRhubarb,
    invFeverTreeTonic,
    invGinKristal,
    invGinKristalOrange,
    invGinKristalRaspberry,
    invGinMare,
    invGinMonolog,
    invGingerAle,
    invGlenmorangie18,
    invGlenmorangieLasanta,
    invGrappa,
    invHendricks,
    invHennessyVS,
    invHennessyXO,
    invJWBlack,
    invJackDaniels,
    invJagermeister,
    invJameson,
    invKakav,
    invKavaBrezKofeina,
    invKavaZrna,
    invKravjeMleko,
    invKumara,
    invLagavulin,
    invLaphroaig,
    invLimete,
    invLimone,
    invMalibu,
    invMed,
    invMedicaKejzar,
    invMeta,
    invMoninJagoda,
    invMoninMango,
    invMonkey47,
    invNikkaBarrel,
    invNikkaMiyagikyo,
    invPelinkovec,
    invPomarance,
    invProsecco,
    invRizevoMleko,
    invRozmarin,
    invRumBumbu,
    invRumDiplomatico,
    invRumHavana,
    invRumHechicera,
    invRumZacapa,
    invSladkor,
    invSladoled,
    invSlivovka,
    invSmetana,
    invSodaVoda,
    invTanqueray,
    invTravarica,
    invVermut,
    invViljamovka
  } = inv

  const recipes: RecipeEntry[] = []

    // =====================================================================
    // RECEPTI / NORMATIVI (RecipeItem) - Kava, žgane pijače, koktajli
    // =====================================================================

    // --- TOPLI NAPITKI - KAVA ---
    const espresso = mi('Kava Espresso')
    if (espresso) recipes.push({ menuItemName: 'Kava Espresso', ingredientId: invKavaZrna.id, quantityPerServing: 1, unit: 'servings', notes: '7g kavnih zrn' })

    const macchiato = mi('Kava Macchiato')
    if (macchiato) {
      recipes.push({ menuItemName: 'Kava Macchiato', ingredientId: invKavaZrna.id, quantityPerServing: 1, unit: 'servings', notes: '7g kavnih zrn' })
      recipes.push({ menuItemName: 'Kava Macchiato', ingredientId: invKravjeMleko.id, quantityPerServing: 0.1, unit: 'L', notes: 'Kapljica mleka' })
    }

    const cappuccino = mi('Cappuccino')
    if (cappuccino) {
      recipes.push({ menuItemName: 'Cappuccino', ingredientId: invKavaZrna.id, quantityPerServing: 1, unit: 'servings', notes: '7g kavnih zrn' })
      recipes.push({ menuItemName: 'Cappuccino', ingredientId: invKravjeMleko.id, quantityPerServing: 0.15, unit: 'L', notes: 'Mlečna pena' })
    }

    const kavaZMlekom = mi('Kava z Mlekom')
    if (kavaZMlekom) {
      recipes.push({ menuItemName: 'Kava z Mlekom', ingredientId: invKavaZrna.id, quantityPerServing: 1, unit: 'servings', notes: '7g kavnih zrn' })
      recipes.push({ menuItemName: 'Kava z Mlekom', ingredientId: invKravjeMleko.id, quantityPerServing: 0.10, unit: 'L', notes: 'Mleko' })
    }

    const kavaSSmetano = mi('Kava s Smetano')
    if (kavaSSmetano) {
      recipes.push({ menuItemName: 'Kava s Smetano', ingredientId: invKavaZrna.id, quantityPerServing: 1, unit: 'servings', notes: '7g kavnih zrn' })
      recipes.push({ menuItemName: 'Kava s Smetano', ingredientId: invSmetana.id, quantityPerServing: 0.03, unit: 'L', notes: 'Smetana na vrhu' })
    }

    const belaKava = mi('Bela Kava')
    if (belaKava) {
      recipes.push({ menuItemName: 'Bela Kava', ingredientId: invKavaZrna.id, quantityPerServing: 1, unit: 'servings', notes: '7g kavnih zrn' })
      recipes.push({ menuItemName: 'Bela Kava', ingredientId: invKravjeMleko.id, quantityPerServing: 0.20, unit: 'L', notes: 'Veliko mleka' })
    }

    const espressoBrezKofeina = mi('Kava Espresso Brez Kofeina')
    if (espressoBrezKofeina) recipes.push({ menuItemName: 'Kava Espresso Brez Kofeina', ingredientId: invKavaBrezKofeina.id, quantityPerServing: 1, unit: 'servings', notes: '7g decaf zrn' })

    const kavaMlekoBrezKofeina = mi('Kava z Mlekom Brez Kofeina')
    if (kavaMlekoBrezKofeina) {
      recipes.push({ menuItemName: 'Kava z Mlekom Brez Kofeina', ingredientId: invKavaBrezKofeina.id, quantityPerServing: 1, unit: 'servings', notes: '7g decaf zrn' })
      recipes.push({ menuItemName: 'Kava z Mlekom Brez Kofeina', ingredientId: invKravjeMleko.id, quantityPerServing: 0.10, unit: 'L', notes: 'Mleko' })
    }

    const cappuccinoBrezKofeina = mi('Cappuccino Brez Kofeina')
    if (cappuccinoBrezKofeina) {
      recipes.push({ menuItemName: 'Cappuccino Brez Kofeina', ingredientId: invKavaBrezKofeina.id, quantityPerServing: 1, unit: 'servings', notes: '7g decaf zrn' })
      recipes.push({ menuItemName: 'Cappuccino Brez Kofeina', ingredientId: invKravjeMleko.id, quantityPerServing: 0.15, unit: 'L', notes: 'Mlečna pena' })
    }

    const macchiatoBrezKofeina = mi('Kava Macchiato Brez Kofeina')
    if (macchiatoBrezKofeina) {
      recipes.push({ menuItemName: 'Kava Macchiato Brez Kofeina', ingredientId: invKavaBrezKofeina.id, quantityPerServing: 1, unit: 'servings', notes: '7g decaf zrn' })
      recipes.push({ menuItemName: 'Kava Macchiato Brez Kofeina', ingredientId: invKravjeMleko.id, quantityPerServing: 0.05, unit: 'L', notes: 'Kapljica mleka' })
    }

    const belaKavaBrezKofeina = mi('Bela Kava Brez Kofeina')
    if (belaKavaBrezKofeina) {
      recipes.push({ menuItemName: 'Bela Kava Brez Kofeina', ingredientId: invKavaBrezKofeina.id, quantityPerServing: 1, unit: 'servings', notes: '7g decaf zrn' })
      recipes.push({ menuItemName: 'Bela Kava Brez Kofeina', ingredientId: invKravjeMleko.id, quantityPerServing: 0.20, unit: 'L', notes: 'Veliko mleka' })
    }

    const kavaRizevoMleko = mi('Kava z Riževim Mlekom')
    if (kavaRizevoMleko) {
      recipes.push({ menuItemName: 'Kava z Riževim Mlekom', ingredientId: invKavaZrna.id, quantityPerServing: 1, unit: 'servings', notes: '7g kavnih zrn' })
      recipes.push({ menuItemName: 'Kava z Riževim Mlekom', ingredientId: invRizevoMleko.id, quantityPerServing: 0.15, unit: 'L', notes: 'Riževo mleko' })
    }

    const kakav = mi('Kakav')
    if (kakav) {
      recipes.push({ menuItemName: 'Kakav', ingredientId: invKakav.id, quantityPerServing: 1, unit: 'servings', notes: '20g kakava' })
      recipes.push({ menuItemName: 'Kakav', ingredientId: invKravjeMleko.id, quantityPerServing: 0.20, unit: 'L', notes: 'Mleko' })
    }

    const kakavSSmetano = mi('Kakav s Smetano')
    if (kakavSSmetano) {
      recipes.push({ menuItemName: 'Kakav s Smetano', ingredientId: invKakav.id, quantityPerServing: 1, unit: 'servings', notes: '20g kakava' })
      recipes.push({ menuItemName: 'Kakav s Smetano', ingredientId: invKravjeMleko.id, quantityPerServing: 0.20, unit: 'L', notes: 'Mleko' })
      recipes.push({ menuItemName: 'Kakav s Smetano', ingredientId: invSmetana.id, quantityPerServing: 0.03, unit: 'L', notes: 'Smetana na vrhu' })
    }

    const babyccino = mi('Babyccino')
    if (babyccino) recipes.push({ menuItemName: 'Babyccino', ingredientId: invKravjeMleko.id, quantityPerServing: 0.10, unit: 'L', notes: 'Samo mlečna pena' })

    const vrocaCokolada = mi('Vroča Čokolada')
    if (vrocaCokolada) {
      recipes.push({ menuItemName: 'Vroča Čokolada', ingredientId: invCokolada.id, quantityPerServing: 1, unit: 'servings', notes: '80g čokolade' })
      recipes.push({ menuItemName: 'Vroča Čokolada', ingredientId: invKravjeMleko.id, quantityPerServing: 0.20, unit: 'L', notes: 'Mleko' })
      recipes.push({ menuItemName: 'Vroča Čokolada', ingredientId: invSmetana.id, quantityPerServing: 0.03, unit: 'L', notes: 'Smetana na vrhu' })
    }

    const cajLimonaMed = mi('Čaj z Limono in Medom')
    if (cajLimonaMed) {
      recipes.push({ menuItemName: 'Čaj z Limono in Medom', ingredientId: invCajVrecice.id, quantityPerServing: 1, unit: 'servings', notes: '1 čajna vrečka' })
      recipes.push({ menuItemName: 'Čaj z Limono in Medom', ingredientId: invLimone.id, quantityPerServing: 1, unit: 'servings', notes: '1 rezina limone' })
      recipes.push({ menuItemName: 'Čaj z Limono in Medom', ingredientId: invMed.id, quantityPerServing: 1, unit: 'servings', notes: '1 žlička medu' })
    }

    const ledenaKavaOlimia = mi('Ledena Kava Olimia')
    if (ledenaKavaOlimia) {
      recipes.push({ menuItemName: 'Ledena Kava Olimia', ingredientId: invKavaZrna.id, quantityPerServing: 2, unit: 'servings', notes: 'Dvojni espresso' })
      recipes.push({ menuItemName: 'Ledena Kava Olimia', ingredientId: invSladoled.id, quantityPerServing: 1, unit: 'servings', notes: '1 žlica vaniljevega sladoleda' })
      recipes.push({ menuItemName: 'Ledena Kava Olimia', ingredientId: invCokolada.id, quantityPerServing: 0.3, unit: 'servings', notes: 'Čokoladni preliv' })
      recipes.push({ menuItemName: 'Ledena Kava Olimia', ingredientId: invSmetana.id, quantityPerServing: 0.03, unit: 'L', notes: 'Smetana' })
    }

    // --- VISKI (enostavno - 1 serving iz steklenice) ---
    const whiskyDrinks: [string, typeof invChivas][] = [
      ['Chivas 12yo', invChivas],
      ['Johnnie Walker Black', invJWBlack],
      ['Jack Daniels', invJackDaniels],
      ['Jameson', invJameson],
      ['Lagavulin 16yo', invLagavulin],
      ['Laphroaig 10yo', invLaphroaig],
      ['Glenmorangie Lasanta 12yo', invGlenmorangieLasanta],
      ['Glenmorangie 18yo', invGlenmorangie18],
      ['Whisky Nikka Miyagikyo', invNikkaMiyagikyo],
      ['Whisky Nikka From the Barrel', invNikkaBarrel],
    ]
    for (const [name, inv] of whiskyDrinks) {
      const item = mi(name)
      if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: 1, unit: 'servings', notes: '0.03L' })
    }

    // --- GIN ---
    const ginDrinks: [string, typeof invGinKristal][] = [
      ['Gin Kristal London Dry', invGinKristal],
      ['Gin Monolog', invGinMonolog],
      ['Gin Hendrick\'s', invHendricks],
      ['Gin Mare', invGinMare],
      ['Gin Tanqueray', invTanqueray],
      ['Gin Monkey 47', invMonkey47],
    ]
    for (const [name, inv] of ginDrinks) {
      const item = mi(name)
      if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: 1, unit: 'servings', notes: '0.03L' })
    }

    // --- LIKERJI ---
    const likerDrinks: [string, typeof invMalibu][] = [
      ['Liker Malibu Rum', invMalibu],
      ['Liker Canella', invCanella],
      ['Liker Rum Bumbu Cream', invBumbuCream],
      ['Liker Carolans', invCarolans],
      ['Liker Medica Kejžar', invMedicaKejzar],
      ['Liker Borovnica Kejžar', invBorovnicaKejzar],
    ]
    for (const [name, inv] of likerDrinks) {
      const item = mi(name)
      if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: 1, unit: 'servings', notes: '0.03L' })
    }

    // --- GRENČICE ---
    const grencDrinks: [string, typeof invPelinkovec][] = [
      ['Pelinkovec Badel Antique', invPelinkovec],
      ['Cynar', invCynar],
      ['Jägermeister', invJagermeister],
      ['Amaro', invAmaro],
      ['Campari Bitter', invCampari],
      ['Aperol', invAperol],
    ]
    for (const [name, inv] of grencDrinks) {
      const item = mi(name)
      if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: 1, unit: 'servings', notes: '0.03L' })
    }

    // --- DESTILATI, KONJAK IN RUM ---
    const destDrinks: [string, typeof invViljamovka][] = [
      ['Viljamovka', invViljamovka],
      ['Slivovka', invSlivovka],
      ['Brinjevec', invBrinjevec],
      ['Grappa Sofija Rebula', invGrappa],
      ['Travarica Rossi', invTravarica],
      ['Hennessy V.S.', invHennessyVS],
      ['Hennessy X.O.', invHennessyXO],
      ['Cognac Delamaine X.O.', invDelamaineXO],
      ['Ararat 6yo', invArarat6],
      ['Ararat 15yo', invArarat15],
      ['Ararat 20yo', invArarat20],
      ['Rum Bumbu Original', invRumBumbu],
      ['Rum Zacapa Solera 23yo', invRumZacapa],
      ['Rum Diplomatico Reserva Exclusiva', invRumDiplomatico],
      ['Rum La Hechicera Reserva Familiar 21yo', invRumHechicera],
    ]
    for (const [name, inv] of destDrinks) {
      const item = mi(name)
      if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: 1, unit: 'servings', notes: '0.03L' })
    }

    // --- MEŠANE PIJAČE (koktajli - kompleksni recepti) ---
    const aperolSpritz = mi('Aperol Spritz')
    if (aperolSpritz) {
      recipes.push({ menuItemName: 'Aperol Spritz', ingredientId: invAperol.id, quantityPerServing: 3, unit: 'servings', notes: '0.09L Aperol' })
      recipes.push({ menuItemName: 'Aperol Spritz', ingredientId: invProsecco.id, quantityPerServing: 1, unit: 'servings', notes: '0.12L Prosecco' })
      recipes.push({ menuItemName: 'Aperol Spritz', ingredientId: invSodaVoda.id, quantityPerServing: 1, unit: 'servings', notes: '0.02L Soda' })
      recipes.push({ menuItemName: 'Aperol Spritz', ingredientId: invPomarance.id, quantityPerServing: 1, unit: 'servings', notes: '1 rezina pomaranče' })
    }

    const martiniSpritz = mi('Martini Spritz')
    if (martiniSpritz) {
      recipes.push({ menuItemName: 'Martini Spritz', ingredientId: invVermut.id, quantityPerServing: 3, unit: 'servings', notes: '0.09L Martini bianco' })
      recipes.push({ menuItemName: 'Martini Spritz', ingredientId: invProsecco.id, quantityPerServing: 1, unit: 'servings', notes: '0.12L Prosecco' })
      recipes.push({ menuItemName: 'Martini Spritz', ingredientId: invSodaVoda.id, quantityPerServing: 1, unit: 'servings', notes: '0.02L Soda' })
      recipes.push({ menuItemName: 'Martini Spritz', ingredientId: invLimete.id, quantityPerServing: 1, unit: 'servings', notes: '1 rezina limete' })
    }

    const negroni = mi('Negroni')
    if (negroni) {
      recipes.push({ menuItemName: 'Negroni', ingredientId: invGinKristal.id, quantityPerServing: 1, unit: 'servings', notes: '0.03L Gin' })
      recipes.push({ menuItemName: 'Negroni', ingredientId: invVermut.id, quantityPerServing: 1, unit: 'servings', notes: '0.03L Vermut' })
      recipes.push({ menuItemName: 'Negroni', ingredientId: invCampari.id, quantityPerServing: 1, unit: 'servings', notes: '0.03L Campari' })
      recipes.push({ menuItemName: 'Negroni', ingredientId: invPomarance.id, quantityPerServing: 1, unit: 'servings', notes: '1 rezina pomaranče' })
    }

    const cubaLibre = mi('Cuba Libre')
    if (cubaLibre) {
      recipes.push({ menuItemName: 'Cuba Libre', ingredientId: invRumHavana.id, quantityPerServing: 2, unit: 'servings', notes: '0.06L Rum' })
      recipes.push({ menuItemName: 'Cuba Libre', ingredientId: invCocaCola.id, quantityPerServing: 1, unit: 'servings', notes: '0.25L Cola' })
      recipes.push({ menuItemName: 'Cuba Libre', ingredientId: invLimete.id, quantityPerServing: 1, unit: 'servings', notes: '1 rezina limete' })
    }

    const mojito = mi('Mojito')
    if (mojito) {
      recipes.push({ menuItemName: 'Mojito', ingredientId: invRumHavana.id, quantityPerServing: 2, unit: 'servings', notes: '0.06L Rum' })
      recipes.push({ menuItemName: 'Mojito', ingredientId: invSodaVoda.id, quantityPerServing: 1, unit: 'servings', notes: '0.15L Soda' })
      recipes.push({ menuItemName: 'Mojito', ingredientId: invSladkor.id, quantityPerServing: 1, unit: 'servings', notes: '1 žlička sladkorja' })
      recipes.push({ menuItemName: 'Mojito', ingredientId: invMeta.id, quantityPerServing: 1, unit: 'servings', notes: 'Meta listi' })
      recipes.push({ menuItemName: 'Mojito', ingredientId: invLimete.id, quantityPerServing: 2, unit: 'servings', notes: '2 rezini limete' })
    }

    const mangoMojito = mi('Mango Mojito')
    if (mangoMojito) {
      recipes.push({ menuItemName: 'Mango Mojito', ingredientId: invRumHavana.id, quantityPerServing: 2, unit: 'servings', notes: '0.06L Rum' })
      recipes.push({ menuItemName: 'Mango Mojito', ingredientId: invSodaVoda.id, quantityPerServing: 1, unit: 'servings', notes: '0.15L Soda' })
      recipes.push({ menuItemName: 'Mango Mojito', ingredientId: invMoninMango.id, quantityPerServing: 1, unit: 'servings', notes: '0.03L Monin Mango' })
      recipes.push({ menuItemName: 'Mango Mojito', ingredientId: invMeta.id, quantityPerServing: 1, unit: 'servings', notes: 'Meta listi' })
      recipes.push({ menuItemName: 'Mango Mojito', ingredientId: invLimete.id, quantityPerServing: 2, unit: 'servings', notes: '2 rezini limete' })
    }

    const strawberryMojito = mi('Strawberry Mojito')
    if (strawberryMojito) {
      recipes.push({ menuItemName: 'Strawberry Mojito', ingredientId: invRumHavana.id, quantityPerServing: 2, unit: 'servings', notes: '0.06L Rum' })
      recipes.push({ menuItemName: 'Strawberry Mojito', ingredientId: invSodaVoda.id, quantityPerServing: 1, unit: 'servings', notes: '0.15L Soda' })
      recipes.push({ menuItemName: 'Strawberry Mojito', ingredientId: invMoninJagoda.id, quantityPerServing: 1, unit: 'servings', notes: '0.03L Monin Strawberry' })
      recipes.push({ menuItemName: 'Strawberry Mojito', ingredientId: invMeta.id, quantityPerServing: 1, unit: 'servings', notes: 'Meta listi' })
      recipes.push({ menuItemName: 'Strawberry Mojito', ingredientId: invLimete.id, quantityPerServing: 2, unit: 'servings', notes: '2 rezini limete' })
    }

    // --- GIN TONICS ---
    const londonDryGT = mi('London Dry Gin Tonic')
    if (londonDryGT) {
      recipes.push({ menuItemName: 'London Dry Gin Tonic', ingredientId: invGinKristal.id, quantityPerServing: 1.5, unit: 'servings', notes: '0.045L Gin' })
      recipes.push({ menuItemName: 'London Dry Gin Tonic', ingredientId: invFeverTreeTonic.id, quantityPerServing: 1, unit: 'servings', notes: '0.20L Tonic' })
      recipes.push({ menuItemName: 'London Dry Gin Tonic', ingredientId: invLimete.id, quantityPerServing: 1, unit: 'servings', notes: '1 rezina limete' })
    }

    const monologGT = mi('Monologue Gin Tonic')
    if (monologGT) {
      recipes.push({ menuItemName: 'Monologue Gin Tonic', ingredientId: invGinMonolog.id, quantityPerServing: 1.5, unit: 'servings', notes: '0.045L Gin' })
      recipes.push({ menuItemName: 'Monologue Gin Tonic', ingredientId: invFeverTreeTonic.id, quantityPerServing: 1, unit: 'servings', notes: '0.20L Tonic' })
      recipes.push({ menuItemName: 'Monologue Gin Tonic', ingredientId: invBrinoveJagode.id, quantityPerServing: 1, unit: 'servings', notes: 'Brinove jagode' })
      recipes.push({ menuItemName: 'Monologue Gin Tonic', ingredientId: invLimete.id, quantityPerServing: 1, unit: 'servings', notes: '1 rezina limete' })
    }

    const hendricksGT = mi('Hendrick\'s Gin Tonic')
    if (hendricksGT) {
      recipes.push({ menuItemName: 'Hendrick\'s Gin Tonic', ingredientId: invHendricks.id, quantityPerServing: 1.5, unit: 'servings', notes: '0.045L Gin' })
      recipes.push({ menuItemName: 'Hendrick\'s Gin Tonic', ingredientId: invFeverTreeTonic.id, quantityPerServing: 1, unit: 'servings', notes: '0.20L Tonic' })
      recipes.push({ menuItemName: 'Hendrick\'s Gin Tonic', ingredientId: invKumara.id, quantityPerServing: 1, unit: 'servings', notes: 'Rezina kumare' })
    }

    const ginMareTonic = mi('Gin Mare Tonic')
    if (ginMareTonic) {
      recipes.push({ menuItemName: 'Gin Mare Tonic', ingredientId: invGinMare.id, quantityPerServing: 1.5, unit: 'servings', notes: '0.045L Gin' })
      recipes.push({ menuItemName: 'Gin Mare Tonic', ingredientId: invFeverTreeMedTonic.id, quantityPerServing: 1, unit: 'servings', notes: '0.20L Mediterranean tonik' })
      recipes.push({ menuItemName: 'Gin Mare Tonic', ingredientId: invLimete.id, quantityPerServing: 1, unit: 'servings', notes: '1 rezina limete' })
      recipes.push({ menuItemName: 'Gin Mare Tonic', ingredientId: invRozmarin.id, quantityPerServing: 1, unit: 'servings', notes: 'Vejica rožmarina' })
    }

    const monkey47GT = mi('Monkey 47 Gin Tonic')
    if (monkey47GT) {
      recipes.push({ menuItemName: 'Monkey 47 Gin Tonic', ingredientId: invMonkey47.id, quantityPerServing: 1.5, unit: 'servings', notes: '0.045L Gin' })
      recipes.push({ menuItemName: 'Monkey 47 Gin Tonic', ingredientId: invFeverTreeTonic.id, quantityPerServing: 1, unit: 'servings', notes: '0.20L Tonic' })
      recipes.push({ menuItemName: 'Monkey 47 Gin Tonic', ingredientId: invBrinoveJagode.id, quantityPerServing: 1, unit: 'servings', notes: 'Brinove jagode' })
      recipes.push({ menuItemName: 'Monkey 47 Gin Tonic', ingredientId: invRozmarin.id, quantityPerServing: 1, unit: 'servings', notes: 'Vejica rožmarina' })
      recipes.push({ menuItemName: 'Monkey 47 Gin Tonic', ingredientId: invLimone.id, quantityPerServing: 1, unit: 'servings', notes: '1 rezina limone' })
    }

    const orangeGingerGT = mi('Orange & Ginger Gin Tonic')
    if (orangeGingerGT) {
      recipes.push({ menuItemName: 'Orange & Ginger Gin Tonic', ingredientId: invGinKristalOrange.id, quantityPerServing: 1.5, unit: 'servings', notes: '0.045L Gin' })
      recipes.push({ menuItemName: 'Orange & Ginger Gin Tonic', ingredientId: invGingerAle.id, quantityPerServing: 1, unit: 'servings', notes: '0.20L Ginger Ale' })
      recipes.push({ menuItemName: 'Orange & Ginger Gin Tonic', ingredientId: invPomarance.id, quantityPerServing: 1, unit: 'servings', notes: '1 rezina pomaranče' })
    }

    const raspberryGT = mi('Raspberry Pink Gin Tonic')
    if (raspberryGT) {
      recipes.push({ menuItemName: 'Raspberry Pink Gin Tonic', ingredientId: invGinKristalRaspberry.id, quantityPerServing: 1.5, unit: 'servings', notes: '0.045L Gin' })
      recipes.push({ menuItemName: 'Raspberry Pink Gin Tonic', ingredientId: invFeverTreeRhubarb.id, quantityPerServing: 1, unit: 'servings', notes: '0.20L Rhubarb&Raspberry tonik' })
      recipes.push({ menuItemName: 'Raspberry Pink Gin Tonic', ingredientId: invMeta.id, quantityPerServing: 1, unit: 'servings', notes: 'Meta listi' })
    }


  return recipes
}
