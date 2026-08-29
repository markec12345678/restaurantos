'use client'

import { useQuery } from '@tanstack/react-query'
import { usePOSStore } from '@/lib/store'
import { Bell, ShoppingCart, AlertTriangle } from 'lucide-react'
import { useState, useEffect, useCallback, useRef, memo } from 'react'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import type { Notification } from './notifications/types'
import { soundManager } from './notifications/NotificationSoundManager'
import { NotificationItem } from './notifications/NotificationItem'

// ============================================
// KOMPONENTA
// ============================================
export const GlobalNotifications = memo(function GlobalNotifications() {
  const activeModule = usePOSStore(s => s.activeModule)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pos-sound-enabled')
      return saved !== null ? saved === 'true' : true
    }
    return true
  })
  const lastOrderCountRef = useRef<number>(0)
  const lastReadyCountRef = useRef<number>(0)

  const { data: orderStats } = useQuery({
    queryKey: ['notification-orders'],
    queryFn: async () => {
      try {
        const [pendingRes, inProgressRes, readyRes] = await Promise.all([
          authFetch('/api/orders?status=pending'),
          authFetch('/api/orders?status=in-progress'),
          authFetch('/api/orders?status=ready'),
        ])
        const [pending, inProgress, ready] = await Promise.all([
          pendingRes.ok ? pendingRes.json() : [],
          inProgressRes.ok ? inProgressRes.json() : [],
          readyRes.ok ? readyRes.json() : [],
        ])
        return { pendingCount: pending.length, inProgressCount: inProgress.length, readyCount: ready.length, totalActive: pending.length + inProgress.length + ready.length }
      } catch {
        return { pendingCount: 0, inProgressCount: 0, readyCount: 0, totalActive: 0 }
      }
    },
    refetchInterval: 5000,
  })

  const { data: lowStockData } = useQuery({
    queryKey: queryKeys.inventory.lowStock,
    queryFn: async () => {
      try {
        const res = await authFetch('/api/inventory')
        if (!res.ok) return { count: 0, items: [] }
        const json = await res.json()
        // FIX TypeError: m?.map is not a function — API vrača { items: [...] }, ne [...]
        // Prej: const items = await res.json() — items je bil objekt, items.filter je crash-al
        const items = Array.isArray(json) ? json : (json.items ?? [])
        const lowItems = items.filter((i: { quantity: number; minQuantity: number }) => i.quantity <= i.minQuantity)
        return { count: lowItems.length, items: lowItems.slice(0, 3) }
      } catch {
        return { count: 0, items: [] }
      }
    },
    refetchInterval: 60000,
  })

  const addNotification = useCallback((notif: Omit<Notification, 'id' | 'timestamp'>) => {
    const id = Math.random().toString(36).substring(2, 11)
    setNotifications(prev => [{ ...notif, id, timestamp: new Date() }, ...prev].slice(0, 8))
    setTimeout(() => { setNotifications(prev => prev.filter(n => n.id !== id)) }, 6000)
  }, [])

  useEffect(() => {
    if (!orderStats) return
    const currentActive = orderStats.totalActive
    const currentReady = orderStats.readyCount
    queueMicrotask(() => {
      if (lastOrderCountRef.current > 0 && currentActive > lastOrderCountRef.current) {
        const newCount = currentActive - lastOrderCountRef.current
        addNotification({ type: 'new-order', message: `${newCount > 1 ? `${newCount} nova naročila` : 'Novo naročilo'}!` })
        if (soundEnabled) soundManager.playNewOrder()
      }
      if (lastReadyCountRef.current > 0 && currentReady > lastReadyCountRef.current) {
        addNotification({ type: 'order-ready', message: 'Naročilo je pripravljeno za postrežbo!' })
        if (soundEnabled) soundManager.playOrderReady()
      }
    })
    lastOrderCountRef.current = currentActive
    lastReadyCountRef.current = currentReady
  }, [orderStats, soundEnabled, addNotification])

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const toggleSound = useCallback(() => {
    const enabled = soundManager.toggle()
    setSoundEnabled(enabled)
    localStorage.setItem('pos-sound-enabled', String(enabled))
  }, [])

  return (
    <>
      <div className="fixed top-3 right-3 z-50 flex flex-col gap-2 pointer-events-none" style={{ maxWidth: '360px' }}>
        {notifications.map(notif => (
          <NotificationItem key={notif.id} notif={notif} onRemove={removeNotification} />
        ))}
      </div>
      <button onClick={toggleSound} className="fixed bottom-3 right-3 z-40 flex h-8 w-8 items-center justify-center rounded-full bg-card border border-border shadow-sm hover:bg-accent transition-colors" title={soundEnabled ? 'Izklopi zvoke' : 'Vklopi zvoke'} aria-label={soundEnabled ? 'Izklopi zvoke' : 'Vklopi zvoke'}>
        <Bell className={`h-3.5 w-3.5 ${soundEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
      </button>
      {activeModule !== 'orders' && activeModule !== 'kitchen' && orderStats && orderStats.totalActive > 0 && (
        <button onClick={() => usePOSStore.getState().setActiveModule('orders')} className="fixed top-3 right-3 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors text-xs font-semibold">
          <ShoppingCart className="h-3.5 w-3.5" />{orderStats.totalActive} aktivnih
        </button>
      )}
      {activeModule !== 'inventory' && lowStockData && lowStockData.count > 0 && (
        <button onClick={() => usePOSStore.getState().setActiveModule('inventory')} className="fixed bottom-3 right-14 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 shadow-lg hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors text-xs font-semibold">
          <AlertTriangle className="h-3.5 w-3.5" />{lowStockData.count} nizkih zal.
        </button>
      )}
    </>
  )
})
