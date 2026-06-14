'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Plus, Star, Percent } from 'lucide-react'
import { typeConfig, formatCurrency } from './constants'
import type { UpsellGridProps } from './constants'

// ============================================
// UPSELL MREZA — Prikaz predlaganih upsell artiklov
// ============================================

export const UpsellGrid = memo(function UpsellGrid({ suggestions, addedItems, onAddSuggestion }: UpsellGridProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-yellow-500" /> Predlagani upsell artikli
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {suggestions.map(item => {
            const typeConf = typeConfig[item.type]
            const isAdded = addedItems.has(item.id)
            return (
              <div key={item.id} className={`p-3 rounded-lg border transition-all ${isAdded ? 'border-green-500 bg-green-50 dark:bg-green-900/10' : 'hover:border-primary hover:shadow-sm'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{item.imageEmoji}</span>
                    <div>
                      <span className="font-medium text-sm block">{item.name}</span>
                      <Badge className={`${typeConf.color} text-[10px]`}>{typeConf.label}</Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold text-lg">{formatCurrency(item.price)}</span>
                  {item.originalPrice && (
                    <span className="text-sm text-muted-foreground line-through">{formatCurrency(item.originalPrice)}</span>
                  )}
                  {item.originalPrice && (
                    <Badge variant="destructive" className="text-[10px]">
                      -{Math.round((1 - item.price / item.originalPrice) * 100)}%
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-3">{item.reason}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Star className="h-3 w-3" /> {item.popularity}%</span>
                    <span className="flex items-center gap-1"><Percent className="h-3 w-3" /> {item.margin}% marža</span>
                  </div>
                  <Button
                    size="sm"
                    variant={isAdded ? 'default' : 'outline'}
                    onClick={() => onAddSuggestion(item.id)}
                    className="h-7 text-xs"
                  >
                    {isAdded ? (
                      <><Sparkles className="h-3 w-3 mr-1" /> Dodano!</>
                    ) : (
                      <><Plus className="h-3 w-3 mr-1" /> Dodaj</>
                    )}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
})
