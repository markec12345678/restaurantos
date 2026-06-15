// Sinhronizacija z računovodstvom

import { toNum, round2 } from '@/lib/decimal'
import type { SyncResult } from './types'

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
