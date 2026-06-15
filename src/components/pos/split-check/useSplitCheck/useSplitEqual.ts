'use client'

import { useState, useMemo, useCallback } from 'react'
import type { SplitParty } from '../constants'

export function useSplitEqual(
  orderTotal: number,
  autoGratuityAmount: number,
  partySize: number,
  onConfirmSplit: (_parties: SplitParty[]) => void,
  onClose: () => void,
  autoGratuity: boolean,
  autoGratuityPercent: number,
) {
  const [equalCount, setEqualCount] = useState(Math.max(partySize, 2))

  const equalSplitAmount = useMemo(() => {
    const total = orderTotal + autoGratuityAmount
    return Math.floor((total / equalCount) * 100) / 100
  }, [orderTotal, equalCount, autoGratuityAmount])

  const equalRemainder = useMemo(() => {
    const total = orderTotal + autoGratuityAmount
    return Math.round((total - equalSplitAmount * equalCount) * 100) / 100
  }, [orderTotal, equalCount, equalSplitAmount, autoGratuityAmount])

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

  return { equalCount, setEqualCount, equalSplitAmount, equalRemainder, handleConfirmEqual }
}
