'use client'

// ============================================
// MODULE PREFETCH HOOK ZA RESTAURANTOS
// Prednalaganje podatkov ob preklopu modula
// ============================================

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { authFetch } from '@/components/pos/PinLogin'
import { logger } from '@/lib/logger'

// ============================================
// TIPI
// ============================================

type ModuleName = string

interface PrefetchConfig {
  /** Query ključi za prefetch */
  queryKeys: readonly unknown[]
  /** API endpoint za prefetch (uporablja authFetch) */
  endpoint?: string
  /** Ali naj se prefetch izvede samo enkrat na sejo (default: false) */
  once?: boolean
}

// ============================================
// MAPIRANJE MODULOV NA PREFETCH KONFIGURACIJO
// ============================================

/**
 * Definira, katere poizvedbe naj se prednaložijo ob preklopu na posamezen modul.
 * Uporablja queryKeys factory za konsistentne tipke.
 *
 * Načelo: ko uporabnik klikne na modul v stranski vrstici, se podatki
 * za ta modul začnejo nalagati še preden se komponenta montira.
 */
const modulePrefetchMap: Record<ModuleName, PrefetchConfig[]> = {
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

// ============================================
// HOOK: useModulePrefetch
// ============================================

/**
 * Hook, ki ob preklopu modula prednaloži podatke z React Query prefetch.
 *
 * Delovanje:
 * 1. Sledi spremembam `activeModule` iz Zustand store-a
 * 2. Ob spremembi modula poišče ustrezne prefetch konfiguracije
 * 3. Za vsako konfiguracijo pokliče `queryClient.prefetchQuery()`
 * 4. Podatki so na voljo v predpomnilniku, ko se komponenta montira
 *
 * Prednosti:
 * - Uporabnik ne čaka na nalaganje podatkov ob preklopu modula
 * - React Query samodejno upravlja s predpomnilnikom (gcTime, staleTime)
 * - Ne vpliva na delovanje, če prefetch odpove — komponenta naloži podatke sama
 *
 * @param activeModule - Trenutno aktivni modul iz Zustand store-a
 */
export function useModulePrefetch(activeModule: ModuleName): void {
  const queryClient = useQueryClient()
  const prefetchedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const configs = modulePrefetchMap[activeModule]
    if (!configs || configs.length === 0) return

    for (const config of configs) {
      const cacheKey = JSON.stringify(config.queryKeys)

      // Če je `once: true`, preskoči že prefetchane ključe
      if (config.once && prefetchedRef.current.has(cacheKey)) continue

      // Označi kot prefetchan (tudi če še ni končan — prepreči podvojene klice)
      prefetchedRef.current.add(cacheKey)

      queryClient.prefetchQuery({
        queryKey: config.queryKeys as unknown[],
        queryFn: async () => {
          if (!config.endpoint) return null
          try {
            const res = await authFetch(config.endpoint)
            if (!res.ok) return null
            return res.json()
          } catch (error: unknown) {
            // Prefetch napake ne motijo uporabnika — tiho zabeleži
            logger.warn('Prefetch', `Napaka pri prefetch za ${activeModule}`, { error: error instanceof Error ? error.message : String(error) })
            return null
          }
        },
        // Uporabi krajši staleTime za prefetch — če uporabnik ne odpre modula, se cache hitro počisti
        staleTime: 60 * 1000, // 1 minuta
      }).catch(() => {
        // Tiho ignoriraj prefetch napake — ne vplivajo na uporabnika
      })
    }
  }, [activeModule, queryClient])
}

// ============================================
// HOOK: useSidebarHoverPrefetch
// ============================================

/**
 * Hook, ki prednaloži podatke, ko uporabnik hoverja nad gumbom modula v stranski vrstici.
 *
 * Hitrejši od čakanja na klik — podatki se začnejo nalagati
 * že ob hoverju, ki praviloma mine 100-300ms pred klikom.
 *
 * @returns Object s `onHover` handlerjem za uporabo v Sidebar
 */
export function useSidebarHoverPrefetch() {
  const queryClient = useQueryClient()
  const prefetchedRef = useRef<Set<string>>(new Set())

  const onModuleHover = (moduleName: ModuleName) => {
    const configs = modulePrefetchMap[moduleName]
    if (!configs || configs.length === 0) return

    for (const config of configs) {
      const cacheKey = JSON.stringify(config.queryKeys)

      // Preskoči že prefetchane (v zadnji minuti)
      if (prefetchedRef.current.has(cacheKey)) continue

      // Preveri, ali so podatki že v cache-u in sveži
      const cachedState = queryClient.getQueryState(config.queryKeys as unknown[])
      if (cachedState && cachedState.status === 'success' && Date.now() - (cachedState.dataUpdatedAt ?? 0) < 30_000) {
        continue
      }

      prefetchedRef.current.add(cacheKey)

      queryClient.prefetchQuery({
        queryKey: config.queryKeys as unknown[],
        queryFn: async () => {
          if (!config.endpoint) return null
          try {
            const res = await authFetch(config.endpoint)
            if (!res.ok) return null
            return res.json()
          } catch {
            return null
          }
        },
        staleTime: 60 * 1000,
      }).catch(() => {})

      // Počisti oznako po 2 minutah — dovoli ponovni prefetch
      setTimeout(() => {
        prefetchedRef.current.delete(cacheKey)
      }, 120_000)
    }
  }

  return { onModuleHover }
}
