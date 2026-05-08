'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CreditCard, Banknote, Smartphone, Percent, Split, Heart, CheckCircle2, Receipt } from 'lucide-react'
import { useState, useMemo } from 'react'
import { toast } from 'sonner'

// ============================================
// TIPI
// ============================================
interface OrderItemType {
  id: string
  menuItem: { name: string }
  quantity: number
  price: number
}

interface PaymentDialogProps {
  order: {
    id: string
    orderNumber: number
    total: number
    subtotal: number
    tax: number
    discount: number
    orderItems: OrderItemType[]
  } | null
  open: boolean
  onClose: () => void
}

// ============================================
// KOMPONENTA
// ============================================
export function PaymentDialog({ order, open, onClose }: PaymentDialogProps) {
  const queryClient = useQueryClient()
  const [paymentMethod, setPaymentMethod] = useState('')
  const [tipAmount, setTipAmount] = useState(0)
  const [tipPercent, setTipPercent] = useState(0)
  const [splitCount, setSplitCount] = useState(1)
  const [splitPayments, setSplitPayments] = useState<Array<{ method: string; amount: number }>>([])
  const [activeTab, setActiveTab] = useState('single')

  const orderTotal = order?.total || 0
  const totalWithTip = orderTotal + tipAmount
  const splitAmount = splitCount > 0 ? totalWithTip / splitCount : totalWithTip

  const tipPresets = [0, 5, 10, 15, 20]

  const handleTipPercent = (pct: number) => {
    setTipPercent(pct)
    setTipAmount(Math.round(orderTotal * pct) / 100)
  }

  const handleCustomTip = (val: string) => {
    const amount = parseFloat(val) || 0
    setTipAmount(amount)
    setTipPercent(orderTotal > 0 ? Math.round((amount / orderTotal) * 100) : 0)
  }

  const processPaymentMutation = useMutation({
    mutationFn: async ({ id, method, tip }: { id: string; method: string; tip: number }) => {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentStatus: 'paid',
          paymentMethod: method,
          total: (order?.total || 0) + tip,
        }),
      })
      if (!res.ok) throw new Error('Failed to process payment')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Plačilo uspešno obdelano!')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      queryClient.invalidateQueries({ queryKey: ['kitchen'] })
      resetAndClose()
    },
    onError: () => {
      toast.error('Napaka pri obdelavi plačila')
    },
  })

  const resetAndClose = () => {
    setPaymentMethod('')
    setTipAmount(0)
    setTipPercent(0)
    setSplitCount(1)
    setSplitPayments([])
    setActiveTab('single')
    onClose()
  }

  const handleSinglePayment = () => {
    if (!paymentMethod) {
      toast.error('Izberite način plačila')
      return
    }
    if (!order) return
    processPaymentMutation.mutate({ id: order.id, method: paymentMethod, tip: tipAmount })
  }

  const handleSplitPayment = () => {
    if (!order) return
    // For split payment, we record as "split" method
    processPaymentMutation.mutate({ id: order.id, method: 'split', tip: tipAmount })
  }

  const paymentMethods = [
    { id: 'cash', label: 'Gotovina', icon: Banknote, color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
    { id: 'card', label: 'Kartično', icon: CreditCard, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
    { id: 'mobile', label: 'Mobilno', icon: Smartphone, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  ]

  if (!order) return null

  return (
    <Dialog open={open} onOpenChange={() => resetAndClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Plačilo #{order.orderNumber}</span>
            <Badge variant="outline" className="text-sm font-bold">
              €{orderTotal.toFixed(2)}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Order summary */}
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
          </div>

          {/* Tip section */}
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
              <span className="text-xs text-muted-foreground">
                €{tipAmount.toFixed(2)}
              </span>
            </div>
          </div>

          {tipAmount > 0 && (
            <div className="flex justify-between font-bold text-base bg-primary/5 p-2 rounded-lg">
              <span>Skupaj z napitnino</span>
              <span>€{totalWithTip.toFixed(2)}</span>
            </div>
          )}

          {/* Payment tabs: Single / Split */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="single" className="flex-1 text-xs">
                <CreditCard className="h-3 w-3 mr-1" />
                Eno plačilo
              </TabsTrigger>
              <TabsTrigger value="split" className="flex-1 text-xs">
                <Split className="h-3 w-3 mr-1" />
                Deljeno plačilo
              </TabsTrigger>
            </TabsList>

            {/* Single payment */}
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
                    Plačaj €{totalWithTip.toFixed(2)}
                  </>
                )}
              </Button>
            </TabsContent>

            {/* Split payment */}
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
                  <p className="text-2xl font-bold text-primary">€{splitAmount.toFixed(2)}</p>
                </div>
                <Separator />
                <div className="space-y-1">
                  {Array.from({ length: splitCount }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Oseba {i + 1}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">€{splitAmount.toFixed(2)}</span>
                        <Badge variant="outline" className="text-[9px] h-4 px-1">
                          {splitCount}x
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Skupaj ({splitCount} oseb)</span>
                  <span className="font-bold">€{totalWithTip.toFixed(2)}</span>
                </div>
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
      </DialogContent>
    </Dialog>
  )
}
