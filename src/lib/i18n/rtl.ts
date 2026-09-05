// ============================================
// RTL HELPER — Right-to-Left support
// ============================================
// Za arabščino, hebrejščino in druge RTL jezike.
// ============================================

'use client'

import { useEffect, useState } from 'react'

// --- RTL jeziki ---
export const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur', 'yi', 'dv']

// --- Hook za trenutno direction ---
export function useTextDirection(locale: string): 'ltr' | 'rtl' {
  const langCode = locale.split('-')[0].toLowerCase()
  return RTL_LANGUAGES.includes(langCode) ? 'rtl' : 'ltr'
}

// --- Hook za aplikacijo RTL/LTR ---
export function useRtlSupport(locale: string) {
  const direction = useTextDirection(locale)
  const [isRtl, setIsRtl] = useState(direction === 'rtl')

  useEffect(() => {
    const rtl = direction === 'rtl'
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsRtl(rtl)

    // Nastavi dir attribute na <html>
    if (typeof document !== 'undefined') {
      document.documentElement.dir = direction
      document.documentElement.lang = locale

      // Dodaj/odstrani rtl class na body
      if (rtl) {
        document.body.classList.add('rtl')
        document.body.classList.remove('ltr')
      } else {
        document.body.classList.add('ltr')
        document.body.classList.remove('rtl')
      }
    }
  }, [direction, locale])

  return {
    isRtl,
    direction,
    // Helper za flex-direction
    flexDirection: isRtl ? 'row-reverse' : 'row',
    // Helper za text-align
    textAlign: isRtl ? 'right' : 'left',
    // Helper za margin/padding flip
    ml: isRtl ? 'mr' : 'ml', // margin-left → margin-right v RTL
    mr: isRtl ? 'ml' : 'mr',
    pl: isRtl ? 'pr' : 'pl',
    pr: isRtl ? 'pl' : 'pr',
  }
}

// --- Helper za flip vrednosti ---
export function flipSpacing(value: string, isRtl: boolean): string {
  if (!isRtl) return value
  // Preprost flip: "ml-4" → "mr-4", "pl-2" → "pr-2"
  return value
    .replace(/\bml-/g, 'mr-')
    .replace(/\bmr-/g, 'ml-')
    .replace(/\bpl-/g, 'pr-')
    .replace(/\bpr-/g, 'pl-')
    .replace(/\bleft-/g, 'right-')
    .replace(/\bright-/g, 'left-')
}

// --- Arabic številke konverzija ---
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']

export function toArabicDigits(value: string | number, locale: string): string {
  const langCode = locale.split('-')[0].toLowerCase()
  if (langCode !== 'ar') return String(value)

  return String(value).replace(/[0-9]/g, (digit) => {
    return ARABIC_DIGITS[parseInt(digit, 10)]
  })
}

// --- Helper za datum format v RTL ---
export function formatRtlDate(date: Date, locale: string): string {
  const langCode = locale.split('-')[0].toLowerCase()
  try {
    return new Intl.DateTimeFormat(langCode, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date)
  } catch {
    return date.toISOString().split('T')[0]
  }
}

// --- Helper za valuto v RTL ---
export function formatRtlCurrency(amount: number, locale: string, currency = 'EUR'): string {
  const langCode = locale.split('-')[0].toLowerCase()
  try {
    return new Intl.NumberFormat(langCode, {
      style: 'currency',
      currency,
    }).format(amount)
  } catch {
    return `€${amount.toFixed(2)}`
  }
}
