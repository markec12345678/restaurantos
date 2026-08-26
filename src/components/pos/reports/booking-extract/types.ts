// ============================================
// TIPI ZA IZPISKE ZA KNJIŽENJE
// ============================================

export interface FinancialSummary {
  totalRevenue: number
  totalSubtotal: number
  totalTax: number
  totalDiscount: number
  totalOrdersCount: number
  completedCount: number
  cancelledCount: number
  avgOrderValue: number
}

export interface PaymentMethodEntry {
  method: string
  count: number
  revenue: number
  tax: number
}

export interface OrderTypeEntry {
  type: string
  count: number
  revenue: number
}

export interface CostsData {
  procurementCost: number
  cogs: number
  writeOffCost: number
  grossProfit: number
  grossMargin: number
}

export interface BookingEntry {
  debit: Record<string, number>
  credit: Record<string, number>
  totalDebit: number
  totalCredit: number
}

export interface CategoryBreakdown {
  category: string
  quantity: number
  revenue: number
  items: number
}

export interface ItemBreakdown {
  name: string
  category: string
  quantity: number
  revenue: number
  avgPrice: number
}

export interface FinancialData {
  periodLabel: string
  summary: FinancialSummary
  paymentMethods: PaymentMethodEntry[]
  orderTypes: OrderTypeEntry[]
  costs: CostsData
  bookingEntry: BookingEntry
  categoryBreakdown: CategoryBreakdown[]
  itemBreakdown: ItemBreakdown[]
}
