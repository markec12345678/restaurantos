'use client'

import { useCallback } from 'react'
import { toast } from 'sonner'
import type { PaymentDialogProps } from '../types'
import { usePaymentHandlers } from '../usePaymentHandlers'
import { useProcessPayment } from '../useProcessPayment'
import { usePaymentState } from './usePaymentState'
import { usePaymentQueries } from './usePaymentQueries'

// ============================================
// HOOK: Stanje in logika plačilnega dialoga
// ============================================

export function usePaymentDialog({ order, open, onClose, onPaymentSuccess }: PaymentDialogProps) {
  const {
    paymentMethod, setPaymentMethod,
    tipAmount, setTipAmount, tipPercent, setTipPercent,
    splitCount, setSplitCount,
    activeTab, setActiveTab,
    guestAssignments, setGuestAssignments,
    giftCardNumber, setGiftCardNumber,
    loyaltySearch, setLoyaltySearch,
    selectedAltPayment, setSelectedAltPayment,
    selectedGiftCardId, setSelectedGiftCardId,
    selectedLoyaltyId, setSelectedLoyaltyId,
    cashReceived, setCashReceived,
    isProcessing, setIsProcessing,
    paymentSuccess, setPaymentSuccess,
    orderTotal, totalWithTip, splitAmount,
    handleTipPercent, handleCustomTip,
    resetAndClose, scheduleClose,
  } = usePaymentState({ order, open, onClose, onPaymentSuccess })

  const { altPayments, giftCards, loyaltyResults } = usePaymentQueries(open, paymentMethod, loyaltySearch)

  // ============================================
  // PROCESS PAYMENT (iz pod-hooka)
  // ============================================
  const { processPaymentMutation } = useProcessPayment(
    {
      order,
      orderTotal,
      tipAmount,
      paymentMethod,
      selectedAltPayment,
      selectedGiftCardId,
      selectedLoyaltyId,
    },
    {
      onPaymentSuccess: onPaymentSuccess ?? (() => {}),
      onSetPaymentSuccess: setPaymentSuccess,
      scheduleClose,
    },
  )

  const handleSinglePayment = useCallback(() => {
    if (!paymentMethod) {
      toast.error('Izberite način plačila')
      return
    }
    if (paymentMethod === 'giftcard' && !selectedGiftCardId) {
      toast.error('Izberite darilno kartico')
      return
    }
    if (paymentMethod === 'alternate' && !selectedAltPayment) {
      toast.error('Izberite vrsto alternativnega plačila')
      return
    }
    processPaymentMutation.mutate()
  }, [paymentMethod, selectedGiftCardId, selectedAltPayment, processPaymentMutation])

  // Split in by-items handlerji (iz usePaymentHandlers)
  const { handleSplitPayment, handlePayByItems } = usePaymentHandlers({
    order,
    isProcessing,
    setIsProcessing,
    orderTotal,
    tipAmount,
    splitCount,
    paymentMethod,
    splitAmount,
    guestAssignments,
    onPaymentSuccess,
    resetAndClose,
  })

  return {
    // Stanje
    paymentMethod, setPaymentMethod,
    tipAmount, setTipAmount, tipPercent, setTipPercent,
    splitCount, setSplitCount,
    activeTab, setActiveTab,
    guestAssignments, setGuestAssignments,
    giftCardNumber, setGiftCardNumber,
    loyaltySearch, setLoyaltySearch,
    selectedAltPayment, setSelectedAltPayment,
    selectedGiftCardId, setSelectedGiftCardId,
    selectedLoyaltyId, setSelectedLoyaltyId,
    cashReceived, setCashReceived,
    isProcessing,
    paymentSuccess,
    // Izpeljane vrednosti
    orderTotal, totalWithTip, splitAmount,
    // Rezultati poizvedb
    altPayments,
    giftCards,
    loyaltyResults,
    // Handlerji
    handleTipPercent, handleCustomTip,
    processPaymentIsPending: processPaymentMutation.isPending,
    handleSinglePayment,
    handleSplitPayment,
    handlePayByItems,
    resetAndClose,
  }
}
