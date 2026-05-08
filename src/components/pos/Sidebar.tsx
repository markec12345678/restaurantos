'use client'

import { usePOSStore } from '@/lib/store'
import { cn } from '@/lib/utils'
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
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useSyncExternalStore, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useQuery } from '@tanstack/react-query'
import { UserIndicator } from '@/components/pos/PinLogin'

const emptySubscribe = () => () => {}
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )
}

const navItems = [
  { id: 'orders', label: 'Prodaja', icon: ShoppingCart, highlight: true },
  { id: 'kitchen', label: 'Kuhinja', icon: ChefHat },
  { id: 'tables', label: 'Mize', icon: BarChartBig },
  { id: 'cash-register', label: 'Blagajna', icon: Wallet },
  { id: 'shifts', label: 'Izmene', icon: CalendarDays },
  { id: 'dashboard', label: 'Nadzorna plošča', icon: LayoutDashboard },
  { id: 'menu', label: 'Jedilnik', icon: UtensilsCrossed },
  { id: 'inventory', label: 'Zaloga', icon: Package },
  { id: 'recipes', label: 'Recepti', icon: BookOpen },
  { id: 'haccp', label: 'HACCP', icon: ShieldCheck },
  { id: 'employees', label: 'Zaposleni', icon: Users },
  { id: 'reports', label: 'Poročila', icon: BarChart3 },
  { id: 'configuration', label: 'Konfiguracija', icon: SlidersHorizontal },
  { id: 'delivery', label: 'Dostava', icon: Truck },
  { id: 'gift-cards', label: 'Darilne kartice', icon: CreditCard },
  { id: 'loyalty', label: 'Zvestoba', icon: Award },
  { id: 'printers', label: 'Tiskalniki', icon: Printer },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook },
  { id: 'settings', label: 'Nastavitve', icon: Settings },
]

export function Sidebar() {
  const { activeModule, setActiveModule, sidebarOpen, setSidebarOpen } = usePOSStore()
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()
  const [isFullscreen, setIsFullscreen] = useState(false)

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
          {navItems.map((item) => {
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
            {isFullscreen ? 'Izhod iz cel. zaslona' : 'Celozaslonski način'}
          </Button>
          {/* Tema */}
          {mounted && (
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-xs h-8"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              {theme === 'dark' ? 'Svetli način' : 'Temni način'}
            </Button>
          )}
        </div>
      </aside>
    </>
  )
}
