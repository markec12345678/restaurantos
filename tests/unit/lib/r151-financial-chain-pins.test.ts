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
//   §18 ZNANA VRZEL (dokumentirana v docs/FINANCIAL-CHAIN.md, fix = #151 korak 2):
//       calculateCheckAmounts še akumulira v JS float (P1-8 kanon pravi
//       Prisma.Decimal); obrost zaščiten z round2 na pisalni meji. Ta pin
//       DOKUMENTIRA trenutno stanje — vsaka sprememba mora iti skozi
//       vzporedno posodobitev tega drift-gata (parity dokaz float↔Decimal).
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

// ─── §18: znana vrzel — float akumulacija v calculateCheckAmounts ───

describe('R151 §18 — dokumentirana vrzel: calculateCheckAmounts float akumulacija (fix = korak 2)', () => {
  it('trenutno stanje: JS float += v calculate.ts (pin trenutnega stanja — sprememba = parity dokaz obvezen)', () => {
    const src = readSrc(join('app/api/checks/_helpers/calculate.ts'))
    expect(src).toContain('let subtotal = 0')
    expect(src).toContain('subtotal += itemBase')
    // pisalna meja zaščitena z round2 (R181 recalc piše zaokroženo)
    const recalc = readSrc(join('app/api/checks/_helpers/transaction.ts'))
    expect(recalc).toContain('subtotal: round2(newSubtotal)')
  })

  it('§18 doktrina P1-8: "vsa aritmetika gre skozi Prisma.Decimal" (order celovod kanon)', () => {
    const src = readSrc(join('app/api/orders/_helpers/order-items.ts'))
    expect(src).toContain('vsa aritmetika gre skozi Prisma.Decimal')
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
