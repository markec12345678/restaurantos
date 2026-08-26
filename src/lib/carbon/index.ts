// ============================================
// Carbon footprint calculation engine
// ============================================
// Izračuna CO2e za jedi na podlagi sestavin (LCA database)
// Vir podatkov: Agribalyse 3.1 (francoska LCA baza, 2500+ živil)
// ============================================

import { db } from '@/lib/db'
import { toNum, round2, multiply } from '@/lib/decimal'

// Default CO2e faktorji (kg CO2e per kg) — če baza ni seedana
const DEFAULT_FACTORS: Record<string, number> = {
  // Meso
  'goveje meso': 27.0, 'teletina': 20.0, 'svinjina': 12.1, 'piščanec': 6.9,
  'puran': 5.9, 'jagnjetina': 22.0, 'konzerva': 8.5,
  // Ribe
  'losos': 11.9, 'tuna': 6.1, 'oslič': 4.8, 'brancin': 5.5, 'orada': 5.5,
  'lignji': 3.5, 'kalamari': 3.5, 'hobotnica': 4.2, 'trilja': 4.0,
  // Mlečni
  'mleko': 1.7, 'sir': 8.5, 'mocarela': 6.2, 'parmezan': 10.5, 'skuta': 3.2,
  'jogurt': 1.9, 'maslo': 9.2, 'smetana': 3.5,
  // Žita
  'pšenica': 0.8, 'riž': 2.7, 'krompir': 0.3, 'testenine': 1.2, 'kruh': 0.9,
  'njoki': 0.9, 'polenta': 0.8, 'mleti': 1.0,
  // Zelenjava
  'paradižnik': 1.4, 'zelena': 0.4, 'kumara': 0.2, 'paprika': 0.6,
  'čebula': 0.2, 'zelje': 0.3, 'špinača': 0.4, 'bučke': 0.2,
  'solata': 0.4, 'motovilec': 0.3, 'rukola': 0.4,
  // Sadje
  'jabolko': 0.4, 'banana': 0.7, 'jagoda': 0.6, 'limona': 0.3,
  // Pijače
  'voda': 0.1, 'pivo': 0.9, 'vino': 1.3, 'žgane': 2.1, 'kava': 4.8,
  'čaj': 0.5, 'sok': 0.8, 'coca': 0.7,
  // Olja
  'oljčno olje': 5.4, 'sončnično': 2.5, 'palmino': 7.6,
  // Stročnice
  'fižol': 0.8, 'leča': 0.9, 'grah': 0.7, 'čičerika': 0.9,
  // Ostalo
  'jajce': 4.2, 'med': 0.5, 'sladkor': 1.2, 'čokolada': 8.8,
}

/**
 * Poišči CO2e faktor za sestavino po imenu
 */
async function findCarbonFactor(ingredientName: string): Promise<{ co2e: number; water?: number; land?: number }> {
  // 1. Preveri v bazi
  const dbFactor = await db.carbonFactor.findFirst({
    where: { name: { contains: ingredientName, mode: 'insensitive' }, isActive: true },
    select: { co2ePerKg: true, waterUsage: true, landUse: true },
  })
  if (dbFactor) {
    return {
      co2e: toNum(dbFactor.co2ePerKg),
      water: dbFactor.waterUsage ? toNum(dbFactor.waterUsage) : undefined,
      land: dbFactor.landUse ? toNum(dbFactor.landUse) : undefined,
    }
  }

  // 2. Preveri v default faktorjih (fuzzy match)
  const lowerName = ingredientName.toLowerCase()
  for (const [key, value] of Object.entries(DEFAULT_FACTORS)) {
    if (lowerName.includes(key) || key.includes(lowerName)) {
      return { co2e: value }
    }
  }

  // 3. Default povprečje za živila
  return { co2e: 2.5 } // Povprečje za živila
}

/**
 * Izračunaj CO2e za artikel na podlagi recepta (RecipeItem)
 * Ali na podlagi imena artikla (fallback)
 */
export async function calculateMenuItemCarbon(menuItemId: string): Promise<{
  co2e: number
  water: number
  land: number
  ingredients: Array<{ name: string; co2e: number; quantity: number }>
}> {
  // Preveri ali artikel ima recept
  const recipeItems = await db.recipeItem.findMany({
    where: { menuItemId },
    include: {
      inventoryItem: { select: { name: true } },
    },
  })

  let totalCo2e = 0
  let totalWater = 0
  let totalLand = 0
  const ingredients: Array<{ name: string; co2e: number; quantity: number }> = []

  if (recipeItems.length > 0) {
    // Ima recept — izračunaj iz sestavin
    for (const ri of recipeItems) {
      const ingredientName = ri.inventoryItem?.name || 'neznan'
      const factor = await findCarbonFactor(ingredientName)
      const qty = toNum(ri.quantityPerServing)
      const co2e = round2(multiply(factor.co2e, qty))
      totalCo2e += co2e
      totalWater += factor.water ? factor.water * qty : 0
      totalLand += factor.land ? factor.land * qty : 0
      ingredients.push({ name: ingredientName, co2e, quantity: qty })
    }
  } else {
    // Nima recepta — uporabi ime artikla
    const menuItem = await db.menuItem.findUnique({
      where: { id: menuItemId },
      select: { name: true },
    })
    const factor = await findCarbonFactor(menuItem?.name || 'hrana')
    totalCo2e = factor.co2e * 0.3 // Približek: 300g povprečna porcija
    ingredients.push({ name: menuItem?.name || 'Artikel', co2e: round2(totalCo2e), quantity: 0.3 })
  }

  return {
    co2e: round2(totalCo2e),
    water: round2(totalWater),
    land: round2(totalLand),
    ingredients,
  }
}

/**
 * Izračunaj CO2e za celotno naročilo
 */
export async function calculateOrderCarbon(orderId: string): Promise<{
  totalCo2e: number
  totalWater: number
  totalLand: number
  items: Array<{ name: string; co2e: number; quantity: number }>
}> {
  const orderItems = await db.orderItem.findMany({
    where: { orderId, voided: false },
    include: { menuItem: { select: { name: true } } },
  })

  let totalCo2e = 0
  let totalWater = 0
  let totalLand = 0
  const items: Array<{ name: string; co2e: number; quantity: number }> = []

  for (const oi of orderItems) {
    const carbon = await calculateMenuItemCarbon(oi.menuItemId)
    const itemCo2e = round2(carbon.co2e * oi.quantity)
    totalCo2e += itemCo2e
    totalWater += carbon.water * oi.quantity
    totalLand += carbon.land * oi.quantity
    items.push({
      name: oi.menuItem?.name || oi.menuItemName || 'Artikel',
      co2e: itemCo2e,
      quantity: oi.quantity,
    })
  }

  return {
    totalCo2e: round2(totalCo2e),
    totalWater: round2(totalWater),
    totalLand: round2(totalLand),
    items,
  }
}

/**
 * Generiraj dnevno poročilo o ogljičnem odtisu
 */
export async function generateDailyCarbonReport(date: Date): Promise<{
  date: string
  totalCo2e: number
  totalWater: number
  totalLand: number
  totalOrders: number
  co2ePerOrder: number
  co2ePerEuro: number
  topItems: Array<{ name: string; co2e: number; orders: number }>
}> {
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)

  const orders = await db.order.findMany({
    where: {
      paidAt: { gte: dayStart, lte: dayEnd },
      paymentStatus: 'paid',
    },
    select: {
      id: true,
      total: true,
      orderItems: {
        where: { voided: false },
        select: { menuItemId: true, quantity: true, menuItem: { select: { name: true } } },
      },
    },
  })

  let totalCo2e = 0
  let totalWater = 0
  let totalLand = 0
  let totalRevenue = 0
  const itemMap: Record<string, { name: string; co2e: number; orders: number }> = {}

  for (const order of orders) {
    totalRevenue += toNum(order.total)
    for (const oi of order.orderItems) {
      const carbon = await calculateMenuItemCarbon(oi.menuItemId)
      const co2e = carbon.co2e * oi.quantity
      totalCo2e += co2e
      totalWater += carbon.water * oi.quantity
      totalLand += carbon.land * oi.quantity

      const name = oi.menuItem?.name || 'Artikel'
      if (!itemMap[oi.menuItemId]) {
        itemMap[oi.menuItemId] = { name, co2e: 0, orders: 0 }
      }
      itemMap[oi.menuItemId].co2e += co2e
      itemMap[oi.menuItemId].orders += oi.quantity
    }
  }

  const topItems = Object.values(itemMap)
    .sort((a, b) => b.co2e - a.co2e)
    .slice(0, 10)

  return {
    date: dayStart.toISOString().split('T')[0],
    totalCo2e: round2(totalCo2e),
    totalWater: round2(totalWater),
    totalLand: round2(totalLand),
    totalOrders: orders.length,
    co2ePerOrder: orders.length > 0 ? round2(totalCo2e / orders.length) : 0,
    co2ePerEuro: totalRevenue > 0 ? round2(totalCo2e / totalRevenue) : 0,
    topItems: topItems.map(i => ({ ...i, co2e: round2(i.co2e) })),
  }
}
