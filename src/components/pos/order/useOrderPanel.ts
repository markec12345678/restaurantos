'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usePOSStore } from '@/lib/store'
import { toast } from 'sonner'
import { usePOSShortcuts } from '@/lib/use-pos-shortcuts'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import type { StockInfoType } from './MenuBrowser'
import type { OrderType } from './OrderList'

// ============================================
// TIPI
// ============================================
export interface OrderPanelState {
  // Lokalno stanje
  customerName: string
  setCustomerName: (_name: string) => void
  customerPhone: string
  setCustomerPhone: (_phone: string) => void
  orderNotes: string
  setOrderNotes: (_notes: string) => void
  mainTab: string
  setMainTab: (_tab: string) => void
  orderListTab: string
  setOrderListTab: (_tab: string) => void
  selectedOrder: OrderType | Record<string, unknown> | null
  setSelectedOrder: (_order: OrderType | Record<string, unknown> | null) => void
  paymentDialogOpen: boolean
  setPaymentDialogOpen: (_open: boolean) => void
  detailOrder: OrderType | null
  setDetailOrder: (_order: OrderType | null) => void
  receiptOrder: OrderType | Record<string, unknown> | null
  setReceiptOrder: (_order: OrderType | Record<string, unknown> | null) => void
  autoPayOrder: Record<string, unknown> | null
  setAutoPayOrder: (_order: Record<string, unknown> | null) => void
  autoReceiptOrderId: string | null
  setAutoReceiptOrderId: (_id: string | null) => void
  voidItem: { id: string; name: string; quantity: number; price: number; vatRate: number; voided: boolean; orderId: string } | null
  setVoidItem: (_item: { id: string; name: string; quantity: number; price: number; vatRate: number; voided: boolean; orderId: string } | null) => void
  stornoOrder: OrderType | Record<string, unknown> | null
  setStornoOrder: (_order: OrderType | Record<string, unknown> | null) => void
  clearCartConfirm: boolean
  setClearCartConfirm: (_open: boolean) => void
  lastAddedId: string | null
  setLastAddedId: (_id: string | null) => void
  shortcutsOpen: boolean
  setShortcutsOpen: (_open: boolean) => void
}

export interface OrderPanelData {
  menus: MenuType[] | undefined
  menusLoading: boolean
  menuItems: MenuItemType[] | undefined
  menuLoading: boolean
  tables: TableType[] | undefined
  orders: OrderType[] | undefined
  ordersLoading: boolean
  discounts: DiscountType[] | undefined
  diningOptions: DiningOptionType[] | undefined
  menuStockMap: Record<string, StockInfoType> | undefined
}

export interface OrderPanelCalculations {
  subtotal: number
  vatBreakdown: Array<{ vatRate: number; taxableAmount: number; taxAmount: number }>
  totalTax: number
  total: number
  _cappedDiscount: number
}

// Pomožni tipi za podatke
interface MenuType {
  id: string
  name: string
  [key: string]: unknown
}
interface MenuItemType {
  id: string
  name: string
  [key: string]: unknown
}
interface TableType {
  id: string
  number: number
  capacity: number
  status: string
}
interface DiscountType {
  id: string
  name: string
  type: string
  amount: number
  isActive: boolean
}
interface DiningOptionType {
  id: string
  name: string
  type: string
}

// ============================================
// USE ORDER PANEL - Hook za stanje in logiko
// ============================================
export function useOrderPanel() {
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

  // ─── Lokalno stanje ────────────────────────────────────────────
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
  const [autoReceiptOrderId, setAutoReceiptOrderId] = useState<string | null>(null)
  const [voidItem, setVoidItem] = useState<{ id: string; name: string; quantity: number; price: number; vatRate: number; voided: boolean; orderId: string } | null>(null)
  const [stornoOrder, setStornoOrder] = useState<OrderType | Record<string, unknown> | null>(null)
  const [clearCartConfirm, setClearCartConfirm] = useState(false)
  const [lastAddedId, setLastAddedId] = useState<string | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  // ─── Keyboard shortcuts ────────────────────────────────────────
  usePOSShortcuts({
    onNewOrder: () => { clearCart(); setCustomerName(''); setCustomerPhone(''); setOrderNotes(''); setDiscount(0); setEditingOrderId(null); setEditingOrderNumber(null); setMainTab('new-order') },
    onPay: () => { if (cart.length > 0) placeOrderMutation.mutate() },
    onSearch: () => { /* Search is handled inside MenuBrowser */ },
    onClearCart: () => { if (cart.length > 0) setClearCartConfirm(true) },
    onOrderList: () => setMainTab('order-list'),
    onEscape: () => { /* Escape is handled inside MenuBrowser */ },
  })

  // ─── Podatki ───────────────────────────────────────────────────
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

  // ─── Izračuni ──────────────────────────────────────────────────
  const subtotal = cartSubtotal()
  const vatBreakdown = cartVatBreakdown()
  const totalTax = cartTaxTotal()
  const _cappedDiscount = Math.min(discount, subtotal)
  const total = cartTotal()

  // ─── Mutacije ──────────────────────────────────────────────────
  const placeOrderMutation = useMutation({
    mutationFn: async () => {
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
      const res = await authFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          type: orderType,
          tableId: orderType === 'dine-in' ? selectedTable : null,
          diningOptionId: diningOptionId || undefined,
          customerName,
          customerPhone,
          discount: _cappedDiscount,
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

  // ─── Stabilni callbacki ────────────────────────────────────────
  const handlePaymentClose = useCallback(() => { setPaymentDialogOpen(false); setSelectedOrder(null); setAutoPayOrder(null) }, [])
  const handlePaymentSuccess = useCallback((orderId: string) => {
    if (orderId) {
      setAutoReceiptOrderId(orderId)
      setReceiptOrder({ id: orderId })
    }
  }, [])
  const handleReceiptClose = useCallback(() => { setReceiptOrder(null); setAutoReceiptOrderId(null) }, [])
  const handleVoidClose = useCallback(() => setVoidItem(null), [])
  const handleVoided = useCallback(() => queryClient.invalidateQueries({ queryKey: queryKeys.orders.all }), [queryClient])
  const handleStornoClose = useCallback(() => setStornoOrder(null), [])
  const handleStornoComplete = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
  }, [queryClient])

  const handleOrderClick = useCallback((order: OrderType) => setDetailOrder(order), [])
  const handlePayOrder = useCallback((order: OrderType) => { setSelectedOrder(order); setPaymentDialogOpen(true) }, [])
  const handlePrintReceipt = useCallback((order: OrderType) => setReceiptOrder(order), [])
  const handleStornoOrder = useCallback((order: OrderType) => setStornoOrder(order), [])
  const handleAddToOrder = useCallback((order: OrderType) => {
    setEditingOrderId(order.id)
    setEditingOrderNumber(order.orderNumber)
    setMainTab('new-order')
  }, [setEditingOrderId, setEditingOrderNumber])

  const handleExitEditing = useCallback(() => { setEditingOrderId(null); setEditingOrderNumber(null); clearCart() }, [setEditingOrderId, setEditingOrderNumber, clearCart])
  const handleClearCartConfirm = useCallback(() => { clearCart(); setClearCartConfirm(false) }, [clearCart])

  return {
    // Store
    cart, addToCart, removeFromCart, updateCartQuantity, clearCart,
    orderType, setOrderType, selectedTable, setSelectedTable,
    discount, setDiscount, activeMenuId, setActiveMenuId,
    editingOrderId, editingOrderNumber,
    appliedDiscountId, setAppliedDiscountId, diningOptionId, setDiningOptionId,
    // Lokalno stanje
    customerName, setCustomerName, customerPhone, setCustomerPhone,
    orderNotes, setOrderNotes, mainTab, setMainTab,
    orderListTab, setOrderListTab,
    selectedOrder, setSelectedOrder,
    paymentDialogOpen, setPaymentDialogOpen,
    detailOrder, setDetailOrder,
    receiptOrder, setReceiptOrder,
    autoPayOrder, setAutoPayOrder,
    autoReceiptOrderId, setAutoReceiptOrderId,
    voidItem, setVoidItem,
    stornoOrder, setStornoOrder,
    clearCartConfirm, setClearCartConfirm,
    lastAddedId, setLastAddedId,
    shortcutsOpen, setShortcutsOpen,
    // Podatki
    menus, menusLoading, menuItems, menuLoading,
    tables, orders, ordersLoading, discounts, diningOptions, menuStockMap,
    // Izračuni
    subtotal, vatBreakdown, totalTax, total,
    // Mutacije
    placeOrderMutation, updateOrderStatusMutation,
    // Handlerji
    handlePaymentClose, handlePaymentSuccess, handleReceiptClose,
    handleVoidClose, handleVoided, handleStornoClose, handleStornoComplete,
    handleOrderClick, handlePayOrder, handlePrintReceipt, handleStornoOrder,
    handleAddToOrder, handleExitEditing, handleClearCartConfirm,
  }
}
