'use client'

import { cn } from '@/lib/utils'
import { Bell, BellRing, ShoppingCart, UtensilsCrossed, RefreshCw, Wifi, WifiOff, HandMetal } from 'lucide-react'
import { ErrorBoundary } from '@/components/error-boundary'
import dynamic from 'next/dynamic'

import { useWaiterPage } from './useWaiterPage'

// Lazy-load podkomponente
const WaiterLogin = dynamic(() => import('./WaiterLogin').then(m => ({ default: m.WaiterLogin })), { ssr: false })
const ReadyTab = dynamic(() => import('./ReadyTab').then(m => ({ default: m.ReadyTab })), { ssr: false })
const OrdersTab = dynamic(() => import('./OrdersTab').then(m => ({ default: m.OrdersTab })), { ssr: false })

// ═══════════════════════════════════════════════════════════════
// GOSTILNA POS — Natakarjeva tablica (/waiter)
// Optimiziran pogled za natakarjev Android/iPad:
// - Moje mize in naročila
// - Pripravljeni artikli iz kuhinje
// - Hitro dodajanje naročil
// - Plačevanje na mizi
// ═══════════════════════════════════════════════════════════════

export default function WaiterPage() {
  const {
    employee,
    activeTab,
    wsConnected,
    isLoading,
    ordersWithReady,
    myOrders,
    allOrders,
    unacknowledged,
    refetch,
    handleMarkServed,
    acknowledge,
    getElapsed,
    setActiveTab,
    setEmployee,
  } = useWaiterPage()

  // ─── Če ni prijavljen ───
  if (!employee) return <WaiterLogin onLogin={setEmployee} />

  return (
    <ErrorBoundary context="Waiter" maxRetries={3}>
    <div className="flex flex-col h-screen bg-background">
      {/* ─── HEADER ─── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-card shadow-sm">
        <div className="flex items-center gap-3">
          <HandMetal className="w-6 h-6 text-blue-500" />
          <h1 className="text-lg font-bold">Natakar</h1>
          <span className="text-sm text-muted-foreground">{employee.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {unacknowledged.length > 0 && (
            <button onClick={() => setActiveTab('ready')}
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-bold animate-pulse touch-manipulation min-h-[40px]">
              <BellRing className="w-4 h-4" />
              {unacknowledged.length} pripravljenih
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold">{unacknowledged.length}</span>
            </button>
          )}
          <button onClick={() => refetch()} className="w-9 h-9 flex items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 touch-manipulation min-h-[44px]" aria-label="Osveži">
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className={cn('flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg font-medium', wsConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800')}>
            {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {wsConnected ? 'Live' : 'Offline'}
          </div>
        </div>
      </div>

      {/* ─── TAB NAVIGACIJA ─── */}
      <div className="flex border-b bg-card">
        {[
          { key: 'ready' as const, label: 'Pripravljeno', icon: Bell, count: ordersWithReady.length + unacknowledged.length, color: 'text-amber-600' },
          { key: 'myorders' as const, label: 'Moja naročila', icon: ShoppingCart, count: myOrders.length, color: 'text-blue-600' },
          { key: 'alltables' as const, label: 'Vse mize', icon: UtensilsCrossed, count: allOrders.length, color: 'text-emerald-600' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors touch-manipulation min-h-[48px] relative',
              activeTab === tab.key
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-muted-foreground hover:text-foreground'
            )}>
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count > 0 && (
              <span className={cn(
                'min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full flex items-center justify-center',
                activeTab === tab.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              )}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ─── VSEBINA ─── */}
      <div className="flex-1 overflow-y-auto pos-scroll">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (<div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />))}
          </div>
        ) : activeTab === 'ready' ? (
          <ReadyTab
            notifications={unacknowledged}
            orders={ordersWithReady}
            onAcknowledge={acknowledge}
            onMarkServed={handleMarkServed}
            getElapsed={getElapsed}
          />
        ) : activeTab === 'myorders' ? (
          <OrdersTab orders={myOrders} onMarkServed={handleMarkServed} getElapsed={getElapsed} />
        ) : (
          <OrdersTab orders={allOrders} onMarkServed={handleMarkServed} getElapsed={getElapsed} />
        )}
      </div>
    </div>
    </ErrorBoundary>
  )
}
