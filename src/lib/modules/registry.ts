// ============================================
// CENTRAL MODULE REGISTRY (§6) — epic #144, P0 korak 3 (R173)
// ============================================
//
// Single source of truth za modulno metadata (§6 iz issue #144):
// vsak modul = ENA vrstica z group/domain/access/priority/relatedModules.
//
// Kanon (R173-b):
//   - ta register je VIR RESNICE za metadata; legacy konzumenti
//     (src/components/pos/sidebar/navItems.ts, src/app/components/
//     module-registry.tsx, Sidebar, CommandPalette) ostajajo klicatelji.
//     Drift-gate test (tests/unit/lib/module-registry.test.ts, 29 testov)
//     uveljavlja invarianto: register ≡ navItems ≡ moduleComponents ≡ i18n ×5.
//   - canAccessModule = Sidebar semantika (Sidebar.tsx:56–61 +
//     usePinAuth.ts hasPermission) — pariteta 8 uporabniških likov × 75
//     modulov je pin v drift-gate testu.
//   - DOKUMENTIRANE SODBE (avtorjeve, spreminjajo se z rundami):
//       · priority 'core'  = Golden Path semena (epic #144 §7) — 12 modulov
//       · priority 'long-tail' = specialistični moduli — 14
//       · domain = groba izpeljava iz skupine (DOMAIN_BY_GROUP)
//       · mobile = true za vse (per-module pregled = deferred, IA runda
//         P0 korak 4 — flag obstaja, sodba še ni fiksirana)
//       · standaloneRoute = samo tam, kjer obstaja standalone stran (/driver)
//   - PURE LIB: brez client-direktive, brez react in lucide importov (test
//     to uveljavlja) — register je varen za client, server in tsx skripte.
//
// Preklapljanje konzumentov NA register (Sidebar/palette iz registerja,
// KioskBarParts.moduleConfig divergenca, NavGroup.label i18n) = IA runda
// (P0 korak 4) — ta register je za zdaj verify-only vir resnice.
// ============================================

export type ModuleGroupId =
  | 'sales'
  | 'cash'
  | 'guests'
  | 'menu'
  | 'staff'
  | 'analytics'
  | 'system'

export type ModuleDomain =
  | 'sales'
  | 'finance'
  | 'crm'
  | 'operations'
  | 'insight'
  | 'platform'

export type ModulePriority = 'core' | 'secondary' | 'long-tail'

/** Dovoljenja — kanon 4 vrednosti (Sidebar/permissions Json) */
export type ModulePermission =
  | 'take_orders'
  | 'manage_cash'
  | 'manage_employees'
  | 'view_reports'

/** Minimalna oblika uporabnika za dostopna vrata (getCurrentUser()/§6) */
export interface ModuleAccessUser {
  role: string
  permissions: string[]
}

export interface ModuleGroup {
  id: ModuleGroupId
  /** Hardcoded SL label — ≡ navGroups.label (i18n = deferred, IA runda) */
  label: string
}

export interface ModuleMeta {
  id: string
  /** i18n ključ (≡ navItems.labelKey; nav.* ×5 jezikov) */
  labelKey: string
  /** lucide-react ikona IME (≡ navItems.icon; string, ne komponenta — pure lib) */
  icon: string
  group: ModuleGroupId
  /** izpeljano iz DOMAIN_BY_GROUP pri izgradni MODULE_REGISTRY */
  domain: ModuleDomain
  permission?: ModulePermission
  adminOnly?: boolean
  /** defaults true — per-module sodba deferred (IA runda, P0 korak 4) */
  mobile: boolean
  priority: ModulePriority
  /** povezani moduli (cilji MORAJO obstajati — drift-gate test) */
  relatedModules: string[]
  /** standalone stran, če obstaja (npr. /driver) */
  standaloneRoute?: string
}

/** RAW vnos = ModuleMeta brez izpeljanih polj (domain, mobile) */
type RawModule = Omit<ModuleMeta, 'domain' | 'mobile'>

export const MODULE_GROUPS: readonly ModuleGroup[] = [
  { id: 'sales', label: 'Prodaja' },
  { id: 'cash', label: 'Blagajna' },
  { id: 'guests', label: 'Gosti & CRM' },
  { id: 'menu', label: 'Meni & zaloge' },
  { id: 'staff', label: 'Osebje' },
  { id: 'analytics', label: 'Analitika' },
  { id: 'system', label: 'Sistem' },
] as const

/** Groba domena = izpeljava iz skupine (dokumentirana sodba, R173) */
export const DOMAIN_BY_GROUP: Record<ModuleGroupId, ModuleDomain> = {
  sales: 'sales',
  cash: 'finance',
  guests: 'crm',
  menu: 'operations',
  staff: 'operations',
  analytics: 'insight',
  system: 'platform',
}

/**
 * 75 modulov — VRSTNI RED ≡ navItems (drift-gate: element-wise ≡).
 * Vrstica = EN modul (§6: en vir resnice za metadata).
 */
const RAW_MODULES: readonly RawModule[] = [
  { id: 'orders', labelKey: 'nav.sales', icon: 'ShoppingCart', group: 'sales', permission: 'take_orders', priority: 'core', relatedModules: ['kitchen', 'tables', 'floor-plan'] },
  { id: 'kitchen', labelKey: 'nav.kitchen', icon: 'ChefHat', group: 'sales', permission: 'take_orders', priority: 'core', relatedModules: ['kitchen-stations', 'kitchen-prep', 'orders'] },
  { id: 'floor-plan', labelKey: 'nav.floor-plan', icon: 'LayoutGrid', group: 'sales', permission: 'take_orders', priority: 'core', relatedModules: ['tables', 'orders'] },
  { id: 'tables', labelKey: 'nav.tables', icon: 'BarChartBig', group: 'sales', permission: 'take_orders', priority: 'core', relatedModules: ['floor-plan', 'orders', 'reservations'] },
  { id: 'waitlist', labelKey: 'nav.waitlistFull', icon: 'ClipboardList', group: 'sales', permission: 'take_orders', priority: 'secondary', relatedModules: ['reservations', 'tables'] },
  { id: 'cash-register', labelKey: 'nav.cash-register', icon: 'Wallet', group: 'cash', permission: 'manage_cash', priority: 'core', relatedModules: ['z-report', 'end-of-day', 'wallet-payment'] },
  { id: 'shifts', labelKey: 'nav.shifts', icon: 'CalendarDays', group: 'cash', permission: 'manage_cash', priority: 'secondary', relatedModules: ['staff-schedule', 'shift-overview'] },
  { id: 'staff-schedule', labelKey: 'nav.staffSchedule', icon: 'CalendarClock', group: 'staff', permission: 'manage_employees', priority: 'secondary', relatedModules: ['shift-overview', 'employees', 'shifts'] },
  { id: 'course-pacing', labelKey: 'nav.coursePacing', icon: 'Layers', group: 'sales', permission: 'take_orders', priority: 'secondary', relatedModules: ['orders', 'kitchen'] },
  { id: 'dashboard', labelKey: 'nav.dashboard', icon: 'LayoutDashboard', group: 'analytics', permission: 'view_reports', priority: 'core', relatedModules: ['reports', 'briefing'] },
  { id: 'guests', labelKey: 'nav.guestCRM', icon: 'UserCircle', group: 'guests', permission: 'take_orders', priority: 'secondary', relatedModules: ['customer-timeline', 'feedback', 'loyalty'] },
  { id: 'menu', labelKey: 'nav.menu', icon: 'UtensilsCrossed', group: 'menu', adminOnly: true, priority: 'core', relatedModules: ['recipes', 'nutrition', 'allergen-matrix'] },
  { id: 'food-cost', labelKey: 'nav.food-cost', icon: 'Calculator', group: 'menu', adminOnly: true, priority: 'long-tail', relatedModules: ['menu', 'recipes'] },
  { id: 'inventory', labelKey: 'nav.inventory', icon: 'Package', group: 'menu', adminOnly: true, priority: 'core', relatedModules: ['inventory-alerts', 'suppliers', 'waste-tracker'] },
  { id: 'suppliers', labelKey: 'nav.suppliers', icon: 'Factory', group: 'menu', adminOnly: true, priority: 'secondary', relatedModules: ['vendor-scorecard', 'reorder-center'] },
  { id: 'reorder-center', labelKey: 'nav.reorderCenter', icon: 'ClipboardList', group: 'menu', adminOnly: true, priority: 'secondary', relatedModules: ['inventory-alerts', 'suppliers'] },
  { id: 'ai-forecast', labelKey: 'nav.ai-forecast', icon: 'Brain', group: 'analytics', adminOnly: true, priority: 'long-tail', relatedModules: ['advanced-analytics', 'ai-recommendations'] },
  { id: 'recipes', labelKey: 'nav.recipes', icon: 'BookOpen', group: 'menu', adminOnly: true, priority: 'secondary', relatedModules: ['recipe-scaling', 'food-cost', 'menu'] },
  { id: 'reservations', labelKey: 'nav.reservations', icon: 'Calendar', group: 'guests', permission: 'take_orders', priority: 'core', relatedModules: ['tables', 'waitlist', 'table-reservation-sync'] },
  { id: 'staff-performance', labelKey: 'nav.staffPerformance', icon: 'Trophy', group: 'staff', permission: 'view_reports', priority: 'secondary', relatedModules: ['labor-reports', 'employees'] },
  { id: 'kitchen-prep', labelKey: 'nav.kitchenPrep', icon: 'ChefHat', group: 'sales', permission: 'take_orders', priority: 'secondary', relatedModules: ['kitchen', 'kitchen-stations'] },
  { id: 'notifications', labelKey: 'nav.notifications', icon: 'Bell', group: 'system', permission: 'manage_cash', priority: 'secondary', relatedModules: ['settings'] },
  { id: 'allergen-matrix', labelKey: 'nav.allergenMatrix', icon: 'ShieldAlert', group: 'menu', adminOnly: true, priority: 'secondary', relatedModules: ['menu', 'nutrition'] },
  { id: 'table-turnover', labelKey: 'nav.tableTurnover', icon: 'LayoutGrid', group: 'analytics', permission: 'view_reports', priority: 'long-tail', relatedModules: ['reports'] },
  { id: 'expenses', labelKey: 'nav.expenses', icon: 'Receipt', group: 'analytics', permission: 'view_reports', priority: 'secondary', relatedModules: ['reports'] },
  { id: 'daily-checklist', labelKey: 'nav.dailyChecklist', icon: 'ClipboardCheck', group: 'system', permission: 'take_orders', priority: 'secondary', relatedModules: ['haccp'] },
  { id: 'end-of-day', labelKey: 'nav.endOfDay', icon: 'FileText', group: 'cash', permission: 'manage_cash', priority: 'secondary', relatedModules: ['z-report', 'cash-register'] },
  { id: 'haccp', labelKey: 'nav.haccp', icon: 'ShieldCheck', group: 'system', adminOnly: true, priority: 'secondary', relatedModules: ['compliance'] },
  { id: 'employees', labelKey: 'nav.employees', icon: 'Users', group: 'staff', permission: 'manage_employees', priority: 'core', relatedModules: ['staff-schedule', 'tip-manager', 'staff-performance'] },
  { id: 'menu-engineering', labelKey: 'nav.menuEngineering', icon: 'Target', group: 'analytics', adminOnly: true, priority: 'long-tail', relatedModules: ['menu', 'food-cost'] },
  { id: 'feedback', labelKey: 'nav.feedback', icon: 'MessageSquare', group: 'guests', permission: 'take_orders', priority: 'secondary', relatedModules: ['guests', 'customer-timeline'] },
  { id: 'reports', labelKey: 'nav.reports', icon: 'BarChart3', group: 'analytics', permission: 'view_reports', priority: 'core', relatedModules: ['dashboard', 'tax-report', 'profit-loss'] },
  { id: 'advanced-analytics', labelKey: 'nav.advancedAnalytics', icon: 'TrendingUp', group: 'analytics', permission: 'view_reports', priority: 'long-tail', relatedModules: ['reports', 'ai-forecast'] },
  { id: 'briefing', labelKey: 'nav.briefing', icon: 'Sunrise', group: 'analytics', permission: 'view_reports', priority: 'secondary', relatedModules: ['dashboard', 'reports'] },
  { id: 'devices', labelKey: 'nav.devices', icon: 'MonitorSmartphone', group: 'system', permission: 'view_reports', priority: 'long-tail', relatedModules: ['locations'] },
  { id: 'data-portability', labelKey: 'nav.dataPortability', icon: 'DatabaseBackup', group: 'system', adminOnly: true, priority: 'long-tail', relatedModules: ['settings'] },
  { id: 'configuration', labelKey: 'nav.configuration', icon: 'SlidersHorizontal', group: 'system', adminOnly: true, priority: 'secondary', relatedModules: ['settings', 'locations'] },
  { id: 'delivery', labelKey: 'nav.delivery', icon: 'Truck', group: 'sales', permission: 'take_orders', priority: 'secondary', relatedModules: ['delivery-tracking', 'driver'] },
  { id: 'delivery-tracking', labelKey: 'nav.deliveryTracking', icon: 'Navigation', group: 'sales', permission: 'take_orders', priority: 'secondary', relatedModules: ['delivery', 'driver'] },
  { id: 'driver', labelKey: 'nav.driver', icon: 'Bike', group: 'sales', permission: 'take_orders', priority: 'secondary', relatedModules: ['delivery', 'delivery-tracking'], standaloneRoute: '/driver' },
  { id: 'z-report', labelKey: 'nav.zReport', icon: 'FileText', group: 'cash', permission: 'manage_cash', priority: 'secondary', relatedModules: ['end-of-day', 'cash-register'] },
  { id: 'tip-manager', labelKey: 'nav.tipManager', icon: 'HandCoins', group: 'staff', permission: 'manage_employees', priority: 'secondary', relatedModules: ['employees'] },
  { id: 'wait-time', labelKey: 'nav.waitTime', icon: 'Timer', group: 'sales', permission: 'take_orders', priority: 'secondary', relatedModules: ['waitlist'] },
  { id: 'multi-location', labelKey: 'nav.multiLocation', icon: 'Store', group: 'system', adminOnly: true, priority: 'long-tail', relatedModules: ['locations'] },
  { id: 'ai-recommendations', labelKey: 'nav.aiRecommendations', icon: 'Brain', group: 'analytics', adminOnly: true, priority: 'long-tail', relatedModules: ['ai-forecast'] },
  { id: 'nutrition', labelKey: 'nav.nutrition', icon: 'ShieldCheck', group: 'menu', adminOnly: true, priority: 'long-tail', relatedModules: ['menu', 'allergen-matrix'] },
  { id: 'gift-cards', labelKey: 'nav.gift-cards', icon: 'CreditCard', group: 'guests', permission: 'take_orders', priority: 'secondary', relatedModules: ['loyalty'] },
  { id: 'loyalty', labelKey: 'nav.loyalty', icon: 'Award', group: 'guests', permission: 'take_orders', priority: 'secondary', relatedModules: ['gift-cards', 'guests'] },
  { id: 'printers', labelKey: 'nav.printers', icon: 'Printer', group: 'system', adminOnly: true, priority: 'secondary', relatedModules: ['settings'] },
  { id: 'webhooks', labelKey: 'nav.webhooks', icon: 'Webhook', group: 'system', adminOnly: true, priority: 'secondary', relatedModules: ['integrations'] },
  { id: 'integrations', labelKey: 'nav.integrations', icon: 'Plug', group: 'system', adminOnly: true, priority: 'secondary', relatedModules: ['webhooks'] },
  { id: 'furs', labelKey: 'nav.furs', icon: 'ShieldCheck', group: 'system', adminOnly: true, priority: 'secondary', relatedModules: ['tax-report', 'settings'] },
  { id: 'locations', labelKey: 'nav.locations', icon: 'MapPin', group: 'system', adminOnly: true, priority: 'secondary', relatedModules: ['multi-location', 'devices', 'configuration'] },
  { id: 'subscription', labelKey: 'nav.subscription', icon: 'CreditCard', group: 'system', adminOnly: true, priority: 'long-tail', relatedModules: ['settings'] },
  { id: 'inventory-alerts', labelKey: 'nav.inventoryAlerts', icon: 'BellRing', group: 'menu', adminOnly: true, priority: 'secondary', relatedModules: ['inventory', 'reorder-center'] },
  { id: 'customer-timeline', labelKey: 'nav.customerTimeline', icon: 'UserCircle', group: 'guests', permission: 'take_orders', priority: 'secondary', relatedModules: ['guests', 'feedback'] },
  { id: 'shift-overview', labelKey: 'nav.shiftOverview', icon: 'Activity', group: 'staff', permission: 'manage_employees', priority: 'secondary', relatedModules: ['staff-schedule', 'labor-reports'] },
  { id: 'profit-loss', labelKey: 'nav.profitLoss', icon: 'PieChart', group: 'analytics', permission: 'view_reports', priority: 'secondary', relatedModules: ['reports', 'expenses', 'tax-report'] },
  { id: 'table-reservation-sync', labelKey: 'nav.tableReservationSync', icon: 'Table2', group: 'guests', permission: 'take_orders', priority: 'secondary', relatedModules: ['reservations'] },
  { id: 'kitchen-stations', labelKey: 'nav.kitchenStations', icon: 'CookingPot', group: 'sales', permission: 'take_orders', priority: 'secondary', relatedModules: ['kitchen', 'kitchen-prep'] },
  { id: 'tax-report', labelKey: 'nav.taxReport', icon: 'Scale', group: 'analytics', permission: 'view_reports', priority: 'secondary', relatedModules: ['reports', 'profit-loss'] },
  { id: 'vendor-scorecard', labelKey: 'nav.vendorScorecard', icon: 'Star', group: 'menu', adminOnly: true, priority: 'long-tail', relatedModules: ['suppliers'] },
  { id: 'order-bump', labelKey: 'nav.orderBump', icon: 'Sparkles', group: 'sales', permission: 'take_orders', priority: 'secondary', relatedModules: ['orders'] },
  { id: 'waste-tracker', labelKey: 'nav.wasteTracker', icon: 'Trash2', group: 'menu', adminOnly: true, priority: 'secondary', relatedModules: ['inventory'] },
  { id: 'recipe-scaling', labelKey: 'nav.recipeScaling', icon: 'Scale3d', group: 'menu', adminOnly: true, priority: 'long-tail', relatedModules: ['recipes'] },
  { id: 'compliance', labelKey: 'nav.compliance', icon: 'ShieldCheck', group: 'system', adminOnly: true, priority: 'secondary', relatedModules: ['haccp', 'audit-log'] },
  { id: 'audit-log', labelKey: 'nav.auditLog', icon: 'ShieldAlert', group: 'system', adminOnly: true, priority: 'secondary', relatedModules: ['compliance'] },
  { id: 'outbox', labelKey: 'nav.outbox', icon: 'Activity', group: 'system', adminOnly: true, priority: 'secondary', relatedModules: ['conflicts', 'offline-queue'] },
  { id: 'ghost-kitchen', labelKey: 'nav.ghostKitchen', icon: 'ChefHat', group: 'analytics', permission: 'view_reports', priority: 'long-tail', relatedModules: ['menu', 'orders'] },
  { id: 'conflicts', labelKey: 'nav.conflicts', icon: 'GitBranch', group: 'system', adminOnly: true, priority: 'secondary', relatedModules: ['offline-queue', 'outbox'] },
  { id: 'offline-queue', labelKey: 'nav.offlineQueue', icon: 'CloudOff', group: 'system', adminOnly: true, priority: 'secondary', relatedModules: ['conflicts', 'outbox'] },
  { id: 'wallet-payment', labelKey: 'nav.walletPayment', icon: 'Nfc', group: 'cash', permission: 'manage_cash', priority: 'secondary', relatedModules: ['cash-register'] },
  { id: 'fraud-detection', labelKey: 'nav.fraudDetection', icon: 'ShieldAlert', group: 'system', adminOnly: true, priority: 'secondary', relatedModules: ['audit-log'] },
  { id: 'labor-reports', labelKey: 'nav.laborReports', icon: 'Calendar', group: 'staff', permission: 'view_reports', priority: 'secondary', relatedModules: ['staff-performance', 'shift-overview'] },
  { id: 'settings', labelKey: 'nav.settings', icon: 'Settings', group: 'system', adminOnly: true, priority: 'core', relatedModules: ['configuration', 'printers', 'subscription'] },
]

/** Polni register (izpeljani domain + mobile) — VRSTNI RED ≡ navItems */
export const MODULE_REGISTRY: readonly ModuleMeta[] = RAW_MODULES.map((m) => ({
  ...m,
  domain: DOMAIN_BY_GROUP[m.group],
  mobile: true, // documented default — per-module pregled deferred (IA runda)
}))

/** ID-ji v vrstnem redu registerja (≡ navItems vrstni red) */
export const MODULE_IDS: readonly string[] = MODULE_REGISTRY.map((m) => m.id)

const MODULE_BY_ID: ReadonlyMap<string, ModuleMeta> = new Map(
  MODULE_REGISTRY.map((m) => [m.id, m]),
)

/** Golden Path semena (§7) — priority 'core' nabor (12) */
export const CORE_MODULE_IDS: readonly string[] = MODULE_REGISTRY
  .filter((m) => m.priority === 'core')
  .map((m) => m.id)

export function getModuleMeta(moduleId: string): ModuleMeta | undefined {
  return MODULE_BY_ID.get(moduleId)
}

export function getModulesByGroup(group: ModuleGroupId): readonly ModuleMeta[] {
  return MODULE_REGISTRY.filter((m) => m.group === group)
}

/**
 * Dostopna vrata (§6) — Sidebar semantika:
 *   1. brez uporabnika → nič (Sidebar.tsx:57 `if (!authUser) return false`)
 *   2. adminOnly → samo admin | manager (Sidebar.tsx:58)
 *   3. permission → usePinAuth.ts hasPermission: admin/manager vedno,
 *      sicer permissions ⊇ {permission} | {'admin'} (Sidebar.tsx:59)
 * Pariteta 8 uporabniških likov × 75 modulov = pin v drift-gate testu.
 */
export function canAccessModule(
  user: ModuleAccessUser | null | undefined,
  moduleId: string,
): boolean {
  if (!user) return false
  const meta = MODULE_BY_ID.get(moduleId)
  if (!meta) return false
  if (meta.adminOnly && user.role !== 'admin' && user.role !== 'manager') return false
  if (meta.permission) {
    if (user.role === 'admin' || user.role === 'manager') return true
    return user.permissions.includes(meta.permission) || user.permissions.includes('admin')
  }
  return true
}
