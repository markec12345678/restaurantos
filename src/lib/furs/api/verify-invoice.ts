// ============================================
// FURS API — Overitev računa
// Pošlji račun na FURS strežnik za overitev
// ============================================

import { logger } from '../../logger'
import type { FursConfig, FursInvoiceData, FursVerificationResult } from '../types'
import { FURS_URLS } from '../types'
import { generateSimulatedEOR } from '../helpers'
import { getFursToken } from './token'
import { buildFursRequest } from './build-request'

// ============================================
// EOR — ENOTNA OZNAKA RAČUNA
// EOR vrne FURS strežnik kot potrditev overitve
// V testnem načinu generiramo simulirani EOR
// ============================================

/**
 * Pošlji račun na FURS strežnik za overitev
 *
 * FURS API specifikacija:
 * - HTTP POST na /v1/cash_payments
 * - JSON body z računskimi podatki
 * - OAuth2 token za avtentikacijo
 * - Vrne EOR (Enotna Oznaka Računa)
 */
export async function verifyInvoiceWithFURS(
  config: FursConfig,
  invoiceData: FursInvoiceData,
  zoi: string,
): Promise<FursVerificationResult> {
  const now = new Date()
  const _isTest = config.environment === 'test'

  // Če ni certifikata, dovoli simulacijo SAMO če je FURS_ALLOW_SIMULATION=true
  if (!config.certPath || !config.certPassword) {
    if (process.env.FURS_ALLOW_SIMULATION === 'true') {
      logger.info('FURS', 'Brez certifikata — uporabljam simulirano overitev (FURS_ALLOW_SIMULATION=true)')
      // FIX HIGH: Simulirana overitev VRNE success=false, da klicalec NE označi računa kot fiscalVerified=true
      // Per ZDDV-1: simulirani račun NI davčno overjen — fiscalVerified MORA ostati false
      return {
        success: false,
        zoi,
        eor: generateSimulatedEOR(zoi, now),
        environment: config.environment,
        verifiedAt: now,
        isSimulation: true,
        error: 'FURS simulacija — račun NI davčno overjen. Nastavite certifikat za produkcijo.',
      }
    }
    logger.error('FURS', 'Brez certifikata in FURS_ALLOW_SIMULATION ni omogočen — overitev ni uspela')
    return {
      success: false,
      zoi,
      eor: '',
      environment: config.environment,
      verifiedAt: now,
      isSimulation: true,
      error: 'Manjka certifikat za FURS overitev. Nastavite FURS_ALLOW_SIMULATION=true za testni način.',
    }
  }

  try {
    // Korak 1: Naloži certifikat in pridobi OAuth token
    const token = await getFursToken(config)
    if (!token) {
    logger.warn('FURS', 'Ne morem pridobiti OAuth tokena — overitev ni uspela')
      return {
        success: false,
        zoi,
        eor: '',
        environment: config.environment,
        verifiedAt: now,
        isSimulation: true,
        error: 'FURS OAuth token ni na voljo — strežnik je morda nedosegljiv',
      }
    }

    // Korak 2: Pripravi FURS zahtevek
    const fursRequest = buildFursRequest(config, invoiceData, zoi)

    // Korak 3: Pošlji na FURS strežnik
    const fursUrl = FURS_URLS[config.environment]
    const response = await fetch(fursUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(fursRequest),
      signal: AbortSignal.timeout(30000), // 30s timeout
    })

    if (!response.ok) {
      const errorBody = await response.text()
      logger.error('FURS', `Napaka od strežnika: ${response.status}`, errorBody)
      return {
        success: false,
        zoi,
        eor: '',
        environment: config.environment,
        verifiedAt: now,
        isSimulation: false,
        error: `FURS strežnik je vrnil napako ${response.status}: ${errorBody}`,
      }
    }

    const result = await response.json() as { eor?: string; EOR?: string; error?: { code: string; message: string } }

    if (result.error) {
      logger.error('FURS', 'Napaka v odgovoru', result.error)
      return {
        success: false,
        zoi,
        eor: '',
        environment: config.environment,
        verifiedAt: now,
        isSimulation: false,
        error: `FURS napaka: ${result.error.code} — ${result.error.message}`,
      }
    }

    const eor = result.eor || result.EOR || ''
    return {
      success: true,
      zoi,
      eor,
      environment: config.environment,
      verifiedAt: now,
      isSimulation: false,
    }
  } catch (err: unknown) {
    logger.error('FURS', 'Napaka pri overjanju:', err)
    // FURS strežnik ni dosegljiv — vrni napako (ne tihe simulacije!)
    return {
      success: false,
      zoi,
      eor: '',
      environment: config.environment,
      verifiedAt: now,
      isSimulation: false, // FIX BUG-F9: Ni simulacija — strežnik je dejansko nedosegljiv
      error: `FURS strežnik ni dosegljiv: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}
