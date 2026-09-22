// ============================================
// R88/R89 — per-location public ordering token (route) — regresijski testi
// ============================================
// Zapira R87 BY-DESIGN luknjo (worklog R88 backlog): POST
// /api/public/online-order je sprejel body.locationId katere koli AKTIVNE
// lokacije KATEREGA KOLI tenanta (anonimen klicatelj).
//
// NOVO vedenje (R88, qr-pay HMAC vzorec iz R81; R89 tokenVersion):
//   1. produkcija BREZ HMAC skrivnosti → 503 fail-closed (R82-D kanon,
//      zrcali qr-pay init) — PRED resolucijo lokacije (ORCH R88: premaknjeno
//      pred lokacijski lookup — NI 404-vs-503 obstoja-oraklja aktivnih
//      lokacij v pokvarjeni produkciji; vsak zahtevek = isti 503), PRED
//      vsakim pisnim klicem.
//   2. body.orderingToken OBVEZEN in vezan na locationId + tokenVersion
//      (R89): manjkajoč / neveljaven / token TUJE lokacije / token IZDAN ZA
//      STARO verzijo lokacije → IZKLJUČNO notInScopeResponse('Lokacija')
//      404 'Lokacija ni najden' — isti odgovor za vse primere (ni
//      obstoja-oraklja), ZERO pisnih klicev.
//   3. R87 vedenje nespremenjeno: manjkajoč locationId → 400, neznana/
//      tuja/neaktivna/malformed lokacija → 404.
//   4. First-party klijent (submitOrderApi) pošilja orderingToken iz
//      URL deep-linka (?t=) — plumbing pin.
//   5. FIKSERJI brez tokenVersion polja (`{ id: LOC_A }`) še vedno delujejo:
//      ruta jemlje `location.tokenVersion ?? 0` (shema NOT NULL DEFAULT 0;
//      default verzija 0 = vsi R88 tokeni ostanejo veljavni — R89 no-backfill).
//
// Vzorec (r87-public-order-scope): vi.hoisted mocki + REALEN notInScopeResponse
// iz '@/lib/tenant-scope', REALNA Zod shema skozi validateRequest, REALEN
// lib/ordering-token (dev fallback skrivnost v test okolju) — tokeni v testih
// so kovani z ISTIM virom kot jih preverja ruta.
// ============================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  locationFindFirst: vi.fn(),
  menuItemFindMany: vi.fn(),
  counterUpsert: vi.fn(),
  orderCreate: vi.fn(),
  txOrderUpdate: vi.fn(),
  getNextOrderNumber: vi.fn(),
  createOnlineOrder: vi.fn(),
  triggerWebhookAsync: vi.fn(),
  fetchMock: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    location: { findFirst: mocks.locationFindFirst },
    menuItem: { findMany: mocks.menuItemFindMany },
    counter: { upsert: mocks.counterUpsert },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({
      order: { create: mocks.orderCreate, update: mocks.txOrderUpdate },
    })),
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.checkRateLimit,
  getClientIp: vi.fn(() => '1.2.3.4'),
  ONLINE_ORDER_LIMIT: { maxRequests: 5, windowMs: 120000 },
}))

vi.mock('@/lib/counters', () => ({
  getNextOrderNumber: mocks.getNextOrderNumber,
}))

// validateRequest: REALNA Zod shema (prejme jo route), realen parse — tako je
// body.orderingToken / locationId preverjen z istimi pravili kot v produkciji.
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

// online-order helperji: shema + konstante + calculateOrderItems REALNI,
// write/webhook poti mockane (createOnlineOrder = spy za lokacijsko pin-ravo).
// lib/ordering-token NI mockan (realen — dev fallback v test okolju).
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

// Route import (PO mockih)
import { POST as onlineOrderPOST } from '@/app/api/public/online-order/route'
import { orderingTokenFor } from '@/lib/ordering-token'
// First-party klijent (plumbing pin)
import { submitOrderApi } from '@/app/order/useOnlineOrder/api-helpers'

// Lokacijski id-ji MORAJO ustrezati regex obliki /^[a-z0-9]{5,50}$/i (brez
// vezajev) — ruta validira obliko PREJ kot DB poizvedbo.
const LOC_A = 'locTenantA'
const LOC_B = 'locTenantB'
const LOC_GHOST = 'locghost99'

/** Stub-a VSE štiri skrivnosti na prazno + produkcija (R82-D scenarij). */
function stubProductionNoSecret() {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('ORDERING_TOKEN_SECRET', '')
  vi.stubEnv('QR_PAY_SECRET', '')
  vi.stubEnv('ENCRYPTION_KEY', '')
  vi.stubEnv('NEXTAUTH_SECRET', '')
}

function makeOnlineReq(locationId?: string, orderingToken?: string) {
  return new Request('http://x/api/public/online-order', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      orderType: 'takeout',
      items: [{ menuItemId: 'mi-1', quantity: 1 }],
      paymentMethod: 'card',
      customer: { fullName: 'Gost', phone: '040123456', email: '', notes: '', preferredTime: '', type: 'takeout' },
      ...(locationId !== undefined ? { locationId } : {}),
      ...(orderingToken !== undefined ? { orderingToken } : {}),
    }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.checkRateLimit.mockResolvedValue({ allowed: true, retryAfterMs: 60000 })
  mocks.locationFindFirst.mockResolvedValue({ id: LOC_A })
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
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

// Skupni assert: NOBENA pisna operacija se ni zgodila (order create, order
// number, checkNumber counter, online-order transakcija, webhook).
function expectZeroWrites() {
  expect(mocks.orderCreate).not.toHaveBeenCalled()
  expect(mocks.getNextOrderNumber).not.toHaveBeenCalled()
  expect(mocks.counterUpsert).not.toHaveBeenCalled()
  expect(mocks.createOnlineOrder).not.toHaveBeenCalled()
  expect(mocks.triggerWebhookAsync).not.toHaveBeenCalled()
}

// ══════════════════════════════════════════════════════════════════
// A. Manjkajoč / neveljaven / tuj token → unificiran 404, ZERO pisnih klicev
// ══════════════════════════════════════════════════════════════════
describe('R88 A: POST /api/public/online-order — ordering token OBVEZEN', () => {
  it('manjkajoč token → 404 "Lokacija ni najden" + ZERO pisnih klicev (lokacija je bila sicer veljavna)', async () => {
    const res = await onlineOrderPOST(makeOnlineReq(LOC_A))
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Lokacija ni najden')
    // lokacija je bila resolvana (404 semantika zedinjena ZA resolucijo);
    // R89: select zdaj vključuje tokenVersion (brez dodatnega DB klica)
    expect(mocks.locationFindFirst).toHaveBeenCalledWith({
      where: { id: LOC_A, isActive: true },
      select: { id: true, tokenVersion: true },
    })
    // menu lookup in vsi zapisi SE NIKOLI ne zgodijo
    expect(mocks.menuItemFindMany).not.toHaveBeenCalled()
    expectZeroWrites()
  })

  it('neveljaven token (napačen format) → 404 + ZERO pisnih klicev', async () => {
    const res = await onlineOrderPOST(makeOnlineReq(LOC_A, 'tok-neveljaven'))
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Lokacija ni najden')
    expectZeroWrites()
  })

  it('tamperiran token (`v1:0:` + napačen MAC) → 404 + ZERO pisnih klicev', async () => {
    const res = await onlineOrderPOST(makeOnlineReq(LOC_A, `v1:0:${'f'.repeat(64)}`))
    expect(res.status).toBe(404)
    expectZeroWrites()
  })

  it('token za TUJO lokacijo → ISTI 404 (ni razlike "manjka" vs "tuj" — ni oraklja)', async () => {
    const res = await onlineOrderPOST(makeOnlineReq(LOC_A, orderingTokenFor(LOC_B)))
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    // isti odgovor kot manjkajoč token (test zgoraj) — unificiran 404
    expect(body.error).toBe('Lokacija ni najden')
    expectZeroWrites()
  })

  it('prazen orderingToken v body → 404 (zod .optional() dovoli "", verify zavrne)', async () => {
    const res = await onlineOrderPOST(makeOnlineReq(LOC_A, ''))
    expect(res.status).toBe(404)
    expectZeroWrites()
  })
})

// ══════════════════════════════════════════════════════════════════
// B. Veljaven token → naročilo se ustvari (žig pinned na lokacijo)
// ══════════════════════════════════════════════════════════════════
describe('R88 B: veljaven ordering token → 201 + žig', () => {
  it('orderingTokenFor(LOC_A) za LOC_A → 201, createOnlineOrder žige LOC_A', async () => {
    const res = await onlineOrderPOST(makeOnlineReq(LOC_A, orderingTokenFor(LOC_A)))
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
// B2. R89 — tokenVersion gate (per-location revokacija)
// ══════════════════════════════════════════════════════════════════
describe('R89 B2: POST /api/public/online-order — tokenVersion gate', () => {
  it('lokacija ima tokenVersion=1, token kovan za verzijo 0 (pred rotate) → 404 + ZERO pisnih klicev', async () => {
    // rotacija se je zgodila: DB vrstica nosi novo verzijo 1
    mocks.locationFindFirst.mockResolvedValue({ id: LOC_A, tokenVersion: 1 })
    const res = await onlineOrderPOST(makeOnlineReq(LOC_A, orderingTokenFor(LOC_A, 0)))
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    // ISTI unified 404 kot napačen/tuj token — ni razlike "star" vs "tuj"
    expect(body.error).toBe('Lokacija ni najden')
    expect(mocks.menuItemFindMany).not.toHaveBeenCalled()
    expectZeroWrites()
  })

  it('lokacija ima tokenVersion=1, token kovan za verzijo 1 (po rotate) → 201 žig LOC_A', async () => {
    mocks.locationFindFirst.mockResolvedValue({ id: LOC_A, tokenVersion: 1 })
    const res = await onlineOrderPOST(makeOnlineReq(LOC_A, orderingTokenFor(LOC_A, 1)))
    expect(res.status).toBe(201)
    const body = await res.json() as { success: boolean }
    expect(body.success).toBe(true)
    expect(mocks.createOnlineOrder.mock.calls[0][0].locationId).toBe(LOC_A)
    expect(mocks.getNextOrderNumber).toHaveBeenCalledWith(LOC_A)
  })
})

// ══════════════════════════════════════════════════════════════════
// C. Produkcija brez skrivnosti → 503 fail-closed (R82-D kanon)
// ══════════════════════════════════════════════════════════════════
describe('R88 C: produkcija brez ORDERING_TOKEN_SECRET → 503', () => {
  it('NODE_ENV=production brez skrivnosti → 503 + ZERO pisnih klicev (tudi z "veljavnim" tokenom)', async () => {
    // token kovan PRED preklopom okolja (v test fallback okolju)
    const devToken = orderingTokenFor(LOC_A)
    stubProductionNoSecret()
    const res = await onlineOrderPOST(makeOnlineReq(LOC_A, devToken))
    expect(res.status).toBe(503)
    const body = await res.json() as { error: string }
    expect(body.error).toBeTruthy()
    expect(body.error).not.toContain('SECRET')
    expect(body.error).not.toContain('HMAC')
    // ORCH R88: 503 gre PRED resolucijo lokacije — ni 404-vs-503 obstoja-oraklja
    // (vsak zahtevek v pokvarjeni produkciji dobi isti 503, tudi z neznano lokacijo)
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
    expect(mocks.menuItemFindMany).not.toHaveBeenCalled()
    expectZeroWrites()
  })
})

// ══════════════════════════════════════════════════════════════════
// D. R87 vedenje nespremenjeno (lokacijski kontekst) — regresijski pin
// ══════════════════════════════════════════════════════════════════
describe('R88 D: R87 lokacijski kontekst ostaja (regresija)', () => {
  it('brez locationId → 400 + ZERO pisnih klicev (prej kot resolucija/tokena)', async () => {
    const res = await onlineOrderPOST(makeOnlineReq())
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Restavracija trenutno ne sprejema spletnih naročil')
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
    expectZeroWrites()
  })

  it('neznana/neaktivna lokacija → 404 (tudi z veljavnim tokenom za njo — ni oraklja)', async () => {
    mocks.locationFindFirst.mockResolvedValue(null)
    const res = await onlineOrderPOST(makeOnlineReq(LOC_GHOST, orderingTokenFor(LOC_GHOST)))
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Lokacija ni najden')
    expect(mocks.menuItemFindMany).not.toHaveBeenCalled()
    expectZeroWrites()
  })

  it('neveljavna oblika locationId → 404 BREZ DB poizvedbe', async () => {
    const res = await onlineOrderPOST(makeOnlineReq('ab', orderingTokenFor('ab')))
    expect(res.status).toBe(404)
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
    expectZeroWrites()
  })
})

// ══════════════════════════════════════════════════════════════════
// E. First-party klijent — submitOrderApi pošilja orderingToken (plumbing)
// ══════════════════════════════════════════════════════════════════
describe('R88 E: submitOrderApi plumbing — orderingToken v POST body', () => {
  it('z tokenom (URL deep link ?t=) → body vsebuje orderingToken + locationId', async () => {
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
      orderingToken: orderingTokenFor(LOC_A),
    })
    expect(result.success).toBe(true)
    expect(mocks.fetchMock.mock.calls[0][0]).toBe('/api/public/online-order')
    const sentBody = JSON.parse(mocks.fetchMock.mock.calls[0][1].body) as { locationId?: string; orderingToken?: string }
    expect(sentBody.locationId).toBe(LOC_A)
    expect(sentBody.orderingToken).toBe(orderingTokenFor(LOC_A))
  })

  it('brez tokena → orderingToken NIKOLI fake-an (ključ izpuščen iz body)', async () => {
    vi.stubGlobal('fetch', mocks.fetchMock)
    await submitOrderApi({
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
    const sentBody = JSON.parse(mocks.fetchMock.mock.calls[0][1].body) as { orderingToken?: string }
    expect(Object.prototype.hasOwnProperty.call(sentBody, 'orderingToken')).toBe(false)
  })
})
