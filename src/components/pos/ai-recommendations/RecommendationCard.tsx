'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Zap } from 'lucide-react'
import type { Recommendation } from './constants'
import { CATEGORY_CONFIG } from './constants'

// ============================================
// KARTICA POSAMEZNEGA PRIPOROČILA
// ============================================

interface RecommendationCardProps {
  rec: Recommendation
  index: number
}

export const RecommendationCard = memo(function RecommendationCard({ rec, index }: RecommendationCardProps) {
  const cfg = CATEGORY_CONFIG[rec.category] || CATEGORY_CONFIG.popular
  const Icon = cfg.icon

  return (
    <Card className="overflow-hidden">
      <div className={`h-1 ${cfg.color.split(' ')[1] || 'bg-gray-200'}`} />
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-muted-foreground">#{index + 1}</span>
            <div>
              <div className="font-semibold text-sm">{rec.item.name}</div>
              <div className="text-xs text-muted-foreground">{rec.item.category?.name}</div>
            </div>
          </div>
          <Badge className={cfg.color}>
            <Icon className="h-3 w-3 mr-1" />
            {cfg.label}
          </Badge>
        </div>

        {/* Cena + Score */}
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-green-600">€{rec.item.price.toFixed(2)}</span>
          <div className="flex items-center gap-1">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold">{rec.score}</span>
            <span className="text-xs text-muted-foreground">točk</span>
          </div>
        </div>

        {/* Razlogi */}
        <div className="space-y-1">
          {rec.reasons.map((reason, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <Zap className="h-3 w-3 text-amber-500 shrink-0" />
              <span className="text-muted-foreground">{reason}</span>
            </div>
          ))}
        </div>

        {/* Score bar */}
        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
          <div className="h-1.5 rounded-full bg-gradient-to-r from-purple-400 to-indigo-600"
            style={{ width: `${Math.min(rec.score, 100)}%` }} />
        </div>
      </CardContent>
    </Card>
  )
})
