'use client'

import { memo } from 'react'
import { Bell, BellRing, CheckCircle, UtensilsCrossed } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WaiterNotification, Order } from './types'

// ─── READY TAB — Pripravljeni artikli ──────────────────────────

interface ReadyTabProps {
  notifications: WaiterNotification[]
  orders: Order[]
  onAcknowledge: (_id: string) => void
  onMarkServed: (_orderId: string, _itemIds?: string[]) => void
  getElapsed: (_d: string | null) => number
}

export const ReadyTab = memo(function ReadyTab({ notifications, orders, onAcknowledge, onMarkServed, getElapsed }: ReadyTabProps) {
  if (notifications.length === 0 && orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
        <div className="w-24 h-24 rounded-3xl bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center mb-4">
          <CheckCircle className="w-12 h-12 text-emerald-500 opacity-60" />
        </div>
        <p className="text-xl font-bold">Ni pripravljenih artiklov</p>
        <p className="text-sm mt-1">Čakam na obvestila iz kuhinje...</p>
      </div>
    )
  }

  return (
    <div className="p-3 space-y-3">
      {/* Aktivna obvestila — PRIPRABLJENO! */}
      {notifications.map(notif => (
        <div key={notif.id}
          className={cn(
            'rounded-2xl border-2 overflow-hidden animate-fade-in-up shadow-lg',
            notif.allReady ? 'border-emerald-500' : 'border-amber-500'
          )}>
          <div className={cn('flex items-center justify-between px-4 py-2.5', notif.allReady ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white')}>
            <div className="flex items-center gap-2">
              {notif.allReady ? <BellRing className="w-5 h-5 animate-bounce" /> : <Bell className="w-5 h-5" />}
              <span className="font-bold text-sm">{notif.allReady ? 'VSE PRIPRAVLJENO!' : 'Artikel pripravljen'}</span>
            </div>
            <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">#{notif.orderNumber}</span>
          </div>
          <div className="px-4 py-3 space-y-2.5">
            {notif.tableNumber && (
              <div className="flex items-center gap-3">
                <span className={cn('text-3xl font-black px-5 py-2 rounded-xl',
                  notif.allReady ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'
                )}>Miza {notif.tableNumber}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-base">
              <UtensilsCrossed className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold">{notif.itemQuantity}x {notif.itemName}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div className={cn('h-full rounded-full', notif.allReady ? 'bg-emerald-500' : 'bg-amber-500')}
                  style={{ width: `${(notif.readyCount / Math.max(notif.totalItems, 1)) * 100}%` }} />
              </div>
              <span className="text-xs font-bold">{notif.readyCount}/{notif.totalItems}</span>
            </div>
            <button onClick={() => { onAcknowledge(notif.id); onMarkServed(notif.orderId) }}
              className={cn('w-full py-3.5 rounded-xl font-bold text-base transition-all active:scale-95 touch-manipulation min-h-[52px]',
                notif.allReady ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-amber-500 text-white hover:bg-amber-600'
              )}>
              {notif.allReady ? (
                <span className="flex items-center justify-center gap-2">
                  <CheckCircle className="w-5 h-5" />PREVZEM — Miza {notif.tableNumber || '?'}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <CheckCircle className="w-5 h-5" />PREVZEM
                </span>
              )}
            </button>
          </div>
        </div>
      ))}

      {/* Naročila s pripravljenimi artikli */}
      {orders.filter(o => !notifications.some(n => n.orderId === o.id)).map(order => {
        // FIX WAITER CRASH: order.items je lahko undefined — Array.isArray preverba
        const orderItems = Array.isArray(order.items) ? order.items : []
        const readyItems = orderItems.filter(i => i.status === 'ready')
        const pendingItems = orderItems.filter(i => !['ready', 'cancelled', 'served'].includes(i.status))
        return (
          <div key={order.id} className="rounded-xl border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">#{order.orderNumber}</span>
                {order.table && <span className="text-base font-black px-3 py-1 rounded-lg bg-primary/15 text-primary">Miza {order.table.number}</span>}
              </div>
              <span className="text-xs text-muted-foreground">{getElapsed(order.firedAt)}min</span>
            </div>
            <div className="space-y-1">
              {readyItems.map(item => (
                <div key={item.id} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-sm">
                  <span><b>{item.quantity}x</b> {item.name}</span>
                  <span className="text-xs text-emerald-600 font-bold">PRIPRABLJENO</span>
                </div>
              ))}
              {pendingItems.slice(0, 3).map(item => (
                <div key={item.id} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-sm">
                  <span><b>{item.quantity}x</b> {item.name}</span>
                  <span className="text-xs text-amber-600 font-bold">V PRIPRAVI</span>
                </div>
              ))}
              {pendingItems.length > 3 && <p className="text-xs text-muted-foreground text-center">+{pendingItems.length - 3} več</p>}
            </div>
            {readyItems.length > 0 && (
              <button onClick={() => onMarkServed(order.id, readyItems.map(i => i.id))}
                className="w-full py-3 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 active:scale-95 transition-all touch-manipulation min-h-[48px]">
                <CheckCircle className="w-4 h-4 inline mr-1" />Prevzemi pripravljene
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
})
