// FIX F4 MEDIUM: Deljena parseVatBreakdown — prejšnja koda je imela dvojnika v batch/route.ts

// ============================================
// FURS DAVČNO POTRJEVANJE (Fiscal Verification)
// Slovenski zakon ZDDV-1 — davčno overjanje računov
// Uporablja lib/furs.ts za ZOI, EOR, QR in certifikate
// ============================================

// Helper: pridobi FURS konfiguracijo iz nastavitev restavracije
// FIX FURS-02 HIGH: Pridobi premisesId iz Location modela če je na voljo
import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { toNum, deepToNumbers } from '@/lib/decimal'
import { getNextReceiptNumber } from '@/lib/counters'
import { fursVerifySchema, fursStornoSchema } from '@/lib/validations'
import { deductStockForOrder, returnStockForOrder, broadcastLowStockAlert } from '@/lib/stock-deduction'
import { generateZOI, verifyInvoiceWithFURS, checkFursConnectivity, validateFursConfig, generateFursQRContent, loadCertificatePrivateKey, type FursConfig, type FursInvoiceData } from '@/lib/furs'
import { emitReceiptCreated, emitReceiptFiscalVerified } from '@/lib/event-emitter'
import { parseVatBreakdown } from './shared'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
async function buildFursConfigFromSettings(settings: {
  businessId: string
  taxId: string
  registerNumber: string
  fursCertPath: string
  fursCertPassword: string
  fursEnvironment: string
}): Promise<FursConfig> {
  // Poskusi pridobiti premisesId iz aktivne lokacije
  let premisesId = settings.businessId || '' // Fallback na businessId
  try {
    const activeLocation = await db.location.findFirst({ where: { isActive: true } })
    if (activeLocation?.premisesId) {
      premisesId = activeLocation.premisesId
    }
  } catch {
    // Location model morda ne obstaja — uporabi businessId
  }

  return {
    businessId: settings.businessId || '',
    taxId: settings.taxId || '',
    registerId: settings.registerNumber || 'BLG-001',
    premisesId, // FIX FURS-02: Uporabi location.premisesId namesto businessId
    deviceIp: '', // NOTE: fursDeviceId je na voljo v Location modelu za FURS spec skladnost
    environment: (settings.fursEnvironment === 'production' ? 'production' : 'test') as FursConfig['environment'],
    certPath: settings.fursCertPath || undefined,
    certPassword: settings.fursCertPassword || undefined,
  }
}

// GET /api/furs — Preveri status FURS povezave
export async function GET(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = checkRateLimit('furs', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const settings = await db.restaurantSettings.findFirst({ where: { isActive: true } })

    if (!settings) {
      return NextResponse.json({
        connected: false,
        environment: 'test',
        message: 'Ni nastavljenih podatkov za FURS povezavo',
        configValid: false,
      })
    }

    const config = await buildFursConfigFromSettings(settings)
    const validation = validateFursConfig(config)
    const hasCert = !!(settings.fursCertPath && settings.fursCertPassword)
    const environment = settings.fursEnvironment || 'test'

    // Preveri povezljivost s FURS strežnikom
    const connectivity = await checkFursConnectivity(environment as 'test' | 'production')

    // FIX BUG-08: Opozorilo o ne-overjenih računih, starejših od 1 uro
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const unfiscalizedCount = await db.receipt.count({
      where: {
        fiscalVerified: false,
        isStorno: false,
        createdAt: { lt: oneHourAgo },
      },
    })

    const response = NextResponse.json({
      connected: connectivity.reachable,
      environment,
      message: connectivity.reachable
        ? (environment === 'test' ? 'FURS testno okolje je dosegljivo' : 'FURS produkcijsko okolje je dosegljivo')
        : `FURS strežnik ni dosegljiv: ${connectivity.error || 'Timeout'}`,
      certConfigured: hasCert,
      configValid: validation.valid,
      configErrors: validation.errors,
      configWarnings: validation.warnings,
      responseTime: connectivity.responseTime,
      fursUrl: environment === 'test'
        ? 'https://blagajne-test.fu.gov.si:9002/v1/cash_payments'
        : 'https://blagajne.fu.gov.si/v1/cash_payments',
      lastCheck: new Date().toISOString(),
      // FIX BUG-08: Opozorilo o ne-overjenih računih
      unfiscalizedWarning: unfiscalizedCount > 0
        ? `POZOR: ${unfiscalizedCount} računov nima davčne overitve in je starejših od 1 ure!`
        : null,
      unfiscalizedCount,
    })

    // FIX BUG-08: Dodaj opozorilni header če so ne-overjeni računi
    if (unfiscalizedCount > 0) {
      response.headers.set('X-Fiscal-Warning', `${unfiscalizedCount} unfiscalized receipts older than 1 hour`)
    }

    return response
  } catch (error: unknown) {
    logger.error('API', 'FURS status error:', error)
    return NextResponse.json({ connected: false, message: 'Napaka pri preverjanju FURS povezave' }, { status: 500 })
  }
}

// POST /api/furs — Davčno overi račun pri FURS
export async function POST(req: Request) {
  // FIX BUG-08: receipt mora biti dostopen v catch bloku
  let receipt: Awaited<ReturnType<typeof db.receipt.findFirst>> = null
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
}

// PUT /api/furs — Storno račun
export async function PUT(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
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
