'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usePOSStore, CartItemType } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Minus, Trash2, ShoppingBag, CreditCard, Banknote, Smartphone, StickyNote, X, Printer, Eye, Clock, ImageIcon } from 'lucide-react'
import { useState, useRef } from 'react'
import { format } from 'date-fns'

export function OrderPanel() {
  const {
    cart, addToCart, removeFromCart, updateCartQuantity, updateCartNotes, clearCart,
    cartTotal, orderType, setOrderType, selectedTable, setSelectedTable,
    discount, setDiscount, taxRate,
  } = usePOSStore()
  const queryClient = useQueryClient()
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [orderListTab, setOrderListTab] = useState('all')
  const [selectedOrder, setSelectedOrder] = useState<Record<string, unknown> | null>(null)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [detailOrder, setDetailOrder] = useState<Record<string, unknown> | null>(null)
  const [receiptOrder, setReceiptOrder] = useState<Record<string, unknown> | null>(null)
  const receiptRef = useRef<HTMLDivElement>(null)

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await fetch('/api/categories')
      return res.json()
    },
  })

  const { data: menuItems, isLoading: menuLoading } = useQuery({
    queryKey: ['menu-items'],
    queryFn: async () => {
      const res = await fetch('/api/menu-items')
      return res.json()
    },
  })

  const { data: tables } = useQuery({
    queryKey: ['tables'],
    queryFn: async () => {
      const res = await fetch('/api/tables')
      return res.json()
    },
  })

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['orders', orderListTab],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (orderListTab !== 'all') params.set('status', orderListTab)
      const res = await fetch(`/api/orders?${params}`)
      return res.json()
    },
  })

  const placeOrderMutation = useMutation({
    mutationFn: async () => {
      const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: orderType,
          tableId: orderType === 'dine-in' ? selectedTable : null,
          customerName,
          customerPhone,
          discount,
          taxRate,
          notes: orderNotes,
          orderItems: cart.map(item => ({
            menuItemId: item.id,
            quantity: item.quantity,
            price: item.price,
            notes: item.notes,
          })),
        }),
      })
      if (!res.ok) throw new Error('Failed to place order')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Order placed successfully!')
      clearCart()
      setCustomerName('')
      setCustomerPhone('')
      setOrderNotes('')
      setDiscount(0)
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['tables'] })
    },
    onError: () => {
      toast.error('Failed to place order')
    },
  })

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Failed to update order')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Order status updated')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['tables'] })
    },
  })

  const processPaymentMutation = useMutation({
    mutationFn: async ({ id, method }: { id: string; method: string }) => {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: 'paid', paymentMethod: method }),
      })
      if (!res.ok) throw new Error('Failed to process payment')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Payment processed successfully!')
      setPaymentDialogOpen(false)
      setSelectedOrder(null)
      setPaymentMethod('')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const filteredMenuItems = menuItems?.filter(
    (item: { categoryId: string; isAvailable: boolean }) =>
      (activeCategory === 'all' || item.categoryId === activeCategory) && item.isAvailable
  ) || []

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const tax = subtotal * taxRate
  const total = subtotal + tax - discount

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    'in-progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    ready: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    completed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  }

  const nextStatus: Record<string, string> = {
    pending: 'in-progress',
    'in-progress': 'ready',
    ready: 'completed',
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Orders</h2>
        <p className="text-muted-foreground">Create and manage orders</p>
      </div>

      <Tabs defaultValue="new-order" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="new-order">New Order</TabsTrigger>
          <TabsTrigger value="order-list">Order List</TabsTrigger>
        </TabsList>

        {/* New Order Tab */}
        <TabsContent value="new-order">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left: Menu Items */}
            <div className="lg:col-span-2 space-y-4">
              {/* Order type & table */}
              <div className="flex flex-wrap gap-3 items-center">
                <Select value={orderType} onValueChange={setOrderType}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dine-in">Dine-in</SelectItem>
                    <SelectItem value="takeaway">Takeaway</SelectItem>
                    <SelectItem value="delivery">Delivery</SelectItem>
                  </SelectContent>
                </Select>

                {orderType === 'dine-in' && (
                  <Select value={selectedTable || ''} onValueChange={setSelectedTable}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Select table" />
                    </SelectTrigger>
                    <SelectContent>
                      {tables?.filter((t: { status: string }) => t.status === 'available' || t.status === 'occupied').map((table: { id: string; number: number; capacity: number }) => (
                        <SelectItem key={table.id} value={table.id}>
                          Table {table.number} ({table.capacity} seats)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Category Pills */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={activeCategory === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveCategory('all')}
                >
                  All
                </Button>
                {categories?.map((cat: { id: string; name: string; icon: string }) => (
                  <Button
                    key={cat.id}
                    variant={activeCategory === cat.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveCategory(cat.id)}
                  >
                    {cat.icon} {cat.name}
                  </Button>
                ))}
              </div>

              {/* Menu Items Grid */}
              {menuLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {[...Array(8)].map((_, i) => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filteredMenuItems.map((item: { id: string; name: string; price: number; description: string; image: string }) => {
                    const inCart = cart.find((c) => c.id === item.id)
                    return (
                      <button
                        key={item.id}
                        onClick={() => addToCart({ id: item.id, name: item.name, price: item.price, categoryId: item.categoryId || '', image: item.image || '' })}
                        className="relative flex flex-col items-start p-2 rounded-lg border border-border bg-card hover:bg-accent transition-colors text-left overflow-hidden group"
                      >
                        {inCart && (
                          <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs z-10">
                            {inCart.quantity}
                          </Badge>
                        )}
                        {/* Item Image */}
                        <div className="w-full aspect-[4/3] rounded-md overflow-hidden mb-2 bg-muted/50 relative">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-cover transition-transform group-hover:scale-105"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = 'none'
                                target.nextElementSibling?.classList.remove('hidden')
                              }}
                            />
                          ) : null}
                          <div className={`absolute inset-0 flex items-center justify-center ${item.image ? 'hidden' : ''}`}>
                            <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                          </div>
                        </div>
                        <span className="font-medium text-sm leading-tight">{item.name}</span>
                        <span className="text-primary font-bold text-sm mt-0.5">${item.price.toFixed(2)}</span>
                        {item.description && (
                          <span className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.description}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Right: Cart */}
            <Card className="h-fit">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4" />
                    Cart
                  </CardTitle>
                  {cart.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearCart} className="text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Cart Items */}
                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                  {cart.length === 0 && (
                    <p className="text-center text-muted-foreground text-sm py-6">Cart is empty</p>
                  )}
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-start gap-2 p-2 rounded-md bg-muted/50">
                      {/* Cart item thumbnail */}
                      {item.image ? (
                        <div className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0">
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-md bg-muted flex-shrink-0 flex items-center justify-center">
                          <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">${item.price.toFixed(2)} each</p>
                        {item.notes && <p className="text-xs text-primary italic mt-0.5">📝 {item.notes}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={() => removeFromCart(item.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-sm font-semibold w-16 text-right">
                        ${(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Customer Info */}
                <div className="space-y-2">
                  <Input
                    placeholder="Customer name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Input
                    placeholder="Phone number"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Input
                    placeholder="Order notes"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>

                {/* Discount */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Discount ($)</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discount || ''}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    className="h-8 w-24 text-sm"
                  />
                </div>

                <Separator />

                {/* Totals */}
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax (10%)</span>
                    <span>${tax.toFixed(2)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount</span>
                      <span>-${discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base pt-1">
                    <span>Total</span>
                    <span>${Math.max(0, total).toFixed(2)}</span>
                  </div>
                </div>

                <Button
                  className="w-full"
                  disabled={cart.length === 0 || placeOrderMutation.isPending}
                  onClick={() => placeOrderMutation.mutate()}
                >
                  {placeOrderMutation.isPending ? 'Placing...' : 'Place Order'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Order List Tab */}
        <TabsContent value="order-list">
          <div className="space-y-4">
            <Tabs value={orderListTab} onValueChange={setOrderListTab}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="in-progress">In Progress</TabsTrigger>
                <TabsTrigger value="ready">Ready</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
              </TabsList>
            </Tabs>

            {ordersLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-40" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {(orders || []).map((order: {
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
                  orderItems: { id: string; menuItem: { name: string }; quantity: number; price: number }[]
                }) => (
                  <Card key={order.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">#{order.orderNumber}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(order.createdAt), 'MMM dd, HH:mm')}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Badge variant="outline" className={statusColors[order.status]}>
                            {order.status}
                          </Badge>
                          {order.paymentStatus === 'paid' && (
                            <Badge variant="outline" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                              Paid
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="text-sm">
                        <p>{order.customerName || 'Walk-in'} · {order.type}</p>
                        {order.table && <p className="text-muted-foreground">Table {order.table.number}</p>}
                      </div>

                      <div className="space-y-1">
                        {order.orderItems.slice(0, 3).map((oi) => (
                          <div key={oi.id} className="flex justify-between text-sm">
                            <span>{oi.quantity}x {oi.menuItem.name}</span>
                            <span>${(oi.price * oi.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                        {order.orderItems.length > 3 && (
                          <p className="text-xs text-muted-foreground">+{order.orderItems.length - 3} more items</p>
                        )}
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between">
                        <span className="font-bold">${order.total.toFixed(2)}</span>
                        <div className="flex gap-1 flex-wrap justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => setDetailOrder(order)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                          {order.status !== 'completed' && order.status !== 'cancelled' && nextStatus[order.status] && (
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 text-xs"
                              onClick={() => updateOrderStatusMutation.mutate({ id: order.id, status: nextStatus[order.status] })}
                              disabled={updateOrderStatusMutation.isPending}
                            >
                              → {nextStatus[order.status]}
                            </Button>
                          )}
                          {order.paymentStatus !== 'paid' && order.status !== 'cancelled' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => {
                                setSelectedOrder(order)
                                setPaymentDialogOpen(true)
                              }}
                            >
                              <CreditCard className="h-3 w-3 mr-1" />
                              Pay
                            </Button>
                          )}
                          {order.paymentStatus === 'paid' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => setReceiptOrder(order)}
                            >
                              <Printer className="h-3 w-3 mr-1" />
                              Receipt
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {(!orders || orders.length === 0) && (
                  <div className="col-span-full text-center py-12 text-muted-foreground">
                    No orders found
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Payment Dialog */}
          <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Process Payment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-2xl font-bold text-center">
                  ${((selectedOrder?.total as number) || 0).toFixed(2)}
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <Button
                    variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                    className="flex flex-col gap-1 h-auto py-3"
                    onClick={() => setPaymentMethod('cash')}
                  >
                    <Banknote className="h-5 w-5" />
                    <span className="text-xs">Cash</span>
                  </Button>
                  <Button
                    variant={paymentMethod === 'card' ? 'default' : 'outline'}
                    className="flex flex-col gap-1 h-auto py-3"
                    onClick={() => setPaymentMethod('card')}
                  >
                    <CreditCard className="h-5 w-5" />
                    <span className="text-xs">Card</span>
                  </Button>
                  <Button
                    variant={paymentMethod === 'upi' ? 'default' : 'outline'}
                    className="flex flex-col gap-1 h-auto py-3"
                    onClick={() => setPaymentMethod('upi')}
                  >
                    <Smartphone className="h-5 w-5" />
                    <span className="text-xs">UPI</span>
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
                <Button
                  disabled={!paymentMethod || processPaymentMutation.isPending}
                  onClick={() => {
                    if (selectedOrder?.id && paymentMethod) {
                      processPaymentMutation.mutate({ id: selectedOrder.id as string, method: paymentMethod })
                    }
                  }}
                >
                  Confirm Payment
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Order Detail Dialog */}
          <Dialog open={!!detailOrder} onOpenChange={(open) => !open && setDetailOrder(null)}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Order #{(detailOrder?.orderNumber as number) || ''}
                  <Badge variant="outline" className={statusColors[(detailOrder?.status as string) || ''] || ''}>
                    {String(detailOrder?.status || '')}
                  </Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Order Info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Customer</p>
                    <p className="font-medium">{String(detailOrder?.customerName || 'Walk-in')}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Type</p>
                    <p className="font-medium capitalize">{String(detailOrder?.type || '')}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Table</p>
                    <p className="font-medium">{detailOrder?.table ? `Table ${(detailOrder.table as { number: number }).number}` : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Payment</p>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className={detailOrder?.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-yellow-100 text-yellow-800'}>
                        {String(detailOrder?.paymentStatus || 'unpaid')}
                      </Badge>
                      {detailOrder?.paymentMethod && <span className="text-xs text-muted-foreground uppercase">{String(detailOrder.paymentMethod)}</span>}
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Time</p>
                    <p className="font-medium">{detailOrder?.createdAt ? format(new Date(detailOrder.createdAt as string), 'MMM dd, yyyy HH:mm') : 'N/A'}</p>
                  </div>
                </div>

                <Separator />

                {/* Items */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Items</p>
                  {((detailOrder?.orderItems as { id: string; menuItem: { name: string; image: string }; quantity: number; price: number; notes: string; status: string }[]) || []).map((oi) => (
                    <div key={oi.id} className="flex items-start justify-between text-sm py-1 gap-2">
                      <div className="flex items-start gap-2 flex-1">
                        {/* Item thumbnail in detail dialog */}
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
                            <Badge variant="outline" className="text-[10px] h-4 capitalize">{oi.status}</Badge>
                          </div>
                          {oi.notes && <p className="text-xs text-muted-foreground italic mt-0.5">{oi.notes}</p>}
                        </div>
                      </div>
                      <span className="font-medium flex-shrink-0">${(oi.price * oi.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Totals */}
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>${((detailOrder?.subtotal as number) || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span>${((detailOrder?.tax as number) || 0).toFixed(2)}</span>
                  </div>
                  {Number(detailOrder?.discount || 0) > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount</span>
                      <span>-${((detailOrder?.discount as number) || 0).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base pt-1">
                    <span>Total</span>
                    <span>${((detailOrder?.total as number) || 0).toFixed(2)}</span>
                  </div>
                </div>

                {detailOrder?.notes && (
                  <div className="text-sm bg-muted/50 p-3 rounded-lg">
                    <p className="text-muted-foreground text-xs mb-1">Order Notes</p>
                    <p>{String(detailOrder.notes)}</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Receipt Dialog */}
          <Dialog open={!!receiptOrder} onOpenChange={(open) => !open && setReceiptOrder(null)}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Printer className="h-4 w-4" />
                  Receipt
                </DialogTitle>
              </DialogHeader>
              <div ref={receiptRef} className="bg-white text-black p-4 rounded-lg text-sm font-mono space-y-3">
                {/* Receipt Header */}
                <div className="text-center">
                  <p className="font-bold text-lg">RestaurantOS</p>
                  <p className="text-xs text-gray-500">123 Main Street, Foodville</p>
                  <p className="text-xs text-gray-500">Tel: (555) 123-4567</p>
                  <div className="border-b border-dashed border-gray-300 my-2" />
                  <p className="text-xs">RECEIPT</p>
                </div>

                {/* Receipt Info */}
                <div className="text-xs space-y-0.5">
                  <div className="flex justify-between">
                    <span>Order #</span>
                    <span>{(receiptOrder?.orderNumber as number) || ''}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Date</span>
                    <span>{receiptOrder?.createdAt ? format(new Date(receiptOrder.createdAt as string), 'MMM dd, yyyy HH:mm') : ''}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Customer</span>
                    <span>{String(receiptOrder?.customerName || 'Walk-in')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Type</span>
                    <span className="capitalize">{String(receiptOrder?.type || '')}</span>
                  </div>
                  {receiptOrder?.table && (
                    <div className="flex justify-between">
                      <span>Table</span>
                      <span>{(receiptOrder.table as { number: number }).number}</span>
                    </div>
                  )}
                </div>

                <div className="border-b border-dashed border-gray-300" />

                {/* Items */}
                <div className="space-y-1 text-xs">
                  {((receiptOrder?.orderItems as { id: string; menuItem: { name: string }; quantity: number; price: number }[]) || []).map((oi) => (
                    <div key={oi.id} className="flex justify-between">
                      <span>{oi.quantity}x {oi.menuItem.name}</span>
                      <span>${(oi.price * oi.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="border-b border-dashed border-gray-300" />

                {/* Totals */}
                <div className="text-xs space-y-0.5">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>${((receiptOrder?.subtotal as number) || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax:</span>
                    <span>${((receiptOrder?.tax as number) || 0).toFixed(2)}</span>
                  </div>
                  {Number(receiptOrder?.discount || 0) > 0 && (
                    <div className="flex justify-between">
                      <span>Discount:</span>
                      <span>-${((receiptOrder?.discount as number) || 0).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm pt-1">
                    <span>TOTAL:</span>
                    <span>${((receiptOrder?.total as number) || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Payment:</span>
                    <span className="uppercase">{String(receiptOrder?.paymentMethod || 'N/A')}</span>
                  </div>
                </div>

                <div className="border-b border-dashed border-gray-300" />

                <div className="text-center text-xs text-gray-500">
                  <p>Thank you for dining with us!</p>
                  <p>We hope to see you again soon.</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setReceiptOrder(null)}>Close</Button>
                <Button onClick={() => {
                  if (receiptRef.current) {
                    const printWindow = window.open('', '_blank')
                    if (printWindow) {
                      printWindow.document.write('<html><head><title>Receipt</title><style>body{font-family:monospace;padding:20px;max-width:300px;margin:0 auto;}</style></head><body>')
                      printWindow.document.write(receiptRef.current.innerHTML)
                      printWindow.document.write('</body></html>')
                      printWindow.document.close()
                      printWindow.print()
                    }
                  }
                  toast.success('Receipt sent to printer')
                }}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  )
}
