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
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { isFursConfigured, getFursConfigSource } from '@/lib/furs/config-resolver'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const url = new URL(req.url)
    const locationId = url.searchParams.get('locationId')

    const source = await getFursConfigSource(locationId)
    const configured = await isFursConfigured(locationId)

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
