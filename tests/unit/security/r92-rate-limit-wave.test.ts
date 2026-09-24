// ============================================
// R92-a — RATE LIMIT WAVE (admin write/issuance rute)
// ============================================
// R92-0 audit: R91-4 je ogradi SAMO rotate (ordering-token-rotate); admin
// WRITE/IZDAJNE rute integracij/lokacij/webhookov so ostale brez vedra. Ta
// fajl zaklene R92-a plast na kritičnih predstavnikih (kanon: inline
// checkRateLimitAsync TAKOJ po requireAuth, PRED resolverjem/params/body —
// zrcali R91-4 rotate):
//
//   A. POST /api/integrations/[id]/rotate-key — IZDAJNA ruta (obrat ključa =
//      podpisni material): blocked → 429 exact body + Retry-After /
//      X-RateLimit-Remaining glave + ZERO db; allowed → normalen tok; pin
//      fiksni ključ 'integrations-rotate-key' + IP + vrstni red po requireAuth
//      + permission gate 'admin'; fallback 60 s brez retryAfterMs.
//   B. POST /api/integrations — blocked → 429 + ZERO db; allowed → create
//      teče (ključ 'integrations-post').
//   C. PUT /api/locations/[id] — blocked → 429 + ZERO db (ključ
//      'locations-mutate'); allowed → update teče.
//   D. POST /api/webhooks — allowed → create teče (ključ 'webhooks-post');
//      blocked → 429 + ZERO db.
//   E. DELETE /api/webhooks/[id] — blocked → 429 + deleteMany NIKOLI (isti
//      ključ 'webhooks-mutate' kot PUT — isti write kanal).
//
// Vzorec (r89-token-rotate section A/H): vi.hoisted mocki, REALNI
// tenant-scope resolver (ni mockan), mockan requireAuth (permission gate se
// pina na klicu), mockResolvedValue (nikoli .Once), ZERO-db asserti na vsaki
// zavrnitvi. 429 = hišni withRateLimit HOF kanon.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  rateLimitCheck: vi.fn(),
  // db — integracije
  integrationFindUnique: vi.fn(),
  integrationUpdate: vi.fn(),
  integrationCreate: vi.fn(),
  integrationLogCreate: vi.fn(),
  // db — lokacije
  locationFindUnique: vi.fn(),
  locationUpdate: vi.fn(),
  // db — webhooks
  webhookCreate: vi.fn(),
  webhookDeleteMany: vi.fn(),
}))

// Auth middleware: mock requireAuth (permission gate se pina na klicu);
// tenant-scope NI mockan (rute ga jemljejo iz '@/lib/tenant-scope' — realen).
vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: mocks.requireAuth,
}))

// R92-a: rate-limit modul mockan — checkRateLimitAsync se pina (fiksni ključ,
// IP, AUTHENTICATED_LIMIT objekt); getClientIp vrača fiksni testni IP.
// AUTHENTICATED_LIMIT vrednosti zrcalijo realni preset (presets.ts: 120/min).
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.rateLimitCheck,
  getClientIp: vi.fn(() => '198.51.100.77'),
  AUTHENTICATED_LIMIT: { maxRequests: 120, windowMs: 60000 },
}))

vi.mock('@/lib/db', () => ({
  db: {
    integration: {
      findUnique: mocks.integrationFindUnique,
      update: mocks.integrationUpdate,
      create: mocks.integrationCreate,
    },
    integrationLog: { create: mocks.integrationLogCreate },
    location: { findUnique: mocks.locationFindUnique, update: mocks.locationUpdate },
    webhook: { create: mocks.webhookCreate, deleteMany: mocks.webhookDeleteMany },
  },
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

// api-utils: validateRequest/parseJsonBody = lahek JSON parse (shema-validacija
// ni predmet te wave-e); validateBody passthrough (R125: locations/[id] PUT je
// prešel na parseJsonBody+validateBody zaradi mask-keep _clear flag-ov);
// handleApiError passthrough (isti vzorec kot r89-token-rotate).
vi.mock('@/lib/api-utils', () => ({
  handleApiError: vi.fn((_e: unknown, _ctx: string, msg: string) =>
    new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'content-type': 'application/json' } })),
  validateRequest: vi.fn(async (req: Request) => {
    try {
      const text = await req.text()
      return { data: text ? JSON.parse(text) : {}, error: null }
    } catch {
      return { data: null, error: new Response(JSON.stringify({ error: 'Neveljavni podatki' }), { status: 400 }) }
    }
  }),
  parseJsonBody: vi.fn(async (req: Request) => {
    try {
      const text = await req.text()
      return { data: text ? JSON.parse(text) : {}, error: null }
    } catch {
      return { data: null, error: new Response(JSON.stringify({ error: 'Neveljavni podatki' }), { status: 400 }) }
    }
  }),
  validateBody: vi.fn((_schema: unknown, data: unknown) => ({ data, error: null })),
}))

// Route importi (PO mockih); tenant-scope + secret-masks + ordering-token +
// decimal REALNI (rate-limit je mockan — glej zgoraj)
import { POST as rotateKeyPOST } from '@/app/api/integrations/[id]/rotate-key/route'
import { POST as integrationsPOST } from '@/app/api/integrations/route'
import { PUT as locationPUT } from '@/app/api/locations/[id]/route'
import { POST as webhooksPOST } from '@/app/api/webhooks/route'
import { DELETE as webhookDELETE } from '@/app/api/webhooks/[id]/route'

const LOC_A = 'loc-tenant-a'
const INT_ID = 'int-rotate-1'

type SessionOverride = { role?: string; locationId?: string | null }

function mockSession(overrides: SessionOverride = {}) {
  const { role = 'admin', locationId = LOC_A } = overrides
  mocks.requireAuth.mockResolvedValue({
    session: { employeeId: 'emp-1', role, locationId },
    error: null,
  })
}

function jsonReq(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const params = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(() => {
  vi.clearAllMocks()
  // privzeto dovoljen rate limit — "allowed" testi nadaljujejo normalno
  mocks.rateLimitCheck.mockResolvedValue({ allowed: true, remaining: 5 })
  mocks.integrationFindUnique.mockResolvedValue({ id: INT_ID, apiKey: 'ros_ak_star', apiSecret: 'ros_sk_star' })
  mocks.integrationUpdate.mockResolvedValue({ id: INT_ID })
  mocks.integrationLogCreate.mockResolvedValue({ id: 'log-1' })
  mocks.locationFindUnique.mockResolvedValue({ id: LOC_A, code: 'LOCA', name: 'Restavracija A' })
  mocks.locationUpdate.mockResolvedValue({ id: LOC_A, name: 'Restavracija A' })
  mocks.webhookCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'wh-1', ...data }))
  mocks.webhookDeleteMany.mockResolvedValue({ count: 1 })
})

// ══════════════════════════════════════════════════════════════════
// A. POST /api/integrations/[id]/rotate-key — izdajna ruta
// ══════════════════════════════════════════════════════════════════
describe('R92-a A: rotate-key rate limit (fiksni ključ integrations-rotate-key)', () => {
  it('blocked → 429 exact body + Retry-After 60 + X-RateLimit-Remaining 0 + ZERO db', async () => {
    mockSession({ role: 'admin', locationId: null })
    mocks.rateLimitCheck.mockResolvedValue({ allowed: false, retryAfterMs: 60000 })

    const res = await rotateKeyPOST(
      jsonReq(`http://localhost:3000/api/integrations/${INT_ID}/rotate-key`, 'POST', { field: 'apiKey', autoGenerate: true }),
      params(INT_ID),
    )

    expect(res.status).toBe(429)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Preveč zahtev. Poskusite znova čez nekaj časa.')
    // Math.ceil(60000 / 1000) = 60
    expect(res.headers.get('Retry-After')).toBe('60')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
    // X-RateLimit-Reset = unix sekunde v prihodnosti (fallback okna)
    const reset = Number(res.headers.get('X-RateLimit-Reset'))
    expect(reset).toBeGreaterThan(Date.now() / 1000)
    // ZERO db: 429 gre PRED params/body/integration poizvedbo/update/log
    expect(mocks.integrationFindUnique).not.toHaveBeenCalled()
    expect(mocks.integrationUpdate).not.toHaveBeenCalled()
    expect(mocks.integrationLogCreate).not.toHaveBeenCalled()
  })

  it('blocked brez retryAfterMs → Retry-After pade nazaj na 60 (house fallback 60000 ms)', async () => {
    mockSession({ role: 'admin', locationId: null })
    mocks.rateLimitCheck.mockResolvedValue({ allowed: false })

    const res = await rotateKeyPOST(
      jsonReq(`http://localhost:3000/api/integrations/${INT_ID}/rotate-key`, 'POST', { field: 'apiKey', autoGenerate: true }),
      params(INT_ID),
    )

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('60')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(mocks.integrationUpdate).not.toHaveBeenCalled()
  })

  it('allowed → normalen tok (200, update + log) + pin: fiksni ključ, IP, AUTHENTICATED_LIMIT, vrstni red po requireAuth, permission admin', async () => {
    mockSession({ role: 'admin', locationId: null })
    const res = await rotateKeyPOST(
      jsonReq(`http://localhost:3000/api/integrations/${INT_ID}/rotate-key`, 'POST', { field: 'apiKey', autoGenerate: true }),
      params(INT_ID),
    )

    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean; field: string; maskedValue: string }
    expect(body.success).toBe(true)
    expect(body.field).toBe('apiKey')
    expect(body.maskedValue).toContain('••••••••')
    expect(mocks.integrationUpdate).toHaveBeenCalledTimes(1)
    expect(mocks.integrationLogCreate).toHaveBeenCalledTimes(1)

    // klic pin: FIKSNI ključ (ne pathname-izpeljan — en IP ne more fan-out
    // prek različnih integrationId) + IP iz getClientIp + realni limit objekt
    expect(mocks.rateLimitCheck).toHaveBeenCalledTimes(1)
    expect(mocks.rateLimitCheck).toHaveBeenCalledWith(
      'integrations-rotate-key',
      '198.51.100.77',
      expect.objectContaining({ maxRequests: expect.any(Number), windowMs: expect.any(Number) }),
    )

    // vrstni red: rate limit šele PO uspešnem requireAuth (anonimni probe-i
    // ne trošijo vedra) in PRED db klici
    expect(mocks.requireAuth.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.rateLimitCheck.mock.invocationCallOrder[0])

    // permission gate pin: izdajna ruta zahteva 'admin' (zrcali rotate R91-4)
    expect(mocks.requireAuth.mock.calls[0][1]).toEqual({ permission: 'admin' })
  })
})

// ══════════════════════════════════════════════════════════════════
// B. POST /api/integrations — create (ključ 'integrations-post')
// ══════════════════════════════════════════════════════════════════
describe('R92-a B: POST /api/integrations rate limit (fiksni ključ integrations-post)', () => {
  it('blocked → 429 + ZERO db (create + lokacijska validacija NIČ)', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.rateLimitCheck.mockResolvedValue({ allowed: false, retryAfterMs: 60000 })

    const res = await integrationsPOST(
      jsonReq('http://localhost:3000/api/integrations', 'POST', {
        name: 'Wolt', type: 'delivery', provider: 'wolt',
      }),
    )

    expect(res.status).toBe(429)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Preveč zahtev. Poskusite znova čez nekaj časa.')
    expect(res.headers.get('Retry-After')).toBe('60')
    expect(mocks.integrationCreate).not.toHaveBeenCalled()
    expect(mocks.locationFindUnique).not.toHaveBeenCalled()
  })

  it('allowed → create teče (201, žig session lokacije) + pin ključa integrations-post', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.integrationCreate.mockResolvedValue({
      id: 'int-new', name: 'Wolt', type: 'delivery', provider: 'wolt', apiKey: 'k', apiSecret: 's', locationId: LOC_A,
    })

    const res = await integrationsPOST(
      jsonReq('http://localhost:3000/api/integrations', 'POST', {
        name: 'Wolt', type: 'delivery', provider: 'wolt',
      }),
    )

    expect(res.status).toBe(201)
    expect(mocks.integrationCreate).toHaveBeenCalledTimes(1)
    expect(mocks.integrationCreate.mock.calls[0][0].data.locationId).toBe(LOC_A)

    expect(mocks.rateLimitCheck).toHaveBeenCalledWith(
      'integrations-post',
      '198.51.100.77',
      expect.objectContaining({ maxRequests: expect.any(Number), windowMs: expect.any(Number) }),
    )
  })
})

// ══════════════════════════════════════════════════════════════════
// C. PUT /api/locations/[id] — write (ključ 'locations-mutate')
// ══════════════════════════════════════════════════════════════════
describe('R92-a C: PUT /api/locations/[id] rate limit (fiksni ključ locations-mutate)', () => {
  it('blocked → 429 + ZERO db (findUnique + update NIKOLI) + pin ključa', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.rateLimitCheck.mockResolvedValue({ allowed: false, retryAfterMs: 60000 })

    const res = await locationPUT(
      jsonReq(`http://localhost:3000/api/locations/${LOC_A}`, 'PUT', { name: 'Novo ime' }),
      params(LOC_A),
    )

    expect(res.status).toBe(429)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Preveč zahtev. Poskusite znova čez nekaj časa.')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
    // ZERO db: 429 gre PRED params/guard/validacijo/poizvedbo
    expect(mocks.locationFindUnique).not.toHaveBeenCalled()
    expect(mocks.locationUpdate).not.toHaveBeenCalled()

    expect(mocks.rateLimitCheck).toHaveBeenCalledWith(
      'locations-mutate',
      '198.51.100.77',
      expect.objectContaining({ maxRequests: expect.any(Number), windowMs: expect.any(Number) }),
    )
  })

  it('allowed → update teče (200, maskiran odgovor) prek REALNEGA scope guard-a', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })

    const res = await locationPUT(
      jsonReq(`http://localhost:3000/api/locations/${LOC_A}`, 'PUT', { name: 'Novo ime' }),
      params(LOC_A),
    )

    expect(res.status).toBe(200)
    expect(mocks.locationUpdate).toHaveBeenCalledTimes(1)
    expect(mocks.locationUpdate.mock.calls[0][0].data.name).toBe('Novo ime')
  })
})

// ══════════════════════════════════════════════════════════════════
// D. POST /api/webhooks — create (ključ 'webhooks-post')
// ══════════════════════════════════════════════════════════════════
describe('R92-a D: POST /api/webhooks rate limit (fiksni ključ webhooks-post)', () => {
  it('allowed → create teče (201, žig session lokacije) + pin ključa webhooks-post', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })

    const res = await webhooksPOST(
      jsonReq('http://localhost:3000/api/webhooks', 'POST', {
        name: 'Order webhook', url: 'https://example.com/hook',
      }),
    )

    expect(res.status).toBe(201)
    expect(mocks.webhookCreate).toHaveBeenCalledTimes(1)
    // R83-F kanon: lokacijski admin → webhook žigan na NJEGOVO lokacijo
    expect(mocks.webhookCreate.mock.calls[0][0].data.locationId).toBe(LOC_A)

    expect(mocks.rateLimitCheck).toHaveBeenCalledWith(
      'webhooks-post',
      '198.51.100.77',
      expect.objectContaining({ maxRequests: expect.any(Number), windowMs: expect.any(Number) }),
    )
  })

  it('blocked → 429 + ZERO db (create NIKOLI)', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.rateLimitCheck.mockResolvedValue({ allowed: false })

    const res = await webhooksPOST(
      jsonReq('http://localhost:3000/api/webhooks', 'POST', {
        name: 'Order webhook', url: 'https://example.com/hook',
      }),
    )

    expect(res.status).toBe(429)
    expect((await res.json() as { error: string }).error).toBe('Preveč zahtev. Poskusite znova čez nekaj časa.')
    expect(mocks.webhookCreate).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// E. DELETE /api/webhooks/[id] — isti vedro kot PUT ('webhooks-mutate')
// ══════════════════════════════════════════════════════════════════
describe('R92-a E: DELETE /api/webhooks/[id] rate limit (fiksni ključ webhooks-mutate)', () => {
  it('blocked → 429 + deleteMany NIKOLI + pin ključa webhooks-mutate', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.rateLimitCheck.mockResolvedValue({ allowed: false, retryAfterMs: 60000 })

    const res = await webhookDELETE(
      jsonReq('http://localhost:3000/api/webhooks/wh-1', 'DELETE'),
      params('wh-1'),
    )

    expect(res.status).toBe(429)
    expect((await res.json() as { error: string }).error).toBe('Preveč zahtev. Poskusite znova čez nekaj časa.')
    expect(res.headers.get('Retry-After')).toBe('60')
    expect(mocks.webhookDeleteMany).not.toHaveBeenCalled()

    expect(mocks.rateLimitCheck).toHaveBeenCalledWith(
      'webhooks-mutate',
      '198.51.100.77',
      expect.objectContaining({ maxRequests: expect.any(Number), windowMs: expect.any(Number) }),
    )
  })
})
