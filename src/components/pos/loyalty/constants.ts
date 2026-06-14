// ============================================
// TIPI, KONSTANTE IN POMOŽNE FUNKCIJE
// za podkomponente upravljanja zvestobnega programa
// ============================================

import { Star, Award, Trophy, Gem, ArrowUpCircle, ArrowDownCircle, RotateCcw, TrendingUp } from 'lucide-react'

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

export const transactionTypeConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  earn: { label: 'Prislužene', color: 'text-emerald-600 dark:text-emerald-400', icon: ArrowUpCircle },
  redeem: { label: 'Unovčene', color: 'text-blue-600 dark:text-blue-400', icon: ArrowDownCircle },
  adjust: { label: 'Prilagojene', color: 'text-amber-600 dark:text-amber-400', icon: RotateCcw },
  expire: { label: 'Potekle', color: 'text-red-600 dark:text-red-400', icon: TrendingUp },
}

export const transactionBadgeStyles: Record<string, string> = {
  earn: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  redeem: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  adjust: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  expire: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

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
