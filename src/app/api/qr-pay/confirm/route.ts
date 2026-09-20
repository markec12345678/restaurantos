// ============================================
// POST /api/qr-pay/confirm — Gost potrdi plačilo preko QR
// ============================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { toNum } from '@/lib/decimal'
import { handleApiError, parseJsonBody } from '@/lib/api-utils'
import { logger } from '@/lib/logger'
import { verifyQrPayToken } from '@/lib/qr-pay-token'
import { checkRateLimitAsync, getClientIp, QR_PAY_LIMIT } from '@/lib/rate-limit'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const confirmSchema = z.object({
  checkId: z.string().min(1),
  paymentMethod: z.enum(['cash', 'card', 'apple-pay', 'google-pay']),
  tipAmount: z.number().min(0).default(0),
  sessionToken: z.string().min(1),
})

export async function POST(req: Request) {
  try {
    // FIX R81 (javna plačilna pot): rate limit 10/min
    const clientIp = getClientIp(req)
    const rateCheck = await checkRateLimitAsync('qr-pay-confirm', clientIp, QR_PAY_LIMIT)
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Preveč zahtevkov. Poskusite znova čez minuto.' }, { status: 429 })
    }

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error } = confirmSchema.safeParse(bodyResult.data)
    if (error) {
      return NextResponse.json({ error: 'Neveljavni podatki' }, { status: 400 })
    }

    // FIX R81 (LEAK-HIGH): sessionToken je bil prej NIKOLI preverjen — kdor koli
    // z checkId je lahko potrdil plačilo tujega čeka. Zdaj: token MORA biti
    // veljaven HMAC za podani checkId (izdan samo prek avtenticiranega init POST).
    if (!verifyQrPayToken(data.sessionToken, data.checkId)) {
      return NextResponse.json({ error: 'Neveljaven QR pay session' }, { status: 403 })
    }

    // Preveri ček (avtorizacija = lastništvo veljavnega tokena za ta checkId)
    const check = await db.check.findUnique({
      where: { id: data.checkId },
      include: { order: true },
    })

    if (!check) {
      return NextResponse.json({ error: 'Ček ni najden' }, { status: 404 })
    }

    if (check.paymentStatus === 'paid') {
      return NextResponse.json({ error: 'Ček je že plačan' }, { status: 400 })
    }

    const amount = toNum(check.total) + data.tipAmount
    const idempotencyKey = `qrpay-${data.sessionToken}-${check.id}`

    // Preveri duplikat (idempotentnost)
    const existing = await db.payment.findFirst({
      where: { idempotencyKey },
    })
    if (existing) {
      return NextResponse.json({ success: true, message: 'Plačilo že obdelano', paymentId: existing.id })
    }

    // Ustvari plačilo
    const payment = await db.payment.create({
      data: {
        checkId: check.id,
        amount,
        tipAmount: data.tipAmount,
        type: data.paymentMethod === 'cash' ? 'cash' : 'card',
        cardType: data.paymentMethod === 'apple-pay' ? 'apple-pay' : data.paymentMethod === 'google-pay' ? 'google-pay' : '',
        status: 'completed',
        idempotencyKey,
        employeeId: null, // QR pay = samo-postreženo
      },
    })

    // Posodobi check in order status
    await db.check.update({
      where: { id: check.id },
      data: {
        paymentStatus: 'paid',
        paymentMethod: data.paymentMethod,
        tip: data.tipAmount,
      },
    })

    await db.order.update({
      where: { id: check.orderId },
      data: {
        paymentStatus: 'paid',
        paymentMethod: data.paymentMethod,
        paidAt: new Date(),
        tip: data.tipAmount,
      },
    })

    // Audit log
    await db.auditLog.create({
      data: {
        action: 'QR_PAY_PAYMENT',
        entityType: 'Payment',
        entityId: payment.id,
        // FIX R81 (tenant model): lokacija prek check.order.locationId (Payment nima lastnega stolpca).
        locationId: check.order.locationId ?? null,
        details: JSON.stringify({
          checkId: check.id,
          amount,
          tipAmount: data.tipAmount,
          paymentMethod: data.paymentMethod,
          source: 'qr-pay',
        }),
      },
    }).catch(() => {})

    logger.info('QR-PAY', `Plačilo ${amount}€ preko QR pay (check #${check.checkNumber}, ${data.paymentMethod})`)

    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      amount,
      tipAmount: data.tipAmount,
      message: 'Plačilo uspešno!',
    }, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/qr-pay/confirm', 'Napaka pri QR pay potrditvi')
  }
}
