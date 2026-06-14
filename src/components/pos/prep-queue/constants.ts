// ═══════════════════════════════════════════════════════════════
// TIPI, KONSTANTE IN POMOŽNE FUNKCIJE
// za podkomponente kuhinjskega pripravljalnega vrstnega reda
// ═══════════════════════════════════════════════════════════════

import { Flame, UtensilsCrossed, Coffee, Wine } from 'lucide-react'

// ─── Tipi ──────────────────────────────────────────────────────

export interface OrderItem {
  id: string
  menuItemId: string
  menuItem: { name: string; category?: { name: string }; prepTime?: number }
  quantity: number
  status: string
  notes?: string
  modifiers?: string
  course?: number
}

export interface KitchenOrder {
  id: string
  orderNumber: number
  type: string
  status: string
  priority: string
  createdAt: string
  orderItems: OrderItem[]
  table?: { number: number; name?: string }
  customerName?: string
  specialInstructions?: string
  elapsedMinutes: number
  estimatedPrepMinutes: number
}

export type ViewMode = 'list' | 'grid'

export interface TimeWarning {
  level: string
  color: string
  bg: string
}

export interface KitchenStats {
  pending: number
  preparing: number
  ready: number
  avgWaitTime: number
}

// ─── Konstante ─────────────────────────────────────────────────

export const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  urgent: { label: 'NUJNO', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30', border: 'border-red-400 dark:border-red-800' },
  high: { label: 'VISOKO', color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30', border: 'border-orange-400 dark:border-orange-800' },
  normal: { label: 'NORMALNO', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-300 dark:border-blue-800' },
  low: { label: 'NIZKO', color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800/30', border: 'border-gray-300 dark:border-gray-700' },
}

export const CATEGORY_ICONS: Record<string, typeof Flame> = {
  'Predjedi': UtensilsCrossed,
  'Glavne jedi': Flame,
  'Pice': Flame,
  'Sladice': Coffee,
  'Pijače': Wine,
  'Juhe': Coffee,
}

export const STATUS_LABELS: Record<string, string> = {
  pending: 'Čakajoče',
  preparing: 'V pripravi',
  ready: 'Pripravljeno',
  served: 'Postreženo',
  cancelled: 'Preklicano',
}

// ─── Pomožne funkcije ──────────────────────────────────────────

/** Ocene časovnih opozoril glede na pretečene minute */
export function getTimeWarning(minutes: number): TimeWarning {
  if (minutes > 30) return { level: 'critical', color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30' }
  if (minutes > 20) return { level: 'warning', color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30' }
  if (minutes > 10) return { level: 'caution', color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' }
  return { level: 'ok', color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30' }
}

// ═══════════════════════════════════════════════════════════════
// PROPS INTERFACES ZA POD-KOMPONENTE
// ═══════════════════════════════════════════════════════════════

export interface PrepQueueStatsProps {
  stats: KitchenStats | undefined
}

export interface OrderCardProps {
  order: KitchenOrder
  viewMode: ViewMode
  onItemStatus: (_itemId: string, _status: string) => void
  onOrderStatus: (_orderId: string) => void
}

export interface OrderColumnProps {
  title: string
  count: number
  dotColor: string
  emptyIcon: React.ElementType
  emptyText: string
  orders: KitchenOrder[]
  viewMode: ViewMode
  onItemStatus: (_itemId: string, _status: string) => void
  onOrderStatus: (_orderId: string) => void
}
