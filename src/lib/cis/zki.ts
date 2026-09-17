// ============================================
// CIS ZKI — ZAŠTITNI KOD IZDAVATELJA (HR fiskalizacija)
// ============================================
// Formula (spec v1.3+ / namespace f73; verificirano proti referenčni
// implementaciji fiskalizacija2-js, Task 24-b):
//
//   ZKI = md5_hex_lowercase( RSA-SHA256-SIGN( inputString ) )
//
// inputString = zlepljen BREZ lojtr:
//   oib + datumVrijeme + brOznRac + oznPosPr + oznNapUr + iznosUkupno
//
//   - datumVrijeme: "dd.MM.yyyy HH:mm:ss" v Europe/Zagreb (POMENBNO: XML
//     element DatVrijeme uporablja "T" med datumom in časom, ZKI vhod pa
//     PRESLEDEK — referenca dela datVrijeme.replace("T", " "))
//   - iznosUkupno: pika kot ločilo, natanko 2 decimalki ("15.00", ne "15,00")
//   - podpis z zasebnim ključem FINA certifikata (RSA-SHA256) nad UTF-8 nizom,
//     MD5 pa se računa nad SUROVIMI PODPISNIMI BAJTI (ne hex/base64!)
//   - rezultat: 32 znakov malih hex (vzorec zastKod v fields.ts)
//
// Strežniško — node:crypto, brez zunanjih odvisnosti. Validacija polj živi v
// invoice.ts (validateRacunData); ta modul je nizko-nivojski primitiv.
// ============================================

import { createSign, createHash } from 'node:crypto'
import { CIS_FIELD_PATTERNS } from './fields'

/** Vhodni podatki za izračun ZKI (zrcalijo ključne elemente tns:Racun). */
export interface ZkiInput {
  /** OIB izdajatelja — 11 števk. */
  oib: string
  /** Čas izdaje: dd.MM.yyyyTHH:mm:ss ALI dd.MM.yyyy HH:mm:ss (normaliziramo). */
  datVrijeme: string
  /** Številka računa (samo številke). */
  brOznRac: string
  /** Oznaka poslovnega prostora. */
  oznPosPr: string
  /** Oznaka naprave za izdajo računov. */
  oznNapUr: string
  /** Skupni znesek računa — številka ALI niz ("15.00"). */
  iznosUkupno: number | string
}

/**
 * Normaliziraj znesek v CIS "iznos" format: pika + natanko 2 decimalki.
 *
 * - številka → zaokroži na 2 decimalki (15 → "15.00", 0.5 → "0.50")
 * - niz → STROGO: sprejme največ 2 decimalki in jih izgubljeno dopolni
 *   ("15" → "15.00", "15.0" → "15.00"); VEJICA NI dovoljena ("15,50" → napaka,
 *   dokumentirano: hrvaški prikaz uporablja vejico, XML/ZKI pa predpisano piko —
 *   tiha pretvorba bi povzročila ZKI nad drugačnim nizom, kot piše v XML)
 * - vse, kar po normalizaciji ne ustreza vzorcu iznos → napaka
 */
export function formatCisAmount(value: number | string): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`CIS znesek: pričakovana končna številka, dobljeno ${String(value)}`)
    }
    const formatted = value.toFixed(2)
    // varovalka: (1e21).toFixed(2) → "1e+21", prevelike številke → vzorec fail
    if (!CIS_FIELD_PATTERNS.iznos.test(formatted)) {
      throw new Error(
        `CIS znesek "${formatted}": ne ustreza predpisanemu formatu (${CIS_FIELD_PATTERNS.iznos})`
      )
    }
    return formatted
  }

  if (value.includes(',')) {
    throw new Error(
      `CIS znesek "${value}": vejica NI dovoljena — uporabi piko z natanko 2 decimalkama (npr. "15.00")`
    )
  }
  // niz: največ 2 decimalki (dopolnimo, NE zaokrožimo — "15.123" bi tiho
  // spremenilo znesek podpisa)
  if (!/^[+-]?\d+(\.\d{1,2})?$/.test(value)) {
    throw new Error(
      `CIS znesek "${value}": pričakovan format s piko in do 2 decimalkama (npr. "15.00")`
    )
  }
  const normalized = Number(value).toFixed(2)
  if (!CIS_FIELD_PATTERNS.iznos.test(normalized)) {
    throw new Error(
      `CIS znesek "${value}" → "${normalized}": ne ustreza predpisanemu formatu (${CIS_FIELD_PATTERNS.iznos})`
    )
  }
  return normalized
}

/** Intl formatirnik za Europe/Zagreb (CET/CEST) — h23 omogoča polnoč kot "00". */
const ZAGREB_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Zagreb',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

/**
 * Formatiraj Datum/datumVrijeme v času Europe/Zagreb (CET/CEST — enako kot
 * Ljubljana). Vrne OBE obliki:
 *   - xml: "dd.MM.yyyyTHH:mm:ss" (elementa Zaglavlje/DatumVrijeme, Racun/DatVrijeme)
 *   - zki: "dd.MM.yyyy HH:mm:ss" (vhodni niz za ZKI — presledek namesto T)
 */
export function formatCisDateTime(date: Date): { xml: string; zki: string } {
  const parts = ZAGREB_FORMATTER.formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? ''

  const xml = `${get('day')}.${get('month')}.${get('year')}T${get('hour')}:${get('minute')}:${get('second')}`
  return { xml, zki: xml.replace('T', ' ') }
}

/**
 * Zlepi ZKI vhodni niz (brez lojtr) — javljen posebej za testabilnost, da lahko
 * testi neodvisno preverijo točen vhod podpisa:
 *   oib + "dd.MM.yyyy HH:mm:ss" + brOznRac + oznPosPr + oznNapUr + iznos
 */
export function zkiInputString(input: ZkiInput): string {
  const datVrijeme = input.datVrijeme.replace('T', ' ')
  const iznos = formatCisAmount(input.iznosUkupno)
  return input.oib + datVrijeme + input.brOznRac + input.oznPosPr + input.oznNapUr + iznos
}

/**
 * Izračunaj ZKI:
 *   1. zlepi vhodni niz (zkiInputString)
 *   2. podpiši RSA-SHA256 z zasebnim ključem FINA certifikata (PEM niz ali Buffer)
 *   3. ZKI = MD5 nad surovimi podpisnimi bajti, lowercase hex (32 znakov)
 *
 * Vrže napako, če je ključ neveljaven (createSign.sign()) ali znesek neveljaven
 * — klicatelj (buildRacunZahtjev) validira podatke že pred tem.
 */
export function computeZki(input: ZkiInput, privateKeyPem: string | Buffer): string {
  const inputString = zkiInputString(input)

  const signer = createSign('RSA-SHA256')
  signer.update(inputString, 'utf8')
  const signature = signer.sign(privateKeyPem)

  return createHash('md5').update(signature).digest('hex')
}
