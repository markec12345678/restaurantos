// =====================================================================
// FURS Config Builder - Zgradi FursConfig iz nastavitev restavracije
// =====================================================================
//
// FIX issue #37: FURS konfiguracija se sedaj bere iz Location modela
// (per-lokacija) z fallback na RestaurantSettings (backward compat).
// RestaurantSettings FURS polja so @deprecated — uporabljaj Location.
//
// FIX P0-C3A: Dodan obvezen `locationId` parameter. Prej je `findFirst({isActive:true})`
// vračalo naključno aktivno lokacijo — v multi-tenant setupu je to pomenilo da je
// Tenant A prejel FURS certifikat Tenanta B. Zdaj se Location vedno pridobi z
// `findUnique({where:{id: locationId}})` — pravi certifikat za pravi račun.
//

import { db } from '@/lib/db'
import type { FursConfig } from '@/lib/furs'
import { logger } from '@/lib/logger'

/**
 * Zgradi FURS konfiguracijo za določeno lokacijo.
 *
 * FIX P0-C3A: `locationId` je obvezen parameter. Če manjka, funkcija vrže napako
 * (namesto da bi padla na `findFirst({isActive:true})` ki je vrnilo naključno lokacijo).
 *
 * @param settings - RestaurantSettings (fallback za single-tenant backward compat)
 * @param locationId - ID lokacije za katero se gradi config (obvezno!)
 *
 * @example
 * // Pravilna uporaba:
 * const order = await db.order.findUnique({ where: { id: orderId } })
 * const settings = await db.restaurantSettings.findFirst({ where: { isActive: true } })
 * if (!settings) return // ...
 * const config = await buildFursConfigFromSettings(settings, order.locationId) // <-- locationId obvezen!
 */
export async function buildFursConfigFromSettings(
  settings: {
    businessId: string
    taxId: string
    registerNumber: string
    fursCertPath: string
    fursCertPassword: string
    fursEnvironment: string
  },
  locationId: string | null | undefined,
): Promise<FursConfig> {
  // Fallback vrednosti iz RestaurantSettings (single-tenant backward compat)
  let premisesId = settings.businessId || ''
  let fursCertPath = settings.fursCertPath
  let fursCertPassword = settings.fursCertPassword
  let fursEnvironment = settings.fursEnvironment
  let businessId = settings.businessId || ''
  let taxId = settings.taxId || ''
  let registerNumber = settings.registerNumber || 'BLG-001'

  // FIX P0-C3A: Pridobi Location z specific ID — ne findFirst({isActive:true})!
  if (locationId) {
    const location = await db.location.findUnique({
      where: { id: locationId },
      select: {
        id: true,
        businessId: true,
        taxId: true,
        registerNumber: true,
        premisesId: true,
        fursCertPath: true,
        fursCertPassword: true,
        fursEnvironment: true,
      },
    })

    if (location) {
      // Location FURS polja imajo prednost pred RestaurantSettings
      if (location.premisesId) premisesId = location.premisesId
      if (location.fursCertPath) fursCertPath = location.fursCertPath
      if (location.fursCertPassword) fursCertPassword = location.fursCertPassword
      if (location.fursEnvironment) fursEnvironment = location.fursEnvironment
      // FIX P0-C3A: tudi businessId/taxId/registerNumber se razlikujejo med lokacijami
      if (location.businessId) businessId = location.businessId
      if (location.taxId) taxId = location.taxId
      if (location.registerNumber) registerNumber = location.registerNumber
    } else {
      // Location ne obstaja — to je data integrity issue
      logger.warn(
        'furs',
        `Location ${locationId} ni najdena — fallback na RestaurantSettings. ` +
          'Prosimo, nastavite FURS certifikat na Location nivoju.',
      )
    }
  } else {
    // FIX P0-C3A: locationId manjka — to je bug v klicatelju!
    // Prej je tu bilo findFirst({isActive:true}) kar je povzročalo cross-tenant leakage.
    logger.warn(
      'furs',
      'buildFursConfigFromSettings klican brez locationId — uporabljam RestaurantSettings fallback. ' +
        'Klicatelj mora posredovati order.locationId ali session.locationId.',
    )
  }

  return {
    businessId,
    taxId,
    registerId: registerNumber,
    premisesId,
    deviceIp: '',
    environment: (fursEnvironment === 'production' ? 'production' : 'test') as FursConfig['environment'],
    certPath: fursCertPath || undefined,
    certPassword: fursCertPassword || undefined,
  }
}
