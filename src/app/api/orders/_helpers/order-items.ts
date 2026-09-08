// Pomožne funkcije za izračun artiklov naročila, davkov in popustov
//
// P1-8 — KANONIČNI RAČUNSKI CELOVOD (edini vir resnice, enak v POS/API/QR/kiosku/mobilnem):
//
//   osnovna cena (NETO — brez DDV; MenuItem.price je po definiciji neto,
//   QR meni prikazuje € × (1 + DDV/100) "z DDV")
//   → modifikatorji (modifiersJson, cena v EUR)
//   → × količina
//   → popust na postavko (proporcionalna porazdelitev, ZADNJA postavka dobi ostanek)
//   → davčna osnova postavke
//   → DDV na postavko: ROUND_HALF_UP na 2 decimalni mesti (FURS: DDV se obračuna
//     po stavki računa, ne na skupni znesek)
//   → seštevek → subtotal / totalTax / totalDiscount / total
//   → napitnina (tip) se doda NAKONC (totalWithTip) in NI predmet DDV
//   → servisna naknada (Check.serviceCharge) je trenutno 0 (ni v toku izračuna)
//
// P1-8 FIX: vsa aritmetika gre skozi Prisma.Decimal (decimal.js) — prejšnja
// implementacija je uporabljala JS float (Math.round na 19.99×3 produktih je
// puščal artefakte 1e-12, ki so se kumulativno razlikovali od DB Decimal).

import { toNum } from '@/lib/decimal'
import { Prisma } from '@prisma/client'

const D = Prisma.Decimal

/** Zaokroži Decimal na 2 decimalni mesti — ROUND_HALF_UP (EUR standard). */
function dec2(val: Prisma.Decimal): Prisma.Decimal {
  return val.toDecimalPlaces(2, D.ROUND_HALF_UP)
}

// Tip za vhodne podatke artiklov naročila
export interface OrderItemInput {
  menuItemId: string
  quantity: number
  notes?: string
  modifiersJson?: unknown
}

// Tip za mapiranje artiklov iz baze
export interface MenuItemVatMap {
  id: string
  vatRate: { toNumber: () => number } | number
  price: { toNumber: () => number } | number
}

// Tip za izračunane podatke artikla naročila
export interface OrderItemData {
  menuItemId: string
  quantity: number
  price: number
  vatRate: number
  vatAmount: number
  discountAmount: number
  notes?: string
  modifiersJson?: unknown
  status: 'pending'
}

// Izračunaj podatke artiklov naročila z multi-DDV in porazdelitvijo popusta
export function buildOrderItemsData(
  orderItems: OrderItemInput[],
  vatMap: Map<string, MenuItemVatMap>,
  discount: number,
): { orderItemsData: OrderItemData[]; subtotal: number } {
  const rawItemsData = orderItems.map(item => {
    const mi = vatMap.get(item.menuItemId)!
    const vatRate = toNum(mi.vatRate as Parameters<typeof toNum>[0])
    const price = toNum(mi.price as Parameters<typeof toNum>[0])
    const itemBase = dec2(new D(price).times(item.quantity)) // cena × količina (neto)
    return { menuItemId: item.menuItemId, quantity: item.quantity, price, vatRate, itemBase }
  })
  const subtotal = dec2(
    rawItemsData.reduce((acc, item) => acc.plus(item.itemBase), new D(0))
  )

  const cappedDiscount = D.min(new D(discount || 0), subtotal) // popust nikoli > osnova
  const discountDec = new D(cappedDiscount)
  let discountDistributed = new D(0)
  const orderItemsData: OrderItemData[] = rawItemsData.map((item, idx) => {
    let itemDiscount = new D(0)
    if (discountDec.gt(0) && subtotal.gt(0)) {
      const remainingDiscount = discountDec.minus(discountDistributed)
      if (idx === rawItemsData.length - 1) {
        // Zadnja postavka prevzame ostanek — vsota popustov po postavkah = točno popust
        itemDiscount = D.max(new D(0), remainingDiscount)
      } else {
        // Proporcionalna porazdelitev, zaokrožena na cent
        itemDiscount = dec2(item.itemBase.times(discountDec).div(subtotal))
      }
      discountDistributed = discountDistributed.plus(itemDiscount)
    }

    const adjustedBase = item.itemBase.minus(itemDiscount) // davčna osnova postavke
    // DDV po postavki: ROUND_HALF_UP na 2 decimalni mesti (FURS ZDDV-1 način)
    const adjustedVat = dec2(adjustedBase.times(item.vatRate).div(100))

    return {
      menuItemId: item.menuItemId, quantity: item.quantity, price: item.price, vatRate: item.vatRate,
      vatAmount: adjustedVat.toNumber(), discountAmount: itemDiscount.toNumber(),
      notes: orderItems[idx].notes, modifiersJson: orderItems[idx].modifiersJson,
      status: 'pending' as const,
    }
  })

  return { orderItemsData, subtotal: subtotal.toNumber() }
}

// Izračunaj skupne zneske naročila
export function calculateOrderTotals(orderItemsData: OrderItemData[], _subtotal: number) {
  const recalculatedSubtotal = dec2(
    orderItemsData.reduce(
      (sum, item) => sum.plus(new D(item.price).times(item.quantity)),
      new D(0)
    )
  )
  const totalTax = dec2(
    orderItemsData.reduce((sum, item) => sum.plus(new D(item.vatAmount)), new D(0))
  )
  const totalDiscountAmount = dec2(
    orderItemsData.reduce((sum, item) => sum.plus(new D(item.discountAmount)), new D(0))
  )
  // total = neto osnova + DDV − popust (napitnina NI vključena — doda se v totalWithTip)
  const total = dec2(recalculatedSubtotal.plus(totalTax).minus(totalDiscountAmount))
  return {
    subtotal: recalculatedSubtotal.toNumber(),
    totalTax: totalTax.toNumber(),
    totalDiscountAmount: totalDiscountAmount.toNumber(),
    total: total.toNumber(),
  }
}

// Preveri, da vsi artikli obstajajo v vatMap
export function validateMenuItems(
  orderItems: OrderItemInput[],
  vatMap: Map<string, MenuItemVatMap>,
): string | null {
  for (const item of orderItems) {
    if (!vatMap.has(item.menuItemId)) {
      return item.menuItemId
    }
  }
  return null
}
