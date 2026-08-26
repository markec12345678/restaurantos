// ============================================
// DELJENI TIPI IN KONSTANTE ZA PREGLED IZMEN
// ============================================

import { Clock, UserCheck, Coffee, LogOut } from 'lucide-react'

// Tip zaposlenega na izmeni
export interface ShiftEmployee {
  id: string
  name: string
  role: string
  shiftType: 'morning' | 'afternoon' | 'evening' | 'full'
  shiftStart: string
  shiftEnd: string
  status: 'scheduled' | 'clocked-in' | 'on-break' | 'clocked-out'
  clockedInAt: string | null
  breakStartedAt: string | null
  totalBreakMinutes: number
  location: string
  hoursWorked: number
  hoursRemaining: number
}

// Konfiguracija statusov
export const statusConfig = {
  'clocked-in': {
    label: 'Na delu',
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    icon: UserCheck,
    dotColor: 'bg-green-500',
  },
  'on-break': {
    label: 'Odmor',
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    icon: Coffee,
    dotColor: 'bg-amber-500',
  },
  'clocked-out': {
    label: 'Odpisan',
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    icon: LogOut,
    dotColor: 'bg-gray-400',
  },
  'scheduled': {
    label: 'Načrtovan',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    icon: Clock,
    dotColor: 'bg-blue-400',
  },
} as const

// Konfiguracija tipov izmen
export const shiftTypeConfig = {
  morning: { label: 'Jutranja', color: 'text-yellow-600' },
  afternoon: { label: 'Popoldanska', color: 'text-orange-600' },
  evening: { label: 'Večerna', color: 'text-purple-600' },
  full: { label: 'Celodnevna', color: 'text-blue-600' },
} as const

// ============================================
// VMESNIKI ZA PROPS PODKOMPONENT
// ============================================

export interface ShiftSummaryCardsProps {
  clockedInCount: number
  onBreakCount: number
  scheduledCount: number
  totalHoursToday: number
}

export interface ShiftFilterBarProps {
  filterStatus: string
  onFilterChange: (_status: string) => void
}

export interface ShiftEmployeeListProps {
  employees: ShiftEmployee[]
  onClockIn: (_employeeId: string) => void
  onClockOut: (_employeeId: string) => void
  onBreak: (_employeeId: string, _onBreak: boolean) => void
}
