'use client'

import { memo } from 'react'
import type { OrderItem } from '../types'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Seznam artiklov v naročilu
// Prikazuje količino, ime in status posameznega artikla
// ═══════════════════════════════════════════════════════════════

interface OrderItemsListProps {
  items: OrderItem[]
}

export const OrderItemsList = memo(function OrderItemsList({ items }: OrderItemsListProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
      <h2 className="font-bold text-lg mb-4">Vsebina naročila</h2>
      <div className="space-y-3">
        {items?.map((item) => (
          <div key={item.id} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`h-2 w-2 rounded-full ${
                item.status === 'ready' ? 'bg-emerald-500' :
                item.status === 'preparing' ? 'bg-amber-500' :
                'bg-gray-300'
              }`} />
              <span className="text-sm">{item.quantity}x {item.menuItem?.name || 'Artikel'}</span>
            </div>
            <span className="text-xs text-muted-foreground capitalize">{item.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
})
