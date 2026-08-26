'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Flame, Package, AlertTriangle, Zap } from 'lucide-react'

// ============================================
// POVZETEK KUHINJSKIH POSTAJ — 4 kartice
// ============================================

interface StationStatsCardsProps {
  activeStations: number
  totalOrders: number
  overloadedStations: number
  avgLoad: number
}

export const StationStatsCards = memo(function StationStatsCards({
  activeStations,
  totalOrders,
  overloadedStations,
  avgLoad,
}: StationStatsCardsProps) {
  return (
    <div className="grid grid-cols-4 gap-3">
      <Card>
        <CardContent className="p-3 text-center">
          <Flame className="h-5 w-5 text-orange-500 mx-auto mb-1" />
          <p className="text-xl font-bold">{activeStations}</p>
          <p className="text-xs text-muted-foreground">Aktivne postaje</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 text-center">
          <Package className="h-5 w-5 text-blue-500 mx-auto mb-1" />
          <p className="text-xl font-bold">{totalOrders}</p>
          <p className="text-xs text-muted-foreground">Artikli v pripravi</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 text-center">
          <AlertTriangle className="h-5 w-5 text-amber-500 mx-auto mb-1" />
          <p className="text-xl font-bold">{overloadedStations}</p>
          <p className="text-xs text-muted-foreground">Preobremenjene</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 text-center">
          <Zap className="h-5 w-5 text-purple-500 mx-auto mb-1" />
          <p className="text-xl font-bold">{Math.round(avgLoad)}%</p>
          <p className="text-xs text-muted-foreground">Povprečna obremenitev</p>
        </CardContent>
      </Card>
    </div>
  )
})
