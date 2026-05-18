import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'

// =====================================================================
// PUBLIC DELIVERY CHECK — Preveri ali je naslov v coni dostave
// GET /api/public/delivery-check?postCode=1000&city=Ljubljana
// =====================================================================

const checkSchema = z.object({
  postCode: z.string().min(1),
  city: z.string().default(''),
})

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const postCode = url.searchParams.get('postCode') || ''
    const city = url.searchParams.get('city') || ''

    if (!postCode) {
      return NextResponse.json({ error: 'Poštna številka je obvezna' }, { status: 400 })
    }

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
          return NextResponse.json({
            deliverable: true,
            zone: {
              id: zone.id,
              name: zone.name,
              deliveryFee: zone.deliveryFee,
              minOrderAmount: zone.minOrderAmount,
              freeDeliveryAbove: zone.freeDeliveryAbove,
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
          id: defaultZone.id,
          name: defaultZone.name,
          deliveryFee: defaultZone.deliveryFee,
          minOrderAmount: defaultZone.minOrderAmount,
          freeDeliveryAbove: defaultZone.freeDeliveryAbove,
          estimatedMinutes: defaultZone.estimatedMinutes,
        },
      })
    }

    return NextResponse.json({
      deliverable: false,
      message: 'Na žalost ne dostavljamo na ta naslov. Poskusite prevzem na lokaciji.',
    })
  } catch (error) {
    console.error('Delivery check error:', error)
    return NextResponse.json({ error: 'Napaka pri preverjanju dostave' }, { status: 500 })
  }
}
