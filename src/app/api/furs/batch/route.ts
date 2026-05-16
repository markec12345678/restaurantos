import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import {
  generateZOI,
  verifyInvoiceWithFURS,
  validateFursConfig,
  generateFursQRContent,
  loadCertificatePrivateKey,
  type FursConfig,
  type FursInvoiceData,
} from '@/lib/furs'

// ============================================
// POST /api/furs/batch — Množična davčna overitev neoverjenih računov
// Poišče vse neoverjene račune in jih posreduje FURS
// ============================================

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
    premisesId: settings.businessId || '',
    deviceIp: '',
    environment: (settings.fursEnvironment === 'production' ? 'production' : 'test') as FursConfig['environment'],
    certPath: settings.fursCertPath || undefined,
    certPassword: settings.fursCertPassword || undefined,
  }
}

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

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const settings = await db.restaurantSettings.findFirst({ where: { isActive: true } })
    if (!settings) {
      return NextResponse.json({ error: 'Ni nastavitev restavracije' }, { status: 400 })
    }

    const config = buildFursConfig(settings)
    const validation = validateFursConfig(config)
    if (!validation.valid) {
      return NextResponse.json({ error: 'FURS konfiguracija ni veljavna', errors: validation.errors }, { status: 400 })
    }

    // Poišči vse neoverjene račune (max 50 naenkrat)
    const unverifiedReceipts = await db.receipt.findMany({
      where: {
        fiscalVerified: false,
        isStorno: false,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Zadnjih 30 dni
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    })

    if (unverifiedReceipts.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        successful: 0,
        failed: 0,
        message: 'Vsi računi so že davčno overjeni',
      })
    }

    // Naloži privatni ključ enkrat za vse
    const privateKey = (settings.fursCertPath && settings.fursCertPassword)
      ? loadCertificatePrivateKey(settings.fursCertPath, settings.fursCertPassword)
      : undefined

    const results: Array<{
      receiptId: string
      receiptNumber: string
      success: boolean
      zoi?: string
      eor?: string
      isSimulation?: boolean
      error?: string
    }> = []

    let successful = 0
    let failed = 0

    // Obdelaj račune zaporedno (FURS ima omejitev na hitrost zahtevkov)
    for (const receipt of unverifiedReceipts) {
      try {
        // Generiraj ZOI
        const zoi = generateZOI({
          taxId: settings.taxId,
          invoiceNumber: receipt.receiptNumber,
          issueDateTime: receipt.createdAt,
          totalAmount: receipt.total,
          premisesId: settings.businessId,
          registerId: settings.registerNumber,
        }, privateKey || undefined)

        // Pripravi podatke za FURS
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

        // Pošlji na FURS
        const result = await verifyInvoiceWithFURS(config, invoiceData, zoi)

        if (result.success) {
          // Shrani overitev
          await db.receipt.update({
            where: { id: receipt.id },
            data: {
              zoi: result.zoi,
              eor: result.eor,
              fiscalVerified: true,
              verificationDate: result.verifiedAt,
            },
          })

          successful++
          results.push({
            receiptId: receipt.id,
            receiptNumber: receipt.receiptNumber,
            success: true,
            zoi: result.zoi,
            eor: result.eor,
            isSimulation: result.isSimulation,
          })
        } else {
          failed++
          results.push({
            receiptId: receipt.id,
            receiptNumber: receipt.receiptNumber,
            success: false,
            error: result.error || 'Napaka pri overjanju',
          })
        }

        // Premor 200ms med zahtevki (FURS rate limiting)
        if (unverifiedReceipts.indexOf(receipt) < unverifiedReceipts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      } catch (err) {
        failed++
        results.push({
          receiptId: receipt.id,
          receiptNumber: receipt.receiptNumber,
          success: false,
          error: err instanceof Error ? err.message : 'Neznana napaka',
        })
      }
    }

    // Revizijski dnevnik
    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'FURS_BATCH_VERIFY',
      entityType: 'Receipt',
      details: {
        totalProcessed: unverifiedReceipts.length,
        successful,
        failed,
        isSimulation: results.some(r => r.isSimulation),
      },
    })

    return NextResponse.json({
      success: true,
      processed: unverifiedReceipts.length,
      successful,
      failed,
      results,
      message: `Obdelano ${unverifiedReceipts.length} računov: ${successful} uspešnih, ${failed} neuspešnih`,
    })
  } catch (error) {
    console.error('FURS batch verification error:', error)
    return NextResponse.json({ error: 'Napaka pri množičnem overjanju računov' }, { status: 500 })
  }
}

// GET /api/furs/batch — Pridobi seznam neoverjenih računov
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const unverifiedCount = await db.receipt.count({
      where: {
        fiscalVerified: false,
        isStorno: false,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    })

    const oldestUnverified = await db.receipt.findFirst({
      where: {
        fiscalVerified: false,
        isStorno: false,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, receiptNumber: true },
    })

    return NextResponse.json({
      unverifiedCount,
      oldestUnverified: oldestUnverified ? {
        receiptNumber: oldestUnverified.receiptNumber,
        createdAt: oldestUnverified.createdAt.toISOString(),
      } : null,
    })
  } catch (error) {
    console.error('FURS batch status error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju statusa' }, { status: 500 })
  }
}
