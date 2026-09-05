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
 * 3. Regular user → vrne session.locationId (ignorira ?locationId iz requesta)
 * 4. Regular user brez session.locationId → vrne null (fallback — admin brez lokacije)
 *
 * @param authResult - rezultat requireAuth()
 * @param searchParams - URL searchParams (ali null za POST brez query)
 * @returns locationId string | null
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
  return sessionLocationId
}

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
