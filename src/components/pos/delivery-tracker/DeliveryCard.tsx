'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MapPin, Clock, Phone, Navigation, MessageSquare, Star, ArrowRight, PhoneCall } from 'lucide-react'
import { format } from 'date-fns'
import { STATUS_CONFIG } from './constants'
import type { DeliveryCardProps } from './constants'

// ============================================
// DELIVERY CARD - Posamezna kartica dostave
// ============================================
export const DeliveryCard = memo(function DeliveryCard({
  tracking,
  nextStatus,
  onUpdateStatus,
  isStatusUpdatePending,
}: DeliveryCardProps) {
  const cfg = STATUS_CONFIG[tracking.status] || STATUS_CONFIG.assigned
  const StatusIcon = cfg.icon
  const nextCfg = nextStatus ? STATUS_CONFIG[nextStatus] : null
  const NextIcon = nextCfg?.icon || ArrowRight
  const order = tracking.deliveryInfo?.order

  return (
    <Card className="overflow-hidden">
      {/* Status bar */}
      <div className={`h-1.5 ${
        tracking.status === 'delivered' ? 'bg-green-500' :
        tracking.status === 'failed' ? 'bg-red-500' :
        tracking.status === 'on_the_way' ? 'bg-purple-500' :
        'bg-blue-500'
      }`} aria-label={tracking.status === 'delivered' ? 'Dostavljeno' : tracking.status === 'failed' ? 'Neuspelo' : tracking.status === 'on_the_way' ? 'Na poti' : 'V obdelavi'} />

      <CardContent className="p-4 space-y-3">
        {/* Order + Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {order && (
              <span className="font-bold text-sm">#{order.orderNumber}</span>
            )}
            <Badge className={cfg.color}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {cfg.label}
            </Badge>
          </div>
          {order && (
            <span className="font-semibold text-green-600">&euro;{(order.total || 0).toFixed(2)}</span>
          )}
        </div>

        {/* Naslov */}
        {tracking.deliveryInfo && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">{tracking.deliveryInfo.address}</div>
              <div className="text-muted-foreground">{tracking.deliveryInfo.city} {tracking.deliveryInfo.postCode}</div>
              {tracking.deliveryInfo.deliveryInstructions && (
                <div className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {tracking.deliveryInfo.deliveryInstructions}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Voznik */}
        <div className="flex items-center gap-3 p-2 bg-accent/50 rounded-lg">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
            {(tracking.driverName || '?').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium">{tracking.driverName}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {tracking.driverPhone}
            </div>
          </div>
          <Button size="sm" variant="outline" className="h-7 w-7 p-0" aria-label="Pokliči voznika">
            <PhoneCall className="h-3 w-3" />
          </Button>
        </div>

        {/* Artikli */}
        {order && order.orderItems.length > 0 && (
          <div className="text-xs text-muted-foreground space-y-0.5">
            {order.orderItems.slice(0, 3).map(oi => (
              <div key={oi.id}>{oi.quantity}x {oi.menuItem.name}</div>
            ))}
            {order.orderItems.length > 3 && (
              <div>+{order.orderItems.length - 3} več</div>
            )}
          </div>
        )}

        {/* ETA */}
        {tracking.estimatedArrival && tracking.status !== 'delivered' && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>ETA: {format(new Date(tracking.estimatedArrival), 'HH:mm')}</span>
            {tracking.lastUpdateAt && (
              <span className="text-xs text-muted-foreground">
                (zadnja posodobitev: {format(new Date(tracking.lastUpdateAt), 'HH:mm')})
              </span>
            )}
          </div>
        )}

        {/* GPS indikator */}
        {tracking.currentLat && tracking.currentLng && (
          <div className="flex items-center gap-2 text-xs text-green-600">
            <Navigation className="h-3 w-3 animate-pulse" />
            GPS aktivno
          </div>
        )}

        {/* Ocena */}
        {tracking.status === 'delivered' && tracking.customerRating && (
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(i => (
              <Star key={i} className={`h-3 w-3 ${i <= (tracking.customerRating || 0) ? 'text-amber-400 fill-amber-400' : 'text-gray-500'}`} />
            ))}
            {tracking.customerFeedback && (
              <span className="text-xs text-muted-foreground ml-2">&ldquo;{tracking.customerFeedback}&rdquo;</span>
            )}
          </div>
        )}

        {/* Actions */}
        {nextStatus && (
          <Button
            size="sm"
            className="w-full"
            variant={nextStatus === 'delivered' ? 'default' : 'outline'}
            onClick={() => onUpdateStatus({ deliveryInfoId: tracking.deliveryInfoId, status: nextStatus })}
            disabled={isStatusUpdatePending}
          >
            <NextIcon className="h-3.5 w-3.5 mr-1" />
            {nextCfg?.label || nextStatus}
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  )
})
