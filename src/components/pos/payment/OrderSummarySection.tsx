'use client'

import { memo } from 'react'
import { Separator } from '@/components/ui/separator'
import type { OrderItemType } from './types'
import { safeToFixed, safeNum } from '@/lib/safe-format'

// ============================================
// POVZETEK NAROČILA
// ============================================

interface OrderSummarySectionProps {
  subtotal: number
  tax: number
  discount: number
  total: number
  orderItems: OrderItemType[]
}

export const OrderSummarySection = memo(function OrderSummarySection({
  subtotal,
  tax,
  discount,
  total,
  orderItems,
}: OrderSummarySectionProps) {
  return (
    <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-sm">
      <div className="flex justify-between text-muted-foreground">
        <span>Vmesna vsota</span>
        <span>€{safeToFixed(subtotal, 2)}</span>
      </div>
      <div className="flex justify-between text-muted-foreground">
        <span>DDV</span>
        <span>€{safeToFixed(tax, 2)}</span>
      </div>
      {discount > 0 && (
        <div className="flex justify-between text-emerald-600">
          <span>Popust</span>
          <span>-€{safeToFixed(discount, 2)}</span>
        </div>
      )}
      <Separator />
      <div className="flex justify-between font-bold">
        <span>Skupaj</span>
        <span>€{safeToFixed(total, 2)}</span>
      </div>
      <Separator />
      <div className="space-y-0.5">
        {/* FIX TypeError: t?.filter — orderItems je lahko undefined */}
        {(Array.isArray(orderItems) ? orderItems : []).map(oi => (
          <div key={oi.id} className="flex justify-between text-xs text-muted-foreground">
            <span>{oi.quantity}x {oi.menuItem?.name || 'Artikel'}</span>
            <span>€{safeToFixed(oi.price * oi.quantity, 2)}</span>
          </div>
        ))}
      </div>
    </div>
  )
})
