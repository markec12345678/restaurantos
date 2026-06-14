'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2, Users, Clock, ChefHat } from 'lucide-react'
import type { StatsGridProps } from './constants'

// ============================================
// STATISTIKA — Štiri kartice z metrikami
// ============================================

export const StatsGrid = memo(function StatsGrid({ estimation }: StatsGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-xs text-muted-foreground">Proste mize</span>
          </div>
          <div className="text-xl font-bold text-green-600">{estimation.availableTables}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-amber-600" />
            <span className="text-xs text-muted-foreground">Zasedenost</span>
          </div>
          <div className="text-xl font-bold text-amber-600">{estimation.occupancyRate.toFixed(0)}%</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-blue-600" />
            <span className="text-xs text-muted-foreground">V čakalni vrsti</span>
          </div>
          <div className="text-xl font-bold text-blue-600">{estimation.waitlistCount}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <ChefHat className="h-4 w-4 text-purple-600" />
            <span className="text-xs text-muted-foreground">Povp. čas obroka</span>
          </div>
          <div className="text-xl font-bold text-purple-600">~{estimation.avgMealTime}m</div>
        </CardContent>
      </Card>
    </div>
  )
})
