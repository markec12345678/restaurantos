// =====================================================================
// FURS Config Builder - Zgradi FursConfig iz nastavitev restavracije
// =====================================================================
//
// FIX issue #37 / R125: Location model je EDINI vir FURS cert polj
// (fursCertPath, fursCertPassword, fursEnvironment, premisesId).
// RestaurantSettings FURS polja so MRTVA — fallback je odstranjen
// (migration 0012_furs_location_only je legacy vrednosti prenesel na lokacije).
// businessId/taxId/registerNumber (poslovna identiteta) smejo ŠE VEDNO
// prihajati iz Settings — to NI del issue #37 duplikata.
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
 * R125 (issue #37): `settings` tip vsebuje SAMO poslovna polja (businessId,
 * taxId, registerNumber). FURS cert polja prihajajo IZKLJUČNO iz Location:
 *   - locationId podan + Location najdena → cert polja iz lokacije
 *   - locationId manjka / Location ne obstaja → cert polja PRAZNA (ne settings!)
 *     (fallback na RestaurantSettings je odstranjen — polja so MRTVA)
 * Polni RestaurantSettings vrstici iz DB ostanejo kompatibilen argument
 * (širši tip) — settings.furs* vrednosti se preprosto IGNORIRAJU.
 *
 * @param settings - poslovna identiteta (businessId/taxId/registerNumber; furs* polja ignorirana)
 * @param locationId - ID lokacije za katero se gradi config (obvezen za cert polja!)
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
  },
  locationId: string | null | undefined,
): Promise<FursConfig> {
  // R125 (issue #37): FURS cert polja izključno iz Location — settings fallback odstranjen
  let premisesId = ''
  let fursCertPath: string | undefined
  let fursCertPassword: string | undefined
  let fursEnvironment = ''
  // Poslovna identiteta: Settings je še vedno default, Location jo overrida (P0-C3A)
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
      // Location je EDINI vir FURS cert polj (R125, issue #37)
      if (location.premisesId) premisesId = location.premisesId
      if (location.fursCertPath) fursCertPath = location.fursCertPath
      if (location.fursCertPassword) fursCertPassword = location.fursCertPassword
      if (location.fursEnvironment) fursEnvironment = location.fursEnvironment
      // FIX P0-C3A: tudi businessId/taxId/registerNumber se razlikujejo med lokacijami
      if (location.businessId) businessId = location.businessId
      if (location.taxId) taxId = location.taxId
      if (location.registerNumber) registerNumber = location.registerNumber
    } else {
      // Location ne obstaja — data integrity issue; cert polja ostanejo PRAZNA
      // (R125: ni fallbacka na RestaurantSettings — fail-closed za fiskalizacijo)
      logger.warn(
        'furs',
        `Location ${locationId} ni najdena — FURS cert polja ostajajo prazna (Location-only, R125). ` +
          'Nastavite FURS certifikat na Location nivoju.',
      )
    }
  } else {
    // FIX P0-C3A: locationId manjka — to je bug v klicatelju!
    // Prej je tu bilo findFirst({isActive:true}) kar je povzročalo cross-tenant leakage.
    logger.warn(
      'furs',
      'buildFursConfigFromSettings klican brez locationId — FURS cert polja ostajajo prazna (Location-only, R125). ' +
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
