// ============================================
// TIPI, KONSTANTE IN POMOŽNE FUNKCIJE
// za podkomponente povratnih informacij gostov
// ============================================

import type { ReactNode } from 'react'

// --- Tipi ---

/** P1-14 (R140-b API): status mnenja — new | in_review | resolved (DB default 'new') */
export type FeedbackStatus = 'new' | 'in_review' | 'resolved'

/** Podatki o posamezni povratni informaciji */
export interface FeedbackEntry {
  id: string
  guestId?: string
  guestName: string
  orderId?: string
  orderNumber?: number
  overallRating: number // 1-5
  foodRating: number
  serviceRating: number
  atmosphereRating: number
  comment: string
  wouldReturn: boolean
  wouldRecommend: boolean
  tags: string[]
  createdAt: string
  responded: boolean
  response?: string
  // P1-14 (R140-b GET whitelist): resolution workflow + kontekst mize/naročila/vira.
  // tableNumber/orderRef so SNAPSHOT-i (String), ne live relacije. Polja so
  // opcijska (defenzivno do starih cache-anih odgovorov) — 'new' je fallback.
  status?: FeedbackStatus
  source?: string
  tableNumber?: string | null
  orderRef?: string | null
  resolvedByName?: string | null
  resolvedAt?: string | null
}

/** Oblika za nov feedback */
export interface NewFeedbackForm {
  guestName: string
  overallRating: number
  foodRating: number
  serviceRating: number
  atmosphereRating: number
  comment: string
  wouldReturn: boolean
  wouldRecommend: boolean
  tags: string[]
}

/** Povprecne ocene po kategorijah */
export interface AvgRatings {
  overall: number
  food: number
  service: number
  atmosphere: number
}

/** Podatek za stolpicni graf distribucije ocen */
export interface RatingDistributionItem {
  rating: number
  count: number
}

// --- Konstante ---

/** Povratne oznake za feedback */
export const FEEDBACK_TAGS = [
  'Odlična hrana', 'Hitra postrežba', 'Prijetna atmosfera',
  'Prijazno osebje', 'Čisto', 'Dobra vinska karta',
  'Predolgo čakanje', 'Hladna hrana', 'Glasno',
  'Drago', 'Majhne porcije', 'Nečisto',
] as const

/** Barve za stolpicni graf */
export const PIE_COLORS = ['#ef4444', '#f59e0b', '#eab308', '#84cc16', '#10b981']

/** Možnosti za filter ocen */
export const FILTER_OPTIONS = ['all', '5', '4', '3', '2', '1'] as const

// --- P1-14 (R140-c): resolution workflow ---

/** Možnosti za status filter (klient-side — GET nima ?status, r140-b) */
export const STATUS_FILTER_OPTIONS = ['all', 'new', 'in_review', 'resolved'] as const
export type FeedbackStatusFilter = (typeof STATUS_FILTER_OPTIONS)[number]

/** Oznake statusnih gumbov v filtru (hardcoded sl — pariteta ostalih nizov v mapi) */
export const FEEDBACK_STATUS_FILTER_LABELS: Record<FeedbackStatusFilter, string> = {
  all: 'Vsi',
  new: 'Novo',
  in_review: 'V obdelavi',
  resolved: 'Rešeno',
}

export interface FeedbackStatusBadgeConfig {
  label: string
  className: string
}

/**
 * Status badge lookup (R140-c). BUG-04 kanon: celoten Tailwind razred je
 * LITERAL v tej mapi — NIKOLI dinamičnih konkatenacij (bg-${x} ne deluje v
 * produkciji; StatusBadge driver/display vzorec). Barvna pariteta z obstoječimi
 * badge-i kartice (100/700 pare brez dark variant — pariteta
 * wouldReturn=emerald / wouldRecommend=blue): new=nevtralna siva,
 * in_review=rumena (KDS in-progress kanon), resolved=zelena (uspeh).
 */
export const FEEDBACK_STATUS_BADGES: Record<string, FeedbackStatusBadgeConfig> = {
  new:       { label: 'Novo',       className: 'bg-gray-100 text-gray-700' },
  in_review: { label: 'V obdelavi', className: 'bg-amber-100 text-amber-700' },
  resolved:  { label: 'Rešeno',     className: 'bg-emerald-100 text-emerald-700' },
}

/** Neznani status — nevtralna siva (defenzivno; brez uhajanja notranjih vrednosti) */
export const FEEDBACK_STATUS_UNKNOWN: FeedbackStatusBadgeConfig = {
  label: 'Novo',
  className: 'bg-gray-100 text-gray-700',
}

/** Prikazna imena virov (GET whitelist: qr_kiosk | web | receipt | pos) */
export const FEEDBACK_SOURCE_LABELS: Record<string, string> = {
  qr_kiosk: 'QR kiosk',
  web: 'Splet',
  receipt: 'Račun',
  pos: 'POS',
}

/**
 * P1-14 (R140-c): tags so v DB JSON String (@default "[]") — GET vrača surovi
 * string. Normaliziraj varno v tabelo (prej bi fb.tags.map v FeedbackCard-u
 * crashal ob string vrednosti). Defenzivno: neveljaven JSON / napačen tip → [].
 */
export function parseFeedbackTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((t): t is string => typeof t === 'string')
  if (typeof raw !== 'string' || raw.trim() === '') return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter((t): t is string => typeof t === 'string')
  } catch {
    // nadaljuj na [] spodaj
  }
  return []
}

/** Polja za ocenjevanje v novem mnenju */
export const RATING_FIELDS = [
  { key: 'overallRating', label: 'Skupna ocena' },
  { key: 'foodRating', label: 'Hrana' },
  { key: 'serviceRating', label: 'Postrežba' },
  { key: 'atmosphereRating', label: 'Atmosfera' },
] as const

// --- Pomožne funkcije ---

/** Ustvari prazno formo za nov feedback */
export function emptyFeedbackForm(): NewFeedbackForm {
  return {
    guestName: '',
    overallRating: 0,
    foodRating: 0,
    serviceRating: 0,
    atmosphereRating: 0,
    comment: '',
    wouldReturn: true,
    wouldRecommend: true,
    tags: [],
  }
}

// --- Props vmesniki za podkomponente ---

export interface FeedbackStatsCardsProps {
  avgRatings: AvgRatings
  nps: number
}

export interface FeedbackRatingChartProps {
  ratingDistribution: RatingDistributionItem[]
}

export interface FeedbackFilterBarProps {
  filterRating: string
  onFilterChange: (_value: string) => void
  // P1-14 (R140-c): status filter — opcijsko (nazaj-kompatibilno)
  filterStatus?: FeedbackStatusFilter
  onStatusFilterChange?: (_value: FeedbackStatusFilter) => void
}

export interface FeedbackListProps {
  feedbacks: FeedbackEntry[]
  // P1-14 (R140-c): akcije reševanja — passthrough na kartice
  onStartReview?: (_id: string) => void
  onResolve?: (_fb: FeedbackEntry) => void
  busyId?: string | null
}

export interface FeedbackCardProps {
  fb: FeedbackEntry
  // P1-14 (R140-c): akcije (PATCH /api/guests/feedback/[id] prek useFeedbackData)
  onStartReview?: (_id: string) => void
  onResolve?: (_fb: FeedbackEntry) => void
  isBusy?: boolean
}

/** Dialog 'Odgovori in reši' (P1-14, R140-c) — stil NewFeedbackDialog kanon */
export interface ResolveFeedbackDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  feedback: FeedbackEntry | null
  responseText: string
  onResponseTextChange: (_text: string) => void
  onSubmit: () => void
  isSubmitting: boolean
}

export interface NewFeedbackDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  newFeedback: NewFeedbackForm
  onNewFeedbackChange: (_form: NewFeedbackForm) => void
  onSubmit: () => void
  isSubmitting: boolean
}

export interface FeedbackEmptyStateProps {
  onAddClick: () => void
}

export interface FeedbackLoadingSkeletonProps {
  children?: ReactNode
}
