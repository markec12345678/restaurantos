'use client'

import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePOSStore } from '@/lib/store'
import { usePOSShortcuts } from '@/lib/use-pos-shortcuts'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import type { StockInfoType } from './types'
import type { OrderType } from './OrderList'
import { useOrderPanelMutations } from './useOrderPanelMutations'

// Zunanji tipi, ki jih uporabljajo druge komponente
export type { OrderPanelState, OrderPanelData, OrderPanelCalculations } from './types'

// ============================================
// USE ORDER PANEL - Hook za stanje in logiko
// ============================================
export function useOrderPanel() {
  const {
    cart, addToCart, removeFromCart, updateCartQuantity, updateCartNotes: _updateCartNotes, clearCart,
    cartTotal, cartSubtotal, cartTaxTotal, cartVatBreakdown,
    orderType, setOrderType, selectedTable, setSelectedTable,
    discount, setDiscount,
    activeMenuId, setActiveMenuId,
    editingOrderId, setEditingOrderId, editingOrderNumber, setEditingOrderNumber,
    appliedDiscountId, setAppliedDiscountId, diningOptionId, setDiningOptionId,
  } = usePOSStore()

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

  // ─── Mutations sub-hook ────────────────────────────────────────
  const {
    placeOrderMutation, updateOrderStatusMutation,
    handleVoided, handleStornoComplete,
    handleAddToOrder, handleExitEditing,
  } = useOrderPanelMutations()

  // ─── Keyboard shortcuts ────────────────────────────────────────
  usePOSShortcuts({
    onNewOrder: () => { clearCart(); setCustomerName(''); setCustomerPhone(''); setOrderNotes(''); setDiscount(0); setEditingOrderId(null); setEditingOrderNumber(null); setMainTab('new-order') },
    onPay: () => { if (cart.length > 0) placeOrderMutation.mutate({ customerName, customerPhone, orderNotes }) },
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
    refetchInterval: 30000,
    staleTime: 20000,
  })

  // ─── Izračuni ──────────────────────────────────────────────────
  const subtotal = cartSubtotal()
  const vatBreakdown = cartVatBreakdown()
  const totalTax = cartTaxTotal()
  const total = cartTotal()

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
  const handleStornoClose = useCallback(() => setStornoOrder(null), [])

  const handleOrderClick = useCallback((order: OrderType) => setDetailOrder(order), [])
  const handlePayOrder = useCallback((order: OrderType) => { setSelectedOrder(order); setPaymentDialogOpen(true) }, [])
  const handlePrintReceipt = useCallback((order: OrderType) => setReceiptOrder(order), [])
  const handleStornoOrder = useCallback((order: OrderType) => setStornoOrder(order), [])
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
