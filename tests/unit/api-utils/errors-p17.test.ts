// ============================================
// P1-17: handleApiError — ZodError + requestId + error code — Unit testi
// ============================================
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { z, ZodError } from 'zod'
import { handleApiError, handleRouteError, ERROR_CODES } from '@/lib/api-utils/errors'

describe('handleApiError — P1-17 izboljšave', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── ZodError → 400 VALIDATION_ERROR ──

  it('ZodError vrne 400 (prej 500!) s code VALIDATION_ERROR', async () => {
    // simuliraj schema.parse() napako iz rute
    let zodError: ZodError
    try {
      z.object({ name: z.string().min(1) }).parse({ name: '' })
      throw new Error('should not reach')
    } catch (e) {
      zodError = e as ZodError
    }

    const response = handleApiError(zodError, 'POST /api/test')
    expect(response.status).toBe(400)

    const body = await response.json()
    expect(body.code).toBe(ERROR_CODES.VALIDATION_ERROR)
    expect(body.error).toBe('Neveljavni podatki')
    expect(Array.isArray(body.validationErrors)).toBe(true)
    expect(body.validationErrors[0]).toHaveProperty('field')
    expect(body.validationErrors[0]).toHaveProperty('message')
  })

  it('ZodError ne razkrije internal sporočila (samo validacijska polja)', async () => {
    let zodError: ZodError
    try {
      z.object({ email: z.string().email() }).parse({ email: 'not-an-email' })
      throw new Error('unreachable')
    } catch (e) {
      zodError = e as ZodError
    }

    const response = handleApiError(zodError, 'PUT /api/test')
    const body = await response.json()
    // ne sme vsebovati "stack", "Invalid", "expected" internals ZodErrorja
    expect(typeof body.error).toBe('string')
    expect(body.error).toBe('Neveljavni podatki')
  })

  // ── requestId ──

  it('odgovor vsebuje requestId (enoličen, v telesu + headerju)', async () => {
    const r1 = handleApiError(new Error('x'), 'GET /a')
    const r2 = handleApiError(new Error('y'), 'GET /b')

    const b1 = await r1.json()
    const b2 = await r2.json()
    expect(b1.requestId).toBeTruthy()
    expect(typeof b1.requestId).toBe('string')
    expect(b1.requestId).not.toBe(b2.requestId)

    expect(r1.headers.get('X-Request-Id')).toBe(b1.requestId)
  })

  // ── error code ──

  it('internal napaka vsebuje code INTERNAL_ERROR', async () => {
    const response = handleApiError(new Error('DB down'), 'GET /api/test')
    const body = await response.json()
    expect(body.code).toBe(ERROR_CODES.INTERNAL_ERROR)
  })

  it('ERROR_CODES vsebuje strojno berljiva imeni', () => {
    expect(ERROR_CODES.VALIDATION_ERROR).toBe('VALIDATION_ERROR')
    expect(ERROR_CODES.INTERNAL_ERROR).toBe('INTERNAL_ERROR')
  })

  // ── produkcija ne razkriva internals ──

  it('v produkciji NE razkrije error.message niti stack sledi', async () => {
    const prevEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      const response = handleApiError(
        new Error('PrismaClientValidationError: WHERE role=hacker'),
        'GET /api/test',
        'Napaka na strežniku'
      )
      const body = await response.json()
      expect(body.error).toBe('Napaka na strežniku')
      expect(body.detail).toBeUndefined()
      expect(JSON.stringify(body)).not.toContain('PrismaClientValidationError')
    } finally {
      process.env.NODE_ENV = prevEnv
    }
  })

  // ── strukturiran log (P1-17 zahteva: requestId, status, code, meta) ──

  it('logira strukturiran kontekst (requestId, statusCode, errorCode, meta)', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    handleApiError(new Error('boom'), 'POST /api/orders', 'Napaka', 500, {
      userId: 'emp-1',
      locationId: 'loc-1',
      latencyMs: 123,
    })

    // JSON strukturiran vnos vsebuje P1-17 zahtevana polja
    const logged = JSON.stringify(consoleSpy.mock.calls[0])
    expect(logged).toContain('requestId')
    expect(logged).toContain('statusCode')
    expect(logged).toContain('errorCode')
    expect(logged).toContain('emp-1')
    expect(logged).toContain('loc-1')
    expect(logged).toContain('latencyMs')
  })

  it('log warn za ZodError (ne error — validacija ni sistemska napaka)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    let zodError: ZodError
    try {
      z.object({ a: z.number() }).parse({})
      throw new Error('unreachable')
    } catch (e) {
      zodError = e as ZodError
    }
    handleApiError(zodError, 'POST /api/x')

    expect(warnSpy).toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
  })
})

describe('handleRouteError — P1-17 ZodError prioriteta', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('ZodError izstopa PRED business patterni kot 400', async () => {
    let zodError: ZodError
    try {
      z.object({ qty: z.number().int() }).parse({ qty: 1.5 })
      throw new Error('unreachable')
    } catch (e) {
      zodError = e as ZodError
    }

    const response = handleRouteError(zodError, 'POST /api/x', [
      { match: 'ni najden', message: 'Ni najdeno', substring: true },
    ])
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.code).toBe(ERROR_CODES.VALIDATION_ERROR)
  })

  it('business error vzorec še vedno deluje', async () => {
    const response = handleRouteError(
      new Error('SHIFT_NOT_FOUND'),
      'POST /api/shifts',
      [{ match: 'SHIFT_NOT_FOUND', message: 'Izmena ni najdena', status: 404 }]
    )
    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe('Izmena ni najdena')
  })
})
