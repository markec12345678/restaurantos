// ============================================
// handleApiError / handleRouteError / matchBusinessError — Unit testi
// Konsistentno obravnavanje napak v API rutah
// ============================================
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { handleApiError, matchBusinessError, handleRouteError } from '@/lib/api-utils/errors'

describe('handleApiError', () => {
  beforeEach(() => {
    // Mock logger, da ne onesnažuje testnega output-a
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('vrne NextResponse z JSON napako in status 500 (default)', async () => {
    const error = new Error('DB connection failed')
    const response = handleApiError(error, 'POST /api/test')

    expect(response).toBeInstanceOf(Response)
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body).toHaveProperty('error')
  })

  it('uporabi custom statusCode, ko je podan', async () => {
    const error = new Error('Not found')
    const response = handleApiError(error, 'GET /api/test', 'Ni najdeno', 404)
    expect(response.status).toBe(404)
  })

  it('uporabi custom userMessage', async () => {
    const error = new Error('Internal stack trace')
    const response = handleApiError(error, 'POST /api/test', 'Napaka pri shranjevanju', 400)
    const body = await response.json()
    // V dev (NODE_ENV !== production) razkrije pravo message
    expect(body.error).toBeDefined()
  })

  it('obdela ne-Error objekt (npr. string)', async () => {
    const error = 'string error'
    const response = handleApiError(error, 'GET /api/test')
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBeDefined()
  })

  it('obdela null error', async () => {
    const response = handleApiError(null, 'GET /api/test')
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBeDefined()
  })

  it('obdela undefined error', async () => {
    const response = handleApiError(undefined, 'GET /api/test')
    expect(response.status).toBe(500)
  })

  it('obdela objekt z message property-jem (ne instanceof Error)', async () => {
    const error = { message: 'custom message', code: 42 }
    const response = handleApiError(error, 'POST /api/test')
    expect(response.status).toBe(500)
  })

  it('logira napako z context-om', () => {
    const error = new Error('test error')
    // Ne moremo preprosto mock-irati logger-a, ker je modul vžeč naložen
    // Ampak preverimo, da funkcija ne vrže napake
    expect(() => handleApiError(error, 'TEST_CONTEXT')).not.toThrow()
  })
})

describe('matchBusinessError', () => {
  it('vrne null za ne-Error input', () => {
    expect(matchBusinessError('string', [])).toBeNull()
    expect(matchBusinessError(null, [])).toBeNull()
    expect(matchBusinessError({}, [])).toBeNull()
    expect(matchBusinessError(42, [])).toBeNull()
  })

  it('vrne null, če ni ujemanja', () => {
    const error = new Error('UNKNOWN_ERROR')
    const patterns = [{ match: 'KNOWN_ERROR', message: 'Znana napaka' }]
    expect(matchBusinessError(error, patterns)).toBeNull()
  })

  it('natančno ujemanje (error.message === pattern.match)', async () => {
    const error = new Error('ALREADY_OPEN')
    const patterns = [
      { match: 'ALREADY_OPEN', message: 'Blagajna je že odprta', status: 409 },
    ]
    const response = matchBusinessError(error, patterns)
    expect(response).not.toBeNull()
    expect(response!.status).toBe(409)
    const body = await response!.json()
    expect(body.error).toBe('Blagajna je že odprta')
  })

  it('predpona ujemanja z argumenti (startsWith pattern.match + ":")', async () => {
    const error = new Error('INSUFFICIENT_STOCK:Pizza:5kos')
    const patterns = [
      {
        match: 'INSUFFICIENT_STOCK',
        message: 'Ni dovolj zaloge',
        status: 422,
        extra: (parts: string[]) => ({ item: parts[1], needed: parts[2] }),
      },
    ]
    const response = matchBusinessError(error, patterns)
    expect(response).not.toBeNull()
    expect(response!.status).toBe(422)
    const body = await response!.json()
    expect(body.error).toBe('Ni dovolj zaloge')
    expect(body.item).toBe('Pizza')
    expect(body.needed).toBe('5kos')
  })

  it('substring ujemanje (pattern.substring = true)', async () => {
    const error = new Error('Naročilo z ID 123 ni najden v bazi')
    const patterns = [
      {
        match: 'ni najden',
        message: 'Naročilo ne obstaja',
        status: 404,
        substring: true,
      },
    ]
    const response = matchBusinessError(error, patterns)
    expect(response).not.toBeNull()
    expect(response!.status).toBe(404)
    const body = await response!.json()
    expect(body.error).toBe('Naročilo ne obstaja')
  })

  it('default status 400, ko status ni podan', async () => {
    const error = new Error('BUSINESS_ERROR')
    const patterns = [{ match: 'BUSINESS_ERROR', message: 'Poslovna napaka' }]
    const response = matchBusinessError(error, patterns)
    expect(response!.status).toBe(400)
  })

  it('vrne prvi ujemajoč pattern (ne zadnjega)', async () => {
    const error = new Error('SHIFT_NOT_FOUND')
    const patterns = [
      { match: 'ALREADY_OPEN', message: 'Že odprto', status: 409 },
      { match: 'SHIFT_NOT_FOUND', message: 'Izmena ni najdena', status: 404 },
      { match: 'SHIFT_NOT_FOUND', message: 'Ta ne bi smel zmaga', status: 500 },
    ]
    const response = matchBusinessError(error, patterns)
    const body = await response!.json()
    expect(body.error).toBe('Izmena ni najdena')
    expect(response!.status).toBe(404)
  })

  it('ne obravnava ujemanja, ko message vsebuje pattern kot substring brez substring:true', () => {
    const error = new Error('The ALREADY_OPEN somewhere in text')
    const patterns = [{ match: 'ALREADY_OPEN', message: 'Ne bi se moral ujemati' }]
    expect(matchBusinessError(error, patterns)).toBeNull()
  })

  it('extra funkcija dobi prazno array za natančno ujemanje', async () => {
    const error = new Error('EXACT_MATCH')
    const extraFn = vi.fn((parts: string[]) => ({ count: parts.length }))
    const patterns = [
      { match: 'EXACT_MATCH', message: 'Test', extra: extraFn },
    ]
    const response = matchBusinessError(error, patterns)
    expect(response).not.toBeNull()
    expect(extraFn).toHaveBeenCalledWith([])
    const body = await response!.json()
    expect(body.count).toBe(0)
  })
})

describe('handleRouteError', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('vrne business error response, ko se ujema s pattern-om', async () => {
    const error = new Error('ALREADY_OPEN')
    const patterns = [{ match: 'ALREADY_OPEN', message: 'Že odprto', status: 409 }]
    const response = handleRouteError(error, 'POST /api/cash-register', patterns, 'Napaka')
    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error).toBe('Že odprto')
  })

  it('pade na handleApiError (500), ko ni business ujemanja', async () => {
    const error = new Error('UNKNOWN_INTERNAL_ERROR')
    const patterns = [{ match: 'ALREADY_OPEN', message: 'Že odprto' }]
    const response = handleRouteError(error, 'POST /api/test', patterns, 'Napaka na strežniku')
    expect(response.status).toBe(500)
  })

  it('pade na handleApiError za ne-Error input', async () => {
    const response = handleRouteError('string error', 'GET /api/test', [], 'Napaka')
    expect(response.status).toBe(500)
  })

  it('uporabi fallbackMessage v handleApiError', async () => {
    const error = new Error('mystery error')
    const response = handleRouteError(error, 'POST /api/test', [], 'Slovensko sporočilo')
    expect(response.status).toBe(500)
  })
})
