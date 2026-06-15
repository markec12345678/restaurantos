'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { executeSplitPayment, executePayByItems } from './payment-handlers'
import type { PaymentHandlersProps } from './payment-handlers'

// ============================================
// PLAČILNI HANDLERJI za split in by-items
// ============================================
export function usePaymentHandlers({
  order,
  isProcessing,
  setIsProcessing,
  orderTotal,
  tipAmount,
  splitCount,
  paymentMethod,
  splitAmount: _splitAmount,
  guestAssignments,
  onPaymentSuccess,
  resetAndClose,
}: PaymentHandlersProps) {
  const queryClient = useQueryClient()

  // FIX H-04: Split payment — ustvari N ločenih plačil namesto enega
  const handleSplitPayment = useCallback(async () => {
    if (!order || isProcessing) return
    setIsProcessing(true)
    try {
      await executeSplitPayment({
        order,
        orderTotal,
        tipAmount,
        splitCount,
        paymentMethod,
        queryClient,
        onPaymentSuccess,
        resetAndClose,
      })
    } catch {
      // toast already handled in executeSplitPayment or silently here
    } finally {
      setIsProcessing(false)
    }
  }, [order, isProcessing, orderTotal, splitCount, tipAmount, paymentMethod, queryClient, onPaymentSuccess, resetAndClose, setIsProcessing])

  // FIX: By-items payment handler — ustvari ločen check za vsakega gosta
  const handlePayByItems = useCallback(async () => {
    if (!order || isProcessing) return
    setIsProcessing(true)
    try {
      await executePayByItems({
        order,
        splitCount,
        guestAssignments,
        queryClient,
        onPaymentSuccess,
        resetAndClose,
      })
    } catch {
      // toast already handled
    } finally {
      setIsProcessing(false)
    }
  }, [order, isProcessing, splitCount, guestAssignments, queryClient, onPaymentSuccess, resetAndClose, setIsProcessing])

  return {
    handleSplitPayment,
    handlePayByItems,
  }
}

// Re-export types
export type { PaymentHandlersProps }
