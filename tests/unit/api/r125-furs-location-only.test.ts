// ============================================
// R125 / ISSUE #37 — FURS LOCATION-ONLY (backend)
// ============================================
// RestaurantSettings.fursCertPath / fursCertPassword / fursEnvironment so
// MRTVA polja (migration 0012_furs_location_only je non-empty vrednosti
// prenesel na aktivne lokacije). Ta datoteka DOKAZUJE:
//  1. getFursConfig: Location → env → missing (fail-closed 503) — NI več
//     settings fallbacka; neveljaven locationId ostane fail-closed (R76)
//  2. buildFursConfigFromSettings: cert polja IZKLJUČNO iz Location; polni
//     settings vrstici (legacy klicatelji) ostanejo kompatibilen argument,
//     settings.furs* vrednosti pa se IGNORIRAJU
//  3. PUT /api/settings: legacy furs* polja v body so STRIPANA (ni jih v
//     Zod shemi + obrambni strip) in se NE persistirajo; create path uporablja
//     DB defaulte (''), GET echo ostane maskiran (read-only legacy)
//  4. GET /api/locations (+ [id]): hasFursCert flag (izračunan PRED
//     maskiranjem) — UI bere FURS stanje lokacije
//
// Trap DB (hišni stil R119–R124): vi.mock('@/lib/db') z getter + vi.hoisted;
// mockani SAMO mejni moduli (auth, rate-limit, ensureDecrypted);
// tenant-scope, maskLocationSecrets, Zod validacija in api-utils tečejo REALNO.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const LOC_OK = 'loc-configured'
const LOC_EMPTY = 'loc-empty'
const LOC_MISSING = 'loc-nonexistent'

// ---------- Vrstice ----------
interface LocationRow {
  id: string
  isActive?: boolean
  isOpen?: boolean
  name?: string
  businessId?: string
  taxId?: string
  registerNumber?: string
  premisesId?: string
  fursCertPath?: string
  fursCertPassword?: string
  fursEnvironment?: string
  _count?: Record<string, number>
  tables?: unknown[]
}

type SettingsRow = Record<string, unknown> & {
  id: string
  fursCertPath: string
  fursCertPassword: string
  fursEnvironment: string
  apiKeys: string
  emailSmtpUser: string
}

function createDb() {
  const locations: LocationRow[] = []
  const settingsRows: SettingsRow[] = []

  // Zajem klicev — dokaz da settings FURS NI več bran/pisan
  const captured = {
    locationFindUnique: [] as Array<{ where?: { id?: string } }>,
    locationFindFirst: [] as unknown[],
    settingsFindFirst: [] as unknown[],
    settingsUpdate: [] as Array<{ data: Record<string, unknown> }>,
    settingsCreate: [] as Array<{ data: Record<string, unknown> }>,
  }

  const matches = (row: LocationRow, where?: Record<string, unknown>) =>
    !where || Object.entries(where).every(([k, v]) => (row as unknown as Record<string, unknown>)[k] === v)

  const db = {
    location: {
      findUnique: async (args: { where?: { id?: string } }) => {
        captured.locationFindUnique.push(args)
        const row = locations.find(l => l.id === args?.where?.id)
        return row ? { ...row } : null
      },
      findFirst: async (args: { where?: Record<string, unknown> }) => {
        captured.locationFindFirst.push(args)
        const row = locations.find(l => l.isActive === true && matches(l, args?.where))
        return row ? { ...row } : null
      },
      findMany: async (args: { where?: Record<string, unknown> }) =>
        locations.filter(l => matches(l, args?.where)).map(l => ({ ...l })),
      count: async (args: { where?: Record<string, unknown> }) =>
        locations.filter(l => matches(l, args?.where)).length,
    },
    restaurantSettings: {
      findFirst: async () => {
        captured.settingsFindFirst.push(1)
        return settingsRows[0] ? { ...settingsRows[0] } : null
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        captured.settingsCreate.push({ data })
        const row: SettingsRow = {
          id: 'settings-new',
          fursCertPath: '',
          fursCertPassword: '',
          fursEnvironment: 'test',
          apiKeys: '{}',
          emailSmtpUser: '',
          ...data,
        }
        settingsRows.push(row)
        return { ...row }
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        captured.settingsUpdate.push({ data })
        const row = settingsRows[0]
        Object.assign(row, data)
        return { ...row }
      },
    },
    order: {
      aggregate: async () => ({ _sum: { total: null, tip: null }, _count: 0 }),
    },
  }

  return { db, locations, settingsRows, captured }
}

// vi.hoisted — mock factory se izvede PRED modulskim scope-om (hišni stil)
const ref = vi.hoisted(() => ({ current: null as unknown as ReturnType<typeof createDb> }))
ref.current = createDb()

const m = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  checkRateLimitAsync: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  get db() {
    return ref.current.db
  },
}))

// Boundary moduli: auth + rate-limit mock, crypto pass-through (kot v furs-cross-tenant)
vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: (...args: unknown[]) => m.requireAuth(...args),
}))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: (...args: unknown[]) => m.checkRateLimitAsync(...args),
  checkRateLimit: () => ({ allowed: true, remaining: 10 }),
  getClientIp: () => '127.0.0.1',
  AUTHENTICATED_LIMIT: {},
}))
vi.mock('@/lib/crypto/secrets', () => ({
  ensureDecrypted: (v: string) => v, // pass-through za teste
}))

// api-utils REALNO, samo handleApiError poenostavljen (settings-cis vzorec)
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

import { getFursConfig } from '@/lib/furs/config-resolver'
import { buildFursConfigFromSettings } from '@/app/api/furs/helpers/build-config'
import { PUT as settingsPUT } from '@/app/api/settings/route'
import { GET as locationsGET } from '@/app/api/locations/route'
import { GET as locationByIdGET } from '@/app/api/locations/[id]/route'

const state = ref.current

// ---------- Helperji ----------
function seedConfiguredLocation(id = LOC_OK): void {
  state.locations.push({
    id,
    isActive: true,
    isOpen: true,
    name: 'Glavna lokacija',
    businessId: 'LOC-BIZ',
    taxId: 'SI-LOC-TAX',
    registerNumber: 'BLG-LOC',
    premisesId: 'PREM-LOC',
    fursCertPath: '/certs/loc.p12',
    fursCertPassword: 'loc-pass',
    fursEnvironment: 'test',
    _count: { orders: 0, tables: 0, employees: 0, inventoryItems: 0, cashShifts: 0, reservations: 0 },
    tables: [],
  })
}

function seedEmptyLocation(id = LOC_EMPTY): void {
  state.locations.push({
    id,
    isActive: true,
    isOpen: true,
    name: 'Prazna lokacija',
    businessId: '',
    taxId: '',
    registerNumber: '',
    premisesId: '',
    fursCertPath: '',
    fursCertPassword: '',
    fursEnvironment: 'test',
    _count: { orders: 0, tables: 0, employees: 0, inventoryItems: 0, cashShifts: 0, reservations: 0 },
    tables: [],
  })
}

/** Legacy settings vrstica s FURS vrednostmi (npr. pred migracijo 0012). */
function seedLegacySettings(): void {
  state.settingsRows.push({
    id: 'settings-1',
    name: 'Legacy',
    businessId: 'SET-BIZ',
    taxId: 'SET-TAX',
    registerNumber: 'SET-REG',
    fursCertPath: '/settings/legacy-cert.p12',
    fursCertPassword: 'legacy-pass',
    fursEnvironment: 'production',
    apiKeys: '{}',
    emailSmtpUser: '',
    emailSmtpPassword: '',
    isActive: true,
  })
}

const setEnv = (key: string, value: string | undefined) => {
  if (value === undefined) delete (process.env as Record<string, string | undefined>)[key]
  else (process.env as Record<string, string | undefined>)[key] = value
}

const jsonReq = (url: string, method: string, body?: unknown) =>
  new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

/** Admin seja (permission admin) — realen tenant-scope jo sprejme. */
function mockSuperAdmin(): void {
  m.requireAuth.mockResolvedValue({
    session: { employeeId: 'emp-1', role: 'super_admin', locationId: null, permissions: ['admin'] },
    error: null,
  })
}

function resetState(): void {
  state.locations.length = 0
  state.settingsRows.length = 0
  state.captured.locationFindUnique.length = 0
  state.captured.locationFindFirst.length = 0
  state.captured.settingsFindFirst.length = 0
  state.captured.settingsUpdate.length = 0
  state.captured.settingsCreate.length = 0
}

beforeEach(() => {
  vi.clearAllMocks()
  resetState()
  m.requireAuth.mockResolvedValue({
    session: { employeeId: 'emp-1', role: 'admin', locationId: null, permissions: ['admin'] },
    error: null,
  })
  m.checkRateLimitAsync.mockResolvedValue({ allowed: true, retryAfterMs: 1000 })
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

// ============================================
// 1. getFursConfig — Location → env → missing
// ============================================
describe('getFursConfig — R125 Location-only veriga', () => {
  it('lokacija s certifikatom → source location + cert polja iz lokacije', async () => {
    seedConfiguredLocation()
    seedLegacySettings() // legacy vrednosti v DB — ne smejo zmagati

    const result = await getFursConfig(LOC_OK)

    expect(result.source).toBe('location')
    expect(result.locationId).toBe(LOC_OK)
    expect(result.error).toBeNull()
    expect(result.fursConfig?.certPath).toBe('/certs/loc.p12')
    expect(result.fursConfig?.certPassword).toBe('loc-pass')
    expect(result.fursConfig?.premisesId).toBe('PREM-LOC')
    // R125 dokaz: settings se NE pošprazuje več nikoli (niti kot fallback)
    expect(state.captured.settingsFindFirst).toHaveLength(0)
  })

  it('lokacija OBSTAJA a ni konfigurirana → NI settings fallbacka → missing 503', async () => {
    seedEmptyLocation()
    seedLegacySettings() // legacy furs vrednosti MORAJO biti ignorirane

    const result = await getFursConfig(LOC_EMPTY)

    expect(result.source).toBe('missing')
    expect(result.fursConfig).toBeNull()
    expect(result.error).not.toBeNull()
    expect(result.error?.status).toBe(503)
    const payload = await result.error?.json()
    expect(payload.error).toBe('FURS certifikat ni konfiguriran.')
    // posodobljen hint: NE priporoča več RestaurantSettings
    expect(JSON.stringify(payload.hint)).not.toContain('RestaurantSettings')
    // R125 dokaz: settings findFirst NI bil klican (fallback odstranjen)
    expect(state.captured.settingsFindFirst).toHaveLength(0)
  })

  it('lokacija ni konfigurirana + env nastavljen → env fallback (ne settings)', async () => {
    seedEmptyLocation()
    seedLegacySettings()
    setEnv('FURS_CERT_PATH', '/env/cert.p12')
    setEnv('FURS_CERT_PASSWORD', 'env-pass')

    const result = await getFursConfig(LOC_EMPTY)

    expect(result.source).toBe('env')
    expect(result.fursConfig?.certPath).toBe('/env/cert.p12')
    expect(state.captured.settingsFindFirst).toHaveLength(0)
  })

  it('neveljaven locationId → missing 503 kljub env IN legacy settings (R76 fail-closed ohranjen)', async () => {
    seedLegacySettings()
    setEnv('FURS_CERT_PATH', '/env/cert.p12')
    setEnv('FURS_CERT_PASSWORD', 'env-pass')

    const result = await getFursConfig(LOC_MISSING)

    expect(result.source).toBe('missing')
    expect(result.fursConfig).toBeNull()
    expect(result.error?.status).toBe(503)
    // cross-tenant zaščita: neveljaven id NE sme pustiti niti env niti settings fallbacka
    const payload = await result.error?.json()
    expect(JSON.stringify(payload)).toContain('fail-closed')
  })

  it('brez locationId → auto-detect prve aktivne lokacije (source location)', async () => {
    // Prisma findFirst vrne prvo aktivno vrstico — trap hrani vrstni red vstavljanja,
    // zato seedamo samo konfigurirano lokacijo (prazna lokacija je pokrita zgoraj)
    seedConfiguredLocation()

    const result = await getFursConfig(undefined)

    expect(result.source).toBe('location')
    expect(result.locationId).toBe(LOC_OK)
    expect(state.captured.locationFindFirst).toHaveLength(1)
    expect(state.captured.settingsFindFirst).toHaveLength(0)
  })
})

// ============================================
// 2. buildFursConfigFromSettings — Location-only cert polja
// ============================================
describe('buildFursConfigFromSettings — R125 Location-only cert polja', () => {
  it('Location cert polja se uporabijo; settings.furs* se ignorirajo', async () => {
    seedConfiguredLocation()
    // Polna legacy settings vrstica (širši tip = kompatibilen klicatelj < R125)
    const legacySettings = {
      businessId: 'SET-BIZ',
      taxId: 'SET-TAX',
      registerNumber: 'SET-REG',
      fursCertPath: '/settings/legacy-cert.p12',
      fursCertPassword: 'legacy-pass',
      fursEnvironment: 'production',
    }

    const config = await buildFursConfigFromSettings(legacySettings, LOC_OK)

    // cert polja IZ Location (ne iz settings!)
    expect(config.certPath).toBe('/certs/loc.p12')
    expect(config.certPassword).toBe('loc-pass')
    expect(config.premisesId).toBe('PREM-LOC')
    expect(config.environment).toBe('test')
    // poslovna identiteta: Location override (P0-C3A semantika ohranjena)
    expect(config.businessId).toBe('LOC-BIZ')
    expect(config.taxId).toBe('SI-LOC-TAX')
  })

  it('settings.furs* vrednosti so IGINORIRANE tudi ko je locationId manjka (dokaz popravka)', async () => {
    const legacySettings = {
      businessId: 'SET-BIZ',
      taxId: 'SET-TAX',
      registerNumber: 'SET-REG',
      fursCertPath: '/settings/legacy-cert.p12',
      fursCertPassword: 'legacy-pass',
      fursEnvironment: 'production',
    }

    const config = await buildFursConfigFromSettings(legacySettings, null)

    // Prej (R124-): certPath bi bil '/settings/legacy-cert.p12' + environment 'production'
    expect(config.certPath).toBeUndefined()
    expect(config.certPassword).toBeUndefined()
    expect(config.premisesId).toBe('')
    expect(config.environment).toBe('test') // NE 'production'
    // poslovna identiteta ŠE VEDNO iz settings (ni del issue #37)
    expect(config.businessId).toBe('SET-BIZ')
    expect(config.taxId).toBe('SET-TAX')
    expect(config.registerId).toBe('SET-REG')
  })

  it('Location ne obstaja → cert polja PRAZNA, identiteta pade na settings', async () => {
    const legacySettings = {
      businessId: 'SET-BIZ',
      taxId: 'SET-TAX',
      registerNumber: 'SET-REG',
      fursCertPath: '/settings/legacy-cert.p12',
      fursCertPassword: 'legacy-pass',
      fursEnvironment: 'production',
    }

    const config = await buildFursConfigFromSettings(legacySettings, LOC_MISSING)

    expect(config.certPath).toBeUndefined()
    expect(config.certPassword).toBeUndefined()
    expect(config.premisesId).toBe('')
    // identiteta: settings fallback ohranjen (business polja niso del duplikata)
    expect(config.businessId).toBe('SET-BIZ')
    expect(state.captured.locationFindUnique[0]?.where?.id).toBe(LOC_MISSING)
  })
})

// ============================================
// 3. PUT /api/settings — legacy furs polja so stripana
// ============================================
describe('PUT /api/settings — R125 strip legacy furs polj', () => {
  it('fursCertPath/fursCertPassword/fursEnvironment v body se NE persistirajo (update path)', async () => {
    seedLegacySettings()
    mockSuperAdmin()

    const res = await settingsPUT(jsonReq('http://localhost:3000/api/settings', 'PUT', {
      name: 'Nova nastavitev',
      fursCertPath: '/hack/cert.p12',
      fursCertPassword: '••••••',
      fursEnvironment: 'production',
    }))

    expect(res.status).toBe(200)
    expect(state.captured.settingsUpdate).toHaveLength(1)
    const data = state.captured.settingsUpdate[0].data
    expect(data.name).toBe('Nova nastavitev')
    // R125 dokaz: furs polj NI v update payloadu (legacy klient = varno ignoriran)
    expect('fursCertPath' in data).toBe(false)
    expect('fursCertPassword' in data).toBe(false)
    expect('fursEnvironment' in data).toBe(false)
    // DB vrstica ohrani legacy vrednost (NETAKNJENO — read-only echo)
    expect(state.settingsRows[0].fursCertPath).toBe('/settings/legacy-cert.p12')
  })

  it('maskiran legacy echo ostane v odgovoru (deprecated read-only)', async () => {
    seedLegacySettings()
    mockSuperAdmin()

    const res = await settingsPUT(jsonReq('http://localhost:3000/api/settings', 'PUT', { name: 'X' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.fursCertPath).toBe('••••••')
    expect(body.fursCertPassword).toBe('••••••')
    expect(body.hasFursCert).toBe(true)
    // geslo se ne leak-a
    expect(JSON.stringify(body)).not.toContain('legacy-pass')
  })

  it('create path: furs polj NI v create payloadu (DB defaulti)', async () => {
    mockSuperAdmin() // settingsRows prazni → create path

    const res = await settingsPUT(jsonReq('http://localhost:3000/api/settings', 'PUT', {
      name: 'Prva',
      fursCertPath: '/x/cert.p12',
      fursCertPassword: 'geslo',
      fursEnvironment: 'production',
    }))

    expect(res.status).toBe(200)
    expect(state.captured.settingsCreate).toHaveLength(1)
    const data = state.captured.settingsCreate[0].data
    expect(data.name).toBe('Prva')
    expect('fursCertPath' in data).toBe(false)
    expect('fursCertPassword' in data).toBe(false)
    expect('fursEnvironment' in data).toBe(false)
  })
})

// ============================================
// 4. GET /api/locations — hasFursCert flag
// ============================================
describe('GET /api/locations — R125 hasFursCert flag', () => {
  it('seznam: hasFursCert true za konfigurirano, false za prazno; maskiranje ostane', async () => {
    seedConfiguredLocation()
    seedEmptyLocation()
    mockSuperAdmin() // super-admin: brez location pina

    const res = await locationsGET(new Request('http://localhost:3000/api/locations'))
    expect(res.status).toBe(200)
    const body = await res.json()

    const ok = body.locations.find((l: { id: string }) => l.id === LOC_OK)
    const empty = body.locations.find((l: { id: string }) => l.id === LOC_EMPTY)
    expect(ok.hasFursCert).toBe(true)
    expect(empty.hasFursCert).toBe(false)
    // maskiranje NETAKNJENO (R86 Security fix ostaja)
    expect(ok.fursCertPassword).toBe('****')
    expect(ok.fursCertPath).toBe('****')
    expect(JSON.stringify(body)).not.toContain('loc-pass')
    expect(JSON.stringify(body)).not.toContain('/certs/loc.p12')
  })

  it('[id]: hasFursCert true + todayStats; maskirana gesla', async () => {
    seedConfiguredLocation()
    mockSuperAdmin()

    const res = await locationByIdGET(
      new Request(`http://localhost:3000/api/locations/${LOC_OK}`),
      { params: Promise.resolve({ id: LOC_OK }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.hasFursCert).toBe(true)
    expect(body.fursCertPassword).toBe('****')
    expect(body.todayStats).toBeDefined()
  })

  it('[id]: hasFursCert false za prazno lokacijo', async () => {
    seedEmptyLocation()
    mockSuperAdmin()

    const res = await locationByIdGET(
      new Request(`http://localhost:3000/api/locations/${LOC_EMPTY}`),
      { params: Promise.resolve({ id: LOC_EMPTY }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.hasFursCert).toBe(false)
  })
})
