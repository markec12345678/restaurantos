'use client'

// ============================================
// KARTICA ZAKLJUČENE DOSTAVE
// ============================================

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { statusLabels, statusColors } from './constants'
import type { CompletedDeliveryCardProps } from './constants'

export const CompletedDeliveryCard = memo(function CompletedDeliveryCard({
  delivery,
}: CompletedDeliveryCardProps) {
  return (
    <Card className="opacity-75">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between">
          <p className="font-medium text-sm">{delivery.address}, {delivery.city}</p>
          <Badge className={statusColors[delivery.status] || ''}>{statusLabels[delivery.status] || delivery.status}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">{delivery.recipientName} | €{(delivery.deliveryFee ?? 0).toFixed(2)}</p>
      </CardContent>
    </Card>
  )
})
