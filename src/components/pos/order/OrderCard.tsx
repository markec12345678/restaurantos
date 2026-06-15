'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Eye, CreditCard, Printer, Plus, FileWarning } from 'lucide-react'
import { format } from 'date-fns'
import type { OrderType as OrderListOrderType } from './OrderList'

// ============================================
// ORDER CARD — Posamezna kartica naročila
// ============================================

interface OrderCardProps {
  order: OrderListOrderType
  statusColors: Record<string, string>
  statusLabels: Record<string, string>
  nextStatus: Record<string, string>
  paymentStatusLabels: Record<string, string>
  paymentStatusColors: Record<string, string>
  isStatusUpdatePending: boolean
  onOrderClick: (_order: OrderListOrderType) => void
  onUpdateOrderStatus: (_params: { id: string; status: string }) => void
  onPayOrder: (_order: OrderListOrderType) => void
  onPrintReceipt: (_order: OrderListOrderType) => void
  onStornoOrder: (_order: OrderListOrderType) => void
  onAddToOrder: (_order: OrderListOrderType) => void
}

export const OrderCard = memo(function OrderCard({
  order, statusColors, statusLabels, nextStatus, paymentStatusLabels, paymentStatusColors,
  isStatusUpdatePending, onOrderClick, onUpdateOrderStatus, onPayOrder, onPrintReceipt, onStornoOrder, onAddToOrder,
}: OrderCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">#{order.orderNumber}</p>
            <p className="text-xs text-muted-foreground">{format(new Date(order.createdAt), 'MMM dd, HH:mm')}</p>
          </div>
          <div className="flex gap-1 flex-wrap">
            <Badge variant="outline" className={statusColors[order.status] || ''}>{statusLabels[order.status] || order.status}</Badge>
            {(order.paymentStatus === 'paid' || order.paymentStatus === 'storno') && (
              <Badge variant="outline" className={paymentStatusColors[order.paymentStatus] || ''}>{paymentStatusLabels[order.paymentStatus] || order.paymentStatus}</Badge>
            )}
          </div>
        </div>
        <div className="text-sm">
          <p>{order.customerName || 'Hodič'} · {order.type === 'dine-in' ? 'Na mestu' : order.type === 'takeout' ? 'Za s seboj' : 'Dostava'}</p>
          {order.table && <p className="text-muted-foreground">Miza {order.table.number}</p>}
        </div>
        <div className="space-y-1">
          {order.orderItems.slice(0, 3).map(oi => (
            <div key={oi.id} className="flex justify-between text-sm">
              <span>{oi.quantity}x {oi.menuItem.name}</span>
              <span>€{(oi.price * oi.quantity).toFixed(2)}</span>
            </div>
          ))}
          {order.orderItems.length > 3 && <p className="text-xs text-muted-foreground">+{order.orderItems.length - 3} artiklov več</p>}
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <span className="font-bold">€{order.total.toFixed(2)}</span>
          <div className="flex gap-1 flex-wrap justify-end">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onOrderClick(order)}>
              <Eye className="h-3 w-3 mr-1" />Poglej
            </Button>
            {order.status !== 'completed' && order.status !== 'cancelled' && nextStatus[order.status] && (
              <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => onUpdateOrderStatus({ id: order.id, status: nextStatus[order.status] })} disabled={isStatusUpdatePending}>
                → {statusLabels[nextStatus[order.status]]}
              </Button>
            )}
            {order.paymentStatus !== 'paid' && order.status !== 'cancelled' && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onPayOrder(order)}>
                <CreditCard className="h-3 w-3 mr-1" />Plačaj
              </Button>
            )}
            {order.paymentStatus === 'paid' && (
              <Button size="sm" variant="default" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => onPrintReceipt(order)}>
                <Printer className="h-3 w-3 mr-1" />Tiskaj račun
              </Button>
            )}
            {order.status !== 'cancelled' && order.paymentStatus !== 'storno' && (
              <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => onStornoOrder(order)}>
                <FileWarning className="h-3 w-3 mr-1" />{order.paymentStatus === 'paid' ? 'Storno' : 'Prekliči'}
              </Button>
            )}
            {(order.status === 'cancelled' || order.paymentStatus === 'storno') && (
              <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 text-[10px]">
                {order.paymentStatus === 'storno' ? 'STORNO' : 'PREKLICANO'}
              </Badge>
            )}
            {order.status !== 'completed' && order.status !== 'cancelled' && order.paymentStatus !== 'paid' && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onAddToOrder(order)}>
                <Plus className="h-3 w-3 mr-1" />Dodaj
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
})
