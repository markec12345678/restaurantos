'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query-keys'
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
    } catch (err: unknown) {
      // P2-UX FIX (nemi neuspeh): prej prazen catch — če je deljeno plačilo padlo
      // na 2. od 4 delov, gostje 1–2 so bili bremenjeni, natakar pa NI VIDEL
      // nobene napake. Zdaj pokažemo sporočilo napake (authFetch vrže Error z
      // .message = Slovenški tekst API-ja in .status).
      const e = err as { message?: string; status?: number }
      toast.error(e?.message || 'Napaka pri deljenem plačilu', { duration: 8000 })
      if (e?.status === 409) {
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      }
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
    } catch (err: unknown) {
      // P2-UX FIX (nemi neuspeh): enako kot pri deljenem plačilu — prej prazen catch.
      const e = err as { message?: string; status?: number }
      toast.error(e?.message || 'Napaka pri plačilu po artiklih', { duration: 8000 })
      if (e?.status === 409) {
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      }
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
