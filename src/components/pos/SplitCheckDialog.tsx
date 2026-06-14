'use client'
// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Split Check Dialog
// Toast POS + Square standard: delitev računa po osebah, artiklih, enakih delih
// Napitnina, auto-gratuity za velike skupine, več načinov plačila
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo, useCallback, useEffect, memo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Split, Users, Equal, Receipt, Plus, Minus, Trash2, CreditCard, Banknote, Smartphone, CheckCircle2, PartyPopper, AlertTriangle, Calculator } from 'lucide-react'
// ─── Tipi ──────────────────────────────────────────────────────
interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  categoryId?: string
}
interface SplitParty {
  id: string
  name: string
  items: string[] // cartItem ids assigned to this party
  tipPercent: number
  tipAmount: number
  paymentMethod: 'cash' | 'card' | 'mobile'
  paid: boolean
}
interface SplitCheckDialogProps {
  open: boolean
  onClose: () => void
  orderTotal: number
  subtotal: number
  taxTotal: number
  cartItems: CartItem[]
  onConfirmSplit: (_parties: SplitParty[]) => void
  partySize?: number
  autoGratuityPercent?: number
  autoGratuityThreshold?: number
}
const _EU_ALLERGEN_MAP: Record<number, string> = {
  1: 'Žita', 2: 'Raki', 3: 'Jajca', 4: 'Ribe', 5: 'Arašidi',
  6: 'Soja', 7: 'Mleko', 8: 'Oreški', 9: 'Zeler', 10: 'Gorčica',
  11: 'Sesam', 12: 'Žveplov dioksid', 13: 'Volčji bob', 14: 'Mehkužci',
}
export const SplitCheckDialog = memo(function SplitCheckDialog({
  open,
  onClose,
  orderTotal,
  subtotal,
  taxTotal,
  cartItems,
  onConfirmSplit,
  partySize = 1,
  autoGratuityPercent = 0,
  autoGratuityThreshold = 6,
}: SplitCheckDialogProps) {
  const [splitMode, setSplitMode] = useState<'equal' | 'items' | 'custom'>('equal')
  // FIX BUG-07: Custom split — sledi zneskom za vsako osebo
  const [customAmounts, setCustomAmounts] = useState<Record<string, number>>({})
  const [parties, setParties] = useState<SplitParty[]>([
    { id: '1', name: 'Oseba 1', items: [], tipPercent: 0, tipAmount: 0, paymentMethod: 'card', paid: false },
  ])
  const [equalCount, setEqualCount] = useState(Math.max(partySize, 2))
  // FIX HIGH: Sync equalCount in parties ko se partySize spremeni
  useEffect(() => {
    setEqualCount(Math.max(partySize, 2))
  }, [partySize])
  // FIX HIGH: Sync parties array ko se partySize spremeni
  useEffect(() => {
    const needed = Math.max(partySize, 2)
    setParties(prev => {
      if (prev.length >= needed) return prev
      const newParties = [...prev]
      for (let i = prev.length; i < needed; i++) {
        newParties.push({ id: String(i + 1), name: `Oseba ${i + 1}`, items: [], tipPercent: 0, tipAmount: 0, paymentMethod: 'card', paid: false })
      }
      return newParties
    })
  }, [partySize])
  // Auto-gratuity: if party size >= threshold, auto-add tip
  const autoGratuity = partySize >= autoGratuityThreshold && autoGratuityPercent > 0
  const autoGratuityAmount = autoGratuity ? Math.round(subtotal * autoGratuityPercent) / 100 : 0
  // ─── Equal Split ──────────────────────────────────────────────
  const equalSplitAmount = useMemo(() => {
    const total = orderTotal + autoGratuityAmount
    return Math.floor((total / equalCount) * 100) / 100
  }, [orderTotal, equalCount, autoGratuityAmount])
  const equalRemainder = useMemo(() => {
    const total = orderTotal + autoGratuityAmount
    return Math.round((total - equalSplitAmount * equalCount) * 100) / 100
  }, [orderTotal, equalCount, equalSplitAmount, autoGratuityAmount])
  // ─── Item-based Split ─────────────────────────────────────────
  const assignedItems = useMemo(() => {
    return new Set(parties.flatMap(p => p.items))
  }, [parties])
  const unassignedItems = useMemo(() => {
    return cartItems.filter(item => !assignedItems.has(item.id))
  }, [cartItems, assignedItems])
  const partyTotals = useMemo(() => {
    return parties.map(party => {
      const itemsTotal = cartItems
        .filter(item => party.items.includes(item.id))
        .reduce((sum, item) => sum + item.price * item.quantity, 0)
      const proportion = subtotal > 0 ? itemsTotal / subtotal : 0
      const taxShare = Math.round(taxTotal * proportion * 100) / 100
      const total = Math.round((itemsTotal + taxShare + party.tipAmount) * 100) / 100
      return { ...party, itemsTotal, taxShare, total }
    })
  }, [parties, cartItems, subtotal, taxTotal])
  // ─── Handlers ─────────────────────────────────────────────────
  const addParty = useCallback(() => {
    const id = String(parties.length + 1)
    setParties(prev => [
      ...prev,
      { id, name: `Oseba ${parties.length + 1}`, items: [], tipPercent: 0, tipAmount: 0, paymentMethod: 'card', paid: false },
    ])
  }, [parties.length])
  const removeParty = useCallback((partyId: string) => {
    if (parties.length <= 1) return
    setParties(prev => prev.filter(p => p.id !== partyId))
  }, [parties.length])
  const assignItemToParty = useCallback((itemId: string, partyId: string) => {
    setParties(prev => prev.map(p => {
      // Remove from all parties first
      const filtered = p.items.filter(id => id !== itemId)
      if (p.id === partyId) {
        return { ...p, items: [...filtered, itemId] }
      }
      return { ...p, items: filtered }
    }))
  }, [])
  const unassignItem = useCallback((itemId: string) => {
    setParties(prev => prev.map(p => ({
      ...p,
      items: p.items.filter(id => id !== itemId),
    })))
  }, [])
  const setPartyTip = useCallback((partyId: string, percent: number) => {
    setParties(prev => prev.map(p => {
      if (p.id !== partyId) return p
      const itemsTotal = cartItems
        .filter(item => p.items.includes(item.id))
        .reduce((sum, item) => sum + item.price * item.quantity, 0)
      return {
        ...p,
        tipPercent: percent,
        tipAmount: Math.round(itemsTotal * percent) / 100,
      }
    }))
  }, [cartItems])
  const togglePartyPayment = useCallback((partyId: string, method: 'cash' | 'card' | 'mobile') => {
    setParties(prev => prev.map(p =>
      p.id === partyId ? { ...p, paymentMethod: method } : p
    ))
  }, [])
  const handleConfirmEqual = useCallback(() => {
    const equalParties: SplitParty[] = Array.from({ length: equalCount }, (_, i) => ({
      id: String(i + 1),
      name: `Oseba ${i + 1}`,
      items: [],
      tipPercent: autoGratuity ? autoGratuityPercent : 0,
      tipAmount: autoGratuity ? Math.round(equalSplitAmount * autoGratuityPercent) / 100 : 0,
      paymentMethod: 'card',
      paid: false,
    }))
    onConfirmSplit(equalParties)
    onClose()
  }, [equalCount, autoGratuity, autoGratuityPercent, equalSplitAmount, onConfirmSplit, onClose])
  const handleConfirmItems = useCallback(() => {
    if (unassignedItems.length > 0) {
      toast.warning(`${unassignedItems.length} artiklov ni dodeljenih!`)
      return
    }
    onConfirmSplit(parties.map(p => ({
      ...p,
      tipAmount: autoGratuity ? Math.round(partyTotals.find(pt => pt.id === p.id)!.itemsTotal * autoGratuityPercent) / 100 : p.tipAmount,
    })))
    onClose()
  }, [unassignedItems.length, parties, autoGratuity, partyTotals, autoGratuityPercent, onConfirmSplit, onClose])
  // FIX BUG-07: Custom split — izračunaj skupni znesek in preveri ujemanje
  const customTotal = useMemo(() => {
    return Object.values(customAmounts).reduce((sum, val) => sum + (val || 0), 0)
  }, [customAmounts])
  const customDifference = useMemo(() => {
    return Math.round(((orderTotal + autoGratuityAmount) - customTotal) * 100) / 100
  }, [orderTotal, autoGratuityAmount, customTotal])
  const isCustomValid = customDifference === 0 && Object.keys(customAmounts).length === parties.length
  const handleConfirmCustom = useCallback(() => {
    if (!isCustomValid) return
    const customParties = parties.map(p => ({
      ...p,
      tipAmount: autoGratuity ? Math.round((customAmounts[p.id] || 0) * autoGratuityPercent) / 100 : 0,
    }))
    onConfirmSplit(customParties)
    onClose()
  }, [isCustomValid, parties, autoGratuity, customAmounts, autoGratuityPercent, onConfirmSplit, onClose])
  // ─── Render ───────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Split className="h-5 w-5 text-primary" />
            Delitev računa
            {autoGratuity && (
              <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
                <PartyPopper className="h-3 w-3 mr-1" />
                Auto-gratuiteta {autoGratuityPercent}% ({partySize}+ oseb)
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        {/* Auto-gratuity notice */}
        {autoGratuity && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <span>
              Za skupino {partySize}+ oseb se samodejno doda gratuiteta {autoGratuityPercent}% (€{autoGratuityAmount.toFixed(2)})
            </span>
          </div>
        )}
        <Tabs value={splitMode} onValueChange={(v) => setSplitMode(v as typeof splitMode)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="equal">
              <Equal className="h-3.5 w-3.5 mr-1.5" />
              Enakomerno
            </TabsTrigger>
            <TabsTrigger value="items">
              <Receipt className="h-3.5 w-3.5 mr-1.5" />
              Po artiklih
            </TabsTrigger>
            <TabsTrigger value="custom">
              <Calculator className="h-3.5 w-3.5 mr-1.5" />
              Po meri
            </TabsTrigger>
          </TabsList>
          {/* ═══ EQUAL SPLIT ═══ */}
          <TabsContent value="equal" className="space-y-4 mt-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Število oseb:</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" aria-label="Zmanjšaj" className="h-8 w-8" onClick={() => setEqualCount(Math.max(2, equalCount - 1))} autoFocus>
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="text-2xl font-bold w-12 text-center">{equalCount}</span>
                <Button variant="outline" size="icon" aria-label="Dodaj" className="h-8 w-8" onClick={() => setEqualCount(Math.min(20, equalCount + 1))}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Skupaj z napitnino</p>
                  <p className="text-2xl font-bold text-primary">€{(orderTotal + autoGratuityAmount).toFixed(2)}</p>
                </CardContent>
              </Card>
              <Card className="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800">
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Na osebo</p>
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">€{equalSplitAmount.toFixed(2)}</p>
                  {equalRemainder > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-1">+€{equalRemainder.toFixed(2)} na zadnjo osebo</p>
                  )}
                </CardContent>
              </Card>
            </div>
            {/* Visual equal split */}
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: equalCount }, (_, i) => (
                <div key={i} className="flex flex-col items-center p-2 rounded-lg bg-muted/50 border">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center mb-1">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-xs text-muted-foreground">Oseba {i + 1}</span>
                  <span className="text-sm font-bold">€{equalSplitAmount.toFixed(2)}</span>
                  {i === 0 && equalRemainder > 0 && (
                    <Badge variant="outline" className="text-[9px] h-4 mt-1">+€{equalRemainder.toFixed(2)}</Badge>
                  )}
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Prekliči</Button>
              <Button onClick={handleConfirmEqual} className="gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                Potrdi delitev ({equalCount}x)
              </Button>
            </DialogFooter>
          </TabsContent>
          {/* ═══ ITEM-BASED SPLIT ═══ */}
          <TabsContent value="items" className="space-y-4 mt-4">
            {/* Parties */}
            <div className="space-y-3">
              {partyTotals.map((party) => (
                <Card key={party.id} className="overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
                    <div className="flex items-center gap-2">
                      <Input
                        value={party.name}
                        onChange={(e) => setParties(prev => prev.map(p =>
                          p.id === party.id ? { ...p, name: e.target.value } : p
                        ))}
                        className="h-7 w-32 text-sm font-medium border-0 bg-transparent p-0 focus-visible:ring-0"
                        aria-label="Ime stranke"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">€{party.total.toFixed(2)}</span>
                      {parties.length > 1 && (
                        <Button variant="ghost" size="icon" aria-label="Izbriši" className="h-6 w-6" onClick={() => removeParty(party.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <CardContent className="p-3">
                    {/* Assigned items */}
                    {party.items.length > 0 ? (
                      <div className="space-y-1 mb-2">
                        {cartItems.filter(item => party.items.includes(item.id)).map(item => (
                          <div key={item.id} className="flex items-center justify-between text-sm bg-muted/30 rounded px-2 py-1">
                            <span>{item.quantity}x {item.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">€{(item.price * item.quantity).toFixed(2)}</span>
                              <Button variant="ghost" size="icon" aria-label="Izbriši" className="h-5 w-5" onClick={() => unassignItem(item.id)}>
                                <Trash2 className="h-2.5 w-2.5 text-muted-foreground" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-2">Izberi artikle spodaj</p>
                    )}
                    {/* Tip for this party */}
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="text-xs text-muted-foreground">Napitnina:</span>
                      {[0, 5, 10, 15, 20].map(pct => (
                        <Button
                          key={pct}
                          variant={party.tipPercent === pct ? 'default' : 'outline'}
                          size="sm"
                          className="h-6 text-[10px] px-2"
                          onClick={() => setPartyTip(party.id, pct)}
                        >
                          {pct}%
                        </Button>
                      ))}
                    </div>
                    {/* Payment method */}
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="text-xs text-muted-foreground">Plačilo:</span>
                      {[
                        { method: 'card' as const, icon: <CreditCard className="h-3 w-3" />, label: 'Kartica' },
                        { method: 'cash' as const, icon: <Banknote className="h-3 w-3" />, label: 'Gotovina' },
                        { method: 'mobile' as const, icon: <Smartphone className="h-3 w-3" />, label: 'Mobilno' },
                      ].map(({ method, icon, label }) => (
                        <Button
                          key={method}
                          variant={party.paymentMethod === method ? 'default' : 'outline'}
                          size="sm"
                          className="h-6 text-[10px] px-2 gap-1"
                          onClick={() => togglePartyPayment(party.id, method)}
                        >
                          {icon} {label}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button variant="outline" onClick={addParty} className="w-full gap-1.5">
                <Plus className="h-4 w-4" />
                Dodaj osebo
              </Button>
            </div>
            {/* Unassigned items */}
            {unassignedItems.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                  Nedodeljeni artikli ({unassignedItems.length})
                </h4>
                <div className="space-y-1">
                  {unassignedItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between text-sm border rounded-lg px-3 py-2 hover:bg-muted/30 transition-colors">
                      <span>{item.quantity}x {item.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">€{(item.price * item.quantity).toFixed(2)}</span>
                        <div className="flex gap-1">
                          {parties.map(party => (
                            <Button
                              key={party.id}
                              variant="outline"
                              size="sm"
                              className="h-6 text-[10px] px-2"
                              onClick={() => assignItemToParty(item.id, party.id)}
                            >
                              → {party.name}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Prekliči</Button>
              <Button onClick={handleConfirmItems} className="gap-1.5" disabled={unassignedItems.length > 0}>
                <CheckCircle2 className="h-4 w-4" />
                Potrdi delitev ({parties.length} oseb)
              </Button>
            </DialogFooter>
          </TabsContent>
          {/* ═══ CUSTOM SPLIT ═══ */}
          <TabsContent value="custom" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Vnesi znesek za vsako osebo. Skupaj mora ustrezati €{(orderTotal + autoGratuityAmount).toFixed(2)}.
            </p>
            {parties.map((party) => (
              <div key={party.id} className="flex items-center gap-3">
                <span className="text-sm font-medium w-24">{party.name}</span>
                <div className="flex-1">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max={(orderTotal + autoGratuityAmount).toFixed(2)}
                    placeholder="0.00"
                    className="h-9"
                    value={customAmounts[party.id] !== undefined ? customAmounts[party.id].toFixed(2) : ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value)
                      setCustomAmounts(prev => ({ ...prev, [party.id]: isNaN(val) ? 0 : val }))
                    }}
                    aria-label="Znesek delitve"
                  />
                </div>
                <span className="text-sm text-muted-foreground">€</span>
                {parties.length > 1 && (
                  <Button variant="ghost" size="icon" aria-label="Izbriši" className="h-7 w-7" onClick={() => {
                    removeParty(party.id)
                    setCustomAmounts(prev => {
                      const next = { ...prev }
                      delete next[party.id]
                      return next
                    })
                  }}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" onClick={() => {
              addParty()
            }} size="sm" className="gap-1">
              <Plus className="h-3 w-3" /> Dodaj osebo
            </Button>
            {/* Povzetek */}
            <div className={`flex items-center justify-between p-3 rounded-lg border ${
              customDifference === 0 ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
            }`}>
              <span className="text-sm font-medium">Skupaj:</span>
              <div className="text-right">
                <span className={`text-sm font-bold ${customDifference === 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                  €{customTotal.toFixed(2)} / €{(orderTotal + autoGratuityAmount).toFixed(2)}
                </span>
                {customDifference !== 0 && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {customDifference > 0 ? `Manjka €${customDifference.toFixed(2)}` : `Preseženo za €${Math.abs(customDifference).toFixed(2)}`}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Prekliči</Button>
              <Button onClick={handleConfirmCustom} disabled={!isCustomValid} className="gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                Potrdi
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
})
