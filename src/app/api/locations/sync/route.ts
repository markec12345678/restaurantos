import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'

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

    const body = await req.json()
    const schema = z.object({
      sourceLocationId: z.string().min(1, 'Izvorna lokacija je obvezna'),
      targetLocationIds: z.array(z.string()).min(1, 'Vsaj ena ciljna lokacija je obvezna'),
      syncMenuStructure: z.boolean().default(true),   // Meniji + kategorije
      syncItems: z.boolean().default(true),             // Artikli
      syncPricing: z.boolean().default(false),          // Cene (lahko se razlikujejo)
      syncModifiers: z.boolean().default(true),         // Modifiers
      syncRecipes: z.boolean().default(false),          // Recepti/zaloga
      dryRun: z.boolean().default(false),               // Samo prikaz sprememb
    })

    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Neveljavni podatki', validationErrors: parsed.error.issues }, { status: 400 })
    }

    const data = parsed.data

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
    const sourceMenus = await db.menu.findMany({
      where: data.sourceLocationId ? {} : {},
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

    const syncResults: Array<{
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

      if (!data.dryRun) {
        for (const menu of sourceMenus) {
          // Poišči ali ustvari meni na ciljni lokaciji
          const existingMenu = await db.menu.findFirst({
            where: { name: menu.name },
          })

          let menuId = existingMenu?.id

          if (!existingMenu && data.syncMenuStructure) {
            const newMenu = await db.menu.create({
              data: {
                name: menu.name,
                icon: menu.icon,
                color: menu.color,
                sortOrder: menu.sortOrder,
                isActive: menu.isActive,
              },
            })
            menuId = newMenu.id
            result.menusCreated++
          }

          if (!menuId) {
            result.errors.push(`Meni "${menu.name}" ni najden na ciljni lokaciji`)
            continue
          }

          // Sinhroniziraj kategorije
          if (data.syncMenuStructure) {
            for (const category of menu.categories) {
              const existingCat = await db.category.findFirst({
                where: { name: category.name, menuId },
              })

              let categoryId = existingCat?.id

              if (!existingCat) {
                const newCat = await db.category.create({
                  data: {
                    name: category.name,
                    icon: category.icon,
                    color: category.color,
                    sortOrder: category.sortOrder,
                    menuId,
                  },
                })
                categoryId = newCat.id
                result.categoriesCreated++
              }

              if (!categoryId) continue

              // Sinhroniziraj artikle
              if (data.syncItems && category.menuItems) {
                for (const item of category.menuItems) {
                  const existingItem = await db.menuItem.findFirst({
                    where: { name: item.name, categoryId },
                  })

                  if (existingItem) {
                    // Update
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
                    await db.menuItem.update({
                      where: { id: existingItem.id },
                      data: updateData,
                    })
                    result.itemsUpdated++
                  } else {
                    // Create
                    await db.menuItem.create({
                      data: {
                        name: item.name,
                        description: item.description,
                        price: item.price,
                        vatRate: item.vatRate,
                        allergens: item.allergens,
                        image: item.image,
                        isAvailable: item.isAvailable,
                        sortOrder: item.sortOrder,
                        categoryId,
                      },
                    })
                    result.itemsCreated++
                  }
                }
              }
            }
          }
        }
      }

      syncResults.push(result)
    }

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
  } catch (error) {
    console.error('Location sync error:', error)
    return NextResponse.json({ error: 'Napaka pri sinhronizaciji' }, { status: 500 })
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

    // Primerjaj menije po lokacijah
    const menuComparison: Array<{
      locationId: string
      locationName: string
      locationCode: string
      menuCount: number
      categoryCount: number
      itemCount: number
    }> = []

    for (const loc of locations) {
      const menuCount = await db.menu.count()
      const categoryCount = await db.category.count()
      const itemCount = await db.menuItem.count({ where: { isAvailable: true } })

      menuComparison.push({
        locationId: loc.id,
        locationName: loc.name,
        locationCode: loc.code,
        menuCount,
        categoryCount,
        itemCount,
      })
    }

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
  } catch (error) {
    console.error('Location comparison error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju primerjave' }, { status: 500 })
  }
}
