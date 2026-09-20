// ============================================
// R86-3 — PUBLIC ENDPOINT tenant-binding (M4 + M5)
// ============================================
// REGRESIJA za 2 MEDIUM iz R85-FINAL-2 (public, brez session rute):
//   M4 public/kiosk POST  — prej VEDNO resolveDefaultLocationId() (prva
//                           aktivna lokacija KATEREGA KOLI tenanta) =
//                           cross-tenant žig naročila, tuj per-lokacijski
//                           order counter, tuj KDS; GET je sprejel
//                           ?locationId, POST ga je ignoriral.
//   M5 public/promo-check — neavtenticen ?locationId → cross-tenant promo
//                           oracle (ime/znesek popusta tujega tenanta) +
//                           globalni prva-lokacija fallback.
//
// NOVO vedenje (fail-closed, R86-3):
//   kiosk POST: ekspliciten kontekst OBVEZEN (?locationId ali body.locationId)
//               → validiran (obstaja + aktiven) → 400 brez konteksta,
//               404 'Lokacija ni najden' za neznano/tujo/neaktivno (unificiran
//               — ni obstoja-oraklja); NIČ pisnih operacij brez žiga.
//   kiosk GET:  izrecen ?locationId zdaj POLNO validiran (prej samo regex);
//               brez parametra single-tenant READ fallback ohranjen
//               (P0-C3B kanon, kot public/menu) — samo prikaz menija.
//   promo-check: ?locationId obvezen + validiran; rate limiting nespremenjen.
//
// Vzorec: vi.hoisted mocki (kot r85-final-scope), REALEN notInScopeResponse
// iz '@/lib/tenant-scope' (404 'X ni najden').
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  parseJsonBody: vi.fn(),
  locationFindFirst: vi.fn(),
  menuFindMany: vi.fn(),
  menuItemFindMany: vi.fn(),
  orderFindFirst: vi.fn(),
  orderCreate: vi.fn(),
  discountFindFirst: vi.fn(),
  getNextOrderNumber: vi.fn(),
  resolveDefaultLocationId: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    location: { findFirst: mocks.locationFindFirst },
    menu: { findMany: mocks.menuFindMany },
    menuItem: { findMany: mocks.menuItemFindMany },
    order: { findFirst: mocks.orderFindFirst, create: mocks.orderCreate },
    discount: { findFirst: mocks.discountFindFirst },
  },
  createAuditLog: vi.fn(async () => ({})),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.checkRateLimit,
  getClientIp: vi.fn(() => '1.2.3.4'),
  PUBLIC_MENU_LIMIT: { maxRequests: 30, windowMs: 60000 },
  KIOSK_LIMIT: { maxRequests: 10, windowMs: 60000 },
  PROMO_CHECK_LIMIT: { maxRequests: 10, windowMs: 60000 },
  PUBLIC_ORDER_LIMIT: { maxRequests: 5, windowMs: 60000 },
}))

vi.mock('@/lib/counters', () => ({
  getNextOrderNumber: mocks.getNextOrderNumber,
  resolveDefaultLocationId: mocks.resolveDefaultLocationId,
}))

vi.mock('@/lib/api-utils', () => ({
  parseJsonBody: mocks.parseJsonBody,
  handleApiError: vi.fn(() => new Response(JSON.stringify({ error: 'Napaka' }), { status: 500, headers: { 'content-type': 'application/json' } })),
  validateRequest: vi.fn(),
}))

vi.mock('@/lib/decimal', () => ({
  toNum: vi.fn((v: unknown) => (typeof v === 'object' && v !== null && 'toNumber' in (v as object) ? (v as { toNumber: () => number }).toNumber() : Number(v ?? 0))),
  calcDiscount: vi.fn((subtotal: number, amount: number, type: string) => (type === 'percentage' ? (subtotal * amount) / 100 : amount)),
}))

vi.mock('@/lib/safe-format', () => ({
  formatEUR: vi.fn((v: string) => `${v} €`),
}))

vi.mock('@/app/api/orders/_helpers/order-items', () => ({
  buildOrderItemsData: vi.fn(() => ({
    orderItemsData: [{ menuItemId: 'mi-1', quantity: 1, unitPrice: 2, totalPrice: 2, vatRate: 22, modifiers: '[]', menuItemName: 'Kava' }],
    subtotal: 2,
  })),
  calculateOrderTotals: vi.fn(() => ({ totalTax: 0.44, total: 2.44 })),
  fetchModifierPriceMap: vi.fn(async () => new Map()),
}))

vi.mock('@/lib/prisma-column-fallback', () => ({
  withLocationColumnFallback: vi.fn(async (_key: string, fn: (withLoc: boolean) => unknown) => fn(true)),
}))

// Route imports (PO mockih)
import { GET as kioskGET, POST as kioskPOST } from '@/app/api/public/kiosk/route'
import { GET as promoCheckGET } from '@/app/api/public/promo-check/route'

// Lokacijski id-ji MORAJO ustrezati regex obliki /^[a-z0-9]{5,50}$/i (brez
// vezajev) — kiosk validira obliko PREJ kot DB poizvedbo.
const LOC_A = 'locTenantA'
const LOC_B = 'locTenantB'
const LOC_GHOST = 'locghost99'
const LOC_DEFAULT = 'locDefault'

function makeKioskBody(over: Record<string, unknown> = {}) {
  return {
    orderItems: [{ menuItemId: 'mi-1', quantity: 1, notes: '' }],
    ...over,
  }
}

function makeKioskReq(url: string, body: Record<string, unknown>) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.checkRateLimit.mockResolvedValue({ allowed: true, retryAfterMs: 60000 })
  mocks.parseJsonBody.mockImplementation(async (req: Request) => ({ data: await req.json(), error: null }))
  mocks.locationFindFirst.mockResolvedValue({ id: LOC_A })
  mocks.menuFindMany.mockResolvedValue([])
  mocks.menuItemFindMany.mockResolvedValue([{ id: 'mi-1', name: 'Kava', price: 2, vatRate: 22 }])
  mocks.orderFindFirst.mockResolvedValue(null)
  mocks.orderCreate.mockResolvedValue({ id: 'ord-1', orderNumber: 7, total: 2.44, locationId: LOC_A, orderItems: [{ id: 'oi-1' }] })
  mocks.discountFindFirst.mockResolvedValue(null)
  mocks.getNextOrderNumber.mockResolvedValue(7)
  mocks.resolveDefaultLocationId.mockResolvedValue(LOC_DEFAULT)
})

// ══════════════════════════════════════════════════════════════════
// A. KIOSK POST (M4) — fail-closed, brez globalnega fallbacka
// ══════════════════════════════════════════════════════════════════
describe('R86-3 A: POST /api/public/kiosk — fail-closed lokacijski kontekst', () => {
  it('brez konteksta (?locationId in body.locationId) → 400 + ZERO pisnih klicev + fallback NIKOLI konsultiran', async () => {
    const res = await kioskPOST(makeKioskReq('http://x/api/public/kiosk', makeKioskBody()))
    expect(res.status).toBe(400)
    // NIKOLI globalna prva-aktivna-lokacija fallback (prej: cross-tenant žig)
    expect(mocks.resolveDefaultLocationId).not.toHaveBeenCalled()
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
    expect(mocks.menuItemFindMany).not.toHaveBeenCalled()
    expect(mocks.orderFindFirst).not.toHaveBeenCalled()
    expect(mocks.orderCreate).not.toHaveBeenCalled()
    expect(mocks.getNextOrderNumber).not.toHaveBeenCalled()
  })

  it('neznana lokacija → 404 "Lokacija ni najden" + ZERO create', async () => {
    mocks.locationFindFirst.mockResolvedValue(null)
    const res = await kioskPOST(makeKioskReq(`http://x/api/public/kiosk?locationId=${LOC_GHOST}`, makeKioskBody()))
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Lokacija ni najden')
    expect(mocks.orderCreate).not.toHaveBeenCalled()
    expect(mocks.menuItemFindMany).not.toHaveBeenCalled()
  })

  it('tuja/neaktivna lokacija → ISTI unificiran 404 (ni oraklja) + where pin { id, isActive: true } + ZERO create', async () => {
    // location.findFirst vrne null za TUJO lokacijo (isActive filter jo izloči)
    mocks.locationFindFirst.mockResolvedValue(null)
    const res = await kioskPOST(makeKioskReq(`http://x/api/public/kiosk?locationId=${LOC_B}`, makeKioskBody()))
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    // ISTI odgovor kot neznana lokacija — ni razlike "ne obstaja" vs "tuja"
    expect(body.error).toBe('Lokacija ni najden')
    const where = mocks.locationFindFirst.mock.calls[0][0].where
    expect(where.id).toBe(LOC_B)
    expect(where.isActive).toBe(true)
    expect(mocks.orderCreate).not.toHaveBeenCalled()
  })

  it('neveljavna oblika locationId → 404 brez DB poizvedbe', async () => {
    const res = await kioskPOST(makeKioskReq('http://x/api/public/kiosk?locationId=ab', makeKioskBody()))
    expect(res.status).toBe(404)
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
    expect(mocks.orderCreate).not.toHaveBeenCalled()
  })

  it('veljaven ?locationId → 201 + create žig = ta lokacija (stamp pinned: items, counter, replay)', async () => {
    const res = await kioskPOST(makeKioskReq(`http://x/api/public/kiosk?locationId=${LOC_A}`, makeKioskBody()))
    expect(res.status).toBe(201)
    const body = await res.json() as { orderId: string; success: boolean }
    expect(body.success).toBe(true)
    // žig naročila pinned na eksplicitno lokacijo
    expect(mocks.orderCreate.mock.calls[0][0].data.locationId).toBe(LOC_A)
    // artikli scoped na menu te lokacije
    expect(mocks.menuItemFindMany.mock.calls[0][0].where.category).toEqual({ menu: { locationId: LOC_A } })
    // per-lokacijski counter TOČNO TE lokacije
    expect(mocks.getNextOrderNumber.mock.calls[0][0]).toBe(LOC_A)
    // idempotency replay lookup scoped
    expect(mocks.orderFindFirst.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('veljaven body.locationId (brez query) → 201 + žig', async () => {
    const res = await kioskPOST(makeKioskReq('http://x/api/public/kiosk', makeKioskBody({ locationId: LOC_A })))
    expect(res.status).toBe(201)
    expect(mocks.orderCreate.mock.calls[0][0].data.locationId).toBe(LOC_A)
  })

  it('query ?locationId ima prednost pred body.locationId', async () => {
    const res = await kioskPOST(makeKioskReq(`http://x/api/public/kiosk?locationId=${LOC_A}`, makeKioskBody({ locationId: LOC_B })))
    expect(res.status).toBe(201)
    expect(mocks.locationFindFirst.mock.calls[0][0].where.id).toBe(LOC_A)
    expect(mocks.orderCreate.mock.calls[0][0].data.locationId).toBe(LOC_A)
  })
})

// ══════════════════════════════════════════════════════════════════
// B. KIOSK GET (M4 sibling) — izrecen ?locationId zdaj validiran;
//    single-tenant READ fallback ohranjen (P0-C3B kanon)
// ══════════════════════════════════════════════════════════════════
describe('R86-3 B: GET /api/public/kiosk — validacija izrecnega ?locationId', () => {
  it('veljaven ?locationId → 200 + meni scoped + lokacija validirana (obstaja + aktiven)', async () => {
    const res = await kioskGET(new Request(`http://x/api/public/kiosk?locationId=${LOC_A}`))
    expect(res.status).toBe(200)
    expect(mocks.locationFindFirst.mock.calls[0][0].where).toEqual({ id: LOC_A, isActive: true })
    expect(mocks.menuFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
    expect(mocks.menuFindMany.mock.calls[0][0].where.isActive).toBe(true)
  })

  it('neznan ?locationId → 404 + meni NI poizveden', async () => {
    mocks.locationFindFirst.mockResolvedValue(null)
    const res = await kioskGET(new Request(`http://x/api/public/kiosk?locationId=${LOC_GHOST}`))
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Lokacija ni najden')
    expect(mocks.menuFindMany).not.toHaveBeenCalled()
  })

  it('brez ?locationId → single-tenant READ fallback OHRANJEN (samo prikaz menija)', async () => {
    const res = await kioskGET(new Request('http://x/api/public/kiosk'))
    expect(res.status).toBe(200)
    expect(mocks.resolveDefaultLocationId).toHaveBeenCalledTimes(1)
    expect(mocks.menuFindMany.mock.calls[0][0].where.locationId).toBe(LOC_DEFAULT)
  })
})

// ══════════════════════════════════════════════════════════════════
// C. PROMO-CHECK (M5) — obvezen + validiran locationId, brez
//    cross-tenant oraklja; rate limiting nespremenjen
// ══════════════════════════════════════════════════════════════════
describe('R86-3 C: GET /api/public/promo-check — obvezen validiran locationId', () => {
  it('brez locationId → 400 + ZERO poizvedb (ni globalnega fallbacka)', async () => {
    const res = await promoCheckGET(new Request('http://x/api/public/promo-check?code=WELCOME10&subtotal=25'))
    expect(res.status).toBe(400)
    expect(mocks.resolveDefaultLocationId).not.toHaveBeenCalled()
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
    expect(mocks.discountFindFirst).not.toHaveBeenCalled()
  })

  it('neznana/tuja lokacija → unificiran 404, BREZ promo podatkov + ZERO discount poizvedb', async () => {
    mocks.locationFindFirst.mockResolvedValue(null)
    const res = await promoCheckGET(new Request(`http://x/api/public/promo-check?code=WELCOME10&subtotal=25&locationId=${LOC_B}`))
    expect(res.status).toBe(404)
    const body = await res.json() as Record<string, unknown>
    expect(body.error).toBe('Lokacija ni najden')
    // NIKOLI promo podatkov (ime/znesek tujega tenanta)
    expect(body.valid).toBeUndefined()
    expect(body.discount).toBeUndefined()
    expect(mocks.discountFindFirst).not.toHaveBeenCalled()
  })

  it('veljavna lokacija + znana koda → 200 valid + where pin (promoCode, isActive, triggerType, locationId)', async () => {
    mocks.discountFindFirst.mockResolvedValue({
      id: 'disc12345678', name: 'WELCOME10', type: 'percentage', amount: 10,
      validFrom: null, validTo: null, maxUses: null, currentUses: 0,
    })
    const res = await promoCheckGET(new Request(`http://x/api/public/promo-check?code=welcome10&subtotal=25&locationId=${LOC_A}`))
    expect(res.status).toBe(200)
    const body = await res.json() as { valid: boolean; discount?: { name: string; discountAmount: number } }
    expect(body.valid).toBe(true)
    expect(body.discount?.name).toBe('WELCOME10')
    expect(body.discount?.discountAmount).toBe(2.5)
    const where = mocks.discountFindFirst.mock.calls[0][0].where
    expect(where.promoCode).toBe('WELCOME10') // normaliziran (toUpperCase)
    expect(where.isActive).toBe(true)
    expect(where.triggerType).toBe('promo_code')
    expect(where.locationId).toBe(LOC_A)
  })

  it('veljavna lokacija + neznana koda → { valid: false } brez promo podatkov', async () => {
    const res = await promoCheckGET(new Request(`http://x/api/public/promo-check?code=NOPE&subtotal=25&locationId=${LOC_A}`))
    expect(res.status).toBe(200)
    const body = await res.json() as { valid: boolean; message: string; discount?: unknown }
    expect(body.valid).toBe(false)
    expect(body.message).toBe('Neveljavna koda')
    expect(body.discount).toBeUndefined()
  })

  it('rate limiting nespremenjen: 429 pred vsemi poizvedbami', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 30000 })
    const res = await promoCheckGET(new Request(`http://x/api/public/promo-check?code=X&subtotal=25&locationId=${LOC_A}`))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeTruthy()
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
    expect(mocks.discountFindFirst).not.toHaveBeenCalled()
  })
})
