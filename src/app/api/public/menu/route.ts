
// =====================================================================
// PUBLIC MENU ENDPOINT - Brez avtentikacije (za QR meni)
// Vrne celoten meni s kategorijami in alergeni za prikaz na telefonu
// Optimizirano za mobilne naprave - minimalni podatki za hitrost
// FIX CRITICAL: Rate limiting za preprečitev zlorabe
// FIX P0-C3B (R90 KANON): izrecen ?locationId je OBVEZEN — fallback
// "prva aktivna lokacija" (prvi tenant v DB!) je IZKORENJEN. Manjkajoč /
// neveljaven / neznan / neaktiven locationId → enoten notInScopeResponse 404
// (ni obstoja-oraklja; ZERO db klicev za manjkajoč ali napačen format).
// Frontend (R90-2): qr/[tableId] sekvenca verify-table → locationId →
// menu fetch; qr-menu page pošilja ?locationId že od R87-3.
// =====================================================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { checkRateLimitAsync, getClientIp, PUBLIC_MENU_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { handleApiError } from '@/lib/api-utils'
import { getRestaurantInfoForLocation } from '@/lib/furs/config-resolver'
import { withCache, withETag, CachePresets } from '@/lib/middleware/cache-headers'
import { notInScopeResponse } from '@/lib/tenant-scope'


export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // FIX CRITICAL: Rate limiting
  const clientIp = getClientIp(req)
  const rateCheck = await checkRateLimitAsync('public-menu', clientIp, PUBLIC_MENU_LIMIT)
  if (!rateCheck.allowed) {
    return rateLimitedResponse(rateCheck.retryAfterMs, 'Preveč zahtevkov. Poskusite znova čez nekaj sekund.')
  }

  try {
    const { searchParams } = new URL(req.url)
    const locationId = searchParams.get('locationId')?.trim() || ''

    // R90 KANON (P0-C3B izkoreninjen): manjkajoč ?locationId → unificiran 404
    // z ZERO db klici (ni first-active lookupa, ni menija, ni nastavitev, ni
    // miz — prej: prva aktivna lokacija KATEREGA KOLI tenanta = njen meni/
    // settings/mize za anonimnega klicatelja).
    if (!locationId) {
      return notInScopeResponse('Lokacija')
    }

    // R90: neveljavna oblika → isti 404, še vedno ZERO db (regex PRED poizvedbo;
    // isti razred oblike kot kiosk resolveKioskLocation).
    if (!/^[a-z0-9]{5,50}$/i.test(locationId)) {
      return notInScopeResponse('Lokacija')
    }

    // R90: lokacija MORA obstajati IN biti AKTIVNA (prej: neznana/neaktivna
    // locationId → prazen meni + settings tuje lokacije). Neznana / tuja /
    // neaktivna → ISTI unificiran 404 (ni obstoja-oraklja; select { id } =
    // minimalen; isActive v where izloči tuje tenante).
    const location = await db.location.findFirst({
      where: { id: locationId, isActive: true },
      select: { id: true },
    })
    if (!location) {
      return notInScopeResponse('Lokacija')
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
