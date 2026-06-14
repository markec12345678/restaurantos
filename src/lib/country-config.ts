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

// ============================================
// SLOVENIJA
// ============================================
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

// ============================================
// HRVAŠKA
// ============================================
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

// ============================================
// ITALIJA
// ============================================
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

// ============================================
// AVSTRIJA
// ============================================
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

// ============================================
// NEMČIJA
// ============================================
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

// ============================================
// MAPA VSEH DRŽAV
// ============================================
export const countries: Record<CountryCode, CountryConfig> = { SI, HR, IT, AT, DE }

export const countryList: CountryConfig[] = [SI, HR, IT, AT, DE]

export function getCountryConfig(code: CountryCode): CountryConfig {
  return countries[code] || SI
}

export function getCountryByLocale(locale: string): CountryCode {
  const mapping: Record<string, CountryCode> = {
    'sl': 'SI', 'sl-SI': 'SI',
    'hr': 'HR', 'hr-HR': 'HR',
    'it': 'IT', 'it-IT': 'IT',
    'de': 'AT', 'de-AT': 'AT', 'de-DE': 'DE',
  }
  return mapping[locale] || 'SI'
}

// Pridobi FURS-kompatibilne kode za DDV (za račune)
export function getTaxCodeForRate(country: CountryCode, rate: number): string {
  const config = getCountryConfig(country)
  if (rate === config.taxRates.standard) return 'S'   // Standard
  if (rate === config.taxRates.reduced) return 'R'    // Reduced
  if (rate === config.taxRates.superReduced && rate !== 0) return 'RR' // Super-reduced
  if (rate === config.taxRates.zero) return 'Z'       // Zero
  return 'S' // Default standard
}

// Pridobi vse davčne stopnje za državo (za dropdown)
export function getTaxRateOptions(country: CountryCode): { value: number; label: string; code: string }[] {
  const config = getCountryConfig(country)
  const options = [
    { value: config.taxRates.standard, label: `${config.taxRates.standard}% (standard)`, code: 'S' },
    { value: config.taxRates.reduced, label: `${config.taxRates.reduced}% (reduced)`, code: 'R' },
  ]
  if (config.taxRates.superReduced !== undefined) {
    options.push({ value: config.taxRates.superReduced, label: `${config.taxRates.superReduced}% (super-reduced)`, code: 'RR' })
  }
  options.push({ value: 0, label: '0% (zero)', code: 'Z' })
  return options
}
