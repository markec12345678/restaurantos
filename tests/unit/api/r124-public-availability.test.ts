// ============================================
// R124 / EPIC #115 P0-03 — PUBLIC REAL-TIME AVAILABILITY ENDPOINT
// ============================================
// GET /api/public/availability?locationId=... — no-store endpoint za
// sold-out propagation v realnem času (QR meni polla vsakih ~30 s).
//
// Pokritje (R90 fail-closed kanon + minimalni javni payload):
//  • Rate limit: checkRateLimitAsync('public-availability', ip, PUBLIC_MENU_LIMIT)
//    → 429 + ZERO db, ko limit ne preide
//  • manjkajoč locationId → 404 (notInScopeResponse) + location.findFirst NI poklican
//  • neveljaven format (/^[a-z0-9]{5,50}$/i) → 404 + ZERO db klicev
//  • neznana ALI neaktivna lokacija → isti 404 (ni obstoja-oraklja)
//  • uspeh: scope = id-ji isAvailable artiklov aktivnih menijev lokacije →
//    computeMenuStockMap({ menuItemIds }) → { availability: { [id]:
//    { stockStatus, stockAvailable } }, timestamp } + Cache-Control no-store
//  • prazen scope (brez menijev / noben artikel isAvailable) → availability {}
//    BREZ availability računa + še vedno no-store
//
// Trap DB (hišni stil R119–R124): vi.mock('@/lib/db') z getter + vi.hoisted
// ref; mockani SAMO mejni moduli (rate-limit, computeMenuStockMap — kanon
// pokrit v tests/unit/lib/menu-availability.test.ts). notInScopeResponse in
// handleApiError sta REALNA (404/500 semantika zares).
import { describe, it, expect, vi, beforeEach } from 'vitest'

const LOC_1 = 'loc0001'
const MENU_1 = 'menu-1'
const CAT_1 = 'cat-1'
const MI_TRACKED = 'mi-tracked-out'
const MI_UNTRACKED = 'mi-untracked'
const MI_HIDDEN = 'mi-hidden'

// ---------- Vrstice ----------
interface LocationRow { id: string; isActive: boolean }
interface MenuRow { id: string; isActive: boolean; locationId: string }
interface CategoryRow { id: string; menuId: string }
interface MenuItemRow { id: string; isAvailable: boolean; categoryId: string }

function createDb() {
  const locations: LocationRow[] = []
  const menus: MenuRow[] = []
  const categories: CategoryRow[] = []
  const menuItems: MenuItemRow[] = []

  // Zajem klicev — dokaz ZERO db na fail-closed poteh + where kanon
  const captured = {
    locationFindFirst: [] as unknown[],
    menuFindMany: [] as Array<{ where?: { isActive?: boolean; locationId?: string } }>,
  }

  const clients = {
    location: {
      findFirst: async ({ where }: { where?: { id?: string; isActive?: boolean } }) => {
        captured.locationFindFirst.push(where ?? {})
        const row = locations.find(l =>
          (where?.id === undefined || l.id === where.id) &&
          (where?.isActive === undefined || l.isActive === where.isActive))
        return row ? { id: row.id } : null
      },
    },
    menu: {
      // nested select iz route: categories → menuItems (where isAvailable) → id
      findMany: async (args: {
        where?: { isActive?: boolean; locationId?: string }
        select?: {
          categories?: {
            select?: {
              menuItems?: {
                where?: { isAvailable?: boolean }
                select?: { id?: boolean }
              }
            }
          }
        }
      }) => {
        captured.menuFindMany.push(args)
        const wantAvailable = args.select?.categories?.select?.menuItems?.where?.isAvailable
        return menus
          .filter(m =>
            (args.where?.isActive === undefined || m.isActive === args.where.isActive) &&
            (args.where?.locationId === undefined || m.locationId === args.where.locationId))
          .map(m => ({
            // select: samo categories (route rabi izključno id-je artiklov)
            categories: categories
              .filter(c => c.menuId === m.id)
              .map(c => ({
                id: c.id,
                menuItems: menuItems
                  .filter(mi => mi.categoryId === c.id && (wantAvailable === undefined || mi.isAvailable === wantAvailable))
                  .map(mi => ({ id: mi.id })),
              })),
          }))
      },
    },
  }

  return { db: clients, locations, menus, categories, menuItems, captured }
}

// vi.hoisted — mock factory se izvede PRED modulskim scope-om (hišni stil)
const ref = vi.hoisted(() => ({ current: null as unknown as ReturnType<typeof createDb> }))
ref.current = createDb()

const m = vi.hoisted(() => ({
  checkRateLimitAsync: vi.fn(),
  computeMenuStockMap: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  get db() {
    return ref.current.db
  },
}))

// Rate-limit je mejni modul — privzeto dovoli; posamezni testi preglasi.
// PUBLIC_MENU_LIMIT uvažamo nazaj iz mockanega modula za assert klica.
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: (...args: unknown[]) => m.checkRateLimitAsync(...args),
  checkRateLimit: () => ({ allowed: true, remaining: 10 }),
  getClientIp: () => '127.0.0.1',
  PUBLIC_MENU_LIMIT: { maxRequests: 30, windowMs: 60000 },
  AUTHENTICATED_LIMIT: { maxRequests: 120, windowMs: 60000 },
}))
vi.mock('@/lib/rate-limit/response', () => ({
  rateLimitedResponse: (retryAfterMs: number, _msg?: string) =>
    new Response(JSON.stringify({ error: 'Preveč zahtevkov.', retryAfterMs }), { status: 429 }),
}))

// Availability kanon je pokrit v tests/unit/lib/menu-availability.test.ts —
// tukaj mockamo mapo in testiramo ROUTE mapping + scope + no-store kanon.
vi.mock('@/lib/availability/menu-availability', () => ({
  computeMenuStockMap: (...args: unknown[]) => m.computeMenuStockMap(...args),
}))

import { GET } from '@/app/api/public/availability/route'
import { PUBLIC_MENU_LIMIT } from '@/lib/rate-limit'

const state = ref.current

// ---------- Helperji ----------
function resetState() {
  state.locations.length = 0
  state.menus.length = 0
  state.categories.length = 0
  state.menuItems.length = 0
  state.captured.locationFindFirst.length = 0
  state.captured.menuFindMany.length = 0
}

function seedLocation(id: string, isActive = true) {
  state.locations.push({ id, isActive })
}

function seedMenuTree(opts: { menuId?: string; items: Array<{ id: string; isAvailable?: boolean }> }) {
  const menuId = opts.menuId ?? MENU_1
  state.menus.push({ id: menuId, isActive: true, locationId: LOC_1 })
  state.categories.push({ id: CAT_1, menuId })
  for (const item of opts.items) {
    state.menuItems.push({ id: item.id, isAvailable: item.isAvailable ?? true, categoryId: CAT_1 })
  }
}

const url = (query = '') => `http://localhost:3000/api/public/availability${query}`

beforeEach(() => {
  vi.clearAllMocks()
  resetState()
  m.checkRateLimitAsync.mockResolvedValue({ allowed: true, remaining: 29 })
  m.computeMenuStockMap.mockResolvedValue({})
})

// ============================================
// FAIL-CLOSED VHODNA VALIDACIJA (R90 kanon)
// ============================================
describe('GET /api/public/availability — fail-closed vhodna validacija', () => {
  it('manjkajoč locationId → 404 + location.findFirst NI poklican', async () => {
    const res = await GET(new Request(url()))
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toBe('Lokacija ni najden') // notInScopeResponse kanon
    expect(state.captured.locationFindFirst).toHaveLength(0)
    expect(m.computeMenuStockMap).not.toHaveBeenCalled()
  })

  it('neveljaven format locationId ("x!!") → 404 + ZERO db klicev', async () => {
    const res = await GET(new Request(url('?locationId=x!!')))
    expect(res.status).toBe(404)
    expect(state.captured.locationFindFirst).toHaveLength(0)
    expect(state.captured.menuFindMany).toHaveLength(0)
    expect(m.computeMenuStockMap).not.toHaveBeenCalled()
  })

  it('neznan locationId (veljaven format) → 404, samo location lookup, brez menijev', async () => {
    const res = await GET(new Request(url('?locationId=zzzz9')))
    expect(res.status).toBe(404)
    expect(state.captured.locationFindFirst).toHaveLength(1)
    expect(state.captured.locationFindFirst[0]).toEqual({ id: 'zzzz9', isActive: true })
    expect(state.captured.menuFindMany).toHaveLength(0)
    expect(m.computeMenuStockMap).not.toHaveBeenCalled()
  })

  it('neaktivna lokacija → isti 404 (brez uhajanja podatkov)', async () => {
    seedLocation(LOC_1, false)
    const res = await GET(new Request(url(`?locationId=${LOC_1}`)))
    expect(res.status).toBe(404)
    expect(state.captured.menuFindMany).toHaveLength(0)
    expect(m.computeMenuStockMap).not.toHaveBeenCalled()
  })

  it('rate limit ne preide → 429 + ZERO db klicev', async () => {
    m.checkRateLimitAsync.mockResolvedValueOnce({ allowed: false, retryAfterMs: 5000 })
    const res = await GET(new Request(url(`?locationId=${LOC_1}`)))
    expect(res.status).toBe(429)
    expect(state.captured.locationFindFirst).toHaveLength(0)
    expect(state.captured.menuFindMany).toHaveLength(0)
    expect(m.computeMenuStockMap).not.toHaveBeenCalled()
  })
})

// ============================================
// USPEŠNA POT — payload, scope, no-store
// ============================================
describe('GET /api/public/availability — uspešna pot', () => {
  it('sleden out + ne-sleden: availability vsebuje SAMO sledenega; no-store + timestamp', async () => {
    seedLocation(LOC_1)
    seedMenuTree({ items: [{ id: MI_TRACKED }, { id: MI_UNTRACKED }] })
    // computeMenuStockMap: sleden artikel je 'out', ne-sleden NI v mapi
    m.computeMenuStockMap.mockResolvedValue({
      [MI_TRACKED]: { status: 'out', available: 0, unit: 'kg', source: 'recipe' },
    })

    const res = await GET(new Request(url(`?locationId=${LOC_1}`)))
    expect(res.status).toBe(200)
    const data = await res.json()

    // ne-sleden artikel ni v mapi → tudi ni v availability (vedno na voljo)
    expect(Object.keys(data.availability)).toEqual([MI_TRACKED])
    expect(data.availability[MI_TRACKED]).toEqual({ stockStatus: 'out', stockAvailable: 0 })

    // no-store kanon: zaloga je realno-časovna (meni ostane cachean posebej)
    expect(res.headers.get('Cache-Control')).toBe('no-store')

    // timestamp je ISO string
    expect(typeof data.timestamp).toBe('string')
    expect(Number.isNaN(Date.parse(data.timestamp))).toBe(false)

    // scope: computeMenuStockMap dobi id-je VSEH isAvailable artiklov lokacije
    expect(m.computeMenuStockMap).toHaveBeenCalledTimes(1)
    expect(m.computeMenuStockMap).toHaveBeenCalledWith({
      menuItemIds: [MI_TRACKED, MI_UNTRACKED],
    })

    // db kanon: lokacija MORA obstajati in biti aktivna; meniji po lokaciji
    expect(state.captured.locationFindFirst[0]).toEqual({ id: LOC_1, isActive: true })
    expect(state.captured.menuFindMany[0].where).toEqual({ isActive: true, locationId: LOC_1 })
  })

  it('isAvailable=false artikel NI v scope-u (menuItemIds)', async () => {
    seedLocation(LOC_1)
    seedMenuTree({ items: [{ id: MI_TRACKED }, { id: MI_HIDDEN, isAvailable: false }] })

    const res = await GET(new Request(url(`?locationId=${LOC_1}`)))
    expect(res.status).toBe(200)
    expect(m.computeMenuStockMap).toHaveBeenCalledWith({ menuItemIds: [MI_TRACKED] })
  })

  it('rate-limit kanon: klican z ("public-availability", ip, PUBLIC_MENU_LIMIT)', async () => {
    seedLocation(LOC_1)
    await GET(new Request(url(`?locationId=${LOC_1}`)))
    expect(m.checkRateLimitAsync).toHaveBeenCalledTimes(1)
    expect(m.checkRateLimitAsync).toHaveBeenCalledWith('public-availability', '127.0.0.1', PUBLIC_MENU_LIMIT)
  })

  it('whitespace locationId se trimma (veljaven id preide validacijo)', async () => {
    seedLocation(LOC_1)
    const res = await GET(new Request(url(`?locationId=${encodeURIComponent('  ' + LOC_1 + '  ')}`)))
    expect(res.status).toBe(200)
    expect(state.captured.locationFindFirst[0]).toEqual({ id: LOC_1, isActive: true })
  })
})

// ============================================
// PRAZEN SCOPE — brez availability računa, še vedno no-store
// ============================================
describe('GET /api/public/availability — prazen scope', () => {
  it('lokacija brez menijev → availability {} + computeMenuStockMap NI poklican', async () => {
    seedLocation(LOC_1)
    const res = await GET(new Request(url(`?locationId=${LOC_1}`)))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.availability).toEqual({})
    expect(m.computeMenuStockMap).not.toHaveBeenCalled()
  })

  it('prazen scope: Cache-Control no-store + timestamp prisoten', async () => {
    seedLocation(LOC_1)
    const res = await GET(new Request(url(`?locationId=${LOC_1}`)))
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    const data = await res.json()
    expect(typeof data.timestamp).toBe('string')
    expect(Number.isNaN(Date.parse(data.timestamp))).toBe(false)
  })

  it('meni obstaja, noben artikel ni isAvailable → {} brez računa (nested where)', async () => {
    seedLocation(LOC_1)
    seedMenuTree({ items: [{ id: MI_HIDDEN, isAvailable: false }] })
    const res = await GET(new Request(url(`?locationId=${LOC_1}`)))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.availability).toEqual({})
    expect(m.computeMenuStockMap).not.toHaveBeenCalled()
  })
})
