// ============================================
// R98 — GET /api/configuration/[tab]: include+select merge fix
// ============================================
// LIVE REPRO (recovery seja R98): tabConfig 'dining-options' definira OBOJE
// select (skalarji) IN include (serviceCharge relacija) → GET je poslal OBE
// top-level opcije → Prisma 5 PrismaClientValidationError "Please either use
// `include` or `select`, but not both at the same time." → 400
// INVALID_PARAMETER ob VSAKEM klicu. Zakaj ni ujel test kanon:
//   • unit testi mockirajo db → Prisma validacija query-ja NE teče,
//   • e2e MODELA-* testira samo POST glavne /api/configuration rute + GET
//     modifier-groups, ne GET [tab] dining-options,
//   • frontend (useOrderPanel) je ob 400 tiho padel na prazen seznam
//     (json.diningOptions ?? []) → bug neviden v UI (WARN v dev.log).
// FIX: relations iz include se merge-ajo V select (relacijski ključi so v
// select veljavni); top-level include NI več poslan.
// Ta test pina kontrakt: findMany args NIKOLI ne vsebujejo `include`.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  findMany: vi.fn(),
}))

vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: mocks.requireAuth,
}))

vi.mock('@/lib/db', () => ({
  db: {
    diningOption: { findMany: mocks.findMany },
    taxRate: { findMany: mocks.findMany },
  },
}))

// '@/lib/tenant-scope' NI mockan — realni resolver (r86-c1 kanon)

import { GET } from '@/app/api/configuration/[tab]/route'

const makeReq = (tab = 'dining-options') =>
  new Request(`http://localhost/api/configuration/${tab}`, { method: 'GET' })

const args = (tab = 'dining-options') => ({ params: Promise.resolve({ tab }) })

const adminSession = (locationId: string | null) => ({
  session: { employeeId: 'emp-1', role: 'admin', locationId, permissions: ['admin'] },
})

describe('R98: GET /api/configuration/[tab] — include+select merge (živi repro pin)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findMany.mockResolvedValue([])
  })

  it('A1: dining-options → findMany dobi select z relacijo serviceCharge, BREZ top-level include', async () => {
    mocks.requireAuth.mockResolvedValue(adminSession('loc-1'))

    const res = await GET(makeReq('dining-options'), args('dining-options'))

    expect(res.status).toBe(200)
    expect(mocks.findMany).toHaveBeenCalledTimes(1)
    const query = mocks.findMany.mock.calls[0][0] as Record<string, unknown>

    // KLJUČNI pin: top-level `include` nikoli ne gre v findMany (Prisma 5
    // vrga validation error ob include+select)
    expect(query).not.toHaveProperty('include')

    // select vsebuje skalarje IZ tabConfig.select …
    const select = query.select as Record<string, unknown>
    expect(select).toMatchObject({
      id: true,
      name: true,
      type: true,
      serviceChargeId: true,
      taxRateId: true,
      prepTimeMinutes: true,
      isActive: true,
      sortOrder: true,
    })
    // … IN relacijo serviceCharge (prej include, zdaj merge-ana v select)
    expect(select.serviceCharge).toEqual({
      select: { id: true, name: true, type: true, amount: true },
    })

    // orderBy nespremenjen
    expect(query.orderBy).toEqual({ sortOrder: 'asc' })
  })

  it('A2: tab BREZ include (tax-rates) → select nespremenjen, brez include', async () => {
    mocks.requireAuth.mockResolvedValue(adminSession('loc-1'))

    const res = await GET(makeReq('tax-rates'), args('tax-rates'))

    expect(res.status).toBe(200)
    const query = mocks.findMany.mock.calls[0][0] as Record<string, unknown>
    expect(query).not.toHaveProperty('include')
    expect(query.select).toMatchObject({ id: true, name: true, rate: true, code: true })
  })

  it('B1: scoped admin → where.locationId = seja lokacija (scope kontrakt ostaja)', async () => {
    mocks.requireAuth.mockResolvedValue(adminSession('loc-1'))

    await GET(makeReq('dining-options'), args('dining-options'))

    const query = mocks.findMany.mock.calls[0][0] as Record<string, unknown>
    expect(query.where).toEqual({ locationId: 'loc-1' })
  })

  it('B2: admin brez lokacije (super-admin) → where {} (cross-lokacijski nadzor)', async () => {
    mocks.requireAuth.mockResolvedValue(adminSession(null))

    const res = await GET(makeReq('dining-options'), args('dining-options'))

    expect(res.status).toBe(200)
    const query = mocks.findMany.mock.calls[0][0] as Record<string, unknown>
    expect(query.where).toEqual({})
  })

  it('C1: odgovor pina finalKey obliko { diningOptions: [...] } s deepToNumbers', async () => {
    mocks.requireAuth.mockResolvedValue(adminSession(null))
    mocks.findMany.mockResolvedValueOnce([
      { id: 'do-1', name: 'Na mestu', type: 'dine-in', prepTimeMinutes: 15, isActive: true, sortOrder: 0, serviceCharge: null },
    ])

    const res = await GET(makeReq('dining-options'), args('dining-options'))
    const body = (await res.json()) as { diningOptions?: unknown[] }

    expect(body.diningOptions).toHaveLength(1)
    expect((body.diningOptions as { id: string }[])[0].id).toBe('do-1')
  })

  it('C2: neveljaven tab → 400 in ZERO db klicev', async () => {
    mocks.requireAuth.mockResolvedValue(adminSession(null))

    const res = await GET(makeReq('ne obstaja'), args('ne obstaja'))

    expect(res.status).toBe(400)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })
})
