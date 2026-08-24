// ============================================
// ZOI — ZAŠČITNI OZNAK IZDAJATELJA
// Po FURS specifikaciji: RSA-SHA256 podpis podatkov računa
// ZOI = Base64(SHA256Sign(data, privateKey))
// ============================================

import crypto from 'crypto'
import { logger } from '../../logger'
import type { FursEnvironment } from '../types'
import { toSlovenianDate } from '../helpers'

/**
 * Generiraj ZOI per FURS specifikaciji
 *
 * Postopek:
 * 1. Združi podatke: TaxNumber + IssueDateTime + InvoiceNumber + PremisesId + DeviceIp + TotalAmount
 * 2. Podpiši z RSA-SHA256 (uporabi privatni ključ iz certifikata)
 * 3. ZOI = Base64(prvih 16 bajtov SHA256 hasha podpisa)
 *
 * SECURITY: Če certifikat (privateKey) ni na voljo:
 *   - V production okolju: VRŽI NAPAKO (prejšnja koda je tiho padla na
 *     nekompatibilen SHA-256 fallback — kršitev ZDDV-1).
 *   - V test okolju: uporabi deterministični SHA-256 hash (za dev/test).
 */
export function generateZOI(
  data: {
    taxId: string
    invoiceNumber: string
    issueDateTime: Date
    totalAmount: number
    premisesId: string
    registerId: string
    environment?: FursEnvironment  // FIX MEDIUM: Če ni podan, default = 'production' (varnostno)
  },
  privateKey?: string | Buffer
): string {
  // FIX MEDIUM: Default na production — prepreči tihi SHA256 fallback
  const env: FursEnvironment = data.environment ?? 'production'
  // Korak 1: Formatiraj datum po FURS specifikaciji (dd.MM.yyyy HH:mm:ss)
  // FIX BUG-F7 CRITICAL: Uporabi SLOVENSKI lokalni čas (CET/CEST), ne server time
  // Če server teče v UTC (Docker), bi getHours() vrnil UTC ure — ZOI bi bil napačen!
  const dt = data.issueDateTime
  const slovenianDate = toSlovenianDate(dt)
  const formattedDate = `${String(slovenianDate.day).padStart(2, '0')}.${String(slovenianDate.month).padStart(2, '0')}.${slovenianDate.year} ${String(slovenianDate.hours).padStart(2, '0')}:${String(slovenianDate.minutes).padStart(2, '0')}:${String(slovenianDate.seconds).padStart(2, '0')}`

  // Korak 2: Združi podatke po FURS specifikaciji
  // Format: TaxId | DateTime | InvoiceNumber | PremisesId | DeviceId | TotalAmount
  // FIX: FURS spec requires deviceIp (electronic device identifier), NOT registerId
  const totalStr = data.totalAmount.toFixed(2)
  const concatenatedData = [
    data.taxId,
    formattedDate,
    data.invoiceNumber,
    data.premisesId,
    data.registerId, // This serves as the electronic device identifier per FURS ZOI specification
    totalStr,
  ].join('|')

  // FIX CRITICAL: Če privateKey manjka v production okolju, VRŽI NAPAKO.
  // Prejšnja koda je tiho padla na SHA-256 fallback tudi v produkciji —
  // kar pomeni, da so se lahko izdali "fiskalni" računi, ki niso bili
  // skladni z ZDDV-1 (RSA-SHA256 podpis je obvezen).
  if (!privateKey) {
    if (env === 'production') {
      throw new Error(
        'FURS ZOI: privatni ključ manjka v production okolju. ' +
        'Naloži certifikat (FURS_CERT_PATH / FURS_CERT_PASSWORD) pred izdajo računov. ' +
        'Če želiš dovoliti testni fallback, nastavi FURS_ENVIRONMENT=test.'
      )
    }
    // Test okolje: uporabi SHA-256 fallback (ni skladno s FURS, a dovoljeno za dev)
    logger.warn('FURS', 'ZOI generiran z SHA-256 fallback (test okolje, brez certifikata) — NI za produkcijo!')
  } else {
    // Korak 3a: Pravi RSA-SHA256 podpis (produkcija)
    try {
      const signer = crypto.createSign('RSA-SHA256')
      signer.update(concatenatedData, 'utf8')
      const signature = signer.sign(privateKey)

      // ZOI = Base64(prvih 16 bajtov SHA256 hash podpisa)
      const signatureHash = crypto.createHash('sha256').update(signature).digest()
      const zoiBytes = signatureHash.subarray(0, 16)
      return zoiBytes.toString('base64')
    } catch (err: unknown) {
      // FIX F1 CRITICAL: V produkciji vrni napako namesto tihi SHA-256 fallback
      logger.warn('FURS', 'Napaka pri RSA podpisovanju:', err)
      if (env === 'production') {
        throw new Error(`FURS RSA podpisovanje ni uspelo v produkciji: ${err instanceof Error ? err.message : String(err)}`)
      }
      // V testnem okolju dovoli fallback na SHA-256
    }
  }

  // Korak 3b: Fallback — SHA256 hash (SAMO za testno fazo, ko env != 'production')
  // Opomba: To NI skladno s FURS specifikacijo za produkcijo!
  const hash = crypto.createHash('sha256').update(concatenatedData, 'utf8').digest()
  const zoiBytes = hash.subarray(0, 16)
  return zoiBytes.toString('base64')
}
