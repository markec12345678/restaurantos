'use client'

// ============================================
// SEZNAM MNENJ GOSTOV
// P1-14 (R140-c): passthrough akcij reševanja + loading state na aktivni
// kartici (busyId — samo kartica v mutaciji kaže spinner).
// ============================================

import { memo } from 'react'
import { FeedbackCard } from './FeedbackCard'
import type { FeedbackListProps } from './constants'

export const FeedbackList = memo(function FeedbackList({
  feedbacks,
  onStartReview,
  onResolve,
  busyId,
}: FeedbackListProps) {
  return (
    <div className="space-y-3">
      {feedbacks.map(fb => (
        <FeedbackCard
          key={fb.id}
          fb={fb}
          onStartReview={onStartReview}
          onResolve={onResolve}
          isBusy={busyId === fb.id}
        />
      ))}
    </div>
  )
})
