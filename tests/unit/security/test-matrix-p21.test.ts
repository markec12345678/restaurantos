// ============================================
// P1-21: TESTNA MATRIKA — varnostni scenariji
// ============================================
// Zahteva (uporabnik): testi za:
//   unauthenticated request, disabled user, wrong role, malformed UUID,
//   invalid decimal, duplicate idempotency key, replayed webhook,
//   duplicate offline event, expired session, revoked session.
//
// Pokritost iz obstoječih testov (referenca, ne duplikat):
//   - wrong location  → tests/unit/security/idor-cross-tenant.test.ts
//   - concurrent update → tests/unit/security/concurrency-p19.test.ts
//   - stale client version (offline sync konflikt) → tests/unit/sync.test.ts
//     ("incoming < existing → konflikt (stale write)")
//
// Ta datoteka pokriva MANJKAJOČE scenarije na enoti (prava koda,
// mockiran samo db sloj — verifyToken/requireAuth tečejo čisto).
// ============================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { Prisma } from '@prisma/client'

// ── Mock db (enoten vzorec iz payment-tenant-guard.test.ts) ──
const mocks = vi.hoisted(() => ({
  employeeFindUnique: vi.fn(),
  sessionFindUnique: vi.fn(),
  sessionDeleteMany: vi.fn(),
  sessionCreate: vi.fn(),
  sessionUpdateMany: vi.fn(),
  employeeUpdate: vi.fn(),
  paymentFindFirst: vi.fn(),
  checkFindFirst: vi.fn(),
  transaction: vi.fn(),
  syncStateFindUnique: vi.fn(),
  syncStateUpsert: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    employee: { findUnique: mocks.employeeFindUnique, update: mocks.employeeUpdate },
    session: {
      findUnique: mocks.sessionFindUnique,
      deleteMany: mocks.sessionDeleteMany,
      create: mocks.sessionCreate,
      updateMany: mocks.sessionUpdateMany,
    },
    payment: { findFirst: mocks.paymentFindFirst, findUnique: vi.fn() },
    check: { findFirst: mocks.checkFindFirst, findUnique: vi.fn() },
    syncState: { findUnique: mocks.syncStateFindUnique, upsert: mocks.syncStateUpsert },
    $transaction: mocks.transaction,
  },
}))

// In-memory session cache pod nadzorom testa (session-lifecycle ga uvozi)
const sessionCache = vi.hoisted(() => ({ sessions: new Map<string, unknown>(), syncSessionToWs: vi.fn() }))
vi.mock('@/lib/auth-middleware/session-store/session-cache', () => sessionCache)

// Webhook odvisnost (provider authorize) — mockiran, podpis ostaja REAL
const walletMocks = vi.hoisted(() => ({ authorizeWalletPayment: vi.fn() }))
vi.mock('@/lib/wallet-payment', () => walletMocks)

// ── Uvozi pod testom ──
import { requireAuth } from '@/lib/auth-middleware'
import { verifyToken, invalidateEmployeeStatusCache } from '@/lib/auth-middleware/session-store/session-lifecycle'
import { hashSessionToken } from '@/lib/auth-middleware/session-store/token-hash'
import { handleApiError } from '@/lib/api-utils'
import { handleCreatePayment } from '@/app/api/payments/_helpers/create-payment'
import { POST as webhookPost } from '@/app/api/wallet-payment/webhook/route'
import { positiveNumber } from '@/lib/validations/shared'
import { sessions } from '@/lib/auth-middleware/session-store/session-cache'
import type { Session } from '@/lib/auth-middleware/types'

// Utišaj logger noise
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'log').mockImplementation(() => {})

const EMP_ID = 'emp-p21'
const TOKEN = 'p21-plain-token-abc123'
const TOKEN_HASH = hashSessionToken(TOKEN)
const NOW = Date.now()

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    token: TOKEN_HASH,
    employeeId: EMP_ID,
    role: 'waiter',
    permissions: [],
    createdAt: NOW - 1000,
    expiresAt: NOW + 60_000,
    absoluteExpiry: NOW + 3_600_000,
    locationId: 'loc-p21',
    sessionVersion: 0,
    ...overrides,
  } as Session
}

function makeDbSession(overrides: Record<string, unknown> = {}) {
  return {
    token: TOKEN_HASH,
    employeeId: EMP_ID,
    role: 'waiter',
    permissions: JSON.stringify([]),
    createdAt: new Date(NOW - 1000),
    expiresAt: new Date(NOW + 60_000),
    absoluteExpiry: new Date(NOW + 3_600_000),
    sessionVersion: 0,
    ...overrides,
  }
}

function makeEmployee(overrides: Record<string, unknown> = {}) {
  return { status: 'active', locationId: 'loc-p21', sessionVersion: 0, ...overrides }
}

function authReq(headers: Record<string, string> = {}) {
  return new Request('http://localhost:3000/api/orders', {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, ...headers },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  sessions.clear()
  invalidateEmployeeStatusCache(EMP_ID)
  process.env.WALLET_WEBHOOK_SECRET = 'whsec_p21'
  // Fire-and-forget DB klici (.catch(() => {})) morajo vrniti Promise
  // — sicer undefined.catch vrže TypeError (ne poškoduje production kode,
  // samo mock pogodba v testih).
  mocks.sessionDeleteMany.mockResolvedValue({ count: 0 })
  mocks.sessionUpdateMany.mockResolvedValue({ count: 0 })
  mocks.sessionCreate.mockResolvedValue({})
  mocks.employeeUpdate.mockResolvedValue({})
})

afterEach(() => {
  delete process.env.WALLET_WEBHOOK_SECRET
})

// ─────────────────────────────────────────────
// 1. UNAUTHENTICATED REQUEST
// ─────────────────────────────────────────────
describe('P1-21 #1: unauthenticated request → 401', () => {
  it('brez Authorization headerja → 401 z navodilom', async () => {
    const res = await requireAuth(new Request('http://localhost:3000/api/orders', { method: 'POST' }))
    expect(res.error).toBeInstanceOf(NextResponse)
    expect(res.error!.status).toBe(401)
    const body = await res.error!.json()
    expect(body.error).toContain('Avtentikacija')
    expect(res.session).toBeNull()
  })

  it('neveljaven žeton (ni v cache-u, ni v DB) → 401', async () => {
    mocks.sessionFindUnique.mockResolvedValue(null) // DB miss
    const res = await requireAuth(authReq())
    expect(res.error!.status).toBe(401)
    const body = await res.error!.json()
    expect(body.error).toContain('Neveljaven ali potekel')
  })

  it('Bearer brez vrednosti → 401 (ne crash-a)', async () => {
    const res = await requireAuth(
      new Request('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { authorization: 'Bearer ' },
      })
    )
    expect(res.error!.status).toBe(401)
  })
})

// ─────────────────────────────────────────────
// 2. DISABLED USER (terminiran/onemogočen račun)
// ─────────────────────────────────────────────
describe('P1-21 #2: disabled user → 401 + uničena seja', () => {
  it('verifyToken: employee status "inactive" (DB pot) → null + brisanje seje', async () => {
    sessions.clear()
    mocks.sessionFindUnique.mockResolvedValue(makeDbSession())
    mocks.employeeFindUnique.mockResolvedValue(makeEmployee({ status: 'inactive' }))

    const result = await verifyToken(TOKEN)
    expect(result).toBeNull()
    expect(mocks.sessionDeleteMany).toHaveBeenCalledWith({ where: { token: TOKEN_HASH } })
  })

  it('verifyToken: employee status "terminated" (in-memory pot) → null + brisanje', async () => {
    sessions.set(TOKEN_HASH, makeSession())
    mocks.employeeFindUnique.mockResolvedValue(makeEmployee({ status: 'terminated' }))

    const result = await verifyToken(TOKEN)
    expect(result).toBeNull()
    // seja je odstranjena iz pomnilnika
    expect(sessions.has(TOKEN_HASH)).toBe(false)
  })

  it('requireAuth: dvojna zaščita — status "suspended" → 401 "ni več aktiven" + destroySession', async () => {
    // verifyToken uspe (active), nato requireAuth-ov lastni check pade
    mocks.sessionFindUnique.mockResolvedValue(makeDbSession())
    mocks.employeeFindUnique
      .mockResolvedValueOnce(makeEmployee({ status: 'active' })) // verifyToken pot
      .mockResolvedValueOnce(makeEmployee({ status: 'suspended' })) // requireAuth dvojni check

    const res = await requireAuth(authReq())
    expect(res.error!.status).toBe(401)
    const body = await res.error!.json()
    expect(body.error).toContain('ni več aktiven')
    // destroySession pobriše DB sejo (fire-and-forget, a klic se zgodi)
    expect(mocks.sessionDeleteMany).toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────
// 3. EXPIRED SESSION
// ─────────────────────────────────────────────
describe('P1-21 #3: expired session → 401 (ne podaljšaj)', () => {
  it('verifyToken: expiresAt v preteklosti (in-memory) → null + eviction', async () => {
    sessions.set(TOKEN_HASH, makeSession({ expiresAt: NOW - 1000 }))
    const result = await verifyToken(TOKEN)
    expect(result).toBeNull()
    expect(sessions.has(TOKEN_HASH)).toBe(false)
  })

  it('verifyToken: absoluteExpiry v preteklosti (in-memory) → null + eviction', async () => {
    sessions.set(TOKEN_HASH, makeSession({ absoluteExpiry: NOW - 1000 }))
    const result = await verifyToken(TOKEN)
    expect(result).toBeNull()
    expect(sessions.has(TOKEN_HASH)).toBe(false)
  })

  it('verifyToken: expiresAt v preteklosti (DB pot) → null + deleteMany', async () => {
    mocks.sessionFindUnique.mockResolvedValue(makeDbSession({ expiresAt: new Date(NOW - 1000) }))
    const result = await verifyToken(TOKEN)
    expect(result).toBeNull()
    expect(mocks.sessionDeleteMany).toHaveBeenCalledWith({ where: { token: TOKEN_HASH } })
  })

  it('requireAuth: potekla seja → 401 "Neveljaven ali potekel žeton"', async () => {
    mocks.sessionFindUnique.mockResolvedValue(makeDbSession({ expiresAt: new Date(NOW - 1000) }))
    const res = await requireAuth(authReq())
    expect(res.error!.status).toBe(401)
  })
})

// ─────────────────────────────────────────────
// 4. REVOKED SESSION (sessionVersion mismatch, P1-11)
// ─────────────────────────────────────────────
describe('P1-21 #4: revoked session → 401', () => {
  it('verifyToken: sessionVersion mismatch (PIN/role spremenjen po prijavi) → null', async () => {
    sessions.set(TOKEN_HASH, makeSession({ sessionVersion: 0 }))
    mocks.employeeFindUnique.mockResolvedValue(makeEmployee({ sessionVersion: 1 })) // bump po prijavi
    const result = await verifyToken(TOKEN)
    expect(result).toBeNull()
    expect(sessions.has(TOKEN_HASH)).toBe(false)
  })
})

// ─────────────────────────────────────────────
// 5. WRONG ROLE (permisija manjka)
// ─────────────────────────────────────────────
describe('P1-21 #5: wrong role → 403', () => {
  it('waiter brez "manage_employees" → 403 (nimate dovoljenja)', async () => {
    mocks.sessionFindUnique.mockResolvedValue(makeDbSession({ role: 'waiter', permissions: '[]' }))
    mocks.employeeFindUnique.mockResolvedValue(makeEmployee())

    const res = await requireAuth(authReq(), { permission: 'manage_employees' })
    expect(res.error).toBeInstanceOf(NextResponse)
    expect(res.error!.status).toBe(403)
    const body = await res.error!.json()
    expect(body.error).toContain('dovoljenja')
  })

  it('manager zahteva "admin" permisijo → 403 (admin-only rute)', async () => {
    mocks.sessionFindUnique.mockResolvedValue(
      makeDbSession({ role: 'manager', permissions: JSON.stringify(['take_orders']) })
    )
    mocks.employeeFindUnique.mockResolvedValue(makeEmployee())

    const res = await requireAuth(authReq(), { permission: 'admin' })
    expect(res.error!.status).toBe(403)
  })
})

// ─────────────────────────────────────────────
// 6. MALFORMED UUID
// ─────────────────────────────────────────────
describe('P1-21 #6: malformed UUID → 400 INVALID_PARAMETER', () => {
  it('handleApiError: PrismaClientValidationError → 400 (ne 500), brez razkritja internals', async () => {
    const err = new Prisma.PrismaClientValidationError(
      'Argument `where`: Provided String `not-a-uuid` is not a valid UUID',
      { clientVersion: '5.22.0' }
    )
    const res = handleApiError(err, 'GET /api/orders/[id]')
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('INVALID_PARAMETER')
    expect(body.requestId).toBeTruthy()
    // Prisma internals (SQL/argumenti) se NE vračajo klientu
    expect(JSON.stringify(body)).not.toContain('not-a-uuid')
    expect(res.headers.get('X-Request-Id')).toBeTruthy()
  })

  it('običajne (ne-prisma) napake ostanejo 500 INTERNAL_ERROR', async () => {
    const res = handleApiError(new Error('boom'), 'GET /api/orders/[id]')
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.code).toBe('INTERNAL_ERROR')
  })
})

// ─────────────────────────────────────────────
// 7. INVALID DECIMAL
// ─────────────────────────────────────────────
describe('P1-21 #7: invalid decimal → validacijska napaka', () => {
  it('negativna cena → zavrnjena', () => {
    expect(positiveNumber.safeParse(-5).success).toBe(false)
  })
  it('nič (minimalni znesek 0.01) → zavrnjena', () => {
    expect(positiveNumber.safeParse(0).success).toBe(false)
  })
  it('NaN → zavrnjen (zod v4: number zavrne NaN)', () => {
    expect(positiveNumber.safeParse(NaN).success).toBe(false)
  })
  it('Infinity → zavrnjen (prepreči DB overflow/nedeterminizem)', () => {
    expect(positiveNumber.safeParse(Infinity).success).toBe(false)
    expect(positiveNumber.safeParse(-Infinity).success).toBe(false)
  })
  it('veljavna decimalna vrednost → sprejeta', () => {
    expect(positiveNumber.safeParse(1.5).success).toBe(true)
    expect(positiveNumber.safeParse(10.55).success).toBe(true)
  })
})

// ─────────────────────────────────────────────
// 8. DUPLICATE IDEMPOTENCY KEY (race path P2002)
// ─────────────────────────────────────────────
describe('P1-21 #8: duplicate idempotency key → obstoječe plačilo (200), ne dvojno plačilo', () => {
  const input = {
    checkId: 'check-p21',
    amount: 12.5,
    tipAmount: 0,
    type: 'cash' as const,
    alternatePaymentTypeId: null,
    cardType: '',
    cardLast4: '',
    authorizationCode: '',
    giftCardId: null,
    loyaltyAccountId: null,
    loyaltyPointsUsed: 0,
    employeeId: null,
    idempotencyKey: 'key-p21-dup',
  }

  it('P2002 (vzporedni request je zmagal) → re-fetch po ključu → 200 z obstoječim', async () => {
    // 1. klic: fast-path miss; 2. klic (po P2002): obstoječe plačilo
    mocks.paymentFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'pay-existing',
        checkId: 'check-p21',
        amount: 12.5,
        status: 'completed',
        check: { id: 'check-p21' },
        alternatePaymentType: null,
        giftCard: null,
        loyaltyAccount: null,
      })
    mocks.checkFindFirst.mockResolvedValue({
      id: 'check-p21',
      total: 12.5,
      orderId: 'order-p21',
      order: { locationId: 'loc-p21' },
    })
    // $transaction vrže unique violation na idempotencyKey
    mocks.transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed on idempotencyKey', {
        code: 'P2002',
        clientVersion: '5.22.0',
      })
    )

    const res = await handleCreatePayment(input, 'emp-p21', 'loc-p21')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('pay-existing')
    // fast-path + race-path re-fetch = 2 poizvedbi po istem ključu
    expect(mocks.paymentFindFirst).toHaveBeenCalledTimes(2)
    expect(mocks.paymentFindFirst.mock.calls[1][0].where.idempotencyKey).toBe('key-p21-dup')
  })
})

// ─────────────────────────────────────────────
// 9. REPLAYED WEBHOOK (Stripe/Adyen retry)
// ─────────────────────────────────────────────
describe('P1-21 #9: replayed webhook → idempotenten odgovor', () => {
  const secret = 'whsec_p21'
  const buildEvent = (type: string) =>
    JSON.stringify({ type, data: { object: { metadata: { walletPaymentId: 'wp-p21' } } } })

  const signedReq = (body: string) => {
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex')
    return new Request('http://localhost:3000/api/wallet-payment/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'stripe-signature': `sha256=${sig}` },
      body,
    })
  }

  it('prvi webhook → 200 {received: true}', async () => {
    walletMocks.authorizeWalletPayment.mockResolvedValue(undefined)
    const res = await webhookPost(signedReq(buildEvent('payment_intent.succeeded')))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.received).toBe(true)
    expect(body.duplicate).toBeUndefined()
  })

  it('replay z UJEMAJOČIM statusom → 200 {received: true, duplicate: true} (ne 500!)', async () => {
    // provider retry-a že obdelan event: plačilo ni več pending
    walletMocks.authorizeWalletPayment.mockRejectedValue(
      new Error('WalletPayment wp-p21 ni v pending stanju (trenutno: authorized)')
    )
    const res = await webhookPost(signedReq(buildEvent('payment_intent.succeeded')))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.received).toBe(true)
    expect(body.duplicate).toBe(true)
  })

  it('replay s KONFLIKTNIM statusom (failed po authorized) → 409 zavrnjen', async () => {
    walletMocks.authorizeWalletPayment.mockRejectedValue(
      new Error('WalletPayment wp-p21 ni v pending stanju (trenutno: authorized)')
    )
    const res = await webhookPost(signedReq(buildEvent('payment_intent.payment_failed')))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('Status conflict')
  })

  it('neveljaven podpis → 401 (timing-safe primerjava)', async () => {
    walletMocks.authorizeWalletPayment.mockResolvedValue(undefined)
    const req = new Request('http://localhost:3000/api/wallet-payment/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 'sha256=' + 'a'.repeat(64) },
      body: buildEvent('payment_intent.succeeded'),
    })
    const res = await webhookPost(req)
    expect(res.status).toBe(401)
    expect(walletMocks.authorizeWalletPayment).not.toHaveBeenCalled()
  })

  it('manjkajoč secret → 503 fail-closed (ne obdelaj nepodpisanih webhookov)', async () => {
    process.env.WALLET_WEBHOOK_SECRET = ''
    const res = await webhookPost(signedReq(buildEvent('payment_intent.succeeded')))
    expect(res.status).toBe(503)
    expect(walletMocks.authorizeWalletPayment).not.toHaveBeenCalled()
  })

  it('malformed JSON (z veljavnim podpisom) → 400', async () => {
    const garbage = '{not json'
    const res = await webhookPost(signedReq(garbage))
    expect(res.status).toBe(400)
  })
})

// ─────────────────────────────────────────────
// 10. DUPLICATE OFFLINE EVENT
// ─────────────────────────────────────────────
describe('P1-21 #10: duplicate offline event → idempotenten upsert (brez dvojne vrstice)', () => {
  it('sync POST: replay istega dogodka → en upsert klic, konflikt NE sprožen (enaka verzija)', async () => {
    // POST /api/sync — isti offline dogodek dvakrat (dvakrat isti body):
    // existing.syncVersion = 5, input.syncVersion = 5 → ni "detected",
    // upsert se kliče z update Math.max(5,5) — idempotentno.
    const { POST } = await import('@/app/api/sync/route')

    mocks.syncStateFindUnique.mockResolvedValue({
      entityType: 'order',
      entityId: 'order-offline-1',
      syncVersion: 5,
      conflictStatus: 'none',
      conflictData: null,
    })
    mocks.syncStateUpsert.mockResolvedValue({
      entityType: 'order',
      entityId: 'order-offline-1',
      syncVersion: 5,
      conflictStatus: 'none',
    })

    const body = JSON.stringify({
      entityType: 'order',
      entityId: 'order-offline-1',
      syncVersion: 5,
      conflictStatus: 'none',
    })

    // Avtentikacija: admin session
    mocks.sessionFindUnique.mockResolvedValue(
      makeDbSession({ role: 'admin', permissions: JSON.stringify(['admin']) })
    )
    mocks.employeeFindUnique.mockResolvedValue(makeEmployee({ status: 'active' }))

    const req = () =>
      new Request('http://localhost:3000/api/sync', {
        method: 'POST',
        headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
        body,
      })

    const res1 = await POST(req())
    expect(res1.status).toBe(200)

    // Replay — isti body
    const res2 = await POST(req())
    expect(res2.status).toBe(200)

    // KLJUČNO: upsert where je kompozitni ključ (entityType_entityId) —
    // oba klica zadenta ISTO vrstico, dvojne vrstice ni mogoče ustvariti.
    const where1 = mocks.syncStateUpsert.mock.calls[0][0].where
    const where2 = mocks.syncStateUpsert.mock.calls[1][0].where
    expect(where1.entityType_entityId).toEqual(where2.entityType_entityId)
    expect(where2.entityType_entityId).toEqual({ entityType: 'order', entityId: 'order-offline-1' })
    // enaka verzija → konflikt NI zaznan (idempotentna replay)
    expect(mocks.syncStateUpsert.mock.calls[1][0].update.conflictStatus).toBe('none')
  })
})
