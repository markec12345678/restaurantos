// ============================================
// STRIPE GATEWAY — Implementacija
// ============================================
// Production-ready Stripe integracija preko Stripe REST API.
// Podpira: authorize, capture, refund, webhook (HMAC-SHA256).
// ============================================

import { BasePaymentGateway, type PaymentRequest, type PaymentResult, type RefundRequest, type RefundResult, type GatewayCapabilities, type WebhookEvent } from '../base'

export class StripeGateway extends BasePaymentGateway {
  readonly type = 'stripe' as const
  readonly displayName = 'Stripe'
  readonly capabilities: GatewayCapabilities = {
    supportsCapture: true,
    supportsRefund: true,
    supportsPartialRefund: true,
    supportsWebhook: true,
    supportsRedirect: false,
    supportsTokenization: true,
    supportedCurrencies: ['EUR', 'USD', 'GBP', 'CHF', 'PLN', 'CZK', 'DKK', 'NOK', 'SEK'],
    maxAmount: 99999999, // €999.999,99 (v centih)
    minAmount: 50, // €0.50 (v centih)
  }

  private get apiKey(): string {
    return this.config.secretKey as string
  }

  private get webhookSecret(): string {
    return this.config.webhookSecret as string
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.apiKey) {
      return { healthy: false, message: 'STRIPE_SECRET_KEY ni nastavljen' }
    }
    try {
      // Preprosta API klic za preverjanje
      const res = await fetch('https://api.stripe.com/v1/balance', {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      })
      return { healthy: res.ok, message: res.ok ? undefined : `HTTP ${res.status}` }
    } catch (err) {
      return { healthy: false, message: err instanceof Error ? err.message : 'Neznana napaka' }
    }
  }

  async createPayment(request: PaymentRequest): Promise<PaymentResult> {
    const validationError = this.validateRequest(request)
    if (validationError) {
      return {
        success: false,
        gatewayTransactionId: '',
        status: 'failed',
        amount: request.amount,
        currency: request.currency,
        errorCode: 'VALIDATION_ERROR',
        errorMessage: validationError,
      }
    }

    // Stripe expects amount v najmanjši enoti (centi za EUR)
    const amountInCents = Math.round(request.amount * 100)

    try {
      const body = new URLSearchParams({
        amount: String(amountInCents),
        currency: request.currency.toLowerCase(),
        'metadata[idempotencyKey]': request.idempotencyKey,
        ...(request.orderId ? { 'metadata[orderId]': request.orderId } : {}),
        ...(request.checkId ? { 'metadata[checkId]': request.checkId } : {}),
        ...(request.customerEmail ? { receipt_email: request.customerEmail } : {}),
        ...(request.description ? { description: request.description } : {}),
        ...(request.paymentToken ? { payment_method: request.paymentToken } : {}),
        ...(request.returnUrl ? {
          confirm: 'true',
          return_url: request.returnUrl,
        } : {}),
      })

      const res = await fetch('https://api.stripe.com/v1/payment_intents', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Idempotency-Key': request.idempotencyKey,
        },
        body,
      })

      const data = await res.json() as {
        id: string
        status: string
        amount: number
        currency: string
        last_payment_error?: { message: string; code?: string }
        charges?: { data: Array<{ payment_method_details?: { card?: { brand?: string; last4?: string } } }> }
      }

      if (!res.ok) {
        return {
          success: false,
          gatewayTransactionId: data.id || '',
          status: 'failed',
          amount: request.amount,
          currency: request.currency,
          errorCode: data.last_payment_error?.code || `HTTP_${res.status}`,
          errorMessage: data.last_payment_error?.message || 'Stripe API error',
          rawResponse: data,
        }
      }

      // Map Stripe status → our status
      const status = this.mapStripeStatus(data.status)

      const card = data.charges?.data?.[0]?.payment_method_details?.card

      return {
        success: status !== 'failed',
        gatewayTransactionId: data.id,
        status,
        amount: data.amount / 100,
        currency: data.currency.toUpperCase(),
        cardBrand: card?.brand,
        cardLast4: card?.last4,
        rawResponse: data,
      }
    } catch (err) {
      return {
        success: false,
        gatewayTransactionId: '',
        status: 'failed',
        amount: request.amount,
        currency: request.currency,
        errorCode: 'NETWORK_ERROR',
        errorMessage: err instanceof Error ? err.message : 'Neznana napaka',
      }
    }
  }

  async capturePayment(gatewayTransactionId: string, amount?: number): Promise<PaymentResult> {
    try {
      const body = new URLSearchParams()
      if (amount) {
        body.append('amount_to_capture', String(Math.round(amount * 100)))
      }

      const res = await fetch(`https://api.stripe.com/v1/payment_intents/${gatewayTransactionId}/capture`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      })

      const data = await res.json() as { id: string; status: string; amount: number; currency: string }

      return {
        success: res.ok,
        gatewayTransactionId: data.id,
        status: this.mapStripeStatus(data.status),
        amount: data.amount / 100,
        currency: data.currency.toUpperCase(),
        errorMessage: res.ok ? undefined : 'Capture failed',
        rawResponse: data,
      }
    } catch (err) {
      return {
        success: false,
        gatewayTransactionId,
        status: 'failed',
        amount: 0,
        currency: 'EUR',
        errorMessage: err instanceof Error ? err.message : 'Neznana napaka',
      }
    }
  }

  async refundPayment(request: RefundRequest): Promise<RefundResult> {
    try {
      const body = new URLSearchParams({
        payment_intent: request.gatewayTransactionId,
        amount: String(Math.round(request.amount * 100)),
        ...(request.reason ? { reason: request.reason } : {}),
      })

      const res = await fetch('https://api.stripe.com/v1/refunds', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Idempotency-Key': request.idempotencyKey,
        },
        body,
      })

      const data = await res.json() as { id: string; amount: number; status: string; reason?: string }

      return {
        success: res.ok,
        refundId: data.id,
        amount: data.amount / 100,
        status: data.status === 'succeeded' ? 'succeeded' : data.status === 'failed' ? 'failed' : 'pending',
        errorMessage: res.ok ? undefined : 'Refund failed',
      }
    } catch (err) {
      return {
        success: false,
        refundId: '',
        amount: request.amount,
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : 'Neznana napaka',
      }
    }
  }

  async getPaymentStatus(gatewayTransactionId: string): Promise<PaymentResult> {
    try {
      const res = await fetch(`https://api.stripe.com/v1/payment_intents/${gatewayTransactionId}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      })

      const data = await res.json() as { id: string; status: string; amount: number; currency: string }

      return {
        success: res.ok,
        gatewayTransactionId: data.id,
        status: this.mapStripeStatus(data.status),
        amount: data.amount / 100,
        currency: data.currency.toUpperCase(),
      }
    } catch (err) {
      return {
        success: false,
        gatewayTransactionId,
        status: 'failed',
        amount: 0,
        currency: 'EUR',
        errorMessage: err instanceof Error ? err.message : 'Neznana napaka',
      }
    }
  }

  async parseWebhookEvent(payload: string, signature: string): Promise<WebhookEvent> {
    if (!this.verifyWebhookSignature(payload, signature)) {
      throw new Error('Invalid webhook signature')
    }

    const event = JSON.parse(payload) as {
      type: string
      data: { object: { id: string; amount?: number; currency?: string; status?: string } }
      created: number
    }

    const typeMap: Record<string, WebhookEvent['type']> = {
      'payment_intent.succeeded': 'payment.captured',
      'payment_intent.payment_failed': 'payment.failed',
      'payment_intent.canceled': 'payment.cancelled',
      'charge.refunded': 'refund.succeeded',
      'refund.failed': 'refund.failed',
    }

    return {
      type: typeMap[event.type] || 'payment.failed',
      gatewayTransactionId: event.data.object.id,
      amount: event.data.object.amount ? event.data.object.amount / 100 : undefined,
      currency: event.data.object.currency?.toUpperCase(),
      timestamp: new Date(event.created * 1000),
      rawEvent: event,
    }
  }

  private mapStripeStatus(stripeStatus: string): PaymentResult['status'] {
    const map: Record<string, PaymentResult['status']> = {
      requires_payment_method: 'pending',
      requires_confirmation: 'pending',
      requires_action: 'pending',
      processing: 'pending',
      requires_capture: 'authorized',
      succeeded: 'captured',
      canceled: 'cancelled',
    }
    return map[stripeStatus] || 'failed'
  }
}
