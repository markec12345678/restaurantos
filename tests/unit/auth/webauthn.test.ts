// ============================================
// WEBAUTHN — Unit testi za lib + challenge store
// ============================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Helper: set/delete env v testih brez TS pritožb o read-only
const setEnv = (key: string, value: string | undefined) => {
  if (value === undefined) {
    delete (process.env as Record<string, string | undefined>)[key]
  } else {
    ;(process.env as Record<string, string | undefined>)[key] = value
  }
}

describe('webauthn lib — base64url', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('base64urlEncode proizvede RFC 4648 §5 output (brez =, +, /)', async () => {
    const { base64urlEncode } = await import('@/lib/webauthn')
    const bytes = new Uint8Array([0xff, 0xfb, 0x7f, 0x00, 0x62, 0x83, 0xfc])
    const encoded = base64urlEncode(bytes)
    expect(encoded).not.toContain('=')
    expect(encoded).not.toContain('+')
    expect(encoded).not.toContain('/')
  })

  it('base64urlEncode + base64urlDecode sta inverzljivi', async () => {
    const { base64urlEncode, base64urlDecode } = await import('@/lib/webauthn')
    const original = new Uint8Array(Array.from({ length: 64 }, (_, i) => (i * 7) % 256))
    const encoded = base64urlEncode(original)
    const decoded = base64urlDecode(encoded)
    expect(Array.from(decoded)).toEqual(Array.from(original))
  })

  it('base64urlDecode pravilno doda padding', async () => {
    const { base64urlEncode, base64urlDecode } = await import('@/lib/webauthn')
    const original = new Uint8Array([1, 2, 3, 4, 5])
    const encoded = base64urlEncode(original)
    expect(encoded.length % 4).not.toBe(0)
    const decoded = base64urlDecode(encoded)
    expect(Array.from(decoded)).toEqual([1, 2, 3, 4, 5])
  })
})

describe('webauthn lib — generateChallenge', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('vrne 43-znakoven base64url string (32 bajtov)', async () => {
    const { generateChallenge } = await import('@/lib/webauthn')
    const challenge = generateChallenge()
    expect(typeof challenge).toBe('string')
    expect(challenge.length).toBe(43)
  })

  it('je base64url (brez =, +, /)', async () => {
    const { generateChallenge } = await import('@/lib/webauthn')
    const challenge = generateChallenge()
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('je naključen — dva klica ne dasta enakega challenge-a', async () => {
    const { generateChallenge } = await import('@/lib/webauthn')
    const c1 = generateChallenge()
    const c2 = generateChallenge()
    expect(c1).not.toBe(c2)
  })
})

describe('webauthn lib — getWebAuthnConfig', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    setEnv('NEXTAUTH_URL', undefined)
    setEnv('NEXT_PUBLIC_APP_URL', undefined)
    setEnv('NEXT_PUBLIC_APP_NAME', undefined)
  })

  it('uporablja NEXTAUTH_URL za rpID + origin', async () => {
    setEnv('NEXTAUTH_URL', 'https://pos.example.com')
    const { getWebAuthnConfig } = await import('@/lib/webauthn')
    const config = getWebAuthnConfig()
    expect(config.rpID).toBe('pos.example.com')
    expect(config.origin).toBe('https://pos.example.com')
  })

  it('obdrži port če je prisoten v NEXTAUTH_URL', async () => {
    setEnv('NEXTAUTH_URL', 'http://localhost:3000')
    const { getWebAuthnConfig } = await import('@/lib/webauthn')
    const config = getWebAuthnConfig()
    expect(config.rpID).toBe('localhost')
    expect(config.origin).toBe('http://localhost:3000')
  })

  it('uporablja NEXT_PUBLIC_APP_NAME za rpName', async () => {
    setEnv('NEXTAUTH_URL', 'https://pos.example.com')
    setEnv('NEXT_PUBLIC_APP_NAME', 'My POS')
    const { getWebAuthnConfig } = await import('@/lib/webauthn')
    const config = getWebAuthnConfig()
    expect(config.rpName).toBe('My POS')
  })

  it('fallback na RestaurantOS + localhost:3000 če env manjka', async () => {
    setEnv('NEXTAUTH_URL', undefined)
    setEnv('NEXT_PUBLIC_APP_URL', undefined)
    const { getWebAuthnConfig } = await import('@/lib/webauthn')
    const config = getWebAuthnConfig()
    expect(config.rpName).toBe('RestaurantOS')
    expect(config.origin).toBe('http://localhost:3000')
  })

  it('fallback na localhost če NEXTAUTH_URL ni veljaven URL', async () => {
    setEnv('NEXTAUTH_URL', 'not-a-valid-url')
    const { getWebAuthnConfig } = await import('@/lib/webauthn')
    const config = getWebAuthnConfig()
    expect(config.origin).toBe('http://localhost:3000')
    expect(config.rpID).toBe('localhost')
  })
})

describe('webauthn lib — isWebAuthnEnable', () => {
  beforeEach(() => {
    vi.resetModules()
    setEnv('WEBAUTHN_ENABLED', undefined)
    setEnv('NODE_ENV', undefined)
    setEnv('NEXTAUTH_URL', undefined)
  })

  it('vrne true ko je WEBAUTHN_ENABLED=true', async () => {
    setEnv('WEBAUTHN_ENABLED', 'true')
    const { isWebAuthnEnable } = await import('@/lib/webauthn')
    expect(isWebAuthnEnable()).toBe(true)
  })

  it('vrne false ko je WEBAUTHN_ENABLED=false', async () => {
    setEnv('WEBAUTHN_ENABLED', 'false')
    const { isWebAuthnEnable } = await import('@/lib/webauthn')
    expect(isWebAuthnEnable()).toBe(false)
  })

  it('vrne false ko env spremenljivka manjka', async () => {
    setEnv('WEBAUTHN_ENABLED', undefined)
    const { isWebAuthnEnable } = await import('@/lib/webauthn')
    expect(isWebAuthnEnable()).toBe(false)
  })

  it('vrne true v produkciji s HTTPS origin-om', async () => {
    setEnv('NODE_ENV', 'production')
    setEnv('NEXTAUTH_URL', 'https://pos.example.com')
    const { isWebAuthnEnable } = await import('@/lib/webauthn')
    expect(isWebAuthnEnable()).toBe(true)
  })

  it('vrne false v produkciji z HTTP origin-om (ni HTTPS)', async () => {
    setEnv('NODE_ENV', 'production')
    setEnv('NEXTAUTH_URL', 'http://insecure.example.com')
    const { isWebAuthnEnable } = await import('@/lib/webauthn')
    expect(isWebAuthnEnable()).toBe(false)
  })

  it('vrne false v development okolju tudi s HTTPS origin-om', async () => {
    setEnv('NODE_ENV', 'development')
    setEnv('NEXTAUTH_URL', 'https://pos.example.com')
    const { isWebAuthnEnable } = await import('@/lib/webauthn')
    expect(isWebAuthnEnable()).toBe(false)
  })
})

describe('webauthn lib — parseTransports', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('filtrira neveljavne transporte, obdrži veljavne', async () => {
    const { parseTransports } = await import('@/lib/webauthn')
    const json = JSON.stringify(['usb', 'invalid', 'nfc', 'bogus', 'internal'])
    const parsed = parseTransports(json)
    expect(parsed).toEqual(['usb', 'nfc', 'internal'])
  })

  it('vrne prazno tabelo za neveljaven JSON', async () => {
    const { parseTransports } = await import('@/lib/webauthn')
    expect(parseTransports('not-json')).toEqual([])
  })

  it('vrne prazno tabelo za ne-tabelo JSON', async () => {
    const { parseTransports } = await import('@/lib/webauthn')
    expect(parseTransports('{}')).toEqual([])
    expect(parseTransports('"usb"')).toEqual([])
    expect(parseTransports('42')).toEqual([])
  })

  it('vrne prazno tabelo za prazno tabelo', async () => {
    const { parseTransports } = await import('@/lib/webauthn')
    expect(parseTransports('[]')).toEqual([])
  })

  it('obdela vse veljavne transporte iz spec-a', async () => {
    const { parseTransports } = await import('@/lib/webauthn')
    const valid = ['ble', 'cable', 'hybrid', 'internal', 'nfc', 'smart-card', 'usb']
    const json = JSON.stringify(valid)
    const parsed = parseTransports(json)
    expect(parsed.sort()).toEqual([...valid].sort())
  })
})

// ============================================
// CHALLENGE STORE TESTS
// ============================================

describe('webauthn challenge-store', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('save → take vrne isti challenge', async () => {
    const { saveChallenge, takeChallenge } = await import('@/lib/webauthn/challenge-store')
    saveChallenge('user-123', 'test-challenge-abc')
    const retrieved = takeChallenge('user-123')
    expect(retrieved).toBe('test-challenge-abc')
  })

  it('take BRIŠE challenge (one-shot) — drugi klic vrne null', async () => {
    const { saveChallenge, takeChallenge } = await import('@/lib/webauthn/challenge-store')
    saveChallenge('user-456', 'test-challenge')
    takeChallenge('user-456')
    const second = takeChallenge('user-456')
    expect(second).toBeNull()
  })

  it('take za neobstoječi ključ vrne null', async () => {
    const { takeChallenge } = await import('@/lib/webauthn/challenge-store')
    expect(takeChallenge('nonexistent-key')).toBeNull()
  })

  it('save z custom TTL — preteče po ttl', async () => {
    const { saveChallenge, takeChallenge } = await import('@/lib/webauthn/challenge-store')
    saveChallenge('ttl-key', 'short-lived', 50)
    await new Promise((r) => setTimeout(r, 100))
    const retrieved = takeChallenge('ttl-key')
    expect(retrieved).toBeNull()
  })

  it('challenge je še vedno veljaven tik pred TTL-jem', async () => {
    const { saveChallenge, takeChallenge } = await import('@/lib/webauthn/challenge-store')
    saveChallenge('ttl-key-2', 'short-lived', 200)
    await new Promise((r) => setTimeout(r, 100))
    const retrieved = takeChallenge('ttl-key-2')
    expect(retrieved).toBe('short-lived')
  })

  it('save z istim ključem overwrite-a prejšnji challenge', async () => {
    const { saveChallenge, takeChallenge } = await import('@/lib/webauthn/challenge-store')
    saveChallenge('overwrite-key', 'challenge-1')
    saveChallenge('overwrite-key', 'challenge-2')
    const retrieved = takeChallenge('overwrite-key')
    expect(retrieved).toBe('challenge-2')
  })

  it('challengeStoreSize vrne število aktivnih challenge-jev', async () => {
    const { saveChallenge, challengeStoreSize, takeChallenge, clearChallenges } = await import('@/lib/webauthn/challenge-store')
    clearChallenges()
    saveChallenge('size-1', 'a')
    saveChallenge('size-2', 'b')
    saveChallenge('size-3', 'c')
    expect(challengeStoreSize()).toBeGreaterThanOrEqual(3)
    takeChallenge('size-1')
    expect(challengeStoreSize()).toBeGreaterThanOrEqual(2)
  })

  it('clearChallenges izprazni celoten store', async () => {
    const { saveChallenge, takeChallenge, clearChallenges, challengeStoreSize } = await import('@/lib/webauthn/challenge-store')
    saveChallenge('clear-1', 'a')
    saveChallenge('clear-2', 'b')
    clearChallenges()
    expect(takeChallenge('clear-1')).toBeNull()
    expect(takeChallenge('clear-2')).toBeNull()
    expect(challengeStoreSize()).toBe(0)
  })
})

// ============================================
// DB HELPERS — mock Prisma
// ============================================

describe('webauthn db-helpers', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('parseTransportsFromDb obdela JSON string iz baze', async () => {
    const { parseTransportsFromDb } = await import('@/lib/webauthn/db-helpers')
    expect(parseTransportsFromDb('["usb", "nfc"]')).toEqual(['usb', 'nfc'])
    expect(parseTransportsFromDb('[]')).toEqual([])
    expect(parseTransportsFromDb('invalid')).toEqual([])
    expect(parseTransportsFromDb('{}')).toEqual([])
  })
})
