// ============================================
// PAYMENT GATEWAY — Base abstraction
// ============================================
// Vsi payment provider-ji implementirajo ta interface.
// Omogoča enostavno dodajanje novih plačilnih metod (Stripe,
// PayPal, Apple Pay, Google Pay, NFC, M-Pesa, Razorpay, itd.).
//
// Pattern po POSR vzoru (base.gateway + factory + registry).
// ============================================

// --- Tipi ---
export type GatewayType =
  | 'stripe'
  | 'paypal'
  | 'apple_pay'
  | 'google_pay'
  | 'samsung_pay'
  | 'nfc_card'
  | 'qr_pay'
  | 'mpesa'
  | 'razorpay'
  | 'jazzcash'
  | 'telebirr'
  | 'cash'

export interface PaymentRequest {
  amount: number // v EUR (ali lokalni valuti)
  currency: string // ISO 4217: EUR, USD, GBP, ...
  description?: string
  customerId?: string
  customerEmail?: string
  customerPhone?: string
  // Reference
  orderId?: string
  checkId?: string
  paymentId?: string
  // Metadata
  metadata?: Record<string, string>
  // Idempotency
  idempotencyKey: string
  // Tokenization (za wallet payments)
  paymentToken?: string
  // Return URL (za redirect-based gateways)
  returnUrl?: string
  // Webhook URL
  webhookUrl?: string
}

export interface PaymentResult {
  success: boolean
  gatewayTransactionId: string
  status: 'pending' | 'authorized' | 'captured' | 'failed' | 'cancelled' | 'refunded'
  amount: number
  currency: string
  // Card info (iz tokena)
  cardBrand?: string
  cardLast4?: string
  // Error info
  errorCode?: string
  errorMessage?: string
  // Raw response (za debug)
  rawResponse?: unknown
  // Redirect URL (za PayPal, itd.)
  redirectUrl?: string
}

export interface RefundRequest {
  gatewayTransactionId: string
  amount: number
  reason?: string
  idempotencyKey: string
}

export interface RefundResult {
  success: boolean
  refundId: string
  amount: number
  status: 'pending' | 'succeeded' | 'failed'
  errorCode?: string
  errorMessage?: string
}

export interface GatewayCapabilities {
  supportsCapture: boolean // authorize → capture flow
  supportsRefund: boolean
  supportsPartialRefund: boolean
  supportsWebhook: boolean
  supportsRedirect: boolean // PayPal-style redirect
  supportsTokenization: boolean // Apple/Google Pay
  supportedCurrencies: string[]
  maxAmount: number // v najmanjši enoti (npr. 10000 EUR)
  minAmount: number
}

// --- Base gateway interface ---
export interface PaymentGateway {
  readonly type: GatewayType
  readonly displayName: string
  readonly capabilities: GatewayCapabilities

  // Initialization
  initialize(config: Record<string, unknown>): Promise<void>

  // Health check
  healthCheck(): Promise<{ healthy: boolean; message?: string }>

  // Create payment (authorize ali capture glede na konfiguracijo)
  createPayment(request: PaymentRequest): Promise<PaymentResult>

  // Capture prejšnje avtorizirano plačilo
  capturePayment(gatewayTransactionId: string, amount?: number): Promise<PaymentResult>

  // Refund (delno ali polno)
  refundPayment(request: RefundRequest): Promise<RefundResult>

  // Preveri status transakcije (polling namesto webhook)
  getPaymentStatus(gatewayTransactionId: string): Promise<PaymentResult>

  // Verificiraj webhook signature (HMAC)
  verifyWebhookSignature(payload: string, signature: string): boolean

  // Parse webhook event
  parseWebhookEvent(payload: string, signature: string): Promise<WebhookEvent>
}

export interface WebhookEvent {
  type: 'payment.authorized' | 'payment.captured' | 'payment.failed' | 'payment.cancelled' | 'refund.created' | 'refund.succeeded' | 'refund.failed'
  gatewayTransactionId: string
  amount?: number
  currency?: string
  timestamp: Date
  rawEvent: unknown
}

// --- Base implementation (helper za provider-je) ---
export abstract class BasePaymentGateway implements PaymentGateway {
  abstract readonly type: GatewayType
  abstract readonly displayName: string
  abstract readonly capabilities: GatewayCapabilities

  protected config: Record<string, unknown> = {}

  async initialize(config: Record<string, unknown>): Promise<void> {
    this.config = config
    await this.onInitialize()
  }

  // Subclass override
  protected async onInitialize(): Promise<void> {
    // Default: nič
  }

  abstract healthCheck(): Promise<{ healthy: boolean; message?: string }>
  abstract createPayment(request: PaymentRequest): Promise<PaymentResult>
  abstract capturePayment(gatewayTransactionId: string, amount?: number): Promise<PaymentResult>
  abstract refundPayment(request: RefundRequest): Promise<RefundResult>
  abstract getPaymentStatus(gatewayTransactionId: string): Promise<PaymentResult>

  // Default: preprosta HMAC-SHA256 verification
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const secret = this.config.webhookSecret as string | undefined
    if (!secret) return false
    const crypto = require('crypto')
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')
    return expected === signature.replace(/^sha256=/, '')
  }

  // Default: throw (subclass override če podpira webhook)
  async parseWebhookEvent(_payload: string, _signature: string): Promise<WebhookEvent> {
    throw new Error(`${this.displayName} ne podpira webhook parsing`)
  }

  // Helper: validiraj request
  protected validateRequest(request: PaymentRequest): string | null {
    if (request.amount <= 0) return 'Znesek mora biti pozitiven'
    if (request.amount > this.capabilities.maxAmount) {
      return `Znesek presega max (${this.capabilities.maxAmount})`
    }
    if (request.amount < this.capabilities.minAmount) {
      return `Znesek pod min (${this.capabilities.minAmount})`
    }
    if (!this.capabilities.supportedCurrencies.includes(request.currency)) {
      return `Valuta ${request.currency} ni podprta`
    }
    if (!request.idempotencyKey) return 'IdempotencyKey je obvezen'
    return null
  }
}
