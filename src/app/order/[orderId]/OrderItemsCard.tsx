'use client'

import { memo } from 'react'
import type { TrackingData } from './types'

// =====================================================================
// RESTAURANTOS ORDER TRACKING — Order Items Card Component
// =====================================================================

interface OrderItemsCardProps {
  tracking: TrackingData
}

export const OrderItemsCard = memo(function OrderItemsCard({
  tracking,
}: OrderItemsCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h3 className="font-bold mb-3">Vsebina naročila</h3>
      <div className="space-y-2">
        {tracking.order.items.map((item, idx) => (
          <div key={idx} className="flex justify-between text-sm">
            <span>
              <span className="font-medium">{item.quantity}×</span> {item.name}
            </span>
            {item.notes && <span className="text-gray-400 text-xs ml-2">({item.notes})</span>}
          </div>
        ))}
      </div>
    </div>
  )
})
