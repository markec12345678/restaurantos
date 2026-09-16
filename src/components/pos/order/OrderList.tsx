'use client'

import { memo, useState, useMemo } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatEUR } from '@/lib/safe-format'
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
  // P2-UX (stale order): optimistic locking — API (Prisma) vrača updatedAt,
  // plačilni potek ga pošlje kot expectedUpdatedAt
  updatedAt?: string
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
export const OrderList = memo(function OrderList({
  orders, ordersLoading, orderListTab, setOrderListTab,
  statusColors, statusLabels, nextStatus, paymentStatusLabels, paymentStatusColors,
  onUpdateOrderStatus, isStatusUpdatePending, onOrderClick, onPayOrder, onPrintReceipt,
  onStornoOrder, onAddToOrder, onVoidItem, detailOrder, setDetailOrder,
}: OrderListProps) {
  // NOVA FUNKCIONALNOST (runda 6): iskanje po seznamu naročil — po številki
  // naročila (#58 ali "58"), imenu stranke, mizi ("miza 3") in znesku ("15,66").
  // Client-side: API vrne do 500 naročil (BULK limit), filtriranje je takojšnje.
  const [search, setSearch] = useState('')

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return orders || []
    const digits = q.replace(/^#/, '').replace(',', '.')
    return (orders || []).filter(o => {
      if (digits !== '' && String(o.orderNumber).includes(digits)) return true
      if (o.customerName?.toLowerCase().includes(q)) return true
      if (o.table?.number && String(o.table.number).includes(digits)) return true
      if (String(o.total ?? '').includes(digits)) return true
      return false
    })
  }, [orders, search])

  // Hitri povzetek filtriranih naročil — koliko jih je + vsota zneskov
  const summary = useMemo(() => {
    const sum = filteredOrders.reduce((acc, o) => acc + (o.total || 0), 0)
    return { count: filteredOrders.length, sum }
  }, [filteredOrders])

  return (
    <div className="h-full overflow-y-auto p-4 custom-scrollbar">
      <div className="space-y-4">
        {/* Iskalna vrstica + povzetek */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Išči: #58, stranka, miza, znesek..."
              className="pl-8 h-9 pr-8"
              aria-label="Iskanje naročil"
              inputMode="search"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Počisti iskanje"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {(orders?.length ?? 0) > 0 && (
            <p className="text-xs text-muted-foreground sm:ml-auto" aria-live="polite">
              {summary.count} naročil · vsota {formatEUR(summary.sum)}
            </p>
          )}
        </div>
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
            {filteredOrders.map((order) => (
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
            {filteredOrders.length === 0 && (orders?.length ?? 0) > 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                Ni zadetkov za „{search}“
              </div>
            )}
            {(orders?.length ?? 0) === 0 && (
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
})
