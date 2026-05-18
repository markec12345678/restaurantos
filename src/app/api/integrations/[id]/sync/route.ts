import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'

// ============================================
// POST /api/integrations/[id]/sync — Sproži sinhronizacijo
// ============================================

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
        // e-Računi: sinhroniziraj račune
        const result = await syncEracuni(integration)
        statusCode = result.statusCode
        responseData = result.responseData
        syncStatus = result.success ? 'success' : 'error'
        syncError = result.error
      } else if (integration.type === 'accounting') {
        // Računovodstvo: pošlji dnevne podatke
        const result = await syncAccounting(integration)
        statusCode = result.statusCode
        responseData = result.responseData
        syncStatus = result.success ? 'success' : 'error'
        syncError = result.error
      } else {
        // Splošna sinhronizacija — pošlji pending dogodke
        const result = await syncGeneric(integration)
        statusCode = result.statusCode
        responseData = result.responseData
        syncStatus = result.success ? 'success' : 'error'
        syncError = result.error
      }
    } catch (err) {
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
  } catch (error) {
    console.error('Failed to sync integration:', error)
    return NextResponse.json({ error: 'Napaka pri sinhronizaciji' }, { status: 500 })
  }
}

// ============================================
// SINHRONIZACIJSKI KONEKTORJI
// ============================================

async function syncEracuni(integration: {
  baseUrl: string
  apiKey: string
  apiSecret: string
  config: string
}): Promise<{ success: boolean; statusCode: number; responseData: string; error: string }> {
  const baseUrl = integration.baseUrl || 'https://www.e-racuni.com'
  const config = JSON.parse(integration.config || '{}')

  try {
    // Pridobi nepotrjene račune za sinhronizacijo
    const { db: dbClient } = await import('@/lib/db')
    const receipts = await dbClient.receipt.findMany({
      where: { fiscalVerified: true },
      take: 50,
      orderBy: { createdAt: 'desc' },
    })

    if (receipts.length === 0) {
      return { success: true, statusCode: 200, responseData: JSON.stringify({ synced: 0 }), error: '' }
    }

    // Pripravi podatke za e-Račune API
    const invoices = receipts.map(r => ({
      invoiceNumber: r.receiptNumber,
      date: r.createdAt,
      total: r.total,
      vat: r.totalVat,
      paymentMethod: r.paymentMethod,
      businessId: config.businessId || '',
    }))

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const response = await fetch(`${baseUrl}/api/v1/invoices/batch`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${integration.apiKey}`,
        'Content-Type': 'application/json',
        'X-API-Secret': integration.apiSecret,
      },
      body: JSON.stringify({ invoices, company_id: config.companyId }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const body = await response.text()
    return {
      success: response.ok,
      statusCode: response.status,
      responseData: body.substring(0, 2000),
      error: response.ok ? '' : `HTTP ${response.status}`,
    }
  } catch (err) {
    return {
      success: false,
      statusCode: 0,
      responseData: '{}',
      error: err instanceof Error ? err.message : 'Napaka pri sinhronizaciji e-Računi',
    }
  }
}

async function syncAccounting(integration: {
  baseUrl: string
  apiKey: string
  config: string
}): Promise<{ success: boolean; statusCode: number; responseData: string; error: string }> {
  const baseUrl = integration.baseUrl
  if (!baseUrl) {
    return { success: false, statusCode: 0, responseData: '{}', error: 'URL ni nastavljen' }
  }

  try {
    const config = JSON.parse(integration.config || '{}')

    // Pridobi dnevno poročilo
    const { db: dbClient } = await import('@/lib/db')
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayOrders = await dbClient.order.findMany({
      where: {
        paidAt: { gte: today },
        paymentStatus: 'paid',
      },
      include: { receipt: true },
    })

    const dailySummary = {
      date: today.toISOString().split('T')[0],
      totalSales: todayOrders.reduce((sum, o) => sum + o.total, 0),
      totalTax: todayOrders.reduce((sum, o) => sum + o.tax, 0),
      totalOrders: todayOrders.length,
      paymentMethods: todayOrders.reduce<Record<string, number>>((acc, o) => {
        acc[o.paymentMethod] = (acc[o.paymentMethod] || 0) + o.total
        return acc
      }, {}),
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const response = await fetch(`${baseUrl}/api/daily-report`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${integration.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...dailySummary, company_id: config.companyId }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const body = await response.text()
    return {
      success: response.ok,
      statusCode: response.status,
      responseData: body.substring(0, 2000),
      error: response.ok ? '' : `HTTP ${response.status}`,
    }
  } catch (err) {
    return {
      success: false,
      statusCode: 0,
      responseData: '{}',
      error: err instanceof Error ? err.message : 'Napaka pri sinhronizaciji računovodstva',
    }
  }
}

async function syncGeneric(integration: {
  baseUrl: string
  apiKey: string
}): Promise<{ success: boolean; statusCode: number; responseData: string; error: string }> {
  const baseUrl = integration.baseUrl
  if (!baseUrl) {
    return { success: false, statusCode: 0, responseData: '{}', error: 'URL ni nastavljen' }
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    const response = await fetch(`${baseUrl}/ping`, {
      method: 'GET',
      headers: integration.apiKey ? {
        'Authorization': `Bearer ${integration.apiKey}`,
      } : {},
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    return {
      success: response.ok,
      statusCode: response.status,
      responseData: JSON.stringify({ status: response.status }),
      error: response.ok ? '' : `HTTP ${response.status}`,
    }
  } catch (err) {
    return {
      success: false,
      statusCode: 0,
      responseData: '{}',
      error: err instanceof Error ? err.message : 'Napaka pri sinhronizaciji',
    }
  }
}
