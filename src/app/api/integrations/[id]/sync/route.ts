
// ============================================
// POST /api/integrations/[id]/sync — Sproži sinhronizacijo
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
// odstranjen prazen import (runda 12 lint cleanup)
import { requireAuth } from '@/lib/auth-middleware'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
// R93-b: enoten 429 helper (rate-limit/response.ts) — DIREKTEN import, ne barrel:
// testi mockajo '@/lib/rate-limit' z vi.hoisted, direkten path teče realen helper.
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { handleApiError } from '@/lib/api-utils'
import { syncEracuni, syncAccounting, syncGeneric, syncQuickBooks, syncXero } from './_helpers'
import { safeJsonSerialize } from '@/lib/json-fields'


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
    return rateLimitedResponse(rateCheck.retryAfterMs)
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

    // R150 (#33): config je JSONB struct — konektorji (legacy podpisi) še naprej
    // delajo z wire stringom; string passthrough, struct re-serializacija.
    const conn = {
      baseUrl: integration.baseUrl,
      apiKey: integration.apiKey,
      apiSecret: integration.apiSecret ?? undefined,
      config: typeof integration.config === 'string' ? integration.config : safeJsonSerialize(integration.config ?? {}),
    }

    const startTime = Date.now()
    let syncStatus = 'success'
    let syncError = ''
    let statusCode = 200
    let responseData: unknown = {}

    try {
      // Sinhronizacija glede na tip integracije
      if (integration.type === 'eracuni') {
        const result = await syncEracuni(conn)
        statusCode = result.statusCode
        responseData = result.responseData
        syncStatus = result.success ? 'success' : 'error'
        syncError = result.error
      } else if (integration.type === 'accounting') {
        // FIX FASE 2: QuickBooks + Xero imajo lastne sync helperje
        if (integration.provider === 'quickbooks') {
          const result = await syncQuickBooks(conn)
          statusCode = result.statusCode
          responseData = result.responseData
          syncStatus = result.success ? 'success' : 'error'
          syncError = result.error
        } else if (integration.provider === 'xero') {
          const result = await syncXero(conn)
          statusCode = result.statusCode
          responseData = result.responseData
          syncStatus = result.success ? 'success' : 'error'
          syncError = result.error
        } else {
          const result = await syncAccounting(conn)
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

    // R150 (#33): requestData/responseData sta zdaj JSONB (0022_json_fields) —
    // helperji vračajo serializiran JSON string (ali raw body) → normaliziraj
    // v NATIVNO vrednost (JSON.stringify bi tiho dvojno kodiral); ne-JSON
    // raw body ostane jsonb string scalar (debug info se ohrani).
    const normalizeJsonLogValue = (raw: unknown): Prisma.InputJsonValue => {
      if (typeof raw === 'string') {
        if (raw.trim() === '') return {}
        try { return JSON.parse(raw) as Prisma.InputJsonValue } catch { return raw }
      }
      if (raw !== null && typeof raw === 'object') return raw as Prisma.InputJsonValue
      return {}
    }

    // Zabeleži sinhronizacijo v log
    await db.integrationLog.create({
      data: {
        integrationId: id,
        action: 'sync',
        direction: 'outbound',
        status: syncStatus,
        statusCode,
        requestData: { triggered: 'manual' },
        responseData: normalizeJsonLogValue(responseData),
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
