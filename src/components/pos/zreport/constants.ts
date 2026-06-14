// ═══════════════════════════════════════════════════════════════
// TIPI, KONSTANTE IN POMOŽNE FUNKCIJE
// za podkomponente Z-poročila / dnevnega zaključka
// ═══════════════════════════════════════════════════════════════

import type { LucideIcon } from 'lucide-react'

// ─── Tipi ──────────────────────────────────────────────────────

export interface ZReportData {
  id: string
  reportDate: string
  openedAt: string
  closedAt: string | null
  totalSales: number
  totalNetSales: number
  totalTax: number
  cashSales: number
  cardSales: number
  mobileSales: number
  alternateSales: number
  dineInSales: number
  takeoutSales: number
  deliverySales: number
  vatStandard: number
  vatStandardAmount: number
  vatReduced: number
  vatReducedAmount: number
  vatZero: number
  totalOrders: number
  totalGuests: number
  avgOrderValue: number
  totalDiscounts: number
  totalTips: number
  totalVoided: number
  totalStorno: number
  startingCash: number
  expectedCash: number
  actualCash: number
  cashDifference: number
  totalCost: number
  grossProfit: number
  grossMargin: number
  status: string
  finalizedBy: string
  notes: string
}

// ─── Pomožne funkcije ──────────────────────────────────────────

/** Oblikuj znesek v valuti */
export function formatCurrency(val: number): string {
  return `€${(val || 0).toFixed(2)}`
}

// ═══════════════════════════════════════════════════════════════
// PROPS INTERFACES ZA POD-KOMPONENTE
// ═══════════════════════════════════════════════════════════════

export interface ZReportStatsProps {
  report: ZReportData
}

export interface StatItemProps {
  icon: LucideIcon
  label: string
  value: string
  color: string
}

export interface PaymentRowProps {
  icon: LucideIcon
  label: string
  value: number
  total: number
  color: string
}

export interface PaymentBreakdownProps {
  report: ZReportData
}

export interface VatCashSectionProps {
  report: ZReportData
}

export interface ProfitDiscountSectionProps {
  report: ZReportData
}

export interface ZReportCloseDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  report: ZReportData | null
  actualCash: string
  onActualCashChange: (_value: string) => void
  closeNotes: string
  onCloseNotesChange: (_value: string) => void
  onFinalize: () => void
  isPending: boolean
}

export interface ZReportHistoryProps {
  reports: ZReportData[]
  onSelectDate: (_date: string) => void
}
