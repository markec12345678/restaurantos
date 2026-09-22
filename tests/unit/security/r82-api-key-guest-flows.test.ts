// ============================================
// R82-C — API-key tenant binding: mobile/order + public/online-order
//         + security-audit (issuance/revoke/rotate scope)
// ============================================
// Pokriva R82-C audit fixe (uporabnik: "šele če audit dokaže problem,
// popravljaj" — audit DOKAZAL: mobile/order POST LEAK-HIGH, GET MEDIUM,
// online-order MEDIUM):
//
//   1. GET /api/mobile/order — order.findFirst scoped na
//      location.subscriptionId (P0-C5 subscriptionId končno PORABLJEN);
//      fail-closed brez subscriptionId; rate limit.
//   2. POST /api/mobile/order — miza scoped (tuja miza → 404, NE tiho
//      fallback); lokacija rešena PRED item validacijo; menuItems scoped na
//      category.menu.locationId; idempotency replay scoped; P2002 s tujim
//      ključem → generičen 409 (nikoli tuj order); rate limit.
//   3. POST /api/public/online-order — lokacija rešena PRED meni poizvedbo;
//      menuItems scoped (category.menu.locationId) → ni cross-tenant
//      injection/ existence oracle; INSUFFICIENT_STOCK brez količin (stock
//      oracle zaprt).
//   4. /api/security-audit — izdajateljeva naročnina: listApiKeys/create/
//      revoke/delete/rotate scoped prek session.locationId →
//      location.subscriptionId; platform admin = global.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyApiKey: vi.fn(),
  rateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  requireAuth: vi.fn(),
  orderFindFirst: vi.fn(),
  orderCreate: vi.fn(),
  tableFindFirst: vi.fn(),
  locationFindFirst: vi.fn(),
  locationFindUnique: vi.fn(),
  menuItemFindMany: vi.fn(),
  counterUpsert: vi.fn(),
  getNextOrderNumber: vi.fn(),
  auditListApiKeys: vi.fn(),
  auditCreateApiKey: vi.fn(),
  auditRevokeApiKey: vi.fn(),
  auditDeleteApiKey: vi.fn(),
  auditRotateApiKey: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.rateLimit,
  getClientIp: () => '127.0.0.1',
  PUBLIC_ORDER_LIMIT: { maxRequests: 5, windowMs: 60_000 },
  ONLINE_ORDER_LIMIT: { maxRequests: 5, windowMs: 120_000 },
}))

vi.mock('@/lib/db', () => ({
  db: {
    order: { findFirst: mocks.orderFindFirst, findUnique: vi.fn(), create: mocks.orderCreate },
    table: { findFirst: mocks.tableFindFirst, findUnique: vi.fn() },
    location: { findFirst: mocks.locationFindFirst, findUnique: mocks.locationFindUnique },
    menuItem: { findMany: mocks.menuItemFindMany },
    counter: { upsert: mocks.counterUpsert },
    $transaction: vi.fn(async (fn: (tx: object) => unknown) => fn({ order: { create: mocks.orderCreate } })),
  },
}))

vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: mocks.requireAuth,
}))

vi.mock('@/lib/api-security', () => ({
  verifyApiKey: mocks.verifyApiKey,
  listApiKeys: mocks.auditListApiKeys,
  createApiKey: mocks.auditCreateApiKey,
  revokeApiKey: mocks.auditRevokeApiKey,
  deleteApiKey: mocks.auditDeleteApiKey,
  rotateApiKey: mocks.auditRotateApiKey,
  hasScope: vi.fn(),
  logApiKeyUsage: vi.fn(),
}))

vi.mock('@/lib/counters', () => ({
  getNextOrderNumber: mocks.getNextOrderNumber,
}))

// order-items helperji — lahkoten mock (unit testira SCOPING, ne matematike)
vi.mock('@/app/api/orders/_helpers/order-items', () => ({
  buildOrderItemsData: vi.fn(() => ({ orderItemsData: [], subtotal: 10 })),
  calculateOrderTotals: vi.fn(() => ({ totalTax: 2.2, total: 12.2 })),
  fetchModifierPriceMap: vi.fn(async () => new Map()),
}))

// online-order helperji: schema + konstante REALNI, funkcije mockane
vi.mock('@/app/api/public/online-order/_helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/api/public/online-order/_helpers')>()
  return {
    ...actual,
    checkRestaurantOpen: vi.fn(async () => null),
    calculateDeliveryFee: vi.fn(async () => ({ fee: 0 })),
    createOnlineOrder: vi.fn(),
    triggerWebhookAsync: vi.fn(async () => undefined),
  }
})

import { GET as mobileOrderGET, POST as mobileOrderPOST } from '@/app/api/mobile/order/route'
import { POST as onlineOrderPOST } from '@/app/api/public/online-order/route'
import { GET as auditGET, POST as auditPOST } from '@/app/api/security-audit/route'
import { createOnlineOrder } from '@/app/api/public/online-order/_helpers'
// R88: realen ordering-token lib (dev/test fallback skrivnost) — kovanje
// tokenov za online-order zahtevke (ruta preverja z ISTIM virom).
import { orderingTokenFor } from '@/lib/ordering-token'

// --- Helperji ---
function validKey(subscriptionId: string | null = 'sub-1', scopes = ['write:orders']) {
  mocks.verifyApiKey.mockResolvedValue({
    valid: true,
    apiKey: { id: 'key-1', name: 'Kiosk', keyPrefix: 'posr_xxx', scopes, rateLimit: 60, isActive: true, createdAt: new Date() },
    ...(subscriptionId ? { subscriptionId } : {}),
  })
}

function makeMobileReq(method: 'GET' | 'POST', body?: unknown): Request {
  const headers: Record<string, string> = { authorization: 'Bearer posr_test' }
  if (body !== undefined) headers['content-type'] = 'application/json'
  return new Request('http://localhost:3000/api/mobile/order', {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

const MOBILE_BODY = {
  tableId: 'table-1',
  customerName: 'Gost',
  items: [{ menuItemId: 'mi-1', quantity: 2 }],
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.rateLimit.mockResolvedValue({ allowed: true })
  mocks.counterUpsert.mockResolvedValue({ value: 1 })
})

// ============================================
// 1) GET /api/mobile/order — subscription scope
// ============================================
describe('R82-C: mobile/order GET — subscription scope', () => {
  it('order.findFirst DOBI location.subscriptionId filter (P0-C5 porabljen)', async () => {
    validKey('sub-1')
    mocks.orderFindFirst.mockResolvedValue({
      id: 'o-1', orderNumber: 5, status: 'pending', total: 12.2, createdAt: new Date(), orderItems: [],
    })

    const req = new Request('http://localhost:3000/api/mobile/order?orderId=o-1', {
      headers: { authorization: 'Bearer posr_test' },
    })
    const res = await mobileOrderGET(req as never)

    expect(res.status).toBe(200)
    const where = mocks.orderFindFirst.mock.calls[0][0].where
    expect(where.id).toBe('o-1')
    expect(where.location).toEqual({ subscriptionId: 'sub-1' })
  })

  it('tuj order (findFirst null) → 404 brez podatkov', async () => {
    validKey('sub-1')
    mocks.orderFindFirst.mockResolvedValue(null)

    const req = new Request('http://localhost:3000/api/mobile/order?orderId=o-foreign', {
      headers: { authorization: 'Bearer posr_test' },
    })
    const res = await mobileOrderGET(req as never)

    expect(res.status).toBe(404)
  })

  it('veljaven ključ BREZ subscriptionId → 403 fail-closed, DB NI klican', async () => {
    validKey(null)

    const req = new Request('http://localhost:3000/api/mobile/order?orderId=o-1', {
      headers: { authorization: 'Bearer posr_test' },
    })
    const res = await mobileOrderGET(req as never)

    expect(res.status).toBe(403)
    expect(mocks.orderFindFirst).not.toHaveBeenCalled()
  })

  it('neveljaven ključ → 401', async () => {
    mocks.verifyApiKey.mockResolvedValue({ valid: false, error: 'Neveljaven API ključ' })

    const req = new Request('http://localhost:3000/api/mobile/order?orderId=o-1', {
      headers: { authorization: 'Bearer posr_test' },
    })
    const res = await mobileOrderGET(req as never)

    expect(res.status).toBe(401)
  })

  it('rate limit ograja PRED verifyApiKey', async () => {
    mocks.rateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 60_000 })

    const req = new Request('http://localhost:3000/api/mobile/order?orderId=o-1', {
      headers: { authorization: 'Bearer posr_test' },
    })
    const res = await mobileOrderGET(req as never)

    expect(res.status).toBe(429)
    expect(mocks.verifyApiKey).not.toHaveBeenCalled()
  })
})

// ============================================
// 2) POST /api/mobile/order — HIGH: tuja miza, meni scope, idempotency
// ============================================
describe('R82-C: mobile/order POST — cross-tenant write zaprt', () => {
  function primeHappyPath() {
    validKey('sub-1')
    mocks.tableFindFirst.mockResolvedValue({ locationId: 'loc-1' })
    mocks.menuItemFindMany.mockResolvedValue([
      { id: 'mi-1', name: 'Pizza', price: 5, vatRate: 22, isAvailable: true },
    ])
    mocks.getNextOrderNumber.mockResolvedValue(7)
    mocks.orderCreate.mockResolvedValue({ id: 'o-new', orderNumber: 7, total: 12.2, locationId: 'loc-1' })
  }

  it('TUJA miza (findFirst null) → 404, items se NE validirajo, order se NE ustvari', async () => {
    validKey('sub-1')
    mocks.tableFindFirst.mockResolvedValue(null)

    const res = await mobileOrderPOST(makeMobileReq('POST', MOBILE_BODY))

    expect(res.status).toBe(404)
    const where = mocks.tableFindFirst.mock.calls[0][0].where
    expect(where.id).toBe('table-1')
    expect(where.location).toEqual({ subscriptionId: 'sub-1' })
    // lokacija rešena PRED item validacijo
    expect(mocks.menuItemFindMany).not.toHaveBeenCalled()
    expect(mocks.orderCreate).not.toHaveBeenCalled()
  })

  it('lastna miza → 201; menuItems scoped na category.menu.locationId; create na loc-1', async () => {
    primeHappyPath()

    const res = await mobileOrderPOST(makeMobileReq('POST', MOBILE_BODY))

    expect(res.status).toBe(201)
    const miWhere = mocks.menuItemFindMany.mock.calls[0][0].where
    expect(miWhere.category).toEqual({ menu: { locationId: 'loc-1' } })
    expect(mocks.getNextOrderNumber).toHaveBeenCalledWith('loc-1')
    const txArg = mocks.orderCreate.mock.calls[0][0]
    expect(txArg.data.locationId).toBe('loc-1')
  })

  it('brez tableId → privzeta lokacija scoped na naročnino (NE globalna prva)', async () => {
    primeHappyPath()
    mocks.tableFindFirst.mockClear()
    mocks.locationFindFirst.mockResolvedValue({ id: 'loc-9' })

    const body = { ...MOBILE_BODY, tableId: undefined }
    const res = await mobileOrderPOST(makeMobileReq('POST', body))

    expect(res.status).toBe(201)
    const where = mocks.locationFindFirst.mock.calls[0][0].where
    expect(where).toEqual({ isActive: true, subscriptionId: 'sub-1' })
  })

  it('ni privzete lokacije za naročnino → 400', async () => {
    validKey('sub-1')
    mocks.locationFindFirst.mockResolvedValue(null)

    const body = { ...MOBILE_BODY, tableId: undefined }
    const res = await mobileOrderPOST(makeMobileReq('POST', body))

    expect(res.status).toBe(400)
    expect(mocks.menuItemFindMany).not.toHaveBeenCalled()
  })

  it('tuj menuItem (scoped findMany vrne []) → 400 "ne obstaja" (injection zaprt)', async () => {
    primeHappyPath()
    mocks.menuItemFindMany.mockResolvedValue([])

    const res = await mobileOrderPOST(makeMobileReq('POST', MOBILE_BODY))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('ne obstaja')
    expect(mocks.orderCreate).not.toHaveBeenCalled()
  })

  it('idempotency replay: lookup scoped na naročnino; zadetek → 200 z idempotentReplay', async () => {
    validKey('sub-1')
    mocks.orderFindFirst.mockResolvedValueOnce({
      id: 'o-existing', orderNumber: 3, total: 9.9, createdAt: new Date(), orderItems: [],
    })

    const body = { ...MOBILE_BODY, tableId: undefined, idempotencyKey: 'idem-1' }
    const res = await mobileOrderPOST(makeMobileReq('POST', body))

    expect(res.status).toBe(200)
    const bodyJson = await res.json()
    expect(bodyJson.idempotentReplay).toBe(true)
    const where = mocks.orderFindFirst.mock.calls[0][0].where
    expect(where.location).toEqual({ subscriptionId: 'sub-1' })
    expect(mocks.orderCreate).not.toHaveBeenCalled()
  })

  it('P2002 z IN-SCOPE obstoječim → replay 200', async () => {
    validKey('sub-1')
    mocks.tableFindFirst.mockClear()
    mocks.locationFindFirst.mockResolvedValue({ id: 'loc-9' })
    mocks.orderFindFirst
      .mockResolvedValueOnce(null) // pre-check: ni replay-a
      .mockResolvedValueOnce({ id: 'o-race', orderNumber: 4, total: 9.9, createdAt: new Date(), orderItems: [] }) // P2002 race
    mocks.menuItemFindMany.mockResolvedValue([
      { id: 'mi-1', name: 'Pizza', price: 5, vatRate: 22, isAvailable: true },
    ])
    mocks.getNextOrderNumber.mockResolvedValue(8)
    mocks.orderCreate.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }))

    const body = { ...MOBILE_BODY, tableId: undefined, idempotencyKey: 'idem-race' }
    const res = await mobileOrderPOST(makeMobileReq('POST', body))

    expect(res.status).toBe(200)
    const bodyJson = await res.json()
    expect(bodyJson.orderId).toBe('o-race')
  })

  it('P2002 s TUJIM ključem (in-scope lookup prazen) → generičen 409, nikoli tuj order', async () => {
    validKey('sub-1')
    mocks.tableFindFirst.mockClear()
    mocks.locationFindFirst.mockResolvedValue({ id: 'loc-9' })
    mocks.orderFindFirst
      .mockResolvedValueOnce(null) // pre-check
      .mockResolvedValueOnce(null) // P2002 scoped lookup: tuj ključ ni v scope
    mocks.menuItemFindMany.mockResolvedValue([
      { id: 'mi-1', name: 'Pizza', price: 5, vatRate: 22, isAvailable: true },
    ])
    mocks.getNextOrderNumber.mockResolvedValue(8)
    mocks.orderCreate.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }))

    const body = { ...MOBILE_BODY, tableId: undefined, idempotencyKey: 'idem-foreign' }
    const res = await mobileOrderPOST(makeMobileReq('POST', body))

    expect(res.status).toBe(409)
    const bodyJson = await res.json()
    expect(bodyJson.orderId).toBeUndefined()
  })

  it('rate limit → 429 pred verifyApiKey', async () => {
    mocks.rateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 60_000 })

    const res = await mobileOrderPOST(makeMobileReq('POST', MOBILE_BODY))

    expect(res.status).toBe(429)
    expect(mocks.verifyApiKey).not.toHaveBeenCalled()
  })
})

// ============================================
// 3) POST /api/public/online-order — meni scope + stock oracle
// ============================================
describe('R82-C: public/online-order — lokacijski scope artiklov', () => {
  function makeOnlineReq(locationId?: string): Request {
    return new Request('http://localhost:3000/api/public/online-order', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        orderType: 'takeout',
        items: [{ menuItemId: 'mi-1', quantity: 1 }],
        paymentMethod: 'card',
        customer: { fullName: 'Gost', phone: '040123456', email: '', notes: '', preferredTime: '', type: 'takeout' },
        ...(locationId
          ? {
              locationId,
              // R88: ordering token OBVEZEN — kovan z realnim libom (isti
              // dev/test fallback vir, ki ga ruta preverja) za TO lokacijo.
              orderingToken: orderingTokenFor(locationId),
            }
          : {}),
      }),
    })
  }

  function primeOnline(locationId: string) {
    // R87-3: validacija je zdaj findFirst({ id, isActive: true }) (kiosk kanon
    // R86-3) — prej findUnique + ročni isActive check.
    mocks.locationFindFirst.mockResolvedValue({ id: locationId })
    mocks.menuItemFindMany.mockResolvedValue([
      { id: 'mi-1', name: 'Pizza', price: 5, vatRate: 22, isAvailable: true, recipeItems: [] },
    ])
    mocks.getNextOrderNumber.mockResolvedValue(11)
    mocks.counterUpsert.mockResolvedValue({ value: 3 })
    ;(createOnlineOrder as ReturnType<typeof vi.fn>).mockResolvedValue({
      order: { id: 'o-on', orderNumber: '11', status: 'pending', total: 5 },
      customerName: 'Gost', customerPhone: '040123456', deliveryAddress: null,
    })
  }

  // R87-3: id-ji BREZ vezajev — route validira regex obliko /^[a-z0-9]{5,50}$/i
  // (kiosk kanon R86-3; Location.id je cuid, vezaji so neveljavna oblika).
  it('menuItems where vsebuje category.menu.locationId = rešena lokacija', async () => {
    primeOnline('locOnline')

    const res = await onlineOrderPOST(makeOnlineReq('locOnline'))

    expect(res.status).toBe(201)
    const where = mocks.menuItemFindMany.mock.calls[0][0].where
    expect(where.category).toEqual({ menu: { locationId: 'locOnline' } })
  })

  it('lokacija se reši PRED meni poizvedbo (invocationCallOrder)', async () => {
    primeOnline('locOnline')

    await onlineOrderPOST(makeOnlineReq('locOnline'))

    expect(mocks.locationFindFirst.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.menuItemFindMany.mock.invocationCallOrder[0])
  })

  it('neznana/tuja/neaktivna lokacija → unificiran 404 "Lokacija ni najden" (R87-3 kanon), meni NI poizvedan', async () => {
    mocks.locationFindFirst.mockResolvedValue(null)

    const res = await onlineOrderPOST(makeOnlineReq('locBad99'))

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Lokacija ni najden')
    // where pin: obstaja + aktiven (ni obstoja-oraklja)
    const where = mocks.locationFindFirst.mock.calls[0][0].where
    expect(where).toEqual({ id: 'locBad99', isActive: true })
    expect(mocks.menuItemFindMany).not.toHaveBeenCalled()
  })

  it('tuj menuItem (scoped findMany vrne []) → 400 "niso na voljo" (isti odgovor kot neobstoječ — ni oracle)', async () => {
    primeOnline('locOnline')
    mocks.menuItemFindMany.mockResolvedValue([])

    const res = await onlineOrderPOST(makeOnlineReq('locOnline'))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('niso na voljo')
    expect(body.unavailableItems).toEqual(['mi-1'])
  })

  it('INSUFFICIENT_STOCK: odgovor NE vsebuje količin (stock oracle zaprt), status 409', async () => {
    primeOnline('locOnline')
    ;(createOnlineOrder as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('INSUFFICIENT_STOCK:potrebno 2.00, na voljo 5.00'),
    )

    const res = await onlineOrderPOST(makeOnlineReq('locOnline'))
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toContain('na zalogi')
    expect(body.error).not.toContain('2.00')
    expect(body.error).not.toContain('5.00')
    expect(body.error).not.toContain('na voljo')
  })
})

// ============================================
// 4) /api/security-audit — izdajateljeva naročnina
// ============================================
describe('R82-C: security-audit — ApiKey issuance/revoke/rotate scope', () => {
  function mockAdmin(locationId: string | null) {
    mocks.requireAuth.mockResolvedValue({
      session: { employeeId: 'emp-1', role: 'admin', locationId, permissions: ['admin'] },
      error: null,
    })
  }

  it('GET: lokacijski admin → listApiKeys z subscriptionId svoje lokacije', async () => {
    mockAdmin('loc-1')
    mocks.locationFindUnique.mockResolvedValue({ subscriptionId: 'sub-1' })
    mocks.auditListApiKeys.mockResolvedValue([])

    const res = await auditGET(new Request('http://localhost:3000/api/security-audit'))

    expect(res.status).toBe(200)
    expect(mocks.locationFindUnique).toHaveBeenCalledWith({
      where: { id: 'loc-1' },
      select: { subscriptionId: true },
    })
    expect(mocks.auditListApiKeys).toHaveBeenCalledWith('sub-1')
  })

  it('GET: platform admin (brez lokacije) → listApiKeys globalno (undefined)', async () => {
    mockAdmin(null)
    mocks.auditListApiKeys.mockResolvedValue([])

    await auditGET(new Request('http://localhost:3000/api/security-audit'))

    expect(mocks.locationFindUnique).not.toHaveBeenCalled()
    expect(mocks.auditListApiKeys).toHaveBeenCalledWith(undefined)
  })

  it('POST create: lokacijski admin → createApiKey prejme subscriptionId izdajatelja', async () => {
    mockAdmin('loc-1')
    mocks.locationFindUnique.mockResolvedValue({ subscriptionId: 'sub-1' })
    mocks.auditCreateApiKey.mockResolvedValue({
      id: 'k-1', name: 'Kiosk', keyPrefix: 'posr_x', scopes: ['admin'], rateLimit: 60,
      isActive: true, createdAt: new Date(), plainKey: 'posr_plain',
    })

    const req = new Request('http://localhost:3000/api/security-audit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'create', name: 'Kiosk', scopes: ['admin'] }),
    })
    const res = await auditPOST(req)

    expect(res.status).toBe(201)
    expect(mocks.auditCreateApiKey).toHaveBeenCalledWith(
      expect.objectContaining({ subscriptionId: 'sub-1' }),
    )
  })

  it('POST rotate: lokacijski admin + tuj keyId → rotate scoped (subscriptionScope prenesen)', async () => {
    mockAdmin('loc-1')
    mocks.locationFindUnique.mockResolvedValue({ subscriptionId: 'sub-1' })
    mocks.auditRotateApiKey.mockResolvedValue(null) // scoped lookup prazen

    const req = new Request('http://localhost:3000/api/security-audit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'rotate', keyId: 'key-foreign' }),
    })
    const res = await auditPOST(req)

    expect(res.status).toBe(404)
    expect(mocks.auditRotateApiKey).toHaveBeenCalledWith('key-foreign', 'sub-1')
  })

  it('POST revoke/delete: subscriptionScope prenesen', async () => {
    mockAdmin('loc-1')
    mocks.locationFindUnique.mockResolvedValue({ subscriptionId: 'sub-2' })
    mocks.auditRevokeApiKey.mockResolvedValue(true)
    mocks.auditDeleteApiKey.mockResolvedValue(true)

    const reqRevoke = new Request('http://localhost:3000/api/security-audit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'revoke', keyId: 'key-1' }),
    })
    await auditPOST(reqRevoke)
    expect(mocks.auditRevokeApiKey).toHaveBeenCalledWith('key-1', 'sub-2')

    const reqDelete = new Request('http://localhost:3000/api/security-audit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'delete', keyId: 'key-1' }),
    })
    await auditPOST(reqDelete)
    expect(mocks.auditDeleteApiKey).toHaveBeenCalledWith('key-1', 'sub-2')
  })
})
