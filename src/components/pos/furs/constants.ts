// ============================================
// FURS DAVČNO POTRJEVANJE — Skupne konstante in tipi
// ============================================

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

export interface FursSettings {
  businessId?: string
  taxId?: string
  registerNumber?: string
  premisesId?: string
  fursEnvironment?: string
  fursCertPath?: string
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
  settings: FursSettings | undefined | null
}

// FursSpecification nima props - uporablja Record<string, never>
export type FursSpecificationProps = Record<string, never>

export interface TierIconConfig {
  label: string
  color: string
  icon: LucideIcon
}
