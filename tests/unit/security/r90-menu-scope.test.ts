// ============================================
// R90-1 — MENU/KIOSK READ FALLBACK IZKORENJEN (P0-C3B kanon zaprt)
// ============================================
// Zapira ZADNJI anonimni globalni READ fallback (R89-FINAL backlog točka;
// R90-0 odločitev: meni/kiosk ostajata tokenless — meni je javen podatek po
// naravi — ampak fallback je IZKORENJEN, izrecen ?locationId je OBVEZEN).
//
//   public/menu   — prej: brez ?locationId → location.findFirst({ isActive:
//                   true }, orderBy createdAt asc) = PRVA AKTIVNA LOKACIJA
//                   KATEREGA KOLI TENANTA → njen meni/settings/mize. Tudi:
//                   neznana/neaktivna locationId → prazen meni + settings
//                   (nabava obstoja-oraklja).
//   public/kiosk  — prej: brez ?locationId → resolveDefaultLocationId() READ
//                   fallback (isti cross-tenant problem; POST je bil
//                   fail-closed že od R86-3). 'Kiosk ni nastavljen' 400 pot
//                   za manjkajoč GET parameter odstranjena.
//   verify-table  — +locationId v select + odgovor (kontrakt za R90-2:
//                   QR meni stran potrebuje lokacijo mize za scoped menu
//                   fetch; nosilec QR kode že pozna lokal — ni skrivnost).
//   lib/counters  — resolveDefaultLocationId REMOVED (zadnji klicočel je
//                   bil kiosk GET; p1-data-model P1-6 blok odstranjen).
//
// NOVO vedenje (kanon):
//   menu GET:  manjkajoč/whitespace ?locationId → notInScopeResponse('Lokacija')
//              404 z ZERO db klici; neveljavna oblika (regex /^[a-z0-9]{5,50}$/i,
//              isti razred kot kiosk) → isti 404, še vedno ZERO db; neznana/
//              tuja/neaktivna → findFirst({ id, isActive: true }) ×1 → ISTI 404
//              (ni obstoja-oraklja); veljaven → meni/settings/mize scoped na
//              TOČNO TO lokacijo, odgovorna oblika nespremenjena
//              { menus, settings, availableTables, timestamp } + cache/ETag.
//   kiosk GET: isti kanon (manjkajoč → 404 ZERO db; regex → findFirst aktiven).
//   verify-table: { exists: true, tableNumber, locationId }.
//
// Vzorec (r86-public-scope — TOČNO TE rute): vi.hoisted + vi.mock;
// @/lib/tenant-scope NI mockan (REALEN notInScopeResponse); cache-headers
// REALEN (ETag/Cache-Control pini); mockResolvedValue (nikoli .Once);
// ZERO-db asserti na zgodnjih zavrnitvah; where/select pini.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  locationFindFirst: vi.fn(),
  menuFindMany: vi.fn(),
  tableFindMany: vi.fn(),
  tableFindUnique: vi.fn(),
  getRestaurantInfo: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    location: { findFirst: mocks.locationFindFirst },
    menu: { findMany: mocks.menuFindMany },
    table: { findMany: mocks.tableFindMany, findUnique: mocks.tableFindUnique },
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.checkRateLimit,
  getClientIp: vi.fn(() => '1.2.3.4'),
  PUBLIC_MENU_LIMIT: { maxRequests: 30, windowMs: 60000 },
  KIOSK_LIMIT: { maxRequests: 10, windowMs: 60000 },
  VERIFY_TABLE_LIMIT: { maxRequests: 10, windowMs: 60000 },
}))

vi.mock('@/lib/api-utils', () => ({
  parseJsonBody: vi.fn(async (req: Request) => ({ data: await req.json(), error: null })),
  handleApiError: vi.fn(() => new Response(JSON.stringify({ error: 'Napaka' }), { status: 500, headers: { 'content-type': 'application/json' } })),
}))

// FURS settings resolver mockan (sicer bi šel v location.findUnique +
// restaurantSettings — za te pine je dovolj, da je bil klican z pravim id-jem)
vi.mock('@/lib/furs/config-resolver', () => ({
  getRestaurantInfoForLocation: mocks.getRestaurantInfo,
}))

vi.mock('@/lib/decimal', () => ({
  toNum: vi.fn((v: unknown) => (typeof v === 'object' && v !== null && 'toNumber' in (v as object) ? (v as { toNumber: () => number }).toNumber() : Number(v ?? 0))),
}))

vi.mock('@/lib/safe-format', () => ({
  formatEUR: vi.fn((v: string) => `${v} €`),
}))

vi.mock('@/app/api/orders/_helpers/order-items', () => ({
  buildOrderItemsData: vi.fn(() => ({ orderItemsData: [], subtotal: 0 })),
  calculateOrderTotals: vi.fn(() => ({ totalTax: 0, total: 0 })),
  fetchModifierPriceMap: vi.fn(async () => new Map()),
}))

// Route imports (PO mockih)
import { GET as menuGET } from '@/app/api/public/menu/route'
import { GET as kioskGET } from '@/app/api/public/kiosk/route'
import { GET as verifyTableGET } from '@/app/api/public/verify-table/route'
import { CachePresets } from '@/lib/middleware/cache-headers'

// Id-ji MORAJO ustrezati regex obliki /^[a-z0-9]{5,50}$/i (brez vezajev) —
// ruti validirata obliko PREJ kot DB poizvedbo.
const LOC_A = 'locTenantA'
const LOC_GHOST = 'locghost99'
const TABLE_ID = 'tblAbc12345'

const MENU_FIXTURE = [
  {
    id: 'menu-1', name: 'Glavni meni', icon: '🍽️', color: '#ff0000', sortOrder: 1,
    categories: [{
      id: 'cat-1', name: 'Jedi', icon: null, color: null, sortOrder: 1,
      menuItems: [{ id: 'mi-1', name: 'Kava', description: '', price: 2, vatRate: 22, allergens: [], image: null, sortOrder: 1, modifierGroups: [] }],
    }],
  },
]

function expectNotInScopeBody(body: unknown) {
  const b = body as { error?: string }
  expect(b.error).toBe('Lokacija ni najden')
  // notInScopeResponse kanon: SAMO error polje (ni detajlov, ni oracle meta)
  expect(Object.keys(b)).toEqual(['error'])
}

/** ZERO-db pin za menu GET zgodnje zavrnitve (prej: first-active lookup). */
function expectZeroMenuDb() {
  expect(mocks.locationFindFirst).not.toHaveBeenCalled()
  expect(mocks.menuFindMany).not.toHaveBeenCalled()
  expect(mocks.tableFindMany).not.toHaveBeenCalled()
  expect(mocks.getRestaurantInfo).not.toHaveBeenCalled()
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.checkRateLimit.mockResolvedValue({ allowed: true, retryAfterMs: 60000 })
  mocks.locationFindFirst.mockResolvedValue({ id: LOC_A })
  mocks.menuFindMany.mockResolvedValue(MENU_FIXTURE)
  mocks.tableFindMany.mockResolvedValue([{ id: 'tbl1', number: 5, capacity: 4 }])
  mocks.tableFindUnique.mockResolvedValue({ id: TABLE_ID, number: 7, status: 'available', locationId: LOC_A })
  mocks.getRestaurantInfo.mockResolvedValue({
    locationId: LOC_A, name: 'Restavracija A', address: 'Ulica 1', phone: '+386 1 234 5678',
    currency: 'EUR', locale: 'sl',
  })
})

// ══════════════════════════════════════════════════════════════════
// A. MENU GET — manjkajoč ?locationId → 404 + ZERO db (P0-C3B zaprt)
// ══════════════════════════════════════════════════════════════════
describe('R90 A: GET /api/public/menu — manjkajoč ?locationId', () => {
  it('brez ?locationId → 404 notInScopeResponse oblika (ni več "No active location" 400)', async () => {
    const res = await menuGET(new Request('http://x/api/public/menu'))
    expect(res.status).toBe(404)
    expectNotInScopeBody(await res.json())
  })

  it('brez ?locationId → ZERO db klici (ni first-active lookupa, ni menija, ni miz, ni settings)', async () => {
    await menuGET(new Request('http://x/api/public/menu'))
    expectZeroMenuDb()
  })

  it('whitespace-only ?locationId → 404 + ZERO db (trim kanon)', async () => {
    const res = await menuGET(new Request('http://x/api/public/menu?locationId=%20%20'))
    expect(res.status).toBe(404)
    expectNotInScopeBody(await res.json())
    expectZeroMenuDb()
  })

  it('rate limiting še vedno prvi: 429 pred kakršno koli obdelavo + ZERO db', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 30000 })
    const res = await menuGET(new Request('http://x/api/public/menu'))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeTruthy()
    expectZeroMenuDb()
  })
})

// ══════════════════════════════════════════════════════════════════
// B. MENU GET — neveljavna oblika → 404 + ZERO db (regex PRED db)
// ══════════════════════════════════════════════════════════════════
describe('R90 B: GET /api/public/menu — neveljavna oblika locationId', () => {
  it('prekratek ("ab") → 404 + ZERO db', async () => {
    const res = await menuGET(new Request('http://x/api/public/menu?locationId=ab'))
    expect(res.status).toBe(404)
    expectNotInScopeBody(await res.json())
    expectZeroMenuDb()
  })

  it('vezaj ("loc-tenant") → 404 + ZERO db (regex brez vezajev, kot kiosk)', async () => {
    const res = await menuGET(new Request('http://x/api/public/menu?locationId=loc-tenant'))
    expect(res.status).toBe(404)
    expectZeroMenuDb()
  })

  it('predolg (51 znakov) → 404 + ZERO db', async () => {
    const res = await menuGET(new Request(`http://x/api/public/menu?locationId=${'a'.repeat(51)}`))
    expect(res.status).toBe(404)
    expectZeroMenuDb()
  })

  it('ne-ASCII znaki ("lokacijač") → 404 + ZERO db', async () => {
    const res = await menuGET(new Request('http://x/api/public/menu?locationId=lokacija%C4%8D'))
    expect(res.status).toBe(404)
    expectZeroMenuDb()
  })
})

// ══════════════════════════════════════════════════════════════════
// C. MENU GET — neznana/neaktivna lokacija → unificiran 404 (ni oraklja)
// ══════════════════════════════════════════════════════════════════
describe('R90 C: GET /api/public/menu — neznana / neaktivna lokacija', () => {
  it('neznan locationId → 404 + findFirst TOČNO 1× (where pin { id, isActive: true }) + meni NI poizveden', async () => {
    mocks.locationFindFirst.mockResolvedValue(null)
    const res = await menuGET(new Request(`http://x/api/public/menu?locationId=${LOC_GHOST}`))
    expect(res.status).toBe(404)
    expect(mocks.locationFindFirst).toHaveBeenCalledTimes(1)
    expect(mocks.locationFindFirst.mock.calls[0][0].where).toEqual({ id: LOC_GHOST, isActive: true })
    expect(mocks.menuFindMany).not.toHaveBeenCalled()
    expect(mocks.tableFindMany).not.toHaveBeenCalled()
    expect(mocks.getRestaurantInfo).not.toHaveBeenCalled()
  })

  it('neznana lokacija → ISTI error body kot neveljavna oblika (ni obstoja-oraklja)', async () => {
    mocks.locationFindFirst.mockResolvedValue(null)
    const unknown = await menuGET(new Request(`http://x/api/public/menu?locationId=${LOC_GHOST}`))
    const malformed = await menuGET(new Request('http://x/api/public/menu?locationId=ab'))
    expect(await unknown.json()).toEqual(await malformed.json())
  })

  it('neaktivna lokacija → ISTI 404 (isActive filter v where — ni posebne poti)', async () => {
    // findFirst({ id, isActive: true }) vrne null za neaktivno vrstico
    mocks.locationFindFirst.mockResolvedValue(null)
    const res = await menuGET(new Request('http://x/api/public/menu?locationId=locInactive1'))
    expect(res.status).toBe(404)
    expectNotInScopeBody(await res.json())
    expect(mocks.locationFindFirst.mock.calls[0][0].where.isActive).toBe(true)
    expect(mocks.menuFindMany).not.toHaveBeenCalled()
  })

  it('findFirst select pin: minimalen { id: true } (ni uhajanja imen/nastavitev v validaciji)', async () => {
    await menuGET(new Request(`http://x/api/public/menu?locationId=${LOC_A}`))
    expect(mocks.locationFindFirst.mock.calls[0][0].select).toEqual({ id: true })
  })
})

// ══════════════════════════════════════════════════════════════════
// D. MENU GET — uspešna pot: scoped + oblika odgovora NESPREMENJENA
// ══════════════════════════════════════════════════════════════════
describe('R90 D: GET /api/public/menu — veljaven locationId (scoped success)', () => {
  it('200 + settings prisoten (ime/id = lokacija) + availableTables count', async () => {
    const res = await menuGET(new Request(`http://x/api/public/menu?locationId=${LOC_A}`))
    expect(res.status).toBe(200)
    const body = await res.json() as { menus: unknown[]; settings: { id: string; name: string }; availableTables: number }
    expect(body.menus).toHaveLength(1)
    expect(body.settings.name).toBe('Restavracija A')
    expect(body.settings.id).toBe(LOC_A)
    expect(body.availableTables).toBe(1)
  })

  it('menus findMany where pin: { isActive: true, locationId } + orderBy sortOrder', async () => {
    await menuGET(new Request(`http://x/api/public/menu?locationId=${LOC_A}`))
    const q = mocks.menuFindMany.mock.calls[0][0]
    expect(q.where).toEqual({ isActive: true, locationId: LOC_A })
    expect(q.orderBy).toEqual({ sortOrder: 'asc' })
  })

  it('mize scoped na lokacijo: where { status: available, locationId }', async () => {
    await menuGET(new Request(`http://x/api/public/menu?locationId=${LOC_A}`))
    expect(mocks.tableFindMany.mock.calls[0][0].where).toEqual({ status: 'available', locationId: LOC_A })
  })

  it('settings resolver pozvan TOČNO z locationId iz queryja', async () => {
    await menuGET(new Request(`http://x/api/public/menu?locationId=${LOC_A}`))
    expect(mocks.getRestaurantInfo).toHaveBeenCalledTimes(1)
    expect(mocks.getRestaurantInfo).toHaveBeenCalledWith(LOC_A)
  })

  it('odgovorna oblika byte-kompatibilna: točno ključi availableTables/menus/settings/timestamp', async () => {
    const res = await menuGET(new Request(`http://x/api/public/menu?locationId=${LOC_A}`))
    const body = await res.json() as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual(['availableTables', 'menus', 'settings', 'timestamp'])
    expect(typeof body.timestamp).toBe('string')
  })

  it('settings oblika pinned (id/name/address/phone/email/web/currency/locale/country=SI)', async () => {
    const res = await menuGET(new Request(`http://x/api/public/menu?locationId=${LOC_A}`))
    const body = await res.json() as { settings: Record<string, unknown> }
    expect(Object.keys(body.settings).sort()).toEqual(
      ['address', 'country', 'currency', 'email', 'id', 'locale', 'name', 'phone', 'web']
    )
    expect(body.settings.country).toBe('SI')
    expect(body.settings.currency).toBe('EUR')
  })

  it('Cache-Control header še vedno aplikiran (PUBLIC_SHORT preset)', async () => {
    const res = await menuGET(new Request(`http://x/api/public/menu?locationId=${LOC_A}`))
    expect(res.headers.get('Cache-Control')).toBe(CachePresets.PUBLIC_SHORT)
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=300, stale-while-revalidate=3600')
  })

  it('ETag še vedno aplikiran (quoted hash) + If-None-Match match → 304 Not Modified', async () => {
    const res = await menuGET(new Request(`http://x/api/public/menu?locationId=${LOC_A}`))
    const etag = res.headers.get('ETag')
    expect(etag).toBeTruthy()
    expect(etag).toMatch(/^"[0-9a-f]+"$/)
    // 304 pot: klicatelj z ujemajočim If-None-Match dobi prazno 304
    const res304 = await menuGET(new Request(`http://x/api/public/menu?locationId=${LOC_A}`, { headers: { 'if-none-match': '*' } }))
    expect(res304.status).toBe(304)
  })
})

// ══════════════════════════════════════════════════════════════════
// E. KIOSK GET — isti kanon (manjkajoč → 404 ZERO db; regex → findFirst)
// ══════════════════════════════════════════════════════════════════
describe('R90 E: GET /api/public/kiosk — read fallback izkoreninjen', () => {
  it('brez ?locationId → 404 notInScopeResponse + ZERO db (resolveDefaultLocationId pot MRTVA)', async () => {
    const res = await kioskGET(new Request('http://x/api/public/kiosk'))
    expect(res.status).toBe(404)
    expectNotInScopeBody(await res.json())
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
    expect(mocks.menuFindMany).not.toHaveBeenCalled()
  })

  it('neveljavna oblika ("ab") → 404 + ZERO db', async () => {
    const res = await kioskGET(new Request('http://x/api/public/kiosk?locationId=ab'))
    expect(res.status).toBe(404)
    expectNotInScopeBody(await res.json())
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
    expect(mocks.menuFindMany).not.toHaveBeenCalled()
  })

  it('whitespace-only → 404 + ZERO db (trim)', async () => {
    const res = await kioskGET(new Request('http://x/api/public/kiosk?locationId=%20'))
    expect(res.status).toBe(404)
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
    expect(mocks.menuFindMany).not.toHaveBeenCalled()
  })

  it('neznan locationId → 404 + findFirst where pin { id, isActive: true } + meni NI poizveden', async () => {
    mocks.locationFindFirst.mockResolvedValue(null)
    const res = await kioskGET(new Request(`http://x/api/public/kiosk?locationId=${LOC_GHOST}`))
    expect(res.status).toBe(404)
    expectNotInScopeBody(await res.json())
    expect(mocks.locationFindFirst.mock.calls[0][0].where).toEqual({ id: LOC_GHOST, isActive: true })
    expect(mocks.menuFindMany).not.toHaveBeenCalled()
  })

  it('veljaven ?locationId → 200 + meni scoped { isActive: true, locationId } + oblika { menus }', async () => {
    const res = await kioskGET(new Request(`http://x/api/public/kiosk?locationId=${LOC_A}`))
    expect(res.status).toBe(200)
    const body = await res.json() as { menus: unknown[] }
    expect(Object.keys(body)).toEqual(['menus'])
    expect(body.menus).toHaveLength(1)
    const q = mocks.menuFindMany.mock.calls[0][0]
    expect(q.where).toEqual({ isActive: true, locationId: LOC_A })
    expect(q.orderBy).toEqual({ sortOrder: 'asc' })
  })
})

// ══════════════════════════════════════════════════════════════════
// F. VERIFY-TABLE — R90-2 kontrakt: odgovor nosi locationId mize
// ══════════════════════════════════════════════════════════════════
describe('R90 F: GET /api/public/verify-table — locationId v odgovoru', () => {
  it('uspeh: { exists: true, tableNumber, locationId } (kontrakt za R90-2 QR meni fetch)', async () => {
    const res = await verifyTableGET(new Request(`http://x/api/public/verify-table?tableId=${TABLE_ID}`))
    expect(res.status).toBe(200)
    const body = await res.json() as { exists: boolean; tableNumber: number; locationId: string; status?: string }
    expect(body.exists).toBe(true)
    expect(body.tableNumber).toBe(7)
    expect(body.locationId).toBe(LOC_A)
    // status NIKOLI ne uhaja (nespremenjen FIX LOW kanon)
    expect(body.status).toBeUndefined()
  })

  it('findUnique select pin: vsebuje locationId (poleg id/number/status)', async () => {
    await verifyTableGET(new Request(`http://x/api/public/verify-table?tableId=${TABLE_ID}`))
    expect(mocks.tableFindUnique.mock.calls[0][0]).toEqual({
      where: { id: TABLE_ID },
      select: { id: true, number: true, status: true, locationId: true },
    })
  })

  it('neznana miza → { exists: false } (nespremenjeno, ni oraklja/status uhajanja)', async () => {
    mocks.tableFindUnique.mockResolvedValue(null)
    const res = await verifyTableGET(new Request(`http://x/api/public/verify-table?tableId=${TABLE_ID}`))
    expect(res.status).toBe(200)
    const body = await res.json() as { exists: boolean; locationId?: string }
    expect(body.exists).toBe(false)
    expect(body.locationId).toBeUndefined()
  })

  it('manjkajoč tableId → 400 { exists: false } (nespremenjeno)', async () => {
    const res = await verifyTableGET(new Request('http://x/api/public/verify-table'))
    expect(res.status).toBe(400)
    const body = await res.json() as { exists: boolean }
    expect(body.exists).toBe(false)
  })
})
