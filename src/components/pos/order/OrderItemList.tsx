'use client'

import { memo } from 'react'
import dynamic from 'next/dynamic'
import { STATUS_COLORS, NEXT_STATUS, STATUS_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS } from './constants'
import type { OrderType } from './OrderList'

// Lazy-loaded podkomponenta
const OrderList = dynamic(() => import('./OrderList').then(m => ({ default: m.OrderList })), { ssr: false })

// ============================================
// ORDER ITEM LIST — Seznam naročil podkomponenta
// ============================================

interface OrderItemListProps {
  orders: OrderType[] | undefined
  ordersLoading: boolean
  orderListTab: string
  setOrderListTab: (_tab: string) => void
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

export const OrderItemList = memo(function OrderItemList({
  orders,
  ordersLoading,
  orderListTab,
  setOrderListTab,
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
}: OrderItemListProps) {
  const statusColors = STATUS_COLORS
  const nextStatus = NEXT_STATUS
  const statusLabels = STATUS_LABELS
  const paymentStatusLabels = PAYMENT_STATUS_LABELS
  const paymentStatusColors = PAYMENT_STATUS_COLORS

  return (
    <OrderList
      orders={orders}
      ordersLoading={ordersLoading}
      orderListTab={orderListTab}
      setOrderListTab={setOrderListTab}
      statusColors={statusColors}
      statusLabels={statusLabels}
      nextStatus={nextStatus}
      paymentStatusLabels={paymentStatusLabels}
      paymentStatusColors={paymentStatusColors}
      onUpdateOrderStatus={onUpdateOrderStatus}
      isStatusUpdatePending={isStatusUpdatePending}
      onOrderClick={onOrderClick}
      onPayOrder={onPayOrder}
      onPrintReceipt={onPrintReceipt}
      onStornoOrder={onStornoOrder}
      onAddToOrder={onAddToOrder}
      onVoidItem={onVoidItem}
      detailOrder={detailOrder}
      setDetailOrder={setDetailOrder}
    />
  )
})
