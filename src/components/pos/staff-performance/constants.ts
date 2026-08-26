// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Skupne konstante za analitiko učinkovitosti zaposlenih
// ═══════════════════════════════════════════════════════════════

import type { LucideIcon } from 'lucide-react'
import { Users, ChefHat, Wine, Award, Coffee, UtensilsCrossed } from 'lucide-react'

// ─── Tipi ──────────────────────────────────────────────────────

export interface PerformanceEmployee {
  employeeId: string
  employeeName: string
  role: string
  jobs: string[]
  totalOrders: number
  totalRevenue: number
  totalTips: number
  avgOrderValue: number
  avgServiceTime: number
  tableTurnover: number
  upsellRate: number
  revenuePerHour: number
  hoursWorked: number
  voidRate: number
  orderTypeBreakdown: { dineIn: number; takeout: number; delivery: number }
  shiftsWorked: number
  performanceScore: number
}

export interface PerformanceData {
  period: string
  startDate: string
  endDate: string
  employees: PerformanceEmployee[]
  totals: {
    totalRevenue: number
    totalTips: number
    totalOrders: number
    avgServiceTime: number
    avgPerformanceScore: number
  }
}

// ─── Konstante ─────────────────────────────────────────────────

export const ROLE_ICONS: Record<string, LucideIcon> = {
  server: UtensilsCrossed,
  chef: ChefHat,
  bartender: Wine,
  host: Users,
  manager: Award,
  prep: Coffee,
}

export const ROLE_LABELS: Record<string, string> = {
  server: 'Natakar(ka)',
  chef: 'Kuhar(ica)',
  bartender: 'Barman/ka',
  host: 'Gostitelj(ica)',
  manager: 'Vodja',
  prep: 'Pripravnik(ica)',
  staff: 'Osebje',
  admin: 'Admin',
}

export const PERIOD_LABELS: Record<string, string> = {
  today: 'Danes',
  week: 'Zadnji teden',
  month: 'Ta mesec',
}

// ─── Pomožne funkcije ──────────────────────────────────────────

export const getScoreColor = (score: number): string => {
  if (score >= 80) return 'text-emerald-600'
  if (score >= 60) return 'text-blue-600'
  if (score >= 40) return 'text-amber-600'
  return 'text-red-600'
}

export const getScoreBg = (score: number): string => {
  if (score >= 80) return 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-800'
  if (score >= 60) return 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-800'
  if (score >= 40) return 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-800'
  return 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-800'
}

export const getScoreBadge = (score: number): string => {
  if (score >= 80) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
  if (score >= 60) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
  if (score >= 40) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
  return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
}

// ─── Props vmesniki za podkomponente ───────────────────────────

export interface PerformanceHeaderProps {
  period: string
  onPeriodChange: (_period: string) => void
}

export interface KpiSummaryCardsProps {
  totals: PerformanceData['totals'] | undefined
}

export interface TopPerformerCardsProps {
  topPerformer: PerformanceEmployee | undefined
  mostTips: PerformanceEmployee | undefined
  fastest: PerformanceEmployee | undefined
  bestUpseller: PerformanceEmployee | undefined
}

export interface EmployeeListProps {
  employees: PerformanceEmployee[]
}

export interface RecommendationsSectionProps {
  employees: PerformanceEmployee[]
  topPerformer: PerformanceEmployee | undefined
}
