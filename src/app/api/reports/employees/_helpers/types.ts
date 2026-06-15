// Tipi za poročilo po zaposlenih

// ─── Tipi ───

export interface EmployeeStatsEntry {
  employeeId: string
  employeeName: string
  role: string
  orderCount: number
  totalRevenue: number
  totalSubtotal: number
  totalTax: number
  totalDiscount: number
  totalTips: number
  avgOrderValue: number
  itemsSold: number
  voidedItems: number
  categoryBreakdown: Record<string, { category: string; revenue: number; quantity: number }>
  hourlyBreakdown: Record<string, { hour: string; revenue: number; orders: number }>
  topItems: Record<string, { name: string; quantity: number; revenue: number }>
}

export function createEmptyStats(employeeId: string, name: string, role: string): EmployeeStatsEntry {
  return {
    employeeId,
    employeeName: name,
    role,
    orderCount: 0,
    totalRevenue: 0,
    totalSubtotal: 0,
    totalTax: 0,
    totalDiscount: 0,
    totalTips: 0,
    avgOrderValue: 0,
    itemsSold: 0,
    voidedItems: 0,
    categoryBreakdown: {},
    hourlyBreakdown: {},
    topItems: {},
  }
}

// ─── Skupni seštevek ───

export interface EmployeeTotals {
  totalRevenue: number
  totalTips: number
  totalOrders: number
  totalItemsSold: number
  totalVoidedItems: number
  avgOrderValue: number
  employeeCount: number
}
