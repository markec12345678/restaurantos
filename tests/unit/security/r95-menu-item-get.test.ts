// ============================================
// R95-d — GET /api/menu-items/[id] (R94 backlog (c))
// ============================================
// Ruta je izvažala LE PUT/DELETE (GET = 405 — e2e MENU-3 forenzika R94).
// Nov GET handler = kanon pariteta s PUT/DELETE:
//   - requireAuth manage_inventory,
//   - REALNI tenant resolver resolveTenantLocationIdOrThrow (NI mockan),
//   - scoped filter (Category → Menu → locationId), super-admin (null) = brez,
//   - enoten 404 'Menu item not found' (zero obstoja-orakelj),
//   - deepToNumbers odgovor (mirror PUT).
// Hišni vzorec r86-c1: vi.hoisted + mock db/requireAuth, REALNI resolver.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  menuItemFindFirst: vi.fn(),
}))

vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: mocks.requireAuth,
}))

vi.mock('@/lib/db', () => ({
  db: {
    menuItem: { findFirst: mocks.menuItemFindFirst },
  },
}))

// '@/lib/tenant-scope' NI mockan — realni resolver (r86-c1 kanon)

import { GET } from '@/app/api/menu-items/[id]/route'
import { resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'

const makeReq = (url = 'http://localhost/api/menu-items/mi-1') =>
  new Request(url, { method: 'GET' })

const params = (id = 'mi-1') => ({ params: Promise.resolve({ id }) })

describe('R95-d: GET /api/menu-items/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('A1: neavtenticen → vrne authResult.error in NE kliče resolverja/db', async () => {
    const errRes = Response.json({ error: 'Unauthorized' }, { status: 401 })
    mocks.requireAuth.mockResolvedValue({ error: errRes })

    const res = await GET(makeReq(), params())

    expect(res).toBe(errRes)
    expect(mocks.menuItemFindFirst).not.toHaveBeenCalled()
    expect(mocks.requireAuth).toHaveBeenCalledWith(
      expect.anything(),
      { permission: 'manage_inventory' },
    )
  })

  it('A2: resolver napaka (non-admin brez lokacije) → 403 in ZERO db klicev', async () => {
    mocks.requireAuth.mockResolvedValue({
      session: { employeeId: 'emp-1', role: 'staff', locationId: null, permissions: ['manage_inventory'] },
    })

    const res = await GET(makeReq(), params())

    expect(res.status).toBe(403)
    expect(mocks.menuItemFindFirst).not.toHaveBeenCalled()
  })

  it('B1: scoped admin → where pina verigo Category → Menu → locationId', async () => {
    mocks.requireAuth.mockResolvedValue({
      session: { employeeId: 'emp-1', role: 'admin', locationId: 'loc-1', permissions: ['manage_inventory'] },
    })
    mocks.menuItemFindFirst.mockResolvedValue({
      id: 'mi-1',
      name: 'Pizza',
      // DecimalLike (Prisma.Decimal vzorec — deepToNumbers pretvarja samo objekte s toNumber)
      price: { toNumber: () => 9.5 },
      category: { menu: { id: 'menu-1', name: 'Glavni', locationId: 'loc-1' } },
      modifierGroups: [],
    })

    const res = await GET(makeReq(), params())
    const body = await res.json()

    expect(res.status).toBe(200)
    // Exact where: id + scoped filter skozi category.menu.locationId
    expect(mocks.menuItemFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'mi-1',
          category: { menu: { locationId: 'loc-1' } },
        },
      }),
    )
    // Include pini: category + modifierGroups z sortOrder orderBy
    const call = mocks.menuItemFindFirst.mock.calls[0][0]
    expect(call.include.category.include.menu.select).toEqual({ id: true, name: true })
    expect(call.include.modifierGroups.orderBy).toEqual({ sortOrder: 'asc' })
    // deepToNumbers: string Decimal → number (mirror PUT kontrakt)
    expect(body.price).toBe(9.5)
    expect(typeof body.price).toBe('number')
  })

  it('B2: super-admin (null scope) → PRAZEN filter, NIKOLI { locationId: null }', async () => {
    mocks.requireAuth.mockResolvedValue({
      session: { employeeId: 'sa-1', role: 'super_admin', locationId: null, permissions: ['manage_inventory'] },
    })
    mocks.menuItemFindFirst.mockResolvedValue({ id: 'mi-2', name: 'Burger', price: { toNumber: () => 8 }, category: { menu: {} }, modifierGroups: [] })

    const res = await GET(makeReq('http://localhost/api/menu-items/mi-2'), params('mi-2'))

    expect(res.status).toBe(200)
    expect(mocks.menuItemFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'mi-2' } }),
    )
  })

  it('C1: neznana id → enoten 404 "Menu item not found" (zero orakelj, isti string kot PUT/DELETE)', async () => {
    mocks.requireAuth.mockResolvedValue({
      session: { employeeId: 'emp-1', role: 'admin', locationId: 'loc-1', permissions: ['manage_inventory'] },
    })
    mocks.menuItemFindFirst.mockResolvedValue(null)

    const res = await GET(makeReq(), params())

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Menu item not found')
  })

  it('C2: TUJ artikel (druga lokacija) → ISTI 404 (scoped filter ga ne najde)', async () => {
    mocks.requireAuth.mockResolvedValue({
      session: { employeeId: 'emp-1', role: 'admin', locationId: 'loc-1', permissions: ['manage_inventory'] },
    })
    mocks.menuItemFindFirst.mockResolvedValue(null)

    const res = await GET(makeReq(), params())

    // Isti odgovor kot C1 — ni razlike med neznano in tujim (no oracle)
    expect(res.status).toBe(404)
  })

  it('D: realni resolver je v igri (NI mockan) — sanity pin', () => {
    expect(typeof resolveTenantLocationIdOrThrow).toBe('function')
  })
})
