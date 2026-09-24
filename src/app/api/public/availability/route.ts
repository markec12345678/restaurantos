// =====================================================================
// R124 (epic #115, P0-03): PUBLIC REAL-TIME AVAILABILITY ENDPOINT
// =====================================================================
// GET /api/public/availability?locationId=... — lagoten, NO-STORE endpoint
// za sold-out propagation v realnem času na javnih kanalih (QR meni).
//
// Zakaj ločen endpoint: GET /api/public/menu uporablja 5-min CDN cache
// (PUBLIC_SHORT — gostje pogosto refreshajo, meni se redko spreminja).
// Zaloga pa je REALNO-ČASOVNA: kanon P0-03 zahteva, da QR ne kaže
// "na zalogi" ko POS že kaže sold-out. Rešitev: meni ostane cachean,
// availability se polla iz tega endpointa (no-store) vsakih ~30 s.
//
// Scope: SAMO artikli aktivnih menijev lokacije (brez uhajanja tujih
// artiklov); fail-closed locationId validacija (isti 404 kanon kot
// public/menu — R90 P0-C3B).
// =====================================================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkRateLimitAsync, getClientIp, PUBLIC_MENU_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { handleApiError } from '@/lib/api-utils'
import { notInScopeResponse } from '@/lib/tenant-scope'
import { computeMenuStockMap } from '@/lib/availability/menu-availability'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // Isti rate-limit razred kot public menu (javni, anonimni)
  const clientIp = getClientIp(req)
  const rateCheck = await checkRateLimitAsync('public-availability', clientIp, PUBLIC_MENU_LIMIT)
  if (!rateCheck.allowed) {
    return rateLimitedResponse(rateCheck.retryAfterMs, 'Preveč zahtevkov. Poskusite znova čez nekaj sekund.')
  }

  try {
    const { searchParams } = new URL(req.url)
    const locationId = searchParams.get('locationId')?.trim() || ''

    // R90 kanon: manjkajoč / neveljaven locationId → enoten 404, ZERO db
    if (!locationId) {
      return notInScopeResponse('Lokacija')
    }
    if (!/^[a-z0-9]{5,50}$/i.test(locationId)) {
      return notInScopeResponse('Lokacija')
    }

    // Lokacija MORA obstajati + biti aktivna (isti 404, ni obstoja-oraklja)
    const location = await db.location.findFirst({
      where: { id: locationId, isActive: true },
      select: { id: true },
    })
    if (!location) {
      return notInScopeResponse('Lokacija')
    }

    // Samo id-ji artiklov aktivnih menijev te lokacije (scope — brez uhajanja)
    const menus = await db.menu.findMany({
      where: { isActive: true, locationId },
      select: {
        categories: {
          select: {
            menuItems: {
              where: { isAvailable: true },
              select: { id: true },
            },
          },
        },
      },
    })
    const menuItemIds = menus.flatMap(m => m.categories.flatMap(c => c.menuItems.map(i => i.id)))
    if (menuItemIds.length === 0) {
      return NextResponse.json(
        { availability: {}, timestamp: new Date().toISOString() },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const stockMap = await computeMenuStockMap({ menuItemIds })

    // Minimalen javni payload — brez unit/source detailjev (ni poslovnih skrivnosti)
    const availability: Record<string, { stockStatus: string; stockAvailable: number | null }> = {}
    for (const [id, entry] of Object.entries(stockMap)) {
      availability[id] = {
        stockStatus: entry.status,
        stockAvailable: entry.available,
      }
    }

    return NextResponse.json(
      { availability, timestamp: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/public/availability', 'Napaka pri pridobivanju razpoložljivosti')
  }
}
