// ============================================
// FURS DAVČNO POTRJEVANJE — Skupne konstante in tipi
// ============================================
//
// ISSUE #37 R125: FURS (fiskalizacija) konfiguracija je vezana na LOKACIJO
// (per poslovni prostor — pravila FURS). Branje prek GET /api/locations
// (odgovor { locations: [...], stats }), pisanje prek PUT /api/locations/[id]
// SAMO s furs polji. Legacy /api/settings furs polja so read-only mrtvi odmev.

import type { ValidationErrorRow } from '@/lib/types'
import type { LucideIcon } from 'lucide-react'

// --- TIPI ---

export interface TestResult {
  success: boolean
  message?: string
  error?: string
  isSimulation?: boolean
  zoi?: string
  eor?: string
  responseTime?: number
  validationErrors?: ValidationErrorRow[]
}

/**
 * FURS-relevanten prerez lokacije (GET /api/locations vrsta).
 * fursCertPath/fursCertPassword so na strežniku MASKIRANI ('••••••' oz. '****'),
 * hasFursCert (R125-b) pove, ali je certifikat na lokaciji nastavljen.
 */
export interface LocationFursConfig {
  id: string
  name: string
  isActive?: boolean
  businessId?: string
  taxId?: string
  registerNumber?: string
  premisesId?: string
  fursCertPath?: string
  fursCertPassword?: string
  fursEnvironment?: string
  hasFursCert?: boolean
}

export interface FursStatus {
  connected?: boolean
  isSimulation?: boolean
  verifiedCount?: number
  environment?: string
  message?: string
}

// --- POMOŽNE FUNKCIJE ---

export type FursEnvironment = 'test' | 'production'

// --- LOKACIJSKA FURS KONFIGURACIJA (ISSUE #37 R125) ---

/** Hierarhična query tipka pod ['locations'] — prefix invalidacija locations CRUD-a jo osveži. */
export const FURS_LOCATIONS_KEY = ['locations', 'furs'] as const

/** Maske, ki jih API vrne namesto skrivnosti (settings: '••••••', locations: '****'). */
export const FURS_SECRET_MASKS = ['••••••', '****'] as const

/** Canonicalna maska, ki jo PUT /api/locations/[id] prepozna kot mask-keep (geslo). */
export const FURS_SECRET_MASK = '••••••'

/** Ali je vrednost maskirani odmev skrivnosti (ne podatka). */
export function isMaskedSecretValue(value: string | null | undefined): boolean {
  if (!value) return false
  return (FURS_SECRET_MASKS as readonly string[]).includes(value)
}

/**
 * Normalizacija odgovora GET /api/locations — hišni vzorec (array | { locations }),
 * filtrirano na vrste z id (obrambno).
 */
export function normalizeLocationsResponse(json: unknown): LocationFursConfig[] {
  const rows: unknown = Array.isArray(json)
    ? json
    : (json as { locations?: unknown } | null)?.locations
  if (!Array.isArray(rows)) return []
  return rows.filter((row): row is LocationFursConfig =>
    typeof (row as { id?: unknown } | null)?.id === 'string',
  )
}

/**
 * Resolucija "trenutne lokacije" za FURS UI: vezana lokacija naprave
 * (readDeviceLocation — URL ?locationId= / localStorage) > prva aktivna > null.
 */
export function pickCurrentLocation(
  rows: LocationFursConfig[],
  deviceLocationId: string | null | undefined,
): LocationFursConfig | null {
  if (deviceLocationId) {
    const bound = rows.find(l => l.id === deviceLocationId)
    if (bound) return bound
  }
  return rows.find(l => l.isActive === true) ?? null
}

/** Ali lokacija ima nastavljen FURS certifikat (hasFursCert flag ali maskirana skrivnost). */
export function locationHasFursCert(location: LocationFursConfig | null | undefined): boolean {
  if (!location) return false
  if (location.hasFursCert === true) return true
  return isMaskedSecretValue(location.fursCertPath) || isMaskedSecretValue(location.fursCertPassword)
}

/** Payload za PUT /api/locations/[id] — SAMO furs polja. */
export interface LocationFursSavePayload {
  fursEnvironment: FursEnvironment
  fursCertPath?: string
  fursCertPassword?: string
}

/**
 * Build payload-a za shranjevanje FURS konfiguracije lokacije (mask-keep):
 *  - geslo: nespremenjena maska → canonicalna '••••••' (strežnik ohrani shranjeno
 *    geslo), nov vnos → pošlji, prazno → IZPUSTI (ohrani obstoječe),
 *  - pot: maskirani odmev ali prazno → IZPUSTI (pot je na strežniku maskirana in
 *    je UI ne prepiše z masko), nov vnos → pošlji,
 *  - okolje: vedno.
 */
export function buildFursLocationSavePayload(
  certPath: string,
  certPassword: string,
  environment: FursEnvironment,
): LocationFursSavePayload {
  const payload: LocationFursSavePayload = { fursEnvironment: environment }
  if (certPassword) {
    payload.fursCertPassword = isMaskedSecretValue(certPassword) ? FURS_SECRET_MASK : certPassword
  }
  if (certPath && !isMaskedSecretValue(certPath)) {
    payload.fursCertPath = certPath
  }
  return payload
}

// --- PROPS INTERFACI ZA POD-KOMPONENTE ---

export interface FursStatusCardsProps {
  isConnected: boolean
  environment: FursEnvironment
  certPath: string
  verifiedCount: number
}

export interface CertificateConfigProps {
  certPath: string
  certPassword: string
  environment: FursEnvironment
  saving: boolean
  onCertPathChange: (_value: string) => void
  onCertPasswordChange: (_value: string) => void
  onEnvironmentChange: (_value: FursEnvironment) => void
  onSave: () => void
}

export interface TestResultsProps {
  testing: boolean
  testResult: TestResult | null
  onTestConnection: () => void
  onTestInvoice: () => void
}

export interface CurrentConfigProps {
  /** Lokacija — vir trenutne FURS konfiguracije (ISSUE #37 R125, ne settings). */
  location: LocationFursConfig | undefined | null
}

// FursSpecification nima props - uporablja Record<string, never>
export type FursSpecificationProps = Record<string, never>

export interface TierIconConfig {
  label: string
  color: string
  icon: LucideIcon
}
