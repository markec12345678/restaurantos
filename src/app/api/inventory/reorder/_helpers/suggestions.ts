// ============================================
// PAMETNO NAROČANJE ZALOGE — Pridobivanje predlogov za GET
// ============================================

import { db } from '@/lib/db'
import { toNum, round2, greaterThan, multiply, abs } from '@/lib/decimal'
import { generateReorderReason, groupBy } from './utils'
import type { ReorderSuggestion, ReorderSummary, ReorderResult } from './types'

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
    // Vsi procuremente za izračun povprečnega časa dobave
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
        if (diff > 0 && diff < 90) { // Ignoriraj anomalije
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

    const last7DaysSales = recentSales.filter(t => new Date(t.createdAt) >= sevenDaysAgo)
    const totalSold7d = last7DaysSales.reduce((s, t) => s + toNum(abs(t.quantity)), 0)
    const totalSold30d = recentSales.reduce((s, t) => s + toNum(abs(t.quantity)), 0)

    const avgDailyConsumption = totalSold30d > 0 ? totalSold30d / 30 : 0
    const recentDailyConsumption = totalSold7d > 0 ? totalSold7d / 7 : 0

    // Trend: ali poraba narašča?
    const trend = recentDailyConsumption > avgDailyConsumption * 1.2 ? 'increasing' :
                  recentDailyConsumption < avgDailyConsumption * 0.5 ? 'decreasing' : 'stable'

    const isLowStock = !greaterThan(item.quantity, item.minQuantity)
    const daysUntilEmpty = avgDailyConsumption > 0 ? Math.floor(toNum(item.quantity) / avgDailyConsumption) : 999

    // Določi nujnost
    let riskLevel: 'critical' | 'high' | 'medium' | 'low' = 'low'
    if (toNum(item.quantity) <= 0 || daysUntilEmpty <= 1) riskLevel = 'critical'
    else if (isLowStock || daysUntilEmpty <= 3) riskLevel = 'high'
    else if (daysUntilEmpty <= 7 || trend === 'increasing') riskLevel = 'medium'

    const needsReorder = isLowStock || daysUntilEmpty <= 7 || riskLevel !== 'low'

    if (!needsReorder && riskLevel === 'low') continue
    if (urgency && riskLevel !== urgency) continue

    // Predlagana količina: pokrij 14 dni porabe ali dopolni do 2x minimalne zaloge
    const suggestedOrderQty = Math.max(
      Math.ceil(avgDailyConsumption * 14),
      Math.max(toNum(item.minQuantity) * 2 - toNum(item.quantity), 0),
      1
    )

    const reason = generateReorderReason({
      daysUntilEmpty,
      currentStock: toNum(item.quantity),
      minStock: toNum(item.minQuantity),
      trend,
      seasonalityFactor: 1,
      riskLevel,
      needsReorder,
    }, item)

    // Pridobi zadnji datum dobave (iz batch lookup mape)
    const lastProcurement = lastProcByItem.get(item.id)

    suggestions.push({
      inventoryItemId: item.id,
      itemName: item.name,
      unit: item.unit,
      supplier: item.supplier,
      currentStock: toNum(item.quantity),
      suggestedQty: suggestedOrderQty,
      costPerUnit: toNum(item.costPerUnit),
      totalCost: round2(multiply(suggestedOrderQty, item.costPerUnit)),
      urgency: riskLevel as ReorderSuggestion['urgency'],
      reason,
      lastOrderDate: lastProcurement?.createdAt?.toISOString() || null,
      avgDeliveryDays: avgDeliveryDaysByItem.get(item.id) || 3,
      category: item.category,
    })
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
