'use client'

// ============================================
// KARTICE S STATISTIKO MNENJ
// ============================================

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Star, Zap, TrendingUp } from 'lucide-react'
import { RatingEmoji } from './RatingEmoji'
import { safeToFixed, safeNum } from '@/lib/safe-format'
import type { FeedbackStatsCardsProps } from './constants'

export const FeedbackStatsCards = memo(function FeedbackStatsCards({ avgRatings, nps }: FeedbackStatsCardsProps) {
  return (
    <div className="grid grid-cols-4 gap-3">
      <Card>
        <CardContent className="p-3 text-center">
          <RatingEmoji rating={avgRatings.overall} />
          <p className="text-2xl font-bold mt-1">{safeToFixed(avgRatings.overall, 1)}</p>
          <p className="text-[10px] text-muted-foreground">Skupna ocena</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 text-center">
          <Star className="h-5 w-5 text-amber-400 mx-auto" />
          <p className="text-2xl font-bold mt-1">{safeToFixed(avgRatings.food, 1)}</p>
          <p className="text-[10px] text-muted-foreground">Hrana</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 text-center">
          <Zap className="h-5 w-5 text-blue-400 mx-auto" />
          <p className="text-2xl font-bold mt-1">{safeToFixed(avgRatings.service, 1)}</p>
          <p className="text-[10px] text-muted-foreground">Postrežba</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 text-center">
          <TrendingUp className="h-5 w-5 text-emerald-400 mx-auto" />
          <p className="text-2xl font-bold mt-1">{nps}</p>
          <p className="text-[10px] text-muted-foreground">NPS</p>
        </CardContent>
      </Card>
    </div>
  )
})
