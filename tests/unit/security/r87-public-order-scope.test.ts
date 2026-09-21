// ============================================
// R87-3 — PUBLIC ORDER endpoints fail-closed (R86-3 residual)
// ============================================
// Zapira R86-3 residual: BY-DESIGN `resolveDefaultLocationId()` WRITE fallback
// v dveh javnih (brez session) rutah:
//
//   public/order  POST — prej: naročilo BREZ tabele in brez lokacije (ali z
//                       IGNORIRANIM body.locationId) padlo na GLOBALNO prvo
//                       aktivno lokacijo KATEREGA KOLI tenanta (counters.ts
//                       resolveDefaultLocationId) = cross-tenant žig naročila,
//                       tuj per-lokacijski order counter (getNextOrderNumber),
//                       tuj KDS broadcast, odbitek tuje zaloge.
//   public/online-order POST — prej: manjkajoč body.locationId → ISTI globalni
//                       fallback; unknown/inactive → 400 'Izbrana lokacija ni
//                       na voljo' (obstoja-orakelj prek findUnique).
//
// NOVO vedenje (fail-closed, R87-3 — zrcali kiosk fix R86-3):
//   order POST:  izrecen kontekst (?locationId query ali body.locationId)
//                VALIDIRAN (obstaja + aktiven); tableId QR pot → lokacija iz DB
//                vrstice mize (server-authoritative, Table.locationId NOT NULL
//                MODEL A) — prav tako VEDNO validirana; neujemana lokacija
//                mize in izrecnega konteksta → 404; brez obeh → 400 + ZERO
//                pisnih klicev. Globalni fallback IZpisane poti ODSTRANJEN.
//   online-order POST: locationId OBVEZEN (400 brez pisnih klicev);
//                unknown/inactive/malformed → unificiran 404 'Lokacija ni
//                najden' (findFirst({ id, isActive: true }) — ni oraklja).
//   klijenti:    online-order klijent že pošilja selectedLocation (R86-3 val);
//                qr-menu klijent ZDAJ pošilja locationId (settings.id iz
//                /api/public/menu). qr/[tableId] klijent pošilja tableId —
//                lokacija se izpelje strežniško iz mize.
//   P0-C3B:      single-tenant GET READ fallback (public/menu brez ?locationId)
//                OHRANJEN — regresijski pin spodaj; obe ruta sta WRITE-only
//                (noben GET handler → ni read fallbacka za regresijo).
//
// Vzorec: vi.hoisted mocki (kot r86-public-scope), REALEN notInScopeResponse
// iz '@/lib/tenant-scope' (404 'X ni najden'), REALNA resolveTable + Zod sheme.
// ============================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
// R88: realen ordering-token lib (dev/test fallback skrivnost) — kovanje tokenov
// za online-order zahtevke (ruta preverja z ISTIM virom).
import { orderingTokenFor } from '@/lib/ordering-token'

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  locationFindFirst: vi.fn(),
  tableFindUnique: vi.fn(),
  tableFindFirst: vi.fn(),
  tableFindMany: vi.fn(),
  tableUpdate: vi.fn(),
  menuFindMany: vi.fn(),
  diningOptionFindFirst: vi.fn(),
  diningOptionCreate: vi.fn(),
  menuItemFindMany: vi.fn(),
  counterUpsert: vi.fn(),
  orderCreate: vi.fn(),
  txOrderUpdate: vi.fn(),
  getNextOrderNumber: vi.fn(),
  resolveDefaultLocationId: vi.fn(),
  broadcastNewOrder: vi.fn(),
  createOnlineOrder: vi.fn(),
  triggerWebhookAsync: vi.fn(),
  fetchMock: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    location: { findFirst: mocks.locationFindFirst },
    table: {
      findUnique: mocks.tableFindUnique,
      findFirst: mocks.tableFindFirst,
      findMany: mocks.tableFindMany,
      update: mocks.tableUpdate,
    },
    menu: { findMany: mocks.menuFindMany },
    diningOption: { findFirst: mocks.diningOptionFindFirst, create: mocks.diningOptionCreate },
    menuItem: { findMany: mocks.menuItemFindMany },
    counter: { upsert: mocks.counterUpsert },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({
      order: { create: mocks.orderCreate, update: mocks.txOrderUpdate },
      table: { update: mocks.tableUpdate },
    })),
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.checkRateLimit,
  getClientIp: vi.fn(() => '1.2.3.4'),
  PUBLIC_ORDER_LIMIT: { maxRequests: 5, windowMs: 60000 },
  ONLINE_ORDER_LIMIT: { maxRequests: 5, windowMs: 120000 },
  PUBLIC_MENU_LIMIT: { maxRequests: 30, windowMs: 60000 },
}))

vi.mock('@/lib/counters', () => ({
  getNextOrderNumber: mocks.getNextOrderNumber,
  resolveDefaultLocationId: mocks.resolveDefaultLocationId,
}))

// validateRequest: REALNA Zod shema (prejme jo route), realen parse — tako so
// body.locationId / tableNumber / items preverjeni z istimi pravili kot v produkciji.
vi.mock('@/lib/api-utils', () => ({
  validateRequest: vi.fn(async (req: Request, schema: { safeParse: (d: unknown) => { success: boolean; data?: unknown } }) => {
    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      const { NextResponse } = await import('next/server')
      return { data: null, error: NextResponse.json({ error: 'Neveljavni podatki' }, { status: 400 }) }
    }
    return { data: parsed.data, error: null }
  }),
  handleRouteError: vi.fn(() => new Response(JSON.stringify({ error: 'Napaka pri oddaji naročila' }), { status: 500, headers: { 'content-type': 'application/json' } })),
  handleApiError: vi.fn(() => new Response(JSON.stringify({ error: 'Napaka' }), { status: 500, headers: { 'content-type': 'application/json' } })),
  parseJsonBody: vi.fn(),
}))

vi.mock('@/lib/safe-format', () => ({
  formatEUR: vi.fn((v: string | number) => `${v} €`),
}))

vi.mock('@/lib/prisma-column-fallback', () => ({
  withLocationColumnFallback: vi.fn(async (_key: string, fn: (withLoc: boolean) => unknown) => fn(true)),
}))

// public/order helperji: sheme + resolveTable + markTableOccupied REALNI
// (unit-testira scoping skozi realno tabelarno resolucijo); urnik/cene/zaloga/
// broadcast mockani (broadcast = spy za lokacijsko pin-ravo).
vi.mock('@/app/api/public/order/_helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/api/public/order/_helpers')>()
  return {
    ...actual,
    isRestaurantOpen: vi.fn(async () => true),
    calculateOrderItems: vi.fn(async () => ({
      orderItemsData: [{ menuItemId: 'mi-1', quantity: 1, price: 5, vatRate: 22, vatAmount: 1.1, notes: '', modifiersJson: '[]' }],
      subtotal: 5,
      totalVat: 1.1,
    })),
    deductInventoryInTx: vi.fn(async () => undefined),
    broadcastNewOrder: mocks.broadcastNewOrder,
  }
})

// online-order helperji: shema + konstante + calculateOrderItems REALNI,
// write/webhook poti mockane (createOnlineOrder = spy za lokacijsko pin-ravo).
vi.mock('@/app/api/public/online-order/_helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/api/public/online-order/_helpers')>()
  return {
    ...actual,
    checkRestaurantOpen: vi.fn(async () => null),
    calculateDeliveryFee: vi.fn(async () => ({ fee: 0 })),
    createOnlineOrder: mocks.createOnlineOrder,
    triggerWebhookAsync: mocks.triggerWebhookAsync,
  }
})

// P0-C3B regresijski pin: public/menu GET (single-tenant READ fallback)
vi.mock('@/lib/furs/config-resolver', () => ({
  getRestaurantInfoForLocation: vi.fn(async () => ({
    locationId: 'locAstatic', name: 'Restavracija', address: '', phone: '', currency: 'EUR', locale: 'sl',
  })),
}))
vi.mock('@/lib/middleware/cache-headers', () => ({
  withCache: vi.fn((res: unknown) => res),
  withETag: vi.fn((_req: unknown, res: unknown) => res),
  CachePresets: { PUBLIC_SHORT: { swr: 300 } },
}))

// Route imports (PO mockih)
import { POST as publicOrderPOST } from '@/app/api/public/order/route'
import { POST as onlineOrderPOST } from '@/app/api/public/online-order/route'
import { GET as publicMenuGET } from '@/app/api/public/menu/route'
// First-party klijenti (plumbing pin)
import { submitOrderApi } from '@/app/order/useOnlineOrder/api-helpers'
import { submitOrderRequest as qrMenuSubmitOrderRequest } from '@/app/qr-menu/use-qr-menu/api-helpers'

// Lokacijski id-ji MORAJO ustrezati regex obliki /^[a-z0-9]{5,50}$/i (brez
// vezajev) — ruti validirajo obliko PREJ kot DB poizvedbo.
const LOC_A = 'locTenantA'
const LOC_B = 'locTenantB'
const LOC_GHOST = 'locghost99'
const TABLE_ID = 'tblAbc12345'

function makeOrderBody(over: Record<string, unknown> = {}) {
  return {
    items: [{ menuItemId: 'mi-1', quantity: 1 }],
    ...over,
  }
}

function makeOrderReq(url: string, body: Record<string, unknown>) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeOnlineReq(locationId?: string) {
  return new Request('http://x/api/public/online-order', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      orderType: 'takeout',
      items: [{ menuItemId: 'mi-1', quantity: 1 }],
      paymentMethod: 'card',
      customer: { fullName: 'Gost', phone: '040123456', email: '', notes: '', preferredTime: '', type: 'takeout' },
      ...(locationId !== undefined
        ? {
            locationId,
            // R88: ordering token je OBVEZEN — kovan z realnim libom (isti
            // dev/test fallback vir, ki ga ruta preverja) za TO lokacijo.
            orderingToken: orderingTokenFor(locationId),
          }
        : {}),
    }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.checkRateLimit.mockResolvedValue({ allowed: true, retryAfterMs: 60000 })
  mocks.locationFindFirst.mockResolvedValue({ id: LOC_A })
  mocks.tableFindUnique.mockResolvedValue(null)
  mocks.tableFindFirst.mockResolvedValue(null)
  mocks.tableFindMany.mockResolvedValue([])
  mocks.tableUpdate.mockResolvedValue({})
  mocks.menuFindMany.mockResolvedValue([])
  mocks.diningOptionFindFirst.mockResolvedValue({ id: 'do-1' })
  mocks.diningOptionCreate.mockResolvedValue({ id: 'do-1' })
  mocks.menuItemFindMany.mockResolvedValue([{ id: 'mi-1', name: 'Pizza', price: 5, vatRate: 22, isAvailable: true, recipeItems: [] }])
  mocks.counterUpsert.mockResolvedValue({ value: 3 })
  mocks.txOrderUpdate.mockResolvedValue({})
  mocks.orderCreate.mockResolvedValue({ id: 'ord-1', orderNumber: 7, status: 'pending', total: 6.1, orderItems: [{ id: 'oi-1' }], table: null })
  mocks.getNextOrderNumber.mockResolvedValue(7)
  mocks.createOnlineOrder.mockResolvedValue({
    order: { id: 'o-on', orderNumber: '7', status: 'pending', total: 6.1 },
    customerName: 'Gost', customerPhone: '040123456', deliveryAddress: null,
  })
  mocks.triggerWebhookAsync.mockResolvedValue(undefined)
  mocks.fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, data: {} }), { status: 200, headers: { 'content-type': 'application/json' } }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// Skupni assert: NOBENA pisna operacija se ni zgodila (order create, dining
// option create, counter, order number, table write, KDS broadcast).
function expectZeroWrites() {
  expect(mocks.orderCreate).not.toHaveBeenCalled()
  expect(mocks.diningOptionCreate).not.toHaveBeenCalled()
  expect(mocks.getNextOrderNumber).not.toHaveBeenCalled()
  expect(mocks.counterUpsert).not.toHaveBeenCalled()
  expect(mocks.tableUpdate).not.toHaveBeenCalled()
  expect(mocks.broadcastNewOrder).not.toHaveBeenCalled()
  expect(mocks.createOnlineOrder).not.toHaveBeenCalled()
}

// ══════════════════════════════════════════════════════════════════
// A. PUBLIC/ORDER POST (QR) — fail-closed, brez globalnega fallbacka
// ══════════════════════════════════════════════════════════════════
describe('R87-3 A: POST /api/public/order — fail-closed lokacijski kontekst', () => {
  it('brez konteksta (noben tableId/tableNumber/locationId) → 400 + ZERO pisnih klicev + fallback NIKOLI konsultiran', async () => {
    const res = await publicOrderPOST(makeOrderReq('http://x/api/public/order', makeOrderBody()))
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('QR naročanje ni nastavljeno — kontaktirajte osebje')
    // R87-3 jedro: globalna prva-aktivna-lokacija fallback IZKLJUČENA iz pisne poti
    expect(mocks.resolveDefaultLocationId).not.toHaveBeenCalled()
    expect(mocks.menuItemFindMany).not.toHaveBeenCalled()
    expectZeroWrites()
  })

  it('neznana lokacija (?locationId, brez mize) → unificiran 404 "Lokacija ni najden" + ZERO pisnih klicev', async () => {
    mocks.locationFindFirst.mockResolvedValue(null)
    const res = await publicOrderPOST(makeOrderReq(`http://x/api/public/order?locationId=${LOC_GHOST}`, makeOrderBody()))
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Lokacija ni najden')
    const where = mocks.locationFindFirst.mock.calls[0][0].where
    expect(where).toEqual({ id: LOC_GHOST, isActive: true })
    expectZeroWrites()
  })

  it('tuja/neaktivna lokacija → ISTI unificiran 404 (ni obstoja-oraklja) + ZERO pisnih klicev', async () => {
    // location.findFirst({ id, isActive: true }) vrne null za TUJO lokacijo
    mocks.locationFindFirst.mockResolvedValue(null)
    const res = await publicOrderPOST(makeOrderReq('http://x/api/public/order', makeOrderBody({ locationId: LOC_B })))
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    // isti odgovor kot neznana lokacija — ni razlike "ne obstaja" vs "tuja"
    expect(body.error).toBe('Lokacija ni najden')
    expectZeroWrites()
  })

  it('neveljavna oblika locationId → 404 BREZ DB poizvedbe', async () => {
    const res = await publicOrderPOST(makeOrderReq('http://x/api/public/order?locationId=ab', makeOrderBody()))
    expect(res.status).toBe(404)
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
    expectZeroWrites()
  })

  it('veljaven ?locationId (brez mize) → 201 + žig = ta lokacija (stamp, counter, menu, diningOption, broadcast pinned)', async () => {
    const res = await publicOrderPOST(makeOrderReq(`http://x/api/public/order?locationId=${LOC_A}`, makeOrderBody()))
    expect(res.status).toBe(201)
    const body = await res.json() as { success: boolean }
    expect(body.success).toBe(true)
    // žig naročila pinned na eksplicitno lokacijo
    expect(mocks.orderCreate.mock.calls[0][0].data.locationId).toBe(LOC_A)
    // artikli scoped na menu te lokacije
    expect(mocks.menuItemFindMany.mock.calls[0][0].where.category).toEqual({ menu: { locationId: LOC_A } })
    // per-lokacijski order counter TOČNO TE lokacije
    expect(mocks.getNextOrderNumber).toHaveBeenCalledWith(LOC_A)
    // dining option per-lokacijski
    expect(mocks.diningOptionFindFirst.mock.calls[0][0].where).toEqual({ type: 'dine-in', locationId: LOC_A })
    // KDS broadcast na VALIDIRANO lokacijo
    expect(mocks.broadcastNewOrder).toHaveBeenCalledTimes(1)
    expect(mocks.broadcastNewOrder.mock.calls[0][3]).toBe(LOC_A)
  })

  it('veljaven body.locationId (brez query) → 201 + žig', async () => {
    const res = await publicOrderPOST(makeOrderReq('http://x/api/public/order', makeOrderBody({ locationId: LOC_A })))
    expect(res.status).toBe(201)
    expect(mocks.orderCreate.mock.calls[0][0].data.locationId).toBe(LOC_A)
  })

  it('query ?locationId ima prednost pred body.locationId', async () => {
    const res = await publicOrderPOST(makeOrderReq(`http://x/api/public/order?locationId=${LOC_A}`, makeOrderBody({ locationId: LOC_B })))
    expect(res.status).toBe(201)
    expect(mocks.locationFindFirst.mock.calls[0][0].where.id).toBe(LOC_A)
    expect(mocks.orderCreate.mock.calls[0][0].data.locationId).toBe(LOC_A)
  })

  it('tableId QR pot (brez izrecnega konteksta) → lokacija iz mize, validirana → 201 + žig + occupied write ostane', async () => {
    mocks.tableFindUnique.mockResolvedValue({ id: TABLE_ID, number: 5, status: 'available', locationId: LOC_A })
    const res = await publicOrderPOST(makeOrderReq('http://x/api/public/order', makeOrderBody({ tableId: TABLE_ID })))
    expect(res.status).toBe(201)
    // where pin: validacija lokacije mize (obstaja + aktiven)
    expect(mocks.locationFindFirst.mock.calls[0][0].where).toEqual({ id: LOC_A, isActive: true })
    expect(mocks.orderCreate.mock.calls[0][0].data.locationId).toBe(LOC_A)
    expect(mocks.getNextOrderNumber).toHaveBeenCalledWith(LOC_A)
    // miza occupied (F7-5 obnašanje nespremenjeno — write po uspešnih gate-ih)
    expect(mocks.tableUpdate).toHaveBeenCalled()
    expect(mocks.broadcastNewOrder.mock.calls[0][3]).toBe(LOC_A)
  })

  it('tableId mize na NEAKTIVNI/nezni lokaciji → unificiran 404 + ZERO pisnih klicev', async () => {
    mocks.tableFindUnique.mockResolvedValue({ id: TABLE_ID, number: 5, status: 'available', locationId: LOC_B })
    mocks.locationFindFirst.mockResolvedValue(null)
    const res = await publicOrderPOST(makeOrderReq('http://x/api/public/order', makeOrderBody({ tableId: TABLE_ID })))
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Lokacija ni najden')
    expectZeroWrites()
  })

  it('TUJA miza (tableId) + izrecen lasten locationId → 404 (nikoli žig na lokacijo tuje mize)', async () => {
    mocks.tableFindUnique.mockResolvedValue({ id: TABLE_ID, number: 5, status: 'available', locationId: LOC_B })
    const res = await publicOrderPOST(makeOrderReq(`http://x/api/public/order?locationId=${LOC_A}`, makeOrderBody({ tableId: TABLE_ID })))
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Lokacija ni najden')
    expectZeroWrites()
  })

  it('tableNumber + locationId → 201 (R84 M2 pin: per-lokacijska disambiguacija še deluje)', async () => {
    mocks.tableFindFirst.mockResolvedValue({ id: TABLE_ID, number: 5, locationId: LOC_A, status: 'available' })
    const res = await publicOrderPOST(makeOrderReq('http://x/api/public/order', makeOrderBody({ tableNumber: '5', locationId: LOC_A })))
    expect(res.status).toBe(201)
    expect(mocks.tableFindFirst.mock.calls[0][0].where).toEqual({ number: 5, locationId: LOC_A })
    expect(mocks.orderCreate.mock.calls[0][0].data.locationId).toBe(LOC_A)
  })

  it('tableNumber BREZ locationId → 400 (R84 M2 pin ohranjen) + ZERO pisnih klicev', async () => {
    const res = await publicOrderPOST(makeOrderReq('http://x/api/public/order', makeOrderBody({ tableNumber: '5' })))
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toContain('lokacijski kontekst')
    expect(mocks.resolveDefaultLocationId).not.toHaveBeenCalled()
    expectZeroWrites()
  })
})

// ══════════════════════════════════════════════════════════════════
// B. PUBLIC/ONLINE-ORDER POST — obvezen + validiran locationId
// ══════════════════════════════════════════════════════════════════
describe('R87-3 B: POST /api/public/online-order — fail-closed lokacijski kontekst', () => {
  it('brez locationId → 400 + ZERO pisnih klicev + fallback NIKOLI konsultiran', async () => {
    const res = await onlineOrderPOST(makeOnlineReq())
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Restavracija trenutno ne sprejema spletnih naročil')
    expect(mocks.resolveDefaultLocationId).not.toHaveBeenCalled()
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
    expect(mocks.menuItemFindMany).not.toHaveBeenCalled()
    expectZeroWrites()
  })

  it('neznana/tuja/neaktivna lokacija → unificiran 404 "Lokacija ni najden" (prej 400 z orakljem) + ZERO pisnih klicev', async () => {
    mocks.locationFindFirst.mockResolvedValue(null)
    const res = await onlineOrderPOST(makeOnlineReq(LOC_B))
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Lokacija ni najden')
    const where = mocks.locationFindFirst.mock.calls[0][0].where
    expect(where).toEqual({ id: LOC_B, isActive: true })
    expect(mocks.menuItemFindMany).not.toHaveBeenCalled()
    expectZeroWrites()
  })

  it('neveljavna oblika locationId → 404 brez DB poizvedbe', async () => {
    const res = await onlineOrderPOST(makeOnlineReq('ab'))
    expect(res.status).toBe(404)
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
    expectZeroWrites()
  })

  it('veljaven locationId → 201 + žig (createOnlineOrder, counter, menu scope) + webhook/checkNumber ostajata', async () => {
    const res = await onlineOrderPOST(makeOnlineReq(LOC_A))
    expect(res.status).toBe(201)
    const body = await res.json() as { success: boolean }
    expect(body.success).toBe(true)
    // artikli scoped na izbrano lokacijo
    expect(mocks.menuItemFindMany.mock.calls[0][0].where.category).toEqual({ menu: { locationId: LOC_A } })
    // per-lokacijski order counter TOČNO TE lokacije
    expect(mocks.getNextOrderNumber).toHaveBeenCalledWith(LOC_A)
    // createOnlineOrder prejme VALIDIRANO lokacijo (žig v transakciji)
    expect(mocks.createOnlineOrder).toHaveBeenCalledTimes(1)
    expect(mocks.createOnlineOrder.mock.calls[0][0].locationId).toBe(LOC_A)
    // checkNumber counter + webhook emisijska pot ostajata nespremenjena
    expect(mocks.counterUpsert).toHaveBeenCalled()
    expect(mocks.triggerWebhookAsync).toHaveBeenCalledWith('order.created', expect.objectContaining({ orderId: 'o-on' }))
  })
})

// ══════════════════════════════════════════════════════════════════
// C. FIRST-Party KLIJENTI — plumbing pošilja izrecen locationId
// ══════════════════════════════════════════════════════════════════
describe('R87-3 C: first-party klijenti — locationId v request body', () => {
  it('online-order klijent (submitOrderApi) vključi locationId v POST body', async () => {
    vi.stubGlobal('fetch', mocks.fetchMock)
    const result = await submitOrderApi({
      orderType: 'takeout',
      cart: [],
      paymentMethod: 'card',
      deliveryDetails: {} as never,
      takeoutDetails: {} as never,
      deliveryFee: 0,
      promoCode: '',
      promoResult: null,
      selectedLocation: LOC_A,
    })
    expect(result.success).toBe(true)
    expect(mocks.fetchMock.mock.calls[0][0]).toBe('/api/public/online-order')
    const sentBody = JSON.parse(mocks.fetchMock.mock.calls[0][1].body) as { locationId?: string }
    expect(sentBody.locationId).toBe(LOC_A)
  })

  it('qr-menu klijent (submitOrderRequest) vključi locationId v POST body (R87-3 plumbing)', async () => {
    vi.stubGlobal('fetch', mocks.fetchMock)
    const cart = [{ menuItem: { id: 'mi-1', price: 5, vatRate: 22 }, quantity: 1, notes: '', selectedModifiers: [] }] as unknown as Parameters<typeof qrMenuSubmitOrderRequest>[1]
    await qrMenuSubmitOrderRequest('5', cart, LOC_A)
    expect(mocks.fetchMock.mock.calls[0][0]).toBe('/api/public/order')
    const sentBody = JSON.parse(mocks.fetchMock.mock.calls[0][1].body) as { locationId?: string; tableNumber?: string }
    expect(sentBody.locationId).toBe(LOC_A)
    expect(sentBody.tableNumber).toBe('5')
  })

  it('qr/[tableId] klijent pošilja tableId — lokacija se izpelje strežniško (pin: payload brez locationId je veljaven le s tableId)', async () => {
    mocks.tableFindUnique.mockResolvedValue({ id: TABLE_ID, number: 3, status: 'available', locationId: LOC_A })
    const res = await publicOrderPOST(makeOrderReq('http://x/api/public/order', makeOrderBody({
      tableId: TABLE_ID,
      orderItems: [{ menuItemId: 'mi-1', quantity: 1 }], // oblika qr/[tableId] klijenta
    })))
    expect(res.status).toBe(201)
    expect(mocks.orderCreate.mock.calls[0][0].data.locationId).toBe(LOC_A)
  })
})

// ══════════════════════════════════════════════════════════════════
// D. P0-C3B — single-tenant GET READ fallback OHRANJEN (regresijski pin)
// ══════════════════════════════════════════════════════════════════
describe('R87-3 D: P0-C3B — GET read fallback (samo READ poti, ne pisne)', () => {
  it('public/menu GET brez ?locationId → single-tenant READ fallback ohranjen (prva aktivna lokacija)', async () => {
    const res = await publicMenuGET(new Request('http://x/api/public/menu'))
    expect(res.status).toBe(200)
    // fallback READ poizvedba: prva aktivna lokacija — meni je scoped nanjo
    expect(mocks.locationFindFirst).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })
    expect(mocks.menuFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('public/order in public/online-order nimata GET handlerja (WRITE-only — pisni fallback Nič, read fallback ni njuna skrb)', async () => {
    const orderRoute = await import('@/app/api/public/order/route')
    const onlineRoute = await import('@/app/api/public/online-order/route')
    expect((orderRoute as Record<string, unknown>).GET).toBeUndefined()
    expect((onlineRoute as Record<string, unknown>).GET).toBeUndefined()
  })
})
