'use client'

import { usePOSStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n'
import { getCountryConfig, type CountryCode } from '@/lib/country-config'
import { ChefHat, Sun, Moon, Menu, X, Store, Maximize, Minimize, Monitor, ExternalLink, HandMetal } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { Button } from '@/components/ui/button'
import { useQuery } from '@tanstack/react-query'
import { hasPermission, authFetch } from '@/components/pos/PinLogin'
import { UserIndicator } from '@/components/pos/PinLogin'
import { LanguageSwitcher } from '@/components/pos/LanguageSwitcher'
import { queryKeys } from '@/lib/query-keys'
import { useSidebarHoverPrefetch } from '@/lib/use-module-prefetch'
import { navItems } from './navItems'
import { useAuthUser, useMounted } from './useAuthUser'

export const Sidebar = memo(function Sidebar() {
  const activeModule = usePOSStore(s => s.activeModule)
  const setActiveModule = usePOSStore(s => s.setActiveModule)
  const sidebarOpen = usePOSStore(s => s.sidebarOpen)
  const setSidebarOpen = usePOSStore(s => s.setSidebarOpen)
  const setKioskMode = usePOSStore(s => s.setKioskMode)
  const country = usePOSStore(s => s.country)
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()
  const [isFullscreen, setIsFullscreen] = useState(false)
  const { onModuleHover } = useSidebarHoverPrefetch()
  const countryConfig = getCountryConfig(country as CountryCode)

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }, [])

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const authUser = useAuthUser()

  const visibleNavItems = useMemo(() => navItems.filter(item => {
    if (!authUser) return false
    if (item.adminOnly && authUser.role !== 'admin' && authUser.role !== 'manager') return false
    if (item.permission && !hasPermission(item.permission)) return false
    return true
  }), [authUser])

  const { data: ordersData } = useQuery({
    queryKey: queryKeys.orders.sidebar,
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
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}

      {/* Mobile hamburger */}
      <Button
        variant="ghost" size="icon" className="fixed top-3 left-3 z-50 md:hidden"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label={sidebarOpen ? 'Zapri meni' : 'Odpri meni'}
        aria-expanded={sidebarOpen}
      >
        {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Sidebar */}
      <aside
        aria-label="Glavna navigacija"
        className={cn(
          'fixed md:static inset-y-0 left-0 z-50 flex flex-col w-56 bg-card border-r border-border transition-transform duration-300 md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border" aria-label="RestaurantOS - domača stran">
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
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto custom-scrollbar" aria-label="Glavna navigacija">
          {visibleNavItems.map((item) => {
            const Icon = item.icon
            const isActive = activeModule === item.id
            return (
              <button
                key={item.id}
                onClick={() => { setActiveModule(item.id); setSidebarOpen(false) }}
                onMouseEnter={() => onModuleHover(item.id)}
                aria-current={isActive ? 'page' : undefined}
                aria-label={t(item.labelKey)}
                className={cn(
                  'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? item.highlight ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {t(item.labelKey)}
                {item.id === 'orders' && activeOrderCount > 0 && (
                  <span className="ml-auto flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1" aria-label={`${activeOrderCount} aktivnih naročil`}>
                    {activeOrderCount}
                  </span>
                )}
                {item.id === 'kitchen' && activeOrderCount > 0 && (
                  <span className="ml-auto flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-orange-500 text-white text-[9px] font-bold px-1" aria-label={`${activeOrderCount} v pripravi`}>
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
          <div className="grid grid-cols-2 gap-1 px-0.5 pb-1">
            <a href="/kds" target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 text-[10px] font-bold hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors touch-manipulation"
              title="KDS - Kitchen Display System">
              <ChefHat className="h-3 w-3" /> KDS <ExternalLink className="h-2.5 w-2.5" />
            </a>
            <a href="/waiter" target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-[10px] font-bold hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors touch-manipulation"
              title="Odpri natakarjevo tablico">
              <HandMetal className="h-3 w-3" /> {t('sidebar.waiter')} <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
          <Button variant="ghost" className="w-full justify-start gap-2 text-xs h-8" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
            {isFullscreen ? t('nav.exitFullscreen') : t('nav.fullscreen')}
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-2 text-xs h-8 touch-manipulation" onClick={() => setKioskMode(true)}>
            <Monitor className="h-3.5 w-3.5" /> {t('nav.kiosk')}
          </Button>
          {mounted && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" className="flex-1 justify-start gap-2 text-xs h-8" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
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
})
