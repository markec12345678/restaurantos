'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { PaymentDialogProps } from '../types'

export function usePaymentState({ order, open: _open, onClose }: PaymentDialogProps) {
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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [])

  return {
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
  }
}
