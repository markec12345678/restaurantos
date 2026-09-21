// ============================================
// R89 — ordering token ROTATE endpoint — regresijski testi
// ============================================
// POST /api/locations/[id]/ordering-token/rotate — per-location revokacija:
// atomarno incrementira Location.tokenVersion in izda nov token za novo
// verzijo. Stari ordering tokeni te lokacije so instant neveljavni (javna
// ruta preverja proti trenutni verziji); druge lokacije/tenanti nedotaknjeni.
//
// Pokrito:
//   A. admin-with-location rotira svojo lokacijo — 200, update pin
//      `tokenVersion: { increment: 1 }` (nikoli read-modify-write), nov token
//      veljaven za NOVO verzijo, star verzijin token neveljaven, odgovor
//      isti kot izdaja + tokenVersion.
//   B. super-admin (null scope) BREZ ?locationId → isWithinScope(null, id)=true
//      → rotira (cross-lokacijski nadzor kanon).
//   C. super-admin Z ?locationId → cilja izrecno lokacijo (resolver query vir).
//   D. Permission gate: requireAuth je mockan → uspeh/neuspeh se EMULIRA;
//      pin: ruta zahteva permission 'admin' (regular staff/waiter nima —
//      rotacija ubije objavljeno povezavo, zrcali PUT /api/locations/[id]);
//      staff z NULL lokacijo → REALNI resolver 403 fail-closed.
//   E. Out-of-scope lokacijsko vezan admin → 404 + ZERO zapisov.
//   F. Neznana lokacija → 404 (ni obstoja-oraklja) + ZERO zapisov.
//   G. Produkcija brez skrivnosti → 503 fail-closed PRED zapisom (R82-D
//      kanon, zrcali izdajno GET ruto) + ZERO zapisov.
//
// Vzorec (r88-seed-posthandler-scope): vi.hoisted mocki, REALNI tenant-scope
// resolver + REALEN ordering-token lib (dev fallback skrivnost v test okolju),
// mockResolvedValue (nikoli .Once), ZERO-write asserti na vsaki zavrnitvi.
// ============================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  locationFindFirst: vi.fn(),
  locationUpdate: vi.fn(),
}))

// Auth middleware: mock requireAuth (permission gate se pin-a na klicu);
// tenant-scope NI mockan (ruta ga jemlje iz '@/lib/tenant-scope' — realen).
vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: mocks.requireAuth,
}))

vi.mock('@/lib/db', () => ({
  db: {
    location: {
      findFirst: mocks.locationFindFirst,
      update: mocks.locationUpdate,
    },
  },
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

// api-utils: samo handleApiError passthrough (rotate nima body validacije)
vi.mock('@/lib/api-utils', () => ({
  handleApiError: vi.fn((_e: unknown, _ctx: string, msg: string) =>
    new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'content-type': 'application/json' } })),
  validateRequest: vi.fn(),
  parseJsonBody: vi.fn(),
}))

// Route import (PO mockih); ordering-token + tenant-scope + utils REALNI
import { POST as rotatePOST } from '@/app/api/locations/[id]/ordering-token/rotate/route'
import { orderingTokenFor, verifyOrderingToken } from '@/lib/ordering-token'

const LOC_A = 'locTenantA'
const LOC_B = 'locTenantB'

/** Stub-a VSE štiri skrivnosti na prazno + produkcija (R82-D scenarij). */
function stubProductionNoSecret() {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('ORDERING_TOKEN_SECRET', '')
  vi.stubEnv('QR_PAY_SECRET', '')
  vi.stubEnv('ENCRYPTION_KEY', '')
  vi.stubEnv('NEXTAUTH_SECRET', '')
}

type SessionOverride = { role?: string; locationId?: string | null }

function mockSession(overrides: SessionOverride = {}) {
  const { role = 'admin', locationId = LOC_A } = overrides
  mocks.requireAuth.mockResolvedValue({
    session: { employeeId: 'emp-1', role, locationId },
    error: null,
  })
}

/** Emulacija requireAuth ZAVRNTNI (npr. waiter brez 'admin' permissiona). */
function mockAuthError(status: number, message: string) {
  mocks.requireAuth.mockResolvedValue({
    session: null,
    error: new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  })
}

function rotateReq(id: string, query = ''): {
  req: Request
  ctx: { params: Promise<{ id: string }> }
} {
  return {
    req: new Request(`http://localhost:3000/api/locations/${id}/ordering-token/rotate${query}`, {
      method: 'POST',
    }),
    ctx: { params: Promise.resolve({ id }) },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.locationFindFirst.mockResolvedValue({
    id: LOC_A, name: 'Restavracija A', isActive: true, tokenVersion: 3,
  })
  mocks.locationUpdate.mockResolvedValue({ id: LOC_A, tokenVersion: 4 })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// ══════════════════════════════════════════════════════════════════
// A. Happy path — admin-with-location rotira svojo lokacijo
// ══════════════════════════════════════════════════════════════════
describe('R89 A: POST ordering-token/rotate — rotacija lastne lokacije', () => {
  it('200 + tokenVersion 4 + ATOMIC increment pin + nov token veljaven, star mrtav', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const { req, ctx } = rotateReq(LOC_A)
    const res = await rotatePOST(req, ctx)

    expect(res.status).toBe(200)
    const body = await res.json() as {
      locationId: string; token: string; orderingUrl: string
      locationName: string; isActive: boolean; tokenVersion: number
    }
    expect(body.locationId).toBe(LOC_A)
    expect(body.tokenVersion).toBe(4)
    expect(body.locationName).toBe('Restavracija A')
    expect(body.isActive).toBe(true)
    // odgovor je isti kot izdajna GET ruta + tokenVersion
    const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    expect(body.orderingUrl).toBe(`${base}/order?loc=${LOC_A}&t=${body.token}`)

    // ATOMIC increment — nikoli read-modify-write
    expect(mocks.locationUpdate).toHaveBeenCalledTimes(1)
    expect(mocks.locationUpdate).toHaveBeenCalledWith({
      where: { id: LOC_A },
      data: { tokenVersion: { increment: 1 } },
      select: { id: true, tokenVersion: true },
    })

    // nov token = kovan za NOVO verzijo in veljaven zanjo
    expect(body.token).toBe(orderingTokenFor(LOC_A, 4))
    expect(verifyOrderingToken(body.token, LOC_A, 4)).toBe(true)
    // star token (verzija 3) je po rotaciji MRTAV
    const oldToken = orderingTokenFor(LOC_A, 3)
    expect(verifyOrderingToken(oldToken, LOC_A, 4)).toBe(false)
    // in nov token NIKOLI ne velja za staro verzijo (fail-closed oba smeri)
    expect(verifyOrderingToken(body.token, LOC_A, 3)).toBe(false)
  })

  it('permission gate pin: requireAuth je klican z { permission: \'admin\' } (write kanon — PUT /api/locations/[id])', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const { req, ctx } = rotateReq(LOC_A)
    await rotatePOST(req, ctx)
    expect(mocks.requireAuth).toHaveBeenCalledTimes(1)
    expect(mocks.requireAuth.mock.calls[0][1]).toEqual({ permission: 'admin' })
  })

  it('location.findFirst pin: select ima id, name, isActive, tokenVersion (brez dodatnih klicev)', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const { req, ctx } = rotateReq(LOC_A)
    await rotatePOST(req, ctx)
    expect(mocks.locationFindFirst).toHaveBeenCalledWith({
      where: { id: LOC_A },
      select: { id: true, name: true, isActive: true, tokenVersion: true },
    })
    expect(mocks.locationFindFirst).toHaveBeenCalledTimes(1)
  })
})

// ══════════════════════════════════════════════════════════════════
// B/C. Super-admin — cross-lokacijski nadzor (isWithinScope(null, id) = true)
// ══════════════════════════════════════════════════════════════════
describe('R89 B/C: super-admin rotacija', () => {
  it('super-admin BREZ ?locationId → scope null → rotira ciljno lokacijo (200, update na njej)', async () => {
    mockSession({ role: 'admin', locationId: null })
    mocks.locationFindFirst.mockResolvedValue({
      id: LOC_B, name: 'Restavracija B', isActive: true, tokenVersion: 0,
    })
    mocks.locationUpdate.mockResolvedValue({ id: LOC_B, tokenVersion: 1 })

    const { req, ctx } = rotateReq(LOC_B)
    const res = await rotatePOST(req, ctx)

    expect(res.status).toBe(200)
    const body = await res.json() as { locationId: string; tokenVersion: number; token: string }
    expect(body.locationId).toBe(LOC_B)
    expect(body.tokenVersion).toBe(1)
    expect(body.token).toBe(orderingTokenFor(LOC_B, 1))
    expect(mocks.locationUpdate).toHaveBeenCalledWith({
      where: { id: LOC_B },
      data: { tokenVersion: { increment: 1 } },
      select: { id: true, tokenVersion: true },
    })
  })

  it('super-admin Z ?locationId=LOC_B → cilja TO lokacijo (resolver query vir)', async () => {
    mockSession({ role: 'admin', locationId: null })
    mocks.locationFindFirst.mockResolvedValue({
      id: LOC_B, name: 'Restavracija B', isActive: true, tokenVersion: 2,
    })
    mocks.locationUpdate.mockResolvedValue({ id: LOC_B, tokenVersion: 3 })

    const { req, ctx } = rotateReq(LOC_B, `?locationId=${LOC_B}`)
    const res = await rotatePOST(req, ctx)

    expect(res.status).toBe(200)
    const body = await res.json() as { locationId: string; tokenVersion: number }
    expect(body.locationId).toBe(LOC_B)
    expect(body.tokenVersion).toBe(3)
    expect(mocks.locationFindFirst.mock.calls[0][0].where.id).toBe(LOC_B)
  })

  it('staff z NULL lokacijo → REALNI resolver 403 fail-closed + ZERO db', async () => {
    mockSession({ role: 'staff', locationId: null })
    const { req, ctx } = rotateReq(LOC_A)
    const res = await rotatePOST(req, ctx)

    expect(res.status).toBe(403)
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
    expect(mocks.locationUpdate).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// D. Permission gate emulacija — regular staff NE sme rotirati
// ══════════════════════════════════════════════════════════════════
describe('R89 D: permission gate — rotacija je admin write op', () => {
  it("waiter (requireAuth zavrne 'admin' permission) → middleware error + ZERO db", async () => {
    // requireAuth je mockan → uspeh/neuspeh se EMULIRA; pin v A zagotavlja,
    // da ruta zahteva permission 'admin' (realni middleware ga preveri proti
    // zaposlenega permissions — waiter brez njega dobi ta error).
    mockAuthError(403, 'Nimate dovoljenja za to akcijo')
    const { req, ctx } = rotateReq(LOC_A)
    const res = await rotatePOST(req, ctx)

    expect(res.status).toBe(403)
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
    expect(mocks.locationUpdate).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// E/F. Zavrnitve — unificiran 404 + ZERO zapisov
// ══════════════════════════════════════════════════════════════════
describe('R89 E/F: scope + obstoj — 404 + ZERO zapisov', () => {
  it('lokacijsko vezan admin tuje lokacije → 404 "Lokacija ni najden" + update NIKOLI', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.locationFindFirst.mockResolvedValue({
      id: LOC_B, name: 'Restavracija B', isActive: true, tokenVersion: 0,
    })
    const { req, ctx } = rotateReq(LOC_B)
    const res = await rotatePOST(req, ctx)

    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Lokacija ni najden')
    expect(mocks.locationUpdate).not.toHaveBeenCalled()
  })

  it('neznana lokacija → ISTI 404 (ni obstoja-oraklja) + update NIKOLI', async () => {
    mockSession({ role: 'admin', locationId: null })
    mocks.locationFindFirst.mockResolvedValue(null)
    const { req, ctx } = rotateReq('locghost99')
    const res = await rotatePOST(req, ctx)

    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Lokacija ni najden')
    expect(mocks.locationUpdate).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// G. Produkcija brez skrivnosti → 503 fail-closed PRED zapisom
// ══════════════════════════════════════════════════════════════════
describe('R89 G: produkcija brez ORDERING_TOKEN_SECRET → 503', () => {
  it('503 + update NIKOLI (zero writes) + sporočilo brez notranjih detajlov', async () => {
    stubProductionNoSecret()
    mockSession({ role: 'admin', locationId: LOC_A })
    const { req, ctx } = rotateReq(LOC_A)
    const res = await rotatePOST(req, ctx)

    expect(res.status).toBe(503)
    const body = await res.json() as { error: string }
    expect(body.error).toBeTruthy()
    expect(body.error).not.toContain('SECRET')
    expect(body.error).not.toContain('HMAC')
    // zrcali izdajno ruto: 503 gre PO resoluciji/scope-u, VEDNO PRED zapisom
    expect(mocks.locationFindFirst).toHaveBeenCalledTimes(1)
    expect(mocks.locationUpdate).not.toHaveBeenCalled()
  })
})
