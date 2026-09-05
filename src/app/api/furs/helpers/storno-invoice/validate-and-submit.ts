// =====================================================================
// FURS Storno Invoice - Validacija in priprava podatkov
// =====================================================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { toNum } from '@/lib/decimal'
import { getNextReceiptNumber } from '@/lib/counters'
import { loadCertificatePrivateKey, generateZOI, verifyInvoiceWithFURS, type FursInvoiceData } from '@/lib/furs'
import { buildFursConfigFromSettings } from '../build-config'
import { parseVatBreakdown } from '../../shared'
import { logger } from '@/lib/logger'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { parseJsonBody, validateBody } from '@/lib/api-utils'
import { fursStornoSchema } from '@/lib/validations'

// Tip za rezultat validacije
export interface StornoValidationResult {
  receipt: any // eslint-disable-line @typescript-eslint/no-explicit-any
  settings: any // eslint-disable-line @typescript-eslint/no-explicit-any
  config: any // eslint-disable-line @typescript-eslint/no-explicit-any
  stornoNumber: string
  zoi: string
  fursResult: { success: boolean; zoi?: string; eor?: string; verifiedAt?: Date; isSimulation: boolean; environment?: string; error?: string }
  authResult: any // eslint-disable-line @typescript-eslint/no-explicit-any
  reason: string
  reasonCode: string
  vatBreakdownForStorno: Record<string, { base: number; vat: number }>
}

// Validiraj zahtevo in pridobi podatke, pošlji na FURS
export async function validateAndSubmitStorno(req: Request): Promise<StornoValidationResult | Response> {
  const rl = await checkRateLimitAsync('furs', getClientIp(req), AUTHENTICATED_LIMIT)
  if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  const bodyResult = await parseJsonBody(req)
  if (bodyResult.error) return bodyResult.error

  const { data, error: validationError } = validateBody(fursStornoSchema, bodyResult.data)
  if (validationError) return validationError

  const { orderId, reason, reasonCode } = data

  // FIX HIGH: Poišči ORIGINALNI račun (ne storno)
  const receipt = await db.receipt.findFirst({ where: { orderId, isStorno: false } })
  if (!receipt) {
    return NextResponse.json({ error: 'Račun ni najden' }, { status: 404 })
  }

  if (receipt.isStorno) {
    return NextResponse.json({ error: 'Račun je že storniran' }, { status: 400 })
  }

  // FIX BUG: Preveri, da naročilo NI že preklicano
  const existingOrder = await db.order.findUnique({ where: { id: orderId } })
  if (existingOrder?.status === 'cancelled') {
    return NextResponse.json({ error: 'Naročilo je že preklicano — storno ni mogoč' }, { status: 400 })
  }
  if (existingOrder?.paymentStatus === 'storno') {
    return NextResponse.json({ error: 'Naročilo je že stornirano — storno ni mogoč' }, { status: 400 })
  }

  // FIX MEDIUM: Preveri, da je originalni račun davčno overjen
  if (!receipt.fiscalVerified) {
    // FIX P0-C3A: preveri fursEnvironment za PRAVO lokacijo (ne globalno)
    const orderForEnv = existingOrder || await db.order.findUnique({ where: { id: orderId } })
    const locationForEnv = orderForEnv?.locationId
      ? await db.location.findUnique({ where: { id: orderForEnv.locationId }, select: { fursEnvironment: true } })
      : null
    const env = locationForEnv?.fursEnvironment || 'test'
    if (env === 'production') {
      return NextResponse.json({
        error: 'Račun ni davčno overjen — storno ni mogoč v produkciji. Najprej overite račun pri FURS.',
        receiptNumber: receipt.receiptNumber,
      }, { status: 400 })
    }
    logger.warn('API', `[FURS] Storno ne-overjenega računa ${receipt.receiptNumber} v testnem okolju`)
  }

  const settings = await db.restaurantSettings.findFirst({ where: { isActive: true } })
  if (!settings) {
    return NextResponse.json({ error: 'Ni nastavitev restavracije — storno ni mogoč' }, { status: 400 })
  }
  // FIX P0-C3A: Pridobi FURS config vezan na order.locationId (ne globalno!)
  // Prej: buildFursConfigFromSettings(settings) je uporabil findFirst({isActive:true})
  const orderForConfig = existingOrder || await db.order.findUnique({ where: { id: orderId } })
  const config = await buildFursConfigFromSettings(settings, orderForConfig?.locationId)
  if (!config.businessId || !config.taxId) {
    return NextResponse.json({ error: 'Manjkajo poslovni podatki (matična št., DDV ID) za to lokacijo — storno ni mogoč' }, { status: 400 })
  }

  // Atomna številka storno računa
  const stornoNumber = await getNextReceiptNumber()

  // Naloži privatni ključ
  const privateKey = (settings.fursCertPath && settings.fursCertPassword)
    ? loadCertificatePrivateKey(settings.fursCertPath, settings.fursCertPassword)
    : undefined

  // Generiraj ZOI za storno račun
  const zoi = generateZOI({
    taxId: config.taxId,
    invoiceNumber: stornoNumber,
    issueDateTime: new Date(),
    totalAmount: toNum(receipt.total),
    premisesId: config.premisesId,
    registerId: config.registerId,
    environment: config.environment,
  }, privateKey || undefined)

  // FURS overitev storno računa
  const vatBreakdown = parseVatBreakdown(receipt.vatBreakdown as string, toNum(receipt.total), 22)

  if (vatBreakdown.length === 0) {
    return NextResponse.json({
      error: 'Račun nima DDV podatkov — storno ni mogoč. Popravite originalni račun.',
      receiptNumber: receipt.receiptNumber,
    }, { status: 400 })
  }

  // Pripravi negiran vatBreakdown za shranjevanje
  const vatBreakdownForStorno: Record<string, { base: number; vat: number }> = {}
  for (const vb of vatBreakdown) {
    vatBreakdownForStorno[String(vb.rate)] = { base: vb.baseAmount, vat: vb.vatAmount }
  }

  // FURS storno račun s POZITIVNIMI zneski
  const stornoInvoiceData: FursInvoiceData = {
    invoiceNumber: stornoNumber,
    issueDateTime: new Date(),
    totalAmount: toNum(receipt.total),
    paymentMethod: (receipt.paymentMethod === 'cash' ? 'cash' :
                    receipt.paymentMethod === 'card' ? 'card' : 'other') as FursInvoiceData['paymentMethod'],
    vatBreakdown: vatBreakdown.map(vb => ({
      rate: vb.rate,
      baseAmount: vb.baseAmount,
      vatAmount: vb.vatAmount,
    })),
    isStorno: true,
    referenceInvoice: {
      invoiceNumber: receipt.receiptNumber,
      zoi: receipt.zoi,
      issueDateTime: receipt.createdAt,
    },
  }

  const fursResult = await verifyInvoiceWithFURS(config, stornoInvoiceData, zoi)

  return {
    receipt, settings, config, stornoNumber, zoi, fursResult,
    authResult, reason: reason || '', reasonCode: reasonCode || '',
    vatBreakdownForStorno,
  }
}
