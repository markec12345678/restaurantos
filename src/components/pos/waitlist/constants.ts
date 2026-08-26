// ============================================
// DELJENI TIPI IN KONSTANTE ZA WAITLIST MANAGER
// ============================================

export interface WaitlistEntry {
  id: string
  guestName: string
  guestPhone: string
  partySize: number
  quotedWaitMinutes: number
  actualWaitMinutes: number
  preferredArea: string
  specialNeeds: string
  status: string
  checkedInAt: string
  notifiedAt: string | null
  seatedAt: string | null
  leftAt: string | null
  tableId: string | null
  notes: string
}

// Možnosti preferiranega območja
export const AREA_OPTIONS = [
  { value: '', label: 'Brez preference' },
  { value: 'ob oknu', label: 'Ob oknu' },
  { value: 'terasa', label: 'Terasa' },
  { value: 'tiho', label: 'Tiho mesto' },
  { value: 'bar', label: 'Bar' },
  { value: 'kot', label: 'Kot' },
]

// Pomožna funkcija za barvo čakalnega časa
export function getWaitTimeColor(waitMinutes: number, quotedMinutes: number): string {
  if (quotedMinutes === 0) return 'text-gray-500'
  const ratio = waitMinutes / quotedMinutes
  if (ratio < 0.8) return 'text-green-600'
  if (ratio < 1.0) return 'text-amber-600'
  return 'text-red-600'
}

// ============================================
// VMESNIKI ZA PROPS PODKOMPONENT
// ============================================

export interface WaitlistHeaderProps {
  waitingCount: number
  notifiedCount: number
  onOpenForm: () => void
}

export interface WaitlistStatsBarProps {
  waitingCount: number
  notifiedCount: number
  totalGuests: number
}

export interface WaitlistEntryCardProps {
  entry: WaitlistEntry
  index: number
  waitTime: number
  isOverQuoted: boolean
  isNotified: boolean
  onNotify: () => void
  onSeat: () => void
  onLeave: () => void
}

export type WaitlistEmptyStateProps = Record<string, never>

export interface WaitlistFormDialogProps {
  open: boolean
  form: Record<string, unknown>
  onOpenChange: (_open: boolean) => void
  onUpdateForm: (_field: string, _value: string | number) => void
  onAddEntry: () => void
  onCancel: () => void
}
