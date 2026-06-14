// Pomožne funkcije za online naročila
// POST /api/public/online-order — pomožni modul za sheme, validacije in izračune

import { db } from '@/lib/db'
import { z } from 'zod'
import { toNum, isPositive, calcVat, type DecimalLike } from '@/lib/decimal'
import { logger } from '@/lib/logger'
import { NextResponse } from 'next/server'

// ─── Sheme za validacijo ───
export const onlineOrderItemSchema = z.object({
  menuItemId: z.string().min(1),
  quantity: z.number().int().min(1).max(20),
  // FIX BUG-06: price in vatRate se IGNORIRAJO — strežnik uporabi ceno iz baze
  notes: z.string().max(500).default(''),
  modifiersJson: z.string().max(2000).default('[]'),
})

export const deliveryDetailsSchema = z.object({
  fullName: z.string().min(1, 'Ime je obvezno').max(100),
  phone: z.string().min(1, 'Telefon je obvezen').max(30),
  email: z.string().max(200).default(''),
  address: z.string().min(1, 'Naslov je obvezen').max(300),
  city: z.string().min(1, 'Mesto je obvezno').max(100),
  postCode: z.string().min(1, 'Poštna številka je obvezna').max(20),
  notes: z.string().max(1000).default(''),
  type: z.literal('delivery'),
})

export const takeoutDetailsSchema = z.object({
  fullName: z.string().min(1, 'Ime je obvezno').max(100),
  phone: z.string().min(1, 'Telefon je obvezen').max(30),
  email: z.string().max(200).default(''),
  notes: z.string().max(1000).default(''),
  preferredTime: z.string().max(10).default(''),
  type: z.literal('takeout'),
})

export const onlineOrderSchema = z.object({
  orderType: z.enum(['delivery', 'takeout']),
  items: z.array(onlineOrderItemSchema).min(1, 'Naročilo mora vsebovati vsaj en artikel').max(30),
  paymentMethod: z.enum(['card', 'cash', 'mobile']).default('card'),
  customer: z.union([deliveryDetailsSchema, takeoutDetailsSchema]),
  // FIX Q02 CRITICAL: deliveryFee ODSTRANJEN iz klientne sheme — strežnik izračuna iz cone dostave
  promoCode: z.string().max(50).optional(),
  locationId: z.string().optional(),
})

// ─── Konstante ───
export const DELIVERY_FEE = 2.50
export const DELIVERY_FEE_VAT_RATE = 22 // Slovenian standard VAT rate for delivery fees (EU/SI requirement)
export const MIN_ORDER_AMOUNT = 10.00

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

// ─── Izračunaj cene artiklov iz strežniških podatkov ───
export interface OrderItemCalc {
  menuItemId: string; quantity: number; price: number
  vatRate: number; vatAmount: number; notes: string; modifiersJson: string
}

export async function calculateOrderItems(
  items: Array<{ menuItemId: string; quantity: number; notes: string; modifiersJson: string }>,
  menuItemMap: Map<string, { id: string; price: DecimalLike; vatRate: DecimalLike; recipeItems: Array<{ quantityPerServing: DecimalLike; inventoryItem: { id: string; quantity: DecimalLike; costPerUnit: DecimalLike } | null }> }>
): Promise<{ orderItemsData: OrderItemCalc[]; subtotal: number; totalVat: number }> {
  let subtotal = 0
  let totalVat = 0
  const orderItemsData: OrderItemCalc[] = []

  for (const item of items) {
    const menuItem = menuItemMap.get(item.menuItemId)
    if (!menuItem) continue

    const qty = item.quantity
    // FIX HIGH: Dodaj ceno modifikatorjev k subtotal
    let modifierTotal = 0
    const parsedModifiers: Array<{ name?: string; price?: number; id?: string }> = (() => {
      try { return JSON.parse(item.modifiersJson || '[]') } catch { return [] }
    })()

    // FIX CRITICAL: Fetch modifier prices from DB — do NOT trust client prices (price tampering)
    const modifierIds = parsedModifiers.filter(m => m.id).map(m => m.id as string)
    const dbModifiers = modifierIds.length > 0
      ? await db.modifier.findMany({ where: { id: { in: modifierIds } } })
      : []
    const modifierPriceMap = new Map(dbModifiers.map(m => [m.id, m.price]))

    for (const mod of parsedModifiers) {
      const dbPrice = mod.id ? modifierPriceMap.get(mod.id as string) : null
      if (dbPrice !== undefined && dbPrice !== null) {
        modifierTotal += toNum(dbPrice) * qty // Use DB price (trusted)
      } else {
        // FIX CRITICAL: REJECT modifiers without DB price match — ne zaupaj klientu!
        logger.warn('API', `[ONLINE ORDER] Modifier "${mod.name}" rejected — no DB price match (possible price tampering)`)
      }
    }

    const itemBase = toNum(menuItem.price) * qty + modifierTotal
    const itemVat = calcVat(itemBase, menuItem.vatRate)
    subtotal += itemBase
    totalVat += itemVat

    orderItemsData.push({
      menuItemId: menuItem.id, quantity: qty, price: toNum(menuItem.price),
      vatRate: toNum(menuItem.vatRate), vatAmount: itemVat, notes: item.notes, modifiersJson: item.modifiersJson,
    })
  }

  return { orderItemsData, subtotal, totalVat }
}

// ─── Async webhook trigger — ne blokiraj odziva ───
export async function triggerWebhookAsync(event: string, payload: Record<string, unknown>) {
  try {
    const webhooks = await db.webhook.findMany({ where: { isActive: true } })
    const matchingWebhooks = webhooks.filter(wh => {
      try {
        const events: string[] = JSON.parse(wh.events)
        return events.includes(event)
      } catch { return false }
    })

    for (const webhook of matchingWebhooks) {
      await db.webhookDelivery.create({
        data: {
          webhookId: webhook.id, event,
          payload: JSON.stringify(payload),
          statusCode: 0, success: false, attemptCount: 0, maxAttempts: 5, nextRetryAt: new Date(),
        },
      })
    }
  } catch (e: unknown) {
    logger.error('API', 'Webhook trigger error:', e)
  }
}
