// ============================================
// BLAGAJNA — Skupne tipi
// ============================================

export interface LiveStatsType {
  cashSales: number
  cardSales: number
  mobileSales: number
  splitPayments: number
  totalSales: number
  totalOrders: number
  totalDiscounts: number
  expectedCash: number
}

export interface ActiveShiftType {
  id: string
  employeeName: string
  openedAt: string
  startingCash: number
}

export interface RecentShiftType {
  id: string
  employeeName: string
  openedAt: string
  closedAt: string
  startingCash: number
  closingCash: number
  expectedCash: number
  cashDifference: number
  totalSales: number
  totalOrders: number
  cashSales: number
  cardSales: number
  notes: string
}

export interface OpenShiftFormType {
  startingCash: string
  employeeId: string
  employeeName: string
}

export interface CloseShiftFormType {
  closingCash: string
  notes: string
}

export interface EodFormType {
  closingCash: string
  notes: string
}
