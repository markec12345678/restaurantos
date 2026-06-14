// ============================================
// FURS POMOŽNE FUNKCIJE
// Slovenska časovna cona, QR koda, validacija, simuliran EOR
// ============================================

import crypto from 'crypto'
import type { FursConfig, FursEnvironment, FursQRData } from './types'
import { FURS_URLS, FURS_TOKEN_URLS } from './types'

// ============================================
// SLOVENSKA ČASOVNA CONA (CET/CEST)
// FIX BUG-F7: FURS zahteva lokalni čas za ZOI in račune
// ============================================

/**
 * Pretvori Date v slovenski lokalni čas (CET/CEST)
 * FURS specifikacija zahteva dd.MM.yyyy HH:mm:ss v CET/CEST
 */
export function toSlovenianDate(dt: Date): { year: number; month: number; day: number; hours: number; minutes: number; seconds: number } {
  // Določi DST (Daylight Saving Time) za Slovenijo
  // Zadnja nedelja v marcu 02:00 CET -> CEST (UTC+2)
  // Zadnja nedelja v oktobru 03:00 CEST -> CET (UTC+1)
  const year = dt.getUTCFullYear()
  const marchLastSun = getLastSunday(year, 2, 31) // March
  const octLastSun = getLastSunday(year, 9, 31)   // October

  const utcMs = dt.getTime()
  const marchTransition = Date.UTC(year, 2, marchLastSun, 1, 0, 0) // 01:00 UTC = 02:00 CET
  const octTransition = Date.UTC(year, 9, octLastSun, 0, 0, 0)     // 00:00 UTC = 02:00 CEST

  const isDST = utcMs >= marchTransition && utcMs < octTransition
  const offsetMs = isDST ? (2 * 60 * 60 * 1000) : (1 * 60 * 60 * 1000)

  const localMs = utcMs + offsetMs
  const localDt = new Date(localMs)

  return {
    year: localDt.getUTCFullYear(),
    month: localDt.getUTCMonth() + 1,
    day: localDt.getUTCDate(),
    hours: localDt.getUTCHours(),
    minutes: localDt.getUTCMinutes(),
    seconds: localDt.getUTCSeconds(),
  }
}

/**
 * Pridobi zadnjo nedeljo v mesecu
 */
export function getLastSunday(year: number, month: number, lastDay: number): number {
  const d = new Date(Date.UTC(year, month, lastDay))
  d.setUTCDate(d.getUTCDate() - d.getUTCDay())
  return d.getUTCDate()
}

// ============================================
// SLOVENSKA ČASOVNA CONA (CET/CEST) — ISO FORMAT
// FIX BUG-F3: FURS zahteva lokalni čas, ne UTC
// ============================================

/**
 * Pretvori Date v ISO 8601 format s slovenskim časom (CET/CEST)
 * FURS zahteva IssueDateTime v lokalnem času
 * FIX BUG-5: Uporabi UTC-osnovan DST izračun (ne getTimezoneOffset()),
 * ki pravilno deluje tudi na UTC strežnikih (Docker).
 */
export function toSlovenianISO(dt: Date): string {
  // Določi DST glede na slovenske prehode (ne strežnikov timezone)
  const year = dt.getUTCFullYear()
  const marchLastSun = getLastSunday(year, 2, 31)
  const octLastSun = getLastSunday(year, 9, 31)

  const utcMs = dt.getTime()
  const marchTransition = Date.UTC(year, 2, marchLastSun, 1, 0, 0) // 01:00 UTC = 02:00 CET
  const octTransition = Date.UTC(year, 9, octLastSun, 0, 0, 0)     // 00:00 UTC = 02:00 CEST

  const isDST = utcMs >= marchTransition && utcMs < octTransition
  const offsetHours = isDST ? 2 : 1 // CEST=+2, CET=+1

  // Ustvari lokalni čas z ustreznim offsetom
  const localMs = utcMs + (offsetHours * 60 * 60 * 1000)
  const localDt = new Date(localMs)

  const pad = (n: number) => String(n).padStart(2, '0')
  const isoStr = `${localDt.getUTCFullYear()}-${pad(localDt.getUTCMonth() + 1)}-${pad(localDt.getUTCDate())}T${pad(localDt.getUTCHours())}:${pad(localDt.getUTCMinutes())}:${pad(localDt.getUTCSeconds())}+${pad(offsetHours)}:00`
  return isoStr
}

// ============================================
// SIMULIRAN EOR (za testno fazo)
// ============================================

/**
 * Generiraj simuliran EOR za testno fazo
 * FURS EOR je 36-mesten niz (UUID format)
 * FIX MEDIUM: Determinističen EOR — uporabi sekundno natančnost (ne ms) za konsistentnost
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
  
  return eor.toUpperCase()
}

// ============================================
// QR KODA ZA FURS PREVERJANJE
// Formati: QR koda vsebuje ZOI + znesek + datum + davčno številko
// Struktura: zoi|amount|datetime|taxId|businessId|registerId|premisesId
// ============================================

/**
 * Generiraj vsebino QR kode za FURS preverjanje računa
 * 
 * FURS specifikacija za QR kodo:
 * Format: zoi_timestamp_amount_taxNumber_premisesId_registerId
 * Ali pa: Base64(JSON({zoi, ts, amount, taxNo, premises, register}))
 */
export function generateFursQRContent(data: FursQRData): string {
  // FURS QR koda — poenostavljen format za Slovenijo
  // Format po FURS specifikaciji:
  // zoi | dd.MM.yyyy HH:mm:ss | znesek | davčna št. | poslovni prostor | blagajna
  
  const dt = data.issueDateTime
  // FIX BUG-F7: Uporabi slovenski čas za QR kodo (skladno z ZOI)
  const sDt = toSlovenianDate(dt)
  const formattedDate = `${String(sDt.day).padStart(2, '0')}.${String(sDt.month).padStart(2, '0')}.${sDt.year} ${String(sDt.hours).padStart(2, '0')}:${String(sDt.minutes).padStart(2, '0')}:${String(sDt.seconds).padStart(2, '0')}`

  // Pobriši SI prefix za davčno številko v QR
  const taxNumber = data.taxId.replace('SI', '')

  const parts = [
    data.zoi,
    formattedDate,
    data.totalAmount.toFixed(2),
    taxNumber,
    data.premisesId || data.businessId,
    data.registerId,
  ]

  return parts.join('|')
}

/**
 * Generiraj URL za FURS preverjanje računa na spletu
 */
export function generateFursVerificationUrl(data: FursQRData): string {
  const qrContent = generateFursQRContent(data)
  // FURS preverjalnik: https://blagajne.fu.gov.si/validation/qr/{data}
  // V testnem načinu: https://blagajne-test.fu.gov.si/validation/qr/{data}
  const encoded = encodeURIComponent(qrContent)
  return `https://blagajne.fu.gov.si/validation/qr/${encoded}`
}

// ============================================
// VALIDACIJA FURS PODATKOV
// ============================================

/**
 * Preveri veljavnost FURS konfiguracije
 */
export function validateFursConfig(config: Partial<FursConfig>): {
  valid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  if (!config.businessId) {
    errors.push('Manjka matična številka podjetja')
  } else if (!/^\d{8}$/.test(config.businessId)) {
    errors.push('Matična številka mora imeti 8 številk')
  }

  if (!config.taxId) {
    errors.push('Manjka ID za DDV')
  } else if (!/^SI\d{8,10}$/.test(config.taxId)) {
    warnings.push('ID za DDV naj bi bil v formatu SIxxxxxxxx')
  }

  if (!config.registerId) {
    errors.push('Manjka številka blagajne')
  }

  if (!config.premisesId) {
    warnings.push('Manjka številka poslovnega prostora — uporabljena bo matična številka')
  }

  if (!config.certPath) {
    warnings.push('Manjka pot do certifikata — overjanje bo simulirano')
  }

  if (!config.certPassword && config.certPath) {
    warnings.push('Manjka geslo certifikata')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

// ============================================
// PREVERI POVEZLJIVOST S FURS STREŽNIKOM
// FIX F8 LOW: Uporabi GET namesto HEAD — FURS API ne podpira HEAD metode (vrne 405)
// ============================================

/**
 * Preveri povezljivost s FURS strežnikom
 */
export async function checkFursConnectivity(environment: FursEnvironment): Promise<{
  reachable: boolean
  responseTime?: number
  error?: string
}> {
  const _url = FURS_TOKEN_URLS[environment] // Token URL supports POST — use that for connectivity
  const start = Date.now()

  try {
    // FIX F8: Uporabimo token URL z GET — FURS cash_payments ne podpira HEAD
    // Token URL vrne 401 (Unauthorized) brez veljavnega JWT, kar pomeni, da strežnik deluje
    const response = await fetch(FURS_URLS[environment], {
      method: 'GET', // GET namesto HEAD — FURS ne podpira HEAD
      signal: AbortSignal.timeout(10000),
    })
    return {
      reachable: response.ok || response.status === 401 || response.status === 405, // 401/405 = strežnik deluje
      responseTime: Date.now() - start,
    }
  } catch (err: unknown) {
    return {
      reachable: false,
      error: err instanceof Error ? err.message : 'Neznana napaka',
    }
  }
}
