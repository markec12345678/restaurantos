// ═══════════════════════════════════════════════════════════════
// RestaurantOS — EOD skupne tipi, konstante in pomožne funkcije
// ═══════════════════════════════════════════════════════════════

export interface EODData {
  date: string
  eodCompleted: boolean
  orders: { total: number; completed: number; cancelled: number; revenue: number; avgOrderValue: number }
  payments: { byMethod: Record<string, { count: number; total: number; tips: number }>; totalTips: number; totalPayments: number }
  vat: Record<string, { base: number; vat: number }>
  furs: { verified: number; queued: number; failed: number; allVerified: boolean }
  shift: { id: string; startingCash: number; cashSales: number; cardSales: number; totalSales: number; cashDiff: number; isClosed: boolean } | null
  reservations: { total: number; confirmed: number; noShow: number }
  guests: { newToday: number }
  expenses: { total: number; count: number }
  netProfit: number
  topItems: Array<{ name: string; quantity: number; revenue: number }>
}

export interface EodChecklistProps {
  eodChecks: Array<{ label: string; done: boolean }>
  completedChecks: number
  allChecksDone: boolean
  onToggleCash: () => void
  onToggleChecklist: () => void
}

export interface EodKpiCardsProps {
  data: EODData
}

export interface EodSectionsProps {
  data: EODData
  expandedSections: Set<string>
  onToggleSection: (_section: string) => void
}

export interface CloseDayDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  actualCash: string
  onActualCashChange: (_value: string) => void
  eodNotes: string
  onEodNotesChange: (_value: string) => void
  expectedCash: number
  startingCash: number
  cashSales: number
  isPending: boolean
  onConfirm: () => void
}
