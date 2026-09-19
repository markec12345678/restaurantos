// ============================================
// R80 — AGGREGATE TENANT-SCOPE LEAKS, BATCH C (Task 3-c) — regression tests
//
// Pokriva:
// 1. locations/[id] scope-denial (guardLocationScope logika: lokacija JE tenant
//    root — lokacijsko vezan admin sme samo svojo lokacijo, super-admin vse;
//    cross-tenant zahteva = 404 in NE sme niti sestaviti DB poizvedbe)
// 2. notifications recipient PII masking (stripRecipientPii — AuditLog nima
//    locationId, zato se details.recipient odstrani iz GET odgovora)
// 3. guests/feedback fail-closed scope pattern (resolveTenantLocationIdOrThrow:
//    non-admin brez lokacije → 403; admin brez lokacije → globalni pregled)
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocki (vi.hoisted zaradi vitest hoisting) ---
const { mockRequireAuth, mockLocationFindUnique, mockOrderAggregate, mockOrderCount } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockLocationFindUnique: vi.fn(),
  mockOrderAggregate: vi.fn(),
  mockOrderCount: vi.fn(),
}))

// Route uporablja requireAuth iz auth-middleware barrel-a — mockamo ga, da
// nadzorujemo session.locationId brez pravega HTTP requesta.
vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: mockRequireAuth,
}))

// Setup.ts ima globalni Proxy mock za @/lib/db — v tem testu ga overridamo z
// eksplicitnimi mocki, da lahko trdimo KATERE poizvedbe so (ne) izvedene.
vi.mock('@/lib/db', () => ({
  db: {
    location: { findUnique: mockLocationFindUnique },
    order: { aggregate: mockOrderAggregate, count: mockOrderCount },
  },
  createAuditLog: vi.fn(),
}))

import { GET as getLocationById } from '@/app/api/locations/[id]/route'
import { stripRecipientPii } from '@/app/api/notifications/_helpers'
import { isWithinScope, notInScopeResponse, resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'

// --- Helperji ---
function makeRequest(id: string): Request {
  return new Request(`http://localhost:3000/api/locations/${id}`)
}

function makeRouteArgs(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) }
}

function makeSession(locationId: string | null, role = 'admin') {
  return { employeeId: 'emp-1', role, locationId, permissions: ['admin'] }
}

// 1:1 zrcali guardLocationScope() iz src/app/api/locations/[id]/route.ts
// (route ga ne exporta — test dokazuje, da ta logika z OECD helperji da 404
// za tuj tenant in null za lastnega / super-admina).
function guardLocationScope(
  session: { locationId?: string | null } | null | undefined,
  id: string,
): ReturnType<typeof notInScopeResponse> | null {
  const sessionLocId = session?.locationId ?? null
  if (sessionLocId && !isWithinScope(sessionLocId, id)) {
    return notInScopeResponse('Lokacija')
  }
  return null
}

describe('R80 batch C: locations/[id] scope-denial', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lokacijsko vezan admin + tuja lokacija → 404 (notInScope)', () => {
    const denied = guardLocationScope(makeSession('loc-a'), 'loc-b')
    expect(denied).not.toBeNull()
    expect(denied!.status).toBe(404)
  })

  it('lokacijsko vezan admin + lastna lokacija → dovoljeno (null)', () => {
    expect(guardLocationScope(makeSession('loc-a'), 'loc-a')).toBeNull()
  })

  it('super-admin (locationId=null) → poljuben id dovoljen', () => {
    expect(guardLocationScope(makeSession(null), 'loc-b')).toBeNull()
    expect(guardLocationScope(makeSession(null), 'loc-a')).toBeNull()
  })

  it('notInScopeResponse vrača 404 z enakim sporočilom kot not-found (ne razkriva obstoja)', () => {
    const res = notInScopeResponse('Lokacija')
    expect(res.status).toBe(404)
  })

  it('GET /api/locations/[id] cross-tenant: 404 in DB poizvedba se sploh ne izvede', async () => {
    mockRequireAuth.mockResolvedValue({ session: makeSession('loc-a') })

    const res = await getLocationById(makeRequest('loc-b'), makeRouteArgs('loc-b'))
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toContain('Lokacija')
    // Guard mora sestaviti zahtevo PRED morebitno DB poizvedbo —
    // _count ×6 + order.aggregate dnevni promet tuje lokacije se ne smejo vrniti.
    expect(mockLocationFindUnique).not.toHaveBeenCalled()
    expect(mockOrderAggregate).not.toHaveBeenCalled()
  })

  it('GET /api/locations/[id] lastna lokacija: guard preide in DB poizvedba teče', async () => {
    mockRequireAuth.mockResolvedValue({ session: makeSession('loc-a') })
    mockLocationFindUnique.mockResolvedValue(null) // 404 not-found — a šele PO guardu

    await getLocationById(makeRequest('loc-a'), makeRouteArgs('loc-a'))

    expect(mockLocationFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'loc-a' } }),
    )
  })
})

describe('R80 batch C: notifications recipient PII masking', () => {
  it('odstrani details.recipient, ohrani channel + subject', () => {
    const details = { channel: 'sms', recipient: '+38640123456', subject: 'Rezervacija', success: true }
    const safe = stripRecipientPii(details)

    expect('recipient' in safe).toBe(false)
    expect(safe.channel).toBe('sms')
    expect(safe.subject).toBe('Rezervacija')
    expect(safe.success).toBe(true)
  })

  it('deluje tudi nad JSON stringom (AuditLog.details je Json)', () => {
    const safe = stripRecipientPii(JSON.stringify({ channel: 'email', recipient: 'gost@example.com' }))
    expect('recipient' in safe).toBe(false)
    expect(safe.channel).toBe('email')
  })

  it('ne-razpadljiv details → prazen objekt (brez PII, brez crasha)', () => {
    expect(stripRecipientPii(null)).toEqual({})
    expect(stripRecipientPii(undefined)).toEqual({})
    expect(stripRecipientPii('ni-json{{')).toEqual({})
  })

  it('email prejemnik drugega tenanta se ne sme izgubiti v odgovoru', () => {
    const safe = stripRecipientPii({ channel: 'email', recipient: 'tenant-b@gost.si', providerId: 'p1' })
    expect(JSON.stringify(safe)).not.toContain('tenant-b@gost.si')
  })
})

describe('R80 batch C: guests/feedback fail-closed scope pattern', () => {
  const searchParams = new URLSearchParams()

  it('non-admin brez session.locationId → 403 (fail-closed data-integrity edge)', () => {
    const result = resolveTenantLocationIdOrThrow(makeSession(null, 'staff'), searchParams)
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.status).toBe(403)
    }
  })

  it('non-admin z lokacijo → filtrira na session lokacijo', () => {
    const result = resolveTenantLocationIdOrThrow(makeSession('loc-a', 'staff'), searchParams)
    expect('error' in result).toBe(false)
    if (!('error' in result)) expect(result.locationId).toBe('loc-a')
  })

  it('admin brez lokacije (super-admin) → null (nefiltriran globalni pregled)', () => {
    const result = resolveTenantLocationIdOrThrow(makeSession(null, 'admin'), searchParams)
    expect('error' in result).toBe(false)
    if (!('error' in result)) expect(result.locationId).toBeNull()
  })
})
