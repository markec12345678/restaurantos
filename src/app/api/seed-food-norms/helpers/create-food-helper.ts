// =====================================================================
// HELPER: createFood - Ustvari menuItem (če ne obstaja) + recepture
// =====================================================================

import { db } from '@/lib/db'

// Helper: ustvari menuItem (če ne obstaja) + recepture
// Uporablja menuByName za preverjanje obstojačih artiklov
export async function createFood(
  name: string,
  price: number,
  catId: string,
  desc: string,
  allergens: string,
  vatRate: number,
  recipes: Array<{ inv: { id: string }; qty: number; unit: string }>,
  image: string = '',
  menuByName: Map<string, { id: string; name: string; image: string | null; [key: string]: unknown }> = new Map()
) {
  let menuItem = menuByName.get(name)
  if (!menuItem) {
    menuItem = await db.menuItem.create({
      data: {
        name,
        description: desc,
        price,
        categoryId: catId,
        allergens,
        vatRate,
        isAvailable: true,
        image,
      }
    })
    menuByName.set(name, menuItem)
  } else if (image && !menuItem.image) {
    // Posodobi sliko če še ni nastavljena
    await db.menuItem.update({ where: { id: menuItem.id }, data: { image } })
  }

  for (const r of recipes) {
    await db.recipeItem.upsert({
      where: {
        menuItemId_inventoryItemId: {
          menuItemId: menuItem.id,
          inventoryItemId: r.inv.id,
        }
      },
      create: {
        menuItemId: menuItem.id,
        inventoryItemId: r.inv.id,
        quantityPerServing: r.qty,
        unit: r.unit,
      },
      update: {
        quantityPerServing: r.qty,
        unit: r.unit,
      }
    })
  }
  return menuItem
}
