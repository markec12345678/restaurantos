'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import type { LocationStatsProps } from './constants'

// Statistične kartice za lokacije
export const LocationStats = memo(function LocationStats({ total, active, open }: LocationStatsProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <Card><CardContent className="p-4 text-center">
        <p className="text-xs text-muted-foreground">Skupaj</p>
        <p className="text-2xl font-bold">{total}</p>
      </CardContent></Card>
      <Card><CardContent className="p-4 text-center">
        <p className="text-xs text-muted-foreground">Aktivne</p>
        <p className="text-2xl font-bold text-green-600">{active}</p>
      </CardContent></Card>
      <Card><CardContent className="p-4 text-center">
        <p className="text-xs text-muted-foreground">Odprte</p>
        <p className="text-2xl font-bold text-blue-600">{open}</p>
      </CardContent></Card>
    </div>
  )
})
