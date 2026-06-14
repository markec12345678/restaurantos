// ============================================
// TIPI, KONSTANTE IN POMOŽNE FUNKCIJE
// za podkomponente upravljanja miz
// ============================================

// --- Tipi ---

/** Podatki o mizi iz API-ja */
export interface TableData {
  id: string
  number: number | string
  capacity: number | string
  area: string
  status: string
  [key: string]: unknown
}

/** Podatki obrazca za dodajanje/urejanje mize */
export interface TableFormData {
  number: string
  capacity: string
  area: string
  status: string
}

/** Naročilo povezano z mizo */
export interface TableOrderData {
  id: string
  orderNumber: number
  status: string
  total: number
  customerName: string
  paymentStatus: string
  createdAt: string
  orderItems: {
    id: string
    menuItem: { name: string }
    quantity: number
    price: number
  }[]
}

// --- Konstante ---

/** Barve miz glede na status */
export const statusColors: Record<string, string> = {
  available: 'bg-emerald-100 border-emerald-300 dark:bg-emerald-900/30 dark:border-emerald-800',
  occupied: 'bg-red-100 border-red-300 dark:bg-red-900/30 dark:border-red-800',
  reserved: 'bg-yellow-100 border-yellow-300 dark:bg-yellow-900/30 dark:border-yellow-800',
  cleaning: 'bg-gray-100 border-gray-300 dark:bg-gray-800/50 dark:border-gray-700',
}

/** Pike statusa mize */
export const statusDot: Record<string, string> = {
  available: 'bg-emerald-500',
  occupied: 'bg-red-500',
  reserved: 'bg-yellow-500',
  cleaning: 'bg-gray-400',
}

/** Oznake območij — slovenščina */
export const areaLabels: Record<string, string> = {
  main: 'Glavna dvorana',
  patio: 'Terasa',
  bar: 'Bar',
  private: 'Zasebni prostor',
}

/** Oznake statusov — slovenščina */
export const statusLabels: Record<string, string> = {
  available: 'Prosta',
  occupied: 'Zasedena',
  reserved: 'Rezervirana',
  cleaning: 'Čiščenje',
}

/** Barve statusov naročil */
export const orderStatusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  'in-progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  ready: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  completed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
}

/** Oznake statusov naročil — slovenščina */
export const orderStatusLabels: Record<string, string> = {
  pending: 'Čakajoče',
  'in-progress': 'V obdelavi',
  ready: 'Pripravljeno',
  completed: 'Zaključeno',
}
