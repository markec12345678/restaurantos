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

/** Barve miz glede na status — Toast-inspired z gradient backgrounds */
export const statusColors: Record<string, string> = {
  available: 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-400 dark:from-emerald-950/40 dark:to-emerald-900/20 dark:border-emerald-700 hover:shadow-emerald-200/50',
  occupied: 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-400 dark:from-amber-950/40 dark:to-amber-900/20 dark:border-amber-700 hover:shadow-amber-200/50',
  reserved: 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-400 dark:from-blue-950/40 dark:to-blue-900/20 dark:border-blue-700 hover:shadow-blue-200/50',
  cleaning: 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-300 dark:from-gray-800/50 dark:to-gray-900/30 dark:border-gray-600 hover:shadow-gray-200/50',
}

/** Pike statusa mize — z glow efektom */
export const statusDot: Record<string, string> = {
  available: 'bg-emerald-500 shadow-sm shadow-emerald-500/50',
  occupied: 'bg-amber-500 shadow-sm shadow-amber-500/50',
  reserved: 'bg-blue-500 shadow-sm shadow-blue-500/50',
  cleaning: 'bg-gray-400 shadow-sm',
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
