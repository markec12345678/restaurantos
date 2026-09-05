// ============================================
// P0-C3A: CROSS-TENANT FURS CONFIG REGRESSION TESTS
//
// Testiramo da FURS/receipt call-sitei uporabljajo Location (vezano na order/session)
// namesto globalnih RestaurantSettings. Preprečuje cross-tenant config leakage
// (Tenant A ne sme dobiti Tenant B certifikata/taxId/businessId).
//
// Test pristop: mock Prisma client, preverjamo da je bil db.location.findUnique
// klican z pravilnim locationId (iz orderja ali session).
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

// --- Mock setup (vi.hoisted zaradi vitest hoisting) ---
const { mockLocationFindUnique, mockLocationFindFirst, mockRestaurantSettingsFindFirst } = vi.hoisted(() => ({
  mockLocationFindUnique: vi.fn(),
  mockLocationFindFirst: vi.fn(),
  mockRestaurantSettingsFindFirst: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    location: {
      findUnique: mockLocationFindUnique,
      findFirst: mockLocationFindFirst,
    },
    restaurantSettings: {
      findFirst: mockRestaurantSettingsFindFirst,
    },
  },
}))

vi.mock('@/lib/crypto/secrets', () => ({
  ensureDecrypted: (v: string) => v, // pass-through za teste
}))

import { getFursConfig, getRestaurantInfoForLocation } from '@/lib/furs/config-resolver'

// --- Test podatki ---

const LOC_A = 'loc-tenant-a'
const LOC_B = 'loc-tenant-b'

const locationA = {
  id: LOC_A,
  name: 'Restavracija A',
  address: 'Slovenska 1',
  postCode: '1000',
  city: 'Ljubljana',
  phone: '01-123-456',
  businessId: '1234567',
  taxId: 'SI12345678',
  registerNumber: 'BLG-A01',
  premisesId: 'PREMISES-A',
  fursCertPath: '/certs/loc-a.p12',
  fursCertPassword: 'enc:v1:iv:tag:password-a',
  fursEnvironment: 'test',
  currency: 'EUR',
  locale: 'sl-SI',
}

const locationB = {
  ...locationA,
  id: LOC_B,
  name: 'Restavracija B',
  businessId: '7654321',
  taxId: 'SI87654321',
  registerNumber: 'BLG-B02',
  premisesId: 'PREMISES-B',
  fursCertPath: '/certs/loc-b.p12',
  fursCertPassword: 'enc:v1:iv:tag:password-b',
}

const settingsGlobal = {
  name: 'Global RestaurantOS',
  address: 'Globalna 1',
  postCode: '1000',
  city: 'Ljubljana',
  phone: '01-000-000',
  businessId: 'GLOBAL-BIZ',
  taxId: 'SI-GLOBAL',
  registerNumber: 'BLG-GLOBAL',
  fursCertPath: '/certs/global.p12',
  fursCertPassword: 'enc:v1:iv:tag:global-pass',
  fursEnvironment: 'test',
  currency: 'EUR',
  locale: 'sl-SI',
}

describe('P0-C3A: Cross-Tenant FURS Config Regression', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getFursConfig(locationId)', () => {
    it('Tenant A dobi certifikat lokacije A (ne B, ne global)', async () => {
      mockLocationFindUnique.mockResolvedValue(locationA)

      const result = await getFursConfig(LOC_A)

      expect(result.source).toBe('location')
      expect(result.locationId).toBe(LOC_A)
      expect(result.fursConfig?.premisesId).toBe('PREMISES-A')
      expect(result.fursConfig?.taxId).toBe('SI12345678')
      expect(result.fursConfig?.certPath).toBe('/certs/loc-a.p12')

      // Pomembno: location.findUnique klican z LOC_A, ne z LOC_B ali brez
      expect(mockLocationFindUnique).toHaveBeenCalledTimes(1)
      expect(mockLocationFindUnique.mock.calls[0][0].where.id).toBe(LOC_A)

      // Pomembno: restaurantSettings.findFirst NI bil klican (Location je zadostoval)
      expect(mockRestaurantSettingsFindFirst).not.toHaveBeenCalled()
    })

    it('Tenant B dobi certifikat lokacije B (ne A)', async () => {
      mockLocationFindUnique.mockResolvedValue(locationB)

      const result = await getFursConfig(LOC_B)

      expect(result.source).toBe('location')
      expect(result.locationId).toBe(LOC_B)
      expect(result.fursConfig?.premisesId).toBe('PREMISES-B')
      expect(result.fursConfig?.taxId).toBe('SI87654321')
      expect(result.fursConfig?.certPath).toBe('/certs/loc-b.p12')

      expect(mockLocationFindUnique.mock.calls[0][0].where.id).toBe(LOC_B)
      expect(mockRestaurantSettingsFindFirst).not.toHaveBeenCalled()
    })

    it('Tenant A nikoli ne dobi Tenant B certifikata', async () => {
      mockLocationFindUnique.mockResolvedValue(locationA)

      const result = await getFursConfig(LOC_A)

      // PremisesId, taxId, certPath morajo biti iz A, ne B
      expect(result.fursConfig?.premisesId).not.toBe('PREMISES-B')
      expect(result.fursConfig?.taxId).not.toBe('SI87654321')
      expect(result.fursConfig?.certPath).not.toBe('/certs/loc-b.p12')
    })

    it('brez locationId: fallback na RestaurantSettings (single-tenant compat)', async () => {
      // Auto-detect: prva aktivna lokacija = null (simulira single-tenant brez lokacij)
      mockLocationFindFirst.mockResolvedValue(null)
      mockRestaurantSettingsFindFirst.mockResolvedValue(settingsGlobal)

      const result = await getFursConfig(null)

      // Source mora biti 'restaurant-settings' (fallback), ne 'location'
      expect(result.source).toBe('restaurant-settings')
      expect(result.fursConfig?.taxId).toBe('SI-GLOBAL')
    })
  })

  describe('getRestaurantInfoForLocation(locationId)', () => {
    it('Tenant A dobi poslovne podatke lokacije A', async () => {
      mockLocationFindUnique.mockResolvedValue(locationA)

      const info = await getRestaurantInfoForLocation(LOC_A)

      expect(info.source).toBe('location')
      expect(info.locationId).toBe(LOC_A)
      expect(info.name).toBe('Restavracija A')
      expect(info.taxId).toBe('SI12345678')
      expect(info.businessId).toBe('1234567')
      expect(info.registerNumber).toBe('BLG-A01')

      expect(mockLocationFindUnique).toHaveBeenCalledTimes(1)
      expect(mockLocationFindUnique.mock.calls[0][0].where.id).toBe(LOC_A)
      expect(mockRestaurantSettingsFindFirst).not.toHaveBeenCalled()
    })

    it('Tenant B dobi poslovne podatke lokacije B (ne A)', async () => {
      mockLocationFindUnique.mockResolvedValue(locationB)

      const info = await getRestaurantInfoForLocation(LOC_B)

      expect(info.source).toBe('location')
      expect(info.locationId).toBe(LOC_B)
      expect(info.name).toBe('Restavracija B')
      expect(info.taxId).toBe('SI87654321')
      expect(info.businessId).toBe('7654321')
      expect(info.registerNumber).toBe('BLG-B02')
    })

    it('Tenant A ne dobi Tenant B poslovnih podatkov', async () => {
      mockLocationFindUnique.mockResolvedValue(locationA)

      const info = await getRestaurantInfoForLocation(LOC_A)

      expect(info.taxId).not.toBe('SI87654321')
      expect(info.businessId).not.toBe('7654321')
      expect(info.name).not.toBe('Restavracija B')
    })

    it('brez locationId: fallback na RestaurantSettings', async () => {
      mockRestaurantSettingsFindFirst.mockResolvedValue(settingsGlobal)

      const info = await getRestaurantInfoForLocation(null)

      expect(info.source).toBe('restaurant-settings')
      expect(info.locationId).toBeNull()
      expect(info.name).toBe('Global RestaurantOS')
      expect(info.taxId).toBe('SI-GLOBAL')
    })

    it('Location ne obstaja (data integrity issue): fallback na RestaurantSettings', async () => {
      mockLocationFindUnique.mockResolvedValue(null)
      mockRestaurantSettingsFindFirst.mockResolvedValue(settingsGlobal)

      const info = await getRestaurantInfoForLocation('nonexistent-loc')

      expect(info.source).toBe('restaurant-settings')
      expect(info.locationId).toBeNull()
      expect(info.name).toBe('Global RestaurantOS')
    })

    it('order.locationId null + nobeni settings: vrne prazne podatke (ne crash)', async () => {
      mockLocationFindUnique.mockResolvedValue(null)
      mockRestaurantSettingsFindFirst.mockResolvedValue(null)

      const info = await getRestaurantInfoForLocation(null)

      expect(info.source).toBe('restaurant-settings')
      expect(info.name).toBe('')
      expect(info.taxId).toBe('')
      expect(info.businessId).toBe('')
      // Ne sme crashati — vrne default vrednosti
    })
  })

  describe('Regression: findFirst({isActive:true}) ni več uporabljen za FURS', () => {
    it('getFursConfig ne kliče location.findFirst({isActive:true})', async () => {
      mockLocationFindUnique.mockResolvedValue(locationA)

      await getFursConfig(LOC_A)

      // Pomembno: kliče se findUnique (z specific id), ne findFirst (brez id)
      const callArg = mockLocationFindUnique.mock.calls[0][0]
      expect(callArg.where).toEqual({ id: LOC_A })
      expect(callArg.where).not.toEqual({ isActive: true })
    })

    it('getRestaurantInfoForLocation ne kliče location.findFirst({isActive:true})', async () => {
      mockLocationFindUnique.mockResolvedValue(locationA)

      await getRestaurantInfoForLocation(LOC_A)

      const callArg = mockLocationFindUnique.mock.calls[0][0]
      expect(callArg.where).toEqual({ id: LOC_A })
    })
  })
})
