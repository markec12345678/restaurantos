'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { DialogFooter } from '@/components/ui/dialog'
import { Users, Minus, Plus, CheckCircle2 } from 'lucide-react'
import type { EqualSplitTabProps } from './constants'

export const EqualSplitTab = memo(function EqualSplitTab({
  equalCount,
  onEqualCountChange,
  orderTotal,
  autoGratuityAmount,
  equalSplitAmount,
  equalRemainder,
  onClose,
  onConfirmEqual,
}: EqualSplitTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Število oseb:</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Zmanjšaj" className="h-8 w-8" onClick={() => onEqualCountChange(Math.max(2, equalCount - 1))} autoFocus>
            <Minus className="h-3 w-3" />
          </Button>
          <span className="text-2xl font-bold w-12 text-center">{equalCount}</span>
          <Button variant="outline" size="icon" aria-label="Dodaj" className="h-8 w-8" onClick={() => onEqualCountChange(Math.min(20, equalCount + 1))}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Skupaj z napitnino</p>
            <p className="text-2xl font-bold text-primary">€{(orderTotal + autoGratuityAmount).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Na osebo</p>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">€{equalSplitAmount.toFixed(2)}</p>
            {equalRemainder > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1">+€{equalRemainder.toFixed(2)} na zadnjo osebo</p>
            )}
          </CardContent>
        </Card>
      </div>
      {/* Vizualna enakomerna delitev */}
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: equalCount }, (_, i) => (
          <div key={i} className="flex flex-col items-center p-2 rounded-lg bg-muted/50 border">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center mb-1">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <span className="text-xs text-muted-foreground">Oseba {i + 1}</span>
            <span className="text-sm font-bold">€{equalSplitAmount.toFixed(2)}</span>
            {i === 0 && equalRemainder > 0 && (
              <Badge variant="outline" className="text-[9px] h-4 mt-1">+€{equalRemainder.toFixed(2)}</Badge>
            )}
          </div>
        ))}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Prekliči</Button>
        <Button onClick={onConfirmEqual} className="gap-1.5">
          <CheckCircle2 className="h-4 w-4" />
          Potrdi delitev ({equalCount}x)
        </Button>
      </DialogFooter>
    </div>
  )
})
