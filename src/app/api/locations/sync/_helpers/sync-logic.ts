// Sinhronizacijska logika za posamezno ciljno lokacijo
// Ustvarjanje/posodabljanje menijev, kategorij in artiklov

import { Prisma } from '@prisma/client'
import type { LocationSyncData, SyncResult } from './types'
import type { fetchSourceMenus } from './fetch-source'
import type { BatchFetchResult } from './batch-fetch'

export async function syncLocationMenus(
  tx: Prisma.TransactionClient,
  data: LocationSyncData,
  sourceMenus: Awaited<ReturnType<typeof fetchSourceMenus>>,
  targetLocation: { id: string; name: string },
  maps: BatchFetchResult,
): Promise<SyncResult> {
  const result: SyncResult = {
    targetLocationId: targetLocation.id,
    targetLocationName: targetLocation.name,
    menusCreated: 0, categoriesCreated: 0, itemsCreated: 0, itemsUpdated: 0, modifiersCreated: 0, errors: [],
  }

  let menuMap = maps.menuMapByLocation.get(targetLocation.id)
  if (!menuMap) {
    menuMap = new Map()
    maps.menuMapByLocation.set(targetLocation.id, menuMap)
  }

  for (const menu of sourceMenus) {
    const existingMenu = menuMap.get(menu.name)
    let menuId = existingMenu?.id

    if (!existingMenu && data.syncMenuStructure) {
      const newMenu = await tx.menu.create({
        data: { name: menu.name, icon: menu.icon, color: menu.color, sortOrder: menu.sortOrder, isActive: menu.isActive },
      })
      menuId = newMenu.id
      menuMap.set(menu.name, newMenu as unknown as Parameters<typeof menuMap.set>[1])
      result.menusCreated++
    }

    if (!menuId) { result.errors.push(`Meni "${menu.name}" ni najden na ciljni lokaciji`); continue }

    if (data.syncMenuStructure) {
      for (const category of menu.categories) {
        let catMap = maps.categoryMapByMenu.get(menuId)
        if (!catMap) { catMap = new Map(); maps.categoryMapByMenu.set(menuId, catMap) }
        const existingCat = catMap.get(category.name)
        let categoryId = existingCat?.id

        if (!existingCat) {
          const newCat = await tx.category.create({ data: { name: category.name, icon: category.icon, color: category.color, sortOrder: category.sortOrder, menuId } })
          categoryId = newCat.id
          catMap.set(category.name, newCat as unknown as Parameters<typeof catMap.set>[1])
          result.categoriesCreated++
        }
        if (!categoryId) continue

        if (data.syncItems && category.menuItems) {
          let itemMap = maps.itemMapByCategory.get(categoryId)
          if (!itemMap) { itemMap = new Map(); maps.itemMapByCategory.set(categoryId, itemMap) }
          const itemsToCreate: Prisma.MenuItemCreateManyInput[] = []

          for (const item of category.menuItems) {
            const existingItem = itemMap.get(item.name)
            if (existingItem) {
              const updateData: Record<string, unknown> = { description: item.description, allergens: item.allergens, image: item.image, isAvailable: item.isAvailable, sortOrder: item.sortOrder }
              if (data.syncPricing) { updateData.price = item.price; updateData.vatRate = item.vatRate }
              await tx.menuItem.update({ where: { id: existingItem.id }, data: updateData })
              result.itemsUpdated++
            } else {
              itemsToCreate.push({ name: item.name, description: item.description, price: item.price, vatRate: item.vatRate, allergens: item.allergens, image: item.image, isAvailable: item.isAvailable, sortOrder: item.sortOrder, categoryId })
            }
          }
          if (itemsToCreate.length > 0) { await tx.menuItem.createMany({ data: itemsToCreate }); result.itemsCreated += itemsToCreate.length }
        }
      }
    }
  }
  return result
}
