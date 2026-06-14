'use client'

// ─── Kvadrant kartice za Menu Engineering ─────────────────────

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { QUADRANT_COLORS, QUADRANT_LABELS, QUADRANT_DESCRIPTIONS, QUADRANT_ICONS, type QuadrantSummaryCardsProps, type QuadrantKey } from './constants'

export const QuadrantSummaryCards = memo(function QuadrantSummaryCards({ data }: QuadrantSummaryCardsProps) {
  const quadrants: Array<{ key: QuadrantKey; count: number }> = [
    { key: 'star', count: data?.stars || 0 },
    { key: 'puzzle', count: data?.puzzles || 0 },
    { key: 'plowhorse', count: data?.plowhorses || 0 },
    { key: 'dog', count: data?.dogs || 0 },
  ]

  return (
    <div className="grid grid-cols-4 gap-3 p-4 flex-shrink-0">
      {quadrants.map(q => {
        const IconComp = QUADRANT_ICONS[q.key]
        return (
          <Card key={q.key} className="overflow-hidden">
            <div className="h-1" style={{ backgroundColor: QUADRANT_COLORS[q.key] }} />
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <span style={{ color: QUADRANT_COLORS[q.key] }}><IconComp className="h-4 w-4" /></span>
                <span className="text-xs font-semibold" style={{ color: QUADRANT_COLORS[q.key] }}>{QUADRANT_LABELS[q.key]}</span>
              </div>
              <p className="text-2xl font-bold">{q.count}</p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-1">{QUADRANT_DESCRIPTIONS[q.key]}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
})
