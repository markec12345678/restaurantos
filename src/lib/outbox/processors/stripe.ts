// ============================================
// Stripe processor — procesiranje plačil
// ============================================

import { logger } from '@/lib/logger'

interface OutboxStripeEvent {
  id: string
  aggregateType: string
  aggregateId: string
  eventType: string
  payload: unknown
  targetEndpoint: string
}

interface StripePaymentPayload {
  orderId: string
  orderNumber: number
  amount: number // v centih
  currency: string // EUR, USD
  customerId?: string
  paymentMethodId?: string
  description?: string
  metadata?: Record<string, string>
}

export async function sendToStripe(event: OutboxStripeEvent): Promise<{ paymentIntentId: string; status: string }> {
  const payload = event.payload as StripePaymentPayload

  if (!payload.amount || payload.amount <= 0) {
    throw new Error('Neveljaven znesek za Stripe plačilo')
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    logger.warn('Outbox-Stripe', 'STRIPE_SECRET_KEY ni nastavljen — skip')
    return { paymentIntentId: 'skipped', status: 'skipped' }
  }

  logger.info('Outbox-Stripe', `Pošiljam plačilo ${payload.amount / 100} ${payload.currency} za naročilo ${payload.orderNumber}`)

  // V produkciji: kliči Stripe SDK
  // const stripe = require('stripe')(stripeKey)
  // const intent = await stripe.paymentIntents.create({ ... })

  // Za MVP: kličemo Stripe API preko fetch
  const response = await fetch('https://api.stripe.com/v1/payment_intents', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      amount: String(payload.amount),
      currency: payload.currency.toLowerCase(),
      'metadata[order_id]': payload.orderId,
      'metadata[order_number]': String(payload.orderNumber),
      ...(payload.customerId ? { customer: payload.customerId } : {}),
      ...(payload.paymentMethodId ? { payment_method: payload.paymentMethodId } : {}),
      ...(payload.description ? { description: payload.description } : {}),
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Stripe API ${response.status}: ${errorText}`)
  }

  const intent = await response.json() as { id: string; status: string }
  return { paymentIntentId: intent.id, status: intent.status }
}
