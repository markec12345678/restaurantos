// ============================================
// TIPI, KONSTANTE IN POMOŽNE FUNKCIJE
// za podkomponente nastavitev
// ============================================

import type { CountryCode } from '@/lib/country-config'

// --- Tipi ---

export interface SettingsData {
  id: string
  name: string
  address: string
  city: string
  postCode: string
  phone: string
  email: string
  web: string
  businessId: string
  taxId: string
  registerNumber: string
  fursCertPath: string
  fursCertPassword: string
  fursEnvironment: string
  defaultVatRate: number
  reducedVatRate: number
  receiptFooter: string
  currency: string
  locale: string
  country: string
  isActive: boolean
}

/** Stanje povezave s FURS */
export type FursStatus = 'disconnected' | 'testing' | 'connected' | 'error'

/** Rezultat posamezne overitve v množičnem overjanju */
export interface BatchVerificationResult {
  receiptId: string
  receiptNumber: string
  success: boolean
  error?: string
  isSimulation?: boolean
}

/** Rezultat množičnega overjanja */
export interface BatchVerificationResults {
  processed: number
  successful: number
  failed: number
  results: BatchVerificationResult[]
}

/** Status neoverjenih računov */
export interface BatchStatus {
  unverifiedCount: number
  oldestUnverified: { receiptNumber: string; createdAt: string } | null
}

// --- Props za podkomponente ---

export interface CountryTabProps {
  selectedCountry: CountryCode
  onCountryChange: (_code: CountryCode) => void
}

export interface CompanyTabProps {
  form: Partial<SettingsData>
  updateField: (_field: string, _value: unknown) => void
}

export interface TaxTabProps {
  form: Partial<SettingsData>
  updateField: (_field: string, _value: unknown) => void
  currentCountryCode: CountryCode
  bulkVatFrom: string
  bulkVatTo: string
  setBulkVatFrom: (_v: string) => void
  setBulkVatTo: (_v: string) => void
  onBulkVatChange: () => void
  bulkVatPending: boolean
}

export interface FursTabProps {
  form: Partial<SettingsData>
  updateField: (_field: string, _value: unknown) => void
  fursStatus: FursStatus
  onTestFursConnection: () => void
  currentCountryCode: CountryCode
}

export interface ReceiptTabProps {
  form: Partial<SettingsData>
  updateField: (_field: string, _value: unknown) => void
}

export interface SettingsStatusBarProps {
  form: Partial<SettingsData>
  fursStatus: FursStatus
  lastSaved: string
  currentCountryCode: CountryCode
}
