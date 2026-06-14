// ============================================
// FURS TIPI IN KONSTANTE
// Slovenski zakon ZDDV-1 — davčno overjanje računov
// ============================================

// ============================================
// KONSTANTE
// ============================================

export const FURS_URLS = {
  test: 'https://blagajne-test.fu.gov.si:9002/v1/cash_payments',
  production: 'https://blagajne.fu.gov.si/v1/cash_payments',
} as const

export const FURS_TOKEN_URLS = {
  test: 'https://blagajne-test.fu.gov.si:9002/v1/cash_payments/oauth/token',
  production: 'https://blagajne.fu.gov.si/v1/cash_payments/oauth/token',
} as const

export type FursEnvironment = 'test' | 'production'

// ============================================
// TIPI
// ============================================

export interface FursConfig {
  businessId: string         // Matična številka (8 mest)
  taxId: string              // ID za DDV (SIxxxxxxxxx)
  registerId: string         // Številka blagajne
  premisesId: string         // Številka poslovnega prostora
  deviceIp: string           // IP naprave (za FURS identifikacijo)
  environment: FursEnvironment
  certPath?: string          // Pot do p12/pfx certifikata
  certPassword?: string      // Geslo certifikata
}

export interface FursReferenceInvoice {
  invoiceNumber: string      // Številka originalnega računa
  zoi: string                // ZOI originalnega računa
  issueDateTime: Date        // Datum izdaje originalnega računa
}

export interface FursInvoiceData {
  invoiceNumber: string      // Številka računa
  issueDateTime: Date        // Datum in čas izdaje
  totalAmount: number        // Skupni znesek
  paymentMethod: 'cash' | 'card' | 'mobile' | 'other'
  vatBreakdown: Array<{
    rate: number             // DDV stopnja (22, 9.5, 0)
    baseAmount: number       // Osnova
    vatAmount: number        // DDV znesek
  }>
  customerVatId?: string     // ID za DDV kupec (opcijsko)
  customerName?: string      // Ime kupca (opcijsko)
  // FIX BUG1: Proper ReferenceInvoice structure for storno — FURS requires original ZOI and issue date
  referenceInvoice?: FursReferenceInvoice
  isStorno?: boolean         // Označuje storno račun
}

export interface FursVerificationResult {
  success: boolean
  zoi: string
  eor: string
  environment: FursEnvironment
  verifiedAt: Date
  isSimulation: boolean
  error?: string
}

export interface FursQRData {
  zoi: string
  totalAmount: number
  issueDateTime: Date
  taxId: string
  businessId: string
  registerId: string
  premisesId: string
}
