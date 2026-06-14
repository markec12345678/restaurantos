// ============================================
// TIPI IN KONSTANTE ZA TABLE RESERVATION SYNC
// ============================================

interface TableInfo {
  id: string
  number: number
  capacity: number
  status: 'available' | 'occupied' | 'reserved' | 'blocked'
  currentOrderId: string | null
  guests: number
  server: string | null
  seatedAt: string | null
  reservation: ReservationInfo | null
}

interface ReservationInfo {
  id: string
  guestName: string
  guestPhone: string | null
  partySize: number
  date: string
  time: string
  status: 'confirmed' | 'pending' | 'seated' | 'completed' | 'cancelled'
  notes: string | null
  duration: number // minutes
}

interface TimeSlot {
  time: string
  available: number
  total: number
  reservations: number
}

export type { TableInfo, ReservationInfo, TimeSlot }

export const STATUS_CONFIG = {
  available: { label: 'Prosto', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', dot: 'bg-green-500', srLabel: 'Prosta miza' },
  occupied: { label: 'Zasedeno', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', dot: 'bg-red-500', srLabel: 'Zasedena miza' },
  reserved: { label: 'Rezervirano', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', dot: 'bg-blue-500', srLabel: 'Rezervirana miza' },
  blocked: { label: 'Blokirano', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300', dot: 'bg-gray-400', srLabel: 'Blokirana miza' },
}

export const RESERVATION_STATUS_CONFIG = {
  confirmed: { label: 'Potrjena', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  pending: { label: 'Na čakanju', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  seated: { label: 'Sedijo', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  completed: { label: 'Zaključena', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
  cancelled: { label: 'Preklicana', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
}

/** Props za SyncHeader */
export interface SyncHeaderProps {
  selectedDate: string
  onDateChange: (_date: string) => void
  onRefresh: () => void
}

/** Props za SummaryCards */
export interface SummaryCardsProps {
  availableCount: number
  occupiedCount: number
  reservedCount: number
  pendingCount: number
}

/** Props za TablesList */
export interface TablesListProps {
  tables: TableInfo[]
  onSeatReservation: (_reservationId: string, _tableId: string) => void
}

/** Props za ReservationsList */
export interface ReservationsListProps {
  reservations: ReservationInfo[]
  availableTables: TableInfo[]
  onSeatReservation: (_reservationId: string, _tableId: string) => void
  onCancelReservation: (_id: string, _name: string) => void
}

/** Props za TimeSlotChart */
export interface TimeSlotChartProps {
  timeSlots: TimeSlot[]
}

/** Props za CancelReservationDialog */
export interface CancelReservationDialogProps {
  cancelTarget: { id: string; name: string } | null
  onOpenChange: (_open: boolean) => void
  onConfirm: () => void
}
