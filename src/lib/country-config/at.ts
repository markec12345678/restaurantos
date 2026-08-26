// ============================================
// AVSTRIJA
// ============================================
import type { CountryConfig } from './types'

export const AT: CountryConfig = {
  code: 'AT',
  name: 'Austria',
  nameLocal: 'Österreich',
  flag: '🇦🇹',
  currency: 'EUR',
  currencySymbol: '€',
  locale: 'de-AT',
  primaryLanguage: 'de',
  taxRates: {
    standard: 20,
    reduced: 13,
    superReduced: 10,
    zero: 0,
  },
  taxRateDescriptions: {
    standard: 'Normalsteuersatz 20% — die meisten Waren und Dienstleistungen, alle alkoholischen Getränke',
    reduced: 'ermäßigter Steuersatz 13% — Beherbergung, Lebensmittel (außer Alkohol), Bücher, Kunst',
    superReduced: 'ermäßigter Steuersatz 10% — Lebensmittel, Buch, Miete, medizinische Betreuung',
    zero: 'Steuersatz 0% — Ausfuhren, innergemeinschaftliche Lieferungen, Seeschifffahrt',
  },
  fiscalization: {
    system: 'RKSV',
    systemLocal: 'Registrierkassensicherungsverordnung (RKSV)',
    authority: 'Bundesministerium für Finanzen',
    authorityShort: 'BMF',
    required: true,
    hasDigitalSign: true,
    certificateFormat: 'Wurzelzertifikat / RKF-Zertifikat',
    testUrl: 'https://hs-abnahme.bmf.gv.at/',
    prodUrl: 'https://hs.bmf.gv.at/',
    infoUrl: 'https://www.bmf.gv.at/',
    receiptCodes: {
      protectionCode: 'Umsatz-ID',
      verificationCode: 'DEP',
    },
  },
  taxIdFormat: {
    prefix: 'ATU',
    digits: 9,
    example: 'ATU12345678',
    description: 'UID-Nummer: ATU + 9 Stellen',
  },
  businessIdFormat: {
    digits: 9,
    example: 'ATU12345678',
    description: 'Firmenbuchnummer (FN)',
  },
  receiptRequirements: [
    'Firmenname',
    'Adresse des Standorts',
    'UID-Nummer (ATUxxxxxxxxx)',
    'Kassennummer',
    'Umsatzsteuer nach Sätzen mit Bemessungsgrundlage und Steuerbetrag',
    'Bruttobetrag',
    'DEP-Datensatz (Digitales Exportprotokoll)',
    'Signatur des Belegs',
    'Startbeleg / Anfangsbeleg',
    'Jahresabschlussbeleg',
  ],
  printerCodePage: 850,  // Latin-1 za avstrijske znake
  dateFormat: 'dd.MM.yyyy',
  numberLocale: 'de-AT',
}
