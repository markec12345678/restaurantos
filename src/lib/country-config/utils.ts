// ============================================
// POMOŽNE FUNKCIJE ZA DRŽAVNE KONFIGURACIJE
// ============================================
import type { CountryCode, CountryConfig } from './types'
import { SI } from './si'
import { HR } from './hr'
import { IT } from './it'
import { AT } from './at'
import { DE } from './de'

// ============================================
// MAPA VSEH DRŽAV
// ============================================
export const countries: Record<CountryCode, CountryConfig> = { SI, HR, IT, AT, DE }

export const countryList: CountryConfig[] = [SI, HR, IT, AT, DE]

export function getCountryConfig(code: CountryCode): CountryConfig {
  return countries[code] || SI
}

export function getCountryByLocale(locale: string): CountryCode {
  const mapping: Record<string, CountryCode> = {
    'sl': 'SI', 'sl-SI': 'SI',
    'hr': 'HR', 'hr-HR': 'HR',
    'it': 'IT', 'it-IT': 'IT',
    'de': 'AT', 'de-AT': 'AT', 'de-DE': 'DE',
  }
  return mapping[locale] || 'SI'
}

// Pridobi FURS-kompatibilne kode za DDV (za račune)
export function getTaxCodeForRate(country: CountryCode, rate: number): string {
  const config = getCountryConfig(country)
  if (rate === config.taxRates.standard) return 'S'   // Standard
  if (rate === config.taxRates.reduced) return 'R'    // Reduced
  if (rate === config.taxRates.superReduced && rate !== 0) return 'RR' // Super-reduced
  if (rate === config.taxRates.zero) return 'Z'       // Zero
  return 'S' // Default standard
}

// Pridobi vse davčne stopnje za državo (za dropdown)
export function getTaxRateOptions(country: CountryCode): { value: number; label: string; code: string }[] {
  const config = getCountryConfig(country)
  const options = [
    { value: config.taxRates.standard, label: `${config.taxRates.standard}% (standard)`, code: 'S' },
    { value: config.taxRates.reduced, label: `${config.taxRates.reduced}% (reduced)`, code: 'R' },
  ]
  if (config.taxRates.superReduced !== undefined) {
    options.push({ value: config.taxRates.superReduced, label: `${config.taxRates.superReduced}% (super-reduced)`, code: 'RR' })
  }
  options.push({ value: 0, label: '0% (zero)', code: 'Z' })
  return options
}
