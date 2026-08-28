// ============================================
// I18N CONSOLIDATION — Centralni proxy za vse i18n sisteme
//
// ISSUE #44: Obstajajo 3 paralelni i18n sistemi:
//   1. messages/*.json (next-intl) — primarni, ~669 sporočil jezik + ar.json (RTL)
//   2. src/lib/i18n/ (domenski moduli: orders, navigation, common, ...) — flat keys
//   3. src/i18n/request.ts (next-intl server config)
//
// Strategija (phased konsolidacija):
//   - Phase 1 (this PR): centralni t() proxy + getI18nStats() dashboard
//   - Phase 2 (Q1 2027): postopno migriraj src/lib/i18n/* v messages/*.json
//   - Phase 3 (v1.0.0): izbriši src/lib/i18n/* — next-intl postane edini sistem
//
// Ta modul ponuja:
//   - tTranslate(key, locale) — preizkusi next-intl (messages), potem src/lib/i18n
//   - getI18nStats() — dashboard s števci prekrivanja
//   - recommendConsolidation() — predlog katere ključe migrirat najprej
// ============================================

// Lazy import next-intl da se ne load-a na server boot
let nextIntlTranslationsCache: Record<string, Record<string, unknown>> = {}

/**
 * Type-safe Locale — kompatibilno z src/lib/i18n/index.ts in src/i18n/request.ts
 */
export type Locale = 'sl' | 'en' | 'it' | 'hr' | 'de'

const SUPPORTED_LOCALES: Locale[] = ['sl', 'en', 'it', 'hr', 'de']

/**
 * Preveri ali je locale podprt.
 */
export function isSupportedLocale(locale: string): locale is Locale {
  return SUPPORTED_LOCALES.includes(locale as Locale)
}

/**
 * Pridobi prevod iz next-intl messages (messages/*.json).
 *
 * @param key - ključ v dotted notation (npr. 'common.save')
 * @param locale - jezik
 */
export async function getNextIntlTranslation(
  key: string,
  locale: Locale = 'sl',
): Promise<string | null> {
  try {
    if (!nextIntlTranslationsCache[locale]) {
      // Lazy import — samo ko prvič rabimo
      const mod = await import(`@/../messages/${locale}.json`)
      nextIntlTranslationsCache[locale] = mod.default || mod
    }
    const messages = nextIntlTranslationsCache[locale]

    // dotted lookup: 'common.save' → messages.common.save
    const parts = key.split('.')
    let current: unknown = messages
    for (const part of parts) {
      if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
        current = (current as Record<string, unknown>)[part]
      } else {
        return null
      }
    }
    return typeof current === 'string' ? current : null
  } catch {
    return null
  }
}

/**
 * Pridobi prevod iz src/lib/i18n (flat keys).
 *
 * @param key - flat key (npr. 'common.save' ali 'save')
 * @param locale - jezik
 */
export async function getLegacyI18nTranslation(
  key: string,
  locale: Locale = 'sl',
): Promise<string | null> {
  try {
    // Lazy import src/lib/i18n — da se ne load-a če ni potreben
    const i18nMod = await import('@/lib/i18n')
    const translations = (i18nMod as unknown as {
      translations?: Record<string, Record<string, string>>
    }).translations
    if (!translations || !translations[locale]) return null
    const value = translations[locale][key]
    return value || null
  } catch {
    return null
  }
}

/**
 * Centralni t() proxy — preizkusi next-intl (messages/*.json) najprej,
 * potem fallback na src/lib/i18n (legacy flat keys).
 *
 * Strategija:
 *   1. next-intl (messages) — PRIMARNI, "common.save"
 *   2. src/lib/i18n flat keys — FALLBACK, "common.save" ali "save"
 *   3. key sam (placeholder) — zadnji fallback
 *
 * @param key - ključ (dotted ali flat)
 * @param locale - jezik (default 'sl')
 */
export async function tTranslate(key: string, locale: Locale = 'sl'): Promise<string> {
  // 1. next-intl
  const nextIntl = await getNextIntlTranslation(key, locale)
  if (nextIntl) return nextIntl

  // 2. src/lib/i18n flat
  const legacy = await getLegacyI18nTranslation(key, locale)
  if (legacy) return legacy

  // 3. Fallback na key sam (placeholder, admin lahko popravi)
  return key
}

/**
 * Statistika i18n konsolidacije — za migracijski dashboard.
 *
 * Vrne:
 *   - nextIntlCount: število ključev v messages/*.json (per locale)
 *   - legacyCount: število ključev v src/lib/i18n (per locale)
 *   - overlapCount: število ključev ki obstajajo v OBEH sistemih (migriraj najprej)
 *   - migrationProgress: % konsolidacije (0-100)
 */
export async function getI18nStats(): Promise<{
  nextIntl: Record<Locale, number>
  legacy: Record<Locale, number>
  overlap: number
  overall: { total: number; consolidated: number; pending: number; progress: number }
  recommendations: string[]
}> {
  const nextIntlCount: Record<Locale, number> = { sl: 0, en: 0, it: 0, hr: 0, de: 0 }
  const legacyCount: Record<Locale, number> = { sl: 0, en: 0, it: 0, hr: 0, de: 0 }

  // Preštej next-intl ključe (samo sl kot referenco)
  for (const locale of SUPPORTED_LOCALES) {
    const messages = await getNextIntlMessagesForCount(locale)
    nextIntlCount[locale] = messages
  }

  // Preštej legacy ključe (samo sl — predpostavlja enako število)
  const legacySl = await getLegacyI18nTranslationCount('sl')
  for (const locale of SUPPORTED_LOCALES) {
    legacyCount[locale] = legacySl // vsi jeziki imajo isto število ključev
  }

  // Prekrivanje — preštejemo koliko legacy ključev obstaja tudi v next-intl
  // (heuristic: preveri prvih N ključev da ne počasnimo)
  const overlap = await calculateOverlap()

  // Migracijski progress — next-intl je cilj, legacy je vir
  // 100% pomeni: 0 ključev v legacy (vse migrirano)
  const total = legacySl
  const consolidated = Math.max(0, legacySl - overlap)
  const progress = total > 0 ? Math.round((consolidated / total) * 1000) / 10 : 100

  const recommendations = generateRecommendations(legacySl, overlap)

  return {
    nextIntl: nextIntlCount,
    legacy: legacyCount,
    overlap,
    overall: {
      total,
      consolidated,
      pending: total - consolidated,
      progress,
    },
    recommendations,
  }
}

/**
 * Helper — preštej sporočila v next-intl messages za določen locale.
 * Glob search z dotted keys (rekurzivno).
 */
async function getNextIntlMessagesForCount(locale: Locale): Promise<number> {
  try {
    if (!nextIntlTranslationsCache[locale]) {
      const mod = await import(`@/../messages/${locale}.json`)
      nextIntlTranslationsCache[locale] = mod.default || mod
    }
    const messages = nextIntlTranslationsCache[locale]

    // Rekurzivno preštej vse string vrednosti (ne intermediate objekte)
    return countStringLeaves(messages)
  } catch {
    return 0
  }
}

function countStringLeaves(obj: unknown): number {
  if (typeof obj === 'string') return 1
  if (obj && typeof obj === 'object') {
    return Object.values(obj as Record<string, unknown>).reduce<number>(
      (sum, val) => sum + countStringLeaves(val),
      0,
    )
  }
  return 0
}

/**
 * Preštevaj ključe v src/lib/i18n (legacy) za določen locale.
 */
async function getLegacyI18nTranslationCount(locale: Locale): Promise<number> {
  try {
    const i18nMod = await import('@/lib/i18n')
    const translations = (i18nMod as unknown as {
      translations?: Record<string, Record<string, string>>
    }).translations
    if (!translations || !translations[locale]) return 0
    return Object.keys(translations[locale]).length
  } catch {
    return 0
  }
}

/**
 * Hevristično prekrivanje — preveri 10 vzorčnih ključev.
 * Real prekrivanje bi zahtevalo polno preverjanje, kar bi bilo počasno.
 */
async function calculateOverlap(): Promise<number> {
  try {
    const i18nMod = await import('@/lib/i18n')
    const translations = (i18nMod as unknown as {
      translations?: Record<string, Record<string, string>>
    }).translations
    if (!translations?.sl) return 0

    const legacyKeys = Object.keys(translations.sl)
    // Vzemi 10 vzorčnih (first 10)
    const sample = legacyKeys.slice(0, 10)
    let overlapCount = 0

    for (const key of sample) {
      // Preveri ali 'common.' + key obstaja v next-intl
      // (predpostavimo da so legacy keys brez namespace prefix)
      const withCommon = key.startsWith('common.') ? key : `common.${key}`
      const nextIntl = await getNextIntlTranslation(withCommon, 'sl')
      if (nextIntl) overlapCount++
    }

    // Skaliraj vzorec na vse ključe
    if (sample.length === 0) return 0
    const ratio = overlapCount / sample.length
    return Math.round(legacyKeys.length * ratio)
  } catch {
    return 0
  }
}

function generateRecommendations(totalLegacy: number, overlap: number): string[] {
  const recommendations: string[] = []

  if (totalLegacy === 0) {
    recommendations.push('✅ Vsi legacy i18n ključi so migrirani — sistema sta konsolidirana.')
    return recommendations
  }

  if (overlap > 0) {
    recommendations.push(
      `⚠️ ${overlap} ključev obstaja v obeh sistemih — migriraj te najprej (lahko izbrišeš iz src/lib/i18n).`,
    )
  }

  recommendations.push(
    `📋 ${totalLegacy - overlap} ključev je samo v src/lib/i18n — premakni jih v messages/sl.json (in ekvivalente za en/it/hr/de).`,
  )

  recommendations.push(
    '🔧 Po migraciji vseh ključev lahko izbrišeš src/lib/i18n/ direktorij (Phase 3).',
  )

  return recommendations
}

/**
 * Cleanup cache (za teste).
 */
export function resetI18nCacheForTesting(): void {
  nextIntlTranslationsCache = {}
}
