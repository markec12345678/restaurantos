// ============================================
// /api/mobile/menu — Mobile-friendly menu
// ============================================
// Optimiziran za mobilne naprave (manj podatkov, hitrejši response).
// Uporablja API key auth (ne session).
// ============================================
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { handleApiError } from '@/lib/api-utils'
import { verifyApiKey } from '@/lib/api-security'
import { toNum } from '@/lib/decimal'
import { parseAllergens } from '@/lib/json-fields'
// R93-c: rate-limit kanon (fiksni store key + fail-closed core). 429 helper
// direktno iz '/response' (ne barrel) — testni mocki so lastniki barrel-a.
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'

export const dynamic = 'force-dynamic'

// GET — mobile menu (kompakten format)
export async function GET(req: Request) {
  try {
    // R93-c (anonimni model, zrcali mobile/order + public/*): rate limit NA
    // VRHU try bloka, PRED verifyApiKey — vsak verifyApiKey klic naredi DB
    // lookup (ApiKey tabela), zato invalid-key brute-force dušimo PRED
    // avtentikacijo. Fiksni store key 'mobile-menu' (ne pathname-izpeljan)
    // preprečuje per-id fan-out iz enega IP-ja; fail-closed core.ts kanon.
    const rateCheck = await checkRateLimitAsync('mobile-menu', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rateCheck.allowed) {
      return rateLimitedResponse(rateCheck.retryAfterMs, 'Preveč zahtevkov')
    }

    // API key auth (za mobile app)
    const authHeader = req.headers.get('authorization')
    const apiKeyResult = await verifyApiKey(authHeader)

    if (!apiKeyResult.valid) {
      return NextResponse.json({ error: apiKeyResult.error }, { status: 401 })
    }

    // Preveri scope
    if (!apiKeyResult.apiKey?.scopes.includes('read:menu') && !apiKeyResult.apiKey?.scopes.includes('admin')) {
      return NextResponse.json({ error: 'Nimaš dovoljenja za menu' }, { status: 403 })
    }

    // FIX R85-FINAL (MEDIUM): Tenant binding — API ključ je bil avtenticiran,
    // ampak subscriptionId nikoli uporabljen: poljuben ?locationId + fallback
    // "prva aktivna lokacija GLEDE NA VSE" = branje menija poljubne naročnine
    // s katerim koli veljavnim ključem. Zdaj: lokacija MORA pripadati naročnini
    // ključa (R82-C mobile/order vzorec); fallback = prva aktivna lokacija
    // TE naročnine (single-tenant compat ohranjen).
    const subId = apiKeyResult.subscriptionId ?? null
    if (!subId) {
      return NextResponse.json({ error: 'API ključ ni vezan na naročnino' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const requestedLocationId = searchParams.get('locationId')
    let locationId: string

    if (requestedLocationId) {
      // Lokacija mora biti dokazljivo last naročnine ključa (fail-closed)
      const owned = await db.location.findFirst({
        where: { id: requestedLocationId, subscriptionId: subId, isActive: true },
        select: { id: true },
      })
      if (!owned) {
        return NextResponse.json({ error: 'Lokacija ni vezana na to naročnino' }, { status: 403 })
      }
      locationId = owned.id
    } else {
      // FIX P0-C2/C3B (scoped): auto-detect prva aktivna lokacija NAROČNINE
      // (prej prva aktivna lokacija VSEH tenantov)
      const firstActive = await db.location.findFirst({
        where: { isActive: true, subscriptionId: subId },
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

    // Pridobi meni (samo aktivni artikli za specifično lokacijo)
    // FIX: MenuItem nima lastnega locationId — scoping prek category.menu.locationId
    const menuItems = await db.menuItem.findMany({
      where: {
        isAvailable: true,
        category: { menu: { locationId } },
      },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        image: true,
        categoryId: true,
        allergens: true,
      },
      orderBy: { name: 'asc' },
    })

    // Pridobi kategorije posebej
    const categoryIds = [...new Set(menuItems.map((i) => i.categoryId).filter(Boolean))]
    const categories = await db.category.findMany({
      where: { id: { in: categoryIds as string[] } },
      select: { id: true, name: true, sortOrder: true },
    })

    // Grupiraj po kategorijah za mobilni prikaz
    const grouped: Record<string, {
      categoryId: string
      categoryName: string
      items: Array<{
        id: string
        name: string
        description: string
        price: number
        image: string
        allergens: string[]
      }>
    }> = {}

    for (const item of menuItems) {
      const catId = item.categoryId || 'uncategorized'
      if (!grouped[catId]) {
        const cat = categories.find((c) => c.id === catId)
        grouped[catId] = {
          categoryId: catId,
          categoryName: cat?.name || 'Ostalo',
          items: [],
        }
      }
      grouped[catId].items.push({
        id: item.id,
        name: item.name,
        description: item.description,
        price: toNum(item.price),
        image: item.image,
        // P1-9 FIX (KRITIČNO): MenuItem.allergens je v bazi CSV format
        // ("1,3,7") — prej JSON.parse je vržel SyntaxError → 500 na CELEM
        // mobile meniju ob prvem artiklu z alergeni! Toleranten parser
        // podpira CSV + JSON format.
        allergens: parseAllergens(item.allergens),
      })
    }

    return NextResponse.json({
      categories: Object.values(grouped),
      totalCount: menuItems.length,
      currency: 'EUR',
      lastUpdated: new Date().toISOString(),
    })
  } catch (err) {
    return handleApiError(err, 'mobile/menu GET')
  }
}
