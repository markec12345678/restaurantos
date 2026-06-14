// ============================================
// CENTRALIZIRANI QUERY KEY FACTORY ZA RESTAURANTOS
// Poenotene tipke za React Query invalidacijo in predpomnjenje
// ============================================

/**
 * Strukturirane query tipke po domenu.
 *
 * Uporaba:
 *   useQuery({ queryKey: queryKeys.orders.all, ... })
 *   queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
 *   queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(id) })
 *   queryClient.invalidateQueries({ queryKey: queryKeys.reports.financial() })
 */

export const queryKeys = {
  // ---- Naročila ----
  orders: {
    all: ['orders'] as const,
    byStatus: (status: string) => ['orders', { status }] as const,
    byTable: (tableId: string) => ['orders', { tableId }] as const,
    active: ['active-orders'] as const,
    stats: ['order-stats'] as const,
    sidebar: ['sidebar-orders'] as const,
    waiter: ['waiter-orders'] as const,
    kds: ['kds-orders'] as const,
  },

  // ---- Kuhinja ----
  kitchen: {
    all: ['kitchen'] as const,
    pacing: ['kitchen-pacing'] as const,
    prepQueue: ['kitchen-prep-queue'] as const,
  },

  // ---- Meni ----
  menus: {
    all: ['menus'] as const,
  },
  categories: {
    all: ['categories'] as const,
  },
  menuItems: {
    all: ['menu-items'] as const,
    allergens: ['menu-items-allergens'] as const,
  },
  modifierGroups: {
    all: ['modifier-groups'] as const,
  },

  // ---- Mize ----
  tables: {
    all: ['tables'] as const,
    orders: (tableId: string) => ['table-orders', tableId] as const,
    turnover: ['tables-turnover'] as const,
    turnoverByPeriod: (period: string) => ['orders-turnover', period] as const,
  },

  // ---- Zaposleni ----
  employees: {
    all: ['employees'] as const,
    performance: (period: string) => ['staff-performance', period] as const,
  },
  shifts: {
    all: ['shifts'] as const,
    schedule: ['shifts-schedule'] as const,
    scheduleEmployees: ['schedule-employees'] as const,
    timeEntries: ['time-entries'] as const,
  },
  jobs: {
    all: ['jobs'] as const,
  },

  // ---- Inventar ----
  inventory: {
    all: ['inventory'] as const,
    categories: ['inventory-categories'] as const,
    brief: ['inventory-brief'] as const,
    stockDashboard: ['inventory', 'stock-dashboard'] as const,
    menuStock: ['menu-stock'] as const,
    forecast: ['inventory-forecast'] as const,
    reorder: ['inventory-reorder'] as const,
    transactions: ['inventory-transactions'] as const,
    lowStock: ['notification-low-stock'] as const,
  },

  // ---- Blagajna ----
  cashRegister: {
    all: ['cash-register'] as const,
  },
  endOfDay: {
    all: ['end-of-day'] as const,
  },

  // ---- Poročila ----
  reports: {
    financial: (params?: Record<string, unknown>) => ['financial-report', params] as const,
    sales: (params?: Record<string, unknown>) => ['sales-report', params] as const,
    popular: (params?: Record<string, unknown>) => ['popular-items', params] as const,
    vat: (params?: Record<string, unknown>) => ['vat-report', params] as const,
    shifts: (params?: Record<string, unknown>) => ['shift-report', params] as const,
    employees: (params?: Record<string, unknown>) => ['employee-report', params] as const,
    heatmap: (period: string, refDate: string) => ['financial-report-heatmap', period, refDate] as const,
    tableRevenue: (period: string, refDate: string) => ['financial-report-tables', period, refDate] as const,
    tips: (period: string, refDate: string) => ['financial-report-tips', period, refDate] as const,
  },

  // ---- Dashboard ----
  dashboard: {
    all: ['dashboard'] as const,
  },

  // ---- Rezervacije ----
  reservations: {
    all: ['reservations'] as const,
    upcoming: ['reservations', 'upcoming'] as const,
    upcomingAdmin: ['reservations-upcoming'] as const,
  },

  // ---- Plačila ----
  altPayments: {
    all: ['alt-payments'] as const,
    types: ['alt-payment-types'] as const,
  },
  checks: {
    all: ['checks'] as const,
  },

  // ---- Darilne kartice ----
  giftCards: {
    all: ['gift-cards'] as const,
  },

  // ---- Zvestoba ----
  loyalty: {
    all: ['loyalty'] as const,
    search: (query: string) => ['loyalty', { query }] as const,
  },

  // ---- Namigi ----
  tipPool: {
    all: ['tip-pools'] as const,
    byDate: (date: string) => ['tip-pool', date] as const,
  },

  // ---- Konfiguracija ----
  configuration: {
    byTab: (tab: string) => ['configuration', tab] as const,
    settings: ['settings'] as const,
    priceGroups: ['price-groups'] as const,
    priceGroupsHH: ['price-groups-hh'] as const,
    happyHourConfig: ['happy-hour-config'] as const,
    openingHours: ['opening-hours'] as const,
    happyHourStatus: ['happy-hour-status'] as const,
  },

  // ---- Dostava ----
  delivery: {
    tracking: ['delivery-trackings'] as const,
    onlineOrders: ['online-orders-admin'] as const,
    zones: ['delivery-zones'] as const,
    unassigned: ['unassigned-deliveries'] as const,
  },

  // ---- Lokacije ----
  locations: {
    all: ['locations'] as const,
    stats: ['location-stats'] as const,
  },

  // ---- Dobavitelji ----
  suppliers: {
    all: ['suppliers'] as const,
  },
  purchaseOrders: {
    all: ['purchase-orders'] as const,
  },

  // ---- HACCP ----
  haccp: {
    all: ['haccp'] as const,
  },

  // ---- FURS ----
  furs: {
    settings: ['furs-settings'] as const,
    status: ['furs-status'] as const,
    batchStatus: ['furs-batch-status'] as const,
  },

  // ---- Računi ----
  receipt: {
    all: ['receipt'] as const,
    byOrder: (orderId: string) => ['receipt', orderId] as const,
  },

  // ---- Z-report ----
  zReport: {
    all: ['z-reports'] as const,
    current: ['z-report'] as const,
  },

  // ---- Avtentikacija ----
  auth: {
    status: ['auth-status'] as const,
  },

  // ---- Webhook ----
  webhooks: {
    all: ['webhooks'] as const,
  },

  // ---- Integracije ----
  integrations: {
    all: ['integrations'] as const,
  },

  // ---- Ostalo ----
  expenses: {
    all: ['expenses'] as const,
  },
  feedback: {
    all: ['feedback'] as const,
  },
  dailyChecklist: {
    all: ['daily-checklist'] as const,
  },
  discounts: {
    all: ['discounts'] as const,
    active: ['discounts-active'] as const,
  },
  diningOptions: {
    all: ['dining-options'] as const,
  },
  voidReasons: {
    all: ['void-reasons'] as const,
  },
  recipes: {
    all: ['recipes'] as const,
  },
  subscription: {
    all: ['subscription'] as const,
  },
  waitlist: {
    all: ['waitlist'] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    orders: ['notification-orders'] as const,
  },
  menuEngineering: {
    all: ['menu-engineering'] as const,
  },
  menuItemNutrition: {
    all: ['menu-items-nutrition'] as const,
  },
  recentOrders7d: {
    all: ['recent-orders-7d'] as const,
  },
} as const

/** Tip za typeof queryKeys — uporaben za generične funkcije */
export type QueryKeys = typeof queryKeys
