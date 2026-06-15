'use client'

// ============================================
// MODULE PREFETCH — TIPI IN KONFIGURACIJA
// ============================================

import { queryKeys } from '@/lib/query-keys'

export type ModuleName = string

export interface PrefetchConfig {
  /** Query ključi za prefetch */
  queryKeys: readonly unknown[]
  /** API endpoint za prefetch (uporablja authFetch) */
  endpoint?: string
  /** Ali naj se prefetch izvede samo enkrat na sejo (default: false) */
  once?: boolean
}

/**
 * Definira, katere poizvedbe naj se prednaložijo ob preklopu na posamezen modul.
 * Uporablja queryKeys factory za konsistentne tipke.
 *
 * Načelo: ko uporabnik klikne na modul v stranski vrstici, se podatki
 * za ta modul začnejo nalagati še preden se komponenta montira.
 */
export const modulePrefetchMap: Record<ModuleName, PrefetchConfig[]> = {
  dashboard: [
    { queryKeys: queryKeys.dashboard.all, endpoint: '/api/dashboard' },
    { queryKeys: queryKeys.orders.stats, endpoint: '/api/orders/stats' },
  ],
  orders: [
    { queryKeys: queryKeys.orders.all, endpoint: '/api/orders' },
    { queryKeys: queryKeys.menus.all, endpoint: '/api/menus' },
    { queryKeys: queryKeys.categories.all, endpoint: '/api/categories' },
    { queryKeys: queryKeys.menuItems.all, endpoint: '/api/menu-items' },
    { queryKeys: queryKeys.tables.all, endpoint: '/api/tables' },
  ],
  kitchen: [
    { queryKeys: queryKeys.kitchen.all, endpoint: '/api/kitchen' },
    { queryKeys: queryKeys.kitchen.pacing, endpoint: '/api/kitchen/pacing' },
  ],
  tables: [
    { queryKeys: queryKeys.tables.all, endpoint: '/api/tables' },
    { queryKeys: queryKeys.orders.all, endpoint: '/api/orders' },
  ],
  'cash-register': [
    { queryKeys: queryKeys.cashRegister.all, endpoint: '/api/cash-register' },
    { queryKeys: queryKeys.orders.all, endpoint: '/api/orders' },
  ],
  inventory: [
    { queryKeys: queryKeys.inventory.all, endpoint: '/api/inventory' },
    { queryKeys: queryKeys.inventory.lowStock, endpoint: '/api/inventory/alerts' },
  ],
  reports: [
    { queryKeys: queryKeys.reports.financial(), endpoint: '/api/reports/financial' },
  ],
  menu: [
    { queryKeys: queryKeys.menus.all, endpoint: '/api/menus' },
    { queryKeys: queryKeys.categories.all, endpoint: '/api/categories' },
    { queryKeys: queryKeys.menuItems.all, endpoint: '/api/menu-items' },
    { queryKeys: queryKeys.modifierGroups.all, endpoint: '/api/modifier-groups' },
  ],
  employees: [
    { queryKeys: queryKeys.employees.all, endpoint: '/api/employees' },
    { queryKeys: queryKeys.shifts.all, endpoint: '/api/shifts' },
    { queryKeys: queryKeys.jobs.all, endpoint: '/api/jobs' },
  ],
  reservations: [
    { queryKeys: queryKeys.reservations.all, endpoint: '/api/reservations' },
    { queryKeys: queryKeys.tables.all, endpoint: '/api/tables' },
  ],
  'gift-cards': [
    { queryKeys: queryKeys.giftCards.all, endpoint: '/api/gift-cards' },
  ],
  loyalty: [
    { queryKeys: queryKeys.loyalty.all, endpoint: '/api/loyalty' },
  ],
  suppliers: [
    { queryKeys: queryKeys.suppliers.all, endpoint: '/api/suppliers' },
    { queryKeys: queryKeys.purchaseOrders.all, endpoint: '/api/purchase-orders' },
  ],
  haccp: [
    { queryKeys: queryKeys.haccp.all, endpoint: '/api/haccp' },
  ],
  'end-of-day': [
    { queryKeys: queryKeys.endOfDay.all, endpoint: '/api/end-of-day' },
    { queryKeys: queryKeys.zReport.all, endpoint: '/api/z-reports' },
  ],
  shifts: [
    { queryKeys: queryKeys.shifts.all, endpoint: '/api/shifts' },
    { queryKeys: queryKeys.shifts.schedule, endpoint: '/api/shifts/schedule' },
  ],
  locations: [
    { queryKeys: queryKeys.locations.all, endpoint: '/api/locations' },
    { queryKeys: queryKeys.locations.stats, endpoint: '/api/locations/stats' },
  ],
  delivery: [
    { queryKeys: queryKeys.delivery.tracking, endpoint: '/api/delivery-trackings' },
    { queryKeys: queryKeys.delivery.onlineOrders, endpoint: '/api/online-orders-admin' },
    { queryKeys: queryKeys.delivery.zones, endpoint: '/api/delivery-zones' },
  ],
  furs: [
    { queryKeys: queryKeys.furs.settings, endpoint: '/api/furs/settings' },
    { queryKeys: queryKeys.furs.status, endpoint: '/api/furs/status' },
  ],
  webhooks: [
    { queryKeys: queryKeys.webhooks.all, endpoint: '/api/webhooks' },
  ],
  integrations: [
    { queryKeys: queryKeys.integrations.all, endpoint: '/api/integrations' },
  ],
  configuration: [
    { queryKeys: queryKeys.configuration.byTab('general'), endpoint: '/api/configuration?tab=general' },
  ],
  feedback: [
    { queryKeys: queryKeys.feedback.all, endpoint: '/api/feedback' },
  ],
  expenses: [
    { queryKeys: queryKeys.expenses.all, endpoint: '/api/expenses' },
  ],
  recipes: [
    { queryKeys: queryKeys.recipes.all, endpoint: '/api/recipes' },
  ],
}
