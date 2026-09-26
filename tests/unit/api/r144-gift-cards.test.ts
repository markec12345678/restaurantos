// ============================================
// R144-b — EPIC #115 #31 GIFT CARDS — trap-DB uniti
// ============================================
// Vzorec r142-devices / r143-loyalty (vi.hoisted + vi.mock('@/lib/db') z
// $transaction passthrough na ISTI mock objekt + vi.mock('@/lib/auth-middleware')
// z importOriginal spreadom — requireAuth na meji, tenant resolverji REALNI).
// rateLimitedResponse ostane REALen (rute ga uvažajo direktno iz
// '@/lib/rate-limit/response' — 429 shape gre čez pravi helper).
// decimal lib ostane REALen (toNum/greaterThan/deepToNumbers delujejo nad
// number; Decimal pretvorba pinnana prek Prisma.Decimal fiksturn).
//
// Pokritje (kontrakt R144-b):
//   POST /api/gift-cards
//    1. audit GIFT_CARD_CREATED točno 1× V tx — details last4 SAMO (poln
//       cardNumber NIKOLI), initialBalance, locationId; ledger + 201
//   PUT /api/gift-cards/[id]
//    2. load delta → GIFT_CARD_ADJUSTED (delta/balanceBefore/balanceAfter/
//       last4) točno 1×, brez status audita; R103 G1 pogojni updateMany pin
//    3. depleted→active reaktivacija → ADJUSTED + STATUS_CHANGED (2 klica)
//    4. status-only sprememba → GIFT_CARD_STATUS_CHANGED (before/after),
//       brez adjust audita
//    5. no-op PUT (prazen body / balance = trenutno) → ZERO auditov,
//       zero ledger, zero update (diff-only kanon R142)
//   DELETE /api/gift-cards/[id]
//    6. prazna kartica → 200 + GIFT_CARD_DELETED (last4, balanceAtDelete,
//       txnCount); scoped deleteMany pin
//    7. kartica s stanjem → 409 guard, ZERO auditov, zero brisanja
//   GET /api/gift-cards
//    8. GIFT_CARD_SELECT whitelist pin (Object.keys) + transactions select +
//       no-store + rl bucket 'gift-cards' + response shape
//    9. scope: loc-bound → where.locationId; super-admin → brez ključa;
//       ?status/?cardNumber filtri kompozibilni
//   GET /api/gift-cards/liability (NOVO)
//   10. 401 fail-closed zero-DB (view_reports permission pin)
//   11. 429 rate-limit bucket 'gift-cards-liability' PRED auth, zero DB
//   12. totals matematika: outstanding = active + depleted SAMO (suspended/
//       expired izključeni), expiringSoon30d okno (30d zgornja meja), scope
//       where, single-bucket byLocation za loc-admina, no-store + key pin
//   13. super-admin byLocation: per-location vrstice + 'Brez lokacije' bucket
//       ZADNJI, Decimal→number pretvorba, location lookup whitelist
//   14. loc-admin brez kartic → enojna ničelna vrstica svoje lokacije
// ============================================
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Prisma } from '@prisma/client'

const LOC_A = 'loc-tenant-a'
const LOC_B = 'loc-tenant-b'
const CARD = 'GC-1234-5678'
const LAST4 = '5678'
const DAY_MS = 24 * 60 * 60 * 1000

const mocks = vi.hoisted(() => ({
  // db.giftCard
  giftCardFindMany: vi.fn(),
  giftCardFindUnique: vi.fn(),
  giftCardCreate: vi.fn(),
  giftCardUpdate: vi.fn(),
  giftCardUpdateMany: vi.fn(),
  giftCardDeleteMany: vi.fn(),
  giftCardCount: vi.fn(),
  giftCardGroupBy: vi.fn(),
  giftCardAggregate: vi.fn(),
  // db.giftCardTransaction
  giftCardTxCount: vi.fn(),
  giftCardTxCreate: vi.fn(),
  // db.location
  locationFindMany: vi.fn(),
  // infra
  transaction: vi.fn(),
  requireAuth: vi.fn(),
  createAuditLog: vi.fn(),
  checkRateLimitAsync: vi.fn(),
}))

vi.mock('@/lib/db', () => {
  // $transaction passthrough na ISTI mock objekt (tx.giftCard deluje —
  // r142/r143 kanon)
  const dbMock = {
    giftCard: {
      findMany: mocks.giftCardFindMany,
      findUnique: mocks.giftCardFindUnique,
      create: mocks.giftCardCreate,
      update: mocks.giftCardUpdate,
      updateMany: mocks.giftCardUpdateMany,
      deleteMany: mocks.giftCardDeleteMany,
      count: mocks.giftCardCount,
      groupBy: mocks.giftCardGroupBy,
      aggregate: mocks.giftCardAggregate,
    },
    giftCardTransaction: {
      count: mocks.giftCardTxCount,
      create: mocks.giftCardTxCreate,
    },
    location: { findMany: mocks.locationFindMany },
    $transaction: mocks.transaction,
  }
  return { db: dbMock, createAuditLog: mocks.createAuditLog }
})

// requireAuth mockan na meji; tenant resolverji ostanejo REALNI (r142/r143 kanon)
vi.mock('@/lib/auth-middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-middleware')>()
  return {
    ...actual,
    requireAuth: mocks.requireAuth,
  }
})

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.checkRateLimitAsync,
  getClientIp: vi.fn(() => '203.0.113.7'),
  AUTHENTICATED_LIMIT: { maxRequests: 120, windowMs: 60_000 },
}))

vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

import { GET as giftCardsGET, POST as giftCardsPOST } from '@/app/api/gift-cards/route'
import { PUT as giftCardPUT, DELETE as giftCardDELETE } from '@/app/api/gift-cards/[id]/route'
import { GET as liabilityGET } from '@/app/api/gift-cards/liability/route'
import { GIFT_CARD_EXPIRING_SOON_DAYS, giftCardLast4 } from '@/lib/gift-cards/constants'

// ---------- Fixture tipi + helperji ----------

interface CardRow {
  id: string
  cardNumber: string
  ownerName: string
  balance: number | Prisma.Decimal
  initialBalance: number
  status: string
  purchasedAt: Date
  expiresAt: Date | null
  locationId: string | null
  location?: { name: string; code: string } | null
  transactions?: Array<Record<string, unknown>>
}

function cardRow(overrides: Partial<CardRow> = {}): CardRow {
  return {
    id: 'gc-1',
    cardNumber: CARD,
    ownerName: 'Ana Novak',
    balance: 50,
    initialBalance: 100,
    status: 'active',
    purchasedAt: new Date('2026-01-15T10:00:00Z'),
    expiresAt: null,
    locationId: LOC_A,
    location: { name: 'Lokacija A', code: 'LA' },
    transactions: [],
    ...overrides,
  }
}

type SessionOverrides = Record<string, unknown>

function session(overrides: SessionOverrides = {}) {
  return {
    token: 'tok-1',
    employeeId: 'emp-1',
    role: 'manager',
    permissions: ['take_orders'],
    locationId: LOC_A,
    createdAt: Date.now(),
    expiresAt: Date.now() + 3_600_000,
    absoluteExpiry: Date.now() + 86_400_000,
    ...overrides,
  }
}

const locStaffSession = () => session()
const locAdminSession = () => session({ role: 'admin', permissions: ['admin', 'take_orders'] })
const superAdminSession = () => session({ role: 'super_admin', locationId: null, permissions: ['admin', 'view_reports'] })

function getReq(url: string) {
  return new Request(url, { method: 'GET' })
}

function jsonReq(url: string, body: unknown, method = 'POST') {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

const unauthorized = () => ({
  session: null,
  error: new Response(JSON.stringify({ error: 'Avtentikacija je obvezna.' }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  }),
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuth.mockResolvedValue({ session: locStaffSession(), error: null })
  mocks.checkRateLimitAsync.mockResolvedValue({ allowed: true, retryAfterMs: 0 })
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({
    giftCard: {
      findUnique: mocks.giftCardFindUnique,
      create: mocks.giftCardCreate,
      update: mocks.giftCardUpdate,
      updateMany: mocks.giftCardUpdateMany,
    },
    giftCardTransaction: { create: mocks.giftCardTxCreate },
  }))
  mocks.createAuditLog.mockResolvedValue(undefined)
  mocks.giftCardFindMany.mockResolvedValue([])
  mocks.giftCardCount.mockResolvedValue(0)
  mocks.giftCardFindUnique.mockResolvedValue(null)
  mocks.giftCardUpdate.mockResolvedValue({})
  mocks.giftCardUpdateMany.mockResolvedValue({ count: 1 })
  mocks.giftCardDeleteMany.mockResolvedValue({ count: 1 })
  mocks.giftCardTxCount.mockResolvedValue(0)
  mocks.giftCardTxCreate.mockResolvedValue({ id: 'gtx-1' })
  mocks.giftCardGroupBy.mockResolvedValue([])
  mocks.giftCardAggregate.mockResolvedValue({ _count: { _all: 0 }, _sum: { balance: null } })
  mocks.locationFindMany.mockResolvedValue([])
})

// ════════════════════════════════════════════════════════════════
// POST /api/gift-cards — audit v tx
// ════════════════════════════════════════════════════════════════
describe('R144 POST /api/gift-cards — GIFT_CARD_CREATED audit', () => {
  it('1. audit točno 1× V tx — details last4 SAMO (poln cardNumber nikoli), initialBalance, locationId', async () => {
    mocks.giftCardCreate.mockResolvedValue(cardRow({ id: 'gc-new', balance: 100, initialBalance: 100 }))
    mocks.giftCardFindUnique.mockResolvedValue(cardRow({ id: 'gc-new', balance: 100, initialBalance: 100 }))

    const res = await giftCardsPOST(jsonReq('http://localhost:3000/api/gift-cards', {
      cardNumber: CARD,
      balance: 100,
      ownerName: 'Ana Novak',
    }))

    expect(res.status).toBe(201)
    // začetni 'load' ledger (R69 greaterThan) se še vedno zapiše
    expect(mocks.giftCardTxCreate).toHaveBeenCalledTimes(1)

    // audit: točno en klic, znotraj tx (drugi argument definiran)
    expect(mocks.createAuditLog).toHaveBeenCalledTimes(1)
    const [entry, txArg] = mocks.createAuditLog.mock.calls[0]
    expect(entry.action).toBe('GIFT_CARD_CREATED')
    expect(entry.entityType).toBe('GiftCard')
    expect(entry.entityId).toBe('gc-new')
    expect(entry.userId).toBe('emp-1')
    expect(txArg).toBeDefined()
    expect(entry.details.cardLast4).toBe(LAST4)
    expect(entry.details.initialBalance).toBe(100)
    expect(entry.details.locationId).toBe(LOC_A)
    expect(entry.locationId).toBe(LOC_A)
    // PII/denar kanon: poln cardNumber NIKOLI v detailsih
    const detailsJson = JSON.stringify(entry.details)
    expect(detailsJson).not.toContain(CARD)
    expect(detailsJson).not.toContain('1234')
  })

  it('1b. 0-balance kartica → brez začetnega load ledgerja, audit še vedno zapisan', async () => {
    mocks.giftCardCreate.mockResolvedValue(cardRow({ id: 'gc-zero', balance: 0, initialBalance: 0 }))
    mocks.giftCardFindUnique.mockResolvedValue(cardRow({ id: 'gc-zero', balance: 0, initialBalance: 0 }))

    const res = await giftCardsPOST(jsonReq('http://localhost:3000/api/gift-cards', {
      cardNumber: CARD,
      balance: 0,
    }))

    expect(res.status).toBe(201)
    expect(mocks.giftCardTxCreate).not.toHaveBeenCalled() // R69: brez lažnega load 0
    expect(mocks.createAuditLog).toHaveBeenCalledTimes(1)
    expect(mocks.createAuditLog.mock.calls[0][0].action).toBe('GIFT_CARD_CREATED')
  })
})

// ════════════════════════════════════════════════════════════════
// PUT /api/gift-cards/[id] — GIFT_CARD_ADJUSTED / STATUS_CHANGED / no-op
// ════════════════════════════════════════════════════════════════
describe('R144 PUT /api/gift-cards/[id] — audit trail', () => {
  /** Plain (brez include) findUnique zaporedje: pre-check → tx re-read → post-op. */
  function queuePlainReads(reads: CardRow[]) {
    let i = 0
    mocks.giftCardFindUnique.mockImplementation(async (args: { include?: unknown } = {}) => {
      if (args.include) return cardRow(reads[reads.length - 1])
      const row = reads[Math.min(i, reads.length - 1)]
      i++
      return row
    })
  }

  it('2. load delta → GIFT_CARD_ADJUSTED točno 1× (delta/before/after/last4), brez status audita; R103 G1 pogojni updateMany pin', async () => {
    queuePlainReads([
      cardRow({ balance: 50 }), // pre-check
      cardRow({ balance: 50 }), // tx re-read
      cardRow({ balance: 100 }), // post-op read (updateData prazen)
    ])

    const res = await giftCardPUT(jsonReq('http://localhost:3000/api/gift-cards/gc-1', { balance: 100 }, 'PUT'), ctx('gc-1'))

    expect(res.status).toBe(200)
    expect(mocks.giftCardUpdateMany).toHaveBeenCalledTimes(1)
    const upd = mocks.giftCardUpdateMany.mock.calls[0][0]
    // R103 G1: cap = initialBalance (100) − diff (50) → pogojni increment
    expect(upd.where).toEqual({ id: 'gc-1', balance: { lte: 50 } })
    expect(upd.data).toEqual({ balance: { increment: 50 } })

    expect(mocks.createAuditLog).toHaveBeenCalledTimes(1)
    const [entry, txArg] = mocks.createAuditLog.mock.calls[0]
    expect(entry.action).toBe('GIFT_CARD_ADJUSTED')
    expect(entry.entityId).toBe('gc-1')
    expect(entry.details).toEqual({
      delta: 50,
      balanceBefore: 50,
      balanceAfter: 100,
      cardLast4: LAST4,
    })
    expect(entry.locationId).toBe(LOC_A)
    expect(txArg).toBeDefined()
    // diff-only: status se ni spremenil → NI status audita
    expect(mocks.createAuditLog.mock.calls.map((c) => c[0].action)).toEqual(['GIFT_CARD_ADJUSTED'])
    // ledger (auto 'load') ostaja
    expect(mocks.giftCardTxCreate).toHaveBeenCalledTimes(1)
  })

  it('3. depleted→active reaktivacija ob loadu → ADJUSTED + STATUS_CHANGED (2 audita)', async () => {
    queuePlainReads([
      cardRow({ balance: 0, status: 'depleted' }),
      cardRow({ balance: 0, status: 'depleted' }),
    ])
    mocks.giftCardUpdate.mockResolvedValue(cardRow({ balance: 50, status: 'active' }))

    const res = await giftCardPUT(jsonReq('http://localhost:3000/api/gift-cards/gc-1', { balance: 50 }, 'PUT'), ctx('gc-1'))

    expect(res.status).toBe(200)
    const actions = mocks.createAuditLog.mock.calls.map((c) => c[0].action)
    expect(actions).toEqual(['GIFT_CARD_ADJUSTED', 'GIFT_CARD_STATUS_CHANGED'])
    const [adj, status] = mocks.createAuditLog.mock.calls
    expect(adj[0].details).toEqual({ delta: 50, balanceBefore: 0, balanceAfter: 50, cardLast4: LAST4 })
    expect(status[0].details.before).toBe('depleted')
    expect(status[0].details.after).toBe('active')
    expect(status[0].details.cardLast4).toBe(LAST4)
    // oba audita v tx
    expect(adj[1]).toBeDefined()
    expect(status[1]).toBeDefined()
  })

  it('4. status-only sprememba → GIFT_CARD_STATUS_CHANGED (before/after), brez adjust audita', async () => {
    queuePlainReads([cardRow({ status: 'active' }), cardRow({ status: 'active' })])
    mocks.giftCardUpdate.mockResolvedValue(cardRow({ status: 'suspended' }))

    const res = await giftCardPUT(jsonReq('http://localhost:3000/api/gift-cards/gc-1', { status: 'suspended' }, 'PUT'), ctx('gc-1'))

    expect(res.status).toBe(200)
    const actions = mocks.createAuditLog.mock.calls.map((c) => c[0].action)
    expect(actions).toEqual(['GIFT_CARD_STATUS_CHANGED'])
    const [entry] = mocks.createAuditLog.mock.calls[0]
    expect(entry.details.before).toBe('active')
    expect(entry.details.after).toBe('suspended')
    expect(entry.details.cardLast4).toBe(LAST4)
    expect(mocks.giftCardUpdateMany).not.toHaveBeenCalled() // brez balance operacije
    expect(mocks.giftCardTxCreate).not.toHaveBeenCalled() // brez auto ledgerja
  })

  it('5. no-op PUT (prazen body ALI balance = trenutno) → ZERO auditov, zero update/ledger', async () => {
    queuePlainReads([cardRow({ balance: 50 }), cardRow({ balance: 50 }), cardRow({ balance: 50 })])

    const resEmpty = await giftCardPUT(jsonReq('http://localhost:3000/api/gift-cards/gc-1', {}, 'PUT'), ctx('gc-1'))
    expect(resEmpty.status).toBe(200)

    const resSame = await giftCardPUT(jsonReq('http://localhost:3000/api/gift-cards/gc-1', { balance: 50 }, 'PUT'), ctx('gc-1'))
    expect(resSame.status).toBe(200)

    // diff-only kanon: nič spremenjeno = nič za logirat
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
    expect(mocks.giftCardUpdate).not.toHaveBeenCalled()
    expect(mocks.giftCardUpdateMany).not.toHaveBeenCalled()
    expect(mocks.giftCardTxCreate).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════
// DELETE /api/gift-cards/[id] — GIFT_CARD_DELETED
// ════════════════════════════════════════════════════════════════
describe('R144 DELETE /api/gift-cards/[id] — audit', () => {
  it('6. prazna kartica → 200 + GIFT_CARD_DELETED (last4, balanceAtDelete, txnCount)', async () => {
    mocks.requireAuth.mockResolvedValue({ session: locAdminSession(), error: null })
    let call = 0
    mocks.giftCardFindUnique.mockImplementation(async (args: { select?: unknown } = {}) => {
      call++
      if (args.select) return { balance: 0 } // fresh balance re-read
      return call === 1 ? cardRow({ balance: 0 }) : cardRow({ balance: 0 })
    })
    mocks.giftCardTxCount.mockResolvedValue(0)

    const res = await giftCardDELETE(new Request('http://localhost:3000/api/gift-cards/gc-1', { method: 'DELETE' }), ctx('gc-1'))

    expect(res.status).toBe(200)
    expect(mocks.giftCardDeleteMany).toHaveBeenCalledTimes(1)
    // scoped deleteMany (R103 G5 kanon)
    expect(mocks.giftCardDeleteMany.mock.calls[0][0].where).toEqual({ id: 'gc-1', locationId: LOC_A })

    expect(mocks.createAuditLog).toHaveBeenCalledTimes(1)
    const [entry] = mocks.createAuditLog.mock.calls[0]
    expect(entry.action).toBe('GIFT_CARD_DELETED')
    expect(entry.entityType).toBe('GiftCard')
    expect(entry.entityId).toBe('gc-1')
    expect(entry.details.cardLast4).toBe(LAST4)
    expect(entry.details.balanceAtDelete).toBe(0)
    expect(entry.details.txnCount).toBe(0)
    expect(entry.locationId).toBe(LOC_A)
    // poln cardNumber nikoli v detailsih
    expect(JSON.stringify(entry.details)).not.toContain(CARD)
  })

  it('7. kartica s stanjem → 409 guard (gift-card-guard), ZERO auditov in brisanja', async () => {
    mocks.requireAuth.mockResolvedValue({ session: locAdminSession(), error: null })
    let call = 0
    mocks.giftCardFindUnique.mockImplementation(async (args: { select?: unknown } = {}) => {
      call++
      if (args.select) return { balance: 50 }
      return cardRow({ balance: 50 })
    })
    mocks.giftCardTxCount.mockResolvedValue(0)

    const res = await giftCardDELETE(new Request('http://localhost:3000/api/gift-cards/gc-1', { method: 'DELETE' }), ctx('gc-1'))

    expect(res.status).toBe(409)
    expect(mocks.giftCardDeleteMany).not.toHaveBeenCalled()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════
// GET /api/gift-cards — whitelist + no-store + scope
// ════════════════════════════════════════════════════════════════
describe('R144 GET /api/gift-cards — whitelist + no-store + scope', () => {
  it('8. GIFT_CARD_SELECT whitelist pin + transactions select + no-store + bucket + response shape', async () => {
    const res = await giftCardsGET(getReq('http://localhost:3000/api/gift-cards'))

    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')

    expect(mocks.giftCardFindMany).toHaveBeenCalledTimes(1)
    const args = mocks.giftCardFindMany.mock.calls[0][0]
    // TOČNO whitelist ključi + transactions sub-select (polne vrstice so
    // prejšnja kršitev — R142 kanon)
    expect(Object.keys(args.select).sort()).toEqual(
      ['balance', 'cardNumber', 'expiresAt', 'id', 'initialBalance', 'location', 'locationId', 'ownerName', 'purchasedAt', 'status', 'transactions'],
    )
    expect(args.select.location).toEqual({ select: { name: true, code: true } })
    // obrambno: nikoli relacij, ki jih UI ne bere
    expect(args.select).not.toHaveProperty('payments')
    expect(args.select).not.toHaveProperty('createdAt')
    expect(args.select).not.toHaveProperty('updatedAt')
    // transactions select = polni UI kontrakt (9 stolpcev), take 10, desc
    const tx = args.select.transactions
    expect(tx.take).toBe(10)
    expect(tx.orderBy).toEqual({ createdAt: 'desc' })
    expect(Object.keys(tx.select).sort()).toEqual(
      ['amount', 'balanceAfter', 'checkId', 'createdAt', 'giftCardId', 'id', 'note', 'orderId', 'type'],
    )
    // rl bucket ohranjen (r94 fs-guard pariteta)
    expect(mocks.checkRateLimitAsync.mock.calls[0][0]).toBe('gift-cards')
    // response shape NESESPEMLJENA (UI/prefetch/plačilni dialog)
    const body = await res.json()
    expect(Object.keys(body).sort()).toEqual(['giftCards', 'limit', 'offset', 'total'])
  })

  it('9. scope: loc-bound → where.locationId (kljub ?locationId=B); super-admin → brez ključa; filtri kompozibilni', async () => {
    await giftCardsGET(getReq(`http://localhost:3000/api/gift-cards?locationId=${LOC_B}&status=active&cardNumber=${CARD}`))
    const where = mocks.giftCardFindMany.mock.calls[0][0].where
    expect(where.locationId).toBe(LOC_A) // lokacijska seja avtoritativna
    expect(where.status).toBe('active')
    expect(where.cardNumber).toBe(CARD) // checkout lookup
    expect(mocks.giftCardCount.mock.calls[0][0].where).toEqual(where)

    mocks.requireAuth.mockResolvedValue({ session: superAdminSession(), error: null })
    await giftCardsGET(getReq('http://localhost:3000/api/gift-cards'))
    const superWhere = mocks.giftCardFindMany.mock.calls[1][0].where
    expect('locationId' in superWhere).toBe(false) // nikoli { locationId: null }
  })
})

// ════════════════════════════════════════════════════════════════
// GET /api/gift-cards/liability — NOVO
// ════════════════════════════════════════════════════════════════
describe('R144 GET /api/gift-cards/liability — auth + rate limit', () => {
  it('10. 401 fail-closed, ZERO DB dotikov, view_reports permission pin', async () => {
    mocks.requireAuth.mockResolvedValue(unauthorized())

    const res = await liabilityGET(getReq('http://localhost:3000/api/gift-cards/liability'))

    expect(res.status).toBe(401)
    expect(mocks.requireAuth).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ permission: 'view_reports' }),
    )
    expect(mocks.giftCardGroupBy).not.toHaveBeenCalled()
    expect(mocks.giftCardAggregate).not.toHaveBeenCalled()
    expect(mocks.locationFindMany).not.toHaveBeenCalled()
  })

  it('11. 429 rate-limit bucket gift-cards-liability PRED auth, zero DB', async () => {
    mocks.checkRateLimitAsync.mockResolvedValue({ allowed: false, retryAfterMs: 30_000 })

    const res = await liabilityGET(getReq('http://localhost:3000/api/gift-cards/liability'))

    expect(res.status).toBe(429)
    expect(mocks.checkRateLimitAsync.mock.calls[0][0]).toBe('gift-cards-liability')
    expect(mocks.requireAuth).not.toHaveBeenCalled()
    expect(mocks.giftCardGroupBy).not.toHaveBeenCalled()
  })
})

describe('R144 GET /api/gift-cards/liability — totals + scope + expiringSoon30d', () => {
  /** groupBy dispatch: by ['status'] → totals; by ['locationId','status'] → byLocation. */
  function mockGroupBy(statusRows: Array<Record<string, unknown>>, locRows: Array<Record<string, unknown>>) {
    mocks.giftCardGroupBy.mockImplementation(async (args: { by: string[] } = { by: [] }) =>
      args.by.length === 1 ? statusRows : locRows,
    )
  }

  it('12. totals matematika: outstanding = active+depleted SAMO; expiring okno 30d; loc-admin single bucket; no-store', async () => {
    mockGroupBy(
      [
        { status: 'active', _count: { _all: 3 }, _sum: { balance: 300 } },
        { status: 'depleted', _count: { _all: 1 }, _sum: { balance: 0 } },
        { status: 'suspended', _count: { _all: 2 }, _sum: { balance: 77 } },
        { status: 'expired', _count: { _all: 4 }, _sum: { balance: 99 } },
      ],
      [
        { locationId: LOC_A, status: 'active', _count: { _all: 3 }, _sum: { balance: 300 } },
        { locationId: LOC_A, status: 'depleted', _count: { _all: 1 }, _sum: { balance: 0 } },
        { locationId: LOC_A, status: 'suspended', _count: { _all: 2 }, _sum: { balance: 77 } },
        { locationId: LOC_A, status: 'expired', _count: { _all: 4 }, _sum: { balance: 99 } },
      ],
    )
    mocks.giftCardAggregate.mockResolvedValue({ _count: { _all: 2 }, _sum: { balance: 45 } })
    mocks.locationFindMany.mockResolvedValue([{ id: LOC_A, name: 'Lokacija A', code: 'LA' }])

    const res = await liabilityGET(getReq('http://localhost:3000/api/gift-cards/liability'))

    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    const body = await res.json()

    // odgovor key pin (kontrakt R144-b)
    expect(Object.keys(body).sort()).toEqual(['byLocation', 'generatedAt', 'totals'])
    expect(Object.keys(body.totals).sort()).toEqual(
      ['activeCards', 'depletedCards', 'expiredCards', 'expiringSoon30d', 'outstandingBalance', 'suspendedCards'],
    )
    expect(body.totals.outstandingBalance).toBe(300) // 300 + 0; suspended 77 + expired 99 IZKLJUČENI
    expect(body.totals.activeCards).toBe(3)
    expect(body.totals.depletedCards).toBe(1)
    expect(body.totals.suspendedCards).toBe(2)
    expect(body.totals.expiredCards).toBe(4)
    expect(body.totals.expiringSoon30d).toEqual({ cards: 2, balance: 45 })

    // scope where: loc-bound → locationId na VSIH poizvedbah
    const totalsCall = mocks.giftCardGroupBy.mock.calls.find((c) => c[0].by.length === 1)![0]
    const locCall = mocks.giftCardGroupBy.mock.calls.find((c) => c[0].by.length === 2)![0]
    expect(totalsCall.where).toEqual({ locationId: LOC_A })
    expect(locCall.where).toEqual({ locationId: LOC_A })
    expect(totalsCall._count).toEqual({ _all: true })
    expect(totalsCall._sum).toEqual({ balance: true })

    // expiringSoon30d: status active + expiresAt ≤ now+30d (ZGORNJA meja samo —
    // lazy expiry ostatke naj poročilo pokaže; NI spodnje meje)
    const aggCall = mocks.giftCardAggregate.mock.calls[0][0]
    expect(aggCall.where.status).toBe('active')
    expect(aggCall.where.locationId).toBe(LOC_A)
    expect('gte' in aggCall.where.expiresAt).toBe(false)
    const lte = aggCall.where.expiresAt.lte as Date
    expect(lte.getTime()).toBeGreaterThan(Date.now() + 29.9 * DAY_MS)
    expect(lte.getTime()).toBeLessThan(Date.now() + 30.1 * DAY_MS)
    // konstanta = enoten vir za UI (R144-c)
    expect(GIFT_CARD_EXPIRING_SOON_DAYS).toBe(30)

    // byLocation: ENOJNA vrstica lokacijskega admina (tudi ko so števci > 0)
    expect(body.byLocation).toHaveLength(1)
    expect(body.byLocation[0]).toEqual({
      locationId: LOC_A,
      locationName: 'Lokacija A',
      locationCode: 'LA',
      outstandingBalance: 300,
      activeCards: 3,
      depletedCards: 1,
      suspendedCards: 2,
      expiredCards: 4,
    })
    // location lookup whitelist { id, name, code }
    expect(mocks.locationFindMany.mock.calls[0][0].select).toEqual({ id: true, name: true, code: true })
  })

  it('13. super-admin: per-location vrstice + Brez lokacije bucket ZADNJI + Decimal→number', async () => {
    mocks.requireAuth.mockResolvedValue({ session: superAdminSession(), error: null })
    mockGroupBy(
      [
        { status: 'active', _count: { _all: 2 }, _sum: { balance: new Prisma.Decimal('200.25') } },
        { status: 'depleted', _count: { _all: 1 }, _sum: { balance: 0 } },
      ],
      [
        { locationId: LOC_B, status: 'suspended', _count: { _all: 1 }, _sum: { balance: new Prisma.Decimal('55.50') } },
        { locationId: LOC_A, status: 'active', _count: { _all: 2 }, _sum: { balance: new Prisma.Decimal('200.25') } },
        { locationId: null, status: 'depleted', _count: { _all: 1 }, _sum: { balance: 0 } },
      ],
    )
    mocks.giftCardAggregate.mockResolvedValue({ _count: { _all: 0 }, _sum: { balance: null } })
    mocks.locationFindMany.mockResolvedValue([
      { id: LOC_A, name: 'Alpha', code: 'AL' },
      { id: LOC_B, name: 'Beta', code: 'BE' },
    ])

    const res = await liabilityGET(getReq('http://localhost:3000/api/gift-cards/liability'))
    const body = await res.json()

    // Decimal(12,2) → number (deepToNumbers/toNum kanon), NIKOLI string
    expect(body.totals.outstandingBalance).toBe(200.25)
    expect(typeof body.totals.outstandingBalance).toBe('number')

    expect(body.byLocation).toHaveLength(3)
    // sort po imenu; null bucket ('Brez lokacije') deterministično ZADNJI
    expect(body.byLocation.map((r: { locationName: string }) => r.locationName)).toEqual(['Alpha', 'Beta', 'Brez lokacije'])
    expect(body.byLocation[0]).toMatchObject({
      locationId: LOC_A,
      outstandingBalance: 200.25,
      activeCards: 2,
      suspendedCards: 0,
    })
    // Beta: suspended balance 55.50 NE pride v outstanding (suspended izključen)
    expect(body.byLocation[1]).toMatchObject({
      locationId: LOC_B,
      outstandingBalance: 0,
      suspendedCards: 1,
    })
    expect(body.byLocation[2]).toMatchObject({
      locationId: null,
      locationCode: null,
      depletedCards: 1,
      outstandingBalance: 0,
    })
    // lookup samo za prisotne id-je (null bucket brez lookupa); vrstni red po
    // Map vstavljanju ni pinan — primerjamo kot množico
    const lookupWhere = mocks.locationFindMany.mock.calls[0][0].where
    expect(lookupWhere.id.in).toHaveLength(2)
    expect([...lookupWhere.id.in].sort()).toEqual([LOC_A, LOC_B].sort())
  })

  it('14. loc-admin brez kartic → enojna ničelna vrstica svoje lokacije (pošteno prazno stanje)', async () => {
    mocks.requireAuth.mockResolvedValue({ session: locAdminSession(), error: null })
    mockGroupBy([], [])
    mocks.giftCardAggregate.mockResolvedValue({ _count: { _all: 0 }, _sum: { balance: null } })
    mocks.locationFindMany.mockResolvedValue([{ id: LOC_A, name: 'Lokacija A', code: 'LA' }])

    const res = await liabilityGET(getReq('http://localhost:3000/api/gift-cards/liability'))
    const body = await res.json()

    expect(body.totals.outstandingBalance).toBe(0)
    expect(body.totals.expiringSoon30d).toEqual({ cards: 0, balance: 0 })
    expect(body.byLocation).toEqual([
      {
        locationId: LOC_A,
        locationName: 'Lokacija A',
        locationCode: 'LA',
        outstandingBalance: 0,
        activeCards: 0,
        depletedCards: 0,
        suspendedCards: 0,
        expiredCards: 0,
      },
    ])
  })
})

// ---------- čisti helper (enoten vir — PII kanon) ----------
describe('R144 giftCardLast4 — PII helper', () => {
  it('15. zadnji 4 znaki; null/undefined → prazen niz (nikoli crash)', () => {
    expect(giftCardLast4('GC-1234-5678')).toBe('5678')
    expect(giftCardLast4('1234')).toBe('1234')
    expect(giftCardLast4('')).toBe('')
    expect(giftCardLast4(null)).toBe('')
    expect(giftCardLast4(undefined)).toBe('')
  })
})
