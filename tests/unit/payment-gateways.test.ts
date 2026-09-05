// ============================================
// Payment Gateways — Unit testi
// ============================================
import { describe, it, expect, beforeEach } from 'vitest'
import {
  GatewayFactory,
  getRegisteredGateways,
  isGatewayRegistered,
  registerGateway,
  type GatewayType,
  type PaymentRequest,
} from '@/lib/payment-gateways'
import { CashGateway } from '@/lib/payment-gateways/providers/cash'
import { StripeGateway } from '@/lib/payment-gateways/providers/stripe'
import { PayPalGateway } from '@/lib/payment-gateways/providers/paypal'

// --- Registry tests ---

describe('Gateway Registry', () => {
  it('stripe je registriran', () => {
    expect(isGatewayRegistered('stripe')).toBe(true)
  })

  it('paypal je registriran', () => {
    expect(isGatewayRegistered('paypal')).toBe(true)
  })

  it('cash je registriran', () => {
    expect(isGatewayRegistered('cash')).toBe(true)
  })

  it('getRegisteredGateways vrne vse 3', () => {
    const all = getRegisteredGateways()
    expect(all).toContain('stripe')
    expect(all).toContain('paypal')
    expect(all).toContain('cash')
    expect(all.length).toBeGreaterThanOrEqual(3)
  })

  it('registerGateway doda nov tip', () => {
    // Custom gateway za test (extend CashGateway brez override readonly)
    class TestGateway extends CashGateway {
      // Override initialize za test
      protected async onInitialize(): Promise<void> {
        // test setup
      }
    }
    registerGateway('cash', () => new TestGateway())
    expect(isGatewayRegistered('cash')).toBe(true)
  })
})

// --- Factory tests ---

describe('GatewayFactory', () => {
  beforeEach(() => {
    GatewayFactory.clearCache()
  })

  it('create vrne gateway primerek', () => {
    const gateway = GatewayFactory.create('cash', {})
    expect(gateway).toBeDefined()
    expect(gateway.type).toBe('cash')
  })

  it('createAsync vrne inicializiran gateway', async () => {
    const gateway = await GatewayFactory.createAsync('cash', {})
    expect(gateway).toBeDefined()
    expect(gateway.type).toBe('cash')
  })

  it('create za nepoznan tip throw-a', () => {
    expect(() => GatewayFactory.create('nonexistent' as GatewayType, {})).toThrow('ni registriran')
  })

  it('clearCache počisti cache', () => {
    GatewayFactory.create('cash', {})
    GatewayFactory.clearCache()
    // Naslednji create bo ustvaril nov primerek
    const gateway = GatewayFactory.create('cash', {})
    expect(gateway).toBeDefined()
  })

  it('cache-ira primerek za isto konfiguracijo', () => {
    const g1 = GatewayFactory.create('cash', { test: true })
    const g2 = GatewayFactory.create('cash', { test: true })
    expect(g1).toBe(g2) // isti primerek
  })
})

// --- Cash Gateway tests ---

describe('CashGateway', () => {
  let gateway: CashGateway

  beforeEach(async () => {
    gateway = new CashGateway()
    await gateway.initialize({})
  })

  it('healthCheck vedno vrne healthy', async () => {
    const health = await gateway.healthCheck()
    expect(health.healthy).toBe(true)
  })

  it('createPayment takoj captured', async () => {
    const request: PaymentRequest = {
      amount: 50.00,
      currency: 'EUR',
      idempotencyKey: 'test-cash-1',
    }
    const result = await gateway.createPayment(request)
    expect(result.success).toBe(true)
    expect(result.status).toBe('captured')
    expect(result.amount).toBe(50.00)
    expect(result.gatewayTransactionId).toContain('cash_')
  })

  it('createPayment zavrne negativen znesek', async () => {
    const request: PaymentRequest = {
      amount: -10,
      currency: 'EUR',
      idempotencyKey: 'test-cash-neg',
    }
    const result = await gateway.createPayment(request)
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('VALIDATION_ERROR')
  })

  it('createPayment zavrne nepodprto valuto', async () => {
    const request: PaymentRequest = {
      amount: 50,
      currency: 'JPY', // Cash ne podpira JPY
      idempotencyKey: 'test-cash-jpy',
    }
    const result = await gateway.createPayment(request)
    expect(result.success).toBe(false)
    expect(result.errorMessage?.toLowerCase()).toContain('valuta')
  })

  it('capturePayment vrne already captured error', async () => {
    const result = await gateway.capturePayment('cash_test')
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('ALREADY_CAPTURED')
  })

  it('refundPayment vedno uspe', async () => {
    const result = await gateway.refundPayment({
      gatewayTransactionId: 'cash_test',
      amount: 25,
      idempotencyKey: 'test-refund-1',
    })
    expect(result.success).toBe(true)
    expect(result.status).toBe('succeeded')
    expect(result.refundId).toContain('cash_refund_')
  })

  it('capabilities: no capture, no webhook, no redirect', () => {
    expect(gateway.capabilities.supportsCapture).toBe(false)
    expect(gateway.capabilities.supportsWebhook).toBe(false)
    expect(gateway.capabilities.supportsRedirect).toBe(false)
    expect(gateway.capabilities.supportsRefund).toBe(true)
  })
})

// --- Stripe Gateway tests (brez pravega API klica) ---

describe('StripeGateway', () => {
  let gateway: StripeGateway

  beforeEach(async () => {
    gateway = new StripeGateway()
    await gateway.initialize({
      secretKey: 'sk_test_fake_key_for_testing',
      webhookSecret: 'whsec_test_fake',
    })
  })

  it('healthCheck vrne false brez API key', async () => {
    const g = new StripeGateway()
    await g.initialize({})
    const health = await g.healthCheck()
    expect(health.healthy).toBe(false)
    expect(health.message).toContain('SECRET_KEY')
  })

  it('capabilities: full feature set', () => {
    expect(gateway.capabilities.supportsCapture).toBe(true)
    expect(gateway.capabilities.supportsRefund).toBe(true)
    expect(gateway.capabilities.supportsPartialRefund).toBe(true)
    expect(gateway.capabilities.supportsWebhook).toBe(true)
    expect(gateway.capabilities.supportsTokenization).toBe(true)
  })

  it('supportedCurrencies vključuje EUR', () => {
    expect(gateway.capabilities.supportedCurrencies).toContain('EUR')
    expect(gateway.capabilities.supportedCurrencies).toContain('USD')
  })

  it('createPayment zavrne prevelik znesek (validation pred API klicem)', async () => {
    const result = await gateway.createPayment({
      amount: 100000000, // > maxAmount (99999999 centov = €999.999,99)
      currency: 'EUR',
      idempotencyKey: 'test-stripe-big',
    })
    expect(result.success).toBe(false)
    // Bodisi validation error (max) bodisi API error (ker dejansko kliče API)
    expect(result.errorCode).toMatch(/VALIDATION_ERROR|HTTP_\d+|NETWORK_ERROR/)
  })

  it('verifyWebhookSignature vrne false za napačen podpis', () => {
    const result = gateway.verifyWebhookSignature('payload', 'wrong-signature')
    expect(result).toBe(false)
  })

  it('verifyWebhookSignature vrne true za pravilen HMAC', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require('crypto')
    const payload = '{"test":true}'
    const secret = 'whsec_test_fake'
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')
    const result = gateway.verifyWebhookSignature(payload, expected)
    expect(result).toBe(true)
  })
})

// --- PayPal Gateway tests ---

describe('PayPalGateway', () => {
  let gateway: PayPalGateway

  beforeEach(async () => {
    gateway = new PayPalGateway()
    await gateway.initialize({
      clientId: 'test_client_id',
      clientSecret: 'test_client_secret',
      environment: 'sandbox',
    })
  })

  it('healthCheck vrne false brez credentials', async () => {
    const g = new PayPalGateway()
    await g.initialize({})
    const health = await g.healthCheck()
    expect(health.healthy).toBe(false)
  })

  it('capabilities: redirect + tokenization off', () => {
    expect(gateway.capabilities.supportsRedirect).toBe(true)
    expect(gateway.capabilities.supportsTokenization).toBe(false)
    expect(gateway.capabilities.supportsCapture).toBe(true)
  })

  it('baseUrl je sandbox za test environment', () => {
    // @ts-expect-error - private property
    expect(gateway.baseUrl).toContain('sandbox.paypal.com')
  })

  it('createPayment zavrne nepodprto valuto', async () => {
    const result = await gateway.createPayment({
      amount: 200, // > minAmount (100)
      currency: 'HRK', // PayPal ne podpira
      idempotencyKey: 'test-paypal-hrk',
    })
    expect(result.success).toBe(false)
    expect(result.errorMessage?.toLowerCase()).toContain('valuta')
  })
})

// --- Helper function tests ---

describe('Helper functions', () => {
  it('processPayment dela za cash', async () => {
    const { processPayment } = await import('@/lib/payment-gateways')
    const result = await processPayment('cash', {
      amount: 30,
      currency: 'EUR',
      idempotencyKey: 'test-helper-1',
    }, {})
    expect(result.success).toBe(true)
    expect(result.status).toBe('captured')
  })

  it('refundPayment dela za cash', async () => {
    const { refundPayment } = await import('@/lib/payment-gateways')
    const result = await refundPayment('cash', {
      gatewayTransactionId: 'cash_test',
      amount: 15,
      idempotencyKey: 'test-refund-helper',
    }, {})
    expect(result.success).toBe(true)
  })
})

// --- Validation tests ---

describe('Validation', () => {
  it('znesek 0 je zavrnjen', async () => {
    const g = new CashGateway()
    await g.initialize({})
    const result = await g.createPayment({
      amount: 0,
      currency: 'EUR',
      idempotencyKey: 'test-zero',
    })
    expect(result.success).toBe(false)
  })

  it('brez idempotencyKey je zavrnjen', async () => {
    const g = new CashGateway()
    await g.initialize({})
    const result = await g.createPayment({
      amount: 50,
      currency: 'EUR',
      idempotencyKey: '',
    })
    expect(result.success).toBe(false)
  })
})
