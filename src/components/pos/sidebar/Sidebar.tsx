'use client'

import { usePOSStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n'
import { getCountryConfig, type CountryCode } from '@/lib/country-config'
import { Menu, X, Store } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { Button } from '@/components/ui/button'
import { useQuery } from '@tanstack/react-query'
import { hasPermission, authFetch } from '@/components/pos/PinLogin'
import { UserIndicator } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { useSidebarHoverPrefetch } from '@/lib/use-module-prefetch'
import dynamic from 'next/dynamic'
import { navItems } from './navItems'
import { useAuthUser, useMounted } from './useAuthUser'

const SidebarBottom = dynamic(() => import('./SidebarBottom').then(m => ({ default: m.SidebarBottom })), { ssr: false })
const SidebarNav = dynamic(() => import('./SidebarNav').then(m => ({ default: m.SidebarNav })), { ssr: false })

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
      {sidebarOpen && (<div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />)}
      <Button variant="ghost" size="icon" className="fixed top-3 left-3 z-50 md:hidden" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label={sidebarOpen ? 'Zapri meni' : 'Odpri meni'} aria-expanded={sidebarOpen}>
        {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>
      <aside aria-label="Glavna navigacija" className={cn('fixed md:static inset-y-0 left-0 z-50 flex flex-col w-56 bg-card border-r border-border transition-transform duration-300 md:translate-x-0', sidebarOpen ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border" aria-label="RestaurantOS - domača stran">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Store className="h-4.5 w-4.5" />
          </div>
          <div>
            <h1 className="font-bold text-sm leading-tight flex items-center gap-1.5">RestaurantOS<span className="text-base">{countryConfig.flag}</span></h1>
            <p className="text-[10px] text-muted-foreground">{t('nav.posSystem')} · {countryConfig.currencySymbol}</p>
          </div>
        </div>
        <SidebarNav
          visibleNavItems={visibleNavItems}
          activeModule={activeModule}
          activeOrderCount={activeOrderCount}
          onModuleClick={(id) => { setActiveModule(id); setSidebarOpen(false) }}
          onModuleHover={onModuleHover}
        />
        <UserIndicator />
        <SidebarBottom isFullscreen={isFullscreen} toggleFullscreen={toggleFullscreen} setKioskMode={setKioskMode} theme={theme} setTheme={setTheme} mounted={mounted} />
      </aside>
    </>
  )
})
