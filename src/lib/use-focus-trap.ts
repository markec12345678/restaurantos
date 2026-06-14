// ============================================
// USEFOCUSTRAP — Fokusna past za modalne dialoge
// WCAG 2.1 zahteva, da tipkovni fokus ostane znotraj odprtega dialoga
// Tab in Shift+Tab krožijo med focusable elementi znotraj kontejnerja
//
// ⚠️ DEPRECATED: Ta hook ni več potreben, saj vsi dialogi v aplikaciji
// uporabljajo Radix UI Dialog/AlertDialog, ki ima vgrajen focus trap,
// Escape handling in aria atribute. Obdržan za morebitne prihodnje
// non-Radix modale, ki bi potrebovali ročno past fokus.
// ============================================

import { useEffect, useRef, useCallback } from 'react'

// Seznam CSS selektorjev za elemente, ki lahko prejmejo fokus
const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled]):not([aria-hidden])',
  'input:not([disabled]):not([type="hidden"]):not([aria-hidden])',
  'select:not([disabled]):not([aria-hidden])',
  'textarea:not([disabled]):not([aria-hidden])',
  '[tabindex]:not([tabindex="-1"]):not([aria-hidden])',
  '[contenteditable]',
].join(', ')

/**
 * Hook za focus trapping znotraj modalnega dialoga.
 * Zagotavlja WCAG 2.1 skladnost — fokus ne more uiti iz dialoga.
 *
 * @param isActive - Ali je focus trap aktivna (npr. dialog je odprt)
 * @returns ref, ki ga pritrdite na kontejner dialoga
 *
 * @example
 * ```tsx
 * function MyDialog({ open }: { open: boolean }) {
 *   const containerRef = useFocusTrap(open)
 *   return (
 *     <div ref={containerRef} role="dialog" aria-modal="true">
 *       <input />
 *       <button>Shrani</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(isActive: boolean) {
  const containerRef = useRef<T>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Shrani prejšnji aktivni element in prestavi fokus v dialog
  useEffect(() => {
    if (!isActive || !containerRef.current) return

    // Shrani element, ki je imel fokus pred odprtjem dialoga
    previousFocusRef.current = document.activeElement as HTMLElement

    // Počakaj na naslednji frame, da se dialog renderira
    const rafId = requestAnimationFrame(() => {
      if (!containerRef.current) return

      const focusable = containerRef.current.querySelectorAll(FOCUSABLE_SELECTORS)
      const firstFocusable = focusable[0] as HTMLElement | undefined

      // Premakni fokus na prvi focusable element (ali na sam kontejner z tabindex)
      if (firstFocusable) {
        firstFocusable.focus()
      } else {
        containerRef.current.setAttribute('tabindex', '-1')
        containerRef.current.focus()
      }
    })

    return () => {
      cancelAnimationFrame(rafId)
      // Ob zaprtju dialoga vrni fokus na element, ki ga je imel prej
      if (previousFocusRef.current && previousFocusRef.current.focus) {
        previousFocusRef.current.focus()
      }
    }
  }, [isActive])

  // Ujemi Tab in Shift+Tab — kroži fokus znotraj dialoga
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isActive || e.key !== 'Tab') return

    const container = containerRef.current
    if (!container) return

    const focusable = container.querySelectorAll(FOCUSABLE_SELECTORS)
    if (focusable.length === 0) {
      e.preventDefault()
      return
    }

    const firstElement = focusable[0] as HTMLElement
    const lastElement = focusable[focusable.length - 1] as HTMLElement

    if (e.shiftKey) {
      // Shift+Tab — če smo na prvem elementu, skoči na zadnjega
      if (document.activeElement === firstElement) {
        e.preventDefault()
        lastElement.focus()
      }
    } else {
      // Tab — če smo na zadnjem elementu, skoči na prvega
      if (document.activeElement === lastElement) {
        e.preventDefault()
        firstElement.focus()
      }
    }
  }, [isActive])

  useEffect(() => {
    if (!isActive) return
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isActive, handleKeyDown])

  return containerRef
}
