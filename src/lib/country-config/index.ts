// Barrel re-export za backward kompatibilnost
// Vsi uvozi `@/lib/country-config` še vedno delujejo

export type { CountryCode, CountryConfig } from './types'
export { SI } from './si'
export { HR } from './hr'
export { IT } from './it'
export { AT } from './at'
export { DE } from './de'
export {
  countries,
  countryList,
  getCountryConfig,
  getCountryByLocale,
  getTaxCodeForRate,
  getTaxRateOptions,
} from './utils'
