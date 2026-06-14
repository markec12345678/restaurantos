'use client'

// ============================================
// EMOTIKON ZA OCENO
// ============================================

import { memo } from 'react'
import { Smile, Meh, Frown } from 'lucide-react'

export const RatingEmoji = memo(function RatingEmoji({ rating }: { rating: number }) {
  if (rating >= 4) return <Smile className="h-5 w-5 text-emerald-500" />
  if (rating >= 3) return <Meh className="h-5 w-5 text-amber-500" />
  return <Frown className="h-5 w-5 text-red-500" />
})
