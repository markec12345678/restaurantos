// ============================================
// ITALIJA
// ============================================
import type { CountryConfig } from './types'

export const IT: CountryConfig = {
  code: 'IT',
  name: 'Italy',
  nameLocal: 'Italia',
  flag: '🇮🇹',
  currency: 'EUR',
  currencySymbol: '€',
  locale: 'it-IT',
  primaryLanguage: 'it',
  taxRates: {
    standard: 22,
    reduced: 10,
    superReduced: 4,
    zero: 0,
  },
  taxRateDescriptions: {
    standard: 'Aliquota IVA ordinaria 22% — maggioranza di beni e servizi, alcolici',
    reduced: 'Aliquota IVA ridotta 10% — generi alimentari (non alcolici), farmaci, acqua, spettacoli, ristorazione',
    superReduced: 'Aliquota IVA minima 4% — generi di prima necessità, libri, periodici, prodotti agricoli',
    zero: 'Aliquota 0% — esportazioni, servizi internazionali, operazioni intracomunitarie',
  },
  fiscalization: {
    system: 'Sistema TS',
    systemLocal: 'Sistema Tessera Sanitaria / SDI',
    authority: 'Agenzia delle Entrate',
    authorityShort: 'Ade',
    required: true,
    hasDigitalSign: true,
    certificateFormat: 'Smart Card / Aruba Sign / InfoCert',
    testUrl: 'https://sts-test.agenziaentrate.gov.it/',
    prodUrl: 'https://sts.agenziaentrate.gov.it/',
    infoUrl: 'https://www.agenziaentrate.gov.it/',
    receiptCodes: {
      protectionCode: 'RT',
      verificationCode: 'SDI',
    },
  },
  taxIdFormat: {
    prefix: 'IT',
    digits: 11,
    example: 'IT12345678901',
    description: 'Partita IVA: IT + 11 cifre',
  },
  businessIdFormat: {
    digits: 11,
    example: '12345678901',
    description: 'Codice Fiscale / P.IVA: 11 cifre',
  },
  receiptRequirements: [
    'Ragione sociale / Denominazione',
    'Indirizzo della sede',
    'Partita IVA',
    'Codice Fiscale',
    'Regime fiscale',
    'Numero e data del documento',
    'Descrizione beni/servizi',
    'IVA per aliquota con imponibile e imposta',
    'Totale documento',
    'Bollo / Riferimento SDI',
  ],
  printerCodePage: 850,  // Latin-1 za italijanske znake
  dateFormat: 'dd/MM/yyyy',
  numberLocale: 'it-IT',
}
