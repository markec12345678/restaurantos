// ============================================
// TIPI IN KONSTANTE ZA IZMENE IN URE
// ============================================

export interface Employee {
  id: string
  name: string
  pin: string
  role: string
  status: string
}

export interface Job {
  id: string
  name: string
  basePayRate: number
}

export interface ShiftItem {
  id: string
  employeeId: string
  employee: { id: string; name: string }
  jobId: string | null
  job: { id: string; name: string } | null
  date: string
  startTime: string
  endTime: string
  status: string
  breakMinutes: number
  notes: string
  createdAt: string
}

export interface TimeEntryItem {
  id: string
  employeeId: string
  employee: { id: string; name: string }
  jobId: string | null
  job: { id: string; name: string } | null
  clockIn: string
  clockOut: string | null
  breakStart: string | null
  breakEnd: string | null
  breakMinutes: number
  totalMinutes: number
  payRate: number
  totalPay: number
  type: string
  status: string
  notes: string
  createdAt: string
}

export interface ShiftFormState {
  employeeId: string
  jobId: string
  date: string
  startTime: string
  endTime: string
  breakMinutes: string
  notes: string
}

// ============================================
// KONSTANTE
// ============================================

export const shiftStatusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  scheduled: { label: 'Načrtovana', color: 'text-blue-700 dark:text-blue-400', bgColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  in_progress: { label: 'V teku', color: 'text-amber-700 dark:text-amber-400', bgColor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  completed: { label: 'Zaključena', color: 'text-emerald-700 dark:text-emerald-400', bgColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  absent: { label: 'Odsotna', color: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
}

export const entryTypeConfig: Record<string, { label: string; bgColor: string }> = {
  regular: { label: 'Redne', bgColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  overtime: { label: 'Nadure', bgColor: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  holiday: { label: 'Praznične', bgColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  sick: { label: 'Bolniška', bgColor: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  vacation: { label: 'Dopust', bgColor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
}

// ============================================
// POMOŽNE FUNKCIJE
// ============================================

export function formatDateSI(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatDateTimeSI(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function minutesToHours(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

// ============================================
// PROPS INTERFACES ZA PODKOMPONENTE
// ============================================

export interface ShiftsTabProps {
  shifts: ShiftItem[]
  shiftsLoading: boolean
  openCreateShift: () => void
  openEditShift: (_shift: ShiftItem) => void
  startShift: (_shift: ShiftItem) => void
  completeShift: (_shift: ShiftItem) => void
  markAbsent: (_shift: ShiftItem) => void
  onDeleteShift: (_shift: ShiftItem) => void
}

export interface TimeTabProps {
  employeesList: Employee[]
  jobs: Job[] | undefined
  clockInEmployeeId: string
  clockInJobId: string
  setClockInEmployeeId: (_id: string) => void
  setClockInJobId: (_id: string) => void
  handleClockIn: () => void
  handleClockOut: (_entryId: string) => void
  activeEntries: TimeEntryItem[]
  completedEntries: TimeEntryItem[]
  entriesLoading: boolean
  clockInPending: boolean
}

export interface ShiftDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  editingShift: ShiftItem | null
  shiftForm: ShiftFormState
  onShiftFormChange: (_form: ShiftFormState) => void
  employeesList: Employee[]
  jobs: Job[] | undefined
  onSubmit: () => void
  createPending: boolean
  updatePending: boolean
}

export interface DeleteShiftDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  onConfirm: () => void
  isPending: boolean
}
