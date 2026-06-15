'use client'

import { memo } from 'react'
import { ShoppingCart, CheckCircle2, AlertTriangle } from 'lucide-react'
import type { Notification } from '../notifications/types'
import { formatNotifTime } from '../notifications/types'

// ============================================
// Tip konfiguracija za obvestila
// ============================================

export const typeConfig = {
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
} as const

// ============================================
// Posamezno obvestilo
// ============================================

interface NotificationItemProps {
  notif: Notification
  onRemove: (_id: string) => void
}

export const NotificationItem = memo(function NotificationItem({ notif, onRemove }: NotificationItemProps) {
  const config = typeConfig[notif.type as keyof typeof typeConfig] || typeConfig['new-order']
  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg ${config.bg} animate-in slide-in-from-right duration-300`}
      onClick={() => onRemove(notif.id)}
    >
      <div className={config.color}>{config.icon}</div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${config.color}`}>{notif.message}</p>
        <p className="text-[10px] text-muted-foreground">{formatNotifTime(notif.timestamp, 'HH:mm:ss')}</p>
      </div>
      <button onClick={() => onRemove(notif.id)} className="text-muted-foreground hover:text-foreground" aria-label="Zapri obvestilo">
        ×
      </button>
    </div>
  )
})
