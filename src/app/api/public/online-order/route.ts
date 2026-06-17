
// =====================================================================
// ONLINE ORDER API - Spletna naročila z dostavo ali prevzemom
// Podpora za: delivery, takeout z online plačilom
// Ekvivalent Toast Online Ordering za slovenski trg
// FIX CRITICAL: Skupni rate limiter modul
// =====================================================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { toNum } from '@/lib/decimal'
import { checkRateLimit, getClientIp, ONLINE_ORDER_LIMIT } from '@/lib/rate-limit'
import { handleRouteError, validateRequest } from '@/lib/api-utils'
import {

  onlineOrderSchema, MIN_ORDER_AMOUNT,
  checkRestaurantOpen, calculateDeliveryFee, calculateOrderItems,
  triggerWebhookAsync, createOnlineOrder,
} from './_helpers'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  // FIX CRITICAL: Rate limiting — skupni modul
  const clientIp = getClientIp(req)
  const rateCheck = checkRateLimit('online-order', clientIp, ONLINE_ORDER_LIMIT)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Preveč naročil. Poskusite znova čez nekaj minut.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.retryAfterMs || 120000) / 1000)) } }
    )
  }

  try {
    // FIX MEDIUM: Fail-CLOSED — če nastavitv ni mogoče prebrati, ZAPRI naročila
    const openError = await checkRestaurantOpen()
    if (openError) return openError

    const { data, error: validationError } = await validateRequest(req, onlineOrderSchema)
    if (validationError) return validationError

    const { orderType, items, paymentMethod, customer, promoCode, locationId } = data

    // Pridobi menu iteme iz DB (strežniška cena, NE klientova!)
    const menuItemIds = [...new Set(items.map((i: { menuItemId: string }) => i.menuItemId))]
    const menuItems = await db.menuItem.findMany({
      where: { id: { in: menuItemIds }, isAvailable: true },
      include: { recipeItems: { include: { inventoryItem: true } } },
    })
    const menuItemMap = new Map(menuItems.map(mi => [mi.id, mi]))

    // FIX BUG-06: Subtotal iz strežniških cen, NE klientovih
    const itemsSubtotal = items.reduce((sum: number, i: { menuItemId: string; quantity: number }) => {
      const mi = menuItemMap.get(i.menuItemId)
      return sum + (mi ? toNum(mi.price) * i.quantity : 0)
    }, 0)

    // Ponovno preveri minimum za dostavo s strežniškimi cenami
    if (orderType === 'delivery' && itemsSubtotal < MIN_ORDER_AMOUNT) {
      return NextResponse.json({ error: `Minimalno naročilo za dostavo je €${MIN_ORDER_AMOUNT.toFixed(2)}` }, { status: 400 })
    }

    if (menuItems.length !== menuItemIds.length) {
      const foundIds = new Set(menuItems.map(m => m.id))
      const missing = menuItemIds.filter(id => !foundIds.has(id))
      return NextResponse.json({ error: 'Nekateri artikli niso na voljo', unavailableItems: missing }, { status: 400 })
    }

    // FIX Q02 CRITICAL: deliveryFee se izračuna strežniško iz cone dostave
    let actualDeliveryFee = 0
    if (orderType === 'delivery' && 'postCode' in customer) {
      const feeResult = await calculateDeliveryFee(customer, itemsSubtotal)
      if (feeResult.error) return feeResult.error
      actualDeliveryFee = feeResult.fee
    }

    // Preveri lokacijo
    if (locationId) {
      const location = await db.location.findUnique({ where: { id: locationId } })
      if (!location || !location.isActive) {
        return NextResponse.json({ error: 'Izbrana lokacija ni na voljo' }, { status: 400 })
      }
    }

    // Generiraj številko naročila
    // FIX Q04 MEDIUM: Če counter ne deluje, VRNI NAPAKO namesto neatomskega fallbacka
    let nextOrderNumber: number
    try {
      const counter = await db.counter.upsert({
        where: { name: 'orderNumber' }, update: { value: { increment: 1 } }, create: { name: 'orderNumber', value: 1 },
      })
      nextOrderNumber = counter.value
    } catch (_counterErr: unknown) {
      return NextResponse.json({ error: 'Napaka pri generiranju številke naročila. Poskusite znova.' }, { status: 503 })
    }

    // Generiraj številko čeka
    let nextCheckNumber: number
    try {
      const counter = await db.counter.upsert({
        where: { name: 'checkNumber' }, update: { value: { increment: 1 } }, create: { name: 'checkNumber', value: 1 },
      })
      nextCheckNumber = counter.value
    } catch {
      return NextResponse.json({ error: 'Napaka pri generiranju številke čeka. Poskusite znova.' }, { status: 503 })
    }

    // Izračunaj zneske iz strežniških podatkov
    const { orderItemsData, subtotal, totalVat } = await calculateOrderItems(items, menuItemMap)

    // Ustvari naročilo znotraj transakcije
    const { order, customerName, customerPhone, deliveryAddress } = await createOnlineOrder({
      orderType,
      items,
      paymentMethod,
      customer: customer as Record<string, unknown>,
      promoCode,
      locationId,
      menuItemMap,
      orderItemsData,
      subtotal,
      totalVat,
      actualDeliveryFee,
      nextOrderNumber,
      nextCheckNumber,
    })

    // Sproži webhook za novo online naročilo (ne blokiraj odziva)
    triggerWebhookAsync('order.created', {
      orderId: order.id, orderNumber: String(order.orderNumber),
      type: orderType, total: toNum(order.total),
      customerName, customerPhone, paymentMethod, source: 'online',
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      order: {
        id: order.id, orderNumber: String(order.orderNumber), status: order.status,
        total: toNum(order.total), orderType,
        estimatedTime: orderType === 'delivery' ? '30-45 min' : '15-25 min',
        deliveryAddress, paymentMethod,
      },
    }, { status: 201 })

  } catch (error: unknown) {
    return handleRouteError(error, 'POST /api/public/online-order', [
      { match: 'INSUFFICIENT_STOCK', message: 'Artikel ni na zalogi', status: 409, extra: (parts) => ({ error: `Na žalost ${parts[1] || 'Artikel'} ni več na zalogi (${parts[2] || ''}). Prosimo, izberite drug artikel.` }) },
    ], 'Napaka pri oddaji naročila. Prosimo, poskusite znova.')
  }
}
