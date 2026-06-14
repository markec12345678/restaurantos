// ============================================
// VEČDRŽAVNA KONFIGURACIJA POS SISTEMA
// Podpora za: Slovenijo, Hrvaško, Italijo, Avstrijo, Nemčijo
// Vsaka država ima: davčne stopnje, fiskalizacijo, valuto, jezik,
// format davčne številke, zahteve za račune itd.
// ============================================

export type CountryCode = 'SI' | 'HR' | 'IT' | 'AT' | 'DE'

export interface CountryConfig {
  code: CountryCode
  name: string
  nameLocal: string
  flag: string
  currency: string
  currencySymbol: string
  locale: string
  primaryLanguage: string
  // Davčne stopnje
  taxRates: {
    standard: number      // Splošna stopnja
    reduced: number       // Znižana stopnja
    superReduced?: number // Še nižja stopnja (IT, HR)
    zero: number          // Ničelna stopnja
  }
  // Opisi davčnih stopenj (za UI)
  taxRateDescriptions: {
    standard: string
    reduced: string
    superReduced?: string
    zero: string
  }
  // Fiskalizacija
  fiscalization: {
    system: string         // Ime sistema
    systemLocal: string    // Ime v lokalnem jeziku
    authority: string      // Ime organa
    authorityShort: string // Kratica organa
    required: boolean      // Ali je obvezna
    hasDigitalSign: boolean // Ali potrebuje digitalni podpis
    certificateFormat: string // Format certifikata
    testUrl?: string       // URL testnega okolja
    prodUrl?: string       // URL produkcijskega okolja
    infoUrl: string        // URL z informacijami
    receiptCodes: {        // Kode na računu
      protectionCode: string   // Zaščitna koda (npr. ZOI za SI, JIR za HR)
      verificationCode: string // Verifikacijska koda (npr. EOR za SI)
    }
  }
  // Format davčne številke
  taxIdFormat: {
    prefix: string        // Predpona (SI, HR, IT, ATU, DE)
    digits: number        // Število števk
    example: string       // Primer
    description: string   // Opis formata
  }
  // Poslovna številka
  businessIdFormat: {
    digits: number
    example: string
    description: string
  }
  // Zahteve za račune
  receiptRequirements: string[]
  // Code page za termični tiskalnik
  printerCodePage: number
  // Format datuma
  dateFormat: string
  // Locale za številske formate
  numberLocale: string
}
