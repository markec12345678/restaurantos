// ============================================
// PAYPAL GATEWAY — Implementacija
// ============================================
// PayPal redirect-based plačila (avtorizacija preko PayPal UI).
// ============================================

import { BasePaymentGateway, type PaymentRequest, type PaymentResult, type RefundRequest, type RefundResult, type GatewayCapabilities } from '../base'

export class PayPalGateway extends BasePaymentGateway {
  readonly type = 'paypal' as const
  readonly displayName = 'PayPal'
  readonly capabilities: GatewayCapabilities = {
    supportsCapture: true,
    supportsRefund: true,
    supportsPartialRefund: true,
    supportsWebhook: true,
    supportsRedirect: true,
    supportsTokenization: false,
    supportedCurrencies: ['EUR', 'USD', 'GBP', 'AUD', 'CAD', 'JPY'],
    maxAmount: 10000000,
    minAmount: 100,
  }

  private get clientId(): string {
    return this.config.clientId as string
  }

  private get clientSecret(): string {
    return this.config.clientSecret as string
  }

  private get environment(): 'sandbox' | 'live' {
    return (this.config.environment as 'sandbox' | 'live') || 'sandbox'
  }

  private get baseUrl(): string {
    return this.environment === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com'
  }

  private async getAccessToken(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })

    const data = await res.json() as { access_token: string }
    return data.access_token
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.clientId || !this.clientSecret) {
      return { healthy: false, message: 'PAYPAL_CLIENT_ID/SECRET ni nastavljen' }
    }
    try {
      const token = await this.getAccessToken()
      return { healthy: !!token }
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

    try {
      const accessToken = await this.getAccessToken()

      const res = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': request.idempotencyKey,
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{
            amount: {
              currency_code: request.currency,
              value: request.amount.toFixed(2),
            },
            description: request.description,
            custom_id: request.orderId,
          }],
          ...(request.returnUrl ? {
            payment_source: {
              paypal: {
                experience_context: {
                  return_url: request.returnUrl,
                  cancel_url: request.returnUrl + '?cancelled=1',
                },
              },
            },
          } : {}),
        }),
      })

      const data = await res.json() as {
        id: string
        status: string
        links: Array<{ href: string; rel: string }>
      }

      // Najdi redirect URL (approve link)
      const approveLink = data.links?.find((l) => l.rel === 'approve')

      return {
        success: res.ok,
        gatewayTransactionId: data.id,
        status: res.ok ? 'pending' : 'failed',
        amount: request.amount,
        currency: request.currency,
        redirectUrl: approveLink?.href,
        errorMessage: res.ok ? undefined : 'PayPal create failed',
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

  async capturePayment(gatewayTransactionId: string, _amount?: number): Promise<PaymentResult> {
    try {
      const accessToken = await this.getAccessToken()

      const res = await fetch(`${this.baseUrl}/v2/checkout/orders/${gatewayTransactionId}/capture`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      const data = await res.json() as { id: string; status: string }

      return {
        success: res.ok,
        gatewayTransactionId: data.id,
        status: data.status === 'COMPLETED' ? 'captured' : 'failed',
        amount: 0, // PayPal vrne v purchase_units
        currency: 'EUR',
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
      const accessToken = await this.getAccessToken()

      const res = await fetch(`${this.baseUrl}/v2/payments/captures/${request.gatewayTransactionId}/refund`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': request.idempotencyKey,
        },
        body: JSON.stringify({
          amount: {
            currency_code: 'EUR',
            value: request.amount.toFixed(2),
          },
          note_to_payer: request.reason,
        }),
      })

      const data = await res.json() as { id: string; status: string }

      return {
        success: res.ok,
        refundId: data.id,
        amount: request.amount,
        status: data.status === 'COMPLETED' ? 'succeeded' : 'pending',
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
      const accessToken = await this.getAccessToken()
      const res = await fetch(`${this.baseUrl}/v2/checkout/orders/${gatewayTransactionId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      const data = await res.json() as { id: string; status: string }

      return {
        success: res.ok,
        gatewayTransactionId: data.id,
        status: data.status === 'COMPLETED' ? 'captured' : 'pending',
        amount: 0,
        currency: 'EUR',
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
}
