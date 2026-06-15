// --- STATUSNE MAPE ---

export const statusLabels: Record<string, string> = {
  pending: '\u010Caka',
  preparing: 'V pripravi',
  ready: 'Pripravljeno',
  picked_up: 'Prevzeto',
  delivered: 'Dostavljeno',
  failed: 'Neuspe\u0161no',
}

export const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  preparing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  ready: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  picked_up: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  delivered: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

export const onlineStatusLabels: Record<string, string> = {
  pending: '\u010Caka',
  confirmed: 'Potrjeno',
  'in-progress': 'V pripravi',
  ready: 'Pripravljeno',
  completed: 'Zaklju\u010Deno',
  cancelled: 'Preklicano',
}

export const onlineStatusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  'in-progress': 'bg-orange-100 text-orange-800',
  ready: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-800',
}
