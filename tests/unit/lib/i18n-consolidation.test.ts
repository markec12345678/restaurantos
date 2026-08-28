// ============================================
// I18N CONSOLIDATION — Unit testi (Issue #44)
//
// Preverjamo:
// - isSupportedLocale: prepozna podprt jezik
// - getNextIntlTranslation: dotted lookup v messages/*.json
// - getLegacyI18nTranslation: flat lookup v src/lib/i18n
// - tTranslate: prioritetna veriga (nextIntl > legacy > key)
// - getI18nStats: števci + recommendations
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const mockNextIntlImport = vi.fn()
  const mockLegacyImport = vi.fn()
  return { mockNextIntlImport, mockLegacyImport }
})

// Mock dynamicnih importov
// next-intl messages — preprost mock
vi.mock('@/../messages/sl.json', () => ({
  default: {
    common: { save: 'Shrani', cancel: 'Prekliči' },
    orders: { table: 'Miza' },
  },
}))
vi.mock('@/../messages/en.json', () => ({
  default: {
    common: { save: 'Save', cancel: 'Cancel' },
    orders: { table: 'Table' },
  },
}))

// src/lib/i18n mock — flat keys
vi.mock('@/lib/i18n', () => ({
  translations: {
    sl: { 'common.save': 'Shrani (legacy)', 'legacy.only': 'Legacy-only ključ' },
    en: { 'common.save': 'Save (legacy)', 'legacy.only': 'Legacy-only key' },
  },
  setLocale: vi.fn(),
  getLocale: vi.fn().mockReturnValue('sl'),
  t: vi.fn((key: string) => key),
}))

import {
  isSupportedLocale,
  tTranslate,
  getNextIntlTranslation,
  getLegacyI18nTranslation,
  resetI18nCacheForTesting,
} from '@/lib/i18n/i18n-consolidation'

describe('isSupportedLocale — Issue #44', () => {
  it('prepozna podprte jezike', () => {
    expect(isSupportedLocale('sl')).toBe(true)
    expect(isSupportedLocale('en')).toBe(true)
    expect(isSupportedLocale('it')).toBe(true)
    expect(isSupportedLocale('hr')).toBe(true)
    expect(isSupportedLocale('de')).toBe(true)
  })

  it('zavrne nepodprte jezike', () => {
    expect(isSupportedLocale('ar')).toBe(false)
    expect(isSupportedLocale('fr')).toBe(false)
    expect(isSupportedLocale('')).toBe(false)
    expect(isSupportedLocale('SL')).toBe(false) // case-sensitive
  })
})

describe('getNextIntlTranslation — Issue #44', () => {
  beforeEach(() => {
    resetI18nCacheForTesting()
  })

  it('dotted lookup: common.save', async () => {
    const result = await getNextIntlTranslation('common.save', 'sl')
    expect(result).toBe('Shrani')
  })

  it('dotted lookup v angleščini', async () => {
    const result = await getNextIntlTranslation('common.save', 'en')
    expect(result).toBe('Save')
  })

  it('dotted lookup: orders.table', async () => {
    const result = await getNextIntlTranslation('orders.table', 'sl')
    expect(result).toBe('Miza')
  })

  it('vrne null za neobstoječ ključ', async () => {
    const result = await getNextIntlTranslation('common.nonexistent', 'sl')
    expect(result).toBeNull()
  })

  it('vrne null za prazen ključ', async () => {
    const result = await getNextIntlTranslation('', 'sl')
    expect(result).toBeNull()
  })

  it('vrne null za neobstoječ jezik', async () => {
    const result = await getNextIntlTranslation('common.save', 'fr' as never)
    expect(result).toBeNull()
  })

  it('vrne null za intermediate objekt (ne string)', async () => {
    // 'common' je objekt, ne string
    const result = await getNextIntlTranslation('common', 'sl')
    expect(result).toBeNull()
  })
})

describe('getLegacyI18nTranslation — Issue #44', () => {
  it('flat lookup: common.save', async () => {
    const result = await getLegacyI18nTranslation('common.save', 'sl')
    expect(result).toBe('Shrani (legacy)')
  })

  it('flat lookup: legacy.only (samo v legacy)', async () => {
    const result = await getLegacyI18nTranslation('legacy.only', 'sl')
    expect(result).toBe('Legacy-only ključ')
  })

  it('vrne null za neobstoječ ključ', async () => {
    const result = await getLegacyI18nTranslation('nonexistent.key', 'sl')
    expect(result).toBeNull()
  })
})

describe('tTranslate — prioritetna veriga Issue #44', () => {
  beforeEach(() => {
    resetI18nCacheForTesting()
  })

  it('1. prioriteta: next-intl messages', async () => {
    // 'common.save' obstaja v obeh — next-intl ima prednost
    const result = await tTranslate('common.save', 'sl')
    expect(result).toBe('Shrani') // ne 'Shrani (legacy)'
  })

  it('2. prioriteta: src/lib/i18n legacy (če next-intl nima)', async () => {
    // 'legacy.only' obstaja samo v src/lib/i18n
    const result = await tTranslate('legacy.only', 'sl')
    expect(result).toBe('Legacy-only ključ')
  })

  it('3. prioriteta: fallback na key sam', async () => {
    // 'nonexistent.key' ne obstaja nikjer
    const result = await tTranslate('nonexistent.key', 'sl')
    expect(result).toBe('nonexistent.key')
  })

  it('angleški prevod preko next-intl', async () => {
    const result = await tTranslate('common.save', 'en')
    expect(result).toBe('Save')
  })
})

describe('getI18nStats — Issue #44 migracijski dashboard', () => {
  beforeEach(() => {
    resetI18nCacheForTesting()
  })

  it('vrne strukturo s števci', async () => {
    const { getI18nStats } = await import('@/lib/i18n/i18n-consolidation')
    const result = await getI18nStats()

    expect(result).toHaveProperty('nextIntl')
    expect(result).toHaveProperty('legacy')
    expect(result).toHaveProperty('overlap')
    expect(result).toHaveProperty('overall')
    expect(result).toHaveProperty('recommendations')

    expect(result.overall).toHaveProperty('total')
    expect(result.overall).toHaveProperty('consolidated')
    expect(result.overall).toHaveProperty('pending')
    expect(result.overall).toHaveProperty('progress')
  })

  it('nextIntl števec za sl > 0', async () => {
    const { getI18nStats } = await import('@/lib/i18n/i18n-consolidation')
    const result = await getI18nStats()
    expect(result.nextIntl.sl).toBeGreaterThan(0)
  })

  it('legacy števec > 0 (v mock-u imamo 2 ključa)', async () => {
    const { getI18nStats } = await import('@/lib/i18n/i18n-consolidation')
    const result = await getI18nStats()
    expect(result.legacy.sl).toBeGreaterThan(0)
  })

  it('recommendations vključuje navodila za migracijo', async () => {
    const { getI18nStats } = await import('@/lib/i18n/i18n-consolidation')
    const result = await getI18nStats()
    expect(result.recommendations.length).toBeGreaterThan(0)
    // Vsebuje nasvet za migracijo
    expect(result.recommendations.some((r) => r.includes('migrira') || r.includes('migr'))).toBe(true)
  })

  it('progress je med 0 in 100', async () => {
    const { getI18nStats } = await import('@/lib/i18n/i18n-consolidation')
    const result = await getI18nStats()
    expect(result.overall.progress).toBeGreaterThanOrEqual(0)
    expect(result.overall.progress).toBeLessThanOrEqual(100)
  })
})
