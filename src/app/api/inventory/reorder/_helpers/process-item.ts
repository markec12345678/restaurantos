// Obdelava posameznega artikla za predloge naročanja zaloge

import { toNum, round2, greaterThan, multiply, abs } from '@/lib/decimal'
import { generateReorderReason } from './utils'
import type { ReorderSuggestion } from './types'

interface InventoryItem {
  id: string
  name: string
  unit: string
  supplier: string
  quantity: Parameters<typeof toNum>[0]
  minQuantity: Parameters<typeof toNum>[0]
  costPerUnit: Parameters<typeof toNum>[0]
  category: string
}

interface SalesTx {
  createdAt: Date
  quantity: Parameters<typeof toNum>[0]
}

export function processItemForSuggestion(
  item: InventoryItem,
  recentSales: SalesTx[],
  sevenDaysAgo: Date,
  avgDeliveryDays: number,
  urgency?: string,
  lastProcurementDate?: string | null,
): ReorderSuggestion | null {
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

  if (!needsReorder && riskLevel === 'low') return null
  if (urgency && riskLevel !== urgency) return null

  // Predlagana količina: pokrij 14 dni porabe ali dopolni do 2x minimalne zaloge
  const suggestedOrderQty = Math.max(
    Math.ceil(avgDailyConsumption * 14),
    Math.max(toNum(item.minQuantity) * 2 - toNum(item.quantity), 0),
    1
  )

  const reason = generateReorderReason(
    {
      daysUntilEmpty,
      currentStock: toNum(item.quantity),
      minStock: toNum(item.minQuantity),
      trend,
      seasonalityFactor: 1,
      riskLevel,
      needsReorder,
    } as Record<string, unknown>,
    item as unknown as Record<string, unknown>,
  )

  return {
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
    lastOrderDate: lastProcurementDate || null,
    avgDeliveryDays: avgDeliveryDays || 3,
    category: item.category,
  }
}
