'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CreditCard, Banknote, Smartphone, Split, Heart, CheckCircle2, Gift, Star, Ticket } from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'

// ============================================
// TIPI
// ============================================
interface OrderItemType {
  id: string
  menuItem: { name: string }
  quantity: number
  price: number
  vatRate: number
}

interface PaymentDialogProps {
  order: {
    id: string
    orderNumber: number
    total: number
    subtotal: number
    tax: number
    discount: number
    tip: number
    orderItems: OrderItemType[]
  } | null
  open: boolean
  onClose: () => void
  onPaymentSuccess?: (orderId: string) => void
}

// ============================================
// KOMPONENTA
// ============================================
export function PaymentDialog({ order, open, onClose, onPaymentSuccess }: PaymentDialogProps) {
  const queryClient = useQueryClient()
  const [paymentMethod, setPaymentMethod] = useState('')
  const [tipAmount, setTipAmount] = useState(0)
  const [tipPercent, setTipPercent] = useState(0)
  const [splitCount, setSplitCount] = useState(1)
  const [activeTab, setActiveTab] = useState('single')

  // Alternate payment, gift card, loyalty
  const [giftCardNumber, setGiftCardNumber] = useState('')
  const [loyaltySearch, setLoyaltySearch] = useState('')
  const [selectedAltPayment, setSelectedAltPayment] = useState('')
  const [selectedGiftCardId, setSelectedGiftCardId] = useState<string | null>(null)
  const [selectedLoyaltyId, setSelectedLoyaltyId] = useState<string | null>(null)
  const [cashReceived, setCashReceived] = useState(0)

  const orderTotal = order?.total || 0
  const totalWithTip = orderTotal + tipAmount
  const splitAmount = Math.floor((totalWithTip / splitCount) * 100) / 100
  const cashChange = Math.max(0, cashReceived - totalWithTip)

  const tipPresets = [0, 5, 10, 15, 20]

  // Naloži alternativna plačila
  const { data: altPayments } = useQuery({
    queryKey: ['alt-payment-types'],
    queryFn: async () => {
      const res = await fetch('/api/configuration/alt-payment-types')
      if (!res.ok) return []
      return res.json()
    },
    enabled: open,
  })

  // Naloži darilne kartice
  const { data: giftCards } = useQuery({
    queryKey: ['gift-cards'],
    queryFn: async () => {
      const res = await fetch('/api/gift-cards')
      if (!res.ok) return []
      return res.json()
    },
    enabled: open && paymentMethod === 'giftcard',
  })

  // Išči zvestobni račun
  const { data: loyaltyResults } = useQuery({
    queryKey: ['loyalty-search', loyaltySearch],
    queryFn: async () => {
      if (!loyaltySearch || loyaltySearch.length < 2) return []
      const res = await fetch(`/api/loyalty?search=${encodeURIComponent(loyaltySearch)}`)
      if (!res.ok) return []
      return res.json()
    },
    enabled: open && paymentMethod === 'loyalty' && loyaltySearch.length >= 2,
  })

  const handleTipPercent = (pct: number) => {
    setTipPercent(pct)
    setTipAmount(Math.round(orderTotal * pct) / 100)
  }

  const handleCustomTip = (val: string) => {
    const amount = parseFloat(val) || 0
    setTipAmount(amount)
    setTipPercent(orderTotal > 0 ? Math.round((amount / orderTotal) * 100) : 0)
  }

  // ============================================
  // CHECK-BASED PLAČILO (Toast POS standard)
  // ============================================
  const processPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!order) return null

      // 1. Ustvari Check za naročilo
      const checkRes = await authFetch('/api/checks', {
        method: 'POST',
        body: JSON.stringify({
          orderId: order.id,
          orderItemIds: order.orderItems.map(oi => oi.id),
        }),
      })
      if (!checkRes.ok) throw new Error('Napaka pri ustvarjanju čeka')
      const check = await checkRes.json()

      // 2. Ustvari Payment za Check
      const paymentRes = await authFetch('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          checkId: check.id,
          amount: totalWithTip,
          tipAmount: tipAmount,
          type: paymentMethod === 'cash' ? 'cash' : paymentMethod === 'card' ? 'card' : paymentMethod === 'mobile' ? 'mobile' : paymentMethod === 'giftcard' ? 'giftcard' : paymentMethod === 'loyalty' ? 'loyalty' : paymentMethod === 'alternate' ? 'alternate' : paymentMethod === 'split' ? 'split' : 'cash',
          alternatePaymentTypeId: paymentMethod === 'alternate' ? selectedAltPayment : null,
          giftCardId: paymentMethod === 'giftcard' ? selectedGiftCardId : null,
          loyaltyAccountId: paymentMethod === 'loyalty' ? selectedLoyaltyId : null,
          status: 'completed',
        }),
      })
      if (!paymentRes.ok) throw new Error('Napaka pri ustvarjanju plačila')

      // 3. Posodobi naročilo
      const orderRes = await authFetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          paymentStatus: 'paid',
          paymentMethod: paymentMethod === 'split' ? 'split' : paymentMethod,
          status: 'completed',
        }),
      })
      if (!orderRes.ok) throw new Error('Napaka pri posodobitvi naročila')
      return orderRes.json()
    },
    onSuccess: (data) => {
      toast.success('Plačilo uspešno obdelano! Ček ustvarjen.')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      queryClient.invalidateQueries({ queryKey: ['kitchen'] })
      queryClient.invalidateQueries({ queryKey: ['cash-register'] })
      queryClient.invalidateQueries({ queryKey: ['checks'] })
      // Obvesti nadrejeno komponento o uspelem plačilu (za samodejni račun)
      if (onPaymentSuccess && data?.id) {
        onPaymentSuccess(data.id)
      }
      setPaymentSuccess(true)
      setTimeout(() => {
        resetAndClose()
      }, 1500)
    },
    onError: () => {
      toast.error('Napaka pri obdelavi plačila')
    },
  })

  const [paymentSuccess, setPaymentSuccess] = useState(false)

  const resetAndClose = () => {
    setPaymentMethod('')
    setTipAmount(0)
    setTipPercent(0)
    setSplitCount(1)
    setActiveTab('single')
    setGiftCardNumber('')
    setLoyaltySearch('')
    setSelectedAltPayment('')
    setSelectedGiftCardId(null)
    setSelectedLoyaltyId(null)
    setCashReceived(0)
    setPaymentSuccess(false)
    onClose()
  }

  const handleSinglePayment = () => {
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
  }

  // FIX H-04: Split payment — ustvari N ločenih plačil namesto enega
  const handleSplitPayment = async () => {
    if (!order) return
    try {
      // 1. Ustvari en Check za celotno naročilo
      const checkRes = await authFetch('/api/checks', {
        method: 'POST',
        body: JSON.stringify({
          orderId: order.id,
          orderItemIds: order.orderItems.map(oi => oi.id),
        }),
      })
      if (!checkRes.ok) throw new Error('Napaka pri ustvarjanju čeka')
      const check = await checkRes.json()

      // 2. Ustvari N ločenih plačil (zadnje absorbira razliko za zaokroževanje)
      const payments: { amount: number; tipPortion: number }[] = []
      for (let i = 0; i < splitCount; i++) {
        const amount = i === splitCount - 1
          ? Math.round((totalWithTip - splitAmount * (splitCount - 1)) * 100) / 100
          : splitAmount
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
            type: 'cash',
            status: 'completed',
          }),
        })
        if (!paymentRes.ok) throw new Error(`Napaka pri ustvarjanju plačila ${i + 1}`)
      }

      // 3. Posodobi naročilo
      const orderRes = await authFetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          paymentStatus: 'paid',
          paymentMethod: 'split',
          status: 'completed',
        }),
      })
      if (!orderRes.ok) throw new Error('Napaka pri posodobitvi naročila')

      toast.success(`Plačilo uspešno! ${splitCount}x €${splitAmount.toFixed(2)}`)
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      queryClient.invalidateQueries({ queryKey: ['kitchen'] })
      queryClient.invalidateQueries({ queryKey: ['cash-register'] })
      queryClient.invalidateQueries({ queryKey: ['checks'] })
      if (onPaymentSuccess && order.id) onPaymentSuccess(order.id)
      resetAndClose()
    } catch {
      toast.error('Napaka pri obdelavi deljenega plačila')
    }
  }

  const paymentMethods = [
    { id: 'cash', label: 'Gotovina', icon: Banknote, color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
    { id: 'card', label: 'Kartično', icon: CreditCard, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
    { id: 'mobile', label: 'Mobilno', icon: Smartphone, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
    { id: 'giftcard', label: 'Darilna kartica', icon: Gift, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
    { id: 'loyalty', label: 'Zvestoba', icon: Star, color: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400' },
    { id: 'alternate', label: 'Bon/Vavčer', icon: Ticket, color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400' },
  ]

  const quickCashAmounts = [5, 10, 20, 50, 100]

  if (!order) return null

  return (
    <Dialog open={open} onOpenChange={() => { if (!paymentSuccess) resetAndClose() }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <AnimatePresence mode="wait">
          {paymentSuccess ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3, type: 'spring' }}
              className="flex flex-col items-center justify-center py-12 gap-4"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                className="h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: 'spring', stiffness: 300 }}
                >
                  <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
                </motion.div>
              </motion.div>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-lg font-bold text-emerald-700 dark:text-emerald-400"
              >
                Plačilo uspešno!
              </motion.p>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-sm text-muted-foreground"
              >
                €{totalWithTip.toFixed(2)}
              </motion.p>
            </motion.div>
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
                <div>
                  <p className="text-xs font-semibold mb-1.5">Hitri zneski</p>
                  <div className="flex gap-1.5 mb-2">
                    {quickCashAmounts.map(amount => {
                      const change = amount - totalWithTip
                      return (
                        <button
                          key={amount}
                          onClick={() => {
                            setCashReceived(amount)
                            if (amount > totalWithTip) {
                              setTipAmount(0)
                              setTipPercent(0)
                            }
                          }}
                          className={`flex-1 py-2 rounded-md text-xs font-bold transition-colors touch-manipulation ${
                            amount >= totalWithTip
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-muted text-muted-foreground hover:bg-accent'
                          }`}
                        >
                          €{amount}
                        </button>
                      )
                    })}
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Znesek za plačilo:</span>
                      <span className="font-bold">€{totalWithTip.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Prejeto:</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={cashReceived || ''}
                        onChange={(e) => setCashReceived(parseFloat(e.target.value) || 0)}
                        className="h-7 text-xs w-24"
                        placeholder={totalWithTip.toFixed(2)}
                      />
                      <span className="text-xs">€</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold">Vračilo:</span>
                      <span className={`font-bold ${cashChange > 0 ? 'text-emerald-700 dark:text-emerald-400' : cashReceived > 0 ? 'text-red-600' : 'text-emerald-700 dark:text-emerald-400'}`}>€{cashChange.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Darilna kartica izbira */}
              {paymentMethod === 'giftcard' && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold">Izberi darilno kartico</p>
                  <Input
                    placeholder="Išči po številki kartice..."
                    value={giftCardNumber}
                    onChange={e => setGiftCardNumber(e.target.value)}
                    className="h-8 text-xs"
                  />
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {(giftCards || [])
                      .filter((gc: { cardNumber: string; status: string; balance: number }) =>
                        gc.status === 'active' && gc.balance > 0 &&
                        (!giftCardNumber || gc.cardNumber.toLowerCase().includes(giftCardNumber.toLowerCase()))
                      )
                      .map((gc: { id: string; cardNumber: string; ownerName: string; balance: number }) => (
                        <button
                          key={gc.id}
                          onClick={() => setSelectedGiftCardId(gc.id)}
                          className={`w-full flex items-center justify-between p-2 rounded-md text-xs transition-colors ${
                            selectedGiftCardId === gc.id
                              ? 'bg-primary/10 border-primary border'
                              : 'bg-muted/50 hover:bg-muted'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Gift className="h-3.5 w-3.5" />
                            <span className="font-mono font-medium">{gc.cardNumber}</span>
                            {gc.ownerName && <span className="text-muted-foreground">({gc.ownerName})</span>}
                          </div>
                          <span className="font-bold">€{gc.balance.toFixed(2)}</span>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Zvestobni račun */}
              {paymentMethod === 'loyalty' && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold">Išči zvestobni račun</p>
                  <Input
                    placeholder="Ime, telefon ali email..."
                    value={loyaltySearch}
                    onChange={e => setLoyaltySearch(e.target.value)}
                    className="h-8 text-xs"
                  />
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {(loyaltyResults || []).map((la: { id: string; customerName: string; phone: string; pointsBalance: number; tier: string }) => (
                      <button
                        key={la.id}
                        onClick={() => setSelectedLoyaltyId(la.id)}
                        className={`w-full flex items-center justify-between p-2 rounded-md text-xs transition-colors ${
                          selectedLoyaltyId === la.id
                            ? 'bg-primary/10 border-primary border'
                            : 'bg-muted/50 hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Star className="h-3.5 w-3.5" />
                          <span className="font-medium">{la.customerName}</span>
                          <span className="text-muted-foreground">{la.phone}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-[9px] h-4">{la.tier}</Badge>
                          <span className="font-bold">{la.pointsBalance} točk</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Alternativno plačilo */}
              {paymentMethod === 'alternate' && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold">Izberi vrsto</p>
                  <div className="space-y-1">
                    {(altPayments || []).map((apt: { id: string; name: string; code: string; type: string }) => (
                      <button
                        key={apt.id}
                        onClick={() => setSelectedAltPayment(apt.id)}
                        className={`w-full flex items-center justify-between p-2 rounded-md text-xs transition-colors ${
                          selectedAltPayment === apt.id
                            ? 'bg-primary/10 border-primary border'
                            : 'bg-muted/50 hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Ticket className="h-3.5 w-3.5" />
                          <span className="font-medium">{apt.name}</span>
                          <span className="text-muted-foreground">({apt.code})</span>
                        </div>
                        <Badge variant="secondary" className="text-[9px] h-4">{apt.type}</Badge>
                      </button>
                    ))}
                  </div>
                </div>
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
            <TabsContent value="split" className="space-y-3">
              <div>
                <p className="text-xs font-semibold mb-2">Število oseb</p>
                <div className="flex gap-1.5">
                  {[2, 3, 4, 5, 6].map(n => (
                    <button
                      key={n}
                      onClick={() => setSplitCount(n)}
                      className={`flex-1 py-2 rounded-md text-sm font-bold transition-colors ${
                        splitCount === n
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-accent'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Vsaka oseba plača</p>
                  <p className="text-3xl font-bold text-primary">€{splitAmount.toFixed(2)}</p>
                </div>
                <Separator />
                <div className="space-y-1">
                  {Array.from({ length: splitCount }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1">
                      <span className="text-muted-foreground">Oseba {i + 1}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">€{splitAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Skupaj ({splitCount} oseb)</span>
                  <span className="font-bold">€{totalWithTip.toFixed(2)}</span>
                </div>
                {tipAmount > 0 && (
                  <div className="flex justify-between text-xs text-rose-600">
                    <span>Od tega napitnina</span>
                    <span>€{tipAmount.toFixed(2)} (€{(tipAmount / splitCount).toFixed(2)}/osebo)</span>
                  </div>
                )}
              </div>

              <Button
                className="w-full h-12 text-base font-bold"
                disabled={processPaymentMutation.isPending}
                onClick={handleSplitPayment}
              >
                {processPaymentMutation.isPending ? (
                  'Obdelujem...'
                ) : (
                  <>
                    <Split className="h-4 w-4 mr-2" />
                    Plačaj deljeno ({splitCount}x €{splitAmount.toFixed(2)})
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>
        </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}
