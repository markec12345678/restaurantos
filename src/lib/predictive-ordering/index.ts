// ============================================
// PREDICTIVE ORDERING ENGINE
// ============================================
// AI-assisted avtomatska naročila zaloga glede na:
//   1. Zgodovinsko porabo (StockTransaction zgodovina)
//   2. Day-of-week vzorce (vikend ima večjo porabo)
//   3. Lead time dobaviteljev (koliko dni traja dostava)
//   4. Trenutno zalogo (vključno z already-naročenim)
//   5. Reorder rules (trigger type, threshold, order quantity)
//
// Rezultat: seznam artiklov, ki jih je treba naročiti v naslednjih 24h.
// ============================================

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { toNum, round2 } from '@/lib/decimal'

// --- Tipi ---
export type TriggerType = 'min_qty' | 'forecast_7d' | 'forecast_14d' | 'manual'

export interface ReorderRecommendation {
  inventoryItemId: string
  itemName: string
  currentQty: number
  unit: string
  // --- Forecast ---
  avgDailyConsumption: number
  forecastedConsumption7d: number
  forecastedConsumption14d: number
  daysUntilEmpty: number // brez naročila
  // --- Recommendation ---
  recommendedQty: number
  triggerType: TriggerType
  triggerReason: string
  // --- Cost ---
  estimatedCost: number
  // --- Supplier ---
  preferredSupplierId?: string
  supplierName?: string
  leadTimeDays: number
  // --- Urgency ---
  urgency: 'low' | 'medium' | 'high' | 'critical'
  // --- Existing PO ---
  hasPendingOrder: boolean
}

export interface PredictiveOrderingResult {
  recommendations: ReorderRecommendation[]
  summary: {
    totalItems: number
    totalEstimatedCost: number
    criticalItems: number
    highItems: number
    mediumItems: number
    lowItems: number
    itemsWithPendingOrders: number
  }
  generatedAt: string
}

// --- Konstante ---
const HISTORY_DAYS = 90 // 3 meseci zgodovine za forecast
const MIN_DATA_DAYS = 7 // Najmanj 7 dni podatkov za smiseln forecast
const SAFETY_STOCK_DAYS = 2 // 2 dni varnostne zaloge

// --- Glavne funkcije ---

// 1. Izračunaj povprečno dnevno porabo za artikel
export async function calculateAvgDailyConsumption(
  inventoryItemId: string,
  historyDays = HISTORY_DAYS,
): Promise<number> {
  const since = new Date()
  since.setDate(since.getDate() - historyDays)

  const transactions = await db.stockTransaction.findMany({
    where: {
      inventoryItemId,
      type: 'sale', // samo prodaja = poraba
      createdAt: { gte: since },
    },
    select: { quantity: true },
  })

  if (transactions.length === 0) return 0

  const totalConsumed = transactions.reduce((sum, t) => sum + Math.abs(toNum(t.quantity)), 0)
  return round2(totalConsumed / historyDays)
}

// 2. Forecast za naslednjih N dni (z day-of-week prilagoditvami)
export async function forecastConsumption(
  inventoryItemId: string,
  days: number,
): Promise<{ forecast: number; confidence: 'low' | 'medium' | 'high' }> {
  const since = new Date()
  since.setDate(since.getDate() - HISTORY_DAYS)

  const transactions = await db.stockTransaction.findMany({
    where: {
      inventoryItemId,
      type: 'sale',
      createdAt: { gte: since },
    },
    select: { quantity: true, createdAt: true },
  })

  if (transactions.length === 0) {
    return { forecast: 0, confidence: 'low' }
  }

  // Agregiraj po dnevih v tednu
  const dayOfWeekConsumption: number[] = Array(7).fill(0)
  const dayOfWeekCounts: number[] = Array(7).fill(0)

  for (const t of transactions) {
    const dow = new Date(t.createdAt).getDay()
    dayOfWeekConsumption[dow] += Math.abs(toNum(t.quantity))
    dayOfWeekCounts[dow]++
  }

  // Povprečje po dnevih v tednu
  const dayOfWeekAvg = dayOfWeekConsumption.map((total, i) =>
    dayOfWeekCounts[i] > 0 ? total / dayOfWeekCounts[i] : 0,
  )

  // Generiraj forecast za naslednjih N dni
  let forecast = 0
  const today = new Date()
  for (let i = 0; i < days; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)
    forecast += dayOfWeekAvg[date.getDay()]
  }

  // Confidence: koliko dni v tednu ima vsaj 1 transakcijo
  const activeDays = dayOfWeekCounts.filter((c) => c > 0).length
  const confidence: 'low' | 'medium' | 'high' =
    activeDays >= 6 ? 'high' : activeDays >= 4 ? 'medium' : 'low'

  return { forecast: round2(forecast), confidence }
}

// 3. Izračunaj dni do izpraznitve
export function calculateDaysUntilEmpty(
  currentQty: number,
  avgDailyConsumption: number,
): number {
  if (avgDailyConsumption <= 0) return Infinity
  return Math.floor(currentQty / avgDailyConsumption)
}

// 4. Generiraj priporočila za naročilo
export async function generateReorderRecommendations(): Promise<PredictiveOrderingResult> {
  // Pridobi vse aktivne reorder rules z inventory itemi
  const rules = await db.reorderRule.findMany({
    where: { isActive: true },
    include: {
      inventoryItem: {
        select: {
          id: true,
          name: true,
          quantity: true,
          unit: true,
          minQuantity: true,
          costPerUnit: true,
          supplier: true,
        },
      },
    },
  })

  // Pridobi tudi artikle brez rule-a ampak z minQuantity < quantity
  const lowStockItems = await db.inventoryItem.findMany({
    where: {
      quantity: { lte: db.inventoryItem.fields.minQuantity },
      reorderRule: null,
    },
    select: {
      id: true,
      name: true,
      quantity: true,
      unit: true,
      minQuantity: true,
      costPerUnit: true,
      supplier: true,
    },
  })

  const recommendations: ReorderRecommendation[] = []

  // Obdelaj reorder rules
  for (const rule of rules) {
    const item = rule.inventoryItem
    const currentQty = toNum(item.quantity)
    const avgDaily = await calculateAvgDailyConsumption(item.id)
    const daysUntilEmpty = calculateDaysUntilEmpty(currentQty, avgDaily)

    const forecast7d = await forecastConsumption(item.id, 7)
    const forecast14d = await forecastConsumption(item.id, 14)

    // Preveri ali trigger pozene
    let shouldTrigger = false
    let triggerReason = ''
    let urgency: ReorderRecommendation['urgency'] = 'low'

    if (rule.triggerType === 'min_qty') {
      if (currentQty <= toNum(rule.triggerThreshold)) {
        shouldTrigger = true
        triggerReason = `Zaloga ${currentQty} ≤ threshold ${toNum(rule.triggerThreshold)}`
        urgency = currentQty <= 0 ? 'critical' : currentQty <= toNum(item.minQuantity) / 2 ? 'high' : 'medium'
      }
    } else if (rule.triggerType === 'forecast_7d') {
      // Trigger če forecast za 7 dni preseže trenutno zalogo + safety stock
      const safetyStock = avgDaily * SAFETY_STOCK_DAYS
      const neededQty = forecast7d.forecast + safetyStock
      if (currentQty < neededQty) {
        shouldTrigger = true
        triggerReason = `Forecast 7d (${forecast7d.forecast}) + safety (${safetyStock.toFixed(1)}) > zaloga (${currentQty})`
        urgency = daysUntilEmpty <= rule.leadTimeDays ? 'critical' : daysUntilEmpty <= 7 ? 'high' : 'medium'
      }
    } else if (rule.triggerType === 'forecast_14d') {
      const neededQty = forecast14d.forecast + avgDaily * SAFETY_STOCK_DAYS
      if (currentQty < neededQty) {
        shouldTrigger = true
        triggerReason = `Forecast 14d (${forecast14d.forecast}) > zaloga + safety`
        urgency = daysUntilEmpty <= rule.leadTimeDays ? 'critical' : daysUntilEmpty <= 14 ? 'high' : 'low'
      }
    }

    if (!shouldTrigger) continue

    // Preveri pending PO
    const pendingPO = await db.purchaseOrderItem.findFirst({
      where: {
        inventoryItemId: item.id,
        purchaseOrder: { status: { in: ['draft', 'sent', 'confirmed'] } },
      },
      include: { purchaseOrder: { select: { poNumber: true } } },
    })

    // Priporočena količina
    let recommendedQty = toNum(rule.orderQuantity)
    if (rule.triggerType !== 'min_qty' && avgDaily > 0) {
      // Za forecast-based: naroči za 14 dni - trenutna zaloga
      recommendedQty = Math.max(
        toNum(rule.orderQuantity),
        Math.ceil((forecast14d.forecast + avgDaily * SAFETY_STOCK_DAYS - currentQty) * 10) / 10,
      )
    }

    recommendations.push({
      inventoryItemId: item.id,
      itemName: item.name,
      currentQty,
      unit: item.unit,
      avgDailyConsumption: avgDaily,
      forecastedConsumption7d: forecast7d.forecast,
      forecastedConsumption14d: forecast14d.forecast,
      daysUntilEmpty,
      recommendedQty,
      triggerType: rule.triggerType as TriggerType,
      triggerReason,
      estimatedCost: round2(recommendedQty * toNum(item.costPerUnit)),
      preferredSupplierId: rule.preferredSupplierId || undefined,
      supplierName: item.supplier || undefined,
      leadTimeDays: rule.leadTimeDays,
      urgency,
      hasPendingOrder: !!pendingPO,
    })
  }

  // Obdelaj low-stock artikle brez rule-a (auto-detection)
  for (const item of lowStockItems) {
    const currentQty = toNum(item.quantity)
    const minQty = toNum(item.minQuantity)

    // Preveri pending PO
    const pendingPO = await db.purchaseOrderItem.findFirst({
      where: {
        inventoryItemId: item.id,
        purchaseOrder: { status: { in: ['draft', 'sent', 'confirmed'] } },
      },
    })
    if (pendingPO) continue // že naročeno

    const avgDaily = await calculateAvgDailyConsumption(item.id)
    const daysUntilEmpty = calculateDaysUntilEmpty(currentQty, avgDaily)

    // Priporoči 2x minQuantity
    const recommendedQty = Math.max(minQty * 2 - currentQty, minQty)

    recommendations.push({
      inventoryItemId: item.id,
      itemName: item.name,
      currentQty,
      unit: item.unit,
      avgDailyConsumption: avgDaily,
      forecastedConsumption7d: avgDaily * 7,
      forecastedConsumption14d: avgDaily * 14,
      daysUntilEmpty,
      recommendedQty,
      triggerType: 'min_qty',
      triggerReason: `Avtomatska detekcija: zaloga ≤ min (${minQty})`,
      estimatedCost: round2(recommendedQty * toNum(item.costPerUnit)),
      supplierName: item.supplier || undefined,
      leadTimeDays: 2,
      urgency: currentQty <= 0 ? 'critical' : currentQty <= minQty / 2 ? 'high' : 'medium',
      hasPendingOrder: false,
    })
  }

  // Sortiraj po urgency
  const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  recommendations.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])

  // Summary
  const summary = {
    totalItems: recommendations.length,
    totalEstimatedCost: round2(recommendations.reduce((sum, r) => sum + r.estimatedCost, 0)),
    criticalItems: recommendations.filter((r) => r.urgency === 'critical').length,
    highItems: recommendations.filter((r) => r.urgency === 'high').length,
    mediumItems: recommendations.filter((r) => r.urgency === 'medium').length,
    lowItems: recommendations.filter((r) => r.urgency === 'low').length,
    itemsWithPendingOrders: recommendations.filter((r) => r.hasPendingOrder).length,
  }

  logger.info('PredictiveOrdering', `Generated ${recommendations.length} recommendations (${summary.criticalItems} critical, ${summary.highItems} high)`)

  return {
    recommendations,
    summary,
    generatedAt: new Date().toISOString(),
  }
}

// 5. Kreiraj Purchase Order iz priporočil
export async function createPurchaseOrderFromRecommendations(
  recommendations: ReorderRecommendation[],
  supplierId: string,
  locationId?: string,
  createdBy?: string,
): Promise<{ poNumber: string; totalAmount: number; itemCount: number }> {
  // Pridobi naslednji PO number
  const lastPO = await db.purchaseOrder.findFirst({
    orderBy: { poNumber: 'desc' },
    select: { poNumber: true },
  })

  let nextNumber = 1
  if (lastPO && lastPO.poNumber) {
    const match = lastPO.poNumber.match(/(\d+)$/)
    if (match) nextNumber = parseInt(match[1], 10) + 1
  }
  const poNumber = `ND-${new Date().getFullYear()}-${String(nextNumber).padStart(6, '0')}`

  // Filtriraj priporočila za tega dobavitelja
  const supplier = await db.supplier.findUnique({
    where: { id: supplierId },
    select: { id: true, name: true },
  })
  if (!supplier) {
    throw new Error(`Supplier ${supplierId} ne obstaja`)
  }

  // Pridobi cost per unit za vsak item
  const itemsWithCost = await Promise.all(
    recommendations.map(async (rec) => {
      const item = await db.inventoryItem.findUnique({
        where: { id: rec.inventoryItemId },
        select: { costPerUnit: true, name: true, unit: true },
      })
      return {
        ...rec,
        unitCost: item ? toNum(item.costPerUnit) : 0,
        itemName: item?.name || rec.itemName,
        unit: item?.unit || rec.unit,
      }
    }),
  )

  // Izračunaj totals
  const subtotal = itemsWithCost.reduce((sum, i) => sum + i.unitCost * i.recommendedQty, 0)
  const vatAmount = subtotal * 0.22 // 22% DDV
  const totalAmount = subtotal + vatAmount

  // Kreiraj PO z items v transakciji
  const po = await db.purchaseOrder.create({
    data: {
      poNumber,
      supplierId,
      status: 'draft',
      expectedDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // +3 dni
      subtotal,
      vatAmount,
      totalAmount,
      requestedBy: createdBy || 'AI Predictive Ordering',
      locationId,
      notes: `[AI-GENERATED] Avtomatsko naročilo na podlagi forecast-a`,
      items: {
        create: itemsWithCost.map((item) => ({
          inventoryItemId: item.inventoryItemId,
          description: item.itemName,
          quantityOrdered: item.recommendedQty,
          unit: item.unit,
          unitPrice: item.unitCost,
          vatRate: 22,
          totalPrice: item.unitCost * item.recommendedQty,
          status: 'pending',
        })),
      },
    },
    include: { items: true },
  })

  // Posodobi reorder rules — zabeleži zadnji trigger
  for (const rec of recommendations) {
    if (rec.preferredSupplierId === supplierId || !rec.preferredSupplierId) {
      await db.reorderRule.updateMany({
        where: { inventoryItemId: rec.inventoryItemId },
        data: {
          lastTriggeredAt: new Date(),
          lastOrderId: po.id,
        },
      })
    }
  }

  logger.info('PredictiveOrdering', `Created PO ${poNumber} for ${supplier.name}: ${itemsWithCost.length} items, €${totalAmount.toFixed(2)}`)

  return {
    poNumber,
    totalAmount: round2(totalAmount),
    itemCount: itemsWithCost.length,
  }
}
