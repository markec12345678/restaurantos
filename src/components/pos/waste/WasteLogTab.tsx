'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { WasteLogTabProps } from './constants'

// ============================================
// DNEVNIK ODPADKOV
// ============================================
export const WasteLogTab = memo(function WasteLogTab({
  entries,
  formatCurrency: fmtCurrency,
}: WasteLogTabProps) {
  return (
    <div className="space-y-2">
      {entries.map(entry => (
        <Card key={entry.id}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{entry.itemName}</span>
                  <Badge variant="outline" className="text-xs">{entry.category}</Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{entry.quantity} {entry.unit}</span>
                  <span>·</span>
                  <span>{new Date(entry.date).toLocaleDateString('sl-SI')}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-red-600">{fmtCurrency(entry.totalCost)}</p>
                <p className="text-xs text-muted-foreground">{entry.reason}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
})
