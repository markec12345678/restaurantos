'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { DeliveryTrackingData } from './constants'

interface DeliveryCardProps {
  tracking: DeliveryTrackingData
  nextStatus: string | null
  onUpdateStatus: (_params: { deliveryInfoId: string; status: string }) => void
  isStatusUpdatePending: boolean
}

export const DeliveryCard = memo(function DeliveryCard({ tracking, nextStatus, onUpdateStatus, isStatusUpdatePending }: DeliveryCardProps) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium">{tracking.driverName || 'Brez voznika'}</span>
          <Badge variant={tracking.status === 'delivered' ? 'default' : 'secondary'}>{tracking.status}</Badge>
        </div>
        {nextStatus && (
          <button
            className="text-xs text-blue-600 hover:underline disabled:opacity-50"
            disabled={isStatusUpdatePending}
            onClick={() => onUpdateStatus({ deliveryInfoId: tracking.deliveryInfoId, status: nextStatus })}
          >
            Naprej → {nextStatus}
          </button>
        )}
      </CardContent>
    </Card>
  )
})
