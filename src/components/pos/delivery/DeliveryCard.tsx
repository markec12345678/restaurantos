'use client'

// ============================================
// KARTICA AKTIVNE DOSTAVE
// ============================================

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { safeToFixed, safeNum } from '@/lib/safe-format'
import { MapPin, Phone, Clock, Navigation, RefreshCw } from 'lucide-react'
import { statusLabels, statusColors, deliveryAdvanceLabel } from './constants'
import type { DeliveryCardProps } from './constants'

export const DeliveryCard = memo(function DeliveryCard({
  delivery,
  onAdvanceStatus,
  onEdit,
}: DeliveryCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <p className="font-medium text-sm">{delivery.address}</p>
            </div>
            <p className="text-xs text-muted-foreground">{delivery.city} {delivery.postCode}</p>
          </div>
          <Badge className={statusColors[delivery.status] || ''}>{statusLabels[delivery.status] || delivery.status}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1">
            <Phone className="h-3 w-3 text-muted-foreground" />
            <span>{delivery.recipientName || 'Brez imena'}</span>
          </div>
          {delivery.courierName && (
            <div className="flex items-center gap-1">
              <Navigation className="h-3 w-3 text-muted-foreground" />
              <span>{delivery.courierName}</span>
            </div>
          )}
          {delivery.promisedTime && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span>{new Date(delivery.promisedTime).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          )}
        </div>

        {delivery.deliveryInstructions && (
          <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">{delivery.deliveryInstructions}</p>
        )}

        <div className="flex items-center justify-between text-xs">
          <span>Dostava: €{safeToFixed(delivery.deliveryFee ?? 0, 2)} | Embalaža: €{safeToFixed(delivery.packagingFee ?? 0, 2)}</span>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => onAdvanceStatus(delivery)} aria-label={`Naprej: ${deliveryAdvanceLabel(delivery.status)}`}>
            <RefreshCw className="h-3 w-3 mr-1" />
            {deliveryAdvanceLabel(delivery.status)}
          </Button>
          <Button variant="outline" size="sm" onClick={() => onEdit(delivery)} aria-label="Uredi dostavo">Uredi</Button>
        </div>
      </CardContent>
    </Card>
  )
})
