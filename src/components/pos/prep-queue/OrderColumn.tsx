'use client'

// ═══════════════════════════════════════════════════════════════
// STOLPEC NAROČIL — posamezen stolpec (čakajoča / v pripravi / pripravljena)
// ═══════════════════════════════════════════════════════════════

import { memo } from 'react'
import { OrderCard } from './OrderCard'
import type { OrderColumnProps } from './constants'

export const OrderColumn = memo(function OrderColumn({
  title, count, dotColor, emptyIcon: EmptyIcon, emptyText,
  orders, viewMode, onItemStatus, onOrderStatus,
}: OrderColumnProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <div className={`h-3 w-3 rounded-full ${dotColor}`}>
          <span className="sr-only">{title}</span>
        </div>
        <h3 className="font-bold text-sm">{title} ({count})</h3>
      </div>
      {orders.map(order => (
        <OrderCard
          key={order.id}
          order={order}
          viewMode={viewMode}
          onItemStatus={onItemStatus}
          onOrderStatus={onOrderStatus}
        />
      ))}
      {orders.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <EmptyIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
          {emptyText}
        </div>
      )}
    </div>
  )
})
