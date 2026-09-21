// =====================================================================
// POST /api/auth/webauthn/verify — WebAuthn ASSERTION verifikacija za
// device→location attestation (R97-a temelj; R98 jo veže v prijavni tok —
// login kontrakt ostaja v tem rundi NEDOTAKNJEN).
//
// JAVNO (isti racional kot /api/auth/employees): naprava na znani lokaciji
// dokaže posest poverilnice LOKACIJE še pred sejo. Uspeh vrne
// { location: { id, name } } — lokacijo POVERILNICE (avtoritativno iz baze,
// ne klientove trditve). Ta rundi NE izda seje/tokena (R98 odločitev).
//
// Varnostne plasti (zero-oracle: VSA neuspeha → isti { error } telesa):
//  - rate limit GENERAL_PUBLIC_LIMIT NAJVIŠJI točki handlerja (R90 canon);
//  - neveljaven signed challenge (HMAC / TTL 120 s / lokacija) → unificiran
//    401 z ZERO db klici;
//  - neznana poverilnica → isti 401 (ni obstoja-oraklja);
//  - lokacija poverilnice MORA ujemati lokacijo iz challenge-a (sicer bi
//    lastnik poverilnice lokacije B lahko "dokazal" lokacijo A — javni
//    options endpoint bi to sicer omogočil);
//  - podpis preverjen proti shranjenemu COSE ključu (@simplewebauthn/server);
//  - FIDO2 §6.1 counter: STRICTLY greater kot shranjen (replay/clone → 401);
//    izjema counter==0 → counter==0 (authenticatorji brez counterja — spec).
//  - šele po vseh preverjanjih: counter increment + lastUsedAt.
// =====================================================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkRateLimitAsync, getClientIp, GENERAL_PUBLIC_LIMIT } from '@/lib/rate-limit'
// DIRECT import (ne barrel) — hišni kanon 429 oblike (R92-b)
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { parseJsonBody } from '@/lib/api-utils'
import type { AuthenticationResponseJSON } from '@simplewebauthn/server'
import {
  isDeviceChallengeSecretConfigured,
  extractChallengeFromClientData,
  verifyDeviceChallenge,
  verifyDeviceAssertion,
} from '@/lib/webauthn/device-attestation'

export const dynamic = 'force-dynamic'

// Enotno sporočilo za VSE verifikacijske neuspehe (ni oraklja o VZROKU —
// manjkajoče polje / slab challenge / neznana poverilnica / slab podpis /
// replay so za klienta nedeljiv "verifikacija ni uspela").
const VERIFY_FAILED_MESSAGE = 'WebAuthn verifikacija ni uspela.'

export async function POST(req: Request) {
  // R90 canon model: anonimna površina — throttle pred vsem (tudi pred
  // validacijo telesa; bucket meri surovi promet).
  const rl = await checkRateLimitAsync('auth-webauthn-verify', getClientIp(req), GENERAL_PUBLIC_LIMIT)
  if (!rl.allowed) {
    return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')
  }

  // Fail-closed: brez HMAC skrivnosti v produkciji ni verifikacije.
  if (!isDeviceChallengeSecretConfigured()) {
    return NextResponse.json({ error: VERIFY_FAILED_MESSAGE }, { status: 503 })
  }

  const bodyResult = await parseJsonBody(req)
  if (bodyResult.error) return bodyResult.error

  const { assertion, locationId } = (bodyResult.data || {}) as {
    assertion?: AuthenticationResponseJSON
    locationId?: string
  }

  // Oblikovna validacija (brez DB): assertion + clientDataJSON + locationId.
  const clientDataJSON = assertion?.response?.clientDataJSON
  if (
    !assertion ||
    typeof assertion.id !== 'string' ||
    typeof clientDataJSON !== 'string' ||
    typeof locationId !== 'string' ||
    locationId.length === 0
  ) {
    return NextResponse.json({ error: VERIFY_FAILED_MESSAGE }, { status: 400 })
  }

  // 1) Signed challenge (HMAC + TTL + lokacija) — PRED vsakim DB klicem.
  const challenge = extractChallengeFromClientData(clientDataJSON)
  if (!challenge || !verifyDeviceChallenge(challenge, locationId)) {
    return NextResponse.json({ error: VERIFY_FAILED_MESSAGE }, { status: 401 })
  }

  // 2) Poverilnica mora obstajati (neznana → ISTI unificiran 401).
  const credential = await db.webAuthnCredential.findUnique({
    where: { credentialId: assertion.id },
    select: {
      credentialId: true,
      publicKey: true,
      counter: true,
      transports: true,
      locationId: true,
      location: { select: { id: true, name: true } },
    },
  })
  if (!credential) {
    return NextResponse.json({ error: VERIFY_FAILED_MESSAGE }, { status: 401 })
  }

  // 3) Lokacija poverilnice = lokacija challenge-a (anti cross-location spoof).
  if (credential.locationId !== locationId || !credential.location) {
    return NextResponse.json({ error: VERIFY_FAILED_MESSAGE }, { status: 401 })
  }

  // 4) Kriptografska verifikacija podpisa (COSE ključ iz baze).
  const result = await verifyDeviceAssertion(assertion, challenge, {
    credentialId: credential.credentialId,
    publicKey: credential.publicKey,
    counter: credential.counter,
    transports: credential.transports,
  })
  if (!result.verified || !result.authenticationInfo) {
    return NextResponse.json({ error: VERIFY_FAILED_MESSAGE }, { status: 401 })
  }

  // 5) FIDO2 §6.1 counter — STRICTLY greater (replay/clone reject). Izjema:
  // 0 → 0 (authenticator brez signature counterja — spec dovoljuje).
  const newCounter = result.authenticationInfo.newCounter
  const counterSupported = !(newCounter === 0 && credential.counter === 0)
  if (counterSupported && newCounter <= credential.counter) {
    return NextResponse.json({ error: VERIFY_FAILED_MESSAGE }, { status: 401 })
  }

  // 6) Šele zdaj: counter increment + lastUsedAt (replay okna 120 s je s tem
  // zaprt — ponovljen assertion bi padel na tem koraku prej).
  await db.webAuthnCredential.update({
    where: { credentialId: credential.credentialId },
    data: { counter: newCounter, lastUsedAt: new Date() },
  })

  return NextResponse.json({ location: credential.location })
}
