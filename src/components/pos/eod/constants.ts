// ═══════════════════════════════════════════════════════════════
// RestaurantOS — EOD skupne tipi, konstante in pomožne funkcije
// ═══════════════════════════════════════════════════════════════

import { safeNum, formatEUR } from '@/lib/safe-format'

export interface EODData {
  date: string
  eodCompleted: boolean
  orders: { total: number; completed: number; cancelled: number; revenue: number; avgOrderValue: number }
  payments: { byMethod: Record<string, { count: number; total: number; tips: number }>; totalTips: number; totalPayments: number }
  vat: Record<string, { base: number; vat: number }>
  furs: { verified: number; queued: number; failed: number; allVerified: boolean }
  shift: { id: string; startingCash: number; cashSales: number; cardSales: number; totalSales: number; cashDiff: number; isClosed: boolean } | null
  reservations: { total: number; confirmed: number; noShow: number }
  guests: { newToday: number }
  expenses: { total: number; count: number }
  netProfit: number
  topItems: Array<{ name: string; quantity: number; revenue: number }>
}

export interface EodChecklistProps {
  eodChecks: Array<{ label: string; done: boolean }>
  completedChecks: number
  allChecksDone: boolean
  onToggleCash: () => void
  onToggleChecklist: () => void
}

export interface EodKpiCardsProps {
  data: EODData
}

export interface EodSectionsProps {
  data: EODData
  expandedSections: Set<string>
  onToggleSection: (_section: string) => void
}

export interface CloseDayDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  actualCash: string
  onActualCashChange: (_value: string) => void
  eodNotes: string
  onEodNotesChange: (_value: string) => void
  expectedCash: number
  startingCash: number
  cashSales: number
  isPending: boolean
  onConfirm: () => void
}

// --- R126-b: Dnevni zaključek (daily close, P0-02) ---

/** Status dnevnega zaključka (kontrakt R126-a: GET/POST /api/daily-close) */
export type DailyCloseStatus = 'PENDING_APPROVAL' | 'CLOSED' | 'REOPENED'

/**
 * Vrstica dnevnega zaključka (GET /api/daily-close → { closes, total }).
 * Decimal polja lahko prispeta kot number ali string — branje prek safeNum.
 * R126-a serializira zavrnitev kot `rejectedNote` (shema `rejectNote`) in
 * odobritev `approvalNote`/`approvedNote` — podpiram obe imeni (defenzivno,
 * vzporedno delo R126-a).
 */
export interface DailyCloseRow {
  id: string
  businessDate: string
  status: DailyCloseStatus
  expectedCash: number
  countedCash: number
  cashVariance: number
  varianceThreshold: number
  notes?: string | null
  rejectedNote?: string | null
  rejectNote?: string | null
  approvalNote?: string | null
  approvedNote?: string | null
  reopenReason?: string | null
  reopenCount?: number
  closedByName?: string | null
  approvedByName?: string | null
  reopenedByName?: string | null
  closedAt?: string | null
  approvedAt?: string | null
  reopenedAt?: string | null
  createdAt?: string
}

/** GET /api/daily-close (z ?date= ali brez — zgodovina) */
export interface DailyCloseData {
  closes: DailyCloseRow[]
  total: number
}

/** POST /api/daily-close → odgovor (kontrakt R126-a) */
export interface DailyClosePostResult {
  close: DailyCloseRow
  variance: number
  threshold: number
  requiresApproval: boolean
  zReportFinalized: boolean
}

/** Vnos za zaključek dneva (POST /api/daily-close) — idempotencyKey generira client (crypto.randomUUID) */
export interface DailyCloseDayInput {
  date: string
  countedCash: number
  notes?: string
  idempotencyKey: string
}

/** Vnos za akcije nad obstoječim zaključkom ([id]/approve | /reject | /reopen) */
export interface DailyCloseActionInput {
  id: string
  rejectedNote?: string
  reopenReason?: string
}

/** "+123,45 €" — razlika z eksplicitnim znakom za pozitivne vrednosti (negativne reši formatEUR) */
export function formatSignedEUR(val: unknown): string {
  const n = safeNum(val)
  return `${n > 0 ? '+' : ''}${formatEUR(n)}`
}

/** Ali je denarna razlika znotraj praga lokacije (barvna logika razlike) */
export function isVarianceWithinThreshold(variance: number, threshold: number): boolean {
  return Math.abs(safeNum(variance)) <= safeNum(threshold)
}

export interface DailyClosePanelProps {
  /** Poslovni datum EOD strani ('YYYY-MM-DD', ljubljanski dan — data.date) */
  date: string
  /**
   * Pričakovana gotovina dneva — zgolj orientacija PRED oddajo (EOD GET:
   * shift nima expectedCash → startingCash + cashSales). Točen izid
   * (variance/threshold/requiresApproval) pokaže dialog iz POST odgovora.
   */
  expectedCash: number
}
