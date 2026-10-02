// @vitest-environment node
// ============================================
// R207 / ISSUE #151 korak 2 — INTEGRACIJA: FISKALNA VERIGA
// ORDER → PAYMENT → RECEIPT → FURS(sim) → SHIFT → Z → EOD (prava DB)
// ============================================
// Repo-backed dokazi za issue #151 korak 2 (§26 RECONCILIATION CHECKPOINTS
// 1–8 + scenarija G/H + §24 failure injection — implementirana podmnožica):
//
//   CKPT 1  Order persisted          — POST /api/orders (strežniški P1-8 izračun)
//   CKPT 2  Payment persisted        — check + cash plačilo → paid (Σ == total)
//   CKPT 3  Receipt persisted        — POST /api/receipts/[id]: total == Order.total
//                                     na cent; DUPLICATE POST → ISTI receipt
//                                     (§24.10 duplicate receipt creation)
//   CKPT 4  Fiscal state persisted   — POST /api/furs: brez certifikata (1) brez
//                                     FURS_ALLOW_SIMULATION → fail 'pending'
//                                     (§24.11/12 temp failure), (2) retry z
//                                     FURS_ALLOW_SIMULATION=true → SIMULACIJA
//                                     ostane fiscalVerified=false (fail-closed:
//                                     simulacija ≠ overitev, §29 label
//                                     disciplina), eor ostane '' (R166 F5),
//                                     (3) ponovljen submit → še vedno pending,
//                                     EN fiskalni efekt (§24.13 duplicate)
//   CKPT 5  Shift updated            — izmena odprta PRED plačilom (okno)
//   CKPT 6  Shift closed             — PUT /api/cash-register/[id]: totals ==
//                                     Σ payments (neto), cashDifference 0;
//                                     RETRY → SHIFT_ALREADY_CLOSED (§24.14)
//   CKPT 7  Z-report finalized       — POST /api/end-of-day → Z finalized,
//                                     totalSales == 48.78; RETRY finalize →
//                                     Z_REPORT_FINALIZED 400 (§24.15)
//   CKPT 8  EOD reflects transaction — GET /api/end-of-day: revenue == 48.78
//
// FURS meja je SIMULIRANA in to je deklarirano: drill DOKAZUJE repo kanon
// (simulacija NE označi računa kot overjen — fail-closed), NE produkcije.
// Produkcija NE validirana (#141 — certifikat = uporabniški korak).
//
// Opomba: auth-middleware (requireAuth) je mockan na MEJI (realna session
// struktura); VSE ostalo (route handlerji, zod, P1-8 Decimal celovod, R181
// check-recalc, plačilni ε guard, receipt številčenje, FURS verify kanon
// vključno s CAS claimom, R185 CAS shift close, R110 Z upsert z advisory
// lockom, EOD agregacija) je REALNO nad PGlite.
// Zagon: node scripts/init-pglite.mjs (PGLITE_DATA_DIR=/tmp/pglite-data-it)
//        → vitest run --config vitest.config.integration.ts <file>
// ============================================

import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest'

// KLJUČNO: tests/setup.ts globalno mock-ira @/lib/db — tu želimo PRAVEGA klienta.
vi.unmock('@/lib/db')

// Auth na meji: realna session struktura (vzorec r128/r132/r151)
const authRef = vi.hoisted(() => ({
  current: null as null | {
    employeeId: string
    role: string
    locationId: string | null
    permissions: string[]
  },
}))

vi.mock('@/lib/auth-middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-middleware')>()
  return {
    ...actual,
    requireAuth: async () =>
      authRef.current
        ? {
            session: {
              token: 'integration-test-token',
              employeeId: authRef.current.employeeId,
              role: authRef.current.role,
              permissions: authRef.current.permissions,
              createdAt: Date.now(),
              expiresAt: Date.now() + 3_600_000,
              absoluteExpiry: Date.now() + 86_400_000,
              locationId: authRef.current.locationId,
            },
            error: null,
          }
        : {
            session: null,
            error: new Response(JSON.stringify({ error: 'Avtentikacija je obvezna.' }), { status: 401 }),
          },
    // resolveTenantLocationId / resolveTenantLocationIdOrThrow ostanejo REALNI
  }
})

import { db } from '@/lib/db'
import { POST as ordersPost } from '@/app/api/orders/route'
import { POST as checksPost } from '@/app/api/checks/route'
import { POST as paymentsPost } from '@/app/api/payments/route'
import { POST as receiptsPost } from '@/app/api/receipts/[id]/route'
import { POST as fursPost } from '@/app/api/furs/route'
import { POST as cashRegisterPost } from '@/app/api/cash-register/route'
import { PUT as cashRegisterPut } from '@/app/api/cash-register/[id]/route'
import { POST as eodPost, GET as eodGet } from '@/app/api/end-of-day/route'
import { POST as zReportPost } from '@/app/api/z-report/route'
import { ljubljanaTodayStr, ljubljanaDayBounds } from '@/lib/timezone-sl'

const RUN_ID = `r207-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

// ---------- Seed ID-ji ----------
const IDS = {
  location: `${RUN_ID}-loc`,
  employee: `${RUN_ID}-emp`,
  settings: `${RUN_ID}-settings`,
  menu: `${RUN_ID}-menu`,
  category: `${RUN_ID}-cat`,
  menuItem: `${RUN_ID}-item`,
}

const IDEM_ORDER = `${RUN_ID}-order-1`
const IDEM_PAY = `${RUN_ID}-pay-1`

// ---------- Pričakovani zneski (P1-8 kanon: ROUND_HALF_UP na 2 decimali, DDV po postavki) ----------
// Naročilo: 2 × 19.99 = 39.98; DDV 22 % = 8.7956 → 8.80; total = 48.78
const EXP = { subtotal: 39.98, vat: 8.8, total: 48.78 }

async function asJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

function req(url: string, method: string, body: unknown): Request {
  return new Request(`http://local${url}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: 'Bearer integration' },
    body: JSON.stringify(body),
  })
}

function post(url: string, body: unknown): Request {
  return req(url, 'POST', body)
}

let orderId = ''
let checkId = ''
let shiftId = ''
let receiptId = ''
let receiptNumber = ''
const auditStart = new Date(Date.now() - 60_000)

beforeAll(async () => {
  // FURS simulacija je v IT PRIVZETO izklopljena — CKPT 4a dokazuje "brez
  // certifikata in brez sim flaga" vejo; CKPT 4b jo eksplicitno vklopi.
  delete process.env.FURS_ALLOW_SIMULATION

  await db.location.create({
    data: {
      id: IDS.location,
      name: 'R207 Lokacija',
      code: `${RUN_ID}-L`,
      premisesId: `${RUN_ID}-p`,
      isActive: true,
      businessId: `${RUN_ID}-biz`,
      taxId: 'SI20720727',
      registerNumber: 'BLG-R207',
      fursEnvironment: 'test',
      // fursCertPath/fursCertPassword ostanejo prazna → SIMULACIJSKA veja
    },
  })

  await db.restaurantSettings.create({
    data: {
      id: IDS.settings,
      name: 'R207 Restavracija',
      businessId: `${RUN_ID}-biz`,
      taxId: 'SI20720727',
      registerNumber: 'BLG-R207',
      isActive: true,
    },
  })

  await db.employee.create({
    data: {
      id: IDS.employee,
      name: 'R207 Test Admin',
      email: `${RUN_ID}@r207-test.local`,
      role: 'admin', // admin = admin permission za FURS verify + EOD POST
      status: 'active',
      pin: `pin-${RUN_ID}`,
      locationId: IDS.location,
    },
  })

  await db.menu.create({ data: { id: IDS.menu, name: `R207 Meni ${RUN_ID}`, locationId: IDS.location } })
  await db.category.create({ data: { id: IDS.category, name: `R207 Kat ${RUN_ID}`, menuId: IDS.menu } })
  await db.menuItem.create({ data: { id: IDS.menuItem, name: 'R207 Test Pica', price: 19.99, categoryId: IDS.category, vatRate: 22 } })

  // Privzeta seja: admin lokacije (admin pokriva take_orders/manage_cash/admin permission zahteve)
  authRef.current = { employeeId: IDS.employee, role: 'admin', locationId: IDS.location, permissions: [] }
})

afterAll(async () => {
  delete process.env.FURS_ALLOW_SIMULATION

  // Čiščenje po FK redu: audit logi (brez FK), payments → orders → receipt →
  // shift → zReport → katalog → employee → settings → location.
  await db.auditLog.deleteMany({
    where: {
      OR: [
        { action: 'FURS_VERIFY_FAILED', entityId: receiptId },
        { action: 'FURS_VERIFY_SUCCESS', entityId: receiptId },
        { action: 'FURS_VERIFY_ERROR' },
        { action: 'EOD_COMPLETED', timestamp: { gte: auditStart } },
        { action: 'CLOSE_REGISTER_SHIFT', entityId: shiftId },
      ],
    },
  }).catch(() => {})
  await db.payment.deleteMany({ where: { idempotencyKey: IDEM_PAY } }).catch(() => {})
  await db.receipt.deleteMany({ where: { orderId } }).catch(() => {})
  await db.order.deleteMany({ where: { idempotencyKey: IDEM_ORDER } }).catch(() => {})
  await db.cashRegisterShift.deleteMany({ where: { id: shiftId } }).catch(() => {})
  await db.zReport.deleteMany({ where: { reportDate: ljubljanaDayBounds(ljubljanaTodayStr()).start, locationId: IDS.location } }).catch(() => {})
  await db.menuItem.deleteMany({ where: { id: IDS.menuItem } }).catch(() => {})
  await db.category.deleteMany({ where: { id: IDS.category } }).catch(() => {})
  await db.menu.deleteMany({ where: { id: IDS.menu } }).catch(() => {})
  await db.employee.deleteMany({ where: { id: IDS.employee } }).catch(() => {})
  await db.restaurantSettings.deleteMany({ where: { id: IDS.settings } }).catch(() => {})
  await db.location.deleteMany({ where: { id: IDS.location } }).catch(() => {})
  await db.$disconnect().catch(() => {})
})

// ============================================
// CKPT 5: Shift open (pred plačilom — okno) + CKPT 1: Order
// ============================================
describe('R207 (5)+(1): izmena odprta pred prometom + naročilo persistirano', () => {
  it('CKPT 5: POST /api/cash-register — izmena odprta (startingCash 100.00)', async () => {
    const res = await cashRegisterPost(post('/api/cash-register', { employeeId: IDS.employee, employeeName: 'R207 Blagajnik', startingCash: 100.0 }))
    expect(res.status).toBe(200)
    const shift = await asJson(res) as Record<string, unknown>
    expect(shift.id).toBeTruthy()
    expect(shift.status).toBe('open')
    expect(Number(shift.startingCash)).toBe(100.0)
    shiftId = String(shift.id)
  })

  it('CKPT 1: POST /api/orders — Order persistiran z strežniškimi zneski (P1-8)', async () => {
    const res = await ordersPost(post('/api/orders', {
      type: 'takeout',
      orderItems: [{ menuItemId: IDS.menuItem, quantity: 2 }],
      idempotencyKey: IDEM_ORDER,
    }))
    expect(res.status).toBe(201)

    const order = await db.order.findUnique({ where: { idempotencyKey: IDEM_ORDER } })
    expect(order).not.toBeNull()
    orderId = order!.id
    expect(Number(order!.subtotal)).toBe(EXP.subtotal)
    expect(Number(order!.tax)).toBe(EXP.vat)
    expect(Number(order!.total)).toBe(EXP.total)
    expect(order!.paymentStatus).toBe('unpaid')
    expect(order!.locationId).toBe(IDS.location)
  })
})

// ============================================
// CKPT 2: Payment — plačilna rekonciliacija na persistiranem stanju
// ============================================
describe('R207 (2): Σ(plačila) == ček == naročilo na cent', () => {
  it('CKPT 2: check + cash plačilo → paid; Σ(completed) == Order.total', async () => {
    const order = await db.order.findUnique({ where: { idempotencyKey: IDEM_ORDER }, include: { orderItems: true } })
    const resCheck = await checksPost(post('/api/checks', {
      orderId: order!.id,
      orderItemIds: order!.orderItems.map(i => i.id),
    }))
    expect(resCheck.status).toBe(201)
    const check = await asJson(resCheck) as Record<string, number | string>
    checkId = String(check.id)
    expect(Number(check.total)).toBe(EXP.total)

    const resPay = await paymentsPost(post('/api/payments', {
      checkId,
      amount: EXP.total,
      type: 'cash',
      idempotencyKey: IDEM_PAY,
    }))
    expect(resPay.status).toBe(201)

    const checkAfter = await db.check.findUnique({ where: { id: checkId } })
    expect(checkAfter!.paymentStatus).toBe('paid')
    const orderAfter = await db.order.findUnique({ where: { idempotencyKey: IDEM_ORDER } })
    expect(orderAfter!.paymentStatus).toBe('paid')
    expect(orderAfter!.paidAt).not.toBeNull()

    const paidSum = await db.payment.aggregate({
      where: { checkId, status: 'completed' },
      _sum: { amount: true },
    })
    expect(Number(paidSum._sum.amount)).toBe(EXP.total) // §25 na cent
  })
})

// ============================================
// CKPT 3: Receipt — persistiran snapshot + duplicate protection
// ============================================
describe('R207 (3): Receipt persistiran — total == Order.total; duplicate POST → ISTI račun', () => {
  it('CKPT 3: POST /api/receipts/[orderId] — račun s snapshot zneski (na cent)', async () => {
    const res = await receiptsPost(
      new Request(`http://local/api/receipts/${orderId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer integration' },
        body: JSON.stringify({ paymentMethod: 'cash' }),
      }),
      { params: Promise.resolve({ id: orderId }) },
    )
    expect(res.status).toBe(201)
    const receipt = await asJson(res) as Record<string, unknown>
    receiptId = String(receipt.id)
    receiptNumber = String(receipt.receiptNumber)
    expect(receiptNumber).toContain('R-')

    // §26 CKPT 3: Receipt.total == Order.total == Check.total na cent
    expect(Number(receipt.total)).toBe(EXP.total)
    expect(Number(receipt.totalWithTip)).toBe(EXP.total)
    expect(receipt.fiscalVerified).toBe(false)

    // Detaljni snapshot kontrakt na PERSISTIRANI vrstici (response shema je stripa)
    const dbReceipt = await db.receipt.findUnique({ where: { id: receiptId } })
    expect(Number(dbReceipt!.subtotal)).toBe(EXP.subtotal)
    expect(Number(dbReceipt!.totalVat)).toBe(EXP.vat)
    expect(dbReceipt!.paymentMethod).toBe('cash')
    expect(dbReceipt!.eor).toBe('')
    expect(dbReceipt!.zoi).not.toBe('') // ZOI placeholder
    expect(dbReceipt!.locationId).toBe(IDS.location) // P1-6: fiskalna veriga po lokaciji

    // vatBreakdown (JSONB native, R150): {"22": {base: 39.98, vat: 8.8}}
    const breakdown = dbReceipt!.vatBreakdown as Record<string, { base: number; vat: number }>
    expect(breakdown['22'].base).toBeCloseTo(EXP.subtotal, 2)
    expect(breakdown['22'].vat).toBeCloseTo(EXP.vat, 2)
  })

  it('§24.10: DUPLICATE receipt creation → ISTI račun (idempotenten), NOV finančni efekt NE nastane', async () => {
    const before = await db.receipt.count({ where: { orderId } })
    const res = await receiptsPost(
      new Request(`http://local/api/receipts/${orderId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer integration' },
        body: JSON.stringify({ paymentMethod: 'cash' }),
      }),
      { params: Promise.resolve({ id: orderId }) },
    )
    // Kontrakt: obstoječ → 200 z ISTIM računom (ne 201, ne nov račun)
    expect(res.status).toBe(200)
    const receipt = await asJson(res) as Record<string, unknown>
    expect(String(receipt.id)).toBe(receiptId)
    expect(String(receipt.receiptNumber)).toBe(receiptNumber)
    expect(await db.receipt.count({ where: { orderId } })).toBe(before) // 1 → 1
  })
})

// ============================================
// CKPT 4: FURS fiskalna meja — SIMULACIJA (deklarirano) + §24 injection
// ============================================
describe('R207 (4): FURS verify — temp failure → retry(sim) → duplicate; fail-closed', () => {
  it('§24.11/12: FURS brez certifikata (brez sim flaga) → 400, fiscalStatus=pending, NI lažne overitve', async () => {
    delete process.env.FURS_ALLOW_SIMULATION // eksplicitno izklopi simulacijsko vejo
    const res = await fursPost(post('/api/furs', { orderId }))
    expect(res.status).toBe(400)
    const body = await asJson(res)
    expect(body.success).toBe(false)
    expect(body.fiscalVerified).toBe(false)
    expect(body.fiscalStatus).toBe('pending')
    expect(String(body.error)).toContain('certifikat')

    // §25: persistirano stanje — NI overitve
    const receipt = await db.receipt.findUnique({ where: { id: receiptId } })
    expect(receipt!.fiscalVerified).toBe(false)
    expect(receipt!.fiscalStatus).toBe('pending')
    expect(receipt!.eor).toBe('')

    // Audit sled obstaja (§22: fiscalization attempts/results)
    const audit = await db.auditLog.findFirst({ where: { action: 'FURS_VERIFY_FAILED', entityId: receiptId } })
    expect(audit).not.toBeNull()
  })

  it('§24.12 retry z FURS_ALLOW_SIMULATION=true → SIMULACIJA ostane fiscalVerified=false (fail-closed, §29)', async () => {
    process.env.FURS_ALLOW_SIMULATION = 'true' // deklarirana simulacija
    const res = await fursPost(post('/api/furs', { orderId }))
    expect(res.status).toBe(400) // simulacija NI uspeh (ZDDV-1: sim račun NI overjen)
    const body = await asJson(res)
    expect(body.success).toBe(false)
    expect(body.isSimulation).toBe(true)
    expect(body.fiscalStatus).toBe('pending')
    // R166 (F5): eor v odgovoru ostane '' — cross-layer kontrakt
    expect(body.eor).toBe('')
    // X-Fiscal-Warning header — klicatelj VE, da fiskalizacija NI uspela
    expect(res.headers.get('X-Fiscal-Warning')).toContain('pending')

    // §25/§29: persistirano stanje — simulacija NE prevrača fiskalnega stanja
    const receipt = await db.receipt.findUnique({ where: { id: receiptId } })
    expect(receipt!.fiscalVerified).toBe(false)
    expect(receipt!.fiscalStatus).toBe('pending')
    expect(receipt!.eor).toBe('') // DB ostane EOR-prazna (ni overitve)

    // Audit: simulacija je izrecno označena (isSimulation=true v detaljih)
    const audit = await db.auditLog.findFirst({
      where: { action: 'FURS_VERIFY_FAILED', entityId: receiptId },
      orderBy: { timestamp: 'desc' },
    })
    const details = JSON.parse(audit!.details) as Record<string, unknown>
    expect(details.isSimulation).toBe(true)
  })

  it('§24.13: ponovljen FURS submit → še vedno pending, EN fiskalni efekt (ni dvojnega EOR)', async () => {
    const auditsBefore = await db.receipt.count({ where: { orderId } })
    const res = await fursPost(post('/api/furs', { orderId }))
    expect(res.status).toBe(400)
    const body = await asJson(res)
    expect(body.fiscalVerified).toBe(false)
    expect(body.fiscalStatus).toBe('pending')

    // Ni dvojnega računa, ni EOR-ja, številka računa ostane ISTA
    expect(await db.receipt.count({ where: { orderId } })).toBe(auditsBefore)
    const receipt = await db.receipt.findUnique({ where: { id: receiptId } })
    expect(receipt!.receiptNumber).toBe(receiptNumber)
    expect(receipt!.eor).toBe('')
  })
})

// ============================================
// CKPT 6: Shift close — totals == Σ payments + §24.14 retry
// ============================================
describe('R207 (6): zaprtje izmene — CAS kanon, totals == Σ payments; retry → SHIFT_ALREADY_CLOSED', () => {
  it('CKPT 6: PUT /api/cash-register/[id] — closingCash = 100 + 48.78, difference 0', async () => {
    const res = await cashRegisterPut(
      new Request(`http://local/api/cash-register/${shiftId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', authorization: 'Bearer integration' },
        body: JSON.stringify({ closingCash: 148.78, notes: 'R207 CKPT 6' }),
      }),
      { params: Promise.resolve({ id: shiftId }) },
    )
    expect(res.status).toBe(200)
    const shift = await asJson(res) as Record<string, unknown>
    expect(shift.status).toBe('closed')
    // Reconciliation: shift totals == Σ settled payments (ISTI Payment vir)
    expect(Number(shift.totalSales)).toBe(EXP.total)
    expect(Number(shift.cashSales)).toBe(EXP.total)
    expect(Number(shift.cardSales)).toBe(0)
    expect(Number(shift.expectedCash)).toBe(148.78)
    expect(Number(shift.closingCash)).toBe(148.78)
    expect(Number(shift.cashDifference)).toBe(0)
    expect(Number(shift.totalOrders)).toBe(1)

    // §25: persistirano stanje
    const dbShift = await db.cashRegisterShift.findUnique({ where: { id: shiftId } })
    expect(dbShift!.status).toBe('closed')
    expect(Number(dbShift!.totalSales)).toBe(EXP.total)
  })

  it('§24.14: shift close RETRY → 400 SHIFT_ALREADY_CLOSED (brez dup prepisa agregatov)', async () => {
    const res = await cashRegisterPut(
      new Request(`http://local/api/cash-register/${shiftId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', authorization: 'Bearer integration' },
        body: JSON.stringify({ closingCash: 999.99 }), // zlonameren retry — NI upoštevan
      }),
      { params: Promise.resolve({ id: shiftId }) },
    )
    expect(res.status).toBe(400)
    const body = await asJson(res)
    expect(String(body.error)).toContain('že zaprta')

    // Agregati ostanejo AVTORITATIVNI (retry jih ni prepisal)
    const dbShift = await db.cashRegisterShift.findUnique({ where: { id: shiftId } })
    expect(Number(dbShift!.totalSales)).toBe(EXP.total)
    expect(Number(dbShift!.closingCash)).toBe(148.78)
  })
})

// ============================================
// CKPT 7: EOD → Z finalize + §24.15 retry; CKPT 8: EOD odraža transakcijo
// ============================================
describe('R207 (7)+(8): EOD zaključek dneva → Z finalized; retry → Z_REPORT_FINALIZED; EOD odraža transakcijo', () => {
  const date = ljubljanaTodayStr()

  it('CKPT 7: POST /api/end-of-day — izmena že zaprta (idempotentna veja) → Z-poročilo finalizirano', async () => {
    const res = await eodPost(post('/api/end-of-day', { date, actualCash: 148.78, notes: 'R207 CKPT 7' }))
    expect(res.status).toBe(200)
    const body = await asJson(res)
    expect(body.success).toBe(true)
    expect(String(body.message)).toContain('Z-poročilo finalizirano')

    // §25/§26 CKPT 7: ZReport persistiran in finaliziran — totals == shift totals
    const z = await db.zReport.findFirst({
      where: { reportDate: ljubljanaDayBounds(date).start, locationId: IDS.location },
    })
    expect(z).not.toBeNull()
    expect(z!.status).toBe('finalized')
    expect(Number(z!.totalSales)).toBe(EXP.total)
    expect(Number(z!.cashSales)).toBe(EXP.total)
    expect(Number(z!.totalTax)).toBe(EXP.vat)
    expect(z!.totalOrders).toBe(1)
  })

  it('§24.15: Z finalization RETRY (POST /api/z-report finalize) → 400 Z_REPORT_FINALIZED', async () => {
    const res = await zReportPost(post('/api/z-report', { date, finalize: true, actualCash: 148.78 }))
    expect(res.status).toBe(400)
    const body = await asJson(res)
    expect(String(body.error)).toContain('že zaključeno')
  })

  it('CKPT 8: GET /api/end-of-day — isti znesek/dan na report meji (revenue == 48.78)', async () => {
    const res = await eodGet(new Request(`http://local/api/end-of-day?date=${date}`, {
      headers: { authorization: 'Bearer integration' },
    }))
    expect(res.status).toBe(200)
    const body = await asJson(res) as {
      date: string
      orders: { total: number; completed: number; revenue: number }
      payments: { totalPayments: number }
      vat: Record<string, number>
      furs: { verified: number; queued: number; failed: number }
    }
    expect(body.date).toBe(date)
    expect(body.orders.total).toBe(1)
    expect(body.orders.completed).toBe(1)
    expect(body.orders.revenue).toBe(EXP.total) // ISTA transakcija, ISTI znesek
    expect(body.payments.totalPayments).toBe(1)
    // FURS status je ISKREN: račun NI overjen (simulacija) → ni lažnega 'allVerified'
    expect(body.furs.verified).toBe(0)
  })
})
