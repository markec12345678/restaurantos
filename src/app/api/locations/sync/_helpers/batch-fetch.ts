// Batch pridobivanje obstoječih entitet za sinhronizacijo menijev
// OPTIMIZACIJA N+1: Vse poizvedbe v 3 klicih namesto N individualnih

import { Prisma } from '@prisma/client'

// Tipi za Map strukture
export type MenuMapByLocation = Map<string, Map<string, { id: string; name: string; locationId: string | null; [key: string]: unknown }>>
export type CategoryMapByMenu = Map<string, Map<string, { id: string; name: string; menuId: string; [key: string]: unknown }>>
export type ItemMapByCategory = Map<string, Map<string, { id: string; name: string; categoryId: string; [key: string]: unknown }>>

export interface BatchFetchResult {
  menuMapByLocation: MenuMapByLocation
  categoryMapByMenu: CategoryMapByMenu
  itemMapByCategory: ItemMapByCategory
}

export async function batchFetchExistingEntities(
  tx: Prisma.TransactionClient,
  targetLocationIds: string[],
): Promise<BatchFetchResult> {
  // 1. Pridobi vse obstoječe menije za vse ciljne lokacije
  const existingMenus = await tx.menu.findMany({
    where: { locationId: { in: targetLocationIds } },
  })

  const menuMapByLocation: MenuMapByLocation = new Map()
  for (const menu of existingMenus) {
    if (!menu.locationId) continue
    let innerMap = menuMapByLocation.get(menu.locationId)
    if (!innerMap) {
      innerMap = new Map()
      menuMapByLocation.set(menu.locationId, innerMap)
    }
    innerMap.set(menu.name, menu as unknown as Parameters<typeof innerMap.set>[1])
  }

  // 2. Pridobi vse obstoječe kategorije za te menije
  const existingMenuIds = existingMenus.map(m => m.id)
  const existingCategories = existingMenuIds.length > 0
    ? await tx.category.findMany({ where: { menuId: { in: existingMenuIds } } })
    : []

  const categoryMapByMenu: CategoryMapByMenu = new Map()
  for (const cat of existingCategories) {
    let innerMap = categoryMapByMenu.get(cat.menuId)
    if (!innerMap) {
      innerMap = new Map()
      categoryMapByMenu.set(cat.menuId, innerMap)
    }
    innerMap.set(cat.name, cat as unknown as Parameters<typeof innerMap.set>[1])
  }

  // 3. Pridobi vse obstoječe artikle za te kategorije
  const existingCategoryIds = existingCategories.map(c => c.id)
  const existingItems = existingCategoryIds.length > 0
    ? await tx.menuItem.findMany({ where: { categoryId: { in: existingCategoryIds } } })
    : []

  const itemMapByCategory: ItemMapByCategory = new Map()
  for (const item of existingItems) {
    let innerMap = itemMapByCategory.get(item.categoryId)
    if (!innerMap) {
      innerMap = new Map()
      itemMapByCategory.set(item.categoryId, innerMap)
    }
    innerMap.set(item.name, item as unknown as Parameters<typeof innerMap.set>[1])
  }

  return { menuMapByLocation, categoryMapByMenu, itemMapByCategory }
}
