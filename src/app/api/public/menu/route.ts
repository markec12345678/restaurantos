
// =====================================================================
// PUBLIC MENU ENDPOINT - Brez avtentikacije (za QR meni)
// Vrne celoten meni s kategorijami in alergeni za prikaz na telefonu
// Optimizirano za mobilne naprave - minimalni podatki za hitrost
// FIX CRITICAL: Rate limiting za preprečitev zlorabe
// =====================================================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp, PUBLIC_MENU_LIMIT } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/api-utils'


export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // FIX CRITICAL: Rate limiting
  const clientIp = getClientIp(req)
  const rateCheck = checkRateLimit('public-menu', clientIp, PUBLIC_MENU_LIMIT)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Preveč zahtevkov. Poskusite znova čez nekaj sekund.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.retryAfterMs || 60000) / 1000)) } }
    )
  }

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
                            // FIX ALLER-06/08 HIGH: Vrni alergene za modifikatorje — EU 1169/2011 zahteva
                            // Če modifikator vsebuje alergene (npr. sir = mleko=7), jih mora stranka videti
                            allergens: true,
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

  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/public/menu', 'Napaka pri pridobivanju menija')
  }
}
