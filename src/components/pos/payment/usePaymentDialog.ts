'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useRef, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import type { PaymentDialogProps } from './types'
import { usePaymentHandlers } from './usePaymentHandlers'

// ============================================
// HOOK: Stanje in logika plačilnega dialoga
// ============================================

export function usePaymentDialog({ order, open, onClose, onPaymentSuccess }: PaymentDialogProps) {
  const queryClient = useQueryClient()
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

  // ============================================
  // CHECK-BASED PLAČILO (Toast POS standard)
  // Avtomatski tok: Check → Payment → Order → Receipt → FURS → Print
  // ============================================
  const processPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!order) return null
      // FIX BUG-04: Prepreči podvojene čeke — ponovno uporabi obstoječi neplačani ček
      let checkId: string | undefined
      const existingChecksRes = await authFetch(`/api/checks?orderId=${order.id}&paymentStatus=unpaid`)
      if (existingChecksRes.ok) {
        const checksData = await existingChecksRes.json()
        const unpaidCheck = checksData.checks?.find((c: { paymentStatus: string }) => c.paymentStatus === 'unpaid')
        if (unpaidCheck) {
          checkId = unpaidCheck.id
        }
      }
      if (!checkId) {
        const checkRes = await authFetch('/api/checks', {
          method: 'POST',
          body: JSON.stringify({
            orderId: order.id,
            orderItemIds: order.orderItems.map(oi => oi.id),
          }),
        })
        if (!checkRes.ok) throw new Error('Napaka pri ustvarjanju čeka')
        const checkData = await checkRes.json()
        checkId = checkData.id
      }
      const check = { id: checkId }
      // 2. Ustvari Payment za Check
      const paymentRes = await authFetch('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          checkId: check.id,
          amount: orderTotal,
          tipAmount: tipAmount,
          type: paymentMethod === 'cash' ? 'cash' : paymentMethod === 'card' ? 'card' : paymentMethod === 'mobile' ? 'mobile' : paymentMethod === 'giftcard' ? 'giftcard' : paymentMethod === 'loyalty' ? 'loyalty' : paymentMethod === 'alternate' ? 'alternate' : paymentMethod === 'split' ? 'split' : 'cash',
          alternatePaymentTypeId: paymentMethod === 'alternate' ? selectedAltPayment : null,
          giftCardId: paymentMethod === 'giftcard' ? selectedGiftCardId : null,
          loyaltyAccountId: paymentMethod === 'loyalty' ? selectedLoyaltyId : null,
          loyaltyPointsUsed: paymentMethod === 'loyalty' && selectedLoyaltyId ? Math.round(orderTotal) : 0,
        }),
      })
      if (!paymentRes.ok) throw new Error('Napaka pri ustvarjanju plačila')
      // 3. Posodobi naročilo
      const orderRes = await authFetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          paymentStatus: 'paid',
          paymentMethod: paymentMethod === 'split' ? 'split' : paymentMethod,
          ...(order.status === 'ready' ? { status: 'completed' } : {}),
          tip: tipAmount,
          totalWithTip: orderTotal + tipAmount,
        }),
      })
      if (!orderRes.ok) throw new Error('Napaka pri posodobitvi naročila')
      const updatedOrder = await orderRes.json()
      // ─── AUTO-RECEIPT: Avtomatsko ustvari račun v bazi ───
      try {
        const receiptRes = await authFetch(`/api/receipts/${order.id}`, {
          method: 'POST',
          body: JSON.stringify({
            paymentMethod: paymentMethod === 'split' ? 'split' : paymentMethod,
            isStorno: false,
          }),
        })
        if (receiptRes.ok) {
          const _receipt = await receiptRes.json()
          // ─── AUTO-FURS: Avtomatsko davčno overi račun ───
          try {
            const fursRes = await authFetch('/api/furs', {
              method: 'POST',
              body: JSON.stringify({ orderId: order.id }),
            })
            const fursResult = fursRes.ok ? await fursRes.json() : null
            if (fursResult?.success && !fursResult.isSimulation) {
              toast.success('Račun davčno overjen (FURS)', { duration: 3000 })
            } else if (fursResult?.success && fursResult.isSimulation) {
              toast.info('Račun overjen (FURS simulacija)', { duration: 3000 })
            }
          } catch {
            toast.warning('FURS overitev ni uspela, račun je brez davčnega overjanja')
          }
          // ─── AUTO-PRINT: Avtomatsko tiskaj na termični tiskalnik ───
          try {
            await authFetch('/api/print', {
              method: 'POST',
              body: JSON.stringify({ type: 'receipt', orderId: order.id }),
            })
            toast.info('Račun poslan na tiskalnik', { duration: 2000 })
          } catch {
            toast.warning('Tiskanje ni uspelo')
          }
        }
      } catch {
        toast.warning('Napaka pri ustvarjanju računa')
        toast.warning('Plačilo uspešno, vendar račun ni bil samodejno ustvarjen. Ustvarite ga ročno.')
      }
      return updatedOrder
    },
    onSuccess: (data) => {
      toast.success('Plačilo uspešno obdelano!')
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.tables.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.cashRegister.all })
      queryClient.invalidateQueries({ queryKey: ['checks'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.menuStock })
      if (onPaymentSuccess && data?.id) {
        onPaymentSuccess(data.id)
      }
      setPaymentSuccess(true)
      closeTimeoutRef.current = setTimeout(() => {
        resetAndClose()
      }, 1500)
    },
    onError: () => {
      toast.error('Napaka pri obdelavi plačila')
    },
  })

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
