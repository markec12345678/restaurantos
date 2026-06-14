// ============================================
// TIPI, KONSTANTE IN POMOŽNE FUNKCIJE
// za podkomponente povratnih informacij gostov
// ============================================

import type { ReactNode } from 'react'

// --- Tipi ---

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
}

export interface FeedbackListProps {
  feedbacks: FeedbackEntry[]
}

export interface FeedbackCardProps {
  fb: FeedbackEntry
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
