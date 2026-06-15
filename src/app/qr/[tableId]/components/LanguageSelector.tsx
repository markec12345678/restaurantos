'use client'

import { memo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Globe, Check } from 'lucide-react'
import { locales } from '../types'
import type { Locale } from '../translations'

// =====================================================================
// QR Menu — Language Selector Component
// =====================================================================

interface LanguageSelectorProps {
  locale: Locale
  setLocale: (_locale: Locale) => void
  localeOpen: boolean
  setLocaleOpen: (_open: boolean) => void
}

export const LanguageSelector = memo(function LanguageSelector({
  locale,
  setLocale,
  localeOpen,
  setLocaleOpen,
}: LanguageSelectorProps) {
  return (
    <div className="relative">
      <button
        onClick={() => setLocaleOpen(!localeOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-sm font-medium hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
      >
        <Globe className="h-4 w-4" />
        <span>{locales.find(l => l.code === locale)?.flag}</span>
      </button>

      <AnimatePresence>
        {localeOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden z-50"
          >
            {locales.map(l => (
              <button
                key={l.code}
                onClick={() => { setLocale(l.code); setLocaleOpen(false) }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors ${locale === l.code ? 'bg-amber-50 dark:bg-amber-900/20 font-semibold' : ''}`}
              >
                <span className="text-lg">{l.flag}</span>
                <span>{l.label}</span>
                {locale === l.code && <Check className="h-4 w-4 ml-auto text-amber-500" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})
