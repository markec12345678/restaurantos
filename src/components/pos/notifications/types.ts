// ============================================
// TIPI ZA GLOBALNA OBVESTILA
// ============================================

export interface Notification {
  id: string
  type: 'new-order' | 'order-ready' | 'payment' | 'urgent'
  message: string
  timestamp: Date
}

export interface NotificationTypeConfig {
  icon: React.ReactNode
  color: string
  bg: string
}

/** Konfiguracija za različne tipe obvestil */
export const NOTIFICATION_TYPE_CONFIG: Record<string, NotificationTypeConfig> = {
  'new-order': {
    icon: null, // Nastavljen v komponenti, ker uporablja JSX
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  },
  'order-ready': {
    icon: null,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
  },
  'payment': {
    icon: null,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  },
  'urgent': {
    icon: null,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  },
}

/** Formatiranje časa obvestila */
export function formatNotifTime(date: Date, fmt: string): string {
  const h = date.getHours().toString().padStart(2, '0')
  const m = date.getMinutes().toString().padStart(2, '0')
  const s = date.getSeconds().toString().padStart(2, '0')
  return fmt.replace('HH', h).replace('mm', m).replace('ss', s)
}
