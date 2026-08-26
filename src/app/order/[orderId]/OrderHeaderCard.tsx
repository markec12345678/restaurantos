'use client'

import { memo } from 'react'
import type { TrackingData } from './types'
import { stepIcons } from './constants'
import { safeToFixed, safeNum } from '@/lib/safe-format'

// =====================================================================
// RESTAURANTOS ORDER TRACKING — Order Header Card
// =====================================================================

interface OrderHeaderCardProps {
  tracking: TrackingData
  autoRefresh: boolean
  onStopRefresh: () => void
}

export const OrderHeaderCard = memo(function OrderHeaderCard({
  tracking,
  autoRefresh,
  onStopRefresh,
}: OrderHeaderCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Naročilo</p>
          <p className="text-3xl font-mono font-bold text-blue-600">#{tracking.order.orderNumber}</p>
        </div>
        <div className="text-right">
          <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold ${
            tracking.order.status === 'delivered' ? 'bg-green-100 text-green-700' :
            tracking.order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
            tracking.order.status === 'in-progress' ? 'bg-orange-100 text-orange-700' :
            'bg-blue-100 text-blue-700'
          }`}>
            {stepIcons[tracking.order.status]} {tracking.order.type === 'delivery' ? 'Dostava' : 'Prevzem'}
          </span>
        </div>
      </div>

      {tracking.order.customerName && (
        <p className="text-sm text-gray-600 mt-2">Pozdravljeni, {tracking.order.customerName}!</p>
      )}

      {tracking.order.delivery && (
        <div className="mt-3 p-3 rounded-xl bg-blue-50 text-sm">
          <p className="font-medium text-blue-800">📍 {tracking.order.delivery.address}, {tracking.order.delivery.city}</p>
        </div>
      )}

      <div className="mt-4 pt-3 border-t flex justify-between items-end">
        <div>
          <p className="text-xs text-gray-500">Predviden čas</p>
          <p className="text-lg font-bold text-blue-700">{tracking.estimatedMinutes} min</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Skupaj</p>
          <p className="text-lg font-bold">€{safeToFixed(tracking.order.total, 2)}</p>
        </div>
      </div>

      {autoRefresh && (
        <p className="text-xs text-center text-gray-400 mt-2">
          Samodejno osveževanje vsakih 15s...
          <button onClick={onStopRefresh} className="ml-1 text-blue-500 underline">Ustavi</button>
        </p>
      )}
    </div>
  )
})
