// ============================================
// R92-b — 429 OBLIKA UNIFIKACIJA — regresijski testi
// ============================================
// R91 backlog (a): hišna 429 oblika je obstajala v DVEH variantah:
//   - CANON (withRateLimit HOF + rotate route iz R91-4): telo
//     'Preveč zahtev. Poskusite znova čez nekaj časa.' + glave Retry-After /
//     X-RateLimit-Remaining / X-RateLimit-Reset (fallback 60 s).
//   - DIVERGENTNA (auth/route.ts IP limit): BREZ glav, login-specifično
//     minute-based telo.
// R92-b: NOV helper src/lib/rate-limit/response.ts (rateLimitedResponse) —
// CANON oblika na enem mestu; auth route sedaj dobi iste glave (telo ostane
// login-specifično, namerno); PIN-lockout 429 ostane ločena oblika (lockout
// ≠ rate limiter — R92 odločitev).
//
// Pokrito:
//   A. Helper unit (rateLimitedResponse): privzeto sporočilo, custom sporočilo,
//      fallback 60 s, pin vseh 3 glav (Retry-After / Remaining '0' / Reset
//      numeričen okoli now + Retry-After).
//   B. Auth route IP rate limit 429 (blokiran): 429 + minute-based telo + glave
//      kanona + ZERO downstream (brez audita, brez PIN validacije, brez
//      lockout knjigovodstva); klic pin (ključ 'auth-login', IP, LOGIN_LIMIT)
//      + vrstni red rate limit < lockout check; fallback brez retryAfterMs.
//   C. Auth route dovoljen → tok naprej do PIN validacije (verifyPin klican,
//      enoten 401); PIN-lockout veja NE uporablja helperja (lasten Retry-After,
//      BREZ X-RateLimit-* — namerno).
//
// Vzorec (r89-token-rotate / r83-guest-routes): vi.hoisted mocki, REALNA zod
// loginSchema validacija prek validateBody mocka (kliče schema.safeParse),
// mockResolvedValue (nikoli .Once), ZERO-downstream asserti na vsaki zavrnitvi.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rateLimitCheck: vi.fn(),
  auditLog: vi.fn(),
  verifyPin: vi.fn(),
  buildAuthResponse: vi.fn(),
  buildAuthStatusResponse: vi.fn(),
  isPinLocked: vi.fn(),
  pinLockoutRemainingMs: vi.fn(),
  recordPinFailure: vi.fn(),
  clearPinFailures: vi.fn(),
  progressiveDelayMs: vi.fn(),
  verifyToken: vi.fn(),
  destroySession: vi.fn(),
  parseJsonBody: vi.fn(),
}))

vi.mock('@/lib/rate-limit', async () => {
  // R92-b: rateLimitedResponse NE mockamo — re-export REALNEGA helperja
  // (rate-limit/response.ts), da auth route testi merijo pravo CANON obliko.
  const response = await import('@/lib/rate-limit/response')
  return {
    checkRateLimitAsync: mocks.rateLimitCheck,
    getClientIp: vi.fn(() => '203.0.113.7'),
    rateLimitedResponse: response.rateLimitedResponse,
    // zrcali realen LOGIN_LIMIT preset (presets.ts: 5 poskusov / 15 min),
    // da objectContaining pin ostane iskren
    LOGIN_LIMIT: { maxRequests: 5, windowMs: 900000 },
  }
})

vi.mock('@/lib/db', () => ({
  db: {},
  createAuditLog: mocks.auditLog,
}))

// _helpers mockan (verifyPin sicer potrebuje bcrypt + pinLookup + db)
vi.mock('@/app/api/auth/_helpers', () => ({
  verifyPin: mocks.verifyPin,
  buildAuthResponse: mocks.buildAuthResponse,
  buildAuthStatusResponse: mocks.buildAuthStatusResponse,
}))

vi.mock('@/lib/auth-middleware', () => ({
  verifyToken: mocks.verifyToken,
  destroySession: mocks.destroySession,
}))

vi.mock('@/lib/auth-middleware/pin-lockout', () => ({
  isPinLocked: mocks.isPinLocked,
  pinLockoutRemainingMs: mocks.pinLockoutRemainingMs,
  recordPinFailure: mocks.recordPinFailure,
  clearPinFailures: mocks.clearPinFailures,
  progressiveDelayMs: mocks.progressiveDelayMs,
}))

// api-utils: parseJsonBody mockan, validateBody pa REALNA pot (kliče
// schema.safeParse nad realno loginSchema, ki jo ruta poda), handleApiError
// passthrough 500 (house vzorec r89/r83)
vi.mock('@/lib/api-utils', () => ({
  parseJsonBody: mocks.parseJsonBody,
  validateBody: (
    schema: { safeParse: (b: unknown) => { success: boolean; data?: unknown } },
    body: unknown
  ) => {
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return {
        data: null,
        error: new Response(JSON.stringify({ error: 'Neveljavni podatki' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
      }
    }
    return { data: parsed.data, error: null }
  },
  handleApiError: vi.fn((_e: unknown, _ctx: string, msg: string) =>
    new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'content-type': 'application/json' } })),
}))

// Route + helper import (PO mockih); response.ts je NEODVISEN modul
// (importira samo next/server) — nanj vi.mock('@/lib/rate-limit') NE vpliva.
import { POST as authPOST } from '@/app/api/auth/route'
import { rateLimitedResponse } from '@/lib/rate-limit/response'

const CANON_MESSAGE = 'Preveč zahtev. Poskusite znova čez nekaj časa.'
const LOGIN_MESSAGE_15MIN = 'Preveč neuspešnih poskusov. Poskusite znova čez 15 min.'

function loginReq(pin = '1234'): Request {
  return new Request('http://localhost:3000/api/auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  // privzeto: body se PRAVILO prebere iz zahtevka (zvesta simulacija),
  // rate limit dovoli, PIN ni zaklenjen — vsak test si nastavi svojo
  // zavrnitev z mockResolvedValue/mockReturnValue
  mocks.parseJsonBody.mockImplementation(async (req: Request) => {
    try {
      return { data: await req.json(), error: null }
    } catch {
      return {
        data: null,
        error: new Response(JSON.stringify({ error: 'Neveljaven JSON' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
      }
    }
  })
  mocks.rateLimitCheck.mockResolvedValue({ allowed: true, remaining: 4 })
  mocks.isPinLocked.mockReturnValue(false)
  mocks.pinLockoutRemainingMs.mockReturnValue(0)
  mocks.verifyPin.mockResolvedValue(null)
  mocks.recordPinFailure.mockReturnValue({ count: 1, locked: false, lockedForMs: 0 })
  mocks.progressiveDelayMs.mockReturnValue(0)
})

// ══════════════════════════════════════════════════════════════════
// A. Helper unit — rateLimitedResponse (CANON 429 oblika)
// ══════════════════════════════════════════════════════════════════
describe('R92-b A: rateLimitedResponse — hišni kanon', () => {
  it('privzeto sporočilo + status 429', async () => {
    const res = rateLimitedResponse(60000)
    expect(res.status).toBe(429)
    const body = await res.json() as { error: string }
    expect(body.error).toBe(CANON_MESSAGE)
  })

  it('custom sporočilo (login minute-based) ohrani status + kanon glav', async () => {
    const res = rateLimitedResponse(900000, LOGIN_MESSAGE_15MIN)
    expect(res.status).toBe(429)
    const body = await res.json() as { error: string }
    expect(body.error).toBe(LOGIN_MESSAGE_15MIN)
    expect(res.headers.get('Retry-After')).toBe('900')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
  })

  it('retryAfterMs undefined → Retry-After pade nazaj na 60 s (house fallback 60000 ms)', async () => {
    const res = rateLimitedResponse(undefined)
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('60')
    const body = await res.json() as { error: string }
    expect(body.error).toBe(CANON_MESSAGE)
  })

  it('glave pin: Retry-After iz ms + Remaining 0 + Reset numeričen ≈ now + Retry-After', () => {
    const beforeSec = Math.floor(Date.now() / 1000)
    const res = rateLimitedResponse(900000)
    expect(res.headers.get('Retry-After')).toBe('900')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
    const reset = Number(res.headers.get('X-RateLimit-Reset'))
    expect(Number.isInteger(reset)).toBe(true)
    expect(reset).toBeGreaterThanOrEqual(beforeSec + 900 - 1)
    expect(reset).toBeLessThanOrEqual(beforeSec + 900 + 2)
  })
})

// ══════════════════════════════════════════════════════════════════
// B. Auth route — IP rate limit 429 (R92-b: glave kanona, ZERO downstream)
// ══════════════════════════════════════════════════════════════════
describe('R92-b B: POST /api/auth — IP rate limit 429', () => {
  it('blocked (900000 ms) → 429 + login telo (15 min) + Retry-After 900 + Remaining 0 + ZERO downstream', async () => {
    mocks.rateLimitCheck.mockResolvedValue({ allowed: false, retryAfterMs: 900000 })
    const res = await authPOST(loginReq())

    expect(res.status).toBe(429)
    const body = await res.json() as { error: string }
    // telo ostane login-specifično (minute-based) — Math.ceil(900000/60000) = 15
    expect(body.error).toBe(LOGIN_MESSAGE_15MIN)
    // NOVE glave (R92-b — prej NIČ): Math.ceil(900000/1000) = 900
    expect(res.headers.get('Retry-After')).toBe('900')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(Number(res.headers.get('X-RateLimit-Reset'))).toBeGreaterThan(0)

    // ZERO downstream: zavrnitev gre PRED lockout checkom, PIN validacijo
    // in vsakim zapisom (brez audita, brez lockout knjigovodstva)
    expect(mocks.auditLog).not.toHaveBeenCalled()
    expect(mocks.isPinLocked).not.toHaveBeenCalled()
    expect(mocks.verifyPin).not.toHaveBeenCalled()
    expect(mocks.recordPinFailure).not.toHaveBeenCalled()
  })

  it('klic pin: ključ auth-login + IP + LOGIN_LIMIT (5/15 min); rate limit PREJ lockout checka', async () => {
    await authPOST(loginReq())

    expect(mocks.rateLimitCheck).toHaveBeenCalledTimes(1)
    expect(mocks.rateLimitCheck).toHaveBeenCalledWith(
      'auth-login',
      '203.0.113.7',
      expect.objectContaining({ maxRequests: 5, windowMs: 900000 }),
    )
    // vrstni red: rate limit šele za body parse/validacijo, PRED per-PIN
    // lockout preverjanjem (lockout plast je lokalen, rate limit globalen)
    expect(mocks.rateLimitCheck.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.isPinLocked.mock.invocationCallOrder[0])
  })

  it('blocked brez retryAfterMs → Retry-After pade nazaj na 60 (helper kanon) + telo ostane minute-based', async () => {
    mocks.rateLimitCheck.mockResolvedValue({ allowed: false })
    const res = await authPOST(loginReq())

    expect(res.status).toBe(429)
    // glava po kanonu helperja (fallback 60000 ms); telo po routinem fallbacku
    // (900000 ms → 15 min). Asimetrija je teoretična — core.ts fail-closed vedno
    // nastavi retryAfterMs = windowMs, v produkciji se fallback ne sproži.
    expect(res.headers.get('Retry-After')).toBe('60')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
    const body = await res.json() as { error: string }
    expect(body.error).toBe(LOGIN_MESSAGE_15MIN)
    expect(mocks.auditLog).not.toHaveBeenCalled()
    expect(mocks.verifyPin).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// C. Auth route — dovoljen tok + PIN-lockout veja (namerno BREZ helperja)
// ══════════════════════════════════════════════════════════════════
describe('R92-b C: POST /api/auth — dovoljen tok in lockout ločitev', () => {
  it('allowed → PIN validacija tok (verifyPin klican) → enoten 401 za napačen PIN', async () => {
    const res = await authPOST(loginReq('9999'))

    // dokaz, da je tok PREDEL rate-limit vrata (P1-12: enoten 401, brez
    // user enumeracije)
    expect(mocks.rateLimitCheck).toHaveBeenCalledTimes(1)
    expect(mocks.verifyPin).toHaveBeenCalledTimes(1)
    expect(mocks.verifyPin).toHaveBeenCalledWith({ pin: '9999' })
    expect(res.status).toBe(401)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Napačen PIN ali nedejaven uporabnik')
    // neuspešen poskus se zabeleži (lockout števec + audit LOGIN_FAILED)
    expect(mocks.recordPinFailure).toHaveBeenCalledWith('9999')
    expect(mocks.auditLog).toHaveBeenCalledTimes(1)
    expect(mocks.auditLog.mock.calls[0][0]).toMatchObject({ action: 'LOGIN_FAILED' })
  })

  it('PIN-lockout 429 NE uporablja helperja — lasten Retry-After, BREZ X-RateLimit-* glav (lockout ≠ rate limiter)', async () => {
    mocks.isPinLocked.mockReturnValue(true)
    mocks.pinLockoutRemainingMs.mockReturnValue(900000)
    const res = await authPOST(loginReq())

    expect(res.status).toBe(429)
    const body = await res.json() as { error: string }
    // Math.ceil(900000/1000)=900 s → Math.ceil(900/60)=15 min (ista telo logika)
    expect(body.error).toBe(LOGIN_MESSAGE_15MIN)
    expect(res.headers.get('Retry-After')).toBe('900')
    // R92 odločitev: lockout je ZAKLEP, ne vedro — X-RateLimit-* glave namerno
    // IZOSTANEO (lockout plast ima svoj Retry-After, ne kanona rate limiterja)
    expect(res.headers.get('X-RateLimit-Remaining')).toBeNull()
    expect(res.headers.get('X-RateLimit-Reset')).toBeNull()
    // lockout zapiše audit sled in NE gre do PIN validacije
    expect(mocks.auditLog).toHaveBeenCalledTimes(1)
    expect(mocks.auditLog.mock.calls[0][0]).toMatchObject({ action: 'LOGIN_FAILED_LOCKOUT' })
    expect(mocks.verifyPin).not.toHaveBeenCalled()
  })
})
