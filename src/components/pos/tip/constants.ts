// ============================================
// TIPI IN KONSTANTE — Upravitelj napitnin
// ============================================

import type { LucideIcon } from 'lucide-react'
import { Equal, Clock, Star, Edit } from 'lucide-react'

import { formatEUR } from '@/lib/safe-format'
export interface TipDistribution {
  id: string
  employeeId: string
  employeeName: string
  hoursWorked: number
  points: number
  amount: number
  status: string
  paidAt: string | null
}

export interface TipPoolData {
  id: string
  date: string
  totalTips: number
  cashTips: number
  cardTips: number
  distributionMethod: string
  status: string
  distributions: TipDistribution[]
}

export const METHOD_LABELS: Record<string, { label: string; icon: LucideIcon; desc: string }> = {
  equal: { label: 'Enako', icon: Equal, desc: 'Enak del za vse' },
  hours: { label: 'Po urah', icon: Clock, desc: 'Proporcionalno uram' },
  points: { label: 'Po točkah', icon: Star, desc: 'Po točkah/sistem' },
  manual: { label: 'Ročno', icon: Edit, desc: 'Ročna dodelitev' },
}

// ============================================
// STATUSI TIP POOLA — R145-c BUG-04 fix (audit R145-a Q3-8)
// Prej: STATUS_LABELS kot ohlapna Record<string,...> mapa z dvema kršitvama:
// 'blue' razred (hišno pravilo: NIKOLI blue/indigo) in ne-tipizirani ključi.
// Zdaj: kanonični seznam statusov + POLNI literal meta mapa (vzorec
// GIFT_CARD_LIABILITY_STATUS_META R144-c) + varen lookup z fallbackom.
// Paleta (kontrakt R145-a): amber pending / emerald distributed+paid /
// zinc neutral (approved je dormant) — NIKOLI blue/indigo.
// ============================================
export const TIP_POOL_STATUSES = ['pending', 'distributed', 'approved', 'paid'] as const

export type TipPoolStatus = (typeof TIP_POOL_STATUSES)[number]

export interface TipPoolStatusUiMeta {
  label: string
  /** Literal Tailwind razredi badgea (brez template interpolacije — BUG-04). */
  color: string
}

export const TIP_POOL_STATUS_META: Record<TipPoolStatus, TipPoolStatusUiMeta> = {
  pending: { label: 'Čakajoče', color: 'bg-amber-100 text-amber-800' },
  distributed: { label: 'Razdeljeno', color: 'bg-emerald-100 text-emerald-800' },
  approved: { label: 'Odobreno', color: 'bg-zinc-100 text-zinc-800' },
  paid: { label: 'Izplačano', color: 'bg-emerald-100 text-emerald-800' },
}

/** Varen lookup: neznana vrednost → zinc fallback z surovim labelom (nikoli crash). */
export const tipPoolStatusMeta = (status: string): TipPoolStatusUiMeta =>
  (TIP_POOL_STATUSES as readonly string[]).includes(status)
    ? TIP_POOL_STATUS_META[status as TipPoolStatus]
    : { label: status, color: 'bg-zinc-100 text-zinc-800' }

export const formatCurrency = (val: number) => `${formatEUR(val || 0)}`
