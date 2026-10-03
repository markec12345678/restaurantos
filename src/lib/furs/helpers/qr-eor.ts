// ============================================
// FURS POMOŽNE FUNKCIJE — EOR IN QR KODA
// Simuliran EOR, FURS QR vsebina (60 numeričnih mest)
// ============================================

import crypto from 'crypto'
import type { FursQRData } from '../types'
import { toSlovenianDate } from './timezone'

/**
 * Generiraj simuliran EOR za testno fazo
 * FURS EOR je 36-mesten UUID v LOWERCASE hex — uradni primer FURS:
 * 56dcaf93-933a-497d-b864-40ba1e8f4fa2
 * FIX (R229, katalog napak A4): prej .toUpperCase() — videz ni ustrezen
 * pravemu EOR-ju na shranjenih/tiskanih simuliranih računih.
 * Determinističen — uporabi sekundno natančnost (ne ms) za konsistentnost.
 */
export function generateSimulatedEOR(zoi: string, date: Date): string {
  const dateStr = date.toISOString().replace(/\.\d{3}Z$/, 'Z') // Odstrani milisekunde
  const hash = crypto.createHash('sha256')
    .update(zoi + dateStr)
    .digest('hex')

  // Formatiraj kot UUID
  const eor = [
    hash.substring(0, 8),
    hash.substring(8, 12),
    hash.substring(12, 16),
    hash.substring(16, 20),
    hash.substring(20, 32),
  ].join('-')

  return eor.toLowerCase()
}

/** 16-bajtni ZOI → 39-mestno decimalno število (levo zapolnjeno z ničlami).
 *
 * Sprejme:
 *  - 32 znakov hex (veljavni/fallback ZOI, kakršen koli case)
 *  - LEGACY KOMPAT: base64 kodiranih 16 bajtov (starejši zapisi v bazi —
 *    prejšnja implementacija je vračala Base64(MD5(podpis))); isti bajti →
 *    isti hex → enak decimalni zapis.
 */
function zoiTo39Digits(zoiRaw: string): string {
  const zoi = zoiRaw.trim().toLowerCase()
  let hex: string
  if (/^[0-9a-f]{32}$/.test(zoi)) {
    hex = zoi
  } else {
    const bytes = Buffer.from(zoiRaw, 'base64')
    if (bytes.length === 16) {
      hex = bytes.toString('hex')
    } else {
      throw new Error(
        `FURS QR: ZOI ni 32-znakovni hex niti 16-bajtni base64 niz ("${zoiRaw.slice(0, 40)}")`
      )
    }
  }
  return BigInt(`0x${hex}`).toString().padStart(39, '0')
}

/**
 * Generiraj vsebino 2D kode (QR / PDF417 / Code128) za preverjanje računa.
 *
 * FIX (R229, katalog napak A3 — ZDDV-1 bloker): prej izmišljen pipe-format
 * "zoi|dd.MM.yyyy HH:mm:ss|znesek|davčna|prostor|blagajna" — kupec računa
 * ne bi mogel preveriti s FURS bralnikom. Specifikacija (ZDDV-1, uradna
 * tehnična dokumentacija) predpisuje TOČNO 60 NUMERIČNIH MEST:
 *
 *   39 mest: ZOI pretvorjen iz 32-znakovnega hex v decimalni zapis
 *            (levo zapolnjen z ničlami)
 *    8 mest: davčna številka zavezanca (brez "SI" predpone)
 *   12 mest: datum in čas izdaje računa v obliki LLMMDDUUMMSS
 *            (slovenski lokalni čas, 2-mestno leto)
 *    1 mesto: kontrolni znak — vsota vseh 59 prejšnjih števk po modulu 10
 */
export function generateFursQRContent(data: FursQRData): string {
  // 39 mest: ZOI (hex 32 znakov ali legacy base64) → decimalno
  const zoiDecimal = zoiTo39Digits(data.zoi)

  // 8 mest: davčna številka (pobriši "SI" prefix)
  const taxNumber = data.taxId.replace(/^SI/i, '')
  if (!/^\d{8}$/.test(taxNumber)) {
    throw new Error(
      `FURS QR: davčna številka mora imeti 8 števk, dobljeno "${data.taxId}"`
    )
  }

  // 12 mest: LLMMDDUUMMSS — slovenski lokalni čas (skladno z ZOI podpisom)
  const sDt = toSlovenianDate(data.issueDateTime)
  const dateTime12 =
    `${String(sDt.year % 100).padStart(2, '0')}` +
    `${String(sDt.month).padStart(2, '0')}` +
    `${String(sDt.day).padStart(2, '0')}` +
    `${String(sDt.hours).padStart(2, '0')}` +
    `${String(sDt.minutes).padStart(2, '0')}` +
    `${String(sDt.seconds).padStart(2, '0')}`

  const first59 = `${zoiDecimal}${taxNumber}${dateTime12}`

  // 1 mesto: kontrolni znak — vsota vseh 59 števk po modulu 10
  const checkDigit =
    first59.split('').reduce((sum, digit) => sum + Number(digit), 0) % 10

  return `${first59}${checkDigit}`
}

// R167 (#143): generateFursVerificationUrl izbrisan (R166-F6) — 0 klicalcev,
// hardkodiran produkcijski URL; ni bil nikoli v uporabi.
