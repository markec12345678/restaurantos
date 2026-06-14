'use client'

import { useQuery } from '@tanstack/react-query'
import { useState, useRef, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import type { PaymentDialogProps } from './types'
import { usePaymentHandlers } from './usePaymentHandlers'
import { useProcessPayment } from './useProcessPayment'

// ============================================
// HOOK: Stanje in logika plačilnega dialoga
// ============================================

export function usePaymentDialog({ order, open, onClose, onPaymentSuccess }: PaymentDialogProps) {
  // Stanje komponente
  const [paymentMethod, setPaymentMethod] = useState('')
  const [tipAmount, setTipAmount] = useState(0)
  const [tipPercent, setTipPercent] = useState(0)
  const [splitCount, setSplitCount] = useState(1)
  const [activeTab, setActiveTab] = useState('single')
  // Split by items state
  const [guestAssignments, setGuestAssignments] = useState<Record<string, number>>({})
  // Alternate payment, gift card, loyalty
  const [giftCardNumber, setGiftCardNumber] = useState('')
  const [loyaltySearch, setLoyaltySearch] = useState('')
  const [selectedAltPayment, setSelectedAltPayment] = useState('')
  const [selectedGiftCardId, setSelectedGiftCardId] = useState<string | null>(null)
  const [selectedLoyaltyId, setSelectedLoyaltyId] = useState<string | null>(null)
  const [cashReceived, setCashReceived] = useState(0)
  // FIX CRITICAL: Double-click guard za split/by-items plačila
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // Izpeljane vrednosti
  const orderTotal = order?.total || 0
  const totalWithTip = orderTotal + tipAmount
  const splitAmount = Math.floor((totalWithTip / splitCount) * 100) / 100

  // Naloži alternativna plačila
  const { data: altPayments } = useQuery({
    queryKey: ['alt-payment-types'],
    queryFn: async () => {
      const res = await authFetch('/api/configuration/alt-payment-types')
      if (!res.ok) return []
      return res.json()
    },
    enabled: open,
  })
  // Naloži darilne kartice
  const { data: giftCards } = useQuery({
    queryKey: queryKeys.giftCards.all,
    queryFn: async () => {
      const res = await authFetch('/api/gift-cards')
      if (!res.ok) return []
      return res.json()
    },
    enabled: open && paymentMethod === 'giftcard',
  })
  // Išči zvestobni račun
  const { data: loyaltyResults } = useQuery({
    queryKey: queryKeys.loyalty.search(loyaltySearch),
    queryFn: async () => {
      if (!loyaltySearch || loyaltySearch.length < 2) return []
      const res = await authFetch(`/api/loyalty?search=${encodeURIComponent(loyaltySearch)}`)
      if (!res.ok) return []
      return res.json()
    },
    enabled: open && paymentMethod === 'loyalty' && loyaltySearch.length >= 2,
  })

  // Napitnina handlerji
  const handleTipPercent = useCallback((pct: number) => {
    setTipPercent(pct)
    setTipAmount(Math.round(orderTotal * pct) / 100)
  }, [orderTotal])
  const handleCustomTip = useCallback((val: string) => {
    const amount = parseFloat(val) || 0
    setTipAmount(amount)
    setTipPercent(orderTotal > 0 ? Math.round((amount / orderTotal) * 100) : 0)
  }, [orderTotal])

  // Reset in zapri
  const resetAndClose = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
    setPaymentMethod('')
    setTipAmount(0)
    setTipPercent(0)
    setSplitCount(1)
    setActiveTab('single')
    setGuestAssignments({})
    setGiftCardNumber('')
    setLoyaltySearch('')
    setSelectedAltPayment('')
    setSelectedGiftCardId(null)
    setSelectedLoyaltyId(null)
    setCashReceived(0)
    setPaymentSuccess(false)
    onClose()
  }, [onClose])

  // Schedule close helper
  const scheduleClose = useCallback(() => {
    closeTimeoutRef.current = setTimeout(() => {
      resetAndClose()
    }, 1500)
  }, [resetAndClose])

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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [])

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
    altPayments: altPayments || [],
    giftCards: giftCards || [],
    loyaltyResults: loyaltyResults || [],
    // Handlerji
    handleTipPercent, handleCustomTip,
    processPaymentIsPending: processPaymentMutation.isPending,
    handleSinglePayment,
    handleSplitPayment,
    handlePayByItems,
    resetAndClose,
  }
}
