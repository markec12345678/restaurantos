// ============================================
// R140 — P1-14 FEEDBACK RESOLUTION (epic #115)
// ============================================
// Trap-DB uniti po r139/r137 vzorcu (vi.hoisted + vi.mock('@/lib/db') +
// txClient redirect). Pokritje:
//   A. PATCH /api/guests/feedback/[id] — CAS prehodi (R112 kanon):
//      new→in_review (response → responded+respondedAt), new→resolved
//      (resolvedById/Name/At snapshot iz seje + Employee), resolved→in_review
//      409, CAS lost-race (updateMany count 0) 409 brez audita, tuj tenant
//      404 zero-oracle (isti odgovor kot neobstoječ), opcijski response,
//      Zod rejection, fail-closed auth/scope PRED body parse (R87-4),
//      createAuditLog prejel tx klient.
//   B. POST /api/feedback-public — persist fix: tableId + tableNumber
//      snapshot, neznana miza → tableId brez snapshot (VSEENO 201), orderId
//      na lokaciji → orderRef snapshot, tuj/neobstoječ order → orderRef null
//      (VSEENO 201, zero-oracle), create fail → 500 (FIX '201 vedno').
//   C. GET /api/guests/feedback — SELECT whitelist (banned: email/telefon/
//      resolvedById/updatedAt), Cache-Control no-store, nova polja.
// '@/lib/tenant-scope' NI mockan (r87 vzorec): realen resolver + realen
// notInScopeResponse. '@/lib/api-utils' realen: Zod rejectioni so resnični.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const LOC_A = 'loc-tenant-a'
const LOC_B = 'loc-tenant-b'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  dbFeedbackFindUnique: vi.fn(),
  dbFeedbackFindMany: vi.fn(),
  dbFeedbackCount: vi.fn(),
  dbFeedbackAggregate: vi.fn(),
  dbFeedbackCreate: vi.fn(),
  dbEmployeeFindUnique: vi.fn(),
  dbLocationFindUnique: vi.fn(),
  dbTableFindUnique: vi.fn(),
  dbOrderFindUnique: vi.fn(),
  txFeedbackFindUnique: vi.fn(),
  txFeedbackUpdateMany: vi.fn(),
  txEmployeeFindUnique: vi.fn(),
  requireAuth: vi.fn(),
  createAuditLog: vi.fn(),
  checkRateLimit: vi.fn(),
}))

const txClient = {
  guestFeedback: {
    findUnique: mocks.txFeedbackFindUnique,
    updateMany: mocks.txFeedbackUpdateMany,
  },
  employee: { findUnique: mocks.txEmployeeFindUnique },
}

vi.mock('@/lib/db', () => ({
  db: {
    $transaction: mocks.transaction,
    guestFeedback: {
      findUnique: mocks.dbFeedbackFindUnique,
      findMany: mocks.dbFeedbackFindMany,
      count: mocks.dbFeedbackCount,
      aggregate: mocks.dbFeedbackAggregate,
      create: mocks.dbFeedbackCreate,
    },
    employee: { findUnique: mocks.dbEmployeeFindUnique },
    location: { findUnique: mocks.dbLocationFindUnique },
    table: { findUnique: mocks.dbTableFindUnique },
    order: { findUnique: mocks.dbOrderFindUnique },
  },
  createAuditLog: mocks.createAuditLog,
}))

// Samo requireAuth — '@/lib/tenant-scope' teče REALNO (r87-hygiene vzorec:
// routes, ki ga uvažajo direktno, poganjajo pravo fail-closed logiko)
vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: mocks.requireAuth,
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.checkRateLimit,
  getClientIp: vi.fn(() => '1.2.3.4'),
  FEEDBACK_PUBLIC_LIMIT: { maxRequests: 5, windowMs: 60000 },
}))

vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

import { PATCH as feedbackPATCH } from '@/app/api/guests/feedback/[id]/route'
import { GET as feedbackGET, POST as feedbackPOST } from '@/app/api/guests/feedback/route'
import { POST as publicPOST } from '@/app/api/feedback-public/route'
import { FEEDBACK_SELECT } from '@/app/api/guests/feedback/_helpers/feedback-select'

function session(overrides: Record<string, unknown> = {}) {
  return { token: 'tok-1', employeeId: 'emp-1', role: 'staff', permissions: ['take_orders'], locationId: LOC_A, ...overrides }
}

function jsonReq(url: string, body: unknown, method = 'PATCH') {
  return new Request(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

function getReq(url: string) {
  return new Request(url, { method: 'GET' })
}

const patchCtx = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(txClient))
  mocks.requireAuth.mockResolvedValue({ session: session(), error: null })
  mocks.createAuditLog.mockResolvedValue(undefined)
  mocks.checkRateLimit.mockResolvedValue({ allowed: true, retryAfterMs: 0 })
  // PATCH privzeti: vrstica obstaja, 'new', naša lokacija
  mocks.dbFeedbackFindUnique.mockResolvedValue({ id: 'fb-1', status: 'new', locationId: LOC_A })
  mocks.txFeedbackUpdateMany.mockResolvedValue({ count: 1 })
  mocks.txFeedbackFindUnique.mockResolvedValue({ id: 'fb-1', status: 'in_review', response: 'Hvala!' })
  mocks.txEmployeeFindUnique.mockResolvedValue({ name: 'Peter Kolesar' })
  // GET privzeti
  mocks.dbFeedbackFindMany.mockResolvedValue([])
  mocks.dbFeedbackCount.mockResolvedValue(0)
  mocks.dbFeedbackAggregate.mockResolvedValue({ _count: 0, _avg: { overallRating: null, foodRating: null, serviceRating: null, atmosphereRating: null } })
  // public POST privzeti
  mocks.dbLocationFindUnique.mockResolvedValue({ id: LOC_A })
  mocks.dbTableFindUnique.mockResolvedValue({ number: 5, locationId: LOC_A })
  mocks.dbOrderFindUnique.mockResolvedValue({ orderNumber: 7, locationId: LOC_A })
  mocks.dbFeedbackCreate.mockResolvedValue({ id: 'fb-new' })
})

// ════════════════════════════════════════════════════════════════
// A. PATCH — resolution ruta (staff, CAS, audit v tx)
// ════════════════════════════════════════════════════════════════
describe('R140 A: PATCH /api/guests/feedback/[id] — CAS prehodi', () => {
  it('new→in_review z response → response + respondedAt + responded=true; brez resolved polj', async () => {
    const res = await feedbackPATCH(jsonReq('http://x/api/guests/feedback/fb-1', { status: 'in_review', response: 'Hvala za mnenje!' }), patchCtx('fb-1'))
    expect(res.status).toBe(200)

    const args = mocks.txFeedbackUpdateMany.mock.calls[0][0]
    expect(args.where).toEqual({ id: 'fb-1', status: { in: ['new'] }, locationId: LOC_A })
    expect(Object.keys(args.data).sort()).toEqual(['responded', 'respondedAt', 'response', 'status'])
    expect(args.data).toMatchObject({ status: 'in_review', response: 'Hvala za mnenje!', responded: true })
    expect(args.data.respondedAt).toBeInstanceOf(Date)
    // odziv: no-store + whitelist read-back
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = await res.json()
    expect(body.feedback.status).toBe('in_review')
  })

  it('new→resolved → resolvedById (iz seje) + resolvedByName (Employee snapshot) + resolvedAt, vse v istem tx', async () => {
    const res = await feedbackPATCH(jsonReq('http://x/api/guests/feedback/fb-1', { status: 'resolved' }), patchCtx('fb-1'))
    expect(res.status).toBe(200)

    expect(mocks.txEmployeeFindUnique).toHaveBeenCalledWith({ where: { id: 'emp-1' }, select: { name: true } })
    const args = mocks.txFeedbackUpdateMany.mock.calls[0][0]
    expect(Object.keys(args.data).sort()).toEqual(['resolvedAt', 'resolvedById', 'resolvedByName', 'status'])
    expect(args.data).toMatchObject({ status: 'resolved', resolvedById: 'emp-1', resolvedByName: 'Peter Kolesar' })
    expect(args.data.resolvedAt).toBeInstanceOf(Date)
    // resolved brez response ne sme pisati odgovora
    expect('response' in args.data).toBe(false)
    expect('responded' in args.data).toBe(false)
  })

  it('neveljaven prehod resolved→in_review → 409, BREZ updateMany in BREZ audita', async () => {
    mocks.dbFeedbackFindUnique.mockResolvedValue({ id: 'fb-1', status: 'resolved', locationId: LOC_A })

    const res = await feedbackPATCH(jsonReq('http://x/api/guests/feedback/fb-1', { status: 'in_review' }), patchCtx('fb-1'))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain('Neveljaven prehod statusa mnenja')
    expect(mocks.txFeedbackUpdateMany).not.toHaveBeenCalled()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })

  it('CAS lost-race (updateMany count 0 po najdeni vrstici) → 409 stale, BREZ audita in read-backa', async () => {
    mocks.txFeedbackUpdateMany.mockResolvedValue({ count: 0 })

    const res = await feedbackPATCH(jsonReq('http://x/api/guests/feedback/fb-1', { status: 'resolved' }), patchCtx('fb-1'))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain('v medčasu spremenjen')
    expect(mocks.txFeedbackUpdateMany).toHaveBeenCalledTimes(1)
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
    expect(mocks.txFeedbackFindUnique).not.toHaveBeenCalled()
  })

  it('tuj tenant id → 404 zero-oracle, ISTI odgovor kot neobstoječ id; zero pisnih učinkov', async () => {
    mocks.dbFeedbackFindUnique.mockResolvedValue({ id: 'fb-1', status: 'new', locationId: LOC_B })
    const resForeign = await feedbackPATCH(jsonReq('http://x/api/guests/feedback/fb-1', { status: 'resolved' }), patchCtx('fb-1'))
    expect(resForeign.status).toBe(404)
    const foreignBody = await resForeign.json()

    mocks.dbFeedbackFindUnique.mockResolvedValue(null)
    const resMissing = await feedbackPATCH(jsonReq('http://x/api/guests/feedback/fb-gone', { status: 'resolved' }), patchCtx('fb-gone'))
    expect(resMissing.status).toBe(404)
    const missingBody = await resMissing.json()

    // zero-oracle: enaka oblika odgovora za tuj tenant IN neobstoječ zapis
    expect(foreignBody).toEqual(missingBody)
    expect(mocks.txFeedbackUpdateMany).not.toHaveBeenCalled()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })

  it('manjkajoč response na in_review je OK (opcijsko polje)', async () => {
    const res = await feedbackPATCH(jsonReq('http://x/api/guests/feedback/fb-1', { status: 'in_review' }), patchCtx('fb-1'))
    expect(res.status).toBe(200)
    const args = mocks.txFeedbackUpdateMany.mock.calls[0][0]
    expect(args.data.status).toBe('in_review')
    expect('response' in args.data).toBe(false)
  })

  it('Zod rejection: predolg response (>1000) in napačen status → 400, zero pisnih učinkov', async () => {
    const resLong = await feedbackPATCH(jsonReq('http://x/api/guests/feedback/fb-1', { status: 'in_review', response: 'a'.repeat(1001) }), patchCtx('fb-1'))
    expect(resLong.status).toBe(400)

    const resStatus = await feedbackPATCH(jsonReq('http://x/api/guests/feedback/fb-1', { status: 'closed' }), patchCtx('fb-1'))
    expect(resStatus.status).toBe(400)

    const resEmpty = await feedbackPATCH(jsonReq('http://x/api/guests/feedback/fb-1', { status: 'in_review', response: '   ' }), patchCtx('fb-1'))
    expect(resEmpty.status).toBe(400)

    expect(mocks.txFeedbackUpdateMany).not.toHaveBeenCalled()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })

  it('audit klic v tx: createAuditLog prejel tx klient + before/after status + action po prehodu', async () => {
    await feedbackPATCH(jsonReq('http://x/api/guests/feedback/fb-1', { status: 'in_review', response: 'Hvala!' }), patchCtx('fb-1'))
    expect(mocks.createAuditLog).toHaveBeenCalledTimes(1)
    const entry = mocks.createAuditLog.mock.calls[0][0]
    expect(entry.action).toBe('feedback_status_changed')
    expect(entry.entityType).toBe('GuestFeedback')
    expect(entry.entityId).toBe('fb-1')
    expect(entry.userId).toBe('emp-1')
    expect(entry.details).toMatchObject({ before: 'new', after: 'in_review' })
    // KLJUČNO: drugi argument = tx klient (audit v isti transakciji kot prehod)
    expect(mocks.createAuditLog.mock.calls[0][1]).toBe(txClient)

    mocks.dbFeedbackFindUnique.mockResolvedValue({ id: 'fb-1', status: 'in_review', locationId: LOC_A })
    await feedbackPATCH(jsonReq('http://x/api/guests/feedback/fb-1', { status: 'resolved' }), patchCtx('fb-1'))
    expect(mocks.createAuditLog.mock.calls[1][0].action).toBe('feedback_resolved')
    expect(mocks.createAuditLog.mock.calls[1][1]).toBe(txClient)
  })

  it('fail-closed: brez seje → 401 (auth error), zero DB dotikov', async () => {
    mocks.requireAuth.mockResolvedValue({
      session: null,
      error: new Response(JSON.stringify({ error: 'Avtentikacija je obvezna.' }), { status: 401, headers: { 'content-type': 'application/json' } }),
    })
    const res = await feedbackPATCH(jsonReq('http://x/api/guests/feedback/fb-1', { status: 'resolved' }), patchCtx('fb-1'))
    expect(res.status).toBe(401)
    expect(mocks.dbFeedbackFindUnique).not.toHaveBeenCalled()
    expect(mocks.txFeedbackUpdateMany).not.toHaveBeenCalled()
  })

  it('R87-4 kanon: regular NULL-lokacija seja → 403 PRED body parse (razbit body ne spremeni odgovora)', async () => {
    mocks.requireAuth.mockResolvedValue({ session: session({ role: 'staff', locationId: null }), error: null })

    const resValid = await feedbackPATCH(jsonReq('http://x/api/guests/feedback/fb-1', { status: 'resolved' }), patchCtx('fb-1'))
    expect(resValid.status).toBe(403)

    // dokaz fail-closed-before-body-parse: NEVELJAVEN JSON → še vedno 403
    const broken = new Request('http://x/api/guests/feedback/fb-1', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{ni-json' })
    const resBroken = await feedbackPATCH(broken, patchCtx('fb-1'))
    expect(resBroken.status).toBe(403)
    expect(mocks.dbFeedbackFindUnique).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════
// B. POST /api/feedback-public — persist fix (tableId/orderRef)
// ════════════════════════════════════════════════════════════════
describe('R140 B: POST /api/feedback-public — tableId/orderRef persist', () => {
  const fbBody = (extra: Record<string, unknown> = {}) => ({
    ratings: { food: 5, service: 4 },
    comment: 'Odlično',
    quickFeedback: [],
    source: 'qr_kiosk',
    ...extra,
  })

  it('tableId → persistiran + tableNumber snapshot (miza na isti lokaciji)', async () => {
    const res = await publicPOST(jsonReq('http://x/api/feedback-public', fbBody({ tableId: 'tbl-1', locationId: LOC_A }), 'POST'))
    expect(res.status).toBe(201)

    expect(mocks.dbTableFindUnique).toHaveBeenCalledWith({ where: { id: 'tbl-1' }, select: { number: true, locationId: true } })
    const createArg = mocks.dbFeedbackCreate.mock.calls[0][0].data
    expect(createArg.tableId).toBe('tbl-1')
    expect(createArg.tableNumber).toBe('5')
    expect(createArg.locationId).toBe(LOC_A)
  })

  it('neznana miza → tableId brez snapshot-a IN VSEENO 201 (nikoli ne faila zaradi mize)', async () => {
    mocks.dbTableFindUnique.mockResolvedValue(null)

    const res = await publicPOST(jsonReq('http://x/api/feedback-public', fbBody({ tableId: 'tbl-gone', locationId: LOC_A }), 'POST'))
    expect(res.status).toBe(201)
    const createArg = mocks.dbFeedbackCreate.mock.calls[0][0].data
    expect(createArg.tableId).toBe('tbl-gone')
    expect('tableNumber' in createArg).toBe(false)
  })

  it('orderId obstaja na isti lokaciji → orderRef snapshot (številka naročila)', async () => {
    const res = await publicPOST(jsonReq('http://x/api/feedback-public', fbBody({ orderId: 'ord-1', locationId: LOC_A }), 'POST'))
    expect(res.status).toBe(201)

    expect(mocks.dbOrderFindUnique).toHaveBeenCalledWith({ where: { id: 'ord-1' }, select: { orderNumber: true, locationId: true } })
    const createArg = mocks.dbFeedbackCreate.mock.calls[0][0].data
    expect(createArg.orderRef).toBe('7')
    // zero-oracle: sam orderId (cuid) se NE persistira
    expect('orderId' in createArg).toBe(false)
  })

  it('orderId tuja lokacija ALI neobstoječ → orderRef null IN VSEENO 201 (zero-oracle, enak odgovor)', async () => {
    mocks.dbOrderFindUnique.mockResolvedValue({ orderNumber: 7, locationId: LOC_B })
    const resForeign = await publicPOST(jsonReq('http://x/api/feedback-public', fbBody({ orderId: 'ord-1', locationId: LOC_A }), 'POST'))
    expect(resForeign.status).toBe(201)
    expect(await resForeign.json()).toEqual({ success: true, message: 'Hvala za vaše mnenje!' })
    expect('orderRef' in mocks.dbFeedbackCreate.mock.calls[0][0].data).toBe(false)

    mocks.dbOrderFindUnique.mockResolvedValue(null)
    const resMissing = await publicPOST(jsonReq('http://x/api/feedback-public', fbBody({ orderId: 'ord-gone', locationId: LOC_A }), 'POST'))
    expect(resMissing.status).toBe(201)
    expect(await resMissing.json()).toEqual({ success: true, message: 'Hvala za vaše mnenje!' })
    expect('orderRef' in mocks.dbFeedbackCreate.mock.calls[1][0].data).toBe(false)
  })

  it('brez locationId → NI order lookupa (zero-oracle disciplina) in NI snapshot-a', async () => {
    const res = await publicPOST(jsonReq('http://x/api/feedback-public', fbBody({ orderId: 'ord-1' }), 'POST'))
    expect(res.status).toBe(201)
    expect(mocks.dbOrderFindUnique).not.toHaveBeenCalled()
    expect(mocks.dbFeedbackCreate.mock.calls[0][0].data).not.toHaveProperty('orderRef')
  })

  it("FIX '201 vedno': neuspešen DB create → 500 generičen (handleApiError kanon)", async () => {
    mocks.dbFeedbackCreate.mockRejectedValue(new Error('DB down'))

    const res = await publicPOST(jsonReq('http://x/api/feedback-public', fbBody({ locationId: LOC_A }), 'POST'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeTruthy()
    expect(body.success).toBeUndefined()
  })
})

// ════════════════════════════════════════════════════════════════
// C. GET /api/guests/feedback — whitelist hardening
// ════════════════════════════════════════════════════════════════
describe('R140 C: GET /api/guests/feedback — whitelist + no-store', () => {
  it('SELECT whitelist: nova polja prisotna, banned ključi (email/telefon/worker refi) izključeni', async () => {
    const res = await feedbackGET(getReq('http://x/api/guests/feedback'))
    expect(res.status).toBe(200)

    expect(mocks.dbFeedbackFindMany).toHaveBeenCalledTimes(1)
    const select = mocks.dbFeedbackFindMany.mock.calls[0][0].select
    // nova + obstoječa UI polja
    for (const key of ['id', 'guestName', 'overallRating', 'comment', 'tags', 'response', 'respondedAt', 'status', 'resolvedByName', 'resolvedAt', 'tableNumber', 'orderRef', 'source', 'locationId', 'createdAt']) {
      expect(select[key]).toBe(true)
    }
    // banned: guest kontakti (tudi prihodnji shemski dodatki), worker ref, meta
    for (const banned of ['email', 'phone', 'customerEmail', 'customerPhone', 'ipAddress', 'resolvedById', 'updatedAt']) {
      expect(banned in select).toBe(false)
    }
    // whitelist je dobesedno skupni FEEDBACK_SELECT (GET = PATCH pariteta)
    expect(select).toEqual(FEEDBACK_SELECT)
  })

  it('Cache-Control: no-store na staff GET odgovoru', async () => {
    const res = await feedbackGET(getReq('http://x/api/guests/feedback'))
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = await res.json()
    // stats/NPS agregacije ostanejo nespremenjene (kanon r80)
    expect(body).toHaveProperty('stats')
    expect(body).toHaveProperty('total')
  })
})
