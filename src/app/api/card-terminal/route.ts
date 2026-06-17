import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { cardTerminalPaymentSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
import { getTerminalConfig, checkTerminalStatus, processTerminalPayment } from './_helpers'
import type { PaymentRequest } from './_helpers'


// ============================================
// CARD TERMINAL INTEGRATION API
// Podpora za: Nexgo, PAX, Verifone, Ingenico, SumUp, Square Reader
// Protocol: TCP/IP ali HTTP API (odvisno od terminala)
// ============================================

// GET /api/card-terminal — Status terminala
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const settings = await db.restaurantSettings.findFirst({ where: { isActive: true } })
    const terminalConfig = getTerminalConfig(settings)
    const status = await checkTerminalStatus(terminalConfig)

    return NextResponse.json({
      connected: status.connected,
      provider: terminalConfig.provider,
      ipAddress: terminalConfig.ipAddress,
      port: terminalConfig.port,
      terminalId: terminalConfig.terminalId,
      responseTime: status.responseTime,
      lastCheck: new Date().toISOString(),
      error: status.error,
    })
  } catch (error: unknown) {
    logger.error('API', '[CardTerminal] Status error:', error)
    return NextResponse.json({ connected: false, error: 'Napaka pri preverjanju terminala' }, { status: 500 })
  }
}

// POST /api/card-terminal — Izvedi transakcijo na terminalu
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX HIGH: Zod validacija — prepreči injection nepričakovanih vrednosti
    const { data, error: validationError } = validateBody(cardTerminalPaymentSchema, bodyResult.data)
    if (validationError) return validationError

    // FIX BUG7: Verify order exists and check payment status before processing card payment
    const order = await db.order.findUnique({ where: { id: data.orderId } })
    if (!order) {
      return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })
    }
    if (order.paymentStatus === 'paid') {
      return NextResponse.json({ error: 'Naročilo je že plačano' }, { status: 400 })
    }
    if (order.status === 'cancelled') {
      return NextResponse.json({ error: 'Naročilo je preklicano — plačilo ni mogoče' }, { status: 400 })
    }

    const settings = await db.restaurantSettings.findFirst({ where: { isActive: true } })
    const terminalConfig = getTerminalConfig(settings)

    // FIX HIGH: Preveri, da test provider ni na voljo v produkciji
    if (terminalConfig.provider === 'test' && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Testni terminal ni na voljo v produkciji' }, { status: 403 })
    }

    const paymentRequest: PaymentRequest = {
      amount: data.amount,
      currency: data.currency,
      orderId: data.orderId,
      orderNumber: data.orderNumber || 0,
      tipAmount: data.tipAmount,
      paymentType: data.paymentType,
      referenceId: data.referenceId,
    }

    const result = await processTerminalPayment(terminalConfig, paymentRequest)

    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: result.success ? 'CARD_PAYMENT_SUCCESS' : 'CARD_PAYMENT_FAILED',
      entityType: 'Order',
      entityId: data.orderId,
      details: {
        amount: data.amount,
        currency: paymentRequest.currency,
        provider: terminalConfig.provider,
        transactionId: result.transactionId,
        authorizationCode: result.authorizationCode,
        cardType: result.cardType,
        cardLast4: result.cardLast4,
        paymentType: paymentRequest.paymentType,
        success: result.success,
        error: result.error,
      },
    })

    return NextResponse.json(result)
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/card-terminal', 'Napaka pri plačilu na terminalu')
  }
}
