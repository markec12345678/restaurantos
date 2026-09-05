// ============================================
// GET /api/furs/config-source — Diagnostic endpoint
//
// ISSUE #37: Pove admin UI od kod FURS certifikat dejansko prihaja.
// Uporabno v setup wizard-u in pri diagnosticiranju multi-tenant težav.
//
// Vrne:
//   - source: 'location' | 'restaurant-settings' | 'env' | 'missing'
//   - locationId: ID uporabljene lokacije (ali null)
//   - configured: ali je FURS konfiguriran
//
// Admin-only (RBAC: admin).
// ============================================

import { NextResponse } from 'next/server'
import { requireAuth, resolveTenantLocationId } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { isFursConfigured, getFursConfigSource } from '@/lib/furs/config-resolver'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const url = new URL(req.url)

    // FIX P0-C2: Centralni tenant scope resolver — admin only, ampak še vedno uporablja resolver
    // Admin brez session.locationId lahko specifiče ?locationId za cross-branch diagnostic
    const scope = resolveTenantLocationId(authResult.session, url.searchParams, {
      endpoint: 'GET /api/furs/config-source',
    })
    if (!scope.ok) return scope.error

    const source = await getFursConfigSource(scope.locationId ?? undefined)
    const configured = await isFursConfigured(scope.locationId ?? undefined)

    return NextResponse.json({
      ...source,
      configured,
      message:
        source.source === 'location'
          ? `FURS certifikat pridobljen iz Location ${source.locationId}`
          : source.source === 'restaurant-settings'
            ? '⚠️ FURS certifikat iz RestaurantSettings (deprecated — nastavi na Location za multi-tenant)'
            : source.source === 'env'
              ? 'FURS certifikat iz env spremenljivk (FURS_CERT_PATH)'
              : '❌ FURS certifikat ni konfiguriran',
    })
  } catch (error: unknown) {
    return handleApiError(
      error,
      'GET /api/furs/config-source',
      'Napaka pri pridobivanju vira FURS konfiguracije',
    )
  }
}
