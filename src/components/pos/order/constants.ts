// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Order Panel skupne tipi, konstante in pomožne funkcije
// ═══════════════════════════════════════════════════════════════

// Status mape za naročila
export const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  'in-progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  ready: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  completed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

export const NEXT_STATUS: Record<string, string> = {
  pending: 'in-progress',
  'in-progress': 'ready',
  ready: 'completed',
}

export const STATUS_LABELS: Record<string, string> = {
  pending: 'Čakajoče',
  'in-progress': 'V obdelavi',
  ready: 'Pripravljeno',
  completed: 'Zaključeno',
  cancelled: 'Preklicano',
}

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: 'Neplačano',
  paid: 'Plačano',
  partial: 'Delno',
  storno: 'Stornirano',
}

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  unpaid: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  partial: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  storno: 'bg-red-200 text-red-900 dark:bg-red-900/40 dark:text-red-300',
}
