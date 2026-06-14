// ============================================
// TIPI IN KONSTANTE ZA WEBHOOK MANAGER
// ============================================

/** Podatkovni tip za spletno kljuko */
export interface WebhookItem {
  id: string
  name: string
  url: string
  events: string
  isActive: boolean
  secret: string
  lastTriggered: string | null
  failureCount: number
  createdAt: string
  updatedAt: string
}

/** Podatkovni tip za obrazec */
export interface FormData {
  name: string
  url: string
  events: string[]
  secret: string
  isActive: boolean
}

/** Dogodek s konfiguracijo */
export interface EventOption {
  value: string
  label: string
  color: string
}

// ============================================
// KONSTANTE
// ============================================

/** Seznam vseh možnih dogodkov za spletne kljuke */
export const eventOptions: EventOption[] = [
  // Naročila
  { value: 'order.created', label: 'Naročilo ustvarjeno', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'order.updated', label: 'Naročilo posodobljeno', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'order.paid', label: 'Naročilo plačano', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  { value: 'order.ready', label: 'Naročilo pripravljeno', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  { value: 'order.cancelled', label: 'Naročilo preklicano', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  { value: 'order.delivered', label: 'Naročilo dostavljeno', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  // Plačila
  { value: 'payment.received', label: 'Plačilo prejeto', color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400' },
  { value: 'payment.refunded', label: 'Plačilo vračano', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  // Računi
  { value: 'receipt.created', label: 'Račun ustvarjen', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400' },
  { value: 'receipt.fiscal_verified', label: 'Račun davčno potrjen', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400' },
  // Zaloga
  { value: 'stock.low', label: 'Zaloga nizka', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  { value: 'stock.critical', label: 'Zaloga kritična', color: 'bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-300' },
  { value: 'stock.restocked', label: 'Zaloga dopolnjena', color: 'bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-400' },
  // Izrene
  { value: 'shift.started', label: 'Izmena začeta', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  { value: 'shift.ended', label: 'Izmena končana', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  // Blagajna
  { value: 'cash_register.opened', label: 'Blagajna odprta', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400' },
  { value: 'cash_register.closed', label: 'Blagajna zaprta', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400' },
  // Rezervacije
  { value: 'reservation.created', label: 'Rezervacija ustvarjena', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400' },
  { value: 'reservation.cancelled', label: 'Rezervacija preklicana', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400' },
  // Gosti
  { value: 'guest.created', label: 'Gost ustvarjen', color: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400' },
  { value: 'loyalty.tier_upgraded', label: 'Zvestobni nivo nadgrajen', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  // Poročila
  { value: 'daily_report.ready', label: 'Dnevno poročilo pripravljeno', color: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400' },
  { value: 'integration.sync_failed', label: 'Sinhronizacija neuspešna', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
]

// ============================================
// POMOŽNE FUNKCIJE
// ============================================

/** Pridobi konfiguracijo za dogodek po vrednosti */
export function getEventConfig(value: string): EventOption {
  return eventOptions.find(e => e.value === value) || { value, label: value, color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' }
}

/** Oblikuj datum v slovenskem formatu */
export function formatDateSI(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Nikoli'
  const d = new Date(dateStr)
  return d.toLocaleDateString('sl-SI', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/** Razčleni JSON niz dogodkov */
export function parseEvents(eventsJson: string): string[] {
  try {
    return JSON.parse(eventsJson || '[]')
  } catch {
    return []
  }
}

// ============================================
// PROPS INTERFACES ZA POD-KOMPONENTE
// ============================================

export interface StatsCardsProps {
  totalCount: number
  activeCount: number
  totalEvents: number
  failedCount: number
}

export interface WebhookTableProps {
  filteredWebhooks: WebhookItem[]
  search: string
  showInactive: boolean
  onSearchChange: (_value: string) => void
  onShowInactiveChange: (_value: boolean) => void
  onTest: (_item: WebhookItem) => void
  onEdit: (_item: WebhookItem) => void
  onDelete: (_item: WebhookItem) => void
  onAdd: () => void
}

export interface WebhookDialogProps {
  open: boolean
  editingItem: WebhookItem | null
  formData: FormData
  onOpenChange: (_open: boolean) => void
  onFormDataChange: (_data: FormData) => void
  onSubmit: () => void
  onToggleEvent: (_eventValue: string) => void
  isPending: boolean
}

export interface DeleteDialogProps {
  open: boolean
  deleteTarget: WebhookItem | null
  onOpenChange: (_open: boolean) => void
  onConfirm: () => void
}
