// ============================================
// TIPI IN KONSTANTE ZA COURSE PACING
// ============================================

interface CourseGroup {
  id: string
  name: string // Predjed, Glavna jed, Sladica, itd.
  sortOrder: number
  items: CourseItem[]
  status: 'waiting' | 'firing' | 'preparing' | 'ready' | 'served'
  firedAt?: string
  readyAt?: string
}

interface CourseItem {
  id: string
  name: string
  quantity: number
  modifiers: string[]
  notes: string
  status: 'pending' | 'preparing' | 'ready' | 'served'
  prepStation: string // kuhinja, šank, itd.
}

interface PacedOrder {
  id: string
  orderNumber: number
  tableNumber: number | null
  tableName: string | null
  customerName: string
  orderType: string
  createdAt: string
  courses: CourseGroup[]
  currentCourseIndex: number
  pacing: 'auto' | 'manual'
  avgGapMinutes: number
}

export type { CourseGroup, CourseItem, PacedOrder }

// ─── Standardni jedilni red ──────────────────────────────────────
export const DEFAULT_COURSE_ORDER = [
  { id: 'predjed', name: 'Predjed', sortOrder: 1 },
  { id: 'juha', name: 'Juha', sortOrder: 2 },
  { id: 'medkrožnik', name: 'Medkrožnik', sortOrder: 3 },
  { id: 'glavna', name: 'Glavna jed', sortOrder: 4 },
  { id: 'sir', name: 'Sir', sortOrder: 5 },
  { id: 'sladica', name: 'Sladica', sortOrder: 6 },
  { id: 'kava', name: 'Kava / Čaj', sortOrder: 7 },
]

// ─── Avtomatsko razvrščanje artiklov v jedi ──────────────────────
export const COURSE_KEYWORDS: Record<string, string[]> = {
  predjed: ['predjed', 'antipasti', 'starter', 'bruschetta', 'tartar', 'carpaccio', 'pršut', 'narezki'],
  juha: ['juha', 'supa', 'minestra', 'kremna', 'goveja'],
  medkrožnik: ['medkrožnik', 'sorbet', 'palčka'],
  glavna: ['steak', 'file', 'rižota', 'rižoto', 'testenine', 'paste', 'pizza', 'ribe', 'losos', 'tuna', 'puran', 'piščanec', 'svinjina', 'teletina', 'govedina', 'mongolski', 'burger', 'želodec', 'ocvrti', 'pečeno', 'žara', 'foliji', 'mošnjički', 'njoke', 'štruklji'],
  sir: ['sir', 'sirna', 'pladanj'],
  sladica: ['sladica', 'torta', 'tiramisu', 'panna', 'cotta', 'čokolada', 'cheesecake', 'palačinke', 'sladoled', 'kremšnita', 'gibanica', 'štrudelj', 'macaron', 'praline', 'fruit'],
  kava: ['kava', 'cappuccino', 'espresso', 'latte', 'čaj', 'matcha'],
}

export function classifyItem(itemName: string): string {
  const lower = itemName.toLowerCase()
  for (const [courseId, keywords] of Object.entries(COURSE_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return courseId
    }
  }
  return 'glavna' // Privzeto: glavna jed
}

// ─── Status barve ────────────────────────────────────────────────
export const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; icon: React.ReactNode }> = {
  waiting: { color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800', label: 'Čaka', icon: undefined },
  firing: { color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20', label: 'FIRE!', icon: undefined },
  preparing: { color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', label: 'V pripravi', icon: undefined },
  ready: { color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', label: 'Pripravljeno', icon: undefined },
  served: { color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-900/30', label: 'Postreženo', icon: undefined },
}

/** Props za PacingHeader */
export interface PacingHeaderProps {
  orderCount: number
}

/** Props za PacedOrderCard */
export interface PacedOrderCardProps {
  order: PacedOrder
  onFireCourse: (_orderId: string, _courseIndex: number) => void
  onReadyCourse: (_orderId: string, _courseIndex: number) => void
}

/** Props za CourseCard */
export interface CourseCardProps {
  course: CourseGroup
  isCurrentCourse: boolean
  canFire: boolean
  canMarkReady: boolean
  onFire: () => void
  onReady: () => void
}
