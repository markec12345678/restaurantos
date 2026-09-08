'use client'

import { useState, useEffect, memo } from 'react'
import { Bell, X, CheckCircle2, AlertTriangle, Info, ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// ============================================
// NOTIFICATION CENTER — Real-time obvestila
// ============================================

type NotificationType = 'success' | 'warning' | 'error' | 'info' | 'order'

interface Notification {
  id: string
  type: NotificationType
  title: string
  message?: string
  timestamp: Date
  read: boolean
}

const NOTIF_ICONS: Record<NotificationType, typeof Bell> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertTriangle,
  info: Info,
  order: ShoppingCart,
}

const NOTIF_COLORS: Record<NotificationType, string> = {
  success: 'text-emerald-500',
  warning: 'text-amber-500',
  error: 'text-red-500',
  info: 'text-blue-500',
  order: 'text-purple-500',
}

const NOTIF_BG: Record<NotificationType, string> = {
  success: 'bg-emerald-50 dark:bg-emerald-950/30',
  warning: 'bg-amber-50 dark:bg-amber-950/30',
  error: 'bg-red-50 dark:bg-red-950/30',
  info: 'bg-blue-50 dark:bg-blue-950/30',
  order: 'bg-purple-50 dark:bg-purple-950/30',
}

export const NotificationCenter = memo(function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)

  const unreadCount = notifications.filter(n => !n.read).length

  useEffect(() => {
    const handleWsMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data)
        if (!msg.type) return

        let notifType: NotificationType = 'info'
        let title = msg.type
        let message: string | undefined

        switch (msg.type) {
          case 'NEW_ORDER':
            notifType = 'order'
            title = `Novo naročilo #${msg.payload?.orderNumber || '?'}`
            message = msg.payload?.tableId ? `Miza ${msg.payload?.tableNumber || '?'}` : 'Za seboj'
            break
          case 'ORDER_CANCELLED':
            notifType = 'warning'
            title = `Preklicano: #${msg.payload?.orderNumber || '?'}`
            message = msg.payload?.cancelReason
            break
          case 'ORDER_UPDATED':
            notifType = 'info'
            title = `Posodobljeno: #${msg.payload?.orderNumber || '?'}`
            message = `Status: ${msg.payload?.newStatus || '?'}`
            break
          case 'STOCK_LOW':
            notifType = 'warning'
            title = `Nizka zaloga: ${msg.payload?.name || '?'}`
            message = `Trenutno: ${msg.payload?.currentQty} (min: ${msg.payload?.minQty})`
            break
          case 'ITEM_STATUS_CHANGED':
            notifType = 'success'
            title = `Pripravljeno: ${msg.payload?.itemName || '?'}`
            message = `Naročilo #${msg.payload?.orderNumber || '?'}`
            break
          default:
            return
        }

        const newNotif: Notification = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: notifType, title, message,
          timestamp: new Date(), read: false,
        }
        setNotifications(prev => [newNotif, ...prev].slice(0, 50))
      } catch { /* ignore */ }
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws`
    try {
      const ws = new WebSocket(wsUrl)
      ws.onopen = () => {
        setWsConnected(true)
        // WS AUDIT 2026-09-09: server ZAHTEVA AUTH sporočilo v 10s — brez njega
        // povezavo zapre (4001). Token nikoli v URL-ju, vedno kot AUTH sporočilo.
        const token = sessionStorage.getItem('pos_auth_token') || localStorage.getItem('pos_token')
        if (token) {
          ws.send(JSON.stringify({ type: 'AUTH', payload: { token } }))
        }
      }
      ws.onclose = () => setWsConnected(false)
      ws.onmessage = handleWsMessage
      return () => ws.close()
    } catch { /* WS not available */ }
  }, [])

  function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  function clearAll() { setNotifications([]) }
  function dismissNotif(id: string) {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  function formatTime(date: Date) {
    const diff = Date.now() - date.getTime()
    if (diff < 60_000) return 'zdaj'
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min`
    return date.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="relative">
      <Button
        variant="ghost" size="icon"
        className="relative btn-press"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Obvestila"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-fade-in-up">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        {wsConnected && (
          <span className="absolute bottom-0.5 right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-1 ring-background" />
        )}
      </Button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div
            className="absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-2rem)] bg-card border rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in-up"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">Obvestila</h3>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="text-xs">{unreadCount} novo</Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>Označi vse</Button>
                )}
                {notifications.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={clearAll}>Počisti</Button>
                )}
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto smooth-scroll">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Bell className="h-10 w-10 opacity-30 mb-2" />
                  <p className="text-sm font-medium">Ni obvestil</p>
                  <p className="text-xs">Obvestila bodo prikazana tukaj</p>
                </div>
              ) : (
                notifications.map(notif => {
                  const Icon = NOTIF_ICONS[notif.type]
                  return (
                    <div
                      key={notif.id}
                      className={cn(
                        'flex gap-3 px-4 py-3 border-b last:border-0 transition-colors hover:bg-muted/30 cursor-pointer animate-fade-in-up',
                        !notif.read && NOTIF_BG[notif.type]
                      )}
                      onClick={() => dismissNotif(notif.id)}
                    >
                      <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', NOTIF_COLORS[notif.type])} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={cn('text-sm font-medium truncate', !notif.read && 'font-bold')}>
                            {notif.title}
                          </p>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {formatTime(notif.timestamp)}
                          </span>
                        </div>
                        {notif.message && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{notif.message}</p>
                        )}
                      </div>
                      {!notif.read && (
                        <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
                      )}
                    </div>
                  )
                })
              )}
            </div>

            <div className="px-4 py-2 border-t bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                {wsConnected ? (
                  <><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Povezano</>
                ) : (
                  <><span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" /> Nepovezano</>
                )}
              </span>
              <span>WebSocket real-time</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
})
