'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Factory, BarChart3, CheckCircle, AlertTriangle } from 'lucide-react'
import type { VendorSummaryCardsProps } from './constants'

// ============================================
// POVZETEK — Štiri kartice z metrikmami dobaviteljev
// ============================================

export const VendorSummaryCards = memo(function VendorSummaryCards({ supplierCount, avgScore, preferredCount, probationCount }: VendorSummaryCardsProps) {
  return (
    <div className="grid grid-cols-4 gap-3">
      <Card>
        <CardContent className="p-3 text-center">
          <Factory className="h-5 w-5 text-violet-500 mx-auto mb-1" />
          <p className="text-xl font-bold">{supplierCount}</p>
          <p className="text-xs text-muted-foreground">Dobavitelji</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 text-center">
          <BarChart3 className="h-5 w-5 text-blue-500 mx-auto mb-1" />
          <p className="text-xl font-bold">{avgScore}/100</p>
          <p className="text-xs text-muted-foreground">Povprečna ocena</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 text-center">
          <CheckCircle className="h-5 w-5 text-green-500 mx-auto mb-1" />
          <p className="text-xl font-bold">{preferredCount}</p>
          <p className="text-xs text-muted-foreground">Prednostni</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 text-center">
          <AlertTriangle className="h-5 w-5 text-red-500 mx-auto mb-1" />
          <p className="text-xl font-bold">{probationCount}</p>
          <p className="text-xs text-muted-foreground">Na preizkusu</p>
        </CardContent>
      </Card>
    </div>
  )
})
