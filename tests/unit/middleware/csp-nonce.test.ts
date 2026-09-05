// ============================================
// CSP NONCE — Unit testi
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { generateCspNonce, formatNonceForCsp, cspHasUnsafeInline } from '@/lib/middleware/csp-nonce'
import type { NextRequest, NextResponse } from 'next/server'

function createMockResponse(): NextResponse {
  const headers = new Map<string, string>()
  return {
    headers: {
      set: (key: string, value: string) => {
        headers.set(key, value)
      },
      get: (key: string) => headers.get(key) || null,
    },
    cookies: {
      set: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
    },
  } as unknown as NextResponse
}

function createMockRequest(protocol: 'http:' | 'https:' = 'http:'): NextRequest {
  return {
    nextUrl: {
      protocol,
      hostname: 'localhost',
      pathname: '/',
    },
    headers: new Headers(),
    cookies: {
      get: vi.fn(),
    },
  } as unknown as NextRequest
}

// Helper: set/delete env v testih brez TS pritožb o read-only
const setEnv = (key: string, value: string | undefined) => {
  if (value === undefined) {
    delete (process.env as Record<string, string | undefined>)[key]
  } else {
    ;(process.env as Record<string, string | undefined>)[key] = value
  }
}

describe('csp-nonce — generateCspNonce', () => {
  it('vrne base64 string', () => {
    const nonce = generateCspNonce()
    expect(typeof nonce).toBe('string')
    expect(nonce).toMatch(/^[A-Za-z0-9+/]+={0,2}$/)
  })

  it('ima ≥24 znakov (18 bajtov base64)', () => {
    const nonce = generateCspNonce()
    expect(nonce.length).toBe(24)
  })

  it('je naključen — dva klica ne dasta enakega nonce-a', () => {
    const nonce1 = generateCspNonce()
    const nonce2 = generateCspNonce()
    expect(nonce1).not.toBe(nonce2)
  })

  it('1000 klicev ne proizvede duplikatov (collision resistance)', () => {
    const nonces = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      nonces.add(generateCspNonce())
    }
    expect(nonces.size).toBe(1000)
  })
})

describe('csp-nonce — formatNonceForCsp', () => {
  it('formatira nonce v CSP direktivo', () => {
    expect(formatNonceForCsp('abc123==')).toBe("'nonce-abc123=='")
  })

  it('ohrani base64 padding', () => {
    expect(formatNonceForCsp('YWJj==')).toBe("'nonce-YWJj=='")
  })

  it('obdela prazen nonce (graceful)', () => {
    expect(formatNonceForCsp('')).toBe("'nonce-'")
  })
})

describe('csp-nonce — cspHasUnsafeInline', () => {
  it('vrne true ko CSP vsebuje unsafe-inline v script-src', () => {
    const csp = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self'"
    expect(cspHasUnsafeInline(csp)).toBe(true)
  })

  it('vrne false ko CSP nima unsafe-inline v script-src', () => {
    const csp = "default-src 'self'; script-src 'self' 'nonce-abc123'; style-src 'self' 'unsafe-inline'"
    expect(cspHasUnsafeInline(csp)).toBe(false)
  })

  it('vrne false ko CSP sploh nima script-src direktive', () => {
    const csp = "default-src 'self'; style-src 'self'"
    expect(cspHasUnsafeInline(csp)).toBe(false)
  })

  it('ignorira unsafe-inline v style-src (samo script-src šteje)', () => {
    const csp = "default-src 'self'; script-src 'self' 'nonce-abc'; style-src 'self' 'unsafe-inline'"
    expect(cspHasUnsafeInline(csp)).toBe(false)
  })

  it('vrne false za prazen CSP', () => {
    expect(cspHasUnsafeInline('')).toBe(false)
  })
})

describe('applySecurityHeaders — CSP nonce generation', () => {
  beforeEach(() => {
    vi.resetModules()
    setEnv('NODE_ENV', undefined)
  })

  it('nastavi CSP z nonce-jem v produkciji (brez unsafe-inline v script-src)', async () => {
    setEnv('NODE_ENV', 'production')
    const { applySecurityHeaders } = await import('@/lib/middleware/security-headers')
    const res = createMockResponse()
    const req = createMockRequest('https:')

    const result = applySecurityHeaders(res, req)

    const csp = res.headers.get('Content-Security-Policy') || ''
    const scriptSrc = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src')) || ''
    expect(scriptSrc).toContain("'nonce-")
    expect(scriptSrc).not.toContain("'unsafe-inline'")
    expect(scriptSrc).not.toContain("'unsafe-eval'")
    const styleSrc = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('style-src')) || ''
    // FIX Issue #34: style-src ne sme vsebovati 'unsafe-inline' (nonce-based)
    expect(styleSrc).not.toContain("'unsafe-inline'")
    expect(styleSrc).toContain("'nonce-")
    expect(result.nonce.length).toBeGreaterThanOrEqual(24)
  })

  it('v dev vsebuje unsafe-eval v script-src (HMR zahteva) vendar NE unsafe-inline', async () => {
    setEnv('NODE_ENV', 'development')
    const { applySecurityHeaders } = await import('@/lib/middleware/security-headers')
    const res = createMockResponse()
    const req = createMockRequest('http:')

    applySecurityHeaders(res, req)

    const csp = res.headers.get('Content-Security-Policy') || ''
    const scriptSrc = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src')) || ''
    expect(scriptSrc).toContain("'unsafe-eval'")
    expect(scriptSrc).toContain("'nonce-")
    expect(scriptSrc).not.toContain("'unsafe-inline'")
  })

  it('vsak klic generira drugačen nonce (per-request)', async () => {
    setEnv('NODE_ENV', 'production')
    const { applySecurityHeaders } = await import('@/lib/middleware/security-headers')

    const res1 = createMockResponse()
    const res2 = createMockResponse()
    const req = createMockRequest('https:')

    const result1 = applySecurityHeaders(res1, req)
    const result2 = applySecurityHeaders(res2, req)

    expect(result1.nonce).not.toBe(result2.nonce)
  })

  it('nastavi x-csp-nonce header za debug/future use', async () => {
    setEnv('NODE_ENV', 'production')
    const { applySecurityHeaders } = await import('@/lib/middleware/security-headers')
    const res = createMockResponse()
    const req = createMockRequest('https:')

    const result = applySecurityHeaders(res, req)

    expect(res.headers.get('x-csp-nonce')).toBe(result.nonce)
  })

  it('ohrani druge varnostne headerje', async () => {
    setEnv('NODE_ENV', 'production')
    const { applySecurityHeaders } = await import('@/lib/middleware/security-headers')
    const res = createMockResponse()
    const req = createMockRequest('https:')

    applySecurityHeaders(res, req)

    expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN')
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(res.headers.get('Strict-Transport-Security')).toContain('max-age=31536000')
    expect(res.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin')
    expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin')
  })

  it('HSTS je prisoten samo v produkciji ali HTTPS', async () => {
    setEnv('NODE_ENV', 'development')
    const { applySecurityHeaders } = await import('@/lib/middleware/security-headers')
    const res1 = createMockResponse()
    const req1 = createMockRequest('http:')
    applySecurityHeaders(res1, req1)
    expect(res1.headers.get('Strict-Transport-Security')).toBeNull()

    setEnv('NODE_ENV', 'production')
    const res2 = createMockResponse()
    const req2 = createMockRequest('http:')
    applySecurityHeaders(res2, req2)
    expect(res2.headers.get('Strict-Transport-Security')).toContain('max-age')
  })
})
