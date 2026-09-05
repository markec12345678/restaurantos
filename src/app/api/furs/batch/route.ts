// FIX F4 MEDIUM: Deljena parseVatBreakdown iz furs/route.ts — prejšnja koda je imela dvojnika
// Če eno popravijo in druge ne, se bodo računi razlikovali med batch in single verify

// ============================================
// POST /api/furs/batch — Množična davčna overitev neoverjenih računov
// Poišče vse neoverjene račune in jih posreduje FURS
// ============================================

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
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

    // FIX P0-C3A: batch obdeluje račune iz VEČ lokacij — ne moremo uporabiti enega configa!
    // Prej: findFirst({isActive:true}) je vzel naključno lokacijo za vse račune.
    // Sedaj: za vsak račun pridobimo order.locationId in zgradimo config za to lokacijo.
    // Config + privateKey se cached-a per-locationId za performanco.

    // Pridobi in zakleni neoverjene račune
    const receiptIds = await fetchAndLockUnverifiedReceipts()

    // Pridobi podatke računov z order.locationId
    const unverifiedReceipts = receiptIds.length > 0
      ? await db.receipt.findMany({
          where: { id: { in: receiptIds } },
          orderBy: { createdAt: 'asc' },
          include: { order: { select: { locationId: true } } },
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

    // FIX P0-C3A: Cache config + privateKey per locationId
    const configCache = new Map<string, { config: ReturnType<typeof buildFursConfig>; privateKeyBuf?: Buffer; valid: boolean; error?: string }>()

    async function getConfigForLocation(locationId: string | null | undefined) {
      const key = locationId || '__no_location__'
      if (configCache.has(key)) return configCache.get(key)!

      // Pridobi Location podatke za to lokacijo
      let location: { premisesId: string; fursCertPath: string; fursCertPassword: string; fursEnvironment: string; businessId: string; taxId: string; registerNumber: string } | null = null
      if (locationId) {
        location = await db.location.findUnique({
          where: { id: locationId },
          select: { premisesId: true, fursCertPath: true, fursCertPassword: true, fursEnvironment: true, businessId: true, taxId: true, registerNumber: true },
        })
      }

      const premisesId = location?.premisesId || settings!.businessId || ''
      const config = buildFursConfig({
        businessId: location?.businessId || settings!.businessId,
        taxId: location?.taxId || settings!.taxId,
        registerNumber: location?.registerNumber || settings!.registerNumber,
        fursCertPath: location?.fursCertPath || settings!.fursCertPath,
        fursCertPassword: location?.fursCertPassword || settings!.fursCertPassword,
        fursEnvironment: location?.fursEnvironment || settings!.fursEnvironment,
        premisesId,
      })

      const validation = validateFursConfig(config)
      if (!validation.valid) {
        const entry = { config, privateKeyBuf: undefined as Buffer | undefined, valid: false, error: validation.errors.join(', ') }
        configCache.set(key, entry)
        return entry
      }

      const certPath = location?.fursCertPath || settings!.fursCertPath
      const certPassword = location?.fursCertPassword || settings!.fursCertPassword
      const privateKey = (certPath && certPassword)
        ? loadCertificatePrivateKey(certPath, certPassword)
        : undefined
      const privateKeyBuf = privateKey instanceof Buffer ? privateKey : undefined

      const entry = { config, privateKeyBuf, valid: true }
      configCache.set(key, entry)
      return entry
    }

    const results: BatchReceiptResult[] = []
    let successful = 0
    let failed = 0

    // Obdelaj račune zaporedno (FURS ima omejitev na hitrost zahtevkov)
    for (let i = 0; i < unverifiedReceipts.length; i++) {
      const receipt = unverifiedReceipts[i]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const receiptLocationId = (receipt as any).order?.locationId ?? null
      const cached = await getConfigForLocation(receiptLocationId)

      let result: BatchReceiptResult
      if (!cached.valid) {
        const errorMsg = 'error' in cached ? cached.error : 'neznana napaka'
        result = {
          success: false,
          receiptId: receipt.id,
          receiptNumber: receipt.receiptNumber,
          error: `FURS konfiguracija za lokacijo ${receiptLocationId || '(brez lokacije)'} ni veljavna: ${errorMsg}`,
          isSimulation: false,
        }
      } else {
        result = await processBatchReceipt(receipt, settings!, cached.config, cached.privateKeyBuf)
      }

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
