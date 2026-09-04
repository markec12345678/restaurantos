'use client'

// ============================================
// DynamicHtmlLang — sinhronizira <html lang> z izbranim jezikom
//
// A11Y FIX (WCAG 3.1.1): prej je bil <html lang="sl"> hardcoded —
// ko je uporabnik preklopil na EN/IT/HR/DE, so screen readerji še
// vedno napovedovali v slovenščini. Ta komponenta posluša localStorage
// in posodobi <html lang> ob spremembi.
// ============================================

import { useEffect } from 'react'

export function DynamicHtmlLang() {
  useEffect(() => {
    const updateLang = () => {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('pos_locale') : null
      const lang = stored || 'sl'
      document.documentElement.lang = lang
    }
    updateLang()
    // Poslušaj spremembe localStorage (npr. iz LanguageSwitcher)
    window.addEventListener('storage', updateLang)
    return () => window.removeEventListener('storage', updateLang)
  }, [])
  return null
}
