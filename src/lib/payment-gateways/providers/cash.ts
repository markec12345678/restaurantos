// ============================================
// CASH GATEWAY — Gotovinska plačila
// ============================================
// Najenostavnejši gateway — ni API klicev, samo zabeleži.
// ============================================

import { BasePaymentGateway, type PaymentRequest, type PaymentResult, type RefundRequest, type RefundResult, type GatewayCapabilities } from '../base'

export class CashGateway extends BasePaymentGateway {
  readonly type = 'cash' as const
  readonly displayName = 'Gotovina'
  readonly capabilities: GatewayCapabilities = {
    supportsCapture: false, // Cash je takoj captured
    supportsRefund: true,
    supportsPartialRefund: true,
    supportsWebhook: false,
    supportsRedirect: false,
    supportsTokenization: false,
    supportedCurrencies: ['EUR', 'USD', 'GBP', 'CHF', 'HRK', 'BAM', 'RSD', 'HUF'],
    maxAmount: 100000,
    minAmount: 1,
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    // Cash vedno deluje
    return { healthy: true }
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

    // Cash je takoj captured — generiramo internal transaction ID
    return {
      success: true,
      gatewayTransactionId: `cash_${request.idempotencyKey}`,
      status: 'captured',
      amount: request.amount,
      currency: request.currency,
    }
  }

  async capturePayment(_gatewayTransactionId: string, _amount?: number): Promise<PaymentResult> {
    // Cash je vedno že captured
    return {
      success: false,
      gatewayTransactionId: _gatewayTransactionId,
      status: 'failed',
      amount: 0,
      currency: 'EUR',
      errorCode: 'ALREADY_CAPTURED',
      errorMessage: 'Gotovinska plačila so takoj captured',
    }
  }

  async refundPayment(request: RefundRequest): Promise<RefundResult> {
    // Cash refund = fizično vračilo gotovine
    return {
      success: true,
      refundId: `cash_refund_${request.idempotencyKey}`,
      amount: request.amount,
      status: 'succeeded',
    }
  }

  async getPaymentStatus(gatewayTransactionId: string): Promise<PaymentResult> {
    return {
      success: true,
      gatewayTransactionId,
      status: 'captured',
      amount: 0,
      currency: 'EUR',
    }
  }
}
