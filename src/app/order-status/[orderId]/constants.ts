// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Konstante in pomožne funkcije za sledenje naročila
// ═══════════════════════════════════════════════════════════════

import { CheckCircle2, ChefHat, Package, PartyPopper } from 'lucide-react'

// ─── Status koraki ─────────────────────────────────────────────
// FIX: Aligned with actual backend statuses: pending, in-progress, ready, completed
// FIX BUG-04 HIGH: Dinamični Tailwind razredi (bg-${color}-500) ne delujejo v produkciji
// Namesto tega uporabimo statično preslikavo barv
export const STEP_COLORS: Record<string, { bg: string; shadow: string }> = {
  blue:    { bg: 'bg-blue-500',    shadow: 'shadow-blue-500/30' },
  amber:   { bg: 'bg-amber-500',   shadow: 'shadow-amber-500/30' },
  emerald: { bg: 'bg-emerald-500', shadow: 'shadow-emerald-500/30' },
  green:   { bg: 'bg-green-500',   shadow: 'shadow-green-500/30' },
}

export const STATUS_STEPS = [
  { key: 'pending', label: 'Prejeto', labelEn: 'Received', icon: CheckCircle2, color: 'blue' },
  { key: 'in-progress', label: 'V pripravi', labelEn: 'Preparing', icon: ChefHat, color: 'amber' },
  { key: 'ready', label: 'Pripravljeno', labelEn: 'Ready', icon: Package, color: 'emerald' },
  { key: 'completed', label: 'Zaključeno', labelEn: 'Completed', icon: PartyPopper, color: 'green' },
]

// Map order status to step index
export const STATUS_TO_STEP: Record<string, number> = {
  'pending': 0,
  'in-progress': 1,
  'preparing': 1,
  'ready': 2,
  'completed': 3,
  'delivered': 3,
}

/** Vrne indeks trenutnega koraka glede na status */
export function getStepIndex(status: string): number {
  return STATUS_TO_STEP[status] ?? 0
}

/** Vrne pretekli čas od ustvarjanja naročila */
export function getElapsedTime(createdAt: string): string {
  const now = new Date().getTime()
  const created = new Date(createdAt).getTime()
  const diffMin = Math.floor((now - created) / 60000)

  if (diffMin < 1) return 'Pravkar'
  if (diffMin < 60) return `Pred ${diffMin} min`
  const h = Math.floor(diffMin / 60)
  const m = diffMin % 60
  return `${h}h ${m}min`
}

/** Vrne predviden čas priprave glede na tip naročila */
export function getEstimatedTime(createdAt: string, type: string): string {
  const created = new Date(createdAt)
  const prepMinutes = type === 'delivery' ? 45 : type === 'takeout' ? 25 : 20
  const estimated = new Date(created.getTime() + prepMinutes * 60000)
  return estimated.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })
}
