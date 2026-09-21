// =====================================================================
// GET /api/auth/webauthn/options?locationId=X — WebAuthn device attestation
// options (R97-a: passkey temelj za device→location binding)
//
// JAVNA površina (isti racional kot GET /api/auth/employees, R95): kiosk
// naprava na znani lokaciji rabi WebAuthn options PRED vsako sejo —
// registracija poverilnice je pa vseeno ADMIN-gated (POST
// /api/settings/webauthn/register), assertion verifikacija je javna
// (POST /api/auth/webauthn/verify — R98 jo vezane v prijavni tok).
//
// CHALLENGE STRATEGIJA (stateless, brez DB tabele — glej
// src/lib/webauthn/device-attestation.ts): HMAC-podpisan token
// base64url(payload || MAC) z TTL 120 s; single-use enforcement = kratek TTL
// + FIDO2 counter check; lokacija je vezana v payload ('l').
//
// Varnostne plasti:
//  - rate limit GENERAL_PUBLIC_LIMIT (20/min) NAJVIŠJI točki handlerja
//    (R90 canon model — throttle PRED validacijo/DB);
//  - produkcija brez challenge skrivnosti → 503 fail-closed (nikoli dev
//    secret v produkciji — ordering-token kanon);
//  - manjkajoč / slab format / neznana / neaktivna lokacija → unificiran
//    notInScopeResponse 404 (ni obstoja-oraklja; ZERO db klicev za prva dva);
//  - odgovor servisira registration (DeviceTab "Registriraj ključ") IN
//    authentication (R98 prijavna integracija) options z ISTIM signed
//    challenge-om — odločitev o prijavni veji je za R98 (login kontrakt
//    ostaja v tem rundi NEDOTAKNJEN).
// =====================================================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkRateLimitAsync, getClientIp, GENERAL_PUBLIC_LIMIT } from '@/lib/rate-limit'
// DIRECT import (ne barrel) — hišni kanon 429 oblike (R92-b)
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { notInScopeResponse } from '@/lib/tenant-scope'
import {
  isDeviceChallengeSecretConfigured,
  buildDeviceRegistrationOptions,
  buildDeviceAuthenticationOptions,
} from '@/lib/webauthn/device-attestation'

export const dynamic = 'force-dynamic'

// Dovoljena oblika locationId — ENAK vzorec kot LOCATION_ID_RE v
// src/lib/ordering-token.ts (prisma cuid/uuid-like, 5–50 znakov
// [a-zA-Z0-9_-]). Regex je samo vhodna sanitacija PRED poizvedbo (zero db
// klicev za slab format); varnost nosi where { isActive: true }.
const LOCATION_ID_RE = /^[a-zA-Z0-9_-]{5,50}$/

export async function GET(req: Request) {
  // R90 canon model: anonimna površina — throttle pred vsem.
  const rl = await checkRateLimitAsync('auth-webauthn-options', getClientIp(req), GENERAL_PUBLIC_LIMIT)
  if (!rl.allowed) {
    return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')
  }

  // Fail-closed: brez HMAC skrivnosti v produkciji NE izdajamo challenge-jev
  // (dev/test ima fiksen fallback — nikoli javno znani secret v produkciji).
  if (!isDeviceChallengeSecretConfigured()) {
    return NextResponse.json(
      { error: 'WebAuthn device attestation ni konfiguriran (503).' },
      { status: 503 },
    )
  }

  // ?locationId je OBVEZEN: manjkajoč ali napačen format → isti unificiran 404.
  const id = new URL(req.url).searchParams.get('locationId')?.trim() || ''
  if (!id || !LOCATION_ID_RE.test(id)) {
    return notInScopeResponse('Lokacija')
  }

  // Lokacija MORA obstajati IN biti AKTIVNA (neznana / tuja / neaktivna → ISTI 404).
  const location = await db.location.findFirst({
    where: { id, isActive: true },
    select: { id: true, name: true },
  })
  if (!location) {
    return notInScopeResponse('Lokacija')
  }

  // Obstoječe poverilnice lokacije → excludeCredentials (prepreči dvojno
  // registracijo istega authenticatorja) + allowCredentials za authentication
  // vejo. Brez publicKey v exclude/allow (samo credentialId + transports).
  const existing = await db.webAuthnCredential.findMany({
    where: { locationId: id },
    select: { credentialId: true, transports: true },
  })

  // Obe veji delita ISTI signed challenge (enoten TTL/enoten HMAC).
  const registration = await buildDeviceRegistrationOptions(id, location.name, existing)
  const authentication = await buildDeviceAuthenticationOptions(id, existing)
  const challenge = registration.challenge

  const res = NextResponse.json({
    location,
    challenge,
    rpID: registration.rp.id,
    registration,
    authentication,
  })
  res.headers.set('Cache-Control', 'no-store')
  return res
}
