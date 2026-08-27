// ============================================
// NAVIGACIJSKI ELEMENTI ZA SIDEBAR
// ============================================

import {
  LayoutDashboard, ShoppingCart, BarChartBig, UtensilsCrossed, Package, Users,
  BarChart3, ChefHat, Wallet, Settings, SlidersHorizontal, Truck, CreditCard,
  Award, Printer, Webhook, CalendarDays,
  Brain, LayoutGrid, Calendar, UserCircle, Sparkles,
  Calculator, ClipboardList, Factory, Plug, MapPin, CalendarClock, Layers,
  MessageSquare, Target, FileText, HandCoins, Navigation, Timer, Trophy, Bell,
  ShieldAlert, Receipt, ClipboardCheck, BellRing, PieChart, Activity, Table2,
  CookingPot, Scale, Star, Trash2, Scale3d, Store, ShieldCheck, BookOpen, GitBranch, Nfc,
} from 'lucide-react'

export interface NavItem {
  id: string
  labelKey: string
  icon: React.ComponentType<{ className?: string }>
  highlight?: boolean
  permission?: string
  adminOnly?: boolean
}

export const navItems: NavItem[] = [
  { id: 'orders', labelKey: 'nav.sales', icon: ShoppingCart, highlight: true, permission: 'take_orders' },
  { id: 'kitchen', labelKey: 'nav.kitchen', icon: ChefHat, permission: 'take_orders' },
  { id: 'floor-plan', labelKey: 'nav.floor-plan', icon: LayoutGrid, permission: 'take_orders' },
  { id: 'tables', labelKey: 'nav.tables', icon: BarChartBig, permission: 'take_orders' },
  { id: 'waitlist', labelKey: 'nav.waitlistFull', icon: ClipboardList, permission: 'take_orders' },
  { id: 'cash-register', labelKey: 'nav.cash-register', icon: Wallet, permission: 'manage_cash' },
  { id: 'shifts', labelKey: 'nav.shifts', icon: CalendarDays, permission: 'manage_cash' },
  { id: 'staff-schedule', labelKey: 'nav.staffSchedule', icon: CalendarClock, permission: 'manage_employees' },
  { id: 'course-pacing', labelKey: 'nav.coursePacing', icon: Layers, permission: 'take_orders' },
  { id: 'dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, permission: 'view_reports' },
  { id: 'guests', labelKey: 'nav.guestCRM', icon: UserCircle, permission: 'take_orders' },
  { id: 'menu', labelKey: 'nav.menu', icon: UtensilsCrossed, adminOnly: true },
  { id: 'food-cost', labelKey: 'nav.food-cost', icon: Calculator, adminOnly: true },
  { id: 'inventory', labelKey: 'nav.inventory', icon: Package, adminOnly: true },
  { id: 'suppliers', labelKey: 'nav.suppliers', icon: Factory, adminOnly: true },
  { id: 'ai-forecast', labelKey: 'nav.ai-forecast', icon: Brain, adminOnly: true },
  { id: 'recipes', labelKey: 'nav.recipes', icon: BookOpen, adminOnly: true },
  { id: 'reservations', labelKey: 'nav.reservations', icon: Calendar, permission: 'take_orders' },
  { id: 'staff-performance', labelKey: 'nav.staffPerformance', icon: Trophy, permission: 'view_reports' },
  { id: 'kitchen-prep', labelKey: 'nav.kitchenPrep', icon: ChefHat, permission: 'take_orders' },
  { id: 'notifications', labelKey: 'nav.notifications', icon: Bell, permission: 'manage_cash' },
  { id: 'allergen-matrix', labelKey: 'nav.allergenMatrix', icon: ShieldAlert, adminOnly: true },
  { id: 'table-turnover', labelKey: 'nav.tableTurnover', icon: LayoutGrid, permission: 'view_reports' },
  { id: 'expenses', labelKey: 'nav.expenses', icon: Receipt, permission: 'view_reports' },
  { id: 'daily-checklist', labelKey: 'nav.dailyChecklist', icon: ClipboardCheck, permission: 'take_orders' },
  { id: 'end-of-day', labelKey: 'nav.endOfDay', icon: FileText, permission: 'manage_cash' },
  { id: 'haccp', labelKey: 'nav.haccp', icon: ShieldCheck, adminOnly: true },
  { id: 'employees', labelKey: 'nav.employees', icon: Users, permission: 'manage_employees' },
  { id: 'menu-engineering', labelKey: 'nav.menuEngineering', icon: Target, adminOnly: true },
  { id: 'feedback', labelKey: 'nav.feedback', icon: MessageSquare, permission: 'take_orders' },
  { id: 'reports', labelKey: 'nav.reports', icon: BarChart3, permission: 'view_reports' },
  { id: 'configuration', labelKey: 'nav.configuration', icon: SlidersHorizontal, adminOnly: true },
  { id: 'delivery', labelKey: 'nav.delivery', icon: Truck, permission: 'take_orders' },
  { id: 'delivery-tracking', labelKey: 'nav.deliveryTracking', icon: Navigation, permission: 'take_orders' },
  { id: 'z-report', labelKey: 'nav.zReport', icon: FileText, permission: 'manage_cash' },
  { id: 'tip-manager', labelKey: 'nav.tipManager', icon: HandCoins, permission: 'manage_employees' },
  { id: 'wait-time', labelKey: 'nav.waitTime', icon: Timer, permission: 'take_orders' },
  { id: 'multi-location', labelKey: 'nav.multiLocation', icon: Store, adminOnly: true },
  { id: 'ai-recommendations', labelKey: 'nav.aiRecommendations', icon: Brain, adminOnly: true },
  { id: 'nutrition', labelKey: 'nav.nutrition', icon: ShieldCheck, adminOnly: true },
  { id: 'gift-cards', labelKey: 'nav.gift-cards', icon: CreditCard, permission: 'take_orders' },
  { id: 'loyalty', labelKey: 'nav.loyalty', icon: Award, permission: 'take_orders' },
  { id: 'printers', labelKey: 'nav.printers', icon: Printer, adminOnly: true },
  { id: 'webhooks', labelKey: 'nav.webhooks', icon: Webhook, adminOnly: true },
  { id: 'integrations', labelKey: 'nav.integrations', icon: Plug, adminOnly: true },
  { id: 'furs', labelKey: 'nav.furs', icon: ShieldCheck, adminOnly: true },
  { id: 'locations', labelKey: 'nav.locations', icon: MapPin, adminOnly: true },
  { id: 'subscription', labelKey: 'nav.subscription', icon: CreditCard, adminOnly: true },
  { id: 'inventory-alerts', labelKey: 'nav.inventoryAlerts', icon: BellRing, adminOnly: true },
  { id: 'customer-timeline', labelKey: 'nav.customerTimeline', icon: UserCircle, permission: 'take_orders' },
  { id: 'shift-overview', labelKey: 'nav.shiftOverview', icon: Activity, permission: 'manage_employees' },
  { id: 'profit-loss', labelKey: 'nav.profitLoss', icon: PieChart, permission: 'view_reports' },
  { id: 'table-reservation-sync', labelKey: 'nav.tableReservationSync', icon: Table2, permission: 'take_orders' },
  { id: 'kitchen-stations', labelKey: 'nav.kitchenStations', icon: CookingPot, permission: 'take_orders' },
  { id: 'tax-report', labelKey: 'nav.taxReport', icon: Scale, permission: 'view_reports' },
  { id: 'vendor-scorecard', labelKey: 'nav.vendorScorecard', icon: Star, adminOnly: true },
  { id: 'order-bump', labelKey: 'nav.orderBump', icon: Sparkles, permission: 'take_orders' },
  { id: 'waste-tracker', labelKey: 'nav.wasteTracker', icon: Trash2, adminOnly: true },
  { id: 'recipe-scaling', labelKey: 'nav.recipeScaling', icon: Scale3d, adminOnly: true },
  { id: 'compliance', labelKey: 'nav.compliance', icon: ShieldCheck, adminOnly: true },
  { id: 'audit-log', labelKey: 'nav.auditLog', icon: ShieldAlert, adminOnly: true },
  { id: 'outbox', labelKey: 'nav.outbox', icon: Activity, adminOnly: true },
  { id: 'ghost-kitchen', labelKey: 'nav.ghostKitchen', icon: ChefHat, permission: 'view_reports' },
  { id: 'conflicts', labelKey: 'nav.conflicts', icon: GitBranch, adminOnly: true },
  { id: 'wallet-payment', labelKey: 'nav.walletPayment', icon: Nfc, permission: 'manage_cash' },
  { id: 'fraud-detection', labelKey: 'nav.fraudDetection', icon: ShieldAlert, adminOnly: true },
  { id: 'labor-reports', labelKey: 'nav.laborReports', icon: Calendar, permission: 'view_reports' },
  { id: 'settings', labelKey: 'nav.settings', icon: Settings, adminOnly: true },
]
