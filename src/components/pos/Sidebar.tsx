'use client'

import { usePOSStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n'
import { getCountryConfig, type CountryCode } from '@/lib/country-config'
import {
  LayoutDashboard,
  ShoppingCart,
  BarChartBig,
  UtensilsCrossed,
  Package,
  Users,
  BarChart3,
  ChefHat,
  Wallet,
  Sun,
  Moon,
  Menu,
  X,
  Store,
  ShieldCheck,
  BookOpen,
  Settings,
  SlidersHorizontal,
  Truck,
  CreditCard,
  Award,
  Printer,
  Webhook,
  CalendarDays,
  Maximize,
  Minimize,
  Monitor,
  ExternalLink,
  HandMetal,
  Brain,
  LayoutGrid,
  Calendar,
  UserCircle,
  Sparkles,
  Calculator,
  ClipboardList,
  QrCode,
  Factory,
  Plug,
  MapPin,
  CalendarClock,
  Layers,
  MessageSquare,
  Target,
  Split,
  FileText,
  HandCoins,
  Navigation,
  Timer,
  Trophy,
  Bell,
  ShieldAlert,
  Receipt,
  ClipboardCheck,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useSyncExternalStore, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useQuery } from '@tanstack/react-query'
import { UserIndicator, getCurrentUser, hasPermission, authFetch } from '@/components/pos/PinLogin'
import { LanguageSwitcher } from '@/components/pos/LanguageSwitcher'

const emptySubscribe = () => () => {}
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )
}

const navItems = [
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
  { id: 'staff-schedule', labelKey: 'nav.staffSchedule', icon: CalendarDays, permission: 'manage_employees' },
  { id: 'staff-performance', labelKey: 'nav.staffPerformance', icon: Trophy, permission: 'view_reports' },
  { id: 'kitchen-prep', labelKey: 'nav.kitchenPrep', icon: ChefHat, permission: 'take_orders' },
  { id: 'notifications', labelKey: 'nav.notifications', icon: Bell, permission: 'manage_cash' },
  { id: 'allergen-matrix', labelKey: 'nav.allergenMatrix', icon: ShieldAlert, adminOnly: true },
  { id: 'table-turnover', labelKey: 'nav.tableTurnover', icon: LayoutGrid, permission: 'view_reports' },
  { id: 'expenses', labelKey: 'nav.expenses', icon: Receipt, permission: 'view_reports' },
  { id: 'daily-checklist', labelKey: 'nav.dailyChecklist', icon: ClipboardCheck, permission: 'take_orders' },
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
  { id: 'settings', labelKey: 'nav.settings', icon: Settings, adminOnly: true },
]

export function Sidebar() {
  const { activeModule, setActiveModule, sidebarOpen, setSidebarOpen, setKioskMode, locale, country } = usePOSStore()
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()
  const [isFullscreen, setIsFullscreen] = useState(false)
  // Force re-render on locale change
  const _locale = locale
  const countryConfig = getCountryConfig(country as CountryCode)

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }

  // Listen for fullscreen changes (including Esc key)
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const { data: ordersData } = useQuery({
    queryKey: ['sidebar-orders'],
    queryFn: async () => {
      const res = await authFetch('/api/orders?status=pending&limit=1')
      const pending = await res.json()
      const res2 = await authFetch('/api/orders?status=in-progress&limit=1')
      const inProgress = await res2.json()
      return { pendingCount: Array.isArray(pending) ? pending.length : 0, inProgressCount: Array.isArray(inProgress) ? inProgress.length : 0 }
    },
    refetchInterval: 30000,
  })

  const activeOrderCount = (ordersData?.pendingCount || 0) + (ordersData?.inProgressCount || 0)

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile hamburger */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 md:hidden"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed md:static inset-y-0 left-0 z-50 flex flex-col w-56 bg-card border-r border-border transition-transform duration-300 md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Store className="h-4.5 w-4.5" />
          </div>
          <div>
            <h1 className="font-bold text-sm leading-tight flex items-center gap-1.5">
              RestaurantOS
              <span className="text-base">{countryConfig.flag}</span>
            </h1>
            <p className="text-[10px] text-muted-foreground">{t('nav.posSystem')} · {countryConfig.currencySymbol}</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto custom-scrollbar">
          {navItems.filter(item => {
            const user = getCurrentUser()
            if (!user) return false
            if ((item as { adminOnly?: boolean }).adminOnly && user.role !== 'admin' && user.role !== 'manager') return false
            if ((item as { permission?: string }).permission && !hasPermission((item as { permission: string }).permission)) return false
            return true
          }).map((item) => {
            const Icon = item.icon
            const isActive = activeModule === item.id
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveModule(item.id)
                  setSidebarOpen(false)
                }}
                className={cn(
                  'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? item.highlight
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {t(item.labelKey)}
                {item.id === 'orders' && activeOrderCount > 0 && (
                  <span className="ml-auto flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1">
                    {activeOrderCount}
                  </span>
                )}
                {item.id === 'kitchen' && activeOrderCount > 0 && (
                  <span className="ml-auto flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-orange-500 text-white text-[9px] font-bold px-1">
                    {activeOrderCount}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Bottom section */}
        <UserIndicator />
        <div className="px-2 py-2 border-t border-border space-y-0.5">
          {/* KDS in natakar povezave */}
          <div className="grid grid-cols-2 gap-1 px-0.5 pb-1">
            <a
              href="/kds"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 text-[10px] font-bold hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors touch-manipulation"
              title="KDS - Kitchen Display System"
            >
              <ChefHat className="h-3 w-3" />
              KDS
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
            <a
              href="/waiter"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-[10px] font-bold hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors touch-manipulation"
              title="Odpri natakarjevo tablico"
            >
              <HandMetal className="h-3 w-3" />
              {t('sidebar.waiter')}
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
          {/* Fullscreen gumb */}
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-xs h-8"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
            {isFullscreen ? t('nav.exitFullscreen') : t('nav.fullscreen')}
          </Button>
          {/* Kiosk način */}
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-xs h-8 touch-manipulation"
            onClick={() => setKioskMode(true)}
          >
            <Monitor className="h-3.5 w-3.5" />
            {t('nav.kiosk')}
          </Button>
          {/* Tema */}
          {mounted && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                className="flex-1 justify-start gap-2 text-xs h-8"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                {theme === 'dark' ? t('sidebar.lightTheme') : t('sidebar.darkTheme')}
              </Button>
              <LanguageSwitcher />
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
