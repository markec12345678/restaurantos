// ============================================
// R118 / ISSUE #114 — POST /api/onboarding/starter-catalog ROUTE TESTI
// ============================================
// Pokrije:
//  • auth gate: brez seje → 401; permission 'admin' je obvezen
//  • tenant/location scope: seja lokacije je AVTORITATIVNA (locationId v
//    telesu je ignoriran za regular/admin-z-lokacijo) — issue #114 §7
//  • §8 zaščita obstoječega kataloga: artikli > 0 in brez confirm → 409
//    (count query mora biti SCOPE-AN na lokacijo — trap preveri where!)
//  • uspešna aplikacija → 200 + summary; applyStarterCatalog prejme pravilni
//    (scoped) locationId
//  • neveljaven venueType → 400
import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocki PRED importom route-a ---
const requireAuthMock = vi.fn()
const checkRateLimitAsyncMock = vi.fn()
const applyMock = vi.fn()

vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: (...args: unknown[]) => checkRateLimitAsyncMock(...args),
  getClientIp: () => '127.0.0.1',
  AUTHENTICATED_LIMIT: { maxRequests: 120, windowMs: 60000 },
}))
vi.mock('@/lib/rate-limit/response', () => ({
  rateLimitedResponse: () => new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 }),
}))

vi.mock('@/lib/onboarding/catalog-templates/apply-starter-catalog', () => ({
  applyStarterCatalog: (...args: unknown[]) => applyMock(...args),
}))

// Scope trap: obnaša se kot prava tenant-scope logika
//  - regular/admin z lokacijo: scope = session.locationId (body locationId IGNORIRAN)
//  - super-admin brez lokacije: scope = body.locationId
function makeAuth(session: { locationId?: string | null; role?: string } | null) {
  return { session, error: null }
}
vi.mock('@/lib/tenant-scope', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tenant-scope')>()
  return {
    ...actual,
    resolveCatalogScope: (authResult: { session?: { locationId?: string | null; role?: string } | null } | null | undefined) => {
      const session = authResult?.session
      if (!session) return { ok: false as const, response: new Response('401', { status: 401 }) }
      if (session.locationId) return { ok: true as const, scope: session.locationId }
      if (session.role === 'super-admin') return { ok: true as const, scope: null }
      return { ok: false as const, response: new Response('403', { status: 403 }) }
    },
  }
})

const menuItemCountMock = vi.fn()
vi.mock('@/lib/db', () => ({
  db: {
    menuItem: { count: (...args: unknown[]) => menuItemCountMock(...args) },
  },
}))

import { POST } from '@/app/api/onboarding/starter-catalog/route'

function post(body: unknown, authHeader?: string) {
  return new Request('http://localhost:3000/api/onboarding/starter-catalog', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(authHeader ? { Authorization: authHeader } : {}) },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  checkRateLimitAsyncMock.mockResolvedValue({ allowed: true, remaining: 5 })
})

// ============================================
// AUTH GATE
// ============================================
describe('POST /api/onboarding/starter-catalog — auth gate', () => {
  it('401 brez seje (fail-closed)', async () => {
    requireAuthMock.mockResolvedValue({ session: null, error: new Response('unauthorized', { status: 401 }) })
    const res = await POST(post({ venueType: 'pizzerija' }))
    expect(res.status).toBe(401)
    expect(applyMock).not.toHaveBeenCalled()
  })

  it('403 zaposleni brez lokacije (niti admin niti lokacija → fail-closed)', async () => {
    requireAuthMock.mockResolvedValue(makeAuth({ role: 'waiter', locationId: null }))
    const res = await POST(post({ venueType: 'pizzerija' }))
    expect(res.status).toBe(403)
    expect(applyMock).not.toHaveBeenCalled()
  })

  it('400 neveljaven venueType', async () => {
    requireAuthMock.mockResolvedValue(makeAuth({ role: 'admin', locationId: 'loc-1' }))
    const res = await POST(post({ venueType: 'not-a-venue' }))
    expect(res.status).toBe(400)
    expect(applyMock).not.toHaveBeenCalled()
  })
})

// ============================================
// TENANT/LOCATION ISOLATION (issue #114 §7)
// ============================================
describe('POST /api/onboarding/starter-catalog — tenant scope', () => {
  it('seja lokacije je AVTORITATIVNA — locationId v telesu je ignoriran (ne more pisati v tujo lokacijo)', async () => {
    requireAuthMock.mockResolvedValue(makeAuth({ role: 'admin', locationId: 'loc-MY' }))
    menuItemCountMock.mockResolvedValue(0)
    applyMock.mockResolvedValue({
      template: 'pizzerija', menuName: 'Pizzerija',
      created: { menus: 1, categories: 4, items: 15, modifierGroups: 2, modifiers: 10, attachments: 15, inventoryItems: 0 },
      totals: { categories: 4, items: 15, modifierGroups: 2 },
      skippedAttachments: [],
    })

    const res = await POST(post({ venueType: 'pizzerija', locationId: 'loc-FOREIGN' }))
    expect(res.status).toBe(200)
    // apply je prejel SCOPED locationId (seja), NE telesnega
    expect(applyMock).toHaveBeenCalledWith(expect.objectContaining({
      locationId: 'loc-MY',
      venueType: 'pizzerija',
    }))
  })

  it('count zaščita je scope-ana na lokacijo seje (ne globalna)', async () => {
    requireAuthMock.mockResolvedValue(makeAuth({ role: 'admin', locationId: 'loc-MY' }))
    applyMock.mockResolvedValue({
      template: 'bar', menuName: 'Bar',
      created: { menus: 1, categories: 1, items: 1, modifierGroups: 0, modifiers: 0, attachments: 0, inventoryItems: 0 },
      totals: { categories: 1, items: 1, modifierGroups: 0 },
      skippedAttachments: [],
    })
    await POST(post({ venueType: 'bar' }))
    expect(menuItemCountMock).toHaveBeenCalledWith({
      where: { category: { menu: { locationId: 'loc-MY' } } },
    })
  })

  it('super-admin brez lokacije lahko izrecno cilja lokacijo', async () => {
    requireAuthMock.mockResolvedValue(makeAuth({ role: 'super-admin', locationId: null }))
    menuItemCountMock.mockResolvedValue(0)
    applyMock.mockResolvedValue({
      template: 'bar', menuName: 'Bar',
      created: { menus: 1, categories: 1, items: 1, modifierGroups: 0, modifiers: 0, attachments: 0, inventoryItems: 0 },
      totals: { categories: 1, items: 1, modifierGroups: 0 },
      skippedAttachments: [],
    })
    const res = await POST(post({ venueType: 'bar', locationId: 'loc-EXPLICIT' }))
    expect(res.status).toBe(200)
    expect(applyMock).toHaveBeenCalledWith(expect.objectContaining({ locationId: 'loc-EXPLICIT' }))
  })
})

// ============================================
// §8 ZAŠČITA OBSTOJEČEGA KATALOGA
// ============================================
describe('POST /api/onboarding/starter-catalog — existing catalog protection (§8)', () => {
  it('artikli > 0 in brez confirm → 409 + existingItemCount', async () => {
    requireAuthMock.mockResolvedValue(makeAuth({ role: 'admin', locationId: 'loc-1' }))
    menuItemCountMock.mockResolvedValue(42)

    const res = await POST(post({ venueType: 'pizzerija' }))
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.existingItemCount).toBe(42)
    expect(applyMock).not.toHaveBeenCalled()
  })

  it('artikli > 0 + confirm: true → dovoljeno (eksplicitna potrditev)', async () => {
    requireAuthMock.mockResolvedValue(makeAuth({ role: 'admin', locationId: 'loc-1' }))
    menuItemCountMock.mockResolvedValue(42)
    applyMock.mockResolvedValue({
      template: 'pizzerija', menuName: 'Pizzerija',
      created: { menus: 0, categories: 0, items: 0, modifierGroups: 0, modifiers: 0, attachments: 0, inventoryItems: 0 },
      totals: { categories: 4, items: 15, modifierGroups: 2 },
      skippedAttachments: [],
    })

    const res = await POST(post({ venueType: 'pizzerija', confirm: true }))
    expect(res.status).toBe(200)
    expect(applyMock).toHaveBeenCalled()
  })

  it('prazen katalog (count 0) → dovoljeno brez confirm (first-run pot)', async () => {
    requireAuthMock.mockResolvedValue(makeAuth({ role: 'admin', locationId: 'loc-1' }))
    menuItemCountMock.mockResolvedValue(0)
    applyMock.mockResolvedValue({
      template: 'kavarna', menuName: 'Kavarna',
      created: { menus: 1, categories: 5, items: 19, modifierGroups: 1, modifiers: 3, attachments: 4, inventoryItems: 0 },
      totals: { categories: 5, items: 19, modifierGroups: 1 },
      skippedAttachments: [],
    })

    const res = await POST(post({ venueType: 'kavarna' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.created.items).toBe(19)
  })
})
