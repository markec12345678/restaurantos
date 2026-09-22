// =====================================================================
// POST /api/settings/webauthn/register — ADMIN registracija WebAuthn
// device poverilnice za lokacijo (R97-a: passkey device attestation temelj)
//
// Auth guard: ISTI kot obstoječe settings endpoints — requireAuth(req,
// { permission: 'admin' }) (GET /api/settings, POST /api/settings/test-email).
//
// Tenant scope (MODEL A write kanon — resolveWriteLocationId + strict guard):
//   - lokacijsko vezan admin: NJEGOVA lokacija je avtoritativna; tuji
//     body.locationId → unificiran 404 (ne tiho preusmerjanje pisnih operacij);
//   - super-admin (brez lokacije): body.locationId je obvezen, lokacija mora
//     obstajati in biti aktivna → sicer unificiran 404.
//
// CHALLENGE STRATEGIJA: stateless signed challenge (HMAC, TTL 120 s) — glej
// src/lib/webauthn/device-attestation.ts. Registracija preveri, da je
// attestation response podpisan TOTOK signed challenge-ju za TO lokacijo
// (expectedChallenge = token; lokacija je vezana v payload — challenge mintan
// za lokacijo A ni uporaben za lokacijo B).
//
// Rate limit: AUTHENTICATED_LIMIT (120/min — settings družina).
// Odgovor NIKOLI ne vsebuje publicKey (admin list/register površina —
// javni ključ ostane strežniški podatek, DeviceTab ga ne prikazuje).
// =====================================================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { resolveTenantLocationIdOrThrow, resolveWriteLocationId, notInScopeResponse } from '@/lib/tenant-scope'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
// DIRECT import (ne barrel) — hišni kanon 429 oblike (R92-b)
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { parseJsonBody } from '@/lib/api-utils'
import { logger } from '@/lib/logger'
import { base64urlEncode } from '@/lib/webauthn'
import type { RegistrationResponseJSON } from '@simplewebauthn/server'
import {
  extractChallengeFromClientData,
  verifyDeviceChallenge,
  verifyDeviceRegistration,
  joinTransports,
} from '@/lib/webauthn/device-attestation'

export const dynamic = 'force-dynamic'

// Dovoljena oblika locationId — ENAK vzorec kot LOCATION_ID_RE v
// src/lib/ordering-token.ts (vhodna sanitacija PRED db klici).
const LOCATION_ID_RE = /^[a-zA-Z0-9_-]{5,50}$/

// Unificirano sporočilo za VSE attestation neuspehe (ni oraklja o vzroku).
const REGISTER_FAILED_MESSAGE =
  'Registracija ni uspela. Podpis ali podatek o napravi niso veljavni.'

export async function POST(req: Request) {
  // Rate limiting — settings družina (ISTI vzorec kot /api/settings/test-email).
  const rl = await checkRateLimitAsync('settings-webauthn-register', getClientIp(req), AUTHENTICATED_LIMIT)
  if (!rl.allowed) {
    return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')
  }

  // ADMIN guard — isti kot obstoječi settings endpoints.
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error
  const session = authResult.session

  const bodyResult = await parseJsonBody(req)
  if (bodyResult.error) return bodyResult.error

  const { credential, locationId: bodyLocationId, deviceName } = (bodyResult.data || {}) as {
    credential?: RegistrationResponseJSON
    locationId?: string
    deviceName?: string
  }

  // Oblikovna validacija (brez DB): attestation response + clientDataJSON.
  const clientDataJSON = credential?.response?.clientDataJSON
  if (!credential || typeof clientDataJSON !== 'string') {
    return NextResponse.json({ error: REGISTER_FAILED_MESSAGE }, { status: 400 })
  }

  // Tenant scope — FORBIDDEN primitivi ostanejo nespremenjeni (samo klic).
  const scope = resolveTenantLocationIdOrThrow(session, null, {
    endpoint: 'POST /api/settings/webauthn/register',
  })
  if ('error' in scope) return scope.error

  // MODEL A write lokacija: seja z lokacijo = avtoritativna; super-admin rabi
  // izrecen body.locationId (resolveWriteLocationId kanon).
  const resolved = resolveWriteLocationId(scope.locationId, bodyLocationId)
  if (!resolved.ok) return resolved.response

  // STRICT scope guard: tuji body.locationId pod lokacijsko vezano sejo →
  // unificiran 404 (zero db — pisne operacije se ne "tiho preusmerjajo").
  if (bodyLocationId && scope.locationId && bodyLocationId !== scope.locationId) {
    return notInScopeResponse('Lokacija')
  }

  const locationId = resolved.locationId
  if (!LOCATION_ID_RE.test(locationId)) {
    return notInScopeResponse('Lokacija')
  }

  // Lokacija mora obstajati + biti aktivna (unificiran 404, zero-oracle).
  const location = await db.location.findFirst({
    where: { id: locationId, isActive: true },
    select: { id: true, name: true },
  })
  if (!location) {
    return notInScopeResponse('Lokacija')
  }

  // 1) Signed challenge iz clientDataJSON (HMAC + TTL + lokacijska vezava).
  const challenge = extractChallengeFromClientData(clientDataJSON)
  if (!challenge || !verifyDeviceChallenge(challenge, locationId)) {
    return NextResponse.json({ error: REGISTER_FAILED_MESSAGE }, { status: 400 })
  }

  // 2) Kriptografska verifikacija attestation-a (@simplewebauthn/server v14).
  const result = await verifyDeviceRegistration(credential, challenge)
  if (!result.verified || !result.registrationInfo) {
    return NextResponse.json({ error: REGISTER_FAILED_MESSAGE }, { status: 400 })
  }

  // 3) Shrani poverilnico (tenant-scoped: locationId je bil scope-resolved).
  const transports = joinTransports(result.registrationInfo.credential.transports)
  const deviceType = result.registrationInfo.credentialDeviceType
  try {
    const saved = await db.webAuthnCredential.create({
      data: {
        credentialId: result.registrationInfo.credential.id,
        publicKey: base64urlEncode(result.registrationInfo.credential.publicKey),
        counter: result.registrationInfo.credential.counter,
        locationId,
        deviceName: (deviceName || '').trim().slice(0, 100) || null,
        transports,
        deviceType,
      },
      // Select brez publicKey (admin površina ne vrača ključa).
      select: {
        id: true,
        deviceName: true,
        transports: true,
        deviceType: true,
        createdAt: true,
      },
    })

    return NextResponse.json(
      { success: true, credential: saved, location: { id: location.id, name: location.name } },
      { status: 201 },
    )
  } catch (err) {
    // P2002 (credentialId @unique) = isti authenticator je že registriran.
    if (err instanceof Error && err.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'Ta WebAuthn poverilnica je že registrirana.' },
        { status: 409 },
      )
    }
    logger.error('webauthn', 'Napaka pri shranjevanju device poverilnice:', err)
    return NextResponse.json({ error: REGISTER_FAILED_MESSAGE }, { status: 500 })
  }
}
