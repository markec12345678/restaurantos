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
//  - šele po vseh preverjanjih: ATOMARNI counter increment + lastUsedAt
//    (R100: updateMany z counter: { lt } = check-and-set v enem stavku —
//    replay/klon, ki zmaga TOCTOU race na branju, izgubi na pisanju).
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
// R99-a kill switch: ista funkcija kot R79 employee WebAuthn sloj
// (/api/auth/webauthn/route.ts) — barrel ostane lahak (samo env + config).
import { isWebAuthnEnable } from '@/lib/webauthn'

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

  // Kill switch (R99-a): konsistenten z R79 employee WebAuthn slojem —
  // TAKOJŠNJE rate-limit checku (throttle ostane NAJPREJ — R90 canon), PRED
  // secret gate-om. Body je UNIFICIRAN VERIFY_FAILED_MESSAGE (isti error telesa
  // kot vsi ostali verify neuspehi — ni oraklja o tem ZAKAJ je onemogočeno).
  if (!isWebAuthnEnable()) {
    return NextResponse.json({ error: VERIFY_FAILED_MESSAGE }, { status: 503 })
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

  // 6) Šele zdaj: ATOMARNI counter increment + lastUsedAt (R100 TOCTOU fix).
  // Prej: read(2) → verify(4) → update(6) brez pogoja — dva SOČASNA verify
  // klica bi oba prebrala stari counter in replay-ani assertion bi sprejel
  // tudi drugi (klasičen check-then-act race; napadalec z ukradenim
  // assertionom ima 120 s TTL okno za vzporedne poizvedbe). Zdaj: updateMany
  // z counter: { lt: newCounter } je EN atomaren check-and-set — replay, ki
  // pride za prvoupravičenim klicem, najde že povišan counter → count 0 →
  // 401. Dva GENUINA assertion-a (dve ločeni ceremony, counters 5 in 6) pa
  // obe uspešni: 4<5 ✓, nato 5<6 ✓ (guard zavrne SAMO ≤ žive vrednosti).
  // FIDO2 spec izjema counter==0 → counter==0 (authenticator brez
  // signature counterja): 0 < 0 nikoli ne ujame, zato gre le-ta prek
  // navadnega update (samo lastUsedAt; replay zaščito nosi izključno
  // 120 s TTL — kot doslej).
  if (counterSupported) {
    const updated = await db.webAuthnCredential.updateMany({
      where: { credentialId: credential.credentialId, counter: { lt: newCounter } },
      data: { counter: newCounter, lastUsedAt: new Date() },
    })
    if (updated.count === 0) {
      return NextResponse.json({ error: VERIFY_FAILED_MESSAGE }, { status: 401 })
    }
  } else {
    await db.webAuthnCredential.update({
      where: { credentialId: credential.credentialId },
      data: { lastUsedAt: new Date() },
    })
  }

  return NextResponse.json({ location: credential.location })
}
