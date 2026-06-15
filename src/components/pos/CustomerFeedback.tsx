'use client'
// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Customer Feedback System
// Zbiranje povratnih informacij po obisku, ocene, komentarji
// ═══════════════════════════════════════════════════════════════
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, Send } from 'lucide-react'
import { memo } from 'react'
import { useFeedbackData } from './customer-feedback/useFeedbackData'

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
  const {
    feedbacks, isLoading,
    showNewDialog, setShowNewDialog,
    filterRating, setFilterRating,
    newFeedback, setNewFeedback,
    filteredFeedbacks, avgRatings, ratingDistribution, nps,
    createFeedbackMutation,
  } = useFeedbackData()

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
