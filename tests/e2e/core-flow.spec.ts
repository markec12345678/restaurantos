// ============================================
// RestaurantOS — P1-testiranje točka 2: E2E MINIMALNI FLOW
// ============================================
// Zahtevani potek (celovit, po specifikaciji):
//   login → open table → create order → add item → send to kitchen
//   → KDS receives order → modify order → close check → pay
//   → fiscalize → print/export receipt → verify accounting
//   → verify inventory → verify audit log
//
// Test je API-level (isti vzorec kot workflow.spec.ts) — pokriva
// CEL backend potek, ne pa tudi klikanja po UI (UI testi so v
// critical-path.spec.ts in so pin-ani na polne frontend komponente).
//
// Predpogoji (zagotovi jih playwright.config.ts webServer + seed):
//   - test-admin / PIN 1111 (admin role)
//   - loc-1, table-1, menu-1/cat-1, mi-1/mi-2
//   - inv-kava (100 kos) + RecipeItem mi-1→inv-kava (1 kos/servis)
//   - FURS_ALLOW_SIMULATION=true (fiskalizacija v simulacijskem načinu)
// ============================================
import { test, expect, request as playwrightRequest } from '@playwright/test'

const API_BASE = '/api'
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const TEST_PIN = '1111'
const TEST_EMPLOYEE_ID = 'test-admin'

test.describe.configure({ mode: 'serial' })

test.describe('E2E Minimalni flow: login → order → plačilo → fiskalizacija → kontrole', () => {
  let authToken: string
  let tableId: string
  let menuItemId: string
  let menuItemId2: string
  let orderId: string
  let orderItemId: string
  let addedItemId: string
  let checkId: string
  let paymentId: string
  let receiptNumber: string
  let eor: string
  let stockQtyBefore: number

  test.beforeAll(async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL })
    const res = await ctx.post(`${API_BASE}/auth`, {
      data: { employeeId: TEST_EMPLOYEE_ID, pin: TEST_PIN },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.success).toBe(true)
    authToken = body.token
    await ctx.dispose()
  })

  function authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' }
  }

  // Helper: polling z retry (async procesi — journal, fiskalizacija)
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

  // ═══════════════════════════════════════════════════════════════
  // 1. LOGIN + priprava (miza, artikli, začetna zaloga)
  // ═══════════════════════════════════════════════════════════════

  test('FLOW-1: login vrne veljaven token (PIN avtentikacija)', async ({ request }) => {
    expect(authToken).toBeTruthy()
    // Token dejansko deluje na avtenticirani ruti
    const res = await request.get(`${API_BASE}/tables`, { headers: authHeaders() })
    expect(res.ok()).toBeTruthy()
  })

  test('FLOW-2: open table — miza je proste pred naročilom', async ({ request }) => {
    const res = await request.get(`${API_BASE}/tables`, { headers: authHeaders() })
    expect(res.ok()).toBeTruthy()
    const tables = await res.json()
    // Izberi prosto mizo (prednostno table-1 iz semena)
    const available = tables.filter((t: { status: string }) => t.status === 'available')
    expect(available.length).toBeGreaterThan(0)
    const preferred = tables.find((t: { id: string }) => t.id === 'table-1')
    tableId = (preferred && preferred.status === 'available' ? preferred : available[0]).id
    expect(tableId).toBeTruthy()
  })

  test('FLOW-3: create order — naročilo ustvarjeno, miza zasedena', async ({ request }) => {
    // Priprava artiklov (mi-1 ima recepto → inventar se razknjiži)
    const menuRes = await request.get(`${API_BASE}/menu-items?limit=20`, { headers: authHeaders() })
    expect(menuRes.ok()).toBeTruthy()
    const menuBody = await menuRes.json()
    expect(menuBody.menuItems.length).toBeGreaterThan(0)
    const byId = new Map(menuBody.menuItems.map((m: { id: string }) => [m.id, m]))
    menuItemId = byId.has('mi-1') ? 'mi-1' : menuBody.menuItems[0].id
    menuItemId2 = byId.has('mi-2') ? 'mi-2'
      : menuBody.menuItems.find((m: { id: string }) => m.id !== menuItemId)?.id ?? menuItemId

    // Zacetna zaloga inventarja (za kasnejso primerjavo)
    const invRes = await request.get(`${API_BASE}/inventory?limit=200`, { headers: authHeaders() })
    if (invRes.ok()) {
      const invBody = await invRes.json()
      const items = invBody.items ?? invBody.inventoryItems ?? invBody
      const kava = Array.isArray(items)
        ? items.find((i: { id: string }) => i.id === 'inv-kava')
        : undefined
      stockQtyBefore = kava ? Number(kava.quantity) : Number.NaN
    }

    const res = await request.post(`${API_BASE}/orders`, {
      headers: authHeaders(),
      data: {
        type: 'dine-in',
        tableId,
        orderItems: [{ menuItemId, quantity: 1 }],
        idempotencyKey: `e2e-core-${Date.now()}`,
      },
    })
    expect(res.ok()).toBeTruthy()
    const order = await res.json()
    expect(order.id).toBeTruthy()
    expect(order.status).toBe('pending')
    expect(order.paymentStatus).toBe('unpaid')
    expect(order.orderItems.length).toBe(1)
    orderId = order.id
    orderItemId = order.orderItems[0].id

    // Miza je zdaj zasedena
    const tablesRes = await request.get(`${API_BASE}/tables`, { headers: authHeaders() })
    const tables = await tablesRes.json()
    const table = tables.find((t: { id: string }) => t.id === tableId)
    expect(table.status).toBe('occupied')
  })

  test('FLOW-4: add item — dodaten artikel na obstoječe naročilo', async ({ request }) => {
    const res = await request.post(`${API_BASE}/orders/${orderId}/add-items`, {
      headers: authHeaders(),
      data: { orderItems: [{ menuItemId: menuItemId2, quantity: 2 }] },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.addedItems).toBe(1)
    expect(body.order.orderItems.length).toBe(2)
    addedItemId = body.order.orderItems.find(
      (i: { id: string }) => i.id === orderItemId ? false : true,
    )?.id
    expect(addedItemId).toBeTruthy()
    // Skupna vsota se je povečala
    expect(Number(body.order.total)).toBeGreaterThan(0)
  })

  test('FLOW-5: send to kitchen — fire naročila', async ({ request }) => {
    const res = await request.patch(`${API_BASE}/orders/${orderId}`, {
      headers: authHeaders(),
      data: { action: 'fire' },
    })
    expect(res.ok()).toBeTruthy()
    const order = await res.json()
    expect(order.status).toBe('in-progress')
    expect(order.firedAt).toBeTruthy()
    expect(order.orderItems[0].status).toBe('preparing')
  })

  test('FLOW-6: KDS receives order — kuhinja vidi naročilo', async ({ request }) => {
    const res = await request.get(`${API_BASE}/kitchen`, { headers: authHeaders() })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    const kdsOrder = body.orders.find((o: { id: string }) => o.id === orderId)
    expect(kdsOrder).toBeTruthy()
    expect(kdsOrder.status).toBe('in-progress')
    expect(kdsOrder.orderItems.length).toBe(2)
    expect(kdsOrder.orderItems[0].menuItem).toBeTruthy()
  })

  test('FLOW-7: modify order — statusi artiklov (KDS ready + natakar served)', async ({ request }) => {
    // KDS: prvi artikel pripravljen
    const res1 = await request.patch(`${API_BASE}/orders/${orderId}`, {
      headers: authHeaders(),
      data: { action: 'item_status', itemId: orderItemId, status: 'ready' },
    })
    expect(res1.ok()).toBeTruthy()

    // KDS: drugi artikel pripravljen (order postane ready)
    const res2 = await request.patch(`${API_BASE}/orders/${orderId}`, {
      headers: authHeaders(),
      data: { action: 'item_status', itemId: addedItemId, status: 'ready' },
    })
    expect(res2.ok()).toBeTruthy()
    const body2 = await res2.json()
    expect(body2.allReady).toBe(true)

    // Natakar: postrežba
    const res3 = await request.patch(`${API_BASE}/orders/${orderId}`, {
      headers: authHeaders(),
      data: { action: 'item_status', itemId: orderItemId, status: 'served' },
    })
    expect(res3.ok()).toBeTruthy()

    const orderRes = await request.get(`${API_BASE}/orders/${orderId}`, { headers: authHeaders() })
    const order = await orderRes.json()
    expect(order.status).toBe('ready')
  })

  test('FLOW-8: close check — ček izračunan strežniško', async ({ request }) => {
    const orderRes = await request.get(`${API_BASE}/orders/${orderId}`, { headers: authHeaders() })
    const order = await orderRes.json()

    const res = await request.post(`${API_BASE}/checks`, {
      headers: authHeaders(),
      data: { orderId },
    })
    expect(res.ok()).toBeTruthy()
    const check = await res.json()
    expect(check.id).toBeTruthy()
    expect(check.orderId).toBe(orderId)
    // Ček skupaj se ujema z naročilom (strežniško izračunan, ne iz klienta)
    expect(Number(check.total)).toBeCloseTo(Number(order.total), 2)
    checkId = check.id
  })

  test('FLOW-9: pay — plačilo v gotovini, naročilo poravnano', async ({ request }) => {
    const orderRes = await request.get(`${API_BASE}/orders/${orderId}`, { headers: authHeaders() })
    const order = await orderRes.json()

    const res = await request.post(`${API_BASE}/payments`, {
      headers: authHeaders(),
      data: {
        checkId,
        amount: Number(order.total),
        tipAmount: 0,
        type: 'cash',
        idempotencyKey: `e2e-core-pay-${Date.now()}`,
      },
    })
    expect(res.ok()).toBeTruthy()
    const payment = await res.json()
    expect(payment.id).toBeTruthy()
    expect(payment.status).toBe('completed')
    paymentId = payment.id

    // Naročilo je plačano
    const paidRes = await request.get(`${API_BASE}/orders/${orderId}`, { headers: authHeaders() })
    const paid = await paidRes.json()
    expect(paid.paymentStatus).toBe('paid')
    expect(paid.paidAt).toBeTruthy()
  })

  test('FLOW-10: fiscalize — račun ustvarjen + FURS overitev (simulacija = pending)', async ({ request }) => {
    // 1. Ustvari račun (ZOI placeholder, številka po lokaciji)
    //    Opomba: POST odziv (receiptCreatedResponseSchema) ne razkriva ZOI —
    //    ta pride šele v FURS overitvi in v GET predogledu (varnostno filtriranje)
    const createRes = await request.post(`${API_BASE}/receipts/${orderId}`, {
      headers: authHeaders(),
      data: { paymentMethod: 'cash' },
    })
    expect(createRes.status()).toBe(201)
    const receipt = await createRes.json()
    expect(receipt.receiptNumber).toMatch(/^R-\d{4}-\d+$/)
    receiptNumber = receipt.receiptNumber
    expect(receipt.fiscalVerified).toBe(false) // pred overitvijo

    // 2. FURS overitev — v TESTNEM okolju (brez certifikata) je simulacija
    //    ISKRENA: račun OSTANE pending (fiscalVerified=false) in overitev
    //    vrne 400 s fiscalStatus='pending' — tako testni E2E ne more "lažno"
    //    potrjevati fiskalizacije. Pravi EOR pride samo s certifikatom.
    const verifyRes = await request.post(`${API_BASE}/furs`, {
      headers: authHeaders(),
      data: { orderId },
    })
    expect(verifyRes.status()).toBe(400) // simulacija ≠ overitev
    const verified = await verifyRes.json()
    expect(verified.success).toBe(false)
    expect(verified.isSimulation).toBe(true)
    expect(verified.fiscalStatus).toBe('pending')
    expect(verified.zoi).toBeTruthy() // ZOI je generiran (SHA-256 test fallback)
    eor = verified.eor || ''

    // Neuspešna overitev je zapisana v revizijski dnevnik (FURS_VERIFY_FAILED)
    const auditRes = await request.get(
      `${API_BASE}/audit?entityType=Receipt&entityId=${receipt.id}&limit=10`,
      { headers: authHeaders() },
    )
    const auditBody = await auditRes.json()
    const fursAudit = auditBody.logs.find((l: { action: string }) => l.action === 'FURS_VERIFY_FAILED')
    expect(fursAudit).toBeTruthy()
  })

  test('FLOW-11: print/export receipt — predogled + označitev tiska', async ({ request }) => {
    // Predogled računa (ZDDV-1 skladen izvoz)
    const res = await request.get(`${API_BASE}/receipts/${orderId}`, { headers: authHeaders() })
    expect(res.ok()).toBeTruthy()
    const preview = await res.json()
    expect(preview.receiptNumber).toBe(receiptNumber)
    expect(preview.zoi).toBeTruthy()
    // V simulaciji EOR ostane prazen (fiskalna overitev čaka na certifikat)
    expect(preview.eor).toBe(eor)
    expect(Number(preview.total)).toBeGreaterThan(0)
    // DDV razdelitev je del računa (DDV split po stopnjah)
    expect(preview.vatBreakdown).toBeTruthy()
    // Postavke računa (2 artikla: osnovni + dodani)
    expect(preview.items.length).toBe(2)

    // Označi kot natisnjen (print/export dogodek je sledljiv)
    const putRes = await request.put(`${API_BASE}/receipts/${orderId}`, {
      headers: authHeaders(),
      data: { printed: true },
    })
    expect(putRes.ok()).toBeTruthy()
    const updated = await putRes.json()
    expect(updated.printedAt).toBeTruthy()
  })

  test('FLOW-12: verify accounting — dnevniški vnos za plačilo, uravnotežen', async ({ request }) => {
    const today = new Date().toISOString().split('T')[0]
    // generateJournalForPayment teče non-blocking — polling
    const entry = await pollUntil(async () => {
      const res = await request.get(
        `${API_BASE}/accounting/journal-entries?referenceType=payment&dateFrom=${today}&limit=50`,
        { headers: authHeaders() },
      )
      if (!res.ok()) return undefined
      const body = await res.json()
      return body.entries.find((e: { reference: string }) => e.reference === paymentId)
    })
    expect(entry).toBeTruthy()
    expect(entry.status).toBe('posted')
    expect(entry.entryNumber).toMatch(/^JE-\d{4}-\d+$/)
    // Double-entry invariant: Σ debit == Σ credit
    const sumDebit = entry.lines.reduce((s: number, l: { debit: number }) => s + Number(l.debit), 0)
    const sumCredit = entry.lines.reduce((s: number, l: { credit: number }) => s + Number(l.credit), 0)
    expect(sumDebit).toBeGreaterThan(0)
    expect(sumDebit).toBeCloseTo(sumCredit, 2)
    // Vsaj dve vrstici (blagajna/ddv/promet)
    expect(entry.lines.length).toBeGreaterThanOrEqual(2)
  })

  test('FLOW-13: verify inventory — zaloga razknjižena + StockTransaction', async ({ request }) => {
    // StockTransaction type=sal za to naročilo (recepta mi-1 → inv-kava)
    const res = await request.get(`${API_BASE}/inventory/transactions?type=sale&limit=50`, {
      headers: authHeaders(),
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    const saleTx = body.transactions.find((t: { orderId: string }) => t.orderId === orderId)
    expect(saleTx).toBeTruthy()
    // Količina je PODPISANA: prodaja = negativna (razknjižitev), nabava = pozitivna
    expect(Number(saleTx.quantity)).toBeLessThan(0)
    expect(Number(saleTx.newQty)).toBeLessThan(Number(saleTx.previousQty))
    expect(saleTx.inventoryItem.name).toContain('Kava')

    // Količina na zalogi se je zmanjšala (če je bil začetni snapshot znan)
    if (!Number.isNaN(stockQtyBefore)) {
      const invRes = await request.get(`${API_BASE}/inventory?limit=200`, { headers: authHeaders() })
      expect(invRes.ok()).toBeTruthy()
      const invBody = await invRes.json()
      const items = invBody.items ?? invBody.inventoryItems ?? invBody
      const kava = Array.isArray(items)
        ? items.find((i: { id: string }) => i.id === 'inv-kava')
        : undefined
      expect(kava).toBeTruthy()
      expect(Number(kava.quantity)).toBeLessThan(stockQtyBefore)
    }
  })

  test('FLOW-14: verify audit log — plačilo in naročilo zapisana v dnevnik', async ({ request }) => {
    // Audit vnos za plačilo (CREATE_PAYMENT)
    const payAudit = await request.get(
      `${API_BASE}/audit?entityType=Payment&entityId=${paymentId}&limit=10`,
      { headers: authHeaders() },
    )
    expect(payAudit.ok()).toBeTruthy()
    const payBody = await payAudit.json()
    expect(payBody.logs.length).toBeGreaterThan(0)
    expect(payBody.logs[0].action).toBe('CREATE_PAYMENT')

    // Audit vnosi za naročilo (ustvarjeno + posodobljeno med potekom)
    const orderAudit = await request.get(
      `${API_BASE}/audit?entityType=Order&entityId=${orderId}&limit=20`,
      { headers: authHeaders() },
    )
    expect(orderAudit.ok()).toBeTruthy()
    const orderBody = await orderAudit.json()
    expect(orderBody.logs.length).toBeGreaterThan(0)
    const actions = orderBody.logs.map((l: { action: string }) => l.action)
    expect(actions).toContain('CREATE_ORDER')
  })
})
