
// =====================================================================
// PUBLIC MENU ENDPOINT - Brez avtentikacije (za QR meni)
// Vrne celoten meni s kategorijami in alergeni za prikaz na telefonu
// Optimizirano za mobilne naprave - minimalni podatki za hitrost
// FIX CRITICAL: Rate limiting za preprečitev zlorabe
// FIX P0-C3B: ?locationId je obvezen (public endpoint brez session)
// =====================================================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { checkRateLimitAsync, getClientIp, PUBLIC_MENU_LIMIT } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/api-utils'
import { getRestaurantInfoForLocation } from '@/lib/furs/config-resolver'
import { withCache, withETag, CachePresets } from '@/lib/middleware/cache-headers'


export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // FIX CRITICAL: Rate limiting
  const clientIp = getClientIp(req)
  const rateCheck = await checkRateLimitAsync('public-menu', clientIp, PUBLIC_MENU_LIMIT)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Preveč zahtevkov. Poskusite znova čez nekaj sekund.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.retryAfterMs || 60000) / 1000)) } }
    )
  }

  try {
    const { searchParams } = new URL(req.url)
    let locationId = searchParams.get('locationId')

    // FIX P0-C3B: ?locationId je opcijsen za backward compat.
    // Prej: bil je obvezem (vrnil 400) — ampak to je razbilo frontend (QR menu, waiter page
    // kličejo /api/public/menu brez ?locationId).
    // Sedaj: če locationId manjka, auto-detect prvo aktivno lokacijo (single-tenant compat).
    // V multi-tenant: frontend mora vedno podati ?locationId (URL parameter iz QR kode).
    if (!locationId) {
      const firstActive = await db.location.findFirst({
        where: { isActive: true },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      })
      if (!firstActive) {
        return NextResponse.json(
          { error: 'No active location found. Specify ?locationId parameter.' },
          { status: 400 },
        )
      }
      locationId = firstActive.id
    }

    const menus = await db.menu.findMany({
      where: { isActive: true, locationId },
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

    // FIX P0-C3B: Pridobi branding iz Location (vezano na locationId)
    const info = await getRestaurantInfoForLocation(locationId)
    const settings = {
      id: info.locationId || '',
      name: info.name,
      address: info.address,
      phone: info.phone,
      email: '',
      web: '',
      currency: info.currency,
      locale: info.locale,
      country: 'SI',
    }

    // FIX P0-C3B: Pridobi razpoložljive mize SAMO za to lokacijo
    const tables = await db.table.findMany({
      where: { status: 'available', locationId },
      select: { id: true, number: true, capacity: true }
    })

    const responseBody = {
      menus,
      settings,
      availableTables: tables.length,
      timestamp: new Date().toISOString(),
    }

    // FIX P9: Cache public menu — 5min CDN cache + ETag za 304 Not Modified
    // Menu se redko spreminja (admin edit), ampak gostje pogosto refreshajo
    const response = withCache(
      NextResponse.json(responseBody),
      CachePresets.PUBLIC_SHORT
    )
    return withETag(req, response, responseBody)

  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/public/menu', 'Napaka pri pridobivanju menija')
  }
}
