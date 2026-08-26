'use client'

import { useState, useMemo, useCallback } from 'react'
import { toast } from 'sonner'
import type { SplitParty, PartyTotal, CartItem } from '../constants'

export function useSplitItems(
  cartItems: CartItem[],
  subtotal: number,
  taxTotal: number,
  autoGratuity: boolean,
  autoGratuityPercent: number,
  autoGratuityAmount: number,
  onConfirmSplit: (_parties: SplitParty[]) => void,
  onClose: () => void,
) {
  const [parties, setParties] = useState<SplitParty[]>([
    { id: '1', name: 'Oseba 1', items: [], tipPercent: 0, tipAmount: 0, paymentMethod: 'card', paid: false },
  ])

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

  return {
    parties, setParties, assignedItems, unassignedItems, partyTotals,
    addParty, removeParty, assignItemToParty, unassignItem,
    setPartyTip, togglePartyPayment, handleConfirmItems,
  }
}
