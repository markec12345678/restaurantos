// ============================================
// AI PREDIKTIVNA ANALÍTIKA ZALOGE — Podatkovna logika
// Pridobivanje in obdelava podatkov za napovedi
// ============================================

import { db } from '@/lib/db'
import type { ForecastResult, ForecastSummary, ForecastData } from './types'
import { processInventoryItem } from './forecast-item'

// ─── Pridobivanje in obdelava podatkov ──────────────────────

export async function getForecastData(days: number, category: string): Promise<ForecastData> {
  // Pridobi vse artikle zaloge
  const whereClause: Record<string, unknown> = {}
  if (category) whereClause.category = category
  const inventoryItems = await db.inventoryItem.findMany({
    where: whereClause,
    include: {
      menuItem: { select: { name: true } },
    },
  })

  // Pridobi transakcije za zadnjih N dni
  const since = new Date()
  since.setDate(since.getDate() - days)

  // FIX MEDIUM: Batch query namesto N+1 — pridobi vse transakcije naenkrat
  const allItemIds = inventoryItems.map(item => item.id)
  const [allTransactions, allProcurements] = await Promise.all([
    db.stockTransaction.findMany({
      where: {
        inventoryItemId: { in: allItemIds },
        type: 'sale',
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'asc' },
    }),
    db.stockTransaction.findMany({
      where: {
        inventoryItemId: { in: allItemIds },
        type: 'procurement',
      },
      orderBy: { createdAt: 'desc' },
      distinct: ['inventoryItemId'],
      select: { inventoryItemId: true, quantity: true, createdAt: true },
    }),
  ])

  // Zgradi lookup mapi
  const txByItem = new Map<string, typeof allTransactions>()
  for (const tx of allTransactions) {
    if (!txByItem.has(tx.inventoryItemId)) txByItem.set(tx.inventoryItemId, [])
    txByItem.get(tx.inventoryItemId)!.push(tx)
  }
  const procByItem = new Map(allProcurements.map(p => [p.inventoryItemId, p]))

  const results: ForecastResult[] = []

  for (const item of inventoryItems) {
    const transactions = txByItem.get(item.id) || []
    const lastProcurement = procByItem.get(item.id)

    results.push(processInventoryItem(item, transactions, lastProcurement, since))
  }

  // Razvrsti po tveganju (critical first)
  const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  results.sort((a, b) => (riskOrder[a.riskLevel] || 3) - (riskOrder[b.riskLevel] || 3))

  // Povzetek
  const summary: ForecastSummary = {
    totalItems: results.length,
    criticalItems: results.filter(r => r.riskLevel === 'critical').length,
    highRiskItems: results.filter(r => r.riskLevel === 'high').length,
    needsReorderCount: results.filter(r => r.needsReorder).length,
    totalSuggestedOrderValue: 0, // Bi lahko izračunali s costPerUnit
    avgConfidence: results.length > 0
      ? Math.round((results.reduce((s, r) => s + r.confidence, 0) / results.length) * 100) / 100
      : 0,
  }

  return { summary, forecasts: results }
}
