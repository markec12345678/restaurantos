// =====================================================================
// FURS Verify Invoice - Validacija in pridobivanje podatkov
// =====================================================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { toNum } from '@/lib/decimal'
import { loadCertificatePrivateKey, generateZOI, type FursInvoiceData } from '@/lib/furs'
import { buildFursConfigFromSettings } from '../build-config'
import { parseVatBreakdown } from '../../shared'
import { checkRateLimit, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { parseJsonBody, validateBody } from '@/lib/api-utils'
import { fursVerifySchema } from '@/lib/validations'

// Tip za rezultat validacije
export interface VerifyValidationResult {
  order: any // eslint-disable-line @typescript-eslint/no-explicit-any
  receipt: any // eslint-disable-line @typescript-eslint/no-explicit-any
  settings: any // eslint-disable-line @typescript-eslint/no-explicit-any
  config: any // eslint-disable-line @typescript-eslint/no-explicit-any
  authResult: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

// Validiraj zahtevo in pridobi vse potrebne podatke
export async function validateAndFetchData(req: Request): Promise<VerifyValidationResult | Response> {
  const rl = checkRateLimit('furs', getClientIp(req), AUTHENTICATED_LIMIT)
  if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  const bodyResult = await parseJsonBody(req)
  if (bodyResult.error) return bodyResult.error

  const { data, error: validationError } = validateBody(fursVerifySchema, bodyResult.data)
  if (validationError) return validationError

  const orderId = data.orderId

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { orderItems: { include: { menuItem: true } } },
  })

  if (!order) {
    return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })
  }

  // FIX HIGH: Preveri, da naročilo NI preklicano/stornirano
  if (order.status === 'cancelled') {
    return NextResponse.json({ error: 'Preklicano naročilo ne more biti davčno overjeno' }, { status: 400 })
  }

  const settings = await db.restaurantSettings.findFirst({ where: { isActive: true } })
  if (!settings) {
    return NextResponse.json({ error: 'Ni nastavitev restavracije' }, { status: 400 })
  }

  const receipt = await db.receipt.findFirst({ where: { orderId, isStorno: false } })
  if (!receipt) {
    return NextResponse.json({ error: 'Račun ni najden - najprej ustvarite račun' }, { status: 400 })
  }

  const config = await buildFursConfigFromSettings(settings)

  return { order, receipt, settings, config, authResult }
}

// Generiraj ZOI in pošlji na FURS za overitev
export async function submitToFurs(
  receipt: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  settings: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  config: any, // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<{ zoi: string; invoiceData: FursInvoiceData } | Response> {
  // Naloži privatni ključ
  const privateKey = (settings.fursCertPath && settings.fursCertPassword)
    ? loadCertificatePrivateKey(settings.fursCertPath, settings.fursCertPassword)
    : undefined

  // Generiraj ZOI
  const zoi = generateZOI({
    taxId: settings.taxId,
    invoiceNumber: receipt.receiptNumber,
    issueDateTime: receipt.createdAt,
    totalAmount: toNum(receipt.total),
    premisesId: config.premisesId,
    registerId: config.registerId,
    environment: config.environment,
  }, privateKey || undefined)

  // Pripravi podatke za FURS
  const vatBreakdown = parseVatBreakdown(receipt.vatBreakdown as string, toNum(receipt.total), 22)

  if (vatBreakdown.length === 0) {
    return NextResponse.json({
      error: 'Račun nima DDV podatkov — overitev ni mogoča. Popravite račun.',
      receiptNumber: receipt.receiptNumber,
    }, { status: 400 })
  }

  const invoiceData: FursInvoiceData = {
    invoiceNumber: receipt.receiptNumber,
    issueDateTime: receipt.createdAt,
    totalAmount: toNum(receipt.total),
    paymentMethod: (receipt.paymentMethod === 'cash' ? 'cash' :
                    receipt.paymentMethod === 'card' ? 'card' :
                    receipt.paymentMethod === 'mobile' ? 'mobile' : 'other') as FursInvoiceData['paymentMethod'],
    vatBreakdown,
  }

  return { zoi, invoiceData }
}
