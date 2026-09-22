// ============================================
// R80 BATCH B — WRITE IDOR REGRESSION: PUT/DELETE /api/gift-cards/[id]
//
// Prej: parent `db.giftCard.findUnique({ where: { id } })` BREZ scope-a na
// PUT (take_orders!) — staff je lahko bral/manipuliral STANJE kartice
// poljubne lokacije; giftCardTransaction.count (:prej L152) je dedoval
// nescopecan parent (audit 2-a: gift-cards/[id]/route.ts:25,152).
//
// Fix: po fetch-u se izpelje scope iz seje (fail-closed resolver) in
// izvrši isWithinScope(scope, existing.locationId) — izven scope-a →
// 404 notInScopeResponse('Darilna kartica'); super-admin (scope null) = nadzor.
// ============================================
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextResponse } from 'next/server'

// --- Mock setup ---

const mockGiftCardFindUnique = vi.fn()
const mockGiftCardUpdate = vi.fn()
const mockGiftCardDelete = vi.fn()
const mockGiftCardDeleteMany = vi.fn()
const mockTxnCount = vi.fn()
const mockTxGiftCardFindUnique = vi.fn()
const mockTxGiftCardUpdate = vi.fn()
const mockTxGiftCardUpdateMany = vi.fn()
const mockTxCreate = vi.fn()

const mockTx = {
  giftCard: {
    findUnique: mockTxGiftCardFindUnique,
    update: mockTxGiftCardUpdate,
    updateMany: mockTxGiftCardUpdateMany,
  },
  giftCardTransaction: { create: mockTxCreate },
}

vi.mock('@/lib/db', () => ({
  db: {
    giftCard: {
      findUnique: mockGiftCardFindUnique,
      update: mockGiftCardUpdate,
      delete: mockGiftCardDelete,
      // R103: scoped deleteMany (count 0 → 404)
      deleteMany: mockGiftCardDeleteMany,
    },
    giftCardTransaction: { count: mockTxnCount, create: vi.fn() },
    $transaction: vi.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
  },
}))

const mockRequireAuth = vi.fn()
// REAL tenant-scope logika — enaka implementacija kot v produkciji
// ('@/lib/auth-middleware' barrel re-exporta src/lib/tenant-scope.ts).
vi.mock('@/lib/auth-middleware', async () => {
  const actual = await vi.importActual<typeof import('@/lib/tenant-scope')>('@/lib/tenant-scope')
  return {
    requireAuth: mockRequireAuth,
    resolveTenantLocationId: actual.resolveTenantLocationId,
    resolveTenantLocationIdOrThrow: actual.resolveTenantLocationIdOrThrow,
    tenantScopeToWhere: actual.tenantScopeToWhere,
  }
})

vi.mock('@/lib/decimal', () => ({
  toNum: (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0),
  greaterThan: (a: unknown, b: unknown) => Number(a) > Number(b),
  deepToNumbers: <T>(v: T): T => v,
}))

vi.mock('@/lib/validations', () => ({
  updateGiftCardSchema: {},
}))

vi.mock('@/lib/api-utils', () => ({
  parseJsonBody: vi.fn(async (req: Request) => {
    try {
      const text = await req.text()
      return { data: JSON.parse(text), error: null }
    } catch {
      return { data: null, error: NextResponse.json({ error: 'Bad JSON' }, { status: 400 }) }
    }
  }),
  handleApiError: (_e: unknown, _ctx: string, msg: string) =>
    NextResponse.json({ error: msg }, { status: 500 }),
  validateBody: <T>(_schema: unknown, data: T) => ({ data, error: null }),
}))

// --- Helperji ---

function makeReq(method: 'PUT' | 'DELETE', body?: unknown): Request {
  return new Request('http://localhost/api/gift-cards/gc-1', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

const routeParams = { params: Promise.resolve({ id: 'gc-1' }) }

const LOC_A = 'loc-tenant-a'
const LOC_B = 'loc-tenant-b'

function sessionWith(locationId: string | null, role = 'staff') {
  return {
    session: {
      token: 'tok',
      employeeId: 'emp-1',
      role,
      permissions: ['take_orders', 'admin'],
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000,
      absoluteExpiry: Date.now() + 86400000,
      locationId,
    },
    error: null,
  }
}

/** Parent kartica (prvi findUnique — brez include/select). */
function cardAt(locationId: string | null) {
  return {
    id: 'gc-1',
    locationId,
    status: 'active',
    balance: 30,
    initialBalance: 100,
    expiresAt: null,
  }
}

/** Prazna kartica (balance 0) — izbris dovoljen (canDeleteGiftCard 0/0 → allowed). */
function emptyCardAt(locationId: string | null) {
  return { ...cardAt(locationId), balance: 0, initialBalance: 0 }
}

/** Razlikuje parent fetch / tx re-read / final re-fetch (include) / fresh (select). */
function mockFindUnique(parent: Record<string, unknown>) {
  mockGiftCardFindUnique.mockImplementation((args: {
    include?: unknown
    select?: unknown
  }) => {
    if (args?.include) {
      return Promise.resolve({ ...parent, balance: 50, transactions: [] })
    }
    if (args?.select) {
      return Promise.resolve({ balance: parent.balance })
    }
    return Promise.resolve(parent)
  })
  mockTxGiftCardFindUnique.mockResolvedValue(parent)
}

describe('R80 batch B: /api/gift-cards/[id] — cross-tenant WRITE IDOR', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue(sessionWith(LOC_A))
  })

  describe('PUT — scope denial', () => {
    it('kartica tujega tenanta → 404, brez manipulacije stanja', async () => {
      mockFindUnique(cardAt(LOC_B))
      const { PUT } = await import('@/app/api/gift-cards/[id]/route')
      const res = await PUT(makeReq('PUT', { balance: 0 }), routeParams)

      expect(res.status).toBe(404)
      // Transakcija (balance manipulation) se NE izvede
      expect(mockTxGiftCardUpdate).not.toHaveBeenCalled()
      expect(mockTxGiftCardUpdateMany).not.toHaveBeenCalled()
      expect(mockTxCreate).not.toHaveBeenCalled()
      // Tudi avtomatska označitev poteka (db.giftCard.update) se ne izvede
      expect(mockGiftCardUpdate).not.toHaveBeenCalled()
    })

    it('kartica lastne lokacije → 200, stanje se posodobi (R103: atomni pogojni load)', async () => {
      mockFindUnique(cardAt(LOC_A))
      // R103: load je zdaj pogojni updateMany (DB vrednoti cap proti tekočemu
      // stanju) — prej nepogojen update z increment + stale cap check
      mockTxGiftCardUpdateMany.mockResolvedValue({ count: 1 })
      mockTxGiftCardFindUnique.mockResolvedValue(cardAt(LOC_A))
      mockTxCreate.mockResolvedValue({})

      const { PUT } = await import('@/app/api/gift-cards/[id]/route')
      const res = await PUT(makeReq('PUT', { balance: 50 }), routeParams)

      expect(res.status).toBe(200)
      // cap = initialBalance(100) − diff(20) = 80 → where.balance.lte 80
      expect(mockTxGiftCardUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'gc-1', balance: { lte: 80 } }),
          data: { balance: { increment: 20 } },
        }),
      )
    })

    it('super-admin brez dodeljene lokacije = nadzor nad vsemi karticami', async () => {
      mockRequireAuth.mockResolvedValue(sessionWith(null, 'super_admin'))
      mockFindUnique(cardAt(LOC_B))
      mockTxGiftCardUpdateMany.mockResolvedValue({ count: 1 })
      mockTxGiftCardFindUnique.mockResolvedValue(cardAt(LOC_B))
      mockTxCreate.mockResolvedValue({})

      const { PUT } = await import('@/app/api/gift-cards/[id]/route')
      const res = await PUT(makeReq('PUT', { balance: 50 }), routeParams)

      expect(res.status).toBe(200)
      expect(mockTxGiftCardUpdateMany).toHaveBeenCalled()
    })

    it('staff brez dodeljene lokacije → 403 fail-closed (scope check pred transakcijo)', async () => {
      mockRequireAuth.mockResolvedValue(sessionWith(null, 'staff'))
      const { PUT } = await import('@/app/api/gift-cards/[id]/route')
      const res = await PUT(makeReq('PUT', { balance: 50 }), routeParams)

      expect(res.status).toBe(403)
      // Parent se sicer prebere (task-prescribed vrstni red: fetch → scope),
      // a WRITE/transakcija se NE izvede in podatki se ne vrnejo
      expect(mockTxGiftCardUpdate).not.toHaveBeenCalled()
      expect(mockTxCreate).not.toHaveBeenCalled()
    })
  })

  describe('DELETE — scope denial (count deduje samo po uspešnem scope checku)', () => {
    it('kartica tujega tenanta → 404, brez count-a in brez brisanja', async () => {
      mockFindUnique(cardAt(LOC_B))
      const { DELETE } = await import('@/app/api/gift-cards/[id]/route')
      const res = await DELETE(makeReq('DELETE'), routeParams)

      expect(res.status).toBe(404)
      expect(mockTxnCount).not.toHaveBeenCalled()
      expect(mockGiftCardDelete).not.toHaveBeenCalled()
    })

    it('prazna kartica lastne lokacije → 200 in izbris (R103 scoped deleteMany)', async () => {
      mockFindUnique(emptyCardAt(LOC_A))
      mockTxnCount.mockResolvedValue(0)
      mockGiftCardDeleteMany.mockResolvedValue({ count: 1 })

      const { DELETE } = await import('@/app/api/gift-cards/[id]/route')
      const res = await DELETE(makeReq('DELETE'), routeParams)

      expect(res.status).toBe(200)
      expect(mockTxnCount).toHaveBeenCalledTimes(1)
      // R103: scoped deleteMany (count 0 → 404) namesto delete (P2025 → 500)
      expect(mockGiftCardDeleteMany).toHaveBeenCalledWith({
        where: { id: 'gc-1', locationId: LOC_A },
      })
    })

    it('super-admin brez dodeljene lokacije = nadzor (prazna tuja kartica se izbriše)', async () => {
      mockRequireAuth.mockResolvedValue(sessionWith(null, 'super_admin'))
      mockFindUnique(emptyCardAt(LOC_B))
      mockTxnCount.mockResolvedValue(0)
      mockGiftCardDeleteMany.mockResolvedValue({ count: 1 })

      const { DELETE } = await import('@/app/api/gift-cards/[id]/route')
      const res = await DELETE(makeReq('DELETE'), routeParams)

      expect(res.status).toBe(200)
      expect(mockGiftCardDeleteMany).toHaveBeenCalled()
    })
  })
})
