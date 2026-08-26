// ============================================
// SLOVENIJA
// ============================================
import type { CountryConfig } from './types'

export const SI: CountryConfig = {
  code: 'SI',
  name: 'Slovenia',
  nameLocal: 'Slovenija',
  flag: '🇸🇮',
  currency: 'EUR',
  currencySymbol: '€',
  locale: 'sl-SI',
  primaryLanguage: 'sl',
  taxRates: {
    standard: 22,
    reduced: 9.5,
    zero: 0,
  },
  taxRateDescriptions: {
    standard: 'Splošna DDV stopnja 22% — velja za večino blaga in storitev, vse pijače (tudi alkohol)',
    reduced: 'Znižana DDV stopnja 9.5% — živila (razen alkohola), knjige, zdravila, sanitarni material, stanovanjske storitve',
    zero: 'Ničelna stopnja 0% — izvoz blaga, storitve tretjim državam, mednarodni prevoz',
  },
  fiscalization: {
    system: 'FURS',
    systemLocal: 'FURS davčno potrjevanje',
    authority: 'Finančna uprava Republike Slovenije',
    authorityShort: 'FURS',
    required: true,
    hasDigitalSign: true,
    certificateFormat: 'PKCS#12 (.p12)',
    testUrl: 'https://blagajne-test.fu.gov.si:9002',
    prodUrl: 'https://blagajne.fu.gov.si',
    infoUrl: 'https://www.fu.gov.si/',
    receiptCodes: {
      protectionCode: 'ZOI',
      verificationCode: 'EOR',
    },
  },
  taxIdFormat: {
    prefix: 'SI',
    digits: 8,
    example: 'SI12345678',
    description: 'ID za DDV: SI + 8 mest',
  },
  businessIdFormat: {
    digits: 8,
    example: '12345678',
    description: 'Matična številka: 8 mest',
  },
  receiptRequirements: [
    'Naziv podjetja',
    'Naslov poslovnega prostora',
    'Matična številka',
    'ID za DDV (SIxxxxxxxxx)',
    'Oznaka poslovnega prostora',
    'Oznaka blagajne/naprave',
    'ZOI (zaščitni označitelj izdajanja)',
    'EOR (elektronski zapis o računu)',
    'DDV po stopnjah z osnovo in zneskom',
  ],
  printerCodePage: 852,  // Latin-2 za čšž
  dateFormat: 'dd.MM.yyyy',
  numberLocale: 'sl-SI',
}
