// ============================================
// /api/payment-gateways — Upravljanje plačilnih gateway-ov
// ============================================
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import {
  getRegisteredGateways,
  GatewayFactory,
  checkAllGatewaysHealth,
  type GatewayType,
} from '@/lib/payment-gateways'

export const dynamic = 'force-dynamic'

// GET — seznam registriranih gateway-ov + health status
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const includeHealth = searchParams.get('health') === '1'

    const registered = getRegisteredGateways()

    if (!includeHealth) {
      return NextResponse.json({
        gateways: registered,
        count: registered.length,
      })
    }

    // Preberi konfiguracije iz env (varno — ne izpostavi secretov)
    const configs: Record<string, Record<string, unknown>> = {}
    if (process.env.STRIPE_SECRET_KEY) {
      configs.stripe = {
        secretKey: process.env.STRIPE_SECRET_KEY,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
      }
    }
    if (process.env.PAYPAL_CLIENT_ID) {
      configs.paypal = {
        clientId: process.env.PAYPAL_CLIENT_ID,
        clientSecret: process.env.PAYPAL_CLIENT_SECRET,
        environment: process.env.PAYPAL_ENV || 'sandbox',
      }
    }
    // Cash vedno omogočen
    configs.cash = {}

    // Health check samo za konfigurirane gateway-e
    const configuredTypes = Object.keys(configs) as GatewayType[]
    const healthResults = await checkAllGatewaysHealth(
      configs as Record<GatewayType, Record<string, unknown>>,
    )

    return NextResponse.json({
      gateways: registered.map((type) => ({
        type,
        configured: configs[type] !== undefined,
        health: healthResults.find((h) => h.type === type) || { type, healthy: false, message: 'Ni konfiguriran' },
      })),
      count: registered.length,
      configuredCount: configuredTypes.length,
    })
  } catch (err) {
    return handleApiError(err, 'payment-gateways GET')
  }
}

// POST — ročno testiraj gateway (admin)
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const body = await req.json().catch(() => ({}))
    const { action, gatewayType, config } = body as {
      action: 'health' | 'test_payment'
      gatewayType: GatewayType
      config?: Record<string, unknown>
    }

    if (!action || !gatewayType) {
      return NextResponse.json({ error: 'action in gatewayType sta obvezna' }, { status: 400 })
    }

    // Za testiranje uporabimo podano konfiguracijo ali env
    const effectiveConfig = config || getEnvConfig(gatewayType)

    if (action === 'health') {
      const gateway = await GatewayFactory.createAsync(gatewayType, effectiveConfig)
      const health = await gateway.healthCheck()
      return NextResponse.json({ gatewayType, ...health })
    }

    if (action === 'test_payment') {
      const gateway = await GatewayFactory.createAsync(gatewayType, effectiveConfig)
      const result = await gateway.createPayment({
        amount: 1.00, // €1 test
        currency: 'EUR',
        description: 'Gateway test payment',
        idempotencyKey: `test_${Date.now()}`,
        metadata: { test: 'true' },
      })
      return NextResponse.json({ gatewayType, result })
    }

    return NextResponse.json({ error: 'Neznana akcija' }, { status: 400 })
  } catch (err) {
    return handleApiError(err, 'payment-gateways POST')
  }
}

// Helper: preberi konfiguracijo iz env
function getEnvConfig(type: GatewayType): Record<string, unknown> {
  switch (type) {
    case 'stripe':
      return {
        secretKey: process.env.STRIPE_SECRET_KEY,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
      }
    case 'paypal':
      return {
        clientId: process.env.PAYPAL_CLIENT_ID,
        clientSecret: process.env.PAYPAL_CLIENT_SECRET,
        environment: process.env.PAYPAL_ENV || 'sandbox',
      }
    case 'cash':
      return {}
    default:
      return {}
  }
}
