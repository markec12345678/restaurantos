// ============================================
// HAPTIC FEEDBACK — Subtle vibration on tap
//
// Web Vibration API (navigator.vibrate) — podprt na Android + iOS PWA.
// Native apps že imajo haptic feedback na tap; sedaj ga imamo tudi mi.
//
// 3 stopnje:
//   - light (10ms) — default tap (gumb, ikona)
//   - medium (20ms) — pomembna akcija (dodaj v košarico, bump order)
//   - heavy (50ms) — kritična akcija (plačilo, void, delete)
//
// A11Y: upošteva prefers-reduced-motion — če je vklopljena, ne vibrira.
// ============================================

export type HapticIntensity = 'light' | 'medium' | 'heavy' | 'success' | 'error'

const INTENSITY_MS: Record<HapticIntensity, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 50,
  success: [10, 30, 10], // pattern: kratka-pavza-kratka
  error: [50, 30, 50, 30, 50], // pattern: dolga-pavza-dolga-pavza-dolga
}

let cachedPrefersReducedMotion: boolean | null = null

function prefersReducedMotion(): boolean {
  if (cachedPrefersReducedMotion !== null) return cachedPrefersReducedMotion
  if (typeof window === 'undefined') return false
  cachedPrefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // Re-check na vsakih 5 minutah (uporabnik lahko spremeni nastavitev)
  setTimeout(() => { cachedPrefersReducedMotion = null }, 5 * 60 * 1000)
  return cachedPrefersReducedMotion
}

/**
 * Sproži haptic feedback.
 *
 * @param intensity - 'light' | 'medium' | 'heavy' | 'success' | 'error'
 * @example
 *   <button onClick={() => haptic('light')}>Klikni</button>
 *   <button onClick={() => haptic('medium')}>Dodaj v košarico</button>
 *   <button onClick={() => haptic('heavy')}>Plačaj</button>
 */
export function haptic(intensity: HapticIntensity = 'light'): void {
  // Preveri podporo
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return

  // A11Y: ne vibriraj če uporabnik preferira reduced motion
  if (prefersReducedMotion()) return

  try {
    navigator.vibrate(INTENSITY_MS[intensity])
  } catch {
    // Tiho ignoriraj — nekateri brskalniki zavračajo brez HTTPS
  }
}

/**
 * Haptic feedback za success akcijo (npr. plačilo uspešno).
 * Pattern: kratka-pavza-kratka vibracija.
 */
export function hapticSuccess(): void {
  haptic('success')
}

/**
 * Haptic feedback za error akcijo (npr. napaka pri plačilu).
 * Pattern: dolga-pavza-dolga-pavza-dolga.
 */
export function hapticError(): void {
  haptic('error')
}

/**
 * Ali je haptic feedback podprt v tem brskalniku?
 */
export function isHapticSupported(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator
}
