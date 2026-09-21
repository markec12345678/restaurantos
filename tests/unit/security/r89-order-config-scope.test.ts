// ============================================
// R89-3 — order-config token gating — regresijski testi
// ============================================
// Zapira zadnjo anonimno enumeracijsko površino (R88 backlog): GET
// /api/public/order-config je VRNIL vse aktivne lokacije VSEH tenantov
// (imena, kode, naslovi, isOpen) vsakemu anonimnemu klicatelju.
//
// NOVO vedenje (R89, fail-closed brez oraklja):
//   1. brez (?locationId= ALI ?locationCode=) IN ?t= → ISTA prazna
//      konfiguracija (200, requiresToken: true) — ZERO db klicev;
//   2. neznana / neaktivna lokacija → ISTA prazna konfiguracija (ni
//      obstoja-oraklja; findFirst točno 1×);
//   3. neveljaven / tamperiran / tuj / zastarel (tokenVersion) token → ISTA
//      prazna konfiguracija; cone/urniki/nastavitve se NE poizvedo;
//   4. veljaven token → config SAMO za to lokacijo (ena lokacija z
//      locationId izjemo, requiresToken: false, scoped where pin-i);
//   5. produkcija brez HMAC skrivnosti → prazna konfiguracija (graceful
//      empty, NE 503 — bralni GET ne sme strgati javnega UI-ja s 5xx).
//
// Vzorec (r88-online-order-token): vi.hoisted mocki, REALEN lib
// ordering-token (dev fallback skrivnost v test okolju) — tokeni so kovani
// z ISTIM virom kot jih preverja ruta. mockResolvedValue (nikoli .Once).
// ============================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  locationFindFirst: vi.fn(),
  deliveryZoneFindMany: vi.fn(),
  openingHoursFindMany: vi.fn(),
  settingsFindFirst: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    location: { findFirst: mocks.locationFindFirst },
    deliveryZone: { findMany: mocks.deliveryZoneFindMany },
    openingHours: { findMany: mocks.openingHoursFindMany },
    restaurantSettings: { findFirst: mocks.settingsFindFirst },
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.checkRateLimit,
  getClientIp: vi.fn(() => '1.2.3.4'),
  ORDER_CONFIG_LIMIT: { maxRequests: 20, windowMs: 60000 },
}))

// handleApiError: mockan (r88 vzorec) — srečna pot ga nikoli ne doseže
vi.mock('@/lib/api-utils', () => ({
  handleApiError: vi.fn(() => new Response(JSON.stringify({ error: 'Napaka' }), { status: 500, headers: { 'content-type': 'application/json' } })),
}))

// Route import (PO mockih)
import { GET as orderConfigGET } from '@/app/api/public/order-config/route'
import { orderingTokenFor } from '@/lib/ordering-token'

// Location id MORA ustrezati LOCATION_ID_RE /^[a-zA-Z0-9_-]{5,50}$/
const LOC_A = 'locTenantA'
const LOC_OTHER = 'locOther99'
const LOC_CODE = 'LJU'

/** Eksaktna prazna konfiguracija (pin oblike — R89 kanon, vedno 200). */
const EMPTY_CONFIG = {
  locations: [],
  selectedLocationCode: null,
  deliveryZones: [],
  isOpenNow: false,
  weeklyHours: [],
  settings: null,
  requiresToken: true,
  locationId: null,
}

/** Veljavna lokacijska vrstica (select iz rute — vključno s tokenVersion). */
function locationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: LOC_A,
    name: 'Restavracija A',
    code: LOC_CODE,
    address: 'Cesta 1',
    city: 'Ljubljana',
    phone: '040123456',
    isOpen: true,
    latitude: 46.05,
    longitude: 14.5,
    tokenVersion: 0,
    ...overrides,
  }
}

function makeReq(query: string) {
  return new Request(`http://x/api/public/order-config${query}`)
}

/** Skupni assert: eksaktna prazna konfiguracija (200, fail-closed oblika). */
async function expectEmptyConfig(res: Response) {
  expect(res.status).toBe(200)
  const body = await res.json()
  expect(body).toEqual(EMPTY_CONFIG)
}

/** Assert: cone/urniki/nastavitve se NISO poizvedeni (zavrnitev pred scope-om). */
function expectNoScopedQueries() {
  expect(mocks.deliveryZoneFindMany).not.toHaveBeenCalled()
  expect(mocks.openingHoursFindMany).not.toHaveBeenCalled()
  expect(mocks.settingsFindFirst).not.toHaveBeenCalled()
}

/** ZERO db: manjkajoč kontekst / produkcija brez skrivnosti — tudi lokacija se NE išče. */
async function expectEmptyZeroDb(res: Response) {
  await expectEmptyConfig(res)
  expect(mocks.locationFindFirst).not.toHaveBeenCalled()
  expectNoScopedQueries()
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.checkRateLimit.mockResolvedValue({ allowed: true, retryAfterMs: 60000 })
  mocks.locationFindFirst.mockResolvedValue(locationRow())
  mocks.deliveryZoneFindMany.mockResolvedValue([
    {
      name: 'Cona center', deliveryFee: 2.5, minOrderAmount: 10, freeDeliveryAbove: 30,
      estimatedMinutes: 30, locationId: LOC_A, isActive: true, sortOrder: 0,
    },
  ])
  mocks.openingHoursFindMany.mockResolvedValue([])
  mocks.settingsFindFirst.mockResolvedValue({
    name: 'Restavracija A', address: 'Cesta 1', city: 'Ljubljana', phone: '040123456', currency: 'EUR',
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

// ══════════════════════════════════════════════════════════════════
// A. Manjkajoč kontekst → 200 prazna konfiguracija + ZERO db klicev
// ══════════════════════════════════════════════════════════════════
describe('R89 A: manjkajoč kontekst → prazna konfiguracija, ZERO db', () => {
  it('goli klic (brez vseh parametrov) → 200 prazna konfiguracija + ZERO db', async () => {
    await expectEmptyZeroDb(await orderConfigGET(makeReq('')))
  })

  it('locationId brez tokena → prazna konfiguracija + ZERO db', async () => {
    await expectEmptyZeroDb(await orderConfigGET(makeReq(`?locationId=${LOC_A}`)))
  })

  it('token brez lokacije → prazna konfiguracija + ZERO db (EITHER missing)', async () => {
    await expectEmptyZeroDb(await orderConfigGET(makeReq(`?t=${orderingTokenFor(LOC_A)}`)))
  })

  it('legacy locationCode brez tokena → prazna konfiguracija + ZERO db', async () => {
    await expectEmptyZeroDb(await orderConfigGET(makeReq(`?locationCode=${LOC_CODE}`)))
  })
})

// ══════════════════════════════════════════════════════════════════
// B. Neznana lokacija → ISTA prazna konfiguracija (ni obstoja-oraklja)
// ══════════════════════════════════════════════════════════════════
describe('R89 B: neznana lokacija → isti prazen odgovor', () => {
  it('token za neznano lokacijo → ISTA prazna konfiguracija; findFirst točno 1×', async () => {
    mocks.locationFindFirst.mockResolvedValue(null)
    await expectEmptyConfig(await orderConfigGET(makeReq(`?locationId=locghost99&t=${orderingTokenFor('locghost99')}`)))
    expectNoScopedQueries()
    // točno ena iskalna poizvedba (ni findMany enumeracije, ni dodatnih klicev)
    expect(mocks.locationFindFirst).toHaveBeenCalledTimes(1)
    expect(mocks.locationFindFirst).toHaveBeenCalledWith({
      where: { id: 'locghost99', isActive: true },
      select: expect.objectContaining({ id: true, tokenVersion: true }),
    })
  })
})

// ══════════════════════════════════════════════════════════════════
// C. Neveljaven / tuj token → prazna konfiguracija, cone/urniki NE poizvedeni
// ══════════════════════════════════════════════════════════════════
describe('R89 C: neveljaven token → prazna konfiguracija', () => {
  it('tamperiran token (pravilen format, napačen MAC) → prazna konfiguracija', async () => {
    await expectEmptyConfig(await orderConfigGET(makeReq(`?locationId=${LOC_A}&t=v1:0:${'f'.repeat(64)}`)))
    // lokacija je bila sicer resolvana — vendar brez nadaljnjih poizvedb
    expect(mocks.locationFindFirst).toHaveBeenCalledTimes(1)
    expectNoScopedQueries()
  })

  it('token TUJE lokacije → ISTA prazna konfiguracija (ni razlike "tuj" vs "slab")', async () => {
    await expectEmptyConfig(await orderConfigGET(makeReq(`?locationId=${LOC_A}&t=${orderingTokenFor(LOC_OTHER)}`)))
    expectNoScopedQueries()
  })
})

// ══════════════════════════════════════════════════════════════════
// D. Veljaven token → 200, config scoped na TOČNO TO lokacijo
// ══════════════════════════════════════════════════════════════════
describe('R89 D: veljaven token → polna konfiguracija ene lokacije', () => {
  it('orderingTokenFor(LOC_A) → 200: ena lokacija z locationId, requiresToken false, scoped where pin-i', async () => {
    const res = await orderConfigGET(makeReq(`?locationId=${LOC_A}&t=${orderingTokenFor(LOC_A)}`))
    expect(res.status).toBe(200)
    const body = await res.json() as {
      locations: { locationId: string; code: string; name: string; address: string; city: string; isOpen: boolean; phone?: string; latitude?: number; longitude?: number; id?: string }[]
      selectedLocationCode: string
      deliveryZones: { name: string; deliveryFee: number; minOrderAmount: number; freeDeliveryAbove: number; estimatedMinutes: number; locationCode: string }[]
      isOpenNow: boolean
      weeklyHours: unknown[]
      settings: { name: string; currency: string } | null
      requiresToken: boolean
      locationId: string
    }
    // ENA lokacija — konec enumeracije; entry nosi locationId (R89 izjema)
    expect(body.locations).toHaveLength(1)
    expect(body.locations[0]).toEqual({
      locationId: LOC_A, code: LOC_CODE, name: 'Restavracija A', address: 'Cesta 1', city: 'Ljubljana', isOpen: true,
    })
    // FIX HIGH pin: telefon, koordinate in surov id NIKOLI v javnem odgovoru
    expect(body.locations[0]).not.toHaveProperty('phone')
    expect(body.locations[0]).not.toHaveProperty('latitude')
    expect(body.locations[0]).not.toHaveProperty('longitude')
    expect(body.locations[0]).not.toHaveProperty('id')
    // metapodatki token-gatinga
    expect(body.requiresToken).toBe(false)
    expect(body.locationId).toBe(LOC_A)
    expect(body.selectedLocationCode).toBe(LOC_CODE)
    // cone scoped na ciljno lokacijo (pin točne where oblike)
    expect(mocks.deliveryZoneFindMany).toHaveBeenCalledWith({
      where: { isActive: true, locationId: LOC_A },
      orderBy: { sortOrder: 'asc' },
    })
    expect(body.deliveryZones).toEqual([
      { name: 'Cona center', deliveryFee: 2.5, minOrderAmount: 10, freeDeliveryAbove: 30, estimatedMinutes: 30, locationCode: LOC_CODE },
    ])
    // urnik scoped na ciljno lokacijo
    expect(mocks.openingHoursFindMany).toHaveBeenCalledWith({
      where: { locationId: LOC_A },
      orderBy: { dayOfWeek: 'asc' },
    })
    // nastavitve + 7 dni urnika + privzeto odprto (prazen urnik → true)
    expect(mocks.settingsFindFirst).toHaveBeenCalledTimes(1)
    expect(body.settings).toEqual({ name: 'Restavracija A', address: 'Cesta 1', city: 'Ljubljana', currency: 'EUR' })
    expect(body.settings).not.toHaveProperty('phone')
    expect(body.isOpenNow).toBe(true)
    expect(body.weeklyHours).toHaveLength(7)
  })

  it('locationId IN locationCode skupaj → prioritetni locationId (id veja)', async () => {
    await orderConfigGET(makeReq(`?locationId=${LOC_A}&locationCode=OTHER&t=${orderingTokenFor(LOC_A)}`))
    expect(mocks.locationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: LOC_A, isActive: true } }),
    )
    const whereArg = mocks.locationFindFirst.mock.calls[0][0].where as Record<string, unknown>
    expect(whereArg).not.toHaveProperty('code')
  })
})

// ══════════════════════════════════════════════════════════════════
// E. tokenVersion vezava (R89-1 kanon) — revokacija zastarelih tokenov
// ══════════════════════════════════════════════════════════════════
describe('R89 E: tokenVersion vezava', () => {
  it('token verzije 0 + lokacija tokenVersion 1 → prazna konfiguracija (zastarel)', async () => {
    mocks.locationFindFirst.mockResolvedValue(locationRow({ tokenVersion: 1 }))
    await expectEmptyConfig(await orderConfigGET(makeReq(`?locationId=${LOC_A}&t=${orderingTokenFor(LOC_A)}`)))
    expectNoScopedQueries()
  })

  it('token verzije 1 + lokacija tokenVersion 1 → veljavna konfiguracija (pozitivna kontrola)', async () => {
    mocks.locationFindFirst.mockResolvedValue(locationRow({ tokenVersion: 1 }))
    const res = await orderConfigGET(makeReq(`?locationId=${LOC_A}&t=${orderingTokenFor(LOC_A, 1)}`))
    expect(res.status).toBe(200)
    const body = await res.json() as { requiresToken: boolean; locationId: string }
    expect(body.requiresToken).toBe(false)
    expect(body.locationId).toBe(LOC_A)
  })
})

// ══════════════════════════════════════════════════════════════════
// F. Legacy ?locationCode= + veljaven token → resolve po kodi
// ══════════════════════════════════════════════════════════════════
describe('R89 F: legacy locationCode param', () => {
  it('?locationCode= + veljaven token za to kodo → polna konfiguracija', async () => {
    const res = await orderConfigGET(makeReq(`?locationCode=${LOC_CODE}&t=${orderingTokenFor(LOC_A)}`))
    expect(res.status).toBe(200)
    // resolve po KODI (id veja ni bila uporabljena)
    expect(mocks.locationFindFirst).toHaveBeenCalledTimes(1)
    expect(mocks.locationFindFirst).toHaveBeenCalledWith({
      where: { code: LOC_CODE, isActive: true },
      select: expect.objectContaining({ id: true, tokenVersion: true }),
    })
    const body = await res.json() as { requiresToken: boolean; locationId: string; selectedLocationCode: string }
    expect(body.requiresToken).toBe(false)
    expect(body.locationId).toBe(LOC_A)
    expect(body.selectedLocationCode).toBe(LOC_CODE)
  })
})

// ══════════════════════════════════════════════════════════════════
// G. Produkcija brez skrivnosti → prazna konfiguracija (graceful, NE 503)
// ══════════════════════════════════════════════════════════════════
describe('R89 G: produkcija brez ORDERING_TOKEN_SECRET', () => {
  it('NODE_ENV=production brez skrivnosti → 200 prazna konfiguracija + ZERO db (tudi z "veljavnim" tokenom)', async () => {
    // token kovan PRED preklopom okolja (v test fallback okolju)
    const devToken = orderingTokenFor(LOC_A)
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ORDERING_TOKEN_SECRET', '')
    vi.stubEnv('QR_PAY_SECRET', '')
    vi.stubEnv('ENCRYPTION_KEY', '')
    vi.stubEnv('NEXTAUTH_SECRET', '')
    const res = await orderConfigGET(makeReq(`?locationId=${LOC_A}&t=${devToken}`))
    // NE 503: bralni GET config ne sme strgati javnega UI-ja s 5xx
    await expectEmptyZeroDb(res)
  })
})
