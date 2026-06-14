'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import { planIcons, planColors } from './constants'
import type { PlansGridProps } from './constants'

// ============================================
// MREŽA PAKETOV — Primerjava paketov naročnine
// ============================================

export const PlansGrid = memo(function PlansGrid({ plans, selectedPlan, currentPlan, onSelectPlan }: PlansGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {Object.entries(plans).map(([key, plan]) => (
        <Card key={key} className={`relative overflow-hidden ${currentPlan === key ? 'ring-2 ring-primary' : ''}`}>
          <div className={`h-1.5 bg-gradient-to-r ${planColors[key]}`} />
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${planColors[key]} text-white flex items-center justify-center`}>
                {planIcons[key]}
              </div>
              <h3 className="font-bold text-lg">{plan.name}</h3>
            </div>
            <div className="mb-4">
              <span className="text-3xl font-bold">€{plan.price}</span>
              <span className="text-muted-foreground text-sm">/mesec</span>
            </div>
            <ul className="space-y-2 text-sm">
              {plan.features.map((f: string, i: number) => (
                <li key={i} className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {!currentPlan && (
              <Button
                className="w-full mt-4"
                variant={selectedPlan === key ? 'default' : 'outline'}
                onClick={() => onSelectPlan(key)}
              >
                {selectedPlan === key ? 'Izbrano ✓' : 'Izberi'}
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
})
