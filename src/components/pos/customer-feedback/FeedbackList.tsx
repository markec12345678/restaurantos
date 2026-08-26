'use client'

// ============================================
// SEZNAM MNENJ GOSTOV
// ============================================

import { memo } from 'react'
import { FeedbackCard } from './FeedbackCard'
import type { FeedbackListProps } from './constants'

export const FeedbackList = memo(function FeedbackList({ feedbacks }: FeedbackListProps) {
  return (
    <div className="space-y-3">
      {feedbacks.map(fb => (
        <FeedbackCard key={fb.id} fb={fb} />
      ))}
    </div>
  )
})
