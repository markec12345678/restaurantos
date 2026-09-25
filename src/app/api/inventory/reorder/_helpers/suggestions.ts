// ============================================
// PAMETNO NAROČANJE ZALOGE — Pridobivanje predlogov za GET
// ============================================
// R129 (epic #115 P1-07): pipeline je prepisan na KANON
// ('@/lib/reorder/canon') — poraba (prodaja + batch-consumption),
// točka naročila, varnostna zaloga, dobavni čas (item→pravilo→izpeljava→
// privzeto), odprte naročilnice (OPEN_PO_STATUSES) — vse razložljivo
// (factors z viri). Batched query (brez N+1), tenant scope ohranjen.
// Kompatibilna polja starega odgovora ostanejo (glej process-item.ts).
// ============================================

import { db } from '@/lib/db'
import {
  collectUsageFactsBatch,
  collectDeliveryFacts,
  collectOpenPurchaseOrders,
  resolveRuleLeadTimeMap,
} from '@/lib/reorder/canon'
import type { UsageFacts } from '@/lib/reorder/canon'
import { toNum, round2, multiply } from '@/lib/decimal'
import { isValidPack, packsForBaseQty } from '@/lib/procurement/pack-size'
import {
  collectLatestSupplierPrices,
  resolveSupplierIdsByNames,
  pickLatestPrice,
} from '@/lib/suppliers/price-history-db'
import {
  collectActiveCatalogLines,
  catalogLineKey,
} from '@/lib/suppliers/catalog-db'
import { groupBy } from './utils'
import type { ReorderSuggestion, ReorderSummary, ReorderResult } from './types'
import { processItemForSuggestion } from './process-item'

export interface ReorderFilterOptions {
  /** Canon statusi ('critical'|'low'|'covered-by-po'|'ok') — mapirano iz
   *  ?status= ali legacy ?urgency= (glej route.ts). Prazno/nezadano =
   *  privzeto vse razen 'ok' (pariteta s starim tokom: samo artikli, ki
   *  potrebujejo pozornost). */
  statuses?: string[]
  /** Filter po dobavitelju (ne-čutljiv na velikost črk). */
  supplier?: string
}

/** Privzeti status filter (star tok ni prikazoval 'ok' artiklov). */
const DEFAULT_STATUSES = new Set<string>(['critical', 'low', 'covered-by-po'])

const ZERO_FACTS: UsageFacts = {
  windowDays: 30,
  recentDays: 7,
  totalConsumed: 0,
  avgDailyUsage: 0,
  recentConsumed: 0,
  recentDailyUsage: 0,
  txCount: 0,
  hasEnoughData: false,
}

export async function getReorderSuggestions(
  // FIX R85-4c M7: tenant scope — null (super-admin) = globalno, string = samo ta lokacija
  locationId: string | null,
  opts: ReorderFilterOptions = {},
): Promise<ReorderResult> {
  // Pridobi vse artikle za analizo (R85-4c: scoped — prej zaloga VSEH tenantov)
  const allItems = await db.inventoryItem.findMany({
    where: {
      ...(locationId ? { locationId } : {}),
    },
    orderBy: { quantity: 'asc' },
  })

  const itemIds = allItems.map(item => item.id)

  // R129: batched kanonska branja (brez N+1) — poraba, pravila, odprte
  // naročilnice (OPEN_PO_STATUSES), dobavna zgodovina.
  const [factsByItem, rules, openPosByItem, deliveryByItem] = await Promise.all([
    collectUsageFactsBatch(db, itemIds, { windowDays: 30, recentDays: 7 }),
    db.reorderRule.findMany({
      where: { inventoryItemId: { in: itemIds } },
      select: { inventoryItemId: true, leadTimeDays: true, isActive: true },
    }),
    collectOpenPurchaseOrders(db, itemIds),
    collectDeliveryFacts(db, itemIds),
  ])
  const ruleLeadByItem = resolveRuleLeadTimeMap(rules)

  const statusFilter = opts.statuses && opts.statuses.length > 0 ? new Set(opts.statuses) : null
  const supplierLower = opts.supplier ? opts.supplier.trim().toLowerCase() : null

  const suggestions: ReorderSuggestion[] = []

  for (const item of allItems) {
    if (supplierLower && item.supplier.toLowerCase() !== supplierLower) continue

    const openPo = openPosByItem.get(item.id)
    const delivery = deliveryByItem.get(item.id)

    const suggestion = processItemForSuggestion(item, factsByItem.get(item.id) ?? ZERO_FACTS, {
      openPoQty: openPo?.qty ?? 0,
      openPoRefs: openPo?.refs ?? [],
      ruleLeadTimeDays: ruleLeadByItem.get(item.id) ?? null,
      avgDeliveryDays: delivery?.avgDeliveryDays ?? null,
      lastProcurementDate: delivery?.lastProcurementDate ?? null,
    })

    // Filter po statusu (privzeto vse razen 'ok')
    if (!(statusFilter ?? DEFAULT_STATUSES).has(suggestion.status)) continue

    suggestions.push(suggestion)
  }

  // R130 (epic #115 P1-08): zgodovina nabavnih cen — zadnja cena per
  // (dobavitelj, artikel) OVERIDE-a unitPrice (sicer obstoječi costPerUnit
  // — back-compat: brez zgodovine se NIČ ne spremeni). Kanon
  // ('@/lib/reorder/canon') ostane ČIST — bulk fetch + preslikava tukaj,
  // PRED povzetkom, da totalEstimatedCost ostane konsistenten s unitPrice.
  // Best-effort: brez zgodovine/modela → 'item-cost' (price-history-db kolektorji).
  const supplierNames = suggestions.map(s => s.supplier)
  const supplierIdByName = await resolveSupplierIdsByNames(db, supplierNames)
  const latestPrices = await collectLatestSupplierPrices(db, suggestions.map(s => s.itemId))
  for (const s of suggestions) {
    s.unitPriceSource = 'item-cost'
    s.unitPriceAsOf = null
    const price = pickLatestPrice(latestPrices, supplierIdByName.get(s.supplier.trim()), s.itemId)
    if (!price) continue
    const lastPriceNum = toNum(price.unitPrice)
    if (!(lastPriceNum > 0)) continue
    s.unitPrice = lastPriceNum
    s.totalCost = round2(multiply(s.suggestedQty, lastPriceNum))
    s.unitPriceSource = 'supplier-history'
    s.unitPriceAsOf = price.observedAt.toISOString()
  }

  // R131 (epic #115 P1-13): pack hint enrichment — kadar artikel ima aktivno
  // katalog linijo za svojega dobavitelja (resolve prek item.supplier ime →
  // Supplier → SupplierItem; supplierIdByName mapa je že naložena zgoraj).
  // Batched lookup (brez N+1); brez linije polja NE obstajajo (čisto aditivno,
  // pariteta R130-a2). Pogoj je ISTI kot pri draft-po pack naročanju
  // (isValidPack IN pricePerPack > 0) — hint nikoli ne obljubi pakirne
  // vrstice, ki je ne bo (kanon #6: nikoli ne izmišljuj cene).
  const catalogLines = await collectActiveCatalogLines(
    db,
    [...supplierIdByName.values()],
    suggestions.map(s => s.itemId),
  )
  for (const s of suggestions) {
    const line = catalogLines.get(catalogLineKey(supplierIdByName.get(s.supplier.trim()) ?? '', s.itemId))
    if (!line) continue
    const packQtyNum = toNum(line.packQty)
    const pricePerPackNum = toNum(line.pricePerPack)
    if (!isValidPack(packQtyNum) || !(pricePerPackNum > 0)) continue
    s.packQty = packQtyNum
    s.packUnit = line.packUnit
    s.baseUnit = s.unit
    s.packsNeeded = packsForBaseQty(s.suggestedQty, packQtyNum)
    s.pricePerPack = pricePerPackNum
    s.packSource = 'catalog'
  }

  // Razvrsti po nujnosti (legacy urgency mapiranje)
  const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  suggestions.sort((a, b) => (urgencyOrder[a.urgency] || 3) - (urgencyOrder[b.urgency] || 3))

  // Povzetek (envelope nespremenjen)
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
