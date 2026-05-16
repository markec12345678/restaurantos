import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// =====================================================================
// PUBLIC MENU ENDPOINT - Brez avtentikacije (za QR meni)
// Vrne celoten meni s kategorijami in alergeni za prikaz na telefonu
// Optimizirano za mobilne naprave - minimalni podatki za hitrost
// =====================================================================

export async function GET() {
  try {
    const menus = await db.menu.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        icon: true,
        color: true,
        sortOrder: true,
        categories: {
          where: { menuItems: { some: { isAvailable: true } } },
          select: {
            id: true,
            name: true,
            icon: true,
            color: true,
            sortOrder: true,
            menuItems: {
              where: { isAvailable: true },
              select: {
                id: true,
                name: true,
                description: true,
                price: true,
                vatRate: true,
                allergens: true,
                image: true,
                sortOrder: true,
                modifierGroups: {
                  select: {
                    sortOrder: true,
                    modifierGroup: {
                      select: {
                        id: true,
                        name: true,
                        required: true,
                        minSelect: true,
                        maxSelect: true,
                        modifiers: {
                          where: { isAvailable: true },
                          select: {
                            id: true,
                            name: true,
                            price: true,
                          },
                          orderBy: { sortOrder: 'asc' }
                        }
                      }
                    }
                  },
                  orderBy: { sortOrder: 'asc' }
                }
              },
              orderBy: { sortOrder: 'asc' }
            }
          },
          orderBy: { sortOrder: 'asc' }
        }
      },
      orderBy: { sortOrder: 'asc' }
    })

    const settings = await db.restaurantSettings.findFirst({
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        email: true,
        web: true,
        currency: true,
        locale: true,
        country: true,
      }
    })

    // Pridobi razpoložljive mize za informacijo
    const tables = await db.table.findMany({
      where: { status: 'available' },
      select: { id: true, number: true, capacity: true }
    })

    return NextResponse.json({
      menus,
      settings,
      availableTables: tables.length,
      timestamp: new Date().toISOString(),
    })

  } catch (error: any) {
    console.error('Public menu error:', error)
    return NextResponse.json({
      error: 'Napaka pri nalaganju menija'
    }, { status: 500 })
  }
}
