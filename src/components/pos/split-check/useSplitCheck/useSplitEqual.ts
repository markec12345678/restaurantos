'use client'

import { useState, useMemo, useCallback } from 'react'
import type { SplitParty } from '../constants'

// FIX F5-10: DDV-aware rounding za value-based split
// Slovensko pravilo: pri delitvi zneska na N delov, zadnji del dobi ostanek
// (da vsota N delov = izvorni znesek, glede na zaokrožitvene cente)
export function distributeWithDdvRounding(
  totalAmount: number,
  parts: number
): number[] {
  if (parts <= 0) return []
  if (parts === 1) return [totalAmount]
  
  // Izračunaj osnovo in DDV za vsak del
  const baseAmount = totalAmount / parts
  const roundedBase = Math.floor(baseAmount * 100) / 100 // zaokroži navzdol na cent
  
  const distributions: number[] = []
  let distributed = 0
  for (let i = 0; i < parts - 1; i++) {
    distributions.push(roundedBase)
    distributed += roundedBase
  }
  // Zadnji del dobi ostanek (garantira vsota = totalAmount)
  distributions.push(Math.round((totalAmount - distributed) * 100) / 100)
  
  return distributions
}


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
