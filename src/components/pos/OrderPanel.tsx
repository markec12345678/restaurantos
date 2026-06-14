'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usePOSStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { ShoppingBag, Clock, Keyboard } from 'lucide-react'
import { useState, useCallback, memo } from 'react'
import { usePOSShortcuts } from '@/lib/use-pos-shortcuts'
import { ReceiptDialog } from '@/components/pos/ReceiptDialog'
import { PaymentDialog } from '@/components/pos/PaymentDialog'
import { VoidItemDialog } from '@/components/pos/VoidItemDialog'
import { StornoDialog } from '@/components/pos/StornoDialog'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import dynamic from 'next/dynamic'

// Lazy-loaded sub-komponente
const MenuBrowser = dynamic(() => import('./order/MenuBrowser').then(m => ({ default: m.MenuBrowser })), { ssr: false })
const OrderList = dynamic(() => import('./order/OrderList').then(m => ({ default: m.OrderList })), { ssr: false })
const OrderCart = dynamic(() => import('./order/OrderCart').then(m => ({ default: m.OrderCart })), { ssr: false })
const ClearCartDialog = dynamic(() => import('./order/ClearCartDialog').then(m => m.ClearCartDialog), { ssr: false })
const ShortcutsDialog = dynamic(() => import('./order/ShortcutsDialog').then(m => m.ShortcutsDialog), { ssr: false })
import type { StockInfoType } from './order/MenuBrowser'
import type { OrderType } from './order/OrderList'

// ============================================
// GLAVNA KOMPONENTA - Koordinator
// ============================================
export const OrderPanel = memo(function OrderPanel() {
  const {
    cart, addToCart, removeFromCart, updateCartQuantity, updateCartNotes: _updateCartNotes, clearCart,
    cartTotal, cartSubtotal, cartTaxTotal, cartVatBreakdown,
    orderType, setOrderType, selectedTable, setSelectedTable,
    discount, setDiscount, taxRate,
    activeMenuId, setActiveMenuId,
    editingOrderId, setEditingOrderId, editingOrderNumber, setEditingOrderNumber,
    appliedDiscountId, setAppliedDiscountId, diningOptionId, setDiningOptionId,
  } = usePOSStore()
  const queryClient = useQueryClient()
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [mainTab, setMainTab] = useState('new-order')
  const [orderListTab, setOrderListTab] = useState('all')
  const [selectedOrder, setSelectedOrder] = useState<OrderType | Record<string, unknown> | null>(null)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [detailOrder, setDetailOrder] = useState<OrderType | null>(null)
  const [receiptOrder, setReceiptOrder] = useState<OrderType | Record<string, unknown> | null>(null)
  const [autoPayOrder, setAutoPayOrder] = useState<Record<string, unknown> | null>(null)
  const [_autoReceiptOrderId, setAutoReceiptOrderId] = useState<string | null>(null)
  const [voidItem, setVoidItem] = useState<{ id: string; name: string; quantity: number; price: number; vatRate: number; voided: boolean; orderId: string } | null>(null)
  const [stornoOrder, setStornoOrder] = useState<OrderType | Record<string, unknown> | null>(null)
  // Clear cart confirmation
  const [clearCartConfirm, setClearCartConfirm] = useState(false)
  // Menu item add animation
  const [lastAddedId, setLastAddedId] = useState<string | null>(null)
  // Keyboard shortcuts dialog
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  // Keyboard shortcuts
  usePOSShortcuts({
    onNewOrder: () => { clearCart(); setCustomerName(''); setCustomerPhone(''); setOrderNotes(''); setDiscount(0); setEditingOrderId(null); setEditingOrderNumber(null); setMainTab('new-order') },
    onPay: () => { if (cart.length > 0) placeOrderMutation.mutate() },
    onSearch: () => { /* Search is handled inside MenuBrowser */ },
    onClearCart: () => { if (cart.length > 0) setClearCartConfirm(true) },
    onOrderList: () => setMainTab('order-list'),
    onEscape: () => { /* Escape is handled inside MenuBrowser */ },
  })

  // ============================================
  // PODATKI
  // ============================================
  const { data: menus, isLoading: menusLoading } = useQuery({
    queryKey: queryKeys.menus.all,
    queryFn: async () => { const res = await authFetch('/api/menus'); return res.json() },
  })
  const { data: menuItems, isLoading: menuLoading } = useQuery({
    queryKey: queryKeys.menuItems.all,
    queryFn: async () => { const res = await authFetch('/api/menu-items'); return res.json() },
  })
  const { data: tables } = useQuery({
    queryKey: queryKeys.tables.all,
    queryFn: async () => { const res = await authFetch('/api/tables'); return res.json() },
  })
  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: queryKeys.orders.byStatus(orderListTab),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (orderListTab !== 'all') params.set('status', orderListTab)
      const res = await authFetch(`/api/orders?${params}`)
      return res.json()
    },
  })
  const { data: discounts } = useQuery({
    queryKey: ['discounts-active'],
    queryFn: async () => {
      const res = await authFetch('/api/discounts')
      if (!res.ok) return []
      const all = await res.json()
      return all.filter((d: { isActive: boolean }) => d.isActive)
    },
  })
  const { data: diningOptions } = useQuery({
    queryKey: queryKeys.diningOptions.all,
    queryFn: async () => {
      const res = await authFetch('/api/configuration/dining-options')
      if (!res.ok) return []
      return res.json()
    },
  })
  const { data: menuStockMap } = useQuery<Record<string, StockInfoType>>({
    queryKey: queryKeys.inventory.menuStock,
    queryFn: async () => {
      try {
        const res = await authFetch('/api/inventory/menu-stock')
        if (!res.ok) return {}
        return res.json()
      } catch {
        return {}
      }
    },
    refetchInterval: 30000, // Osveži vsakih 30 sekund
    staleTime: 20000,
  })

  // ============================================
  // MUTACIJE
  // ============================================
  const subtotal = cartSubtotal()
  const vatBreakdown = cartVatBreakdown()
  const totalTax = cartTaxTotal()
  const cappedDiscount = Math.min(discount, subtotal)
  const total = cartTotal()

  const placeOrderMutation = useMutation({
    mutationFn: async () => {
      // Če urejamo obstoječe naročilo, dodaj artikle
      if (editingOrderId) {
        const res = await authFetch(`/api/orders/${editingOrderId}/add-items`, {
          method: 'POST',
          body: JSON.stringify({
            orderItems: cart.map(item => ({
              menuItemId: item.id,
              quantity: item.quantity,
              price: item.price,
              notes: item.notes,
              modifiersJson: JSON.stringify(item.modifiers.map(m => ({ name: m.name, price: m.price, modifierGroupName: m.modifierGroupName }))),
            })),
          }),
        })
        if (!res.ok) throw new Error('Failed to add items')
        return res.json()
      }
      // Novo naročilo
      const res = await authFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          type: orderType,
          tableId: orderType === 'dine-in' ? selectedTable : null,
          diningOptionId: diningOptionId || undefined,
          customerName,
          customerPhone,
          discount: cappedDiscount,
          appliedDiscountId: appliedDiscountId || undefined,
          taxRate,
          notes: orderNotes,
          orderItems: cart.map(item => ({
            menuItemId: item.id,
            quantity: item.quantity,
            price: item.price,
            notes: item.notes,
            modifiersJson: JSON.stringify(item.modifiers.map(m => ({ name: m.name, price: m.price, modifierGroupName: m.modifierGroupName }))),
          })),
        }),
      })
      if (!res.ok) throw new Error('Failed to place order')
      return res.json()
    },
    onSuccess: (data) => {
      if (editingOrderId) {
        toast.success(`Artikli dodani k naročilu #${editingOrderNumber}!`)
      } else {
        toast.success('Naročilo uspešno oddano! Plačaj in natisni račun.')
      }
      // Samodejno odpri plačilno okno z novim naročilom
      if (data && !editingOrderId) {
        setAutoPayOrder(data)
        setPaymentDialogOpen(true)
      }
      clearCart()
      setCustomerName('')
      setCustomerPhone('')
      setOrderNotes('')
      setDiscount(0)
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.tables.all })
    },
    onError: () => { toast.error('Napaka pri oddaji naročila') },
  })

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await authFetch(`/api/orders/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Failed to update order')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Status naročila posodobljen')
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.tables.all })
    },
  })

  // ============================================
  // STATUSNE MAPE
  // ============================================
  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    'in-progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    ready: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    completed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  }
  const nextStatus: Record<string, string> = { pending: 'in-progress', 'in-progress': 'ready', ready: 'completed' }
  const statusLabels: Record<string, string> = { pending: 'Čakajoče', 'in-progress': 'V obdelavi', ready: 'Pripravljeno', completed: 'Zaključeno', cancelled: 'Preklicano' }
  const paymentStatusLabels: Record<string, string> = { unpaid: 'Neplačano', paid: 'Plačano', partial: 'Delno', storno: 'Stornirano' }
  const paymentStatusColors: Record<string, string> = {
    unpaid: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    partial: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    storno: 'bg-red-200 text-red-900 dark:bg-red-900/40 dark:text-red-300',
  }

  // ============================================
  // STABILNI CALLBACKI za dialoge
  // ============================================
  const handlePaymentClose = useCallback(() => { setPaymentDialogOpen(false); setSelectedOrder(null); setAutoPayOrder(null) }, [])
  const handlePaymentSuccess = useCallback((orderId: string) => {
    if (orderId) {
      setAutoReceiptOrderId(orderId)
      setReceiptOrder({ id: orderId })
    }
  }, [])
  const handleReceiptClose = useCallback(() => setReceiptOrder(null), [])
  const handleVoidClose = useCallback(() => setVoidItem(null), [])
  const handleVoided = useCallback(() => queryClient.invalidateQueries({ queryKey: queryKeys.orders.all }), [queryClient])
  const handleStornoClose = useCallback(() => setStornoOrder(null), [])
  const handleStornoComplete = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
  }, [queryClient])

  // Handler za OrderList akcije
  const handleOrderClick = useCallback((order: OrderType) => setDetailOrder(order), [])
  const handlePayOrder = useCallback((order: OrderType) => { setSelectedOrder(order); setPaymentDialogOpen(true) }, [])
  const handlePrintReceipt = useCallback((order: OrderType) => setReceiptOrder(order), [])
  const handleStornoOrder = useCallback((order: OrderType) => setStornoOrder(order), [])
  const handleAddToOrder = useCallback((order: OrderType) => {
    setEditingOrderId(order.id)
    setEditingOrderNumber(order.orderNumber)
    setMainTab('new-order')
  }, [setEditingOrderId, setEditingOrderNumber])

  // Handler za exit editing
  const handleExitEditing = useCallback(() => { setEditingOrderId(null); setEditingOrderNumber(null); clearCart() }, [setEditingOrderId, setEditingOrderNumber, clearCart])

  // Handler za clear cart dialog
  const handleClearCartConfirm = useCallback(() => { clearCart(); setClearCartConfirm(false) }, [clearCart])

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="h-full flex flex-col">
      {/* TOP TAB BAR - Naročila / Seznam naročil */}
      <div className="flex items-center border-b border-border bg-card px-4 h-11 flex-shrink-0">
        <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
          <TabsList className="h-8 bg-transparent p-0 gap-4">
            <TabsTrigger value="new-order" className="h-8 px-0 text-sm font-semibold data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none">
              <ShoppingBag className="h-3.5 w-3.5 mr-1.5" />
              Novo naročilo
            </TabsTrigger>
            <TabsTrigger value="order-list" className="h-8 px-0 text-sm font-semibold data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none">
              <Clock className="h-3.5 w-3.5 mr-1.5" />
              Seznam naročil
            </TabsTrigger>
          </TabsList>
          <Button variant="ghost" size="icon" aria-label="Ključ" className="h-7 w-7 ml-auto" onClick={() => setShortcutsOpen(true)} title="Tipkovne bližnjice">
            <Keyboard className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </Tabs>
      </div>
      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-hidden">
        {mainTab === 'new-order' ? (
          /* ============================================
             NOVO NAROČILO - Toast POS Layout
             ============================================ */
          <div className="h-full flex">
            {/* LEFT: Menu Area (65%) */}
            <MenuBrowser
              menus={menus}
              menuItems={menuItems}
              tables={tables}
              diningOptions={diningOptions}
              discounts={discounts}
              menuStockMap={menuStockMap}
              orderType={orderType}
              setOrderType={setOrderType}
              selectedTable={selectedTable}
              setSelectedTable={setSelectedTable}
              activeMenuId={activeMenuId}
              setActiveMenuId={setActiveMenuId}
              diningOptionId={diningOptionId}
              setDiningOptionId={setDiningOptionId}
              discount={discount}
              setDiscount={setDiscount}
              appliedDiscountId={appliedDiscountId}
              setAppliedDiscountId={setAppliedDiscountId}
              subtotal={subtotal}
              cart={cart}
              editingOrderId={editingOrderId}
              editingOrderNumber={editingOrderNumber}
              menusLoading={menusLoading}
              menuLoading={menuLoading}
              onAddToCart={addToCart}
              onSetLastAddedId={setLastAddedId}
              lastAddedId={lastAddedId}
            />
            {/* RIGHT: Cart Panel (35%) */}
            <OrderCart
              cart={cart}
              removeFromCart={removeFromCart}
              updateCartQuantity={updateCartQuantity}
              subtotal={subtotal}
              vatBreakdown={vatBreakdown}
              totalTax={totalTax}
              discount={discount}
              total={total}
              customerName={customerName}
              setCustomerName={setCustomerName}
              customerPhone={customerPhone}
              setCustomerPhone={setCustomerPhone}
              orderNotes={orderNotes}
              setOrderNotes={setOrderNotes}
              setDiscount={setDiscount}
              appliedDiscountId={appliedDiscountId}
              setAppliedDiscountId={setAppliedDiscountId}
              discounts={discounts}
              editingOrderId={editingOrderId}
              editingOrderNumber={editingOrderNumber}
              onExitEditing={handleExitEditing}
              onSubmit={() => placeOrderMutation.mutate()}
              isPending={placeOrderMutation.isPending}
              setClearCartConfirm={setClearCartConfirm}
            />
          </div>
        ) : (
          /* ============================================
             SEZNAM NAROČIL
             ============================================ */
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
            onUpdateOrderStatus={(params) => updateOrderStatusMutation.mutate(params)}
            isStatusUpdatePending={updateOrderStatusMutation.isPending}
            onOrderClick={handleOrderClick}
            onPayOrder={handlePayOrder}
            onPrintReceipt={handlePrintReceipt}
            onStornoOrder={handleStornoOrder}
            onAddToOrder={handleAddToOrder}
            onVoidItem={setVoidItem}
            detailOrder={detailOrder}
            setDetailOrder={setDetailOrder}
          />
        )}
      </div>
      {/* Payment Dialog */}
      <PaymentDialog
        order={(autoPayOrder || selectedOrder) as Parameters<typeof PaymentDialog>[0]['order']}
        open={paymentDialogOpen}
        onClose={handlePaymentClose}
        onPaymentSuccess={handlePaymentSuccess}
      />
      {/* Receipt Dialog */}
      <ReceiptDialog
        orderId={receiptOrder?.id as string || null}
        open={!!receiptOrder}
        onClose={() => { handleReceiptClose(); setAutoReceiptOrderId(null) }}
      />
      {/* Void Item Dialog */}
      <VoidItemDialog
        orderItem={voidItem}
        orderId={voidItem?.orderId || ''}
        open={!!voidItem}
        onClose={handleVoidClose}
        onVoided={handleVoided}
      />
      {/* Storno Dialog */}
      <StornoDialog
        order={stornoOrder as { id: string; orderNumber: number; total: number; subtotal: number; tax: number; discount: number; tip: number; paymentMethod: string; paymentStatus: string } | null}
        open={!!stornoOrder}
        onClose={handleStornoClose}
        onStornoComplete={handleStornoComplete}
      />
      {/* Clear Cart Confirmation Dialog */}
      <ClearCartDialog
        open={clearCartConfirm}
        onOpenChange={setClearCartConfirm}
        onConfirm={handleClearCartConfirm}
      />
      {/* Keyboard Shortcuts Dialog */}
      <ShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
      />
    </div>
  )
})
