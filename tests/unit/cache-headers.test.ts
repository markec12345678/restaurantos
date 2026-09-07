// ============================================
// CACHING HELPER TESTS — Cache-Control + ETag
// ============================================
import { describe, it, expect } from 'vitest'
import { NextResponse } from 'next/server'
import {
  CachePresets,
  withCache,
  generateETag,
  checkETagMatch,
  withETag,
} from '@/lib/middleware/cache-headers'

describe('Cache headers — Cache-Control presets', () => {
  it('PUBLIC_SHORT: 5min cache + 1h stale-while-revalidate', () => {
    expect(CachePresets.PUBLIC_SHORT).toContain('max-age=300')
    expect(CachePresets.PUBLIC_SHORT).toContain('stale-while-revalidate=3600')
    expect(CachePresets.PUBLIC_SHORT).toContain('public')
  })

  it('PUBLIC_LONG: 1h cache + 24h stale', () => {
    expect(CachePresets.PUBLIC_LONG).toContain('max-age=3600')
    expect(CachePresets.PUBLIC_LONG).toContain('stale-while-revalidate=86400')
  })

  it('STATIC: immutable', () => {
    expect(CachePresets.STATIC).toContain('immutable')
    expect(CachePresets.STATIC).toContain('max-age=86400')
  })

  it('PRIVATE_NO_CACHE: private + no-cache + no-store', () => {
    expect(CachePresets.PRIVATE_NO_CACHE).toContain('private')
    expect(CachePresets.PRIVATE_NO_CACHE).toContain('no-cache')
    expect(CachePresets.PRIVATE_NO_CACHE).toContain('no-store')
  })

  it('REALTIME: no-store + must-revalidate', () => {
    expect(CachePresets.REALTIME).toContain('no-store')
    expect(CachePresets.REALTIME).toContain('must-revalidate')
  })

  it('SENSITIVE: no-store + private', () => {
    expect(CachePresets.SENSITIVE).toContain('no-store')
    expect(CachePresets.SENSITIVE).toContain('private')
  })
})

describe('withCache — dodaj Cache-Control header', () => {
  it('doda Cache-Control header na NextResponse', () => {
    const response = NextResponse.json({ data: 'test' })
    const result = withCache(response, CachePresets.PUBLIC_SHORT)
    expect(result.headers.get('Cache-Control')).toBe(CachePresets.PUBLIC_SHORT)
  })

  it('ohrani obstoječe headerje', () => {
    const response = NextResponse.json({ data: 'test' })
    response.headers.set('X-Custom', 'value')
    const result = withCache(response, CachePresets.PUBLIC_LONG)
    expect(result.headers.get('X-Custom')).toBe('value')
    expect(result.headers.get('Cache-Control')).toBe(CachePresets.PUBLIC_LONG)
  })
})

describe('generateETag — generiraj ETag iz body', () => {
  it('generira quoted hex string', () => {
    const etag = generateETag({ data: 'test' })
    expect(etag).toMatch(/^"[a-f0-9]+"$/)
  })

  it('je determinističen — isti input = isti ETag', () => {
    const body = { data: 'test', nested: { value: 42 } }
    const etag1 = generateETag(body)
    const etag2 = generateETag(body)
    expect(etag1).toBe(etag2)
  })

  it('sprememba v body spremeni ETag', () => {
    const body1 = { data: 'test' }
    const body2 = { data: 'test2' }
    expect(generateETag(body1)).not.toBe(generateETag(body2))
  })

  it('sprejema string input', () => {
    const etag = generateETag('hello world')
    expect(etag).toMatch(/^"[a-f0-9]+"$/)
  })

  it('sprejema array input', () => {
    const etag = generateETag([1, 2, 3])
    expect(etag).toMatch(/^"[a-f0-9]+"$/)
  })
})

describe('checkETagMatch — preveri If-None-Match header', () => {
  it('vrne false če header manjka', () => {
    const req = new Request('https://example.com/api/test')
    expect(checkETagMatch(req, '"abc123"')).toBe(false)
  })

  it('vrne true če se ETag ujema', () => {
    const req = new Request('https://example.com/api/test', {
      headers: { 'if-none-match': '"abc123"' },
    })
    expect(checkETagMatch(req, '"abc123"')).toBe(true)
  })

  it('vrne false če se ETag ne ujema', () => {
    const req = new Request('https://example.com/api/test', {
      headers: { 'if-none-match': '"different"' },
    })
    expect(checkETagMatch(req, '"abc123"')).toBe(false)
  })

  it('podpira wildcard *', () => {
    const req = new Request('https://example.com/api/test', {
      headers: { 'if-none-match': '*' },
    })
    expect(checkETagMatch(req, '"abc123"')).toBe(true)
  })

  it('podpira comma-separated ETags', () => {
    const req = new Request('https://example.com/api/test', {
      headers: { 'if-none-match': '"etag1", "etag2", "abc123"' },
    })
    expect(checkETagMatch(req, '"abc123"')).toBe(true)
  })
})

describe('withETag — dodaj ETag in preveri If-None-Match', () => {
  it('doda ETag header na response', () => {
    const req = new Request('https://example.com/api/test')
    const response = NextResponse.json({ data: 'test' })
    const result = withETag(req, response, { data: 'test' })
    expect(result.headers.get('ETag')).toMatch(/^"[a-f0-9]+"$/)
    expect(result.status).toBe(200)
  })

  it('vrne 304 če se ETag ujema', () => {
    const body = { data: 'test' }
    const etag = generateETag(body)
    const req = new Request('https://example.com/api/test', {
      headers: { 'if-none-match': etag },
    })
    const response = NextResponse.json(body)
    const result = withETag(req, response, body)
    expect(result.status).toBe(304)
  })

  it('vrne 200 z ETag če se ne ujema', () => {
    const body = { data: 'test' }
    const req = new Request('https://example.com/api/test', {
      headers: { 'if-none-match': '"different-etag"' },
    })
    const response = NextResponse.json(body)
    const result = withETag(req, response, body)
    expect(result.status).toBe(200)
    expect(result.headers.get('ETag')).toBeDefined()
  })
})

describe('API Versioning', () => {
  it('CURRENT_API_VERSION je 1', async () => {
    const mod = await import('@/lib/middleware/api-version')
    expect(mod.CURRENT_API_VERSION).toBe(1)
  })

  it('getApiVersion vrača default če header manjka', async () => {
    const mod = await import('@/lib/middleware/api-version')
    const req = new Request('https://example.com/api/test')
    expect(mod.getApiVersion(req)).toBe(1)
  })

  it('getApiVersion bere X-API-Version header', async () => {
    const mod = await import('@/lib/middleware/api-version')
    const req = new Request('https://example.com/api/test', {
      headers: { 'x-api-version': '1' },
    })
    expect(mod.getApiVersion(req)).toBe(1)
  })

  it('isVersionSupported vrača true za podprto verzijo', async () => {
    const mod = await import('@/lib/middleware/api-version')
    expect(mod.isVersionSupported(1)).toBe(true)
    expect(mod.isVersionSupported(99)).toBe(false)
  })

  it('withApiVersion doda X-API-Version header', async () => {
    const mod = await import('@/lib/middleware/api-version')
    const req = new Request('https://example.com/api/test')
    const response = NextResponse.json({ data: 'test' })
    const result = mod.withApiVersion(req, response)
    expect(result.headers.get('X-API-Version')).toBe('1')
  })

  it('checkApiVersion vrača null za podprto verzijo', async () => {
    const mod = await import('@/lib/middleware/api-version')
    const req = new Request('https://example.com/api/test')
    expect(mod.checkApiVersion(req)).toBeNull()
  })

  it('checkApiVersion vrača 400 za nepodprto verzijo', async () => {
    const mod = await import('@/lib/middleware/api-version')
    const req = new Request('https://example.com/api/test', {
      headers: { 'x-api-version': '99' },
    })
    const result = mod.checkApiVersion(req)
    expect(result).not.toBeNull()
    expect(result?.status).toBe(400)
  })
})
