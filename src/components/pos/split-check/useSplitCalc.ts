'use client'

import { useState, useCallback } from 'react'
import type { SplitMode, CartItem, SplitParty } from './constants'
import { useSplitCheck } from './useSplitCheck'

// ============================================
// HOOK: SplitCalc — Poenostavljen dostop do izračunov delitve
// ============================================

interface UseSplitCalcParams {
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

export function useSplitCalc({
  orderTotal,
  subtotal,
  taxTotal,
  cartItems,
  partySize,
  autoGratuityPercent,
  autoGratuityThreshold,
  onConfirmSplit,
  onClose,
}: UseSplitCalcParams) {
  const [localSplitMode, setLocalSplitMode] = useState<SplitMode>('equal')

  const split = useSplitCheck({
    orderTotal, subtotal, taxTotal, cartItems,
    partySize, autoGratuityPercent, autoGratuityThreshold,
    onConfirmSplit, onClose,
  })

  const handleSplitModeChange = useCallback((mode: string) => {
    setLocalSplitMode(mode as SplitMode)
  }, [])

  // Override splitMode from local state (useSplitCheck also has its own)
  return {
    ...split,
    splitMode: localSplitMode,
    setSplitMode: handleSplitModeChange,
  }
}
