'use client'

import { useQuery } from '@tanstack/react-query'
import { usePOSStore } from '@/lib/store'
import { Bell, ShoppingCart, ChefHat, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'

// ============================================
// ZVOČNI UPRAVLJATELJ
// ============================================
class NotificationSoundManager {
  private audioContext: AudioContext | null = null
  private enabled = true

  toggle() {
    this.enabled = !this.enabled
    return this.enabled
  }

  isEnabled() { return this.enabled }

  private getContext() {
    if (!this.audioContext) this.audioContext = new AudioContext()
    return this.audioContext
  }

  playNewOrder() {
    if (!this.enabled) return
    try {
      const ctx = this.getContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.12)
      gain.gain.setValueAtTime(0.12, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.35)
    } catch { /* Audio not available */ }
  }

  playOrderReady() {
    if (!this.enabled) return
    try {
      const ctx = this.getContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(660, ctx.currentTime)
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1)
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.2)
      gain.gain.setValueAtTime(0.1, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.4)
    } catch { /* Audio not available */ }
  }

  playPaymentReceived() {
    if (!this.enabled) return
    try {
      const ctx = this.getContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(523, ctx.currentTime)
      osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1)
      gain.gain.setValueAtTime(0.08, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.3)
    } catch { /* Audio not available */ }
  }
}

const soundManager = new NotificationSoundManager()

// ============================================
// TIPI
// ============================================
interface Notification {
  id: string
  type: 'new-order' | 'order-ready' | 'payment' | 'urgent'
  message: string
  timestamp: Date
}

// ============================================
// KOMPONENTA
// ============================================
export function GlobalNotifications() {
  const { activeModule } = usePOSStore()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [lastOrderCount, setLastOrderCount] = useState<number>(0)
  const [lastReadyCount, setLastReadyCount] = useState<number>(0)

  // Poll for active orders
  const { data: orderStats } = useQuery({
    queryKey: ['notification-orders'],
    queryFn: async () => {
      const pending = await fetch('/api/orders?status=pending').then(r => r.json())
      const inProgress = await fetch('/api/orders?status=in-progress').then(r => r.json())
      const ready = await fetch('/api/orders?status=ready').then(r => r.json())
      return {
        pendingCount: pending.length,
        inProgressCount: inProgress.length,
        readyCount: ready.length,
        totalActive: pending.length + inProgress.length + ready.length,
      }
    },
    refetchInterval: 8000,
  })

  // Detect changes and create notifications
  useEffect(() => {
    if (!orderStats) return

    const currentActive = orderStats.totalActive
    const currentReady = orderStats.readyCount

    // New order detected
    if (lastOrderCount > 0 && currentActive > lastOrderCount) {
      const newCount = currentActive - lastOrderCount
      addNotification({
        type: 'new-order',
        message: `${newCount > 1 ? `${newCount} nova naročila` : 'Novo naročilo'}!`,
      })
      if (soundEnabled) soundManager.playNewOrder()
    }

    // New ready order detected
    if (lastReadyCount > 0 && currentReady > lastReadyCount) {
      addNotification({
        type: 'order-ready',
        message: 'Naročilo je pripravljeno za postrežbo!',
      })
      if (soundEnabled) soundManager.playOrderReady()
    }

    setLastOrderCount(currentActive)
    setLastReadyCount(currentReady)
  }, [orderStats, soundEnabled])

  const addNotification = useCallback((notif: Omit<Notification, 'id' | 'timestamp'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    setNotifications(prev => [{ ...notif, id, timestamp: new Date() }, ...prev].slice(0, 8))
    // Auto-remove after 6 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id))
    }, 6000)
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const toggleSound = useCallback(() => {
    const enabled = soundManager.toggle()
    setSoundEnabled(enabled)
  }, [])

  const typeConfig: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
    'new-order': {
      icon: <ShoppingCart className="h-4 w-4" />,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    },
    'order-ready': {
      icon: <CheckCircle2 className="h-4 w-4" />,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
    },
    'payment': {
      icon: <ShoppingCart className="h-4 w-4" />,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    },
    'urgent': {
      icon: <AlertTriangle className="h-4 w-4" />,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    },
  }

  return (
    <>
      {/* Floating notification container */}
      <div className="fixed top-3 right-3 z-50 flex flex-col gap-2 pointer-events-none" style={{ maxWidth: '360px' }}>
        {notifications.map(notif => {
          const config = typeConfig[notif.type] || typeConfig['new-order']
          return (
            <div
              key={notif.id}
              className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg ${config.bg} animate-in slide-in-from-right duration-300`}
              onClick={() => removeNotification(notif.id)}
            >
              <div className={config.color}>{config.icon}</div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${config.color}`}>{notif.message}</p>
                <p className="text-[10px] text-muted-foreground">{format(notif.timestamp, 'HH:mm:ss')}</p>
              </div>
              <button onClick={() => removeNotification(notif.id)} className="text-muted-foreground hover:text-foreground">
                ×
              </button>
            </div>
          )
        })}
      </div>

      {/* Sound toggle - fixed bottom right */}
      <button
        onClick={toggleSound}
        className="fixed bottom-3 right-3 z-40 flex h-8 w-8 items-center justify-center rounded-full bg-card border border-border shadow-sm hover:bg-accent transition-colors"
        title={soundEnabled ? 'Izklopi zvoke' : 'Vklopi zvoke'}
      >
        <Bell className={`h-3.5 w-3.5 ${soundEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
      </button>

      {/* Active order badge - top right when not on orders/kitchen */}
      {activeModule !== 'orders' && activeModule !== 'kitchen' && orderStats && orderStats.totalActive > 0 && (
        <button
          onClick={() => usePOSStore.getState().setActiveModule('orders')}
          className="fixed top-3 right-3 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors text-xs font-semibold"
        >
          <ShoppingCart className="h-3.5 w-3.5" />
          {orderStats.totalActive} aktivnih
        </button>
      )}
    </>
  )
}

function format(date: Date, fmt: string): string {
  const h = date.getHours().toString().padStart(2, '0')
  const m = date.getMinutes().toString().padStart(2, '0')
  const s = date.getSeconds().toString().padStart(2, '0')
  return fmt.replace('HH', h).replace('mm', m).replace('ss', s)
}
