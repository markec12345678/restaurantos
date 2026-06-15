// Pomožne funkcije za online naročila — Preverjanje odpiralnega časa in dostave

import { db } from '@/lib/db'
import { toNum, isPositive } from '@/lib/decimal'
import { logger } from '@/lib/logger'
import { NextResponse } from 'next/server'
import { DELIVERY_FEE } from './schemas'

// ─── Preveri, ali je restavracija odprta ───
// FIX MEDIUM: Fail-CLOSED, ne fail-open — če nastavitv ni mogoče prebrati, ZAPRI naročila
export async function checkRestaurantOpen(): Promise<NextResponse | null> {
  try {
    // FIX: Uporabi OpeningHours model (ne Configuration, ki ne obstaja v Prisma shemi)
    const hours = await db.openingHours.findMany({ where: {} })
    if (hours && hours.length > 0) {
      // FIX MEDIUM: Uporabi slovenski čas (CET/CEST), ne strežnikov lokalni čas
      const slovenianTime = new Date().toLocaleString('en-US', { timeZone: 'Europe/Ljubljana' })
      const now = new Date(slovenianTime)
      const dayOfWeek = now.getDay()
      const todayHours = hours.find(h => h.dayOfWeek === dayOfWeek)
      if (!todayHours || todayHours.isClosed) {
        return NextResponse.json({ error: 'Restavracija je trenutno zaprta.' }, { status: 403 })
      }
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      if (todayHours.openTime && currentTime < todayHours.openTime) {
        return NextResponse.json({ error: 'Restavracija še ni odprta.' }, { status: 403 })
      }
      if (todayHours.closeTime && currentTime > todayHours.closeTime) {
        return NextResponse.json({ error: 'Restavracija je že zaprta.' }, { status: 403 })
      }
    }
    return null // Restavracija je odprta
  } catch (configError: unknown) {
    // FIX MEDIUM: Fail-CLOSED — če nastavitve ni mogoče prebrati, blokiraj naročila
    logger.error('API', '[ONLINE-ORDER] Napaka pri preverjanju odpiralnega časa:', configError)
    return NextResponse.json({ error: 'Ni mogoče preveriti odpiralnega časa. Poskusite znova.' }, { status: 503 })
  }
}

// ─── Izračunaj dostavno iz cone ───
// FIX Q02 CRITICAL: deliveryFee se izračuna strežniško iz cone dostave — NE iz klienta
interface DeliveryCustomer { postCode: string; city: string }
export async function calculateDeliveryFee(
  customer: DeliveryCustomer, itemsSubtotal: number
): Promise<{ fee: number; error?: NextResponse }> {
  const zones = await db.deliveryZone.findMany({ where: { isActive: true } })
  const matchingZone = zones.find(zone => {
    try {
      const postCodes: string[] = JSON.parse(zone.postCodes)
      const cities: string[] = JSON.parse(zone.cities)
      const postCodeMatch = postCodes.includes(customer.postCode)
      const cityMatch = cities.some(c => customer.city.toLowerCase().includes(c.toLowerCase()))
      return postCodeMatch || cityMatch
    } catch { return false }
  })

  if (!matchingZone && zones.length > 0) {
    return {
      fee: 0,
      error: NextResponse.json({
        error: 'Na ta naslov ne dostavljamo. Izberite prevzem na lokaciji.',
        deliverable: false,
      }, { status: 400 }),
    }
  }

  if (matchingZone && itemsSubtotal < toNum(matchingZone.minOrderAmount)) {
    return {
      fee: 0,
      error: NextResponse.json({
        error: `Minimalno naročilo za cono "${matchingZone.name}" je €${toNum(matchingZone.minOrderAmount).toFixed(2)}`,
      }, { status: 400 }),
    }
  }

  // FIX D-13 LOW: Uporabi freeDeliveryAbove iz cone — brezplačna dostava nad pragom
  if (matchingZone && isPositive(matchingZone.freeDeliveryAbove) && itemsSubtotal >= toNum(matchingZone.freeDeliveryAbove)) {
    return { fee: 0 } // Brezplačna dostava nad pragom
  }

  // FIX CRITICAL: Prejšnja koda je uporabila `||` kar obrne 0 kot falsy
  const fee = matchingZone ? toNum(matchingZone.deliveryFee) : DELIVERY_FEE
  return { fee }
}
