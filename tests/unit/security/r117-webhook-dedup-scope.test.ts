// ============================================
// R117 — WEBHOOK DEDUP SCOPE (H-1 Bolt P1 + H-2 Wolt/Glovo P2)
// ============================================
//
// PASS 1 (R117 audit) dokazane najdbe:
//   H-1 (P1): Bolt dedup je bil NESCOPEAN — `order.findFirst({
//     customerName: { contains: 'Bolt:<id>' } })` brez integracije/lokacije:
//     (a) `contains` prefix kolizije (123 ujame 1234) → legitimen webhook
//         tiho pogoltnjen,
//     (b) lahko vrnil/replay-al TUJ order (cross-tenant leak),
//     (c) identiteta ni bila vezana na integracijo.
//     Fix: kanonski Wolt/Glovo model — integrationLog (scoped na
//     integrationId + EXACT JSON identiteta) + legacy customerName fallback
//     (location scoped + delimiter-exact `startsWith 'Bolt:<id> — '`).
//   H-2 (P2): Wolt/Glovo legacy notes fallback je bil UNSCOPED — order iz
//     lokacije A + webhook za lokacijo B = replay tujega ordera.
//     Fix: `locationId: webhookLocationId` v fallback where; kanonska
//     integrationLog pot nespremenjena.
//
// TESTNA FILOZOFIJA — "ni lažnivojski test mocka":
//   • Realni helperji + realne route tečejo proti mini-DB modelu, ki za
//     točno tiste predikate, na katerih stoji fix (location equality,
//     startsWith, notes contains, integrationLog JSON identity),
//     modelira PostgreSQL semantiko. Prefix kolizija in cross-location
//     uhajanje sta DOKAZANA skozi obnašanje, ne skozi where-shape samo.
//   • BOLT-5 uporablja realno $transaction strukturo route + emulacijo
//     pg_advisory_xact_lock (per-ključ FIFO veriga) — konkurenčna
//     redeliverija = točno en order (create točno enkrat).
//   • Strukturni pini (source contains) dodatno preprečujejo
//     reintrodukcijo unscoped contains.
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { createHmac } from 'crypto'

const LOC_A = 'loc-tenant-a'
const LOC_B = 'loc-tenant-b'

// --- In-memory DB model (vi.hoisted — dostopen v vi.mock factory) ---
const state = vi.hoisted(() => ({
  // Order vrstice — modelira NOT NULL locationId (schema kanon)
  orders: [] as Array<{ id: string; orderNumber: number; locationId: string; customerName: string; notes: string }>,
  // IntegrationLog vrstice — modelira realne writerje (bolt route + wolt/glovo logAndSync)
  logs: [] as Array<{ integrationId: string; action: string; direction: string; status: string; requestData: string; responseData: string }>,
  // pg_advisory_xact_lock emulacija: per-ključ FIFO veriga
  lockChains: new Map<string, Promise<void>>(),
  // envelope ?t= mock vir (route prebere integrationId iz envelope)
  envelopeIntegrationId: 'int-bolt-a',
  // zadnji where, ki ga je order.findFirst model videl (where-shape pini)
  lastOrderWhere: null as Record<string, unknown> | null,
  orderSeq: 0,
}))

// --- Mocki ---
const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  integrationFindFirst: vi.fn(),
  integrationUpdate: vi.fn(),
  integrationLogFindMany: vi.fn(),
  integrationLogCreate: vi.fn(),
  orderFindFirst: vi.fn(),
  menuItemFindMany: vi.fn(),
  // tx klient
  txExecuteRaw: vi.fn(),
  txIntegrationLogFindMany: vi.fn(),
  txOrderFindFirst: vi.fn(),
  txOrderCreate: vi.fn(),
  txMenuItemFindMany: vi.fn(),
  txMenuItemFindFirst: vi.fn(),
  // route depi
  getNextOrderNumber: vi.fn(),
  emitOrderCreated: vi.fn(),
  emitEvent: vi.fn(),
  checkRateLimitAsync: vi.fn(),
  getClientIp: vi.fn(),
  rateLimitedResponse: vi.fn(),
  parseWebhookEnvelope: vi.fn(),
  broadcastWSEvent: vi.fn(),
  deductInventoryWolt: vi.fn(),
  logAndSyncWolt: vi.fn(),
  deductInventoryGlovo: vi.fn(),
  logAndSyncGlovo: vi.fn(),
}))

// --- Mini-DB model: PostgreSQL semantika za točno tiste predikate,
//     na katerih stoji R117 fix (location equality + startsWith/contains). ---
function orderFindFirstModel({ where }: { where: Record<string, unknown> }) {
  state.lastOrderWhere = where
  const w = where as {
    locationId?: string
    customerName?: { startsWith?: string }
    notes?: { contains?: string }
  }
  const match = state.orders.find(o => {
    // Prisma eq: nedefiniran pogoj ne filtrira; podan pogoj je obvezen
    if (w.locationId !== undefined && o.locationId !== w.locationId) return false
    // Prisma startsWith: prefix-exact (delimiter vključen — 123 NE ujame 1234)
    if (w.customerName?.startsWith !== undefined && !o.customerName.startsWith(w.customerName.startsWith)) return false
    // Prisma contains: substring
    if (w.notes?.contains !== undefined && !o.notes.includes(w.notes.contains)) return false
    return true
  })
  return match ? { ...match } : null
}

function integrationLogFindManyModel({ where }: { where: Record<string, unknown> }) {
  const w = where as {
    integrationId?: string
    action?: string
    direction?: string
    status?: string
    OR?: Array<{ requestData?: { contains?: string } }>
  }
  const patterns = (w.OR ?? [])
    .map(o => o?.requestData?.contains)
    .filter((p): p is string => typeof p === 'string')
  return state.logs
    .filter(l =>
      (w.integrationId === undefined || l.integrationId === w.integrationId) &&
      (w.action === undefined || l.action === w.action) &&
      (w.direction === undefined || l.direction === w.direction) &&
      (w.status === undefined || l.status === w.status) &&
      (patterns.length === 0 || patterns.some(p => l.requestData.includes(p)))
    )
    .map(l => ({ ...l }))
}

vi.mock('@/lib/db', () => ({
  db: {
    $transaction: mocks.transaction,
    integration: { findFirst: mocks.integrationFindFirst, update: mocks.integrationUpdate },
    integrationLog: { findMany: mocks.integrationLogFindMany, create: mocks.integrationLogCreate },
    menuItem: { findMany: mocks.menuItemFindMany },
    order: { findFirst: mocks.orderFindFirst },
  },
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/counters', () => ({
  getNextOrderNumber: mocks.getNextOrderNumber,
}))

vi.mock('@/lib/event-emitter', () => ({
  emitOrderCreated: mocks.emitOrderCreated,
  emitEvent: mocks.emitEvent,
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.checkRateLimitAsync,
  getClientIp: mocks.getClientIp,
  DELIVERY_WEBHOOK_LIMIT: { windowMs: 60000, max: 60 },
}))

vi.mock('@/lib/rate-limit/response', () => ({
  rateLimitedResponse: mocks.rateLimitedResponse,
}))

vi.mock('@/lib/ordering-token', () => ({
  isOrderingSecretConfigured: vi.fn(() => true),
  parseWebhookEnvelope: mocks.parseWebhookEnvelope,
}))

vi.mock('@/lib/websocket-client', () => ({
  broadcastWSEvent: mocks.broadcastWSEvent,
}))

vi.mock('@/lib/webhook-engine', () => ({
  verifySignature: vi.fn(() => true),
}))

// Wolt/Glovo pisne post-tx poti: mock + modeliran log zapis (isti format
// kot realni writer — action 'receive_order', requestData = body, ...).
vi.mock('@/app/api/delivery/webhook/wolt/_helpers/wolt-inventory', () => ({
  deductInventoryForOrder: mocks.deductInventoryWolt,
  logAndSyncIntegration: mocks.logAndSyncWolt,
}))

vi.mock('@/app/api/delivery/webhook/glovo/_helpers/glovo-inventory', () => ({
  deductInventoryForOrder: mocks.deductInventoryGlovo,
}))

vi.mock('@/app/api/delivery/webhook/glovo/_helpers/glovo-logging', () => ({
  broadcastWS: vi.fn(),
  logAndSyncIntegration: mocks.logAndSyncGlovo,
}))

vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

import { POST as boltPOST } from '@/app/api/delivery/webhook/bolt/route'
import { POST as woltPOST } from '@/app/api/delivery/webhook/wolt/route'
import { POST as glovoPOST } from '@/app/api/delivery/webhook/glovo/route'

const INT_BOLT_A = { id: 'int-bolt-a', provider: 'bolt', isActive: true, locationId: LOC_A, apiSecret: 'bolt-secret' }
const INT_BOLT_B = { id: 'int-bolt-b', provider: 'bolt', isActive: true, locationId: LOC_B, apiSecret: 'bolt-secret' }
const INT_WOLT_A = { id: 'int-wolt-a', provider: 'wolt', isActive: true, locationId: LOC_A, apiSecret: 'wolt-secret' }
const INT_WOLT_B = { id: 'int-wolt-b', provider: 'wolt', isActive: true, locationId: LOC_B, apiSecret: 'wolt-secret' }
const INT_GLOVO_A = { id: 'int-glovo-a', provider: 'glovo', isActive: true, locationId: LOC_A, apiSecret: 'glovo-secret' }
const INT_GLOVO_B = { id: 'int-glovo-b', provider: 'glovo', isActive: true, locationId: LOC_B, apiSecret: 'glovo-secret' }

const ALL_INTEGRATIONS = [INT_BOLT_A, INT_BOLT_B, INT_WOLT_A, INT_WOLT_B, INT_GLOVO_A, INT_GLOVO_B]

const MENU_ITEM = { id: 'mi-1', name: 'Pica Margherita', price: 9.5, vatRate: 9.5 }

const BOLT_PAYLOAD = (orderId: string) => ({
  order_id: orderId,
  status: 'pending',
  customer: { name: 'Metka Novak', phone: '+38640123456' },
  delivery_address: 'Ulica 1, Ljubljana',
  delivery_notes: 'zvonec pri vrati',
  delivery_fee: 1.5,
  items: [{ id: 'b1', name: 'Pica Margherita', quantity: 2, price: 9.9, notes: '', options: [] }],
  total_price: 21.3,
  currency: 'EUR',
})

const WOLT_PAYLOAD = (orderId: string) => ({
  order_id: orderId,
  status: 'pending',
  delivery: {
    location: { formatted_address: 'Cesta 2, Ljubljana' },
    recipient: { name: 'Janez Kranjski', phone: '+38641111222' },
  },
  items: [{ item_id: 'mi-1', name: 'Pica Margherita', count: 1 }],
  payment: { method: 'card', total: 10.6 },
})

const GLOVO_PAYLOAD = (orderId: string) => ({
  order_id: orderId,
  status: 'pending',
  delivery_address: { street: 'Ulica 3', city: 'Maribor' },
  customer: { name: 'Mojca Pokrajculja', phone: '+38641222333' },
  products: [{ product_id: 'mi-1', name: 'Pica Margherita', quantity: 2, price: 9.5 }],
  payment: { method: 'card' },
})

function boltRequest(orderId: string): Request {
  const body = JSON.stringify(BOLT_PAYLOAD(orderId))
  const sig = createHmac('sha256', 'bolt-secret').update(body).digest('hex')
  return new Request('http://localhost/api/delivery/webhook/bolt?t=env:hmac', {
    method: 'POST',
    headers: { 'x-bolt-signature': sig, 'content-type': 'application/json' },
    body,
  })
}

function webhookRequest(url: string, payload: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'x-wolt-signature': 'sig', 'x-glovo-signature': 'sig', 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  // reset in-memory DB
  state.orders = []
  state.logs = []
  state.lockChains = new Map()
  state.envelopeIntegrationId = 'int-bolt-a'
  state.lastOrderWhere = null
  state.orderSeq = 0

  // $transaction + pg_advisory_xact_lock emulacija: per-ključ FIFO veriga —
  // $executeRaw z advisory lock SQL drži mutex do konca tx callbacka
  // (finally release). Različni ključi = vzporedni (isti semantiki kot PG).
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    // holder objekt (TS narrowing ne sledi prireditvi znotraj callbacka)
    const lock: { release: (() => void) | null } = { release: null }
    const tx = {
      $executeRaw: async (_strings: TemplateStringsArray, lockKey?: string) => {
        if (typeof lockKey !== 'string') return 1
        const prev = state.lockChains.get(lockKey) ?? Promise.resolve()
        const gate = new Promise<void>(resolve => { lock.release = resolve })
        state.lockChains.set(lockKey, prev.then(() => gate))
        await prev // advisory lock: čakaj na prejšnjega imetnika ISTEGA ključa
        return 1
      },
      integrationLog: { findMany: mocks.txIntegrationLogFindMany },
      order: { findFirst: mocks.txOrderFindFirst, create: mocks.txOrderCreate },
      menuItem: { findMany: mocks.txMenuItemFindMany, findFirst: mocks.txMenuItemFindFirst },
    }
    try {
      return await fn(tx)
    } finally {
      lock.release?.()
    }
  })

  // db modeli (isti vir resnice za db in tx klient = ena baza)
  mocks.integrationLogFindMany.mockImplementation(integrationLogFindManyModel)
  mocks.txIntegrationLogFindMany.mockImplementation(integrationLogFindManyModel)
  mocks.orderFindFirst.mockImplementation(orderFindFirstModel)
  mocks.txOrderFindFirst.mockImplementation(orderFindFirstModel)
  mocks.integrationLogCreate.mockImplementation(async ({ data }: { data: Record<string, string> }) => {
    state.logs.push({
      integrationId: data.integrationId,
      action: data.action,
      direction: data.direction,
      status: data.status,
      requestData: data.requestData,
      responseData: data.responseData,
    })
    return {}
  })
  mocks.txOrderCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    const d = data as { orderNumber: number; customerName?: string; notes?: string; location?: { connect?: { id?: string } } }
    state.orderSeq += 1
    const row = {
      id: `ord-new-${state.orderSeq}`,
      orderNumber: d.orderNumber,
      locationId: d.location?.connect?.id ?? '',
      customerName: d.customerName ?? '',
      notes: d.notes ?? '',
    }
    state.orders.push(row)
    return { ...row, total: 21.3, orderItems: [], deliveryInfo: {} }
  })

  // integracije po envelope id
  mocks.integrationFindFirst.mockImplementation(async ({ where }: { where: { id: string; provider: string } }) => {
    const found = ALL_INTEGRATIONS.find(i => i.id === where.id && i.provider === where.provider)
    return found ? { ...found } : null
  })
  mocks.parseWebhookEnvelope.mockImplementation(() => ({ ok: true, integrationId: state.envelopeIntegrationId }))
  mocks.integrationUpdate.mockResolvedValue({})
  mocks.checkRateLimitAsync.mockResolvedValue({ allowed: true, retryAfterMs: 1000 })
  mocks.getClientIp.mockReturnValue('203.0.113.9')
  mocks.getNextOrderNumber.mockImplementation(async (locationId: string) => {
    state.orderSeq += 1
    return 100 + state.orderSeq
  })
  mocks.emitOrderCreated.mockResolvedValue(undefined)
  mocks.emitEvent.mockResolvedValue(undefined)
  mocks.deductInventoryWolt.mockResolvedValue(undefined)
  mocks.deductInventoryGlovo.mockResolvedValue(undefined)
  mocks.logAndSyncWolt.mockImplementation(async (integrationId: string, body: string, orderId: string, orderNumber: number) => {
    state.logs.push({
      integrationId,
      action: 'receive_order',
      direction: 'inbound',
      status: 'success',
      requestData: body.substring(0, 2000),
      responseData: JSON.stringify({ orderId, orderNumber }),
    })
  })
  mocks.logAndSyncGlovo.mockImplementation(async (integrationId: string, body: string, orderId: string, orderNumber: number) => {
    state.logs.push({
      integrationId,
      action: 'receive_order',
      direction: 'inbound',
      status: 'success',
      requestData: body.substring(0, 2000),
      responseData: JSON.stringify({ orderId, orderNumber }),
    })
  })
  mocks.menuItemFindMany.mockResolvedValue([MENU_ITEM])
  mocks.txMenuItemFindMany.mockResolvedValue([MENU_ITEM])
  mocks.txMenuItemFindFirst.mockResolvedValue(MENU_ITEM)
})

// ══════════════════════════════════════════════════════════════════
// BOLT-1 — ista integracija + isti Bolt order_id → replay ISTEGA ordera
// ══════════════════════════════════════════════════════════════════
describe('R117 BOLT-1: same integration + same provider order id → replay', () => {
  it('prvi webhook ustvari (201), ponovljen webhook replaya prek integrationLog identitete (200, isti order, NI drugega create-a)', async () => {
    const first = await boltPOST(boltRequest('bolt-900'))
    expect(first.status).toBe(201)
    const firstBody = await first.json() as { orderId: string; orderNumber: number }

    expect(state.orders).toHaveLength(1)
    // route je zapisal kanonski log (order_received / inbound / success)
    expect(state.logs).toHaveLength(1)
    expect(state.logs[0]).toMatchObject({ integrationId: 'int-bolt-a', action: 'order_received' })

    // redelivery ISTEGA webhooka ISTI integraciji
    const second = await boltPOST(boltRequest('bolt-900'))
    expect(second.status).toBe(200)
    const secondBody = await second.json() as { success: boolean; message: string; orderId: string; orderNumber: number }
    expect(secondBody.success).toBe(true)
    expect(secondBody.message).toBe('Naročilo že obstaja')
    expect(secondBody.orderId).toBe(firstBody.orderId)
    expect(secondBody.orderNumber).toBe(firstBody.orderNumber)
    // točno EN order v bazi
    expect(state.orders).toHaveLength(1)
  })

  it('replay tudi brez loga prek legacy fallbacka (zgodovinski customerName zapis, ista lokacija)', async () => {
    // Zgodovinski order (pred log modelom): customerName nosilec identitete
    state.orders.push({ id: 'ord-legacy-1', orderNumber: 7, locationId: LOC_A, customerName: 'Bolt:bolt-800 — Stara Metka', notes: '' })
    const res = await boltPOST(boltRequest('bolt-800'))
    expect(res.status).toBe(200)
    const body = await res.json() as { orderId: string; orderNumber: number }
    expect(body.orderId).toBe('ord-legacy-1')
    expect(body.orderNumber).toBe(7)
    expect(state.orders).toHaveLength(1)
    // legacy fallback je bil lokacijsko scoped
    expect(state.lastOrderWhere).toMatchObject({ locationId: LOC_A })
    expect((state.lastOrderWhere as { customerName?: { startsWith?: string } }).customerName?.startsWith).toBe('Bolt:bolt-800 — ')
  })
})

// ══════════════════════════════════════════════════════════════════
// BOLT-2 — druga integracija + isti provider order id → NI duplikat
// ══════════════════════════════════════════════════════════════════
describe('R117 BOLT-2: different integration + same provider order id → new order', () => {
  it('integracija B ne replaya ordera integracije A — ustvari svojega (201) na svoji lokaciji', async () => {
    // prvi webhook prek integracije A (lokacija A)
    const first = await boltPOST(boltRequest('bolt-shared'))
    expect(first.status).toBe(201)
    const firstBody = await first.json() as { orderId: string }

    // isti Bolt order_id prek integracije B (lokacija B)
    state.envelopeIntegrationId = 'int-bolt-b'
    const second = await boltPOST(boltRequest('bolt-shared'))
    expect(second.status).toBe(201)
    const secondBody = await second.json() as { orderId: string }

    // DVA ločena orderja — identiteta je vezana na integracijo
    expect(state.orders).toHaveLength(2)
    expect(secondBody.orderId).not.toBe(firstBody.orderId)
    expect(state.orders[0].locationId).toBe(LOC_A)
    expect(state.orders[1].locationId).toBe(LOC_B)
  })
})

// ══════════════════════════════════════════════════════════════════
// BOLT-3 — numerična prefix kolizija: 123 nikoli ne ujame 1234 (in obratno)
// ══════════════════════════════════════════════════════════════════
describe('R117 BOLT-3: prefix collision 123 vs 1234 → NI false duplicate', () => {
  it('obstoječ Bolt:1234 — incoming 123 → NI replay, ustvari novo naročilo', async () => {
    state.orders.push({ id: 'ord-legacy-1234', orderNumber: 10, locationId: LOC_A, customerName: 'Bolt:1234 — Legacy', notes: '' })
    const res = await boltPOST(boltRequest('123'))
    expect(res.status).toBe(201)
    const body = await res.json() as { orderId: string }
    expect(body.orderId).not.toBe('ord-legacy-1234')
    expect(state.orders).toHaveLength(2)
    // where-shape pin: delimiter-exact startsWith (NI contains)
    const w = state.lastOrderWhere as { customerName?: { startsWith?: string }; locationId?: string }
    expect(w.customerName?.startsWith).toBe('Bolt:123 — ')
    expect(w.locationId).toBe(LOC_A)
    expect(w.customerName).not.toHaveProperty('contains')
  })

  it('obstoječ Bolt:123 — incoming 1234 → NI replay, ustvari novo naročilo', async () => {
    state.orders.push({ id: 'ord-legacy-123', orderNumber: 11, locationId: LOC_A, customerName: 'Bolt:123 — Legacy', notes: '' })
    const res = await boltPOST(boltRequest('1234'))
    expect(res.status).toBe(201)
    const body = await res.json() as { orderId: string }
    expect(body.orderId).not.toBe('ord-legacy-123')
    expect(state.orders).toHaveLength(2)
    const w = state.lastOrderWhere as { customerName?: { startsWith?: string } }
    expect(w.customerName?.startsWith).toBe('Bolt:1234 — ')
  })
})

// ══════════════════════════════════════════════════════════════════
// BOLT-4 — cross-location: webhook za lokacijo B NIKOLI ne vrne/replay-a
//          ordera lokacije A in ni tiho pogoltnjen
// ══════════════════════════════════════════════════════════════════
describe('R117 BOLT-4: cross-location → never return foreign order, never swallow', () => {
  it('Bolt order lokacije A + webhook prek integracije lokacije B → nov order na B (NI replay tujega)', async () => {
    state.orders.push({ id: 'ord-legacy-locA', orderNumber: 5, locationId: LOC_A, customerName: 'Bolt:555 — Ana', notes: '' })

    state.envelopeIntegrationId = 'int-bolt-b' // integracija, žigana na LOC_B
    const res = await boltPOST(boltRequest('555'))
    expect(res.status).toBe(201)
    const body = await res.json() as { orderId: string }

    // webhooK NI bil pogoltnjen: nov order na lokaciji B
    expect(state.orders).toHaveLength(2)
    expect(body.orderId).not.toBe('ord-legacy-locA')
    expect(state.orders[1].locationId).toBe(LOC_B)
    // lookup je bil scoped na webhook lokacijo (B), ne na A
    expect(state.lastOrderWhere).toMatchObject({ locationId: LOC_B })
  })

  it('unscoped regresija bi bila ujeta: bi bilo, da bi fallback iskal brez locationId, bi test failnil', async () => {
    // Dokumentira zaščitno vrednost modela: če helper izgubi locationId scope
    // (regresija na unscoped contains/startsWith), model vrne tuj order →
    // helper replaya tujega → test BOLT-4 zgoraj failne. Ta test pini
    // where-shape neposredno.
    state.orders.push({ id: 'ord-legacy-locA', orderNumber: 5, locationId: LOC_A, customerName: 'Bolt:555 — Ana', notes: '' })
    state.envelopeIntegrationId = 'int-bolt-b'
    await boltPOST(boltRequest('555'))
    const w = state.lastOrderWhere as { locationId?: string; customerName?: Record<string, unknown> }
    // OBVEZNO: lokacijski scope + startsWith (ne contains)
    expect(w.locationId).toBe(LOC_B)
    expect(w.customerName).toHaveProperty('startsWith')
    expect(w.customerName).not.toHaveProperty('contains')
  })
})

// ══════════════════════════════════════════════════════════════════
// BOLT-5 — sočasna duplikat redeliverija: točno EN order ustvarjen/replay-an
//          (realna $transaction struktura + advisory lock emulacija)
// ══════════════════════════════════════════════════════════════════
describe('R117 BOLT-5: concurrent duplicate webhook → exactly one Order', () => {
  it('Promise.all dveh enakih webhookov → točno en create, eden 201, drugi 200 replay z istim orderId', async () => {
    const [r1, r2] = await Promise.all([
      boltPOST(boltRequest('bolt-concurrent')),
      boltPOST(boltRequest('bolt-concurrent')),
    ])
    const statuses = [r1.status, r2.status].sort()
    // eden je ustvaril (201), drugi je replayał (200) — ali obratno vrstni red
    expect(statuses).toEqual([200, 201])

    const b1 = await r1.json() as { orderId: string; orderNumber: number }
    const b2 = await r2.json() as { orderId: string; orderNumber: number }
    // oba odgovora nosita ISTI order (idempotenten kontrakt)
    expect(b1.orderId).toBe(b2.orderId)
    expect(b1.orderNumber).toBe(b2.orderNumber)
    // točno EN order v bazi
    expect(state.orders).toHaveLength(1)
    expect(state.orders[0].locationId).toBe(LOC_A)
  })
})

// ══════════════════════════════════════════════════════════════════
// H-2 — WOLT / GLOVO legacy fallback cross-location regresija
// ══════════════════════════════════════════════════════════════════
describe('R117 H-2 Wolt: legacy notes fallback cross-location', () => {
  it('Wolt order lokacije A (notes WOLT:w-9) + webhook za lokacijo B → NI replay A-jevega, nov order na B', async () => {
    state.orders.push({ id: 'ord-wolt-locA', orderNumber: 5, locationId: LOC_A, customerName: 'Janez', notes: 'WOLT:w-9 | opomba' })

    state.envelopeIntegrationId = 'int-wolt-b'
    const res = await woltPOST(webhookRequest('http://localhost/api/delivery/webhook/wolt?t=env:hmac', WOLT_PAYLOAD('w-9')))
    expect(res.status).toBe(200)
    const body = await res.json() as { status: string; orderId: string }
    expect(body.status).toBe('accepted')
    // NI replay tujega ordera — nov order na lokaciji B
    expect(body.orderId).not.toBe('ord-wolt-locA')
    expect(state.orders).toHaveLength(2)
    expect(state.orders[1].locationId).toBe(LOC_B)
    // fallback lookup je bil scoped na lokacijo B
    expect(state.lastOrderWhere).toMatchObject({ locationId: LOC_B })
  })

  it('normalen same-location legacy replay še vedno deluje (backward compat ohranjen)', async () => {
    state.orders.push({ id: 'ord-wolt-locA', orderNumber: 5, locationId: LOC_A, customerName: 'Janez', notes: 'WOLT:w-9 | opomba' })

    state.envelopeIntegrationId = 'int-wolt-a' // ista lokacija
    const res = await woltPOST(webhookRequest('http://localhost/api/delivery/webhook/wolt?t=env:hmac', WOLT_PAYLOAD('w-9')))
    expect(res.status).toBe(200)
    const body = await res.json() as { status: string; orderId: string }
    expect(body.status).toBe('accepted')
    expect(body.orderId).toBe('ord-wolt-locA')
    // NI novega orderja — legacy replay na isti lokaciji
    expect(state.orders).toHaveLength(1)
  })
})

describe('R117 H-2 Glovo: legacy notes fallback cross-location', () => {
  it('Glovo order lokacije A (notes GLOVO:g-9) + webhook za lokacijo B → NI replay A-jevega, nov order na B', async () => {
    state.orders.push({ id: 'ord-glovo-locA', orderNumber: 6, locationId: LOC_A, customerName: 'Mojca', notes: 'GLOVO:g-9 | opomba' })

    state.envelopeIntegrationId = 'int-glovo-b'
    const res = await glovoPOST(webhookRequest('http://localhost/api/delivery/webhook/glovo?t=env:hmac', GLOVO_PAYLOAD('g-9')))
    expect(res.status).toBe(200)
    const body = await res.json() as { status: string; orderId: string }
    expect(body.status).toBe('accepted')
    expect(body.orderId).not.toBe('ord-glovo-locA')
    expect(state.orders).toHaveLength(2)
    expect(state.orders[1].locationId).toBe(LOC_B)
    expect(state.lastOrderWhere).toMatchObject({ locationId: LOC_B })
  })

  it('normalen same-location legacy replay še vedno deluje (backward compat ohranjen)', async () => {
    state.orders.push({ id: 'ord-glovo-locA', orderNumber: 6, locationId: LOC_A, customerName: 'Mojca', notes: 'GLOVO:g-9 | opomba' })

    state.envelopeIntegrationId = 'int-glovo-a'
    const res = await glovoPOST(webhookRequest('http://localhost/api/delivery/webhook/glovo?t=env:hmac', GLOVO_PAYLOAD('g-9')))
    expect(res.status).toBe(200)
    const body = await res.json() as { status: string; orderId: string }
    expect(body.status).toBe('accepted')
    expect(body.orderId).toBe('ord-glovo-locA')
    expect(state.orders).toHaveLength(1)
  })
})

// ══════════════════════════════════════════════════════════════════
// Strukturni pini — reintrodukcija unscoped dedupa je prepovedana
// ══════════════════════════════════════════════════════════════════
describe('R117 strukturni pini: scoped dedup kanon v viru', () => {
  const boltHelpersSrc = readFileSync(join(process.cwd(), 'src/app/api/delivery/webhook/bolt/_helpers/index.ts'), 'utf-8')
  const woltMappingSrc = readFileSync(join(process.cwd(), 'src/app/api/delivery/webhook/wolt/_helpers/wolt-mapping.ts'), 'utf-8')
  const glovoIdemSrc = readFileSync(join(process.cwd(), 'src/app/api/delivery/webhook/glovo/_helpers/glovo-idempotency.ts'), 'utf-8')
  const boltRouteSrc = readFileSync(join(process.cwd(), 'src/app/api/delivery/webhook/bolt/route.ts'), 'utf-8')

  it('Bolt helper: integrationLog kanon + lokacijsko scoped legacy startsWith; unscoped customerName contains IZKORENJEN', () => {
    // kanonski model (Wolt/Glovo identiteta)
    expect(boltHelpersSrc).toContain('integrationLog.findMany')
    expect(boltHelpersSrc).toContain("action: 'order_received'")
    // exact JSON identiteta, ne substring odločitev
    expect(boltHelpersSrc).toContain('data.boltOrderId === boltOrderId')
    // legacy fallback: lokacijski scope + delimiter-exact startsWith
    expect(boltHelpersSrc).toContain('locationId: webhookLocationId')
    expect(boltHelpersSrc).toContain('startsWith: boltLegacyCustomerNamePrefix(boltOrderId)')
    // prepovedani vzorec (H-1) je izkoreninjen
    expect(boltHelpersSrc).not.toContain('customerName: { contains:')
    expect(boltHelpersSrc).not.toContain("contains: `Bolt:${boltOrderId}`")
  })

  it('Wolt helper: legacy notes fallback lokacijsko scoped', () => {
    expect(woltMappingSrc).toContain('locationId: webhookLocationId, notes: { contains: `WOLT:${orderId}` }')
  })

  it('Glovo helper: legacy notes fallback lokacijsko scoped', () => {
    expect(glovoIdemSrc).toContain('locationId: webhookLocationId, notes: { contains: `GLOVO:${orderId}` }')
  })

  it('Bolt route: lokacijska resolucija PRED fast-path dedupom (R112 lock/tx kanon nespremenjen)', () => {
    // R112 pini ostajajo (advisory lock + Serializable + scoped menu)
    expect(boltRouteSrc).toContain('pg_advisory_xact_lock')
    expect(boltRouteSrc).toContain('delivery-webhook:')
    expect(boltRouteSrc).toContain('TransactionIsolationLevel.Serializable')
    // R117: lokacija je resolve-ana pred dedup fast-path (indexOf pin)
    expect(boltRouteSrc.indexOf('const webhookLocationId')).toBeGreaterThan(-1)
    expect(boltRouteSrc.indexOf('findExistingBoltOrder(data.order_id, webhookLocationId'))
      .toBeGreaterThan(boltRouteSrc.indexOf('Ni nastavljene lokacije'))
    // dedup klici nosijo scope
    expect(boltRouteSrc).toContain('findExistingBoltOrder(data.order_id, webhookLocationId, boltIntegration.id)')
    expect(boltRouteSrc).toContain('findExistingBoltOrder(data.order_id, webhookLocationId, boltIntegration.id, tx)')
  })
})
