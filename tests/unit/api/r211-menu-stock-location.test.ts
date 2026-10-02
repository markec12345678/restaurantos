// ============================================
// #152 G1 (R211) — POS MENU-STOCK LOCATION SCOPE
// ============================================
// Vrzel G1 (docs/INVENTORY-CHAIN.md §5): GET /api/inventory/menu-stock je
// klical computeMenuStockMap() BREZ scope-a — P1-7 kanon
// @@unique([menuItemId, locationId]) pomeni, da je multi-lokacijski tenant
// na POS indikatorjih lahko videl zalogo NAPAČNE lokacije (last-writer-wins).
//
// FIX (R211): route posreduje session.locationId (P1-7 Employee lokacija)
// → direktna pot lokacijsko filtrirana (mirror deduct-direct.ts); super-admin
// brez dodeljene lokacije (locationId null) → vidi celoten tenant
// (obnašanje nespremenjeno, back-compat).
//
// Kanon vir: tests/unit/lib/menu-availability.test.ts (#152 G1 describe) —
// tukaj ROUTE-nivo: scope se posreduje iz session-a, permisije se ne spreminjajo
// (R124 OR permisija ostane).
import { describe, it, expect, vi, beforeEach } from 'vitest'

const m = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  computeMenuStockMap: vi.fn(),
}))

vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: (...args: unknown[]) => m.requireAuth(...args),
}))

vi.mock('@/lib/availability/menu-availability', () => ({
  computeMenuStockMap: (...args: unknown[]) => m.computeMenuStockMap(...args),
}))

import { GET } from '@/app/api/inventory/menu-stock/route'

function authOk(locationId: string | null) {
  return {
    session: { locationId },
    error: null,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  m.requireAuth.mockResolvedValue(authOk('loc-1'))
  m.computeMenuStockMap.mockResolvedValue({})
})

describe('GET /api/inventory/menu-stock — location scope (#152 G1, R211)', () => {
  it('posreduje session.locationId v computeMenuStockMap (P1-7 mirror deduct-direct)', async () => {
    const res = await GET(new Request('http://localhost:3000/api/inventory/menu-stock'))
    expect(res.status).toBe(200)
    expect(m.requireAuth).toHaveBeenCalledTimes(1)
    expect(m.computeMenuStockMap).toHaveBeenCalledTimes(1)
    expect(m.computeMenuStockMap).toHaveBeenCalledWith({ locationId: 'loc-1' })
  })

  it('super-admin brez dodeljene lokacije (null) → locationId undefined → brez filtra (back-compat)', async () => {
    m.requireAuth.mockResolvedValue(authOk(null))
    await GET(new Request('http://localhost:3000/api/inventory/menu-stock'))
    expect(m.computeMenuStockMap).toHaveBeenCalledWith({ locationId: undefined })
  })

  it('R124 OR permisija ostane (take_orders ALI manage_inventory)', async () => {
    await GET(new Request('http://localhost:3000/api/inventory/menu-stock'))
    const opts = m.requireAuth.mock.calls[0]?.[1] as { permission?: string[] }
    expect(opts?.permission).toEqual(['take_orders', 'manage_inventory'])
  })

  it('requireAuth napaka → passthrough (pisalni kanon nespremenjen)', async () => {
    const errRes = new Response(JSON.stringify({ error: '401' }), { status: 401 })
    m.requireAuth.mockResolvedValue({ session: null, error: errRes })
    const res = await GET(new Request('http://localhost:3000/api/inventory/menu-stock'))
    expect(res.status).toBe(401)
    expect(m.computeMenuStockMap).not.toHaveBeenCalled()
  })
})
