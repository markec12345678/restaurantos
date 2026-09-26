// ============================================
// TIPI, KONSTANTE IN POMOŽNE FUNKCIJE
// za podkomponente upravljanja darilnih kartic
// ============================================

import { formatEUR } from '@/lib/safe-format'
// R144-c (epic #115 #31): prag "poteče kmalu" iz ENOTNEGA vira (strežnik IN UI)
import { GIFT_CARD_EXPIRING_SOON_DAYS } from '@/lib/gift-cards/constants'

// RUNDA 51: transactionTypeConfig preseljena v src/lib/gift-card-tx-category.ts
// (GIFT_CARD_TX_CATEGORY_META — ENOTEN VIR; ikone ostanejo v TransactionHistoryDialog)
// --- Tipi ---

export interface GiftCardTransaction {
  id: string
  giftCardId: string
  type: string
  amount: number
  balanceAfter: number
  orderId: string | null
  checkId: string | null
  note: string
  createdAt: string
}

export interface GiftCard {
  id: string
  cardNumber: string
  balance: number
  initialBalance: number
  status: string
  ownerName: string
  purchasedAt: string
  expiresAt: string | null
  transactions: GiftCardTransaction[]
  createdAt: string
  updatedAt: string
}

// --- Konstante ---

export const statusConfig: Record<string, { label: string; color: string; bgColor: string; dotColor: string }> = {
  active: {
    label: 'Aktivna',
    color: 'text-emerald-700 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    dotColor: 'bg-emerald-500',
  },
  depleted: {
    label: 'Porabljena',
    color: 'text-gray-700 dark:text-gray-400',
    bgColor: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    dotColor: 'bg-gray-500',
  },
  expired: {
    label: 'Potekla',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    dotColor: 'bg-red-500',
  },
  suspended: {
    label: 'Suspendirana',
    color: 'text-amber-700 dark:text-amber-400',
    bgColor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    dotColor: 'bg-amber-500',
  },
}

// --- Pomožne funkcije ---

export function formatDateSI(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('sl-SI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatDateTimeSI(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('sl-SI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatCurrency(amount: number): string {
  return `${formatEUR(amount)}`
}

export function generateCardNumber(): string {
  const prefix = 'GC'
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${timestamp.slice(-4)}-${random}`
}

// ============================================
// ODPUSTNA OBVEZNOST (R144-c, epic #115 #31) — UI mape + pomožniki
// Vir praga je src/lib/gift-cards/constants.ts (ENOTEN VIR za strežnik IN
// UI — BUG-04: brez dupliciranja števil; precedens lifecycle-constants).
// Meta mapa je POLNI literal (nikoli konkatenacij/objektov kot ključev),
// brez modrih/indigo tonov (hišno pravilo). Barve sledijo jeziku obstoječega
// statusConfig (emerald/nevtralno/amber/red) — nevtralna je zinc (pariteta
// LIFECYCLE_BUCKET_META).
// ============================================

/** Literarni statusi liability poročila (BUG-04 — iteracija po tej tupli). */
export const GIFT_CARD_LIABILITY_STATUSES = ['active', 'depleted', 'suspended', 'expired'] as const

export type GiftCardLiabilityStatus = (typeof GIFT_CARD_LIABILITY_STATUSES)[number]

export interface GiftCardLiabilityStatusUiMeta {
  label: string
  /** Barvni namig besedila (emerald/zinc/amber/red — brez blue/indigo) */
  textClass: string
  /** Literal razred barvne pike per status */
  dotClass: string
  /** Pošten podnaslov številca (definicijska semantika statusa) */
  hint: string
}

/** Številci statusov — oznake/pika/hint kot POLNI literali (BUG-04). */
export const GIFT_CARD_LIABILITY_STATUS_META: Record<GiftCardLiabilityStatus, GiftCardLiabilityStatusUiMeta> = {
  active: {
    label: 'Aktivne',
    textClass: 'text-emerald-700 dark:text-emerald-400',
    dotClass: 'bg-emerald-500',
    hint: 'Z nespotrošenim saldom',
  },
  depleted: {
    label: 'Izčrpane',
    textClass: 'text-zinc-700 dark:text-zinc-300',
    dotClass: 'bg-zinc-400 dark:bg-zinc-500',
    hint: 'Saldo popolnoma potrošen',
  },
  suspended: {
    label: 'Suspendirane',
    textClass: 'text-amber-700 dark:text-amber-400',
    dotClass: 'bg-amber-500',
    hint: 'Začasno onemogočene za porabo',
  },
  expired: {
    label: 'Poteče',
    textClass: 'text-red-700 dark:text-red-400',
    dotClass: 'bg-red-500',
    hint: 'Po datumu veljavnosti (lazy odpis)',
  },
}

/** Strukturni vir števcev (zadostuje LiabilityTotals iz useGiftCardLiability). */
export interface LiabilityStatusCountSource {
  activeCards: number
  depletedCards: number
  suspendedCards: number
  expiredCards: number
}

/** Števec per status — literal switch (BUG-04: nikoli objekti kot ključi). */
export function liabilityStatusCount(
  status: GiftCardLiabilityStatus,
  totals: LiabilityStatusCountSource,
): number {
  switch (status) {
    case 'active':
      return totals.activeCards
    case 'depleted':
      return totals.depletedCards
    case 'suspended':
      return totals.suspendedCards
    case 'expired':
      return totals.expiredCards
  }
}

/** Oznaka KPI "poteče kmalu" — dnevi IZ enotnega vira, NIKOLI hardcode 30. */
export function giftCardExpiringSoonLabel(): string {
  return `Poteče v ${GIFT_CARD_EXPIRING_SOON_DAYS} dneh`
}
