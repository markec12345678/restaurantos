'use client'

import { usePOSStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { useI18n, localeLabels, type AppLocale } from '@/i18n/provider'
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
  Globe,
  Check,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useSyncExternalStore, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useQuery } from '@tanstack/react-query'
import { UserIndicator, getCurrentUser, hasPermission } from '@/components/pos/PinLogin'

const emptySubscribe = () => () => {}
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )
}

const navItems = [
  { id: 'orders', label: 'Prodaja', icon: ShoppingCart, highlight: true, permission: 'take_orders' },
  { id: 'kitchen', label: 'Kuhinja', icon: ChefHat, permission: 'take_orders' },
  { id: 'tables', label: 'Mize', icon: BarChartBig, permission: 'take_orders' },
  { id: 'cash-register', label: 'Blagajna', icon: Wallet, permission: 'manage_cash' },
  { id: 'shifts', label: 'Izmene', icon: CalendarDays, permission: 'manage_cash' },
  { id: 'dashboard', label: 'Nadzorna plošča', icon: LayoutDashboard, permission: 'view_reports' },
  { id: 'menu', label: 'Jedilnik', icon: UtensilsCrossed, adminOnly: true },
  { id: 'inventory', label: 'Zaloga', icon: Package, adminOnly: true },
  { id: 'recipes', label: 'Recepti', icon: BookOpen, adminOnly: true },
  { id: 'haccp', label: 'HACCP', icon: ShieldCheck, adminOnly: true },
  { id: 'employees', label: 'Zaposleni', icon: Users, permission: 'manage_employees' },
  { id: 'reports', label: 'Poročila', icon: BarChart3, permission: 'view_reports' },
  { id: 'configuration', label: 'Konfiguracija', icon: SlidersHorizontal, adminOnly: true },
  { id: 'delivery', label: 'Dostava', icon: Truck, permission: 'take_orders' },
  { id: 'gift-cards', label: 'Darilne kartice', icon: CreditCard, permission: 'take_orders' },
  { id: 'loyalty', label: 'Zvestoba', icon: Award, permission: 'take_orders' },
  { id: 'printers', label: 'Tiskalniki', icon: Printer, adminOnly: true },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook, adminOnly: true },
  { id: 'settings', label: 'Nastavitve', icon: Settings, adminOnly: true },
]

export function Sidebar() {
  const { activeModule, setActiveModule, sidebarOpen, setSidebarOpen, setKioskMode } = usePOSStore()
  const { theme, setTheme } = useTheme()
  const { locale, setLocale, t } = useI18n()
  const mounted = useMounted()
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)

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
      const res = await fetch('/api/orders?status=pending&limit=1')
      const pending = await res.json()
      const res2 = await fetch('/api/orders?status=in-progress&limit=1')
      const inProgress = await res2.json()
      return { pendingCount: pending.length, inProgressCount: inProgress.length }
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
            <h1 className="font-bold text-sm leading-tight">RestaurantOS</h1>
            <p className="text-[10px] text-muted-foreground">Prodajna točka</p>
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
                {item.label}
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
          {/* Fullscreen gumb */}
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-xs h-8"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
            {isFullscreen ? t('common.close') : 'Celozaslonski način'}
          </Button>
          {/* Kiosk način */}
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-xs h-8 touch-manipulation"
            onClick={() => setKioskMode(true)}
          >
            <Monitor className="h-3.5 w-3.5" />
            Kiosk način
          </Button>
          {/* Language switcher */}
          <div className="relative">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-xs h-8"
              onClick={() => setLangOpen(!langOpen)}
            >
              <Globe className="h-3.5 w-3.5" />
              <span>{localeLabels[locale].flag}</span>
              <span className="truncate">{localeLabels[locale].label}</span>
            </Button>
            {langOpen && (
              <div className="absolute bottom-full left-0 mb-1 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50">
                {(Object.entries(localeLabels) as [AppLocale, { flag: string; label: string }][]).map(([code, info]) => (
                  <button
                    key={code}
                    onClick={() => { setLocale(code); setLangOpen(false) }}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent transition-colors',
                      locale === code && 'bg-accent font-semibold'
                    )}
                  >
                    <span>{info.flag}</span>
                    <span className="truncate">{info.label}</span>
                    {locale === code && <Check className="h-3 w-3 ml-auto text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Tema */}
          {mounted && (
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-xs h-8"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              {theme === 'dark' ? t('settings.light') : t('settings.dark')}
            </Button>
          )}
        </div>
      </aside>
    </>
  )
}
