// ============================================
// FURS CONFIG RESOLVER — Per-location FURS configuration
//
// ISSUE #37: RestaurantSettings FURS polja (fursCertPath, fursCertPassword,
// fursEnvironment) so duplikat Location FURS polj. FURS zahteva per-lokacija
// certifikat (vsaka lokacija ima svoj premisesId).
//
// Ta modul centralizira logiko za izbiro prave FURS konfiguracije:
//   1. Če je podan locationId → preberi iz te lokacije
//   2. Drugače → preberi iz prve aktivne lokacije (auto-detect)
//   3. Fallback → RestaurantSettings (single-tenant backward compat)
//   4. Končni fallback → env spremenljivke (FURS_CERT_PATH, itd.)
//
// Uporaba:
//   const config = await getFursConfig(locationId)
//   if (config.error) return config.error
//   // config.fursConfig je pripravljen za verifyInvoiceWithFURS()
// ============================================

import { db } from '@/lib/db'
import type { FursConfig } from '@/lib/furs'
import { NextResponse } from 'next/server'

export interface FursConfigResult {
  /** Pripravljen FursConfig (ali null če manjkajo obvezna polja) */
  fursConfig: FursConfig | null
  /** Vir konfiguracije (za debug) */
  source: 'location' | 'restaurant-settings' | 'env' | 'missing'
  /** ID uporabljene lokacije (ali null) */
  locationId: string | null
  /** Napaka (če manjkajo obvezna polja) */
  error: NextResponse | null
}

/**
 * Pridobi FURS konfiguracijo za določeno lokacijo.
 *
 * Logika po prioriteti:
 * 1. Location z podanim locationId (multi-tenant)
 * 2. Prva aktivna Location (single-tenant auto-detect)
 * 3. RestaurantSettings (legacy fallback)
 * 4. env spremenljivke (zadnji fallback)
 *
 * @param locationId - opcijsko ID lokacije. Če ni podan, se auto-detect-a prva aktivna.
 */
export async function getFursConfig(locationId?: string | null): Promise<FursConfigResult> {
  // 1. Poskusi pridobiti specifično lokacijo (ali prvo aktivno)
  let location: {
    id: string
    businessId: string
    taxId: string
    registerNumber: string
    premisesId: string
    fursCertPath: string
    fursCertPassword: string
    fursEnvironment: string
  } | null = null

  if (locationId) {
    location = await db.location.findUnique({
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
  } else {
    // Auto-detect: prva aktivna lokacija
    location = await db.location.findFirst({
      where: { isActive: true },
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
  }

  // 2. Če lokacija obstaja in ima vse potrebne podatke → uporabi jo
  if (location && location.premisesId && location.fursCertPath) {
    return {
      fursConfig: {
        businessId: location.businessId || '',
        taxId: location.taxId || '',
        registerId: location.registerNumber || 'BLG-001',
        premisesId: location.premisesId,
        deviceIp: '',
        environment: (location.fursEnvironment === 'production' ? 'production' : 'test') as FursConfig['environment'],
        certPath: location.fursCertPath || undefined,
        certPassword: location.fursCertPassword || undefined,
      },
      source: 'location',
      locationId: location.id,
      error: null,
    }
  }

  // 3. Fallback na RestaurantSettings (single-tenant backward compat)
  const settings = await db.restaurantSettings.findFirst({
    select: {
      businessId: true,
      taxId: true,
      registerNumber: true,
      fursCertPath: true,
      fursCertPassword: true,
      fursEnvironment: true,
    },
  })

  if (settings && settings.fursCertPath) {
    // ⚠️ ISSUE #37: deprecated path — admin naj nastavi FURS na Location nivoju
    console.warn(
      '[furs] Uporabljam RestaurantSettings FURS konfiguracijo (deprecated). ' +
        'Prosimo, nastavite FURS certifikat na Location nivoju za multi-tenant podporo.',
    )

    // Pridobi premisesId iz Location (če obstaja) ali fallback na businessId
    let premisesId = settings.businessId
    if (location?.premisesId) {
      premisesId = location.premisesId
    }

    return {
      fursConfig: {
        businessId: settings.businessId || '',
        taxId: settings.taxId || '',
        registerId: settings.registerNumber || 'BLG-001',
        premisesId,
        deviceIp: '',
        environment: (settings.fursEnvironment === 'production' ? 'production' : 'test') as FursConfig['environment'],
        certPath: settings.fursCertPath || undefined,
        certPassword: settings.fursCertPassword || undefined,
      },
      source: 'restaurant-settings',
      locationId: location?.id || null,
      error: null,
    }
  }

  // 4. Zadnji fallback: env spremenljivke
  const envCertPath = process.env.FURS_CERT_PATH
  const envCertPassword = process.env.FURS_CERT_PASSWORD
  const envEnvironment = process.env.FURS_ENV
  const envTaxNumber = process.env.FURS_TAX_NUMBER

  if (envCertPath) {
    return {
      fursConfig: {
        businessId: '',
        taxId: envTaxNumber || '',
        registerId: 'BLG-001',
        premisesId: '',
        deviceIp: '',
        environment: (envEnvironment === 'production' ? 'production' : 'test') as FursConfig['environment'],
        certPath: envCertPath,
        certPassword: envCertPassword || undefined,
      },
      source: 'env',
      locationId: null,
      error: null,
    }
  }

  // 5. Ni najdena nobena konfiguracija
  return {
    fursConfig: null,
    source: 'missing',
    locationId: location?.id || null,
    error: NextResponse.json(
      {
        error: 'FURS certifikat ni konfiguriran.',
        hint: 'Nastavite FURS certifikat na Location nivoju (priporočeno za multi-tenant) ali v RestaurantSettings (deprecated) ali v .env (FURS_CERT_PATH).',
        docs: '/SECURITY.md#furs',
      },
      { status: 503 },
    ),
  }
}

/**
 * Hitra validacija ali je FURS konfiguriran za določeno lokacijo.
 *
 * Uporaba v setup wizard-u ali v dashboard alertih:
 *   if (!(await isFursConfigured(locationId))) {
 *     showToast('FURS certifikat ni nastavljen za to lokacijo')
 *   }
 */
export async function isFursConfigured(locationId?: string | null): Promise<boolean> {
  const result = await getFursConfig(locationId)
  return result.fursConfig !== null && !!result.fursConfig.certPath
}

/**
 * Pridobi vir FURS konfiguracije za prikaz v admin UI.
 * Uporabno za diagnosticiranje "odkod bere FURS certifikat".
 */
export async function getFursConfigSource(locationId?: string | null): Promise<{
  source: 'location' | 'restaurant-settings' | 'env' | 'missing'
  locationId: string | null
}> {
  const result = await getFursConfig(locationId)
  return {
    source: result.source,
    locationId: result.locationId,
  }
}
