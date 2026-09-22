// ============================================
// RestaurantOS — P1-testiranje točka 2: E2E VARIANTE POTEKA
// ============================================
// Minimalni flow (glej core-flow.spec.ts) ponovljen za:
//   A. offline mode     (idempotenčna replay sinhronizacija + queue)
//   B. split payment    (2 delna plačila + zavrnitev preplačila)
//   C. refund           (vračilo + knjigovodska reverza)
//   D. dve lokaciji     (neodvisen potek na loc-1 in loc-2)
//   E. dve hkratni blagajni (sočasna naročila/plačila + idempotenčna dirka)
// ============================================
import { test, expect, request as playwrightRequest } from '@playwright/test'

const API_BASE = '/api'
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const TEST_PIN = '1111'
const TEST_EMPLOYEE_ID = 'test-admin'

test.describe.configure({ mode: 'serial' })

// Skupni helperji (vsi varianti uporabljajo isti dostop)
let authToken: string

async function login(): Promise<string> {
  const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL })
  const res = await ctx.post(`${API_BASE}/auth`, {
    data: { employeeId: TEST_EMPLOYEE_ID, pin: TEST_PIN },
  })
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  await ctx.dispose()
  return body.token
}

function auth(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

async function pollUntil<T>(
  fn: () => Promise<T | undefined>,
  timeoutMs = 10_000,
  intervalMs = 500,
): Promise<T> {
  const start = Date.now()
  for (;;) {
    const value = await fn()
    if (value !== undefined) return value
    if (Date.now() - start > timeoutMs) throw new Error('pollUntil timeout')
    await new Promise(r => setTimeout(r, intervalMs))
  }
}

/** FURS overitev v TESTNEM okolju (brez certifikata): ISKRENA simulacija —
 *  400 + fiscalStatus='pending' + isSimulation=true + ZOI. Račun NI "lažno"
 *  potrjen (fiscalVerified ostane false). Pravi EOR samo s certifikatom. */
async function expectFursSimulation(
  request: import('@playwright/test').APIRequestContext,
  orderId: string,
): Promise<void> {
  const res = await request.post(`${API_BASE}/furs`, {
    headers: auth(authToken),
    data: { orderId },
  })
  expect(res.status()).toBe(400)
  const body = await res.json()
  expect(body.success).toBe(false)
  expect(body.isSimulation).toBe(true)
  expect(body.fiscalStatus).toBe('pending')
  expect(body.zoi).toBeTruthy()
}

/** Skrajšani potek: naročilo → fire → check (vrne {orderId, checkId, total}) */
async function createOrderAndCheck(
  request: import('@playwright/test').APIRequestContext,
  menuItemId: string,
  tableId: string,
  quantity = 1,
): Promise<{ orderId: string; checkId: string; total: number }> {
  const res = await request.post(`${API_BASE}/orders`, {
    headers: auth(authToken),
    data: {
      type: 'dine-in',
      tableId,
      orderItems: [{ menuItemId, quantity }],
      idempotencyKey: `e2e-var-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    },
  })
  expect(res.ok()).toBeTruthy()
  const order = await res.json()

  const fire = await request.patch(`${API_BASE}/orders/${order.id}`, {
    headers: auth(authToken),
    data: { action: 'fire' },
  })
  expect(fire.ok()).toBeTruthy()

  const checkRes = await request.post(`${API_BASE}/checks`, {
    headers: auth(authToken),
    data: { orderId: order.id },
  })
  expect(checkRes.ok()).toBeTruthy()
  const check = await checkRes.json()
  return { orderId: order.id, checkId: check.id, total: Number(check.total) }
}

/** Plačilo + fiskalizacija (vrne paymentId) */
async function payAndFiscalize(
  request: import('@playwright/test').APIRequestContext,
  orderId: string,
  checkId: string,
  amount: number,
  type: string,
  idempotencyKey: string,
): Promise<string> {
  const pay = await request.post(`${API_BASE}/payments`, {
    headers: auth(authToken),
    data: { checkId, amount, tipAmount: 0, type, idempotencyKey },
  })
  expect(pay.ok()).toBeTruthy()
  const payment = await pay.json()
  expect(payment.status).toBe('completed')
  return payment.id
}

test.beforeAll(async () => {
  authToken = await login()
})

// ═══════════════════════════════════════════════════════════════════
// A. OFFLINE MODE — replay sinhronizacija brez duplikatov
// ═══════════════════════════════════════════════════════════════════
test.describe('Varianta A: offline mode (idempotenčna sinhronizacija)', () => {
  const key = `e2e-offline-${Date.now()}`
  let orderId: string

  test('A-1: naročilo ustvarjeno "offline" (z idempotencyKey)', async ({ request }) => {
    const res = await request.post(`${API_BASE}/orders`, {
      headers: auth(authToken),
      data: {
        type: 'dine-in',
        tableId: 'table-1',
        orderItems: [{ menuItemId: 'mi-1', quantity: 2 }],
        idempotencyKey: key,
      },
    })
    expect(res.ok()).toBeTruthy()
    const order = await res.json()
    expect(order.id).toBeTruthy()
    orderId = order.id
  })

  test('A-2: ponovna sinhronizacija istega naročila NE ustvari duplikata', async ({ request }) => {
    // Naprava se ponovno poveže in retry-a CEL payload (network partition med sinhronizacijo)
    const replay = await request.post(`${API_BASE}/orders`, {
      headers: auth(authToken),
      data: {
        type: 'dine-in',
        tableId: 'table-1',
        orderItems: [{ menuItemId: 'mi-1', quantity: 2 }],
        idempotencyKey: key,
      },
    })
    expect(replay.status()).toBe(200) // 200 = obstoječe naročilo (201 = novo)
    const replayed = await replay.json()
    expect(replayed.id).toBe(orderId)

    // Zagotovi, da res ni duplikata: poisci vsa naročila s tem idempotencyKey
    const list = await request.get(`${API_BASE}/orders?limit=100`, { headers: auth(authToken) })
    const body = await list.json()
    const withKey = body.orders.filter((o: { idempotencyKey?: string }) => o.idempotencyKey === key)
    expect(withKey.length).toBe(1)
  })

  test('A-3: naročilo se uspešno zaključi po sinhronizaciji (fire → check → pay → fiskalizacija)', async ({ request }) => {
    const fire = await request.patch(`${API_BASE}/orders/${orderId}`, {
      headers: auth(authToken),
      data: { action: 'fire' },
    })
    expect(fire.ok()).toBeTruthy()

    const checkRes = await request.post(`${API_BASE}/checks`, {
      headers: auth(authToken),
      data: { orderId },
    })
    expect(checkRes.ok()).toBeTruthy()
    const check = await checkRes.json()

    const paymentId = await payAndFiscalize(
      request, orderId, check.id, Number(check.total), 'cash', `e2e-offline-pay-${key}`,
    )
    expect(paymentId).toBeTruthy()

    // Receipt + FURS overitev (simulacija — pending, glej expectFursSimulation)
    const createRes = await request.post(`${API_BASE}/receipts/${orderId}`, {
      headers: auth(authToken),
      data: { paymentMethod: 'cash' },
    })
    expect(createRes.status()).toBe(201)
    await expectFursSimulation(request, orderId)
  })

  test('A-4: outbox queue statistika je dostopna (globina vrste za monitoring)', async ({ request }) => {
    const res = await request.get(`${API_BASE}/outbox?status=all`, { headers: auth(authToken) })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.stats).toHaveProperty('pending')
    expect(body.stats).toHaveProperty('sent')
    expect(body.stats).toHaveProperty('failed')
  })
})

// ═══════════════════════════════════════════════════════════════════
// B. SPLIT PAYMENT — delna plačila + zavrnitev preplačila
// ═══════════════════════════════════════════════════════════════════
test.describe('Varianta B: split payment', () => {
  let orderId: string
  let checkId: string
  let total: number

  test('B-1: naročilo + ček za razdeljeno plačilo', async ({ request }) => {
    const res = await request.post(`${API_BASE}/orders`, {
      headers: auth(authToken),
      data: {
        type: 'dine-in',
        tableId: 'table-1',
        orderItems: [
          { menuItemId: 'mi-2', quantity: 1 },
          { menuItemId: 'mi-3', quantity: 1 },
        ],
        idempotencyKey: `e2e-split-${Date.now()}`,
      },
    })
    expect(res.ok()).toBeTruthy()
    orderId = (await res.json()).id

    const checkRes = await request.post(`${API_BASE}/checks`, {
      headers: auth(authToken),
      data: { orderId },
    })
    expect(checkRes.ok()).toBeTruthy()
    const check = await checkRes.json()
    checkId = check.id
    total = Number(check.total)
    expect(total).toBeGreaterThan(1)
  })

  test('B-2: prvo delno plačilo (gotovina) → partial', async ({ request }) => {
    const first = Math.round(total / 2 * 100) / 100
    const res = await request.post(`${API_BASE}/payments`, {
      headers: auth(authToken),
      data: {
        checkId, amount: first, tipAmount: 0, type: 'cash',
        idempotencyKey: `split-${checkId}-s0-${first}`,
      },
    })
    expect(res.ok()).toBeTruthy()
    const payment = await res.json()
    expect(payment.status).toBe('completed')

    // Naročilo je delno plačano
    const orderRes = await request.get(`${API_BASE}/orders/${orderId}`, { headers: auth(authToken) })
    expect((await orderRes.json()).paymentStatus).toBe('partial')
  })

  test('B-3: drugo delno plačilo (kartica) → paid', async ({ request }) => {
    const first = Math.round(total / 2 * 100) / 100
    const rest = Math.round((total - first) * 100) / 100
    const res = await request.post(`${API_BASE}/payments`, {
      headers: auth(authToken),
      data: {
        checkId, amount: rest, tipAmount: 0, type: 'card',
        idempotencyKey: `split-${checkId}-s1-${rest}`,
      },
    })
    expect(res.ok()).toBeTruthy()

    const orderRes = await request.get(`${API_BASE}/orders/${orderId}`, { headers: auth(authToken) })
    const order = await orderRes.json()
    expect(order.paymentStatus).toBe('paid')
    expect(order.paidAt).toBeTruthy()
  })

  test('B-4: preplačilo že poravnanega čeka je zavrnjeno', async ({ request }) => {
    const res = await request.post(`${API_BASE}/payments`, {
      headers: auth(authToken),
      data: {
        checkId, amount: 1, tipAmount: 0, type: 'cash',
        idempotencyKey: `split-${checkId}-s2-overpay`,
      },
    })
    // 400 (validacija) ali 409 (conflict — ček že plačan) — oba sta pravilna zavrnitvi
    expect([400, 409]).toContain(res.status())
    const body = await res.json()
    expect(body.error).toContain('plačan')
  })

  test('B-5: račun + fiskalizacija po razdeljenem plačilu', async ({ request }) => {
    const createRes = await request.post(`${API_BASE}/receipts/${orderId}`, {
      headers: auth(authToken),
      data: { paymentMethod: 'cash' },
    })
    expect(createRes.status()).toBe(201)
    await expectFursSimulation(request, orderId)
  })
})

// ═══════════════════════════════════════════════════════════════════
// C. REFUND — vračilo + knjigovodska reverza
// ═══════════════════════════════════════════════════════════════════
test.describe('Varianta C: refund', () => {
  let orderId: string
  let paymentId: string
  let paidTotal: number

  test('C-1: polni potek do plačila (izhodišče za vračilo)', async ({ request }) => {
    const { orderId: oid, checkId, total } = await createOrderAndCheck(request, 'mi-2', 'table-1')
    orderId = oid
    paidTotal = total
    paymentId = await payAndFiscalize(request, oid, checkId, total, 'card', `e2e-refund-pay-${Date.now()}`)
    expect(paymentId).toBeTruthy()

    const createRes = await request.post(`${API_BASE}/receipts/${orderId}`, {
      headers: auth(authToken),
      data: { paymentMethod: 'card' },
    })
    expect(createRes.status()).toBe(201)
    await expectFursSimulation(request, orderId)
  })

  test('C-2: delno vračilo (50 %) — uspešno, plačilo delno vračeno', async ({ request }) => {
    const half = Math.round(paidTotal / 2 * 100) / 100
    const res = await request.post(`${API_BASE}/payments/${paymentId}/refund`, {
      headers: auth(authToken),
      data: { amount: half, reason: 'E2E test — delno vračilo' },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.fullyRefunded).toBe(false)
    expect(body.refundAmount).toBe(half)
  })

  test('C-3: vračilo ostanka — plačilo popolnoma vračeno', async ({ request }) => {
    const first = Math.round(paidTotal / 2 * 100) / 100
    const rest = Math.round((paidTotal - first) * 100) / 100 // TOČNO ostank (ne zaokrožena polovica!)
    const res = await request.post(`${API_BASE}/payments/${paymentId}/refund`, {
      headers: auth(authToken),
      data: { amount: rest, reason: 'E2E test — končno vračilo' },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.fullyRefunded).toBe(true)

    // Status plačila je refunded
    const payRes = await request.get(`${API_BASE}/payments?limit=50`, { headers: auth(authToken) })
    const payBody = await payRes.json()
    const payments = payBody.payments ?? payBody
    const refunded = payments.find((p: { id: string }) => p.id === paymentId)
    expect(refunded).toBeTruthy()
    expect(refunded.status).toBe('refunded')
  })

  test('C-4: knjigovodska reverza vračila obstaja in je uravnotežena', async ({ request }) => {
    const today = new Date().toISOString().split('T')[0]
    const entries = await pollUntil(async () => {
      const res = await request.get(
        `${API_BASE}/accounting/journal-entries?referenceType=refund&dateFrom=${today}&limit=50`,
        { headers: auth(authToken) },
      )
      if (!res.ok()) return undefined
      const body = await res.json()
      const found = body.entries.filter((e: { reference: string }) => e.reference.includes(paymentId))
      return found.length > 0 ? found : undefined
    })
    expect(entries.length).toBeGreaterThanOrEqual(2) // 2 delni vračili → 2 reverzi (ali konsolidirano)

    // Vse reverze so uravnotežene (Σdebit == Σcredit)
    for (const entry of entries) {
      const sumDebit = entry.lines.reduce((s: number, l: { debit: number }) => s + Number(l.debit), 0)
      const sumCredit = entry.lines.reduce((s: number, l: { credit: number }) => s + Number(l.credit), 0)
      expect(sumDebit).toBeGreaterThan(0)
      expect(sumDebit).toBeCloseTo(sumCredit, 2)
    }
  })

  test('C-5: vračilo nad zneskom plačila je zavrnjeno', async ({ request }) => {
    const res = await request.post(`${API_BASE}/payments/${paymentId}/refund`, {
      headers: auth(authToken),
      data: { amount: 1000, reason: 'E2E test — preveliko vračilo' },
    })
    expect([400, 409]).toContain(res.status())
  })
})

// ═══════════════════════════════════════════════════════════════════
// D. DVE LOKACIJI — neodvisen potek na loc-1 (HQ) in loc-2 (FIL2)
// ═══════════════════════════════════════════════════════════════════
test.describe('Varianta D: dve lokaciji', () => {
  test('D-1: obe lokaciji obstajata in sta aktivni', async ({ request }) => {
    const res = await request.get(`${API_BASE}/locations`, { headers: auth(authToken) })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    const codes = body.locations.map((l: { code: string }) => l.code)
    expect(codes).toContain('HQ')
    expect(codes).toContain('FIL2')
  })

  test('D-2: polni potek na lokaciji 1 (table-1, mi-1)', async ({ request }) => {
    const { orderId, checkId, total } = await createOrderAndCheck(request, 'mi-1', 'table-1')
    const paymentId = await payAndFiscalize(request, orderId, checkId, total, 'cash', `e2e-loc1-${Date.now()}`)

    const orderRes = await request.get(`${API_BASE}/orders/${orderId}`, { headers: auth(authToken) })
    const order = await orderRes.json()
    expect(order.locationId).toBe('loc-1')

    const createRes = await request.post(`${API_BASE}/receipts/${orderId}`, {
      headers: auth(authToken),
      data: { paymentMethod: 'cash' },
    })
    expect(createRes.status()).toBe(201)
    const receipt1 = await createRes.json()
    // (POST odziv ne razkriva locationId — posredna potrditev: businessName +
    //  številka v lokacijski vrsti; order.locationId že preverjen zgoraj)
    expect(receipt1.businessName).toContain('Restavracija')
    await expectFursSimulation(request, orderId)

    // JE za plačilo na lokaciji 1
    const today = new Date().toISOString().split('T')[0]
    const entry = await pollUntil(async () => {
      const res = await request.get(
        `${API_BASE}/accounting/journal-entries?referenceType=payment&dateFrom=${today}&limit=50`,
        { headers: auth(authToken) },
      )
      if (!res.ok()) return undefined
      const body = await res.json()
      return body.entries.find((e: { reference: string }) => e.reference === paymentId)
    })
    expect(entry.locationId).toBe('loc-1')
  })

  test('D-3: polni potek na lokaciji 2 (table-2, mi-4)', async ({ request }, testInfo) => {
    const { orderId, checkId, total } = await createOrderAndCheck(request, 'mi-4', 'table-2')
    const paymentId = await payAndFiscalize(request, orderId, checkId, total, 'cash', `e2e-loc2-${Date.now()}`)

    const orderRes = await request.get(`${API_BASE}/orders/${orderId}`, { headers: auth(authToken) })
    const order = await orderRes.json()
    expect(order.locationId).toBe('loc-2')

    // Račun na lokaciji 2 — LASTNA številčna vrsta (neodvisna od loc-1:
    // loc-1 je v tem trenutku že izdal več računov, loc-2 pa prvega)
    const createRes = await request.post(`${API_BASE}/receipts/${orderId}`, {
      headers: auth(authToken),
      data: { paymentMethod: 'cash' },
    })
    expect(createRes.status()).toBe(201)
    const receipt2 = await createRes.json()
    expect(receipt2.receiptNumber).toMatch(/^R-\d{4}-\d+$/)
    // Retry-robustno (v1.3.1 CI fix): trda vrednost '-000001' drži le za PRVI
    // loc-2 račun na sveži bazi. Računi so finančni zapisi (NE brišejo se) —
    // vsak playwright retry zapusti DODATEN loc-2 račun, zato je pričakovana
    // številka 000001 + število poskusa. Asercija ostaja STROGA: dokazuje, da
    // loc-2 šteje od 000001 v LASTNI vrsti (neodvisno od loc-1 — globalni
    // števec bi dal višjo številko, ker loc-1 že ima račune).
    const expectedSeq = String(testInfo.retry + 1).padStart(6, '0')
    expect(receipt2.receiptNumber.endsWith(`-${expectedSeq}`)).toBe(true) // lastna vrsta loc-2
    expect(receipt2.businessName).toContain('Filiala')
    await expectFursSimulation(request, orderId)

    const today = new Date().toISOString().split('T')[0]
    const entry = await pollUntil(async () => {
      const res = await request.get(
        `${API_BASE}/accounting/journal-entries?referenceType=payment&dateFrom=${today}&limit=50`,
        { headers: auth(authToken) },
      )
      if (!res.ok()) return undefined
      const body = await res.json()
      return body.entries.find((e: { reference: string }) => e.reference === paymentId)
    })
    expect(entry.locationId).toBe('loc-2')
  })
})

// ═══════════════════════════════════════════════════════════════════
// E. DVE HKRATNI BLAGAJNI — sočasnost + idempotenčna dirka
// ═══════════════════════════════════════════════════════════════════
test.describe('Varianta E: dve hkratni blagajni', () => {
  test('E-1: sočasno ustvarjanje naročil na dveh blagajnah', async ({ request }) => {
    const [a, b] = await Promise.all([
      request.post(`${API_BASE}/orders`, {
        headers: auth(authToken),
        data: {
          type: 'dine-in', tableId: 'table-1',
          orderItems: [{ menuItemId: 'mi-1', quantity: 1 }],
          idempotencyKey: `e2e-regA-${Date.now()}`,
        },
      }),
      request.post(`${API_BASE}/orders`, {
        headers: auth(authToken),
        data: {
          type: 'dine-in', tableId: 'table-2',
          orderItems: [{ menuItemId: 'mi-4', quantity: 2 }],
          idempotencyKey: `e2e-regB-${Date.now()}`,
        },
      }),
    ])
    expect(a.ok()).toBeTruthy()
    expect(b.ok()).toBeTruthy()
    const orderA = await a.json()
    const orderB = await b.json()
    expect(orderA.id).not.toBe(orderB.id) // dve različni naročili
    expect(orderA.orderNumber).not.toBe(orderB.orderNumber)
  })

  test('E-2: sočasno plačevanje dveh čekov (Promise.all)', async ({ request }) => {
    // Dva čeka iz prejšnjega koraka + nova — priprava
    const [ctxA, ctxB] = await Promise.all([
      createOrderAndCheck(request, 'mi-2', 'table-1'),
      createOrderAndCheck(request, 'mi-5', 'table-2'),
    ])

    const ts = Date.now()
    const [payA, payB] = await Promise.all([
      request.post(`${API_BASE}/payments`, {
        headers: auth(authToken),
        data: { checkId: ctxA.checkId, amount: ctxA.total, tipAmount: 0, type: 'cash', idempotencyKey: `e2e-concA-${ts}` },
      }),
      request.post(`${API_BASE}/payments`, {
        headers: auth(authToken),
        data: { checkId: ctxB.checkId, amount: ctxB.total, tipAmount: 0, type: 'card', idempotencyKey: `e2e-concB-${ts}` },
      }),
    ])
    expect(payA.ok()).toBeTruthy()
    expect(payB.ok()).toBeTruthy()
    const paymentA = await payA.json()
    const paymentB = await payB.json()
    expect(paymentA.id).not.toBe(paymentB.id) // dve ločeni plačili

    // Fiskalizacija obeh (neodvisno, sočasno — simulacija pending na obeh)
    const [fiscA, fiscB] = await Promise.all([
      (async () => {
        await request.post(`${API_BASE}/receipts/${ctxA.orderId}`, {
          headers: auth(authToken), data: { paymentMethod: 'cash' },
        })
        return request.post(`${API_BASE}/furs`, { headers: auth(authToken), data: { orderId: ctxA.orderId } })
      })(),
      (async () => {
        await request.post(`${API_BASE}/receipts/${ctxB.orderId}`, {
          headers: auth(authToken), data: { paymentMethod: 'card' },
        })
        return request.post(`${API_BASE}/furs`, { headers: auth(authToken), data: { orderId: ctxB.orderId } })
      })(),
    ])
    expect(fiscA.status()).toBe(400) // simulacija — pending
    expect(fiscB.status()).toBe(400)
    const bodyA = await fiscA.json()
    const bodyB = await fiscB.json()
    expect(bodyA.isSimulation).toBe(true)
    expect(bodyB.isSimulation).toBe(true)
    expect(bodyA.zoi).not.toBe(bodyB.zoi) // vsak račun ima svoj ZOI
    expect(bodyA.fiscalStatus).toBe('pending')
    expect(bodyB.fiscalStatus).toBe('pending')

    // Oba dnevniška vnosa sta uravnotežena
    const today = new Date().toISOString().split('T')[0]
    for (const paymentId of [paymentA.id, paymentB.id]) {
      const entry = await pollUntil(async () => {
        const res = await request.get(
          `${API_BASE}/accounting/journal-entries?referenceType=payment&dateFrom=${today}&limit=50`,
          { headers: auth(authToken) },
        )
        if (!res.ok()) return undefined
        const body = await res.json()
        return body.entries.find((e: { reference: string }) => e.reference === paymentId)
      })
      const sumDebit = entry.lines.reduce((s: number, l: { debit: number }) => s + Number(l.debit), 0)
      const sumCredit = entry.lines.reduce((s: number, l: { credit: number }) => s + Number(l.credit), 0)
      expect(sumDebit).toBeCloseTo(sumCredit, 2)
    }
  })

  test('E-3: idempotenčna dirka — dve sočasni plačili z ISTIM ključem = eno plačilo', async ({ request }) => {
    const { checkId, total } = await createOrderAndCheck(request, 'mi-3', 'table-1')
    const key = `e2e-race-${Date.now()}`

    // Dve blagajni hkrati pošljeta ISTO plačilo (npr. double-submit na slabši povezavi)
    const [res1, res2] = await Promise.all([
      request.post(`${API_BASE}/payments`, {
        headers: auth(authToken),
        data: { checkId, amount: total, tipAmount: 0, type: 'cash', idempotencyKey: key },
      }),
      request.post(`${API_BASE}/payments`, {
        headers: auth(authToken),
        data: { checkId, amount: total, tipAmount: 0, type: 'cash', idempotencyKey: key },
      }),
    ])

    // Vsaj ena uspe; oba odgovora se morata končati brez 5xx
    const statuses = [res1.status(), res2.status()].sort()
    expect(statuses[0]).toBeLessThan(500)
    const successes = [res1, res2].filter(r => r.ok())
    expect(successes.length).toBeGreaterThanOrEqual(1)

    // Enolično plačilo: vsi uspešni odgovori vračajo ISTI paymentId
    const paymentIds = new Set<string>()
    for (const r of successes) paymentIds.add((await r.json()).id)
    expect(paymentIds.size).toBe(1)

    // Ni duplikatov v bazi: točno eno plačilo s tem idempotencyKey
    const list = await request.get(`${API_BASE}/payments?limit=100`, { headers: auth(authToken) })
    const body = await list.json()
    const payments = body.payments ?? body
    const withKey = payments.filter((p: { idempotencyKey?: string }) => p.idempotencyKey === key)
    expect(withKey.length).toBe(1)
  })

  test('E-4: dvojno zapiranje istega čeka je zavrnjeno (druga blagajna zaostane)', async ({ request }) => {
    // MODEL A (v1.3.1 CI fix): prej 'mi-1' + 'table-2' — MEŠANI lokaciji (mi-1
    // pripada loc-1, table-2 loc-2). Nova cross-tenant varovalka take naročilo
    // PRAVILNO zavrne (400) — test pa preverja zapiranje čeka, ne lokacije, zato
    // uporabimo DOSLEDEN par loc-2 (mi-4 + table-2), kot ga uporablja D-3.
    const { checkId, total } = await createOrderAndCheck(request, 'mi-4', 'table-2')
    const first = await request.post(`${API_BASE}/payments`, {
      headers: auth(authToken),
      data: { checkId, amount: total, tipAmount: 0, type: 'cash', idempotencyKey: `e2e-close1-${Date.now()}` },
    })
    expect(first.ok()).toBeTruthy()

    // Druga blagajna poskuša zapreti isti ček z DRUGIM ključem → zavrnjeno
    const second = await request.post(`${API_BASE}/payments`, {
      headers: auth(authToken),
      data: { checkId, amount: total, tipAmount: 0, type: 'cash', idempotencyKey: `e2e-close2-${Date.now()}` },
    })
    // 400 (validacija) ali 409 (conflict — ček že plačan): oba sta pravilna zavrnitev
    expect([400, 409]).toContain(second.status())
    expect((await second.json()).error).toContain('plačan')
  })
})
