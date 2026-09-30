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
//       · standaloneRoute = samo tam, kjer obstaja standalone stran (/driver)
//   - PURE LIB: brez client-direktive, brez react in lucide importov (test
//     to uveljavlja) — register je varen za client, server in tsx skripte.
//
// IA RUNDI (P0 korak 4, R174) — register postane POGON (ne samo verify):
//   - navItems/navGroups (src/components/pos/sidebar/navItems.ts) sta
//     DERIVIRANA iz registerja (adapter: NAV_ICONS string→lucide komponenta);
//     Sidebar in CommandPalette ostajata klicatelja navItems — vir je register.
//   - groupOrder = intra-group render red znotraj skupine (navGroups.itemIds
//     sodba, PINANO z drift-gate element-wise); default = vrstni red v
//     registerju (= navItems flat red). All-or-none pravilo per grupa.
//   - highlight = poseben aktivni stil (SidebarNav); sodba: samo 'orders'.
//   - mobile SODBA fiksirana (prej true za vse): 12 back-office modulov
//     (audit-log, conflicts, offline-queue, outbox, fraud-detection, webhooks,
//     integrations, subscription, multi-location, data-portability, compliance,
//     ghost-kitchen) = false — invarianta: mobile:false ⇒ adminOnly || long-tail.
//   - NavGroup.label i18n: MODULE_GROUPS.labelKey (nav.group.*) ×5 jezikov;
//     SidebarNav renderira t(labelKey) — SL label ostane fallback/drift-pin.
// P0-01 (epic #144, R175): modul 'danes' (Danes kokpit) = 76. modul — landing
//   operativno stanje za like z view_reports (page.tsx: privzeti activeModule
//   'orders' → 'danes' ob prvem vstopu za admin/manager/view_reports).
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
  /** Hardcoded SL label — ≡ navGroups.label (drift-gate pin, fallback) */
  label: string
  /** i18n ključ skupinske glave (nav.group.* — IA runda R174, ×5 jezikov) */
  labelKey: string
}

export interface ModuleMeta {
  id: string
  /** i18n ključ (≡ navItems.labelKey; nav.* ×5 jezikov) */
  labelKey: string
  /** lucide-react ikona IME (≡ NAV_ICONS ključ v navItems.ts; pure lib) */
  icon: string
  group: ModuleGroupId
  /** izpeljano iz DOMAIN_BY_GROUP pri izgradni MODULE_REGISTRY */
  domain: ModuleDomain
  permission?: ModulePermission
  adminOnly?: boolean
  /** IA sodba (R174): true = operativno na mobilnem/tablici; false =
   *  back-office desktop sodba (12 modulov; invarianta v drift-gate) */
  mobile: boolean
  /** intra-group render red (navGroups.itemIds sodba); default = register red.
   *  All-or-none per grupa (drift-gate test uveljavlja). */
  groupOrder?: number
  /** Poseben aktivni stil (SidebarNav); sodba: samo 'orders' (drift-gate pin) */
  highlight?: boolean
  priority: ModulePriority
  /** povezani moduli (cilji MORAJO obstajati — drift-gate test) */
  relatedModules: string[]
  /** standalone stran, če obstaja (npr. /driver) */
  standaloneRoute?: string
}

/** RAW vnos = ModuleMeta brez izpeljanih polj (domain, mobile) */
type RawModule = Omit<ModuleMeta, 'domain' | 'mobile'> & { mobile?: boolean }

export const MODULE_GROUPS: readonly ModuleGroup[] = [
  { id: 'sales', label: 'Prodaja', labelKey: 'nav.group.sales' },
  { id: 'cash', label: 'Blagajna', labelKey: 'nav.group.cash' },
  { id: 'guests', label: 'Gosti & CRM', labelKey: 'nav.group.guests' },
  { id: 'menu', label: 'Meni & zaloge', labelKey: 'nav.group.menu' },
  { id: 'staff', label: 'Osebje', labelKey: 'nav.group.staff' },
  { id: 'analytics', label: 'Analitika', labelKey: 'nav.group.analytics' },
  { id: 'system', label: 'Sistem', labelKey: 'nav.group.system' },
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
 * groupOrder = intra-group render red (sodba navGroups.itemIds, R174);
 * grupe sales/cash/guests so brez (default = register red ≡ render red).
 */
const RAW_MODULES: readonly RawModule[] = [
  { id: 'orders', labelKey: 'nav.sales', icon: 'ShoppingCart', group: 'sales', permission: 'take_orders', highlight: true, priority: 'core', relatedModules: ['kitchen', 'tables', 'floor-plan'] },
  { id: 'kitchen', labelKey: 'nav.kitchen', icon: 'ChefHat', group: 'sales', permission: 'take_orders', priority: 'core', relatedModules: ['kitchen-stations', 'kitchen-prep', 'orders'] },
  { id: 'floor-plan', labelKey: 'nav.floor-plan', icon: 'LayoutGrid', group: 'sales', permission: 'take_orders', priority: 'core', relatedModules: ['tables', 'orders'] },
  { id: 'tables', labelKey: 'nav.tables', icon: 'BarChartBig', group: 'sales', permission: 'take_orders', priority: 'core', relatedModules: ['floor-plan', 'orders', 'reservations'] },
  { id: 'waitlist', labelKey: 'nav.waitlistFull', icon: 'ClipboardList', group: 'sales', permission: 'take_orders', priority: 'secondary', relatedModules: ['reservations', 'tables'] },
  { id: 'cash-register', labelKey: 'nav.cash-register', icon: 'Wallet', group: 'cash', permission: 'manage_cash', priority: 'core', relatedModules: ['z-report', 'end-of-day', 'wallet-payment'] },
  { id: 'shifts', labelKey: 'nav.shifts', icon: 'CalendarDays', group: 'cash', permission: 'manage_cash', priority: 'secondary', relatedModules: ['staff-schedule', 'shift-overview'] },
  { id: 'staff-schedule', labelKey: 'nav.staffSchedule', icon: 'CalendarClock', group: 'staff', groupOrder: 2, permission: 'manage_employees', priority: 'secondary', relatedModules: ['shift-overview', 'employees', 'shifts'] },
  { id: 'course-pacing', labelKey: 'nav.coursePacing', icon: 'Layers', group: 'sales', permission: 'take_orders', priority: 'secondary', relatedModules: ['orders', 'kitchen'] },
  { id: 'dashboard', labelKey: 'nav.dashboard', icon: 'LayoutDashboard', group: 'analytics', groupOrder: 2, permission: 'view_reports', priority: 'core', relatedModules: ['reports', 'briefing'] },
  { id: 'guests', labelKey: 'nav.guestCRM', icon: 'UserCircle', group: 'guests', permission: 'take_orders', priority: 'secondary', relatedModules: ['customer-timeline', 'feedback', 'loyalty'] },
  { id: 'menu', labelKey: 'nav.menu', icon: 'UtensilsCrossed', group: 'menu', groupOrder: 1, adminOnly: true, priority: 'core', relatedModules: ['recipes', 'nutrition', 'allergen-matrix'] },
  { id: 'food-cost', labelKey: 'nav.food-cost', icon: 'Calculator', group: 'menu', groupOrder: 4, adminOnly: true, priority: 'long-tail', relatedModules: ['menu', 'recipes'] },
  { id: 'inventory', labelKey: 'nav.inventory', icon: 'Package', group: 'menu', groupOrder: 2, adminOnly: true, priority: 'core', relatedModules: ['inventory-alerts', 'suppliers', 'waste-tracker'] },
  { id: 'suppliers', labelKey: 'nav.suppliers', icon: 'Factory', group: 'menu', groupOrder: 7, adminOnly: true, priority: 'secondary', relatedModules: ['vendor-scorecard', 'reorder-center'] },
  { id: 'reorder-center', labelKey: 'nav.reorderCenter', icon: 'ClipboardList', group: 'menu', groupOrder: 8, adminOnly: true, priority: 'secondary', relatedModules: ['inventory-alerts', 'suppliers'] },
  { id: 'ai-forecast', labelKey: 'nav.ai-forecast', icon: 'Brain', group: 'analytics', groupOrder: 11, adminOnly: true, priority: 'long-tail', relatedModules: ['advanced-analytics', 'ai-recommendations'] },
  { id: 'recipes', labelKey: 'nav.recipes', icon: 'BookOpen', group: 'menu', groupOrder: 5, adminOnly: true, priority: 'secondary', relatedModules: ['recipe-scaling', 'food-cost', 'menu'] },
  { id: 'reservations', labelKey: 'nav.reservations', icon: 'Calendar', group: 'guests', permission: 'take_orders', priority: 'core', relatedModules: ['tables', 'waitlist', 'table-reservation-sync'] },
  { id: 'staff-performance', labelKey: 'nav.staffPerformance', icon: 'Trophy', group: 'staff', groupOrder: 5, permission: 'view_reports', priority: 'secondary', relatedModules: ['labor-reports', 'employees'] },
  { id: 'kitchen-prep', labelKey: 'nav.kitchenPrep', icon: 'ChefHat', group: 'sales', permission: 'take_orders', priority: 'secondary', relatedModules: ['kitchen', 'kitchen-stations'] },
  { id: 'notifications', labelKey: 'nav.notifications', icon: 'Bell', group: 'system', groupOrder: 18, permission: 'manage_cash', priority: 'secondary', relatedModules: ['settings'] },
  { id: 'allergen-matrix', labelKey: 'nav.allergenMatrix', icon: 'ShieldAlert', group: 'menu', groupOrder: 10, adminOnly: true, priority: 'secondary', relatedModules: ['menu', 'nutrition'] },
  { id: 'table-turnover', labelKey: 'nav.tableTurnover', icon: 'LayoutGrid', group: 'analytics', groupOrder: 6, permission: 'view_reports', priority: 'long-tail', relatedModules: ['reports'] },
  { id: 'expenses', labelKey: 'nav.expenses', icon: 'Receipt', group: 'analytics', groupOrder: 7, permission: 'view_reports', priority: 'secondary', relatedModules: ['reports'] },
  { id: 'daily-checklist', labelKey: 'nav.dailyChecklist', icon: 'ClipboardCheck', group: 'system', groupOrder: 20, permission: 'take_orders', priority: 'secondary', relatedModules: ['haccp'] },
  { id: 'end-of-day', labelKey: 'nav.endOfDay', icon: 'FileText', group: 'cash', permission: 'manage_cash', priority: 'secondary', relatedModules: ['z-report', 'cash-register'] },
  { id: 'haccp', labelKey: 'nav.haccp', icon: 'ShieldCheck', group: 'system', groupOrder: 13, adminOnly: true, priority: 'secondary', relatedModules: ['compliance'] },
  { id: 'employees', labelKey: 'nav.employees', icon: 'Users', group: 'staff', groupOrder: 1, permission: 'manage_employees', priority: 'core', relatedModules: ['staff-schedule', 'tip-manager', 'staff-performance'] },
  { id: 'menu-engineering', labelKey: 'nav.menuEngineering', icon: 'Target', group: 'analytics', groupOrder: 5, adminOnly: true, priority: 'long-tail', relatedModules: ['menu', 'food-cost'] },
  { id: 'feedback', labelKey: 'nav.feedback', icon: 'MessageSquare', group: 'guests', permission: 'take_orders', priority: 'secondary', relatedModules: ['guests', 'customer-timeline'] },
  { id: 'reports', labelKey: 'nav.reports', icon: 'BarChart3', group: 'analytics', groupOrder: 3, permission: 'view_reports', priority: 'core', relatedModules: ['dashboard', 'tax-report', 'profit-loss'] },
  { id: 'advanced-analytics', labelKey: 'nav.advancedAnalytics', icon: 'TrendingUp', group: 'analytics', groupOrder: 4, permission: 'view_reports', priority: 'long-tail', relatedModules: ['reports', 'ai-forecast'] },
  // P0-01 (epic #144, R175): Danes kokpit — landing operativno stanje (9 vprašanj):
  // zdaj/izjeme/prodano/kuhinja/mize/smena/rezervacije/zaloge/okvare.
  // Kompozicija obstoječih endpointov (brez nove API površine) + deep-linki
  // v module (setActiveModule). groupOrder 0 = prvi v ANALITIKA (pred briefing).
  { id: 'danes', labelKey: 'nav.danes', icon: 'Home', group: 'analytics', groupOrder: 0, permission: 'view_reports', priority: 'core', relatedModules: ['orders', 'kitchen', 'tables', 'cash-register'] },
  { id: 'briefing', labelKey: 'nav.briefing', icon: 'Sunrise', group: 'analytics', groupOrder: 1, permission: 'view_reports', priority: 'secondary', relatedModules: ['dashboard', 'reports'] },
  { id: 'devices', labelKey: 'nav.devices', icon: 'MonitorSmartphone', group: 'system', groupOrder: 4, permission: 'view_reports', priority: 'long-tail', relatedModules: ['locations'] },
  { id: 'data-portability', labelKey: 'nav.dataPortability', icon: 'DatabaseBackup', group: 'system', groupOrder: 5, adminOnly: true, mobile: false, priority: 'long-tail', relatedModules: ['settings'] },
  { id: 'configuration', labelKey: 'nav.configuration', icon: 'SlidersHorizontal', group: 'system', groupOrder: 1, adminOnly: true, priority: 'secondary', relatedModules: ['settings', 'locations'] },
  { id: 'delivery', labelKey: 'nav.delivery', icon: 'Truck', group: 'sales', permission: 'take_orders', priority: 'secondary', relatedModules: ['delivery-tracking', 'driver'] },
  { id: 'delivery-tracking', labelKey: 'nav.deliveryTracking', icon: 'Navigation', group: 'sales', permission: 'take_orders', priority: 'secondary', relatedModules: ['delivery', 'driver'] },
  { id: 'driver', labelKey: 'nav.driver', icon: 'Bike', group: 'sales', permission: 'take_orders', priority: 'secondary', relatedModules: ['delivery', 'delivery-tracking'], standaloneRoute: '/driver' },
  { id: 'z-report', labelKey: 'nav.zReport', icon: 'FileText', group: 'cash', permission: 'manage_cash', priority: 'secondary', relatedModules: ['end-of-day', 'cash-register'] },
  { id: 'tip-manager', labelKey: 'nav.tipManager', icon: 'HandCoins', group: 'staff', groupOrder: 4, permission: 'manage_employees', priority: 'secondary', relatedModules: ['employees'] },
  { id: 'wait-time', labelKey: 'nav.waitTime', icon: 'Timer', group: 'sales', permission: 'take_orders', priority: 'secondary', relatedModules: ['waitlist'] },
  { id: 'multi-location', labelKey: 'nav.multiLocation', icon: 'Store', group: 'system', groupOrder: 6, adminOnly: true, mobile: false, priority: 'long-tail', relatedModules: ['locations'] },
  { id: 'ai-recommendations', labelKey: 'nav.aiRecommendations', icon: 'Brain', group: 'analytics', groupOrder: 12, adminOnly: true, priority: 'long-tail', relatedModules: ['ai-forecast'] },
  { id: 'nutrition', labelKey: 'nav.nutrition', icon: 'ShieldCheck', group: 'menu', groupOrder: 11, adminOnly: true, priority: 'long-tail', relatedModules: ['menu', 'allergen-matrix'] },
  { id: 'gift-cards', labelKey: 'nav.gift-cards', icon: 'CreditCard', group: 'guests', permission: 'take_orders', priority: 'secondary', relatedModules: ['loyalty'] },
  { id: 'loyalty', labelKey: 'nav.loyalty', icon: 'Award', group: 'guests', permission: 'take_orders', priority: 'secondary', relatedModules: ['gift-cards', 'guests'] },
  { id: 'printers', labelKey: 'nav.printers', icon: 'Printer', group: 'system', groupOrder: 7, adminOnly: true, priority: 'secondary', relatedModules: ['settings'] },
  { id: 'webhooks', labelKey: 'nav.webhooks', icon: 'Webhook', group: 'system', groupOrder: 9, adminOnly: true, mobile: false, priority: 'secondary', relatedModules: ['integrations'] },
  { id: 'integrations', labelKey: 'nav.integrations', icon: 'Plug', group: 'system', groupOrder: 8, adminOnly: true, mobile: false, priority: 'secondary', relatedModules: ['webhooks'] },
  { id: 'furs', labelKey: 'nav.furs', icon: 'ShieldCheck', group: 'system', groupOrder: 10, adminOnly: true, priority: 'secondary', relatedModules: ['tax-report', 'settings'] },
  { id: 'locations', labelKey: 'nav.locations', icon: 'MapPin', group: 'system', groupOrder: 3, adminOnly: true, priority: 'secondary', relatedModules: ['multi-location', 'devices', 'configuration'] },
  { id: 'subscription', labelKey: 'nav.subscription', icon: 'CreditCard', group: 'system', groupOrder: 11, adminOnly: true, mobile: false, priority: 'long-tail', relatedModules: ['settings'] },
  { id: 'inventory-alerts', labelKey: 'nav.inventoryAlerts', icon: 'BellRing', group: 'menu', groupOrder: 3, adminOnly: true, priority: 'secondary', relatedModules: ['inventory', 'reorder-center'] },
  { id: 'customer-timeline', labelKey: 'nav.customerTimeline', icon: 'UserCircle', group: 'guests', permission: 'take_orders', priority: 'secondary', relatedModules: ['guests', 'feedback'] },
  { id: 'shift-overview', labelKey: 'nav.shiftOverview', icon: 'Activity', group: 'staff', groupOrder: 3, permission: 'manage_employees', priority: 'secondary', relatedModules: ['staff-schedule', 'labor-reports'] },
  { id: 'profit-loss', labelKey: 'nav.profitLoss', icon: 'PieChart', group: 'analytics', groupOrder: 8, permission: 'view_reports', priority: 'secondary', relatedModules: ['reports', 'expenses', 'tax-report'] },
  { id: 'table-reservation-sync', labelKey: 'nav.tableReservationSync', icon: 'Table2', group: 'guests', permission: 'take_orders', priority: 'secondary', relatedModules: ['reservations'] },
  { id: 'kitchen-stations', labelKey: 'nav.kitchenStations', icon: 'CookingPot', group: 'sales', permission: 'take_orders', priority: 'secondary', relatedModules: ['kitchen', 'kitchen-prep'] },
  { id: 'tax-report', labelKey: 'nav.taxReport', icon: 'Scale', group: 'analytics', groupOrder: 9, permission: 'view_reports', priority: 'secondary', relatedModules: ['reports', 'profit-loss'] },
  { id: 'vendor-scorecard', labelKey: 'nav.vendorScorecard', icon: 'Star', group: 'menu', groupOrder: 12, adminOnly: true, priority: 'long-tail', relatedModules: ['suppliers'] },
  { id: 'order-bump', labelKey: 'nav.orderBump', icon: 'Sparkles', group: 'sales', permission: 'take_orders', priority: 'secondary', relatedModules: ['orders'] },
  { id: 'waste-tracker', labelKey: 'nav.wasteTracker', icon: 'Trash2', group: 'menu', groupOrder: 9, adminOnly: true, priority: 'secondary', relatedModules: ['inventory'] },
  { id: 'recipe-scaling', labelKey: 'nav.recipeScaling', icon: 'Scale3d', group: 'menu', groupOrder: 6, adminOnly: true, priority: 'long-tail', relatedModules: ['recipes'] },
  { id: 'compliance', labelKey: 'nav.compliance', icon: 'ShieldCheck', group: 'system', groupOrder: 12, adminOnly: true, mobile: false, priority: 'secondary', relatedModules: ['haccp', 'audit-log'] },
  { id: 'audit-log', labelKey: 'nav.auditLog', icon: 'ShieldAlert', group: 'system', groupOrder: 14, adminOnly: true, mobile: false, priority: 'secondary', relatedModules: ['compliance'] },
  { id: 'outbox', labelKey: 'nav.outbox', icon: 'Activity', group: 'system', groupOrder: 15, adminOnly: true, mobile: false, priority: 'secondary', relatedModules: ['conflicts', 'offline-queue'] },
  { id: 'ghost-kitchen', labelKey: 'nav.ghostKitchen', icon: 'ChefHat', group: 'analytics', groupOrder: 10, permission: 'view_reports', mobile: false, priority: 'long-tail', relatedModules: ['menu', 'orders'] },
  { id: 'conflicts', labelKey: 'nav.conflicts', icon: 'GitBranch', group: 'system', groupOrder: 16, adminOnly: true, mobile: false, priority: 'secondary', relatedModules: ['offline-queue', 'outbox'] },
  { id: 'offline-queue', labelKey: 'nav.offlineQueue', icon: 'CloudOff', group: 'system', groupOrder: 17, adminOnly: true, mobile: false, priority: 'secondary', relatedModules: ['conflicts', 'outbox'] },
  { id: 'wallet-payment', labelKey: 'nav.walletPayment', icon: 'Nfc', group: 'cash', permission: 'manage_cash', priority: 'secondary', relatedModules: ['cash-register'] },
  { id: 'fraud-detection', labelKey: 'nav.fraudDetection', icon: 'ShieldAlert', group: 'system', groupOrder: 19, adminOnly: true, mobile: false, priority: 'secondary', relatedModules: ['audit-log'] },
  { id: 'labor-reports', labelKey: 'nav.laborReports', icon: 'Calendar', group: 'staff', groupOrder: 6, permission: 'view_reports', priority: 'secondary', relatedModules: ['staff-performance', 'shift-overview'] },
  { id: 'settings', labelKey: 'nav.settings', icon: 'Settings', group: 'system', groupOrder: 2, adminOnly: true, priority: 'core', relatedModules: ['configuration', 'printers', 'subscription'] },
]

/** Polni register (izpeljani domain + mobile) — VRSTNI RED ≡ navItems */
export const MODULE_REGISTRY: readonly ModuleMeta[] = RAW_MODULES.map((m) => ({
  ...m,
  domain: DOMAIN_BY_GROUP[m.group],
  mobile: m.mobile ?? true, // R174 sodba: 12 back-office modulov eksplicitno false
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

// ============================================
// P0-02 (epic #144, R176): ROLE-BASED WORKSPACES
// ============================================
//
// Issue #144 P0-02: "Use the existing role/permission system as a UX model,
// not only an authorization layer." Workspace = primarna pot po modulih za
// vlogo, IZPELJANA iz realnega EmployeeRole enuma (prisma/schema.prisma) +
// kanona 4 dovoljenj — NE nova avtorizacijska plast.
//
// Sodbe (iz issue P0-02 primarnih poti, preslikane na obstoječe module):
//   waiter  : mize → order → send/status → payment  ≡ tables, orders, kitchen,
//             cash-register (pličilo je task-veriga; dostop do cash-register
//             ostaja manage_cash-gated — path je SODEBNIK navigacije, ne vrat)
//   kitchen : KDS → preparation → ready/recall      ≡ kitchen, kitchen-prep,
//             kitchen-stations (ready/recall sta akciji znotraj KDS)
//   manager : Danes → operativa → blagajna → osebje → zaloga → analitika
//             ≡ danes, orders, cash-register, z-report, employees, inventory,
//             reports (P0-01 kokpit kot vstopna točka)
//   admin   : danes (P0-01 kokpit) → system → users/roles → integrations →
//             FURS → configuration → compliance ≡ danes, settings, employees,
//             integrations, furs, configuration, compliance
//
// Landing kanon (page.tsx): workspace.landing ob PRVEM vstopu, samo če
// canAccessModule(user, landing) in uporabnik še ni sam izbral modula
// (store default 'orders'). Kiosk/prodajni način se NE preusmerja (R153/R175).
//   manager/admin → danes (≡ R175 P0-01), chef/kitchen → kitchen KDS (NOVO,
//   P0-02), staff → orders (no-op ≡ R175 "operativni liki ostanejo").
//
// PURE LIB (kanon R173): brez react/lucide/client-direktiv.

export type WorkspaceId = 'waiter' | 'kitchen' | 'manager' | 'admin'

export interface Workspace {
  id: WorkspaceId
  /** i18n ključ (workspace.* ×5 jezikov) — CommandPalette "Moduli" glava */
  labelKey: string
  /** Landing modul ob prijavi (page.tsx landing gate; invarianta: ∈ path) */
  landing: string
  /** Primarna pot (issue #144 P0-02) — urejeni module ids iz registerja */
  path: string[]
}

/** 4 workspaces — VRSTNI RED = issue P0-02 (waiter/kitchen/manager/admin) */
export const WORKSPACES: readonly Workspace[] = [
  {
    id: 'waiter',
    labelKey: 'workspace.waiter',
    landing: 'orders',
    path: ['tables', 'orders', 'kitchen', 'cash-register'],
  },
  {
    id: 'kitchen',
    labelKey: 'workspace.kitchen',
    landing: 'kitchen',
    path: ['kitchen', 'kitchen-prep', 'kitchen-stations'],
  },
  {
    id: 'manager',
    labelKey: 'workspace.manager',
    landing: 'danes',
    path: ['danes', 'orders', 'cash-register', 'z-report', 'employees', 'inventory', 'reports'],
  },
  {
    id: 'admin',
    labelKey: 'workspace.admin',
    landing: 'danes',
    path: ['danes', 'settings', 'employees', 'integrations', 'furs', 'configuration', 'compliance'],
  },
]

/**
 * DB EmployeeRole enum (prisma/schema.prisma) → workspace. Drift-gate
 * uveljavlja dvosmerno pokritost: vsak enum value je mapiran in vsak ključ
 * JE enum value (brez inventiranih rol — kanon R174: 'server' NE obstaja).
 */
export const ROLE_TO_WORKSPACE: Readonly<Record<string, WorkspaceId>> = {
  admin: 'admin',
  manager: 'manager',
  chef: 'kitchen',
  kitchen: 'kitchen',
  staff: 'waiter',
}

/**
 * Permission fallback za role vrednosti izven DB enuma (legacy/testni liki:
 * 'server', 'cashier', 'analyst', ...). Prvi match po kanonu 4 dovoljenj.
 * Vrstni red je SODBA: view_reports premaga take_orders (analitik → kokpit,
 * ne natakar) — pariteta z R175 landing gate (view_reports → danes).
 */
const PERMISSION_WORKSPACE_FALLBACK: readonly (readonly [string, WorkspaceId])[] = [
  ['view_reports', 'manager'],
  ['take_orders', 'waiter'],
  ['manage_cash', 'waiter'],
  ['manage_employees', 'manager'],
] as const

/**
 * Razreši workspace za uporabnika (P0-02 UX model):
 *   1. brez uporabnika → null (fail-closed)
 *   2. DB role (EmployeeRole enum) → ROLE_TO_WORKSPACE
 *   3. izven enuma → permission fallback (prvi match)
 *   4. brez matcha → null (ostane na store default 'orders')
 * Rezultat je NAVIGACIJSKI model — dostop še zmeraj uveljavlja
 * canAccessModule (ta funkcija NE odpira modulov).
 */
export function resolveWorkspaceForUser(
  user: ModuleAccessUser | null | undefined,
): Workspace | null {
  if (!user) return null
  const byRole = ROLE_TO_WORKSPACE[user.role]
  if (byRole) return WORKSPACES.find((w) => w.id === byRole) ?? null
  for (const [permission, id] of PERMISSION_WORKSPACE_FALLBACK) {
    if (user.permissions.includes(permission)) {
      return WORKSPACES.find((w) => w.id === id) ?? null
    }
  }
  return null
}
