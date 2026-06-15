// Sinhronizacija z e-Računi

import { toNum } from '@/lib/decimal'
import type { IntegrationBase, SyncResult } from './types'

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
