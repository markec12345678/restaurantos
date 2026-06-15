// Pomožne funkcije za sinhronizacijo integracij
// POST /api/integrations/[id]/sync — pomožni modul

import { toNum, round2 } from '@/lib/decimal'

// ─── Tipi ────────────────────────────────────────────────────

export interface IntegrationBase {
  baseUrl: string
  apiKey: string
  apiSecret?: string
  config: string
}

export interface SyncResult {
  success: boolean
  statusCode: number
  responseData: string
  error: string
}

// ─── Sinhronizacijski konektorji ──────────────────────────────

export async function syncEracuni(integration: IntegrationBase): Promise<SyncResult> {
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
      total: toNum(r.total),
      vat: toNum(r.totalVat),
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
        'X-API-Secret': integration.apiSecret || '',
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
  } catch (err: unknown) {
    return {
      success: false,
      statusCode: 0,
      responseData: '{}',
      error: err instanceof Error ? err.message : 'Napaka pri sinhronizaciji e-Računi',
    }
  }
}

export async function syncAccounting(integration: {
  baseUrl: string
  apiKey: string
  config: string
}): Promise<SyncResult> {
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
      totalSales: round2(todayOrders.reduce((sum, o) => sum + toNum(o.total), 0)),
      totalTax: round2(todayOrders.reduce((sum, o) => sum + toNum(o.tax), 0)),
      totalOrders: todayOrders.length,
      paymentMethods: todayOrders.reduce<Record<string, number>>((acc, o) => {
        acc[o.paymentMethod] = (acc[o.paymentMethod] || 0) + toNum(o.total)
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
  } catch (err: unknown) {
    return {
      success: false,
      statusCode: 0,
      responseData: '{}',
      error: err instanceof Error ? err.message : 'Napaka pri sinhronizaciji računovodstva',
    }
  }
}

export async function syncGeneric(integration: {
  baseUrl: string
  apiKey: string
}): Promise<SyncResult> {
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
  } catch (err: unknown) {
    return {
      success: false,
      statusCode: 0,
      responseData: '{}',
      error: err instanceof Error ? err.message : 'Napaka pri sinhronizaciji',
    }
  }
}
