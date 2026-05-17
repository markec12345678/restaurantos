import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getNextReceiptNumber } from '@/lib/counters'
import { validateBody, fursVerifySchema, fursStornoSchema } from '@/lib/validations'
import { deductStockForOrder, returnStockForOrder, broadcastLowStockAlert } from '@/lib/stock-deduction'
import {
  generateZOI,
  verifyInvoiceWithFURS,
  checkFursConnectivity,
  validateFursConfig,
  generateFursQRContent,
  loadCertificatePrivateKey,
  type FursConfig,
  type FursInvoiceData,
} from '@/lib/furs'

// ============================================
// FURS DAVČNO POTRJEVANJE (Fiscal Verification)
// Slovenski zakon ZDDV-1 — davčno overjanje računov
// Uporablja lib/furs.ts za ZOI, EOR, QR in certifikate
// ============================================

// Helper: pridobi FURS konfiguracijo iz nastavitev restavracije
function buildFursConfig(settings: {
  businessId: string
  taxId: string
  registerNumber: string
  fursCertPath: string
  fursCertPassword: string
  fursEnvironment: string
}): FursConfig {
  return {
    businessId: settings.businessId || '',
    taxId: settings.taxId || '',
    registerId: settings.registerNumber || 'BLG-001',
    premisesId: settings.businessId || '', // Privzeto: matična št. = poslovni prostor
    deviceIp: '',
    environment: (settings.fursEnvironment === 'production' ? 'production' : 'test') as FursConfig['environment'],
    certPath: settings.fursCertPath || undefined,
    certPassword: settings.fursCertPassword || undefined,
  }
}

// Helper: pridobi DDV razdelitev iz računa
function parseVatBreakdown(vatBreakdownStr: string): Array<{ rate: number; baseAmount: number; vatAmount: number }> {
  try {
    const parsed = JSON.parse(vatBreakdownStr || '{}')
    return Object.entries(parsed).map(([rate, amounts]) => ({
      rate: parseFloat(rate),
      baseAmount: (amounts as { base: number; vat: number }).base || 0,
      vatAmount: (amounts as { base: number; vat: number }).vat || 0,
    }))
  } catch {
    return []
  }
}

// GET /api/furs — Preveri status FURS povezave
export async function GET(req: Request) {
  try {
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

    const config = buildFursConfig(settings)
    const validation = validateFursConfig(config)
    const hasCert = !!(settings.fursCertPath && settings.fursCertPassword)
    const environment = settings.fursEnvironment || 'test'

    // Preveri povezljivost s FURS strežnikom
    const connectivity = await checkFursConnectivity(environment as 'test' | 'production')

    return NextResponse.json({
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
    })
  } catch (error) {
    console.error('FURS status error:', error)
    return NextResponse.json({ connected: false, message: 'Napaka pri preverjanju FURS povezave' }, { status: 500 })
  }
}

// POST /api/furs — Davčno overi račun pri FURS
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    const { data, error: validationError } = validateBody(fursVerifySchema, body)
    if (validationError) return validationError

    const orderId = data.orderId

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { orderItems: { include: { menuItem: true } } },
    })

    if (!order) {
      return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })
    }

    const settings = await db.restaurantSettings.findFirst({ where: { isActive: true } })

    if (!settings) {
      return NextResponse.json({ error: 'Ni nastavitev restavracije' }, { status: 400 })
    }

    let receipt = await db.receipt.findFirst({ where: { orderId } })

    if (!receipt) {
      return NextResponse.json({ error: 'Račun ni najden - najprej ustvarite račun' }, { status: 400 })
    }

    if (receipt.fiscalVerified) {
      // Vrni QR kodo tudi za že overjene račune
      const qrContent = generateFursQRContent({
        zoi: receipt.zoi,
        totalAmount: receipt.total,
        issueDateTime: receipt.createdAt,
        taxId: settings.taxId,
        businessId: settings.businessId,
        registerId: settings.registerNumber,
        premisesId: settings.businessId,
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
    const config = buildFursConfig(settings)
    
    // Naloži privatni ključ iz certifikata za RSA-SHA256 podpis
    const privateKey = (settings.fursCertPath && settings.fursCertPassword)
      ? loadCertificatePrivateKey(settings.fursCertPath, settings.fursCertPassword)
      : undefined

    const zoi = generateZOI({
      taxId: settings.taxId,
      invoiceNumber: receipt.receiptNumber,
      issueDateTime: receipt.createdAt,
      totalAmount: receipt.total,
      premisesId: settings.businessId,
      registerId: settings.registerNumber,
    }, privateKey || undefined)

    // ─── PRIPRAVI PODATKE ZA FURS OVERITEV ───
    const vatBreakdown = parseVatBreakdown(receipt.vatBreakdown as string)

    const invoiceData: FursInvoiceData = {
      invoiceNumber: receipt.receiptNumber,
      issueDateTime: receipt.createdAt,
      totalAmount: receipt.total,
      paymentMethod: (receipt.paymentMethod === 'cash' ? 'cash' :
                      receipt.paymentMethod === 'card' ? 'card' :
                      receipt.paymentMethod === 'mobile' ? 'mobile' : 'other') as FursInvoiceData['paymentMethod'],
      vatBreakdown,
    }

    // ─── POŠLJI NA FURS (ali simuliraj) ───
    const result = await verifyInvoiceWithFURS(config, invoiceData, zoi)

    if (!result.success) {
      // Overitev ni uspela — ne shrani
      await createAuditLog({
        userId: authResult.session?.employeeId,
        action: 'FURS_VERIFY_FAILED',
        entityType: 'Receipt',
        entityId: receipt.id,
        details: { zoi, error: result.error, isSimulation: result.isSimulation },
      })

      return NextResponse.json({
        success: false,
        zoi,
        eor: '',
        fiscalVerified: false,
        isSimulation: result.isSimulation,
        error: result.error || 'Napaka pri FURS overjanju',
      }, { status: 400 })
    }

    // ─── SHRANI OVERITEV ───
    await db.receipt.update({
      where: { id: receipt.id },
      data: {
        zoi: result.zoi,
        eor: result.eor,
        fiscalVerified: true,
        verificationDate: result.verifiedAt,
      },
    })

    // ─── RAZKNJIŽEVANJE ZALOGE (fallback) ───
    const freshOrder = await db.order.findUnique({ where: { id: order.id } })
    if (freshOrder && !freshOrder.inventoryDeducted) {
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
      totalAmount: receipt.total,
      issueDateTime: receipt.createdAt,
      taxId: settings.taxId,
      businessId: settings.businessId,
      registerId: settings.registerNumber,
      premisesId: settings.businessId,
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
  } catch (error) {
    console.error('FURS verification error:', error)

    await createAuditLog({
      userId: undefined,
      action: 'FURS_VERIFY_ERROR',
      entityType: 'Receipt',
      details: { error: String(error) },
    })

    return NextResponse.json({ error: 'Napaka pri davčnem overjanju računa' }, { status: 500 })
  }
}

// PUT /api/furs — Storno račun
export async function PUT(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    const { data, error: validationError } = validateBody(fursStornoSchema, body)
    if (validationError) return validationError

    const { orderId, reason, reasonCode } = data

    const receipt = await db.receipt.findFirst({ where: { orderId } })
    if (!receipt) {
      return NextResponse.json({ error: 'Račun ni najden' }, { status: 404 })
    }

    if (receipt.isStorno) {
      return NextResponse.json({ error: 'Račun je že storniran' }, { status: 400 })
    }

    const settings = await db.restaurantSettings.findFirst({ where: { isActive: true } })
    const config = buildFursConfig(settings || {
      businessId: '', taxId: '', registerNumber: 'BLG-001',
      fursCertPath: '', fursCertPassword: '', fursEnvironment: 'test',
    })

    // Atomna številka storno računa
    const stornoNumber = await getNextReceiptNumber()

    // Naloži privatni ključ za podpisovanje storno računa
    const privateKey = (settings?.fursCertPath && settings?.fursCertPassword)
      ? loadCertificatePrivateKey(settings.fursCertPath, settings.fursCertPassword)
      : undefined

    // Generiraj ZOI za storno račun
    const zoi = generateZOI({
      taxId: config.taxId,
      invoiceNumber: stornoNumber,
      issueDateTime: new Date(),
      totalAmount: -receipt.total,
      premisesId: config.businessId,
      registerId: config.registerId,
    }, privateKey || undefined)

    // FURS overitev storno računa
    const vatBreakdown = parseVatBreakdown(receipt.vatBreakdown as string)

    const stornoInvoiceData: FursInvoiceData = {
      invoiceNumber: stornoNumber,
      issueDateTime: new Date(),
      totalAmount: -receipt.total,
      paymentMethod: (receipt.paymentMethod === 'cash' ? 'cash' :
                      receipt.paymentMethod === 'card' ? 'card' : 'other') as FursInvoiceData['paymentMethod'],
      vatBreakdown: vatBreakdown.map(vb => ({
        rate: vb.rate,
        baseAmount: -vb.baseAmount,
        vatAmount: -vb.vatAmount,
      })),
    }

    const fursResult = await verifyInvoiceWithFURS(config, stornoInvoiceData, zoi)

    // FIX: Vse operacije v eni transakciji — prepreči parcialno stanje
    const stornoReceipt = await db.$transaction(async (tx) => {
      const receipt = await tx.receipt.create({
        data: {
          receiptNumber: stornoNumber,
          orderId: receipt.orderId,
          businessName: receipt.businessName,
          businessAddress: receipt.businessAddress,
          businessId: receipt.businessId,
          taxId: receipt.taxId,
          registerId: receipt.registerId,
          zoi: fursResult.zoi || zoi,
          eor: fursResult.eor || '',
          fiscalVerified: fursResult.success,
          verificationDate: fursResult.verifiedAt,
          subtotal: -receipt.subtotal,
          vatBreakdown: receipt.vatBreakdown,
          totalVat: -receipt.totalVat,
          discount: -receipt.discount,
          total: -receipt.total,
          tip: -receipt.tip,
          totalWithTip: -receipt.totalWithTip,
          paymentMethod: receipt.paymentMethod,
          isCopy: false,
          isStorno: true,
          stornoOf: receipt.receiptNumber,
        },
      })

      // Označi original kot storniran
      await tx.receipt.update({
        where: { id: receipt.id },
        data: { isStorno: true },
      })

      // Posodobi naročilo
      await tx.order.update({
        where: { id: receipt.orderId },
        data: {
          paymentStatus: 'storno',
          status: 'cancelled',
          cancelReason: `STORNO: ${reason || reasonCode}`,
          cancelledAt: new Date(),
          cancelledBy: authResult.session?.employeeId || '',
        },
      })

      // Označi plačila kot refunded
      const checks = await tx.check.findMany({ where: { orderId: receipt.orderId } })
      for (const check of checks) {
        await tx.payment.updateMany({
          where: { checkId: check.id },
          data: { status: 'refunded' },
        })
      }

      return receipt
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
      totalAmount: -receipt.total,
      issueDateTime: stornoReceipt.createdAt,
      taxId: config.taxId,
      businessId: config.businessId,
      registerId: config.registerId,
      premisesId: config.businessId,
    })

    return NextResponse.json({
      success: true,
      stornoReceipt,
      originalReceiptNumber: receipt.receiptNumber,
      stornoReason: reason || reasonCode,
      isSimulation: fursResult.isSimulation,
      qrContent,
      message: `Storno račun ${stornoNumber} ustvarjen za račun ${receipt.receiptNumber}${fursResult.isSimulation ? ' (SIMULACIJA)' : ''}`,
    })
  } catch (error) {
    console.error('FURS storno error:', error)
    return NextResponse.json({ error: 'Napaka pri storniranju računa' }, { status: 500 })
  }
}
