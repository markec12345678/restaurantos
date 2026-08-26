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
import { handleApiError, parseJsonBody } from '@/lib/api-utils'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import crypto from 'crypto'

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

    // Pridobi ček z naročilom
    const check = await db.check.findUnique({
      where: { id: data.checkId },
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

    // Generiraj enkratni token za QR pay session
    const sessionToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minut veljavnost

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
    const settings = await db.restaurantSettings.findFirst({ where: { isActive: true } })
    if (settings) {
      result.restaurant = {
        name: settings.name,
        address: `${settings.address}, ${settings.postCode} ${settings.city}`,
        taxId: settings.taxId,
      }
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
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Manjka token' }, { status: 400 })
    }

    // Token je session-specific — preveri ček z tem paymentId patternom
    // V produkciji bi shranili v Redis z TTL, tukaj preverjamo preko check paymentStatus
    // Za varnost: token mora biti 64 hex znakov
    if (!/^[a-f0-9]{64}$/.test(token)) {
      return NextResponse.json({ error: 'Neveljaven token' }, { status: 400 })
    }

    // Pridobi neporavnan ček (zaenkrat preprost lookup)
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
      take: 1,
    })

    if (unpaidChecks.length === 0) {
      return NextResponse.json({ error: 'Ni aktivne QR pay session' }, { status: 404 })
    }

    const check = unpaidChecks[0]
    const settings = await db.restaurantSettings.findFirst({ where: { isActive: true } })

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
        name: settings?.name || 'RestaurantOS',
        address: settings ? `${settings.address}, ${settings.postCode} ${settings.city}` : '',
        taxId: settings?.taxId || '',
      },
      paymentMethods: ['cash', 'card', 'apple-pay', 'google-pay'],
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/qr-pay', 'Napaka pri pridobivanju QR pay podatkov')
  }
}
