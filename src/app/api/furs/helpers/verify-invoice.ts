// =====================================================================
// FURS Verify Invoice - Davčno overi račun pri FURS
// =====================================================================

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { toNum } from '@/lib/decimal'
import { generateFursQRContent, loadCertificatePrivateKey, generateZOI, verifyInvoiceWithFURS, type FursInvoiceData } from '@/lib/furs'
import { buildFursConfigFromSettings } from './build-config'
import { deductStockForOrder, broadcastLowStockAlert } from '@/lib/stock-deduction'
import { emitReceiptCreated, emitReceiptFiscalVerified } from '@/lib/event-emitter'
import { parseVatBreakdown } from '../shared'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { parseJsonBody, validateBody, handleApiError } from '@/lib/api-utils'
import { fursVerifySchema } from '@/lib/validations'

export async function verifyInvoice(req: Request): Promise<Response> {
  // FIX BUG-08: receipt mora biti dostopen v catch bloku
  let receipt: Awaited<ReturnType<typeof db.receipt.findFirst>> = null
  try {
    try {
      // Rate limiting — prepreči zlorabo API-ja
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
  
      // FIX HIGH: Preveri, da naročilo NI preklicano/stornirano — FURS overitev ni mogoča za preklicana naročila
      if (order.status === 'cancelled') {
        return NextResponse.json({ error: 'Preklicano naročilo ne more biti davčno overjeno' }, { status: 400 })
      }
  
      const settings = await db.restaurantSettings.findFirst({ where: { isActive: true } })
  
      if (!settings) {
        return NextResponse.json({ error: 'Ni nastavitev restavracije' }, { status: 400 })
      }
  
      receipt = await db.receipt.findFirst({ where: { orderId, isStorno: false } })
  
      if (!receipt) {
        return NextResponse.json({ error: 'Račun ni najden - najprej ustvarite račun' }, { status: 400 })
      }
  
      // FIX CRITICAL: Zgradi config PREDEN se uporabi — prejšnja koda je referencirala config
      // preden je bil definiran, ko je račun že overjen (ReferenceError: config is not defined)
      const config = await buildFursConfigFromSettings(settings)
  
      if (receipt.fiscalVerified) {
        // Vrni QR kodo tudi za že overjene račune
        const qrContent = generateFursQRContent({
          zoi: receipt.zoi,
          totalAmount: toNum(receipt.total),
          issueDateTime: receipt.createdAt,
          taxId: settings.taxId,
          businessId: settings.businessId,
          registerId: settings.registerNumber,
          premisesId: config.premisesId,
        })
  
        return NextResponse.json({
          success: true,
          zoi: receipt.zoi,
          eor: receipt.eor,
          fiscalVerified: true,
          verificationDate: receipt.verificationDate?.toISOString(),
          qrContent,
          message: 'Račun je že davčno overjen',
        })
      }
  
      // ─── GENERIRAJ ZOI po FURS specifikaciji ───
      
      // Naloži privatni ključ iz certifikata za RSA-SHA256 podpis
      const privateKey = (settings.fursCertPath && settings.fursCertPassword)
        ? loadCertificatePrivateKey(settings.fursCertPath, settings.fursCertPassword)
        : undefined
  
      // FIX CRITICAL: generateZOI je bil okvarjen — mankal je registerId in zaklepni oklepaj
      // FURS ZOI specifikacija zahteva registerId (oznaka blagajne) za pravilen izračun ZOI
      // FIX F1 CRITICAL: Podaj environment v generateZOI — prejšnja koda je referencirala nedefinirano spremenljivko
      const zoi = generateZOI({
        taxId: settings.taxId,
        invoiceNumber: receipt.receiptNumber,
        issueDateTime: receipt.createdAt,
        totalAmount: toNum(receipt.total),
        premisesId: config.premisesId,
        registerId: config.registerId,
        environment: config.environment,
      }, privateKey || undefined)
  
      // ─── PRIPRAVI PODATKE ZA FURS OVERITEV ───
      const vatBreakdown = parseVatBreakdown(receipt.vatBreakdown as string, toNum(receipt.total), 22)
  
      // FIX F04 HIGH: Preveri, da imamo DDV podatke pred pošiljanjem FURS
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
  
      // ─── POŠLJI NA FURS (ali simuliraj) ───
      const result = await verifyInvoiceWithFURS(config, invoiceData, zoi)
  
      if (!result.success) {
        // FIX BUG-08: Označi račun kot pending — overitev ni uspela, ampak račun obstaja
        await db.receipt.update({
          where: { id: receipt.id },
          data: {
            fiscalVerified: false,
            fiscalStatus: 'pending',
          },
        })
  
        // Overitev ni uspela — ne shrani
        await createAuditLog({
          userId: authResult.session?.employeeId,
          action: 'FURS_VERIFY_FAILED',
          entityType: 'Receipt',
          entityId: receipt.id,
          details: { zoi, error: result.error, isSimulation: result.isSimulation },
        })
  
        const failResponse = NextResponse.json({
          success: false,
          zoi,
          eor: '',
          fiscalVerified: false,
          fiscalStatus: 'pending',
          isSimulation: result.isSimulation,
          error: result.error || 'Napaka pri FURS overjanju',
          warning: 'FISKALIZACIJA NI USPELA — Račun je označen kot pending. Ponovite overitev čim prej!',
        }, { status: 400 })
        failResponse.headers.set('X-Fiscal-Warning', 'Fiscalization pending — receipt requires manual re-verification')
        return failResponse
      }
  
      // ─── SHRANI OVERITEV ───
      await db.receipt.update({
        where: { id: receipt.id },
        data: {
          zoi: result.zoi,
          eor: result.eor,
          fiscalVerified: true,
          fiscalStatus: 'verified',
          verificationDate: result.verifiedAt,
        },
      })
  
      // ─── RAZKNJIŽEVANJE ZALOGE (fallback) ───
      // FIX CRITICAL: Preveri inventoryDeducted brez predhodnega nastavljanja flaga.
      // Prejšnja koda je nastavila inventoryDeducted=true ZNOTRAJ transakcije,
      // nato pa preverila freshOrder.inventoryDeducted (ki je bil false — stara vrednost).
      // Potem je deductStockForOrder preveril inventoryDeducted in videl true,
      // zato SKUPAJ zaloge NI bila razknjižena. Popravek: samo preveri, ne nastavljaj flaga.
      const freshOrder = await db.order.findUnique({ where: { id: order.id } })
      if (freshOrder && !freshOrder.inventoryDeducted) {
        // Zaloga še ni bila razknjižena — razknjiži sedaj
        // deductStockForOrder bo sam nastavil inventoryDeducted=true po koncu
        const stockResult = await deductStockForOrder(
          order.id,
          order.orderNumber,
          order.orderItems.map(oi => ({
            menuItemId: oi.menuItemId,
            quantity: oi.quantity,
            voided: oi.voided,
          }))
        )
        if (stockResult.lowStockAlerts.length > 0) {
          broadcastLowStockAlert(stockResult.lowStockAlerts)
        }
      }
  
      // ─── QR KODA ───
      const qrContent = generateFursQRContent({
        zoi: result.zoi,
        totalAmount: toNum(receipt.total),
        issueDateTime: receipt.createdAt,
        taxId: settings.taxId,
        businessId: settings.businessId,
        registerId: settings.registerNumber,
        premisesId: config.premisesId,
      })
  
      // ─── REVIZIJSKI DNEVNIK ───
      await createAuditLog({
        userId: authResult.session?.employeeId,
        action: 'FURS_VERIFY_SUCCESS',
        entityType: 'Receipt',
        entityId: receipt.id,
        details: {
          zoi: result.zoi,
          eor: result.eor,
          isSimulation: result.isSimulation,
          environment: result.environment,
        },
      })
  
      // Webhook: receipt.fiscal_verified
      emitReceiptFiscalVerified({
        receiptId: receipt.id,
        zoi: result.zoi,
        eor: result.eor,
      }).catch(err => logger.error('API', '[Webhook] receipt.fiscal_verified napaka:', err))
  
      // Webhook: receipt.created (ob FURS overitvi je račun dokončen)
      emitReceiptCreated({
        receiptId: receipt.id,
        receiptNumber: receipt.receiptNumber,
        orderId: receipt.orderId,
        total: toNum(receipt.total),
      }).catch(err => logger.error('API', '[Webhook] receipt.created napaka:', err))
  
      return NextResponse.json({
        success: true,
        zoi: result.zoi,
        eor: result.eor,
        fiscalVerified: true,
        verificationDate: result.verifiedAt.toISOString(),
        receiptNumber: receipt.receiptNumber,
        isSimulation: result.isSimulation,
        environment: result.environment,
        qrContent,
        message: result.isSimulation
          ? `Račun davčno overjen (SIMULACIJA) v ${result.environment === 'test' ? 'TESTNEM' : 'PRODUKCIJSKEM'} okolju`
          : `Račun davčno overjen v ${result.environment === 'test' ? 'TESTNEM' : 'PRODUKCIJSKEM'} okolju`,
      })
    } catch (error: unknown) {
      logger.error('API', 'FURS verification error:', error)
  
      // FIX BUG-08: Označi račun kot pending kadar overitev vrne nepričakovano napako
      if (receipt?.id) {
        try {
          await db.receipt.update({
            where: { id: receipt.id },
            data: {
              fiscalVerified: false,
              fiscalStatus: 'pending',
            },
          })
        } catch { /* Receipt update failed — already logged below */ }
      }
  
      await createAuditLog({
        userId: undefined,
        action: 'FURS_VERIFY_ERROR',
        entityType: 'Receipt',
        details: { error: String(error) },
      })
  
      const errorResponse = NextResponse.json({
        error: 'Napaka pri davčnem overjanju računa',
        fiscalStatus: 'pending',
        warning: 'FISKALIZACIJA NI USPELA — Račun je označen kot pending. Ponovite overitev čim prej!',
      }, { status: 500 })
      errorResponse.headers.set('X-Fiscal-Warning', 'Fiscalization pending — receipt requires manual re-verification')
      return errorResponse
    }
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/furs', 'Napaka pri overjanju računa')
  }
}
