
// =====================================================================
// PUBLIC ORDER TRACKING — Sledenje statusu online naročila
// GET /api/public/order-track?orderId=xxx&phone=040123456
// Varnost: zahteva vsaj zadnje 4 številke telefona
// FIX CRITICAL: Rate limiting za preprečitev enumeracije naročil
// =====================================================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { checkRateLimitAsync, getClientIp, ORDER_TRACK_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { handleApiError } from '@/lib/api-utils'


export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // FIX CRITICAL: Rate limiting
  const clientIp = getClientIp(req)
  const rateCheck = await checkRateLimitAsync('order-track', clientIp, ORDER_TRACK_LIMIT)
  if (!rateCheck.allowed) {
    return rateLimitedResponse(rateCheck.retryAfterMs, 'Preveč zahtevkov. Poskusite znova čez nekaj sekund.')
  }

  try {
    const url = new URL(req.url)
    const orderId = url.searchParams.get('orderId')
    const orderNumber = url.searchParams.get('orderNumber')
    const phone = url.searchParams.get('phone')?.trim()
    // R83: izbirna lokacijska vezava — orderNumber je per-lokacijski števec
    // (globalno se trči med tenanti). Gostova UI ve, s katere lokacije je
    // naročil → z ?locationId= je lookup scoped; brez nje disambiguacija prek
    // telefona (spodaj).
    const locationId = url.searchParams.get('locationId')?.trim()

    if (!orderId && !orderNumber) {
      return NextResponse.json({ error: 'ID ali številka naročila je obvezna' }, { status: 400 })
    }

    // FIX MEDIUM: Validiraj format orderId — zavrni očitno neveljavne vnose
    if (orderId && !/^[a-z0-9]{5,50}$/i.test(orderId)) {
      return NextResponse.json({ error: 'Neveljaven format ID-ja naročila' }, { status: 400 })
    }
    // FIX MEDIUM: Validiraj orderNumber — samo številke
    if (orderNumber && !/^\d{1,10}$/.test(orderNumber)) {
      return NextResponse.json({ error: 'Neveljavna številka naročila' }, { status: 400 })
    }
    // R83: validiraj format locationId, če je podan (isti razred kot orderId)
    if (locationId && !/^[a-z0-9]{5,50}$/i.test(locationId)) {
      return NextResponse.json({ error: 'Neveljaven format lokacije' }, { status: 400 })
    }
    // R83: telefon mora biti numeričen (prej je bil sprejet kateri koli 4-znakski niz)
    if (phone && !/^\d{4,20}$/.test(phone.replace(/\s/g, ''))) {
      return NextResponse.json({ error: 'Neveljavna telefonska številka' }, { status: 400 })
    }

    // FIX BUG6: Only allow UUID-based access without phone verification.
    // orderNumber is sequential and easy to enumerate — require phone for that lookup.
    // UUID orderId is unguessable, so it's safe to allow without phone for recent orders.
    // FIX MEDIUM: Zmanjšaj UUID-only okno iz 30 min na 15 min — manjša izpostavljenost
    const isUuidLookup = !!orderId && /^[a-z0-9]{20,}$/i.test(orderId)

    if (!phone || phone.length < 4) {
      // Without phone: only allow UUID-based lookup for recent orders
      if (!isUuidLookup) {
        return NextResponse.json({ error: 'Telefonska številka je obvezna za iskanje po številki naročila' }, { status: 400 })
      }
      // Allow UUID access for recent orders only (customer just placed the order)
      // FIX MEDIUM: Zmanjšaj okno na 15 minut — zmanjšaj tveganje izpostavljenosti PII
      const recentCutoff = new Date(Date.now() - 15 * 60000)
      const recentOrder = await db.order.findFirst({
        where: {
          id: orderId,
          createdAt: { gte: recentCutoff },
        },
      })
      if (!recentOrder) {
        return NextResponse.json({ error: 'Telefonska številka je obvezna za sledenje' }, { status: 400 })
      }
    }

    // Poišči kandidate — R83: findMany (max 5) za disambiguacijo trkov
    // orderNumber čez lokacije (per-lokacijski števec). Izbirna lokacijska vezava.
    const where: Record<string, unknown> = {}
    if (orderId) where.id = orderId
    if (orderNumber) where.orderNumber = parseInt(orderNumber) || 0
    if (locationId) where.locationId = locationId

    const candidates = await db.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        orderItems: {
          include: { menuItem: { select: { name: true, image: true } } },
        },
        deliveryInfo: true,
        diningOption: true,
      },
    })

    if (candidates.length === 0) {
      return NextResponse.json({ error: 'Naročilo ni bilo najdeno' }, { status: 404 })
    }

    // R83 fix PRAZEN-TELEFON BYPASS: prej je bilo `inputPhone.endsWith('')`
    // vedno true, ko naročilo NI imelo customerPhone → kateri koli 4-znakski
    // telefon je "preveril" naročilo (cross-tenant branje po sekvenčnem
    // orderNumber). Zdaj: naročilo brez shranjene telefonske številke NI nikoli
    // preverjeno — vrne se 403 brez PII.
    const wantsPhoneVerify = !!phone && phone.length >= 4
    let verified = false
    let order: (typeof candidates)[number] | undefined

    if (wantsPhoneVerify) {
      const inputPhone = (phone as string).replace(/\s/g, '')
      order = candidates.find(c => {
        const orderPhone = (c.customerPhone || '').replace(/\s/g, '')
        // brez shranjenega telefona ni verifikacije (prej: endsWith('') = true bypass)
        if (!orderPhone) return false
        return orderPhone.endsWith(inputPhone.slice(-4)) || inputPhone.endsWith(orderPhone.slice(-4))
      })
      if (!order) {
        return NextResponse.json({ error: 'Napačna telefonska številka' }, { status: 403 })
      }
      verified = true
    } else {
      // brez telefona: samo UUID-recent pot (zagotovljena zgoraj) — prvi kandidat
      order = candidates[0]
    }

    // Status timeline
    const timeline: Array<{ status: string; label: string; time?: string; completed: boolean }> = []
    const statusOrder = ['pending', 'confirmed', 'in-progress', 'ready', 'delivered']
    const statusLabels: Record<string, string> = {
      'pending': 'Naročilo prejeto',
      'confirmed': 'Potrjeno',
      'in-progress': 'V pripravi',
      'ready': 'Pripravljeno',
      'delivered': 'Dostavljeno / Prevzeto',
      'cancelled': 'Preklicano',
    }

    if (order.status === 'cancelled') {
      timeline.push({ status: 'cancelled', label: 'Preklicano', completed: true, time: order.cancelledAt?.toISOString() })
    } else {
      const currentIdx = statusOrder.indexOf(order.status)
      for (let i = 0; i < statusOrder.length; i++) {
        timeline.push({
          status: statusOrder[i],
          label: statusLabels[statusOrder[i]] || statusOrder[i],
          completed: i <= currentIdx,
          time: i === currentIdx ? order.updatedAt.toISOString() : undefined,
        })
      }
    }

    return NextResponse.json({
      order: {
        id: order.id,
        orderNumber: String(order.orderNumber),
        status: order.status,
        type: order.type,
        // FIX MEDIUM + R83: PII (ime, naslov) SAMO ob uspešni telefonski verifikaciji
        // (prej je bil gate `phone && length>=4` — bypass prek praznega orderPhone)
        ...(verified ? { customerName: order.customerName } : {}),
        subtotal: order.subtotal,
        tax: order.tax,
        total: order.total,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        items: order.orderItems.map(item => ({
          name: item.menuItem?.name || 'Artikel',
          quantity: item.quantity,
          notes: item.notes,
        })),
        // FIX MEDIUM + R83: dostavni naslov samo ob verifikaciji
        delivery: (verified && order.deliveryInfo) ? {
          address: order.deliveryInfo.address,
          city: order.deliveryInfo.city,
          estimatedTime: order.deliveryInfo.estimatedTime?.toISOString(),
          status: order.deliveryInfo.status,
        } : order.deliveryInfo ? {
          // Brez telefona vrni samo status dostave, ne naslova
          estimatedTime: order.deliveryInfo.estimatedTime?.toISOString(),
          status: order.deliveryInfo.status,
        } : null,
      },
      timeline,
      estimatedMinutes: order.type === 'delivery' ? 35 : 20,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/public/order-track', 'Napaka pri sledenju naročila')
  }
}
