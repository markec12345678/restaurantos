'use client'
// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Split Check Dialog
// Toast POS + Square standard: delitev računa po osebah, artiklih, enakih delih
// Napitnina, auto-gratuity za velike skupine, več načinov plačila
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo, useCallback, memo } from 'react'
import dynamic from 'next/dynamic'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Split, Equal, Receipt, Calculator, PartyPopper, AlertTriangle } from 'lucide-react'
import {
  type SplitParty,
  type SplitCheckDialogProps,
  type PartyTotal,
  type SplitMode,
} from './split-check/constants'

// Lazy-loaded podkomponente
const EqualSplitTab = dynamic(() => import('./split-check/EqualSplitTab').then(m => ({ default: m.EqualSplitTab })), { ssr: false })
const ItemsSplitTab = dynamic(() => import('./split-check/ItemsSplitTab').then(m => ({ default: m.ItemsSplitTab })), { ssr: false })
const CustomSplitTab = dynamic(() => import('./split-check/CustomSplitTab').then(m => ({ default: m.CustomSplitTab })), { ssr: false })

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
  const [splitMode, setSplitMode] = useState<SplitMode>('equal')
  // FIX BUG-07: Custom split — sledi zneskom za vsako osebo
  const [customAmounts, setCustomAmounts] = useState<Record<string, number>>({})
  const [parties, setParties] = useState<SplitParty[]>([
    { id: '1', name: 'Oseba 1', items: [], tipPercent: 0, tipAmount: 0, paymentMethod: 'card', paid: false },
  ])
  const [equalCount, setEqualCount] = useState(Math.max(partySize, 2))

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
      return { ...party, itemsTotal, taxShare, total } as PartyTotal
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
      // Odstrani iz vseh strank najprej
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

  // ─── Handlers za podkomponente ────────────────────────────────
  const handleEqualCountChange = useCallback((count: number) => {
    setEqualCount(count)
  }, [])

  const handleCustomAmountChange = useCallback((partyId: string, amount: number) => {
    setCustomAmounts(prev => ({ ...prev, [partyId]: amount }))
  }, [])

  const handleCustomAmountDelete = useCallback((partyId: string) => {
    setCustomAmounts(prev => {
      const next = { ...prev }
      delete next[partyId]
      return next
    })
  }, [])

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
        {/* Auto-gratuity obvestilo */}
        {autoGratuity && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <span>
              Za skupino {partySize}+ oseb se samodejno doda gratuiteta {autoGratuityPercent}% (&euro;{autoGratuityAmount.toFixed(2)})
            </span>
          </div>
        )}
        <Tabs value={splitMode} onValueChange={(v) => setSplitMode(v as SplitMode)}>
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
          {/* ═══ ENAKOMERNA DELITEV ═══ */}
          <TabsContent value="equal" className="mt-4">
            <EqualSplitTab
              equalCount={equalCount}
              onEqualCountChange={handleEqualCountChange}
              orderTotal={orderTotal}
              autoGratuityAmount={autoGratuityAmount}
              equalSplitAmount={equalSplitAmount}
              equalRemainder={equalRemainder}
              onClose={onClose}
              onConfirmEqual={handleConfirmEqual}
            />
          </TabsContent>
          {/* ═══ DELITEV PO ARTIKLIH ═══ */}
          <TabsContent value="items" className="mt-4">
            <ItemsSplitTab
              partyTotals={partyTotals}
              parties={parties}
              onSetParties={setParties}
              cartItems={cartItems}
              unassignedItems={unassignedItems}
              onAddParty={addParty}
              onRemoveParty={removeParty}
              onAssignItemToParty={assignItemToParty}
              onUnassignItem={unassignItem}
              onSetPartyTip={setPartyTip}
              onTogglePartyPayment={togglePartyPayment}
              onClose={onClose}
              onConfirmItems={handleConfirmItems}
            />
          </TabsContent>
          {/* ═══ DELITEV PO MERI ═══ */}
          <TabsContent value="custom" className="mt-4">
            <CustomSplitTab
              parties={parties}
              customAmounts={customAmounts}
              onCustomAmountChange={handleCustomAmountChange}
              onCustomAmountDelete={handleCustomAmountDelete}
              orderTotal={orderTotal}
              autoGratuityAmount={autoGratuityAmount}
              customTotal={customTotal}
              customDifference={customDifference}
              isCustomValid={isCustomValid}
              onAddParty={addParty}
              onRemoveParty={removeParty}
              onClose={onClose}
              onConfirmCustom={handleConfirmCustom}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
})
