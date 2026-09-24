// FIX F4 MEDIUM: Deljena parseVatBreakdown — prejšnja koda je imela dvojnika v batch/route.ts

// ============================================
// FURS DAVČNO POTRJEVANJE (Fiscal Verification)
// Slovenski zakon ZDDV-1 — davčno overjanje računov
// Uporablja lib/furs.ts za ZOI, EOR, QR in certifikate
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { requireAuth } from '@/lib/auth-middleware'
import { resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { validateFursConfig, checkFursConnectivity } from '@/lib/furs'
import { buildFursConfigFromSettings } from './helpers/build-config'
import { verifyInvoice } from './helpers/verify-invoice'
import { stornoInvoice } from './helpers/storno-invoice'
import { logger } from '@/lib/logger'


// GET /api/furs — Preveri status FURS povezave
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = await checkRateLimitAsync('furs', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')

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

    // FIX P0-C3A: Pridobi FURS config vezan na session.locationId (ne globalno!)
    // Prej: buildFursConfigFromSettings(settings) je uporabil findFirst({isActive:true})
    // R86-2c2 (M2 klasa): resolver — non-admin seja z NULL lokacijo je prej
    // dobila globalni config fallback + count ne-overjenih računov VSEH
    // tenantov. Zdaj: 403 fail-closed. Super-admin (null) = globalni pogled;
    // config resolution NI preoblikovana (dual-config izključitev R77/P0-C3A).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'GET /api/furs',
    })
    if ('error' in scope) return scope.error

    const config = await buildFursConfigFromSettings(settings, scope.locationId)
    const validation = validateFursConfig(config)
    // R125 (issue #37): hasCert/environment iz Location configa — settings.furs*
    // polja so MRTVA (migration 0012_furs_location_only prenesla legacy na lokacije).
    const hasCert = !!(config.certPath && config.certPassword)
    const environment = config.environment || 'test'

    // Preveri povezljivost s FURS strežnikom
    const connectivity = await checkFursConnectivity(environment as 'test' | 'production')

    // FIX BUG-08 + FIX R80 (tenant scope): Opozorilo o ne-overjenih računih,
    // starejših od 1 uro — count je SCOPED na lokacijo seje (Receipt.locationId
    // NOT NULL); super-admin (locationId=null) vidi vse lokacije.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const unfiscalizedCount = await db.receipt.count({
      where: {
        fiscalVerified: false,
        isStorno: false,
        createdAt: { lt: oneHourAgo },
        ...(scope.locationId ? { locationId: scope.locationId } : {}),
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
      // v1.3.2: uradni endpoint (spec 6.1/8) — prej napačni /v1/cash_payments
      fursUrl: environment === 'test'
        ? 'https://blagajne-test.fu.gov.si:9002/v1/cash_registers/invoices'
        : 'https://blagajne.fu.gov.si:9003/v1/cash_registers/invoices',
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
  return verifyInvoice(req)
}

// PUT /api/furs — Storno račun
export async function PUT(req: Request) {
  return stornoInvoice(req)
}
