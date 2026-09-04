// ============================================
// PAYMENT GATEWAY — Factory & Registry
// ============================================
// Factory pattern: ustvari primerek gateway-a glede na tip.
// Registry: centralni seznam vseh registriranih gateway-ov.
//
// Uporaba:
//   const gateway = gatewayFactory.create('stripe', { secretKey: '...' })
//   const result = await gateway.createPayment({ ... })
//
// Ali preko helper-ja:
//   const result = await processPayment('stripe', request, config)
// ============================================

import { type PaymentGateway, type GatewayType, type PaymentRequest, type PaymentResult, type RefundRequest, type RefundResult } from './base'
import { StripeGateway } from './providers/stripe'
import { PayPalGateway } from './providers/paypal'
import { CashGateway } from './providers/cash'

// --- Registry (vsi podprti gateway-i) ---
const registry = new Map<GatewayType, () => PaymentGateway>()

export function registerGateway(type: GatewayType, factory: () => PaymentGateway): void {
  registry.set(type, factory)
}

export function getRegisteredGateways(): GatewayType[] {
  return Array.from(registry.keys())
}

export function isGatewayRegistered(type: GatewayType): boolean {
  return registry.has(type)
}

// --- Factory ---
export class GatewayFactory {
  private static instances = new Map<string, PaymentGateway>()

  /**
   * Ustvari ali pridobi obstoječi gateway primerek (singleton per config)
   */
  static create(type: GatewayType, config: Record<string, unknown>): PaymentGateway {
    // Cache key vključuje config hash (da lahko istočasno delamo z več konfiguracijami)
    const configKey = JSON.stringify(config)
    const cacheKey = `${type}:${configKey}`

    const cached = this.instances.get(cacheKey)
    if (cached) return cached

    const factory = registry.get(type)
    if (!factory) {
      throw new Error(`Gateway ${type} ni registriran. Uporabite registerGateway() najprej.`)
    }

    const gateway = factory()
    // Initialize je async ampak factory je sync — caller mora poklicati initialize()
    // Če je potrebno, lahko uporabimo createAsync
    void gateway.initialize(config)
    this.instances.set(cacheKey, gateway)
    return gateway
  }

  /**
   * Async verzija (počaka na initialize)
   */
  static async createAsync(type: GatewayType, config: Record<string, unknown>): Promise<PaymentGateway> {
    const gateway = this.create(type, config)
    await gateway.initialize(config)
    return gateway
  }

  /**
   * Počisti cache (uporabno za testiranje)
   */
  static clearCache(): void {
    this.instances.clear()
  }
}

// --- Helper funkcije (enostavnejša uporaba) ---

export async function processPayment(
  type: GatewayType,
  request: PaymentRequest,
  config: Record<string, unknown>,
): Promise<PaymentResult> {
  const gateway = await GatewayFactory.createAsync(type, config)
  return gateway.createPayment(request)
}

export async function refundPayment(
  type: GatewayType,
  request: RefundRequest,
  config: Record<string, unknown>,
): Promise<RefundResult> {
  const gateway = await GatewayFactory.createAsync(type, config)
  return gateway.refundPayment(request)
}

export async function capturePayment(
  type: GatewayType,
  gatewayTransactionId: string,
  config: Record<string, unknown>,
  amount?: number,
): Promise<PaymentResult> {
  const gateway = await GatewayFactory.createAsync(type, config)
  return gateway.capturePayment(gatewayTransactionId, amount)
}

// --- Auto-registration default gateway-ov ---
// (lahko override-a uporabnik z registerGateway)

registerGateway('stripe', () => new StripeGateway())
registerGateway('paypal', () => new PayPalGateway())
registerGateway('cash', () => new CashGateway())

// --- Health check za vse gateway-e ---
export async function checkAllGatewaysHealth(
  configs: Record<GatewayType, Record<string, unknown>>,
): Promise<Array<{ type: GatewayType; healthy: boolean; message?: string }>> {
  const results: Array<{ type: GatewayType; healthy: boolean; message?: string }> = []
  for (const [type, config] of Object.entries(configs)) {
    try {
      const gateway = await GatewayFactory.createAsync(type as GatewayType, config)
      const health = await gateway.healthCheck()
      results.push({ type: type as GatewayType, ...health })
    } catch (err) {
      results.push({
        type: type as GatewayType,
        healthy: false,
        message: err instanceof Error ? err.message : 'Neznana napaka',
      })
    }
  }
  return results
}
