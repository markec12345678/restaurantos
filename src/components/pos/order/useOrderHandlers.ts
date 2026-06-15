'use client'

import { useCallback } from 'react'
import type { OrderType } from './OrderList'

// ============================================
// USE ORDER HANDLERS - Stabilni callbacki
// ============================================

interface OrderHandlersDeps {
  setPaymentDialogOpen: (_open: boolean) => void
  setSelectedOrder: (_order: OrderType | Record<string, unknown> | null) => void
  setAutoPayOrder: (_order: Record<string, unknown> | null) => void
  setAutoReceiptOrderId: (_id: string | null) => void
  setReceiptOrder: (_order: OrderType | Record<string, unknown> | null) => void
  setVoidItem: (_item: { id: string; name: string; quantity: number; price: number; vatRate: number; voided: boolean; orderId: string } | null) => void
  setStornoOrder: (_order: OrderType | Record<string, unknown> | null) => void
  setDetailOrder: (_order: OrderType | null) => void
  clearCart: () => void
  setClearCartConfirm: (_open: boolean) => void
}

export function useOrderHandlers(deps: OrderHandlersDeps) {
  const {
    setPaymentDialogOpen, setSelectedOrder, setAutoPayOrder,
    setAutoReceiptOrderId, setReceiptOrder, setVoidItem,
    setStornoOrder, setDetailOrder, clearCart, setClearCartConfirm,
  } = deps

  const handlePaymentClose = useCallback(() => {
    setPaymentDialogOpen(false); setSelectedOrder(null); setAutoPayOrder(null)
  }, [setPaymentDialogOpen, setSelectedOrder, setAutoPayOrder])

  const handlePaymentSuccess = useCallback((orderId: string) => {
    if (orderId) {
      setAutoReceiptOrderId(orderId)
      setReceiptOrder({ id: orderId })
    }
  }, [setAutoReceiptOrderId, setReceiptOrder])

  const handleReceiptClose = useCallback(() => {
    setReceiptOrder(null); setAutoReceiptOrderId(null)
  }, [setReceiptOrder, setAutoReceiptOrderId])

  const handleVoidClose = useCallback(() => setVoidItem(null), [setVoidItem])
  const handleStornoClose = useCallback(() => setStornoOrder(null), [setStornoOrder])

  const handleOrderClick = useCallback((order: OrderType) => setDetailOrder(order), [setDetailOrder])

  const handlePayOrder = useCallback((order: OrderType) => {
    setSelectedOrder(order); setPaymentDialogOpen(true)
  }, [setSelectedOrder, setPaymentDialogOpen])

  const handlePrintReceipt = useCallback((order: OrderType) => setReceiptOrder(order), [setReceiptOrder])

  const handleStornoOrder = useCallback((order: OrderType) => setStornoOrder(order), [setStornoOrder])

  const handleClearCartConfirm = useCallback(() => {
    clearCart(); setClearCartConfirm(false)
  }, [clearCart, setClearCartConfirm])

  return {
    handlePaymentClose,
    handlePaymentSuccess,
    handleReceiptClose,
    handleVoidClose,
    handleStornoClose,
    handleOrderClick,
    handlePayOrder,
    handlePrintReceipt,
    handleStornoOrder,
    handleClearCartConfirm,
  }
}
