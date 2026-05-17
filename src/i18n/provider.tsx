'use client'

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { useTranslations as useNextIntlTranslations } from 'next-intl'

export type AppLocale = 'sl' | 'en' | 'it' | 'de' | 'hr'

interface I18nContextType {
  locale: AppLocale
  setLocale: (locale: AppLocale) => void
  t: (key: string) => string
}

const I18nContext = createContext<I18nContextType | null>(null)

const localeLabels: Record<AppLocale, { flag: string; label: string }> = {
  sl: { flag: '🇸🇮', label: 'Slovenščina' },
  en: { flag: '🇬🇧', label: 'English' },
  it: { flag: '🇮🇹', label: 'Italiano' },
  de: { flag: '🇩🇪', label: 'Deutsch' },
  hr: { flag: '🇭🇷', label: 'Hrvatski' },
}

export { localeLabels }

// Simple nested key lookup for translations
function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split('.')
  let current: unknown = obj
  for (const key of keys) {
    if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[key]
    } else {
      return path // Return key as fallback
    }
  }
  return typeof current === 'string' ? current : path
}

// Cache for loaded messages
const messagesCache: Record<AppLocale, Record<string, unknown>> = {} as never

async function loadMessages(locale: AppLocale): Promise<Record<string, unknown>> {
  if (messagesCache[locale]) return messagesCache[locale]
  try {
    const mod = await import(`../../messages/${locale}.json`)
    messagesCache[locale] = mod.default
    return mod.default
  } catch {
    // Fallback to Slovenian
    const mod = await import('../../messages/sl.json')
    messagesCache[locale] = mod.default
    return mod.default
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>('sl')
  const [messages, setMessages] = useState<Record<string, unknown>>({})

  // Load saved locale from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('pos-locale') as AppLocale | null
    if (saved && ['sl', 'en', 'it', 'de', 'hr'].includes(saved)) {
      setLocaleState(saved)
    }
  }, [])

  // Load messages when locale changes
  // FIX: Dodan stale-check — prepreči race condition pri hitri zamenjavi jezika
  useEffect(() => {
    let stale = false
    loadMessages(locale).then(msgs => {
      if (!stale) setMessages(msgs)
    })
    return () => { stale = true }
  }, [locale])

  const setLocale = useCallback((newLocale: AppLocale) => {
    setLocaleState(newLocale)
    localStorage.setItem('pos-locale', newLocale)
    // Update HTML lang attribute — FIX: SSR guard za document
    if (typeof document !== 'undefined') {
      document.documentElement.lang = newLocale
    }
  }, [])

  const t = useCallback((key: string): string => {
    return getNestedValue(messages, key)
  }, [messages])

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return context
}

export function useLocale() {
  const { locale, setLocale } = useI18n()
  // FIX: Guard proti neveljavnemu locale-ju
  const localeInfo = localeLabels[locale] || localeLabels.sl
  return { locale, setLocale, localeInfo }
}
