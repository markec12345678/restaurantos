// ============================================
// PAMETNO NAROČANJE ZALOGE — Pridobivanje predlogov za GET
// ============================================

import { db } from '@/lib/db'
import { groupBy } from './utils'
import type { ReorderSuggestion, ReorderSummary, ReorderResult } from './types'
import { processItemForSuggestion } from './process-item'

export async function getReorderSuggestions(urgency: string): Promise<ReorderResult> {
  // Pridobi vse artikle za analizo
  const allItems = await db.inventoryItem.findMany({
    orderBy: { quantity: 'asc' },
  })

  // Pridobi zadnje transakcije za izračun povprečne porabe
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

  const suggestions: ReorderSuggestion[] = []

  // FIX MEDIUM: Batch query namesto N+1 — pridobi vse transakcije naenkrat
  const allItemIds = allItems.map(item => item.id)

  const [allSales, allProcurements, allDeliveryHistory] = await Promise.all([
    db.stockTransaction.findMany({
      where: {
        inventoryItemId: { in: allItemIds },
        type: 'sale',
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    db.stockTransaction.findMany({
      where: {
        inventoryItemId: { in: allItemIds },
        type: 'procurement',
      },
      orderBy: { createdAt: 'desc' },
      distinct: ['inventoryItemId'],
      select: { inventoryItemId: true, createdAt: true },
    }),
    db.stockTransaction.findMany({
      where: {
        inventoryItemId: { in: allItemIds },
        type: 'procurement',
        createdAt: { gte: ninetyDaysAgo },
      },
      orderBy: { createdAt: 'asc' },
      select: { inventoryItemId: true, createdAt: true },
    }),
  ])

  // Zgradi lookup mapi
  const salesByItem = new Map<string, typeof allSales>()
  for (const tx of allSales) {
    if (!salesByItem.has(tx.inventoryItemId)) salesByItem.set(tx.inventoryItemId, [])
    salesByItem.get(tx.inventoryItemId)!.push(tx)
  }
  const lastProcByItem = new Map(allProcurements.map(p => [p.inventoryItemId, p]))

  // Izračunaj povprečni čas dobave iz zgodovine procurementov
  const avgDeliveryDaysByItem = new Map<string, number>()
  const procsByItem = new Map<string, typeof allDeliveryHistory>()
  for (const proc of allDeliveryHistory) {
    if (!procsByItem.has(proc.inventoryItemId)) procsByItem.set(proc.inventoryItemId, [])
    procsByItem.get(proc.inventoryItemId)!.push(proc)
  }
  for (const [itemId, procs] of procsByItem) {
    if (procs.length >= 2) {
      let totalDays = 0
      let intervals = 0
      for (let i = 1; i < procs.length; i++) {
        const diff = (new Date(procs[i].createdAt).getTime() - new Date(procs[i - 1].createdAt).getTime()) / (1000 * 60 * 60 * 24)
        if (diff > 0 && diff < 90) {
          totalDays += diff
          intervals++
        }
      }
      if (intervals > 0) avgDeliveryDaysByItem.set(itemId, Math.round(totalDays / intervals))
    }
  }

  // Izračunaj predloge za vsak artikel
  for (const item of allItems) {
    const recentSales = salesByItem.get(item.id) || []
    const avgDeliveryDays = avgDeliveryDaysByItem.get(item.id) || 3
    const lastProcDate = lastProcByItem.get(item.id)?.createdAt?.toISOString() || null

    const suggestion = processItemForSuggestion(
      item,
      recentSales,
      sevenDaysAgo,
      avgDeliveryDays,
      urgency,
      lastProcDate,
    )

    if (suggestion) {
      suggestions.push(suggestion)
    }
  }

  // Razvrsti po nujnosti
  const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  suggestions.sort((a, b) => (urgencyOrder[a.urgency] || 3) - (urgencyOrder[b.urgency] || 3))

  // Povzetek
  const summary: ReorderSummary = {
    totalSuggestions: suggestions.length,
    totalEstimatedCost: Math.round(suggestions.reduce((s, r) => s + r.totalCost, 0) * 100) / 100,
    criticalCount: suggestions.filter(s => s.urgency === 'critical').length,
    highCount: suggestions.filter(s => s.urgency === 'high').length,
    bySupplier: groupBy(suggestions, 'supplier'),
    byCategory: groupBy(suggestions, 'category'),
  }

  return { summary, suggestions }
}
