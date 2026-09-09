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
    // P2-UX FIX (dvojni klik): React-Query NE deduplicira .mutate() klicev — dva
    // hitra klika v istem frame-u bi izvedla mutationFn dvakrat. Gumb je sicer
    // disabled med isPending, a to velja šele po re-renderju; ta sync varovalka
    // pokriva tudi klik v istem trenutku.
    if (processPaymentMutation.isPending || isProcessing) return
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
    // P2-UX FIX (opozorilo pred zaprtjem): artikli, ki niso bili poslani v kuhinjo,
    // bodo s plačilom trajno zaključeni (backend po plačilu force-complete).
    // Natakarju pokažemo opozorilo PRED potrditvijo plačila.
    const unsentItems = (order?.orderItems ?? []).filter(oi => oi.status === 'pending')
    if (unsentItems.length > 0) {
      toast.warning(
        `Pozor: ${unsentItems.length} ${unsentItems.length === 1 ? 'artikel ni poslan' : 'artiklov ni poslanih'} v kuhinjo — s plačilom bo naročilo zaključeno.`,
        { duration: 8000 },
      )
    }
    processPaymentMutation.mutate()
  }, [paymentMethod, selectedGiftCardId, selectedAltPayment, processPaymentMutation, isProcessing, order])

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
