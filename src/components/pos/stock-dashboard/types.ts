// ============================================
// TIPI IN POMOŽNE FUNKCIJE ZA STOCK DASHBOARD
// ============================================

export interface StockItem {
  id: string
  name: string
  unit: string
  quantity: number
  minQuantity: number
  costPerUnit: number
  servingsPerUnit: number
  category: string
  supplier: string
  menuItem?: { id: string; name: string; price: number } | null
  _lastTransaction?: { createdAt: string; type: string } | null
}

// Barva zalogskega nivoja (besedilo)
export const stockLevelColor = (qty: number, minQty: number) => {
  if (qty <= 0) return 'text-red-600'
  if (qty <= minQty * 0.5) return 'text-orange-600'
  if (qty <= minQty) return 'text-amber-600'
  return 'text-emerald-600'
}

// Barva zalogskega nivoja (ozadje)
export const stockLevelBg = (qty: number, minQty: number) => {
  if (qty <= 0) return 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40'
  if (qty <= minQty * 0.5) return 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/40'
  if (qty <= minQty) return 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40'
  return 'bg-card border-border'
}

// Barva vrstice napredka
export const progressColor = (pct: number) => {
  if (pct <= 10) return 'bg-red-500'
  if (pct <= 30) return 'bg-orange-500'
  if (pct <= 60) return 'bg-amber-500'
  return 'bg-emerald-500'
}

// Oznaka zalogskega nivoja
export const progressLabel = (pct: number) => {
  if (pct <= 10) return 'Kritično nizka zaloga'
  if (pct <= 30) return 'Nizka zaloga'
  if (pct <= 60) return 'Zmerna zaloga'
  return 'Zadostna zaloga'
}
