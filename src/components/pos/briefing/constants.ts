// ============================================
// R141-c (epic #115 P2-28) — Dnevni pregled (manager briefing)
// TIPI (zrcalijo GET /api/reports/briefing kontrakt R141-b), badge mape
// (BUG-04 kanon) in čisti pomožniki. Samo izvozi — cilj enotnega testa.
// ============================================

// --- Tipi (kontrakt R141-a/R141-b; deepToNumbers'ed odgovor) ---

export interface ReservationSummary {
  confirmed: number
  seated: number
  cancelled: number
  noShow: number
  totalGuests: number
}

export interface UpcomingReservation {
  id: string
  customerName: string
  dateTime: string
  partySize: number
  status: string
  tableNumber: string | null
  notes: string | null
  specialRequests: string | null
  isVip: boolean
}

export interface ReservationSection {
  summary: ReservationSummary
  upcoming: UpcomingReservation[]
}

export interface StaffShiftEntry {
  employeeName: string
  role: string
  shiftType: string
  startTime: string
  endTime: string
  status: string
}

export interface StaffCoverage {
  scheduled: number
  confirmed: number
  byRole: Record<string, number>
}

export interface StaffSection {
  shifts: StaffShiftEntry[]
  coverage: StaffCoverage
  pendingTimeOff: number
}

export interface LowStockItem {
  id: string
  name: string
  quantity: number
  minQuantity: number
  unit: string
  status: string
}

export interface ExpiringBatch {
  lotNumber: string
  itemName: string
  expiryDate: string
  daysToExpiry: number
  quantityRemaining: number
  unit: string
}

export interface InventorySection {
  lowStock: LowStockItem[]
  lowStockCount: number
  expiring: ExpiringBatch[]
  expiredCount: number
}

export interface OpenPurchaseOrder {
  poNumber: string
  supplierName: string
  status: string
  expectedDate: string | null
  totalAmount: number
}

export interface ArrivingTodayPO {
  poNumber: string
  supplierName: string
}

export interface PurchasingSection {
  openPos: OpenPurchaseOrder[]
  openCount: number
  arrivingToday: ArrivingTodayPO[]
}

export interface YesterdaySales {
  revenue: number
  ordersCount: number
  avgTicket: number
  tips: number
  revenueChangePct: number | null
}

export interface TopItem {
  name: string
  quantity: number
  revenue: number
}

export interface WasteReasonEntry {
  reason: string
  cost: number
  count: number
}

export interface YesterdaySection {
  sales: YesterdaySales
  topItems: TopItem[]
  waste: { totalCost: number; topReasons: WasteReasonEntry[] }
  zReportStatus: string | null
  dailyCloseStatus: string | null
}

export interface UnresolvedFeedback {
  new: number
  inReview: number
  oldest: string | null
}

export interface PendingApprovals {
  dailyCloses: number
  stocktakes: number
}

export interface OperationalIssues {
  critical: number
  warning: number
}

export interface IssuesSection {
  unresolvedFeedback: UnresolvedFeedback
  pendingApprovals: PendingApprovals
  operational: OperationalIssues
}

export interface KdsSection {
  lateCount: number
  onTimeRate: number
  avgFiredToReadyMinutes: number
  activeTickets: number
}

export interface BriefingResponse {
  date: string
  generatedAt: string
  locationId: string | null
  reservations: ReservationSection
  staff: StaffSection
  inventory: InventorySection
  purchasing: PurchasingSection
  yesterday: YesterdaySection
  issues: IssuesSection
  kds: KdsSection
}

// --- Ključi lookup map (konstante za test pokritosti) ---

/** Status rezervacije (Prisma Reservation.status kanon) */
export const RESERVATION_STATUSES = ['confirmed', 'seated', 'cancelled', 'no_show'] as const
/** Odprte naročilnice (OPEN_PO_STATUSES kanon — schema comment je zastarel) */
export const PO_STATUSES = ['draft', 'submitted', 'approved', 'partial'] as const
/** Vloge na izmeni (Prisma StaffShift.role kanon) */
export const ROLES = ['server', 'chef', 'bartender', 'host', 'manager', 'prep', 'dishwasher'] as const
/** Tipi izmen (Prisma StaffShift.shiftType kanon) */
export const SHIFT_TYPES = ['morning', 'afternoon', 'evening', 'night', 'split', 'custom'] as const
/** Statusi izmen (Prisma StaffShift.status kanon) */
export const SHIFT_STATUSES = ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'] as const
/** Status Z-poročila */
export const Z_REPORT_STATUSES = ['draft', 'finalized', 'approved'] as const
/** Status dnevnega zaključka (DailyClose.status kanon) */
export const DAILY_CLOSE_STATUSES = ['PENDING_APPROVAL', 'CLOSED', 'REOPENED'] as const

// --- Badge mape (BUG-04 kanon: celoten Tailwind razred je LITERAL v mapi —
//     NIKOLI dinamičnih konkatenacij; brez modrih/indigo tonov — hišno
//     pravilo, paleta red/amber/emerald/zinc; ?? UNKNOWN fallback) ---

export interface BriefingBadgeConfig {
  label: string
  className: string
}

/** Status rezervacije — pariteta specifikaciji P2-28 */
export const RESERVATION_STATUS_BADGES: Record<string, BriefingBadgeConfig> = {
  confirmed: { label: 'Potrjena',    className: 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  seated:    { label: 'Na mizi',     className: 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  cancelled: { label: 'Odpovedana',  className: 'border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300' },
  no_show:   { label: 'Ni prišel',   className: 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300' },
}

export const RESERVATION_STATUS_UNKNOWN: BriefingBadgeConfig = {
  label: 'Neznano',
  className: 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
}

/** Resnost nizke zaloge */
export const LOW_STOCK_SEVERITY_BADGES: Record<string, BriefingBadgeConfig> = {
  critical: { label: 'Kritično', className: 'border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300' },
  low:      { label: 'Nizko',    className: 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300' },
}

export const LOW_STOCK_SEVERITY_UNKNOWN: BriefingBadgeConfig = {
  label: 'Neznano',
  className: 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
}

/** Status naročilnice */
export const PO_STATUS_BADGES: Record<string, BriefingBadgeConfig> = {
  draft:     { label: 'Osnutek',  className: 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300' },
  submitted: { label: 'Poslana',  className: 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  approved:  { label: 'Odobrena', className: 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  partial:   { label: 'Delna',    className: 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300' },
}

export const PO_STATUS_UNKNOWN: BriefingBadgeConfig = {
  label: 'Neznano',
  className: 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
}

/** Tip izmene (chip poleg časa) */
export const SHIFT_TYPE_BADGES: Record<string, BriefingBadgeConfig> = {
  morning:   { label: 'Zjutraj',   className: 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  afternoon: { label: 'Popoldan',  className: 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300' },
  evening:   { label: 'Zvečer',    className: 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  night:     { label: 'Noč',       className: 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300' },
  split:     { label: 'Razdeljena', className: 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  custom:    { label: 'Po meri',   className: 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300' },
}

export const SHIFT_TYPE_UNKNOWN: BriefingBadgeConfig = {
  label: 'Izmena',
  className: 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
}

/** Status izmene */
export const SHIFT_STATUS_BADGES: Record<string, BriefingBadgeConfig> = {
  scheduled:   { label: 'Načrtovana', className: 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300' },
  confirmed:   { label: 'Potrjena',   className: 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  in_progress: { label: 'V teku',     className: 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  completed:   { label: 'Zaključena', className: 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300' },
  cancelled:   { label: 'Odpovedana', className: 'border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300' },
  no_show:     { label: 'Ni prišel',  className: 'border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300' },
}

export const SHIFT_STATUS_UNKNOWN: BriefingBadgeConfig = {
  label: 'Neznano',
  className: 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
}

/** Status Z-poročila (null → UI prikaže '—') */
export const Z_REPORT_STATUS_BADGES: Record<string, BriefingBadgeConfig> = {
  draft:     { label: 'Osnutek',   className: 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300' },
  finalized: { label: 'Zaključeno', className: 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  approved:  { label: 'Odobreno',  className: 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
}

export const Z_REPORT_STATUS_UNKNOWN: BriefingBadgeConfig = {
  label: 'Neznano',
  className: 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
}

/** Status dnevnega zaključka (DailyClose — UPPER_SNAKE kanon) */
export const DAILY_CLOSE_STATUS_BADGES: Record<string, BriefingBadgeConfig> = {
  PENDING_APPROVAL: { label: 'Čaka odobritev', className: 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  CLOSED:           { label: 'Zaključeno',    className: 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  REOPENED:         { label: 'Ponovno odprto', className: 'border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300' },
}

export const DAILY_CLOSE_STATUS_UNKNOWN: BriefingBadgeConfig = {
  label: 'Neznano',
  className: 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
}

/**
 * Trend spremembe prihodka (up/down/neutral → literal razredi; vrednost % je
 * dinamičen NASLOV, ne barva — BUG-04: barvni razred je iz lookup mape).
 */
export type PctTrend = 'up' | 'down' | 'neutral'

export const PCT_TREND_BADGES: Record<PctTrend, string> = {
  up:      'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  down:    'border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300',
  neutral: 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
}

// --- Oznake (hardcoded sl — kanon modulov; samo nav.* je i18n) ---

/** Slovenska imena vlog (Prisma StaffShift.role) — neznana → raw vrednost */
export const ROLE_LABELS: Record<string, string> = {
  server: 'Natakar',
  chef: 'Kuhar',
  bartender: 'Barman',
  host: 'Hostesa',
  manager: 'Vodja',
  prep: 'Priprava',
  dishwasher: 'Pomivalnik',
}

/** Varno vrne oznako vloge (neznana → surova vrednost, ne crash) */
export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role
}

// --- Čisti pomožniki (cilj enotnega testa) ---

export interface CoverSummary {
  /** Pričakovani gostje — server že sešteje partySize (confirmed+seated) */
  expectedGuests: number
  /** Rezervacije danes — števec potrjenih */
  reservationsToday: number
  seated: number
  cancelled: number
  noShow: number
}

/**
 * Povzetek rezervacij za KPI vrstico. Defenzivno: manjkajoča/nepopolna
 * poročila (null/undefined polja) → 0, nikoli ne crasha.
 */
export function summarizeCovers(summary?: Partial<ReservationSummary> | null): CoverSummary {
  const s = summary ?? {}
  const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0)
  return {
    expectedGuests: num(s.totalGuests),
    reservationsToday: num(s.confirmed),
    seated: num(s.seated),
    cancelled: num(s.cancelled),
    noShow: num(s.noShow),
  }
}

/**
 * Sprememba prihodka v % → prikazni niz + trend (badge lookup ključ).
 * null/undefined/NaN → neutral '—'; 0 → neutral '—' (brez šuma).
 * Pozitivno → '+N %' (up), negativno → '−N %' (down, tipografski minus).
 */
export function formatPctChange(pct: number | null | undefined): { label: string; trend: PctTrend } {
  if (pct == null || !Number.isFinite(pct) || pct === 0) return { label: '—', trend: 'neutral' }
  const rounded = Math.round(Math.abs(pct) * 10) / 10
  const formatted = rounded.toFixed(1).replace(/\.0$/, '').replace('.', ',')
  return pct > 0
    ? { label: `+${formatted} %`, trend: 'up' }
    : { label: `−${formatted} %`, trend: 'down' }
}

/** Resnost preteka roka uporabnosti: ≤1 dan rdeča, ≤3 amber, drugače nevtralno */
export function daysToExpirySeverity(days: number | null | undefined): 'critical' | 'low' | 'neutral' {
  if (days == null || !Number.isFinite(days)) return 'neutral'
  if (days <= 1) return 'critical'
  if (days <= 3) return 'low'
  return 'neutral'
}

/**
 * Besedilo preteka roka: 'poteče danes' (0), 'poteče jutro' (1),
 * drugače 'poteče čez N dni'. Negativno (že pretečeno) → 'poteče danes'
 * (honesto — batch je še na seznamu expiring).
 */
export function formatDaysToExpiry(days: number | null | undefined): string {
  if (days == null || !Number.isFinite(days) || days <= 0) return 'poteče danes'
  if (days === 1) return 'poteče jutro'
  return `poteče čez ${days} dni`
}

const SL_DAY_NAMES = ['Nedelja', 'Ponedeljek', 'Torek', 'Sreda', 'Četrtek', 'Petek', 'Sobota'] as const

/**
 * 'YYYY-MM-DD' → 'Sobota, 26. 9. 2026' (ročno, brez ICU odvisnosti —
 * deterministično med dev/CI/Docker). Neveljaven vhod → surovi niz.
 */
export function formatBriefingDateLabel(dateStr: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim())
  if (!m) return dateStr
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const utc = new Date(Date.UTC(y, mo - 1, d))
  if (Number.isNaN(utc.getTime()) || utc.getUTCDate() !== d || utc.getUTCMonth() !== mo - 1) return dateStr
  const dayName = SL_DAY_NAMES[utc.getUTCDay()]
  return `${dayName}, ${d}. ${mo}. ${y}`
}

/** Barva besedila preteka roka (literal razredi — BUG-04, ključ = daysToExpirySeverity) */
export const EXPIRY_SEVERITY_TEXT: Record<'critical' | 'low' | 'neutral', string> = {
  critical: 'text-red-600 dark:text-red-400',
  low: 'text-amber-600 dark:text-amber-400',
  neutral: 'text-muted-foreground',
}

/**
 * 'YYYY-MM-DD' ali ISO → '26. 9. 2026' (kratek sl zapis, brez dneva v tednu).
 * null/neveljaven → '—' (POTRJENO '—' za odsotne podatke v briefing UI).
 */
export function formatSlDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.trim())
  if (!m) return '—'
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const utc = new Date(Date.UTC(y, mo - 1, d))
  if (Number.isNaN(utc.getTime()) || utc.getUTCDate() !== d || utc.getUTCMonth() !== mo - 1) return '—'
  return `${d}. ${mo}. ${y}`
}
