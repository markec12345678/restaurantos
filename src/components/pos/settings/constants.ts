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
  // ISSUE #37 R125: legacy read-only echo — FURS UI zdaj bere Location
  // (GET /api/locations; zapis prek PUT /api/locations/[id]). Ti polja ostanejo
  // samo kot maskiran read-only odmev /api/settings (zapis ignorira furs*).
  fursCertPath: string
  fursCertPassword: string
  fursEnvironment: string
  cisCertPath: string
  cisCertPassword: string
  cisEnvironment: string
  defaultVatRate: number
  reducedVatRate: number
  receiptFooter: string
  currency: string
  locale: string
  country: string
  isActive: boolean
}

/** Stanje povezave s FURS (ponovno uporabljeno tudi za CIS povezavo) */
export type FursStatus = 'disconnected' | 'testing' | 'connected' | 'error'

/**
 * Forma + maskirne zastavice, ki jih GET /api/settings vrne poleg
 * SettingsData (hasCisCert/hasFursCert niso del zapisljivega objekta).
 */
export type SettingsFormWithFlags = Partial<SettingsData> & {
  hasCisCert?: boolean
  hasFursCert?: boolean
}

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

/**
 * ISSUE #37 R125: FURS konfiguracija je vezana na lokacijo (per poslovni
 * prostor) — tab upravlja svojo Location FURS state (GET/PUT /api/locations)
 * namesto polij settings forme; forma ne prenaša več form/updateField.
 */
export interface FursTabProps {
  fursStatus: FursStatus
  onTestFursConnection: () => void
  currentCountryCode: CountryCode
}

export interface CisTabProps {
  form: SettingsFormWithFlags
  updateField: (_field: string, _value: unknown) => void
  /** Stanje CIS povezave (isti tip kot fursStatus) */
  cisStatus: FursStatus
  onTestCisConnection: () => void
  /** Stanje testne oddaje računa (idle = 'disconnected') */
  cisSendStatus: FursStatus
  /** Surov odgovor testne oddaje (JIR/napaka/XML) — null pred prvo oddajo */
  cisSendResult: import('./cis-send-status').CisSendResponse | null
  onSendCisTestInvoice: () => void
  currentCountryCode: CountryCode
}

export interface ReceiptTabProps {
  form: Partial<SettingsData>
  updateField: (_field: string, _value: unknown) => void
}

export interface SettingsStatusBarProps {
  form: Partial<SettingsData>
  fursStatus: FursStatus
  /** Stanje CIS povezave — prikazano, ko je izbrana država HR (Task 24-c) */
  cisStatus: FursStatus
  lastSaved: string
  currentCountryCode: CountryCode
}
