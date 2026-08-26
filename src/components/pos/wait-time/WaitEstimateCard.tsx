'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatWait } from './constants'
import type { WaitEstimateCardProps } from './constants'

// ============================================
// OCENA ČAKANJA — Kartica z glavno oceno
// ============================================

export const WaitEstimateCard = memo(function WaitEstimateCard({ estimation, partySize, diningType }: WaitEstimateCardProps) {
  return (
    <Card className={`border-2 ${
      estimation.estimatedWait === 0 ? 'border-green-300 dark:border-green-800' :
      estimation.estimatedWait <= 15 ? 'border-amber-300 dark:border-amber-800' :
      estimation.estimatedWait <= 30 ? 'border-orange-300 dark:border-orange-800' :
      'border-red-300 dark:border-red-800'
    }`}>
      <CardContent className="p-6 text-center">
        <div className={`text-5xl font-bold mb-2 ${
          estimation.estimatedWait === 0 ? 'text-green-600' :
          estimation.estimatedWait <= 15 ? 'text-amber-600' :
          estimation.estimatedWait <= 30 ? 'text-orange-600' :
          'text-red-600'
        }`}>
          {formatWait(estimation.estimatedWait)}
        </div>
        <div className="flex items-center justify-center gap-2 mb-3">
          <Badge className={
            estimation.confidence === 'high' ? 'bg-green-100 text-green-800' :
            estimation.confidence === 'medium' ? 'bg-amber-100 text-amber-800' :
            'bg-red-100 text-red-800'
          }>
            {estimation.confidence === 'high' ? 'Visoka natančnost' :
             estimation.confidence === 'medium' ? 'Srednja natančnost' :
             'Nizka natančnost'}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Za {partySize} {parseInt(partySize) === 1 ? 'osebo' : parseInt(partySize) < 5 ? 'osebe' : 'oseb'}
          {' · '}{diningType === 'dine-in' ? 'na mestu' : diningType === 'takeout' ? 'za s seboj' : 'dostava'}
        </p>
      </CardContent>
    </Card>
  )
})
