import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// Javni API za meni - BREZ avtentikacije
// Uporablja se za QR naročanje (stranka skenira QR kodo na mizi)

export async function GET() {
  try {
    const [menus, settings] = await Promise.all([
      db.menu.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          categories: {
            where: { menuItems: { some: { isAvailable: true } } },
            orderBy: { sortOrder: 'asc' },
            include: {
              menuItems: {
                where: { isAvailable: true },
                orderBy: { sortOrder: 'asc' },
                select: {
                  id: true,
                  name: true,
                  description: true,
                  price: true,
                  image: true,
                  vatRate: true,
                  allergens: true,
                  categoryId: true,
                },
              },
            },
          },
        },
      }),
      db.restaurantSettings.findFirst({ where: { isActive: true } }),
    ])

    // Transform za QR stran - poskrbi za pravilno pot do slik
    const transformedMenus = menus.map(menu => ({
      ...menu,
      categories: menu.categories.map(cat => ({
        ...cat,
        menuItems: cat.menuItems.map(item => ({
          ...item,
          // image polje že vsebuje pot (npr. /menu-images/xxx.png ali prazno)
          image: item.image || '',
        })),
      })),
    }))

    return NextResponse.json({
      restaurant: settings ? {
        name: settings.name,
        address: settings.address,
        city: settings.city,
        phone: settings.phone,
        email: settings.email,
        web: settings.web,
        currency: settings.currency,
      } : null,
      menus: transformedMenus,
    })
  } catch (error) {
    console.error('[PUBLIC MENU] Napaka:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju menija' }, { status: 500 })
  }
}
