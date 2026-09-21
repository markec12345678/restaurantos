// ============================================
// R93-c — mobile/* rate-limit plast (API-key familija)
// ============================================
// R93-0 audit: mobile/menu + mobile/loyalty sta imeli NO rate limit (samo
// mobile/order je imel legacy R82-C vedro). Ti testi zaklenejo kanon:
//
//   A. GET /api/mobile/menu — blocked → 429 exact shape (REALEN
//      rateLimitedResponse — ruta ga importira DIREKTNO iz
//      '@/lib/rate-limit/response', barrel je mockan in ga NE izvaža) +
//      ZERO verifyApiKey/db klicev; allowed → verifyApiKey + scope check
//      tečeta; pin fiksni ključ 'mobile-menu' + AUTHENTICATED_LIMIT oblika +
//      vrstni red rate-limit PRED verifyApiKey (anonimni model — vsak
//      verifyApiKey klic je DB lookup, invalid-key brute-force se duši PRED
//      avtentikacijo).
//   B. GET /api/mobile/loyalty — isto (ključ 'mobile-loyalty').
//   C. POST /api/mobile/order (legacy R82-C) — ključ 'mobile-order' +
//      PUBLIC_ORDER_LIMIT NESPREMENJENA; blocked → 429 prek rateLimitedResponse
//      (novo enotno telo 'Preveč zahtevkov' + Retry-After/X-RateLimit-*
//      glave kanona); fs pin: direct import iz '@/lib/rate-limit/response'
//      prisoten v route viru, stari inline 429 body-i odstranjeni.
//
// Vzorec (r89-token-rotate / r92-rate-limit-wave): vi.hoisted mocki,
// mockResolvedValue (nikoli .Once), ZERO-db asserti na vsaki zavrnitvi.
// rate-limit/response je REALen — 429 oblika se testira čez pravi helper.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const mocks = vi.hoisted(() => ({
  verifyApiKey: vi.fn(),
  rateLimitCheck: vi.fn(),
  // db
  locationFindFirst: vi.fn(),
  menuItemFindMany: vi.fn(),
  categoryFindMany: vi.fn(),
  loyaltyAccountFindFirst: vi.fn(),
  loyaltyTransactionFindMany: vi.fn(),
  orderFindFirst: vi.fn(),
  orderCreate: vi.fn(),
  tableFindFirst: vi.fn(),
}))

// R93-c: rate-limit BARREL mockan (checkRateLimitAsync se pina — fiksni ključ,
// IP, limit oblika); rateLimitedResponse NAMERNO NI v mocku — rute ga jemljejo
// direktno iz '@/lib/rate-limit/response' (REALen), tako da 429 shape testi
// gredo čez pravi kanon helper. Strict mock bi sicer vrgel napako, če bi ruta
// helper jemala iz barrel-a (impliciten direct-import pin).
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.rateLimitCheck,
  getClientIp: vi.fn(() => '198.51.100.77'),
  AUTHENTICATED_LIMIT: { maxRequests: 120, windowMs: 60000 },
  PUBLIC_ORDER_LIMIT: { maxRequests: 5, windowMs: 60000 },
}))

vi.mock('@/lib/api-security', () => ({
  verifyApiKey: mocks.verifyApiKey,
}))

vi.mock('@/lib/db', () => ({
  db: {
    location: { findFirst: mocks.locationFindFirst },
    menuItem: { findMany: mocks.menuItemFindMany },
    category: { findMany: mocks.categoryFindMany },
    loyaltyAccount: { findFirst: mocks.loyaltyAccountFindFirst },
    loyaltyTransaction: { findMany: mocks.loyaltyTransactionFindMany },
    order: { findFirst: mocks.orderFindFirst, create: mocks.orderCreate },
    table: { findFirst: mocks.tableFindFirst },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      order: { create: mocks.orderCreate },
    })),
  },
}))

vi.mock('@/lib/counters', () => ({
  getNextOrderNumber: vi.fn(),
}))

vi.mock('@/app/api/orders/_helpers/order-items', () => ({
  buildOrderItemsData: vi.fn(() => ({ orderItemsData: [], subtotal: 0 })),
  calculateOrderTotals: vi.fn(() => ({ totalTax: 0, total: 0 })),
  fetchModifierPriceMap: vi.fn(async () => new Map()),
}))

// api-utils: handleApiError passthrough (isti vzorec kot r89-token-rotate)
vi.mock('@/lib/api-utils', () => ({
  handleApiError: vi.fn((_e: unknown, _ctx: string, msg: string) =>
    new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'content-type': 'application/json' } })),
}))

// Route importi (PO mockih); tenant-scope + decimal + json-fields REALNI
import { GET as mobileMenuGET } from '@/app/api/mobile/menu/route'
import { GET as mobileLoyaltyGET } from '@/app/api/mobile/loyalty/route'
import { GET as mobileOrderGET, POST as mobileOrderPOST } from '@/app/api/mobile/order/route'

const SUB_A = 'sub-tenant-a'

function mockValidApiKey(scopes: string[] = ['admin']) {
  mocks.verifyApiKey.mockResolvedValue({
    valid: true,
    apiKey: { id: 'key-1', scopes, isActive: true },
    subscriptionId: SUB_A,
  })
}

function blockedCheck(retryAfterMs = 60000) {
  mocks.rateLimitCheck.mockResolvedValue({ allowed: false, retryAfterMs, remaining: 0 })
}

/** Skupni 429-shape assert (REALEN rateLimitedResponse kanon — R92-b). */
async function expectRateLimited(res: Response) {
  expect(res.status).toBe(429)
  const data = await res.json()
  expect(data).toEqual({ error: 'Preveč zahtevkov' })
  expect(res.headers.get('Retry-After')).toBe('60')
  expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
  const reset = Number(res.headers.get('X-RateLimit-Reset'))
  expect(Number.isFinite(reset)).toBe(true)
  expect(reset).toBeGreaterThan(Date.now() / 1000)
}

// ════════════════════════════════════════════════════════════════════
// A. GET /api/mobile/menu
// ════════════════════════════════════════════════════════════════════
describe('R93-c A: GET /api/mobile/menu — rate limit pred verifyApiKey', () => {
  beforeEach(() => {
    mocks.rateLimitCheck.mockResolvedValue({ allowed: true, remaining: 119 })
    mockValidApiKey()
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('A1: blocked → 429 exact shape + ZERO verifyApiKey/db klicev', async () => {
    blockedCheck()
    const res = await mobileMenuGET(new Request('http://localhost:3000/api/mobile/menu'))
    await expectRateLimited(res)
    expect(mocks.verifyApiKey).not.toHaveBeenCalled()
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
    expect(mocks.menuItemFindMany).not.toHaveBeenCalled()
    expect(mocks.categoryFindMany).not.toHaveBeenCalled()
  })

  it('A2: allowed → tok do verifyApiKey + DB (meni resolvan)', async () => {
    mocks.locationFindFirst.mockResolvedValue({ id: 'loc-a' })
    mocks.menuItemFindMany.mockResolvedValue([])
    mocks.categoryFindMany.mockResolvedValue([])
    const res = await mobileMenuGET(new Request('http://localhost:3000/api/mobile/menu'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.totalCount).toBe(0)
    expect(mocks.verifyApiKey).toHaveBeenCalledTimes(1)
    expect(mocks.locationFindFirst).toHaveBeenCalledTimes(1)
  })

  it('A3: allowed, a ključ brez menu scope-a → 403 (scope check živ po rate-limit plasti)', async () => {
    mockValidApiKey(['write:orders'])
    const res = await mobileMenuGET(new Request('http://localhost:3000/api/mobile/menu'))
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toBe('Nimaš dovoljenja za menu')
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
  })

  it('A4: call pin — fiksni ključ "mobile-menu" + IP + AUTHENTICATED_LIMIT, PRED verifyApiKey', async () => {
    mocks.locationFindFirst.mockResolvedValue({ id: 'loc-a' })
    mocks.menuItemFindMany.mockResolvedValue([])
    mocks.categoryFindMany.mockResolvedValue([])
    await mobileMenuGET(new Request('http://localhost:3000/api/mobile/menu'))
    expect(mocks.rateLimitCheck).toHaveBeenCalledWith(
      'mobile-menu',
      '198.51.100.77',
      expect.objectContaining({ maxRequests: 120, windowMs: 60000 }),
    )
    // anonimni model: vedro se potroši PRED DB lookup avtentikacije
    expect(mocks.rateLimitCheck.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.verifyApiKey.mock.invocationCallOrder[0],
    )
  })
})

// ════════════════════════════════════════════════════════════════════
// B. GET /api/mobile/loyalty
// ════════════════════════════════════════════════════════════════════
describe('R93-c B: GET /api/mobile/loyalty — rate limit pred verifyApiKey', () => {
  beforeEach(() => {
    mocks.rateLimitCheck.mockResolvedValue({ allowed: true, remaining: 119 })
    mockValidApiKey()
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('B1: blocked → 429 exact shape + ZERO verifyApiKey/db klicev', async () => {
    blockedCheck()
    const res = await mobileLoyaltyGET(new Request('http://localhost:3000/api/mobile/loyalty?phone=040123456'))
    await expectRateLimited(res)
    expect(mocks.verifyApiKey).not.toHaveBeenCalled()
    expect(mocks.loyaltyAccountFindFirst).not.toHaveBeenCalled()
    expect(mocks.loyaltyTransactionFindMany).not.toHaveBeenCalled()
  })

  it('B2: allowed → tok skozi verifyApiKey + scope do loyalty poizvedbe (404 ni najden)', async () => {
    mocks.loyaltyAccountFindFirst.mockResolvedValue(null)
    const res = await mobileLoyaltyGET(new Request('http://localhost:3000/api/mobile/loyalty?phone=040123456'))
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toBe('Loyalty račun ni najden')
    expect(mocks.verifyApiKey).toHaveBeenCalledTimes(1)
    expect(mocks.loyaltyAccountFindFirst).toHaveBeenCalledTimes(1)
  })

  it('B3: call pin — fiksni ključ "mobile-loyalty" + IP + AUTHENTICATED_LIMIT, PRED verifyApiKey', async () => {
    mocks.loyaltyAccountFindFirst.mockResolvedValue(null)
    await mobileLoyaltyGET(new Request('http://localhost:3000/api/mobile/loyalty?phone=040123456'))
    expect(mocks.rateLimitCheck).toHaveBeenCalledWith(
      'mobile-loyalty',
      '198.51.100.77',
      expect.objectContaining({ maxRequests: 120, windowMs: 60000 }),
    )
    expect(mocks.rateLimitCheck.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.verifyApiKey.mock.invocationCallOrder[0],
    )
  })
})

// ════════════════════════════════════════════════════════════════════
// C. /api/mobile/order — legacy R82-C plast (ključ/placement nespremenjena,
//    R93-c migrira SAMO 429 blok na rateLimitedResponse)
// ════════════════════════════════════════════════════════════════════
describe('R93-c C: /api/mobile/order — legacy ključ + nov 429 kanon', () => {
  beforeEach(() => {
    mocks.rateLimitCheck.mockResolvedValue({ allowed: true, remaining: 4 })
    mockValidApiKey(['write:orders'])
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('C1: GET blocked → 429 rateLimitedResponse shape + ZERO verifyApiKey', async () => {
    blockedCheck()
    const res = await mobileOrderGET(new Request('http://localhost:3000/api/mobile/order?orderId=o-1'))
    await expectRateLimited(res)
    expect(mocks.verifyApiKey).not.toHaveBeenCalled()
    expect(mocks.orderFindFirst).not.toHaveBeenCalled()
  })

  it('C2: POST blocked → 429 + ZERO verifyApiKey/$transaction (ključ mobile-order + PUBLIC_ORDER_LIMIT)', async () => {
    blockedCheck()
    const res = await mobileOrderPOST(
      new Request('http://localhost:3000/api/mobile/order', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: [{ menuItemId: 'mi-1', quantity: 1 }] }),
      }),
    )
    await expectRateLimited(res)
    expect(mocks.verifyApiKey).not.toHaveBeenCalled()
    expect(mocks.orderCreate).not.toHaveBeenCalled()
    // legacy ključ + legacy PUBLIC_ORDER_LIMIT (R82-C) NESPREMENJENA
    expect(mocks.rateLimitCheck).toHaveBeenCalledWith(
      'mobile-order',
      '198.51.100.77',
      expect.objectContaining({ maxRequests: 5, windowMs: 60000 }),
    )
  })

  it('C3: fs pin — direct rateLimitedResponse import prisoten, stari inline 429 body-i odstranjeni', () => {
    const src = readFileSync(join(process.cwd(), 'src', 'app', 'api', 'mobile', 'order', 'route.ts'), 'utf8')
    // direct import (NE barrel — testni mocki so lastniki barrel-a)
    expect(src).toContain("import { rateLimitedResponse } from '@/lib/rate-limit/response'")
    expect(src).not.toContain("rateLimitedResponse } from '@/lib/rate-limit'")
    // legacy ključ nespremenjen
    expect(src).toContain("checkRateLimitAsync('mobile-order'")
    // stari inline 429 bloki (dva različna body-a) sta migrirana
    expect(src).not.toContain('Poskusite znova čez minuto.')
    expect(src).toContain("rateLimitedResponse(rateCheck.retryAfterMs, 'Preveč zahtevkov')")
  })

  it('C4: fs pin — menu/loyalty vire nosita fiksna ključa na vrhu try bloka (pred verifyApiKey)', () => {
    const menuSrc = readFileSync(join(process.cwd(), 'src', 'app', 'api', 'mobile', 'menu', 'route.ts'), 'utf8')
    const loyaltySrc = readFileSync(join(process.cwd(), 'src', 'app', 'api', 'mobile', 'loyalty', 'route.ts'), 'utf8')
    expect(menuSrc).toContain("checkRateLimitAsync('mobile-menu'")
    expect(loyaltySrc).toContain("checkRateLimitAsync('mobile-loyalty'")
    // source-level placement pin (behavioral invocationCallOrder pin zgoraj)
    // — primerjamo proti DEJANSKEMU klicu `await verifyApiKey(` (komentar
    // omenja 'verifyApiKey' že v placement pojasnilu, zato klic-pattern)
    expect(menuSrc.indexOf("checkRateLimitAsync('mobile-menu'")).toBeLessThan(menuSrc.indexOf('await verifyApiKey('))
    expect(loyaltySrc.indexOf("checkRateLimitAsync('mobile-loyalty'")).toBeLessThan(loyaltySrc.indexOf('await verifyApiKey('))
  })
})
