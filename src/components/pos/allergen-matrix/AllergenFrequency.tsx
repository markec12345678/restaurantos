'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'
import type { AllergenFrequencyProps } from './constants'

// ============================================
// VIZUALIZACIJA POGOSTOSTI ALERGENOV
// ============================================

export const AllergenFrequency = memo(function AllergenFrequency({
  allergenCounts,
  totalItems,
}: AllergenFrequencyProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Pogostost alergenov
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {allergenCounts.map(a => (
            <div key={a.id} className="flex items-center gap-3">
              <span className="text-lg w-6 text-center">{a.icon}</span>
              <span className="text-sm w-24 font-medium">{a.label}</span>
              <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden" role="progressbar" aria-valuenow={Math.round((a.count / totalItems) * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${a.label}: ${a.count} od ${totalItems} artiklov`}>
                <div
                  className="h-full bg-amber-500 rounded-full transition-all"
                  style={{ width: `${(a.count / totalItems) * 100}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-8 text-right">{a.count}x</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
})
