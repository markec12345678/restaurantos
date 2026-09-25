// ============================================
// TIPI IN KONSTANTE ZA COURSE PACING (R134)
// ============================================
// KANON R134 (epic #115 P1-10): Course entiteta je edini vir resnice.
// Prejšnja heuristika (classifyItem / COURSE_KEYWORDS po imenu artikla,
// izmišljeni statusi 'waiting'/'firing', DEFAULT_COURSE_ORDER, trdo kodiran
// avgGapMinutes) je IZBRISANA — UI prikazuje samo realne Course podatke iz
// /api/kitchen (flattened courseNumber/courseName/courseStatus/courseId).
//
// Realni statusi (state machine na strežniku):
//   pending <-> held; pending|held -> fired -> ready -> served (+cancelled).
//   'preparing' je v modelu prisoten (legacy ročni vpisi) — prikazan, brez akcij.
// ============================================

// ─── Statusi ──────────────────────────────────────────────────────
export type CourseStatus =
  | 'pending'
  | 'held'
  | 'fired'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'cancelled'

/** Vse akcije nad tokom (PUT /api/courses/[id] body { action }) */
export type CourseAction = 'fire' | 'hold' | 'unhold' | 'ready' | 'served'

/** Status posameznega orderItem-a (item-level, ne course-level) */
export type CourseItemStatus = 'pending' | 'fired' | 'preparing' | 'ready' | 'served' | 'cancelled' | 'held'

// ─── Tipi (podatki iz /api/kitchen) ──────────────────────────────
export interface CourseItem {
  id: string
  name: string
  quantity: number
  modifiers: string[]
  notes: string
  /** Item status iz /api/kitchen (nastavljen s course fire/ready propagacijo) */
  status: CourseItemStatus
  /** Flattened course polja — vsa OPTIONAL (legacy itemi brez course) */
  courseNumber: number | null
  courseName: string | null
  courseStatus: string | null
  courseId: string | null
}

/** Skupina postavk istega toka znotraj naročila */
export interface CourseGroup {
  /** Številka toka (1..8); null = 'Brez toka' (legacy itemi brez course) */
  courseNumber: number | null
  name: string
  /** Course row id — AKCIJE so možne SAMO če obstaja (fire/hold/ready/...) */
  courseId: string | null
  /** Course-level status (iz courseStatus flattened polja); null = neznano */
  status: string | null
  items: CourseItem[]
}

export interface PacedOrder {
  id: string
  orderNumber: number
  tableNumber: number | null
  tableName: string | null
  customerName: string
  orderType: string
  createdAt: string | null
  courses: CourseGroup[]
  /** Vsaj en tok v statusu 'pending' → fire next/all sta smiselna */
  hasPending: boolean
}

// ─── Kanonska imena tokov (kanon 3: 1..4 fiksno, >=5 'Tok {n}') ──
export const COURSE_NAMES: Record<number, string> = {
  1: 'Predjed',
  2: 'Juha',
  3: 'Glavna jed',
  4: 'Sladica',
}

/** Ime toka po številki — neznane številke → 'Tok {n}' (pariteta strežnika) */
export function courseNameFor(courseNumber: number): string {
  return COURSE_NAMES[courseNumber] ?? `Tok ${courseNumber}`
}

// ─── Opcije za izbiro toka v košarici (opt-in toggle 'Tokovi') ───
export const CART_COURSE_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: '1 · Predjed' },
  { value: 2, label: '2 · Juha' },
  { value: 3, label: '3 · Glavna jed' },
  { value: 4, label: '4 · Sladica' },
]

/** Default tok pri oddaji s prižganimi Tokovi (kanon 3: 'Glavna jed') */
export const DEFAULT_CART_COURSE = 3

// ─── Status barve (paleta: emerald/amber/red/zinc + orange za ogenj) ──
export const COURSE_STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: 'text-zinc-600 dark:text-zinc-400', bg: 'bg-zinc-50 dark:bg-zinc-900/40', label: 'Čaka' },
  held: { color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30', label: 'Zadržan' },
  fired: { color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/30', label: 'Požgan' },
  preparing: { color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30', label: 'V pripravi' },
  ready: { color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30', label: 'Pripravljeno' },
  served: { color: 'text-zinc-500 dark:text-zinc-500', bg: 'bg-zinc-50 dark:bg-zinc-900/40', label: 'Postreženo' },
  cancelled: { color: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30', label: 'Preklicano' },
}

/** Item-level barva/status znak (pariteta z današnjim prikazom) */
export const COURSE_ITEM_STATUS_MARK: Record<string, { text: string; mark: string }> = {
  pending: { text: 'text-zinc-500', mark: '○' },
  held: { text: 'text-amber-600', mark: '○' },
  fired: { text: 'text-orange-600', mark: '⏳' },
  preparing: { text: 'text-amber-600', mark: '⏳' },
  ready: { text: 'text-emerald-600', mark: '✓' },
  served: { text: 'text-zinc-500', mark: '✓' },
  cancelled: { text: 'text-red-600', mark: '×' },
}

// ─── Props podkomponent ──────────────────────────────────────────
export interface PacingHeaderProps {
  orderCount: number
}

export interface PacedOrderCardProps {
  order: PacedOrder
  /** Order-level: POST /api/orders/[id]/courses/fire { mode: 'next' } */
  onFireNext: (orderId: string) => void
  /** Order-level: POST /api/orders/[id]/courses/fire { mode: 'all' } */
  onFireAll: (orderId: string) => void
  /** Course-level: PUT /api/courses/[courseId] { action } */
  onCourseAction: (courseId: string, action: CourseAction) => void
  /** Busy zastavice (disabled med mutation v teku) */
  busyCourseId: string | null
  busyOrderFire: boolean
}

export interface CourseCardProps {
  course: CourseGroup
  isCurrentCourse: boolean
  onAction: (action: CourseAction) => void
  disabled: boolean
}
