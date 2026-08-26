// ============================================
// TIPI IN KONSTANTE ZA KUHINJSKE POSTAJE
// ============================================

export interface Station {
  id: string
  name: string
  type: 'grill' | 'fry' | 'salad' | 'dessert' | 'pizza' | 'sushi' | 'bar' | 'prep' | 'saute' | 'general'
  icon: string
  status: 'active' | 'paused' | 'closed'
  capacity: number
  currentLoad: number
  queue: StationOrder[]
  avgPrepTime: number
  assignedCooks: string[]
  temperature: number | null
  lastOrderAt: string | null
}

export interface StationOrder {
  id: string
  orderId: string
  itemName: string
  quantity: number
  priority: 'normal' | 'high' | 'rush'
  startedAt: string | null
  estimatedMinutes: number
  elapsedMinutes: number
  notes: string | null
}

/** Privzete postaje brez naročil in obremenitve */
export const stationDefaults: Omit<Station, 'queue' | 'currentLoad' | 'lastOrderAt'>[] = [
  { id: 'grill', name: 'Žar', type: 'grill', icon: '🥩', status: 'active', capacity: 8, avgPrepTime: 12, assignedCooks: [], temperature: null },
  { id: 'fry', name: 'Friteza', type: 'fry', icon: '🍟', status: 'active', capacity: 10, avgPrepTime: 6, assignedCooks: [], temperature: null },
  { id: 'saute', name: 'Kuhalna plošča', type: 'saute', icon: '🍳', status: 'active', capacity: 6, avgPrepTime: 15, assignedCooks: [], temperature: null },
  { id: 'salad', name: 'Hladna kuhinja', type: 'salad', icon: '🥗', status: 'active', capacity: 12, avgPrepTime: 5, assignedCooks: [], temperature: null },
  { id: 'pizza', name: 'Peč za pice', type: 'pizza', icon: '🍕', status: 'active', capacity: 4, avgPrepTime: 12, assignedCooks: [], temperature: null },
  { id: 'dessert', name: 'Sladice', type: 'dessert', icon: '🍰', status: 'active', capacity: 8, avgPrepTime: 8, assignedCooks: [], temperature: null },
  { id: 'bar', name: 'Bar', type: 'bar', icon: '🍸', status: 'active', capacity: 15, avgPrepTime: 3, assignedCooks: [], temperature: null },
  { id: 'prep', name: 'Priprava', type: 'prep', icon: '🔪', status: 'active', capacity: 10, avgPrepTime: 10, assignedCooks: [], temperature: null },
]

/** Preslikava kategorij/nazivov na postaje */
export const typeMapping: Record<string, string> = {
  'grill': 'grill', 'steak': 'grill', 'meso': 'grill', 'burger': 'grill',
  'fry': 'fry', 'friteza': 'fry', 'pomfrit': 'fry', 'krompirček': 'fry',
  'salad': 'salad', 'solate': 'salad', 'hladno': 'salad',
  'pizza': 'pizza', 'pice': 'pizza',
  'dessert': 'dessert', 'sladice': 'dessert', 'sladko': 'dessert', 'torta': 'dessert',
  'bar': 'bar', 'pijača': 'bar', 'koktajl': 'bar', 'vino': 'bar', 'kava': 'bar', 'coffee': 'bar',
  'saute': 'saute', 'testenine': 'saute', 'rižote': 'saute', 'rižota': 'saute', 'juhe': 'saute', 'soup': 'saute',
  'prep': 'prep', 'predjedi': 'prep', 'prigrizki': 'prep',
}

/** Konfiguracija prioritete naročil */
export const priorityConfig = {
  normal: { label: 'Normalno', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
  high: { label: 'Prioritetno', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  rush: { label: 'NUJNO', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
}
