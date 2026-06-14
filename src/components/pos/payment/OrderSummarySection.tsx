'use client'

import { memo } from 'react'
import { Separator } from '@/components/ui/separator'
import type { OrderItemType } from './types'

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
        <span>€{subtotal.toFixed(2)}</span>
      </div>
      <div className="flex justify-between text-muted-foreground">
        <span>DDV</span>
        <span>€{tax.toFixed(2)}</span>
      </div>
      {discount > 0 && (
        <div className="flex justify-between text-emerald-600">
          <span>Popust</span>
          <span>-€{discount.toFixed(2)}</span>
        </div>
      )}
      <Separator />
      <div className="flex justify-between font-bold">
        <span>Skupaj</span>
        <span>€{total.toFixed(2)}</span>
      </div>
      <Separator />
      <div className="space-y-0.5">
        {orderItems.map(oi => (
          <div key={oi.id} className="flex justify-between text-xs text-muted-foreground">
            <span>{oi.quantity}x {oi.menuItem.name}</span>
            <span>€{(oi.price * oi.quantity).toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  )
})
