// ============================================
// R135 — EPIC #115 P1-11 KIOSK: plačilna semantika + zaloga + vezava naprave
// ============================================
// Regresijsko zaklene strežniško polovico P1-11 (route POST /api/public/kiosk):
//   1. Plačilo: order.paymentMethod persistiran (prej Vedno '') + Check
//      (checkNumber counter, unpaid) + kartica → Payment 'pending' /
//      gotovina → brez Payment vrstice (plačilo pri blagajni) — kanon
//      online-order createOnlineOrder.
//   2. Odbitek zaloge znotraj transakcije (deductInventoryInTx + order.update
//      inventoryDeducted: true + orderItem.checkId link) — kanon QR javne poti.
//   3. Sold-out enforcement na pisni poti (R124 mapa; 'out' → 400 +
//      unavailableItems, ZERO pisnih klicev; 'low' → dovoljen).
//   4. Gate odprtosti (isRestaurantOpen fail-closed → 403, pred menu fetchem).
//   5. MAX_ORDER_TOTAL zgornja meja (QR-02 kanon) → 400.
//   6. DeviceRegistry vezava: deviceId → upsert type 'kiosk', status 'online',
//      lastSeenAt; napaka registracije NE restriktira naročila (best-effort).
//   7. Idempotent replay short-circuit: 200 replay PRED counterjem/tranzakcijo.
//   8. GET: modifierGroups v selectu (kiosk mora ponuditi dodatke).
// Vzorec: trap-DB (vi.hoisted + vi.mock), kot r86-public-scope.
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
  orderUpdate: vi.fn(),
  checkCreate: vi.fn(),
  paymentCreate: vi.fn(),
  orderItemUpdateMany: vi.fn(),
  deviceRegistryUpsert: vi.fn(),
  getNextOrderNumber: vi.fn(),
  getNextCounter: vi.fn(),
  computeMenuStockMap: vi.fn(),
  verifyOrderingToken: vi.fn(),
  isOrderingSecretConfigured: vi.fn(),
  kioskIsOpen: vi.fn(),
  deductInventoryInTx: vi.fn(),
  buildOrderItemsData: vi.fn(),
  calculateOrderTotals: vi.fn(),
  fetchModifierPriceMap: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    location: { findFirst: mocks.locationFindFirst },
    menu: { findMany: mocks.menuFindMany },
    menuItem: { findMany: mocks.menuItemFindMany },
    order: { findFirst: mocks.orderFindFirst, create: mocks.orderCreate, update: mocks.orderUpdate },
    check: { create: mocks.checkCreate },
    payment: { create: mocks.paymentCreate },
    orderItem: { updateMany: mocks.orderItemUpdateMany },
    deviceRegistry: { upsert: mocks.deviceRegistryUpsert },
    counter: { upsert: vi.fn() },
    $transaction: mocks.transaction,
  },
  createAuditLog: vi.fn(async () => ({})),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.checkRateLimit,
  getClientIp: vi.fn(() => '1.2.3.4'),
  PUBLIC_MENU_LIMIT: { maxRequests: 30, windowMs: 60000 },
  KIOSK_LIMIT: { maxRequests: 10, windowMs: 60000 },
}))

vi.mock('@/lib/rate-limit/response', () => ({
  rateLimitedResponse: vi.fn(() => new Response(JSON.stringify({ error: 'Preveč zahtevkov' }), { status: 429 })),
}))

vi.mock('@/lib/counters', () => ({
  getNextOrderNumber: mocks.getNextOrderNumber,
  getNextCounter: mocks.getNextCounter,
  resolveDefaultLocationId: vi.fn(),
}))

vi.mock('@/lib/api-utils', () => ({
  parseJsonBody: mocks.parseJsonBody,
  handleApiError: vi.fn(() => new Response(JSON.stringify({ error: 'Napaka' }), { status: 500 })),
}))

vi.mock('@/lib/decimal', () => ({
  toNum: vi.fn((v: unknown) => (typeof v === 'object' && v !== null && 'toNumber' in (v as object) ? (v as { toNumber: () => number }).toNumber() : Number(v ?? 0))),
}))

vi.mock('@/lib/safe-format', () => ({
  formatEUR: vi.fn((v: string) => `${v} €`),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/availability/menu-availability', () => ({
  computeMenuStockMap: mocks.computeMenuStockMap,
}))

vi.mock('@/lib/ordering-token', () => ({
  verifyOrderingToken: mocks.verifyOrderingToken,
  isOrderingSecretConfigured: mocks.isOrderingSecretConfigured,
}))

vi.mock('@/app/api/public/order/_helpers', () => ({
  isRestaurantOpen: mocks.kioskIsOpen,
  deductInventoryInTx: mocks.deductInventoryInTx,
  MAX_ORDER_TOTAL: 2000,
}))

vi.mock('@/app/api/orders/_helpers/order-items', () => ({
  buildOrderItemsData: mocks.buildOrderItemsData,
  calculateOrderTotals: mocks.calculateOrderTotals,
  fetchModifierPriceMap: mocks.fetchModifierPriceMap,
}))

// Route imports (PO mockih)
import { GET as kioskGET, POST as kioskPOST } from '@/app/api/public/kiosk/route'

const LOC = 'locKioskA'
const TOKEN = 'v1:0:abc123def'

function makeBody(over: Record<string, unknown> = {}) {
  return {
    orderItems: [{ menuItemId: 'mi-1', quantity: 2, notes: '' }],
    diningOption: 'takeout',
    paymentMethod: 'card',
    orderingToken: TOKEN,
    ...over,
  }
}

function makeReq(body: Record<string, unknown>, query = `?locationId=${LOC}`) {
  return new Request(`http://x/api/public/kiosk${query}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const MENU_ITEM = {
  id: 'mi-1', name: 'Kava', price: 2, vatRate: 22,
  recipeItems: [{ quantityPerServing: 0.018, yieldPercent: null, inventoryItem: { id: 'inv-1', quantity: 100, costPerUnit: 8, unit: 'kg' } }],
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.checkRateLimit.mockResolvedValue({ allowed: true, retryAfterMs: 60000 })
  mocks.parseJsonBody.mockImplementation(async (req: Request) => ({ data: await req.json(), error: null }))
  mocks.locationFindFirst.mockResolvedValue({ id: LOC, tokenVersion: 0 })
  mocks.verifyOrderingToken.mockReturnValue(true)
  mocks.isOrderingSecretConfigured.mockReturnValue(true)
  mocks.kioskIsOpen.mockResolvedValue(true)
  mocks.menuItemFindMany.mockResolvedValue([MENU_ITEM])
  mocks.computeMenuStockMap.mockResolvedValue({})
  mocks.fetchModifierPriceMap.mockResolvedValue(new Map())
  mocks.buildOrderItemsData.mockReturnValue({
    orderItemsData: [{ menuItemId: 'mi-1', quantity: 2, unitPrice: 2, totalPrice: 4, vatRate: 22, modifiers: '[]' }],
    subtotal: 4,
  })
  mocks.calculateOrderTotals.mockReturnValue({ totalTax: 0.88, total: 4.88 })
  mocks.getNextOrderNumber.mockResolvedValue(7)
  mocks.getNextCounter.mockResolvedValue(5)
  mocks.orderFindFirst.mockResolvedValue(null)
  mocks.orderCreate.mockResolvedValue({ id: 'ord-1', orderNumber: 7, total: 4.88, orderItems: [{ id: 'oi-1' }, { id: 'oi-2' }] })
  mocks.checkCreate.mockResolvedValue({ id: 'chk-1' })
  mocks.paymentCreate.mockResolvedValue({ id: 'pay-1' })
  mocks.orderItemUpdateMany.mockResolvedValue({ count: 2 })
  mocks.orderUpdate.mockResolvedValue({})
  mocks.deductInventoryInTx.mockResolvedValue(undefined)
  mocks.deviceRegistryUpsert.mockResolvedValue({})
  mocks.transaction.mockImplementation(async (fn: (tx: object) => unknown) => fn({
    txMarker: 'tx-client',
    order: { create: mocks.orderCreate, update: mocks.orderUpdate },
    check: { create: mocks.checkCreate },
    payment: { create: mocks.paymentCreate },
    orderItem: { updateMany: mocks.orderItemUpdateMany },
  }))
})

// ─── 1. Plačilna semantika ───
describe('R135: plačilna semantika (Check + Payment kanon)', () => {
  it('kartica → 201 + Check unpaid/card + Payment pending/card + order.paymentMethod "kartica" + checkId link', async () => {
    const res = await kioskPOST(makeReq(makeBody()))
    expect(res.status).toBe(201)
    // order.create v transakciji: paymentMethod ZDAJ persistiran (prej Vedno '')
    expect(mocks.orderCreate.mock.calls[0][0].data.paymentMethod).toBe('kartica')
    expect(mocks.orderCreate.mock.calls[0][0].data.paymentStatus).toBe('unpaid')
    // Check: checkNumber iz counterja, unpaid, card, zneski iz kanoničnega izračuna
    const checkData = mocks.checkCreate.mock.calls[0][0].data
    expect(checkData.checkNumber).toBe(5)
    expect(checkData.orderId).toBe('ord-1')
    expect(checkData.paymentStatus).toBe('unpaid')
    expect(checkData.paymentMethod).toBe('card')
    expect(checkData.total).toBe(4.88)
    expect(checkData.tip).toBe(0)
    // Payment pending — SAMO za kartico
    expect(mocks.paymentCreate).toHaveBeenCalledWith({
      data: { checkId: 'chk-1', amount: 4.88, tipAmount: 0, type: 'card', status: 'pending' },
    })
    // orderItems povezani na ček
    expect(mocks.orderItemUpdateMany).toHaveBeenCalledWith({
      where: { orderId: 'ord-1' }, data: { checkId: 'chk-1' },
    })
    const body = await res.json() as { paymentMethod: string; orderNumber: number }
    expect(body.paymentMethod).toBe('kartica')
    expect(body.orderNumber).toBe(7)
  })

  it('gotovina → 201 + Check card/cash + BREZ Payment vrstice (plačilo pri blagajni) + paymentMethod "gotovina"', async () => {
    const res = await kioskPOST(makeReq(makeBody({ paymentMethod: 'cash' })))
    expect(res.status).toBe(201)
    expect(mocks.orderCreate.mock.calls[0][0].data.paymentMethod).toBe('gotovina')
    expect(mocks.checkCreate.mock.calls[0][0].data.paymentMethod).toBe('cash')
    // gotovina = brez Payment vrstice (isti kanon kot online-order)
    expect(mocks.paymentCreate).not.toHaveBeenCalled()
    const body = await res.json() as { paymentMethod: string }
    expect(body.paymentMethod).toBe('gotovina')
  })
})

// ─── 2. Odbitek zaloge v transakciji ───
describe('R135: odbitek zaloge (inventoryDeducted kanon)', () => {
  it('deductInventoryInTx v transakciji z recipeItem mapo + inventoryDeducted: true', async () => {
    await kioskPOST(makeReq(makeBody()))
    // transakcija je bila odprta
    expect(mocks.transaction).toHaveBeenCalledTimes(1)
    // odbitek: (tx, items, menuItemMap, orderNumber) — map nosi recipeItems
    expect(mocks.deductInventoryInTx).toHaveBeenCalledTimes(1)
    const [tx, items, map, orderNumber] = mocks.deductInventoryInTx.mock.calls[0]
    expect(items).toEqual([{ menuItemId: 'mi-1', quantity: 2, notes: '' }])
    expect(map.get('mi-1')?.recipeItems).toHaveLength(1)
    expect(orderNumber).toBe(7)
    // isti tx klient je posredovan helperju (marker + metode)
    expect(tx).toMatchObject({ txMarker: 'tx-client' })
    // inventoryDeducted šele po odbitku
    expect(mocks.orderUpdate).toHaveBeenCalledWith({ where: { id: 'ord-1' }, data: { inventoryDeducted: true } })
  })
})

// ─── 3. Sold-out enforcement ───
describe('R135: sold-out enforcement na pisni poti (R124 kanon)', () => {
  it('izprodan artikel → 400 + unavailableItems + ZERO pisnih klicev (ni transakcije)', async () => {
    mocks.computeMenuStockMap.mockResolvedValue({ 'mi-1': { status: 'out', available: 0, unit: 'kg' } })
    const res = await kioskPOST(makeReq(makeBody()))
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string; unavailableItems: Array<{ menuItemId: string; name: string }> }
    expect(body.error).toBe('Nekateri artikli so žal izprodani')
    expect(body.unavailableItems).toEqual([{ menuItemId: 'mi-1', name: 'Kava' }])
    expect(mocks.orderCreate).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.getNextOrderNumber).not.toHaveBeenCalled()
  })

  it('nizka zaloga (low) je DOVOLJENA (isti kanon kot POS — opozorilo, ne zapora)', async () => {
    mocks.computeMenuStockMap.mockResolvedValue({ 'mi-1': { status: 'low', available: 2, unit: 'kg' } })
    const res = await kioskPOST(makeReq(makeBody()))
    expect(res.status).toBe(201)
    expect(mocks.transaction).toHaveBeenCalledTimes(1)
  })
})

// ─── 4. Gate odprtosti ───
describe('R135: gate odprtosti (fail-closed)', () => {
  it('zaprta restavracija → 403 PRED menu fetchem (zero item fetch, zero transakcij)', async () => {
    mocks.kioskIsOpen.mockResolvedValue(false)
    const res = await kioskPOST(makeReq(makeBody()))
    expect(res.status).toBe(403)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Restavracija je trenutno zaprta. Naročila niso mogoča.')
    expect(mocks.menuItemFindMany).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
    // isRestaurantOpen scoped na kiosk lokacijo
    expect(mocks.kioskIsOpen).toHaveBeenCalledWith(LOC)
  })
})

// ─── 5. MAX_ORDER_TOTAL ───
describe('R135: zgornja meja zneska (QR-02 kanon)', () => {
  it('total > 2000 € → 400 z razumljivim sporočilom + zero transakcij', async () => {
    mocks.calculateOrderTotals.mockReturnValue({ totalTax: 454.55, total: 2500 })
    const res = await kioskPOST(makeReq(makeBody()))
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toContain('maksimalni znesek')
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.getNextOrderNumber).not.toHaveBeenCalled()
  })
})

// ─── 6. Vezava naprave (DeviceRegistry) ───
describe('R135: device binding (DeviceRegistry upsert)', () => {
  it('deviceId → upsert type kiosk/status online/lastSeenAt + lokacija; naročilo uspe ne glede na to', async () => {
    const res = await kioskPOST(makeReq(makeBody({ deviceId: 'kiosk-tablet-1' })))
    expect(res.status).toBe(201)
    expect(mocks.deviceRegistryUpsert).toHaveBeenCalledTimes(1)
    const arg = mocks.deviceRegistryUpsert.mock.calls[0][0]
    expect(arg.where).toEqual({ deviceId: 'kiosk-tablet-1' })
    expect(arg.create.type).toBe('kiosk')
    expect(arg.create.status).toBe('online')
    expect(arg.create.locationId).toBe(LOC)
    expect(arg.create.lastSeenAt).toBeInstanceOf(Date)
    expect(arg.update.type).toBe('kiosk')
  })

  it('DeviceRegistry napaka je ne-blockirajoča — naročilo ostane 201', async () => {
    mocks.deviceRegistryUpsert.mockRejectedValue(new Error('registry down'))
    const res = await kioskPOST(makeReq(makeBody({ deviceId: 'kiosk-tablet-1' })))
    expect(res.status).toBe(201)
    const body = await res.json() as { success: boolean }
    expect(body.success).toBe(true)
  })
})

// ─── 7. Idempotent replay short-circuit ───
describe('R135: replay PRED counterjem/tranzakcijo', () => {
  it('obstoječ idempotencyKey → 200 replay + ZERO counterja + ZERO transakcije', async () => {
    mocks.orderFindFirst.mockResolvedValue({
      id: 'ord-0', orderNumber: 3, total: 4.88, orderItems: [{ id: 'oi-0' }],
    })
    const res = await kioskPOST(makeReq(makeBody({ idempotencyKey: 'k-1' })))
    expect(res.status).toBe(200)
    const body = await res.json() as { idempotentReplay: boolean; orderNumber: number }
    expect(body.idempotentReplay).toBe(true)
    expect(body.orderNumber).toBe(3)
    expect(mocks.getNextCounter).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.orderCreate).not.toHaveBeenCalled()
  })
})

// ─── 8. Token vezava + modifierji + GET select ───
describe('R135: token vezava, modifiersJson passthrough, GET modifierGroups', () => {
  it('verifyOrderingToken prejel (token, lokacija, tokenVersion iz lokacijskega zapisa)', async () => {
    mocks.locationFindFirst.mockResolvedValue({ id: LOC, tokenVersion: 4 })
    await kioskPOST(makeReq(makeBody()))
    expect(mocks.verifyOrderingToken).toHaveBeenCalledWith(TOKEN, LOC, 4)
  })

  it('modifiersJson iz telesa pride do buildOrderItemsData (izračun po BUG-13 kanonu)', async () => {
    const mods = JSON.stringify([{ name: 'Extra shot', price: 0.5 }])
    await kioskPOST(makeReq(makeBody({ orderItems: [{ menuItemId: 'mi-1', quantity: 1, notes: '', modifiersJson: mods }] })))
    const passed = mocks.buildOrderItemsData.mock.calls[0][0]
    expect(passed[0].modifiersJson).toBe(mods)
  })

  it('GET: menuItems select vsebuje modifierGroups (s modifierji + alergeni)', async () => {
    mocks.menuFindMany.mockResolvedValue([])
    const res = await kioskGET(new Request(`http://x/api/public/kiosk?locationId=${LOC}`))
    expect(res.status).toBe(200)
    const select = mocks.menuFindMany.mock.calls[0][0].include.categories.include.menuItems.select
    expect(select.modifierGroups).toBeDefined()
    expect(select.modifierGroups.select.modifierGroup.select.modifiers).toBeDefined()
    expect(select.modifierGroups.select.modifierGroup.select.required).toBe(true)
  })
})
