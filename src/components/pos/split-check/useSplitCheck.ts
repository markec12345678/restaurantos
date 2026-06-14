'use client'

import { useState, useMemo, useCallback } from 'react'
import { toast } from 'sonner'
import type { SplitParty, PartyTotal, SplitMode, CartItem } from './constants'

// ============================================
// HOOK: Stanje in logika za delitev računa
// ============================================

interface UseSplitCheckParams {
  orderTotal: number
  subtotal: number
  taxTotal: number
  cartItems: CartItem[]
  partySize: number
  autoGratuityPercent: number
  autoGratuityThreshold: number
  onConfirmSplit: (_parties: SplitParty[]) => void
  onClose: () => void
}

export function useSplitCheck({
  orderTotal,
  subtotal,
  taxTotal,
  cartItems,
  partySize,
  autoGratuityPercent,
  autoGratuityThreshold,
  onConfirmSplit,
  onClose,
}: UseSplitCheckParams) {
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

  return {
    // Stanje
    splitMode, setSplitMode,
    parties, setParties,
    customAmounts,
    equalCount,
    // Auto-gratuity
    autoGratuity,
    autoGratuityAmount,
    // Izračuni - enakomerna delitev
    equalSplitAmount,
    equalRemainder,
    // Izračuni - delitev po artiklih
    unassignedItems,
    partyTotals,
    // Izračuni - delitev po meri
    customTotal,
    customDifference,
    isCustomValid,
    // Handlerji - skupni
    addParty,
    removeParty,
    // Handlerji - enakomerna delitev
    handleEqualCountChange,
    handleConfirmEqual,
    // Handlerji - delitev po artiklih
    assignItemToParty,
    unassignItem,
    setPartyTip,
    togglePartyPayment,
    handleConfirmItems,
    // Handlerji - delitev po meri
    handleCustomAmountChange,
    handleCustomAmountDelete,
    handleConfirmCustom,
  }
}
