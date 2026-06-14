'use client'

// ============================================
// KARTICA ONLINE NAROČILA
// ============================================

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Phone, ShoppingCart } from 'lucide-react'
import { onlineStatusLabels, onlineStatusColors, getNextOnlineStatus, onlineAdvanceLabel } from './constants'
import type { OnlineOrderCardProps } from './constants'

export const OnlineOrderCard = memo(function OnlineOrderCard({
  order,
  onNextStatus,
  onShowDetail,
}: OnlineOrderCardProps) {
  const nextStatus = getNextOnlineStatus(order.status)

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 text-blue-700 font-bold text-sm">
              #{order.orderNumber}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{order.customerName || 'Gost'}</span>
                <Badge variant="outline" className="text-[10px]">
                  {order.type === 'delivery' ? 'Dostava' : 'Prevzem'}
                </Badge>
                <Badge className={onlineStatusColors[order.status] || ''}>
                  {onlineStatusLabels[order.status] || order.status}
                </Badge>
                <Badge variant={order.paymentStatus === 'paid' ? 'default' : 'secondary'} className={order.paymentStatus === 'paid' ? 'bg-green-600' : ''}>
                  {order.paymentStatus === 'paid' ? 'Plačano' : 'Čaka plačilo'}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{order.customerPhone}</span>
                <span>{order.orderItems?.length || 0} artiklov</span>
                <span className="font-semibold text-blue-700">€{order.total.toFixed(2)}</span>
                <span>{new Date(order.createdAt).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {nextStatus && (
              <Button size="sm" onClick={() => onNextStatus(order.id, nextStatus)} aria-label={onlineAdvanceLabel(order.status)}>
                {onlineAdvanceLabel(order.status)}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => onShowDetail(order)} aria-label="Podrobnosti naročila">
              <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Podrobnosti
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})
