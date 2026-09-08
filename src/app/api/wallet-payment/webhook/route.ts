// ============================================
// POST /api/wallet-payment/webhook — Gateway webhook (Stripe/Adyen)
// ============================================
// Stripe/Adyen nas obvesti o statusu plačila preko webhook-a.
// Avtenticiramo s HMAC podpisom v headerju.
//
// FIX P2 (audit 2026-09-06):
//   1. UPORABA crypto.timingSafeEqual() namesto !== za primerjavo podpisov
//      (prejšnja implementacija je bila ranljiva na timing attack)
//   2. FAIL-CLOSED ko WALLET_WEBHOOK_SECRET manjka (prej se je samo loggalo
//      warning in nadaljevalo brez verifikacije — napadalec bi lahko poslal
//      lažen webhook in sprožil authorizeWalletPayment)
// ============================================
import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-utils'
import { authorizeWalletPayment } from '@/lib/wallet-payment'
import { logger } from '@/lib/logger'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// PAYMENT AUDIT 2026-09-09 (duplicate webhook): providerji (Stripe/Adyen)
// redeliverjajo webhoopke, ki niso vrnili 2xx. authorizeWalletPayment vrže
// napako, če WalletPayment NI več v pending stanju → prej je to pomenilo 500
// → ponovni poskusi v neskončnost (Stripe retry-a do 3 dni). Duplikat, ki se
// ujema s ŽE obdelanim stanjem, je idempotentno potrdjen z 200 — pravi
// konflikt stanj (npr. authorized po failed) pa se ZAVRNE z 409.

/**
 * Constant-time primerjava HMAC podpisov — prepreči timing attack.
 *
 * Timing attack: napadalec meri čas odgovora za vsak znak podpisa.
 * Z !== primerjavo Pride do early-exit ob prvem neujemanju — napadalec
 * lahko izlušči pravilen podpis znak-po-znak.
 *
 * timingSafeEqual vedno primerja vse bajte — čas je neodvisen od tega
 * kje se pojavi razlika.
 */
function safeCompareSignature(expected: string, provided: string): boolean {
  const expectedBuf = Buffer.from(expected, 'utf8')
  const providedBuf = Buffer.from(provided, 'utf8')
  // Če se dolžini razlikujeta, še vedno primerjaj (da čas ne razkrije dolžine)
  // ampak vrni false
  if (expectedBuf.length !== providedBuf.length) {
    // Primerjaj expectedBuf s samim sabo da porabimo enak čas
    crypto.timingSafeEqual(expectedBuf, expectedBuf)
    return false
  }
  return crypto.timingSafeEqual(expectedBuf, providedBuf)
}

export async function POST(req: Request) {
  try {
    // 1. Preberi body + signature
    const body = await req.text()
    const signature = req.headers.get('stripe-signature') || req.headers.get('x-adyen-signature') || ''
    const webhookSecret = process.env.WALLET_WEBHOOK_SECRET

    // FIX P2: FAIL-CLOSED — če secret ni nastavljen, ZAVRNI webhook.
    // Prej: log warning + continue — to pomeni da napadalec v produtkijskem
    // okolju brez WALLET_WEBHOOK_SECRET lahko pošlje poljuben webhook in
    // sproži authorizeWalletPayment z izmišljenim walletPaymentId.
    if (!webhookSecret) {
      logger.error('WalletWebhook', 'WALLET_WEBHOOK_SECRET ni nastavljen — webhook ZAVRNJEN (fail-closed)')
      return NextResponse.json(
        { error: 'Webhook secret not configured — refusing unverified webhook' },
        { status: 503 },
      )
    }

    // FIX P2: Če signature manjka, ZAVRNI (prej: nadaljevalo bi se z empty stringom)
    if (!signature) {
      logger.warn('WalletWebhook', 'Manjka signature header — webhook zavrnjen')
      return NextResponse.json(
        { error: 'Missing signature header' },
        { status: 401 },
      )
    }

    // HMAC-SHA256 verifikacija s constant-time primerjavo
    const expected = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex')
    const provided = signature.replace(/^sha256=/, '')
    if (!safeCompareSignature(expected, provided)) {
      logger.error('WalletWebhook', 'Neveljaven podpis webhook-a')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
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

      try {
        await authorizeWalletPayment(walletPaymentId, {
          transactionId: obj.id as string,
          cardBrand: ((obj.charges as { data?: Array<{ payment_method_details?: { card?: { brand?: string } } }> })?.data?.[0]?.payment_method_details?.card?.brand) || '',
          cardLast4: ((obj.charges as { data?: Array<{ payment_method_details?: { card?: { last4?: string } } }> })?.data?.[0]?.payment_method_details?.card?.last4) || '',
          status,
          errorMessage,
        })
      } catch (err) {
        // PAYMENT AUDIT (duplicate webhook): če plačilo ŽE ni v pending stanju
        // — dovoli samo idempotentni duplikat (enak končni status), sicer 409.
        const message = err instanceof Error ? err.message : String(err)
        if (message.includes('ni v pending stanju')) {
          const currentStatus = message.match(/trenutno: (\w+)/)?.[1] || 'unknown'
          if (currentStatus === status) {
            logger.info('WalletWebhook', `Duplikat webhook-a za ${walletPaymentId} (status ${status}) — idempotentno potrjeno`)
            return NextResponse.json({ received: true, duplicate: true })
          }
          logger.warn('WalletWebhook', `Webhook konflikt stanj za ${walletPaymentId}: ${currentStatus} ≠ ${status} — zavrnjeno`)
          return NextResponse.json(
            { error: `Status conflict: payment is '${currentStatus}', webhook says '${status}'` },
            { status: 409 },
          )
        }
        throw err
      }
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
