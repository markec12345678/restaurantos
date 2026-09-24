// ============================================
// R116 — POST /api/orders IDEMPOTENCY TENANT BOUNDARY
// ============================================
// REGRESIJA za P0 tenant-boundary luknjo v idempotency fast-pathu:
//   findExistingOrderByIdempotencyKey je bil GLOBALNI lookup
//   ({ idempotencyKey } brez lokacije) in je tekel PRED resolucijo lokacije:
//     FAST-PATH LEAK: uporabnik lokacije B s ključem naročila lokacije A
//       je prejel celoten tuj order (orderNumber/total/PII/table/orderItems).
//     P2002 LEAK: globalni @unique na Order.idempotencyKey → cross-location
//       create dobi P2002 → catch je delal ISTI globalni lookup → tuj order.
//
// Pravilno vedenje (kanon R82-C mobile/order + R83 kiosk — enak vzorec že
// obstaja v javnih endpointih, POST /api/orders je bil edini brez njega):
//   1. lokacija se resolvira PRED fast-pathom (obstoječi R88-3 resolver,
//      read-only) — replay nikoli ne obide tenant/location scope preverjanja;
//   2. replay lookup je scoped: { idempotencyKey, locationId };
//   3. P2002 + scoped miss = ključ tuje lokacije → generičen 409 (NI podatkov).
//   Admin/super_admin: ISTI canonical resolver (miza → scope → izrecni
//   ?locationId) — nikoli globalnega lookup-a samo zato, ker je admin.
//
// Vzorec (r88): realen tenant-scope resolver (NIKOLI mockan), mockan db.
// KLJUČNI TRAP: order.findFirst mock implementira DB semantiko — vrne ORDER_A
// za vsak klic, ki fila po ključu (locationId filter upošteva SAMO če je
// podan). Če handler regresa na globalni lookup, trap vrne ORDER_A in testi
// status/leak assertov PADEJO. mockResolvedValue (nikoli .Once),
// ZERO-write asserti na vsaki zavrnitvi.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Prisma } from '@prisma/client'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  // db
  menuItemFindMany: vi.fn(),
  tableFindUnique: vi.fn(),
  locationFindFirst: vi.fn(),
  orderFindFirst: vi.fn(),
  counterUpsert: vi.fn(),
  employeeFindUnique: vi.fn(),
  transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
  getNextOrderNumber: vi.fn(),
  checkStockAvailability: vi.fn(),
  handleStockDeduction: vi.fn(),
  handlePostCreationEffects: vi.fn(),
  txOrderCreate: vi.fn(),
  txTableFindUnique: vi.fn(),
  txTableUpdateMany: vi.fn(),
}))

// Skupni tx objekt — iste funkcije kot db top-level (vzorec r85/r88)
const tx = {
  order: { create: mocks.txOrderCreate },
  table: { findUnique: mocks.txTableFindUnique, updateMany: mocks.txTableUpdateMany },
}

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

vi.mock('@/lib/db', () => ({
  db: {
    menuItem: { findMany: mocks.menuItemFindMany },
    table: { findUnique: mocks.tableFindUnique },
    location: { findFirst: mocks.locationFindFirst },
    order: { findFirst: mocks.orderFindFirst },
    counter: { upsert: mocks.counterUpsert },
    employee: { findUnique: mocks.employeeFindUnique },
    diningOption: { findFirst: vi.fn() },
    revenueCenter: { findFirst: vi.fn() },
    $transaction: mocks.transaction,
  },
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/counters', () => ({
  getNextOrderNumber: mocks.getNextOrderNumber,
}))

vi.mock('@/lib/stock-deduction', () => ({
  checkStockAvailability: mocks.checkStockAvailability,
}))

vi.mock('@/app/api/orders/_helpers/order-items', () => ({
  buildOrderItemsData: vi.fn((items: { menuItemId: string; quantity: number }[]) => ({
    orderItemsData: items.map((i) => ({
      menuItemId: i.menuItemId,
      quantity: i.quantity,
      price: 10,
      vatRate: 22,
      vatAmount: 2.2,
      notes: '',
      status: 'pending',
    })),
    subtotal: 10,
  })),
  calculateOrderTotals: vi.fn(() => ({ totalTax: 2.2, totalDiscountAmount: 0, total: 12.2 })),
  validateMenuItems: vi.fn(() => null),
  fetchModifierPriceMap: vi.fn(async () => new Map()),
}))

vi.mock('@/app/api/orders/_helpers/stock', () => ({
  handleStockDeduction: mocks.handleStockDeduction,
  handlePostCreationEffects: mocks.handlePostCreationEffects,
}))

vi.mock('@/lib/api-utils', () => ({
  // validateRequest: JSON passthrough (focus R116 = tenant boundary, ne Zod)
  validateRequest: vi.fn(async (req: Request) => {
    try {
      const text = await req.text()
      return { data: text ? JSON.parse(text) : {}, error: null }
    } catch {
      return { data: null, error: new Response(JSON.stringify({ error: 'Bad JSON' }), { status: 400 }) }
    }
  }),
  handleApiError: vi.fn((_e: unknown, _ctx: string, msg: string) =>
    new Response(JSON.stringify({ error: msg }), { status: 500 })),
  parsePaginationParams: vi.fn(() => ({ limit: 50, offset: 0 })),
  BULK_MAX_LIMIT: 500,
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: vi.fn(async () => ({ allowed: true, retryAfterMs: 60000 })),
  checkRateLimit: vi.fn(() => ({ allowed: true, retryAfterMs: 60000 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
  AUTHENTICATED_LIMIT: { maxRequests: 60, windowMs: 60000 },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { POST as ordersPOST } from '@/app/api/orders/route'

vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

const LOC_A = 'loc-r116-a'
const LOC_B = 'loc-r116-b'
const KEY_A = 'key-of-location-a-order'
const FIRED_AT_A = new Date('2026-09-24T10:00:00.000Z')

// Tuj order (lokacija A) — kar NE SME priti odgovoru uporabniku lokacije B
const ORDER_A = {
  id: 'ord-a-leak',
  orderNumber: 101,
  locationId: LOC_A,
  idempotencyKey: KEY_A,
  status: 'pending',
  firedAt: FIRED_AT_A,
  total: '55.50',
  customerName: 'Tujec A',
  customerPhone: '+386 40 999 888',
  table: { id: 't-a', number: 7, locationId: LOC_A },
  orderItems: [{ id: 'oi-1', menuItemId: 'mi-a', name: 'Tuj artikel' }],
}

// "DB" stanje: ključi, ki obstajajo (simulacija globalnega @unique +
// lokacijskega fila). TRAP: locationId filter upošteva SAMO, če ga handler
// sploh pošlje — globalni lookup (brez locationId) BI našel ORDER_A.
let dbKeys: Map<string, string> // idempotencyKey → locationId

function installDbLikeFindFirst() {
  mocks.orderFindFirst.mockImplementation(async (args: {
    where: { idempotencyKey: string; locationId?: string }
  }) => {
    const { idempotencyKey, locationId } = args.where
    const owner = dbKeys.get(idempotencyKey)
    if (!owner) return null
    // Handler je poslal scoped where → upoštevaj lokacijo.
    // Globalni lookup (locationId undefined) → Vrne tuj order (trap!).
    if (locationId !== undefined && locationId !== owner) return null
    return { ...ORDER_A, idempotencyKey, locationId: owner }
  })
}

type SessionOverride = { role?: string; locationId?: string | null }

function mockSession(overrides: SessionOverride = {}) {
  const { role = 'staff', locationId = LOC_A } = overrides
  mocks.requireAuth.mockResolvedValue({
    session: { employeeId: 'emp-1', role, locationId },
    error: null,
  })
}

function postRequest(url: string, body?: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const ORDER_BODY = (key?: string) => ({
  type: 'dine-in',
  orderItems: [{ menuItemId: 'mi-1', quantity: 2 }],
  ...(key ? { idempotencyKey: key } : {}),
})

beforeEach(() => {
  vi.clearAllMocks()
  dbKeys = new Map()
  installDbLikeFindFirst()
  mocks.transaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) => fn(tx))
  mocks.menuItemFindMany.mockResolvedValue([{ id: 'mi-1', price: 10, vatRate: 22 }])
  mocks.tableFindUnique.mockResolvedValue(null)
  mocks.locationFindFirst.mockImplementation(async ({ where }: { where: { id: string } }) =>
    ({ id: where.id }))
  mocks.employeeFindUnique.mockResolvedValue({ status: 'active' })
  mocks.getNextOrderNumber.mockResolvedValue(7)
  mocks.checkStockAvailability.mockResolvedValue({ warnings: [] })
  mocks.handleStockDeduction.mockResolvedValue({ stockDeducted: false })
  mocks.handlePostCreationEffects.mockResolvedValue(undefined)
  mocks.txOrderCreate.mockResolvedValue({
    id: 'ord-new',
    orderNumber: 7,
    locationId: LOC_A,
    table: null,
    orderItems: [],
  })
  mocks.txTableFindUnique.mockResolvedValue({ id: 't-1' })
  mocks.txTableUpdateMany.mockResolvedValue({ count: 1 })
})

// ══════════════════════════════════════════════════════════════════
// A. FAST-PATH — replay je vezan na lokacijo
// ══════════════════════════════════════════════════════════════════
describe('R116 A: fast-path replay tenant scope', () => {
  it('REQUIRED TEST: order lokacije A → isti idempotencyKey → POST uporabnika lokacije B → A order se NIKOLI ne vrne (201 na B)', async () => {
    dbKeys.set(KEY_A, LOC_A) // order A obstaja
    mockSession({ role: 'staff', locationId: LOC_B })

    const res = await ordersPOST(postRequest('http://localhost:3000/api/orders', ORDER_BODY(KEY_A)))

    // Prej: 200 + CELOTEN tuj order (leak). Zdaj: B dobi svoje novo naročilo.
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe('ord-new')
    // Tuj order NIKOLI v odgovoru — nobeno polje iz ORDER_A ne sme priti ven
    expect(body.orderNumber).not.toBe(ORDER_A.orderNumber)
    expect(body.customerName).toBeUndefined()
    expect(body.customerPhone).toBeUndefined()

    // Lookup je bil SCOPED na lokacijo B (ne globalni)
    expect(mocks.orderFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { idempotencyKey: KEY_A, locationId: LOC_B } }),
    )
    // B kreira svoje naročilo na svoji lokaciji
    expect(mocks.txOrderCreate).toHaveBeenCalledTimes(1)
    expect(mocks.txOrderCreate.mock.calls[0][0].data.locationId).toBe(LOC_B)
    expect(mocks.txOrderCreate.mock.calls[0][0].data.idempotencyKey).toBe(KEY_A)
  })

  it('isti ključ + ista lokacija → 200 replay istega orderja, ZERO pisnih klicev, firedAt nespremenjen', async () => {
    dbKeys.set(KEY_A, LOC_A)
    mockSession({ role: 'staff', locationId: LOC_A })

    const res = await ordersPOST(postRequest('http://localhost:3000/api/orders', ORDER_BODY(KEY_A)))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(ORDER_A.id)
    expect(body.locationId).toBe(LOC_A)
    // Idempotency replay NE sme sprementiti firedAt (izvorna vrstica gre ven)
    expect(body.firedAt).toBe(FIRED_AT_A.toISOString())
    // ZERO pisnih klicev — replay ni kreacija
    expect(mocks.txOrderCreate).not.toHaveBeenCalled()
    expect(mocks.getNextOrderNumber).not.toHaveBeenCalled()
    expect(mocks.handlePostCreationEffects).not.toHaveBeenCalled()
    expect(mocks.handleStockDeduction).not.toHaveBeenCalled()
  })

  it('replay lookup je scoped TUDI za regular userja brez mize (session lokacija)', async () => {
    dbKeys.set(KEY_A, LOC_A)
    mockSession({ role: 'staff', locationId: LOC_A })
    dbKeys.set('key-x', LOC_B)
    // uporabnik A pošlje ključ, ki obstaja na B — scoped lookup ne najde nič
    const res = await ordersPOST(postRequest('http://localhost:3000/api/orders', ORDER_BODY('key-x')))
    expect(res.status).toBe(201)
    expect(mocks.orderFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { idempotencyKey: 'key-x', locationId: LOC_A } }),
    )
  })
})

// ══════════════════════════════════════════════════════════════════
// B. VRSTNI RED — lokacija PRED replay-om (scope check nikoli obiti)
// ══════════════════════════════════════════════════════════════════
describe('R116 B: lokacijska resolucija PRED idempotency lookupom', () => {
  it('staff A + miza lokacije B + ključ obstoječega orderja → 400 IDOR mismatch, lookup se NE zgodi', async () => {
    dbKeys.set(KEY_A, LOC_A)
    mockSession({ role: 'staff', locationId: LOC_A })
    mocks.tableFindUnique.mockResolvedValue({ locationId: LOC_B })

    const res = await ordersPOST(
      postRequest('http://localhost:3000/api/orders', { ...ORDER_BODY(KEY_A), tableId: 't-b' }),
    )

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Izbrana miza pripada drugi lokaciji')
    // R116 kanon: replay NIKOLI pred tenant/location scope preverjanjem
    expect(mocks.orderFindFirst).not.toHaveBeenCalled()
    expect(mocks.txOrderCreate).not.toHaveBeenCalled()
  })

  it('super-admin ključ-only (brez mize brez ?locationId) → 400 fail-closed, NI globalnega lookup-a', async () => {
    dbKeys.set(KEY_A, LOC_A)
    mockSession({ role: 'admin', locationId: null })

    const res = await ordersPOST(postRequest('http://localhost:3000/api/orders', ORDER_BODY(KEY_A)))

    // Prej: globalni lookup bi vrgel ORDER_A tudi super-adminu brez scope-a.
    // Zdaj: canonical resolver fail-closed (isti kontrakt kot kreacija, R88-3).
    expect(res.status).toBe(400)
    expect(String((await res.json()).error)).toContain('locationId je obvezen')
    expect(mocks.orderFindFirst).not.toHaveBeenCalled()
    expect(mocks.txOrderCreate).not.toHaveBeenCalled()
  })

  it('super-admin + miza (lokacija B) + ključ orderja lokacije B → 200 replay prek razrešene lokacije', async () => {
    dbKeys.set('key-b', LOC_B)
    mockSession({ role: 'admin', locationId: null })
    mocks.tableFindUnique.mockResolvedValue({ locationId: LOC_B })

    const res = await ordersPOST(
      postRequest('http://localhost:3000/api/orders', { ...ORDER_BODY('key-b'), tableId: 't-b' }),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.locationId).toBe(LOC_B)
    expect(body.id).toBe(ORDER_A.id)
    expect(mocks.txOrderCreate).not.toHaveBeenCalled()
    // lookup scoped na mizino lokacijo (canonical resolver), ne globalni
    expect(mocks.orderFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { idempotencyKey: 'key-b', locationId: LOC_B } }),
    )
  })
})

// ══════════════════════════════════════════════════════════════════
// C. P2002 RACE PATH — scoped replay + generičen 409 za tuj ključ
// ══════════════════════════════════════════════════════════════════
describe('R116 C: P2002 race path tenant boundary', () => {
  const P2002 = () =>
    new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
    })

  it('isti ključ + ista lokacija, vzporedna dirka → P2002 → scoped replay 200 (idempotent replay response)', async () => {
    dbKeys.set(KEY_A, LOC_A)
    mockSession({ role: 'staff', locationId: LOC_A })
    // Sočasna dirka: oba requesta z istim NOVIM ključem sta mimo fast-patha
    // (ključ še ne obstaja); "sočasni zmagovalec" ga vpiše med fast-pathom
    // in create → P2002 na drugem → catch scoped lookup najde zmagovalca.
    mocks.txOrderCreate.mockImplementation(async () => {
      dbKeys.set('key-race', LOC_A) // zmagovalec je ravnokar commitnil
      throw P2002()
    })

    const res = await ordersPOST(
      postRequest('http://localhost:3000/api/orders', ORDER_BODY('key-race')),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(ORDER_A.id)
    expect(body.locationId).toBe(LOC_A)
    // replay vrača izvorno vrstico — firedAt NE nastane drugič
    expect(body.firedAt).toBe(FIRED_AT_A.toISOString())
    // catch lookup je bil scoped
    expect(mocks.orderFindFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { idempotencyKey: 'key-race', locationId: LOC_A } }),
    )
  })

  it('isti ključ + DRUGA lokacija, P2002 (globalni @unique) → 409 generičen, brez podatkov tujega orderja', async () => {
    dbKeys.set(KEY_A, LOC_A)
    mockSession({ role: 'staff', locationId: LOC_B })
    mocks.txOrderCreate.mockImplementation(async () => {
      throw P2002()
    })

    const res = await ordersPOST(postRequest('http://localhost:3000/api/orders', ORDER_BODY(KEY_A)))

    // Prej: P2002 → globalni lookup → tuj order (leak). Zdaj: 409 brez podatkov.
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe('Naročilo s tem ključem že obstaja')
    // NIKOLI nobenega polja tujega orderja
    expect(body.id).toBeUndefined()
    expect(body.orderNumber).toBeUndefined()
    expect(body.total).toBeUndefined()
    expect(body.locationId).toBeUndefined()
    expect(body.customerName).toBeUndefined()
    expect(body.orderItems).toBeUndefined()
    expect(JSON.stringify(body)).not.toContain(ORDER_A.id)
    expect(JSON.stringify(body)).not.toContain(String(ORDER_A.orderNumber))
    // catch lookup je bil scoped na lokacijo B
    expect(mocks.orderFindFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { idempotencyKey: KEY_A, locationId: LOC_B } }),
    )
  })

  it('P2002 brez scoped replay možnosti (ključ ne obstaja nikjer — teoretični drugi constraint) → 409 generičen', async () => {
    dbKeys.clear()
    mockSession({ role: 'staff', locationId: LOC_A })
    mocks.txOrderCreate.mockImplementation(async () => {
      throw P2002()
    })

    const res = await ordersPOST(
      postRequest('http://localhost:3000/api/orders', ORDER_BODY('key-never-seen')),
    )

    // Ni replay-a → determinističen 409 (nikoli 500 + stack navzven)
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('Naročilo s tem ključem že obstaja')
  })
})

// ══════════════════════════════════════════════════════════════════
// D. TRANSACTION FAILURE — napol zapisan workflow ne more uiti
// ══════════════════════════════════════════════════════════════════
describe('R116 D: transaction failure', () => {
  it('spodletela tx (ne-P2002) → 500, ZERO stranskih učinkov (stock/effects se ne pokličejo)', async () => {
    mockSession({ role: 'staff', locationId: LOC_A })
    mocks.txOrderCreate.mockImplementation(async () => {
      throw new Error('db connection lost')
    })

    const res = await ordersPOST(postRequest('http://localhost:3000/api/orders', ORDER_BODY('key-ok')))

    expect(res.status).toBe(500)
    // Stranski učinki ŠELE po uspešni transakciji
    expect(mocks.handleStockDeduction).not.toHaveBeenCalled()
    expect(mocks.handlePostCreationEffects).not.toHaveBeenCalled()
  })
})
