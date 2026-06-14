'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, CheckCircle2, Users, Zap } from 'lucide-react'
import type { EstimationFactorsProps } from './constants'

// ============================================
// DEJAVNIKI OCENE — Prikaz vplivnih faktorjev
// ============================================

export const EstimationFactors = memo(function EstimationFactors({ estimation, partySize }: EstimationFactorsProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Dejavniki ocene</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-accent/50">
            {estimation.isPeakHour ? (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
            <span className="text-sm">
              {estimation.isPeakHour ? 'Prometna ura' : 'Mirna ura'}
            </span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-accent/50">
            {estimation.isWeekend ? (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
            <span className="text-sm">
              {estimation.isWeekend ? 'Vikend' : 'Delovni dan'}
            </span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-accent/50">
            <Users className="h-4 w-4 text-blue-500" />
            <span className="text-sm">
              {parseInt(partySize) >= 6 ? 'Velika skupina' : parseInt(partySize) >= 4 ? 'Srednja skupina' : 'Majhna skupina'}
            </span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-accent/50">
            <Zap className="h-4 w-4 text-purple-500" />
            <span className="text-sm">
              {estimation.occupancyRate > 80 ? 'Visoka zasedenost' : 'Normalna zasedenost'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})
