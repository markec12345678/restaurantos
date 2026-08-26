'use client'

import { useState, useMemo, useCallback } from 'react'
import type { SplitParty } from '../constants'

export function useSplitCustom(
  orderTotal: number,
  autoGratuityAmount: number,
  autoGratuity: boolean,
  autoGratuityPercent: number,
  parties: SplitParty[],
  onConfirmSplit: (_parties: SplitParty[]) => void,
  onClose: () => void,
) {
  const [customAmounts, setCustomAmounts] = useState<Record<string, number>>({})

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
    customAmounts,
    customTotal,
    customDifference,
    isCustomValid,
    handleConfirmCustom,
    handleCustomAmountChange,
    handleCustomAmountDelete,
  }
}
