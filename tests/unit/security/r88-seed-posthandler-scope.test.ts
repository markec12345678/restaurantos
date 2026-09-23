// ============================================
// R88-3 — SEED + ORDERS POST-HANDLER SCOPE + QR-MENU GENERATOR
// ============================================
// REGRESIJA za zadnji pisni residual resolveDefaultLocationId() (prva aktivna
// lokacija KATEREGA KOLI tenanta = cross-tenant žig):
//   HIGH   POST /api/orders/seed          — prej VEDNO resolveDefaultLocationId():
//           super-admin/seed žig 35–84 demo naročil + per-lokacijskih counterjev
//           na PRVO aktivno lokacijo poljubnega tenanta (Integration model NIMA
//           locationId — globalni findFirst).
//   HIGH   orders/_helpers/post-handler   — globalni fallback za naročilo brez
//           session lokacije IN brez mize (isti cross-tenant žig).
//   NEW    GET /api/locations/[id]/qr-menu — QR generator za /qr-menu?locationId=
//           (R87-3 klient ŽE bere ?locationId iz URL-ja; do R88 noben generator
//           te URL oblike ni producent — samo table QRji /qr/[tableId]).
//
// Vzorec (r86-a/r87): realen tenant-scope resolver (re-export iz auth-middleware
// barrela — NIKOLI mockan), resolveWriteLocationId za pisni žig seeda,
// notInScopeResponse za qr-menu 404. mockResolvedValue (nikoli .Once —
// preživi clearAllMocks), ZERO-write asserti na vsaki zavrnitvi.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  // db
  menuItemFindMany: vi.fn(),
  tableFindMany: vi.fn(),
  tableFindUnique: vi.fn(),
  locationFindFirst: vi.fn(),
  orderFindFirst: vi.fn(),
  orderCreate: vi.fn(),
  counterUpsert: vi.fn(),
  employeeFindUnique: vi.fn(),
  transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
  // counters (per-lokacijsko številčenje ostaja; globalni fallback je odstranjen)
  getNextOrderNumber: vi.fn(),
  // _helpers/stock + stock-deduction
  checkStockAvailability: vi.fn(),
  handleStockDeduction: vi.fn(),
  handlePostCreationEffects: vi.fn(),
  // transakcijski tx (vzorec r86-a)
  txOrderCreate: vi.fn(),
  txTableFindUnique: vi.fn(),
  txTableUpdateMany: vi.fn(),
  // qrcode (URL pin — srce qr-menu generatorja)
  qrToBuffer: vi.fn(),
}))

// Skupni tx objekt — iste funkcije kot db top-level (vzorec r85-final-scope)
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
    table: { findMany: mocks.tableFindMany, findUnique: mocks.tableFindUnique },
    location: { findFirst: mocks.locationFindFirst },
    order: { findFirst: mocks.orderFindFirst, create: mocks.orderCreate },
    counter: { upsert: mocks.counterUpsert },
    employee: { findUnique: mocks.employeeFindUnique },
    // FK scope preverbi v post-handlerju (body jih v teh testih ne pošilja)
    diningOption: { findFirst: vi.fn() },
    revenueCenter: { findFirst: vi.fn() },
    $transaction: mocks.transaction,
  },
  // createAuditLog je TOP-LEVEL export iz '@/lib/db' (ne lastnost db klienta)
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

// R88-3: counters — samo per-lokacijski getNextOrderNumber; resolveDefaultLocationId
// je iz seed/post-handler IZLOČEN (modul sam ostaja za delivery webhookе — niso v scope-u R88-3).
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
  // validateRequest: JSON passthrough (focus R88-3 = lokacijska resolucija, ne Zod)
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
  checkSeedAllowed: vi.fn(() => ({ allowed: true })),
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

// qrcode: URL pin brez realnega bufferja (določena 8-bajtna PNG podpis × format)
vi.mock('qrcode', () => ({
  default: { toBuffer: mocks.qrToBuffer },
}))

import { POST as ordersPOST } from '@/app/api/orders/route'
import { POST as seedPOST } from '@/app/api/orders/seed/route'
import { GET as qrMenuGET } from '@/app/api/locations/[id]/qr-menu/route'

// Utišaj logger
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

const LOC_A = 'loc-tenant-a'
const LOC_B = 'loc-tenant-b'
const LOC_C = 'loc-tenant-c'
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

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

function getRequest(url: string): Request {
  return new Request(url, { method: 'GET' })
}

const ORDER_BODY = {
  type: 'dine-in',
  orderItems: [{ menuItemId: 'mi-1', quantity: 2 }],
}

/** seed POST je statično `Response | undefined` (SeedGuardResult.error? —
 *  obstoječa oblika) — testni helper za narrowing. */
async function runSeed(req: Request): Promise<Response> {
  const res = await seedPOST(req)
  if (!res) throw new Error('POST /api/orders/seed ni vrnil odgovora')
  return res
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.transaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) => fn(tx))
  mocks.menuItemFindMany.mockResolvedValue([{ id: 'mi-1', price: 10, vatRate: 22 }])
  mocks.tableFindMany.mockResolvedValue([]) // seed: brez naključnih miz (čist žig lokacije)
  mocks.tableFindUnique.mockResolvedValue(null)
  mocks.locationFindFirst.mockResolvedValue({ id: LOC_B })
  mocks.orderFindFirst.mockResolvedValue(null)
  mocks.orderCreate.mockResolvedValue({ id: 'seed-order' })
  mocks.counterUpsert.mockResolvedValue({ name: 'orderNumber', value: 1 })
  mocks.employeeFindUnique.mockResolvedValue({ status: 'active' })
  mocks.getNextOrderNumber.mockResolvedValue(7)
  mocks.checkStockAvailability.mockResolvedValue({ warnings: [] })
  mocks.handleStockDeduction.mockResolvedValue({ stockDeducted: false })
  mocks.handlePostCreationEffects.mockResolvedValue(undefined)
  mocks.txOrderCreate.mockResolvedValue({
    id: 'ord-1',
    orderNumber: 7,
    locationId: LOC_A,
    table: null,
    orderItems: [],
  })
  mocks.txTableFindUnique.mockResolvedValue({ id: 't-1' })
  mocks.txTableUpdateMany.mockResolvedValue({ count: 1 })
  mocks.qrToBuffer.mockResolvedValue(PNG_SIG)
})

// ══════════════════════════════════════════════════════════════════
// A. POST /api/orders/seed — IZRECNA lokacija, nikoli globalni fallback
// ══════════════════════════════════════════════════════════════════
describe('R88 A: POST /api/orders/seed — resolveWriteLocationId žig', () => {
  it('super-admin (admin, session.locationId null) BREZ ?locationId → 400 + ZERO pisnih klicev', async () => {
    mockSession({ role: 'admin', locationId: null })
    const res = await runSeed(postRequest('http://localhost:3000/api/orders/seed'))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(String(body.error)).toContain('locationId je obvezen')
    // ZERO pisnih klicev — seed NE ugiba tenantа
    expect(mocks.orderCreate).not.toHaveBeenCalled()
    expect(mocks.counterUpsert).not.toHaveBeenCalled()
    expect(mocks.getNextOrderNumber).not.toHaveBeenCalled()
  })

  it('super-admin z ?locationId=LOC_B → vsa naročila žigana na LOC_B', async () => {
    mockSession({ role: 'admin', locationId: null })
    const res = await runSeed(postRequest(`http://localhost:3000/api/orders/seed?locationId=${LOC_B}`))

    expect(res.status).toBe(200)
    expect(mocks.orderCreate).toHaveBeenCalled()
    for (const call of mocks.orderCreate.mock.calls) {
      expect(call[0].data.locationId).toBe(LOC_B)
    }
    // per-lokacijsko številčenje na IZRECNO lokacijo
    expect(mocks.getNextOrderNumber).toHaveBeenCalledWith(LOC_B)
    expect(mocks.counterUpsert).not.toHaveBeenCalled() // scoped raw-SQL counter, ne globalni upsert
  })

  it('admin-with-location: session lokacija ZMAGA, ?locationId (LOC_B) se IGNORIRA', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await runSeed(postRequest(`http://localhost:3000/api/orders/seed?locationId=${LOC_B}`))

    expect(res.status).toBe(200)
    expect(mocks.orderCreate).toHaveBeenCalled()
    for (const call of mocks.orderCreate.mock.calls) {
      expect(call[0].data.locationId).toBe(LOC_A)
    }
    expect(mocks.getNextOrderNumber).toHaveBeenCalledWith(LOC_A)
  })

  it('regular staff z NULL lokacijo → 403 fail-closed + ZERO pisnih klicev', async () => {
    mockSession({ role: 'staff', locationId: null })
    const res = await runSeed(postRequest('http://localhost:3000/api/orders/seed'))

    expect(res.status).toBe(403)
    expect(String((await res.json()).error)).toContain('nima dodeljene lokacije')
    expect(mocks.orderCreate).not.toHaveBeenCalled()
    expect(mocks.counterUpsert).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// B. POST /api/orders + post-handler — lokacijska resolucija brez globalnega fallbacka
// ══════════════════════════════════════════════════════════════════
describe('R88 B: POST /api/orders — resolveOrderLocationId (scope kanon)', () => {
  it('staff lokacije A + miza lokacije B → 400 mismatch + ZERO create', async () => {
    mockSession({ role: 'staff', locationId: LOC_A })
    mocks.tableFindUnique.mockResolvedValue({ locationId: LOC_B })
    const res = await ordersPOST(postRequest('http://localhost:3000/api/orders', { ...ORDER_BODY, tableId: 't-b' }))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Izbrana miza pripada drugi lokaciji')
    expect(mocks.txOrderCreate).not.toHaveBeenCalled()
    expect(mocks.orderCreate).not.toHaveBeenCalled()
    expect(mocks.getNextOrderNumber).not.toHaveBeenCalled()
  })

  it('staff lokacije A + brez mize → create žige session lokacijo (happy path)', async () => {
    mockSession({ role: 'staff', locationId: LOC_A })
    const res = await ordersPOST(postRequest('http://localhost:3000/api/orders', ORDER_BODY))

    expect(res.status).toBe(201)
    expect(mocks.txOrderCreate.mock.calls[0][0].data.locationId).toBe(LOC_A)
    // R115 (P0 firedAt source-of-truth): Sales "Oddaj naročilo" (POST /api/orders)
    // = trenutek pošiljanja v kuhinjo (kuhinja obveščena ob isti kreaciji —
    // print/WS/push) → firedAt MORA biti nastavljen server-side (DateTime).
    // Prej null → KDS timer "--:--", operational-alerts nevidni.
    expect(mocks.txOrderCreate.mock.calls[0][0].data.firedAt).toBeInstanceOf(Date)
    expect(mocks.getNextOrderNumber).toHaveBeenCalledWith(LOC_A)
    // session-sourced scope: NI lokacijske validacije (ta je za super-admina)
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
  })

  it('super-admin + miza → lokacija = miza (validirana: obstaja + aktivna)', async () => {
    mockSession({ role: 'admin', locationId: null })
    mocks.tableFindUnique.mockResolvedValue({ locationId: LOC_B })
    mocks.locationFindFirst.mockResolvedValue({ id: LOC_B })
    const res = await ordersPOST(postRequest('http://localhost:3000/api/orders', { ...ORDER_BODY, tableId: 't-b' }))

    expect(res.status).toBe(201)
    expect(mocks.txOrderCreate.mock.calls[0][0].data.locationId).toBe(LOC_B)
    expect(mocks.locationFindFirst).toHaveBeenCalledWith({
      where: { id: LOC_B, isActive: true },
      select: { id: true },
    })
  })

  it('super-admin + miza (B) + ?locationId=LOC_C → miza ZMAGA (tableLocationId ?? query)', async () => {
    mockSession({ role: 'admin', locationId: null })
    mocks.tableFindUnique.mockResolvedValue({ locationId: LOC_B })
    mocks.locationFindFirst.mockResolvedValue({ id: LOC_B })
    const res = await ordersPOST(
      postRequest(`http://localhost:3000/api/orders?locationId=${LOC_C}`, { ...ORDER_BODY, tableId: 't-b' }),
    )

    expect(res.status).toBe(201)
    expect(mocks.txOrderCreate.mock.calls[0][0].data.locationId).toBe(LOC_B)
    expect(mocks.locationFindFirst).toHaveBeenCalledTimes(1)
    expect(mocks.locationFindFirst.mock.calls[0][0].where.id).toBe(LOC_B)
  })

  it('super-admin brez mize brez ?locationId → 400 (NI globalnega fallbacka) + ZERO pisanja', async () => {
    mockSession({ role: 'admin', locationId: null })
    const res = await ordersPOST(postRequest('http://localhost:3000/api/orders', ORDER_BODY))

    expect(res.status).toBe(400)
    expect(String((await res.json()).error)).toContain('locationId je obvezen')
    // stara globalna oblika je bila location.findFirst({ where: { isActive: true },
    // orderBy: { createdAt: 'asc' } }) (resolveDefaultLocationId) — NIČ podobnega
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
    expect(mocks.txOrderCreate).not.toHaveBeenCalled()
    expect(mocks.getNextOrderNumber).not.toHaveBeenCalled()
  })

  it('super-admin brez mize + veljaven ?locationId=LOC_B → žig LOC_B', async () => {
    mockSession({ role: 'admin', locationId: null })
    mocks.locationFindFirst.mockResolvedValue({ id: LOC_B })
    const res = await ordersPOST(
      postRequest(`http://localhost:3000/api/orders?locationId=${LOC_B}`, ORDER_BODY),
    )

    expect(res.status).toBe(201)
    expect(mocks.txOrderCreate.mock.calls[0][0].data.locationId).toBe(LOC_B)
    expect(mocks.locationFindFirst).toHaveBeenCalledWith({
      where: { id: LOC_B, isActive: true },
      select: { id: true },
    })
  })

  it('super-admin brez mize + neznan ?locationId → 400 "Lokacija ni najdena" + ZERO create', async () => {
    mockSession({ role: 'admin', locationId: null })
    mocks.locationFindFirst.mockResolvedValue(null)
    const res = await ordersPOST(
      postRequest('http://localhost:3000/api/orders?locationId=loc-neznana', ORDER_BODY),
    )

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Lokacija ni najdena')
    expect(mocks.txOrderCreate).not.toHaveBeenCalled()
    expect(mocks.getNextOrderNumber).not.toHaveBeenCalled()
  })

  it('regular staff z NULL lokacijo → 403 resolverja PRED body parse-om + ZERO db', async () => {
    mockSession({ role: 'staff', locationId: null })
    const res = await ordersPOST(postRequest('http://localhost:3000/api/orders', ORDER_BODY))

    expect(res.status).toBe(403)
    // kanon: resolver takoj po requireAuth → idempotency findFirst (body tok) se ne zgodi
    expect(mocks.orderFindFirst).not.toHaveBeenCalled()
    expect(mocks.txOrderCreate).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// C. GET /api/locations/[id]/qr-menu — QR generator za /qr-menu?locationId=
// ══════════════════════════════════════════════════════════════════
describe('R88 C: GET /api/locations/[id]/qr-menu', () => {
  it('super-admin → 200 PNG + QR enkodira /qr-menu?locationId=<id> (zaprtje zanke R87-3)', async () => {
    mockSession({ role: 'admin', locationId: null })
    mocks.locationFindFirst.mockResolvedValue({ id: LOC_B, name: 'Restavracija B', isActive: true })
    const res = await qrMenuGET(getRequest(`http://localhost:3000/api/locations/${LOC_B}/qr-menu`), {
      params: Promise.resolve({ id: LOC_B }),
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/png')
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=86400')
    expect(res.headers.get('Content-Disposition')).toBe('inline; filename="qr-meni-restavracija-b.png"')
    const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    expect(mocks.qrToBuffer).toHaveBeenCalledWith(
      `${base}/qr-menu?locationId=${LOC_B}`,
      expect.objectContaining({ type: 'png', width: 400, errorCorrectionLevel: 'M' }),
    )
    // mocked PNG podpis teče skozi response nespremenjen
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('regular staff lastna lokacija → 200 PNG', async () => {
    mockSession({ role: 'staff', locationId: LOC_A })
    mocks.locationFindFirst.mockResolvedValue({ id: LOC_A, name: 'Loc A', isActive: true })
    const res = await qrMenuGET(getRequest(`http://localhost:3000/api/locations/${LOC_A}/qr-menu`), {
      params: Promise.resolve({ id: LOC_A }),
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/png')
  })

  it('regular staff tuja lokacija → 404 notInScopeResponse (unificiran 404)', async () => {
    mockSession({ role: 'staff', locationId: LOC_A })
    mocks.locationFindFirst.mockResolvedValue({ id: LOC_B, name: 'Tujka', isActive: true })
    const res = await qrMenuGET(getRequest(`http://localhost:3000/api/locations/${LOC_B}/qr-menu`), {
      params: Promise.resolve({ id: LOC_B }),
    })

    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('Lokacija ni najden')
    expect(mocks.qrToBuffer).not.toHaveBeenCalled()
  })

  it('neznan id → 404 notInScopeResponse', async () => {
    mockSession({ role: 'staff', locationId: LOC_A })
    mocks.locationFindFirst.mockResolvedValue(null)
    const res = await qrMenuGET(getRequest('http://localhost:3000/api/locations/loc-duh/qr-menu'), {
      params: Promise.resolve({ id: 'loc-duh' }),
    })

    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('Lokacija ni najden')
    expect(mocks.qrToBuffer).not.toHaveBeenCalled()
  })

  it('regular staff z NULL lokacijo → 403 + location.findFirst NI klican', async () => {
    mockSession({ role: 'staff', locationId: null })
    const res = await qrMenuGET(getRequest(`http://localhost:3000/api/locations/${LOC_A}/qr-menu`), {
      params: Promise.resolve({ id: LOC_A }),
    })

    expect(res.status).toBe(403)
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
    expect(mocks.qrToBuffer).not.toHaveBeenCalled()
  })
})
