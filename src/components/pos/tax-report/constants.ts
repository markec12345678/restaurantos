// ============================================
// TIPI IN KONSTANTE — Davčno poročilo
// ============================================

export interface TaxReportData {
  period: string
  periodStart: string
  periodEnd: string
  totalRevenue: number
  taxableRevenue: number
  exemptRevenue: number
  taxBreakdown: {
    rate: number
    label: string
    base: number
    tax: number
    total: number
  }[]
  totalTax: number
  totalWithTax: number
  fursSubmissions: number
  fursPending: number
  fursFailed: number
  zReportsCount: number
  dailyBreakdown: {
    date: string
    revenue: number
    tax: number
    zReport: boolean
  }[]
}

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(amount)
}
