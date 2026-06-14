'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Eye, CreditCard, Printer, Plus, FileWarning } from 'lucide-react'
import { format } from 'date-fns'
import { OrderDetailDialog } from './OrderDetailDialog'

// ============================================
// TIPI
// ============================================
export interface OrderItemType {
  id: string
  menuItem: { name: string; image: string }
  quantity: number
  price: number
  notes: string
  status: string
  modifiersJson?: string
  voided?: boolean
  vatRate?: number
}

export interface OrderType {
  id: string
  orderNumber: number
  type: string
  status: string
  total: number
  customerName: string
  paymentStatus: string
  paymentMethod: string
  createdAt: string
  table?: { number: number }
  orderItems: OrderItemType[]
  subtotal?: number
  tax?: number
  discount?: number
  cancelReason?: string
  cancelledAt?: string
  cancelledBy?: string
}

export interface OrderListProps {
  // Podatki
  orders: OrderType[] | undefined
  ordersLoading: boolean
  // Status filter
  orderListTab: string
  setOrderListTab: (_tab: string) => void
  // Status mape
  statusColors: Record<string, string>
  statusLabels: Record<string, string>
  nextStatus: Record<string, string>
  paymentStatusLabels: Record<string, string>
  paymentStatusColors: Record<string, string>
  // Handlerji
  onUpdateOrderStatus: (_params: { id: string; status: string }) => void
  isStatusUpdatePending: boolean
  onOrderClick: (_order: OrderType) => void
  onPayOrder: (_order: OrderType) => void
  onPrintReceipt: (_order: OrderType) => void
  onStornoOrder: (_order: OrderType) => void
  onAddToOrder: (_order: OrderType) => void
  onVoidItem: (_item: { id: string; name: string; quantity: number; price: number; vatRate: number; voided: boolean; orderId: string }) => void
  // Detail dialog
  detailOrder: OrderType | null
  setDetailOrder: (_order: OrderType | null) => void
}

// ============================================
// ORDER LIST - Seznam naročil
// ============================================
export function OrderList({
  orders,
  ordersLoading,
  orderListTab,
  setOrderListTab,
  statusColors,
  statusLabels,
  nextStatus,
  paymentStatusLabels,
  paymentStatusColors,
  onUpdateOrderStatus,
  isStatusUpdatePending,
  onOrderClick,
  onPayOrder,
  onPrintReceipt,
  onStornoOrder,
  onAddToOrder,
  onVoidItem,
  detailOrder,
  setDetailOrder,
}: OrderListProps) {
  return (
    <div className="h-full overflow-y-auto p-4 custom-scrollbar">
      <div className="space-y-4">
        <Tabs value={orderListTab} onValueChange={setOrderListTab}>
          <TabsList>
            <TabsTrigger value="all">Vse</TabsTrigger>
            <TabsTrigger value="pending">Čakajoče</TabsTrigger>
            <TabsTrigger value="in-progress">V obdelavi</TabsTrigger>
            <TabsTrigger value="ready">Pripravljeno</TabsTrigger>
            <TabsTrigger value="completed">Zaključeno</TabsTrigger>
            <TabsTrigger value="cancelled" className="text-red-600">Preklicano</TabsTrigger>
          </TabsList>
        </Tabs>
        {ordersLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(orders || []).map((order) => (
              <Card key={order.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">#{order.orderNumber}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(order.createdAt), 'MMM dd, HH:mm')}</p>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      <Badge variant="outline" className={statusColors[order.status] || ''}>{statusLabels[order.status] || order.status}</Badge>
                      {(order.paymentStatus === 'paid' || order.paymentStatus === 'storno') && (
                        <Badge variant="outline" className={paymentStatusColors[order.paymentStatus] || ''}>
                          {paymentStatusLabels[order.paymentStatus] || order.paymentStatus}
                        </Badge>
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
                      {/* Storno/Preklic gumb */}
                      {order.status !== 'cancelled' && order.paymentStatus !== 'storno' && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => onStornoOrder(order)}>
                          <FileWarning className="h-3 w-3 mr-1" />{order.paymentStatus === 'paid' ? 'Storno' : 'Prekliči'}
                        </Button>
                      )}
                      {/* Pregled storniranega naročila */}
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
            ))}
            {(!orders || orders.length === 0) && (
              <div className="col-span-full text-center py-12 text-muted-foreground">Ni najdenih naročil</div>
            )}
          </div>
        )}
      </div>

      {/* ORDER DETAIL DIALOG */}
      <OrderDetailDialog
        detailOrder={detailOrder}
        setDetailOrder={setDetailOrder}
        statusColors={statusColors}
        statusLabels={statusLabels}
        paymentStatusLabels={paymentStatusLabels}
        paymentStatusColors={paymentStatusColors}
        onVoidItem={onVoidItem}
      />
    </div>
  )
}
