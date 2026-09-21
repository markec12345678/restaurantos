// ============================================
// LOKACIJA ORDERING TOKEN — izdaja javnega naročilnega tokena (R88)
// ============================================
// Per-location public ordering token (R81 qr-pay HMAC vzorec, brez sheme/
// Redis-a): stateless HMAC-SHA256 vezava lokacija↔naročanje. Restaurant
// objavi ordering URL (`/order?loc=<id>&t=<token>`) na spletni strani /
// plakatu — kot deep link; POST /api/public/online-order ga zahteva (R88).
//
// Izdaja = AVTORIZACIJA: samo avtenticirano osebje (requireAuth brez posebnega
// permissiona — vsak zaposleni sme poiskati ordering povezavo svoje lokacije)
// in SAMO znotraj lokacijskega scope-a seje (centralni resolver kanon iz R80).
//
// GET only — token je dolgotrajna poverilnica (BREZ TTL — glej header
// lib/ordering-token.ts); revokacija = rotacija ORDERING_TOKEN_SECRET.
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { isWithinScope, notInScopeResponse, resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'
import { getAppUrl } from '@/lib/utils'
import { isOrderingSecretConfigured, orderingTokenFor } from '@/lib/ordering-token'

export const dynamic = 'force-dynamic'

// ============================================
// GET /api/locations/[id]/ordering-token — izdaj ordering token + deep link
// ============================================

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(req)
  if (authResult.error) return authResult.error

  // R88 resolver kanon: IMMEDIATELY po requireAuth, PRED body/param
  // handlingom — non-admin NULL-lokacijska seja → 403 fail-closed (M2 kanon).
  const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
    endpoint: 'GET /api/locations/[id]/ordering-token',
  })
  if ('error' in scope) return scope.error

  try {
    const { id } = await params

    const location = await db.location.findFirst({
      where: { id },
      select: { id: true, isActive: true, name: true },
    })
    if (!location) {
      // Namerno 404 — ne razkrivamo obstoja tuje lokacije (isti odgovor kot
      // out-of-scope spodaj; ni obstoja-oraklja).
      return notInScopeResponse('Lokacija')
    }

    // Scope: lokacijsko vezana seja sme izdati token SAMO za svojo lokacijo;
    // super-admin (null scope) = cross-lokacijski nadzor (isWithinScope kanon).
    if (!isWithinScope(scope.locationId, location.id)) {
      return notInScopeResponse('Lokacija')
    }

    // R82-D kanon (zrcali qr-pay init 503): v produkciji brez nastavljenega
    // HMAC secret-a NE izdajamo tokena (nikoli token z javno znanim dev
    // secretom). Sporočilo brez notranjih detajlov.
    if (process.env.NODE_ENV === 'production' && !isOrderingSecretConfigured()) {
      return NextResponse.json(
        { error: 'Izdaja naročilnih povezav ni konfigurirana — kontaktirajte podporo' },
        { status: 503 },
      )
    }

    const token = orderingTokenFor(location.id)
    return NextResponse.json({
      locationId: location.id,
      token,
      orderingUrl: `${getAppUrl()}/order?loc=${location.id}&t=${token}`,
      locationName: location.name,
      isActive: location.isActive,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/locations/[id]/ordering-token', 'Napaka pri izdaji naročilnega tokena')
  }
}
