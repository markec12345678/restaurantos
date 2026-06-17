// Seed PrepStations + InventoryItems + RecipeItems (za stock deduction + COGS)
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('Seeding PrepStations + InventoryItems + RecipeItems...')

  // 1. PrepStations
  const kitchen = await prisma.prepStation.create({ data: { name: 'Vroča kuhinja', type: 'kitchen', avgPrepTime: 20, isActive: true, sortOrder: 0 } })
  const bar = await prisma.prepStation.create({ data: { name: 'Bar', type: 'bar', avgPrepTime: 5, isActive: true, sortOrder: 1 } })
  console.log(`✓ 2 PrepStations: ${kitchen.name} (kitchen), ${bar.name} (bar)`)

  // 2. Inventory items (sestavine)
  const items = await prisma.menuItem.findMany()
  const inventoryMap = {
    'Beefsteak': { name: 'Goveji zrezek 1kg', unit: 'kg', qty: 25, minQty: 5, cost: 18.50, servings: 4 },
    'Lignji na žaru': { name: 'Lignji 1kg', unit: 'kg', qty: 15, minQty: 3, cost: 22.00, servings: 4 },
    'Pizza Margherita': { name: 'Piza testo', unit: 'kos', qty: 50, minQty: 10, cost: 1.50, servings: 1 },
    'Špaghetti Carbonara': { name: 'Špageti 500g', unit: 'kos', qty: 20, minQty: 5, cost: 2.50, servings: 4 },
    'Laški Teran': { name: 'Laški Teran 0.75l', unit: 'steklenica', qty: 24, minQty: 6, cost: 8.00, servings: 4 },
    'Pivo Laško': { name: 'Pivo Laško 0.5l', unit: 'kos', qty: 120, minQty: 24, cost: 1.20, servings: 1 },
    'Coca-Cola': { name: 'Coca-Cola 0.33l', unit: 'kos', qty: 96, minQty: 24, cost: 0.80, servings: 1 },
    'Kava': { name: 'Kavna zrna 1kg', unit: 'kg', qty: 5, minQty: 1, cost: 25.00, servings: 100 },
  }

  // 3. Poveži MenuItems z PrepStations + kreiraj InventoryItems + RecipeItems
  let recipesCount = 0
  let stationsLinked = 0
  for (const mi of items) {
    const config = inventoryMap[mi.name]
    if (!config) continue

    // 3a. Določi PrepStation (hrana → kitchen, pijača → bar)
    const isDrink = ['Laški Teran', 'Pivo Laško', 'Coca-Cola', 'Kava'].includes(mi.name)
    const station = isDrink ? bar : kitchen
    await prisma.menuItem.update({ where: { id: mi.id }, data: { prepStationId: station.id } })
    stationsLinked++

    // 3b. Kreiraj InventoryItem
    const inv = await prisma.inventoryItem.create({
      data: {
        name: config.name,
        unit: config.unit,
        quantity: config.qty,
        minQuantity: config.minQty,
        costPerUnit: config.cost,
        category: isDrink ? 'pijača' : 'hrana',
        location: 'glavni skladišč',
        servingsPerUnit: config.servings,
        menuItemId: mi.id,
      },
    })

    // 3c. Kreiraj RecipeItem (1 serving = 1/servingsPerUnit inventory)
    const qtyPerServing = 1 / config.servings
    await prisma.recipeItem.create({
      data: {
        menuItemId: mi.id,
        inventoryItemId: inv.id,
        quantityPerServing: qtyPerServing,
        unit: config.unit,
        notes: `Avtomatsko kreiran recept za ${mi.name}`,
      },
    })
    recipesCount++
  }

  console.log(`✓ ${stationsLinked} MenuItems linked to PrepStations`)
  console.log(`✓ ${recipesCount} RecipeItems created (stock deduction + COGS)`)
  console.log(`✓ ${recipesCount} InventoryItems created`)

  console.log('\n✅ Seed complete! Stock deduction + COGS calculation + PrepStation routing sedaj delujejo.')
}

main().catch(e => { console.error('SEED ERROR:', e); process.exit(1) }).finally(() => prisma.$disconnect())
