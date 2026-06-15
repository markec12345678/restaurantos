// ============================================
// FURS POMOŽNE FUNKCIJE — EOR IN QR KODA
// Simuliran EOR, FURS QR vsebina, verifikacijski URL
// ============================================

import crypto from 'crypto'
import type { FursQRData } from '../types'
import { toSlovenianDate } from './timezone'

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
