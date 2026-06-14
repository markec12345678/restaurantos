// ============================================
// REZERVACIJSKI SISTEM — Skupne konstante in tipi
// ============================================

// --- TIPI ---

export interface TableType {
  id: string
  number: number
  capacity: number
  area: string
  status: string
}

export interface ReservationType {
  id: string
  customerName: string
  customerPhone: string
  customerEmail: string
  tableId: string | null
  table: { id: string; number: number; capacity: number; area: string } | null
  dateTime: string
  partySize: number
  duration: number
  status: string
  notes: string
  specialRequests: string
  source: string
  confirmedAt: string | null
  actualArrival: string | null
  actualDeparture: string | null
  reminderSent: boolean
  createdAt: string
}

// --- STATUSNE MAPE ---

export const statusLabels: Record<string, string> = {
  confirmed: 'Potrjena',
  seated: 'Sedeči',
  completed: 'Zaključena',
  cancelled: 'Preklicana',
  no_show: 'Ni prišel',
}

export const statusColors: Record<string, string> = {
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  seated: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  completed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 border-gray-200 dark:border-gray-800',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
  no_show: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
}

export const sourceLabels: Record<string, string> = {
  walk_in: 'Osebno',
  phone: 'Telefon',
  website: 'Spletna stran',
  app: 'Aplikacija',
}

export const timeSlots = [
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00',
]

// --- PROPS INTERFACI ZA POD-KOMPONENTE ---

export interface ReservationCardProps {
  reservation: ReservationType
  onEdit: () => void
  onStatusChange: (_id: string, _status: string) => void
}

export interface TimelineViewProps {
  reservations: ReservationType[]
  tables: TableType[]
  onEdit: (_r: ReservationType) => void
  onStatusChange: (_id: string, _status: string) => void
}

export interface ListViewProps {
  reservations: ReservationType[]
  onEdit: (_r: ReservationType) => void
  onStatusChange: (_id: string, _status: string) => void
}

export interface ReservationDialogProps {
  open: boolean
  onClose: () => void
  reservation: ReservationType | null
  tables: TableType[]
  selectedDate: Date
  onSave: (_data: Record<string, unknown>) => void
}
