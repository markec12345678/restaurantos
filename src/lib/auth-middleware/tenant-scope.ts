// ============================================
// TENANT SCOPE RESOLVER — resolveTenantLocationId()
// ============================================
// Centralni helper za multi-tenant isolation. Reši tri kritične težave:
//
// 1. IDOR bypass preko ?locationId parametra
//    (regular user bi lahko pošiljal ?locationId=loc-b in dostopal do tuje lokacije)
//
// 2. Fail-closed za regular user brez session.locationId
//    (če Employee.locationId ni nastavljen in role ni admin, DENY — ne dovoli vse)
//
// 3. Magic string past ("__DENIED__")
//    (prejšnji načrt je uporabljal magic string — interpretacijska napaka = bypass)
//
// Rešitev: strukturiran rezultat z discriminatorjem (Tagged Union).
// Klicatelj MORA obravnavati vse tri primere ali uporabiti便捷 helper.
// ============================================

import { NextResponse } from 'next/server'
import type { Session } from './types'

// --- Tipi: strukturiran rezultat ---

export type TenantScopeResult =
  | { ok: true; locationId: string; source: 'session' | 'query'; isCrossBranch: boolean }
  | { ok: true; locationId: null; source: 'admin_global'; isCrossBranch: boolean }
  | { ok: false; reason: 'no_session' | 'regular_user_without_location'; error: NextResponse }

// --- Pomožni tipi za admin check ---

const ADMIN_ROLES = new Set(['admin', 'super_admin'])

function isAdminRole(session: Session | null | undefined): boolean {
  return !!session && ADMIN_ROLES.has(session.role)
}

// --- Glavni helper ---

/**
 * Resolve tenant locationId iz session + query parametra.
 *
 * Pravila:
 * 1. Regular user (non-admin): session.locationId je AVTORITATIVEN.
 *    - Če je null → DENY (fail-closed, data integrity issue)
 *    - Query parameter ?locationId se IGNORIRA (prepreči bypass)
 *
 * 2. Admin z session.locationId: uporabi session.locationId (admin restricted to location)
 *    - Query parameter se IGNORIRA
 *
 * 3. Admin z session.locationId=null (super admin): lahko dostopa do vseh lokacij
 *    - Če je ?locationId podan, uporabi ga (cross-branch access, auditirano)
 *    - Če ni podan, vrne null (global view)
 *
 * @param session - uporabniška seja iz requireAuth()
 * @param searchParams - URLSearchParams iz req.url (lahko tudi prazno)
 * @param options.endpoint - ime endpointa za audit log (npr. 'GET /api/orders')
 * @param options.auditLogger - funkcija za cross-branch audit log (option)
 *
 * @returns TenantScopeResult — strukturiran rezultat, NIKDY ne vrne null/undefined
 *
 * @example
 * const authResult = await requireAuth(req, ...)
 * if (authResult.error) return authResult.error
 * const scope = resolveTenantLocationId(authResult.session, searchParams, {
 *   endpoint: 'GET /api/orders',
 * })
 * if (!scope.ok) return scope.error // DENY
 * const where = { ...(scope.locationId ? { locationId: scope.locationId } : {}) }
 */
export function resolveTenantLocationId(
  session: Session | null | undefined,
  searchParams: URLSearchParams | null | undefined,
  options?: {
    endpoint?: string
    auditLogger?: (entry: {
      employeeId: string
      endpoint: string
      requestedLocationId: string
      sessionLocationId: string | null
    }) => void | Promise<void>
  },
): TenantScopeResult {
  // 1. Brez session → DENY
  if (!session) {
    return {
      ok: false,
      reason: 'no_session',
      error: NextResponse.json(
        { error: 'Avtentikacija je obvezna.' },
        { status: 401 },
      ),
    }
  }

  const sessionLocationId = session.locationId ?? null
  const requestedLocationId = searchParams?.get('locationId') ?? searchParams?.get('branchId') ?? null
  const isAdmin = isAdminRole(session)

  // 2. Regular user (non-admin) — session.locationId je avtoritativen
  if (!isAdmin) {
    if (!sessionLocationId) {
      // Fail-closed: regular user brez locationId = data integrity issue
      // Ne dovoli vse (varnost pred arterijami konfiguracije)
      return {
        ok: false,
        reason: 'regular_user_without_location',
        error: NextResponse.json(
          {
            error:
              'Vaš račun nima dodeljene lokacije. Kontaktirajte administratorja.',
          },
          { status: 403 },
        ),
      }
    }
    // Regular user: vedno uporabi session.locationId, ignoriraj query
    return {
      ok: true,
      locationId: sessionLocationId,
      source: 'session',
      isCrossBranch: false,
    }
  }

  // 3. Admin z session.locationId — uporabi svojo lokacijo (admin restricted to location)
  if (sessionLocationId) {
    return {
      ok: true,
      locationId: sessionLocationId,
      source: 'session',
      isCrossBranch: false,
    }
  }

  // 4. Admin brez session.locationId (super admin) — lahko uporabi query
  if (requestedLocationId) {
    // Cross-branch access — auditiraj (non-blocking)
    if (options?.auditLogger && options?.endpoint) {
      try {
        Promise.resolve(
          options.auditLogger({
            employeeId: session.employeeId,
            endpoint: options.endpoint,
            requestedLocationId,
            sessionLocationId: null,
          }),
        ).catch(() => {
          // Audit log failure ne sme blokirati requesta
        })
      } catch {
        // Non-blocking
      }
    }
    return {
      ok: true,
      locationId: requestedLocationId,
      source: 'query',
      isCrossBranch: true,
    }
  }

  // 5. Super admin brez query parametra — global view (locationId = null)
  return {
    ok: true,
    locationId: null,
    source: 'admin_global',
    isCrossBranch: false,
  }
}

// --- Pomožni helper za Prisma where clause ---

/**
 * Pomožni helper, ki iz TenantScopeResult generira Prisma where filter.
 *
 * @example
 * const scope = resolveTenantLocationId(...)
 * if (!scope.ok) return scope.error
 * const where = { status: 'pending', ...tenantScopeToWhere(scope) }
 * const orders = await db.order.findMany({ where })
 */
export function tenantScopeToWhere(
  scope: Extract<TenantScopeResult, { ok: true }>,
): { locationId?: string } {
  return scope.locationId ? { locationId: scope.locationId } : {}
}

// --- Convenient one-liner za enostavne primere ---

/**
 * Enojni helper, ki resolve-a tenant scope in takoj vrže NextResponse na DENY.
 * Uporabno za krajše endpointe kjer ne potrebujete podrobnosti o source.
 *
 * @returns { locationId: string | null } ali { error: NextResponse } — pogojno
 *
 * @example
 * const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams)
 * if ('error' in scope) return scope.error
 * const where = { ...(scope.locationId ? { locationId: scope.locationId } : {}) }
 */
export function resolveTenantLocationIdOrThrow(
  session: Session | null | undefined,
  searchParams: URLSearchParams | null | undefined,
  options?: { endpoint?: string },
): { locationId: string | null } | { error: NextResponse } {
  const scope = resolveTenantLocationId(session, searchParams, options)
  if (!scope.ok) return { error: scope.error }
  return { locationId: scope.locationId }
}
