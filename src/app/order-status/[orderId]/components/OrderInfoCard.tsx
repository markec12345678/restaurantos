'use client'

import { memo } from 'react'
import { Phone, MapPin, Clock } from 'lucide-react'
import type { OrderData } from '../types'
import { getElapsedTime, getEstimatedTime, getStepIndex } from '../constants'
import { safeToFixed, safeNum } from '@/lib/safe-format'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Kartica s podatki naročila
// Prikazuje številko, tip, ceno, stranko in predviden čas
// ═══════════════════════════════════════════════════════════════

interface OrderInfoCardProps {
  order: OrderData
}

export const OrderInfoCard = memo(function OrderInfoCard({ order }: OrderInfoCardProps) {
  const currentStep = getStepIndex(order.status)
  const isCancelled = order.status === 'cancelled'
  const typeLabel = order.type === 'dine-in' ? 'Na mestu' : order.type === 'takeout' ? 'Za s seboj' : 'Dostava'

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Naročilo #{order.orderNumber}</h1>
          <p className="text-sm text-muted-foreground">{typeLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-primary">{'\u20AC'}{safeToFixed(order.total, 2)}</p>
          <p className="text-xs text-muted-foreground">
            {getElapsedTime(order.createdAt)}
          </p>
        </div>
      </div>

      {/* Podatki o stranki in lokaciji */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
        {order.customerName && (
          <span className="flex items-center gap-1">
            <Phone className="h-3 w-3" />
            {order.customerName}
          </span>
        )}
        {order.location && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {order.location.name}
          </span>
        )}
      </div>

      {/* Predviden čas */}
      {!isCancelled && currentStep < 5 && (
        <div className="bg-primary/5 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Predviden čas</span>
          </div>
          <span className="text-sm font-bold text-primary">
            {getEstimatedTime(order.createdAt, order.type)}
          </span>
        </div>
      )}
    </div>
  )
})
