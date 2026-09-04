// ============================================
// POST /api/wallet-payment/webhook — Gateway webhook (Stripe/Adyen)
// ============================================
// Stripe/Adyen nas obvesti o statusu plačila preko webhook-a.
// Avtenticiramo s HMAC podpisom v headerju.
// ============================================
import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-utils'
import { authorizeWalletPayment } from '@/lib/wallet-payment'
import { logger } from '@/lib/logger'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    // 1. Preberi body + signature
    const body = await req.text()
    const signature = req.headers.get('stripe-signature') || req.headers.get('x-adyen-signature') || ''
    const webhookSecret = process.env.WALLET_WEBHOOK_SECRET

    if (!webhookSecret) {
      logger.warn('WalletWebhook', 'WALLET_WEBHOOK_SECRET ni nastavljen — skip verification')
    } else if (signature) {
      // HMAC-SHA256 verifikacija
      const expected = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex')
      const provided = signature.replace(/^sha256=/, '')
      if (expected !== provided) {
        logger.error('WalletWebhook', 'Neveljaven podpis webhook-a')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    // 2. Parse JSON
    let payload: unknown
    try {
      payload = JSON.parse(body)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    // 3. Obdelaj glede na tip eventa
    const event = payload as {
      type?: string
      data?: { object?: Record<string, unknown> }
      [k: string]: unknown
    }

    if (!event.type || !event.data?.object) {
      return NextResponse.json({ error: 'Missing type or data' }, { status: 400 })
    }

    const obj = event.data.object as Record<string, unknown>

    // Stripe events
    if (event.type === 'payment_intent.succeeded' || event.type === 'payment_intent.payment_failed') {
      const walletPaymentId = (obj.metadata as Record<string, unknown>)?.walletPaymentId as string | undefined
      if (!walletPaymentId) {
        logger.warn('WalletWebhook', 'Manjka walletPaymentId v metadata')
        return NextResponse.json({ received: true })
      }

      const status = event.type === 'payment_intent.succeeded' ? 'authorized' : 'failed'
      const errorMessage = status === 'failed'
        ? ((obj.last_payment_error as { message?: string })?.message || 'Payment failed')
        : undefined

      await authorizeWalletPayment(walletPaymentId, {
        transactionId: obj.id as string,
        cardBrand: ((obj.charges as { data?: Array<{ payment_method_details?: { card?: { brand?: string } } }> })?.data?.[0]?.payment_method_details?.card?.brand) || '',
        cardLast4: ((obj.charges as { data?: Array<{ payment_method_details?: { card?: { last4?: string } } }> })?.data?.[0]?.payment_method_details?.card?.last4) || '',
        status,
        errorMessage,
      })
    }
    // Adyen events (drugačen format)
    else if (event.type === 'AUTHORISATION') {
      const walletPaymentId = (obj.additionalData as Record<string, unknown>)?.walletPaymentId as string | undefined
      if (walletPaymentId) {
        await authorizeWalletPayment(walletPaymentId, {
          transactionId: (obj.pspReference as string) || '',
          status: obj.success === 'true' || obj.success === true ? 'authorized' : 'failed',
          errorMessage: obj.reason ? String(obj.reason) : undefined,
        })
      }
    } else {
      logger.info('WalletWebhook', `Neobdelan event tip: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    return handleApiError(err, 'wallet-payment webhook')
  }
}
