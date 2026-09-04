
// =====================================================================
// PUBLIC DELIVERY CHECK — Preveri ali je naslov v coni dostave
// GET /api/public/delivery-check?postCode=1000&city=Ljubljana
// FIX CRITICAL: Rate limiting za preprečitev zlorabe
// FIX HIGH: Ne izpostavljaj internih ID-jev
// =====================================================================

// FIX MEDIUM: Zod validacija za query parametre
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { checkRateLimitAsync, getClientIp, DELIVERY_CHECK_LIMIT } from '@/lib/rate-limit'
import { toNum } from '@/lib/decimal'
import { z } from 'zod'
import { handleApiError } from '@/lib/api-utils'


const deliveryCheckSchema = z.object({
  postCode: z.string().min(1, 'Poštna številka je obvezna').max(20),
  city: z.string().max(100).default(''),
})

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // FIX CRITICAL: Rate limiting
  const clientIp = getClientIp(req)
  const rateCheck = await checkRateLimitAsync('delivery-check', clientIp, DELIVERY_CHECK_LIMIT)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Preveč zahtevkov. Poskusite znova čez nekaj sekund.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.retryAfterMs || 60000) / 1000)) } }
    )
  }

  try {
    const url = new URL(req.url)
    // FIX MEDIUM: Validiraj vnos z Zod
    const parsed = deliveryCheckSchema.safeParse({
      postCode: url.searchParams.get('postCode') || '',
      city: url.searchParams.get('city') || '',
    })
    if (!parsed.success) {
      return NextResponse.json({ error: 'Neveljavni podatki' }, { status: 400 })
    }
    const { postCode, city } = parsed.data

    // Pridobi vse aktivne cone dostave
    const zones = await db.deliveryZone.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    })

    // Poišči prvo cono, ki ustreza naslovu
    for (const zone of zones) {
      try {
        const postCodes: string[] = JSON.parse(zone.postCodes || '[]')
        const cities: string[] = JSON.parse(zone.cities || '[]')

        // Preveri poštno številko
        const postCodeMatch = postCodes.length === 0 || postCodes.includes(postCode)
        // Preveri mesto (če je določeno)
        const cityMatch = cities.length === 0 || cities.some(c => city.toLowerCase().includes(c.toLowerCase()))

        if (postCodeMatch && cityMatch) {
          // FIX HIGH: Ne izpostavljaj zone.id — samo ime in nastavitve
          return NextResponse.json({
            deliverable: true,
            zone: {
              name: zone.name,
              deliveryFee: toNum(zone.deliveryFee),
              minOrderAmount: toNum(zone.minOrderAmount),
              freeDeliveryAbove: toNum(zone.freeDeliveryAbove),
              estimatedMinutes: zone.estimatedMinutes,
            },
          })
        }
      } catch {
        // Skip zones with invalid JSON
        continue
      }
    }

    // Preveri ali obstaja kakšna cona s privzetimi nastavitvami (brez omejitev)
    const defaultZone = zones.find(z => {
      try {
        const pc = JSON.parse(z.postCodes || '[]')
        const ct = JSON.parse(z.cities || '[]')
        return pc.length === 0 && ct.length === 0 && z.isActive
      } catch { return false }
    })

    if (defaultZone) {
      return NextResponse.json({
        deliverable: true,
        zone: {
          name: defaultZone.name,
          deliveryFee: toNum(defaultZone.deliveryFee),
          minOrderAmount: toNum(defaultZone.minOrderAmount),
          freeDeliveryAbove: toNum(defaultZone.freeDeliveryAbove),
          estimatedMinutes: defaultZone.estimatedMinutes,
        },
      })
    }

    return NextResponse.json({
      deliverable: false,
      message: 'Na žalost ne dostavljamo na ta naslov. Poskusite prevzem na lokaciji.',
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/public/delivery-check', 'Napaka pri preverjanju dostave')
  }
}
