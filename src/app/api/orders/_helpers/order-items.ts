// Pomožne funkcije za izračun artiklov naročila, davkov in popustov

import { toNum, round2 } from '@/lib/decimal'

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
  let subtotal = 0
  const rawItemsData = orderItems.map(item => {
    const mi = vatMap.get(item.menuItemId)!
    const vatRate = toNum(mi.vatRate as Parameters<typeof toNum>[0])
    const price = toNum(mi.price as Parameters<typeof toNum>[0])
    const itemBase = price * item.quantity
    subtotal += itemBase
    return { menuItemId: item.menuItemId, quantity: item.quantity, price, vatRate, itemBase }
  })

  const cappedDiscount = Math.min(discount || 0, subtotal)
  let discountDistributed = 0
  const orderItemsData: OrderItemData[] = rawItemsData.map((item, idx) => {
    let itemDiscount = 0
    if (cappedDiscount > 0 && subtotal > 0) {
      const remainingDiscount = cappedDiscount - discountDistributed
      if (idx === rawItemsData.length - 1) {
        itemDiscount = Math.max(0, remainingDiscount)
      } else {
        itemDiscount = Math.round((item.itemBase / subtotal) * cappedDiscount * 100) / 100
      }
      discountDistributed += itemDiscount
    }

    const adjustedBase = item.itemBase - itemDiscount
    const adjustedVat = Math.round(adjustedBase * (item.vatRate / 100) * 100) / 100

    return {
      menuItemId: item.menuItemId, quantity: item.quantity, price: item.price, vatRate: item.vatRate,
      vatAmount: adjustedVat, discountAmount: itemDiscount,
      notes: orderItems[idx].notes, modifiersJson: orderItems[idx].modifiersJson,
      status: 'pending' as const,
    }
  })

  return { orderItemsData, subtotal }
}

// Izračunaj skupne zneske naročila
export function calculateOrderTotals(orderItemsData: OrderItemData[], _subtotal: number) {
  const recalculatedSubtotal = orderItemsData.reduce((sum, item) => sum + toNum(item.price) * item.quantity, 0)
  const totalTax = round2(orderItemsData.reduce((sum, item) => sum + toNum(item.vatAmount), 0))
  const totalDiscountAmount = round2(orderItemsData.reduce((sum, item) => sum + toNum(item.discountAmount), 0))
  const total = round2(recalculatedSubtotal + totalTax - totalDiscountAmount)
  return { subtotal: recalculatedSubtotal, totalTax, totalDiscountAmount, total }
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
