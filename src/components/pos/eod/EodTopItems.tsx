'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp } from 'lucide-react'
import type { EodSectionsProps } from './constants'

export const EodTopItems = memo(function EodTopItems({ data }: Pick<EodSectionsProps, 'data'>) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="h-4 w-4" />Najbolj prodajani danes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.topItems.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">{idx + 1}</span>
                <span className="text-sm">{item.name}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">{item.quantity}x</span>
                <span className="font-semibold">&euro;{item.revenue.toFixed(2)}</span>
              </div>
            </div>
          ))}
          {data.topItems.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Ni prodaje danes</p>}
        </div>
      </CardContent>
    </Card>
  )
})
