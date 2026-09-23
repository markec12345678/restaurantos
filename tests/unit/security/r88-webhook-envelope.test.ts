// ============================================
// R88-2 — DELIVERY WEBHOOK PER-TENANT ATRIBUCIJA + Integration.locationId
// ============================================
// Zapira zadnjo R87-FINAL odprtino: delivery webhooki wolt/glovo/bolt so
// prej pozvali SAMO globalni integration.findFirst({ provider, isActive })
// (prva integracija poljubnega tenanta — brez tenant atribucije) in žigali
// naročilo na GLOBALNO prvo aktivno lokacijo KATEREGA KOLI tenanta
// (resolveDefaultLocationId) = cross-tenant naročilo, tuj order counter,
// tuj KDS broadcast, odbitek tuje zaloge.
//
// NOVO vedenje (kanon, vsi trije webhooki):
//   1. rate limit (nespremenjen)
//   2. R82-D kanon: produkcija brez ORDERING_TOKEN_SECRET → 503 fail-closed
//      PRED kakršno koli verifikacijo (dev/test fallback dovoljen)
//   3. envelope `?t=<integrationId>:<hmac64>` (lib/ordering-token.ts,
//      timing-safe HMAC nad `delivery-webhook:v1:<integrationId>`) —
//      manjkajoč/malformiran/tuj → ISTI unificiran 404 'Integracija ni
//      najdena' (NI obstoja-oraklja) + ZERO db klicev
//   4. tenant atribucija: integration.findFirst({ id: VERIFICIRAN,
//      provider, isActive: true }) — null → isti 404
//   5. apiSecret/signature 401-ji (D-01, nespremenjeni; bolt: lasten
//      fail-closed 503 brez secreta)
//   6. lokacija IZ integracije (Integration.locationId) — null → 503
//      'Ni nastavljene lokacije' (platforma retry-a); globalni
//      resolveDefaultLocationId fallback IZKORENJEN (regresijski pin).
//
// Integrations [id] API: GET webhookUrl (samo delivery providerji; produkcija
// brez secret-a → polje izpuščeno), GET/PUT/DELETE tenant scope
// (resolveTenantLocationIdOrThrow + isWithinScope → notInScopeResponse 404;
// NULL-žigana integracija vidna SAMO super-adminu), PUT locationId po MODEL A
// write kanonu (R87 guests POST vzorec; super-admin null = brisanje žiga).
//
// Vzorec (r87-*): vi.hoisted + vi.mock; @/lib/tenant-scope NI mockan (realen
// resolver); @/lib/ordering-token NI mockan (realen HMAC); mockResolvedValue
// (nikoli .Once); ZERO-write asserti; where-shape pini.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'
import crypto from 'crypto'

const mocks = vi.hoisted(() => ({
  // db
  integrationFindFirst: vi.fn(),
  integrationFindUnique: vi.fn(),
  integrationUpdate: vi.fn(),
  integrationLogFindMany: vi.fn(),
  integrationLogCreate: vi.fn(),
  orderCreate: vi.fn(),
  orderFindFirst: vi.fn(),
  menuItemFindFirst: vi.fn(),
  menuItemFindMany: vi.fn(),
  locationFindFirst: vi.fn(),
  // infra
  checkRateLimit: vi.fn(),
  getNextOrderNumber: vi.fn(),
  resolveDefaultLocationId: vi.fn(), // regresijski pin: sme ostati NIKOLI poklican
  emitOrderCreated: vi.fn(),
  broadcastWSEvent: vi.fn(),
  wsBroadcastEvent: vi.fn(),
  // wolt/glovo helper write-poti (schema/constants ostajajo REALNI)
  findExistingWoltOrder: vi.fn(),
  mapWoltItems: vi.fn(),
  findExistingGlovoOrder: vi.fn(),
  mapGlovoProducts: vi.fn(),
  deductInventory: vi.fn(),
  logAndSyncIntegration: vi.fn(),
  // integrations [id]
  requireAuth: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    integration: {
      findFirst: mocks.integrationFindFirst,
      findUnique: mocks.integrationFindUnique,
      update: mocks.integrationUpdate,
    },
    integrationLog: {
      findMany: mocks.integrationLogFindMany,
      create: mocks.integrationLogCreate,
    },
    order: { create: mocks.orderCreate, findFirst: mocks.orderFindFirst },
    menuItem: { findFirst: mocks.menuItemFindFirst, findMany: mocks.menuItemFindMany },
    location: { findFirst: mocks.locationFindFirst },
    // FIX R112 (WEBHOOK-1/2): dedup + order create sta zdaj ENA Serializable tx
    // pod advisory lock-om — tx klient mora nositi iste mocke (isti vir resnice,
    // asserti nad orderCreate/menuItemFindMany ostanejo veljavni).
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({
      $executeRaw: vi.fn().mockResolvedValue(0),
      order: { create: mocks.orderCreate, findFirst: mocks.orderFindFirst },
      menuItem: { findFirst: mocks.menuItemFindFirst, findMany: mocks.menuItemFindMany },
    })),
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.checkRateLimit,
  getClientIp: vi.fn(() => '1.2.3.4'),
  DELIVERY_WEBHOOK_LIMIT: { maxRequests: 30, windowMs: 60000 },
  // R92-a: integrations/[id] PUT/DELETE zdaj trošita vedro 'integrations-mutate'
  // (AUTHENTICATED_LIMIT mora obstajati v mocku — ruta ga podaja kot tretji argument)
  AUTHENTICATED_LIMIT: { maxRequests: 120, windowMs: 60000 },
}))

vi.mock('@/lib/counters', () => ({
  getNextOrderNumber: mocks.getNextOrderNumber,
  resolveDefaultLocationId: mocks.resolveDefaultLocationId,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  // FIX R112: bolt/wolt/glovo catch kontrakt zdaj gre čez structuredErrorResponse
  // → handleApiError → generateRequestId (mock mora obstajati)
  generateRequestId: vi.fn(() => 'req-test'),
}))

vi.mock('@/lib/event-emitter', () => ({
  emitOrderCreated: mocks.emitOrderCreated,
}))

vi.mock('@/lib/websocket-client', () => ({
  broadcastWSEvent: mocks.broadcastWSEvent,
}))

vi.mock('@/lib/ws-server-broadcast', () => ({
  wsBroadcastEvent: mocks.wsBroadcastEvent,
}))

// wolt/glovo helperji: REALNA shema + konstante + broadcast (zrcali r87
// public-order vzorec); pisne helper poti mockane (zaloga/log — tečejo PO
// order create-u, za tukajšnje pini niso potrebne v celoti izvajane).
vi.mock('@/app/api/delivery/webhook/wolt/_helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/api/delivery/webhook/wolt/_helpers')>()
  return {
    ...actual,
    findExistingWoltOrder: mocks.findExistingWoltOrder,
    mapWoltItemsToOrderItems: mocks.mapWoltItems,
    deductInventoryForOrder: mocks.deductInventory,
    logAndSyncIntegration: mocks.logAndSyncIntegration,
  }
})

vi.mock('@/app/api/delivery/webhook/glovo/_helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/api/delivery/webhook/glovo/_helpers')>()
  return {
    ...actual,
    findExistingGlovoOrder: mocks.findExistingGlovoOrder,
    mapGlovoProductsToOrderItems: mocks.mapGlovoProducts,
    deductInventoryForOrder: mocks.deductInventory,
    logAndSyncIntegration: mocks.logAndSyncIntegration,
  }
})

// integrations [id]: mock requireAuth, REALEN tenant-scope resolver (r87
// vzorec — ruta ga importira direktno iz '@/lib/tenant-scope', ta modul ni
// mockan, zato teče produkcijska logika).
vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: mocks.requireAuth,
}))

import { POST as woltPOST } from '@/app/api/delivery/webhook/wolt/route'
import { POST as glovoPOST } from '@/app/api/delivery/webhook/glovo/route'
import { POST as boltPOST } from '@/app/api/delivery/webhook/bolt/route'
import { GET as integrationGET, PUT as integrationPUT } from '@/app/api/integrations/[id]/route'
import { parseWebhookEnvelope, webhookEnvelopeTokenFor } from '@/lib/ordering-token'
import { signPayload } from '@/lib/webhook-engine'
import { getAppUrl } from '@/lib/utils'

const INT_WOLT = 'intwolt0001'
const INT_GLOVO = 'intglovo001'
const INT_BOLT = 'intbolt0001'
const INT_UNKNOWN = 'intUnknown99'
const LOC_A = 'loc-tenant-a'
const LOC_B = 'loc-tenant-b'
const WOLT_SECRET = 'wolt-secret'
const BOLT_SECRET = 'bolt-secret'

// ---- Envelope/payload helperji ----

function woltEnvelope(integrationId = INT_WOLT) {
  return webhookEnvelopeTokenFor(integrationId)
}

function woltUrl(t?: string | null) {
  return t === null
    ? 'http://localhost:3000/api/delivery/webhook/wolt'
    : `http://localhost:3000/api/delivery/webhook/wolt?t=${t ?? woltEnvelope()}`
}

function woltRequest(body: unknown, t?: string | null) {
  return new Request(woltUrl(t), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-wolt-signature': signPayload(typeof body === 'string' ? body : JSON.stringify(body), WOLT_SECRET),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function makeWoltBody(over: Record<string, unknown> = {}) {
  return {
    order_id: 'w-1',
    items: [{ item_id: 'mi-1', name: 'Pizza', count: 1 }],
    ...over,
  }
}

function glovoUrl(t: string) {
  return `http://localhost:3000/api/delivery/webhook/glovo?t=${t}`
}

function makeGlovoBody(over: Record<string, unknown> = {}) {
  return {
    order_id: 'g-1',
    products: [{ product_id: 'mi-1', name: 'Pizza', quantity: 1 }],
    ...over,
  }
}

function glovoRequest(body: unknown, secret = WOLT_SECRET) {
  const raw = JSON.stringify(body)
  return new Request(glovoUrl(webhookEnvelopeTokenFor(INT_GLOVO)), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-glovo-signature': signPayload(raw, secret) },
    body: raw,
  })
}

function boltRequest(body: unknown, t = webhookEnvelopeTokenFor(INT_BOLT), secret?: string) {
  const raw = JSON.stringify(body)
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (secret) {
    headers['x-bolt-signature'] = crypto.createHmac('sha256', secret).update(raw).digest('hex')
  }
  return new Request(`http://localhost:3000/api/delivery/webhook/bolt?t=${t}`, {
    method: 'POST',
    headers,
    body: raw,
  })
}

function makeBoltBody(over: Record<string, unknown> = {}) {
  return {
    order_id: 'b-1',
    total_price: 6.1,
    items: [{ id: 'bi-1', name: 'Kebab', quantity: 1, price: 5, options: [] }],
    ...over,
  }
}

/** R88-2 regresijski pin: NOBENA pisna operacija v webhook toku se ni zgodila. */
function expectZeroWebhookWrites() {
  expect(mocks.orderCreate).not.toHaveBeenCalled()
  expect(mocks.integrationLogCreate).not.toHaveBeenCalled()
  expect(mocks.integrationUpdate).not.toHaveBeenCalled()
  expect(mocks.getNextOrderNumber).not.toHaveBeenCalled()
  expect(mocks.emitOrderCreated).not.toHaveBeenCalled()
  expect(mocks.wsBroadcastEvent).not.toHaveBeenCalled()
  expect(mocks.broadcastWSEvent).not.toHaveBeenCalled()
}

/**
 * R82-D kanon: zaženi test v "produkciji brez ORDERING_TOKEN_SECRET"
 * (vsi štirje kandidati za skrivnost odstranjeni; NODE_ENV=production).
 * VseENO obnovi prejšnje okolje (setup.ts nastavi ENCRYPTION_KEY).
 */
async function withProductionNoSecret(fn: () => Promise<void>) {
  const prevNodeEnv = process.env.NODE_ENV
  const keys = ['ORDERING_TOKEN_SECRET', 'QR_PAY_SECRET', 'ENCRYPTION_KEY', 'NEXTAUTH_SECRET']
  const saved = keys.map((k) => [k, process.env[k]] as const)
  // @ts-expect-error — NODE_ENV je read-only v type defs (isti vzorec kot tests/setup.ts)
  process.env.NODE_ENV = 'production'
  for (const k of keys) delete process.env[k]
  try {
    await fn()
  } finally {
    // @ts-expect-error — glej zgoraj
    process.env.NODE_ENV = prevNodeEnv
    for (const [k, v] of saved) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.checkRateLimit.mockResolvedValue({ allowed: true, retryAfterMs: 60000 })
  mocks.integrationFindFirst.mockResolvedValue(null)
  mocks.integrationFindUnique.mockResolvedValue(null)
  mocks.integrationUpdate.mockResolvedValue({ id: INT_WOLT, provider: 'wolt' })
  mocks.integrationLogFindMany.mockResolvedValue([])
  mocks.integrationLogCreate.mockResolvedValue({})
  mocks.orderFindFirst.mockResolvedValue(null)
  mocks.orderCreate.mockResolvedValue({ id: 'ord-1', orderNumber: 7, total: 6.1, orderItems: [], locationId: LOC_A })
  mocks.menuItemFindFirst.mockResolvedValue({ id: 'mi-1', name: 'Pizza', price: 5, vatRate: 22 })
  mocks.menuItemFindMany.mockResolvedValue([{ id: 'mi-1', name: 'Kebab', price: 5, vatRate: 22 }])
  mocks.locationFindFirst.mockResolvedValue({ id: LOC_A })
  mocks.getNextOrderNumber.mockResolvedValue(7)
  mocks.emitOrderCreated.mockResolvedValue(undefined)
  mocks.findExistingWoltOrder.mockResolvedValue(null)
  mocks.findExistingGlovoOrder.mockResolvedValue(null)
  mocks.mapWoltItems.mockResolvedValue([
    { menuItemId: 'mi-1', quantity: 1, price: 5, vatRate: 22, vatAmount: 1.1, discountAmount: 0, notes: '', status: 'pending' },
  ])
  mocks.mapGlovoProducts.mockResolvedValue([
    { menuItemId: 'mi-1', quantity: 1, price: 5, vatRate: 22, vatAmount: 1.1, discountAmount: 0, notes: '', status: 'pending' },
  ])
  mocks.deductInventory.mockResolvedValue(undefined)
  mocks.logAndSyncIntegration.mockResolvedValue(undefined)
})

// ══════════════════════════════════════════════════════════════════
// A. LIB — webhook envelope (realen @/lib/ordering-token)
// ══════════════════════════════════════════════════════════════════
describe('R88-2 A: webhook envelope format + timing-safe verifikacija', () => {
  it('format: `<integrationId>:<64 hex>`', () => {
    const t = woltEnvelope()
    expect(t).toMatch(/^intwolt0001:[a-f0-9]{64}$/)
  })

  it('veljaven envelope → ok:true z VERIFICIRANIM integrationId', () => {
    const parsed = parseWebhookEnvelope(woltEnvelope())
    expect(parsed).toEqual({ ok: true, integrationId: INT_WOLT })
  })

  it('tampered mac (zadnji hex znak) → ok:false', () => {
    const t = woltEnvelope()
    const tampered = `${t.slice(0, -1)}${t.endsWith('0') ? '1' : '0'}`
    expect(parseWebhookEnvelope(tampered)).toEqual({ ok: false })
  })

  it('mac tujega id-ja (envelope za A, mac izračunan nad B) → ok:false', () => {
    const macOfB = woltEnvelope('bbbb2222').split(':')[1]
    expect(parseWebhookEnvelope(`aaaa1111:${macOfB}`)).toEqual({ ok: false })
  })

  it('non-string (undefined/null/številka) → ok:false', () => {
    expect(parseWebhookEnvelope(undefined)).toEqual({ ok: false })
    expect(parseWebhookEnvelope(null)).toEqual({ ok: false })
    expect(parseWebhookEnvelope(42 as unknown as string)).toEqual({ ok: false })
  })

  it('malformiran (brez ločila / kratek id / slaba dolžina mac) → ok:false', () => {
    expect(parseWebhookEnvelope('nolocila')).toEqual({ ok: false })
    expect(parseWebhookEnvelope('ab:0'.padEnd(10, '0'))).toEqual({ ok: false })
    expect(parseWebhookEnvelope(`${INT_WOLT}:deadbeef`)).toEqual({ ok: false })
  })
})

// ══════════════════════════════════════════════════════════════════
// B. WOLT (representativna ruta) — envelope gate + tenant atribucija
// ══════════════════════════════════════════════════════════════════
describe('R88-2 B: POST /api/delivery/webhook/wolt — envelope + atribucija', () => {
  it('manjkajoč ?t → 404 unificiran + ZERO db klicev + ZERO pisnih klicev', async () => {
    const res = await woltPOST(woltRequest(makeWoltBody(), null))
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Integracija ni najdena')
    expect(mocks.integrationFindFirst).not.toHaveBeenCalled()
    expectZeroWebhookWrites()
  })

  it('malformiran ?t → 404 unificiran (isti odgovor kot manjkajoč — ni oraklja)', async () => {
    const res = await woltPOST(woltRequest(makeWoltBody(), 'garbage'))
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Integracija ni najdena')
    expect(mocks.integrationFindFirst).not.toHaveBeenCalled()
    expectZeroWebhookWrites()
  })

  it('tampered envelope → 404 (timing-safe verifikacija v ruti)', async () => {
    const tampered = `${woltEnvelope().slice(0, -1)}${woltEnvelope().endsWith('0') ? '1' : '0'}`
    const res = await woltPOST(woltRequest(makeWoltBody(), tampered))
    expect(res.status).toBe(404)
    expect(mocks.integrationFindFirst).not.toHaveBeenCalled()
    expectZeroWebhookWrites()
  })

  it('veljaven envelope + neznana/neaktivna integracija → 404 unificiran', async () => {
    mocks.integrationFindFirst.mockResolvedValue(null)
    const res = await woltPOST(woltRequest(makeWoltBody()))
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Integracija ni najdena')
    // lookup gre SAMO po verificiranem id-ju + provider pin (nikoli globalni {provider, isActive})
    expect(mocks.integrationFindFirst.mock.calls[0][0].where).toEqual({
      id: INT_WOLT, provider: 'wolt', isActive: true,
    })
    expectZeroWebhookWrites()
  })

  it('najdena integracija brez apiSecret → 401 (D-01 nespremenjen)', async () => {
    mocks.integrationFindFirst.mockResolvedValue({ id: INT_WOLT, provider: 'wolt', isActive: true, apiSecret: '', locationId: LOC_A })
    const res = await woltPOST(woltRequest(makeWoltBody()))
    expect(res.status).toBe(401)
    expectZeroWebhookWrites()
  })

  it('slab podpis → 401 (nespremenjen)', async () => {
    mocks.integrationFindFirst.mockResolvedValue({ id: INT_WOLT, provider: 'wolt', isActive: true, apiSecret: WOLT_SECRET, locationId: LOC_A })
    const bad = woltRequest(makeWoltBody(), null)
    const res = await woltPOST(new Request(woltUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-wolt-signature': 'sha256=deadbeef' },
      body: JSON.stringify(makeWoltBody()),
    }))
    expect(res.status).toBe(401)
    expect(bad).toBeDefined()
    expectZeroWebhookWrites()
  })

  it('veljaven podpis + integration.locationId → order.create žig TOČNO te lokacije', async () => {
    mocks.integrationFindFirst.mockResolvedValue({ id: INT_WOLT, provider: 'wolt', isActive: true, apiSecret: WOLT_SECRET, locationId: LOC_A })
    mocks.orderCreate.mockResolvedValue({ id: 'ord-1', orderNumber: 7, total: 6.1, orderItems: [], locationId: LOC_A })

    const res = await woltPOST(woltRequest(makeWoltBody()))
    expect(res.status).toBe(200)
    const body = await res.json() as { status: string }
    expect(body.status).toBe('accepted')

    // žig naročila pinned na lokacijo IZ INTEGRACIJE
    expect(mocks.orderCreate.mock.calls[0][0].data.location).toEqual({ connect: { id: LOC_A } })
    // per-lokacijski order counter TOČNO TE lokacije (R112: + tx klient)
    expect(mocks.getNextOrderNumber).toHaveBeenCalledWith(LOC_A, expect.anything())
    // KDS broadcast na validirano lokacijo
    expect(mocks.wsBroadcastEvent).toHaveBeenCalledTimes(1)
    expect(mocks.wsBroadcastEvent.mock.calls[0][1].locationId).toBe(LOC_A)
    // globalni fallback IZKORENJEN (regresijski pin)
    expect(mocks.resolveDefaultLocationId).not.toHaveBeenCalled()
  })

  it('integration.locationId null → 503 "Ni nastavljene lokacije" + ZERO order.create', async () => {
    mocks.integrationFindFirst.mockResolvedValue({ id: INT_WOLT, provider: 'wolt', isActive: true, apiSecret: WOLT_SECRET, locationId: null })
    const res = await woltPOST(woltRequest(makeWoltBody()))
    expect(res.status).toBe(503)
    const body = await res.json() as { message: string }
    expect(body.message).toBe('Ni nastavljene lokacije')
    expect(mocks.orderCreate).not.toHaveBeenCalled()
    expect(mocks.getNextOrderNumber).not.toHaveBeenCalled()
    // NIKOLI globalna prva-lokacija fallback (R87-FINAL zaprt)
    expect(mocks.resolveDefaultLocationId).not.toHaveBeenCalled()
  })

  it('produkcija brez ORDERING_TOKEN_SECRET → 503 fail-closed (tudi z veljavnim envelope)', async () => {
    // Envelope/podpis se minta ŠE v testnem okolju (lib v produkciji brez
    // secreta namerno NE izda tokena — to je prav tisto vedenje, ki ga pinamo).
    const prebuilt = woltRequest(makeWoltBody())
    await withProductionNoSecret(async () => {
      const res = await woltPOST(prebuilt)
      expect(res.status).toBe(503)
      expect(mocks.integrationFindFirst).not.toHaveBeenCalled()
      expectZeroWebhookWrites()
    })
  })
})

// ══════════════════════════════════════════════════════════════════
// C. GLOVO + BOLT — provider pin in razlike
// ══════════════════════════════════════════════════════════════════
describe('R88-2 C: glovo/bolt — provider pin + lastne razlike', () => {
  it('glovo: lookup pripet na provider "glovo" + order.create žig integration.locationId', async () => {
    mocks.integrationFindFirst.mockResolvedValue({ id: INT_GLOVO, provider: 'glovo', isActive: true, apiSecret: WOLT_SECRET, locationId: LOC_B })
    const res = await glovoPOST(glovoRequest(makeGlovoBody()))
    expect(res.status).toBe(200)
    expect(mocks.integrationFindFirst.mock.calls[0][0].where).toEqual({
      id: INT_GLOVO, provider: 'glovo', isActive: true,
    })
    expect(mocks.orderCreate.mock.calls[0][0].data.location).toEqual({ connect: { id: LOC_B } })
    expect(mocks.getNextOrderNumber).toHaveBeenCalledWith(LOC_B, expect.anything())
    expect(mocks.resolveDefaultLocationId).not.toHaveBeenCalled()
  })

  it('glovo: wolt envelope (validen za tujo integracijo, ki ne obstaja pri providerju) → 404', async () => {
    mocks.integrationFindFirst.mockResolvedValue(null)
    const raw = JSON.stringify(makeGlovoBody())
    const res = await glovoPOST(new Request(glovoUrl(woltEnvelope()), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-glovo-signature': signPayload(raw, WOLT_SECRET) },
      body: raw,
    }))
    expect(res.status).toBe(404)
    expect(mocks.integrationFindFirst).toHaveBeenCalledWith({ where: { id: INT_WOLT, provider: 'glovo', isActive: true } })
    expectZeroWebhookWrites()
  })

  it('bolt: order create žig integration.locationId + 201 (bolt lasten odgovor)', async () => {
    mocks.integrationFindFirst.mockResolvedValue({ id: INT_BOLT, provider: 'bolt', isActive: true, apiSecret: BOLT_SECRET, locationId: LOC_A })
    const res = await boltPOST(boltRequest(makeBoltBody(), undefined, BOLT_SECRET))
    expect(res.status).toBe(201)
    expect(mocks.integrationFindFirst.mock.calls[0][0].where).toEqual({
      id: INT_BOLT, provider: 'bolt', isActive: true,
    })
    expect(mocks.orderCreate.mock.calls[0][0].data.location).toEqual({ connect: { id: LOC_A } })
    expect(mocks.getNextOrderNumber).toHaveBeenCalledWith(LOC_A, expect.anything())
    expect(mocks.resolveDefaultLocationId).not.toHaveBeenCalled()
  })

  it('bolt: brez apiSecret IN brez WEBHOOK_SECRET → 503 fail-closed (bolt lastna semantika)', async () => {
    mocks.integrationFindFirst.mockResolvedValue({ id: INT_BOLT, provider: 'bolt', isActive: true, apiSecret: null, locationId: LOC_A })
    const prevSecret = process.env.WEBHOOK_SECRET
    delete process.env.WEBHOOK_SECRET
    try {
      // Podpisni header JE prisoten (sicer bi 401 manjkajoči-podpis vrgel
      // prej) — brez secreta pa bolt lasten fail-closed 503.
      const res = await boltPOST(boltRequest(makeBoltBody(), undefined, 'kakor-koli'))
      expect(res.status).toBe(503)
    } finally {
      if (prevSecret !== undefined) process.env.WEBHOOK_SECRET = prevSecret
    }
    expectZeroWebhookWrites()
  })

  it('bolt: manjkajoč ?t → 404 unificiran (isti kanon kot wolt/glovo)', async () => {
    const res = await boltPOST(new Request('http://localhost:3000/api/delivery/webhook/bolt', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-bolt-signature': 'deadbeef' },
      body: JSON.stringify(makeBoltBody()),
    }))
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Integracija ni najdena')
    expect(mocks.integrationFindFirst).not.toHaveBeenCalled()
    expectZeroWebhookWrites()
  })
})

// ══════════════════════════════════════════════════════════════════
// D. INTEGRATIONS [id] GET — scope + webhookUrl izdaja
// ══════════════════════════════════════════════════════════════════
describe('R88-2 D: GET /api/integrations/[id] — scope + webhookUrl', () => {
  function session(overrides: Record<string, unknown> = {}) {
    mocks.requireAuth.mockResolvedValue({
      session: { employeeId: 'emp-1', role: 'staff', locationId: LOC_A, ...overrides },
      error: null,
    })
  }

  it('delivery provider (wolt) → webhookUrl z envelope tokenom + maskirana ključa', async () => {
    session({ role: 'admin', locationId: null })
    mocks.integrationFindUnique.mockResolvedValue({
      id: INT_WOLT, provider: 'wolt', locationId: LOC_A, apiKey: 'k', apiSecret: 's', logs: [],
    })
    const res = await integrationGET(
      new Request(`http://localhost:3000/api/integrations/${INT_WOLT}`),
      { params: Promise.resolve({ id: INT_WOLT }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json() as { webhookUrl?: string; apiKey: string }
    expect(body.webhookUrl).toBe(
      `${getAppUrl()}/api/delivery/webhook/wolt?t=${webhookEnvelopeTokenFor(INT_WOLT)}`,
    )
    // maskiranje ključev ostaja (nespremenjeno vedenje)
    expect(body.apiKey).toBe('••••••••')
  })

  it('non-delivery provider (eracuni) → webhookUrl polje IZPUŠČENO', async () => {
    session({ role: 'admin', locationId: null })
    mocks.integrationFindUnique.mockResolvedValue({
      id: INT_UNKNOWN, provider: 'eracuni', locationId: LOC_A, apiKey: '', apiSecret: '', logs: [],
    })
    const res = await integrationGET(
      new Request(`http://localhost:3000/api/integrations/${INT_UNKNOWN}`),
      { params: Promise.resolve({ id: INT_UNKNOWN }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(Object.prototype.hasOwnProperty.call(body, 'webhookUrl')).toBe(false)
  })

  it('tuja lokacija (žig LOC_B, seja LOC_A) → 404 notInScope', async () => {
    session()
    mocks.integrationFindUnique.mockResolvedValue({ id: INT_WOLT, provider: 'wolt', locationId: LOC_B, logs: [] })
    const res = await integrationGET(
      new Request(`http://localhost:3000/api/integrations/${INT_WOLT}`),
      { params: Promise.resolve({ id: INT_WOLT }) },
    )
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Integracija ni najden')
  })

  it('NULL-žigana integracija: loc-bound → 404 (samo super-admin jo vidi)', async () => {
    session()
    mocks.integrationFindUnique.mockResolvedValue({ id: INT_WOLT, provider: 'wolt', locationId: null, logs: [] })
    const res = await integrationGET(
      new Request(`http://localhost:3000/api/integrations/${INT_WOLT}`),
      { params: Promise.resolve({ id: INT_WOLT }) },
    )
    expect(res.status).toBe(404)
  })

  it('NULL-žigana integracija: super-admin → 200 (globalni nadzor)', async () => {
    session({ role: 'admin', locationId: null })
    mocks.integrationFindUnique.mockResolvedValue({ id: INT_WOLT, provider: 'wolt', locationId: null, logs: [] })
    const res = await integrationGET(
      new Request(`http://localhost:3000/api/integrations/${INT_WOLT}`),
      { params: Promise.resolve({ id: INT_WOLT }) },
    )
    expect(res.status).toBe(200)
  })

  it('produkcija brez secret-a → webhookUrl izpuščen (nikoli token z dev secretom)', async () => {
    await withProductionNoSecret(async () => {
      session({ role: 'admin', locationId: null })
      mocks.integrationFindUnique.mockResolvedValue({ id: INT_WOLT, provider: 'wolt', locationId: LOC_A, logs: [] })
      const res = await integrationGET(
        new Request(`http://localhost:3000/api/integrations/${INT_WOLT}`),
        { params: Promise.resolve({ id: INT_WOLT }) },
      )
      expect(res.status).toBe(200)
      const body = await res.json() as Record<string, unknown>
      expect(Object.prototype.hasOwnProperty.call(body, 'webhookUrl')).toBe(false)
    })
  })
})

// ══════════════════════════════════════════════════════════════════
// E. INTEGRATIONS [id] PUT — MODEL A write kanon za locationId
// ══════════════════════════════════════════════════════════════════
describe('R88-2 E: PUT /api/integrations/[id] — locationId write kanon', () => {
  function session(overrides: Record<string, unknown> = {}) {
    mocks.requireAuth.mockResolvedValue({
      session: { employeeId: 'emp-1', role: 'staff', locationId: LOC_A, ...overrides },
      error: null,
    })
  }

  function putRequest(body: unknown) {
    return new Request(`http://localhost:3000/api/integrations/${INT_WOLT}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('super-admin nastavi locationId → validiran proti DB + update žige kandidata', async () => {
    session({ role: 'admin', locationId: null })
    mocks.integrationFindUnique.mockResolvedValue({ id: INT_WOLT, provider: 'wolt', locationId: null })
    mocks.locationFindFirst.mockResolvedValue({ id: LOC_B })
    const res = await integrationPUT(putRequest({ locationId: LOC_B }), { params: Promise.resolve({ id: INT_WOLT }) })
    expect(res.status).toBe(200)
    expect(mocks.locationFindFirst).toHaveBeenCalledWith({ where: { id: LOC_B }, select: { id: true } })
    expect(mocks.integrationUpdate.mock.calls[0][0].data.locationId).toBe(LOC_B)
  })

  it('super-admin brez kandidata (prazen string) → 400 resolveWriteLocationId + ZERO update', async () => {
    session({ role: 'admin', locationId: null })
    mocks.integrationFindUnique.mockResolvedValue({ id: INT_WOLT, provider: 'wolt', locationId: null })
    const res = await integrationPUT(putRequest({ locationId: '  ' }), { params: Promise.resolve({ id: INT_WOLT }) })
    expect(res.status).toBe(400)
    expect(mocks.integrationUpdate).not.toHaveBeenCalled()
  })

  it('loc-bound osebje: body.locationId IGNORIRAN → žig session lokacije', async () => {
    session() // staff @ LOC_A
    mocks.integrationFindUnique.mockResolvedValue({ id: INT_WOLT, provider: 'wolt', locationId: LOC_A })
    const res = await integrationPUT(putRequest({ locationId: LOC_B }), { params: Promise.resolve({ id: INT_WOLT }) })
    expect(res.status).toBe(200)
    expect(mocks.integrationUpdate.mock.calls[0][0].data.locationId).toBe(LOC_A)
    expect(mocks.locationFindFirst).toHaveBeenCalledWith({ where: { id: LOC_A }, select: { id: true } })
  })

  it('super-admin locationId: null → izrecno brisanje žiga (integracija postane super-admin-only)', async () => {
    session({ role: 'admin', locationId: null })
    mocks.integrationFindUnique.mockResolvedValue({ id: INT_WOLT, provider: 'wolt', locationId: LOC_A })
    const res = await integrationPUT(putRequest({ locationId: null }), { params: Promise.resolve({ id: INT_WOLT }) })
    expect(res.status).toBe(200)
    const data = mocks.integrationUpdate.mock.calls[0][0].data
    expect(Object.prototype.hasOwnProperty.call(data, 'locationId')).toBe(true)
    expect(data.locationId).toBeNull()
    // brisanje žiga ne validira lokacije (ni referenca)
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
  })

  it('neznana lokacija (kandidat ni v DB) → 404 "Lokacija ni najden" + ZERO update', async () => {
    session({ role: 'admin', locationId: null })
    mocks.integrationFindUnique.mockResolvedValue({ id: INT_WOLT, provider: 'wolt', locationId: null })
    mocks.locationFindFirst.mockResolvedValue(null)
    const res = await integrationPUT(putRequest({ locationId: 'loc-ghost-99' }), { params: Promise.resolve({ id: INT_WOLT }) })
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Lokacija ni najden')
    expect(mocks.integrationUpdate).not.toHaveBeenCalled()
  })

  it('tuja integracija (žig LOC_B, seja LOC_A) → 404 + ZERO update (write IDOR zaprt)', async () => {
    session()
    mocks.integrationFindUnique.mockResolvedValue({ id: INT_WOLT, provider: 'wolt', locationId: LOC_B })
    const res = await integrationPUT(putRequest({ name: 'Heker' }), { params: Promise.resolve({ id: INT_WOLT }) })
    expect(res.status).toBe(404)
    expect(mocks.integrationUpdate).not.toHaveBeenCalled()
  })
})
