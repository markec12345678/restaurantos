
// ============================================
// POST /api/integrations/[id]/sync — Sproži sinhronizacijo
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { syncEracuni, syncAccounting, syncGeneric, syncQuickBooks, syncXero } from './_helpers'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

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
