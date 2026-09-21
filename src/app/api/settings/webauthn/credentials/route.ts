// =====================================================================
// GET /api/settings/webauthn/credentials?locationId=X — ADMIN seznam
// WebAuthn device poverilnic lokacije (R97-a)
//
// Auth guard: ISTI kot obstoječe settings endpoints — requireAuth(req,
// { permission: 'admin' }). Tenant scope: resolveTenantLocationIdOrThrow
// (FORBIDDEN primitivi nespremenjeni) — lokacijsko vezan admin vidi SAMO
// svojo lokacijo (query parameter se ignorira), super-admin rabi izrecen
// ?locationId (MODEL A: ni implicitnega globalnega pogleda na ta seznam).
//
// PII/ključi: select IZRECNO brez publicKey (javni COSE ključ ne potuje iz
// baze na admin UI — credentialId je javen po FIDO2 naravi, publicKey pa
// ostane strežniški podatek).
//
// Zero-oracle: slab format locationId → enoten 404 (zero db); neznana
// lokacija = lokacija brez poverilnic (prazen seznam — ni razlikovanja).
// =====================================================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { resolveTenantLocationIdOrThrow, notInScopeResponse } from '@/lib/tenant-scope'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
// DIRECT import (ne barrel) — hišni kanon 429 oblike (R92-b)
import { rateLimitedResponse } from '@/lib/rate-limit/response'

export const dynamic = 'force-dynamic'

// Dovoljena oblika locationId — ENAK vzorec kot LOCATION_ID_RE v
// src/lib/ordering-token.ts (vhodna sanitacija PRED db klici).
const LOCATION_ID_RE = /^[a-zA-Z0-9_-]{5,50}$/

export async function GET(req: Request) {
  // Rate limiting — settings družina.
  const rl = await checkRateLimitAsync('settings-webauthn-credentials', getClientIp(req), AUTHENTICATED_LIMIT)
  if (!rl.allowed) {
    return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')
  }

  // ADMIN guard — isti kot obstoječi settings endpoints.
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error
  const session = authResult.session

  // Tenant scope (query locationId je relevanten SAMO za super-admina —
  // lokacijsko vezana seja ga ignorira, pravilo resolveTenantLocationId).
  const searchParams = new URL(req.url).searchParams
  const scope = resolveTenantLocationIdOrThrow(session, searchParams, {
    endpoint: 'GET /api/settings/webauthn/credentials',
  })
  if ('error' in scope) return scope.error

  // Super-admin brez izrecnega ?locationId → 400 (ni implicitnega globalnega
  // pogleda; MODEL A: izrecen locationId za ta seznam).
  const locationId = scope.locationId
  if (!locationId) {
    return NextResponse.json(
      { error: 'locationId je obvezen (MODEL A): podaj ?locationId= ali se prijavi kot admin z lokacijo.' },
      { status: 400 },
    )
  }

  // Slab format → unificiran 404, ZERO db klicev.
  if (!LOCATION_ID_RE.test(locationId)) {
    return notInScopeResponse('Lokacija')
  }

  // Scoped seznam — select IZRECNO brez publicKey (pin na viru).
  const credentials = await db.webAuthnCredential.findMany({
    where: { locationId },
    select: {
      id: true,
      deviceName: true,
      transports: true,
      deviceType: true,
      createdAt: true,
      lastUsedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ locationId, credentials })
}
