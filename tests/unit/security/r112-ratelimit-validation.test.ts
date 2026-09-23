// ============================================
// R112-d — RATE-LIMIT KVOTE + INPUT VALIDACIJA HARDENING
// ============================================
//
// Forenzika (glej worklog R112-recon 4.1/4.2/5.1/5.2/LOW + R112 headerji v
// urejenih datotekah):
//
//   RL-1 (LOW-MED, POST /api/wallet-payment/webhook): edini JAVNI write
//     endpoint BREZ rate limita → neomejen CPU (HMAC + JSON parse) / trigger
//     authorizeWalletPayment lookupov. Fix: DELIVERY_WEBHOOK_LIMIT (30/min/IP)
//     bucket 'wallet-payment-webhook', 429 prek R92-b kanon helperja.
//   RL-2 (MED, finančni pisalni subset): payments POST, payments/[id]/refund
//     POST, wallet-payment POST, checks POST, z-report POST, end-of-day POST —
//     brez AUTHENTICATED_LIMIT. Fix: skupni bucket 'authenticated-write',
//     checkRateLimitAsync TAKOJ za requireAuth, PRED body parse / DB zapisom.
//   VAL-1 (MED, configuration coerceFieldTypes): številska koercija BREZ mej —
//     NaN/Infinity/negativne vrednosti do Prisme (500) ali v zapis (fiskalno
//     napačen DDV). Fix: finitost na vseh koerciranih poljih + meje rate 0–100,
//     amount ≥ 0 (strop 100.000), avgPrepTime celo število 0–480; kršitev →
//     THROW ZodError → obstoječ handleApiError catch → 400 (P1-17 pot,
//     brez nove response oblike).
//   VAL-2 (MED, updateOrderSchema): client-authoritative totalWithTip +
//     neomejen tip. Fix: tip max 500 € (min 0); totalWithTip deprecated v
//     shemi (backward compat) in IGNORIRAN v put-handlerju — server recalc
//     totalWithTip = fresh total + efektivni tip (pokrije tudi popust + tip
//     v enem requestu; prej bi discount veja uporabila STAR tip).
//   SEC-1 (LOW, scheduled-emails/process): `WS_BROADCAST_SECRET ||` cross-
//     purpose reuse skrivnosti — sprejemamo IZKLJUČNO CRON_SECRET
//     (fail-closed ostane: brez secret → requireAuth pot).
//
// Pokritje: A coerceFieldTypes meje (runtime) · B tip bound v shemi (runtime)
// · C put-handler server-recalc (runtime) · D fs-pini (vir pini).
// Konvencije: r111-kot-furs-loyalty-concurrency.test.ts (vi.hoisted mocki,
// fs-pin readFileSync sekcija, utišan console).
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const LOC_A = 'loc-tenant-a'
const ORD = 'ord-1'

// --- Mocki (vi.hoisted) — potrebni za import put-handlerja in
// configuration/_helpers (običajni db/auth verigi so mockani, testiramo
// čisto logiko recalc-a / koercije) ---
const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  resolveTenantLocationIdOrThrow: vi.fn(),
  orderFindFirst: vi.fn(),
  orderUpdateMany: vi.fn(),
  emitOrderWebhooks: vi.fn(),
  broadcastWS: vi.fn(),
  handleOrderCompletion: vi.fn(),
  handleOrderCancellation: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    order: { findFirst: mocks.orderFindFirst, updateMany: mocks.orderUpdateMany },
  },
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: mocks.requireAuth,
}))

vi.mock('@/lib/tenant-scope', () => ({
  resolveTenantLocationIdOrThrow: mocks.resolveTenantLocationIdOrThrow,
  // binding potreben že ob importu configuration/_helpers (v testih ni klican)
  resolveCatalogScope: vi.fn(),
}))

vi.mock('@/app/api/orders/[id]/_helpers/order-actions', () => ({
  broadcastWS: mocks.broadcastWS,
  handleOrderCompletion: mocks.handleOrderCompletion,
  handleOrderCancellation: mocks.handleOrderCancellation,
}))

vi.mock('@/app/api/orders/[id]/webhooks', () => ({
  emitOrderWebhooks: mocks.emitOrderWebhooks,
}))

// Utišaj logger
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

import { coerceFieldTypes } from '@/app/api/configuration/_helpers'
import { updateOrderSchema } from '@/lib/validations/orders'
import { handlePutOrder } from '@/app/api/orders/[id]/_helpers/put-handler'
import { ZodError } from 'zod'

// Fixture — oblika, ki jo put-handler bere (subtotal/tax/total/tip/orderItems)
const BASE_ORDER = () => ({
  id: ORD,
  orderNumber: 1,
  status: 'pending',
  paymentStatus: 'unpaid',
  subtotal: 100,
  discount: 0,
  tax: 22,
  total: 122,
  tip: 0,
  totalWithTip: 122,
  orderItems: [] as Array<Record<string, unknown>>,
  deliveryInfo: null,
  updatedAt: new Date(),
  tableId: null,
  type: 'dine-in',
  paymentMethod: '',
  locationId: LOC_A,
  employeeId: null,
  customerName: null,
  notes: null,
  cancelledBy: null,
  inventoryDeducted: false,
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuth.mockResolvedValue({
    session: { employeeId: 'emp-1', role: 'staff', locationId: LOC_A },
    error: null,
  })
  // Centralni resolver — put-handler preverja `if ('error' in scope)`
  mocks.resolveTenantLocationIdOrThrow.mockReturnValue({ locationId: LOC_A })
  mocks.orderFindFirst.mockResolvedValue(BASE_ORDER())
  mocks.orderUpdateMany.mockResolvedValue({ count: 1 })
  mocks.emitOrderWebhooks.mockResolvedValue(undefined)
})

function jsonPut(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ══════════════════════════════════════════════════════════════════
// A. coerceFieldTypes — mejna validacija (VAL-1, runtime)
// ══════════════════════════════════════════════════════════════════
describe('R112 A: configuration coerceFieldTypes — meje po koerciji (VAL-1)', () => {
  it('rate 150 → ZodError s path rate in mejo 0–100 (fiskalni DDV)', () => {
    expect(() => coerceFieldTypes({ rate: 150 })).toThrow(ZodError)
    try {
      coerceFieldTypes({ rate: 150 })
    } catch (e) {
      const zerr = e as ZodError
      expect(zerr.issues[0].path).toEqual(['rate'])
      expect(zerr.issues[0].message).toContain('med 0 in 100')
    }
  })

  it("rate 'abc' → NaN po koerciji → zavrnjeno (končno število)", () => {
    expect(() => coerceFieldTypes({ rate: 'abc' })).toThrow(/končno število/)
  })

  it('amount Infinity → zavrnjeno (končno število)', () => {
    expect(() => coerceFieldTypes({ amount: Number.POSITIVE_INFINITY })).toThrow(/končno število/)
  })

  it('amount -1 → zavrnjeno (negativen znesek)', () => {
    expect(() => coerceFieldTypes({ amount: -1 })).toThrow(/negativen/)
  })

  it('amount 150000 → zavrnjeno (strop 100.000)', () => {
    expect(() => coerceFieldTypes({ amount: 150000 })).toThrow(/100\.000/)
  })

  it('avgPrepTime -5 → zavrnjeno (meja 0–480 minut)', () => {
    expect(() => coerceFieldTypes({ avgPrepTime: -5 })).toThrow(/0 in 480/)
  })

  it('avgPrepTime 12.5 → zavrnjeno (mora biti celo število)', () => {
    expect(() => coerceFieldTypes({ avgPrepTime: 12.5 })).toThrow(/celo število/)
  })

  it('veljavne vrednosti → NI metanja, vrne isti mutiran Record (obstoječ kontrakt) + koercija (boundary: rate 100, amount 0, avgPrepTime 480)', () => {
    const data: Record<string, unknown> = { rate: 100, amount: 0, avgPrepTime: 480, sortOrder: '3', maxUses: 10, isActive: 'true' }
    const returned = coerceFieldTypes(data)
    expect(returned).toBe(data) // obstoječ kontrakt: isti objekt (config-cross-scope vzorec)
    expect(data.rate).toBe(100)
    expect(data.amount).toBe(0)
    expect(data.avgPrepTime).toBe(480)
    expect(data.sortOrder).toBe(3) // koercija '3' → 3
    expect(data.isActive).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════
// B. updateOrderSchema — tip bound (VAL-2a, runtime)
// ══════════════════════════════════════════════════════════════════
describe('R112 B: updateOrderSchema — tip max 500 € (VAL-2a)', () => {
  it('tip 501 → zavrnjen z jasnim sporočilom (prej neomejen)', () => {
    const result = updateOrderSchema.safeParse({ tip: 501 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('500')
    }
  })

  it('tip 500 sprejet, tip -1 zavrnjen (min 0), totalWithTip ostane sprejet (deprecated, backward compat)', () => {
    expect(updateOrderSchema.safeParse({ tip: 500 }).success).toBe(true)
    expect(updateOrderSchema.safeParse({ tip: -1 }).success).toBe(false)
    // Deprecated polje je še vedno sprejeto (strežnik ga ignorira — glej C)
    expect(updateOrderSchema.safeParse({ tip: 10, totalWithTip: 132 }).success).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════
// C. put-handler — totalWithTip server-recalc (VAL-2b, runtime)
// ══════════════════════════════════════════════════════════════════
describe('R112 C: PUT /api/orders/[id] — totalWithTip strežniški recalc (VAL-2b)', () => {
  it('tip-only update: totalWithTip = total + tip (server recalc), klientova vrednost IGNORIRANA', async () => {
    mocks.orderFindFirst
      .mockResolvedValueOnce(BASE_ORDER()) // existing read
      .mockResolvedValueOnce({ ...BASE_ORDER(), tip: 20, totalWithTip: 142 }) // return read

    const res = await handlePutOrder(
      jsonPut(`http://localhost:3000/api/orders/${ORD}`, { tip: 20, totalWithTip: 999999 }),
      Promise.resolve({ id: ORD }),
    )

    expect(res.status).toBe(200)
    expect(mocks.orderUpdateMany).toHaveBeenCalledTimes(1)
    const data = mocks.orderUpdateMany.mock.calls[0][0].data
    expect(data.tip).toBe(20)
    // Server recalc: 122 (fresh total) + 20 (tip) — NE klientov 999999
    expect(data.totalWithTip).toBe(142)
    expect(data.totalWithTip).not.toBe(999999)
  })

  it('popust + tip v enem requestu: totalWithTip = novTotal + novTip (prej bi discount veja uporabila STAR tip)', async () => {
    const base = BASE_ORDER()
    base.orderItems = [{ price: 100, quantity: 1, vatRate: 22, voided: false }]
    mocks.orderFindFirst
      .mockResolvedValueOnce(base)
      .mockResolvedValueOnce({ ...base })

    await handlePutOrder(
      jsonPut(`http://localhost:3000/api/orders/${ORD}`, { discount: 10, tip: 5 }),
      Promise.resolve({ id: ORD }),
    )

    const data = mocks.orderUpdateMany.mock.calls[0][0].data
    // discount recalc: subtotal 90, DDV 19.8 → total 109.8
    expect(data.total).toBeCloseTo(109.8, 2)
    // server recalc: 109.8 + 5 = 114.8 (prej: 109.8 + STAR tip 0)
    expect(data.totalWithTip).toBeCloseTo(114.8, 2)
  })

  it('brez tip/total sprememb: totalWithTip NI zapisan (nič se ne recalca), notes pa se', async () => {
    await handlePutOrder(
      jsonPut(`http://localhost:3000/api/orders/${ORD}`, { notes: 'samo opomba' }),
      Promise.resolve({ id: ORD }),
    )

    expect(mocks.orderUpdateMany).toHaveBeenCalledTimes(1)
    const data = mocks.orderUpdateMany.mock.calls[0][0].data
    expect(data.notes).toBe('samo opomba')
    expect(Object.prototype.hasOwnProperty.call(data, 'totalWithTip')).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════
// D. fs-pini — vir pini (regresija zaščita)
// ══════════════════════════════════════════════════════════════════
describe('R112 D: fs-pini — kanon pini v viru', () => {
  const webhookSrc = readFileSync(join(process.cwd(), 'src/app/api/wallet-payment/webhook/route.ts'), 'utf-8')
  const configHelpersSrc = readFileSync(join(process.cwd(), 'src/app/api/configuration/_helpers.ts'), 'utf-8')
  const configTabSrc = readFileSync(join(process.cwd(), 'src/app/api/configuration/[tab]/route.ts'), 'utf-8')
  const ordersValidationsSrc = readFileSync(join(process.cwd(), 'src/lib/validations/orders.ts'), 'utf-8')
  const putHandlerSrc = readFileSync(join(process.cwd(), 'src/app/api/orders/[id]/_helpers/put-handler.ts'), 'utf-8')
  const scheduledEmailsSrc = readFileSync(join(process.cwd(), 'src/app/api/scheduled-emails/process/route.ts'), 'utf-8')

  // Finančni pisalni subset (RL-2) — vseh 6 rut
  const FINANCIAL_ROUTES = [
    'src/app/api/payments/route.ts',
    'src/app/api/payments/[id]/refund/route.ts',
    'src/app/api/wallet-payment/route.ts',
    'src/app/api/checks/route.ts',
    'src/app/api/z-report/route.ts',
    'src/app/api/end-of-day/route.ts',
  ] as const

  it('RL-1 wallet-payment/webhook: checkRateLimitAsync bucket + DELIVERY_WEBHOOK_LIMIT + kanon 429 helper', () => {
    expect(webhookSrc).toContain("checkRateLimitAsync('wallet-payment-webhook', getClientIp(req), DELIVERY_WEBHOOK_LIMIT)")
    expect(webhookSrc).toContain('rateLimitedResponse(rl.retryAfterMs')
    // Hišni kanon: helper DIREKTNO iz rate-limit/response (NE prek barrela)
    expect(webhookSrc).toContain("from '@/lib/rate-limit/response'")
  })

  it('RL-2 finančni subset: authenticated-write pin (takoj za requireAuth) v vseh 6 rutah', () => {
    for (const file of FINANCIAL_ROUTES) {
      const src = readFileSync(join(process.cwd(), ...file.split('/')), 'utf-8')
      expect(src, file).toContain("checkRateLimitAsync('authenticated-write', getClientIp(req), AUTHENTICATED_LIMIT)")
      expect(src, file).toContain('rateLimitedResponse(rl.retryAfterMs')
      expect(src, file).toContain("from '@/lib/rate-limit/response'")
    }
  })

  it('VAL-1 configuration: mejna sporočila (rate/amount/avgPrepTime/finitost) + ZodError 400 pot', () => {
    expect(configHelpersSrc).toContain('mora biti število med 0 in 100')
    expect(configHelpersSrc).toContain('ne sme biti negativen')
    expect(configHelpersSrc).toContain('ne sme preseči 100.000')
    expect(configHelpersSrc).toContain('celo število med 0 in 480 minut')
    expect(configHelpersSrc).toContain('končno število')
    // Kršitev → THROW ZodError → handleApiError P1-17 pot → 400 (brez nove oblike)
    expect(configHelpersSrc).toContain('throw new ZodError')
    // Oba klicatelja še vedno izvajata koercijo/validacijo
    expect(configHelpersSrc).toContain('coerceFieldTypes(filteredData)')
    expect(configTabSrc).toContain('coerceFieldTypes(filteredData)')
  })

  it('VAL-2 orders: tip max 500 pin v shemi + deprecated totalWithTip; put-handler NE zapisuje klientove vrednosti', () => {
    expect(ordersValidationsSrc).toContain(".max(500, 'Napitnina ne more preseči 500')")
    expect(ordersValidationsSrc).toContain('DEPRECATED (FIX R112, VAL-2)')
    // Client-authoritative zapis IZKORENENjen
    expect(putHandlerSrc).not.toContain('updateData.totalWithTip = data.totalWithTip')
    // Server recalc pin
    expect(putHandlerSrc).toContain('updateData.totalWithTip = freshTotal + effectiveTip')
  })

  it('SEC-1 scheduled-emails/process: WS_BROADCAST_SECRET popolnoma odstranjen, samo CRON_SECRET (fail-closed ohranjen)', () => {
    expect(scheduledEmailsSrc).not.toContain('WS_BROADCAST_SECRET')
    expect(scheduledEmailsSrc).toContain("process.env.CRON_SECRET || ''")
    // Fail-closed: prazen secret → cron veja NI sprejeta → requireAuth pot
    expect(scheduledEmailsSrc).toContain('if (cronSecret && authHeader === `Bearer ${cronSecret}`)')
  })
})
