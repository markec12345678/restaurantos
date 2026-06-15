'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TimeDistributionChart } from './TimeDistributionChart'

// ============================================
// Prihodek po kategorijah kartica
// ============================================

interface CategoryBreakdownCardProps {
  categoryBreakdown: { name: string; revenue: number }[]
}

export const CategoryBreakdownCard = memo(function CategoryBreakdownCard({ categoryBreakdown }: CategoryBreakdownCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Prihodek po kategorijah</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <TimeDistributionChart data={categoryBreakdown.slice(0, 10)} periodLabel="Prihodek po kategorijah" />
        </div>
      </CardContent>
    </Card>
  )
})
