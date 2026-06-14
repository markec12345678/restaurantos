// =====================================================================
// FURS Storno Invoice - Storno račun
// =====================================================================

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { toNum, deepToNumbers } from '@/lib/decimal'
import { getNextReceiptNumber } from '@/lib/counters'
import { fursStornoSchema } from '@/lib/validations'
import { returnStockForOrder, broadcastLowStockAlert } from '@/lib/stock-deduction'
import { generateZOI, verifyInvoiceWithFURS, generateFursQRContent, loadCertificatePrivateKey, type FursInvoiceData } from '@/lib/furs'
import { buildFursConfigFromSettings } from './build-config'
import { parseVatBreakdown } from '../shared'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { parseJsonBody, validateBody } from '@/lib/api-utils'
import { handleApiError } from '@/lib/api-utils'

export async function stornoInvoice(req: Request): Promise<Response> {
  try {
      const rl = checkRateLimit('furs', getClientIp(req), AUTHENTICATED_LIMIT)
      if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })
  
      const authResult = await requireAuth(req, { permission: 'admin' })
      if (authResult.error) return authResult.error
  
      const bodyResult = await parseJsonBody(req)
      if (bodyResult.error) return bodyResult.error
  
      const { data, error: validationError } = validateBody(fursStornoSchema, bodyResult.data)
      if (validationError) return validationError
  
      const { orderId, reason, reasonCode } = data
  
      // FIX HIGH: Poišči ORIGINALNI račun (ne storno) — findFirst brez filtra bi lahko našel storno
      const receipt = await db.receipt.findFirst({ where: { orderId, isStorno: false } })
      if (!receipt) {
        return NextResponse.json({ error: 'Račun ni najden' }, { status: 404 })
      }
  
      if (receipt.isStorno) {
        return NextResponse.json({ error: 'Račun je že storniran' }, { status: 400 })
      }
  
      // FIX BUG: Preveri, da naročilo NI že preklicano — prepreči double-storno
      const existingOrder = await db.order.findUnique({ where: { id: orderId } })
      if (existingOrder?.status === 'cancelled') {
        return NextResponse.json({ error: 'Naročilo je že preklicano — storno ni mogoč' }, { status: 400 })
      }
      if (existingOrder?.paymentStatus === 'storno') {
        return NextResponse.json({ error: 'Naročilo je že stornirano — storno ni mogoč' }, { status: 400 })
      }
  
      // FIX MEDIUM: Preveri, da je originalni račun davčno overjen — FURS zahteva
      // Storno računa, ki ni overjen, ni smiselno — najprej overi, nato storniraj
      // V PRODUKCIJI: BLOKIRAJ storno ne-overjenega računa (ZDDV-1 zahteva)
      // V TESTNEM okolju: dovoli z opozorilom
      if (!receipt.fiscalVerified) {
        const settings = await db.restaurantSettings.findFirst({ where: { isActive: true } })
        const env = settings?.fursEnvironment || 'test'
        if (env === 'production') {
          return NextResponse.json({
            error: 'Račun ni davčno overjen — storno ni mogoč v produkciji. Najprej overite račun pri FURS.',
            receiptNumber: receipt.receiptNumber,
          }, { status: 400 })
        }
        // Testno okolje — opozori, a dovoli
        logger.warn('API', `[FURS] Storno ne-overjenega računa ${receipt.receiptNumber} v testnem okolju`)
      }
  
      const settings = await db.restaurantSettings.findFirst({ where: { isActive: true } })
      // FIX: Preveri da so nastavitve na voljo PREDEN nadaljuješ s stornom
      if (!settings) {
        return NextResponse.json({ error: 'Ni nastavitev restavracije — storno ni mogoč' }, { status: 400 })
      }
      if (!settings.businessId || !settings.taxId) {
        return NextResponse.json({ error: 'Manjkajo poslovni podatki (matična št., DDV ID) — storno ni mogoč' }, { status: 400 })
      }
      const config = await buildFursConfigFromSettings(settings)
  
      // Atomna številka storno računa
      const stornoNumber = await getNextReceiptNumber()
  
      // Naloži privatni ključ za podpisovanje storno računa
      // FIX MEDIUM: settings je že validiran kot non-null zgoraj (vrne 400 če ni)
      const privateKey = (settings.fursCertPath && settings.fursCertPassword)
        ? loadCertificatePrivateKey(settings.fursCertPath, settings.fursCertPassword)
        : undefined
  
      // Generiraj ZOI za storno račun
      // FIX F1 CRITICAL: Podaj environment v generateZOI — prejšnja koda je referencirala nedefinirano spremenljivko
      const zoi = generateZOI({
        taxId: config.taxId,
        invoiceNumber: stornoNumber,
        issueDateTime: new Date(),
        totalAmount: toNum(receipt.total), // FIX F3 HIGH: FURS zahteva POZITIVEN znesek z InvoiceType storno, NE negativni
        premisesId: config.premisesId,
        registerId: config.registerId,
        environment: config.environment,
      }, privateKey || undefined)
  
      // FURS overitev storno računa
      const vatBreakdown = parseVatBreakdown(receipt.vatBreakdown as string, toNum(receipt.total), 22)
  
      // FIX F04 HIGH: Preveri DDV podatke za storno
      if (vatBreakdown.length === 0) {
        return NextResponse.json({
          error: 'Račun nima DDV podatkov — storno ni mogoč. Popravite originalni račun.',
          receiptNumber: receipt.receiptNumber,
        }, { status: 400 })
      }
  
      // FIX MEDIUM: Pripravi negiran vatBreakdown za shranjevanje v storno račun
      const vatBreakdownForStorno: Record<string, { base: number; vat: number }> = {}
      for (const vb of vatBreakdown) {
        vatBreakdownForStorno[String(vb.rate)] = { base: vb.baseAmount, vat: vb.vatAmount }
      }
  
      // FIX F3 HIGH: FURS storno račun MORA imeti POZITIVNE zneske z referenco na originalni račun
      // Po FURS specifikaciji se storno račun pošlje s pozitivnimi zneski in InvoiceIdentifier
      // originalnega računa — FURS sam obrne predznak. Negativni zneski bodo zavrnjeni.
      // V bazi pa hranimo negativne zneske za pravilno knjigovodstvo.
      const stornoInvoiceData: FursInvoiceData = {
        invoiceNumber: stornoNumber,
        issueDateTime: new Date(),
        totalAmount: toNum(receipt.total), // POZITIVEN — FURS storno specifikacija
        paymentMethod: (receipt.paymentMethod === 'cash' ? 'cash' :
                        receipt.paymentMethod === 'card' ? 'card' : 'other') as FursInvoiceData['paymentMethod'],
        vatBreakdown: vatBreakdown.map(vb => ({
          rate: vb.rate,
          baseAmount: vb.baseAmount,  // POZITIVEN — FURS storno specifikacija
          vatAmount: vb.vatAmount,    // POZITIVEN — FURS storno specifikacija
        })),
        // FIX BUG1: Proper ReferenceInvoice structure — FURS requires original ZOI and issue date
        // Previously misused customerVatId/customerName fields — FURS would reject the storno
        isStorno: true,
        referenceInvoice: {
          invoiceNumber: receipt.receiptNumber,
          zoi: receipt.zoi,
          issueDateTime: receipt.createdAt,
        },
      }
  
      const fursResult = await verifyInvoiceWithFURS(config, stornoInvoiceData, zoi)
  
      // FIX F08 HIGH: Če FURS overitev storna NE uspe, NE označi originala kot storniranega
      // Prejšnja koda je nadaljevala s stornom tudi ko je fursResult.success=false
      if (!fursResult.success) {
        // Označi poskus storna v audit logu
        await createAuditLog({
          userId: authResult.session?.employeeId,
          action: 'FURS_STORNO_FAILED',
          entityType: 'Receipt',
          entityId: receipt.id,
          details: {
            stornoNumber,
            originalReceiptNumber: receipt.receiptNumber,
            reason: reason || reasonCode,
            fursError: fursResult.error,
            isSimulation: fursResult.isSimulation,
          },
        })
  
        return NextResponse.json({
          success: false,
          error: 'FURS overitev storno računa ni uspela — storno NI bilo izvedeno.',
          fursError: fursResult.error,
          isSimulation: fursResult.isSimulation,
          warning: 'STORNO NI IZVEDENO — FURS overitev ni uspela. Poskusite znova.',
        }, { status: 400 })
      }
  
      // FURS overitev storna je uspela — nadaljuj s transakcijo
      const originalReceipt = receipt
      const stornoReceipt = await db.$transaction(async (tx) => {
        const newStornoReceipt = await tx.receipt.create({
          data: {
            receiptNumber: stornoNumber,
            orderId: originalReceipt.orderId,
            businessName: originalReceipt.businessName,
            businessAddress: originalReceipt.businessAddress,
            businessId: originalReceipt.businessId,
            taxId: originalReceipt.taxId,
            registerId: originalReceipt.registerId,
            zoi: fursResult.zoi || zoi,
            eor: fursResult.eor || '',
            fiscalVerified: fursResult.success,
            verificationDate: fursResult.verifiedAt,
            subtotal: originalReceipt.subtotal.negated(),
            // FIX MEDIUM: Shrani NEGIRAN vatBreakdown — storno račun ima negativne zneske
            vatBreakdown: JSON.stringify(
              Object.fromEntries(
                Object.entries(vatBreakdownForStorno).map(([rate, data]) => [
                  rate,
                  { base: -(data as { base: number; vat: number }).base, vat: -(data as { base: number; vat: number }).vat }
                ])
              )
            ),
            totalVat: originalReceipt.totalVat.negated(),
            discount: originalReceipt.discount.negated(),
            total: originalReceipt.total.negated(),
            tip: originalReceipt.tip.negated(),
            totalWithTip: originalReceipt.totalWithTip.negated(),
            paymentMethod: originalReceipt.paymentMethod,
            isCopy: false,
            isStorno: true,
            stornoOf: originalReceipt.receiptNumber,
          },
        })
  
        // Označi original kot storniran
        await tx.receipt.update({
          where: { id: originalReceipt.id },
          data: { isStorno: true },
        })
  
        // Posodobi naročilo
        await tx.order.update({
          where: { id: originalReceipt.orderId },
          data: {
            paymentStatus: 'storno',
            status: 'cancelled',
            cancelReason: `STORNO: ${reason || reasonCode}`,
            cancelledAt: new Date(),
            cancelledBy: authResult.session?.employeeId || '',
          },
        })
  
        // Označi plačila kot refunded
        const checks = await tx.check.findMany({ where: { orderId: originalReceipt.orderId } })
        for (const check of checks) {
          await tx.payment.updateMany({
            where: { checkId: check.id },
            data: { status: 'refunded' },
          })
        }
  
        return newStornoReceipt
      })
  
      // Vrni zalogo
      const stornoOrder = await db.order.findUnique({ where: { id: receipt.orderId } })
      if (stornoOrder && stornoOrder.inventoryDeducted) {
        const returnResult = await returnStockForOrder(
          receipt.orderId,
          stornoOrder.orderNumber,
          `STORNO: ${reason || reasonCode}`
        )
        if (returnResult.lowStockAlerts.length > 0) {
          broadcastLowStockAlert(returnResult.lowStockAlerts)
        }
      }
  
      // Revizijski dnevnik
      await createAuditLog({
        userId: authResult.session?.employeeId,
        action: 'FURS_STORNO',
        entityType: 'Receipt',
        entityId: stornoReceipt.id,
        details: {
          stornoNumber,
          originalReceiptNumber: receipt.receiptNumber,
          reason: reason || reasonCode,
          isSimulation: fursResult.isSimulation,
        },
      })
  
      // QR koda za storno
      const qrContent = generateFursQRContent({
        zoi: fursResult.zoi || zoi,
        totalAmount: toNum(receipt.total), // FIX F3: Pozitiven znesek za QR kodo — FURS specifikacija
        issueDateTime: stornoReceipt.createdAt,
        taxId: config.taxId,
        businessId: config.businessId,
        registerId: config.registerId,
        premisesId: config.premisesId,
      })
  
      return NextResponse.json(deepToNumbers({
        success: true,
        stornoReceipt,
        originalReceiptNumber: receipt.receiptNumber,
        stornoReason: reason || reasonCode,
        isSimulation: fursResult.isSimulation,
        qrContent,
        message: `Storno račun ${stornoNumber} ustvarjen za račun ${receipt.receiptNumber}${fursResult.isSimulation ? ' (SIMULACIJA)' : ''}`,
      }))
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/furs', 'Napaka pri storniranju računa')
  }
}
