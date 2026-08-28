// ============================================
// FURS CONFIG RESOLVER — Unit testi (Issue #37)
//
// Preverjamo:
// - getFursConfig(locationId): prioriteta Location > RestaurantSettings > env
// - isFursConfigured: boolean check
// - getFursConfigSource: diagnostika
// - Multi-tenant: različne lokacije imajo različne FURS certifikate
// - Single-tenant fallback: RestaurantSettings ali env
// - Missing config: vrne error response
// ============================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const mockLocationFindUnique = vi.fn()
  const mockLocationFindFirst = vi.fn()
  const mockRestaurantSettingsFindFirst = vi.fn()
  return {
    mockLocationFindUnique,
    mockLocationFindFirst,
    mockRestaurantSettingsFindFirst,
  }
})

vi.mock('@/lib/db', () => ({
  db: {
    location: {
      findUnique: mocks.mockLocationFindUnique,
      findFirst: mocks.mockLocationFindFirst,
    },
    restaurantSettings: {
      findFirst: mocks.mockRestaurantSettingsFindFirst,
    },
  },
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

// Suppress console.warn v testih (FURS deprecated warning)
vi.spyOn(console, 'warn').mockImplementation(() => {})

import {
  getFursConfig,
  isFursConfigured,
  getFursConfigSource,
} from '@/lib/furs/config-resolver'

const setEnv = (key: string, value: string | undefined) => {
  if (value === undefined) {
    delete (process.env as Record<string, string | undefined>)[key]
  } else {
    ;(process.env as Record<string, string | undefined>)[key] = value
  }
}

describe('getFursConfig — Issue #37 prioritetna veriga', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setEnv('FURS_CERT_PATH', undefined)
    setEnv('FURS_CERT_PASSWORD', undefined)
    setEnv('FURS_ENV', undefined)
    setEnv('FURS_TAX_NUMBER', undefined)
  })

  afterEach(() => {
    setEnv('FURS_CERT_PATH', undefined)
    setEnv('FURS_CERT_PASSWORD', undefined)
    setEnv('FURS_ENV', undefined)
    setEnv('FURS_TAX_NUMBER', undefined)
  })

  it('1. prioriteta: Location z locationId → source=location', async () => {
    mocks.mockLocationFindUnique.mockResolvedValue({
      id: 'loc-1',
      businessId: '12345678',
      taxId: 'SI12345678',
      registerNumber: 'BLG-001',
      premisesId: 'PREMISES-X',
      fursCertPath: '/certs/loc1.p12',
      fursCertPassword: 'pass1',
      fursEnvironment: 'production',
    })

    const result = await getFursConfig('loc-1')

    expect(result.source).toBe('location')
    expect(result.locationId).toBe('loc-1')
    expect(result.error).toBeNull()
    expect(result.fursConfig).toEqual({
      businessId: '12345678',
      taxId: 'SI12345678',
      registerId: 'BLG-001',
      premisesId: 'PREMISES-X',
      deviceIp: '',
      environment: 'production',
      certPath: '/certs/loc1.p12',
      certPassword: 'pass1',
    })
    // Ni se povpraževal po RestaurantSettings (hitri path)
    expect(mocks.mockRestaurantSettingsFindFirst).not.toHaveBeenCalled()
  })

  it('2. prioriteta: brez locationId → auto-detect prve aktivne lokacije', async () => {
    mocks.mockLocationFindFirst.mockResolvedValue({
      id: 'loc-auto',
      businessId: '87654321',
      taxId: 'SI87654321',
      registerNumber: 'BLG-002',
      premisesId: 'PREMISES-AUTO',
      fursCertPath: '/certs/auto.p12',
      fursCertPassword: 'autopass',
      fursEnvironment: 'test',
    })

    const result = await getFursConfig(undefined)

    expect(result.source).toBe('location')
    expect(result.locationId).toBe('loc-auto')
    expect(mocks.mockLocationFindFirst).toHaveBeenCalledWith({
      where: { isActive: true },
      select: expect.any(Object),
    })
  })

  it('3. prioriteta: Location brez fursCertPath → fallback na RestaurantSettings', async () => {
    mocks.mockLocationFindUnique.mockResolvedValue({
      id: 'loc-empty',
      businessId: '',
      taxId: '',
      registerNumber: '',
      premisesId: '',
      fursCertPath: '', // prazen
      fursCertPassword: '',
      fursEnvironment: '',
    })
    mocks.mockRestaurantSettingsFindFirst.mockResolvedValue({
      businessId: '11111111',
      taxId: 'SI11111111',
      registerNumber: 'BLG-FB',
      fursCertPath: '/certs/fallback.p12',
      fursCertPassword: 'fbpass',
      fursEnvironment: 'test',
    })

    const result = await getFursConfig('loc-empty')

    expect(result.source).toBe('restaurant-settings')
    expect(result.fursConfig?.certPath).toBe('/certs/fallback.p12')
  })

  it('4. prioriteta: nobena Location + noben RestaurantSettings → fallback na env', async () => {
    mocks.mockLocationFindFirst.mockResolvedValue(null)
    mocks.mockRestaurantSettingsFindFirst.mockResolvedValue(null)
    setEnv('FURS_CERT_PATH', '/env/cert.p12')
    setEnv('FURS_CERT_PASSWORD', 'envpass')
    setEnv('FURS_ENV', 'production')
    setEnv('FURS_TAX_NUMBER', 'SI99999999')

    const result = await getFursConfig()

    expect(result.source).toBe('env')
    expect(result.fursConfig?.certPath).toBe('/env/cert.p12')
    expect(result.fursConfig?.certPassword).toBe('envpass')
    expect(result.fursConfig?.environment).toBe('production')
  })

  it('5. prioriteta: nič konfigurirano → source=missing + error', async () => {
    mocks.mockLocationFindFirst.mockResolvedValue(null)
    mocks.mockRestaurantSettingsFindFirst.mockResolvedValue(null)
    setEnv('FURS_CERT_PATH', undefined)

    const result = await getFursConfig()

    expect(result.source).toBe('missing')
    expect(result.fursConfig).toBeNull()
    expect(result.error).not.toBeNull()
  })

  it('locationId ki ne obstaja → fallback na RestaurantSettings', async () => {
    mocks.mockLocationFindUnique.mockResolvedValue(null)
    mocks.mockRestaurantSettingsFindFirst.mockResolvedValue({
      businessId: '11111111',
      taxId: 'SI11111111',
      registerNumber: 'BLG-FB',
      fursCertPath: '/certs/fallback.p12',
      fursCertPassword: 'fbpass',
      fursEnvironment: 'test',
    })

    const result = await getFursConfig('nonexistent-loc')

    expect(result.source).toBe('restaurant-settings')
    expect(result.fursConfig?.certPath).toBe('/certs/fallback.p12')
  })
})

describe('isFursConfigured — Issue #37', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setEnv('FURS_CERT_PATH', undefined)
  })

  it('vrne true če je Location konfiguriran', async () => {
    mocks.mockLocationFindFirst.mockResolvedValue({
      id: 'loc-1',
      businessId: '12345678',
      taxId: 'SI12345678',
      registerNumber: 'BLG-001',
      premisesId: 'PREMISES-X',
      fursCertPath: '/certs/loc1.p12',
      fursCertPassword: 'pass1',
      fursEnvironment: 'test',
    })

    const result = await isFursConfigured()
    expect(result).toBe(true)
  })

  it('vrne true če je env FURS_CERT_PATH nastavljen', async () => {
    mocks.mockLocationFindFirst.mockResolvedValue(null)
    mocks.mockRestaurantSettingsFindFirst.mockResolvedValue(null)
    setEnv('FURS_CERT_PATH', '/env/cert.p12')

    const result = await isFursConfigured()
    expect(result).toBe(true)
  })

  it('vrne false če ni nobene konfiguracije', async () => {
    mocks.mockLocationFindFirst.mockResolvedValue(null)
    mocks.mockRestaurantSettingsFindFirst.mockResolvedValue(null)
    setEnv('FURS_CERT_PATH', undefined)

    const result = await isFursConfigured()
    expect(result).toBe(false)
  })

  it('vrne false če Location obstaja a brez fursCertPath', async () => {
    mocks.mockLocationFindFirst.mockResolvedValue({
      id: 'loc-empty',
      businessId: '',
      taxId: '',
      registerNumber: '',
      premisesId: '',
      fursCertPath: '', // prazen
      fursCertPassword: '',
      fursEnvironment: '',
    })
    mocks.mockRestaurantSettingsFindFirst.mockResolvedValue(null)
    setEnv('FURS_CERT_PATH', undefined)

    const result = await isFursConfigured()
    expect(result).toBe(false)
  })
})

describe('getFursConfigSource — diagnostika', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setEnv('FURS_CERT_PATH', undefined)
  })

  it('vrne source + locationId za konfigurirano lokacijo', async () => {
    mocks.mockLocationFindUnique.mockResolvedValue({
      id: 'loc-x',
      businessId: '12345678',
      taxId: 'SI12345678',
      registerNumber: 'BLG-001',
      premisesId: 'PREMISES-X',
      fursCertPath: '/certs/x.p12',
      fursCertPassword: 'pass',
      fursEnvironment: 'test',
    })

    const result = await getFursConfigSource('loc-x')

    expect(result).toEqual({
      source: 'location',
      locationId: 'loc-x',
    })
  })

  it('vrne source=missing ko ni konfigurirano', async () => {
    mocks.mockLocationFindFirst.mockResolvedValue(null)
    mocks.mockRestaurantSettingsFindFirst.mockResolvedValue(null)
    setEnv('FURS_CERT_PATH', undefined)

    const result = await getFursConfigSource()
    expect(result.source).toBe('missing')
    expect(result.locationId).toBeNull()
  })
})

describe('Multi-tenant izolacija — različne lokacije imajo različne FURS cert', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loc-A in loc-B imata različne certPath', async () => {
    mocks.mockLocationFindUnique
      .mockResolvedValueOnce({
        id: 'loc-A',
        businessId: 'AAA',
        taxId: 'SI_AAA',
        registerNumber: 'BLG-A',
        premisesId: 'PREM-A',
        fursCertPath: '/certs/aaa.p12',
        fursCertPassword: 'aaa-pass',
        fursEnvironment: 'test',
      })
      .mockResolvedValueOnce({
        id: 'loc-B',
        businessId: 'BBB',
        taxId: 'SI_BBB',
        registerNumber: 'BLG-B',
        premisesId: 'PREM-B',
        fursCertPath: '/certs/bbb.p12',
        fursCertPassword: 'bbb-pass',
        fursEnvironment: 'production',
      })

    const resultA = await getFursConfig('loc-A')
    const resultB = await getFursConfig('loc-B')

    expect(resultA.fursConfig?.certPath).toBe('/certs/aaa.p12')
    expect(resultA.fursConfig?.premisesId).toBe('PREM-A')
    expect(resultA.fursConfig?.environment).toBe('test')

    expect(resultB.fursConfig?.certPath).toBe('/certs/bbb.p12')
    expect(resultB.fursConfig?.premisesId).toBe('PREM-B')
    expect(resultB.fursConfig?.environment).toBe('production')

    // Popolna izolacija
    expect(resultA.fursConfig?.certPath).not.toBe(resultB.fursConfig?.certPath)
    expect(resultA.fursConfig?.premisesId).not.toBe(resultB.fursConfig?.premisesId)
  })
})
