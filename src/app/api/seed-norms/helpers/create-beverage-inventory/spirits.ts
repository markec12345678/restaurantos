// Žgane pijače: viski, gin, likerji, grenčice, destilati, konjak, rum, vermut
import { db } from '@/lib/db'
import type { InvItem } from '../types'

export async function createSpirits(): Promise<Record<string, InvItem>> {
    // --- VISKI (0.70L steklenice, 0.03L na serving = ~23 servings) ---
    const invChivas = await db.inventoryItem.create({ data: { name: 'Chivas 12yo (0.70L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 35.00, supplier: 'Pernod Ricard', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 1.52 } })
    const invJWBlack = await db.inventoryItem.create({ data: { name: 'Johnnie Walker Black (0.70L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 42.00, supplier: 'Diageo', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 1.83 } })
    const invJackDaniels = await db.inventoryItem.create({ data: { name: 'Jack Daniels (0.70L)', unit: 'steklenica', quantity: 4, minQuantity: 1, costPerUnit: 30.00, supplier: 'Brown-Forman', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 1.30 } })
    const invJameson = await db.inventoryItem.create({ data: { name: 'Jameson (0.70L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 28.00, supplier: 'Pernod Ricard', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 1.22 } })
    const invLagavulin = await db.inventoryItem.create({ data: { name: 'Lagavulin 16yo (0.70L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 85.00, supplier: 'Diageo', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 3.70 } })
    const invLaphroaig = await db.inventoryItem.create({ data: { name: 'Laphroaig 10yo (0.70L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 65.00, supplier: 'Beam Suntory', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 2.83 } })
    const invGlenmorangieLasanta = await db.inventoryItem.create({ data: { name: 'Glenmorangie Lasanta 12yo (0.70L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 55.00, supplier: 'Moet Hennessy', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 2.39 } })
    const invGlenmorangie18 = await db.inventoryItem.create({ data: { name: 'Glenmorangie 18yo (0.70L)', unit: 'steklenica', quantity: 1, minQuantity: 1, costPerUnit: 110.00, supplier: 'Moet Hennessy', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 4.78 } })
    const invNikkaMiyagikyo = await db.inventoryItem.create({ data: { name: 'Nikka Miyagikyo (0.70L)', unit: 'steklenica', quantity: 1, minQuantity: 1, costPerUnit: 80.00, supplier: 'Nikka', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 3.48 } })
    const invNikkaBarrel = await db.inventoryItem.create({ data: { name: 'Nikka From the Barrel (0.50L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 55.00, supplier: 'Nikka', category: 'spirits', servingsPerUnit: 16, servingSize: '0.03L', costPerServing: 3.44 } })

    // --- GIN (0.70L steklenice, 0.03L na serving = ~23 servings) ---
    const invGinKristal = await db.inventoryItem.create({ data: { name: 'Gin Kristal London Dry (0.70L)', unit: 'steklenica', quantity: 4, minQuantity: 1, costPerUnit: 22.00, supplier: 'Kristal', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 0.96 } })
    const invGinMonolog = await db.inventoryItem.create({ data: { name: 'Gin Monolog (0.70L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 25.00, supplier: 'Monolog', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 1.09 } })
    const invHendricks = await db.inventoryItem.create({ data: { name: 'Hendrick\'s Gin (0.70L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 40.00, supplier: 'William Grant', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 1.74 } })
    const invGinMare = await db.inventoryItem.create({ data: { name: 'Gin Mare (0.70L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 42.00, supplier: 'Gin Mare', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 1.83 } })
    const invTanqueray = await db.inventoryItem.create({ data: { name: 'Tanqueray London Dry (0.70L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 25.00, supplier: 'Diageo', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 1.09 } })
    const invMonkey47 = await db.inventoryItem.create({ data: { name: 'Monkey 47 (0.50L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 45.00, supplier: 'Black Forest', category: 'spirits', servingsPerUnit: 16, servingSize: '0.03L', costPerServing: 2.81 } })
    const invGinKristalOrange = await db.inventoryItem.create({ data: { name: 'Gin Kristal Orange&Ginger (0.70L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 24.00, supplier: 'Kristal', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 1.04 } })
    const invGinKristalRaspberry = await db.inventoryItem.create({ data: { name: 'Gin Kristal Raspberry (0.70L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 24.00, supplier: 'Kristal', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 1.04 } })

    // --- LIKERJI (0.70L, 0.03L serving) ---
    const invMalibu = await db.inventoryItem.create({ data: { name: 'Malibu Rum (0.70L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 18.00, supplier: 'Pernod Ricard', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 0.78 } })
    const invCanella = await db.inventoryItem.create({ data: { name: 'Canella (0.70L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 22.00, supplier: 'Canella', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 0.96 } })
    const invBumbuCream = await db.inventoryItem.create({ data: { name: 'Bumbu Cream (0.70L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 24.00, supplier: 'Bumbu', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 1.04 } })
    const invCarolans = await db.inventoryItem.create({ data: { name: 'Carolans (0.70L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 18.00, supplier: 'Tullamore Dew', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 0.78 } })
    const invMedicaKejzar = await db.inventoryItem.create({ data: { name: 'Medica Kejžar (0.50L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 14.00, supplier: 'Kejžar', category: 'spirits', servingsPerUnit: 16, servingSize: '0.03L', costPerServing: 0.88 } })
    const invBorovnicaKejzar = await db.inventoryItem.create({ data: { name: 'Borovnica Kejžar (0.50L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 14.00, supplier: 'Kejžar', category: 'spirits', servingsPerUnit: 16, servingSize: '0.03L', costPerServing: 0.88 } })
    const invBaileys = await db.inventoryItem.create({ data: { name: 'Baileys (0.70L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 22.00, supplier: 'Diageo', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 0.96 } })
    const invAmaretto = await db.inventoryItem.create({ data: { name: 'Amaretto Disaronno (0.70L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 24.00, supplier: 'Disaronno', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 1.04 } })
    const invKahlua = await db.inventoryItem.create({ data: { name: 'Kahlua (0.70L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 22.00, supplier: 'Pernod Ricard', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 0.96 } })

    // --- GRENČICE (0.70L, 0.03L serving) ---
    const invPelinkovec = await db.inventoryItem.create({ data: { name: 'Pelinkovec Badel Antique (0.70L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 18.00, supplier: 'Badel', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 0.78 } })
    const invCynar = await db.inventoryItem.create({ data: { name: 'Cynar (0.70L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 16.00, supplier: 'Campari Group', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 0.70 } })
    const invJagermeister = await db.inventoryItem.create({ data: { name: 'Jägermeister (0.70L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 20.00, supplier: 'Mast-Jägermeister', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 0.87 } })
    const invAmaro = await db.inventoryItem.create({ data: { name: 'Amaro Montenegro (0.70L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 18.00, supplier: 'Montenegro', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 0.78 } })
    const invCampari = await db.inventoryItem.create({ data: { name: 'Campari Bitter (0.70L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 22.00, supplier: 'Campari Group', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 0.96 } })
    const invAperol = await db.inventoryItem.create({ data: { name: 'Aperol (0.70L)', unit: 'steklenica', quantity: 4, minQuantity: 2, costPerUnit: 18.00, supplier: 'Campari Group', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 0.78 } })

    // --- DESTILATI, KONJAK IN RUM (0.50L/0.70L, 0.03L serving) ---
    const invViljamovka = await db.inventoryItem.create({ data: { name: 'Viljamovka (0.50L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 18.00, supplier: 'Klet', category: 'spirits', servingsPerUnit: 16, servingSize: '0.03L', costPerServing: 1.13 } })
    const invSlivovka = await db.inventoryItem.create({ data: { name: 'Slivovka (0.50L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 20.00, supplier: 'Klet', category: 'spirits', servingsPerUnit: 16, servingSize: '0.03L', costPerServing: 1.25 } })
    const invBrinjevec = await db.inventoryItem.create({ data: { name: 'Brinjevec (0.50L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 20.00, supplier: 'Klet', category: 'spirits', servingsPerUnit: 16, servingSize: '0.03L', costPerServing: 1.25 } })
    const invGrappa = await db.inventoryItem.create({ data: { name: 'Grappa Sofija Rebula (0.50L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 22.00, supplier: 'Jakončič', category: 'spirits', servingsPerUnit: 16, servingSize: '0.03L', costPerServing: 1.38 } })
    const invTravarica = await db.inventoryItem.create({ data: { name: 'Travarica Rossi (0.50L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 16.00, supplier: 'Rossi', category: 'spirits', servingsPerUnit: 16, servingSize: '0.03L', costPerServing: 1.00 } })
    const invHennessyVS = await db.inventoryItem.create({ data: { name: 'Hennessy V.S. (0.70L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 40.00, supplier: 'Moet Hennessy', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 1.74 } })
    const invHennessyXO = await db.inventoryItem.create({ data: { name: 'Hennessy X.O. (0.70L)', unit: 'steklenica', quantity: 1, minQuantity: 1, costPerUnit: 180.00, supplier: 'Moet Hennessy', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 7.83 } })
    const invDelamaineXO = await db.inventoryItem.create({ data: { name: 'Delamaine X.O. (0.70L)', unit: 'steklenica', quantity: 1, minQuantity: 1, costPerUnit: 175.00, supplier: 'Delamaine', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 7.61 } })
    const invArarat6 = await db.inventoryItem.create({ data: { name: 'Ararat 6yo (0.50L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 20.00, supplier: 'Yerevan Brandy', category: 'spirits', servingsPerUnit: 16, servingSize: '0.03L', costPerServing: 1.25 } })
    const invArarat15 = await db.inventoryItem.create({ data: { name: 'Ararat 15yo (0.50L)', unit: 'steklenica', quantity: 1, minQuantity: 1, costPerUnit: 55.00, supplier: 'Yerevan Brandy', category: 'spirits', servingsPerUnit: 16, servingSize: '0.03L', costPerServing: 3.44 } })
    const invArarat20 = await db.inventoryItem.create({ data: { name: 'Ararat 20yo (0.50L)', unit: 'steklenica', quantity: 1, minQuantity: 1, costPerUnit: 85.00, supplier: 'Yerevan Brandy', category: 'spirits', servingsPerUnit: 16, servingSize: '0.03L', costPerServing: 5.31 } })
    const invRumBumbu = await db.inventoryItem.create({ data: { name: 'Rum Bumbu Original (0.70L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 30.00, supplier: 'Bumbu', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 1.30 } })
    const invRumZacapa = await db.inventoryItem.create({ data: { name: 'Rum Zacapa 23yo (0.70L)', unit: 'steklenica', quantity: 1, minQuantity: 1, costPerUnit: 75.00, supplier: 'Zacapa', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 3.26 } })
    const invRumDiplomatico = await db.inventoryItem.create({ data: { name: 'Rum Diplomatico Reserva (0.70L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 38.00, supplier: 'Diplomatico', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 1.65 } })
    const invRumHechicera = await db.inventoryItem.create({ data: { name: 'Rum La Hechicera 21yo (0.70L)', unit: 'steklenica', quantity: 1, minQuantity: 1, costPerUnit: 50.00, supplier: 'Hechicera', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 2.17 } })
    const invRumHavana = await db.inventoryItem.create({ data: { name: 'Rum Havana Club 3yo (0.70L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 20.00, supplier: 'Pernod Ricard', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 0.87 } })
    const invVermut = await db.inventoryItem.create({ data: { name: 'Vermut Martini Bianco (0.70L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 15.00, supplier: 'Martini', category: 'spirits', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 0.65 } })

    return {
      invChivas, invJWBlack, invJackDaniels, invJameson, invLagavulin, invLaphroaig,
      invGlenmorangieLasanta, invGlenmorangie18, invNikkaMiyagikyo, invNikkaBarrel,
      invGinKristal, invGinMonolog, invHendricks, invGinMare, invTanqueray, invMonkey47,
      invGinKristalOrange, invGinKristalRaspberry,
      invMalibu, invCanella, invBumbuCream, invCarolans, invMedicaKejzar, invBorovnicaKejzar,
      invBaileys, invAmaretto, invKahlua,
      invPelinkovec, invCynar, invJagermeister, invAmaro, invCampari, invAperol,
      invViljamovka, invSlivovka, invBrinjevec, invGrappa, invTravarica,
      invHennessyVS, invHennessyXO, invDelamaineXO,
      invArarat6, invArarat15, invArarat20,
      invRumBumbu, invRumZacapa, invRumDiplomatico, invRumHechicera, invRumHavana, invVermut,
    }
}
