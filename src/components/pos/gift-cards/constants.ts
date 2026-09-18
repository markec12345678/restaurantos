// ============================================
// TIPI, KONSTANTE IN POMOŽNE FUNKCIJE
// za podkomponente upravljanja darilnih kartic
// ============================================

import { formatEUR } from '@/lib/safe-format'

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
