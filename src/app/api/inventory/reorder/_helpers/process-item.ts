// Obdelava posameznega artikla za predloge naročanja zaloge
//
// R129 (epic #115 P1-07): izračun je delegiran na KANON
// ('@/lib/reorder/canon' — enoten vir resnice). Ta adapter le:
//   1. prevodi Prisma Decimal polja v kanonske number vhode,
//   2. doda kompatibilna polja starega odgovora (urgency/reason/trend/
//      daysUntilEmpty/...), da UI tok ostane nespremenjen.
// Business logika (formula, statusi, viri) živi IZKLJUČNO v kanonu.

import { toNum, round2, multiply, greaterThan } from '@/lib/decimal'
import { computeReorderSuggestion } from '@/lib/reorder/canon'
import type { UsageFacts, ReorderContext } from '@/lib/reorder/canon'
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
  // R129: kanonska eksplicitna polja (nullable — ko manjkajo, kanon izpelje)
  reorderPoint?: Parameters<typeof toNum>[0] | null
  safetyStock?: Parameters<typeof toNum>[0] | null
  leadTimeDays?: number | null
}

export interface ReorderPipelineContext extends ReorderContext {
  /** Zadnji prevzem (ISO) — kompatibilno polje lastOrderDate. */
  lastProcurementDate?: string | null
}

export function processItemForSuggestion(
  item: InventoryItem,
  facts: UsageFacts,
  ctx: ReorderPipelineContext = {},
): ReorderSuggestion {
  const costPerUnit = toNum(item.costPerUnit)
  const minQuantity = toNum(item.minQuantity)

  // Kanonski izračun (pure) — vse številke + statusi + faktorji + viri.
  const canon = computeReorderSuggestion(
    {
      id: item.id,
      name: item.name,
      unit: item.unit,
      supplier: item.supplier,
      quantity: toNum(item.quantity),
      minQuantity,
      reorderPoint: item.reorderPoint == null ? null : toNum(item.reorderPoint),
      safetyStock: item.safetyStock == null ? null : toNum(item.safetyStock),
      leadTimeDays: item.leadTimeDays ?? null,
      costPerUnit,
    },
    facts,
    ctx,
  )

  // --- Kompatibilna polja starega odgovora (obstoječa semantika) ---
  const avg = facts.avgDailyUsage
  const recent = facts.recentDailyUsage
  const trend: ReorderSuggestion['trend'] =
    recent > avg * 1.2 ? 'increasing' :
    recent < avg * 0.5 ? 'decreasing' : 'stable'
  const isLowStock = !greaterThan(item.quantity, item.minQuantity)
  const daysUntilEmpty = avg > 0 ? Math.floor(canon.available / avg) : 999

  // Mapiranje kanon status → legacy urgency (UI riskConfig ostaja delujoč):
  //   critical → critical, low → high, covered-by-po → medium, ok → low.
  const urgency: ReorderSuggestion['urgency'] =
    canon.status === 'critical' ? 'critical' :
    canon.status === 'low' ? 'high' :
    canon.status === 'covered-by-po' ? 'medium' : 'low'

  let reason = generateReorderReason(
    {
      daysUntilEmpty,
      currentStock: canon.available,
      minStock: minQuantity,
      trend,
      seasonalityFactor: 1,
      riskLevel: urgency,
      needsReorder: canon.status !== 'ok',
    } as Record<string, unknown>,
    item as unknown as Record<string, unknown>,
  )
  if (canon.status === 'covered-by-po') {
    reason += ' · Pokrito z odprto naročilnico'
  }

  return {
    // kompatibilna polja
    inventoryItemId: item.id,
    itemName: item.name,
    unit: item.unit,
    supplier: item.supplier,
    currentStock: canon.available,
    suggestedQty: canon.suggestedQty,
    costPerUnit,
    totalCost: round2(multiply(canon.suggestedQty, costPerUnit)),
    urgency,
    reason,
    lastOrderDate: ctx.lastProcurementDate ?? null,
    avgDeliveryDays: ctx.avgDeliveryDays ?? 3,
    category: item.category,
    // R129 kanon polja
    status: canon.status,
    dataStatus: canon.dataStatus,
    factors: canon.factors,
    reorderPoint: canon.reorderPoint,
    reorderPointSource: canon.reorderPointSource,
    safetyStock: canon.safetyStock,
    safetyStockSource: canon.safetyStockSource,
    leadTimeDays: canon.leadTimeDays,
    leadTimeSource: canon.leadTimeSource,
    openPoQty: canon.openPoQty,
    openPos: canon.openPos,
    expectedDelivery: canon.expectedDelivery,
    unitPrice: costPerUnit,
    // R130 (P1-08): privzeti vir cene — enrichment v suggestions.ts OVERIDE-a
    // z zadnjo dobaviteljsko ceno, če zgodovina obstaja.
    unitPriceSource: 'item-cost',
    unitPriceAsOf: null,
    itemId: item.id,
    name: item.name,
    avgDailyUsage: avg,
    recentUsage: recent,
    trend,
    isLowStock,
    daysUntilEmpty,
  }
}
