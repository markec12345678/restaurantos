// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Skupne konstante in tipi za Razpored zaposlenih
// ═══════════════════════════════════════════════════════════════

// ─── Tipi ──────────────────────────────────────────────────────
export interface EmployeeType {
  id: string
  name: string
  role: string
  pin: string
  isActive: boolean
}

export interface ShiftType {
  id: string
  employeeId: string
  employee: { id: string; name: string; role: string }
  jobId: string | null
  job: { id: string; name: string; color: string } | null
  date: string
  startTime: string
  endTime: string
  status: string
  breakMinutes: number
  notes: string
}

export interface JobType {
  id: string
  name: string
  color: string
}

// ─── Konstante ─────────────────────────────────────────────────
export const DAY_NAMES = ['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned']

export const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)

export const SHIFT_COLORS = [
  'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800',
  'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800',
  'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800',
  'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400 border-teal-200 dark:border-teal-800',
]

export const statusLabels: Record<string, string> = {
  scheduled: 'Načrtovana',
  in_progress: 'V teku',
  completed: 'Zaključena',
  absent: 'Odsoten',
}

export const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  in_progress: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  completed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  absent: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

// ─── Pomožne funkcije ──────────────────────────────────────────

/** Izračunaj ure iz start/end časa in odmora */
export function calcHours(start: string, end: string, breakMin: number): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let diff = (eh * 60 + em) - (sh * 60 + sm)
  if (diff < 0) diff += 24 * 60 // če ponoči
  return Math.max(0, (diff - breakMin) / 60)
}

/** Vrni barvo izmene glede na indeks */
export function getShiftColor(idx: number): string {
  return SHIFT_COLORS[idx % SHIFT_COLORS.length]
}

// ─── Skupni tipi za podkomponente ─────────────────────────────

/** Statistika izmen za teden */
export interface SchedulerStats {
  totalHours: number
  scheduledCount: number
  completedCount: number
  inProgressCount: number
  absentCount: number
  uniqueEmployees: number
}
