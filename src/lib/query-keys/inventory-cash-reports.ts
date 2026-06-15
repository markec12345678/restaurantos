// ============================================
// QUERY KEYS — Inventar, Blagajna, Poročila, Dashboard, Rezervacije
// ============================================

export const inventoryKeys = {
  all: ['inventory'] as const,
  categories: ['inventory-categories'] as const,
  brief: ['inventory-brief'] as const,
  stockDashboard: ['inventory', 'stock-dashboard'] as const,
  menuStock: ['menu-stock'] as const,
  forecast: ['inventory-forecast'] as const,
  reorder: ['inventory-reorder'] as const,
  transactions: ['inventory-transactions'] as const,
  lowStock: ['notification-low-stock'] as const,
}

export const cashRegisterKeys = {
  all: ['cash-register'] as const,
}

export const endOfDayKeys = {
  all: ['end-of-day'] as const,
}

export const reportsKeys = {
  financial: (params?: Record<string, unknown>) => ['financial-report', params] as const,
  sales: (params?: Record<string, unknown>) => ['sales-report', params] as const,
  popular: (params?: Record<string, unknown>) => ['popular-items', params] as const,
  vat: (params?: Record<string, unknown>) => ['vat-report', params] as const,
  shifts: (params?: Record<string, unknown>) => ['shift-report', params] as const,
  employees: (params?: Record<string, unknown>) => ['employee-report', params] as const,
  heatmap: (period: string, refDate: string) => ['financial-report-heatmap', period, refDate] as const,
  tableRevenue: (period: string, refDate: string) => ['financial-report-tables', period, refDate] as const,
  tips: (period: string, refDate: string) => ['financial-report-tips', period, refDate] as const,
}

export const dashboardKeys = {
  all: ['dashboard'] as const,
}

export const reservationsKeys = {
  all: ['reservations'] as const,
  upcoming: ['reservations', 'upcoming'] as const,
  upcomingAdmin: ['reservations-upcoming'] as const,
}
