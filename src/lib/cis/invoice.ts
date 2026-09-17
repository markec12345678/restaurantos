// ============================================
// CIS RACUNZAHTJEV — gradnja SOAP zahteve + ZKI (HR fiskalizacija)
// ============================================
// Struktura XML-a je TOČNO po referenčni implementaciji fiskalizacija2-js
// (spec v1.3+ / namespace f73, verificirano Task 24-b). RED elementov znotraj
// tns:Racun je vezan z XML shemo (sequence) — NE premeščaj!
//
// Potek buildRacunZahtjev():
//   1. validateRacunData() — neveljavni podatki → rezultat z valid=false,
//      prazen envelope (non-throwing, skladno s checkCisConnectivity stilom)
//   2. IdPoruke = randomUUID() ( že lowercase, vzorec uuid v fields.ts)
//   3. Zaglavlje/DatumVrijeme = čas sporočila (opts.now ?? Date.now) v Zagrebu
//   4. ZKI = computeZki(nad podatki RAČUNA — DatVrijeme računa, ne zaglavlja!)
//   5. envelope string (soap:Envelope → tns:RacunZahtjev)
//
// XML-dsig podpis soap:Body je LOČEN korak (zahteva FINA P12) — TODO ob
// pridobitvi certifikata; glej worklog Task 23/24.
// ============================================

import { randomUUID } from 'node:crypto'
import { CIS_NS, CIS_SOAP_NS } from './constants'
import { CIS_FIELD_PATTERNS, CIS_OZNA_SLIJED_VALUES, CIS_NACIN_PLACANJA_VALUES } from './fields'
import { computeZki, formatCisAmount, formatCisDateTime } from './zki'
import type { CisConfigValidation } from './types'

/** Znesek: številka (normaliziramo) ALI že formatiran niz ("15.00", STROGO). */
export type CisAmount = number | string

/** Porez po stopi (tns:Pdv/tns:Pnp → tns:Porez, ponovljivo). */
export interface CisPorezStopa {
  stopa: CisAmount
  osnovica: CisAmount
  iznos: CisAmount
}

/** Ostali porezi (tns:OstaliPor → tns:Porez z Naziv, ponovljivo). */
export interface CisOstaliPorez {
  naziv: string
  stopa: CisAmount
  osnovica: CisAmount
  iznos: CisAmount
}

/** Naknada (tns:Naknade → tns:Naknada, ponovljivo). */
export interface CisNaknada {
  nazivN: string
  iznosN: CisAmount
}

/** Podatki računa za RacunZahtjev (zrcali tns:Racun, spec v1.3+). */
export interface CisRacunData {
  /** OIB izdajatelja — 11 števk. */
  oib: string
  /** Ali je izdajatelj v sistemu PDV. */
  usustPdv: boolean
  /** Čas izdaje računa — Date ALI že formatiran niz dd.MM.yyyyTHH:mm:ss. */
  datumVrijeme: Date | string
  /** P = račun v rednem slijedu, N = brez slijeda (paragon). */
  oznSlijed: 'P' | 'N'
  brOznRac: string
  oznPosPr: string
  oznNapUr: string
  /** Porazdelitev PDV po stopah (opcijsko — samo če je izdajatelj v PDV). */
  pdv?: CisPorezStopa[]
  pnp?: CisPorezStopa[]
  ostaliPor?: CisOstaliPorez[]
  iznosOslobPdv?: CisAmount
  iznosMarza?: CisAmount
  iznosNePodlOpor?: CisAmount
  naknade?: CisNaknada[]
  iznosUkupno: CisAmount
  nacinPlac: 'G' | 'K' | 'T' | 'O'
  /** OIB operaterja — 11 števk. */
  oibOper: string
  /** Naknadno dostavljanje (paragon računi). */
  nakDost: boolean
  /** Samo ob nakDost=true — sicer validation napaka. */
  paragonBrRac?: string
  specNamj?: string
  oibPrimateljaRacuna?: string
}

/** Rezultat gradnje zahteve (enako CisConfigValidation konvenciji). */
export interface CisInvoiceRequestResult {
  /** SOAP envelope (pri valid=false prazen niz ''). */
  envelope: string
  /** Izračunani ZKI (32 malih hex znakov; pri valid=false ''). */
  zki: string
  /** UUID poruke (Id atributa RacunZahtjev + Zaglavlje/IdPoruke). */
  idPoruke: string
  validation: CisConfigValidation
}

/** XML-escape besedilnih vrednosti (& < > " ') — npr. Naziv, SpecNamj. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Validiraj znesek (formatCisAmount napake ujamemo v berljive validation napake). */
function validateAmount(label: string, value: CisAmount | undefined, errors: string[]): void {
  if (value === undefined) return
  try {
    formatCisAmount(value)
  } catch (err: unknown) {
    errors.push(`${label}: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/** Validiraj stopo (npr. "25.00"); številka se najprej formatira. */
function validateStopa(label: string, value: CisAmount, errors: string[]): void {
  const asString =
    typeof value === 'number' ? (Number.isFinite(value) ? value.toFixed(2) : String(value)) : value
  if (!CIS_FIELD_PATTERNS.stopa.test(asString)) {
    errors.push(`${label} "${String(value)}": stopa naj bo do 3 števke + 2 decimalki (npr. "25.00")`)
  }
}

/**
 * Validiraj podatke računa proti vzorcem CIS_FIELD_PATTERNS in poslovnim pravilom.
 * Non-throwing — vedno vrne { valid, errors, warnings }.
 */
export function validateRacunData(data: CisRacunData): CisConfigValidation {
  const errors: string[] = []
  const warnings: string[] = []

  if (!CIS_FIELD_PATTERNS.oib.test(data.oib)) {
    errors.push(`Oib "${data.oib}": pričakovanih natanko 11 števk`)
  }
  if (typeof data.datumVrijeme === 'string' && !CIS_FIELD_PATTERNS.datumVrijeme.test(data.datumVrijeme)) {
    errors.push(`DatVrijeme "${data.datumVrijeme}": pričakovan format dd.MM.yyyyTHH:mm:ss`)
  }
  if (!(CIS_OZNA_SLIJED_VALUES as readonly string[]).includes(data.oznSlijed)) {
    errors.push(`OznSlijed "${data.oznSlijed}": dovoljeno P ali N`)
  }
  if (!CIS_FIELD_PATTERNS.brOznRac.test(data.brOznRac)) {
    errors.push(`BrOznRac "${data.brOznRac}": pričakovane samo številke (1–20)`)
  }
  if (!CIS_FIELD_PATTERNS.oznPosPr.test(data.oznPosPr)) {
    errors.push(`OznPosPr "${data.oznPosPr}": dovoljeno alfanumerično + pomišljaj (1–20 znakov)`)
  }
  if (!CIS_FIELD_PATTERNS.oznNapUr.test(data.oznNapUr)) {
    errors.push(`OznNapUr "${data.oznNapUr}": pričakovane samo številke (1–20)`)
  }

  // Zneski — glavni + po stopah + opcijski
  validateAmount('IznosUkupno', data.iznosUkupno, errors)
  const porezGroups: Array<[string, CisPorezStopa[] | undefined]> = [
    ['Pdv', data.pdv],
    ['Pnp', data.pnp],
  ]
  for (const [name, group] of porezGroups) {
    for (const [i, p] of (group ?? []).entries()) {
      validateStopa(`${name}[${i}].Stopa`, p.stopa, errors)
      validateAmount(`${name}[${i}].Osnovica`, p.osnovica, errors)
      validateAmount(`${name}[${i}].Iznos`, p.iznos, errors)
    }
  }
  for (const [i, p] of (data.ostaliPor ?? []).entries()) {
    if (!p.naziv || !p.naziv.trim()) {
      errors.push(`OstaliPor[${i}].Naziv ne sme biti prazen`)
    }
    validateStopa(`OstaliPor[${i}].Stopa`, p.stopa, errors)
    validateAmount(`OstaliPor[${i}].Osnovica`, p.osnovica, errors)
    validateAmount(`OstaliPor[${i}].Iznos`, p.iznos, errors)
  }
  validateAmount('IznosOslobPdv', data.iznosOslobPdv, errors)
  validateAmount('IznosMarza', data.iznosMarza, errors)
  validateAmount('IznosNePodlOpor', data.iznosNePodlOpor, errors)
  for (const [i, n] of (data.naknade ?? []).entries()) {
    if (!n.nazivN || !n.nazivN.trim()) {
      errors.push(`Naknade[${i}].NazivN ne sme biti prazen`)
    }
    validateAmount(`Naknade[${i}].IznosN`, n.iznosN, errors)
  }

  if (!(CIS_NACIN_PLACANJA_VALUES as readonly string[]).includes(data.nacinPlac)) {
    errors.push(`NacinPlac "${data.nacinPlac}": dovoljeno G, K, T, O ("C" NI veljaven v HR)`)
  }
  if (!CIS_FIELD_PATTERNS.oib.test(data.oibOper)) {
    errors.push(`OibOper "${data.oibOper}": pričakovanih natanko 11 števk`)
  }
  // Poslovno pravilo: ParagonBrRac izključno ob naknadnem dostavljanju
  if (data.paragonBrRac !== undefined && data.paragonBrRac !== '' && !data.nakDost) {
    errors.push('ParagonBrRac je dovoljen SAMO ob NakDost=true (naknadno dostavljanje)')
  }
  if (data.oibPrimateljaRacuna !== undefined && data.oibPrimateljaRacuna !== '' && !CIS_FIELD_PATTERNS.oib.test(data.oibPrimateljaRacuna)) {
    errors.push(`OibPrimateljaRacuna "${data.oibPrimateljaRacuna}": pričakovanih natanko 11 števk`)
  }

  // Opozorila (ne blokirajo oddaje)
  if (!data.usustPdv && ((data.pdv?.length ?? 0) > 0 || (data.pnp?.length ?? 0) > 0)) {
    warnings.push('USustPdv=false, a so podani Pdv/Pnp bloki — pričakovano prazni pri ne-PDV izdajatelju')
  }
  if (data.nakDost && !data.paragonBrRac) {
    warnings.push('NakDost=true brez ParagonBrRac — CIS pričakuje paragon številko ob naknadnem dostavljanju')
  }

  return { valid: errors.length === 0, errors, warnings }
}

/** Blok tns:Pdv / tns:Pnp (ponovljivi tns:Porez z Stopa/Osnovica/Iznos). */
function porezLines(tag: 'Pdv' | 'Pnp', porezi: CisPorezStopa[] | undefined): string[] {
  if (!porezi || porezi.length === 0) return []
  const lines: string[] = [`        <tns:${tag}>`]
  for (const p of porezi) {
    lines.push(
      '          <tns:Porez>',
      `            <tns:Stopa>${formatCisAmount(p.stopa)}</tns:Stopa>`,
      `            <tns:Osnovica>${formatCisAmount(p.osnovica)}</tns:Osnovica>`,
      `            <tns:Iznos>${formatCisAmount(p.iznos)}</tns:Iznos>`,
      '          </tns:Porez>',
    )
  }
  lines.push(`        </tns:${tag}>`)
  return lines
}

/** Blok tns:OstaliPor (Porez z Naziv + Stopa/Osnovica/Iznos). */
function ostaliPorLines(porezi: CisOstaliPorez[] | undefined): string[] {
  if (!porezi || porezi.length === 0) return []
  const lines: string[] = ['        <tns:OstaliPor>']
  for (const p of porezi) {
    lines.push(
      '          <tns:Porez>',
      `            <tns:Naziv>${escapeXml(p.naziv)}</tns:Naziv>`,
      `            <tns:Stopa>${formatCisAmount(p.stopa)}</tns:Stopa>`,
      `            <tns:Osnovica>${formatCisAmount(p.osnovica)}</tns:Osnovica>`,
      `            <tns:Iznos>${formatCisAmount(p.iznos)}</tns:Iznos>`,
      '          </tns:Porez>',
    )
  }
  lines.push('        </tns:OstaliPor>')
  return lines
}

/** Blok tns:Naknade (ponovljivi tns:Naknada z NazivN/IznosN). */
function naknadeLines(naknade: CisNaknada[] | undefined): string[] {
  if (!naknade || naknade.length === 0) return []
  const lines: string[] = ['        <tns:Naknade>']
  for (const n of naknade) {
    lines.push(
      '          <tns:Naknada>',
      `            <tns:NazivN>${escapeXml(n.nazivN)}</tns:NazivN>`,
      `            <tns:IznosN>${formatCisAmount(n.iznosN)}</tns:IznosN>`,
      '          </tns:Naknada>',
    )
  }
  lines.push('        </tns:Naknade>')
  return lines
}

/** Ena neobvezen znesek-element (preskoči, če undefined). */
function amountLine(tag: string, value: CisAmount | undefined): string[] {
  if (value === undefined) return []
  return [`        <tns:${tag}>${formatCisAmount(value)}</tns:${tag}>`]
}

/** Ena neobvezen besedilni element (preskoči, če undefined ALI prazen niz). */
function textLine(tag: string, value: string | undefined): string[] {
  if (value === undefined || value === '') return []
  return [`        <tns:${tag}>${escapeXml(value)}</tns:${tag}>`]
}

/**
 * Zgradi RacunZahtjev SOAP envelope.
 *
 * Neveljavni podatki → { envelope: '', zki: '', idPoruke, validation.valid=false }
 * (non-throwing; validacijske napake so v rezultatu).
 *
 * @param data podatki računa (CisRacunData)
 * @param privateKeyPem zasebni ključ FINA certifikata (PEM niz ali Buffer)
 * @param opts.now čas sporočila (Zaglavlje/DatumVrijeme) — default Date.now()
 */
export function buildRacunZahtjev(
  data: CisRacunData,
  privateKeyPem: string | Buffer,
  opts: { now?: Date } = {}
): CisInvoiceRequestResult {
  const validation = validateRacunData(data)
  const idPoruke = randomUUID()

  if (!validation.valid) {
    return { envelope: '', zki: '', idPoruke, validation }
  }

  const now = opts.now ?? new Date()
  const zaglavljeDatumVrijeme = formatCisDateTime(now).xml

  // DatVrijeme RAČUNA (ne zaglavlja!) gre v ZKI; computeZki normalizira T → presledek
  const racunDatVrijeme =
    typeof data.datumVrijeme === 'string' ? data.datumVrijeme : formatCisDateTime(data.datumVrijeme).xml

  const zki = computeZki(
    {
      oib: data.oib,
      datVrijeme: racunDatVrijeme,
      brOznRac: data.brOznRac,
      oznPosPr: data.oznPosPr,
      oznNapUr: data.oznNapUr,
      iznosUkupno: data.iznosUkupno,
    },
    privateKeyPem
  )

  const racun: string[] = [
    `        <tns:Oib>${escapeXml(data.oib)}</tns:Oib>`,
    `        <tns:USustPdv>${data.usustPdv ? 'true' : 'false'}</tns:USustPdv>`,
    `        <tns:DatVrijeme>${racunDatVrijeme}</tns:DatVrijeme>`,
    `        <tns:OznSlijed>${data.oznSlijed}</tns:OznSlijed>`,
    '        <tns:BrRac>',
    `          <tns:BrOznRac>${escapeXml(data.brOznRac)}</tns:BrOznRac>`,
    `          <tns:OznPosPr>${escapeXml(data.oznPosPr)}</tns:OznPosPr>`,
    `          <tns:OznNapUr>${escapeXml(data.oznNapUr)}</tns:OznNapUr>`,
    '        </tns:BrRac>',
    // RED po shemi: Pdv → Pnp → OstaliPor → osvoboditve/marža/neoporezivo → Naknade
    ...porezLines('Pdv', data.pdv),
    ...porezLines('Pnp', data.pnp),
    ...ostaliPorLines(data.ostaliPor),
    ...amountLine('IznosOslobPdv', data.iznosOslobPdv),
    ...amountLine('IznosMarza', data.iznosMarza),
    ...amountLine('IznosNePodlOpor', data.iznosNePodlOpor),
    ...naknadeLines(data.naknade),
    `        <tns:IznosUkupno>${formatCisAmount(data.iznosUkupno)}</tns:IznosUkupno>`,
    `        <tns:NacinPlac>${data.nacinPlac}</tns:NacinPlac>`,
    `        <tns:OibOper>${escapeXml(data.oibOper)}</tns:OibOper>`,
    `        <tns:ZastKod>${zki}</tns:ZastKod>`,
    `        <tns:NakDost>${data.nakDost ? 'true' : 'false'}</tns:NakDost>`,
    // ParagonBrRac izključno ob naknadnem dostavljanju (validation to vsili)
    ...(data.nakDost ? textLine('ParagonBrRac', data.paragonBrRac) : []),
    ...textLine('SpecNamj', data.specNamj),
    ...textLine('OibPrimateljaRacuna', data.oibPrimateljaRacuna),
  ]

  const envelope = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<soap:Envelope xmlns:soap="${CIS_SOAP_NS}">`,
    '  <soap:Body>',
    `    <tns:RacunZahtjev xmlns:tns="${CIS_NS}" Id="${idPoruke}">`,
    '      <tns:Zaglavlje>',
    `        <tns:IdPoruke>${idPoruke}</tns:IdPoruke>`,
    `        <tns:DatumVrijeme>${zaglavljeDatumVrijeme}</tns:DatumVrijeme>`,
    '      </tns:Zaglavlje>',
    '      <tns:Racun>',
    ...racun,
    '      </tns:Racun>',
    '    </tns:RacunZahtjev>',
    '  </soap:Body>',
    '</soap:Envelope>',
  ].join('\n')

  return { envelope, zki, idPoruke, validation }
}
