// FIX F4 MEDIUM: Deljena parseVatBreakdown iz furs/route.ts — prejšnja koda je imela dvojnika
// Če eno popravijo in druge ne, se bodo računi razlikovali med batch in single verify

// ============================================
// POST /api/furs/batch — Množična davčna overitev neoverjenih računov
// Poišče vse neoverjene račune in jih posreduje FURS
// ============================================

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { toNum } from '@/lib/decimal'
import { generateZOI, verifyInvoiceWithFURS, validateFursConfig, loadCertificatePrivateKey, type FursConfig, type FursInvoiceData,  } from '@/lib/furs'
import { parseVatBreakdown } from '../shared'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/api-utils'

function buildFursConfig(settings: {
  businessId: string
  taxId: string
  registerNumber: string
  fursCertPath: string
  fursCertPassword: string
  fursEnvironment: string
  premisesId?: string
}): FursConfig {
  return {
    businessId: settings.businessId || '',
    taxId: settings.taxId || '',
    registerId: settings.registerNumber || 'BLG-001',
    // FIX FURS-02 HIGH: premisesId MORA biti ID poslovnega prostora, NE matična številka
    // Location.premisesId je registriran pri FURS — uporabimo ga če je na voljo
    premisesId: settings.premisesId || settings.businessId || '',
    deviceIp: '',
    environment: (settings.fursEnvironment === 'production' ? 'production' : 'test') as FursConfig['environment'],
    certPath: settings.fursCertPath || undefined,
    certPassword: settings.fursCertPassword || undefined,
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

    // FIX F2 HIGH: Pridobi premisesId iz aktivne lokacije — enako kot v furs/route.ts
    // Prejšnja koda je uporabila settings.businessId kar je NAPAKA za FURS
    let premisesId = settings.businessId || ''
    try {
      const activeLocation = await db.location.findFirst({ where: { isActive: true } })
      if (activeLocation?.premisesId) {
        premisesId = activeLocation.premisesId
      }
    } catch {
      // Location model morda ne obstaja — uporabi businessId
    }

    const config = buildFursConfig({ ...settings, premisesId })
    const validation = validateFursConfig(config)
    if (!validation.valid) {
      return NextResponse.json({ error: 'FURS konfiguracija ni veljavna', errors: validation.errors }, { status: 400 })
    }

    // Poišči vse neoverjene račune (max 50 naenkrat)
    // FIX BUG8: Mark receipts as "processing" first to prevent concurrent batch requests
    // from picking up the same receipts. Use a transaction to atomically select-and-lock.
    const receiptIds = await db.$transaction(async (tx) => {
      const receipts = await tx.receipt.findMany({
        where: {
          fiscalVerified: false,
          fiscalStatus: { not: 'processing' }, // Skip already-processing receipts
          isStorno: false,
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Zadnjih 30 dni
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
        select: { id: true },
      })

      if (receipts.length > 0) {
        // Mark as processing so concurrent requests skip them
        await tx.receipt.updateMany({
          where: { id: { in: receipts.map(r => r.id) } },
          data: { fiscalStatus: 'processing' },
        })
      }

      return receipts.map(r => r.id)
    })

    // Now fetch the full receipt data (outside the short transaction)
    const unverifiedReceipts = receiptIds.length > 0
      ? await db.receipt.findMany({
          where: { id: { in: receiptIds } },
          orderBy: { createdAt: 'asc' },
        })
      : []

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
    for (let i = 0; i < unverifiedReceipts.length; i++) {
      const receipt = unverifiedReceipts[i]
      try {
        // Generiraj ZOI
        // FIX F1 CRITICAL: Podaj environment — prejšnja koda je imela nedefinirano spremenljivko
        // FIX F2 HIGH: Uporabi config.premisesId (iz Location) namesto settings.businessId
        const zoi = generateZOI({
          taxId: settings.taxId,
          invoiceNumber: receipt.receiptNumber,
          issueDateTime: receipt.createdAt,
          totalAmount: toNum(receipt.total),
          premisesId: config.premisesId, // FIX F2: Pravilen premisesId iz Location
          registerId: settings.registerNumber,
          environment: config.environment, // FIX F1: Podaj environment za pravilen fallback
        }, privateKey || undefined)

        // Pripravi podatke za FURS
        const vatBreakdown = parseVatBreakdown(receipt.vatBreakdown as string, toNum(receipt.total), 22)

        const invoiceData: FursInvoiceData = {
          invoiceNumber: receipt.receiptNumber,
          issueDateTime: receipt.createdAt,
          totalAmount: toNum(receipt.total),
          paymentMethod: (receipt.paymentMethod === 'cash' ? 'cash' :
                          receipt.paymentMethod === 'card' ? 'card' :
                          receipt.paymentMethod === 'mobile' ? 'mobile' : 'other') as FursInvoiceData['paymentMethod'],
          vatBreakdown,
        }

        // Pošlji na FURS
        const result = await verifyInvoiceWithFURS(config, invoiceData, zoi)

        if (result.success) {
          // Shrani overitev
          // FIX MEDIUM: Dodaj fiscalStatus: 'verified' — brez tega je polje null v batch obdelavi
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
          // FIX BUG8: Reset fiscalStatus from 'processing' back to 'pending' so receipt can be retried
          await db.receipt.update({
            where: { id: receipt.id },
            data: { fiscalStatus: 'pending' },
          })
          failed++
          results.push({
            receiptId: receipt.id,
            receiptNumber: receipt.receiptNumber,
            success: false,
            error: result.error || 'Napaka pri overjanju',
          })
        }

        // Premor 200ms med zahtevki (FURS rate limiting) — samo če ni zadnji
        if (i < unverifiedReceipts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      } catch (err: unknown) {
        // FIX BUG8: Reset fiscalStatus from 'processing' back to 'pending' so receipt can be retried
        try {
          await db.receipt.update({
            where: { id: receipt.id },
            data: { fiscalStatus: 'pending' },
          })
        } catch { /* ignore reset failure */ }
        // FIX SECURITY: Do not expose raw error messages to client — could leak
        // FURS API details, certificate paths, or connection errors.
        // Log detailed error server-side only.
        logger.error('API', `FURS batch error for receipt ${receipt.receiptNumber}:`, err)
        failed++
        results.push({
          receiptId: receipt.id,
          receiptNumber: receipt.receiptNumber,
          success: false,
          error: 'Napaka pri overjanju računa',
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
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/furs/batch', 'Napaka pri množičnem overjanju računov')
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
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/furs/batch', 'Napaka pri pridobivanju statusa')
  }
}
