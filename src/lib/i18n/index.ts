// ============================================
// VEČJEZIČNI SISTEM (i18n) — SL / EN / IT / HR / DE
// Podpora za: slovenščino, angleščino, italijanščino,
// hrvaščino in nemščino
// Za evropski trg (SI, HR, IT, AT, DE)
// ============================================

export type Locale = 'sl' | 'en' | 'it' | 'hr' | 'de'

export const localeNames: Record<Locale, string> = {
  sl: 'Slovenščina',
  en: 'English',
  it: 'Italiano',
  hr: 'Hrvatski',
  de: 'Deutsch',
}

export const localeFlags: Record<Locale, string> = {
  sl: '🇸🇮',
  en: '🇬🇧',
  it: '🇮🇹',
  hr: '🇭🇷',
  de: '🇩🇪',
}

// — Uvoz domenskih modulov —
import { commonSl, commonEn, commonIt, commonHr, commonDe } from './common'
import { navSl, navEn, navIt, navHr, navDe } from './navigation'
import { ordersSl, ordersEn, ordersIt, ordersHr, ordersDe } from './orders'
import { restaurantSl, restaurantEn, restaurantIt, restaurantHr, restaurantDe } from './restaurant'
import { reportsSl, reportsEn, reportsIt, reportsHr, reportsDe } from './reports'
import { operationsSl, operationsEn, operationsIt, operationsHr, operationsDe } from './operations'
import { settingsSl, settingsEn, settingsIt, settingsHr, settingsDe } from './settings'

// ============================================
// TRANSLATIONS MAP — Združevanje domenskih prevodov
// ============================================
const sl: Record<string, string> = { ...commonSl, ...navSl, ...ordersSl, ...restaurantSl, ...reportsSl, ...operationsSl, ...settingsSl }
const en: Record<string, string> = { ...commonEn, ...navEn, ...ordersEn, ...restaurantEn, ...reportsEn, ...operationsEn, ...settingsEn }
const it: Record<string, string> = { ...commonIt, ...navIt, ...ordersIt, ...restaurantIt, ...reportsIt, ...operationsIt, ...settingsIt }
const hr: Record<string, string> = { ...commonHr, ...navHr, ...ordersHr, ...restaurantHr, ...reportsHr, ...operationsHr, ...settingsHr }
const de: Record<string, string> = { ...commonDe, ...navDe, ...ordersDe, ...restaurantDe, ...reportsDe, ...operationsDe, ...settingsDe }

const translations: Record<Locale, Record<string, string>> = { sl, en, it, hr, de }

// ============================================
// T() — Glavna funkcija za prevod
// ============================================
let currentLocale: Locale = 'sl'

export function setLocale(locale: Locale) {
  currentLocale = locale
  if (typeof window !== 'undefined') {
    localStorage.setItem('pos_locale', locale)
  }
}

export function getLocale(): Locale {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('pos_locale') as Locale | null
    if (stored && ['sl', 'en', 'it', 'hr', 'de'].includes(stored)) {
      currentLocale = stored
    }
  }
  return currentLocale
}

export function t(key: string, params?: Record<string, string | number>): string {
  const translation = translations[currentLocale]?.[key] || translations.sl[key] || key
  if (!params) return translation
  return Object.entries(params).reduce(
    (str, [k, v]) => str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
    translation
  )
}

// Hook za uporabo v React komponentah
export function useTranslation() {
  const locale = getLocale()
  return {
    t,
    locale,
    setLocale,
    localeNames,
    localeFlags,
  }
}
