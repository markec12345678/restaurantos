// ============================================
// R83 — javne gost-rute + webhook-engine + employees stamp — regresijski testi
// ============================================
// R82-FINAL-2 sveže-oke audit je odkril naslednji val luknj. Ta fajl zaklene
// popravke (vsi fixi fail-closed, pogojni spread, brez { locationId: null }):
//   1. employees POST locationId stamp (produkt prioriteta #1 — novi staff
//      lockout na fail-closed gate-ih)
//   2. public/order-track — PRAZEN-TELEFON bypass (endsWith('') = true) +
//      izbirna lokacijska vezava orderNumber lookupa
//   3. public/kiosk — GET globalni meni → scoped; POST lokacija PRED item
//      fetchom (category.menu.locationId); idempotency replay scoped
//   4. webhook-engine trigger — brez locationId SAMO globalni webhook-i
//      (prej: komentar "samo globalni" ≠ koda { isActive: true })
//   5. wallet-payment — GET/stats scope prek checkIds (brez relacije dvokoračno)
//      + POST checkId ownership
//   6. isRestaurantOpen(locationId) — urnik TOČNO TE lokacije (prej globalni mix)
//   7. feedback-public — GuestFeedback.locationId stamp (prej vedno NULL)
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  validateRequest: vi.fn(),
  parseJsonBody: vi.fn(),
  checkRateLimit: vi.fn(),
  employeeFindUnique: vi.fn(),
  employeeFindMany: vi.fn(),
  employeeCreate: vi.fn(),
  employeeJobCreate: vi.fn(),
  locationFindUnique: vi.fn(),
  locationFindFirst: vi.fn(),
  orderFindMany: vi.fn(),
  orderFindFirst: vi.fn(),
  orderCreate: vi.fn(),
  menuFindMany: vi.fn(),
  menuItemFindMany: vi.fn(),
  webhookFindMany: vi.fn(),
  webhookCreate: vi.fn(),
  webhookDeliveryCreate: vi.fn(),
  webhookDeliveryUpdate: vi.fn(),
  webhookUpdate: vi.fn(),
  restaurantSettingsFindFirst: vi.fn(),
  checkFindMany: vi.fn(),
  checkFindUnique: vi.fn(),
  checkFindFirst: vi.fn(),
  walletPaymentFindMany: vi.fn(),
  walletPaymentGroupBy: vi.fn(),
  walletPaymentAggregate: vi.fn(),
  walletPaymentCreate: vi.fn(),
  tableFindFirst: vi.fn(),
  tableFindUnique: vi.fn(),
  tableUpdate: vi.fn(),
  openingHoursFindMany: vi.fn(),
  guestFeedbackCreate: vi.fn(),
  getNextOrderNumber: vi.fn(),
  resolveDefaultLocationId: vi.fn(),
  deliverWebhook: vi.fn(),
  // R135 (P1-11): kiosk POST kanoni — token, sold-out, plačilo, zaloga
  getNextCounter: vi.fn(),
  checkCreate: vi.fn(),
  paymentCreate: vi.fn(),
  orderItemUpdateMany: vi.fn(),
  orderUpdate: vi.fn(),
  kioskStockMap: vi.fn(),
  kioskVerifyToken: vi.fn(),
  kioskSecretConfigured: vi.fn(),
  kioskIsOpen: vi.fn(),
  kioskDeductInventory: vi.fn(),
}))

vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: mocks.requireAuth,
  // R83: testni resolver z ISTIMI semantikami kot lib/tenant-scope.ts —
  // non-admin brez lokacije → fail-closed 403; admin brez lokacije → global (null);
  // admin z ?locationId= → override.
  resolveTenantLocationIdOrThrow: (session: { locationId?: string | null; role?: string } | null | undefined, searchParams?: URLSearchParams, _opts?: { endpoint?: string }) => {
    const role = session?.role ?? ''
    const adminish = role === 'admin' || role === 'super_admin'
    if (!session?.locationId && !adminish) {
      return { error: new Response(JSON.stringify({ error: 'Zahtevana je lokacija' }), { status: 403, headers: { 'content-type': 'application/json' } }) }
    }
    const q = searchParams?.get('locationId')
    if (q && adminish) return { locationId: q }
    return { locationId: session?.locationId ?? null }
  },
}))

vi.mock('@/lib/db', () => ({
  db: {
    employee: { findUnique: mocks.employeeFindUnique, findMany: mocks.employeeFindMany, create: mocks.employeeCreate },
    employeeJob: { create: mocks.employeeJobCreate },
    location: { findUnique: mocks.locationFindUnique, findFirst: mocks.locationFindFirst },
    order: { findMany: mocks.orderFindMany, findFirst: mocks.orderFindFirst, create: mocks.orderCreate, update: mocks.orderUpdate },
    payment: { create: mocks.paymentCreate },
    orderItem: { updateMany: mocks.orderItemUpdateMany },
    menu: { findMany: mocks.menuFindMany },
    menuItem: { findMany: mocks.menuItemFindMany },
    webhook: { findMany: mocks.webhookFindMany, create: mocks.webhookCreate },
    webhookDelivery: { create: mocks.webhookDeliveryCreate, update: mocks.webhookDeliveryUpdate },
    restaurantSettings: { findFirst: mocks.restaurantSettingsFindFirst },
    check: { findMany: mocks.checkFindMany, findFirst: mocks.checkFindFirst, findUnique: mocks.checkFindUnique, create: mocks.checkCreate },
    walletPayment: { findMany: mocks.walletPaymentFindMany, groupBy: mocks.walletPaymentGroupBy, aggregate: mocks.walletPaymentAggregate, create: mocks.walletPaymentCreate },
    openingHours: { findMany: mocks.openingHoursFindMany },
    table: { findFirst: mocks.tableFindFirst, findUnique: mocks.tableFindUnique, update: mocks.tableUpdate },
    guestFeedback: { create: mocks.guestFeedbackCreate },
    // R135: transakcijski tx klient — order.create usmerjen v isti trak,
    // ostale tx operacije (check/payment/orderItem) dobijo lastne trake
    $transaction: vi.fn(async (fn: (tx: object) => unknown) => fn({
      order: { create: mocks.orderCreate, update: mocks.orderUpdate },
      check: { create: mocks.checkCreate },
      payment: { create: mocks.paymentCreate },
      orderItem: { updateMany: mocks.orderItemUpdateMany },
    })),
  },
  createAuditLog: vi.fn(async () => ({})),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.checkRateLimit.mockResolvedValue({ allowed: true }),
  getClientIp: vi.fn(() => '1.2.3.4'),
  AUTHENTICATED_LIMIT: { maxRequests: 120, windowMs: 60000 },
  PUBLIC_MENU_LIMIT: { maxRequests: 30, windowMs: 60000 },
  KIOSK_LIMIT: { maxRequests: 10, windowMs: 60000 },
  PUBLIC_ORDER_LIMIT: { maxRequests: 5, windowMs: 60000 },
  ORDER_TRACK_LIMIT: { maxRequests: 20, windowMs: 60000 },
  FEEDBACK_PUBLIC_LIMIT: { maxRequests: 5, windowMs: 60000 },
  GENERAL_PUBLIC_LIMIT: { maxRequests: 20, windowMs: 60000 },
  SETUP_LIMIT: { maxRequests: 5, windowMs: 900000 },
}))

vi.mock('@/lib/outbox', () => ({
  createOutboxEvent: vi.fn(async () => ({})),
}))

vi.mock('@/lib/api-utils', () => ({
  validateRequest: mocks.validateRequest,
  parseJsonBody: mocks.parseJsonBody,
  handleApiError: vi.fn((err: unknown, ctx?: string) => {
    void err; void ctx
    return new Response(JSON.stringify({ error: 'Napaka' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }),
  parsePaginationParams: vi.fn(() => ({ limit: 50, offset: 0, search: '' })),
  endOfDayParam: vi.fn(() => new Date()),
}))

vi.mock('@/lib/pin-lookup', () => ({
  hashPinLookup: vi.fn(() => 'hmac-lookup'),
  pinLookupEnabled: vi.fn(() => true),
}))

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn(async () => 'bcrypt-hashed'), compare: vi.fn(async () => false) },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/decimal', () => ({
  toNum: vi.fn((v: unknown) => (typeof v === 'object' && v !== null && 'toNumber' in (v as object) ? (v as { toNumber: () => number }).toNumber() : Number(v ?? 0))),
}))

vi.mock('@/lib/safe-format', () => ({
  formatEUR: vi.fn((v: string) => `${v} €`),
}))

vi.mock('@/lib/counters', () => ({
  getNextOrderNumber: mocks.getNextOrderNumber,
  resolveDefaultLocationId: mocks.resolveDefaultLocationId,
  getNextCounter: mocks.getNextCounter,
}))

// R135 (P1-11): kiosk POST je token-bound + sold-out gate + odbitek zaloge.
// BARREL '@/app/api/public/order/_helpers' je mockan SAMO za kiosk ruto —
// r83 testi isRestaurantOpen izhajajo iz neposredne poti '.../_helpers/table'
// (druga enota v grafu, ostane realna). computeMenuStockMap mockan (R124 mapa).
vi.mock('@/lib/availability/menu-availability', () => ({
  computeMenuStockMap: mocks.kioskStockMap,
}))
vi.mock('@/lib/ordering-token', () => ({
  verifyOrderingToken: mocks.kioskVerifyToken,
  isOrderingSecretConfigured: mocks.kioskSecretConfigured,
}))
vi.mock('@/app/api/public/order/_helpers', () => ({
  isRestaurantOpen: mocks.kioskIsOpen,
  deductInventoryInTx: mocks.kioskDeductInventory,
  MAX_ORDER_TOTAL: 2000,
}))

vi.mock('@/app/api/orders/_helpers/order-items', () => ({
  buildOrderItemsData: vi.fn(() => ({
    orderItemsData: [{ menuItemId: 'mi-1', quantity: 1, unitPrice: 2, totalPrice: 2, vatRate: 22, modifiers: '[]', menuItemName: 'Kava' }],
    subtotal: 2,
  })),
  calculateOrderTotals: vi.fn(() => ({ totalTax: 0.44, total: 2.44 })),
  fetchModifierPriceMap: vi.fn(async () => new Map()),
}))

vi.mock('@/lib/webhook-engine/signing', () => ({
  signPayload: vi.fn(() => 'sig'),
}))

vi.mock('@/lib/webhook-engine/delivery/deliver', () => ({
  deliverWebhook: mocks.deliverWebhook,
}))

vi.mock('@/lib/webhook-engine/delivery/ssrf', () => ({
  isInternalUrl: vi.fn(() => false),
}))

vi.mock('@/lib/crypto/secrets', () => ({
  ensureDecrypted: vi.fn((v: string) => v),
}))

vi.mock('@/lib/json-fields', () => ({
  parseWebhookEvents: vi.fn((v: string) => {
    try { return JSON.parse(v || '[]') as string[] } catch { return [] as string[] }
  }),
}))

vi.mock('@/lib/secret-masks', () => ({
  maskWebhookSecret: vi.fn((wh: Record<string, unknown>) => wh),
}))

vi.mock('@/lib/prisma-column-fallback', () => ({
  withLocationColumnFallback: vi.fn(async (_key: string, fn: (withLoc: boolean) => unknown) => fn(true)),
}))

// Route imports (PO mockih)
import { POST as employeesPOST } from '@/app/api/employees/route'
import { NextResponse } from 'next/server'
import { GET as orderTrackGET } from '@/app/api/public/order-track/route'
import { GET as kioskGET, POST as kioskPOST } from '@/app/api/public/kiosk/route'
import { triggerWebhook } from '@/lib/webhook-engine/delivery/trigger'
import { GET as walletGET, POST as walletPOST } from '@/app/api/wallet-payment/route'
import { isRestaurantOpen, resolveTable } from '@/app/api/public/order/_helpers/table'
import { POST as feedbackPOST } from '@/app/api/feedback-public/route'
import { GET as webhooksGET, POST as webhooksPOST } from '@/app/api/webhooks/route'

function mockAuth(locationId: string | null, role = 'admin') {
  mocks.requireAuth.mockResolvedValue({
    session: { employeeId: 'emp-1', role, locationId, permissions: ['admin'] },
    error: null,
  })
}

function makeJsonReq(url: string, body: object) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const baseEmployeeBody = {
  name: 'Nov Zaposlen',
  email: 'nov@test.si',
  role: 'staff',
  status: 'active',
  pin: '482915',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.checkRateLimit.mockResolvedValue({ allowed: true })
  mocks.employeeCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'emp-new', ...data }))
  mocks.employeeFindUnique.mockResolvedValue(null)
  mocks.getNextOrderNumber.mockResolvedValue(7)
  mocks.deliverWebhook.mockResolvedValue({ success: true, statusCode: 200, responseBody: 'ok' })
  mocks.walletPaymentCreate.mockResolvedValue({ id: 'wp-1', status: 'pending', amount: 10, currency: 'EUR', walletType: 'apple_pay', checkId: 'ck-1' })
  // R135 defaults: token veljaven, odprto, zaloga OK, tranzakcijski traki mirni
  mocks.kioskVerifyToken.mockReturnValue(true)
  mocks.kioskSecretConfigured.mockReturnValue(true)
  mocks.kioskIsOpen.mockResolvedValue(true)
  mocks.kioskDeductInventory.mockResolvedValue(undefined)
  mocks.kioskStockMap.mockResolvedValue({})
  mocks.checkCreate.mockResolvedValue({ id: 'chk-1' })
  mocks.paymentCreate.mockResolvedValue({ id: 'pay-1' })
  mocks.orderItemUpdateMany.mockResolvedValue({ count: 1 })
  mocks.orderUpdate.mockResolvedValue({})
  mocks.getNextCounter.mockResolvedValue(5)
})

// ============================================
// 1) employees POST — locationId stamp (produkt prioriteta #1)
// ============================================
describe('R83: employees POST locationId stamp', () => {
  it('lokacijski admin → nov zaposleni DOBI lokacijo seje (body.locationId ignoriran)', async () => {
    mockAuth('loc-1', 'admin')
    mocks.validateRequest.mockResolvedValue({
      data: { ...baseEmployeeBody, locationId: 'loc-OTHER' },
      error: null,
    })

    const res = await employeesPOST(makeJsonReq('http://x/api/employees', baseEmployeeBody))
    expect(res.status).toBe(201)
    const createArg = mocks.employeeCreate.mock.calls[0][0].data
    expect(createArg.locationId).toBe('loc-1')
  })

  it('platform admin (brez lokacije) + veljaven body.locationId → zapis na to lokacijo', async () => {
    mockAuth(null, 'super_admin')
    mocks.validateRequest.mockResolvedValue({ data: { ...baseEmployeeBody, locationId: 'loc-9' }, error: null })
    mocks.locationFindUnique.mockResolvedValue({ id: 'loc-9' })

    const res = await employeesPOST(makeJsonReq('http://x/api/employees', baseEmployeeBody))
    expect(res.status).toBe(201)
    expect(mocks.locationFindUnique).toHaveBeenCalledWith({ where: { id: 'loc-9' }, select: { id: true } })
    expect(mocks.employeeCreate.mock.calls[0][0].data.locationId).toBe('loc-9')
  })

  it('platform admin + staff BREZ locationId → 400 (fail-closed, brez razbitih NULL računov)', async () => {
    mockAuth(null, 'super_admin')
    mocks.validateRequest.mockResolvedValue({ data: { ...baseEmployeeBody }, error: null })

    const res = await employeesPOST(makeJsonReq('http://x/api/employees', baseEmployeeBody))
    expect(res.status).toBe(400)
    expect(mocks.employeeCreate).not.toHaveBeenCalled()
  })

  it('platform admin + NEVELJAVEN body.locationId → 400', async () => {
    mockAuth(null, 'super_admin')
    mocks.validateRequest.mockResolvedValue({ data: { ...baseEmployeeBody, locationId: 'loc-gone' }, error: null })
    mocks.locationFindUnique.mockResolvedValue(null)

    const res = await employeesPOST(makeJsonReq('http://x/api/employees', baseEmployeeBody))
    expect(res.status).toBe(400)
    expect(mocks.employeeCreate).not.toHaveBeenCalled()
  })

  it('platform admin + role admin brez lokacije → platformni račun (brez locationId ključa)', async () => {
    mockAuth(null, 'super_admin')
    mocks.validateRequest.mockResolvedValue({ data: { ...baseEmployeeBody, role: 'admin' }, error: null })

    const res = await employeesPOST(makeJsonReq('http://x/api/employees', baseEmployeeBody))
    expect(res.status).toBe(201)
    const createArg = mocks.employeeCreate.mock.calls[0][0].data
    expect('locationId' in createArg).toBe(false)
  })
})

// ============================================
// 2) public/order-track — prazen-telefon bypass + lokacijska vezava
// ============================================
const trackOrder = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'orduuid1234567890123456789',
  orderNumber: 5,
  status: 'pending',
  type: 'dine-in',
  customerName: 'Janez Novak',
  customerPhone: '040123456',
  subtotal: 10, tax: 2.2, total: 12.2,
  createdAt: new Date(), updatedAt: new Date(), cancelledAt: null,
  orderItems: [{ menuItem: { name: 'Kava' }, quantity: 1, notes: '' }],
  deliveryInfo: null,
  diningOption: null,
  ...over,
})

describe('R83: public/order-track', () => {
  it('PRAZEN-TELEFON bypass zaprt: naročilo brez customerPhone → 403 (prej kateri koli telefon)', async () => {
    mocks.orderFindMany.mockResolvedValue([trackOrder({ customerPhone: null })])

    const res = await orderTrackGET(new Request('http://x/api/public/order-track?orderNumber=5&phone=9999'))

    expect(res.status).toBe(403)
  })

  it('pravilen telefon → 200 + PII', async () => {
    mocks.orderFindMany.mockResolvedValue([trackOrder()])

    const res = await orderTrackGET(new Request('http://x/api/public/order-track?orderNumber=5&phone=3456'))
    expect(res.status).toBe(200)
    const body = await res.json() as { order: { customerName?: string } }
    expect(body.order.customerName).toBe('Janez Novak')
  })

  it('napačen telefon → 403', async () => {
    mocks.orderFindMany.mockResolvedValue([trackOrder()])

    const res = await orderTrackGET(new Request('http://x/api/public/order-track?orderNumber=5&phone=0000'))
    expect(res.status).toBe(403)
  })

  it('?locationId= → findMany where vsebuje lokacijski filter', async () => {
    mocks.orderFindMany.mockResolvedValue([])

    await orderTrackGET(new Request('http://x/api/public/order-track?orderNumber=5&phone=3456&locationId=locabc123'))

    const where = mocks.orderFindMany.mock.calls[0][0].where
    expect(where.locationId).toBe('locabc123')
  })

  it('ne-numeričen telefon → 400 (prej sprejet kateri koli 4-znakski niz)', async () => {
    const res = await orderTrackGET(new Request('http://x/api/public/order-track?orderNumber=5&phone=abcd'))
    expect(res.status).toBe(400)
  })

  it('UUID pot brez telefona → PII NI v odgovoru', async () => {
    mocks.orderFindFirst.mockResolvedValue(trackOrder())
    mocks.orderFindMany.mockResolvedValue([trackOrder()])

    const res = await orderTrackGET(new Request('http://x/api/public/order-track?orderId=orduuid1234567890123456789'))
    expect(res.status).toBe(200)
    const body = await res.json() as { order: { customerName?: string; delivery?: { address?: string } | null } }
    expect(body.order.customerName).toBeUndefined()
    expect(body.order.delivery).toBeNull()
  })
})

// ============================================
// 3) public/kiosk — scope menija, artiklov in idempotency replaya
// ============================================
describe('R83: public/kiosk', () => {
  it('GET: ?locationId= → meni scoped na lokacijo (prej GLOBALNI meni vseh tenantov). R86-3: izrecna lokacija je zdaj POLNO validirana (obstaja + aktiven)', async () => {
    mocks.menuFindMany.mockResolvedValue([])
    // R86-3 (M4): izrecen ?locationId se validira prek location.findFirst({ id, isActive: true })
    mocks.locationFindFirst.mockResolvedValue({ id: 'locabc123' })

    const res = await kioskGET(new Request('http://x/api/public/kiosk?locationId=locabc123'))
    expect(res.status).toBe(200)

    // R86-3: validacija pinana — neznana/tuja/neaktivna lokacija NE vrne menija
    expect(mocks.locationFindFirst.mock.calls[0][0].where).toEqual({ id: 'locabc123', isActive: true })

    const where = mocks.menuFindMany.mock.calls[0][0].where
    expect(where.locationId).toBe('locabc123')
    expect(where.isActive).toBe(true)
  })

  it('GET: brez parametra → 404 notInScopeResponse + ZERO db (R90: read fallback izkoreninjen)', async () => {
    // R90 kanon: manjkajoč ?locationId se zavrne PRED vsakim db klicem —
    // prej resolveDefaultLocationId() (prva aktivna lokacija katerega koli
    // tenanta); stara 'Kiosk ni nastavljen' 400 pot za manjkajoč param je
    // odstranjena (POST jo še vedno proizvaja za pisno pot).
    const res = await kioskGET(new Request('http://x/api/public/kiosk'))
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Lokacija ni najden')
    expect(mocks.resolveDefaultLocationId).not.toHaveBeenCalled()
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
    expect(mocks.menuFindMany).not.toHaveBeenCalled()
  })

  it('POST: artikli scoped na category.menu.locationId (prej globalni fetch tujih artiklov). R86-3: ekspliciten kontekst je OBVEZEN (?locationId) + validiran — globalni fallback je odstranjen', async () => {
    // R86-3 (M4): POST prej VEDNO resolveDefaultLocationId() (prva aktivna
    // lokacija katerega koli tenanta). Zdaj: ekspliciten ?locationId +
    // validacija (obstaja + aktiven); brez konteksta → 400 fail-closed.
    mocks.locationFindFirst.mockResolvedValue({ id: 'lockiosk' })
    mocks.parseJsonBody.mockResolvedValue({ data: { orderItems: [{ menuItemId: 'mi-1', quantity: 1, notes: '' }], idempotencyKey: 'k-1', orderingToken: 'kiosk-token-123' }, error: null })
    mocks.menuItemFindMany.mockResolvedValue([{ id: 'mi-1', name: 'Kava', price: 2, vatRate: 22 }])
    mocks.orderFindFirst.mockResolvedValue(null)
    mocks.orderCreate.mockResolvedValue({ id: 'ord-9', orderNumber: 7, total: 2.44, orderItems: [{ id: 'oi-1' }] })

    const res = await kioskPOST(makeJsonReq('http://x/api/public/kiosk?locationId=lockiosk', { orderItems: [{ menuItemId: 'mi-1', quantity: 1 }] }))
    expect(res.status).toBe(201)

    // R86-3: validacija pinana (obstaja + aktiven) + fallback NIKOLI konsultiran
    expect(mocks.locationFindFirst.mock.calls[0][0].where).toEqual({ id: 'lockiosk', isActive: true })
    expect(mocks.resolveDefaultLocationId).not.toHaveBeenCalled()

    const where = mocks.menuItemFindMany.mock.calls[0][0].where
    expect(where.category).toEqual({ menu: { locationId: 'lockiosk' } })
  })

  it('POST: idempotency replay lookup je lokacijsko scoped (prej globalni @unique namespace). R86-3: ekspliciten ?locationId + validacija', async () => {
    mocks.locationFindFirst.mockResolvedValue({ id: 'lockiosk' })
    mocks.parseJsonBody.mockResolvedValue({ data: { orderItems: [{ menuItemId: 'mi-1', quantity: 1, notes: '' }], idempotencyKey: 'k-foreign', orderingToken: 'kiosk-token-123' }, error: null })
    mocks.menuItemFindMany.mockResolvedValue([{ id: 'mi-1', name: 'Kava', price: 2, vatRate: 22 }])
    // replay obstaja na TUJI lokaciji → scoped findFirst vrne null → NOVO naročilo
    mocks.orderFindFirst.mockResolvedValue(null)
    mocks.orderCreate.mockResolvedValue({ id: 'ord-10', orderNumber: 8, total: 2.44, orderItems: [{ id: 'oi-2' }] })

    const res = await kioskPOST(makeJsonReq('http://x/api/public/kiosk?locationId=lockiosk', { orderItems: [{ menuItemId: 'mi-1', quantity: 1 }], idempotencyKey: 'k-foreign' }))
    expect(res.status).toBe(201)

    const where = mocks.orderFindFirst.mock.calls[0][0].where
    expect(where.idempotencyKey).toBe('k-foreign')
    expect(where.locationId).toBe('lockiosk')
  })

  // R86-3 (M4): fail-closed regresija — brez lokacijskega konteksta NI več
  // globalnega fallbacka (prej: VEDNO prva aktivna lokacija katerega koli
  // tenanta = cross-tenant žig naročila).
  it('POST brez lokacijskega konteksta → 400 fail-closed + ZERO pisnih klicev (R86-3)', async () => {
    const res = await kioskPOST(makeJsonReq('http://x/api/public/kiosk', { orderItems: [{ menuItemId: 'mi-1', quantity: 1 }] }))
    expect(res.status).toBe(400)
    expect(mocks.resolveDefaultLocationId).not.toHaveBeenCalled()
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
    expect(mocks.menuItemFindMany).not.toHaveBeenCalled()
    expect(mocks.orderCreate).not.toHaveBeenCalled()
  })
})

// ============================================
// 4) webhook-engine trigger — brez locationId SAMO globalni webhook-i
// ============================================
describe('R83: webhook trigger — komentar ≠ koda fix', () => {
  it('brez locationId → SAMO globalni webhook-i (locationId: null), NE vsi tenanti', async () => {
    mocks.restaurantSettingsFindFirst.mockResolvedValue(null)
    mocks.webhookFindMany.mockResolvedValue([])

    await triggerWebhook('order.created', { orderId: 'o1' })

    const where = mocks.webhookFindMany.mock.calls[0][0].where
    expect(where).toEqual({ isActive: true, locationId: null })
  })

  it('z locationId → lokacijski + globalni (OR filter)', async () => {
    mocks.restaurantSettingsFindFirst.mockResolvedValue(null)
    mocks.webhookFindMany.mockResolvedValue([])

    await triggerWebhook('order.paid', { orderId: 'o1' }, 'loc-1')

    const where = mocks.webhookFindMany.mock.calls[0][0].where
    expect(where.OR).toEqual([{ locationId: 'loc-1' }, { locationId: null }])
  })
})

// ============================================
// 5) wallet-payment — GET/stats scope + POST checkId ownership
// R84 UPDATE: scope je sedaj ENOKORAČEN prek locationId stolpca (schema round
// R84-2) — checkIds dvokoračni scope (take 10000) je ODSTRANJEN. Regresija
// pina novo vedenje; lib nivo v tests/unit/security/r84-wallet-outbox-location.
// ============================================
describe('R83/R84: wallet-payment scope', () => {
  it('GET: lokacijski uporabnik → where.locationId DIREKTNO (enokoračno, brez checkIds)', async () => {
    mockAuth('loc-1', 'admin')
    mocks.walletPaymentFindMany.mockResolvedValue([])

    await walletGET(new Request('http://x/api/wallet-payment'))

    // R84: checkIds dvokoračna poizvedba je ukinjena
    expect(mocks.checkFindMany).not.toHaveBeenCalled()
    const where = mocks.walletPaymentFindMany.mock.calls[0][0].where
    expect(where.locationId).toBe('loc-1')
    expect('checkId' in where).toBe(false)
  })

  it('GET stats=1: lokacijski uporabnik → stats prejme locationId (enokoračno)', async () => {
    mockAuth('loc-1', 'admin')
    mocks.walletPaymentGroupBy.mockResolvedValue([])
    mocks.walletPaymentAggregate.mockResolvedValue({ _count: { id: 0 }, _sum: { amount: null, refundedAmount: null } })

    await walletGET(new Request('http://x/api/wallet-payment?stats=1'))

    // R84: stats gre prek lib getWalletPaymentStats(from, to, locationId) —
    // enokoračni scope: NO checkIds, where.locationId direktno na groupBy/aggregate
    expect(mocks.checkFindMany).not.toHaveBeenCalled()
    expect(mocks.walletPaymentAggregate.mock.calls[0][0].where.locationId).toBe('loc-1')
  })

  it('GET: super-admin → brez locationId filtra (globalni pogled)', async () => {
    mockAuth(null, 'super_admin')
    mocks.walletPaymentFindMany.mockResolvedValue([])

    await walletGET(new Request('http://x/api/wallet-payment'))

    expect(mocks.checkFindMany).not.toHaveBeenCalled()
    const where = mocks.walletPaymentFindMany.mock.calls[0][0].where
    expect('locationId' in where).toBe(false)
  })

  it('POST: tuj checkId → 404 (prej RAW zapis brez preverjanja)', async () => {
    mockAuth('loc-1', 'admin')
    mocks.checkFindFirst.mockResolvedValue(null)

    const res = await walletPOST(makeJsonReq('http://x/api/wallet-payment', {
      walletType: 'apple_pay',
      amount: 10,
      paymentToken: 'tok-1234567890',
      checkId: 'ck-foreign',
    }))

    expect(res.status).toBe(404)
  })

  it('POST: lasten checkId → preide na initiate (locationId izpeljan iz čeka)', async () => {
    mockAuth('loc-1', 'admin')
    mocks.checkFindFirst.mockImplementation(async ({ where }: { where: { id?: string; order?: { locationId?: string } } }) =>
      where.id === 'ck-1' && where.order?.locationId === 'loc-1' ? { id: 'ck-1' } : null)
    // R84: initiate lib izpelje locationId prek check.findUnique
    mocks.checkFindUnique.mockResolvedValue({ order: { locationId: 'loc-1' } })

    const res = await walletPOST(makeJsonReq('http://x/api/wallet-payment', {
      walletType: 'apple_pay',
      amount: 10,
      paymentToken: 'tok-1234567890',
      checkId: 'ck-1',
    }))

    expect(res.status).toBe(201)
    // R84: WalletPayment je stampiran z izpeljano lokacijo čeka
    expect(mocks.walletPaymentCreate.mock.calls[0][0].data.locationId).toBe('loc-1')
  })
})

// ============================================
// 6) isRestaurantOpen — urnik TOČNO TE lokacije
// ============================================
describe('R83: isRestaurantOpen(locationId)', () => {
  it('brez locationId → false (fail-closed), DB NE klican', async () => {
    const result = await isRestaurantOpen()
    expect(result).toBe(false)
    expect(mocks.openingHoursFindMany).not.toHaveBeenCalled()
  })

  it('z locationId → findMany scoped', async () => {
    mocks.openingHoursFindMany.mockResolvedValue([])

    const result = await isRestaurantOpen('loc-1')

    expect(result).toBe(false) // prazen urnik → zaprto
    expect(mocks.openingHoursFindMany).toHaveBeenCalledWith({ where: { locationId: 'loc-1' } })
  })

  it('odprt urnik danes → true (samo lokacijski vnosi)', async () => {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Ljubljana' }))
    const dayOfWeek = now.getDay()
    const cur = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    mocks.openingHoursFindMany.mockResolvedValue([
      { dayOfWeek, isClosed: false, openTime: '00:00', closeTime: '23:59', breakStart: null, breakEnd: null },
    ])

    const result = await isRestaurantOpen('loc-1')

    // currentTime je znotraj 00:00–23:59 (razen natanko 23:59) — robustno:
    expect(mocks.openingHoursFindMany).toHaveBeenCalledWith({ where: { locationId: 'loc-1' } })
    expect(result).toBe(cur <= '23:59')
  })
})

// ============================================
// 7) resolveTable — tableNumber lokacijska disambiguacija
// ============================================
describe('R83: resolveTable tableNumber scope', () => {
  it('tableNumber + locationId → findFirst scoped na lokacijo', async () => {
    mocks.tableFindFirst.mockResolvedValue({ id: 'tbl-1', number: 5, status: 'available', locationId: 'loc-1' })
    mocks.tableUpdate.mockResolvedValue({})

    const result = await resolveTable(undefined, '5', 'loc-1')

    expect(mocks.tableFindFirst).toHaveBeenCalledWith({ where: { number: 5, locationId: 'loc-1' } })
    expect(result).toMatchObject({ tableId: 'tbl-1', tableNumber: 5 })
  })

  it('tableNumber BREZ locationId → 400 fail-closed (R84 M2: prej globalni findFirst — prvi tenant z mizo št. N je dobil tuje naročilo)', async () => {
    mocks.tableFindFirst.mockResolvedValue({ id: 'tbl-1', number: 5, status: 'available', locationId: 'loc-1' })
    mocks.tableUpdate.mockResolvedValue({})

    const result = await resolveTable(undefined, '5')

    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(400)
    // R84: NI več DB poizvedbe brez lokacijskega konteksta
    expect(mocks.tableFindFirst).not.toHaveBeenCalled()
    expect(mocks.tableUpdate).not.toHaveBeenCalled()
  })
})

// ============================================
// 8) feedback-public — GuestFeedback.locationId stamp
// ============================================
describe('R83: feedback-public locationId stamp', () => {
  const fbBody = {
    ratings: { food: 5, service: 4 },
    comment: 'Odlično',
    quickFeedback: [],
    source: 'qr_kiosk',
  }

  it('veljaven locationId → zapis na GuestFeedback (prej VEDNO NULL)', async () => {
    mocks.validateRequest.mockResolvedValue({ data: { ...fbBody, locationId: 'loc-1' }, error: null })
    mocks.locationFindUnique.mockResolvedValue({ id: 'loc-1' })

    const res = await feedbackPOST(makeJsonReq('http://x/api/feedback-public', fbBody))
    expect(res.status).toBe(201)

    const createArg = mocks.guestFeedbackCreate.mock.calls[0][0].data
    expect(createArg.locationId).toBe('loc-1')
  })

  it('neveljaven locationId → zapis BREZ locationId ključa (pogojni spread)', async () => {
    mocks.validateRequest.mockResolvedValue({ data: { ...fbBody, locationId: 'loc-gone' }, error: null })
    mocks.locationFindUnique.mockResolvedValue(null)

    const res = await feedbackPOST(makeJsonReq('http://x/api/feedback-public', fbBody))
    expect(res.status).toBe(201)

    const createArg = mocks.guestFeedbackCreate.mock.calls[0][0].data
    expect('locationId' in createArg).toBe(false)
  })
})

// ============================================
// 9) webhooks POST/GET — locationId stamp + tenant scope (R83-FIX, HIGH iz FINAL-2)
// ============================================
describe('R83-FIX: webhooks locationId stamp + scope', () => {
  const whBody = { name: 'Integracija', url: 'https://example.com/hook', events: '["order.paid"]', isActive: true, secret: '' }

  it('POST: lokacijski admin → webhook vezan na NJEGOVO lokacijo (prej GLOBALEN)', async () => {
    mockAuth('loc-1', 'admin')
    mocks.validateRequest.mockResolvedValue({ data: whBody, error: null })
    mocks.webhookCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'wh-1', ...data }))

    const res = await webhooksPOST(makeJsonReq('http://x/api/webhooks', whBody))
    expect(res.status).toBe(201)

    const createArg = mocks.webhookCreate.mock.calls[0][0].data
    expect(createArg.locationId).toBe('loc-1')
  })

  it('POST: platform admin brez locationId → globalni webhook (pooblaščen, brez ključa)', async () => {
    mockAuth(null, 'admin')
    mocks.validateRequest.mockResolvedValue({ data: whBody, error: null })
    mocks.webhookCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'wh-2', ...data }))

    const res = await webhooksPOST(makeJsonReq('http://x/api/webhooks', whBody))
    expect(res.status).toBe(201)

    const createArg = mocks.webhookCreate.mock.calls[0][0].data
    expect('locationId' in createArg).toBe(false)
  })

  it('GET: lokacijski admin → where.locationId scope (prej VSI tenanti)', async () => {
    mockAuth('loc-1', 'admin')
    mocks.webhookFindMany.mockResolvedValue([])

    await webhooksGET(new Request('http://x/api/webhooks'))

    const where = mocks.webhookFindMany.mock.calls[0][0].where
    expect(where.locationId).toBe('loc-1')
  })

  it('GET: super-admin → globalni pogled (brez locationId filtra)', async () => {
    mockAuth(null, 'super_admin')
    mocks.webhookFindMany.mockResolvedValue([])

    await webhooksGET(new Request('http://x/api/webhooks'))

    const where = mocks.webhookFindMany.mock.calls[0][0].where
    expect('locationId' in where).toBe(false)
  })
})
