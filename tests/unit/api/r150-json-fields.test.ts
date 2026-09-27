// ============================================
// R150 (repo issue #33 "JSON-as-String") — trap-DB uniti za JSONB + wire kanon
// ============================================
// KONTRAKT RUNDE (worklog R150-a — vezljiv): po migraciji 0022_json_fields je
// DB oblika 25 stolpcev NATIVNI Json (JSONB), WIRE format API-jev pa se NE
// spremeni — endpointi še naprej SPREJEMAJO in VRAČAJO JSON STRINGE
// (zero-oracle/byte-identical kanon). Ta fajl pina OBE strani kanona:
//   A. WIRE-SHAPE GUARDS — GET endpointi, katerih trap-DB vrstice nosijo
//      NATIVNE Json vrednosti, vračajo polja kot JSON STRINGE
//      (typeof === 'string' + JSON.parse round-trip).
//   B. TOLERANTNA BRANJA — malformed legacy vrednosti v db vrsticah NIKOLI
//      ne sprožijo 500 (string passthrough / parse fallback).
//   C. WRITERJI — POST/PUT s JSON-string wire zapiše NATIVNO vrednost
//      (parsePermissions / parseIntegrationConfig / parseAllergens /
//      parseStringArray poti); wire string na odgovoru (toJsonWire).
//   D. DUAL-WRITE — orders POST: legacy modifiersJson STRING (nespremenjen)
//      + OrderItemModifier join vrstice v ISTI transakciji; helper sprejme
//      tudi native-array vhod (toleranten) + bogus FK → NULL group.
//   E. QUERYABILITY — staff-performance data-fetch where =
//      orderItems: { some: { orderItemModifiers: { some: {} } } } (join-exists).
//   F. RECEIPTS/REBUILD — vatBreakdown update payload je NATIVNI object.
//   G. REGISTRY — getJsonFieldStats + JSON_FIELDS brez drifta (25 migrated,
//      zastareli vnosi odstranjeni, DEFER stolpci nemigrirani).
// Vzorec: vi.hoisted + vi.mock('@/lib/db') trap-DB (r146 kanon); requireAuth
// mockan na meji (importOriginal spread), tenant resolverji REALNI iz
// '@/lib/tenant-scope'; api-utils REAL (Zod wire sheme se aplicirajo);
// rate-limit mockan brez novih bucketov (zero mock churn, R148 lekcija 4).
// ============================================
import { describe, it, expect, beforeEach, vi } from 'vitest'

const LOC = 'loc-r150-a'

const mocks = vi.hoisted(() => ({
  // infra
  requireAuth: vi.fn(),
  checkRateLimitAsync: vi.fn(),
  transaction: vi.fn(),
  // jobs
  jobFindMany: vi.fn(),
  jobCreate: vi.fn(),
  // integrations
  integrationFindMany: vi.fn(),
  integrationCreate: vi.fn(),
  // guests
  guestFindMany: vi.fn(),
  guestCount: vi.fn(),
  guestCreate: vi.fn(),
  // happy-hour
  happyHourScheduleFindMany: vi.fn(),
  // configuration (12 tab)
  taxRateFindMany: vi.fn(),
  diningOptionFindMany: vi.fn(),
  revenueCenterFindMany: vi.fn(),
  salesCategoryFindMany: vi.fn(),
  priceGroupFindMany: vi.fn(),
  serviceChargeFindMany: vi.fn(),
  prepStationFindMany: vi.fn(),
  voidReasonFindMany: vi.fn(),
  noSaleReasonFindMany: vi.fn(),
  alternatePaymentTypeFindMany: vi.fn(),
  printerFindMany: vi.fn(),
  discountFindMany: vi.fn(),
  // webhooks / kot / settings / zones / suppliers
  webhookFindMany: vi.fn(),
  kotDocumentFindMany: vi.fn(),
  settingsFindFirst: vi.fn(),
  settingsCreate: vi.fn(),
  settingsUpdate: vi.fn(),
  deliveryZoneFindMany: vi.fn(),
  supplierFindMany: vi.fn(),
  supplierCount: vi.fn(),
  // orders dual-write
  orderFindFirst: vi.fn(),
  menuItemFindMany: vi.fn(),
  employeeFindUnique: vi.fn(),
  txOrderCreate: vi.fn(),
  txOrderItemModifierCreateMany: vi.fn(),
  getNextOrderNumber: vi.fn(),
  checkStockAvailability: vi.fn(),
  handleStockDeduction: vi.fn(),
  handlePostCreationEffects: vi.fn(),
  buildOrderItemsData: vi.fn(),
  calculateOrderTotals: vi.fn(),
  fetchModifierPriceMap: vi.fn(),
  // receipts/rebuild
  receiptFindMany: vi.fn(),
  receiptUpdate: vi.fn(),
  rebuildOrderFindUnique: vi.fn(),
  // staff-performance data-fetch
  spEmployeeFindMany: vi.fn(),
  spOrderGroupBy: vi.fn(),
  spPaymentGroupBy: vi.fn(),
  spStaffShiftGroupBy: vi.fn(),
  spTimeEntryGroupBy: vi.fn(),
  spOrderFindMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    job: { findMany: mocks.jobFindMany, create: mocks.jobCreate },
    integration: { findMany: mocks.integrationFindMany, create: mocks.integrationCreate },
    location: { findFirst: vi.fn(), findUnique: vi.fn() },
    guest: { findMany: mocks.guestFindMany, count: mocks.guestCount, create: mocks.guestCreate },
    happyHourSchedule: { findMany: mocks.happyHourScheduleFindMany },
    taxRate: { findMany: mocks.taxRateFindMany },
    diningOption: { findMany: mocks.diningOptionFindMany, findFirst: vi.fn() },
    revenueCenter: { findMany: mocks.revenueCenterFindMany, findFirst: vi.fn() },
    salesCategory: { findMany: mocks.salesCategoryFindMany },
    priceGroup: { findMany: mocks.priceGroupFindMany },
    serviceCharge: { findMany: mocks.serviceChargeFindMany },
    prepStation: { findMany: mocks.prepStationFindMany },
    voidReason: { findMany: mocks.voidReasonFindMany },
    noSaleReason: { findMany: mocks.noSaleReasonFindMany },
    alternatePaymentType: { findMany: mocks.alternatePaymentTypeFindMany },
    printer: { findMany: mocks.printerFindMany },
    discount: { findMany: mocks.discountFindMany },
    webhook: { findMany: mocks.webhookFindMany },
    kotDocument: { findMany: mocks.kotDocumentFindMany },
    restaurantSettings: { findFirst: mocks.settingsFindFirst, create: mocks.settingsCreate, update: mocks.settingsUpdate },
    deliveryZone: { findMany: mocks.deliveryZoneFindMany },
    supplier: { findMany: mocks.supplierFindMany, count: mocks.supplierCount },
    menuItem: { findMany: mocks.menuItemFindMany },
    table: { findUnique: vi.fn() },
    order: {
      findFirst: mocks.orderFindFirst,
      findMany: mocks.spOrderFindMany,
      findUnique: mocks.rebuildOrderFindUnique,
      groupBy: mocks.spOrderGroupBy,
    },
    orderItemModifier: { createMany: vi.fn() },
    receipt: { findMany: mocks.receiptFindMany, update: mocks.receiptUpdate },
    employee: { findMany: mocks.spEmployeeFindMany, findUnique: mocks.employeeFindUnique },
    payment: { groupBy: mocks.spPaymentGroupBy },
    staffShift: { groupBy: mocks.spStaffShiftGroupBy },
    timeEntry: { groupBy: mocks.spTimeEntryGroupBy },
    counter: { upsert: vi.fn() },
    $transaction: mocks.transaction,
  },
  createAuditLog: vi.fn(async () => ({})),
}))

// requireAuth mockan na meji (r145/r146 kanon) — tenant resolverji ostanejo
// REALNI iz '@/lib/tenant-scope' (rute ga uvažajo direktno).
vi.mock('@/lib/auth-middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-middleware')>()
  return {
    ...actual,
    requireAuth: mocks.requireAuth,
  }
})

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.checkRateLimitAsync,
  checkRateLimit: vi.fn(() => ({ allowed: true, retryAfterMs: 60000 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
  AUTHENTICATED_LIMIT: { maxRequests: 120, windowMs: 60_000 },
}))

// orders POST: mockamo samo izračune; pairOrderItemsWithInput +
// writeOrderItemModifiersInTx ostanejo REALNI (dual-write pin — ta fajl
// preverja REALNI dual-write nad trap-DB).
vi.mock('@/app/api/orders/_helpers/order-items', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/api/orders/_helpers/order-items')>()
  return {
    ...actual,
    buildOrderItemsData: mocks.buildOrderItemsData,
    calculateOrderTotals: mocks.calculateOrderTotals,
    fetchModifierPriceMap: mocks.fetchModifierPriceMap,
  }
})

vi.mock('@/app/api/orders/_helpers/stock', () => ({
  handleStockDeduction: mocks.handleStockDeduction,
  handlePostCreationEffects: mocks.handlePostCreationEffects,
}))

vi.mock('@/lib/stock-deduction', () => ({
  checkStockAvailability: mocks.checkStockAvailability,
}))

vi.mock('@/lib/counters', () => ({
  getNextOrderNumber: mocks.getNextOrderNumber,
}))

vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

// Route imports (PO mockih)
import { GET as jobsGET, POST as jobsPOST } from '@/app/api/jobs/route'
import { GET as integrationsGET, POST as integrationsPOST } from '@/app/api/integrations/route'
import { GET as guestsGET, POST as guestsPOST } from '@/app/api/guests/route'
import { GET as happyHourGET } from '@/app/api/happy-hour/route'
import { GET as configurationGET } from '@/app/api/configuration/route'
import { GET as webhooksGET } from '@/app/api/webhooks/route'
import { GET as kotGET } from '@/app/api/kot/route'
import { GET as settingsGET, PUT as settingsPUT } from '@/app/api/settings/route'
import { GET as deliveryZonesGET } from '@/app/api/delivery-zones/route'
import { GET as suppliersGET } from '@/app/api/suppliers/route'
import { POST as ordersPOST } from '@/app/api/orders/route'
import { POST as rebuildPOST } from '@/app/api/receipts/rebuild/route'
import { writeOrderItemModifiersInTx } from '@/app/api/orders/_helpers/order-items'
import { fetchPerformanceData } from '@/app/api/staff-performance/_helpers/data-fetch'
import { JSON_FIELDS, JSON_WIRE_FIELDS, getJsonFieldStats } from '@/lib/json-fields'

// ---------- helperji ----------
const sessionRef: { current: Record<string, unknown> | null } = { current: null }

function session(overrides: Record<string, unknown> = {}) {
  return {
    token: 'tok-1',
    employeeId: 'emp-1',
    role: 'admin',
    locationId: LOC,
    permissions: ['admin'],
    createdAt: Date.now(),
    expiresAt: Date.now() + 3_600_000,
    absoluteExpiry: Date.now() + 86_400_000,
    ...overrides,
  }
}

function jsonReq(url: string, body: unknown, method = 'POST'): Request {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** Wire-shape guard helper: polje MORA biti JSON string, ki round-tripa. */
function expectJsonString(v: unknown): unknown {
  expect(typeof v).toBe('string')
  return JSON.parse(v as string)
}

const LEGACY_MODIFIERS = '[{"name":"Extra shot","price":0.5}]'

beforeEach(() => {
  vi.clearAllMocks()
  sessionRef.current = session()
  mocks.requireAuth.mockImplementation(async () => ({ session: sessionRef.current, error: null }))
  mocks.checkRateLimitAsync.mockResolvedValue({ allowed: true, retryAfterMs: 60000 })
  // defaults: vsi findMany/create traki mirni
  mocks.jobFindMany.mockResolvedValue([])
  mocks.integrationFindMany.mockResolvedValue([])
  mocks.guestFindMany.mockResolvedValue([])
  mocks.guestCount.mockResolvedValue(0)
  mocks.happyHourScheduleFindMany.mockResolvedValue([])
  mocks.webhookFindMany.mockResolvedValue([])
  mocks.kotDocumentFindMany.mockResolvedValue([])
  mocks.deliveryZoneFindMany.mockResolvedValue([])
  mocks.supplierFindMany.mockResolvedValue([])
  mocks.supplierCount.mockResolvedValue(0)
  mocks.taxRateFindMany.mockResolvedValue([])
  mocks.diningOptionFindMany.mockResolvedValue([])
  mocks.revenueCenterFindMany.mockResolvedValue([])
  mocks.salesCategoryFindMany.mockResolvedValue([])
  mocks.priceGroupFindMany.mockResolvedValue([])
  mocks.serviceChargeFindMany.mockResolvedValue([])
  mocks.prepStationFindMany.mockResolvedValue([])
  mocks.voidReasonFindMany.mockResolvedValue([])
  mocks.noSaleReasonFindMany.mockResolvedValue([])
  mocks.alternatePaymentTypeFindMany.mockResolvedValue([])
  mocks.printerFindMany.mockResolvedValue([])
  mocks.discountFindMany.mockResolvedValue([])
  mocks.receiptFindMany.mockResolvedValue([])
  mocks.menuItemFindMany.mockResolvedValue([{ id: 'mi-1', vatRate: 22, price: 10 }])
  mocks.spEmployeeFindMany.mockResolvedValue([])
  mocks.spOrderGroupBy.mockResolvedValue([])
  mocks.spPaymentGroupBy.mockResolvedValue([])
  mocks.spStaffShiftGroupBy.mockResolvedValue([])
  mocks.spTimeEntryGroupBy.mockResolvedValue([])
  mocks.spOrderFindMany.mockResolvedValue([])
  mocks.orderFindFirst.mockResolvedValue(null)
  mocks.employeeFindUnique.mockResolvedValue({ status: 'active' })
  mocks.getNextOrderNumber.mockResolvedValue(7)
  mocks.checkStockAvailability.mockResolvedValue({ warnings: [] })
  mocks.handleStockDeduction.mockResolvedValue({ stockDeducted: false })
  mocks.handlePostCreationEffects.mockResolvedValue(undefined)
  mocks.buildOrderItemsData.mockImplementation(
    (items: Array<{ menuItemId: string; quantity: number; notes?: string; modifiersJson?: unknown }>) => ({
      orderItemsData: items.map((i) => ({
        menuItemId: i.menuItemId,
        quantity: i.quantity,
        price: 10,
        vatRate: 22,
        vatAmount: 2.2,
        discountAmount: 0,
        notes: i.notes ?? '',
        modifiersJson: i.modifiersJson,
        status: 'pending' as const,
      })),
      subtotal: 10,
    }),
  )
  mocks.calculateOrderTotals.mockReturnValue({ subtotal: 10, totalTax: 2.2, totalDiscountAmount: 0, total: 12.2 })
  mocks.fetchModifierPriceMap.mockResolvedValue(new Map())
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      order: { create: mocks.txOrderCreate, findUnique: vi.fn(), update: vi.fn() },
      table: { findUnique: vi.fn(), updateMany: vi.fn() },
      orderItem: { create: vi.fn(), updateMany: vi.fn() },
      course: { create: vi.fn() },
      modifierGroup: { findMany: vi.fn(async () => []) },
      orderItemModifier: { createMany: mocks.txOrderItemModifierCreateMany },
    }),
  )
  mocks.txOrderItemModifierCreateMany.mockResolvedValue({ count: 1 })
  // tx.order.create → db vrstice nosijo podpis (menuItemId, quantity, notes,
  // modifiersJson) — realni pairOrderItemsWithInput lahko matcha input
  mocks.txOrderCreate.mockImplementation(
    async (args: { data: { orderItems?: { create?: Array<Record<string, unknown>> } } }) => ({
      id: 'ord-new',
      orderNumber: 7,
      locationId: LOC,
      table: null,
      orderItems: (args.data.orderItems?.create ?? []).map((it, i) => ({
        id: `oi-${i + 1}`,
        menuItemId: it.menuItemId,
        quantity: it.quantity,
        notes: it.notes ?? null,
        modifiersJson: it.modifiersJson,
      })),
    }),
  )
})

// ════════════════════════════════════════════════════════════════
// A. WIRE-SHAPE GUARDS — native JSONB v vrstici → JSON string na wire-u
// ════════════════════════════════════════════════════════════════
describe('R150 A: wire-shape guards (GET — native JSONB → wire JSON string)', () => {
  it('jobs GET: permissions (native array v db) → wire JSON string + round-trip', async () => {
    mocks.jobFindMany.mockResolvedValue([
      { id: 'job-1', name: 'Kuhar', permissions: ['admin', 'take_orders'], isActive: true, employees: [] },
    ])
    const res = await jobsGET(new Request('http://x/api/jobs'))
    expect(res.status).toBe(200)
    const body = await res.json() as Array<{ permissions: unknown }>
    expect(expectJsonString(body[0].permissions)).toEqual(['admin', 'take_orders'])
  })

  it('integrations GET: config + events (native v db) → wire JSON stringa + round-trip', async () => {
    mocks.integrationFindMany.mockResolvedValue([
      {
        id: 'int-1', name: 'eRačuni', type: 'eracuni', provider: 'eracuni',
        config: { companyId: '123', autoSync: true }, events: ['order.created'],
        apiKey: '', apiSecret: '', _count: { logs: 0 },
      },
    ])
    const res = await integrationsGET(new Request('http://x/api/integrations'))
    expect(res.status).toBe(200)
    const body = await res.json() as Array<{ config: unknown; events: unknown }>
    expect(expectJsonString(body[0].config)).toEqual({ companyId: '123', autoSync: true })
    expect(expectJsonString(body[0].events)).toEqual(['order.created'])
  })

  it('guests GET: allergens + dietaryPrefs (native v db) → wire JSON stringa + round-trip', async () => {
    mocks.guestFindMany.mockResolvedValue([
      {
        id: 'g-1', firstName: 'Janez', lastName: 'Novak',
        allergens: ['1', '3'], dietaryPrefs: ['vegan'], dislikes: [], favoriteItems: [],
        loyaltyAccount: null, orders: [],
      },
    ])
    const res = await guestsGET(new Request('http://x/api/guests'))
    expect(res.status).toBe(200)
    const body = await res.json() as { guests: Array<{ allergens: unknown; dietaryPrefs: unknown }>; total: number }
    expect(expectJsonString(body.guests[0].allergens)).toEqual(['1', '3'])
    expect(expectJsonString(body.guests[0].dietaryPrefs)).toEqual(['vegan'])
  })

  it('happy-hour GET: daysOfWeek + appliesToIds (native v db) → wire JSON stringa + round-trip', async () => {
    mocks.happyHourScheduleFindMany.mockResolvedValue([
      {
        id: 'hh-1', isActive: true, startTime: '00:00', endTime: '23:59',
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7], appliesToIds: ['pg-1'], priceGroupId: 'pg-1',
        validFrom: null, validTo: null, priceGroup: { id: 'pg-1', name: 'Pijača' },
      },
    ])
    const res = await happyHourGET(new Request('http://x/api/happy-hour'))
    expect(res.status).toBe(200)
    const body = await res.json() as { schedules: Array<{ daysOfWeek: unknown; appliesToIds: unknown }> }
    expect(expectJsonString(body.schedules[0].daysOfWeek)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(expectJsonString(body.schedules[0].appliesToIds)).toEqual(['pg-1'])
  })

  it('configuration GET: printers printRules (native v db) → wire JSON string + round-trip', async () => {
    mocks.printerFindMany.mockResolvedValue([
      {
        id: 'pr-1', name: 'Kuhinja', type: 'kitchen', location: 'bar', ipAddress: '10.0.0.5',
        printRules: [{ type: 'order', prepStationId: 'ps-1' }], isActive: true, sortOrder: 0,
      },
    ])
    const res = await configurationGET(new Request('http://x/api/configuration'))
    expect(res.status).toBe(200)
    const body = await res.json() as { printers: Array<{ printRules: unknown }> }
    expect(expectJsonString(body.printers[0].printRules)).toEqual([{ type: 'order', prepStationId: 'ps-1' }])
  })

  it('webhooks GET: events (native v db) → wire JSON string + round-trip', async () => {
    mocks.webhookFindMany.mockResolvedValue([
      { id: 'wh-1', name: 'Hook', url: 'https://example.com/hook', events: ['order.paid'], isActive: true, secret: 'whsec_abc', locationId: LOC },
    ])
    const res = await webhooksGET(new Request('http://x/api/webhooks'))
    expect(res.status).toBe(200)
    const body = await res.json() as Array<{ events: unknown }>
    expect(expectJsonString(body[0].events)).toEqual(['order.paid'])
  })

  it('kot GET: itemsJson (native v db) → wire JSON string + round-trip', async () => {
    mocks.kotDocumentFindMany.mockResolvedValue([
      {
        id: 'kot-1', orderId: 'o-1', type: 'kitchen',
        itemsJson: [{ menuItemId: 'c-menu-1', name: 'Kava', quantity: 1 }],
        createdAt: new Date(), employee: { id: 'e-1', name: 'Janez' },
      },
    ])
    const res = await kotGET(new Request('http://x/api/kot'))
    expect(res.status).toBe(200)
    const body = await res.json() as { kots: Array<{ itemsJson: unknown }> }
    expect(expectJsonString(body.kots[0].itemsJson)).toEqual([{ menuItemId: 'c-menu-1', name: 'Kava', quantity: 1 }])
  })

  it('settings GET: emailReportRecipients (native) → wire JSON string; apiKeys ostane DEFER string', async () => {
    mocks.settingsFindFirst.mockResolvedValue({
      id: 's-1', name: 'RestaurantOS', isActive: true,
      emailReportRecipients: ['a@x.si', 'b@x.si'],
      apiKeys: '{"geminiApiKey":"g-key"}',
      fursCertPassword: null, fursCertPath: null, emailSmtpPassword: null,
      cisCertPassword: null, cisCertPath: null, emailSmtpUser: 'smtp@x.si',
    })
    const res = await settingsGET(new Request('http://x/api/settings'))
    expect(res.status).toBe(200)
    const body = await res.json() as { emailReportRecipients: unknown; apiKeys: unknown; hasGeminiKey: boolean }
    // R150 wire mapping: JSONB struct → JSON string (UI dela JSON.parse)
    expect(expectJsonString(body.emailReportRecipients)).toEqual(['a@x.si', 'b@x.si'])
    // DEFER (byte-pinned): apiKeys ostane serializiran string (nikoli nativen)
    expect(typeof body.apiKeys).toBe('string')
    expect(body.hasGeminiKey).toBe(true) // apiKeys branje deluje
  })

  it('delivery-zones GET: postCodes + cities (native v db) → wire JSON stringa + round-trip', async () => {
    mocks.deliveryZoneFindMany.mockResolvedValue([
      { id: 'dz-1', name: 'Ljubljana center', postCodes: ['1000', '2000'], cities: ['Ljubljana'], deliveryFee: 2.5, minOrderAmount: 10, freeDeliveryAbove: 30 },
    ])
    const res = await deliveryZonesGET(new Request('http://x/api/delivery-zones'))
    expect(res.status).toBe(200)
    const body = await res.json() as { zones: Array<{ postCodes: unknown; cities: unknown }> }
    expect(expectJsonString(body.zones[0].postCodes)).toEqual(['1000', '2000'])
    expect(expectJsonString(body.zones[0].cities)).toEqual(['Ljubljana'])
  })

  it('suppliers GET: deliveryDays (native v db) → wire JSON string + round-trip', async () => {
    mocks.supplierFindMany.mockResolvedValue([
      { id: 'sup-1', name: 'Kavomat d.o.o.', deliveryDays: ['pon', 'sre'], _count: { purchaseOrders: 2 } },
    ])
    const res = await suppliersGET(new Request('http://x/api/suppliers'))
    expect(res.status).toBe(200)
    const body = await res.json() as { suppliers: Array<{ deliveryDays: unknown }> }
    expect(expectJsonString(body.suppliers[0].deliveryDays)).toEqual(['pon', 'sre'])
  })
})

// ════════════════════════════════════════════════════════════════
// B. TOLERANTNA BRANJA — malformed legacy vrednosti NIKOLI 500
// ════════════════════════════════════════════════════════════════
describe('R150 B: tolerantna branja (malformed legacy v db vrstici)', () => {
  it('jobs GET: malformed legacy permissions string → 200, string passthrough (nikoli throw)', async () => {
    mocks.jobFindMany.mockResolvedValue([
      { id: 'job-bad', name: 'Pokvarjen', permissions: '{broken', employees: [] },
    ])
    const res = await jobsGET(new Request('http://x/api/jobs'))
    expect(res.status).toBe(200)
    const body = await res.json() as Array<{ permissions: unknown }>
    // toJsonWire: string vrednosti ostanejo NESPREMENJENE (že-wire/legacy)
    expect(body[0].permissions).toBe('{broken')
  })

  it('happy-hour GET: malformed legacy daysOfWeek → 200, parse fallback (activeSchedules [])', async () => {
    mocks.happyHourScheduleFindMany.mockResolvedValue([
      {
        id: 'hh-bad', isActive: true, startTime: '00:00', endTime: '23:59',
        daysOfWeek: 'garbage', appliesToIds: '[]', priceGroupId: 'pg-1',
        validFrom: null, validTo: null, priceGroup: { id: 'pg-1', name: 'Pijača' },
      },
    ])
    const res = await happyHourGET(new Request('http://x/api/happy-hour'))
    expect(res.status).toBe(200)
    const body = await res.json() as {
      schedules: Array<{ daysOfWeek: unknown }>
      activeSchedules: unknown[]
      currentlyActive: boolean
    }
    expect(body.schedules[0].daysOfWeek).toBe('garbage') // passthrough na wire-u
    expect(body.activeSchedules).toEqual([]) // parseDaysOfWeek → [] fallback
    expect(body.currentlyActive).toBe(false)
  })

  it('delivery-zones GET: malformed legacy postCodes → 200, string passthrough', async () => {
    mocks.deliveryZoneFindMany.mockResolvedValue([
      { id: 'dz-bad', name: 'X', postCodes: '{oops', cities: [], deliveryFee: 2.5, minOrderAmount: 10, freeDeliveryAbove: 0 },
    ])
    const res = await deliveryZonesGET(new Request('http://x/api/delivery-zones'))
    expect(res.status).toBe(200)
    const body = await res.json() as { zones: Array<{ postCodes: unknown }> }
    expect(body.zones[0].postCodes).toBe('{oops')
  })

  it('suppliers GET: malformed legacy deliveryDays → 200, string passthrough', async () => {
    mocks.supplierFindMany.mockResolvedValue([
      { id: 'sup-bad', name: 'X', deliveryDays: '{oops', _count: { purchaseOrders: 0 } },
    ])
    const res = await suppliersGET(new Request('http://x/api/suppliers'))
    expect(res.status).toBe(200)
    const body = await res.json() as { suppliers: Array<{ deliveryDays: unknown }> }
    expect(body.suppliers[0].deliveryDays).toBe('{oops')
  })
})

// ════════════════════════════════════════════════════════════════
// C. WRITERJI — JSON-string wire → NATIVNA vrednost v db + wire odgovor
// ════════════════════════════════════════════════════════════════
describe('R150 C: writerji (wire string → native JSONB)', () => {
  it('jobs POST: wire string permissions → db create dobi NATIVNO array; odgovor wire string', async () => {
    mocks.jobCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'job-2', ...data, employees: [] }))
    const res = await jobsPOST(jsonReq('http://x/api/jobs', { name: 'Natakar', permissions: '["take_orders","view_reports"]' }))
    expect(res.status).toBe(201)
    const createArg = mocks.jobCreate.mock.calls[0][0].data
    // R150: NATIVNA vrednost v JSONB stolpec (JSON.stringify bi tiho dvojno kodiral)
    expect(Array.isArray(createArg.permissions)).toBe(true)
    expect(createArg.permissions).toEqual(['take_orders', 'view_reports'])
    // wire mapping na POST odgovoru (byte-identical wire)
    const body = await res.json() as { permissions: unknown }
    expect(expectJsonString(body.permissions)).toEqual(['take_orders', 'view_reports'])
  })

  it('integrations POST: config + events wire stringa → db create dobi NATIVNI object/array', async () => {
    mocks.integrationCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'int-2', ...data }))
    const res = await integrationsPOST(jsonReq('http://x/api/integrations', {
      name: 'eRačuni', type: 'eracuni', provider: 'eracuni',
      config: '{"autoSync":true}', events: '["order.created"]',
    }))
    expect(res.status).toBe(201)
    const createArg = mocks.integrationCreate.mock.calls[0][0].data
    expect(createArg.config).toEqual({ autoSync: true })
    expect(createArg.events).toEqual(['order.created'])
    const body = await res.json() as { config: unknown; events: unknown }
    expect(expectJsonString(body.config)).toEqual({ autoSync: true })
    expect(expectJsonString(body.events)).toEqual(['order.created'])
  })

  it('guests POST: NATIVE-array wire je sprejet (toleranten vhod) → db dobi nativne arraye (allergens filtrirani)', async () => {
    mocks.guestCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'g-9', ...data, loyaltyAccount: null }))
    const res = await guestsPOST(jsonReq('http://x/api/guests', {
      firstName: 'Ana', lastName: 'Novak',
      allergens: ['1', '3', '99'], // 99 ni veljaven EU alergen → izločen
      dietaryPrefs: ['vegan'], dislikes: ['sladkor'], favoriteItems: ['pizza'],
    }))
    expect(res.status).toBe(201)
    const createArg = mocks.guestCreate.mock.calls[0][0].data
    expect(Array.isArray(createArg.allergens)).toBe(true)
    expect(createArg.allergens).toEqual(['1', '3']) // parseAllergens per-element filter
    expect(createArg.dietaryPrefs).toEqual(['vegan'])
    expect(createArg.favoriteItems).toEqual(['pizza'])
    const body = await res.json() as { allergens: unknown }
    expect(expectJsonString(body.allergens)).toEqual(['1', '3'])
  })

  it('settings PUT: emailReportRecipients wire string → db update dobi NATIVNO array; odgovor wire string', async () => {
    mocks.settingsFindFirst.mockResolvedValue({
      id: 's-1', name: 'RestaurantOS', isActive: true,
      emailReportRecipients: [], apiKeys: '{}', emailSmtpUser: 'smtp@x.si',
      fursCertPassword: null, fursCertPath: null, emailSmtpPassword: null,
      cisCertPassword: null, cisCertPath: null,
    })
    mocks.settingsUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 's-1', name: 'RestaurantOS', isActive: true, emailSmtpUser: 'smtp@x.si',
      fursCertPassword: null, fursCertPath: null, emailSmtpPassword: null,
      cisCertPassword: null, cisCertPath: null, apiKeys: '{}', ...data,
    }))
    const res = await settingsPUT(jsonReq('http://x/api/settings', { emailReportRecipients: '["a@x.si","b@x.si"]' }, 'PUT'))
    expect(res.status).toBe(200)
    const updateArg = mocks.settingsUpdate.mock.calls[0][0].data
    expect(Array.isArray(updateArg.emailReportRecipients)).toBe(true)
    expect(updateArg.emailReportRecipients).toEqual(['a@x.si', 'b@x.si'])
    const body = await res.json() as { emailReportRecipients: unknown }
    expect(expectJsonString(body.emailReportRecipients)).toEqual(['a@x.si', 'b@x.si'])
  })
})

// ════════════════════════════════════════════════════════════════
// D. DUAL-WRITE — orders POST: legacy string + OrderItemModifier v isti tx
// ════════════════════════════════════════════════════════════════
describe('R150 D: orders POST dual-write (OrderItemModifier + legacy modifiersJson)', () => {
  it('string wire modifiersJson → legacy STRING nespremenjen v order.create + orderItemModifier.createMany vrstice v ISTI tx', async () => {
    const res = await ordersPOST(jsonReq('http://localhost:3000/api/orders', {
      type: 'dine-in',
      orderItems: [{ menuItemId: 'mi-1', quantity: 2, notes: '', modifiersJson: LEGACY_MODIFIERS }],
    }))
    expect(res.status).toBe(201)
    const body = await res.json() as { id: string }
    expect(body.id).toBe('ord-new')

    // 1) LEGACY: OrderItem.modifiersJson ostane wire STRING (byte-kompatibilen)
    const createData = mocks.txOrderCreate.mock.calls[0][0].data as {
      orderItems: { create: Array<{ modifiersJson: unknown }> }
    }
    expect(createData.orderItems.create[0].modifiersJson).toBe(LEGACY_MODIFIERS)
    expect(typeof createData.orderItems.create[0].modifiersJson).toBe('string')

    // 2) DUAL-WRITE: OrderItemModifier join vrstice v ISTI transakciji
    expect(mocks.transaction).toHaveBeenCalledTimes(1)
    expect(mocks.txOrderItemModifierCreateMany).toHaveBeenCalledTimes(1)
    expect(mocks.txOrderItemModifierCreateMany).toHaveBeenCalledWith({
      data: [
        {
          orderItemId: 'oi-1',
          name: 'Extra shot',
          price: 0.5, // snapshot cene (native number)
          quantity: null,
          modifierGroupId: null,
          modifierGroupName: '',
          sortOrder: 0,
        },
      ],
    })
  })

  it('writeOrderItemModifiersInTx: native-array vhod (toleranten) + veljaven modifierGroupId → snapshot imena skupine', async () => {
    const tx = {
      modifierGroup: { findMany: vi.fn(async () => [{ id: 'mg-1', name: 'Dodatki' }]) },
      orderItemModifier: { createMany: vi.fn(async () => ({ count: 1 })) },
    }
    const n = await writeOrderItemModifiersInTx(
      tx as unknown as Parameters<typeof writeOrderItemModifiersInTx>[0],
      [{ orderItemId: 'oi-1', modifiersJson: [{ name: 'Ekstra sir', price: 1, quantity: 2, modifierGroupId: 'mg-1' }] }],
    )
    expect(n).toBe(1)
    expect(tx.modifierGroup.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['mg-1'] } },
      select: { id: true, name: true },
    })
    expect(tx.orderItemModifier.createMany).toHaveBeenCalledWith({
      data: [
        {
          orderItemId: 'oi-1', name: 'Ekstra sir', price: 1, quantity: 2,
          modifierGroupId: 'mg-1', modifierGroupName: 'Dodatki', sortOrder: 0,
        },
      ],
    })
  })

  it('writeOrderItemModifiersInTx: bogus modifierGroupId (ne obstaja) → NULL FK + vrstica vseeno zapisana (nikoli 500)', async () => {
    const tx = {
      modifierGroup: { findMany: vi.fn(async () => []) },
      orderItemModifier: { createMany: vi.fn(async () => ({ count: 1 })) },
    }
    const n = await writeOrderItemModifiersInTx(
      tx as unknown as Parameters<typeof writeOrderItemModifiersInTx>[0],
      [{ orderItemId: 'oi-2', modifiersJson: [{ name: 'X', price: 1, modifierGroupId: 'mg-GONE' }] }],
    )
    expect(n).toBe(1)
    expect(tx.orderItemModifier.createMany).toHaveBeenCalledWith({
      data: [
        {
          orderItemId: 'oi-2', name: 'X', price: 1, quantity: null,
          modifierGroupId: null, modifierGroupName: '', sortOrder: 0,
        },
      ],
    })
  })
})

// ════════════════════════════════════════════════════════════════
// E. QUERYABILITY — staff-performance join-exists filter
// ════════════════════════════════════════════════════════════════
describe('R150 E: staff-performance data-fetch (orderItemModifiers join-exists)', () => {
  it('order.findMany #2 where = orderItems: { some: { orderItemModifiers: { some: {} } } } (NE modifiersJson string filter)', async () => {
    await fetchPerformanceData(new Date('2026-01-01T00:00:00.000Z'), LOC)
    expect(mocks.spOrderFindMany).toHaveBeenCalledTimes(2)
    const where2 = (mocks.spOrderFindMany.mock.calls[1][0] as { where: Record<string, unknown> }).where
    expect(where2.orderItems).toEqual({ some: { orderItemModifiers: { some: {} } } })
    // stari Prisma filter z stringom '[]' se na JSONB ne upošteva — NE sme obstajati
    expect(JSON.stringify(where2)).not.toContain('modifiersJson')
    expect(where2.employeeId).toEqual({ not: null })
  })
})

// ════════════════════════════════════════════════════════════════
// F. RECEIPTS/REBUILD — vatBreakdown update payload = NATIVNI object
// ════════════════════════════════════════════════════════════════
describe('R150 F: receipts/rebuild (vatBreakdown native payload)', () => {
  it('platform admin + prazni (legacy string) vatBreakdown → update payload NATIVNI object', async () => {
    sessionRef.current = session({ locationId: null }) // platform admin (brez lokacije)
    // legacy prazna vrednost = string '' (pre-migracija oblika) — tolerantna preverba
    mocks.receiptFindMany.mockResolvedValue([
      { id: 'r-1', receiptNumber: 'R-1', orderId: 'o-1', vatBreakdown: '' },
    ])
    mocks.rebuildOrderFindUnique.mockResolvedValue({
      id: 'o-1',
      orderItems: [
        { voided: false, price: 10, quantity: 2, vatRate: 22, vatAmount: 0, menuItem: { vatRate: 22 } },
      ],
    })
    mocks.receiptUpdate.mockResolvedValue({ id: 'r-1' })

    const res = await rebuildPOST(new Request('http://x/api/receipts/rebuild', { method: 'POST' }))
    expect(res.status).toBe(200)
    const body = await res.json() as { processed: number; updated: number }
    expect(body.processed).toBe(1)
    expect(body.updated).toBe(1)

    const updateArg = mocks.receiptUpdate.mock.calls[0][0]
    expect(updateArg.where).toEqual({ id: 'r-1' })
    // R150: NATIVNI object (ne JSON string — stringify bi dvojno kodiral JSONB)
    expect(typeof updateArg.data.vatBreakdown).toBe('object')
    expect(updateArg.data.vatBreakdown).toEqual({ '22': { base: 20, vat: 4.4 } })
  })
})

// ════════════════════════════════════════════════════════════════
// G. REGISTRY — JSON_FIELDS inventar + getJsonFieldStats (brez drifta)
// ════════════════════════════════════════════════════════════════
describe('R150 G: registry (0022_json_fields inventar)', () => {
  it('getJsonFieldStats: usesPrismaJson true (Phase 3 KONČAN)', () => {
    const stats = getJsonFieldStats()
    expect(stats.usesPrismaJson).toBe(true)
    expect(stats.zodValidated).toBe(true)
  })

  it('točno 25 stolpcev je migriranih (migrated: true)', () => {
    const migrated = JSON_FIELDS.filter((f) => f.migrated)
    expect(migrated).toHaveLength(25)
  })

  it('NI zastarelih vnosov (Order.vatBreakdown, ApiLog.*, ScheduledEmailLog.*, OpeningHours.daysOfWeek, HappyHour, Discount.appliesToIds)', () => {
    expect(JSON_FIELDS.some((f) => f.model === 'Order')).toBe(false)
    expect(JSON_FIELDS.some((f) => f.model === 'ApiLog')).toBe(false)
    expect(JSON_FIELDS.some((f) => f.model === 'ScheduledEmailLog')).toBe(false)
    expect(JSON_FIELDS.some((f) => f.model === 'OpeningHours')).toBe(false)
    expect(JSON_FIELDS.some((f) => f.model === 'HappyHour')).toBe(false) // preimenovan v HappyHourSchedule
    expect(JSON_FIELDS.some((f) => f.model === 'Discount' && f.field === 'appliesToIds')).toBe(false)
  })

  it('preneseni/novi vnosi prisotni (KotDocument.itemsJson, Location.emailReportRecipients, BiometricCredential.transports, ApiKey.scopes, IntegrationLog.*, HappyHourSchedule.*)', () => {
    const has = (model: string, field: string) =>
      JSON_FIELDS.some((f) => f.model === model && f.field === field && f.migrated === true)
    expect(has('KotDocument', 'itemsJson')).toBe(true)
    expect(has('Location', 'emailReportRecipients')).toBe(true)
    expect(has('BiometricCredential', 'transports')).toBe(true)
    expect(has('ApiKey', 'scopes')).toBe(true)
    expect(has('IntegrationLog', 'requestData')).toBe(true)
    expect(has('IntegrationLog', 'responseData')).toBe(true)
    expect(has('HappyHourSchedule', 'daysOfWeek')).toBe(true)
    expect(has('HappyHourSchedule', 'appliesToIds')).toBe(true)
  })

  it('DEFER stolpci NISO migrirani (AuditLog.details, WebhookDelivery.payload, RestaurantSettings.apiKeys)', () => {
    const find = (model: string, field: string) => JSON_FIELDS.find((f) => f.model === model && f.field === field)
    expect(find('AuditLog', 'details')?.migrated).toBeUndefined()
    expect(find('WebhookDelivery', 'payload')?.migrated).toBeUndefined()
    expect(find('RestaurantSettings', 'apiKeys')?.migrated).toBeUndefined()
  })

  it('OrderItem.modifiersJson = legacy dual-write stolpec (brez migrated flaga, parser parseOrderItemModifiers)', () => {
    const f = JSON_FIELDS.find((e) => e.model === 'OrderItem' && e.field === 'modifiersJson')
    expect(f).toBeDefined()
    expect(f?.migrated).toBeUndefined()
    expect(f?.parser).toBe('parseOrderItemModifiers')
    expect(f?.description).toContain('dual-write')
  })

  it('JSON_WIRE_FIELDS: pokriva migrirana wire polja, NE legacy/DEFER stolpcev', () => {
    for (const field of ['permissions', 'printRules', 'vatBreakdown', 'emailReportRecipients', 'postCodes', 'cities', 'events', 'allergens', 'deliveryDays', 'daysOfWeek', 'appliesToIds', 'config', 'requestData', 'responseData', 'tags', 'transports', 'itemsJson', 'scopes']) {
      expect(JSON_WIRE_FIELDS.has(field)).toBe(true)
    }
    expect(JSON_WIRE_FIELDS.has('modifiersJson')).toBe(false)
    expect(JSON_WIRE_FIELDS.has('details')).toBe(false)
    expect(JSON_WIRE_FIELDS.has('payload')).toBe(false)
    expect(JSON_WIRE_FIELDS.has('apiKeys')).toBe(false)
  })
})
