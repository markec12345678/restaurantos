// ============================================
// TIPI, KONSTANTE IN POMOŽNE FUNKCIJE
// za podkomponente upravljanja darilnih kartic
// ============================================

import { ArrowDownToLine, Wallet, ArrowUpDown, RefreshCw } from 'lucide-react'

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

export const transactionTypeConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  load: {
    label: 'Naloži',
    color: 'text-emerald-700 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    icon: ArrowDownToLine,
  },
  redeem: {
    label: 'Unovči',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    icon: Wallet,
  },
  adjust: {
    label: 'Prilagodi',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    icon: ArrowUpDown,
  },
  transfer: {
    label: 'Prenesi',
    color: 'text-purple-700 dark:text-purple-400',
    bgColor: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    icon: RefreshCw,
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
  return `€${amount.toFixed(2)}`
}

export function generateCardNumber(): string {
  const prefix = 'GC'
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${timestamp.slice(-4)}-${random}`
}
