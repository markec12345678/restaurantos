'use client'

import { memo } from 'react'
import type { OrderInfoPanelProps } from './constants'
import { formatEUR } from '@/lib/safe-format'

// ============================================
// PODATKI NAROČILA
// ============================================
export const OrderInfoPanel = memo(function OrderInfoPanel({
  order,
  totalWithTip,
}: OrderInfoPanelProps) {
  return (
    <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
      <div className="flex justify-between font-semibold">
        <span>Naročilo #{order.orderNumber}</span>
        <span>{formatEUR(totalWithTip)}</span>
      </div>
      {order.discount > 0 && (
        <div className="flex justify-between text-xs text-emerald-600">
          <span>Popust</span>
          <span>-{formatEUR(order.discount)}</span>
        </div>
      )}
      {order.tip > 0 && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Napitnina</span>
          <span>{formatEUR(order.tip)}</span>
        </div>
      )}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Način plačila</span>
        <span>{order.paymentMethod || 'Ni plačano'}</span>
      </div>
    </div>
  )
})
