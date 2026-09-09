'use client'

import { memo, useState } from 'react'
import { safeToFixed, safeNum } from '@/lib/safe-format'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
  // FIX TypeError: t?.filter is not a function — order.orderItems je lahko undefined
  // če API vrača partial podatke ali če order prihaja iz drugačnega vira.
  const orderItems = Array.isArray(order?.orderItems) ? order.orderItems : []
  // P2-UX FIX (opozorilo pred zaprtjem): zaključek NEPLAČANEGA naročila je
  // nepovraten ('completed' nima izhodnih prehodov) — zahteva potrditev.
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false)
  const nextStatusOfOrder = nextStatus[order.status]
  const needsCloseConfirmation =
    order.status !== 'completed' &&
    order.status !== 'cancelled' &&
    nextStatusOfOrder === 'completed' &&
    order.paymentStatus !== 'paid'
  // FIX RangeError: Invalid time value — order.createdAt je lahko undefined
  const formatTime = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '—'
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return '—'
      return format(d, 'MMM dd, HH:mm')
    } catch {
      return '—'
    }
  }
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">#{order.orderNumber}</p>
            <p className="text-xs text-muted-foreground">{formatTime(order.createdAt)}</p>
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
          {orderItems.slice(0, 3).map(oi => (
            <div key={oi.id} className="flex justify-between text-sm">
              <span>{oi.quantity}x {oi.menuItem?.name || 'Artikel'}</span>
              <span>€{(oi.price * oi.quantity).toFixed(2)}</span>
            </div>
          ))}
          {orderItems.length > 3 && <p className="text-xs text-muted-foreground">+{orderItems.length - 3} artiklov več</p>}
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <span className="font-bold">€{safeToFixed(order.total, 2)}</span>
          <div className="flex gap-1 flex-wrap justify-end">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onOrderClick(order)}>
              <Eye className="h-3 w-3 mr-1" />Poglej
            </Button>
            {order.status !== 'completed' && order.status !== 'cancelled' && nextStatus[order.status] && (
              <Button
                size="sm"
                variant="default"
                className="h-7 text-xs"
                onClick={() => {
                  // P2-UX FIX: zaključek neplačanega naročila → potrditveno okno
                  if (needsCloseConfirmation) {
                    setConfirmCloseOpen(true)
                  } else {
                    onUpdateOrderStatus({ id: order.id, status: nextStatus[order.status] })
                  }
                }}
                disabled={isStatusUpdatePending}
              >
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
        {/* P2-UX FIX: potrditev zaključka neplačanega naročila */}
        <AlertDialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Naročilo #{order.orderNumber} ni plačano</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2">
                  <p>
                    Zaključek naročila je <strong>nepovraten</strong> — po zaključku ga ni mogoče več odpreti (samo storno).
                    Stanje: <strong>{paymentStatusLabels[order.paymentStatus] || order.paymentStatus}</strong>, znesek: <strong>€{safeToFixed(order.total, 2)}</strong>.
                  </p>
                  <p className="text-muted-foreground">Ste prepričani, da želite zaključiti neplačano naročilo?</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Prekliči — raje plačaj</AlertDialogCancel>
              <AlertDialogAction
                className="bg-amber-600 hover:bg-amber-700"
                onClick={() => onUpdateOrderStatus({ id: order.id, status: nextStatusOfOrder })}
              >
                Vseeno zaključi
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
})
