'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Zap } from 'lucide-react'
import { typeConfig, formatCurrency } from './constants'
import type { RulesListProps } from './constants'

// ============================================
// PRAVILA UPSELL — Upravljanje upsell pravil
// ============================================

export const RulesList = memo(function RulesList({ rules, onToggleRule }: RulesListProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" /> Upsell pravila
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rules.map(rule => {
            const typeConf = typeConfig[rule.type]
            return (
              <div key={rule.id} className={`flex items-center justify-between p-3 rounded-lg border ${rule.enabled ? '' : 'opacity-60'}`}>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onToggleRule(rule.id)}
                    className={`h-5 w-9 rounded-full transition-colors relative ${rule.enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                    aria-label={`${rule.enabled ? 'Onemogoci' : 'Omogoci'} pravilo ${rule.name}`}
                  >
                    <div className={`h-4 w-4 rounded-full bg-white absolute top-0.5 transition-transform ${rule.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{rule.name}</span>
                      <Badge className={`${typeConf.color} text-[10px]`}>{typeConf.label}</Badge>
                      {rule.discount > 0 && (
                        <Badge variant="destructive" className="text-[10px]">-{rule.discount}%</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>Prozilec: {rule.trigger}</span>
                      <span>·</span>
                      <span>{rule.suggestion}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium">{rule.conversionRate}% konverzija</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(rule.totalRevenue)} prihodek</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
})
