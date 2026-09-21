
// ============================================
// POST /api/integrations/[id]/sync — Sproži sinhronizacijo
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { requireAuth } from '@/lib/auth-middleware'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/api-utils'
import { syncEracuni, syncAccounting, syncGeneric, syncQuickBooks, syncXero } from './_helpers'


export const dynamic = 'force-dynamic'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  // R92-a: rate limit TAKOJ po requireAuth — samo avtenticirani klici trošijo
  // vedro (anonimni probe-i ne onesnažijo NAT vedra pisarne); fail-closed
  // (checkRateLimitAsync zavrača, če cache odpove — core.ts kanon).
  // Fiksni ključ 'integrations-sync' (NE iz pathname): en IP ne more fan-out
  // prek različnih integrationId-jev. Drag ZUNANJNJI sync (outbound fetch
  // integracij) — brez vedra bi en avtenticiran IP lahko povzročil fan-out
  // sinhronizacij čez poljubne integrationId-je.
  const rateCheck = await checkRateLimitAsync('integrations-sync', getClientIp(req), AUTHENTICATED_LIMIT)
  if (!rateCheck.allowed) {
    // 429 oblika = hišni kanon (withRateLimit HOF): Retry-After / X-RateLimit-*
    // glave, fallback 60 s, ko odgovor ne nosi retryAfterMs.
    const retryAfter = Math.ceil((rateCheck.retryAfterMs ?? 60000) / 1000)
    return NextResponse.json(
      { error: 'Preveč zahtev. Poskusite znova čez nekaj časa.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + retryAfter),
        },
      }
    )
  }

  try {
    const { id } = await params

    const integration = await db.integration.findUnique({ where: { id } })
    if (!integration) {
      return NextResponse.json({ error: 'Integracija ni najdena' }, { status: 404 })
    }

    if (!integration.syncEnabled) {
      return NextResponse.json({ error: 'Sinhronizacija je onemogočena' }, { status: 400 })
    }

    const startTime = Date.now()
    let syncStatus = 'success'
    let syncError = ''
    let statusCode = 200
    let responseData = '{}'

    try {
      // Sinhronizacija glede na tip integracije
      if (integration.type === 'eracuni') {
        const result = await syncEracuni(integration)
        statusCode = result.statusCode
        responseData = result.responseData
        syncStatus = result.success ? 'success' : 'error'
        syncError = result.error
      } else if (integration.type === 'accounting') {
        // FIX FASE 2: QuickBooks + Xero imajo lastne sync helperje
        if (integration.provider === 'quickbooks') {
          const result = await syncQuickBooks(integration)
          statusCode = result.statusCode
          responseData = result.responseData
          syncStatus = result.success ? 'success' : 'error'
          syncError = result.error
        } else if (integration.provider === 'xero') {
          const result = await syncXero(integration)
          statusCode = result.statusCode
          responseData = result.responseData
          syncStatus = result.success ? 'success' : 'error'
          syncError = result.error
        } else {
          const result = await syncAccounting(integration)
          statusCode = result.statusCode
          responseData = result.responseData
          syncStatus = result.success ? 'success' : 'error'
          syncError = result.error
        }
      } else {
        const result = await syncGeneric(integration)
        statusCode = result.statusCode
        responseData = result.responseData
        syncStatus = result.success ? 'success' : 'error'
        syncError = result.error
      }
    } catch (err: unknown) {
      syncStatus = 'error'
      syncError = err instanceof Error ? err.message : 'Napaka pri sinhronizaciji'
    }

    const durationMs = Date.now() - startTime

    // Zabeleži sinhronizacijo v log
    await db.integrationLog.create({
      data: {
        integrationId: id,
        action: 'sync',
        direction: 'outbound',
        status: syncStatus,
        statusCode,
        requestData: JSON.stringify({ triggered: 'manual' }),
        responseData,
        errorMessage: syncError,
        durationMs,
      },
    })

    // Posodobi status sinhronizacije
    await db.integration.update({
      where: { id },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: syncStatus,
        lastSyncError: syncError,
        connectionStatus: syncStatus === 'success' ? 'connected' : 'error',
      },
    })

    return NextResponse.json({
      status: syncStatus,
      durationMs,
      error: syncError || undefined,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/integrations/[id]/sync', 'Napaka pri sinhronizaciji')
  }
}
