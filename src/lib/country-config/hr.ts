// ============================================
// HRVAŠKA
// ============================================
import type { CountryConfig } from './types'

export const HR: CountryConfig = {
  code: 'HR',
  name: 'Croatia',
  nameLocal: 'Hrvatska',
  flag: '🇭🇷',
  currency: 'EUR',
  currencySymbol: '€',
  locale: 'hr-HR',
  primaryLanguage: 'hr',
  taxRates: {
    standard: 25,
    reduced: 13,
    superReduced: 5,
    zero: 0,
  },
  taxRateDescriptions: {
    standard: 'Opći PDV stopa 25% — većina robe i usluga, sva alkoholna pića',
    reduced: 'Snižena PDV stopa 13% — hrana (bez alkohola), voda, knjige, novine, lijekovi, ulaznice za kulturne događaje',
    superReduced: 'Posebno snižena PDV stopa 5% — kruh, mlijeko, ljekovito bilje, priručnici za školstvo, dječja oprema',
    zero: 'Stopa 0% — izvoz robe, međunarodni prijevoz, isporuka lijekova humanitarnim organizacijama',
  },
  fiscalization: {
    system: 'Fiskalizacija',
    systemLocal: 'Fiskalizacija računa',
    authority: 'Porezna uprava Republike Hrvatske',
    authorityShort: 'Porezna uprava',
    required: true,
    hasDigitalSign: true,
    certificateFormat: 'PKCS#12 (.p12) — FINA certifikat',
    testUrl: 'https://cistest.apis-it.hr:8449/FiskalizacijaService',
    prodUrl: 'https://cis.apis-it.hr:8449/FiskalizacijaService',
    infoUrl: 'https://porezna-uprava.gov.hr/',
    receiptCodes: {
      protectionCode: 'JIR',
      verificationCode: 'JIR',
    },
  },
  taxIdFormat: {
    prefix: 'HR',
    digits: 11,
    example: 'HR12345678901',
    description: 'OIB: HR + 11 znamenki',
  },
  businessIdFormat: {
    digits: 11,
    example: '12345678901',
    description: 'OIB: 11 znamenki',
  },
  receiptRequirements: [
    'Naziv trgovačkog društva',
    'Adresa poslovnog prostora',
    'OIB (osobni identifikacijski broj)',
    'PDV broj (HRxxxxxxxxxxx)',
    'Oznaka poslovnog prostora',
    'Oznaka naplatnog uređaja',
    'JIR (jedinstveni identifikator računa)',
    'ZKI (zaštitni kod izdavatelja)',
    'PDV po stopama s osnovicom i iznosom poreza',
    'Vrijeme izdavanja računa',
  ],
  printerCodePage: 852,  // Latin-2 za čćžšđ
  dateFormat: 'dd.MM.yyyy.',
  numberLocale: 'hr-HR',
}
