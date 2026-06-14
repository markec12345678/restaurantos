'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Eye, CreditCard, Printer, Plus, FileWarning, XCircle, ImageIcon } from 'lucide-react'
import { format } from 'date-fns'

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

      {/* ============================================
           ORDER DETAIL DIALOG
           ============================================ */}
      <Dialog open={!!detailOrder} onOpenChange={(open) => !open && setDetailOrder(null)}>
        <DialogContent className="max-w-lg" tabIndex={-1}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Naročilo #{detailOrder?.orderNumber || ''}
              <Badge variant="outline" className={statusColors[detailOrder?.status || ''] || ''}>
                {statusLabels[detailOrder?.status || ''] || detailOrder?.status || ''}
              </Badge>
              {(detailOrder?.paymentStatus === 'paid' || detailOrder?.paymentStatus === 'storno') && (
                <Badge variant="outline" className={paymentStatusColors[detailOrder?.paymentStatus || ''] || ''}>
                  {paymentStatusLabels[detailOrder?.paymentStatus || ''] || detailOrder?.paymentStatus || ''}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Storno/Preklic opozorilo */}
            {(detailOrder?.status === 'cancelled' || detailOrder?.paymentStatus === 'storno') && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 space-y-1">
                <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                  {detailOrder?.paymentStatus === 'storno' ? 'Stornirano naročilo' : 'Preklicano naročilo'}
                </p>
                {Boolean(detailOrder?.cancelReason) && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Razlog: {detailOrder?.cancelReason}
                  </p>
                )}
                {Boolean(detailOrder?.cancelledAt) && (
                  <p className="text-xs text-red-600/70 dark:text-red-400/70">
                    Preklicano: {format(new Date(detailOrder?.cancelledAt || ''), 'dd.MM.yyyy HH:mm')}
                  </p>
                )}
                {Boolean(detailOrder?.cancelledBy) && (
                  <p className="text-xs text-red-600/70 dark:text-red-400/70">
                    Preklical/a: {detailOrder?.cancelledBy}
                  </p>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-muted-foreground">Stranka</p><p className="font-medium">{detailOrder?.customerName || 'Hodič'}</p></div>
              <div><p className="text-muted-foreground">Vrsta</p><p className="font-medium">{detailOrder?.type === 'dine-in' ? 'Na mestu' : detailOrder?.type === 'takeout' ? 'Za s seboj' : 'Dostava'}</p></div>
              <div><p className="text-muted-foreground">Miza</p><p className="font-medium">{detailOrder?.table ? `Miza ${detailOrder.table.number}` : 'Brez'}</p></div>
              <div>
                <p className="text-muted-foreground">Plačilo</p>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className={paymentStatusColors[detailOrder?.paymentStatus || ''] || 'bg-yellow-100 text-yellow-800'}>
                    {paymentStatusLabels[detailOrder?.paymentStatus || ''] || 'Neplačano'}
                  </Badge>
                  {Boolean(detailOrder?.paymentMethod) && <span className="text-xs text-muted-foreground uppercase">{detailOrder?.paymentMethod}</span>}
                </div>
              </div>
              <div><p className="text-muted-foreground">Čas</p><p className="font-medium">{detailOrder?.createdAt ? format(new Date(detailOrder.createdAt), 'MMM dd, yyyy HH:mm') : 'Brez'}</p></div>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-semibold">Artikli</p>
              {(detailOrder?.orderItems || []).map(oi => (
                <div key={oi.id} className={`flex items-start justify-between text-sm py-1 gap-2 ${oi.voided ? 'opacity-40 line-through' : ''}`}>
                  <div className="flex items-start gap-2 flex-1">
                    {oi.menuItem.image ? (
                      <div className="w-9 h-9 rounded-md overflow-hidden flex-shrink-0">
                        <img src={oi.menuItem.image} alt={oi.menuItem.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-md bg-muted flex-shrink-0 flex items-center justify-center">
                        <ImageIcon className="h-3.5 w-3.5 text-muted-foreground/50" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{oi.quantity}x {oi.menuItem.name}</span>
                        <Badge variant="outline" className={`text-[10px] h-4 capitalize ${oi.voided ? 'bg-red-100 text-red-800' : ''}`}>{oi.voided ? 'VOID' : oi.status}</Badge>
                      </div>
                      {oi.modifiersJson && (() => {
                        try {
                          const mods = JSON.parse(oi.modifiersJson)
                          if (mods.length > 0) return (
                            <div className="flex flex-wrap gap-0.5 mt-0.5">
                              {mods.map((m: { name: string; price: number }, mi: number) => (
                                <Badge key={mi} variant="outline" className="text-[9px] h-3.5 px-1 py-0">{m.name}{m.price > 0 ? ` +€${m.price.toFixed(2)}` : ''}</Badge>
                              ))}
                            </div>
                          )
                        } catch {
                          // Neveljavni podatki o alergenih — prikaži brez alergenov
                        }
                        return null
                      })()}
                      {oi.notes && <p className="text-xs text-muted-foreground italic mt-0.5">{oi.notes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="font-medium">€{(oi.price * oi.quantity).toFixed(2)}</span>
                    {!oi.voided && detailOrder?.paymentStatus !== 'paid' && detailOrder?.status !== 'cancelled' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Storniraj"
                        className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          onVoidItem({
                            id: oi.id,
                            name: oi.menuItem.name,
                            quantity: oi.quantity,
                            price: oi.price,
                            vatRate: oi.vatRate || 22.0,
                            voided: false,
                            orderId: detailOrder?.id || '',
                          })
                        }}
                        title="Void artikla"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Separator />
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Vmesna vsota</span><span>€{(detailOrder?.subtotal || 0).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Davek</span><span>€{(detailOrder?.tax || 0).toFixed(2)}</span></div>
              {Number(detailOrder?.discount || 0) > 0 && <div className="flex justify-between text-emerald-600"><span>Popust</span><span>-€{(detailOrder?.discount || 0).toFixed(2)}</span></div>}
              <div className="flex justify-between font-bold"><span>Skupaj</span><span>€{(detailOrder?.total || 0).toFixed(2)}</span></div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
