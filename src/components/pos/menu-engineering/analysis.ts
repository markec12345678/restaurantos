// ═══════════════════════════════════════════════════════════════
// RestaurantOS — ČISTA analitična logika Menu Engineering
// Izvlečeno iz use-engineering-data.ts (QA 2026-09-17, runda 3),
// da jo lahko PONOVNO uporabi tudi Nadzorna plošča (KPI kartice)
// brez podvajanja poslovnih pravil kvadrantov.
//
// Profitability (bruto dobiček %) vs Popularity (prodana količina)
// 4 kvadranti: Zvezda / Uganka / Delavski konj / Pes
// ═══════════════════════════════════════════════════════════════

import type { MenuItemRow } from '@/lib/types'
import type { MenuEngineeringData, MenuItemAnalysis } from './constants'

export interface PopularApiResponse {
  popularItems: MenuItemRow[]
}

/**
 * Iz surovih podatkov (popularni artikli + zemljevid food-costov)
 * izračunaj kvadrante, range in povzetek za Menu Engineering.
 */
export function analyzeEngineeringData(
  popular: PopularApiResponse | null | undefined,
  foodCostMap: Record<string, number>,
): MenuEngineeringData {
  const rows = popular?.popularItems ?? []

  const items: MenuItemAnalysis[] = rows.map((item, idx) => {
    const qty = (item.quantity as number) || 0
    const revenue = (item.revenue as number) || 0
    const price = qty > 0 ? revenue / qty : 0
    const foodCost = foodCostMap[item.id] || price * 0.3 // Fallback 30 %
    const grossProfit = price - foodCost
    const grossProfitPercent = price > 0 ? (grossProfit / price) * 100 : 0

    return {
      id: item.id || String(idx),
      name: item.name,
      category: item.category,
      price,
      foodCost,
      grossProfit,
      grossProfitPercent,
      quantitySold: qty,
      revenue,
      popularityRank: 0,
      profitabilityRank: 0,
      quadrant: 'dog' as const,
    }
  })

  // Mediani (robustnejša središčna mera kot povprečje — izhodišča kvadrantov)
  const sortedByPopularity = [...items].sort((a, b) => b.quantitySold - a.quantitySold)
  const sortedByProfit = [...items].sort((a, b) => b.grossProfitPercent - a.grossProfitPercent)

  const medianPopularity = sortedByPopularity.length > 0
    ? sortedByPopularity[Math.floor(sortedByPopularity.length / 2)].quantitySold
    : 0
  const medianProfitability = sortedByProfit.length > 0
    ? sortedByProfit[Math.floor(sortedByProfit.length / 2)].grossProfitPercent
    : 50

  // Dodeli kvadrante in range
  items.forEach((item) => {
    item.popularityRank = sortedByPopularity.findIndex((i) => i.id === item.id) + 1
    item.profitabilityRank = sortedByProfit.findIndex((i) => i.id === item.id) + 1

    const isHighPopularity = item.quantitySold >= medianPopularity
    const isHighProfitability = item.grossProfitPercent >= medianProfitability

    if (isHighPopularity && isHighProfitability) item.quadrant = 'star'
    else if (!isHighPopularity && isHighProfitability) item.quadrant = 'puzzle'
    else if (isHighPopularity && !isHighProfitability) item.quadrant = 'plowhorse'
    else item.quadrant = 'dog'
  })

  return {
    items,
    medianPopularity,
    medianProfitability,
    totalItems: items.length,
    stars: items.filter((i) => i.quadrant === 'star').length,
    puzzles: items.filter((i) => i.quadrant === 'puzzle').length,
    plowhorses: items.filter((i) => i.quadrant === 'plowhorse').length,
    dogs: items.filter((i) => i.quadrant === 'dog').length,
  }
}
