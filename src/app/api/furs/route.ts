// FIX F4 MEDIUM: Deljena parseVatBreakdown — prejšnja koda je imela dvojnika v batch/route.ts

// ============================================
// FURS DAVČNO POTRJEVANJE (Fiscal Verification)
// Slovenski zakon ZDDV-1 — davčno overjanje računov
// Uporablja lib/furs.ts za ZOI, EOR, QR in certifikate
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { checkRateLimit, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { validateFursConfig, checkFursConnectivity } from '@/lib/furs'
import { buildFursConfigFromSettings } from './helpers/build-config'
import { verifyInvoice } from './helpers/verify-invoice'
import { stornoInvoice } from './helpers/storno-invoice'
import { logger } from '@/lib/logger'


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
  return verifyInvoice(req)
}

// PUT /api/furs — Storno račun
export async function PUT(req: Request) {
  return stornoInvoice(req)
}
