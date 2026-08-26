// ============================================
// OCENJEVANJE DOBAVITELJEV — Skupne konstante in tipi
// ============================================

import type { LucideIcon } from 'lucide-react'
import { CheckCircle, AlertTriangle, BarChart3 } from 'lucide-react'

// --- TIPI ---

export interface SupplierMetrics {
  onTimeDelivery: number   // 0-100
  qualityRating: number    // 0-100
  priceCompetitiveness: number // 0-100
  responsiveness: number   // 0-100
  orderAccuracy: number    // 0-100
}

export interface SupplierScore {
  id: string
  name: string
  contactPerson: string | null
  phone: string | null
  email: string | null
  category: string
  overallScore: number // 0-100
  metrics: SupplierMetrics
  totalOrders: number
  totalSpent: number
  avgDeliveryDays: number
  lastOrderDate: string | null
  trend: 'up' | 'down' | 'stable'
  recentIssues: string[]
  tier: 'preferred' | 'standard' | 'probation'
}

export type SortBy = 'score' | 'delivery' | 'quality' | 'price'

export interface TierConfig {
  label: string
  color: string
  icon: LucideIcon
}

// --- POMOŽNE FUNKCIJE ---

export const TIER_CONFIG: Record<string, TierConfig> = {
  preferred: { label: 'Prednostni', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
  standard: { label: 'Standardni', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: BarChart3 },
  probation: { label: 'Na preizkusu', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: AlertTriangle },
}

export function getScoreColor(score: number): string {
  if (score >= 85) return 'text-green-600'
  if (score >= 70) return 'text-amber-600'
  return 'text-red-600'
}

export function getScoreBg(score: number): string {
  if (score >= 85) return 'bg-green-500'
  if (score >= 70) return 'bg-amber-500'
  return 'bg-red-500'
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(amount)
}

// --- PROPS INTERFACI ZA POD-KOMPONENTE ---

export interface VendorSummaryCardsProps {
  supplierCount: number
  avgScore: number
  preferredCount: number
  probationCount: number
}

export interface VendorSortBarProps {
  sortBy: SortBy
  onSortChange: (_sortBy: SortBy) => void
}

export interface SupplierCardProps {
  supplier: SupplierScore
  rank: number
}
