// ============================================
// QR Pay-at-Table API — Gost plača preko QR kode
// ============================================
// 40% gostov preferira QR plačilo (raziskava 2025)
// Flow:
//   1. Natakar ustvari ček → POST /api/qr-pay/init → vrne QR kodo z URL
//   2. Gost poslika QR kodo → odpri URL v brskalniku
//   3. Gost vidi znesek, izbere plačilno metodo, potrdi
//   4. POST /api/qr-pay/confirm → ustvari Payment + update Check/Order
// ============================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { toNum, round2 } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { getRestaurantInfoForLocation } from '@/lib/furs/config-resolver'
import { handleApiError, parseJsonBody } from '@/lib/api-utils'
import { logger } from '@/lib/logger'
import { qrPayTokenFor, verifyQrPayToken } from '@/lib/qr-pay-token'
import { checkRateLimitAsync, getClientIp, QR_PAY_LIMIT } from '@/lib/rate-limit'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// POST /api/qr-pay/init — Ustvari QR pay session za ček
const initSchema = z.object({
  checkId: z.string().min(1),
})

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error } = initSchema.safeParse(bodyResult.data)
    if (error) {
      return NextResponse.json({ error: 'Neveljavni podatki' }, { status: 400 })
    }

    // FIX R81 (LEAK-HIGH, tenant scope): ček se pridobi LOKACIJSKO scoped
    // (Check nima lastnega locationId — pot prek order.locationId). Staff ne more
    // ustvariti QR session za tuj ček.
    const sessionLocId = authResult.session?.locationId ?? null
    const check = await db.check.findFirst({
      where: {
        id: data.checkId,
        ...(sessionLocId ? { order: { locationId: sessionLocId } } : {}),
      },
      include: {
        order: {
          include: {
            table: { select: { number: true } },
            orderItems: {
              where: { voided: false },
              include: { menuItem: { select: { name: true, image: true } } },
            },
          },
        },
      },
    })

    if (!check) {
      return NextResponse.json({ error: 'Ček ni najden' }, { status: 404 })
    }

    if (check.paymentStatus === 'paid') {
      return NextResponse.json({ error: 'Ček je že plačan' }, { status: 400 })
    }

    // FIX R81 (LEAK-HIGH): token je zdaj STATELESS HMAC VEZAVA ček↔token
    // (prej random hex, ki se ni nikjer shranil in se NIKOLI preveril).
    // Token se izda samo prek avtenticiranega init POST z lokacijskim scope-om.
    const sessionToken = qrPayTokenFor(check.id)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minut veljavnost (informativno; vezava je trajna — glej R82 opombo v qr-pay-token.ts)

    // Zgradi QR pay URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const qrPayUrl = `${appUrl}/qr-pay/${sessionToken}`

    // Pripravi podatke za prikaz gostu
    const items = check.order.orderItems.map(oi => ({
      name: oi.menuItem?.name || oi.menuItemName || 'Artikel',
      quantity: oi.quantity,
      price: toNum(oi.price),
      total: round2(toNum(oi.price) * oi.quantity),
    }))

    const result = {
      sessionToken,
      qrPayUrl,
      expiresAt: expiresAt.toISOString(),
      check: {
        id: check.id,
        checkNumber: check.checkNumber,
        subtotal: toNum(check.subtotal),
        tax: toNum(check.tax),
        discount: toNum(check.discount),
        serviceCharge: toNum(check.serviceCharge),
        tip: toNum(check.tip),
        total: toNum(check.total),
        totalWithTip: toNum(check.totalWithTip),
      },
      order: {
        orderNumber: check.order.orderNumber,
        tableNumber: check.order.table?.number || null,
        items,
      },
      restaurant: {
        // Pridobi iz settings (lazy load)
      },
    }

    // Pridobi restavracija info
    // FIX P0-C3A: Pridobi iz Location (vezano na order.locationId) namesto globalnih settings
    const info = await getRestaurantInfoForLocation(check.order.locationId)
    result.restaurant = {
      name: info.name || 'RestaurantOS',
      address: `${info.address}, ${info.postCode} ${info.city}`.trim(),
      taxId: info.taxId,
    }

    logger.info('QR-PAY', `QR pay session ustvarjen za ček #${check.checkNumber} (token: ${sessionToken.slice(0, 8)}...)`)

    return NextResponse.json(result, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/qr-pay/init', 'Napaka pri ustvarjanju QR pay session')
  }
}

// GET /api/qr-pay?token=xxx — Pridobi podatke za prikaz gostu
export async function GET(req: Request) {
  try {
    // FIX R81 (javna pot): rate limit 10/min
    const clientIp = getClientIp(req)
    const rateCheck = await checkRateLimitAsync('qr-pay-session', clientIp, QR_PAY_LIMIT)
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Preveč zahtevkov. Poskusite znova čez minuto.' }, { status: 429 })
    }

    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Manjka token' }, { status: 400 })
    }

    // FIX R81 (LEAK-HIGH): token je HMAC vezava na KONKRETEN ček —
    // prej je bila vrjen PRVI neporavnan ček GLOBALNO (vsi tenanti!) ne glede
    // na token. Zdaj: poiščemo med neporavnanimi čeki tistega, čigar HMAC
    // se ujema s podanim tokenom. Tuj/izmišljen token → 404 (brez enumeracije).
    if (!/^[a-f0-9]{64}$/.test(token)) {
      return NextResponse.json({ error: 'Neveljaven token' }, { status: 400 })
    }

    const unpaidChecks = await db.check.findMany({
      where: { paymentStatus: { in: ['unpaid', 'partial'] } },
      include: {
        order: {
          include: {
            table: { select: { number: true } },
            orderItems: {
              where: { voided: false },
              include: { menuItem: { select: { name: true, image: true, allergens: true } } },
            },
          },
        },
      },
      take: 100,
      orderBy: { createdAt: 'desc' },
    })

    const check = unpaidChecks.find((c) => verifyQrPayToken(token, c.id))

    if (!check) {
      return NextResponse.json({ error: 'Ni aktivne QR pay session' }, { status: 404 })
    }
    // FIX P0-C3A: Pridobi iz Location (vezano na order.locationId) namesto globalnih settings
    const info = await getRestaurantInfoForLocation(check.order.locationId)

    const items = check.order.orderItems.map(oi => ({
      name: oi.menuItem?.name || oi.menuItemName || 'Artikel',
      quantity: oi.quantity,
      price: toNum(oi.price),
      total: round2(toNum(oi.price) * oi.quantity),
      allergens: oi.menuItem?.allergens || '',
    }))

    return NextResponse.json({
      check: {
        id: check.id,
        checkNumber: check.checkNumber,
        subtotal: toNum(check.subtotal),
        tax: toNum(check.tax),
        discount: toNum(check.discount),
        tip: toNum(check.tip),
        total: toNum(check.total),
        totalWithTip: toNum(check.totalWithTip),
      },
      order: {
        orderNumber: check.order.orderNumber,
        tableNumber: check.order.table?.number || null,
        items,
      },
      restaurant: {
        name: info.name || 'RestaurantOS',
        address: `${info.address}, ${info.postCode} ${info.city}`.trim(),
        taxId: info.taxId || '',
      },
      paymentMethods: ['cash', 'card', 'apple-pay', 'google-pay'],
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/qr-pay', 'Napaka pri pridobivanju QR pay podatkov')
  }
}
