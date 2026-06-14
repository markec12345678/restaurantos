import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { Prisma } from '@prisma/client'
// =====================================================================
// MULTI-LOCATION MENU SYNC API
// Sinhronizacija menijev, kategorij in artiklov med lokacijami
// Za verige restavracij z centraliziranim upravljanjem menija
// =====================================================================

// POST /api/locations/sync — Sinhroniziraj meni iz izvorne lokacije na ciljne
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const locationSyncSchema = z.object({
      sourceLocationId: z.string().min(1, 'Izvorna lokacija je obvezna').max(100, 'ID lokacije je predolg'),
      targetLocationIds: z.array(z.string().max(100, 'ID lokacije je predolg')).min(1, 'Vsaj ena ciljna lokacija je obvezna').max(50, 'Največ 50 ciljnih lokacij'),
      syncMenuStructure: z.boolean().default(true),
      syncItems: z.boolean().default(true),
      syncPricing: z.boolean().default(false),
      syncModifiers: z.boolean().default(true),
      syncRecipes: z.boolean().default(false),
      dryRun: z.boolean().default(false),
    })

    const { data, error: validationError } = await validateRequest(req, locationSyncSchema)
    if (validationError) return validationError

    // Preveri izvorno lokacijo
    const sourceLocation = await db.location.findUnique({
      where: { id: data.sourceLocationId },
    })
    if (!sourceLocation) {
      return NextResponse.json({ error: 'Izvorna lokacija ne obstaja' }, { status: 404 })
    }

    // Preveri ciljne lokacije
    const targetLocations = await db.location.findMany({
      where: { id: { in: data.targetLocationIds } },
    })
    if (targetLocations.length !== data.targetLocationIds.length) {
      return NextResponse.json({ error: 'Nekatere ciljne lokacije ne obstajajo' }, { status: 404 })
    }

    // Pridobi podatke iz izvorne lokacije
    // FIX CRITICAL: Prejšnja koda je uporabila `data.sourceLocationId ? {} : {}` kar je VEDNO prazen filter!
    // To pomeni, da se sinhronizirajo VSI meniji iz VSEH lokacij namesto samo iz izvorne lokacije
    const sourceMenus = await db.menu.findMany({
      where: { locationId: data.sourceLocationId },
      include: {
        categories: {
          include: {
            menuItems: {
              include: {
                modifierGroups: {
                  include: {
                    modifierGroup: {
                      include: {
                        modifiers: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    })

    // =====================================================================
    // OPTIMIZACIJA N+1: Batch pridobivanje obstoječih entitet
    // Namesto individualnih findFirst klicev v zanki (N+1 problem),
    // pridobimo vse podatke za VSE ciljne lokacije v 3 poizvedbah
    // in zgradimo Map strukture za O(1) iskanje
    // =====================================================================

    const syncResults = data.dryRun
      ? targetLocations.map(loc => ({
          targetLocationId: loc.id,
          targetLocationName: loc.name,
          menusCreated: 0,
          categoriesCreated: 0,
          itemsCreated: 0,
          itemsUpdated: 0,
          modifiersCreated: 0,
          errors: [] as string[],
        }))
      : await db.$transaction(async (tx) => {
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
          const results: Array<{
            targetLocationId: string
            targetLocationName: string
            menusCreated: number
            categoriesCreated: number
            itemsCreated: number
            itemsUpdated: number
            modifiersCreated: number
            errors: string[]
          }> = []

          for (const targetLocation of targetLocations) {
            const result = {
              targetLocationId: targetLocation.id,
              targetLocationName: targetLocation.name,
              menusCreated: 0,
              categoriesCreated: 0,
              itemsCreated: 0,
              itemsUpdated: 0,
              modifiersCreated: 0,
              errors: [] as string[],
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
                menuMap.set(menu.name, newMenu)
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
                    catMap.set(category.name, newCat)
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

    return NextResponse.json({
      success: true,
      sourceLocation: {
        id: sourceLocation.id,
        name: sourceLocation.name,
        menuCount: sourceMenus.length,
        categoryCount: sourceMenus.reduce((sum, m) => sum + m.categories.length, 0),
        itemCount: sourceMenus.reduce((sum, m) => sum + m.categories.reduce((s, c) => s + c.menuItems.length, 0), 0),
      },
      dryRun: data.dryRun,
      results: syncResults,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/locations/sync', 'Napaka pri sinhronizaciji')
  }
}

// GET /api/locations/sync — Pridobi primerjavo menijev med lokacijami
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const locations = await db.location.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        _count: {
          select: {
            orders: true,
            tables: true,
            employees: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    // =====================================================================
    // OPTIMIZACIJA N+1: Ena sama poizvedba za štetje menijev, kategorij in artiklov
    // Namesto 3 count() poizvedbe na lokacijo (N+1 problem — 30 klicev za 10 lokacij),
    // uporabimo GROUP BY v enem SQL stavku (1 poizvedba za vse lokacije)
    // =====================================================================

    const locationIds = locations.map(l => l.id)

    const menuCountsByLocation = locationIds.length > 0
      ? await db.$queryRaw<
          Array<{
            locationId: string
            menuCount: bigint
            categoryCount: bigint
            itemCount: bigint
          }>
        >`
          SELECT
            m.locationId,
            COUNT(DISTINCT m.id) as menuCount,
            COUNT(DISTINCT c.id) as categoryCount,
            COUNT(DISTINCT CASE WHEN mi.isAvailable = 1 THEN mi.id END) as itemCount
          FROM Menu m
          LEFT JOIN Category c ON c.menuId = m.id
          LEFT JOIN MenuItem mi ON mi.categoryId = c.id
          WHERE m.locationId IN (${Prisma.join(locationIds)})
          GROUP BY m.locationId
        `
      : []

    // Pretvori rezultate v Map za O(1) dostop po locationId
    const countMap = new Map<string, { menuCount: number; categoryCount: number; itemCount: number }>()
    for (const row of menuCountsByLocation) {
      countMap.set(row.locationId, {
        menuCount: Number(row.menuCount),
        categoryCount: Number(row.categoryCount),
        itemCount: Number(row.itemCount),
      })
    }

    // Primerjaj menije po lokacijah
    const menuComparison = locations.map(loc => {
      const counts = countMap.get(loc.id) ?? { menuCount: 0, categoryCount: 0, itemCount: 0 }
      return {
        locationId: loc.id,
        locationName: loc.name,
        locationCode: loc.code,
        menuCount: counts.menuCount,
        categoryCount: counts.categoryCount,
        itemCount: counts.itemCount,
      }
    })

    // Centralizirana poročila
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const dailyStats = await db.order.groupBy({
      by: ['type'],
      where: { createdAt: { gte: today } },
      _sum: { total: true },
      _count: true,
    })

    const monthlyStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const monthlyStats = await db.order.groupBy({
      by: ['type'],
      where: { createdAt: { gte: monthlyStart } },
      _sum: { total: true },
      _count: true,
    })

    return NextResponse.json({
      locations,
      menuComparison,
      centralizedReports: {
        daily: dailyStats,
        monthly: monthlyStats,
      },
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/locations/sync', 'Napaka pri pridobivanju primerjave')
  }
}
