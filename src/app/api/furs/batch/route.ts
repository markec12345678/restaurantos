// FIX F4 MEDIUM: Deljena parseVatBreakdown iz furs/route.ts — prejšnja koda je imela dvojnika
// Če eno popravijo in druge ne, se bodo računi razlikovali med batch in single verify

// ============================================
// POST /api/furs/batch — Množična davčna overitev neoverjenih računov
// Poišče vse neoverjene račune in jih posreduje FURS
// ============================================

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { requireAuth } from '@/lib/auth-middleware'
import { resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'
import { validateFursConfig, loadCertificatePrivateKey } from '@/lib/furs'
import { handleApiError } from '@/lib/api-utils'
import { buildFursConfig, fetchAndLockUnverifiedReceipts, processBatchReceipt, type BatchReceiptResult } from './_helpers'


export const dynamic = 'force-dynamic'

// R86-2c2: batch fiskalizacija je platform-level operacija (ZDDV-1 48h job —
// obdeluje neoverjene račune VSEH lokacij; config se rešuje per račun prek
// order.locationId, P0-C3A). Kanonični gate = mirror /api/receipts/regenerate,
// /api/webhooks/deliveries POST in /api/reports/digest-send: lokacijsko vezan
// admin ne sme sprožiti fiskalizacije TUJIH računov (cross-tenant fiskalni
// write); platformni admin (brez lokacije) — da.
function platformAdminGate(authResult: { session: { role: string; locationId?: string | null } | null }): NextResponse | null {
  const session = authResult.session
  const isPlatformAdmin = !!session && ['admin', 'super_admin'].includes(session.role) && !session.locationId
  if (isPlatformAdmin) return null
  return NextResponse.json(
    { error: 'Množična fiskalizacija je platformska operacija (vse lokacije) — dovoljeno samo platformnemu administratorju.' },
    { status: 403 },
  )
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    // R86-2c2: platformAdminGate TAKOJ za requireAuth, PRED settings/db dostopom
    const platformGate = platformAdminGate(authResult)
    if (platformGate) return platformGate

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

      // R125 (issue #37): FURS cert polja izključno iz Location — settings.furs*
      // fallback odstranjen (polja so MRTVA; migration 0012 prenesla vrednosti na
      // lokacije). Poslovna identiteta (businessId/taxId/registerNumber) sme še
      // vedno pasti na Settings (NI del duplikata).
      const premisesId = location?.premisesId || ''
      const config = buildFursConfig({
        businessId: location?.businessId || settings!.businessId,
        taxId: location?.taxId || settings!.taxId,
        registerNumber: location?.registerNumber || settings!.registerNumber,
        fursCertPath: location?.fursCertPath || '',
        fursCertPassword: location?.fursCertPassword || '',
        fursEnvironment: location?.fursEnvironment || '',
        premisesId,
      })

      const validation = validateFursConfig(config)
      if (!validation.valid) {
        const entry = { config, privateKeyBuf: undefined as Buffer | undefined, valid: false, error: validation.errors.join(', ') }
        configCache.set(key, entry)
        return entry
      }

      // R125 (issue #37): podpisni ključ izključno iz Location (settings.furs* MRTVA)
      const certPath = location?.fursCertPath || ''
      const certPassword = location?.fursCertPassword || ''
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

    // FIX R80 (tenant scope): GET status je SCOPED na lokacijo seje
    // (Receipt.locationId NOT NULL) — lokacijsko vezan admin ne vidi count-a
    // + receiptNumber tujih lokacij. Super-admin (locationId=null) vidi vse.
    // POST batch ostaja BY DESIGN multi-location (ZDDV-1 48h job čez vse
    // lokacije — config se rešuje per račun) in se NE dotikamo.
    // R86-2c2 (M2 klasa): resolver namesto raw spread — non-admin seja z NULL
    // lokacijo → 403 fail-closed (prej: globalni count + receiptNumber).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'GET /api/furs/batch',
    })
    if ('error' in scope) return scope.error
    const locFilter = scope.locationId ? { locationId: scope.locationId } : {}

    const unverifiedCount = await db.receipt.count({
      where: {
        fiscalVerified: false,
        isStorno: false,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        ...locFilter,
      },
    })

    const oldestUnverified = await db.receipt.findFirst({
      where: {
        fiscalVerified: false,
        isStorno: false,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        ...locFilter,
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
