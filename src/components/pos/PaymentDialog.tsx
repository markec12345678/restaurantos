'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CreditCard, Heart, CheckCircle2, Split, Users } from 'lucide-react'
import { useState, useRef, useEffect, memo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
// Sub-component imports
import { PaymentSuccessAnimation } from './payment/PaymentSuccessAnimation'
import { CashPaymentSection } from './payment/CashPaymentSection'
import { GiftCardSection } from './payment/GiftCardSection'
import { LoyaltySection } from './payment/LoyaltySection'
import { AlternatePaymentSection } from './payment/AlternatePaymentSection'
import { SplitPaymentTab } from './payment/SplitPaymentTab'
import { ByItemsTab } from './payment/ByItemsTab'
import { tipPresets, paymentMethods } from './payment/constants'
import type { PaymentDialogProps } from './payment/types'

// ============================================
// KOMPONENTA
// ============================================
export const PaymentDialog = memo(function PaymentDialog({ order, open, onClose, onPaymentSuccess }: PaymentDialogProps) {
  const queryClient = useQueryClient()
  const [paymentMethod, setPaymentMethod] = useState('')
  const [tipAmount, setTipAmount] = useState(0)
  const [tipPercent, setTipPercent] = useState(0)
  const [splitCount, setSplitCount] = useState(1)
  const [activeTab, setActiveTab] = useState('single')
  // Split by items state
  const [guestAssignments, setGuestAssignments] = useState<Record<string, number>>({}) // orderItemId -> guestNumber
  // Alternate payment, gift card, loyalty
  const [giftCardNumber, setGiftCardNumber] = useState('')
  const [loyaltySearch, setLoyaltySearch] = useState('')
  const [selectedAltPayment, setSelectedAltPayment] = useState('')
  const [selectedGiftCardId, setSelectedGiftCardId] = useState<string | null>(null)
  const [selectedLoyaltyId, setSelectedLoyaltyId] = useState<string | null>(null)
  const [cashReceived, setCashReceived] = useState(0)
  // FIX CRITICAL: Double-click guard za split/by-items plačila
  const [isProcessing, setIsProcessing] = useState(false)
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
  const handleTipPercent = useCallback((pct: number) => {
    setTipPercent(pct)
    setTipAmount(Math.round(orderTotal * pct) / 100)
  }, [orderTotal])
  const handleCustomTip = useCallback((val: string) => {
    const amount = parseFloat(val) || 0
    setTipAmount(amount)
    setTipPercent(orderTotal > 0 ? Math.round((amount / orderTotal) * 100) : 0)
  }, [orderTotal])
  // ============================================
  // CHECK-BASED PLAČILO (Toast POS standard)
  // Avtomatski tok: Check → Payment → Order → Receipt → FURS → Print
  // ============================================
  const processPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!order) return null
      // FIX BUG-04: Prepreči podvojene čeke — ponovno uporabi obstoječi neplačani ček
      let checkId: string | undefined
      // Poišči obstoječ neplačan ček za to naročilo
      const existingChecksRes = await authFetch(`/api/checks?orderId=${order.id}&paymentStatus=unpaid`)
      if (existingChecksRes.ok) {
        const checksData = await existingChecksRes.json()
        const unpaidCheck = checksData.checks?.find((c: { paymentStatus: string }) => c.paymentStatus === 'unpaid')
        if (unpaidCheck) {
          checkId = unpaidCheck.id
        }
      }
      if (!checkId) {
        // Ustvari nov ček samo če ne obstaja
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
          amount: orderTotal, // FIX CRITICAL: amount = check total (brez napitnine), tipAmount je ločeno
          tipAmount: tipAmount,
          type: paymentMethod === 'cash' ? 'cash' : paymentMethod === 'card' ? 'card' : paymentMethod === 'mobile' ? 'mobile' : paymentMethod === 'giftcard' ? 'giftcard' : paymentMethod === 'loyalty' ? 'loyalty' : paymentMethod === 'alternate' ? 'alternate' : paymentMethod === 'split' ? 'split' : 'cash',
          alternatePaymentTypeId: paymentMethod === 'alternate' ? selectedAltPayment : null,
          giftCardId: paymentMethod === 'giftcard' ? selectedGiftCardId : null,
          loyaltyAccountId: paymentMethod === 'loyalty' ? selectedLoyaltyId : null,
          // FIX CRITICAL: loyaltyPointsUsed — 1 točka = 1€ (ne * 100!)
          loyaltyPointsUsed: paymentMethod === 'loyalty' && selectedLoyaltyId ? Math.round(orderTotal) : 0,
        }),
      })
      if (!paymentRes.ok) throw new Error('Napaka pri ustvarjanju plačila')
      // 3. Posodobi naročilo
      // FIX: Include tip amount in order update so order.tip is correct
      const orderRes = await authFetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          paymentStatus: 'paid',
          paymentMethod: paymentMethod === 'split' ? 'split' : paymentMethod,
          // FIX: Only set status='completed' if order is already 'ready'
          // Otherwise the status state machine will reject the transition
          ...(order.status === 'ready' ? { status: 'completed' } : {}),
          // FIX: Send tip amount to order
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
            // FURS overitev ni uspela — račun je še vedno veljaven, samo ni davčno overjen
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
            // Tiskanje ni uspelo — račun je ustvarjen, lahko se natisne kasneje
            toast.warning('Tiskanje ni uspelo')
          }
        }
      } catch {
        // Račun ni bil ustvarjen — plačilo je še vedno veljavno, račun se lahko ustvari ročno
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
      // Obvesti nadrejeno komponento o uspelem plačilu (za prikaz računa)
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
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [])
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
  // FIX H-04: Split payment — ustvari N ločenih plačil namesto enega
  const handleSplitPayment = useCallback(async () => {
    if (!order || isProcessing) return
    setIsProcessing(true)
    try {
      // FIX BUG-04: Prepreči podvojene čeke — ponovno uporabi obstoječi neplačani ček
      let splitCheckId: string | undefined
      const existingSplitChecksRes = await authFetch(`/api/checks?orderId=${order.id}&paymentStatus=unpaid`)
      if (existingSplitChecksRes.ok) {
        const checksData = await existingSplitChecksRes.json()
        const unpaidCheck = checksData.checks?.find((c: { paymentStatus: string }) => c.paymentStatus === 'unpaid')
        if (unpaidCheck) {
          splitCheckId = unpaidCheck.id
        }
      }
      if (!splitCheckId) {
        const checkRes = await authFetch('/api/checks', {
          method: 'POST',
          body: JSON.stringify({
            orderId: order.id,
            orderItemIds: order.orderItems.map(oi => oi.id),
          }),
        })
        if (!checkRes.ok) throw new Error('Napaka pri ustvarjanju čeka')
        const checkData = await checkRes.json()
        splitCheckId = checkData.id
      }
      const check = { id: splitCheckId }
      // 2. Ustvari N ločenih plačil (zadnje absorbira razliko za zaokroževanje)
      // FIX MEDIUM: Split payment amount = orderTotal brez napitnine (tipAmount je ločeno)
      // Če se napitnina porazdeli, se prišteje k vsakem paymentu
      const payments: { amount: number; tipPortion: number }[] = []
      const splitBase = Math.floor((orderTotal / splitCount) * 100) / 100
      for (let i = 0; i < splitCount; i++) {
        const amount = i === splitCount - 1
          ? Math.round((orderTotal - splitBase * (splitCount - 1)) * 100) / 100
          : splitBase
        const tipPortion = i === splitCount - 1
          ? Math.round((tipAmount - Math.round((tipAmount / splitCount) * 100) / 100 * (splitCount - 1)) * 100) / 100
          : Math.round((tipAmount / splitCount) * 100) / 100
        payments.push({ amount, tipPortion })
      }
      for (let i = 0; i < payments.length; i++) {
        const paymentRes = await authFetch('/api/payments', {
          method: 'POST',
          body: JSON.stringify({
            checkId: check.id,
            amount: payments[i].amount,
            tipAmount: payments[i].tipPortion,
            // FIX: Use the actual selected payment method, not hardcoded 'cash'
            type: paymentMethod === 'cash' ? 'cash' : paymentMethod === 'card' ? 'card' : paymentMethod === 'mobile' ? 'mobile' : paymentMethod === 'split' ? 'split' : 'cash',
          }),
        })
        if (!paymentRes.ok) throw new Error(`Napaka pri ustvarjanju plačila ${i + 1}`)
      }
      // 3. Posodobi naročilo
      // FIX: Include tip, and respect status state machine
      const orderRes = await authFetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          paymentStatus: 'paid',
          paymentMethod: 'split',
          ...(order.status === 'ready' ? { status: 'completed' } : {}),
          tip: tipAmount,
          totalWithTip: orderTotal + tipAmount,
        }),
      })
      if (!orderRes.ok) throw new Error('Napaka pri posodobitvi naročila')
      // FIX MEDIUM: Split payment — ustvari račun in FURS overitev
      try {
        const receiptRes = await authFetch(`/api/receipts/${order.id}`, {
          method: 'POST',
          body: JSON.stringify({ paymentMethod: 'split', isStorno: false }),
        })
        if (receiptRes.ok) {
          try {
            await authFetch('/api/furs', {
              method: 'POST',
              body: JSON.stringify({ orderId: order.id }),
            })
          } catch { /* FURS overitev ni kritična za split payment */ }
        }
      } catch { /* Račun ni bil ustvarjen — plačilo je še vedno veljavno */ }
      toast.success(`Plačilo uspešno! ${splitCount}x €${splitAmount.toFixed(2)}`)
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.tables.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.cashRegister.all })
      queryClient.invalidateQueries({ queryKey: ['checks'] })
      if (onPaymentSuccess && order.id) onPaymentSuccess(order.id)
      resetAndClose()
    } catch {
      toast.error('Napaka pri obdelavi deljenega plačila')
    } finally {
      setIsProcessing(false)
    }
  }, [order, isProcessing, orderTotal, splitCount, tipAmount, paymentMethod, splitAmount, queryClient, onPaymentSuccess, resetAndClose])
  // FIX: By-items payment handler — ustvari ločen check za vsakega gosta
  const handlePayByItems = useCallback(async () => {
    if (!order || isProcessing) return
    setIsProcessing(true)
    try {
      // Ustvari ločen check za vsakega gosta
      const guestCount = Math.max(splitCount, 2)
      for (let g = 1; g <= guestCount; g++) {
        const guestItemIds = order.orderItems
          .filter(oi => guestAssignments[oi.id] === g)
          .map(oi => oi.id)
        if (guestItemIds.length === 0) continue
        const checkRes = await authFetch('/api/checks', {
          method: 'POST',
          body: JSON.stringify({ orderId: order.id, orderItemIds: guestItemIds }),
        })
        if (!checkRes.ok) throw new Error('Napaka pri ustvarjanju čeka')
        const check = await checkRes.json()
        const guestTotal = order.orderItems
          .filter(oi => guestAssignments[oi.id] === g)
          .reduce((sum, oi) => sum + oi.price * oi.quantity, 0)
        await authFetch('/api/payments', {
          method: 'POST',
          body: JSON.stringify({
            checkId: check.id,
            amount: guestTotal,
            tipAmount: 0,
            type: 'cash',
            status: 'completed',
          }),
        })
      }
      await authFetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          paymentStatus: 'paid',
          paymentMethod: 'split',
          // FIX: Only set completed if order is ready (respects status state machine)
          ...(order.status === 'ready' ? { status: 'completed' } : {}),
        }),
      })
      toast.success('Plačilo po artiklih uspešno!')
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.tables.all })
      if (onPaymentSuccess && order.id) onPaymentSuccess(order.id)
      resetAndClose()
    } catch {
      toast.error('Napaka pri obdelavi plačila po artiklih')
    } finally {
      setIsProcessing(false)
    }
  }, [order, isProcessing, splitCount, guestAssignments, queryClient, onPaymentSuccess, resetAndClose])

  if (!order) return null
  return (
    <Dialog open={open} onOpenChange={() => { if (!paymentSuccess) resetAndClose() }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <AnimatePresence mode="wait">
          {paymentSuccess ? (
            <PaymentSuccessAnimation totalWithTip={totalWithTip} />
          ) : (
            <motion.div key="payment" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Plačilo #{order.orderNumber}</span>
            <Badge variant="outline" className="text-sm font-bold">
              €{orderTotal.toFixed(2)}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Povzetek naročila */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Vmesna vsota</span>
              <span>€{order.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>DDV</span>
              <span>€{order.tax.toFixed(2)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Popust</span>
                <span>-€{order.discount.toFixed(2)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold">
              <span>Skupaj</span>
              <span>€{orderTotal.toFixed(2)}</span>
            </div>
            <Separator />
            <div className="space-y-0.5">
              {order.orderItems.map(oi => (
                <div key={oi.id} className="flex justify-between text-xs text-muted-foreground">
                  <span>{oi.quantity}x {oi.menuItem.name}</span>
                  <span>€{(oi.price * oi.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Napitnina */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Heart className="h-4 w-4 text-rose-500" />
              <span className="text-sm font-semibold">Napitnina</span>
            </div>
            <div className="flex gap-1.5 mb-2">
              {tipPresets.map(pct => (
                <button
                  key={pct}
                  onClick={() => handleTipPercent(pct)}
                  className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    tipPercent === pct && (pct > 0 || tipAmount === 0)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {pct === 0 ? 'Brez' : `${pct}%`}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Znesek:</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={tipAmount || ''}
                onChange={e => handleCustomTip(e.target.value)}
                className="h-7 text-xs w-24"
                placeholder="0.00"
                aria-label="Znesek napitnine"
                autoFocus
              />
              <span className="text-xs text-muted-foreground">€</span>
            </div>
          </div>
          {tipAmount > 0 && (
            <div className="flex justify-between font-bold text-base bg-rose-50 dark:bg-rose-900/20 p-2 rounded-lg">
              <span className="flex items-center gap-2"><Heart className="h-3.5 w-3.5 text-rose-500" /> Skupaj z napitnino</span>
              <span>€{totalWithTip.toFixed(2)}</span>
            </div>
          )}
          {/* Plačilni zavihki */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="single" className="flex-1 text-xs">
                <CreditCard className="h-3 w-3 mr-1" />
                Eno plačilo
              </TabsTrigger>
              <TabsTrigger value="split" className="flex-1 text-xs">
                <Split className="h-3 w-3 mr-1" />
                Deljeno
              </TabsTrigger>
              <TabsTrigger value="byitems" className="flex-1 text-xs">
                <Users className="h-3 w-3 mr-1" />
                Po artiklih
              </TabsTrigger>
            </TabsList>
            {/* Eno plačilo */}
            <TabsContent value="single" className="space-y-3">
              <div>
                <p className="text-xs font-semibold mb-2">Način plačila</p>
                <div className="grid grid-cols-3 gap-2">
                  {paymentMethods.map(pm => {
                    const Icon = pm.icon
                    const isSelected = paymentMethod === pm.id
                    return (
                      <button
                        key={pm.id}
                        onClick={() => setPaymentMethod(pm.id)}
                        className={`flex flex-col items-center gap-1.5 py-3 rounded-lg border-2 transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : 'border-border hover:bg-accent'
                        }`}
                      >
                        <Icon className={`h-5 w-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="text-[11px] font-semibold">{pm.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              {/* FIX M-14: Hitri zneski za gotovino z vračilom */}
              {paymentMethod === 'cash' && (
                <CashPaymentSection
                  totalWithTip={totalWithTip}
                  cashReceived={cashReceived}
                  setCashReceived={setCashReceived}
                  setTipAmount={setTipAmount}
                  setTipPercent={setTipPercent}
                />
              )}
              {/* Darilna kartica izbira */}
              {paymentMethod === 'giftcard' && (
                <GiftCardSection
                  giftCards={giftCards || []}
                  giftCardNumber={giftCardNumber}
                  setGiftCardNumber={setGiftCardNumber}
                  selectedGiftCardId={selectedGiftCardId}
                  setSelectedGiftCardId={setSelectedGiftCardId}
                />
              )}
              {/* Zvestobni račun */}
              {paymentMethod === 'loyalty' && (
                <LoyaltySection
                  loyaltyResults={loyaltyResults || []}
                  loyaltySearch={loyaltySearch}
                  setLoyaltySearch={setLoyaltySearch}
                  selectedLoyaltyId={selectedLoyaltyId}
                  setSelectedLoyaltyId={setSelectedLoyaltyId}
                />
              )}
              {/* Alternativno plačilo */}
              {paymentMethod === 'alternate' && (
                <AlternatePaymentSection
                  altPayments={altPayments || []}
                  selectedAltPayment={selectedAltPayment}
                  setSelectedAltPayment={setSelectedAltPayment}
                />
              )}
              <Button
                className="w-full h-12 text-base font-bold"
                disabled={!paymentMethod || processPaymentMutation.isPending}
                onClick={handleSinglePayment}
              >
                {processPaymentMutation.isPending ? (
                  'Obdelujem...'
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Plačaj €{totalWithTip.toFixed(2)} ({paymentMethods.find(p => p.id === paymentMethod)?.label || ''})
                  </>
                )}
              </Button>
            </TabsContent>
            {/* Deljeno plačilo */}
            <TabsContent value="split">
              <SplitPaymentTab
                splitCount={splitCount}
                setSplitCount={setSplitCount}
                totalWithTip={totalWithTip}
                tipAmount={tipAmount}
                splitAmount={splitAmount}
                isProcessing={isProcessing}
                processPaymentIsPending={processPaymentMutation.isPending}
                onPaySplit={handleSplitPayment}
              />
            </TabsContent>
            {/* ─── Deli po artiklih ─── */}
            <TabsContent value="byitems">
              <ByItemsTab
                order={order}
                splitCount={splitCount}
                guestAssignments={guestAssignments}
                setGuestAssignments={setGuestAssignments}
                isProcessing={isProcessing}
                processPaymentIsPending={processPaymentMutation.isPending}
                onPayByItems={handlePayByItems}
              />
            </TabsContent>
          </Tabs>
        </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
})
