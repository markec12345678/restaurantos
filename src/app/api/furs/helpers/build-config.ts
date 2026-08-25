// =====================================================================
// FURS Config Builder - Zgradi FursConfig iz nastavitev restavracije
// =====================================================================
//
// FIX issue #37: FURS konfiguracija se sedaj bere iz Location modela
// (per-lokacija) z fallback na RestaurantSettings (backward compat).
// RestaurantSettings FURS polja so @deprecated — uporabljaj Location.
//

import { db } from '@/lib/db'
import type { FursConfig } from '@/lib/furs'

// Helper: pridobi FURS konfiguracijo iz nastavitev restavracije
// FIX issue #37: najprej preveri Location model (per-lokacija FURS cert),
// fallback na RestaurantSettings za backward compat.
export async function buildFursConfigFromSettings(settings: {
  businessId: string
  taxId: string
  registerNumber: string
  fursCertPath: string
  fursCertPassword: string
  fursEnvironment: string
}): Promise<FursConfig> {
  // Poskusi pridobiti aktivno lokacijo — FURS cert je per-lokacija (issue #37)
  let premisesId = settings.businessId || '' // Fallback na businessId
  let fursCertPath = settings.fursCertPath
  let fursCertPassword = settings.fursCertPassword
  let fursEnvironment = settings.fursEnvironment

  try {
    const activeLocation = await db.location.findFirst({ where: { isActive: true } })
    if (activeLocation) {
      // FIX issue #37: Location FURS polja imajo prednost pred RestaurantSettings
      if (activeLocation.premisesId) {
        premisesId = activeLocation.premisesId
      }
      if (activeLocation.fursCertPath) {
        fursCertPath = activeLocation.fursCertPath
      }
      if (activeLocation.fursCertPassword) {
        fursCertPassword = activeLocation.fursCertPassword
      }
      if (activeLocation.fursEnvironment) {
        fursEnvironment = activeLocation.fursEnvironment
      }
    }
  } catch {
    // Location model morda ne obstaja — uporabi RestaurantSettings fallback
  }

  return {
    businessId: settings.businessId || '',
    taxId: settings.taxId || '',
    registerId: settings.registerNumber || 'BLG-001',
    premisesId,
    deviceIp: '',
    environment: (fursEnvironment === 'production' ? 'production' : 'test') as FursConfig['environment'],
    certPath: fursCertPath || undefined,
    certPassword: fursCertPassword || undefined,
  }
}
