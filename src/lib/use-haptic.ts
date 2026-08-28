// ============================================
// USE HAPTIC — React hook za haptic feedback
//
// Uporaba:
//   const haptic = useHaptic()
//   <button onClick={haptic.light}>Klikni</button>
//   <button onClick={haptic.medium}>Dodaj</button>
//   <button onClick={haptic.heavy}>Plačaj</button>
//
// Ali z wrapper funkcijo (uporabno v existing onClick):
//   const withHaptic = useHaptic()
//   <button onClick={() => { withHaptic.medium(); addToCart() }}>Dodaj</button>
// ============================================

'use client'

import { useCallback } from 'react'
import { haptic, hapticSuccess, hapticError, type HapticIntensity } from '@/lib/haptic'

export function useHaptic() {
  const trigger = useCallback((intensity: HapticIntensity = 'light') => {
    haptic(intensity)
  }, [])

  const light = useCallback(() => haptic('light'), [])
  const medium = useCallback(() => haptic('medium'), [])
  const heavy = useCallback(() => haptic('heavy'), [])
  const success = useCallback(() => hapticSuccess(), [])
  const error = useCallback(() => hapticError(), [])

  return {
    trigger,
    light,
    medium,
    heavy,
    success,
    error,
  }
}
