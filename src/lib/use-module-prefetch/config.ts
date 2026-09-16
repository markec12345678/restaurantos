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
    // FIX (QA 2026-09-17, runda 3): '/api/kitchen/pacing' ne obstaja (404) —
    // useCoursePacing.ts bere iz /api/kitchen
    { queryKeys: queryKeys.kitchen.pacing, endpoint: '/api/kitchen' },
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
    // FIX (E2E 2026-09-17): ključ mora biti enak konsumerskemu
    // ([...queryKeys.inventory.all, filterCategory] v useInventoryQueries,
    // privzeti filter = 'all') — prej ['inventory'] ≠ ['inventory','all']
    // → PODVOJEN klic na /api/inventory ob vsaki odprtji modula (poraba rate limita)
    { queryKeys: [...queryKeys.inventory.all, 'all'], endpoint: '/api/inventory' },
    // FIX (E2E 2026-09-17): odstranjena mrtva vnosna točka /api/inventory/alerts —
    // ruta ne obstaja (405) in ključa ['notification-low-stock'] ne konzumira nihče
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
    // FIX (QA 2026-09-17, runda 3): '/api/z-reports' ne obstaja (404) — konsumer bere /api/z-report
    { queryKeys: queryKeys.zReport.all, endpoint: '/api/z-report' },
  ],
  shifts: [
    { queryKeys: queryKeys.shifts.all, endpoint: '/api/shifts' },
    // FIX (QA 2026-09-17, runda 3): odstranjena mrtva vrstica shifts.schedule —
    // konsumerjev ključ je [...schedule, from, to] (goli ključ se ne ujame) + endpoint 405
  ],
  locations: [
    { queryKeys: queryKeys.locations.all, endpoint: '/api/locations' },
    { queryKeys: queryKeys.locations.stats, endpoint: '/api/locations/stats' },
  ],
  delivery: [
    // FIX (QA 2026-09-17, runda 3): '/api/delivery-trackings' ne obstaja (404) — ruta je /api/delivery-tracking
    { queryKeys: queryKeys.delivery.tracking, endpoint: '/api/delivery-tracking' },
    // FIX (QA 2026-09-17, runda 3): odstranjena mrtva vrstica onlineOrders —
    // ključ konsumerja vsebuje filter (se ne ujame) + '/api/online-orders-admin' je 404
    { queryKeys: queryKeys.delivery.zones, endpoint: '/api/delivery-zones' },
  ],
  furs: [
    // FIX (QA 2026-09-17, runda 3): endpointa sta morala biti ista kot v FursManager.tsx —
    // prej '/api/furs/settings' in '/api/furs/status' → 404 ob vsaki obiski modula
    // (mrtev promet + odvečna 404 napaka v cache-u konsumerja)
    { queryKeys: queryKeys.furs.settings, endpoint: '/api/settings' },
    { queryKeys: queryKeys.furs.status, endpoint: '/api/furs' },
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
    // FIX (QA 2026-09-17, runda 3): '/api/feedback' ne obstaja (404) — konsumer bere /api/guests/feedback
    { queryKeys: queryKeys.feedback.all, endpoint: '/api/guests/feedback' },
  ],
  expenses: [
    { queryKeys: queryKeys.expenses.all, endpoint: '/api/expenses' },
  ],
  recipes: [
    { queryKeys: queryKeys.recipes.all, endpoint: '/api/recipes' },
  ],
}
