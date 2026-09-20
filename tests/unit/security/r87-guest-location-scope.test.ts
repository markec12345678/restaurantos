// ============================================
// R87-1 — GUEST LOCATION (per-location CRM tenant binding)
// ============================================
// REGRESIJA za R87 schema round (Guest.locationId stolpec + backfill):
//   HIGH   guests/[id] PUT    — prej NEscopčan: kateri koli take_orders staff
//           je smel posodobiti PII gosta KATEREGA KOLI tenanta (ime, email,
//           telefon, alergeni). "R82 schema round" nota čakala na stolpec.
//   HIGH   guests/[id] DELETE — prej NEscopčan: cross-tenant GDPR anonimizacija.
//   MEDIUM guests POST        — prej NULL-žig (gost neviden lokacijskemu
//           zaposlenemu, ki ga je ustvaril; zrcali loyalty POST R86-5).
//   GET    guests + guests/[id] — stolpec ALI naročilna povezava (legacy
//           vrstice pred backfill-om ostanejo vidne prek naročil).
//
// Vzorec (r86-5): realen tenant-scope resolver + resolveWriteLocationId +
// notInScopeResponse; pinanje where-clavzov in data žigov. null scope
// (super-admin) = PRAZEN filter, NIKOLI { locationId: null }.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  guestFindMany: vi.fn(),
  guestCount: vi.fn(),
  guestCreate: vi.fn(),
  guestFindUnique: vi.fn(),
  guestUpdate: vi.fn(),
  orderFindFirst: vi.fn(),
  emitEvent: vi.fn(),
}))

// Auth middleware: mock requireAuth, REALNI tenant-scope resolver
vi.mock('@/lib/auth-middleware', async () => {
  const tenantScope = await import('@/lib/auth-middleware/tenant-scope')
  return {
    requireAuth: mocks.requireAuth,
    resolveTenantLocationId: tenantScope.resolveTenantLocationId,
    resolveTenantLocationIdOrThrow: tenantScope.resolveTenantLocationIdOrThrow,
    tenantScopeToWhere: tenantScope.tenantScopeToWhere,
  }
})

vi.mock('@/lib/event-emitter', () => ({
  emitEvent: mocks.emitEvent,
}))

vi.mock('@/lib/db', () => ({
  db: {
    guest: {
      findMany: mocks.guestFindMany,
      count: mocks.guestCount,
      create: mocks.guestCreate,
      findUnique: mocks.guestFindUnique,
      update: mocks.guestUpdate,
    },
    order: { findFirst: mocks.orderFindFirst },
  },
}))

import { GET as guestsGET, POST as guestsPOST } from '@/app/api/guests/route'
import { GET as guestGET, PUT as guestPUT, DELETE as guestDELETE } from '@/app/api/guests/[id]/route'
import { upsertGuest } from '@/app/api/public/online-order/_helpers/upsert-guest'

vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

const LOC_A = 'loc-tenant-a'
const LOC_B = 'loc-tenant-b'
const GUEST_ID = 'guest-1'

function session(overrides: Record<string, unknown> = {}) {
  mocks.requireAuth.mockResolvedValue({
    session: { employeeId: 'emp-1', role: 'staff', locationId: LOC_A, ...overrides },
    error: null,
  })
}

function listRequest(query = '') {
  return new Request(`http://localhost:3000/api/guests${query}`, { method: 'GET' })
}

function idRequest(method: string, query = '', body?: unknown) {
  return new Request(`http://localhost:3000/api/guests/${GUEST_ID}${query}`, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.guestFindMany.mockResolvedValue([])
  mocks.guestCount.mockResolvedValue(0)
  mocks.guestCreate.mockResolvedValue({ id: 'new-guest', locationId: LOC_A })
  mocks.guestFindUnique.mockResolvedValue(null)
  mocks.guestUpdate.mockResolvedValue({ id: GUEST_ID, locationId: LOC_A })
  mocks.orderFindFirst.mockResolvedValue(null)
  mocks.emitEvent.mockResolvedValue(undefined)
})

// ══════════════════════════════════════════════════════════════════
// A. GET /api/guests — stolpec ALI naročilna povezava
// ══════════════════════════════════════════════════════════════════
describe('R87 A: GET /api/guests — location filter (AND-OR)', () => {
  it('loc-bound staff → where.AND[0].OR = [{ locationId }, { orders.some.locationId }]', async () => {
    session({ role: 'staff', locationId: LOC_A })
    await guestsGET(listRequest())
    const where = mocks.guestFindMany.mock.calls[0][0].where
    expect(where.AND).toEqual([{
      OR: [
        { locationId: LOC_A },
        { orders: { some: { locationId: LOC_A } } },
      ],
    }])
    // count dobi ISTI where (pagination total)
    expect(mocks.guestCount).toHaveBeenCalledWith({ where })
  })

  it('search ?search= → where.OR (search) in where.AND (lokacija) SOOBSTOJITA', async () => {
    session({ role: 'staff', locationId: LOC_A })
    await guestsGET(listRequest('?search=novak'))
    const where = mocks.guestFindMany.mock.calls[0][0].where
    expect(where.AND).toBeDefined() // lokacijski filter NE clobbered
    expect(where.OR).toEqual([
      { firstName: { contains: 'novak' } },
      { lastName: { contains: 'novak' } },
      { phone: { contains: 'novak' } },
      { email: { contains: 'novak' } },
    ])
  })

  it('super-admin → where BREZ lokacijskega AND (globalni pogled)', async () => {
    session({ role: 'admin', locationId: null })
    await guestsGET(listRequest())
    const where = mocks.guestFindMany.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(where, 'AND')).toBe(false)
  })

  it('regular staff z NULL lokacijo → 403 + ZERO db klicev', async () => {
    session({ role: 'staff', locationId: null })
    const res = await guestsGET(listRequest())
    expect(res.status).toBe(403)
    expect(mocks.guestFindMany).not.toHaveBeenCalled()
    expect(mocks.guestCount).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// B. POST /api/guests — žig Guest.locationId (MEDIUM NULL-žig zaprt)
// ══════════════════════════════════════════════════════════════════
describe('R87 B: POST /api/guests — resolveWriteLocationId žig', () => {
  function postRequest(query = '') {
    return new Request(`http://localhost:3000/api/guests${query}`, {
      method: 'POST',
      body: JSON.stringify({ lastName: 'Novak', phone: '040123456' }),
    })
  }

  it('loc-bound staff → create žige session lokacijo', async () => {
    session({ role: 'staff', locationId: LOC_A })
    const res = await guestsPOST(postRequest())
    expect(res.status).toBe(201)
    expect(mocks.guestCreate.mock.calls[0][0].data.locationId).toBe(LOC_A)
  })

  it('regular staff z NULL lokacijo → 403 + ZERO pisnih klicev', async () => {
    session({ role: 'staff', locationId: null })
    const res = await guestsPOST(postRequest())
    expect(res.status).toBe(403)
    expect(mocks.guestCreate).not.toHaveBeenCalled()
  })

  it('super-admin brez ?locationId → 400 fail-closed (NE prva lokacija)', async () => {
    session({ role: 'admin', locationId: null })
    const res = await guestsPOST(postRequest())
    expect(res.status).toBe(400)
    expect(mocks.guestCreate).not.toHaveBeenCalled()
  })

  it('super-admin z ?locationId=LOC_B → izrecni žig LOC_B', async () => {
    session({ role: 'admin', locationId: null })
    const res = await guestsPOST(postRequest(`?locationId=${LOC_B}`))
    expect(res.status).toBe(201)
    expect(mocks.guestCreate.mock.calls[0][0].data.locationId).toBe(LOC_B)
  })
})

// ══════════════════════════════════════════════════════════════════
// C. GET /api/guests/[id] — scope preverba na zapisu
// ══════════════════════════════════════════════════════════════════
describe('R87 C: GET /api/guests/[id] — guestInScope', () => {
  it('gost žigan na TUJO lokacijo, brez naročilne povezave → 404 notInScope', async () => {
    session({ role: 'staff', locationId: LOC_A })
    mocks.guestFindUnique.mockResolvedValue({ id: GUEST_ID, locationId: LOC_B })
    const res = await guestGET(idRequest('GET'), { params: Promise.resolve({ id: GUEST_ID }) })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Gost ni najden') // unificiran 404 — ni oraklja
    // naročilna povezava je bila preverjena (fallback korak)
    expect(mocks.orderFindFirst).toHaveBeenCalledWith({
      where: { guestId: GUEST_ID, locationId: LOC_A },
      select: { id: true },
    })
  })

  it('gost z NULL žigom, a z naročilom na mojo lokacijo → 200 (legacy fallback)', async () => {
    session({ role: 'staff', locationId: LOC_A })
    mocks.guestFindUnique.mockResolvedValue({ id: GUEST_ID, locationId: null })
    mocks.orderFindFirst.mockResolvedValue({ id: 'ord-1' })
    const res = await guestGET(idRequest('GET'), { params: Promise.resolve({ id: GUEST_ID }) })
    expect(res.status).toBe(200)
  })

  it('gost žigan na mojo lokacijo → 200 + naročilna povezava NI poizvedana (stolpec short-circuit)', async () => {
    session({ role: 'staff', locationId: LOC_A })
    mocks.guestFindUnique.mockResolvedValue({ id: GUEST_ID, locationId: LOC_A })
    const res = await guestGET(idRequest('GET'), { params: Promise.resolve({ id: GUEST_ID }) })
    expect(res.status).toBe(200)
    expect(mocks.orderFindFirst).not.toHaveBeenCalled()
  })

  it('super-admin → 200 brez naročilne preverbe (globalni pogled)', async () => {
    session({ role: 'admin', locationId: null })
    mocks.guestFindUnique.mockResolvedValue({ id: GUEST_ID, locationId: LOC_B })
    const res = await guestGET(idRequest('GET'), { params: Promise.resolve({ id: GUEST_ID }) })
    expect(res.status).toBe(200)
    expect(mocks.orderFindFirst).not.toHaveBeenCalled()
  })

  it('regular staff z NULL lokacijo → 403 + ZERO db klicev', async () => {
    session({ role: 'staff', locationId: null })
    const res = await guestGET(idRequest('GET'), { params: Promise.resolve({ id: GUEST_ID }) })
    expect(res.status).toBe(403)
    expect(mocks.guestFindUnique).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// D. PUT /api/guests/[id] — HIGH cross-tenant PII update zaprt
// ══════════════════════════════════════════════════════════════════
describe('R87 D: PUT /api/guests/[id] — tenant scope', () => {
  it('tuji gost (žig LOC_B, brez naročilne povezave) → 404 + ZERO update', async () => {
    session({ role: 'staff', locationId: LOC_A })
    mocks.guestFindUnique.mockResolvedValue({ id: GUEST_ID, locationId: LOC_B })
    const res = await guestPUT(idRequest('PUT', '', { firstName: 'Heker' }), { params: Promise.resolve({ id: GUEST_ID }) })
    expect(res.status).toBe(404)
    expect(mocks.guestUpdate).not.toHaveBeenCalled()
  })

  it('gost brez žiga, a z naročilom na mojo lokacijo → 200 update (legacy fallback)', async () => {
    session({ role: 'staff', locationId: LOC_A })
    mocks.guestFindUnique.mockResolvedValue({ id: GUEST_ID, locationId: null })
    mocks.orderFindFirst.mockResolvedValue({ id: 'ord-1' })
    const res = await guestPUT(idRequest('PUT', '', { firstName: 'Marko' }), { params: Promise.resolve({ id: GUEST_ID }) })
    expect(res.status).toBe(200)
    expect(mocks.guestUpdate).toHaveBeenCalled()
  })

  it('lastni gost → 200 + update pripet na { id }', async () => {
    session({ role: 'staff', locationId: LOC_A })
    mocks.guestFindUnique.mockResolvedValue({ id: GUEST_ID, locationId: LOC_A })
    const res = await guestPUT(idRequest('PUT', '', { firstName: 'Marko' }), { params: Promise.resolve({ id: GUEST_ID }) })
    expect(res.status).toBe(200)
    expect(mocks.guestUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: GUEST_ID } }),
    )
  })

  it('regular staff z NULL lokacijo → 403 PRED body parse + ZERO db klicev', async () => {
    session({ role: 'staff', locationId: null })
    const res = await guestPUT(idRequest('PUT', '', { firstName: 'X' }), { params: Promise.resolve({ id: GUEST_ID }) })
    expect(res.status).toBe(403)
    expect(mocks.guestFindUnique).not.toHaveBeenCalled()
    expect(mocks.guestUpdate).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// E. DELETE /api/guests/[id] — HIGH cross-tenant GDPR anonimizacija zaprt
// ══════════════════════════════════════════════════════════════════
describe('R87 E: DELETE /api/guests/[id] — tenant scope', () => {
  it('tuji gost → 404 + ZERO anonimizacijskih zapisov', async () => {
    session({ role: 'admin', locationId: LOC_A })
    mocks.guestFindUnique.mockResolvedValue({
      id: GUEST_ID, locationId: LOC_B, orders: [],
    })
    const res = await guestDELETE(idRequest('DELETE'), { params: Promise.resolve({ id: GUEST_ID }) })
    expect(res.status).toBe(404)
    expect(mocks.guestUpdate).not.toHaveBeenCalled()
  })

  it('lastni gost z naročili → 400 (obstoječa zaščita: anonimiziraj namesto brisanja)', async () => {
    session({ role: 'admin', locationId: LOC_A })
    mocks.guestFindUnique.mockResolvedValue({
      id: GUEST_ID, locationId: LOC_A, orders: [{ id: 'o1' }],
    })
    const res = await guestDELETE(idRequest('DELETE'), { params: Promise.resolve({ id: GUEST_ID }) })
    expect(res.status).toBe(400)
    expect(mocks.guestUpdate).not.toHaveBeenCalled()
  })

  it('lastni gost brez naročil → 200 anonimizacija (obstoječi tok nespremenjen)', async () => {
    session({ role: 'admin', locationId: LOC_A })
    mocks.guestFindUnique.mockResolvedValue({
      id: GUEST_ID, locationId: LOC_A, orders: [],
    })
    const res = await guestDELETE(idRequest('DELETE'), { params: Promise.resolve({ id: GUEST_ID }) })
    expect(res.status).toBe(200)
    expect(mocks.guestUpdate).toHaveBeenCalled()
  })

  it('regular admin-permission staff z NULL lokacijo → 403 + ZERO db klicev', async () => {
    session({ role: 'admin', locationId: null, employeeId: 'emp-perm' })
    // Pozor: 'admin' je PERMISSION — resolver loči po VLOGI; staff vloga z
    // NULL lokacijo je 403 kljub admin permissionu (fail-closed kanon).
    mocks.requireAuth.mockResolvedValue({
      session: { employeeId: 'emp-1', role: 'manager', locationId: null },
      error: null,
    })
    const res = await guestDELETE(idRequest('DELETE'), { params: Promise.resolve({ id: GUEST_ID }) })
    expect(res.status).toBe(403)
    expect(mocks.guestFindUnique).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// F. upsertGuest (public/online-order) — žig + NULL claim
// ══════════════════════════════════════════════════════════════════
describe('R87 F: upsertGuest — Guest.locationId žig', () => {
  function makeTx() {
    return {
      guest: {
        findFirst: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
      },
    }
  }

  it('nov gost → create žige lokacijo naročila', async () => {
    const tx = makeTx()
    tx.guest.findFirst.mockResolvedValue(null)
    await upsertGuest(tx as never, 'Ana Novak', '040123456', 'ana@x.si', 25.5, LOC_A)
    expect(tx.guest.create.mock.calls[0][0].data.locationId).toBe(LOC_A)
  })

  it('obstoječi gost z NULL žigom → update GA POVZAME (claim)', async () => {
    const tx = makeTx()
    tx.guest.findFirst.mockResolvedValue({ id: GUEST_ID, locationId: null })
    await upsertGuest(tx as never, 'Ana Novak', '040123456', 'ana@x.si', 25.5, LOC_A)
    const data = tx.guest.update.mock.calls[0][0].data
    expect(data.locationId).toBe(LOC_A)
  })

  it('obstoječi gost z žigom LOC_B → žig NE prepisan (monotono)', async () => {
    const tx = makeTx()
    tx.guest.findFirst.mockResolvedValue({ id: GUEST_ID, locationId: LOC_B })
    await upsertGuest(tx as never, 'Ana Novak', '040123456', 'ana@x.si', 25.5, LOC_A)
    const data = tx.guest.update.mock.calls[0][0].data
    expect(Object.prototype.hasOwnProperty.call(data, 'locationId')).toBe(false)
  })

  it('brez emaila → NIČ guest zapisov (obstoječe vedenje)', async () => {
    const tx = makeTx()
    await upsertGuest(tx as never, 'Anonimen', '', '', 10, LOC_A)
    expect(tx.guest.findFirst).not.toHaveBeenCalled()
    expect(tx.guest.create).not.toHaveBeenCalled()
  })
})
