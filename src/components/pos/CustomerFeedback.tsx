'use client'
// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Customer Feedback System
// Zbiranje povratnih informacij po obisku, ocene, komentarji
// Toast POS + OpenTable standard za feedback gostov
// ═══════════════════════════════════════════════════════════════
import dynamic from 'next/dynamic'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { MessageSquare, Send } from 'lucide-react'
import { useState, useMemo, memo } from 'react'
import { toast } from 'sonner'
import {
  emptyFeedbackForm,
} from './customer-feedback/constants'
import type {
  FeedbackEntry,
  NewFeedbackForm,
  AvgRatings,
  RatingDistributionItem,
} from './customer-feedback/constants'

// ─── Lazy-loaded podkomponente ────────────────────────────────
const FeedbackStatsCards = dynamic(
  () => import('./customer-feedback/FeedbackStatsCards').then(m => m.FeedbackStatsCards),
  { ssr: false },
)
const FeedbackRatingChart = dynamic(
  () => import('./customer-feedback/FeedbackRatingChart').then(m => m.FeedbackRatingChart),
  { ssr: false },
)
const FeedbackFilterBar = dynamic(
  () => import('./customer-feedback/FeedbackFilterBar').then(m => m.FeedbackFilterBar),
  { ssr: false },
)
const FeedbackList = dynamic(
  () => import('./customer-feedback/FeedbackList').then(m => m.FeedbackList),
  { ssr: false },
)
const FeedbackEmptyState = dynamic(
  () => import('./customer-feedback/FeedbackEmptyState').then(m => m.FeedbackEmptyState),
  { ssr: false },
)
const FeedbackLoadingSkeleton = dynamic(
  () => import('./customer-feedback/FeedbackLoadingSkeleton').then(m => m.FeedbackLoadingSkeleton),
  { ssr: false },
)
const NewFeedbackDialog = dynamic(
  () => import('./customer-feedback/NewFeedbackDialog').then(m => m.NewFeedbackDialog),
  { ssr: false },
)

// ─── Glavna komponenta ──────────────────────────────────────────
export const CustomerFeedback = memo(function CustomerFeedback() {
  const queryClient = useQueryClient()
  const [_tab, _setTab] = useState<'overview' | 'list' | 'new'>('overview')
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [filterRating, setFilterRating] = useState('all')
  const [_selectedFeedback, _setSelectedFeedback] = useState<FeedbackEntry | null>(null)
  // Nov feedback form
  const [newFeedback, setNewFeedback] = useState<NewFeedbackForm>(emptyFeedbackForm())

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.feedback.all,
    queryFn: async () => {
      const res = await authFetch('/api/guests/feedback')
      if (!res.ok) {
        // Ce endpoint se ne obstaja, vrnemo prazne podatke
        return { feedbacks: [], stats: { avgRating: 0, total: 0, nps: 0 } }
      }
      return res.json()
    },
  })

  const feedbacks: FeedbackEntry[] = data?.feedbacks || []
  const _stats = data?.stats || { avgRating: 0, total: 0, nps: 0 }

  // Filtrirani feedbacki
  const filteredFeedbacks = useMemo(() => {
    if (filterRating === 'all') return feedbacks
    const rating = parseInt(filterRating)
    return feedbacks.filter((f: FeedbackEntry) => f.overallRating === rating)
  }, [feedbacks, filterRating])

  // Povprecne ocene
  const avgRatings: AvgRatings = useMemo(() => {
    if (feedbacks.length === 0) return { overall: 0, food: 0, service: 0, atmosphere: 0 }
    return {
      overall: feedbacks.reduce((s: number, f: FeedbackEntry) => s + f.overallRating, 0) / feedbacks.length,
      food: feedbacks.reduce((s: number, f: FeedbackEntry) => s + f.foodRating, 0) / feedbacks.length,
      service: feedbacks.reduce((s: number, f: FeedbackEntry) => s + f.serviceRating, 0) / feedbacks.length,
      atmosphere: feedbacks.reduce((s: number, f: FeedbackEntry) => s + f.atmosphereRating, 0) / feedbacks.length,
    }
  }, [feedbacks])

  // Distribucija ocen za graf
  const ratingDistribution: RatingDistributionItem[] = useMemo(() => {
    return [1, 2, 3, 4, 5].map(rating => ({
      rating,
      count: feedbacks.filter((f: FeedbackEntry) => f.overallRating === rating).length,
    }))
  }, [feedbacks])

  // NPS izracun
  const nps = useMemo(() => {
    if (feedbacks.length === 0) return 0
    const promoters = feedbacks.filter((f: FeedbackEntry) => f.overallRating >= 4).length
    const detractors = feedbacks.filter((f: FeedbackEntry) => f.overallRating <= 2).length
    return Math.round(((promoters - detractors) / feedbacks.length) * 100)
  }, [feedbacks])

  // Shrani nov feedback
  const createFeedbackMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch('/api/guests/feedback', {
        method: 'POST',
        body: JSON.stringify(newFeedback),
      })
      if (!res.ok) throw new Error('Failed to create feedback')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Povratna informacija shranjena!')
      setShowNewDialog(false)
      setNewFeedback(emptyFeedbackForm())
      queryClient.invalidateQueries({ queryKey: queryKeys.feedback.all })
    },
    onError: () => {
      toast.error('Napaka pri shranjevanju povratne informacije')
    },
  })

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card flex-shrink-0">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Mnenja gostov</h1>
          <Badge variant="outline" className="text-xs">{feedbacks.length} mnenj</Badge>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowNewDialog(true)}>
          <Send className="h-3.5 w-3.5" />
          Novo mnenje
        </Button>
      </div>
      {/* Vsebina */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <FeedbackLoadingSkeleton />
        ) : feedbacks.length === 0 ? (
          <FeedbackEmptyState onAddClick={() => setShowNewDialog(true)} />
        ) : (
          <>
            <FeedbackStatsCards avgRatings={avgRatings} nps={nps} />
            <FeedbackRatingChart ratingDistribution={ratingDistribution} />
            <FeedbackFilterBar filterRating={filterRating} onFilterChange={setFilterRating} />
            <FeedbackList feedbacks={filteredFeedbacks} />
          </>
        )}
      </div>
      {/* Dialog za novo mnenje */}
      <NewFeedbackDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        newFeedback={newFeedback}
        onNewFeedbackChange={setNewFeedback}
        onSubmit={() => createFeedbackMutation.mutate()}
        isSubmitting={createFeedbackMutation.isPending}
      />
    </div>
  )
})
