// FIX F4 MEDIUM: Deljena parseVatBreakdown iz furs/route.ts — prejšnja koda je imela dvojnika
// Če eno popravijo in druge ne, se bodo računi razlikovali med batch in single verify

// ============================================
// POST /api/furs/batch — Množična davčna overitev neoverjenih računov
// Poišče vse neoverjene račune in jih posreduje FURS
// ============================================

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateFursConfig, loadCertificatePrivateKey } from '@/lib/furs'
import { handleApiError } from '@/lib/api-utils'
import { buildFursConfig, fetchAndLockUnverifiedReceipts, processBatchReceipt, type BatchReceiptResult } from './_helpers'


export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const settings = await db.restaurantSettings.findFirst({ where: { isActive: true } })
    if (!settings) {
      return NextResponse.json({ error: 'Ni nastavitev restavracije' }, { status: 400 })
    }

    // FIX F2 HIGH: Pridobi premisesId iz aktivne lokacije
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

    // Pridobi in zakleni neoverjene račune
    const receiptIds = await fetchAndLockUnverifiedReceipts()

    // Pridobi podatke računov
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
    const privateKeyBuf = privateKey instanceof Buffer ? privateKey : undefined

    const results: BatchReceiptResult[] = []
    let successful = 0
    let failed = 0

    // Obdelaj račune zaporedno (FURS ima omejitev na hitrost zahtevkov)
    for (let i = 0; i < unverifiedReceipts.length; i++) {
      const receipt = unverifiedReceipts[i]
      const result = await processBatchReceipt(receipt, settings, config, privateKeyBuf)

      if (result.success) {
        successful++
      } else {
        failed++
      }
      results.push(result)

      // Premor 200ms med zahtevki (FURS rate limiting)
      if (i < unverifiedReceipts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200))
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
