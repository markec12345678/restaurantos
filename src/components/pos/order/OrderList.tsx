'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { OrderDetailDialog } from './OrderDetailDialog'
import { OrderCard } from './OrderCard'

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
  orders: OrderType[] | undefined
  ordersLoading: boolean
  orderListTab: string
  setOrderListTab: (_tab: string) => void
  statusColors: Record<string, string>
  statusLabels: Record<string, string>
  nextStatus: Record<string, string>
  paymentStatusLabels: Record<string, string>
  paymentStatusColors: Record<string, string>
  onUpdateOrderStatus: (_params: { id: string; status: string }) => void
  isStatusUpdatePending: boolean
  onOrderClick: (_order: OrderType) => void
  onPayOrder: (_order: OrderType) => void
  onPrintReceipt: (_order: OrderType) => void
  onStornoOrder: (_order: OrderType) => void
  onAddToOrder: (_order: OrderType) => void
  onVoidItem: (_item: { id: string; name: string; quantity: number; price: number; vatRate: number; voided: boolean; orderId: string }) => void
  detailOrder: OrderType | null
  setDetailOrder: (_order: OrderType | null) => void
}

// ============================================
// ORDER LIST - Seznam naročil
// ============================================
export function OrderList({
  orders, ordersLoading, orderListTab, setOrderListTab,
  statusColors, statusLabels, nextStatus, paymentStatusLabels, paymentStatusColors,
  onUpdateOrderStatus, isStatusUpdatePending, onOrderClick, onPayOrder, onPrintReceipt,
  onStornoOrder, onAddToOrder, onVoidItem, detailOrder, setDetailOrder,
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
              <OrderCard
                key={order.id} order={order}
                statusColors={statusColors} statusLabels={statusLabels} nextStatus={nextStatus}
                paymentStatusLabels={paymentStatusLabels} paymentStatusColors={paymentStatusColors}
                isStatusUpdatePending={isStatusUpdatePending}
                onOrderClick={onOrderClick} onUpdateOrderStatus={onUpdateOrderStatus}
                onPayOrder={onPayOrder} onPrintReceipt={onPrintReceipt}
                onStornoOrder={onStornoOrder} onAddToOrder={onAddToOrder}
              />
            ))}
            {(!orders || orders.length === 0) && (
              <div className="col-span-full text-center py-12 text-muted-foreground">Ni najdenih naročil</div>
            )}
          </div>
        )}
      </div>
      <OrderDetailDialog
        detailOrder={detailOrder} setDetailOrder={setDetailOrder}
        statusColors={statusColors} statusLabels={statusLabels}
        paymentStatusLabels={paymentStatusLabels} paymentStatusColors={paymentStatusColors}
        onVoidItem={onVoidItem}
      />
    </div>
  )
}
