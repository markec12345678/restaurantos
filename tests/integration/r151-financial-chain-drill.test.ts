// @vitest-environment node
// ============================================
// R151 / ISSUE #151 korak 1 — INTEGRACIJA: FINANČNA VERIGA
// ORDER TOTAL → ZGODOVINSKI SNAPSHOT → PLAČILNA REKONCILIACIJA (prava DB)
// ============================================
// Repo-backed dokazi za issue #151 (P1 — Financial Integrity &
// Reconciliation: Payment → Receipt → FURS → Shift → Z → EOD), korak 1:
//
//   (1) §4 ORDER TOTAL CORRECTNESS — klient NI avtoritativni vir zneskov:
//       payload z vbrizganimi total/subtotal/tax + item price: 0.01 →
//       strežnik izračuna iz DB cen (buildOrderItemsData kanon, P1-8) —
//       vbrizgana polja so ignorirana (zod strip + DB-cene kanon).
//   (2) §5 + scenarij F HISTORICAL PRICE / SNAPSHOT: sprememba
//       MenuItem.price + Modifier.price PO naročilu → zgodovinski OrderItem
//       snapshot (price/vatRate/vatAmount) in Order.total ostanejo
//       NESPREMENJENA; novo naročilo zaračuna nove cene.
//   (3) §7/§8 PAYMENT METHOD RECONCILIATION + SPLIT: Σ(completed payments)
//       == Check.total == Order.total na cent; unpaid → partial → paid;
//       paidAt + paymentMethod (single type / 'split') derivacija
//       (updateCheckAndOrderStatus kanon).
//   (4) §9 IDEMPOTENCY / DUPLICATE PROTECTION (A/B/C + retry):
//       isti idempotencyKey replay → ISTI payment (200), count nespremenjen;
//       overpayment preko ε praga (0.01) → 400 OVERPAYMENT, brez efekta;
//       plačan ček + novo plačilo → 409 ALREADY_PAID, brez efekta.
//   (5) §25 DATABASE-STATE VERIFICATION: vsi dokazi so na persistiranem
//       stanju (db.order/check/payment), ne na odgovorih UI-ja.
//
// Zunanje meje, ki jih ta drill NE pokriva (korak 2 = R206): Receipt →
// FURS (simulacija) → Shift → Z → EOD; browser evidence (#151 §28).
//
// Opomba: auth-middleware (requireAuth) je mockan na MEJI (realna session
// struktura); VSE ostalo (route, zod validacija, P1-8 Decimal celovod,
// R181 check-recalc kanon, plačilni advisory lock + ε prag, Decimal) je
// REALNO nad PGlite.
// Zagon: node scripts/init-pglite.mjs (PGLITE_DATA_DIR=/tmp/pglite-data-it)
//        → vitest run --config vitest.config.integration.ts <file>
// ============================================

import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest'

// KLJUČNO: tests/setup.ts globalno mock-ira @/lib/db — tu želimo PRAVEGA klienta.
vi.unmock('@/lib/db')

// Auth na meji: realna session struktura (vzorec r128/r132)
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

const RUN_ID = `r151-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

// ---------- Seed ID-ji (FK veriga: Location → Menu → Category → MenuItem → InventoryItem) ----------
const IDS = {
  location: `${RUN_ID}-loc`,
  employee: `${RUN_ID}-emp`,
  menu: `${RUN_ID}-menu`,
  category: `${RUN_ID}-cat`,
  menuItem: `${RUN_ID}-item`,
  modifierGroup: `${RUN_ID}-mg`,
  modifier: `${RUN_ID}-mod`,
  inventory: `${RUN_ID}-inv`,
}

const IDEM_ORDER_A = `${RUN_ID}-order-a`
const IDEM_ORDER_B = `${RUN_ID}-order-b`

// ---------- Pričakovani zneski (P1-8 kanon: ROUND_HALF_UP na 2 decimali, DDV po postavki) ----------
// Order A: 19.99 (neto) + 3.00 (modifier DB cena) = 22.99; ×2 = 45.98 osnova
//          DDV 22 % na 45.98 = 10.1156 → 10.12; total = 45.98 + 10.12 = 56.10
const EXP_A = { itemPrice: 22.99, subtotal: 45.98, vat: 10.12, total: 56.10 }
// Order B (PO spremembi cen: 29.99 + 5.00 = 34.99; ×1): DDV 22 % = 7.6978 → 7.70; total 42.69
const EXP_B = { itemPrice: 34.99, subtotal: 34.99, vat: 7.70, total: 42.69 }

async function asJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

function post(url: string, body: unknown): Request {
  return new Request(`http://local${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer integration' },
    body: JSON.stringify(body),
  })
}

beforeAll(async () => {
  await db.location.create({ data: { id: IDS.location, name: 'R151 Lokacija', code: `${RUN_ID}-L`, premisesId: `${RUN_ID}-p`, isActive: true } })

  await db.employee.create({
    data: {
      id: IDS.employee,
      name: 'R151 Test Natakar',
      email: `${RUN_ID}@r151-test.local`,
      role: 'manager',
      status: 'active',
      // Employee.pin je @unique @default("") (CI fix #133) — ekspliciten unikaten pin
      pin: `pin-${RUN_ID}`,
      locationId: IDS.location,
    },
  })

  // Katalog MODEL A: Menu → Category → MenuItem (lokacija)
  await db.menu.create({ data: { id: IDS.menu, name: `R151 Meni ${RUN_ID}`, locationId: IDS.location } })
  await db.category.create({ data: { id: IDS.category, name: `R151 Kat ${RUN_ID}`, menuId: IDS.menu } })
  await db.menuItem.create({ data: { id: IDS.menuItem, name: 'R151 Test Pica', price: 19.99, categoryId: IDS.category, vatRate: 22 } })

  // Modifier skupina (MODEL A — po lokaciji) + modifier z DB ceno +3.00
  await db.modifierGroup.create({ data: { id: IDS.modifierGroup, name: `R151 Velikost ${RUN_ID}`, locationId: IDS.location } })
  await db.modifier.create({ data: { id: IDS.modifier, name: 'R151 Veliki', price: 3.0, modifierGroupId: IDS.modifierGroup } })
  await db.menuItemModifierGroup.create({ data: { menuItemId: IDS.menuItem, modifierGroupId: IDS.modifierGroup } })

  // Zaloga 1:1 link (brez recepture — deductDirect pot): 100 enot, 1 servirka/enoto
  await db.inventoryItem.create({
    data: {
      id: IDS.inventory,
      name: 'R151 Test Pica (zaloga)',
      quantity: 100,
      minQuantity: 5,
      costPerUnit: 4.5,
      servingsPerUnit: 1,
      menuItemId: IDS.menuItem,
      locationId: IDS.location,
    },
  })

  // Privzeta seja: manager lokacije (take_orders zadostuje za orders/checks/payments POST)
  authRef.current = { employeeId: IDS.employee, role: 'manager', locationId: IDS.location, permissions: ['take_orders'] }
})

afterAll(async () => {
  // Čiščenje po FK redu: Payment.check = Restrict → payments PRVI, potem order
  // (Check kaskada iz Ordera; OrderItem/OrderItemModifier kaskadirajo; stock ledger najprej)
  await db.stockTransaction.deleteMany({ where: { inventoryItemId: IDS.inventory } }).catch(() => {})
  // Payment delete po idempotencyKey (vsi ključi v tem fajlu so run-unikatni)
  await db.payment.deleteMany({ where: { idempotencyKey: { startsWith: `${RUN_ID}-pay` } } }).catch(() => {})
  await db.order.deleteMany({ where: { idempotencyKey: { in: [IDEM_ORDER_A, IDEM_ORDER_B] } } }).catch(() => {})
  await db.inventoryItem.deleteMany({ where: { id: IDS.inventory } }).catch(() => {})
  await db.menuItemModifierGroup.deleteMany({ where: { menuItemId: IDS.menuItem } }).catch(() => {})
  await db.modifier.deleteMany({ where: { id: IDS.modifier } }).catch(() => {})
  await db.modifierGroup.deleteMany({ where: { id: IDS.modifierGroup } }).catch(() => {})
  await db.menuItem.deleteMany({ where: { id: IDS.menuItem } }).catch(() => {})
  await db.category.deleteMany({ where: { id: IDS.category } }).catch(() => {})
  await db.menu.deleteMany({ where: { id: IDS.menu } }).catch(() => {})
  await db.employee.deleteMany({ where: { id: IDS.employee } }).catch(() => {})
  await db.location.deleteMany({ where: { id: IDS.location } }).catch(() => {})
  await db.$disconnect().catch(() => {})
})

// ============================================
// (1) + (2) Naročili A in B + zgodovinski snapshot dokaz
// ============================================
describe('R151 integracija (1)+(2): strežniški total + zgodovinski snapshot', () => {
  it('(1) §4: POST /api/orders z vbrizganimi zneski → strežniški izračun iz DB cen (klient NI avtoritativni)', async () => {
    // Vbrizg: total/subtotal/tax na bodyju (zod strip) + price: 0.01 na artiklu
    // (shema sprejme opcijski price, a strežnik računa IZKLJUČNO iz DB MenuItem.price)
    const res = await ordersPost(post('/api/orders', {
      type: 'dine-in',
      orderItems: [{ menuItemId: IDS.menuItem, quantity: 2, price: 0.01, modifiersJson: JSON.stringify([{ name: 'R151 Veliki', price: 0.01 }]) }],
      total: 1.0,
      subtotal: 1.0,
      tax: 1.0,
      discount: 0,
      idempotencyKey: IDEM_ORDER_A,
    }))
    expect(res.status).toBe(201)

    const order = await db.order.findUnique({ where: { idempotencyKey: IDEM_ORDER_A }, include: { orderItems: true } })
    expect(order).not.toBeNull()
    expect(order!.orderItems).toHaveLength(1)
    const item = order!.orderItems[0]

    // Strežniški snapshot: cena iz DB (19.99 + 3.00 modifier DB cena) — NE 0.01
    expect(Number(item.price)).toBe(EXP_A.itemPrice)
    // DDV po postavki ROUND_HALF_UP: 45.98 × 22 % = 10.1156 → 10.12
    expect(Number(item.vatAmount)).toBe(EXP_A.vat)
    expect(Number(item.vatRate)).toBe(22)
    // Order totals iz P1-8 celovoda — NE vbrizgane 1.00 vrednosti
    expect(Number(order!.subtotal)).toBe(EXP_A.subtotal)
    expect(Number(order!.tax)).toBe(EXP_A.vat)
    expect(Number(order!.total)).toBe(EXP_A.total)
    expect(order!.paymentStatus).toBe('unpaid')
  })

  it('(2) §5 scenarij F: sprememba cen PO naročilu → zgodovinski snapshot stabilen, novo naročilo zaračuna nove cene', async () => {
    // Master data sprememba: menu cena 19.99 → 29.99, modifier 3.00 → 5.00
    await db.menuItem.update({ where: { id: IDS.menuItem }, data: { price: 29.99 } })
    await db.modifier.update({ where: { id: IDS.modifier }, data: { price: 5.0 } })

    // ZGODOVINSKO naročilo A: nespremenjeno (historical transaction values)
    const orderA = await db.order.findUnique({ where: { idempotencyKey: IDEM_ORDER_A }, include: { orderItems: true } })
    expect(orderA).not.toBeNull()
    expect(Number(orderA!.orderItems[0].price)).toBe(EXP_A.itemPrice)
    expect(Number(orderA!.orderItems[0].vatAmount)).toBe(EXP_A.vat)
    expect(Number(orderA!.subtotal)).toBe(EXP_A.subtotal)
    expect(Number(orderA!.total)).toBe(EXP_A.total)

    // NOVO naročilo B: nove cene (34.99 neto; DDV 7.70; total 42.69)
    const res = await ordersPost(post('/api/orders', {
      type: 'takeout',
      orderItems: [{ menuItemId: IDS.menuItem, quantity: 1, modifiersJson: JSON.stringify([{ name: 'R151 Veliki', price: 0.01 }]) }],
      idempotencyKey: IDEM_ORDER_B,
    }))
    expect(res.status).toBe(201)
    const orderB = await db.order.findUnique({ where: { idempotencyKey: IDEM_ORDER_B }, include: { orderItems: true } })
    expect(orderB).not.toBeNull()
    expect(Number(orderB!.orderItems[0].price)).toBe(EXP_B.itemPrice)
    expect(Number(orderB!.orderItems[0].vatAmount)).toBe(EXP_B.vat)
    expect(Number(orderB!.total)).toBe(EXP_B.total)

    // Prevračuna NISTAR (ni menu versioning modela — snapshot model): OrderItem A je
    // ostal na stari ceni kljub novi DB ceni — to JE deklarirana semantika (§5).
    expect(Number(orderA!.orderItems[0].price)).not.toBe(Number(orderB!.orderItems[0].price))
  })
})

// ============================================
// (3) + (4) Check → plačilna rekonciliacija + idempotencia
// ============================================
describe('R151 integracija (3)+(4): Σ(plačila) == ček == naročilo + duplicate protection', () => {
  let checkAId = ''
  let checkBId = ''
  let pay2Id = ''

  it('(3) §7: check iz OrderItemov (R181 kanon) — totals == order totals na cent', async () => {
    const orderA = await db.order.findUnique({ where: { idempotencyKey: IDEM_ORDER_A }, include: { orderItems: true } })
    const res = await checksPost(post('/api/checks', {
      orderId: orderA!.id,
      orderItemIds: orderA!.orderItems.map(i => i.id),
    }))
    expect(res.status).toBe(201)
    const check = await asJson(res) as Record<string, number | string>
    checkAId = String(check.id)

    // Check totals iz PRAVIH OrderItem snapshotov (R181 tx-fresh) == Order totals
    expect(Number(check.subtotal)).toBe(EXP_A.subtotal)
    expect(Number(check.tax)).toBe(EXP_A.vat)
    expect(Number(check.total)).toBe(EXP_A.total)
    expect(check.paymentStatus).toBe('unpaid')

    const orderAafter = await db.order.findUnique({ where: { idempotencyKey: IDEM_ORDER_A } })
    expect(Number(orderAafter!.total)).toBe(Number(check.total)) // §7 invariant na cent
  })

  it('(3a) §8 split: cash 10.00 → partial; card preostanek → paid + paidAt + paymentMethod derivacija', async () => {
    // Del 1: cash 10.00 (idempotenten ključ P1)
    const p1 = await paymentsPost(post('/api/payments', {
      checkId: checkAId,
      amount: 10.0,
      type: 'cash',
      idempotencyKey: `${RUN_ID}-pay-1`,
    }))
    expect(p1.status).toBe(201)

    let check = await db.check.findUnique({ where: { id: checkAId } })
    expect(check!.paymentStatus).toBe('partial')
    const orderA1 = await db.order.findUnique({ where: { idempotencyKey: IDEM_ORDER_A } })
    expect(orderA1!.paymentStatus).toBe('partial')

    // Del 2: kartica preostanek (56.10 − 10.00 = 46.10) — različen tip → 'split' na orderju
    const p2 = await paymentsPost(post('/api/payments', {
      checkId: checkAId,
      amount: 46.1,
      type: 'card',
      idempotencyKey: `${RUN_ID}-pay-2`,
    }))
    expect(p2.status).toBe(201)
    pay2Id = String((await asJson(p2) as Record<string, unknown>).id)

    check = await db.check.findUnique({ where: { id: checkAId } })
    expect(check!.paymentStatus).toBe('paid')

    const orderA2 = await db.order.findUnique({ where: { idempotencyKey: IDEM_ORDER_A } })
    expect(orderA2!.paymentStatus).toBe('paid')
    expect(orderA2!.paidAt).not.toBeNull()
    expect(orderA2!.paymentMethod).toBe('split') // cash + card → 'split' (kanon)
    expect(orderA2!.status).toBe('completed') // vsi čeki plačani → completed (kanon)

    // §7 invariant na PERSISTIRANEM stanju: Σ(completed payments) == check.total == order.total
    const paidSum = await db.payment.aggregate({
      where: { checkId: checkAId, status: 'completed' },
      _sum: { amount: true },
    })
    expect(Number(paidSum._sum.amount)).toBeCloseTo(EXP_A.total, 2)
    expect(Number(check!.total)).toBe(EXP_A.total)

    // §25: točno 2 plačila, statusi completed, tipi cash/card
    const payments = await db.payment.findMany({ where: { checkId: checkAId }, orderBy: { createdAt: 'asc' } })
    expect(payments).toHaveLength(2)
    expect(payments.map(p => p.status)).toEqual(['completed', 'completed'])
    expect(payments.map(p => p.type)).toEqual(['cash', 'card'])
  })

  it('(4a) §9B: ISTI idempotencyKey replay → ISTI payment (200), NOV finančni efekt NI nastal', async () => {
    const before = await db.payment.count({ where: { checkId: checkAId } })
    const replay = await paymentsPost(post('/api/payments', {
      checkId: checkAId,
      amount: 46.1,
      type: 'card',
      idempotencyKey: `${RUN_ID}-pay-2`, // ISTI ključ kot (3a) del 2
    }))
    expect(replay.status).toBe(200) // replay vrne obstoječe plačilo
    const body = await asJson(replay)
    expect(String(body.id)).toBe(pay2Id) // ISTI payment — en finančni efekt
    expect(await db.payment.count({ where: { checkId: checkAId } })).toBe(before) // 2 → 2
  })

  it('(4b) §7/§9C: OVERPAYMENT preko ε praga (0.01) → 400, brez finančnega efekta', async () => {
    // Check B: preostanek po 10.00 = 42.69 − 10.00 = 32.69; poskus 40.00 > 32.69 + 0.01
    const orderB = await db.order.findUnique({ where: { idempotencyKey: IDEM_ORDER_B }, include: { orderItems: true } })
    const resCheck = await checksPost(post('/api/checks', {
      orderId: orderB!.id,
      orderItemIds: orderB!.orderItems.map(i => i.id),
    }))
    expect(resCheck.status).toBe(201)
    checkBId = String((await asJson(resCheck) as Record<string, unknown>).id)

    const p1 = await paymentsPost(post('/api/payments', {
      checkId: checkBId,
      amount: 10.0,
      type: 'cash',
      idempotencyKey: `${RUN_ID}-pay-3`,
    }))
    expect(p1.status).toBe(201)
    expect((await db.check.findUnique({ where: { id: checkBId } }))!.paymentStatus).toBe('partial')

    const beforeCount = await db.payment.count({ where: { checkId: checkBId } })
    const over = await paymentsPost(post('/api/payments', {
      checkId: checkBId,
      amount: 40.0, // preostanek 32.69 → 40.00 > 32.69 + 0.01 ε
      type: 'card',
      idempotencyKey: `${RUN_ID}-pay-4`,
    }))
    expect(over.status).toBe(400)
    const overBody = await asJson(over) as Record<string, unknown>
    expect(String(overBody.error)).toContain('presega preostali znesek') // OVERPAYMENT kanon (400)
    expect(await db.payment.count({ where: { checkId: checkBId } })).toBe(beforeCount) // brez efekta

    // Pravi preostanek zaključi ček B → paid (42.69 = 10.00 + 32.69)
    const p2 = await paymentsPost(post('/api/payments', {
      checkId: checkBId,
      amount: 32.69,
      type: 'cash',
      idempotencyKey: `${RUN_ID}-pay-5`,
    }))
    expect(p2.status).toBe(201)
    const checkB = await db.check.findUnique({ where: { id: checkBId } })
    expect(checkB!.paymentStatus).toBe('paid')
    const paidSumB = await db.payment.aggregate({ where: { checkId: checkBId, status: 'completed' }, _sum: { amount: true } })
    expect(Number(paidSumB._sum.amount)).toBeCloseTo(EXP_B.total, 2)
  })

  it('(4c) §9A: plačan ček + novo plačilo → 409 ALREADY_PAID, brez finančnega efekta', async () => {
    const before = await db.payment.count({ where: { checkId: checkAId } })
    const res = await paymentsPost(post('/api/payments', {
      checkId: checkAId, // check A je plačan od (3a)
      amount: 5.0,
      type: 'cash',
      idempotencyKey: `${RUN_ID}-pay-6`,
    }))
    expect(res.status).toBe(409)
    const body = await asJson(res) as Record<string, unknown>
    expect(String(body.error)).toContain('že popolnoma plačan') // ALREADY_PAID kanon (409)
    expect(await db.payment.count({ where: { checkId: checkAId } })).toBe(before) // brez efekta
  })
})
