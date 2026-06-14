'use client'

// ============================================
// DETAIL DIALOG ZA ONLINE NAROČILO
// ============================================

import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { onlineStatusLabels, onlineStatusColors } from './constants'
import type { OnlineOrderDetailDialogProps } from './constants'

export const OnlineOrderDetailDialog = memo(function OnlineOrderDetailDialog({
  open,
  onOpenChange,
  order,
}: OnlineOrderDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent tabIndex={-1}>
        <DialogHeader>
          <DialogTitle>Naročilo #{order?.orderNumber}</DialogTitle>
        </DialogHeader>
        {order && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Badge className={onlineStatusColors[order.status] || 'bg-gray-100 text-gray-600'}>
                {onlineStatusLabels[order.status] || order.status}
              </Badge>
              <span className="text-muted-foreground">{new Date(order.createdAt).toLocaleString('sl-SI')}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><span className="font-medium">Stranka:</span> {order.customerName || '—'}</div>
              <div><span className="font-medium">Telefon:</span> {order.customerPhone || '—'}</div>
              <div><span className="font-medium">Tip:</span> {order.type}</div>
              <div><span className="font-medium">Plačilo:</span> {order.paymentMethod} ({order.paymentStatus})</div>
            </div>
            {order.orderItems.length > 0 && (
              <div>
                <span className="font-medium">Artikli:</span>
                <ul className="mt-1 space-y-1">
                  {order.orderItems.map((item) => (
                    <li key={item.id} className="flex justify-between">
                      <span>{item.quantity}x {item.menuItemId}</span>
                      <span>€{(item.price * item.quantity).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="border-t pt-2 flex justify-between font-medium">
              <span>Skupaj:</span>
              <span>€{order.total.toFixed(2)}</span>
            </div>
            {order.notes && (
              <div className="bg-muted p-2 rounded text-xs">{order.notes}</div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
})
