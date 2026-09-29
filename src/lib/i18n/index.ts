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
import { suppliersSl, suppliersEn, suppliersIt, suppliersHr, suppliersDe } from './suppliers'

// ============================================
// TRANSLATIONS MAP — Združevanje domenskih prevodov
// ============================================
const sl: Record<string, string> = { ...commonSl, ...navSl, ...ordersSl, ...restaurantSl, ...reportsSl, ...operationsSl, ...settingsSl, ...suppliersSl }
const en: Record<string, string> = { ...commonEn, ...navEn, ...ordersEn, ...restaurantEn, ...reportsEn, ...operationsEn, ...settingsEn, ...suppliersEn }
const it: Record<string, string> = { ...commonIt, ...navIt, ...ordersIt, ...restaurantIt, ...reportsIt, ...operationsIt, ...settingsIt, ...suppliersIt }
const hr: Record<string, string> = { ...commonHr, ...navHr, ...ordersHr, ...restaurantHr, ...reportsHr, ...operationsHr, ...settingsHr, ...suppliersHr }
const de: Record<string, string> = { ...commonDe, ...navDe, ...ordersDe, ...restaurantDe, ...reportsDe, ...operationsDe, ...settingsDe, ...suppliersDe }

const translations: Record<Locale, Record<string, string>> = { sl, en, it, hr, de }

// ============================================
// T()/TFOR() — Glavna funkcija za prevod
// R154 (#44): tFor je ČISTA funkcija (locale je parameter, brez module-state) —
// uporablja jo reaktiven hook useI18n (src/hooks/useI18n.ts). t() ostane kot
// backward-compat delegat za ne-react klicalce (legacy i18n-consolidation
// veriga izbrisana R167 — mrtev next-intl sloj, issue #143).
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

// R154 (#44): čista prevajalna funkcija — SL-fallback + {param} interpolacija
// (logika 1:1 iz bivšega t()), samo izvor locale je zdaj parameter namesto
// module var. Reaktivnost zagotavlja hook (zustand locale → re-render).
export function tFor(locale: Locale, key: string, params?: Record<string, string | number>): string {
  const translation = translations[locale]?.[key] || translations.sl[key] || key
  if (!params) return translation
  return Object.entries(params).reduce(
    (str, [k, v]) => str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
    translation
  )
}

// Backward-compat delegat — getLocale() sinhronizira module var z localStorage
// (persist kanon: 'pos_locale' ostane edini vir resnice za ne-react klicalce).
export function t(key: string, params?: Record<string, string | number>): string {
  return tFor(getLocale(), key, params)
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
