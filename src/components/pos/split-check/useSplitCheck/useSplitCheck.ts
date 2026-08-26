'use client'

import { useState, useCallback } from 'react'
import type { SplitMode } from '../constants'
import { useSplitEqual } from './useSplitEqual'
import { useSplitItems } from './useSplitItems'
import { useSplitCustom } from './useSplitCustom'

interface UseSplitCheckParams {
  orderTotal: number
  subtotal: number
  taxTotal: number
  cartItems: import('../constants').CartItem[]
  partySize: number
  autoGratuityPercent: number
  autoGratuityThreshold: number
  onConfirmSplit: (_parties: import('../constants').SplitParty[]) => void
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

  const autoGratuity = partySize >= autoGratuityThreshold && autoGratuityPercent > 0
  const autoGratuityAmount = autoGratuity ? Math.round(subtotal * autoGratuityPercent) / 100 : 0

  const equal = useSplitEqual(orderTotal, autoGratuityAmount, partySize, onConfirmSplit, onClose, autoGratuity, autoGratuityPercent)
  const items = useSplitItems(cartItems, subtotal, taxTotal, autoGratuity, autoGratuityPercent, autoGratuityAmount, onConfirmSplit, onClose)
  const custom = useSplitCustom(orderTotal, autoGratuityAmount, autoGratuity, autoGratuityPercent, items.parties, onConfirmSplit, onClose)

  const handleEqualCountChange = useCallback((count: number) => {
    equal.setEqualCount(count)
  }, [equal])

  return {
    splitMode, setSplitMode,
    parties: items.parties, setParties: items.setParties,
    customAmounts: custom.customAmounts,
    equalCount: equal.equalCount,
    autoGratuity,
    autoGratuityAmount,
    equalSplitAmount: equal.equalSplitAmount,
    equalRemainder: equal.equalRemainder,
    unassignedItems: items.unassignedItems,
    partyTotals: items.partyTotals,
    customTotal: custom.customTotal,
    customDifference: custom.customDifference,
    isCustomValid: custom.isCustomValid,
    addParty: items.addParty,
    removeParty: items.removeParty,
    handleEqualCountChange,
    handleConfirmEqual: equal.handleConfirmEqual,
    assignItemToParty: items.assignItemToParty,
    unassignItem: items.unassignItem,
    setPartyTip: items.setPartyTip,
    togglePartyPayment: items.togglePartyPayment,
    handleConfirmItems: items.handleConfirmItems,
    handleCustomAmountChange: custom.handleCustomAmountChange,
    handleCustomAmountDelete: custom.handleCustomAmountDelete,
    handleConfirmCustom: custom.handleConfirmCustom,
  }
}
