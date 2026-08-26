// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Skupne konstante za P&L porocilo
// ═══════════════════════════════════════════════════════════════

// ─── Tipi ──────────────────────────────────────────────────────

export interface PnLData {
  period: string
  periodStart: string
  periodEnd: string
  revenue: {
    food: number
    beverages: number
    delivery: number
    other: number
    total: number
  }
  costOfGoods: {
    food: number
    beverages: number
    total: number
  }
  grossProfit: number
  grossMargin: number
  operatingExpenses: {
    labor: number
    rent: number
    utilities: number
    marketing: number
    supplies: number
    maintenance: number
    insurance: number
    other: number
    total: number
  }
  operatingProfit: number
  operatingMargin: number
  otherIncome: number
  otherExpenses: number
  netProfit: number
  netMargin: number
  covers: number
  avgCheck: number
}

export type PnLPeriod = 'today' | 'week' | 'month' | 'quarter'

// ─── Konstante ─────────────────────────────────────────────────

export const PERIOD_LABELS: Record<PnLPeriod, string> = {
  today: 'Danes',
  week: 'Teden',
  month: 'Mesec',
  quarter: 'Cetrtletje',
}

export const PERIOD_NAMES: Record<PnLPeriod, string> = {
  today: 'Danes',
  week: 'Ta teden',
  month: 'Ta mesec',
  quarter: 'To cetrtletje',
}

// ─── Pomozne funkcije ──────────────────────────────────────────

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(amount)
}

export const formatPercent = (value: number): string => {
  return `${value.toFixed(1)}%`
}

// ─── Props vmesniki za podkomponente ───────────────────────────

export interface PnlHeaderProps {
  period: PnLPeriod
  onPeriodChange: (_period: PnLPeriod) => void
  isProfitable: boolean
  periodName: string
}

export interface KpiCardsProps {
  data: PnLData
  isProfitable: boolean
}

export interface SummaryTabProps {
  data: PnLData
  isProfitable: boolean
}

export interface RevenueTabProps {
  data: PnLData
}

export interface ExpensesTabProps {
  data: PnLData
}
