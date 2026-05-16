import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'

// =====================================================================
// SEED NORMATIVOV - Inventarne postavke + Recepti za pijače
// =====================================================================
// Ta endpoint doda obsežen inventar sestavin pijač in recepture (normative)
// za vse standardne pijace v barih, restavracijah in lokalih.
// Uporabnik mora samo vnesti svoje količine zaloge in lahko začne delati.
// =====================================================================

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    // Pobriši stare inventarne postavke in recepte
    await db.recipeItem.deleteMany()
    await db.inventoryItem.deleteMany()

    // Pridobi vse menu iteme za mapiranje po imenu
    const menuItems = await db.menuItem.findMany()
    const menuByName = new Map<string, typeof menuItems[0]>()
    for (const mi of menuItems) {
      menuByName.set(mi.name, mi)
    }

    // Helper funkcija
    const mi = (name: string) => menuByName.get(name)

    // =====================================================================
    // 1. INVENTARNE POSTAVKE - Sestavine pijač z servingsPerUnit
    // =====================================================================

    // --- KAVA IN TOPLI NAPITKI ---
    const invKavaZrna = await db.inventoryItem.create({ data: { name: 'Kavna zrna (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 25.00, supplier: 'Kavarna Roast', category: 'beverages', servingsPerUnit: 120, servingSize: '7g', costPerServing: 0.21 } })
    const invKavaBrezKofeina = await db.inventoryItem.create({ data: { name: 'Kava brez kofeina (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 30.00, supplier: 'Kavarna Roast', category: 'beverages', servingsPerUnit: 120, servingSize: '7g', costPerServing: 0.25 } })
    const invKravjeMleko = await db.inventoryItem.create({ data: { name: 'Kravje mleko (1L)', unit: 'L', quantity: 20, minQuantity: 5, costPerUnit: 1.20, supplier: 'Ljubljanske mlekarne', category: 'dairy', servingsPerUnit: 5, servingSize: '0.20L', costPerServing: 0.24 } })
    const invOvsenoMleko = await db.inventoryItem.create({ data: { name: 'Ovseno mleko (1L)', unit: 'L', quantity: 5, minQuantity: 2, costPerUnit: 2.50, supplier: 'Oatly', category: 'dairy', servingsPerUnit: 5, servingSize: '0.20L', costPerServing: 0.50 } })
    const invMandljevoMleko = await db.inventoryItem.create({ data: { name: 'Mandljevo mleko (1L)', unit: 'L', quantity: 3, minQuantity: 1, costPerUnit: 3.00, supplier: 'Alpro', category: 'dairy', servingsPerUnit: 5, servingSize: '0.20L', costPerServing: 0.60 } })
    const invSojinoMleko = await db.inventoryItem.create({ data: { name: 'Sojino mleko (1L)', unit: 'L', quantity: 3, minQuantity: 1, costPerUnit: 2.20, supplier: 'Alpro', category: 'dairy', servingsPerUnit: 5, servingSize: '0.20L', costPerServing: 0.44 } })
    const invRizevoMleko = await db.inventoryItem.create({ data: { name: 'Riževo mleko (1L)', unit: 'L', quantity: 2, minQuantity: 1, costPerUnit: 2.80, supplier: 'Rice Dream', category: 'dairy', servingsPerUnit: 5, servingSize: '0.20L', costPerServing: 0.56 } })
    const invSmetana = await db.inventoryItem.create({ data: { name: 'Sladka smetana (1L)', unit: 'L', quantity: 5, minQuantity: 2, costPerUnit: 3.50, supplier: 'Ljubljanske mlekarne', category: 'dairy', servingsPerUnit: 20, servingSize: '0.05L', costPerServing: 0.18 } })
    const invSladkor = await db.inventoryItem.create({ data: { name: 'Sladkor (1kg)', unit: 'kg', quantity: 10, minQuantity: 3, costPerUnit: 1.50, supplier: 'Dobavitelj', category: 'dry-goods', servingsPerUnit: 200, servingSize: '5g', costPerServing: 0.01 } })
    const invMed = await db.inventoryItem.create({ data: { name: 'Med (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 10.00, supplier: 'Kmetija Med', category: 'dry-goods', servingsPerUnit: 100, servingSize: '10g', costPerServing: 0.10 } })
    const invKakav = await db.inventoryItem.create({ data: { name: 'Kakav v prahu (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 12.00, supplier: 'Dobavitelj', category: 'dry-goods', servingsPerUnit: 50, servingSize: '20g', costPerServing: 0.24 } })
    const invCokolada = await db.inventoryItem.create({ data: { name: 'Čokolada za vročo čokolado (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 15.00, supplier: 'Gorenjka', category: 'dry-goods', servingsPerUnit: 12, servingSize: '80g', costPerServing: 1.25 } })
    const invCajVrecice = await db.inventoryItem.create({ data: { name: 'Čajne vrečke (100kos)', unit: 'kos', quantity: 5, minQuantity: 2, costPerUnit: 8.00, supplier: 'Čajarna', category: 'beverages', servingsPerUnit: 100, servingSize: '1 vrečka', costPerServing: 0.08 } })
    const invSladoled = await db.inventoryItem.create({ data: { name: 'Vaniljev sladoled (1L)', unit: 'L', quantity: 3, minQuantity: 1, costPerUnit: 6.00, supplier: 'Ljubljanske mlekarne', category: 'dairy', servingsPerUnit: 10, servingSize: '0.10L', costPerServing: 0.60 } })

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

    // --- MIKSERJI (tonik, soda, cola, itd.) ---
    const invTonicWater = await db.inventoryItem.create({ data: { name: 'Schweppes Tonic Water (0.25L)', unit: 'kos', quantity: 48, minQuantity: 12, costPerUnit: 1.10, supplier: 'Coca-Cola CPC', category: 'mixers', servingsPerUnit: 1, servingSize: '0.25L', costPerServing: 1.10 } })
    const invFeverTreeTonic = await db.inventoryItem.create({ data: { name: 'Fever Tree Tonic Water (0.20L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 1.80, supplier: 'Fever Tree', category: 'mixers', servingsPerUnit: 1, servingSize: '0.20L', costPerServing: 1.80 } })
    const invFeverTreeMedTonic = await db.inventoryItem.create({ data: { name: 'Fever Tree Mediterranean Tonic (0.20L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 1.80, supplier: 'Fever Tree', category: 'mixers', servingsPerUnit: 1, servingSize: '0.20L', costPerServing: 1.80 } })
    const invFeverTreeRhubarb = await db.inventoryItem.create({ data: { name: 'Fever Tree Rhubarb&Raspberry Tonic (0.20L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 1.80, supplier: 'Fever Tree', category: 'mixers', servingsPerUnit: 1, servingSize: '0.20L', costPerServing: 1.80 } })
    const invGingerAle = await db.inventoryItem.create({ data: { name: 'Fever Tree Ginger Ale (0.20L)', unit: 'kos', quantity: 12, minQuantity: 4, costPerUnit: 1.80, supplier: 'Fever Tree', category: 'mixers', servingsPerUnit: 1, servingSize: '0.20L', costPerServing: 1.80 } })
    const invSodaVoda = await db.inventoryItem.create({ data: { name: 'Soda voda (0.20L)', unit: 'kos', quantity: 48, minQuantity: 12, costPerUnit: 0.50, supplier: 'Radenska', category: 'mixers', servingsPerUnit: 1, servingSize: '0.20L', costPerServing: 0.50 } })
    const invCocaCola = await db.inventoryItem.create({ data: { name: 'Coca-Cola (0.25L)', unit: 'kos', quantity: 72, minQuantity: 24, costPerUnit: 1.20, supplier: 'Coca-Cola CPC', category: 'mixers', servingsPerUnit: 1, servingSize: '0.25L', costPerServing: 1.20 } })
    const invCocaColaZero = await db.inventoryItem.create({ data: { name: 'Coca-Cola Zero (0.25L)', unit: 'kos', quantity: 48, minQuantity: 12, costPerUnit: 1.20, supplier: 'Coca-Cola CPC', category: 'mixers', servingsPerUnit: 1, servingSize: '0.25L', costPerServing: 1.20 } })
    const invFanta = await db.inventoryItem.create({ data: { name: 'Fanta (0.25L)', unit: 'kos', quantity: 48, minQuantity: 12, costPerUnit: 1.10, supplier: 'Coca-Cola CPC', category: 'mixers', servingsPerUnit: 1, servingSize: '0.25L', costPerServing: 1.10 } })
    const invSprite = await db.inventoryItem.create({ data: { name: 'Sprite (0.25L)', unit: 'kos', quantity: 48, minQuantity: 12, costPerUnit: 1.10, supplier: 'Coca-Cola CPC', category: 'mixers', servingsPerUnit: 1, servingSize: '0.25L', costPerServing: 1.10 } })
    const invCockta = await db.inventoryItem.create({ data: { name: 'Cockta (0.275L)', unit: 'kos', quantity: 36, minQuantity: 12, costPerUnit: 1.00, supplier: 'Cockta', category: 'mixers', servingsPerUnit: 1, servingSize: '0.275L', costPerServing: 1.00 } })
    const invSchweppesBitter = await db.inventoryItem.create({ data: { name: 'Schweppes Bitter Lemon (0.25L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 1.10, supplier: 'Coca-Cola CPC', category: 'mixers', servingsPerUnit: 1, servingSize: '0.25L', costPerServing: 1.10 } })
    const invRedBull = await db.inventoryItem.create({ data: { name: 'Red Bull (0.20L)', unit: 'kos', quantity: 48, minQuantity: 12, costPerUnit: 2.20, supplier: 'Red Bull', category: 'mixers', servingsPerUnit: 1, servingSize: '0.20L', costPerServing: 2.20 } })
    const invProsecco = await db.inventoryItem.create({ data: { name: 'Prosecco za koktajle (0.75L)', unit: 'steklenica', quantity: 6, minQuantity: 2, costPerUnit: 10.00, supplier: 'Vinoteka', category: 'beverages', servingsPerUnit: 6, servingSize: '0.12L', costPerServing: 1.67 } })

    // --- SADJE ZA GARNIRJE IN SOKOVE ---
    const invLimone = await db.inventoryItem.create({ data: { name: 'Limone (1kg)', unit: 'kg', quantity: 6, minQuantity: 2, costPerUnit: 3.00, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 30, servingSize: '1 rezina', costPerServing: 0.10 } })
    const invLimete = await db.inventoryItem.create({ data: { name: 'Limete (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 5.00, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 30, servingSize: '1 rezina', costPerServing: 0.17 } })
    const invPomarance = await db.inventoryItem.create({ data: { name: 'Pomaranče (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 2.50, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 8, servingSize: '1 pomaranča', costPerServing: 0.31 } })
    const invMeta = await db.inventoryItem.create({ data: { name: 'Sveža meta (šen)', unit: 'šen', quantity: 3, minQuantity: 1, costPerUnit: 2.00, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 20, servingSize: '1 vejica', costPerServing: 0.10 } })
    const invRozmarin = await db.inventoryItem.create({ data: { name: 'Svež rožmarin (šen)', unit: 'šen', quantity: 2, minQuantity: 1, costPerUnit: 2.50, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 15, servingSize: '1 vejica', costPerServing: 0.17 } })
    const invBrinoveJagode = await db.inventoryItem.create({ data: { name: 'Brinove jagode (0.1kg)', unit: 'kg', quantity: 0.3, minQuantity: 0.1, costPerUnit: 25.00, supplier: 'Zeliščar', category: 'produce', servingsPerUnit: 30, servingSize: '3 jagode', costPerServing: 0.83 } })
    const invKumara = await db.inventoryItem.create({ data: { name: 'Kumara (1kos)', unit: 'kos', quantity: 5, minQuantity: 2, costPerUnit: 1.00, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 20, servingSize: '1 rezina', costPerServing: 0.05 } })

    // --- MONIN SIRUPI ZA KOKTAJLE ---
    const invMoninMango = await db.inventoryItem.create({ data: { name: 'Monin Mango sirup (0.70L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 12.00, supplier: 'Monin', category: 'syrups', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 0.52 } })
    const invMoninJagoda = await db.inventoryItem.create({ data: { name: 'Monin Strawberry sirup (0.70L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 12.00, supplier: 'Monin', category: 'syrups', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 0.52 } })
    const invMoninBezeg = await db.inventoryItem.create({ data: { name: 'Monin Bezgovi sirup (0.70L)', unit: 'steklenica', quantity: 1, minQuantity: 1, costPerUnit: 12.00, supplier: 'Monin', category: 'syrups', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 0.52 } })
    const invMoninIngver = await db.inventoryItem.create({ data: { name: 'Monin Ginger sirup (0.70L)', unit: 'steklenica', quantity: 1, minQuantity: 1, costPerUnit: 12.00, supplier: 'Monin', category: 'syrups', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 0.52 } })

    // --- VODE ---
    const invMineralnaVoda025 = await db.inventoryItem.create({ data: { name: 'Mineralna voda (0.25L)', unit: 'kos', quantity: 48, minQuantity: 12, costPerUnit: 0.60, supplier: 'Radenska', category: 'beverages', servingsPerUnit: 1, servingSize: '0.25L', costPerServing: 0.60 } })
    const invMineralnaVoda050 = await db.inventoryItem.create({ data: { name: 'Mineralna voda (0.50L)', unit: 'kos', quantity: 36, minQuantity: 12, costPerUnit: 0.90, supplier: 'Radenska', category: 'beverages', servingsPerUnit: 1, servingSize: '0.50L', costPerServing: 0.90 } })
    const invMineralnaVoda100 = await db.inventoryItem.create({ data: { name: 'Mineralna voda (1.00L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 1.30, supplier: 'Radenska', category: 'beverages', servingsPerUnit: 1, servingSize: '1.00L', costPerServing: 1.30 } })
    const invNaravnaVoda025 = await db.inventoryItem.create({ data: { name: 'Naravna voda (0.25L)', unit: 'kos', quantity: 48, minQuantity: 12, costPerUnit: 0.40, supplier: 'Costella', category: 'beverages', servingsPerUnit: 1, servingSize: '0.25L', costPerServing: 0.40 } })
    const invNaravnaVoda050 = await db.inventoryItem.create({ data: { name: 'Naravna voda (0.50L)', unit: 'kos', quantity: 36, minQuantity: 12, costPerUnit: 0.60, supplier: 'Costella', category: 'beverages', servingsPerUnit: 1, servingSize: '0.50L', costPerServing: 0.60 } })
    const invNaravnaVoda100 = await db.inventoryItem.create({ data: { name: 'Naravna voda (1.00L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 0.90, supplier: 'Costella', category: 'beverages', servingsPerUnit: 1, servingSize: '1.00L', costPerServing: 0.90 } })
    const invVodaZOkusom = await db.inventoryItem.create({ data: { name: 'Voda z okusom (0.50L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 1.00, supplier: 'Radenska', category: 'beverages', servingsPerUnit: 1, servingSize: '0.50L', costPerServing: 1.00 } })
    const invRadenskaFunc = await db.inventoryItem.create({ data: { name: 'Radenska FunctionALL (0.50L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 1.20, supplier: 'Radenska', category: 'beverages', servingsPerUnit: 1, servingSize: '0.50L', costPerServing: 1.20 } })

    // --- SOKOVI ---
    const invMarelicniSok = await db.inventoryItem.create({ data: { name: 'Marelični sok (0.20L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 1.20, supplier: 'Fructal', category: 'beverages', servingsPerUnit: 1, servingSize: '0.20L', costPerServing: 1.20 } })
    const invJabolcniSok = await db.inventoryItem.create({ data: { name: 'Jabolčni sok 100% (0.20L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 1.40, supplier: 'Fructal', category: 'beverages', servingsPerUnit: 1, servingSize: '0.20L', costPerServing: 1.40 } })
    const invRibezovSok = await db.inventoryItem.create({ data: { name: 'Ribezov sok (0.20L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 1.20, supplier: 'Fructal', category: 'beverages', servingsPerUnit: 1, servingSize: '0.20L', costPerServing: 1.20 } })
    const invAnanasovSok = await db.inventoryItem.create({ data: { name: 'Ananasov sok (0.20L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 1.20, supplier: 'Fructal', category: 'beverages', servingsPerUnit: 1, servingSize: '0.20L', costPerServing: 1.20 } })
    const invPomarancniSok = await db.inventoryItem.create({ data: { name: 'Pomarančni sok (0.20L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 1.20, supplier: 'Fructal', category: 'beverages', servingsPerUnit: 1, servingSize: '0.20L', costPerServing: 1.20 } })
    const invJagodniSok = await db.inventoryItem.create({ data: { name: 'Jagodni sok (0.20L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 1.20, supplier: 'Fructal', category: 'beverages', servingsPerUnit: 1, servingSize: '0.20L', costPerServing: 1.20 } })
    const invLedeniCaj = await db.inventoryItem.create({ data: { name: 'Ledeni čaj (0.25L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 1.10, supplier: 'Fructal', category: 'beverages', servingsPerUnit: 1, servingSize: '0.25L', costPerServing: 1.10 } })
    const invCedevita = await db.inventoryItem.create({ data: { name: 'Cedevita (0.30L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 1.00, supplier: 'Cedevita', category: 'beverages', servingsPerUnit: 1, servingSize: '0.30L', costPerServing: 1.00 } })
    const invBubbleTea = await db.inventoryItem.create({ data: { name: 'Bubble Tea kit (0.36L)', unit: 'kos', quantity: 12, minQuantity: 4, costPerUnit: 2.50, supplier: 'Bubble Tea', category: 'beverages', servingsPerUnit: 1, servingSize: '0.36L', costPerServing: 2.50 } })

    // --- TOČENO PIVO (keg) ---
    const invHalerKeg = await db.inventoryItem.create({ data: { name: 'Haler Lager keg (30L)', unit: 'keg', quantity: 2, minQuantity: 1, costPerUnit: 75.00, supplier: 'Haler', category: 'beverages', servingsPerUnit: 60, servingSize: '0.50L', costPerServing: 1.25 } })
    const invLaskoKeg = await db.inventoryItem.create({ data: { name: 'Laško Lager keg (30L)', unit: 'keg', quantity: 3, minQuantity: 1, costPerUnit: 85.00, supplier: 'Laško', category: 'beverages', servingsPerUnit: 60, servingSize: '0.50L', costPerServing: 1.42 } })
    const invUnionKeg = await db.inventoryItem.create({ data: { name: 'Union Lager keg (30L)', unit: 'keg', quantity: 2, minQuantity: 1, costPerUnit: 80.00, supplier: 'Union', category: 'beverages', servingsPerUnit: 60, servingSize: '0.50L', costPerServing: 1.33 } })
    const invPeliconIPAKeg = await db.inventoryItem.create({ data: { name: 'Pelicon IPA keg (20L)', unit: 'keg', quantity: 1, minQuantity: 1, costPerUnit: 90.00, supplier: 'Pelicon', category: 'beverages', servingsPerUnit: 40, servingSize: '0.50L', costPerServing: 2.25 } })
    const invRadlerKeg = await db.inventoryItem.create({ data: { name: 'Radler Grenivka keg (30L)', unit: 'keg', quantity: 1, minQuantity: 1, costPerUnit: 80.00, supplier: 'Union', category: 'beverages', servingsPerUnit: 60, servingSize: '0.50L', costPerServing: 1.33 } })

    // --- PIVO V STEKLENICAH ---
    const invResetLagerish = await db.inventoryItem.create({ data: { name: 'Reset Lagerish Cream Ale (0.50L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 2.50, supplier: 'Reset', category: 'beverages', servingsPerUnit: 1, servingSize: '0.50L', costPerServing: 2.50 } })
    const invResetFroggy = await db.inventoryItem.create({ data: { name: 'Reset Froggy IPA (0.50L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 2.50, supplier: 'Reset', category: 'beverages', servingsPerUnit: 1, servingSize: '0.50L', costPerServing: 2.50 } })
    const invResetStout = await db.inventoryItem.create({ data: { name: 'Reset Irish Extra Stout (0.50L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 2.50, supplier: 'Reset', category: 'beverages', servingsPerUnit: 1, servingSize: '0.50L', costPerServing: 2.50 } })
    const invPeliconWinter = await db.inventoryItem.create({ data: { name: 'Pelicon Winter (0.75L)', unit: 'kos', quantity: 12, minQuantity: 4, costPerUnit: 6.50, supplier: 'Pelicon', category: 'beverages', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 6.50 } })
    const invZeleniHaler = await db.inventoryItem.create({ data: { name: 'Zeleni Haler Lager s Konopljo (0.50L)', unit: 'kos', quantity: 12, minQuantity: 4, costPerUnit: 2.80, supplier: 'Haler', category: 'beverages', servingsPerUnit: 1, servingSize: '0.50L', costPerServing: 2.80 } })
    const invBevogTak = await db.inventoryItem.create({ data: { name: 'Bevog Tak Pale Ale (0.33L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 2.20, supplier: 'Bevog', category: 'beverages', servingsPerUnit: 1, servingSize: '0.33L', costPerServing: 2.20 } })
    const invHeineken00 = await db.inventoryItem.create({ data: { name: 'Heineken 0.0 (0.33L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 1.80, supplier: 'Heineken', category: 'beverages', servingsPerUnit: 1, servingSize: '0.33L', costPerServing: 1.80 } })
    const invDaura = await db.inventoryItem.create({ data: { name: 'Daura Lager (0.33L)', unit: 'kos', quantity: 12, minQuantity: 4, costPerUnit: 2.10, supplier: 'Estrella Damm', category: 'beverages', servingsPerUnit: 1, servingSize: '0.33L', costPerServing: 2.10 } })

    // --- VINA - za točenje po kozarcih (0.75L = 7 kozarcev po 0.10L) ---
    const invPeninaZaTocenje = await db.inventoryItem.create({ data: { name: 'Penina za točenje (0.75L)', unit: 'steklenica', quantity: 6, minQuantity: 2, costPerUnit: 12.00, supplier: 'Vinoteka', category: 'beverages', servingsPerUnit: 7, servingSize: '0.10L', costPerServing: 1.71 } })

    // --- PENINE IN ŠAMPANJCI (steklenice - celotna prodaja) ---
    const invNo1Brut = await db.inventoryItem.create({ data: { name: 'No.1 Brut (0.75L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 22.00, supplier: 'Istenič', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 22.00 } })
    const invSlapsakBrutReserve = await db.inventoryItem.create({ data: { name: 'Domaine Slapšak Brut Reserve (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 25.00, supplier: 'Slapšak', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 25.00 } })
    const invSlapsakBrutRose = await db.inventoryItem.create({ data: { name: 'Domaine Slapšak Brut Rosé (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 25.00, supplier: 'Slapšak', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 25.00 } })
    const invGourmetRose = await db.inventoryItem.create({ data: { name: 'Penina Gourmet Rosé (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 22.00, supplier: 'Istenič', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 22.00 } })
    const invZlataRadgonska = await db.inventoryItem.create({ data: { name: 'Zlata Radgonska Penina Brut Selection (0.75L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 18.00, supplier: 'Radgonske gorice', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 18.00 } })
    const invMariaBrut = await db.inventoryItem.create({ data: { name: 'Maria Brut 2020 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 19.00, supplier: 'Kerin', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 19.00 } })
    const invBoemmeRumeniMuskat = await db.inventoryItem.create({ data: { name: 'Penina Boemme Rumeni Muškat (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 19.00, supplier: 'Emino', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 19.00 } })
    const invBjanaBrut = await db.inventoryItem.create({ data: { name: 'Bjana Brut (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 30.00, supplier: 'Bjana', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 30.00 } })
    const invMufiPetNat = await db.inventoryItem.create({ data: { name: 'Mufi Pet Nat Brut Nature 2023 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 19.00, supplier: 'Keltis', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 19.00 } })
    const invLouisRoederer = await db.inventoryItem.create({ data: { name: 'Champagne Louis Roederer Collection 244 (0.75L)', unit: 'steklenica', quantity: 1, minQuantity: 0, costPerUnit: 65.00, supplier: 'Roederer', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 65.00 } })
    const invPolRoger = await db.inventoryItem.create({ data: { name: 'Champagne Pol Roger Brut Reserve (0.75L)', unit: 'steklenica', quantity: 1, minQuantity: 0, costPerUnit: 65.00, supplier: 'Pol Roger', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 65.00 } })
    const invMoetChandon = await db.inventoryItem.create({ data: { name: 'Moët & Chandon Imperial Brut (0.75L)', unit: 'steklenica', quantity: 1, minQuantity: 0, costPerUnit: 58.00, supplier: 'Moët', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 58.00 } })
    const invDomPerignon = await db.inventoryItem.create({ data: { name: 'Dom Pérignon Brut 2013 (0.75L)', unit: 'steklenica', quantity: 1, minQuantity: 0, costPerUnit: 220.00, supplier: 'Dom Pérignon', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 220.00 } })

    // --- BELA VINA (steklenice + kozarci) ---
    const invCuveeEmino = await db.inventoryItem.create({ data: { name: 'Cuvee Emino 2022 (0.75L)', unit: 'steklenica', quantity: 6, minQuantity: 2, costPerUnit: 12.00, supplier: 'Emino', category: 'wine', servingsPerUnit: 7, servingSize: '0.10L kozarec', costPerServing: 1.71 } })
    const invChardonnayVerus = await db.inventoryItem.create({ data: { name: 'Chardonnay Verus 2023 (0.75L)', unit: 'steklenica', quantity: 4, minQuantity: 1, costPerUnit: 20.00, supplier: 'Verus', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 20.00 } })
    const invSauvignonCru = await db.inventoryItem.create({ data: { name: 'Sauvignon Blanc Cru Veliki Vrh 2023 (0.75L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 25.00, supplier: 'Brodnjak', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 25.00 } })
    const invLaskiRizling = await db.inventoryItem.create({ data: { name: 'Laški Rizling 2021 (0.75L)', unit: 'steklenica', quantity: 4, minQuantity: 1, costPerUnit: 20.00, supplier: 'Colnar', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 20.00 } })
    const invTraminec = await db.inventoryItem.create({ data: { name: 'Traminec 2023 (0.75L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 22.00, supplier: 'Keltis', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 22.00 } })
    const invRebula = await db.inventoryItem.create({ data: { name: 'Rebula 2022 (0.75L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 20.00, supplier: 'Blažič', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 20.00 } })
    const invChardonnayDular = await db.inventoryItem.create({ data: { name: 'Chardonnay Dular 2022 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 28.00, supplier: 'Dular', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 28.00 } })
    const invChardonnayVicomte = await db.inventoryItem.create({ data: { name: 'Chardonnay Domaine Vicomte de Noue 2020 (0.75L)', unit: 'steklenica', quantity: 1, minQuantity: 0, costPerUnit: 70.00, supplier: 'Marinčič', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 70.00 } })
    const invSiponVerus = await db.inventoryItem.create({ data: { name: 'Šipon Verus 2022 (0.75L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 20.00, supplier: 'Verus', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 20.00 } })
    const invSiviPinotJamertal = await db.inventoryItem.create({ data: { name: 'Sivi Pinot Jamertal 2021 (0.75L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 22.00, supplier: 'Valdhuber', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 22.00 } })
    const invRenskiRizlingStare = await db.inventoryItem.create({ data: { name: 'Renski Rizling Stare Trte 2015 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 22.00, supplier: 'Dveri-Pax', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 22.00 } })
    const invRenskiRizlingKeltis = await db.inventoryItem.create({ data: { name: 'Renski Rizling Keltis 2021 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 25.00, supplier: 'Keltis', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 25.00 } })
    const invAlter = await db.inventoryItem.create({ data: { name: 'Alter 2021 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 24.00, supplier: 'Šumenjak', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 24.00 } })
    const invMalvazijaMovia = await db.inventoryItem.create({ data: { name: 'Malvazija Malval Movia 2023 (0.75L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 20.00, supplier: 'Movia', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 20.00 } })
    const invRebulaCru = await db.inventoryItem.create({ data: { name: 'Rebula Cru Selection 2021 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 32.00, supplier: 'Simčič', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 32.00 } })
    const invBurjaBela = await db.inventoryItem.create({ data: { name: 'Burja Bela 2022 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 23.00, supplier: 'Burja', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 23.00 } })
    const invAngelBelo2021 = await db.inventoryItem.create({ data: { name: 'Angel Belo Grande Cuvee 2021 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 38.00, supplier: 'Batič', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 38.00 } })
    const invAngelBelo2019 = await db.inventoryItem.create({ data: { name: 'Angel Belo Grande Cuvee 2019 (3.00L)', unit: 'steklenica', quantity: 1, minQuantity: 0, costPerUnit: 150.00, supplier: 'Batič', category: 'wine', servingsPerUnit: 1, servingSize: '3.00L', costPerServing: 150.00 } })
    const invRumeniMuskat = await db.inventoryItem.create({ data: { name: 'Rumeni Muškat 2023 (0.75L)', unit: 'steklenica', quantity: 4, minQuantity: 1, costPerUnit: 17.00, supplier: 'Dular', category: 'wine', servingsPerUnit: 7, servingSize: '0.10L kozarec', costPerServing: 2.43 } })
    const invRumeniMuskatPozna = await db.inventoryItem.create({ data: { name: 'Rumeni Muškat Pozna Trgatev 2019 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 22.00, supplier: 'Prus', category: 'wine', servingsPerUnit: 7, servingSize: '0.10L kozarec', costPerServing: 3.14 } })
    const invBelaFrankinja = await db.inventoryItem.create({ data: { name: 'Bela Frankinja 2023 (0.75L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 20.00, supplier: 'Dular', category: 'wine', servingsPerUnit: 7, servingSize: '0.10L kozarec', costPerServing: 2.86 } })

    // --- ROSÉ VINA ---
    const invRoseBatic = await db.inventoryItem.create({ data: { name: 'Rosé Batič 2024 (0.75L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 25.00, supplier: 'Batič', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 25.00 } })
    const invRoseVerstovsek = await db.inventoryItem.create({ data: { name: 'Rosé Verstovšek Estate 2024 (0.75L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 20.00, supplier: 'Verstovšek', category: 'wine', servingsPerUnit: 7, servingSize: '0.10L kozarec', costPerServing: 2.86 } })

    // --- RDEČA VINA ---
    const invModraFrankinjaEmino = await db.inventoryItem.create({ data: { name: 'Modra Frankinja Emino 2023 (0.75L)', unit: 'steklenica', quantity: 6, minQuantity: 2, costPerUnit: 12.00, supplier: 'Emino', category: 'wine', servingsPerUnit: 7, servingSize: '0.10L kozarec', costPerServing: 1.71 } })
    const invModraFrankinjaDular = await db.inventoryItem.create({ data: { name: 'Modra Frankinja Dular 2023 (0.75L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 17.00, supplier: 'Dular', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 17.00 } })
    const invModraFrankinjaLuna = await db.inventoryItem.create({ data: { name: 'Modra Frankinja Luna 2021 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 38.00, supplier: 'Kobal', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 38.00 } })
    const invModriPinotVerus = await db.inventoryItem.create({ data: { name: 'Modri Pinot Verus 2019 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 22.00, supplier: 'Verus', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 22.00 } })
    const invModriPinotOpoka = await db.inventoryItem.create({ data: { name: 'Modri Pinot Opoka 2020 (0.75L)', unit: 'steklenica', quantity: 1, minQuantity: 0, costPerUnit: 55.00, supplier: 'Simčič', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 55.00 } })
    const invMerlotKeltis = await db.inventoryItem.create({ data: { name: 'Merlot Keltis 2018 (0.75L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 28.00, supplier: 'Keltis', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 28.00 } })
    const invMerlotOpoka = await db.inventoryItem.create({ data: { name: 'Merlot Opoka 2019 (0.75L)', unit: 'steklenica', quantity: 1, minQuantity: 0, costPerUnit: 65.00, supplier: 'Simčič', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 65.00 } })
    const invCabernetKeltis = await db.inventoryItem.create({ data: { name: 'Cabernet Sauvignon Keltis 2018 (0.75L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 28.00, supplier: 'Keltis', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 28.00 } })
    const invCabernetPavo = await db.inventoryItem.create({ data: { name: 'Cabernet Sauvignon Pavo Limited Edition 2021 (0.75L)', unit: 'steklenica', quantity: 1, minQuantity: 0, costPerUnit: 50.00, supplier: 'Kristančič', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 50.00 } })
    const invGuerilaRetro = await db.inventoryItem.create({ data: { name: 'Guerila Retro Selection 2020 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 28.00, supplier: 'Guerila', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 28.00 } })
    const invDuetEdiSimcic = await db.inventoryItem.create({ data: { name: 'Duet Edi Simčič 2021 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 36.00, supplier: 'Simčič', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 36.00 } })
    const invDuetLex2018 = await db.inventoryItem.create({ data: { name: 'Duet Lex Edi Simčič 2018 (1.50L)', unit: 'steklenica', quantity: 1, minQuantity: 0, costPerUnit: 110.00, supplier: 'Simčič', category: 'wine', servingsPerUnit: 1, servingSize: '1.50L', costPerServing: 110.00 } })
    const invDuetLex2020 = await db.inventoryItem.create({ data: { name: 'Duet Lex Edi Simčič 2020 (0.75L)', unit: 'steklenica', quantity: 1, minQuantity: 0, costPerUnit: 55.00, supplier: 'Simčič', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 55.00 } })
    const invCarolinaRdeca = await db.inventoryItem.create({ data: { name: 'Carolina Rdeča 2018 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 40.00, supplier: 'Jakončič', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 40.00 } })
    const invVelikoRdeceMovia = await db.inventoryItem.create({ data: { name: 'Veliko Rdeče Movia 2015 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 52.00, supplier: 'Movia', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 52.00 } })

    // --- TUJA VINA ---
    const invPosipTerraMadre = await db.inventoryItem.create({ data: { name: 'Pošip Premium Terra Madre 2021 (0.75L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 17.00, supplier: 'Terra Madre', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 17.00 } })
    const invAndreisVinasmora = await db.inventoryItem.create({ data: { name: 'Andreis Vinasmora 2020 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 17.00, supplier: 'Babič', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 17.00 } })
    const invPlavacMali = await db.inventoryItem.create({ data: { name: 'Plavac Mali Premium Terra Madre 2017 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 28.00, supplier: 'Terra Madre', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 28.00 } })
    const invVranecInstinct = await db.inventoryItem.create({ data: { name: 'Vranec Instinct 2019 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 17.00, supplier: 'Puklavec', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 17.00 } })
    const invJermannDreams = await db.inventoryItem.create({ data: { name: 'Chardonnay Where Dreams Have No End 2021 (0.75L)', unit: 'steklenica', quantity: 1, minQuantity: 0, costPerUnit: 65.00, supplier: 'Jermann', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 65.00 } })
    const invVintageTunina = await db.inventoryItem.create({ data: { name: 'Vintage Tunina 2022 (0.75L)', unit: 'steklenica', quantity: 1, minQuantity: 0, costPerUnit: 65.00, supplier: 'Jermann', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 65.00 } })

    // --- LIKERSKO VINO ---
    const invKerosBelo = await db.inventoryItem.create({ data: { name: 'Keros Belo 2020 (0.50L)', unit: 'steklenica', quantity: 4, minQuantity: 1, costPerUnit: 25.00, supplier: 'Kerin', category: 'wine', servingsPerUnit: 10, servingSize: '0.05L', costPerServing: 2.50 } })
    const invKerosRdece = await db.inventoryItem.create({ data: { name: 'Keros Rdeče 2018 (0.50L)', unit: 'steklenica', quantity: 4, minQuantity: 1, costPerUnit: 25.00, supplier: 'Kerin', category: 'wine', servingsPerUnit: 10, servingSize: '0.05L', costPerServing: 2.50 } })
    const invVelikoRdece2012 = await db.inventoryItem.create({ data: { name: 'Veliko Rdeče Movia 2012 (3.00L)', unit: 'steklenica', quantity: 1, minQuantity: 0, costPerUnit: 200.00, supplier: 'Movia', category: 'wine', servingsPerUnit: 1, servingSize: '3.00L', costPerServing: 200.00 } })
    const invSladkiRefosk = await db.inventoryItem.create({ data: { name: 'Sladki Refošk (0.50L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 14.00, supplier: 'Vina Koper', category: 'wine', servingsPerUnit: 5, servingSize: '0.10L', costPerServing: 2.80 } })

    // =====================================================================
    // HRANA - INVENTARNE POSTAVKE
    // =====================================================================

    // --- ZELENJAVA IN SADJE ---
    const invRimskiOhrovt = await db.inventoryItem.create({ data: { name: 'Rimski ohrovt (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 3.50, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.35 } })
    const invParadiznik = await db.inventoryItem.create({ data: { name: 'Paradižnik (1kg)', unit: 'kg', quantity: 8, minQuantity: 3, costPerUnit: 2.50, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.25 } })
    const invBazilika = await db.inventoryItem.create({ data: { name: 'Sveža bazilika (šen)', unit: 'šen', quantity: 3, minQuantity: 1, costPerUnit: 3.00, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 15, servingSize: '1 vejica', costPerServing: 0.20 } })
    const invCebula = await db.inventoryItem.create({ data: { name: 'Čebula (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 1.50, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.08 } })
    const invPaprika = await db.inventoryItem.create({ data: { name: 'Paprika (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 3.50, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 8, servingSize: '1 paprika', costPerServing: 0.44 } })
    const invGobe = await db.inventoryItem.create({ data: { name: 'Gobe šampinjoni (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 5.00, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.50 } })
    const invAvokado = await db.inventoryItem.create({ data: { name: 'Avokado (1kos)', unit: 'kos', quantity: 6, minQuantity: 2, costPerUnit: 2.00, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 1, servingSize: '1 kos', costPerServing: 2.00 } })
    const invZelje = await db.inventoryItem.create({ data: { name: 'Zelje (1glava)', unit: 'kos', quantity: 3, minQuantity: 1, costPerUnit: 1.50, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 4, servingSize: '250g', costPerServing: 0.38 } })
    const invKorenje = await db.inventoryItem.create({ data: { name: 'Korenje (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 1.80, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.18 } })

    // --- MESO IN RIBE ---
    const invGovedinaMleta = await db.inventoryItem.create({ data: { name: 'Mleta govedina (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 12.00, supplier: 'Mesarstvo', category: 'meat', servingsPerUnit: 5, servingSize: '200g', costPerServing: 2.40 } })
    const invSlanina = await db.inventoryItem.create({ data: { name: 'Slanina (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 10.00, supplier: 'Mesarstvo', category: 'meat', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.50 } })
    const invPanceta = await db.inventoryItem.create({ data: { name: 'Panceta (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 12.00, supplier: 'Mesarstvo', category: 'meat', servingsPerUnit: 15, servingSize: '65g', costPerServing: 0.80 } })
    const invJanjetina = await db.inventoryItem.create({ data: { name: 'Janječji kotleti (1kg)', unit: 'kg', quantity: 4, minQuantity: 1, costPerUnit: 18.00, supplier: 'Mesarstvo', category: 'meat', servingsPerUnit: 4, servingSize: '250g', costPerServing: 4.50 } })
    const invJajca = await db.inventoryItem.create({ data: { name: 'Jajca (10kos)', unit: 'kos', quantity: 30, minQuantity: 10, costPerUnit: 0.30, supplier: 'Kmetija', category: 'dairy', servingsPerUnit: 10, servingSize: '1 jajce', costPerServing: 0.30 } })

    // --- MLEKO IN MLEČNI IZDELKI ---
    const invMocarela = await db.inventoryItem.create({ data: { name: 'Mocarela (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 8.00, supplier: 'Sirarna', category: 'dairy', servingsPerUnit: 8, servingSize: '125g', costPerServing: 1.00 } })
    const invCheddarSir = await db.inventoryItem.create({ data: { name: 'Cheddar sir (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 12.00, supplier: 'Sirarna', category: 'dairy', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.60 } })
    const invSvicarskiSir = await db.inventoryItem.create({ data: { name: 'Švicarski sir (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 14.00, supplier: 'Sirarna', category: 'dairy', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.70 } })
    const invGorgonzola = await db.inventoryItem.create({ data: { name: 'Gorgonzola (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 16.00, supplier: 'Sirarna', category: 'dairy', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.80 } })
    const invRicotta = await db.inventoryItem.create({ data: { name: 'Ricotta (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 6.00, supplier: 'Sirarna', category: 'dairy', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.60 } })
    const invMaslo = await db.inventoryItem.create({ data: { name: 'Maslo (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 8.00, supplier: 'Ljubljanske mlekarne', category: 'dairy', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.40 } })

    // --- SUHE SESTAVINE ---
    const invMoka = await db.inventoryItem.create({ data: { name: 'Moka (1kg)', unit: 'kg', quantity: 10, minQuantity: 3, costPerUnit: 1.00, supplier: 'Mlinotest', category: 'dry-goods', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.05 } })
    const invKruh = await db.inventoryItem.create({ data: { name: 'Kruh za bruschetta (1 hlebček)', unit: 'kos', quantity: 5, minQuantity: 2, costPerUnit: 2.50, supplier: 'Pekarna', category: 'dry-goods', servingsPerUnit: 8, servingSize: '1 rezina', costPerServing: 0.31 } })
    const invTestoZaPico = await db.inventoryItem.create({ data: { name: 'Testo za pico (1 kos)', unit: 'kos', quantity: 10, minQuantity: 3, costPerUnit: 1.50, supplier: 'Kuhinja', category: 'dry-goods', servingsPerUnit: 1, servingSize: '1 testo', costPerServing: 1.50 } })
    const invPivskoTesto = await db.inventoryItem.create({ data: { name: 'Pivsko testo (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 3.00, supplier: 'Kuhinja', category: 'dry-goods', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.30 } })
    const invKrompir = await db.inventoryItem.create({ data: { name: 'Krompir (1kg)', unit: 'kg', quantity: 10, minQuantity: 3, costPerUnit: 1.00, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.20 } })
    const invRiz = await db.inventoryItem.create({ data: { name: 'Riž (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 2.50, supplier: 'Dobavitelj', category: 'dry-goods', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.25 } })
    const invOljcnoOlje = await db.inventoryItem.create({ data: { name: 'Oljčno olje (1L)', unit: 'L', quantity: 5, minQuantity: 2, costPerUnit: 8.00, supplier: 'Oljarstvo', category: 'dry-goods', servingsPerUnit: 50, servingSize: '0.02L', costPerServing: 0.16 } })
    const invKis = await db.inventoryItem.create({ data: { name: 'Balzamični kis (0.50L)', unit: 'L', quantity: 2, minQuantity: 1, costPerUnit: 8.00, supplier: 'Dobavitelj', category: 'dry-goods', servingsPerUnit: 50, servingSize: '0.01L', costPerServing: 0.16 } })
    const invCesn = await db.inventoryItem.create({ data: { name: 'Česen (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 6.00, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 50, servingSize: '20g', costPerServing: 0.12 } })
    const invBBQOmaka = await db.inventoryItem.create({ data: { name: 'BBQ omaka (1L)', unit: 'L', quantity: 3, minQuantity: 1, costPerUnit: 4.00, supplier: 'Dobavitelj', category: 'dry-goods', servingsPerUnit: 20, servingSize: '0.05L', costPerServing: 0.20 } })
    const invTartarskaOmaka = await db.inventoryItem.create({ data: { name: 'Tartarska omaka (1L)', unit: 'L', quantity: 2, minQuantity: 1, costPerUnit: 5.00, supplier: 'Dobavitelj', category: 'dry-goods', servingsPerUnit: 30, servingSize: '0.03L', costPerServing: 0.17 } })
    const invParadiznikovaOmaka = await db.inventoryItem.create({ data: { name: 'Paradižnikova omaka za pico (1L)', unit: 'L', quantity: 5, minQuantity: 2, costPerUnit: 3.00, supplier: 'Kuhinja', category: 'dry-goods', servingsPerUnit: 8, servingSize: '0.12L', costPerServing: 0.38 } })
    const invBechamel = await db.inventoryItem.create({ data: { name: 'Béchamel omaka (1L)', unit: 'L', quantity: 3, minQuantity: 1, costPerUnit: 4.00, supplier: 'Kuhinja', category: 'dairy', servingsPerUnit: 10, servingSize: '0.10L', costPerServing: 0.40 } })
    const invKavaZaTiramisu = await db.inventoryItem.create({ data: { name: 'Kava za tiramisu (1L)', unit: 'L', quantity: 2, minQuantity: 1, costPerUnit: 3.00, supplier: 'Kavarna', category: 'beverages', servingsPerUnit: 10, servingSize: '0.10L', costPerServing: 0.30 } })
    const invMascarpone = await db.inventoryItem.create({ data: { name: 'Mascarpone (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 8.00, supplier: 'Ljubljanske mlekarne', category: 'dairy', servingsPerUnit: 5, servingSize: '200g', costPerServing: 1.60 } })
    const invKakavPrašek = await db.inventoryItem.create({ data: { name: 'Kakav prah za tiramisu (0.50kg)', unit: 'kg', quantity: 1, minQuantity: 0.5, costPerUnit: 15.00, supplier: 'Dobavitelj', category: 'dry-goods', servingsPerUnit: 50, servingSize: '10g', costPerServing: 0.30 } })
    const invPiskoti = await db.inventoryItem.create({ data: { name: 'Piškoti Savoiardi (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 8.00, supplier: 'Dobavitelj', category: 'dry-goods', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.80 } })
    const invCrnoFižol = await db.inventoryItem.create({ data: { name: 'Črni fižol (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 3.00, supplier: 'Dobavitelj', category: 'dry-goods', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.30 } })
    const invKoruza = await db.inventoryItem.create({ data: { name: 'Koruza (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 2.00, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.20 } })
    const invSolata = await db.inventoryItem.create({ data: { name: 'Mešana solata (1kg)', unit: 'kg', quantity: 4, minQuantity: 2, costPerUnit: 4.00, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 8, servingSize: '125g', costPerServing: 0.50 } })
    const invZrezki = await db.inventoryItem.create({ data: { name: 'Testenine špageti (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 2.00, supplier: 'Mlinotest', category: 'dry-goods', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.20 } })
    const invPenneTestenine = await db.inventoryItem.create({ data: { name: 'Testenine penne (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 2.00, supplier: 'Mlinotest', category: 'dry-goods', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.20 } })
    const invFettuccine = await db.inventoryItem.create({ data: { name: 'Testenine fettuccine (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 2.50, supplier: 'Mlinotest', category: 'dry-goods', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.25 } })
    const invGovejaJuha = await db.inventoryItem.create({ data: { name: 'Goveja juha osnova (5L)', unit: 'L', quantity: 5, minQuantity: 2, costPerUnit: 3.00, supplier: 'Kuhinja', category: 'dry-goods', servingsPerUnit: 10, servingSize: '0.50L', costPerServing: 1.50 } })
    const invZrezkiRezanci = await db.inventoryItem.create({ data: { name: 'Rezanci za juho (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 2.50, supplier: 'Mlinotest', category: 'dry-goods', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.25 } })
    const invPeprikaChili = await db.inventoryItem.create({ data: { name: 'Chili paprika (0.5kg)', unit: 'kg', quantity: 1, minQuantity: 0.5, costPerUnit: 8.00, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 50, servingSize: '10g', costPerServing: 0.16 } })
    const invOlive = await db.inventoryItem.create({ data: { name: 'Črne olive (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 6.00, supplier: 'Dobavitelj', category: 'dry-goods', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.30 } })
    const invKruhoveDrobtine = await db.inventoryItem.create({ data: { name: 'Krušne drobtine (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 1.50, supplier: 'Dobavitelj', category: 'dry-goods', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.08 } })

    // =====================================================================
    // 2. RECEPTI / NORMATIVI (RecipeItem)
    // =====================================================================

    const recipes: { menuItemName: string; ingredientId: string; quantityPerServing: number; unit: string; notes?: string }[] = []

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

    // --- VODE (enostavno - 1:1 inventar) ---
    const waterDrinks: [string, typeof invMineralnaVoda025][] = [
      ['Mineralna Voda (0.25L)', invMineralnaVoda025],
      ['Mineralna Voda (0.50L)', invMineralnaVoda050],
      ['Mineralna Voda (1.00L)', invMineralnaVoda100],
      ['Naravna Voda (0.25L)', invNaravnaVoda025],
      ['Naravna Voda (0.50L)', invNaravnaVoda050],
      ['Naravna Voda (1.00L)', invNaravnaVoda100],
      ['Naravna Voda z Okusom (0.50L)', invVodaZOkusom],
      ['Voda Radenska FunctionALL (0.50L)', invRadenskaFunc],
    ]
    for (const [name, inv] of waterDrinks) {
      const item = mi(name)
      if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: 1, unit: 'servings', notes: '1 enota' })
    }

    // --- NARAVNI SOKOVI ---
    const limonada = mi('Limonada (0.35L)')
    if (limonada) {
      recipes.push({ menuItemName: 'Limonada (0.35L)', ingredientId: invLimone.id, quantityPerServing: 5, unit: 'servings', notes: 'Sok 1/2 limone' })
      recipes.push({ menuItemName: 'Limonada (0.35L)', ingredientId: invSladkor.id, quantityPerServing: 3, unit: 'servings', notes: 'Sladkor po okusu' })
      recipes.push({ menuItemName: 'Limonada (0.35L)', ingredientId: invNaravnaVoda050.id, quantityPerServing: 0.7, unit: 'servings', notes: 'Voda' })
    }

    const limonadaOkus = mi('Limonada z Okusom (0.35L)')
    if (limonadaOkus) {
      recipes.push({ menuItemName: 'Limonada z Okusom (0.35L)', ingredientId: invLimone.id, quantityPerServing: 5, unit: 'servings', notes: 'Sok 1/2 limone' })
      recipes.push({ menuItemName: 'Limonada z Okusom (0.35L)', ingredientId: invSladkor.id, quantityPerServing: 3, unit: 'servings', notes: 'Sladkor' })
      recipes.push({ menuItemName: 'Limonada z Okusom (0.35L)', ingredientId: invMeta.id, quantityPerServing: 1, unit: 'servings', notes: 'Meta listi' })
    }

    const hisniSokMeta = mi('Hišni Sok Meta (0.35L)')
    if (hisniSokMeta) {
      recipes.push({ menuItemName: 'Hišni Sok Meta (0.35L)', ingredientId: invMeta.id, quantityPerServing: 3, unit: 'servings', notes: 'Sveža meta' })
      recipes.push({ menuItemName: 'Hišni Sok Meta (0.35L)', ingredientId: invSladkor.id, quantityPerServing: 3, unit: 'servings', notes: 'Sladkor' })
    }

    const hisniLedeniCaj = mi('Hišni Ledeni Čaj (0.35L)')
    if (hisniLedeniCaj) {
      recipes.push({ menuItemName: 'Hišni Ledeni Čaj (0.35L)', ingredientId: invCajVrecice.id, quantityPerServing: 1, unit: 'servings', notes: '1 čajna vrečka' })
      recipes.push({ menuItemName: 'Hišni Ledeni Čaj (0.35L)', ingredientId: invSladkor.id, quantityPerServing: 2, unit: 'servings', notes: 'Sladkor' })
      recipes.push({ menuItemName: 'Hišni Ledeni Čaj (0.35L)', ingredientId: invLimone.id, quantityPerServing: 1, unit: 'servings', notes: '1 rezina limone' })
    }

    const naravniPomSok = mi('Naravni Pomarančni Sok (0.10L)')
    if (naravniPomSok) {
      recipes.push({ menuItemName: 'Naravni Pomarančni Sok (0.10L)', ingredientId: invPomarance.id, quantityPerServing: 1, unit: 'servings', notes: 'Sok 1 pomaranče' })
    }

    // --- SOKOVI V STEKLENICAH ---
    const sokDrinks: [string, typeof invMarelicniSok][] = [
      ['Marelični Sok (0.20L)', invMarelicniSok],
      ['Naravni Jabolčni Sok 100% (0.20L)', invJabolcniSok],
      ['Ribezov Sok (0.20L)', invRibezovSok],
      ['Ananasov Sok (0.20L)', invAnanasovSok],
      ['Pomarančni Sok (0.20L)', invPomarancniSok],
      ['Jagodni Sok (0.20L)', invJagodniSok],
      ['Ledeni Čaj (0.25L)', invLedeniCaj],
      ['Cedevita (0.30L)', invCedevita],
      ['Bubble Tea (0.36L)', invBubbleTea],
    ]
    for (const [name, inv] of sokDrinks) {
      const item = mi(name)
      if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: 1, unit: 'servings', notes: '1 enota' })
    }

    // --- GAZIRANE PIJAČE ---
    const gaziraneDrinks: [string, typeof invCocaCola][] = [
      ['Coca Cola (0.25L)', invCocaCola],
      ['Coca Cola Zero (0.25L)', invCocaColaZero],
      ['Fanta (0.25L)', invFanta],
      ['Cockta (0.275L)', invCockta],
      ['Sprite (0.25L)', invSprite],
      ['Schweppes Tonic Water (0.25L)', invTonicWater],
      ['Schweppes Bitter Lemon (0.25L)', invSchweppesBitter],
      ['Fever Tree Tonic Water (0.20L)', invFeverTreeTonic],
      ['Fever Tree Mediterranean Tonic (0.20L)', invFeverTreeMedTonic],
      ['Fever Tree Rhubarb & Raspberry Tonic (0.20L)', invFeverTreeRhubarb],
      ['Red Bull (0.20L)', invRedBull],
    ]
    for (const [name, inv] of gaziraneDrinks) {
      const item = mi(name)
      if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: 1, unit: 'servings', notes: '1 enota' })
    }

    // --- TOČENO PIVO ---
    const tocenoPivoDrinks: [string, typeof invHalerKeg, number][] = [
      ['Pivo Haler Lager Nefiltriran (0.30L)', invHalerKeg, 0.6],
      ['Pivo Haler Lager Nefiltriran (0.50L)', invHalerKeg, 1],
      ['Pivo Laško Lager (0.30L)', invLaskoKeg, 0.6],
      ['Pivo Laško Lager (0.50L)', invLaskoKeg, 1],
      ['Pivo Union Lager (0.30L)', invUnionKeg, 0.6],
      ['Pivo Union Lager (0.50L)', invUnionKeg, 1],
      ['Pelicon 3rd Pill IPA (0.30L)', invPeliconIPAKeg, 0.6],
      ['Pelicon 3rd Pill IPA (0.50L)', invPeliconIPAKeg, 1],
      ['Radler Grenivka (0.30L)', invRadlerKeg, 0.6],
      ['Radler Grenivka (0.50L)', invRadlerKeg, 1],
    ]
    for (const [name, inv, qty] of tocenoPivoDrinks) {
      const item = mi(name)
      if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: qty, unit: 'servings', notes: qty < 1 ? '0.30L' : '0.50L' })
    }

    // --- PIVO V STEKLENICAH ---
    const pivoBottleDrinks: [string, typeof invResetLagerish][] = [
      ['Reset Lagerish Cream Ale (0.50L)', invResetLagerish],
      ['Reset Froggy IPA (0.50L)', invResetFroggy],
      ['Reset Irish Extra Stout (0.50L)', invResetStout],
    ]
    for (const [name, inv] of pivoBottleDrinks) {
      const item = mi(name)
      if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: 1, unit: 'servings', notes: '1 steklenica' })
    }

    // --- CRAFT PIVA ---
    const craftDrinks: [string, typeof invPeliconWinter][] = [
      ['Pelicon Winter (0.75L)', invPeliconWinter],
      ['Zeleni Haler Lager s Konopljo (0.50L)', invZeleniHaler],
      ['Bevog Tak Pale Ale (0.33L)', invBevogTak],
    ]
    for (const [name, inv] of craftDrinks) {
      const item = mi(name)
      if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: 1, unit: 'servings', notes: '1 steklenica' })
    }

    // --- BREZALKOHOLNO PIVO ---
    const brezalkDrinks: [string, typeof invHeineken00][] = [
      ['Heineken 0.0 (0.33L)', invHeineken00],
      ['Daura Lager (0.33L)', invDaura],
    ]
    for (const [name, inv] of brezalkDrinks) {
      const item = mi(name)
      if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: 1, unit: 'servings', notes: '1 steklenica' })
    }

    // =====================================================================
    // VINSKI RECEPTI - Penine, Bela, Rosé, Rdeča, Tuja, Likerska vina
    // =====================================================================

    // --- PENINE IN ŠAMPANJCI (steklenica = 1 serving) ---
    const penineDrinks: [string, typeof invNo1Brut][] = [
      ['No.1 Brut', invNo1Brut],
      ['Domaine Slapšak Brut Reserve', invSlapsakBrutReserve],
      ['Domaine Slapšak Brut Rosé', invSlapsakBrutRose],
      ['Penina Gourmet Rosé', invGourmetRose],
      ['Zlata Radgonska Penina Brut Selection', invZlataRadgonska],
      ['Maria Brut 2020', invMariaBrut],
      ['Penina Boemme Rumeni Muškat', invBoemmeRumeniMuskat],
      ['Bjana Brut', invBjanaBrut],
      ['Mufi Pet Nat Brut Nature 2023', invMufiPetNat],
      ['Champagne Louis Roederer Collection 244 Brut', invLouisRoederer],
      ['Champagne Pol Roger Brut Reserve', invPolRoger],
      ['Moët & Chandon Imperial Brut', invMoetChandon],
      ['Dom Pérignon Brut 2013', invDomPerignon],
    ]
    for (const [name, inv] of penineDrinks) {
      const item = mi(name)
      if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: 1, unit: 'servings', notes: '1 steklenica' })
    }

    // --- BELA VINA - KOZARCI (1 serving = 0.10L iz steklenice z servingsPerUnit=7) ---
    const belaVinaKozarec: [string, typeof invCuveeEmino][] = [
      ['Cuvee Emino 2022 (kozarec)', invCuveeEmino],
      ['Rumeni Muškat 2023 (kozarec)', invRumeniMuskat],
      ['Rumeni Muškat Pozna Trgatev 2019 (kozarec)', invRumeniMuskatPozna],
      ['Bela Frankinja 2023 (kozarec)', invBelaFrankinja],
    ]
    for (const [name, inv] of belaVinaKozarec) {
      const item = mi(name)
      if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: 1, unit: 'servings', notes: '1 kozarec 0.10L' })
    }

    // --- BELA VINA - STEKLENICE (1 serving = 1 steklenica) ---
    const belaVinaSteklenica: [string, typeof invChardonnayVerus][] = [
      ['Cuvee Emino 2022 (steklenica)', invCuveeEmino],
      ['Chardonnay Verus 2023', invChardonnayVerus],
      ['Sauvignon Blanc Cru Veliki Vrh 2023', invSauvignonCru],
      ['Laški Rizling 2021', invLaskiRizling],
      ['Traminec 2023', invTraminec],
      ['Rebula 2022', invRebula],
      ['Chardonnay Dular 2022', invChardonnayDular],
      ['Chardonnay Domaine Vicomte de Noue 2020', invChardonnayVicomte],
      ['Šipon Verus 2022', invSiponVerus],
      ['Sivi Pinot Jamertal 2021', invSiviPinotJamertal],
      ['Renski Rizling Stare Trte 2015', invRenskiRizlingStare],
      ['Renski Rizling Keltis 2021', invRenskiRizlingKeltis],
      ['Alter 2021', invAlter],
      ['Malvazija Malval Movia 2023', invMalvazijaMovia],
      ['Rebula Cru Selection 2021', invRebulaCru],
      ['Burja Bela 2022', invBurjaBela],
      ['Angel Belo Grande Cuvee 2021', invAngelBelo2021],
      ['Angel Belo Grande Cuvee 2019', invAngelBelo2019],
      ['Rumeni Muškat 2023 (steklenica)', invRumeniMuskat],
      ['Rumeni Muškat Pozna Trgatev 2019 (steklenica)', invRumeniMuskatPozna],
      ['Bela Frankinja 2023 (steklenica)', invBelaFrankinja],
    ]
    for (const [name, inv] of belaVinaSteklenica) {
      const item = mi(name)
      if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: 1, unit: 'servings', notes: '1 steklenica 0.75L' })
    }

    // --- ROSÉ VINA ---
    const roseDrinks: [string, typeof invRoseBatic, number][] = [
      ['Rosé Batič 2024', invRoseBatic, 1],
      ['Rosé Verstovšek Estate 2024 (kozarec)', invRoseVerstovsek, 1],
      ['Rosé Verstovšek Estate 2024 (steklenica)', invRoseVerstovsek, 1],
    ]
    for (const [name, inv, qty] of roseDrinks) {
      const item = mi(name)
      if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: qty, unit: 'servings', notes: name.includes('kozarec') ? '1 kozarec' : '1 steklenica' })
    }

    // --- RDEČA VINA - KOZARCI ---
    const rdecaVinaKozarec: [string, typeof invModraFrankinjaEmino][] = [
      ['Modra Frankinja Emino 2023 (kozarec)', invModraFrankinjaEmino],
    ]
    for (const [name, inv] of rdecaVinaKozarec) {
      const item = mi(name)
      if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: 1, unit: 'servings', notes: '1 kozarec 0.10L' })
    }

    // --- RDEČA VINA - STEKLENICE ---
    const rdecaVinaSteklenica: [string, typeof invModraFrankinjaDular][] = [
      ['Modra Frankinja Emino 2023 (steklenica)', invModraFrankinjaEmino],
      ['Modra Frankinja Dular 2023', invModraFrankinjaDular],
      ['Modra Frankinja Luna 2021', invModraFrankinjaLuna],
      ['Modri Pinot Verus 2019', invModriPinotVerus],
      ['Modri Pinot Opoka 2020', invModriPinotOpoka],
      ['Merlot Keltis 2018', invMerlotKeltis],
      ['Merlot Opoka 2019', invMerlotOpoka],
      ['Cabernet Sauvignon Keltis 2018', invCabernetKeltis],
      ['Cabernet Sauvignon Pavo Limited Edition 2021', invCabernetPavo],
      ['Guerila Retro Selection 2020', invGuerilaRetro],
      ['Duet Edi Simčič 2021', invDuetEdiSimcic],
      ['Duet Lex Edi Simčič 2018', invDuetLex2018],
      ['Duet Lex Edi Simčič 2020', invDuetLex2020],
      ['Carolina Rdeča 2018', invCarolinaRdeca],
      ['Veliko Rdeče Movia 2015', invVelikoRdeceMovia],
    ]
    for (const [name, inv] of rdecaVinaSteklenica) {
      const item = mi(name)
      if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: 1, unit: 'servings', notes: '1 steklenica 0.75L' })
    }

    // --- TUJA VINA ---
    const tujaVinaDrinks: [string, typeof invPosipTerraMadre][] = [
      ['Pošip Premium Terra Madre 2021', invPosipTerraMadre],
      ['Andreis Vinasmora 2020', invAndreisVinasmora],
      ['Plavac Mali Premium Terra Madre 2017', invPlavacMali],
      ['Vranec Instinct 2019', invVranecInstinct],
      ['Chardonnay Where Dreams Have No End 2021', invJermannDreams],
      ['Vintage Tunina 2022', invVintageTunina],
    ]
    for (const [name, inv] of tujaVinaDrinks) {
      const item = mi(name)
      if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: 1, unit: 'servings', notes: '1 steklenica 0.75L' })
    }

    // --- LIKERSKO VINO ---
    const likerskoVinoKozarec: [string, typeof invKerosBelo][] = [
      ['Keros Belo 2020 (0.05L)', invKerosBelo],
      ['Keros Rdeče 2018 (0.05L)', invKerosRdece],
      ['Sladki Refošk (kozarec)', invSladkiRefosk],
    ]
    for (const [name, inv] of likerskoVinoKozarec) {
      const item = mi(name)
      if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: 1, unit: 'servings', notes: '1 kozarec' })
    }
    const likerskoVinoStek: [string, typeof invKerosBelo][] = [
      ['Keros Belo 2020 (0.50L)', invKerosBelo],
      ['Keros Rdeče 2018 (0.50L)', invKerosRdece],
      ['Veliko Rdeče Movia 2012', invVelikoRdece2012],
      ['Sladki Refošk (0.50L)', invSladkiRefosk],
    ]
    for (const [name, inv] of likerskoVinoStek) {
      const item = mi(name)
      if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: 1, unit: 'servings', notes: '1 steklenica' })
    }

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

    // =====================================================================
    // 3. SHRANI VSE RECEPTE V BAZO
    // =====================================================================
    let createdCount = 0
    const errors: string[] = []

    for (const recipe of recipes) {
      const menuItem = mi(recipe.menuItemName)
      if (!menuItem) {
        errors.push(`Menu item "${recipe.menuItemName}" ni bil najden`)
        continue
      }
      try {
        await db.recipeItem.create({
          data: {
            menuItemId: menuItem.id,
            inventoryItemId: recipe.ingredientId,
            quantityPerServing: recipe.quantityPerServing,
            unit: recipe.unit,
            notes: recipe.notes || '',
          }
        })
        createdCount++
      } catch (e: any) {
        if (!e.message?.includes('Unique')) {
          errors.push(`Napaka pri "${recipe.menuItemName}": ${e.message}`)
        }
      }
    }

    // =====================================================================
    // 4. INVENTARNE POSTAVKE ZA HRANO - RestorantOS
    // =====================================================================

    // --- MESO ---
    const invSvinjskiZrezek = await db.inventoryItem.create({ data: { name: 'Svinjski zrezek (1kg)', unit: 'kg', quantity: 15, minQuantity: 5, costPerUnit: 12.00, supplier: 'Mesarstvo RestorantOS', category: 'meat', location: 'hladilnik', servingsPerUnit: 4, servingSize: '250g', costPerServing: 3.00 } })
    const invTelecjiZrezek = await db.inventoryItem.create({ data: { name: 'Telečji zrezek (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 28.00, supplier: 'Mesarstvo RestorantOS', category: 'meat', location: 'hladilnik', servingsPerUnit: 4, servingSize: '250g', costPerServing: 7.00 } })
    const invPuramjiFile = await db.inventoryItem.create({ data: { name: 'Puranji file (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 14.00, supplier: 'Mesarstvo RestorantOS', category: 'meat', location: 'hladilnik', servingsPerUnit: 6, servingSize: '170g', costPerServing: 2.33 } })
    const invPiscancjiFile = await db.inventoryItem.create({ data: { name: 'Piščančji file (1kg)', unit: 'kg', quantity: 8, minQuantity: 3, costPerUnit: 10.00, supplier: 'Mesarstvo RestorantOS', category: 'meat', location: 'hladilnik', servingsPerUnit: 6, servingSize: '170g', costPerServing: 1.67 } })
    const invGovedinaZaGolaz = await db.inventoryItem.create({ data: { name: 'Govedina za golaž (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 18.00, supplier: 'Mesarstvo RestorantOS', category: 'meat', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 3.60 } })
    const invMletnoMeso = await db.inventoryItem.create({ data: { name: 'Mletno meso goveje (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 12.00, supplier: 'Mesarstvo RestorantOS', category: 'meat', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 2.40 } })
    const invSvinjskaPecenko = await db.inventoryItem.create({ data: { name: 'Svinjska pečenka (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 10.00, supplier: 'Mesarstvo RestorantOS', category: 'meat', location: 'hladilnik', servingsPerUnit: 2, servingSize: '450g', costPerServing: 4.50 } })
    const invTelecjaPrsa = await db.inventoryItem.create({ data: { name: 'Telečja prsa (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 22.00, supplier: 'Mesarstvo RestorantOS', category: 'meat', location: 'hladilnik', servingsPerUnit: 3, servingSize: '300g', costPerServing: 6.60 } })
    const invBeefsteak = await db.inventoryItem.create({ data: { name: 'Beefsteak goveji (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 35.00, supplier: 'Mesarstvo RestorantOS', category: 'meat', location: 'hladilnik', servingsPerUnit: 4, servingSize: '250g', costPerServing: 8.75 } })
    const invRostbeef = await db.inventoryItem.create({ data: { name: 'Rostbeef (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 30.00, supplier: 'Mesarstvo RestorantOS', category: 'meat', location: 'hladilnik', servingsPerUnit: 4, servingSize: '250g', costPerServing: 7.50 } })
    const invSvinjskaKraca = await db.inventoryItem.create({ data: { name: 'Svinjska krača (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 8.00, supplier: 'Mesarstvo RestorantOS', category: 'meat', location: 'hladilnik', servingsPerUnit: 1, servingSize: '1500g', costPerServing: 12.00 } })
    const invRebra = await db.inventoryItem.create({ data: { name: 'Svinjska rebra (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 9.00, supplier: 'Mesarstvo RestorantOS', category: 'meat', location: 'hladilnik', servingsPerUnit: 3, servingSize: '350g', costPerServing: 3.15 } })
    const invPecenaKlobasa = await db.inventoryItem.create({ data: { name: 'Pečenica (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 10.00, supplier: 'Mesarstvo RestorantOS', category: 'meat', location: 'hladilnik', servingsPerUnit: 3, servingSize: '300g', costPerServing: 3.00 } })
    const invKrvavica = await db.inventoryItem.create({ data: { name: 'Krvavica (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 7.00, supplier: 'Mesarstvo RestorantOS', category: 'meat', location: 'hladilnik', servingsPerUnit: 3, servingSize: '300g', costPerServing: 2.10 } })
    const invPiscanecCeli = await db.inventoryItem.create({ data: { name: 'Pišanec cel (kos)', unit: 'kos', quantity: 5, minQuantity: 2, costPerUnit: 12.00, supplier: 'Perutninarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 1, servingSize: '1500g', costPerServing: 12.00 } })
    const invGovedinaBograch = await db.inventoryItem.create({ data: { name: 'Govedina za bograč (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 16.00, supplier: 'Mesarstvo RestorantOS', category: 'meat', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 3.20 } })
    const invBurgerPatty = await db.inventoryItem.create({ data: { name: 'Burger patty goveji 170g', unit: 'kos', quantity: 30, minQuantity: 10, costPerUnit: 3.50, supplier: 'Mesarstvo RestorantOS', category: 'meat', location: 'hladilnik', servingsPerUnit: 1, servingSize: '170g', costPerServing: 3.50 } })
    const invPljucnaPecenka = await db.inventoryItem.create({ data: { name: 'Pljučna pečenka (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 18.00, supplier: 'Mesarstvo RestorantOS', category: 'meat', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 3.60 } })

    // --- MESNINE / PRŠUT / ŠUNKA ---
    const invPrsut = await db.inventoryItem.create({ data: { name: 'Kraški pršut (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 30.00, supplier: 'Kraški pršut', category: 'meat', location: 'hladilnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 3.00 } })
    const invKuhanPrsut = await db.inventoryItem.create({ data: { name: 'Kuhan pršut (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 18.00, supplier: 'Mesarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 1.80 } })
    const invDomacaSunka = await db.inventoryItem.create({ data: { name: 'Domača šunka (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 15.00, supplier: 'Mesarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 1.50 } })
    const invSuhaSalama = await db.inventoryItem.create({ data: { name: 'Suha goveja salama (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 14.00, supplier: 'Mesarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 1.40 } })
    const invHrenovka = await db.inventoryItem.create({ data: { name: 'Hrenovka (kos)', unit: 'kos', quantity: 20, minQuantity: 5, costPerUnit: 1.50, supplier: 'Mesarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 1, servingSize: '1 kos', costPerServing: 1.50 } })
    const invMesnineIzbira = await db.inventoryItem.create({ data: { name: 'Izbira kraških mesnin (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 22.00, supplier: 'Kraški pršut', category: 'meat', location: 'hladilnik', servingsPerUnit: 3, servingSize: '300g', costPerServing: 7.33 } })
    const invKebabMeso = await db.inventoryItem.create({ data: { name: 'Piščančji kebab (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 12.00, supplier: 'Dobavitelj', category: 'meat', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 2.40 } })

    // --- RIBE IN MORSKI SADEŽI ---
    const invLosos = await db.inventoryItem.create({ data: { name: 'File lososa (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 22.00, supplier: 'Ribarnica', category: 'fish', location: 'hladilnik', servingsPerUnit: 3, servingSize: '300g', costPerServing: 6.60 } })
    const invFileOrade = await db.inventoryItem.create({ data: { name: 'File orade (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 18.00, supplier: 'Ribarnica', category: 'fish', location: 'hladilnik', servingsPerUnit: 3, servingSize: '300g', costPerServing: 5.40 } })
    const invFileBrancina = await db.inventoryItem.create({ data: { name: 'File brancina (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 20.00, supplier: 'Ribarnica', category: 'fish', location: 'hladilnik', servingsPerUnit: 3, servingSize: '300g', costPerServing: 6.00 } })
    const invOslic = await db.inventoryItem.create({ data: { name: 'Ocvrt oslič (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 12.00, supplier: 'Ribarnica', category: 'fish', location: 'hladilnik', servingsPerUnit: 3, servingSize: '300g', costPerServing: 4.00 } })
    const invFilePostrvi = await db.inventoryItem.create({ data: { name: 'File postrvi (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 14.00, supplier: 'Ribarnica', category: 'fish', location: 'hladilnik', servingsPerUnit: 3, servingSize: '300g', costPerServing: 4.20 } })
    const invGamberi = await db.inventoryItem.create({ data: { name: 'Gamberi (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 25.00, supplier: 'Ribarnica', category: 'fish', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 5.00 } })
    const invKalamari = await db.inventoryItem.create({ data: { name: 'Kalamari sveži (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 14.00, supplier: 'Ribarnica', category: 'fish', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 2.80 } })
    const invTunaKos = await db.inventoryItem.create({ data: { name: 'Tuna v kosih (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 20.00, supplier: 'Ribarnica', category: 'fish', location: 'hladilnik', servingsPerUnit: 6, servingSize: '150g', costPerServing: 3.33 } })

    // --- SIRI ---
    const invMozzarella = await db.inventoryItem.create({ data: { name: 'Mozzarella (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 10.00, supplier: 'Mlekarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 1.00 } })
    const invParmezan = await db.inventoryItem.create({ data: { name: 'Parmezan Grana Padano (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 20.00, supplier: 'Sirarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 50, servingSize: '20g', costPerServing: 0.40 } })
    const invFetaSir = await db.inventoryItem.create({ data: { name: 'Feta sir (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 12.00, supplier: 'Sirarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 1.20 } })
    const invKozjiSir = await db.inventoryItem.create({ data: { name: 'Kozji sir (1kg)', unit: 'kg', quantity: 1, minQuantity: 1, costPerUnit: 20.00, supplier: 'Sirarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 2.00 } })
    const invEdamec = await db.inventoryItem.create({ data: { name: 'Edamec (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 12.00, supplier: 'Sirarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 1.20 } })
    const invGauda = await db.inventoryItem.create({ data: { name: 'Gauda (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 10.00, supplier: 'Sirarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 1.00 } })
    const invSiroviStrukelj = await db.inventoryItem.create({ data: { name: 'Sirovi štrukelj (kos)', unit: 'kos', quantity: 10, minQuantity: 3, costPerUnit: 2.50, supplier: 'Pekarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 1, servingSize: '1 kos', costPerServing: 2.50 } })

    // --- MLEČNI IZDELKI ---
    const invKislaSmetana = await db.inventoryItem.create({ data: { name: 'Kisla smetana (0.20L)', unit: 'kos', quantity: 20, minQuantity: 5, costPerUnit: 0.80, supplier: 'Ljubljanske mlekarne', category: 'dairy', location: 'hladilnik', servingsPerUnit: 1, servingSize: '0.20L', costPerServing: 0.80 } })
    const invSladkaSmetana = await db.inventoryItem.create({ data: { name: 'Sladka smetana za kuhanje (0.20L)', unit: 'kos', quantity: 15, minQuantity: 5, costPerUnit: 1.00, supplier: 'Ljubljanske mlekarne', category: 'dairy', location: 'hladilnik', servingsPerUnit: 1, servingSize: '0.20L', costPerServing: 1.00 } })

    // --- TESTENINE IN RIŽ ---
    const invSpageti = await db.inventoryItem.create({ data: { name: 'Špageti (1kg)', unit: 'kg', quantity: 10, minQuantity: 3, costPerUnit: 2.00, supplier: 'Barilla', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.40 } })
    const invRezanci = await db.inventoryItem.create({ data: { name: 'Široki rezanci (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 2.50, supplier: 'Barilla', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.50 } })
    const invNjoki = await db.inventoryItem.create({ data: { name: 'Njoki (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 3.50, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.70 } })
    const invRizeviRezanci = await db.inventoryItem.create({ data: { name: 'Riževi rezanci (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 4.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.80 } })

    // --- ZELINJAVA ---
    const invPommesFrites = await db.inventoryItem.create({ data: { name: 'Pommes frites zamrznjeni (2.5kg)', unit: 'kg', quantity: 8, minQuantity: 3, costPerUnit: 2.50, supplier: 'Dobavitelj', category: 'produce', location: 'zamrzovalnik', servingsPerUnit: 5, servingSize: '500g', costPerServing: 1.25 } })
    const invSampinjoni = await db.inventoryItem.create({ data: { name: 'Sveži šampinjoni (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 4.00, supplier: 'Green Valley', category: 'produce', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.80 } })
    const invMešanaZelenjava = await db.inventoryItem.create({ data: { name: 'Mešana zelenjava (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 3.00, supplier: 'Green Valley', category: 'produce', location: 'hladilnik', servingsPerUnit: 4, servingSize: '250g', costPerServing: 0.75 } })
    const invCesen = await db.inventoryItem.create({ data: { name: 'Česen (0.5kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 6.00, supplier: 'Green Valley', category: 'produce', location: 'skladišče', servingsPerUnit: 50, servingSize: '10g', costPerServing: 0.12 } })
    const invBucke = await db.inventoryItem.create({ data: { name: 'Bučke (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 3.00, supplier: 'Green Valley', category: 'produce', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.60 } })
    const invMelancani = await db.inventoryItem.create({ data: { name: 'Melancani (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 3.50, supplier: 'Green Valley', category: 'produce', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.70 } })
    const invRukola = await db.inventoryItem.create({ data: { name: 'Rukola (0.2kg)', unit: 'kos', quantity: 5, minQuantity: 2, costPerUnit: 2.50, supplier: 'Green Valley', category: 'produce', location: 'hladilnik', servingsPerUnit: 4, servingSize: '50g', costPerServing: 0.63 } })
    const invBlitva = await db.inventoryItem.create({ data: { name: 'Blitva (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 3.00, supplier: 'Green Valley', category: 'produce', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.60 } })
    const invFeferoni = await db.inventoryItem.create({ data: { name: 'Feferoni (1kg)', unit: 'kg', quantity: 1, minQuantity: 1, costPerUnit: 6.00, supplier: 'Dobavitelj', category: 'produce', location: 'skladišče', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.30 } })
    const invAnanas = await db.inventoryItem.create({ data: { name: 'Ananas (1kos)', unit: 'kos', quantity: 3, minQuantity: 1, costPerUnit: 3.00, supplier: 'Green Valley', category: 'produce', location: 'hladilnik', servingsPerUnit: 6, servingSize: '1 rezina', costPerServing: 0.50 } })
    const invRepa = await db.inventoryItem.create({ data: { name: 'Repa (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 2.00, supplier: 'Green Valley', category: 'produce', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.40 } })

    // --- OMAKE, ZAČIMBE, OLJA ---
    const invPelati = await db.inventoryItem.create({ data: { name: 'Pelati paradižnik (2.5kg)', unit: 'kos', quantity: 6, minQuantity: 2, costPerUnit: 3.50, supplier: 'Mutti', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 5, servingSize: '500g', costPerServing: 0.70 } })
    const invOlivnoOlje = await db.inventoryItem.create({ data: { name: 'Olivno olje (1L)', unit: 'L', quantity: 5, minQuantity: 2, costPerUnit: 8.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 20, servingSize: '50ml', costPerServing: 0.40 } })
    const invKruhoveRezine = await db.inventoryItem.create({ data: { name: 'Kruhove rezine (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 2.50, supplier: 'Pekarna', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.25 } })
    const invGorciica = await db.inventoryItem.create({ data: { name: 'Gorčica (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 5.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 50, servingSize: '20g', costPerServing: 0.10 } })
    const invHren = await db.inventoryItem.create({ data: { name: 'Hren (1kg)', unit: 'kg', quantity: 1, minQuantity: 1, costPerUnit: 8.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'hladilnik', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.40 } })
    const invAjvar = await db.inventoryItem.create({ data: { name: 'Ajvar (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 5.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.50 } })
    const invOrigano = await db.inventoryItem.create({ data: { name: 'Origano (0.1kg)', unit: 'kg', quantity: 0.5, minQuantity: 0.2, costPerUnit: 15.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 50, servingSize: '2g', costPerServing: 0.30 } })
    const invKetchup = await db.inventoryItem.create({ data: { name: 'Ketchup (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 3.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.15 } })
    const invPesto = await db.inventoryItem.create({ data: { name: 'Bazilični pesto (0.20kg)', unit: 'kos', quantity: 5, minQuantity: 2, costPerUnit: 3.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'hladilnik', servingsPerUnit: 4, servingSize: '50g', costPerServing: 0.75 } })
    const invTartufi = await db.inventoryItem.create({ data: { name: 'Tartufi (0.05kg)', unit: 'kg', quantity: 0.2, minQuantity: 0.1, costPerUnit: 150.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'hladilnik', servingsPerUnit: 10, servingSize: '5g', costPerServing: 7.50 } })
    const invCurryPrah = await db.inventoryItem.create({ data: { name: 'Curry prah (0.1kg)', unit: 'kg', quantity: 0.3, minQuantity: 0.1, costPerUnit: 15.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 20, servingSize: '5g', costPerServing: 0.75 } })
    const invPoper = await db.inventoryItem.create({ data: { name: 'Črni poper (0.1kg)', unit: 'kg', quantity: 0.3, minQuantity: 0.1, costPerUnit: 12.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 50, servingSize: '2g', costPerServing: 0.24 } })
    const invSol = await db.inventoryItem.create({ data: { name: 'Sol (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 0.50, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 100, servingSize: '10g', costPerServing: 0.01 } })
    const invKislaKumara = await db.inventoryItem.create({ data: { name: 'Kisle kumarice (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 4.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.40 } })
    const invTatarskaOmaka = await db.inventoryItem.create({ data: { name: 'Tatarska omaka (0.20L)', unit: 'kos', quantity: 10, minQuantity: 3, costPerUnit: 1.50, supplier: 'Dobavitelj', category: 'dry-goods', location: 'hladilnik', servingsPerUnit: 1, servingSize: '0.20L', costPerServing: 1.50 } })

    // --- PALAČINKE IN SLADICE ---
    const invMokaPalacinke = await db.inventoryItem.create({ data: { name: 'Moka za palačinke (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 1.50, supplier: 'Mlinotest', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.15 } })
    const invNutella = await db.inventoryItem.create({ data: { name: 'Nutella (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 10.00, supplier: 'Ferrero', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 10, servingSize: '100g', costPerServing: 1.00 } })
    const invLinoLada = await db.inventoryItem.create({ data: { name: 'Lino Lada (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 8.00, supplier: 'Droga Kolinska', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.80 } })
    const invKakavZaPalačinke = await db.inventoryItem.create({ data: { name: 'Kakav za palačinke (1kg)', unit: 'kg', quantity: 1, minQuantity: 1, costPerUnit: 10.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.50 } })
    const invVanilijevPuding = await db.inventoryItem.create({ data: { name: 'Vanilijev puding (kos)', unit: 'kos', quantity: 20, minQuantity: 5, costPerUnit: 1.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 1, servingSize: '1 kos', costPerServing: 1.00 } })
    const invOreoPiskot = await db.inventoryItem.create({ data: { name: 'Oreo piškot (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 8.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.80 } })
    const invPlazmaPiskot = await db.inventoryItem.create({ data: { name: 'Plazma piškot (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 6.00, supplier: 'Droga Kolinska', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.60 } })
    const invJagodniPire = await db.inventoryItem.create({ data: { name: 'Jagodni pire (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 6.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'zamrzovalnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.60 } })
    const invBelaCokolada = await db.inventoryItem.create({ data: { name: 'Bela čokolada (1kg)', unit: 'kg', quantity: 1, minQuantity: 1, costPerUnit: 12.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 10, servingSize: '100g', costPerServing: 1.20 } })
    const invPistacija = await db.inventoryItem.create({ data: { name: 'Pistacija (1kg)', unit: 'kg', quantity: 0.5, minQuantity: 0.2, costPerUnit: 30.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 20, servingSize: '50g', costPerServing: 1.50 } })
    const invArasidi = await db.inventoryItem.create({ data: { name: 'Arašidi (1kg)', unit: 'kg', quantity: 1, minQuantity: 1, costPerUnit: 8.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.40 } })
    const invMandlji = await db.inventoryItem.create({ data: { name: 'Mleti mandlji (1kg)', unit: 'kg', quantity: 1, minQuantity: 1, costPerUnit: 15.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.75 } })
    const invKinderBueno = await db.inventoryItem.create({ data: { name: 'Kinder Bueno (kos)', unit: 'kos', quantity: 10, minQuantity: 3, costPerUnit: 1.50, supplier: 'Ferrero', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 1, servingSize: '1 kos', costPerServing: 1.50 } })
    const invFerreroRocher = await db.inventoryItem.create({ data: { name: 'Ferrero Rocher (kos)', unit: 'kos', quantity: 10, minQuantity: 3, costPerUnit: 1.80, supplier: 'Ferrero', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 1, servingSize: '1 kos', costPerServing: 1.80 } })
    const invRaffaello = await db.inventoryItem.create({ data: { name: 'Raffaello (kos)', unit: 'kos', quantity: 10, minQuantity: 3, costPerUnit: 1.50, supplier: 'Ferrero', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 1, servingSize: '1 kos', costPerServing: 1.50 } })
    const invMandM = await db.inventoryItem.create({ data: { name: "M&M's bonboni (1kg)", unit: 'kg', quantity: 1, minQuantity: 1, costPerUnit: 12.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.60 } })
    const invSnickers = await db.inventoryItem.create({ data: { name: 'Snickers (kos)', unit: 'kos', quantity: 10, minQuantity: 3, costPerUnit: 1.20, supplier: 'Mars', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 1, servingSize: '1 kos', costPerServing: 1.20 } })
    const invKokosovaMoka = await db.inventoryItem.create({ data: { name: 'Kokosova moka (1kg)', unit: 'kg', quantity: 1, minQuantity: 1, costPerUnit: 5.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.25 } })

    // --- TESTO ZA PICE ---

    // =====================================================================
    // 5. RECEPTI ZA HRANO - RestorantOS
    // =====================================================================
    const foodRecipes: Array<{ menuItemName: string; ingredientId: string; quantityPerServing: number; unit: string; notes?: string }> = [
      // --- HLAĐNE PREDJEDI ---
      { menuItemName: 'Domači narezek', ingredientId: invMesnineIzbira.id, quantityPerServing: 0.3, unit: 'kg', notes: '300g mesnin' },
      { menuItemName: 'Domači narezek', ingredientId: invParmezan.id, quantityPerServing: 0.05, unit: 'kg', notes: 'sir' },
      { menuItemName: 'Pršut z olivami', ingredientId: invPrsut.id, quantityPerServing: 0.25, unit: 'kg', notes: 'kraški pršut' },
      { menuItemName: 'Pršut z olivami', ingredientId: invOlive.id, quantityPerServing: 0.05, unit: 'kg', notes: 'olive' },
      { menuItemName: 'Sirova plošča', ingredientId: invGorgonzola.id, quantityPerServing: 0.1, unit: 'kg', notes: 'gorgonzola' },
      { menuItemName: 'Sirova plošča', ingredientId: invGauda.id, quantityPerServing: 0.1, unit: 'kg', notes: 'gauda' },
      { menuItemName: 'Sirova plošča', ingredientId: invEdamec.id, quantityPerServing: 0.1, unit: 'kg', notes: 'edamec' },

      // --- TOPLE PREDJEDI ---
      { menuItemName: 'Ocvrti šampinjoni', ingredientId: invSampinjoni.id, quantityPerServing: 0.3, unit: 'kg', notes: 'šampinjoni' },
      { menuItemName: 'Ocvrti šampinjoni', ingredientId: invMoka.id, quantityPerServing: 0.05, unit: 'kg', notes: 'za paniranje' },
      { menuItemName: 'Ocvrti šampinjoni', ingredientId: invOlivnoOlje.id, quantityPerServing: 0.05, unit: 'L', notes: 'za cvrenje' },
      { menuItemName: 'Šampinjoni na žaru z gorgonzolo', ingredientId: invSampinjoni.id, quantityPerServing: 0.3, unit: 'kg', notes: 'šampinjoni' },
      { menuItemName: 'Šampinjoni na žaru z gorgonzolo', ingredientId: invGorgonzola.id, quantityPerServing: 0.1, unit: 'kg', notes: 'gorgonzola' },
      { menuItemName: 'Šampinjoni v gorgonzolni omaki', ingredientId: invSampinjoni.id, quantityPerServing: 0.3, unit: 'kg', notes: 'šampinjoni' },
      { menuItemName: 'Šampinjoni v gorgonzolni omaki', ingredientId: invGorgonzola.id, quantityPerServing: 0.1, unit: 'kg', notes: 'gorgonzola' },
      { menuItemName: 'Šampinjoni v gorgonzolni omaki', ingredientId: invSladkaSmetana.id, quantityPerServing: 1, unit: 'kos', notes: 'smetana' },
      { menuItemName: 'Ocvrti sir s tatarsko omako', ingredientId: invGauda.id, quantityPerServing: 0.2, unit: 'kg', notes: 'sir za cvrenje' },
      { menuItemName: 'Ocvrti sir s tatarsko omako', ingredientId: invMoka.id, quantityPerServing: 0.05, unit: 'kg', notes: 'za paniranje' },
      { menuItemName: 'Ocvrti sir s tatarsko omako', ingredientId: invTatarskaOmaka.id, quantityPerServing: 1, unit: 'kos', notes: 'tatarska omaka' },
      { menuItemName: 'Sirovi štruklji', ingredientId: invSiroviStrukelj.id, quantityPerServing: 3, unit: 'kos', notes: '3 kosi' },
      { menuItemName: 'Popečena slanina na rukoli', ingredientId: invSlanina.id, quantityPerServing: 0.15, unit: 'kg', notes: 'slanina' },
      { menuItemName: 'Popečena slanina na rukoli', ingredientId: invRukola.id, quantityPerServing: 1, unit: 'kos', notes: 'rukola' },
      { menuItemName: 'Dnevna kremna gobova juha', ingredientId: invSampinjoni.id, quantityPerServing: 0.1, unit: 'kg', notes: 'gobe' },
      { menuItemName: 'Dnevna kremna gobova juha', ingredientId: invSladkaSmetana.id, quantityPerServing: 1, unit: 'kos', notes: 'smetana' },
      { menuItemName: 'Goveja juha', ingredientId: invGovedinaZaGolaz.id, quantityPerServing: 0.05, unit: 'kg', notes: 'govedina' },
      { menuItemName: 'Goveja juha', ingredientId: invMešanaZelenjava.id, quantityPerServing: 0.1, unit: 'kg', notes: 'zelenjava' },

      // --- GLAVNE JEDI ---
      { menuItemName: 'Polnjena telečja prsa', ingredientId: invTelecjaPrsa.id, quantityPerServing: 0.3, unit: 'kg', notes: 'telečja prsa' },
      { menuItemName: 'Polnjena telečja prsa', ingredientId: invKrompir.id, quantityPerServing: 0.3, unit: 'kg', notes: 'slan krompir' },
      { menuItemName: 'Polnjena telečja prsa', ingredientId: invMešanaZelenjava.id, quantityPerServing: 0.2, unit: 'kg', notes: 'zelenjava' },
      { menuItemName: 'Pečena svinjska krača', ingredientId: invSvinjskaKraca.id, quantityPerServing: 1, unit: 'kos', notes: '1500g krača' },
      { menuItemName: 'Svinjska pečenka', ingredientId: invSvinjskaPecenko.id, quantityPerServing: 0.45, unit: 'kg', notes: '450g pečenka' },
      { menuItemName: 'Svinjska pečenka', ingredientId: invKrompir.id, quantityPerServing: 0.3, unit: 'kg', notes: 'slan krompir' },
      { menuItemName: 'Telečja pečenka', ingredientId: invTelecjaPrsa.id, quantityPerServing: 0.45, unit: 'kg', notes: '450g telečja' },
      { menuItemName: 'Rumpsteak', ingredientId: invBeefsteak.id, quantityPerServing: 0.25, unit: 'kg', notes: '250g rumpsteak' },
      { menuItemName: 'BBQ rebrca', ingredientId: invRebra.id, quantityPerServing: 0.5, unit: 'kg', notes: '500g rebra' },
      { menuItemName: 'BBQ rebrca', ingredientId: invBBQOmaka.id, quantityPerServing: 1, unit: 'kos', notes: 'BBQ omaka' },
      { menuItemName: 'Beefsteak v poprovi omaki', ingredientId: invBeefsteak.id, quantityPerServing: 0.25, unit: 'kg', notes: '250g beefsteak' },
      { menuItemName: 'Kraški beefsteak', ingredientId: invBeefsteak.id, quantityPerServing: 0.25, unit: 'kg', notes: '250g beefsteak' },
      { menuItemName: 'Kraški beefsteak', ingredientId: invPrsut.id, quantityPerServing: 0.05, unit: 'kg', notes: 'pršut' },
      { menuItemName: 'Kraški beefsteak', ingredientId: invParmezan.id, quantityPerServing: 0.03, unit: 'kg', notes: 'sir' },
      { menuItemName: 'Bograč v kotličku', ingredientId: invGovedinaBograch.id, quantityPerServing: 0.2, unit: 'kg', notes: '200g govedina' },
      { menuItemName: 'Bograč v kotličku', ingredientId: invPaprika.id, quantityPerServing: 0.1, unit: 'kg', notes: 'paprika' },
      { menuItemName: 'Bograč v kotličku', ingredientId: invCebula.id, quantityPerServing: 0.05, unit: 'kg', notes: 'čebula' },
      { menuItemName: 'Goveji golaž v kotličku', ingredientId: invGovedinaZaGolaz.id, quantityPerServing: 0.2, unit: 'kg', notes: '200g govedina' },
      { menuItemName: 'Goveji golaž v kotličku', ingredientId: invKruhoveRezine.id, quantityPerServing: 0.1, unit: 'kg', notes: 'kruhova rezina' },
      { menuItemName: 'Dunajski zrezek', ingredientId: invSvinjskiZrezek.id, quantityPerServing: 0.25, unit: 'kg', notes: '250g zrezek' },
      { menuItemName: 'Pariški zrezek', ingredientId: invSvinjskiZrezek.id, quantityPerServing: 0.25, unit: 'kg', notes: '250g zrezek' },
      { menuItemName: 'Hišni zrezek', ingredientId: invSvinjskiZrezek.id, quantityPerServing: 0.25, unit: 'kg', notes: '250g zrezek' },
      { menuItemName: 'Hišni zrezek', ingredientId: invSampinjoni.id, quantityPerServing: 0.1, unit: 'kg', notes: 'šampinjoni' },
      { menuItemName: 'Hišni zrezek', ingredientId: invSladkaSmetana.id, quantityPerServing: 1, unit: 'kos', notes: 'smetanova omaka' },
      { menuItemName: 'Kraški zrezek', ingredientId: invSvinjskiZrezek.id, quantityPerServing: 0.25, unit: 'kg', notes: '250g zrezek' },
      { menuItemName: 'Kraški zrezek', ingredientId: invKuhanPrsut.id, quantityPerServing: 0.05, unit: 'kg', notes: 'pršut' },
      { menuItemName: 'Kraški zrezek', ingredientId: invParmezan.id, quantityPerServing: 0.03, unit: 'kg', notes: 'sir' },
      { menuItemName: 'Naravni zrezek', ingredientId: invSvinjskiZrezek.id, quantityPerServing: 0.25, unit: 'kg', notes: '250g zrezek' },
      { menuItemName: 'Zrezek z gobami', ingredientId: invSvinjskiZrezek.id, quantityPerServing: 0.25, unit: 'kg', notes: '250g zrezek' },
      { menuItemName: 'Zrezek z gobami', ingredientId: invSampinjoni.id, quantityPerServing: 0.1, unit: 'kg', notes: 'gobe' },
      { menuItemName: 'Ljubljanski zrezek', ingredientId: invSvinjskiZrezek.id, quantityPerServing: 0.25, unit: 'kg', notes: '250g zrezek' },
      { menuItemName: 'Ljubljanski zrezek', ingredientId: invDomacaSunka.id, quantityPerServing: 0.05, unit: 'kg', notes: 'šunka' },
      { menuItemName: 'Ljubljanski zrezek', ingredientId: invGauda.id, quantityPerServing: 0.03, unit: 'kg', notes: 'sir' },
      { menuItemName: 'Zrezek v curry omaki', ingredientId: invSvinjskiZrezek.id, quantityPerServing: 0.25, unit: 'kg', notes: '250g zrezek' },
      { menuItemName: 'Sirov zrezek', ingredientId: invSvinjskiZrezek.id, quantityPerServing: 0.25, unit: 'kg', notes: '250g zrezek' },
      { menuItemName: 'Sirov zrezek', ingredientId: invGauda.id, quantityPerServing: 0.1, unit: 'kg', notes: 'sir' },
      { menuItemName: 'Hawaii zrezek', ingredientId: invSvinjskiZrezek.id, quantityPerServing: 0.25, unit: 'kg', notes: '250g zrezek' },
      { menuItemName: 'Hawaii zrezek', ingredientId: invAnanas.id, quantityPerServing: 1, unit: 'kos', notes: 'ananas' },
      { menuItemName: 'Tagliata na rukoli', ingredientId: invRostbeef.id, quantityPerServing: 0.25, unit: 'kg', notes: '250g rostbeef' },
      { menuItemName: 'Rostbeef', ingredientId: invRostbeef.id, quantityPerServing: 0.25, unit: 'kg', notes: '250g rostbeef' },
      { menuItemName: 'Žar tris', ingredientId: invSvinjskiZrezek.id, quantityPerServing: 0.15, unit: 'kg', notes: 'svinjski kare' },
      { menuItemName: 'Žar tris', ingredientId: invPiscancjiFile.id, quantityPerServing: 0.1, unit: 'kg', notes: 'piščančja prsa' },
      { menuItemName: 'Žar tris', ingredientId: invRostbeef.id, quantityPerServing: 0.1, unit: 'kg', notes: 'rostbeef' },
      { menuItemName: 'Ocvrt pišanec', ingredientId: invPiscanecCeli.id, quantityPerServing: 1, unit: 'kos', notes: 'cel pišanec' },
      { menuItemName: 'Pohančki', ingredientId: invPuramjiFile.id, quantityPerServing: 0.25, unit: 'kg', notes: 'puranji/piščančji' },
      { menuItemName: 'Pečenica s prilogo', ingredientId: invPecenaKlobasa.id, quantityPerServing: 0.3, unit: 'kg', notes: '300g pečenica' },
      { menuItemName: 'Pečenica s prilogo', ingredientId: invZelje.id, quantityPerServing: 0.15, unit: 'kg', notes: 'zelje' },
      { menuItemName: 'Pečenica s prilogo', ingredientId: invKrompir.id, quantityPerServing: 0.2, unit: 'kg', notes: 'krompir' },
      { menuItemName: 'Krvavica s prilogo', ingredientId: invKrvavica.id, quantityPerServing: 0.3, unit: 'kg', notes: '300g krvavica' },
      { menuItemName: 'Krvavica s prilogo', ingredientId: invZelje.id, quantityPerServing: 0.15, unit: 'kg', notes: 'zelje' },
      { menuItemName: 'Krvavica s prilogo', ingredientId: invKrompir.id, quantityPerServing: 0.2, unit: 'kg', notes: 'krompir' },

      // --- TESTENINE ---
      { menuItemName: 'Bolognese', ingredientId: invSpageti.id, quantityPerServing: 0.2, unit: 'kg', notes: '200g testenine' },
      { menuItemName: 'Bolognese', ingredientId: invMletnoMeso.id, quantityPerServing: 0.15, unit: 'kg', notes: 'mletno meso' },
      { menuItemName: 'Bolognese', ingredientId: invPelati.id, quantityPerServing: 0.2, unit: 'kg', notes: 'pelati' },
      { menuItemName: 'Carbonara', ingredientId: invSpageti.id, quantityPerServing: 0.2, unit: 'kg', notes: '200g testenine' },
      { menuItemName: 'Carbonara', ingredientId: invKuhanPrsut.id, quantityPerServing: 0.1, unit: 'kg', notes: 'pršut' },
      { menuItemName: 'Carbonara', ingredientId: invSladkaSmetana.id, quantityPerServing: 1, unit: 'kos', notes: 'smetanova omaka' },
      { menuItemName: 'Napoli', ingredientId: invSpageti.id, quantityPerServing: 0.2, unit: 'kg', notes: '200g testenine' },
      { menuItemName: 'Napoli', ingredientId: invPelati.id, quantityPerServing: 0.2, unit: 'kg', notes: 'pelati' },
      { menuItemName: 'Z gobami', ingredientId: invSpageti.id, quantityPerServing: 0.2, unit: 'kg', notes: '200g testenine' },
      { menuItemName: 'Z gobami', ingredientId: invSampinjoni.id, quantityPerServing: 0.15, unit: 'kg', notes: 'gobe' },
      { menuItemName: 'S tartufi', ingredientId: invSpageti.id, quantityPerServing: 0.2, unit: 'kg', notes: '200g testenine' },
      { menuItemName: 'S tartufi', ingredientId: invTartufi.id, quantityPerServing: 1, unit: 'kos', notes: 'tartufi' },
      { menuItemName: 'S tartufi', ingredientId: invSladkaSmetana.id, quantityPerServing: 1, unit: 'kos', notes: 'smetanova omaka' },
      { menuItemName: 'V gorgonzolini omaki', ingredientId: invSpageti.id, quantityPerServing: 0.2, unit: 'kg', notes: '200g testenine' },
      { menuItemName: 'V gorgonzolini omaki', ingredientId: invGorgonzola.id, quantityPerServing: 0.1, unit: 'kg', notes: 'gorgonzola' },
      { menuItemName: 'S puranom v smetanovi omaki', ingredientId: invSpageti.id, quantityPerServing: 0.2, unit: 'kg', notes: '200g testenine' },
      { menuItemName: 'S puranom v smetanovi omaki', ingredientId: invPuramjiFile.id, quantityPerServing: 0.15, unit: 'kg', notes: 'puran' },
      { menuItemName: 'S puranom v smetanovi omaki', ingredientId: invSladkaSmetana.id, quantityPerServing: 1, unit: 'kos', notes: 'smetana' },
      { menuItemName: 'S puranom v curry omaki', ingredientId: invSpageti.id, quantityPerServing: 0.2, unit: 'kg', notes: '200g testenine' },
      { menuItemName: 'S puranom v curry omaki', ingredientId: invPuramjiFile.id, quantityPerServing: 0.15, unit: 'kg', notes: 'puran' },
      { menuItemName: 'S puranom v curry omaki', ingredientId: invCurryPrah.id, quantityPerServing: 1, unit: 'kos', notes: 'curry' },
      { menuItemName: 'V smetanovi omaki', ingredientId: invSpageti.id, quantityPerServing: 0.2, unit: 'kg', notes: '200g testenine' },
      { menuItemName: 'V smetanovi omaki', ingredientId: invSladkaSmetana.id, quantityPerServing: 1, unit: 'kos', notes: 'smetana' },
      { menuItemName: 'Z morskimi sadeži', ingredientId: invSpageti.id, quantityPerServing: 0.2, unit: 'kg', notes: '200g testenine' },
      { menuItemName: 'Z morskimi sadeži', ingredientId: invKalamari.id, quantityPerServing: 0.1, unit: 'kg', notes: 'kalamari' },
      { menuItemName: 'Z morskimi sadeži', ingredientId: invGamberi.id, quantityPerServing: 0.1, unit: 'kg', notes: 'gamberi' },
      { menuItemName: 'Z morskimi sadeži v smetanovi omaki', ingredientId: invSpageti.id, quantityPerServing: 0.2, unit: 'kg', notes: '200g testenine' },
      { menuItemName: 'Z morskimi sadeži v smetanovi omaki', ingredientId: invKalamari.id, quantityPerServing: 0.1, unit: 'kg', notes: 'kalamari' },
      { menuItemName: 'Z morskimi sadeži v smetanovi omaki', ingredientId: invSladkaSmetana.id, quantityPerServing: 1, unit: 'kos', notes: 'smetana' },
      { menuItemName: 'S pljučno pečenko in zelenjavo', ingredientId: invSpageti.id, quantityPerServing: 0.2, unit: 'kg', notes: '200g testenine' },
      { menuItemName: 'S pljučno pečenko in zelenjavo', ingredientId: invPljucnaPecenka.id, quantityPerServing: 0.2, unit: 'kg', notes: 'pljučna pečenka' },
      { menuItemName: 'Sicilijana', ingredientId: invSpageti.id, quantityPerServing: 0.2, unit: 'kg', notes: '200g testenine' },
      { menuItemName: 'Sicilijana', ingredientId: invMozzarella.id, quantityPerServing: 0.1, unit: 'kg', notes: 'moccarela' },
      { menuItemName: 'Sicilijana', ingredientId: invMelancani.id, quantityPerServing: 0.1, unit: 'kg', notes: 'melancani' },
      { menuItemName: 'Z gamberi na rdeče ali belo', ingredientId: invSpageti.id, quantityPerServing: 0.2, unit: 'kg', notes: '200g testenine' },
      { menuItemName: 'Z gamberi na rdeče ali belo', ingredientId: invGamberi.id, quantityPerServing: 0.15, unit: 'kg', notes: 'gamberi' },
      { menuItemName: 'S piščancem', ingredientId: invSpageti.id, quantityPerServing: 0.2, unit: 'kg', notes: '200g testenine' },
      { menuItemName: 'S piščancem', ingredientId: invPiscancjiFile.id, quantityPerServing: 0.15, unit: 'kg', notes: 'piščanec' },
      { menuItemName: 'S piščancem', ingredientId: invMozzarella.id, quantityPerServing: 0.1, unit: 'kg', notes: 'moccarela' },
      { menuItemName: 'Pad Thai z zelenjavo', ingredientId: invRizeviRezanci.id, quantityPerServing: 0.2, unit: 'kg', notes: 'riževi rezanci' },
      { menuItemName: 'Pad Thai z zelenjavo', ingredientId: invBucke.id, quantityPerServing: 0.05, unit: 'kg', notes: 'bučke' },
      { menuItemName: 'Pad Thai z zelenjavo', ingredientId: invKorenje.id, quantityPerServing: 0.05, unit: 'kg', notes: 'korenje' },
      { menuItemName: 'Pad Thai z zelenjavo', ingredientId: invJajca.id, quantityPerServing: 1, unit: 'kos', notes: '1 jajce' },
      { menuItemName: 'Pad Thai z zelenjavo', ingredientId: invArasidi.id, quantityPerServing: 0.03, unit: 'kg', notes: 'arašidi' },
      { menuItemName: 'Pad Thai s piščancem', ingredientId: invRizeviRezanci.id, quantityPerServing: 0.2, unit: 'kg', notes: 'riževi rezanci' },
      { menuItemName: 'Pad Thai s piščancem', ingredientId: invPiscancjiFile.id, quantityPerServing: 0.15, unit: 'kg', notes: 'piščanec' },
      { menuItemName: 'Pad Thai s piščancem', ingredientId: invBucke.id, quantityPerServing: 0.05, unit: 'kg', notes: 'bučke' },
      { menuItemName: 'Pad Thai s piščancem', ingredientId: invJajca.id, quantityPerServing: 1, unit: 'kos', notes: '1 jajce' },
      { menuItemName: 'Pad Thai s piščancem', ingredientId: invArasidi.id, quantityPerServing: 0.03, unit: 'kg', notes: 'arašidi' },

      // --- RIŽOTE ---
      { menuItemName: 'Morska rižota', ingredientId: invRiz.id, quantityPerServing: 0.2, unit: 'kg', notes: 'riž' },
      { menuItemName: 'Morska rižota', ingredientId: invKalamari.id, quantityPerServing: 0.1, unit: 'kg', notes: 'kalamari' },
      { menuItemName: 'Morska rižota', ingredientId: invGamberi.id, quantityPerServing: 0.1, unit: 'kg', notes: 'gamberi' },
      { menuItemName: 'Rižota z gobami', ingredientId: invRiz.id, quantityPerServing: 0.2, unit: 'kg', notes: 'riž' },
      { menuItemName: 'Rižota z gobami', ingredientId: invSampinjoni.id, quantityPerServing: 0.15, unit: 'kg', notes: 'gobe' },
      { menuItemName: 'Rižota s puranom in papriko', ingredientId: invRiz.id, quantityPerServing: 0.2, unit: 'kg', notes: 'riž' },
      { menuItemName: 'Rižota s puranom in papriko', ingredientId: invPuramjiFile.id, quantityPerServing: 0.15, unit: 'kg', notes: 'puran' },
      { menuItemName: 'Rižota s puranom in papriko', ingredientId: invPaprika.id, quantityPerServing: 0.1, unit: 'kg', notes: 'paprika' },
      { menuItemName: 'Zelenjavna rižota', ingredientId: invRiz.id, quantityPerServing: 0.2, unit: 'kg', notes: 'riž' },
      { menuItemName: 'Zelenjavna rižota', ingredientId: invMešanaZelenjava.id, quantityPerServing: 0.2, unit: 'kg', notes: 'zelenjava' },
      { menuItemName: 'Rižota z gamberi in mešanimi gobami', ingredientId: invRiz.id, quantityPerServing: 0.2, unit: 'kg', notes: 'riž' },
      { menuItemName: 'Rižota z gamberi in mešanimi gobami', ingredientId: invGamberi.id, quantityPerServing: 0.1, unit: 'kg', notes: 'gamberi' },
      { menuItemName: 'Rižota z gamberi in mešanimi gobami', ingredientId: invSampinjoni.id, quantityPerServing: 0.1, unit: 'kg', notes: 'gobe' },

      // --- KALAMARI ---
      { menuItemName: 'Ocvrti kalamari', ingredientId: invKalamari.id, quantityPerServing: 0.2, unit: 'kg', notes: '200g kalamari' },
      { menuItemName: 'Ocvrti kalamari', ingredientId: invMoka.id, quantityPerServing: 0.05, unit: 'kg', notes: 'za paniranje' },
      { menuItemName: 'Ocvrti kalamari', ingredientId: invTatarskaOmaka.id, quantityPerServing: 1, unit: 'kos', notes: 'tatarska omaka' },
      { menuItemName: 'Kalamari na žaru', ingredientId: invKalamari.id, quantityPerServing: 0.3, unit: 'kg', notes: '300g kalamari' },
      { menuItemName: 'Kalamari na žaru', ingredientId: invKrompir.id, quantityPerServing: 0.2, unit: 'kg', notes: 'slan krompir' },
      { menuItemName: 'Kalamari na žaru', ingredientId: invBlitva.id, quantityPerServing: 0.1, unit: 'kg', notes: 'blitva' },
      { menuItemName: 'Polnjeni kalamari po dunajsko', ingredientId: invKalamari.id, quantityPerServing: 0.25, unit: 'kg', notes: '250g kalamari' },
      { menuItemName: 'Polnjeni kalamari po dunajsko', ingredientId: invGauda.id, quantityPerServing: 0.05, unit: 'kg', notes: 'sir' },
      { menuItemName: 'Polnjeni kalamari po dunajsko', ingredientId: invKuhanPrsut.id, quantityPerServing: 0.05, unit: 'kg', notes: 'pršut' },

      // --- RIBJE JEDI ---
      { menuItemName: 'Losos', ingredientId: invLosos.id, quantityPerServing: 0.3, unit: 'kg', notes: '300g losos' },
      { menuItemName: 'Losos', ingredientId: invKrompir.id, quantityPerServing: 0.2, unit: 'kg', notes: 'slan krompir' },
      { menuItemName: 'Losos', ingredientId: invBlitva.id, quantityPerServing: 0.1, unit: 'kg', notes: 'blitva' },
      { menuItemName: 'Gamberi po pariško', ingredientId: invGamberi.id, quantityPerServing: 0.2, unit: 'kg', notes: '200g gamberi' },
      { menuItemName: 'Ocvrt oslič s prilogo', ingredientId: invOslic.id, quantityPerServing: 0.3, unit: 'kg', notes: '300g oslič' },
      { menuItemName: 'Ocvrt oslič s prilogo', ingredientId: invPommesFrites.id, quantityPerServing: 0.2, unit: 'kg', notes: 'pomfri' },
      { menuItemName: 'File postrvi', ingredientId: invFilePostrvi.id, quantityPerServing: 0.3, unit: 'kg', notes: '300g postrv' },
      { menuItemName: 'File orade', ingredientId: invFileOrade.id, quantityPerServing: 0.3, unit: 'kg', notes: '300g orada' },
      { menuItemName: 'File brancina na žaru', ingredientId: invFileBrancina.id, quantityPerServing: 0.3, unit: 'kg', notes: '300g brancin' },

      // --- SOLATE ---
      { menuItemName: 'Solata Kraljica', ingredientId: invSolata.id, quantityPerServing: 0.3, unit: 'kg', notes: 'mešana solata' },
      { menuItemName: 'Solata Kraljica', ingredientId: invGauda.id, quantityPerServing: 0.05, unit: 'kg', notes: 'sir' },
      { menuItemName: 'Solata Kraljica', ingredientId: invTatarskaOmaka.id, quantityPerServing: 1, unit: 'kos', notes: 'tatarska omaka' },
      { menuItemName: 'Cezarjeva solata', ingredientId: invSolata.id, quantityPerServing: 0.2, unit: 'kg', notes: 'solata' },
      { menuItemName: 'Cezarjeva solata', ingredientId: invPiscancjiFile.id, quantityPerServing: 0.15, unit: 'kg', notes: 'piščanec' },
      { menuItemName: 'Cezarjeva solata', ingredientId: invParmezan.id, quantityPerServing: 0.03, unit: 'kg', notes: 'parmezan' },
      { menuItemName: 'Grška solata', ingredientId: invSolata.id, quantityPerServing: 0.15, unit: 'kg', notes: 'solata' },
      { menuItemName: 'Grška solata', ingredientId: invParadiznik.id, quantityPerServing: 0.1, unit: 'kg', notes: 'paradižnik' },
      { menuItemName: 'Grška solata', ingredientId: invFetaSir.id, quantityPerServing: 0.1, unit: 'kg', notes: 'feta sir' },
      { menuItemName: 'Grška solata', ingredientId: invOlive.id, quantityPerServing: 0.03, unit: 'kg', notes: 'olive' },
      { menuItemName: 'Solata rukola s parmezanom', ingredientId: invRukola.id, quantityPerServing: 1, unit: 'kos', notes: 'rukola' },
      { menuItemName: 'Solata rukola s parmezanom', ingredientId: invParmezan.id, quantityPerServing: 0.03, unit: 'kg', notes: 'parmezan' },
      { menuItemName: 'Mešana solata s tuno', ingredientId: invSolata.id, quantityPerServing: 0.3, unit: 'kg', notes: 'mešana solata' },
      { menuItemName: 'Mešana solata s tuno', ingredientId: invTunaKos.id, quantityPerServing: 0.15, unit: 'kg', notes: 'tuna' },

      // --- PIZZE ---
      { menuItemName: 'Margerita', ingredientId: invTestoZaPico.id, quantityPerServing: 1, unit: 'kg', notes: '1 testo' },
      { menuItemName: 'Margerita', ingredientId: invPelati.id, quantityPerServing: 0.1, unit: 'kg', notes: 'pelati' },
      { menuItemName: 'Margerita', ingredientId: invMozzarella.id, quantityPerServing: 0.15, unit: 'kg', notes: 'mozzarella' },
      { menuItemName: 'Hišna pica', ingredientId: invTestoZaPico.id, quantityPerServing: 1, unit: 'kg', notes: '1 testo' },
      { menuItemName: 'Hišna pica', ingredientId: invPelati.id, quantityPerServing: 0.1, unit: 'kg', notes: 'pelati' },
      { menuItemName: 'Hišna pica', ingredientId: invMozzarella.id, quantityPerServing: 0.15, unit: 'kg', notes: 'mozzarella' },
      { menuItemName: 'Hišna pica', ingredientId: invKuhanPrsut.id, quantityPerServing: 0.05, unit: 'kg', notes: 'kuhan pršut' },
      { menuItemName: 'Hišna pica', ingredientId: invDomacaSunka.id, quantityPerServing: 0.05, unit: 'kg', notes: 'domača šunka' },
      { menuItemName: 'Hišna pica', ingredientId: invSuhaSalama.id, quantityPerServing: 0.05, unit: 'kg', notes: 'salama' },
      { menuItemName: 'Hišna pica', ingredientId: invSlanina.id, quantityPerServing: 0.05, unit: 'kg', notes: 'slanina' },
      { menuItemName: 'Hišna pica', ingredientId: invSampinjoni.id, quantityPerServing: 0.05, unit: 'kg', notes: 'gobe' },
      { menuItemName: 'Kraška', ingredientId: invTestoZaPico.id, quantityPerServing: 1, unit: 'kg', notes: '1 testo' },
      { menuItemName: 'Kraška', ingredientId: invPelati.id, quantityPerServing: 0.1, unit: 'kg', notes: 'pelati' },
      { menuItemName: 'Kraška', ingredientId: invMozzarella.id, quantityPerServing: 0.15, unit: 'kg', notes: 'mozzarella' },
      { menuItemName: 'Kraška', ingredientId: invPrsut.id, quantityPerServing: 0.05, unit: 'kg', notes: 'pršut' },
      { menuItemName: 'Kraška', ingredientId: invSampinjoni.id, quantityPerServing: 0.05, unit: 'kg', notes: 'gobe' },
      { menuItemName: 'S tuno', ingredientId: invTestoZaPico.id, quantityPerServing: 1, unit: 'kg', notes: '1 testo' },
      { menuItemName: 'S tuno', ingredientId: invPelati.id, quantityPerServing: 0.1, unit: 'kg', notes: 'pelati' },
      { menuItemName: 'S tuno', ingredientId: invMozzarella.id, quantityPerServing: 0.15, unit: 'kg', notes: 'mozzarella' },
      { menuItemName: 'S tuno', ingredientId: invTunaKos.id, quantityPerServing: 0.1, unit: 'kg', notes: 'tuna' },
      { menuItemName: 'Štirje siri', ingredientId: invTestoZaPico.id, quantityPerServing: 1, unit: 'kg', notes: '1 testo' },
      { menuItemName: 'Štirje siri', ingredientId: invMozzarella.id, quantityPerServing: 0.1, unit: 'kg', notes: 'mozzarella' },
      { menuItemName: 'Štirje siri', ingredientId: invGorgonzola.id, quantityPerServing: 0.05, unit: 'kg', notes: 'gorgonzola' },
      { menuItemName: 'Štirje siri', ingredientId: invGauda.id, quantityPerServing: 0.05, unit: 'kg', notes: 'gauda' },
      { menuItemName: 'Štirje siri', ingredientId: invEdamec.id, quantityPerServing: 0.05, unit: 'kg', notes: 'edamec' },

      // --- BURGERJI ---
      { menuItemName: 'Hišni burger', ingredientId: invBurgerPatty.id, quantityPerServing: 1, unit: 'kos', notes: '170g goveji patty' },
      { menuItemName: 'Hišni burger', ingredientId: invKozjiSir.id, quantityPerServing: 0.05, unit: 'kg', notes: 'kozji sir' },
      { menuItemName: 'Hišni burger', ingredientId: invSlanina.id, quantityPerServing: 0.05, unit: 'kg', notes: 'slanina' },
      { menuItemName: 'Hišni burger', ingredientId: invCebula.id, quantityPerServing: 0.03, unit: 'kg', notes: 'karamelizirana čebula' },
      { menuItemName: 'The classic', ingredientId: invBurgerPatty.id, quantityPerServing: 1, unit: 'kos', notes: '170g goveji patty' },
      { menuItemName: 'The classic', ingredientId: invCheddarSir.id, quantityPerServing: 0.05, unit: 'kg', notes: 'cheddar' },
      { menuItemName: 'The classic', ingredientId: invSolata.id, quantityPerServing: 0.03, unit: 'kg', notes: 'solata' },
      { menuItemName: 'Big BOSS', ingredientId: invBurgerPatty.id, quantityPerServing: 1, unit: 'kos', notes: '170g goveji patty' },
      { menuItemName: 'Big BOSS', ingredientId: invRostbeef.id, quantityPerServing: 0.05, unit: 'kg', notes: 'rostbeef' },
      { menuItemName: 'Big BOSS', ingredientId: invTartufi.id, quantityPerServing: 1, unit: 'kos', notes: 'tartufina majoneza' },
      { menuItemName: 'Cheese please', ingredientId: invBurgerPatty.id, quantityPerServing: 1, unit: 'kos', notes: '170g goveji patty' },
      { menuItemName: 'Cheese please', ingredientId: invCheddarSir.id, quantityPerServing: 0.05, unit: 'kg', notes: 'cheddar' },
      { menuItemName: 'Green garden', ingredientId: invBurgerPatty.id, quantityPerServing: 1, unit: 'kos', notes: '170g patty' },
      { menuItemName: 'Green garden', ingredientId: invPesto.id, quantityPerServing: 1, unit: 'kos', notes: 'bazilični pesto' },
      { menuItemName: 'Green garden', ingredientId: invBucke.id, quantityPerServing: 0.05, unit: 'kg', notes: 'bučke' },
      { menuItemName: 'Crispy chicken burger', ingredientId: invPiscancjiFile.id, quantityPerServing: 0.18, unit: 'kg', notes: '180g piščančja prsa' },
      { menuItemName: 'Crispy chicken burger', ingredientId: invCheddarSir.id, quantityPerServing: 0.05, unit: 'kg', notes: 'sir' },
      { menuItemName: 'Fit burger', ingredientId: invPiscancjiFile.id, quantityPerServing: 0.18, unit: 'kg', notes: '180g piščančja prsa' },
      { menuItemName: 'Fit burger', ingredientId: invBucke.id, quantityPerServing: 0.05, unit: 'kg', notes: 'bučke' },
      { menuItemName: 'Fit burger', ingredientId: invJajca.id, quantityPerServing: 1, unit: 'kos', notes: '1 jajce' },

      // --- VEGETARIJANSKE ---
      { menuItemName: 'Zelenjavni zrezki', ingredientId: invMešanaZelenjava.id, quantityPerServing: 0.2, unit: 'kg', notes: 'zelenjava' },
      { menuItemName: 'Sojini polpeti', ingredientId: invMletnoMeso.id, quantityPerServing: 0.15, unit: 'kg', notes: 'sojini polpeti' },
      { menuItemName: 'Bučke na žaru', ingredientId: invBucke.id, quantityPerServing: 0.25, unit: 'kg', notes: 'bučke' },
      { menuItemName: 'Bučke na žaru', ingredientId: invCesen.id, quantityPerServing: 0.01, unit: 'kg', notes: 'česen' },
      { menuItemName: 'Bučke na žaru', ingredientId: invOlivnoOlje.id, quantityPerServing: 0.02, unit: 'L', notes: 'olivno olje' },
      { menuItemName: 'Ocvrte bučke', ingredientId: invBucke.id, quantityPerServing: 0.25, unit: 'kg', notes: 'bučke' },
      { menuItemName: 'Ocvrti melancani', ingredientId: invMelancani.id, quantityPerServing: 0.25, unit: 'kg', notes: 'melancani' },
      { menuItemName: 'Vegetarijanska plošča', ingredientId: invMešanaZelenjava.id, quantityPerServing: 0.2, unit: 'kg', notes: 'zelenjava' },
      { menuItemName: 'Vegetarijanska plošča', ingredientId: invSampinjoni.id, quantityPerServing: 0.1, unit: 'kg', notes: 'šampinjoni' },

      // --- PALAČINKE ---
      { menuItemName: 'Hišna sladica', ingredientId: invMokaPalacinke.id, quantityPerServing: 0.1, unit: 'kg', notes: 'moka' },
      { menuItemName: 'Hišna sladica', ingredientId: invJajca.id, quantityPerServing: 1, unit: 'kos', notes: '1 jajce' },
      { menuItemName: 'Hišna sladica', ingredientId: invJagodniPire.id, quantityPerServing: 0.05, unit: 'kg', notes: 'jagodni pire' },
      { menuItemName: 'Hišna sladica', ingredientId: invLinoLada.id, quantityPerServing: 0.03, unit: 'kg', notes: 'Lino Lada' },
      { menuItemName: 'Hišna sladica', ingredientId: invBelaCokolada.id, quantityPerServing: 0.03, unit: 'kg', notes: 'bela čokolada' },
      { menuItemName: 'Hišna sladica', ingredientId: invPlazmaPiskot.id, quantityPerServing: 0.02, unit: 'kg', notes: 'Plazma biskvit' },
      { menuItemName: 'Raffaello', ingredientId: invMokaPalacinke.id, quantityPerServing: 0.1, unit: 'kg', notes: 'moka' },
      { menuItemName: 'Raffaello', ingredientId: invJajca.id, quantityPerServing: 1, unit: 'kos', notes: '1 jajce' },
      { menuItemName: 'Raffaello', ingredientId: invBelaCokolada.id, quantityPerServing: 0.03, unit: 'kg', notes: 'bela čokolada' },
      { menuItemName: 'Raffaello', ingredientId: invLinoLada.id, quantityPerServing: 0.03, unit: 'kg', notes: 'Lino Lada' },
      { menuItemName: 'Raffaello', ingredientId: invMandlji.id, quantityPerServing: 0.02, unit: 'kg', notes: 'mandlji' },
      { menuItemName: 'Raffaello', ingredientId: invKokosovaMoka.id, quantityPerServing: 0.02, unit: 'kg', notes: 'kokosova moka' },
      { menuItemName: 'Raffaello', ingredientId: invRaffaello.id, quantityPerServing: 1, unit: 'kos', notes: 'Raffaello kroglica' },
      { menuItemName: 'Kinder Bueno', ingredientId: invMokaPalacinke.id, quantityPerServing: 0.1, unit: 'kg', notes: 'moka kakavova' },
      { menuItemName: 'Kinder Bueno', ingredientId: invJajca.id, quantityPerServing: 1, unit: 'kos', notes: '1 jajce' },
      { menuItemName: 'Kinder Bueno', ingredientId: invKakavZaPalačinke.id, quantityPerServing: 0.02, unit: 'kg', notes: 'kakav' },
      { menuItemName: 'Kinder Bueno', ingredientId: invNutella.id, quantityPerServing: 0.03, unit: 'kg', notes: 'čokoladno-lešnikova krema' },
      { menuItemName: 'Kinder Bueno', ingredientId: invKinderBueno.id, quantityPerServing: 1, unit: 'kos', notes: 'Kinder Bueno' },
      { menuItemName: 'Snickers', ingredientId: invMokaPalacinke.id, quantityPerServing: 0.1, unit: 'kg', notes: 'moka kakavova' },
      { menuItemName: 'Snickers', ingredientId: invJajca.id, quantityPerServing: 1, unit: 'kos', notes: '1 jajce' },
      { menuItemName: 'Snickers', ingredientId: invKakavZaPalačinke.id, quantityPerServing: 0.02, unit: 'kg', notes: 'kakav' },
      { menuItemName: 'Snickers', ingredientId: invArasidi.id, quantityPerServing: 0.03, unit: 'kg', notes: 'arašidi' },
      { menuItemName: 'Snickers', ingredientId: invSnickers.id, quantityPerServing: 1, unit: 'kos', notes: 'Snickers' },
      { menuItemName: 'Ferrero Rocher', ingredientId: invMokaPalacinke.id, quantityPerServing: 0.1, unit: 'kg', notes: 'moka kakavova' },
      { menuItemName: 'Ferrero Rocher', ingredientId: invJajca.id, quantityPerServing: 1, unit: 'kos', notes: '1 jajce' },
      { menuItemName: 'Ferrero Rocher', ingredientId: invNutella.id, quantityPerServing: 0.03, unit: 'kg', notes: 'čokoladno-lešnikova krema' },
      { menuItemName: 'Ferrero Rocher', ingredientId: invMandlji.id, quantityPerServing: 0.02, unit: 'kg', notes: 'lešniki' },
      { menuItemName: 'Ferrero Rocher', ingredientId: invFerreroRocher.id, quantityPerServing: 1, unit: 'kos', notes: 'Ferrero Rocher' },
      { menuItemName: "M&M's", ingredientId: invMokaPalacinke.id, quantityPerServing: 0.1, unit: 'kg', notes: 'moka kakavova' },
      { menuItemName: "M&M's", ingredientId: invJajca.id, quantityPerServing: 1, unit: 'kos', notes: '1 jajce' },
      { menuItemName: "M&M's", ingredientId: invNutella.id, quantityPerServing: 0.03, unit: 'kg', notes: 'Nutella' },
      { menuItemName: "M&M's", ingredientId: invMandM.id, quantityPerServing: 0.02, unit: 'kg', notes: "M&M's" },

      // --- OTROŠKE JEDI ---
      { menuItemName: 'Krožnik Miškolin', ingredientId: invGauda.id, quantityPerServing: 0.15, unit: 'kg', notes: 'ocvrti sir' },
      { menuItemName: 'Krožnik Miškolin', ingredientId: invPommesFrites.id, quantityPerServing: 0.15, unit: 'kg', notes: 'pomfri' },
      { menuItemName: 'Krožnik Korenjak', ingredientId: invSvinjskiZrezek.id, quantityPerServing: 0.15, unit: 'kg', notes: 'dunajski zrezek' },
      { menuItemName: 'Krožnik Korenjak', ingredientId: invPommesFrites.id, quantityPerServing: 0.15, unit: 'kg', notes: 'pomfri' },
      { menuItemName: 'Otroški pohančki', ingredientId: invPuramjiFile.id, quantityPerServing: 0.15, unit: 'kg', notes: 'puran/piščanec' },
      { menuItemName: 'Otroški pohančki', ingredientId: invPommesFrites.id, quantityPerServing: 0.15, unit: 'kg', notes: 'pomfri' },
      { menuItemName: 'Pizza Malček', ingredientId: invTestoZaPico.id, quantityPerServing: 0.5, unit: 'kg', notes: 'manjše testo' },
      { menuItemName: 'Pizza Malček', ingredientId: invPelati.id, quantityPerServing: 0.05, unit: 'kg', notes: 'pelati' },
      { menuItemName: 'Pizza Malček', ingredientId: invMozzarella.id, quantityPerServing: 0.1, unit: 'kg', notes: 'mozzarella' },

      // --- MALICE (Dnevno kosilo) ---
      { menuItemName: 'Malica - Dunajski zrezek', ingredientId: invSvinjskiZrezek.id, quantityPerServing: 0.20, unit: 'kg', notes: '200g zrezek' },
      { menuItemName: 'Malica - Dunajski zrezek', ingredientId: invMoka.id, quantityPerServing: 0.03, unit: 'kg', notes: 'paniranje' },
      { menuItemName: 'Malica - Dunajski zrezek', ingredientId: invPommesFrites.id, quantityPerServing: 0.15, unit: 'kg', notes: 'pomfri' },
      { menuItemName: 'Malica - Dunajski zrezek', ingredientId: invSolata.id, quantityPerServing: 0.1, unit: 'kg', notes: 'solata' },
      { menuItemName: 'Malica - Pariški zrezek', ingredientId: invSvinjskiZrezek.id, quantityPerServing: 0.20, unit: 'kg', notes: '200g zrezek' },
      { menuItemName: 'Malica - Pariški zrezek', ingredientId: invMoka.id, quantityPerServing: 0.03, unit: 'kg', notes: 'paniranje' },
      { menuItemName: 'Malica - Pariški zrezek', ingredientId: invJajca.id, quantityPerServing: 1, unit: 'kos', notes: '1 jajce' },
      { menuItemName: 'Malica - Pariški zrezek', ingredientId: invPommesFrites.id, quantityPerServing: 0.15, unit: 'kg', notes: 'pomfri' },
      { menuItemName: 'Malica - Pečena rebra', ingredientId: invRebra.id, quantityPerServing: 0.30, unit: 'kg', notes: '300g rebra' },
      { menuItemName: 'Malica - Pečena rebra', ingredientId: invKrompir.id, quantityPerServing: 0.25, unit: 'kg', notes: 'pražen krompir' },
      { menuItemName: 'Malica - Pečena rebra', ingredientId: invSolata.id, quantityPerServing: 0.1, unit: 'kg', notes: 'solata' },
      { menuItemName: 'Malica - BBQ perutničke', ingredientId: invPiscancjiFile.id, quantityPerServing: 0.25, unit: 'kg', notes: 'piščančje perutničke' },
      { menuItemName: 'Malica - BBQ perutničke', ingredientId: invBBQOmaka.id, quantityPerServing: 0.05, unit: 'L', notes: 'BBQ omaka' },
      { menuItemName: 'Malica - BBQ perutničke', ingredientId: invPommesFrites.id, quantityPerServing: 0.15, unit: 'kg', notes: 'pomfri' },
      { menuItemName: 'Malica - Svinjska pečenka', ingredientId: invSvinjskaPecenko.id, quantityPerServing: 0.30, unit: 'kg', notes: '300g pečenka' },
      { menuItemName: 'Malica - Svinjska pečenka', ingredientId: invKrompir.id, quantityPerServing: 0.25, unit: 'kg', notes: 'pražen krompir' },
      { menuItemName: 'Malica - Svinjska pečenka', ingredientId: invSolata.id, quantityPerServing: 0.1, unit: 'kg', notes: 'solata' },
      { menuItemName: 'Malica - Ocvrti oslič', ingredientId: invOslic.id, quantityPerServing: 0.20, unit: 'kg', notes: '200g oslič' },
      { menuItemName: 'Malica - Ocvrti oslič', ingredientId: invMoka.id, quantityPerServing: 0.03, unit: 'kg', notes: 'paniranje' },
      { menuItemName: 'Malica - Ocvrti oslič', ingredientId: invKrompir.id, quantityPerServing: 0.20, unit: 'kg', notes: 'krompirjeva solata' },
      { menuItemName: 'Malica - Ocvrti oslič s pomfrijem', ingredientId: invOslic.id, quantityPerServing: 0.15, unit: 'kg', notes: '150g oslič' },
      { menuItemName: 'Malica - Ocvrti oslič s pomfrijem', ingredientId: invMoka.id, quantityPerServing: 0.03, unit: 'kg', notes: 'paniranje' },
      { menuItemName: 'Malica - Ocvrti oslič s pomfrijem', ingredientId: invPommesFrites.id, quantityPerServing: 0.15, unit: 'kg', notes: 'pomfri' },
      { menuItemName: 'Malica - Ocvrti sir', ingredientId: invGauda.id, quantityPerServing: 0.15, unit: 'kg', notes: 'ocvrti sir' },
      { menuItemName: 'Malica - Ocvrti sir', ingredientId: invSolata.id, quantityPerServing: 0.1, unit: 'kg', notes: 'solata' },
      { menuItemName: 'Malica - Špageti bolognese', ingredientId: invSpageti.id, quantityPerServing: 0.15, unit: 'kg', notes: 'špageti' },
      { menuItemName: 'Malica - Špageti bolognese', ingredientId: invMletnoMeso.id, quantityPerServing: 0.10, unit: 'kg', notes: 'bolognese omaka' },
      { menuItemName: 'Malica - Špageti bolognese', ingredientId: invParadiznik.id, quantityPerServing: 0.05, unit: 'kg', notes: 'paradižnikova omaka' },
      { menuItemName: 'Malica - Mesni sir', ingredientId: invMletnoMeso.id, quantityPerServing: 0.15, unit: 'kg', notes: 'mesni sir' },
      { menuItemName: 'Malica - Mesni sir', ingredientId: invGauda.id, quantityPerServing: 0.05, unit: 'kg', notes: 'sir' },
      { menuItemName: 'Malica - Mesni sir', ingredientId: invSampinjoni.id, quantityPerServing: 0.03, unit: 'kg', notes: 'šampinjoni' },
      { menuItemName: 'Malica - Bograč', ingredientId: invGovedinaBograch.id, quantityPerServing: 0.15, unit: 'kg', notes: 'govedina' },
      { menuItemName: 'Malica - Bograč', ingredientId: invParadiznik.id, quantityPerServing: 0.05, unit: 'kg', notes: 'paradižnik' },
      { menuItemName: 'Malica - Bograč', ingredientId: invCebula.id, quantityPerServing: 0.03, unit: 'kg', notes: 'čebula' },
      { menuItemName: 'Malica - Bograč', ingredientId: invPaprika.id, quantityPerServing: 0.03, unit: 'kg', notes: 'paprika' },
      { menuItemName: 'Malica - Goveji golaž', ingredientId: invGovedinaZaGolaz.id, quantityPerServing: 0.15, unit: 'kg', notes: 'govedina' },
      { menuItemName: 'Malica - Goveji golaž', ingredientId: invCebula.id, quantityPerServing: 0.03, unit: 'kg', notes: 'čebula' },
      { menuItemName: 'Malica - Goveji golaž', ingredientId: invParadiznik.id, quantityPerServing: 0.03, unit: 'kg', notes: 'paradižnikova omaka' },
    ]

    for (const recipe of foodRecipes) {
      const menuItem = mi(recipe.menuItemName)
      if (!menuItem) {
        errors.push(`HRANA: Menu item "${recipe.menuItemName}" ni bil najden`)
        continue
      }
      try {
        await db.recipeItem.create({
          data: {
            menuItemId: menuItem.id,
            inventoryItemId: recipe.ingredientId,
            quantityPerServing: recipe.quantityPerServing,
            unit: recipe.unit,
            notes: recipe.notes || '',
          }
        })
        createdCount++
      } catch (e: any) {
        if (!e.message?.includes('Unique')) {
          errors.push(`HRANA: Napaka pri "${recipe.menuItemName}": ${e.message}`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Normativi uspešno naloženi! ${createdCount} receptov ustvarjenih (vključno s hrano).`,
      stats: {
        inventoryItems: await db.inventoryItem.count(),
        recipeItems: await db.recipeItem.count(),
        menuItemsWithRecipe: (await db.recipeItem.groupBy({ by: ['menuItemId'] })).length,
      },
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Seed-norms error:', error)
    return NextResponse.json({ error: 'Napaka pri nalaganju normativov: ' + String(error) }, { status: 500 })
  }
}
