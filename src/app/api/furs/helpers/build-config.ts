// =====================================================================
// FURS Config Builder - Zgradi FursConfig iz nastavitev restavracije
// =====================================================================

import { db } from '@/lib/db'
import type { FursConfig } from '@/lib/furs'

// Helper: pridobi FURS konfiguracijo iz nastavitev restavracije
// FIX FURS-02 HIGH: Pridobi premisesId iz Location modela če je na voljo
export async function buildFursConfigFromSettings(settings: {
  businessId: string
  taxId: string
  registerNumber: string
  fursCertPath: string
  fursCertPassword: string
  fursEnvironment: string
}): Promise<FursConfig> {
  // Poskusi pridobiti premisesId iz aktivne lokacije
  let premisesId = settings.businessId || '' // Fallback na businessId
  try {
    const activeLocation = await db.location.findFirst({ where: { isActive: true } })
    if (activeLocation?.premisesId) {
      premisesId = activeLocation.premisesId
    }
  } catch {
    // Location model morda ne obstaja — uporabi businessId
  }

  return {
    businessId: settings.businessId || '',
    taxId: settings.taxId || '',
    registerId: settings.registerNumber || 'BLG-001',
    premisesId, // FIX FURS-02: Uporabi location.premisesId namesto businessId
    deviceIp: '', // NOTE: fursDeviceId je na voljo v Location modelu za FURS spec skladnost
    environment: (settings.fursEnvironment === 'production' ? 'production' : 'test') as FursConfig['environment'],
    certPath: settings.fursCertPath || undefined,
    certPassword: settings.fursCertPassword || undefined,
  }
}
