// ============================================
// R151 / ISSUE #151 korak 1 — DRIFT-GATE: FINANČNI KONTRAKTI (fs-pini)
// ============================================
// #151 "Financial Integrity & Reconciliation" — korak 1 pini kontrakte,
// na katerih počivajo dokazi iz tests/integration/r151-financial-chain-drill.test.ts:
//
//   §4  Klient NI avtoritativni vir finančnih zneskov:
//       - createOrderSchema NIMA total/subtotal/tax polj (zod strip);
//       - POST handler zneske RAČUNA (buildOrderItemsData + calculateOrderTotals)
//         in piše izračunane vrednosti — client price je opcijski in
//         NEKORISTEN (DB cena = edini vir, FIX BUG-13);
//       - createCheckSchema: "Zneski se izračunajo strežniško iz povezanih
//         OrderItem-ov" (doktrinarna vrstica).
//   §5  Snapshot semantika: OrderItem.price/vatRate/vatAmount so persistirani
//       ENKRAT ob kreaciji (order create data iz izračunanih vrednosti);
//       ni menu versioning modela (deklarirano v BUSINESS-CHAIN 'price').
//   §7  Check.total formula (R181 kanon): subtotal + tax + serviceCharge − discount;
//       plačilni ε prag 0.01 (overpayment guard + paid derivacija — ISTI prag
//       na obeh straneh = reconciliacijski kanon).
//   §9  Idempotency kontrakt: Payment.idempotencyKey @unique + replay = isti
//       payment (status 200), OVERPAYMENT 400, ALREADY_PAID 409.
//   §18 MIGRACIJA (korak 2 = R207): calculateCheckAmounts zdaj akumulira v
//       Prisma.Decimal (kanon P1-8: "vsa aritmetika gre skozi Prisma.Decimal").
//       Prejšnja kanon-divergenca (JS float +=) je odpravljena v izvoru;
//       pisalna meja ostane zaščitena z round2(...) v R181 recalc kanonu.
//       Parity dokaz (behavioral): float referenčna akumulacija (stari algoritem)
//       vs Decimal implementacija — obnašanje na pisalni meji nespremenjeno.
//
// Vsak pin je fail-closed: sprememba kontrakta brez posodobitve dokaza =
// rdeč test.
// ============================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const SRC = join(process.cwd(), 'src')
const DOCS = join(process.cwd(), 'docs')

function readSrc(rel: string): string {
  return readFileSync(join(SRC, rel), 'utf-8')
}

// ─── §4: Zod shema naročila brez finančnih zneskov ───

describe('R151 §4 — createOrderSchema: klient ne more določati finančnih zneskov', () => {
  it('shema NIMA total/subtotal/tax/paymentStatus polj (zod strip = vbrizg ignoriran)', async () => {
    const mod = await import('@/lib/validations/orders')
    const shape = mod.createOrderSchema.shape as unknown as Record<string, unknown>
    expect(Object.keys(shape)).not.toContain('total')
    expect(Object.keys(shape)).not.toContain('subtotal')
    expect(Object.keys(shape)).not.toContain('tax')
    expect(Object.keys(shape)).not.toContain('paymentStatus')
    // Poslovna vhoda (NE izračunane vrednosti) sta dovoljena:
    expect(shape.discount).toBeDefined()
    expect(shape.tip).toBeDefined()
  })

  it('OrderItem vhod: price je opcijski in se NIKOLI ne uporabi za račun (DB-cene kanon)', async () => {
    const mod = await import('@/lib/validations/orders')
    const root = mod.createOrderSchema.shape as unknown as Record<string, unknown>
    const itemShape = (root.orderItems as unknown as { element: { shape: Record<string, unknown> } }).element.shape
    expect(itemShape.price).toBeDefined() // obstaja (wire kompatibilnost) ...
    // ... ampak buildOrderItemsData cene bere IZKLJUČNO iz vatMap (DB MenuItem.price
    // + DB modifier cene) — negativni pin: client price se ne pojavlja v računu.
    const src = readSrc(join('app/api/orders/_helpers/order-items.ts'))
    expect(src).toContain('const dbPrice = dbModifierPrices?.get(mod.name.toLowerCase())')
    expect(src).toContain('const basePrice = toNum(mi.price as Parameters<typeof toNum>[0])')
    // negativni pin: ni poti, kjer bi item.price (input) zašel v ceno
    expect(src).not.toMatch(/price:\s*[^,\n]*input/i)
  })

  it('POST handler zneske RAČUNA strežniško (P1-8 celovod) in piše izračunane vrednosti', () => {
    const src = readSrc(join('app/api/orders/_helpers/post-handler.ts'))
    // kanonska izračunana vrstica (edini vir totals)
    expect(src).toContain('buildOrderItemsData(data.orderItems, vatMap, data.discount || 0)')
    expect(src).toContain('calculateOrderTotals(orderItemsData, subtotal)')
    // Order create piše izračunane vrednosti (subtotal/tax/discount/total iz P1-8)
    expect(src).toMatch(/subtotal,\s*\n\s*tax:\s*totalTax/)
    expect(src).toMatch(/discount:\s*totalDiscountAmount/)
  })

  it('§4 doktrina checks: "Zneski se izračunajo strežniško iz povezanih OrderItem-ov"', () => {
    const src = readSrc(join('lib/validations/orders.ts'))
    expect(src).toContain('Zneski se izračunajo strežniško iz povezanih OrderItem-ov')
  })
})

// ─── §5: Snapshot semantika ───

describe('R151 §5 — zgodovinski snapshot: persistiran ENKRAT ob kreaciji', () => {
  it('OrderItem create v post-handlerju nosi izračunane snapshot polja (price/vatRate/vatAmount)', () => {
    const src = readSrc(join('app/api/orders/_helpers/post-handler.ts'))
    // orderItemsData (izračun) je vir create-many vrstic — ne master data re-read
    expect(src).toContain('orderItemsData')
    // snapshot polja obstajajo na modelu (schema) — derivacija ob kreaciji
    const schema = readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf-8')
    const orderItemModel = schema.slice(schema.indexOf('model OrderItem '), schema.indexOf('model OrderItemModifier '))
    expect(orderItemModel).toContain('vatRate')
    expect(orderItemModel).toContain('vatAmount')
    expect(orderItemModel).toContain('menuItemName') // snapshot imena (BUG-13 družina)
  })

  it('§5 doktrina BUSINESS-CHAIN: "ni menu versioning modela" (snapshot model deklariran)', () => {
    const doc = readFileSync(join(DOCS, 'BUSINESS-CHAIN.md'), 'utf-8')
    expect(doc).toContain('ni menu versioning modela')
    expect(doc).toContain('client cene NIKOLI zaupane')
  })
})

// ─── §7/§9: Plačilna rekonciliacija + ε prag + idempotencia ───

describe('R151 §7/§9 — plačilni kanon: ε prag 0.01, replay, OVERPAYMENT, ALREADY_PAID', () => {
  it('create-payment: overpayment guard s pragom 0.01 + status completed + idempotency fast-path', () => {
    const src = readSrc(join('app/api/payments/_helpers/create-payment.ts'))
    expect(src).toContain('greaterThan(data.amount, add(remainingAmount, 0.01))')
    expect(src).toContain("throw new Error(`OVERPAYMENT:")
    expect(src).toContain("throw new Error(`ALREADY_PAID:")
    expect(src).toContain("status: 'completed'")
    expect(src).toContain('findExistingPaymentByIdempotencyKey(idempotencyKey, locationId)')
  })

  it('check-status: ISTI ε prag na paid derivaciji (Σ >= total − 0.01) + split/single paymentMethod', () => {
    const src = readSrc(join('app/api/payments/_helpers/check-status.ts'))
    expect(src).toContain('greaterThanOrEqual(totalPaid, subtract(checkTotal, 0.01))')
    expect(src).toContain("paymentStatus: 'paid'")
    expect(src).toContain("paymentStatus: 'partial'")
    expect(src).toContain("orderUpdateData.paymentMethod = 'split'")
    // order → completed ob vseh čekih plačanih
    expect(src).toContain("data: { status: 'completed' }")
  })

  it('Payment shema: idempotencyKey @unique (duplicate protection na DB nivoju) + Restrict FK (revizijska sled)', () => {
    const schema = readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf-8')
    const paymentModel = schema.slice(schema.indexOf('model Payment '), schema.indexOf('model Discount '))
    expect(paymentModel).toMatch(/idempotencyKey\s+String\?\s+@unique/)
    expect(paymentModel).toContain('onDelete: Restrict') // Check → Payment: ohrani sled
    expect(paymentModel).toContain('refundAmount')
  })

  it('Check.total formula (R181 recalc kanon): subtotal + tax + serviceCharge − discount', () => {
    const src = readSrc(join('app/api/checks/_helpers/transaction.ts'))
    expect(src).toContain('round2(newSubtotal + newTax + toNum(affectedCheck.serviceCharge) - newDiscount)')
  })
})

// ─── §18: Decimal migracija (R207, korak 2) + float↔Decimal parity dokaz ───

describe('R151 §18 — Decimal migracija calculateCheckAmounts (R207: vrzel zaprta v izvoru)', () => {
  it('fs-pin: akumulacija teče skozi Prisma.Decimal (subtotal = subtotal.plus(...))', () => {
    const src = readSrc(join('app/api/checks/_helpers/calculate.ts'))
    expect(src).toContain('new Prisma.Decimal(0)')
    expect(src).toContain('subtotal = subtotal.plus(itemBase)')
    expect(src).toContain('tax = tax.plus(itemVat)')
    // pretvorba v number izključno na API meji
    expect(src).toContain('subtotal.toNumber()')
    expect(src).toContain('tax.toNumber()')
  })

  it('NEGATIVEN pin: JS float += akumulacija je odstranjena (prejšnje stanje vrzeli)', () => {
    const src = readSrc(join('app/api/checks/_helpers/calculate.ts'))
    // vrstično-pripet regex (koda, ne komentar — R204 lekcija): accumulate
    // statements morajo biti odstranjeni iz zanke
    expect(src).not.toMatch(/^\s+subtotal \+= /m)
    expect(src).not.toMatch(/^\s+tax \+= /m)
    expect(src).not.toMatch(/^\s+let subtotal = 0/m)
    expect(src).not.toMatch(/^\s+let tax = 0/m)
  })

  it('pisalna meja ostane zaščitena z round2 (R181 recalc kanon nespremenjen)', () => {
    const recalc = readSrc(join('app/api/checks/_helpers/transaction.ts'))
    expect(recalc).toContain('subtotal: round2(newSubtotal)')
  })

  it('§18 doktrina P1-8: "vsa aritmetika gre skozi Prisma.Decimal" (order celovod kanon)', () => {
    const src = readSrc(join('app/api/orders/_helpers/order-items.ts'))
    expect(src).toContain('vsa aritmetika gre skozi Prisma.Decimal')
  })
})

describe('R151 §18 — FLOAT↔DECIMAL PARITY DOKAZ (behavioral, korak 2)', () => {
  // Referenčna implementacija PRED migracijo (stari algoritem — float akumulacija).
  // Namen: dokazati, da migracija na Decimal NI spremenila obnašanja na pisalni
  // meji (parity pri realističnih velikostih) IN da je Decimal točen tam, kjer
  // float odmika (akumulacijska točnost).
  function legacyFloatCheckAmounts(items: Array<{ price: number; quantity: number; vatAmount: number; vatRate: number }>): { subtotal: number; tax: number } {
    let subtotal = 0
    let tax = 0
    for (const oi of items) {
      const itemBase = oi.price * oi.quantity
      const itemVat = oi.vatAmount > 0 ? oi.vatAmount : (oi.price * oi.quantity * oi.vatRate / 100)
      subtotal += itemBase
      tax += itemVat
    }
    return { subtotal, tax }
  }

  function makeItems(n: number, price: number, quantity = 1, vatAmount = 0, vatRate = 22) {
    return Array.from({ length: n }, (_, i) => ({
      id: `oi-${i}`, checkId: null, check: null, voided: false,
      price, quantity, vatAmount, vatRate,
    }))
  }

  it('PARITETA na pisalni meji: round2(legacy float) == round2(Decimal) pri realističnih velikostih (2dp vhodi)', async () => {
    const { calculateCheckAmounts } = await import('@/app/api/checks/_helpers/calculate')
    const { round2 } = await import('@/lib/decimal')

    // Realistični scenariji: majhne/velike cene, veliko postavk, DDV snapshot
    const scenarios: Array<{ n: number; price: number; qty: number; vat: number }> = [
      { n: 3, price: 19.99, qty: 2, vat: 10.12 },   // r151 Order A vzorec
      { n: 1, price: 34.99, qty: 1, vat: 7.7 },     // r151 Order B vzorec
      { n: 47, price: 8.5, qty: 3, vat: 0 },        // DDV iz rate (fallback veja)
      { n: 150, price: 129.99, qty: 1, vat: 0 },
      { n: 1000, price: 0.01, qty: 1, vat: 0 },     // sub-cent akumulacija
      { n: 2500, price: 24.9, qty: 4, vat: 0 },     // velik kos
    ]
    for (const s of scenarios) {
      const items = makeItems(s.n, s.price, s.qty, s.vat)
      const legacy = legacyFloatCheckAmounts(items)
      const decimal = calculateCheckAmounts(items)
      // PARITETA na pisalni meji (round2) — pisani zneski so nespremenjeni
      expect(round2(decimal.subtotal)).toBe(round2(legacy.subtotal))
      expect(round2(decimal.tax)).toBe(round2(legacy.tax))
    }
  })

  it('TOČNOST: Decimal vsota 10 000 × 0.01 je točno 100.00 — float referenca odmika (razlog za migracijo)', async () => {
    const { calculateCheckAmounts } = await import('@/app/api/checks/_helpers/calculate')
    const items = makeItems(10_000, 0.01)
    const decimal = calculateCheckAmounts(items)
    const legacy = legacyFloatCheckAmounts(items)

    // Decimal: točno (vsota 2dp vrednosti je 2dp vrednost)
    expect(decimal.subtotal).toBe(100)
    // Float referenca: DOKUMENTIRAN odmik (akumulacija 10k × 0.01 v IEEE-754)
    // — to je bila kanon-divergenca (maskirana z round2 na pisalni meji)
    expect(legacy.subtotal).not.toBe(100) // drift je realen
    expect(Math.abs(legacy.subtotal - 100)).toBeLessThan(0.01) // …a sub-cent (maskiran)
  })

  it('DDV fallback veja (vatAmount=0 → iz vatRate) je parity in točna', async () => {
    const { calculateCheckAmounts } = await import('@/app/api/checks/_helpers/calculate')
    const { round2 } = await import('@/lib/decimal')

    // 100 × 45.98 @ 22 % = 1011.56 — Decimal točno
    const items = makeItems(100, 45.98, 1, 0, 22)
    const decimal = calculateCheckAmounts(items)
    const legacy = legacyFloatCheckAmounts(items)
    expect(round2(decimal.tax)).toBe(1011.56)
    expect(round2(decimal.tax)).toBe(round2(legacy.tax))

    // DDV snapshot veja (vatAmount > 0) — 1:1 (brez pretvorbe)
    const snap = makeItems(3, 19.99, 2, 10.12)
    const d2 = calculateCheckAmounts(snap)
    expect(d2.tax).toBe(30.36) // 3 × 10.12 točno (float bi odmiknil na večjih vsotah)
  })

  it('prazna množica → 0/0 (kontrakt)', async () => {
    const { calculateCheckAmounts } = await import('@/app/api/checks/_helpers/calculate')
    expect(calculateCheckAmounts([])).toEqual({ subtotal: 0, tax: 0 })
  })
})

// ─── docs/FINANCIAL-CHAIN.md: matrica obstaja in sidra na realne kanone ───

describe('R151 — docs/FINANCIAL-CHAIN.md: matrica obstaja in sidra na realne kanone', () => {
  const doc = () => readFileSync(join(DOCS, 'FINANCIAL-CHAIN.md'), 'utf-8')

  it('16 finančnih dejstev iz #151 §3 je pokritih (zavihki matrice)', () => {
    const d = doc()
    for (const fact of [
      'Order subtotal', 'Order total', 'Modifier amount', 'Discount', 'Tax',
      'Payment amount', 'Payment method', 'Payment status', 'Receipt total',
      'Fiscal total', 'Shift sales', 'Cash sales', 'Card sales', 'Cash difference',
      'Z-report total', 'EOD revenue',
    ]) {
      expect(d).toContain(fact)
    }
  })

  it('sidra na realne kanonske datoteke (fail-closed referenci)', () => {
    const d = doc()
    expect(d).toContain('src/app/api/orders/_helpers/order-items.ts')
    expect(d).toContain('src/app/api/payments/_helpers/create-payment.ts')
    expect(d).toContain('src/app/api/payments/_helpers/check-status.ts')
    expect(d).toContain('src/lib/cash-shift/close-shift-canon.ts')
    expect(d).toContain('src/app/api/z-report/_helpers/upsert-z-report.ts')
  })

  it('anti-overclaim: simulacija ≠ produkcija (FURS) je izrecno deklarirana', () => {
    const d = doc()
    expect(d).toContain('SIMULIRANO')
    expect(d).toContain('NE produkcijska validacija')
  })
})

// ─── R207 (korak 2): §23 failure matrica + vrzeli register osvežen ───

describe('R207 — docs/FINANCIAL-CHAIN.md: §23 matrica izpolnjena, vrzeli register osvežen', () => {
  const doc = () => readFileSync(join(DOCS, 'FINANCIAL-CHAIN.md'), 'utf-8')

  it('§23 matrica obstaja in pokriva ključne failure vrstice iz implementacije', () => {
    const d = doc()
    expect(d).toContain('## 4. §23 Failure / Recovery matrica')
    for (const row of [
      'Payment 401', 'Payment 409 ALREADY_PAID', 'Payment 429',
      'Duplicate request (ISTI key)', 'Receipt failure / duplicate',
      'FURS temporary failure', 'FURS permanent failure', 'FURS duplicate submission',
      'Shift close retry', 'Z finalization retry', 'Browser refresh after settlement',
    ]) {
      expect(d).toContain(row)
    }
  })

  it('vrzeli register: §11/§13/§15/§16/§28 ZAPRTO R207, §18 MIGRIRANO, FURS ostaja SIMULIRANO', () => {
    const d = doc()
    expect(d).toContain('ZAPRTO R207')
    expect(d).toContain('MIGRIRANO R207')
    expect(d).toContain('IZPOLNJENA R207')
    // anti-overclaim ostaja: FURS produkcija NE validirana
    expect(d).toContain('produkcija NE validirana')
    // status glava kaže korak 2
    expect(d).toContain('Status dokazovanja (R207, korak 2)')
  })

  it('§23 matrica sidra na nove dokaze (R207 IT drill + §28 E2E spec)', () => {
    const d = doc()
    expect(d).toContain('r207-fiscal-chain-drill.test.ts')
    expect(d).toContain('r151-settlement-recovery.spec.ts')
  })
})
