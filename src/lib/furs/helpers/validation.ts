// ============================================
// FURS POMOŽNE FUNKCIJE — VALIDACIJA IN POVEZLJIVOST
// Validacija FURS konfiguracije, preverjanje povezljivosti
// ============================================

import type { FursConfig, FursEnvironment } from '../types'
import { FURS_URLS, FURS_TOKEN_URLS } from '../types'

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

/**
 * Preveri povezljivost s FURS strežnikom
 * FIX F8 LOW: Uporabi GET namesto HEAD — FURS API ne podpira HEAD metode (vrne 405)
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
