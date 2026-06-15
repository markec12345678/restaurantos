// Pomožne funkcije za Location Sync API — Sinhronizacija menijev znotraj transakcije

import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import type { LocationSyncData, SyncResult } from './types'
import type { fetchSourceMenus } from './fetch-source'

// ─── Sinhronizacija znotraj transakcije ─────────────────────

export async function syncMenusToTargets(
  data: LocationSyncData,
  sourceMenus: Awaited<ReturnType<typeof fetchSourceMenus>>,
  targetLocations: Awaited<ReturnType<typeof db.location.findMany>>,
): Promise<SyncResult[]> {
  // =====================================================================
  // OPTIMIZACIJA N+1: Batch pridobivanje obstoječih entitet
  // Namesto individualnih findFirst klicev v zanki (N+1 problem),
  // pridobimo vse podatke za VSE ciljne lokacije v 3 poizvedbah
  // in zgradimo Map strukture za O(1) iskanje
  // =====================================================================

  return db.$transaction(async (tx) => {
    // 1. Pridobi vse obstoječe menije za vse ciljne lokacije (1 poizvedba namesto N)
    const existingMenus = await tx.menu.findMany({
      where: { locationId: { in: data.targetLocationIds } },
    })
    // Map: locationId → menuName → Menu (za O(1) iskanje menija po imenu na lokaciji)
    const menuMapByLocation = new Map<string, Map<string, typeof existingMenus[number]>>()
    for (const menu of existingMenus) {
      if (!menu.locationId) continue
      let innerMap = menuMapByLocation.get(menu.locationId)
      if (!innerMap) {
        innerMap = new Map()
        menuMapByLocation.set(menu.locationId, innerMap)
      }
      innerMap.set(menu.name, menu)
    }

    // 2. Pridobi vse obstoječe kategorije za te menije (1 poizvedba namesto N)
    const existingMenuIds = existingMenus.map(m => m.id)
    const existingCategories = existingMenuIds.length > 0
      ? await tx.category.findMany({ where: { menuId: { in: existingMenuIds } } })
      : []
    // Map: menuId → categoryName → Category (za O(1) iskanje kategorije po imenu v meniju)
    const categoryMapByMenu = new Map<string, Map<string, typeof existingCategories[number]>>()
    for (const cat of existingCategories) {
      let innerMap = categoryMapByMenu.get(cat.menuId)
      if (!innerMap) {
        innerMap = new Map()
        categoryMapByMenu.set(cat.menuId, innerMap)
      }
      innerMap.set(cat.name, cat)
    }

    // 3. Pridobi vse obstoječe artikle za te kategorije (1 poizvedba namesto N)
    const existingCategoryIds = existingCategories.map(c => c.id)
    const existingItems = existingCategoryIds.length > 0
      ? await tx.menuItem.findMany({ where: { categoryId: { in: existingCategoryIds } } })
      : []
    // Map: categoryId → itemName → MenuItem (za O(1) iskanje artikla po imenu v kategoriji)
    const itemMapByCategory = new Map<string, Map<string, typeof existingItems[number]>>()
    for (const item of existingItems) {
      let innerMap = itemMapByCategory.get(item.categoryId)
      if (!innerMap) {
        innerMap = new Map()
        itemMapByCategory.set(item.categoryId, innerMap)
      }
      innerMap.set(item.name, item)
    }

    // --- Sinhronizacija z uporabo map za O(1) iskanje ---
    const results: SyncResult[] = []

    for (const targetLocation of targetLocations) {
      const result: SyncResult = {
        targetLocationId: targetLocation.id,
        targetLocationName: targetLocation.name,
        menusCreated: 0,
        categoriesCreated: 0,
        itemsCreated: 0,
        itemsUpdated: 0,
        modifiersCreated: 0,
        errors: [],
      }

      let menuMap = menuMapByLocation.get(targetLocation.id)
      if (!menuMap) {
        menuMap = new Map()
        menuMapByLocation.set(targetLocation.id, menuMap)
      }

      for (const menu of sourceMenus) {
        // Poišči ali ustvari meni na ciljni lokaciji
        // FIX MEDIUM: Omeji iskanje na ciljno lokacijo — prejšnja koda je iskala globalno
        const existingMenu = menuMap.get(menu.name)
        let menuId = existingMenu?.id

        if (!existingMenu && data.syncMenuStructure) {
          const newMenu = await tx.menu.create({
            data: {
              name: menu.name,
              icon: menu.icon,
              color: menu.color,
              sortOrder: menu.sortOrder,
              isActive: menu.isActive,
            },
          })
          menuId = newMenu.id
          // Shrani nov meni v map za nadaljnje iskanje
          menuMap.set(menu.name, newMenu as unknown as Parameters<typeof menuMap.set>[1])
          result.menusCreated++
        }

        if (!menuId) {
          result.errors.push(`Meni "${menu.name}" ni najden na ciljni lokaciji`)
          continue
        }

        // Sinhroniziraj kategorije
        if (data.syncMenuStructure) {
          for (const category of menu.categories) {
            let catMap = categoryMapByMenu.get(menuId)
            if (!catMap) {
              catMap = new Map()
              categoryMapByMenu.set(menuId, catMap)
            }

            const existingCat = catMap.get(category.name)
            let categoryId = existingCat?.id

            if (!existingCat) {
              const newCat = await tx.category.create({
                data: {
                  name: category.name,
                  icon: category.icon,
                  color: category.color,
                  sortOrder: category.sortOrder,
                  menuId,
                },
              })
              categoryId = newCat.id
              catMap.set(category.name, newCat as unknown as Parameters<typeof catMap.set>[1])
              result.categoriesCreated++
            }

            if (!categoryId) continue

            // Sinhroniziraj artikle — zberemo za batch createMany
            if (data.syncItems && category.menuItems) {
              let itemMap = itemMapByCategory.get(categoryId)
              if (!itemMap) {
                itemMap = new Map()
                itemMapByCategory.set(categoryId, itemMap)
              }

              const itemsToCreate: Prisma.MenuItemCreateManyInput[] = []

              for (const item of category.menuItems) {
                const existingItem = itemMap.get(item.name)

                if (existingItem) {
                  // Update obstoječega artikla
                  const updateData: Record<string, unknown> = {
                    description: item.description,
                    allergens: item.allergens,
                    image: item.image,
                    isAvailable: item.isAvailable,
                    sortOrder: item.sortOrder,
                  }
                  if (data.syncPricing) {
                    updateData.price = item.price
                    updateData.vatRate = item.vatRate
                  }
                  await tx.menuItem.update({
                    where: { id: existingItem.id },
                    data: updateData,
                  })
                  result.itemsUpdated++
                } else {
                  // Zberi za batch createMany namesto individualnih create klicev
                  itemsToCreate.push({
                    name: item.name,
                    description: item.description,
                    price: item.price,
                    vatRate: item.vatRate,
                    allergens: item.allergens,
                    image: item.image,
                    isAvailable: item.isAvailable,
                    sortOrder: item.sortOrder,
                    categoryId,
                  })
                }
              }

              // Batch ustvarjanje artiklov z createMany (1 poizvedba namesto N)
              if (itemsToCreate.length > 0) {
                await tx.menuItem.createMany({ data: itemsToCreate })
                result.itemsCreated += itemsToCreate.length
              }
            }
          }
        }
      }

      results.push(result)
    }

    return results
  }, { timeout: 30000 })
}
