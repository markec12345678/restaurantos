// ============================================
// TIPI, KONSTANTE IN POMOŽNE FUNKCIJE
// za podkomponente upravljanja zvestobnega programa
// ============================================

import { Star, Award, Trophy, Gem } from 'lucide-react'
import {
  LIFECYCLE_ACTIVE_MAX_DAYS,
  LIFECYCLE_AT_RISK_MAX_DAYS,
  type LifecycleBucket,
} from '@/lib/loyalty/lifecycle-constants'

// --- Tipi ---

export interface LoyaltyTransaction {
  id: string
  loyaltyAccountId: string
  type: string
  points: number
  reason: string
  orderId: string | null
  checkId: string | null
  monetaryValue: number
  createdAt: string
}

export interface LoyaltyAccount {
  id: string
  customerName: string
  customerPhone: string
  customerEmail: string
  pointsBalance: number
  lifetimePoints: number
  tier: string
  isActive: boolean
  transactions: LoyaltyTransaction[]
  createdAt: string
  updatedAt: string
}

// --- Konstante ---

export const tierConfig: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string; borderColor: string }> = {
  bronze: {
    label: 'Bronasti',
    icon: Star,
    color: 'text-amber-700 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
  silver: {
    label: 'Srebrni',
    icon: Award,
    color: 'text-gray-600 dark:text-gray-300',
    bgColor: 'bg-gray-50 dark:bg-gray-900/30',
    borderColor: 'border-gray-200 dark:border-gray-700',
  },
  gold: {
    label: 'Zlati',
    icon: Trophy,
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
  },
  platinum: {
    label: 'Platinasti',
    icon: Gem,
    color: 'text-purple-700 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    borderColor: 'border-purple-200 dark:border-purple-800',
  },
}

export const tierBadgeStyles: Record<string, string> = {
  bronze: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  silver: 'bg-gray-200 text-gray-800 dark:bg-gray-700/30 dark:text-gray-300',
  gold: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  platinum: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
}

// RUNDA 50: transactionTypeConfig/transactionBadgeStyles preseljena v
// src/lib/loyalty-tx-category.ts (LOYALTY_TX_CATEGORY_META) — enoten vir
// za oznake/barve/kategorizacijo, s testi.

// --- Pomožne funkcije ---

export function formatDateSI(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('sl-SI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatPoints(points: number): string {
  return points.toLocaleString('sl-SI')
}

// ============================================
// ŽIVLJENJSKI CIKEL (R143-c, epic #115 #30) — UI mape + pomožniki
// Vir pragov je src/lib/loyalty/lifecycle-constants.ts (enoten vir za
// strežnik IN UI — BUG-04: brez dupliciranja števil). Badge/razredne mape
// so polni literali (nikoli konkatenacij), brez modrih/indigo tonov
// (hišno pravilo). Nivo oznake/barve prihajajo iz obstoječih map
// tierConfig/tierBadgeStyles zgoraj — NI novih vzporednih map.
// ============================================

export interface LifecycleBucketUiMeta {
  label: string
  /** Barvni namig besedila (emerald/neutral/amber/red — brez blue/indigo) */
  textClass: string
  /** Literal razred barvne pike per segment */
  dotClass: string
}

/** Segmenti življenjskega cikla — iteracija po LIFECYCLE_BUCKETS (BUG-04). */
export const LIFECYCLE_BUCKET_META: Record<LifecycleBucket, LifecycleBucketUiMeta> = {
  new: {
    label: 'Nov',
    textClass: 'text-zinc-700 dark:text-zinc-300',
    dotClass: 'bg-zinc-400 dark:bg-zinc-500',
  },
  active: {
    label: 'Aktiven',
    textClass: 'text-emerald-700 dark:text-emerald-400',
    dotClass: 'bg-emerald-500',
  },
  at_risk: {
    label: 'Ogrožen',
    textClass: 'text-amber-700 dark:text-amber-400',
    dotClass: 'bg-amber-500',
  },
  churned: {
    label: 'Izgubljen',
    textClass: 'text-red-700 dark:text-red-400',
    dotClass: 'bg-red-500',
  },
}

/** Pošten podnaslov segmenta — dnevi IZ konstant, nikoli hardcode. */
export function lifecycleBucketHint(bucket: LifecycleBucket): string {
  switch (bucket) {
    case 'new':
      return 'Brez transakcij'
    case 'active':
      return `Zadnja transakcija ≤ ${LIFECYCLE_ACTIVE_MAX_DAYS} dni`
    case 'at_risk':
      return `${LIFECYCLE_ACTIVE_MAX_DAYS + 1}–${LIFECYCLE_AT_RISK_MAX_DAYS} dni od zadnje transakcije`
    case 'churned':
      return `Več kot ${LIFECYCLE_AT_RISK_MAX_DAYS} dni brez transakcije`
  }
}

/** Barvni gradient vrstice napredka per nivo (isti design jezik kot LoyaltyTierProgress). */
export const tierBarGradients: Record<string, string> = {
  bronze: 'from-amber-500 to-amber-400',
  silver: 'from-gray-400 to-gray-300',
  gold: 'from-yellow-500 to-yellow-400',
  platinum: 'from-purple-500 to-purple-400',
}

/** Nevtralni fallback za neznan nivo (BUG-04: nikoli undefined, brez ugibanja). */
export const TIER_BADGE_UNKNOWN: { label: string; className: string } = {
  label: 'Neznano',
  className: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-300',
}

/** Varen nivo badge: label iz tierConfig + razred iz tierBadgeStyles + fallback. */
export function tierBadge(tier: string | null | undefined): { label: string; className: string } {
  if (!tier || !(tier in tierBadgeStyles) || !(tier in tierConfig)) return TIER_BADGE_UNKNOWN
  return { label: tierConfig[tier].label, className: tierBadgeStyles[tier] }
}
