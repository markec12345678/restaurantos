// ============================================
// P0-C2: resolveTenantLocationId() helper tests
//
// Testiramo:
// 1. Regular user z locationId → uporabi session.locationId
// 2. Regular user brez locationId → DENY (fail-closed)
// 3. Regular user z ?locationId query → query IGNORIRAN (prepreči bypass)
// 4. Admin z session.locationId → uporabi session.locationId
// 5. Admin brez session.locationId + brez query → null (global view)
// 6. Admin brez session.locationId + ?locationId → query (cross-branch, auditirano)
// 7. Brez session → DENY
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  resolveTenantLocationId,
  resolveTenantLocationIdOrThrow,
  tenantScopeToWhere,
} from '@/lib/auth-middleware/tenant-scope'
import type { Session } from '@/lib/auth-middleware/types'

// --- Helper za kreiranje session ---
function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    token: 'tok',
    employeeId: 'emp-1',
    role: 'staff',
    permissions: ['take_orders'],
    createdAt: Date.now(),
    expiresAt: Date.now() + 3600000,
    absoluteExpiry: Date.now() + 86400000,
    locationId: null,
    ...overrides,
  }
}

function makeSearchParams(params: Record<string, string> = {}): URLSearchParams {
  return new URLSearchParams(params)
}

describe('P0-C2: resolveTenantLocationId() — Tenant Scope Helper', () => {
  describe('Regular user (non-admin)', () => {
    it('z locationId: uporabi session.locationId', () => {
      const session = makeSession({ role: 'staff', locationId: 'loc-a' })
      const result = resolveTenantLocationId(session, makeSearchParams())

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.locationId).toBe('loc-a')
        expect(result.source).toBe('session')
        expect(result.isCrossBranch).toBe(false)
      }
    })

    it('brez locationId: DENY (fail-closed)', () => {
      const session = makeSession({ role: 'staff', locationId: null })
      const result = resolveTenantLocationId(session, makeSearchParams())

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toBe('regular_user_without_location')
      }
    })

    it('z ?locationId query: query IGNORIRAN (prepreči bypass)', () => {
      const session = makeSession({ role: 'staff', locationId: 'loc-a' })
      const result = resolveTenantLocationId(
        session,
        makeSearchParams({ locationId: 'loc-b' }),
      )

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.locationId).toBe('loc-a') // session, ne query!
        expect(result.source).toBe('session')
        expect(result.isCrossBranch).toBe(false)
      }
    })

    it('z ?branchId query: query IGNORIRAN (alternate param name)', () => {
      const session = makeSession({ role: 'staff', locationId: 'loc-a' })
      const result = resolveTenantLocationId(
        session,
        makeSearchParams({ branchId: 'loc-b' }),
      )

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.locationId).toBe('loc-a') // session, ne query!
      }
    })

    it('manager role: isto kot staff (non-admin)', () => {
      const session = makeSession({ role: 'manager', locationId: 'loc-a' })
      const result = resolveTenantLocationId(
        session,
        makeSearchParams({ locationId: 'loc-b' }),
      )

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.locationId).toBe('loc-a') // session, ne query!
      }
    })

    it('manager brez locationId: DENY', () => {
      const session = makeSession({ role: 'manager', locationId: null })
      const result = resolveTenantLocationId(session, makeSearchParams())

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toBe('regular_user_without_location')
      }
    })
  })

  describe('Admin', () => {
    it('z session.locationId: uporabi svojo lokacijo', () => {
      const session = makeSession({ role: 'admin', locationId: 'loc-admin' })
      const result = resolveTenantLocationId(
        session,
        makeSearchParams({ locationId: 'loc-b' }),
      )

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.locationId).toBe('loc-admin')
        expect(result.source).toBe('session')
        expect(result.isCrossBranch).toBe(false)
      }
    })

    it('brez session.locationId + brez query: null (global view)', () => {
      const session = makeSession({ role: 'admin', locationId: null })
      const result = resolveTenantLocationId(session, makeSearchParams())

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.locationId).toBeNull()
        expect(result.source).toBe('admin_global')
        expect(result.isCrossBranch).toBe(false)
      }
    })

    it('brez session.locationId + ?locationId: query (cross-branch)', () => {
      const session = makeSession({ role: 'admin', locationId: null })
      const result = resolveTenantLocationId(
        session,
        makeSearchParams({ locationId: 'loc-b' }),
        { endpoint: 'GET /api/orders' },
      )

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.locationId).toBe('loc-b')
        expect(result.source).toBe('query')
        expect(result.isCrossBranch).toBe(true)
      }
    })

    it('cross-branch access kliče auditLogger (non-blocking)', async () => {
      const auditLogger = vi.fn().mockResolvedValue(undefined)
      const session = makeSession({ role: 'admin', locationId: null })
      resolveTenantLocationId(
        session,
        makeSearchParams({ locationId: 'loc-b' }),
        { endpoint: 'GET /api/orders', auditLogger },
      )

      // Počakaj da promise resolve-a
      await new Promise(r => setTimeout(r, 10))

      expect(auditLogger).toHaveBeenCalledWith({
        employeeId: 'emp-1',
        endpoint: 'GET /api/orders',
        requestedLocationId: 'loc-b',
        sessionLocationId: null,
      })
    })

    it('super_admin role: obravnavan kot admin', () => {
      const session = makeSession({ role: 'super_admin', locationId: null })
      const result = resolveTenantLocationId(
        session,
        makeSearchParams({ locationId: 'loc-b' }),
      )

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.locationId).toBe('loc-b')
        expect(result.source).toBe('query')
        expect(result.isCrossBranch).toBe(true)
      }
    })
  })

  describe('Edge cases', () => {
    it('brez session: DENY (no_session)', () => {
      const result = resolveTenantLocationId(null, makeSearchParams())

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toBe('no_session')
      }
    })

    it('brez session (undefined): DENY', () => {
      const result = resolveTenantLocationId(undefined, makeSearchParams())

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toBe('no_session')
      }
    })

    it('brez searchParams: deluje (admin global)', () => {
      const session = makeSession({ role: 'admin', locationId: null })
      const result = resolveTenantLocationId(session, null)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.locationId).toBeNull()
        expect(result.source).toBe('admin_global')
      }
    })

    it('brez searchParams (regular user): uporabi session', () => {
      const session = makeSession({ role: 'staff', locationId: 'loc-a' })
      const result = resolveTenantLocationId(session, null)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.locationId).toBe('loc-a')
      }
    })
  })

  describe('tenantScopeToWhere() — Prisma filter helper', () => {
    it('z locationId: vrne { locationId }', () => {
      const scope = resolveTenantLocationId(
        makeSession({ role: 'staff', locationId: 'loc-a' }),
        makeSearchParams(),
      )
      if (!scope.ok) throw new Error('Expected ok')

      const where = tenantScopeToWhere(scope)
      expect(where).toEqual({ locationId: 'loc-a' })
    })

    it('z null locationId (admin global): vrne {}', () => {
      const scope = resolveTenantLocationId(
        makeSession({ role: 'admin', locationId: null }),
        makeSearchParams(),
      )
      if (!scope.ok) throw new Error('Expected ok')

      const where = tenantScopeToWhere(scope)
      expect(where).toEqual({})
    })
  })

  describe('resolveTenantLocationIdOrThrow() — convenient one-liner', () => {
    it('z regular user: vrne locationId', () => {
      const result = resolveTenantLocationIdOrThrow(
        makeSession({ role: 'staff', locationId: 'loc-a' }),
        makeSearchParams(),
      )

      expect('error' in result).toBe(false)
      if (!('error' in result)) {
        expect(result.locationId).toBe('loc-a')
      }
    })

    it('z regular user brez locationId: vrne error', () => {
      const result = resolveTenantLocationIdOrThrow(
        makeSession({ role: 'staff', locationId: null }),
        makeSearchParams(),
      )

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.status).toBe(403)
      }
    })

    it('z admin global: vrne null', () => {
      const result = resolveTenantLocationIdOrThrow(
        makeSession({ role: 'admin', locationId: null }),
        makeSearchParams(),
      )

      expect('error' in result).toBe(false)
      if (!('error' in result)) {
        expect(result.locationId).toBeNull()
      }
    })
  })

  describe('Regression: nikoli ne vrne null/undefined rezultata', () => {
    it('vedno vrne strukturiran objekt', () => {
      const cases = [
        resolveTenantLocationId(null, null),
        resolveTenantLocationId(makeSession(), null),
        resolveTenantLocationId(makeSession({ role: 'staff', locationId: 'x' }), null),
        resolveTenantLocationId(makeSession({ role: 'admin', locationId: 'x' }), null),
        resolveTenantLocationId(makeSession({ role: 'admin', locationId: null }), null),
        resolveTenantLocationId(
          makeSession({ role: 'admin', locationId: null }),
          makeSearchParams({ locationId: 'x' }),
        ),
      ]

      for (const result of cases) {
        expect(result).toBeDefined()
        expect(typeof result).toBe('object')
        expect('ok' in result).toBe(true)
      }
    })
  })
})
