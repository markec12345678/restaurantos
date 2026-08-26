// ============================================
// NEMČIJA
// ============================================
import type { CountryConfig } from './types'

export const DE: CountryConfig = {
  code: 'DE',
  name: 'Germany',
  nameLocal: 'Deutschland',
  flag: '🇩🇪',
  currency: 'EUR',
  currencySymbol: '€',
  locale: 'de-DE',
  primaryLanguage: 'de',
  taxRates: {
    standard: 19,
    reduced: 7,
    zero: 0,
  },
  taxRateDescriptions: {
    standard: 'Regelsteuersatz 19% — die meisten Waren und Dienstleistungen, alkoholische Getränke',
    reduced: 'ermäßigter Steuersatz 7% — Lebensmittel (außer Alkohol), Bücher, Zeitungen, Blumen, Kunstgegenstände',
    zero: 'Steuersatz 0% — Ausfuhren, innergemeinschaftliche Lieferungen',
  },
  fiscalization: {
    system: 'KassensichV',
    systemLocal: 'Kassensicherungsverordnung / DSFinV-K',
    authority: 'Bundeszentralamt für Steuern',
    authorityShort: 'BZSt',
    required: true,
    hasDigitalSign: true,
    certificateFormat: 'TSE (Technische Sicherheitseinrichtung) — SD-Karte, USB, Cloud',
    testUrl: 'https://www.bzst.de/',
    prodUrl: 'https://www.bzst.de/',
    infoUrl: 'https://www.bzst.de/DE/Unternehmen/Kassensicherungsverordnung/kassensicherungsverordnung_node.html',
    receiptCodes: {
      protectionCode: 'TSE-Signatur',
      verificationCode: 'TSE-Transaktion',
    },
  },
  taxIdFormat: {
    prefix: 'DE',
    digits: 9,
    example: 'DE123456789',
    description: 'USt-IdNr: DE + 9 Stellen',
  },
  businessIdFormat: {
    digits: 9,
    example: 'DE123456789',
    description: 'Steuernummer / Handelsregisternummer',
  },
  receiptRequirements: [
    'Firmenname und -anschrift',
    'USt-IdNr (DExxxxxxxxx)',
    'Ausstellungsdatum',
    'Menge und Bezeichnung der Ware/Dienstleistung',
    'Umsatzsteuer nach Sätzen',
    'Bruttobetrag',
    'TSE-Signatur',
    'TSE-Transaktionsnummer',
    'TSE-Serialnummer',
    'TSE-Zeitstempel',
    'Kassennummer / Terminal-ID',
  ],
  printerCodePage: 850,  // Latin-1 za nemške znake
  dateFormat: 'dd.MM.yyyy',
  numberLocale: 'de-DE',
}
