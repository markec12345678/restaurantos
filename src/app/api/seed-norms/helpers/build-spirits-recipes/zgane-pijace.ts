// =====================================================================
// GRADNJA RECEPTOV - Žgane pijače (viski, gin, likerji, grenčice, destilati)
// =====================================================================

import type { InvItem, MiFn, RecipeEntry } from '../types'

export function buildZganePijaceRecipes(
  inv: Record<string, InvItem>,
  mi: MiFn
): RecipeEntry[] {
  const {
    invAmaro,
    invAperol,
    invArarat15,
    invArarat20,
    invArarat6,
    invBorovnicaKejzar,
    invBrinjevec,
    invBumbuCream,
    invCanella,
    invCarolans,
    invChivas,
    invCynar,
    invDelamaineXO,
    invGinKristal,
    invGinKristalOrange,
    invGinKristalRaspberry,
    invGinMare,
    invGinMonolog,
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
    invLagavulin,
    invLaphroaig,
    invMalibu,
    invMedicaKejzar,
    invMonkey47,
    invNikkaBarrel,
    invNikkaMiyagikyo,
    invPelinkovec,
    invRumBumbu,
    invRumDiplomatico,
    invRumHavana,
    invRumHechicera,
    invRumZacapa,
    invSlivovka,
    invTanqueray,
    invTravarica,
    invViljamovka,
    invCampari,
  } = inv

  const recipes: RecipeEntry[] = []

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

  return recipes
}
