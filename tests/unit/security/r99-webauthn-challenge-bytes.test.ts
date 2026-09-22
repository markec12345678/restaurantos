// ============================================
// R99 — device challenge BAJTNI kontrakt (generate*Options)
// ============================================
// LIVE REPRO (R99-b e2e z virtual authenticatorjem): POST
// /api/settings/webauthn/register je vrnil 400 ob ŽIVI ceremony — v14
// generateRegistrationOptions/generateAuthenticationOptions STRING challenge
// tretirajo kot UTF-8 BESEDILO (isoUint8Array.fromUTF8String →
// isoBase64URL.fromBuffer) → ceremony challenge = base64url(utf8(token)) ≠
// token → verifyDeviceChallenge (HMAC struktura payload||MAC) pade → 400/401.
//
// FIX: challenge podan KOT BAJTE (Uint8Array) → lib dela fromBuffer = točen
// base64url tokena; clientDataJSON challenge = token (kanoničen round-trip) →
// extract = token → verifyDeviceChallenge(token) ✓ in expectedChallenge =
// token ✓ (v14 verify primerja RAW string).
//
// Ta test pina kontrakt BREZ nalaganja realnega lib-a (vmThreads crash kanon
// — glej r97-webauthn-endpoints.test.ts): mocka @simplewebauthn/server,
// ujame ARGUMENTE build funkcij in preveri, da je challenge Uint8Array, čigar
// base64url enkodiranje je VELJAVEN signed token (verifyDeviceChallenge).
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  generateRegistrationOptions: vi.fn(),
  generateAuthenticationOptions: vi.fn(),
  verifyRegistrationResponse: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
}))

vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: mocks.generateRegistrationOptions,
  generateAuthenticationOptions: mocks.generateAuthenticationOptions,
  verifyRegistrationResponse: mocks.verifyRegistrationResponse,
  verifyAuthenticationResponse: mocks.verifyAuthenticationResponse,
}))

import {
  buildDeviceRegistrationOptions,
  buildDeviceAuthenticationOptions,
} from '@/lib/webauthn/device-attestation'
import { base64urlEncode } from '@/lib/webauthn'
import { verifyDeviceChallenge } from '@/lib/webauthn/device-attestation'

const LOC = 'loc-1'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.generateRegistrationOptions.mockResolvedValue({
    rp: { id: 'localhost', name: 'RestaurantOS' },
    challenge: 'captured',
    pubKeyCredParams: [],
  })
  mocks.generateAuthenticationOptions.mockResolvedValue({
    rpId: 'localhost',
    challenge: 'captured',
  })
})

/** Iz Ujedanih options izlušči challenge in potrdi bajtni kontrakt. */
function expectByteContract(challenge: unknown): void {
  // Kontrakt: challenge MORA biti bajti (Uint8Array) — NE string (v14 bi
  // string tretiral kot UTF-8 besedilo in pokvaril signed token strukturo).
  expect(challenge).toBeInstanceOf(Uint8Array)
  // base64url enkodiranje bajtov = SIGNED TOKEN, ki mora preživeti
  // verifyDeviceChallenge (HMAC + TTL + lokacijska vezava) — TOČNO to
  // preverjanje delata register/verify ruta nad extracted challenge-om.
  const token = base64urlEncode(challenge as Uint8Array)
  expect(verifyDeviceChallenge(token, LOC)).toBe(true)
  // In negativni kontrol: tuja lokacija pade (token je vezan na LOC).
  expect(verifyDeviceChallenge(token, 'loc-other')).toBe(false)
}

describe('R99: device challenge bajtni kontrakt (v14 UTF-8 besedilo past)', () => {
  it('A: buildDeviceRegistrationOptions poda challenge KOT BAJTE = veljaven signed token za lokacijo', async () => {
    await buildDeviceRegistrationOptions(LOC, 'Test Restavracija', [])
    expect(mocks.generateRegistrationOptions).toHaveBeenCalledTimes(1)
    const args = mocks.generateRegistrationOptions.mock.calls[0][0] as {
      challenge: unknown
      rpID: string
      userName: string
    }
    expect(args.rpID).toBe('localhost')
    expect(args.userName).toBe(`device:${LOC}`)
    expectByteContract(args.challenge)
  })

  it('B: buildDeviceAuthenticationOptions poda challenge KOT BAJTE = veljaven signed token za lokacijo', async () => {
    await buildDeviceAuthenticationOptions(LOC, [])
    expect(mocks.generateAuthenticationOptions).toHaveBeenCalledTimes(1)
    const args = mocks.generateAuthenticationOptions.mock.calls[0][0] as {
      challenge: unknown
      rpID: string
      userVerification: string
    }
    expect(args.rpID).toBe('localhost')
    expect(args.userVerification).toBe('preferred')
    expectByteContract(args.challenge)
  })

  it('C: dva klica = dva RAZLIČNA tokena (naključna nonce v payload-u — ni replay zamenjava)', async () => {
    await buildDeviceAuthenticationOptions(LOC, [])
    await buildDeviceAuthenticationOptions(LOC, [])
    const first = mocks.generateAuthenticationOptions.mock.calls[0][0] as { challenge: Uint8Array }
    const second = mocks.generateAuthenticationOptions.mock.calls[1][0] as { challenge: Uint8Array }
    expect(Buffer.from(first.challenge).equals(Buffer.from(second.challenge))).toBe(false)
    // Oba sta vseeno veljavna tokena za isto lokacijo
    expect(verifyDeviceChallenge(base64urlEncode(first.challenge), LOC)).toBe(true)
    expect(verifyDeviceChallenge(base64urlEncode(second.challenge), LOC)).toBe(true)
  })
})
