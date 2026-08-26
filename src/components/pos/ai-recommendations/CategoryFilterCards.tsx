'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { CATEGORY_CONFIG } from './constants'
import type { Recommendation } from './constants'

// ============================================
// CATEGORY FILTER CARDS SUB-COMPONENT
// ============================================
interface CategoryFilterCardsProps {
  activeTab: string
  onTabChange: (_tab: string) => void
  recommendations: Recommendation[]
}

export const CategoryFilterCards = memo(function CategoryFilterCards({
  activeTab,
  onTabChange,
  recommendations,
}: CategoryFilterCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
        const Icon = cfg.icon
        const count = recommendations.filter(r => r.category === key).length
        return (
          <Card key={key} className={`cursor-pointer transition-all ${activeTab === key ? 'ring-2 ring-purple-400' : ''}`}
            role="button" tabIndex={0}
            onClick={() => onTabChange(activeTab === key ? 'all' : key)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTabChange(activeTab === key ? 'all' : key) } }}
          >
            <CardContent className="p-3 text-center">
              <Icon className={`h-5 w-5 mx-auto mb-1 ${cfg.color.split(' ')[0]}`} />
              <div className="text-lg font-bold">{count}</div>
              <div className="text-xs text-muted-foreground">{cfg.label}</div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
})
