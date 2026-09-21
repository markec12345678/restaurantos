// ============================================
// INTEGRACIJSKI SCHEDULER — Periodična sinhronizacija aktivnih integracij
// Pokliči iz cron job-a ali periodičnega fetch-a na klientu
// GET /api/integrations/scheduler — Obdelaj vse integracije, ki potrebujejo sync
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { requireAuth } from '@/lib/auth-middleware'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'

import { handleApiError } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  // R92-a: rate limit TAKOJ po requireAuth — samo avtenticirani klici trošijo
  // vedro (anonimni probe-i ne onesnažijo NAT vedra pisarne); fail-closed
  // (checkRateLimitAsync zavrača, če cache odpove — core.ts kanon).
  // Fiksni ključ 'integrations-scheduler': batch operacija čez VSE aktivne
  // integracije (outbound ping + log + update na vsako) — brez vedra bi jo
  // avtenticiran IP lahko prižgal v zanki (self-DoS na izhodni promet).
  const rateCheck = await checkRateLimitAsync('integrations-scheduler', getClientIp(req), AUTHENTICATED_LIMIT)
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
    const now = new Date()

    // Pridobi vse aktivne integracije z omogočeno sinhronizacijo
    const integrations = await db.integration.findMany({
      where: {
        isActive: true,
        syncEnabled: true,
        connectionStatus: { not: 'error' },
      },
    })

    const results: Array<{
      id: string
      name: string
      status: string
      durationMs: number
      error?: string
    }> = []

    for (const integration of integrations) {
      // Preveri, če je čas za sinhronizacijo
      const lastSync = integration.lastSyncAt
      const intervalMs = (integration.syncInterval || 300) * 1000
      const shouldSync = !lastSync || (now.getTime() - lastSync.getTime()) >= intervalMs

      if (!shouldSync) continue

      const startTime = Date.now()
      let syncStatus = 'success'
      let syncError = ''

      try {
        // Pošlji ping/healthcheck na integracijo
        if (integration.baseUrl) {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 15000)

          const response = await fetch(`${integration.baseUrl}/ping`, {
            method: 'GET',
            headers: integration.apiKey ? {
              'Authorization': `Bearer ${integration.apiKey}`,
            } : {},
            signal: controller.signal,
          })

          clearTimeout(timeoutId)

          if (!response.ok) {
            syncStatus = 'error'
            syncError = `HTTP ${response.status}`
          }
        }
      } catch (err: unknown) {
        syncStatus = 'error'
        syncError = err instanceof Error ? err.message : 'Napaka pri povezavi'
      }

      const durationMs = Date.now() - startTime

      // Zabeleži v log
      await db.integrationLog.create({
        data: {
          integrationId: integration.id,
          action: 'scheduled_sync',
          direction: 'outbound',
          status: syncStatus,
          statusCode: syncStatus === 'success' ? 200 : 0,
          requestData: JSON.stringify({ triggered: 'scheduler', interval: integration.syncInterval }),
          responseData: '{}',
          errorMessage: syncError,
          durationMs,
        },
      })

      // Posodobi integracijo
      await db.integration.update({
        where: { id: integration.id },
        data: {
          lastSyncAt: now,
          lastSyncStatus: syncStatus,
          lastSyncError: syncError,
          connectionStatus: syncStatus === 'success' ? 'connected' : 'error',
        },
      })

      results.push({
        id: integration.id,
        name: integration.name,
        status: syncStatus,
        durationMs,
        error: syncError || undefined,
      })
    }

    return NextResponse.json({
      processed: results.length,
      results,
      timestamp: now.toISOString(),
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/integrations/scheduler', 'Napaka pri sinhronizaciji')
  }
}
