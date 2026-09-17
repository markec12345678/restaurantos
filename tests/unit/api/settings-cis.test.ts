// ============================================
// SETTINGS ROUTE — CIS certifikat polja (Task 24)
//
// GET /api/settings:
//   - cisCertPassword/cisCertPath se maskirata ('••••••'), NE leakata v odgovoru
//   - hasCisCert flag pravilno računan
//   - cisEnvironment preživi v odgovoru (ne-občutljivo polje)
// PUT /api/settings:
//   - maskirana vrednost '••••••' se NE shrani (ohrani staro)
//   - cisEnvironment se shrani
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  settingsFindFirst: vi.fn(),
  settingsCreate: vi.fn(),
  settingsUpdate: vi.fn(),
  requireAuth: vi.fn(),
  checkRateLimitAsync: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    restaurantSettings: {
      findFirst: mocks.settingsFindFirst,
      create: mocks.settingsCreate,
      update: mocks.settingsUpdate,
    },
  },
}))

vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: mocks.requireAuth,
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.checkRateLimitAsync,
  getClientIp: () => '127.0.0.1',
  AUTHENTICATED_LIMIT: {},
}))

vi.mock('@/lib/api-utils', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/api-utils')>()
  return {
    ...actual,
    handleApiError: (e: unknown) => ({
      json: async () => ({ error: String(e) }),
      status: 500,
    }),
  }
})

import { GET, PUT } from '@/app/api/settings/route'
import { updateSettingsSchema } from '@/lib/validations/settings'

function makeRequest(body?: unknown, method = 'GET'): Request {
  return new Request('http://localhost:3000/api/settings', {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

/** Polna settings vrstica iz DB (kakršna pride iz Prisme). */
function dbSettings(overrides: Record<string, unknown> = {}) {
  return {
    id: 'settings-1',
    name: 'Test Restavracija',
    address: 'Ulica 1',
    city: 'Zagreb',
    postCode: '10000',
    phone: '',
    email: '',
    web: '',
    businessId: '12345678901',
    taxId: 'HR12345678901',
    registerNumber: 'BLG-001',
    fursCertPath: '/certs/furs.p12',
    fursCertPassword: 'furs-secret',
    fursEnvironment: 'test',
    cisCertPath: '/certs/fina-demo.p12',
    cisCertPassword: 'cis-secret',
    cisEnvironment: 'test',
    defaultVatRate: 22,
    reducedVatRate: 9.5,
    loyaltyEnabled: false,
    loyaltyPointsPerEuro: 1,
    loyaltyPointsValue: 0.01,
    receiptFooter: '',
    currency: 'EUR',
    locale: 'sl-SI',
    country: 'HR',
    isActive: true,
    apiKeys: '{}',
    emailSmtpHost: '',
    emailSmtpPort: 587,
    emailSmtpUser: '',
    emailSmtpPassword: '',
    emailFromAddress: '',
    emailReportRecipients: '[]',
    emailEnabled: false,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuth.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } })
  mocks.checkRateLimitAsync.mockResolvedValue({ allowed: true })
})

describe('GET /api/settings — CIS maskiranje (Task 24)', () => {
  it('maskira cisCertPassword in cisCertPath, izpostavi hasCisCert', async () => {
    mocks.settingsFindFirst.mockResolvedValue(dbSettings())

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const data = await res.json()

    // Geslo in pot NIKOLI v odgovoru
    expect(data.cisCertPassword).toBe('••••••')
    expect(data.cisCertPath).toBe('••••••')
    expect(JSON.stringify(data)).not.toContain('cis-secret')
    expect(JSON.stringify(data)).not.toContain('/certs/fina-demo.p12')
    // Flag je true (obstaja + geslo)
    expect(data.hasCisCert).toBe(true)
    // Ne-občutljivo okolje preživi
    expect(data.cisEnvironment).toBe('test')
  })

  it('hasCisCert=false ko cert manjka', async () => {
    mocks.settingsFindFirst.mockResolvedValue(dbSettings({ cisCertPath: '', cisCertPassword: '' }))

    const res = await GET(makeRequest())
    const data = await res.json()

    expect(data.cisCertPassword).toBe('')
    expect(data.cisCertPath).toBe('')
    expect(data.hasCisCert).toBe(false)
  })
})

describe('PUT /api/settings — CIS shranjevanje (Task 24)', () => {
  it('ne prepiše cisCertPassword z maskirano vrednostjo', async () => {
    mocks.settingsFindFirst.mockResolvedValue(dbSettings())
    mocks.settingsUpdate.mockImplementation(({ data }) => Promise.resolve(dbSettings(data)))

    const res = await PUT(makeRequest({
      cisEnvironment: 'production',
      cisCertPassword: '••••••',
      cisCertPath: '••••••',
    }, 'PUT'))

    expect(res.status).toBe(200)

    // Update call: geslo/pot NE smejo biti v data (maska je bila odstranjena)
    const updateCall = mocks.settingsUpdate.mock.calls[0][0]
    expect(updateCall.data.cisEnvironment).toBe('production')
    expect(updateCall.data.cisCertPassword).toBeUndefined()
    expect(updateCall.data.cisCertPath).toBeUndefined()
  })

  it('shrani novo cisCertPassword ko uporabnik vpiše pravo vrednost', async () => {
    mocks.settingsFindFirst.mockResolvedValue(dbSettings())
    mocks.settingsUpdate.mockImplementation(({ data }) => Promise.resolve(dbSettings(data)))

    await PUT(makeRequest({ cisCertPassword: 'novo-geslo' }, 'PUT'))

    const updateCall = mocks.settingsUpdate.mock.calls[0][0]
    expect(updateCall.data.cisCertPassword).toBe('novo-geslo')
  })
})

describe('updateSettingsSchema — CIS polja (Task 24)', () => {
  it('sprejme veljavna CIS polja', () => {
    const result = updateSettingsSchema.safeParse({
      cisCertPath: '/certs/fina.p12',
      cisCertPassword: 'geslo',
      cisEnvironment: 'production',
    })
    expect(result.success).toBe(true)
  })

  it('zavrne neveljaven cisEnvironment', () => {
    const result = updateSettingsSchema.safeParse({ cisEnvironment: 'staging' })
    expect(result.success).toBe(false)
  })
})
