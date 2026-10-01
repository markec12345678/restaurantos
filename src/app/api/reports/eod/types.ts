// =====================================================================
// R191 (epik #144 P2 faza — tech debt sweep): kanonska WIRE oblika odziva
// GET /api/reports/eod — vir resnice za EOD komponente.
//
// Prej: vseh 10 EOD komponent v src/components/pos/cash-register/ je
// deklariralo lokalni `type EodData = any` alias — odzivna oblika API-ja je
// bila nevidna tsc in VSCode (maintenance + evidence debt po epikovi
// definiciji koraka 23).
//
// OBLIKA = WIRE format (JSON po serializaciji):
//   - Decimal polja prek deepToNumbers → number (metrics.ts :100)
//   - Date polja prek NextResponse.json → string
//   - employeeBreakdown: enrichEmployeeNames vrača Object.values().sort()
//     → ARRAY (ne Record iz computeEodMetrics)
//   - activeShift: podmnožica CashRegisterShift po deepToNumbers
//
// Potrošniki: EodDialog, EodCloseForm, EodPendingWarning, EodSummaryStats,
// EodVatBreakdown, EodPaymentMethods, EodCostAnalysis, EodEmployeeBreakdown,
// eod-summary-sections (EodSections re-export), eod-close-section.
// Drift-gate: tests/unit/security/r191-eod-wire-types.test.ts
// =====================================================================

// ─── summary: iz computeEodMetrics (metrics.ts :88-93) ───
export interface EodSummaryData {
  totalOrders: number
  completedOrders: number
  cancelledOrders: number
  pendingOrders: number
  paidOrders: number
  totalRevenue: number
  totalSubtotal: number
  totalTax: number
  totalDiscount: number
  totalTips: number
  totalWithTips: number
  avgOrderValue: number
  cancelledRevenue: number
}

// ─── DDV razčlenitev: Array<{ base, vat, rate }> (metrics.ts :94) ───
export interface EodVatRow {
  base: number
  vat: number
  rate: number
}

// ─── Plačilne metode: Array<{ method, count, revenue, tips }> (metrics.ts :95) ───
export interface EodPaymentMethodRow {
  method: string
  count: number
  revenue: number
  tips: number
}

// ─── Po zaposlenih: enrichEmployeeNames → Object.values().sort() (secondary-queries.ts :48) ───
export interface EodEmployeeRow {
  employeeId: string
  orderCount: number
  revenue: number
  tips: number
  employeeName?: string
}

// ─── Po urah: 24 slotov (metrics.ts :66-68) ───
export interface EodHourlyRow {
  hour: number
  revenue: number
  orders: number
}

// ─── Kategorije: computeCategoryBreakdown (secondary-queries.ts :12) ───
export interface EodCategoryRow {
  category: string
  quantity: number
  revenue: number
  menu: string
}

// ─── Voidani artikli (metrics.ts :80-82) ───
export interface EodVoidedItemRow {
  name: string
  quantity: number
  price: number
}

// ─── Stroški (metrics.ts :98) ───
export interface EodCostsData {
  procurementCost: number
  writeOffCost: number
  cogs: number
  grossProfit: number
  grossMargin: number
}

// ─── Aktivna izmena: podmnožica CashRegisterShift po deepToNumbers + JSON
// (Decimal → number, DateTime → string). Polna oblika ima več polj — ta
// interface opisuje GARANTIRANO podmnožico, ki jo bere UI. ───
export interface EodActiveShiftData {
  id: string
  status: string
  openedAt: string
  closedAt: string | null
  startingCash: number
  cashSales: number
  cardSales: number
  totalSales: number
  totalOrders: number
}

// ─── Polni odziv GET /api/reports/eod (route.ts :68-80) ───
export interface EodReportData {
  date: string
  summary: EodSummaryData
  vatBreakdown: EodVatRow[]
  paymentMethods: EodPaymentMethodRow[]
  categoryBreakdown: EodCategoryRow[]
  employeeBreakdown: EodEmployeeRow[]
  hourlyBreakdown: EodHourlyRow[]
  costs: EodCostsData
  voidedItems: EodVoidedItemRow[]
  activeShift: EodActiveShiftData | null
  isDayClosed: boolean
}
