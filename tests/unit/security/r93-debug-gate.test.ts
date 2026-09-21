// ============================================
// R93-c — debug/query + debug/env produkcija-gate (analiza + pini)
// ============================================
// R93-0 backlog (d): analiza debug rut. VERDICTI (dokumentirani v route
// komentarjih, ta testi jih zaklenejo):
//
//   debug/query — 5 FIXNIH Prisma introspekcijskih probe (order.findMany
//   take:1 z include-i); NIČ request vnosa, NIČ arbitrary SQL, NIČ table
//   listing-a; odgovor = števci (≤1) + skrajšana (≤300 znakov) Prisma error
//   sporočila. Gate requireAuth { permission: 'admin' } je ZADOSTEN (odločitev
//   (b): vedenje ohranjeno) — platformAdminGate zavržen, ker ruta ne izpostavi
//   ničesar platformskega in nič tenant vrstic (za razliko od debug/env).
//
//   debug/env — platformAdminGate (R86-4 hišni precedens) + maskiran
//   DATABASE_URL STA zadostna: površina je 7 fiksnih ključev (NE iteracija
//   process.env), secret-named vrednosti NISO del površine → dodatna redakcija
//   ni potrebna. Ti testi pinajo both gates + odsotnost cross-tenant row dump-a
//   in secret leak-a.
//
// Vzorec (r89/r92): vi.hoisted, mockResolvedValue (nikoli .Once),
// ZERO-db asserti na zavrnitvah.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  orderFindMany: vi.fn(),
}))

vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: mocks.requireAuth,
}))

vi.mock('@/lib/db', () => ({
  db: {
    order: { findMany: mocks.orderFindMany },
  },
}))

// Route importi (PO mockih)
import { GET as debugQueryGET } from '@/app/api/debug/query/route'
import { GET as debugEnvGET } from '@/app/api/debug/env/route'

const LOC_A = 'loc-tenant-a'

type SessionOverride = { role?: string; locationId?: string | null }

function mockSession(overrides: SessionOverride = {}) {
  const { role = 'admin', locationId = LOC_A } = overrides
  mocks.requireAuth.mockResolvedValue({
    session: { employeeId: 'emp-1', role, locationId, permissions: ['admin'] },
    error: null,
  })
}

function mockAuthError(status: number, message: string) {
  mocks.requireAuth.mockResolvedValue({
    session: null,
    error: new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  })
}

// ════════════════════════════════════════════════════════════════════
// A. GET /api/debug/query — admin gate + fiksna probe površina
// ════════════════════════════════════════════════════════════════════
describe('R93-c A: GET /api/debug/query — gate + probe površina', () => {
  beforeEach(() => {
    mockSession()
    mocks.orderFindMany.mockResolvedValue([{ id: 'o-1', total: 42 }])
  })

  it('A1: requireAuth error → passthrough 401 + ZERO db klicev', async () => {
    mockAuthError(401, 'Niste prijavljeni')
    const res = await debugQueryGET(new Request('http://localhost:3000/api/debug/query'))
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toBe('Niste prijavljeni')
    expect(mocks.orderFindMany).not.toHaveBeenCalled()
  })

  it('A2: gate pin — requireAuth zahteva permission "admin"', async () => {
    await debugQueryGET(new Request('http://localhost:3000/api/debug/query'))
    expect(mocks.requireAuth).toHaveBeenCalledTimes(1)
    expect(mocks.requireAuth.mock.calls[0][1]).toEqual({ permission: 'admin' })
  })

  it('A3: admin → 200; 5 fiksnih probe poizvedb (take:1), odgovor = ŠTEVCI brez vrstic', async () => {
    const res = await debugQueryGET(new Request('http://localhost:3000/api/debug/query'))
    expect(res.status).toBe(200)
    const data = await res.json()
    // 5 fiksnih probe (ordersSimple/WithTable/WithBrand/WithItems/FullInclude)
    expect(mocks.orderFindMany).toHaveBeenCalledTimes(5)
    for (const call of mocks.orderFindMany.mock.calls) {
      expect(call[0]).toEqual(expect.objectContaining({ take: 1 }))
    }
    // Ruta vrača SAMO length števce — DB vrstice NIKOLI ne puščajo routa
    // (ni cross-tenant row dump surface)
    expect(JSON.stringify(data)).not.toContain('o-1')
    expect(JSON.stringify(data)).not.toContain('42')
    expect(data.ordersSimple).toBe(1)
    // brez error ključev = vse probe uspešne
    expect(Object.keys(data).some((k) => k.endsWith('Error'))).toBe(false)
  })

  it('A4: padla probe → ŠE VEDNO 200 + error string skrajšan na ≤300 znakov', async () => {
    mocks.orderFindMany.mockRejectedValue(new Error('X'.repeat(500)))
    const res = await debugQueryGET(new Request('http://localhost:3000/api/debug/query'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(typeof data.ordersSimpleError).toBe('string')
    expect(data.ordersSimpleError.length).toBeLessThanOrEqual(300)
  })
})

// ════════════════════════════════════════════════════════════════════
// B. GET /api/debug/env — platformAdminGate (R86-4) + fiksna maskirana
//    površina (brez wholesale process.env dump-a)
// ════════════════════════════════════════════════════════════════════
describe('R93-c B: GET /api/debug/env — platform gate + fiksna površina', () => {
  beforeEach(() => {
    mockSession()
  })

  it('B1: lokacijsko vezan admin (role admin Z lokacijo) → 403 platform gate', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await debugEnvGET(new Request('http://localhost:3000/api/debug/env'))
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toBe('Debug env informacije so platformske — dostop dovoljen samo platformnemu administratorju.')
  })

  it('B2: platform admin (brez lokacije) → 200; površina = NAJVEČ 7 fiksnih ključev (brez env iteracije)', async () => {
    mockSession({ role: 'admin', locationId: null })
    const res = await debugEnvGET(new Request('http://localhost:3000/api/debug/env'))
    expect(res.status).toBe(200)
    const data = await res.json()
    // pin: NOVO skrivnostno ime v env NE smedi pristati v odgovoru — površina
    // je fiksna množica ključev (R86-4 surface, R93-c zaklenjen)
    const allowedKeys = new Set([
      'DATABASE_URL_set',
      'POSTGRES_URL_set',
      'DATABASE_URL_preview',
      'FULL_MASKED',
      'POSTGRES_HOST',
      'PGDATABASE',
      'NODE_ENV',
    ])
    expect(Object.keys(data).every((k) => allowedKeys.has(k))).toBe(true)
  })

  it('B3: platform admin + secret env vrednosti → 200, skrivnosti NIKOLI v telesu; URL maskiran', async () => {
    mockSession({ role: 'admin', locationId: null })
    vi.stubEnv('DATABASE_URL', 'postgresql://dbuser:supersecret@db.host:5432/resto')
    vi.stubEnv('STRIPE_API_KEY', 'sk_test_LEAKME')
    vi.stubEnv('NEXTAUTH_SECRET', 's3cr3t-LEAKME')
    try {
      const res = await debugEnvGET(new Request('http://localhost:3000/api/debug/env'))
      expect(res.status).toBe(200)
      const body = JSON.stringify(await res.json())
      expect(body).not.toContain('supersecret')
      expect(body).not.toContain('sk_test_LEAKME')
      expect(body).not.toContain('s3cr3t-LEAKME')
      expect(body).toContain('****') // URL geslo maskirano (R86-4)
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
