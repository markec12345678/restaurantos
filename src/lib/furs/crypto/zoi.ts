// ============================================
// ZOI — ZAŠČITNA OZNAKA IZDAJATELJA
// Po FURS specifikaciji (ZDDV-1, Tehnična dokumentacija v3.2):
//   1. podatki računa se ZLEPIJO BREZ LOJTR (vrstni red spodaj)
//   2. podpis = RSA-SHA256(zlepljeni podatki, privateKey)
//   3. ZOI = MD5(podpis) izpisan kot TOČNO 32 znakov MALIH hex (0-9, a-f)
//      — uradni primer FURS: 8402f0a963e37b2258e034fc8ae7ffc1
// ============================================
// FIX (R229, katalog napak A1+A2 — ZDDV-1 bloker za pilota):
//   A1: prej Base64(MD5(podpis)) (~22 znakov z '+/='), spec pa zahteva
//       32 znakov malih hex — enako kot pravilni HR ZKI (src/lib/cis/zki.ts,
//       `digest('hex')`). Base64 ZOI bi FURS zavrnil (format + podpisno
//       preverjanje), neveljaven pa bi bil tudi tiskani račun in QR.
//   A2: prej podatki zlepljeni z ločilom '|' — spec zahteva zlepljanje
//       BREZ lojtr. Podpis se je računal nad drugim nizom, kot ga preveri
//       FURS → ZOI napačen ne glede na format izhoda.
//   Fallback (samo test env) je sedaj tudi formatno pariteten (32 malih hex).
// ============================================

import crypto from 'crypto'
import { logger } from '../../logger'
import type { FursEnvironment } from '../types'
import { toSlovenianDate } from '../helpers'

/** Vhodni podatki za izračun ZOI (zrcalijo ključne elemente InvoiceRequest). */
export interface ZoiData {
  /** Davčna številka zavezanca (npr. "SI12345678" ali "12345678"). */
  taxId: string
  /** Zaporedna številka računa. */
  invoiceNumber: string
  /** Datum in čas izdaje računa (rendira se v slovenskem lokalnem času). */
  issueDateTime: Date
  /** Skupni znesek računa (rendira se "dd.dd" s piko). */
  totalAmount: number
  /** Oznaka poslovnega prostora. */
  premisesId: string
  /** Oznaka elektronske naprave (blagajne). */
  registerId: string
  /** FIX MEDIUM: Če ni podan, default = 'production' (varnostno). */
  environment?: FursEnvironment
}

/**
 * Zlepi vhodne podatke za ZOI podpis — BREZ lojtr (FURS spec, korak 1):
 *
 *   TaxNumber + IssueDateTime + InvoiceNumber + PremisesId + ElectronicDeviceId + TotalAmount
 *
 * - IssueDateTime: "dd.MM.yyyy HH:mm:ss" v slovenskem lokalnem času (CET/CEST).
 *   FIX BUG-F7 CRITICAL: uporabi SLOVENSKI lokalni čas, ne server time —
 *   če server teče v UTC (Docker), bi getHours() vrnil UTC ure.
 * - TotalAmount: pika kot ločilo, natanko 2 decimalki ("12.50").
 * - registerId = oznaka elektronske naprave per FURS ZOI specifikaciji.
 *
 * Javno izvožena za testabilnost — testi neodvisno preverijo točen vhod
 * podpisa (vzorec: src/lib/cis/zki.ts zkiInputString).
 */
export function zoiInputString(data: ZoiData): string {
  const slovenianDate = toSlovenianDate(data.issueDateTime)
  const formattedDate =
    `${String(slovenianDate.day).padStart(2, '0')}.${String(slovenianDate.month).padStart(2, '0')}.${slovenianDate.year} ` +
    `${String(slovenianDate.hours).padStart(2, '0')}:${String(slovenianDate.minutes).padStart(2, '0')}:${String(slovenianDate.seconds).padStart(2, '0')}`
  const totalStr = data.totalAmount.toFixed(2)
  return (
    data.taxId +
    formattedDate +
    data.invoiceNumber +
    data.premisesId +
    data.registerId + // oznaka elektronske naprave per FURS ZOI specifikaciji
    totalStr
  )
}

/**
 * Generiraj ZOI per FURS specifikaciji (32 znakov malih hex).
 *
 * Postopek:
 * 1. Zlepi podatke BREZ lojtr (zoiInputString)
 * 2. Podpiši z RSA-SHA256 (privatni ključ iz certifikata)
 * 3. ZOI = MD5(podpis) kot lowercase hex — točno 32 znakov
 *
 * SECURITY: Če certifikat (privateKey) ni na voljo:
 *   - V production okolju: VRŽI NAPAKO (prejšnja koda je tiho padla na
 *     nekompatibilen fallback — kršitev ZDDV-1).
 *   - V test okolju: deterministični fallback hash (formatno pariteten,
 *     vsebinsko NI skladen s FURS — NI za produkcijo).
 */
export function generateZOI(
  data: ZoiData,
  privateKey?: string | Buffer
): string {
  // FIX MEDIUM: Default na production — prepreči tihi fallback
  const env: FursEnvironment = data.environment ?? 'production'
  const concatenatedData = zoiInputString(data)

  // FIX CRITICAL: Če privateKey manjka v production okolju, VRŽI NAPAKO.
  // Prejšnja koda je tiho padla na fallback tudi v produkciji —
  // kar pomeni, da so se lahko izdali "fiskalni" računi, ki niso bili
  // skladni z ZDDV-1 (RSA-SHA256 podpis je obvezen).
  if (!privateKey) {
    if (env === 'production') {
      throw new Error(
        'FURS ZOI: privatni ključ manjka v production okolju. ' +
        'Naloži certifikat (FURS_CERT_PATH / FURS_CERT_PASSWORD) pred izdajo računov. ' +
        'Če želiš dovoliti testni fallback, nastavi FURS_ENV=test (kanonska varjanta).'
      )
    }
    // Test okolje: fallback (ni skladno s FURS, a dovoljeno za dev)
    logger.warn('FURS', 'ZOI generiran s fallback hash-om (test okolje, brez certifikata) — NI za produkcijo!')
  } else {
    // Korak 2a: Pravi RSA-SHA256 podpis (produkcija)
    try {
      const signer = crypto.createSign('RSA-SHA256')
      signer.update(concatenatedData, 'utf8')
      const signature = signer.sign(privateKey)

      // ZOI = MD5(podpis) kot 32 znakov malih hex — ZDDV-1
      // (enaka formula kot HR ZKI: src/lib/cis/zki.ts computeZki)
      return crypto.createHash('md5').update(signature).digest('hex')
    } catch (err: unknown) {
      // FIX F1 CRITICAL: V produkciji vrni napako namesto tihega fallbacka
      logger.warn('FURS', 'Napaka pri RSA podpisovanju:', err)
      if (env === 'production') {
        throw new Error(`FURS RSA podpisovanje ni uspelo v produkciji: ${err instanceof Error ? err.message : String(err)}`)
      }
      // V testnem okolju dovoli fallback
    }
  }

  // Korak 2b: Fallback — SHA-256 prvih 16 bajtov v lowercase hex (SAMO test env,
  // ko env != 'production'). FORMATNO pariteten s spec (32 malih hex — QR/PDF417
  // kompatibilen), vsebinsko pa NI skladen s FURS (ni RSA podpisa)!
  return crypto.createHash('sha256').update(concatenatedData, 'utf8').digest().subarray(0, 16).toString('hex')
}
