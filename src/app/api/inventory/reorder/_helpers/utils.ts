// ============================================
// PAMETNO NAROČANJE ZALOGE — Pomožne funkcije
// ============================================

import type { ReorderSuggestion } from './types'

export function generateReorderReason(
  f: Record<string, unknown>,
  _item: Record<string, unknown>,
): string {
  const reasons: string[] = []

  if (f.daysUntilEmpty !== null && (f.daysUntilEmpty as number) <= 2) {
    reasons.push(`Zaloga zmanjka čez ${f.daysUntilEmpty} dni!`)
  } else if (f.daysUntilEmpty !== null && (f.daysUntilEmpty as number) <= 7) {
    reasons.push(`Zaloga zmanjka čez ${f.daysUntilEmpty} dni`)
  }

  if (Number(f.currentStock) <= Number(f.minStock)) {
    reasons.push('Pod minimalno zalogo')
  }

  if (f.trend === 'increasing') {
    reasons.push('Poraba narašča')
  }

  if ((f.seasonalityFactor as number) > 1.2) {
    reasons.push('Vikend porast pričakovana')
  }

  if (reasons.length === 0) {
    reasons.push('Priporočeno naročilo glede na napoved')
  }

  return reasons.join(' · ')
}

export function groupBy(arr: ReorderSuggestion[], key: keyof ReorderSuggestion): Record<string, number> {
  const grouped: Record<string, number> = {}
  for (const item of arr) {
    const k = String(item[key] || 'Neznano')
    grouped[k] = (grouped[k] || 0) + 1
  }
  return grouped
}
