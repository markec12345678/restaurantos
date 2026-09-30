// ============================================
// RestaurantOS — ISSUE #144 P0 korak 7 (§7): GOLDEN PATH E2E
// ============================================
// En CELOVIT dokaz §7 verige (en serial tok, isti backend, ista baza):
//
//   Setup → Login → Open Shift → Table → Order → Modifier → Fire → KDS
//   → Ready → Serve → Payment → Receipt → FURS → Close → Z-report
//   → Inventory → Report (+ Audit, + Idempotency, + Authorization)
//
// Preslikava segmentov na teste (izvedba = vrstni red deklaracij):
//   Setup         → GP-SETUP   (setup/status isInitialized)
//   Login         → FLOW-1     (PIN avtentikacija; GP-AUTH = 401 brez tokena)
//   Open Shift    → FLOW-1b    (blagajniška izmena @ loc-1 prek gp-cashier)
//   Table         → FLOW-2     (prosta miza → zasedena v FLOW-3)
//   Order+Modifier→ FLOW-3     (modifiersJson 'Ekstra sir' — strežniško
//                            avtoritativna cena = osnova + 1.5 iz DB)
//   (add items)   → FLOW-4
//   Fire          → FLOW-5     (firedAt + in-progress)
//   KDS           → FLOW-6     (kuhinja vidi naročilo)
//   Ready/Serve   → FLOW-7     (item statusi ready→served, order ready)
//   Payment       → FLOW-9     (gotovina, order paid)
//   Idempotency   → FLOW-9b    (isti idempotencyKey = isti payment, 200)
//   Receipt       → FLOW-11    (predogled ZDDV-1 + tisk)
//   FURS          → FLOW-10    ⚠️ SIMULACIJA (FURS_ALLOW_SIMULATION=true):
//                              račun OSTANE pending, fiscalVerified=false,
//                              EOR prazen, audit FURS_VERIFY_FAILED —
//                              NI ekvivalent produkcijski FURS validaciji.
//   Accounting    → FLOW-12    (double-entry JE za plačilo)
//   Inventory     → FLOW-13    (razknjižba + StockTransaction type=sale)
//   Audit         → FLOW-14    (CREATE_PAYMENT + CREATE_ORDER)
//   Close         → FLOW-16    (zaprtje izmene; cashDifference = 0;
//                              avtomatski Z-osnutek postShiftCloseActions)
//   Z-report      → FLOW-17    (finalizacija; OPEN_SHIFTS vrata zaprta)
//   Report        → FLOW-18    (EOD vsote vključujejo NAŠE plačilo)
//
// Ostali §7 dokazni vidiki (izven tega spec-a, referenčno):
//   - Tenant izolacija: tests/e2e/multi-tenant-security.spec.ts (MODELA-*)
//   - Offline/reconnect: tests/e2e/outbox-worker.spec.ts (server-side outbox)
//   - Failure path (FURS verify fail): FLOW-10 audit preverja FURS_VERIFY_FAILED
//
// Test je API-level (isti vzorec kot workflow.spec.ts) — pokriva CEL backend
// potek, ne pa tudi klikanja po UI (UI testi so v critical-path.spec.ts).
//
// Predpogoji (zagotovi jih playwright.config.ts webServer + seed):
//   - test-admin / PIN 1111 (admin, brez lokacije — super-admin kanon)
//   - gp-cashier @ loc-1 (R177 seed — lokacija blagajniške izmene)
//   - loc-1, table-1, menu-1/cat-1, mi-1/mi-2
//   - inv-kava (100 kos) + RecipeItem mi-1→inv-kava (1 kos/servis)
//   - Modifier 'Ekstra sir' 1.5 na mg-loc-1-1 (mod-loc-1-2)
//   - FURS_ALLOW_SIMULATION=true (fiskalizacija v simulacijskem načinu)
// ============================================
import { test, expect, request as playwrightRequest } from '@playwright/test'

const API_BASE = '/api'
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const TEST_PIN = '1111'
const TEST_EMPLOYEE_ID = 'test-admin'

test.describe.configure({ mode: 'serial' })

// LJ poslovni dan (paritetno z lib/timezone-sl ljubljanaTodayStr — en-CA = YYYY-MM-DD)
function ljubljanaToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Ljubljana' }).format(new Date())
}

test.describe('Golden Path (§7): login → order → plačilo → FURS(sim) → Close → Z → Report', () => {
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
  // ── §7 Golden Path stanje ──
  let shiftId: string
  let startingCash = 0
  let closingCash = 0
  let paymentTotal = 0
  let paymentIdempotencyKey = ''
  let mi1BasePrice = 0

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
  // 0. §7 SETUP — baza je inicializirana (javna ruta, pariteta setup.spec)
  // ═══════════════════════════════════════════════════════════════

  test('GP-SETUP: e2e baza je inicializirana (§7: Setup)', async ({ request }) => {
    const res = await request.get(`${API_BASE}/setup/status`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.isInitialized).toBe(true)
  })

  // ═══════════════════════════════════════════════════════════════
  // 1. LOGIN + priprava (miza, artikli, začetna zaloga, izmena)
  // ═══════════════════════════════════════════════════════════════

  test('FLOW-1: login vrne veljaven token (PIN avtentikacija)', async ({ request }) => {
    expect(authToken).toBeTruthy()
    // Token dejansko deluje na avtenticirani ruti
    const res = await request.get(`${API_BASE}/tables`, { headers: authHeaders() })
    expect(res.ok()).toBeTruthy()
  })

  test('GP-AUTH: brez tokena sta blagajna in Z-poročilo 401 (§7: Authorization)', async ({ request }) => {
    const cash = await request.get(`${API_BASE}/cash-register`)
    expect(cash.status()).toBe(401)
    const zr = await request.post(`${API_BASE}/z-report`, {
      data: { date: '2026-01-01' },
    })
    expect(zr.status()).toBe(401)
  })

  test('FLOW-1b: Open Shift — blagajniška izmena odprta na loc-1 (§7: Open Shift)', async ({ request }) => {
    const getRes = await request.get(`${API_BASE}/cash-register`, { headers: authHeaders() })
    expect(getRes.ok()).toBeTruthy()
    const state = await getRes.json()

    if (state.activeShift) {
      // Že odprta izmena (re-run / prejšnji spec) — ponovno uporabi
      shiftId = state.activeShift.id
      startingCash = Number(state.activeShift.startingCash)
      expect(state.activeShift.status).toBe('open')
      expect(shiftId).toBeTruthy()
      return
    }

    // test-admin seja je brez lokacije (super-admin kanon) → ?locationId=loc-1;
    // lokacija izmene se izpelje iz gp-cashier (loc-1) — glej seed R177.
    const open = async (cash: number) =>
      request.post(`${API_BASE}/cash-register?locationId=loc-1`, {
        headers: authHeaders(),
        data: { employeeId: 'gp-cashier', employeeName: 'GP Cashier', startingCash: cash },
      })

    let res = await open(100)
    if (res.status() === 409) {
      // STARTING_CASH_MISMATCH: prejšnja zaprta izmena ima drugačen končni
      // seštevek (re-run baze brez reset) — uskladi z expectedCash iz napake
      const err = await res.json()
      expect(typeof err.expectedCash).toBe('number')
      res = await open(Number(err.expectedCash))
    } else if (res.status() === 400) {
      // ALREADY_OPEN (race z drugim spec-om) — ponovno preberi aktivno izmeno
      const reGet = await request.get(`${API_BASE}/cash-register`, { headers: authHeaders() })
      const reState = await reGet.json()
      expect(reState.activeShift).toBeTruthy()
      shiftId = reState.activeShift.id
      startingCash = Number(reState.activeShift.startingCash)
      expect(shiftId).toBeTruthy()
      return
    }
    // Route kontrakt: POST /api/cash-register vrne 200 (NextResponse.json brez
    // status arg) — uspeh = 2xx; 409 = STARTING_CASH_MISMATCH, 400 = ALREADY_OPEN
    expect(res.status()).toBe(200)
    const shift = await res.json()
    expect(shift.status).toBe('open')
    expect(shift.locationId).toBe('loc-1')
    shiftId = shift.id
    startingCash = Number(shift.startingCash)
    expect(shiftId).toBeTruthy()
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

  test('FLOW-3: create order — naročilo z MODIFIERJEM, miza zasedena (§7: Order + Modifier)', async ({ request }) => {
    // Priprava artiklov (mi-1 ima recepto → inventar se razknjiži)
    const menuRes = await request.get(`${API_BASE}/menu-items?limit=20`, { headers: authHeaders() })
    expect(menuRes.ok()).toBeTruthy()
    const menuBody = await menuRes.json()
    expect(menuBody.menuItems.length).toBeGreaterThan(0)
    const byId = new Map(menuBody.menuItems.map((m: { id: string }) => [m.id, m]))
    menuItemId = byId.has('mi-1') ? 'mi-1' : menuBody.menuItems[0].id
    menuItemId2 = byId.has('mi-2') ? 'mi-2'
      : menuBody.menuItems.find((m: { id: string }) => m.id !== menuItemId)?.id ?? menuItemId
    // Osnovna cena mi-1 za kasnejšo primerjavo z modifierjem
    const mi1 = byId.get(menuItemId) as { price?: number } | undefined
    mi1BasePrice = Number(mi1?.price ?? 0)

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

    // §7 Modifier: 'Ekstra sir' (seed mod-loc-1-2, 1.50 € — cena pride iz DB,
    // klientova vrednost je samo fallback). Strežnik izračuna enotno ceno
    // = osnova + vsota modifierjev (order-items.ts, server-authoritative).
    const modifier = { name: 'Ekstra sir', price: 1.5 }
    const res = await request.post(`${API_BASE}/orders`, {
      headers: authHeaders(),
      data: {
        type: 'dine-in',
        tableId,
        orderItems: [{
          menuItemId,
          quantity: 1,
          modifiersJson: JSON.stringify([modifier]),
        }],
        idempotencyKey: `e2e-core-${Date.now()}`,
      },
    })
    expect(res.ok()).toBeTruthy()
    const order = await res.json()
    expect(order.id).toBeTruthy()
    expect(order.status).toBe('pending')
    expect(order.paymentStatus).toBe('unpaid')
    // R115 (P0 firedAt source-of-truth): Sales "Oddaj naročilo" mora VEDNO
    // nastaviti firedAt (kuhinja je obveščena ob isti kreaciji — print/WS/push;
    // KDS časovnik, waiter elapsed in operational-alerts berejo to polje).
    // Prej je bilo firedAt=null → KDS timer "--:--", alerti nevidni.
    expect(order.firedAt).toBeTruthy()
    expect(order.orderItems.length).toBe(1)
    // §7 Modifier: enotna cena = osnova + modifier (strežniški izračun)
    expect(Number(order.orderItems[0].price)).toBeCloseTo(mi1BasePrice + 1.5, 2)
    // Modifier je zapisan na OrderItem (wire: modifiersJson string ali array)
    const rawMods = order.orderItems[0].modifiersJson
    const mods: Array<{ name: string }> = typeof rawMods === 'string' ? JSON.parse(rawMods) : rawMods
    expect(Array.isArray(mods)).toBe(true)
    expect(mods.some((m) => m.name === 'Ekstra sir')).toBe(true)
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

  test('FLOW-5: send to kitchen — fire naročila (§7: Fire)', async ({ request }) => {
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

  test('FLOW-6: KDS receives order — kuhinja vidi naročilo (§7: KDS)', async ({ request }) => {
    const res = await request.get(`${API_BASE}/kitchen`, { headers: authHeaders() })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    const kdsOrder = body.orders.find((o: { id: string }) => o.id === orderId)
    expect(kdsOrder).toBeTruthy()
    expect(kdsOrder.status).toBe('in-progress')
    expect(kdsOrder.orderItems.length).toBe(2)
    expect(kdsOrder.orderItems[0].menuItem).toBeTruthy()
  })

  test('FLOW-7: modify order — statusi artiklov (KDS ready + natakar served) (§7: Ready → Serve)', async ({ request }) => {
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

  test('FLOW-9: pay — plačilo v gotovini, naročilo poravnano (§7: Payment)', async ({ request }) => {
    const orderRes = await request.get(`${API_BASE}/orders/${orderId}`, { headers: authHeaders() })
    const order = await orderRes.json()
    paymentTotal = Number(order.total)

    paymentIdempotencyKey = `e2e-core-pay-${Date.now()}`
    const res = await request.post(`${API_BASE}/payments`, {
      headers: authHeaders(),
      data: {
        checkId,
        amount: paymentTotal,
        tipAmount: 0,
        type: 'cash',
        idempotencyKey: paymentIdempotencyKey,
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

  test('FLOW-9b: idempotency — ponovljeno plačilo z istim ključem = isti payment (§7: Idempotency)', async ({ request }) => {
    // SKB idempotency kanon (create-payment.ts): obstoječi idempotencyKey →
    // 200 + ISTI rezultat, NE novo plačilo (double-click / retry / offline)
    const res = await request.post(`${API_BASE}/payments`, {
      headers: authHeaders(),
      data: {
        checkId,
        amount: paymentTotal,
        tipAmount: 0,
        type: 'cash',
        idempotencyKey: paymentIdempotencyKey,
      },
    })
    expect(res.ok()).toBeTruthy()
    const replay = await res.json()
    expect(replay.id).toBe(paymentId)

    // Naročilo ostane točno enkrat poravnano
    const orderRes = await request.get(`${API_BASE}/orders/${orderId}`, { headers: authHeaders() })
    const order = await orderRes.json()
    expect(order.paymentStatus).toBe('paid')
  })

  test('FLOW-10: fiscalize — račun ustvarjen + FURS overitev (⚠️ SIMULACIJA = pending)', async ({ request }) => {
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

    // 2. FURS overitev — §7 OZNAKA: v TESTNEM okolju (brez certifikata) je
    //    SIMULACIJA ISKRENA: račun OSTANE pending (fiscalVerified=false) in
    //    overitev vrne 400 s fiscalStatus='pending' — tako E2E ne more "lažno"
    //    potrjevati fiskalizacije. Pravi EOR pride samo s certifikatom.
    //    To NI produkcijska FURS validacija (fizikalna validacija = ločen obseg).
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

  test('FLOW-11: print/export receipt — predogled (z modifierjem) + označitev tiska (§7: Receipt)', async ({ request }) => {
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
    // §7 Modifier: modifier je viden na postavki računa
    const itemMods: Array<{ name: string }> = preview.items[0].modifiers ?? []
    expect(itemMods.some((m) => m.name === 'Ekstra sir')).toBe(true)

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

  test('FLOW-13: verify inventory — zaloga razknjižena + StockTransaction (§7: Inventory)', async ({ request }) => {
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

  test('FLOW-14: verify audit log — plačilo in naročilo zapisana v dnevnik (§7: Audit trail)', async ({ request }) => {
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

  // ═══════════════════════════════════════════════════════════════
  // GOLDEN PATH rep (§7): Close → Z-report → Report
  // (živa izmena → zaprtje → avtomatski osnutek → finalizacija → EOD)
  // ═══════════════════════════════════════════════════════════════

  test('FLOW-15: živa izmena vidi NAŠO gotovinsko prodajo', async ({ request }) => {
    const res = await request.get(`${API_BASE}/cash-register`, { headers: authHeaders() })
    expect(res.ok()).toBeTruthy()
    const state = await res.json()
    expect(state.activeShift).toBeTruthy()
    expect(state.activeShift.id).toBe(shiftId)
    // Živa statistika je scoped na izmeno (loc-1) in vključuje NAŠE plačilo
    // (calculateLiveStats: paid/storno, paidAt ≥ openedAt, locationId izmene)
    expect(Number(state.liveStats.cashSales)).toBeGreaterThanOrEqual(paymentTotal)
    expect(Number(state.liveStats.totalSales)).toBeGreaterThanOrEqual(paymentTotal)
    closingCash = startingCash + Number(state.liveStats.cashSales)
  })

  test('FLOW-16: Close — zaprtje izmene brez gotovinske razlike (§7: Close)', async ({ request }) => {
    const res = await request.put(`${API_BASE}/cash-register/${shiftId}`, {
      headers: authHeaders(),
      data: { closingCash, totalTips: 0, notes: 'Golden Path E2E (§7)' },
    })
    expect(res.ok()).toBeTruthy()
    const closed = await res.json()
    expect(closed.status).toBe('closed')
    expect(closed.closedAt).toBeTruthy()
    // Prodaja izmere vključuje NAŠE plačilo; gotovina se strojno ujema
    expect(Number(closed.totalSales)).toBeGreaterThanOrEqual(paymentTotal)
    expect(Number(closed.cashSales)).toBeGreaterThanOrEqual(paymentTotal)
    // expectedCash = startingCash + cashSales + cashTips(0) = closingCash
    expect(Number(closed.cashDifference)).toBeCloseTo(0, 2)
    // Avtomatski Z-osnutek (postShiftCloseActions) je sprožen ob zaprtju —
    // njegov obstoj/stanje preveri FLOW-17.
  })

  test('FLOW-17: Z-report — avtomatski osnutek + finalizacija (§7: Z-report)', async ({ request }) => {
    const today = ljubljanaToday()

    // 1. Avtomatski OSNUTEK (postShiftCloseActions ob zaprtju izmene) obstaja
    const draftRes = await request.get(`${API_BASE}/z-report?date=${today}`, { headers: authHeaders() })
    expect(draftRes.ok()).toBeTruthy()
    const drafts = await draftRes.json()
    const draft = drafts.find((r: { locationId?: string | null }) => r.locationId === 'loc-1')
    expect(draft).toBeTruthy()
    expect(draft.status).not.toBe('finalized')

    // 2. Finalizacija (admin brez session lokacije sme body.locationId;
    //    OPEN_SHIFTS vrata so zaprta — izmena je zaprta v FLOW-16)
    const finRes = await request.post(`${API_BASE}/z-report`, {
      headers: authHeaders(),
      data: { date: today, locationId: 'loc-1', actualCash: closingCash, notes: 'Golden Path E2E (§7)', finalize: true },
    })
    expect(finRes.ok()).toBeTruthy()
    const report = await finRes.json()
    expect(report.status).toBe('finalized')
    // Konsistenca: poročilo dneva vključuje NAŠE plačilo
    expect(Number(report.totalSales)).toBeGreaterThanOrEqual(paymentTotal)
    expect(Number(report.cashSales)).toBeGreaterThanOrEqual(paymentTotal)

    // 3. GET potrdi stanje (status filter)
    const listRes = await request.get(
      `${API_BASE}/z-report?date=${today}&status=finalized`,
      { headers: authHeaders() },
    )
    expect(listRes.ok()).toBeTruthy()
    const finalized = await listRes.json()
    expect(finalized.some((r: { id: string }) => r.id === report.id)).toBe(true)
  })

  test('FLOW-18: Report — EOD poročilo konsistentno s plačilom (§7: Report)', async ({ request }) => {
    const today = ljubljanaToday()
    const res = await request.get(
      `${API_BASE}/reports/eod?date=${today}&locationId=loc-1`,
      { headers: authHeaders() },
    )
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    // EOD vsote vključujejo NAŠE plačilo (pariteta Z-poročilu)
    expect(Number(body.summary.totalRevenue)).toBeGreaterThanOrEqual(paymentTotal)
    expect(Number(body.summary.paidOrders)).toBeGreaterThanOrEqual(1)
    // Dan je operativno zaključen (izmena @ loc-1 je zaprta)
    expect(body.isDayClosed).toBe(true)
  })
})
