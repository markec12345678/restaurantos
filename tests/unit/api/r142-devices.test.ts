// ============================================
// R142-b — P0-#29 DEVICE CENTER (epic #115) — trap-DB uniti
// ============================================
// Vzorec r141-briefing / r140-feedback-resolution (vi.hoisted +
// vi.mock('@/lib/db') + vi.mock('@/lib/auth-middleware') z importOriginal
// spreadom — requireAuth na meji, tenant resolverji REALNI). Pokritje:
//
//   GET /api/devices (R142-b upgrade):
//    1. whitelist enforcement — findMany select vsebuje SAMO DEVICE_SELECT
//       ključe (brez employee/PII polj), location omejen na { name, code }
//    2. Cache-Control: no-store
//    3. rate-limit 429 (bucket 'devices-list', pred auth, zero DB)
//    4. scope filter — lokacijski admin → where.locationId; super-admin → {}
//    5. isOnline izračunan iz lastSeenAt (5-min pravilnik; <1min → true,
//       10min → false, null → false) + sweep write-on-GET ODSTRANJEN
//
//   PATCH /api/devices/[id] (NOVO):
//    6. 401 fail-closed (requireAuth napaka passthrough, zero DB)
//    7. 404 zero-oracle — tuja naprava (locationId ≠ session lokacija)
//    8. 404 neobstoječ id — ISTI body kot 7 (ni enumeracije)
//    9. super-admin rename — 200 + audit DEVICE_UPDATE (v tx) + no-store
//   10. lokacijski admin pošlje locationId → 403 fail-closed (tudi lastna!)
//   11. super-admin reassign na neaktivno/neobstoječo lokacijo → 400
//   12. prazen body (brez name in locationId) → 400
//   13. Zod: ime prazno / 201 znakov → 400
//   14. payload NIKOLI ne vsebuje status/lastSeenAt/deviceId (klient domena)
//   15. no-op locationId = trenutna → 200 brez update in brez audita
// ============================================
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const LOC_A = 'loc-tenant-a'
const LOC_B = 'loc-tenant-b'

const mocks = vi.hoisted(() => ({
  // deviceRegistry
  deviceFindMany: vi.fn(),
  deviceFindUnique: vi.fn(),
  deviceUpdateMany: vi.fn(),
  // location (validacija ciljne lokacije)
  locationFindUnique: vi.fn(),
  // infra
  requireAuth: vi.fn(),
  createAuditLog: vi.fn(),
  checkRateLimitAsync: vi.fn(),
}))

vi.mock('@/lib/db', () => {
  // $transaction passthrough na ISTI mock objekt (tx.deviceRegistry deluje)
  const dbMock = {
    deviceRegistry: {
      findMany: mocks.deviceFindMany,
      findUnique: mocks.deviceFindUnique,
      updateMany: mocks.deviceUpdateMany,
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    location: { findUnique: mocks.locationFindUnique },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(dbMock)),
  }
  return { db: dbMock, createAuditLog: mocks.createAuditLog }
})

// requireAuth mockan na meji; tenant resolverji ostanejo REALNI (r141 kanon)
vi.mock('@/lib/auth-middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-middleware')>()
  return {
    ...actual,
    requireAuth: mocks.requireAuth,
  }
})

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.checkRateLimitAsync,
  getClientIp: vi.fn(() => '203.0.113.7'),
  AUTHENTICATED_LIMIT: { maxRequests: 120, windowMs: 60_000 },
}))

vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

import { GET as devicesGET } from '@/app/api/devices/route'
import { PATCH as devicesPatch } from '@/app/api/devices/[id]/route'

// ---------- Fixture tipi + helperji ----------

interface DeviceRow {
  id: string
  deviceId: string
  name: string
  type: string
  status: string
  lastSeenAt: Date | null
  appVersion: string
  locationId: string | null
  location: { name: string; code: string } | null
}

function deviceRow(overrides: Partial<DeviceRow> = {}): DeviceRow {
  return {
    id: 'dev-1',
    deviceId: 'HW-POS-001',
    name: 'POS-1',
    type: 'pos',
    status: 'online',
    lastSeenAt: new Date(),
    appVersion: '1.4.2',
    locationId: LOC_A,
    location: { name: 'Glavna poslovalnica', code: 'HQ' },
    ...overrides,
  }
}

interface SessionOverrides {
  role?: string
  locationId?: string | null
  permissions?: string[]
}

function session(overrides: SessionOverrides = {}) {
  return {
    token: 'tok-1',
    employeeId: 'emp-1',
    role: 'admin',
    permissions: ['admin'],
    locationId: LOC_A,
    createdAt: Date.now(),
    expiresAt: Date.now() + 3_600_000,
    absoluteExpiry: Date.now() + 86_400_000,
    ...overrides,
  }
}

const locAdminSession = () => session()
const superAdminSession = () => session({ role: 'super_admin', locationId: null })

function getReq(url = 'http://localhost:3000/api/devices') {
  return new Request(url, { method: 'GET' })
}

function patchReq(body: unknown, id = 'dev-1') {
  return new NextRequest(`http://localhost:3000/api/devices/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

const unauthorized = () => ({
  session: null,
  error: new Response(JSON.stringify({ error: 'Avtentikacija je obvezna.' }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  }),
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuth.mockResolvedValue({ session: locAdminSession(), error: null })
  mocks.checkRateLimitAsync.mockResolvedValue({ allowed: true, retryAfterMs: 0 })
  mocks.deviceFindMany.mockResolvedValue([])
  mocks.deviceFindUnique.mockResolvedValue(null)
  mocks.deviceUpdateMany.mockResolvedValue({ count: 1 })
  mocks.locationFindUnique.mockResolvedValue({ id: LOC_B, isActive: true })
  mocks.createAuditLog.mockResolvedValue(undefined)
})

// ════════════════════════════════════════════════════════════════
// GET /api/devices
// ════════════════════════════════════════════════════════════════
describe('R142 GET /api/devices', () => {
  it('1. whitelist enforcement: findMany select vsebuje SAMO DEVICE_SELECT ključe (brez employee/PII)', async () => {
    mocks.deviceFindMany.mockResolvedValue([])
    const res = await devicesGET(getReq())
    expect(res.status).toBe(200)

    expect(mocks.deviceFindMany).toHaveBeenCalledTimes(1)
    const args = mocks.deviceFindMany.mock.calls[0][0]
    // TOČNO whitelist ključi (nič več — polne vrstice so prejšnja kršitev)
    expect(Object.keys(args.select).sort()).toEqual(
      ['appVersion', 'deviceId', 'id', 'lastSeenAt', 'location', 'locationId', 'name', 'status', 'type'].sort(),
    )
    // location relacija omejena na display polji (brez id/owner/PII stolpcev)
    expect(args.select.location).toEqual({ select: { name: true, code: true } })
    // obrambno: nikoli employee/PII relacij v poizvedbi
    const keys = Object.keys(args.select)
    expect(keys).not.toContain('employee')
    expect(keys).not.toContain('user')
    // orderBy kanon
    expect(args.orderBy).toEqual({ lastSeenAt: 'desc' })
  })

  it('2. no-store: Cache-Control: no-store na odgovoru', async () => {
    const res = await devicesGET(getReq())
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('3. rate-limit 429: bucket devices-list PRED auth, zero DB dotikov', async () => {
    mocks.checkRateLimitAsync.mockResolvedValue({ allowed: false, retryAfterMs: 45_000 })
    const res = await devicesGET(getReq())
    expect(res.status).toBe(429)
    expect(mocks.checkRateLimitAsync.mock.calls[0][0]).toBe('devices-list')
    expect(res.headers.get('Retry-After')).toBe('45')
    // rate limit pred requireAuth → brej seje se NIče dotakne baze
    expect(mocks.requireAuth).not.toHaveBeenCalled()
    expect(mocks.deviceFindMany).not.toHaveBeenCalled()
  })

  it('4. scope filter: lokacijski admin → where.locationId, super-admin → prazen where', async () => {
    // lokacijski admin (privzeti beforeEach session)
    await devicesGET(getReq(`http://localhost:3000/api/devices?locationId=${LOC_B}`))
    expect(mocks.deviceFindMany.mock.calls[0][0].where).toEqual({ locationId: LOC_A })

    // super-admin: globalni pogled (prazen filter, NIKOLI { locationId: null })
    mocks.requireAuth.mockResolvedValue({ session: superAdminSession(), error: null })
    await devicesGET(getReq())
    expect(mocks.deviceFindMany.mock.calls[1][0].where).toEqual({})
  })

  it('5. isOnline izračunan iz lastSeenAt (5-min pravilnik) + sweep write-on-GET odstranjen', async () => {
    const now = Date.now()
    mocks.deviceFindMany.mockResolvedValue([
      deviceRow({ id: 'dev-fresh', lastSeenAt: new Date(now - 60_000) }),
      deviceRow({ id: 'dev-stale', lastSeenAt: new Date(now - 10 * 60_000) }),
      deviceRow({ id: 'dev-never', lastSeenAt: null }),
    ])

    const res = await devicesGET(getReq())
    expect(res.status).toBe(200)
    const body = (await res.json()) as { devices: Array<DeviceRow & { isOnline: boolean }>; count: number }

    expect(body.count).toBe(3)
    const byId = new Map(body.devices.map((d) => [d.id, d]))
    expect(byId.get('dev-fresh')?.isOnline).toBe(true)
    expect(byId.get('dev-stale')?.isOnline).toBe(false)
    expect(byId.get('dev-never')?.isOnline).toBe(false)
    // DB status stolpec ostane v vrstici (klient domena, samo prebranan)
    expect(byId.get('dev-stale')?.status).toBe('online')
    // GET NE piše — sweep (updateMany) odstranjen
    expect(mocks.deviceUpdateMany).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════
// PATCH /api/devices/[id]
// ════════════════════════════════════════════════════════════════
describe('R142 PATCH /api/devices/[id] — auth + scope', () => {
  it('6. 401 fail-closed: requireAuth napaka passthrough, zero DB dotikov', async () => {
    mocks.requireAuth.mockResolvedValue(unauthorized())

    const res = await devicesPatch(patchReq({ name: 'Novo ime' }), ctx('dev-1'))

    expect(res.status).toBe(401)
    expect(mocks.requireAuth).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ permission: 'admin' }),
    )
    expect(mocks.deviceFindUnique).not.toHaveBeenCalled()
    expect(mocks.deviceUpdateMany).not.toHaveBeenCalled()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })

  it('7. 404 zero-oracle: tuja naprava (locationId ≠ session lokacija) → isto sporočilo kot 404', async () => {
    mocks.deviceFindUnique.mockResolvedValue({ id: 'dev-b', name: 'TUJA', locationId: LOC_B })

    const res = await devicesPatch(patchReq({ name: 'Prevzeto' }), ctx('dev-b'))

    expect(res.status).toBe(404)
    // notInScopeResponse kanon — template '{what} ni najden' (pariteta
    // feedback rute 'Povratna informacija ni najden'); zero-oracle: isti
    // body za tujo IN neobstojeco napravo.
    expect(await res.json()).toEqual({ error: 'Naprava ni najden' })
    expect(mocks.deviceUpdateMany).not.toHaveBeenCalled()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })

  it('8. 404 neobstoječ id — ISTI odgovor kot tuja naprava (ni enumeracije)', async () => {
    mocks.deviceFindUnique.mockResolvedValue(null)

    const res = await devicesPatch(patchReq({ name: 'Karkoli' }), ctx('dev-ne-obstaja'))

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Naprava ni najden' })
    expect(mocks.deviceUpdateMany).not.toHaveBeenCalled()
  })
})

describe('R142 PATCH /api/devices/[id] — happy path + audit', () => {
  it('9. super-admin rename: 200 + device (whitelist) + no-store + audit DEVICE_UPDATE v tx', async () => {
    mocks.requireAuth.mockResolvedValue({ session: superAdminSession(), error: null })
    // 1. klic = existing load (minimal select), 2. klic = tx read-back (DEVICE_SELECT)
    mocks.deviceFindUnique
      .mockResolvedValueOnce({ id: 'dev-1', name: 'Staro ime', locationId: LOC_A })
      .mockResolvedValue(deviceRow({ id: 'dev-1', name: 'Novo ime' }))
    mocks.deviceUpdateMany.mockResolvedValue({ count: 1 })

    const res = await devicesPatch(patchReq({ name: 'Novo ime' }), ctx('dev-1'))

    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    const body = (await res.json()) as { device: DeviceRow }
    expect(body.device.name).toBe('Novo ime')
    expect(body.device.deviceId).toBe('HW-POS-001')
    expect(body.device.location).toEqual({ name: 'Glavna poslovalnica', code: 'HQ' })

    // super-admin: where pin SAMO na id (brez locationId)
    const upd = mocks.deviceUpdateMany.mock.calls[0][0]
    expect(upd.where).toEqual({ id: 'dev-1' })
    expect(upd.data).toEqual({ name: 'Novo ime' })

    // audit: DEVICE_UPDATE, old→new, V tx (drugi argument = tx klient)
    expect(mocks.createAuditLog).toHaveBeenCalledTimes(1)
    const entry = mocks.createAuditLog.mock.calls[0][0]
    expect(entry.action).toBe('DEVICE_UPDATE')
    expect(entry.entityType).toBe('DeviceRegistry')
    expect(entry.entityId).toBe('dev-1')
    expect(entry.details).toEqual({ name: { before: 'Staro ime', after: 'Novo ime' } })
    expect(entry.userId).toBe('emp-1')
    expect(mocks.createAuditLog.mock.calls[0][1]).toBeDefined()
  })
})

describe('R142 PATCH /api/devices/[id] — locationId pravilnik', () => {
  it('10. lokacijski admin pošlje locationId → 403 fail-closed (tudi lastno lokacijo)', async () => {
    const resForeign = await devicesPatch(patchReq({ locationId: LOC_B }), ctx('dev-1'))
    expect(resForeign.status).toBe(403)

    // tudi lastna lokacija NI izjema — fail-closed, brej tihega ignoriranja
    const resOwn = await devicesPatch(patchReq({ locationId: LOC_A }), ctx('dev-1'))
    expect(resOwn.status).toBe(403)

    expect(mocks.deviceFindUnique).not.toHaveBeenCalled()
    expect(mocks.deviceUpdateMany).not.toHaveBeenCalled()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })

  it('11. super-admin reassign na neaktivno / neobstoječo lokacijo → 400, zero pisanja', async () => {
    mocks.requireAuth.mockResolvedValue({ session: superAdminSession(), error: null })
    mocks.deviceFindUnique.mockResolvedValue({ id: 'dev-1', name: 'POS-1', locationId: LOC_A })

    // neaktivna lokacija
    mocks.locationFindUnique.mockResolvedValue({ id: LOC_B, isActive: false })
    const resInactive = await devicesPatch(patchReq({ locationId: LOC_B }), ctx('dev-1'))
    expect(resInactive.status).toBe(400)

    // neobstoječa lokacija
    mocks.locationFindUnique.mockResolvedValue(null)
    const resMissing = await devicesPatch(patchReq({ locationId: 'loc-404' }), ctx('dev-1'))
    expect(resMissing.status).toBe(400)

    expect(mocks.deviceUpdateMany).not.toHaveBeenCalled()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })

  it('15. no-op: locationId = trenutna vrednost → 200 brez update in brez audita', async () => {
    mocks.requireAuth.mockResolvedValue({ session: superAdminSession(), error: null })
    mocks.deviceFindUnique.mockResolvedValue(deviceRow({ id: 'dev-1', locationId: LOC_A }))

    const res = await devicesPatch(patchReq({ locationId: LOC_A }), ctx('dev-1'))

    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    const body = (await res.json()) as { device: DeviceRow }
    expect(body.device.id).toBe('dev-1')
    expect(body.device.locationId).toBe(LOC_A)

    expect(mocks.locationFindUnique).not.toHaveBeenCalled()
    expect(mocks.deviceUpdateMany).not.toHaveBeenCalled()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })
})

describe('R142 PATCH /api/devices/[id] — validacija + payload whitelist', () => {
  it('12. prazen body (brez name in locationId) → 400 z validationErrors', async () => {
    const res = await devicesPatch(patchReq({}), ctx('dev-1'))

    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string; validationErrors: unknown }
    expect(body.error).toBe('Neveljavni podatki')
    expect(body.validationErrors).toBeDefined()
    expect(mocks.deviceFindUnique).not.toHaveBeenCalled()
    expect(mocks.deviceUpdateMany).not.toHaveBeenCalled()
  })

  it('13. Zod: ime prazno (whitespace) IN 201 znakov → 400', async () => {
    const resEmpty = await devicesPatch(patchReq({ name: '   ' }), ctx('dev-1'))
    expect(resEmpty.status).toBe(400)

    const resTooLong = await devicesPatch(patchReq({ name: 'x'.repeat(201) }), ctx('dev-1'))
    expect(resTooLong.status).toBe(400)

    expect(mocks.deviceFindUnique).not.toHaveBeenCalled()
    expect(mocks.deviceUpdateMany).not.toHaveBeenCalled()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })

  it('14. payload NIKOLI ne vsebuje status/lastSeenAt/deviceId (klient domena)', async () => {
    mocks.requireAuth.mockResolvedValue({ session: superAdminSession(), error: null })
    mocks.deviceFindUnique.mockResolvedValue({ id: 'dev-1', name: 'Staro', locationId: LOC_A })
    mocks.deviceUpdateMany.mockResolvedValue({ count: 1 })

    await devicesPatch(patchReq({ name: 'N', locationId: LOC_B }), ctx('dev-1'))

    expect(mocks.deviceUpdateMany).toHaveBeenCalledTimes(1)
    const data = mocks.deviceUpdateMany.mock.calls[0][0].data as Record<string, unknown>
    // točno whitelisted ključi
    expect(Object.keys(data).sort()).toEqual(['locationId', 'name'])
    expect(data).not.toHaveProperty('status')
    expect(data).not.toHaveProperty('lastSeenAt')
    expect(data).not.toHaveProperty('deviceId')
  })
})
