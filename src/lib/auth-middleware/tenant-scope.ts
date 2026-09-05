// ============================================
// TENANT SCOPE — Central helper za locationId authorization
//
// Issue #45 P0-C2: 21 endpoint-ov je sprejemalo ?locationId=
// brez preverjanja ali je uporabnik super_admin.
//
// Ta helper zagotavlja konsistenten authorization pattern:
//
//   super_admin + requestedLocationId → uporabi requestedLocationId
//   regular user                      → uporabi session.locationId (avtoritativen)
//   super_admin + brez requestedLocationId → null (vidi vse lokacije)
//
// Uporaba:
//   const effectiveLocationId = resolveTenantLocationId(authResult, searchParams)
//   if (effectiveLocationId) where.locationId = effectiveLocationId
// ============================================

import type { NextRequest } from 'next/server'

interface AuthResult {
  session?: {
    role?: string | null
    locationId?: string | null
  } | null
  error?: unknown
}

/**
 * Pridobi avtoritativni locationId za trenutnega uporabnika.
 *
 * Pravila:
 * 1. Super admin + ?locationId=X → vrne X (lahko izbere katero koli lokacijo)
 * 2. Super admin brez ?locationId → vrne null (vidi vse lokacije)
 * 3. Regular user + session.locationId → vrne session.locationId (ignorira ?locationId)
 * 4. Regular user BREZ session.locationId → vrne '__TENANT_DENIED__' (fail-closed)
 *    Pomeni: uporabnik nima dodeljene lokacije → ne sme videti ničesar.
 *    Klicatelj mora preverjati na to s tenantLocationFilter() ali eksplicitno.
 *
 * @param authResult - rezultat requireAuth()
 * @param searchParams - URL searchParams (ali null za POST brez query)
 * @returns locationId string | null (null = super_admin vidi vse; '__TENANT_DENIED__' = deny)
 */
export function resolveTenantLocationId(
  authResult: AuthResult,
  searchParams: URLSearchParams | null,
): string | null {
  const isSuperAdmin = authResult.session?.role === 'super_admin'
  const sessionLocationId = authResult.session?.locationId ?? null
  const requestedLocationId = searchParams?.get('locationId') ?? null

  if (isSuperAdmin) {
    // Super admin lahko izbere katero koli lokacijo (ali vse)
    return requestedLocationId
  }

  // Regular user — session.locationId je avtoritativen
  // ?locationId= iz requesta se IGNORIRA
  if (sessionLocationId) {
    return sessionLocationId
  }

  // 🔴 FAIL-CLOSED: Regular user brez session.locationId ne sme videti ničesar.
  // Vrne sentinel vrednost, ki bo privedla do praznega rezultata v query-ju.
  return TENANT_DENIED
}

/**
 * Sentinel vrednost za fail-closed obnašanje.
 * Klicatelj naj preverja: if (loc === TENANT_DENIED) return 403
 * ali uporabi tenantLocationFilter() ki to obravnava avtomatsko.
 */
export const TENANT_DENIED = '__TENANT_DENIED__'

/**
 * Ali naj se locationId filter uporabi?
 *
 * Uporabno za pogojne query-je:
 *   const loc = resolveTenantLocationId(auth, searchParams)
 *   const where = loc ? { locationId: loc } : {}
 */
export function tenantLocationFilter(
  authResult: AuthResult,
  searchParams: URLSearchParams | null,
): Record<string, string> {
  const loc = resolveTenantLocationId(authResult, searchParams)
  return loc ? { locationId: loc } : {}
}
