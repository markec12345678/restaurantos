'use client'

// ============================================
// SEZNAM NABAVNIH NAROČIL — Prikaz naročil
// ============================================

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Truck, FileText, Calendar, Clock } from 'lucide-react'
import { safeToFixed, safeNum } from '@/lib/safe-format'
import { format } from 'date-fns'
import type { PurchaseOrderType } from './constants'
import { poStatusLabels, poStatusColors } from './constants'

interface PurchaseOrdersListProps {
  orders: PurchaseOrderType[]
}

export const PurchaseOrdersList = memo(function PurchaseOrdersList({ orders }: PurchaseOrdersListProps) {
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
        <FileText className="h-12 w-12 opacity-20" />
        <p className="text-sm font-medium">Ni nabavnih naročil</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {orders.map(po => (
        <Card key={po.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm font-mono">{po.poNumber}</span>
                    <Badge variant="outline" className={`text-[9px] h-5 px-1.5 ${poStatusColors[po.status]}`}>
                      {poStatusLabels[po.status]}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Truck className="h-3 w-3" />{po.supplier?.name || 'Neznan'}</span>
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(po.orderDate), 'd. MMM yyyy')}</span>
                    {po.expectedDate && (
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Pričakovano: {format(new Date(po.expectedDate), 'd. MMM yyyy')}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs text-muted-foreground">{po.items?.length || 0} artiklov</span>
                    <span className="font-bold text-sm">&euro;{safeToFixed(po.totalAmount, 2)}</span>
                    <span className="text-xs text-muted-foreground">(DDV: &euro;{safeToFixed(po.vatAmount, 2)})</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
})
