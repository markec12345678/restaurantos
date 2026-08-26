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

import { ordersKeys, kitchenKeys, menusKeys, categoriesKeys, menuItemsKeys, modifierGroupsKeys, tablesKeys, employeesKeys, shiftsKeys, jobsKeys } from './orders-menu-staff'
import { inventoryKeys, cashRegisterKeys, endOfDayKeys, reportsKeys, dashboardKeys, reservationsKeys } from './inventory-cash-reports'
import { altPaymentsKeys, checksKeys, giftCardsKeys, loyaltyKeys, tipPoolKeys, configurationKeys } from './payments-loyalty-config'
import { deliveryKeys, locationsKeys, suppliersKeys, purchaseOrdersKeys, haccpKeys, fursKeys, receiptKeys, zReportKeys, authKeys, webhooksKeys, integrationsKeys, expensesKeys, feedbackKeys, dailyChecklistKeys, discountsKeys, diningOptionsKeys, voidReasonsKeys, recipesKeys, subscriptionKeys, waitlistKeys, notificationsKeys, menuEngineeringKeys, menuItemNutritionKeys, recentOrders7dKeys } from './delivery-misc'

export const queryKeys = {
  // ---- Naročila ----
  orders: ordersKeys,
  // ---- Kuhinja ----
  kitchen: kitchenKeys,
  // ---- Meni ----
  menus: menusKeys,
  categories: categoriesKeys,
  menuItems: menuItemsKeys,
  modifierGroups: modifierGroupsKeys,
  // ---- Mize ----
  tables: tablesKeys,
  // ---- Zaposleni ----
  employees: employeesKeys,
  shifts: shiftsKeys,
  jobs: jobsKeys,
  // ---- Inventar ----
  inventory: inventoryKeys,
  // ---- Blagajna ----
  cashRegister: cashRegisterKeys,
  endOfDay: endOfDayKeys,
  // ---- Poročila ----
  reports: reportsKeys,
  // ---- Dashboard ----
  dashboard: dashboardKeys,
  // ---- Rezervacije ----
  reservations: reservationsKeys,
  // ---- Plačila ----
  altPayments: altPaymentsKeys,
  checks: checksKeys,
  // ---- Darilne kartice ----
  giftCards: giftCardsKeys,
  // ---- Zvestoba ----
  loyalty: loyaltyKeys,
  // ---- Namigi ----
  tipPool: tipPoolKeys,
  // ---- Konfiguracija ----
  configuration: configurationKeys,
  // ---- Dostava ----
  delivery: deliveryKeys,
  // ---- Lokacije ----
  locations: locationsKeys,
  // ---- Dobavitelji ----
  suppliers: suppliersKeys,
  purchaseOrders: purchaseOrdersKeys,
  // ---- HACCP ----
  haccp: haccpKeys,
  // ---- FURS ----
  furs: fursKeys,
  // ---- Računi ----
  receipt: receiptKeys,
  // ---- Z-report ----
  zReport: zReportKeys,
  // ---- Avtentikacija ----
  auth: authKeys,
  // ---- Webhook ----
  webhooks: webhooksKeys,
  // ---- Integracije ----
  integrations: integrationsKeys,
  // ---- Ostalo ----
  expenses: expensesKeys,
  feedback: feedbackKeys,
  dailyChecklist: dailyChecklistKeys,
  discounts: discountsKeys,
  diningOptions: diningOptionsKeys,
  voidReasons: voidReasonsKeys,
  recipes: recipesKeys,
  subscription: subscriptionKeys,
  waitlist: waitlistKeys,
  notifications: notificationsKeys,
  menuEngineering: menuEngineeringKeys,
  menuItemNutrition: menuItemNutritionKeys,
  recentOrders7d: recentOrders7dKeys,
} as const

/** Tip za typeof queryKeys — uporaben za generične funkcije */
export type QueryKeys = typeof queryKeys
