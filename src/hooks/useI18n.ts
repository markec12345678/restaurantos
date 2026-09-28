'use client'
import { usePOSStore } from '@/lib/store/store'
import { tFor, localeNames, localeFlags, type Locale } from '@/lib/i18n'

// R154 (#44): reaktiven i18n hook — locale živi v zustand store-u, t se veže
// na vsak render (prej: module-level t() iz @/lib/i18n se NI re-renderal ob
// zamenjavi jezika; komponente so stale na starem jeziku do reloada).
export function useI18n(): {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
  localeNames: Record<Locale, string>
  localeFlags: Record<Locale, string>
} {
  const locale = usePOSStore(s => s.locale)
  const setLocale = usePOSStore(s => s.setLocale)
  return {
    locale,
    setLocale,
    // t zapre locale iz tega rendera → zamenjava jezika sproži re-render
    // (zustand selector) in vsi teksti se osvežijo.
    t: (key: string, params?: Record<string, string | number>) => tFor(locale, key, params),
    localeNames,
    localeFlags,
  }
}
