// ============================================
// PIN VPIS — Čiste pomožne funkcije (runda 25)
// Ločeno od usePinLogin hooka, da je testabilno brez
// react-query / komponent (hitri node testi).
// ============================================

import { PIN_MAX_LENGTH } from './constants'

/**
 * Uporabi števko na obstoječi PIN.
 * Vrne nov PIN + zastavico za samodejno oddajo (ob doseženi max dolžini).
 *
 * Square/Clover vzorec: uporabnik NE sme morati tapkati "Potrdi", ko je PIN
 * poln. Varno za spremenljivo dolžino (4–6): auto-submit ŠELE pri 6 (max),
 * ker pri 4 ne vemo, ali zaposleni vpiše še 5. in 6. števko.
 */
export function applyPinDigit(
  prev: string,
  digit: string,
  maxLength = PIN_MAX_LENGTH,
): { pin: string; autoSubmit: boolean } {
  if (prev.length >= maxLength) return { pin: prev, autoSubmit: false }
  const next = prev + digit
  return { pin: next, autoSubmit: next.length >= maxLength }
}

/**
 * Haptična povratna informacija (mikrointerakcija — Square/Clover vzorec).
 * Tiho ignorirana na napravah brez vibracijskega motorja (iOS Safari, desktop).
 */
export function hapticFeedback(ms: number): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(ms)
    }
  } catch {
    // nič — haptika je čisto opcijska
  }
}
