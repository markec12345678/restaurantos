// DDV razčlenitev po stopnjah

import { toNum, round2 } from '@/lib/decimal'
import type { VatRateEntry } from './types'

// ─── Izračunaj DDV razčlenitev po stopnjah ───
export function computeVatBreakdown(
  orders: Array<{
    id: string
    orderItems: Array<{
      voided: boolean
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      price: any
      quantity: number
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vatRate: any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vatAmount: any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      discountAmount: any
      menuItemId: string
      menuItem: { name: string; // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vatRate: any; category: { name: string } | null } | null
    }>
  }>,
): Record<string, VatRateEntry> {
  const vatRates: Record<string, VatRateEntry> = {
    '22': { rate: 22, label: 'DDV 22% (Standardna)', code: 'S', baseAmount: 0, vatAmount: 0, totalAmount: 0, itemCount: 0, orderCount: 0, items: {} },
    '9.5': { rate: 9.5, label: 'DDV 9.5% (Znižana)', code: 'R', baseAmount: 0, vatAmount: 0, totalAmount: 0, itemCount: 0, orderCount: 0, items: {} },
    '0': { rate: 0, label: 'DDV 0% (Oproščeno)', code: 'Z', baseAmount: 0, vatAmount: 0, totalAmount: 0, itemCount: 0, orderCount: 0, items: {} },
  }

  const processedOrders = new Set<string>()

  for (const order of orders) {
    for (const oi of order.orderItems) {
      if (oi.voided) continue

      const rateKey = String(toNum(oi.vatRate))
      // FIX C-09: Osnova mora odšteti discount — FURS zahteva osnovo PO popustu
      const base = toNum(oi.price) * oi.quantity - toNum(oi.discountAmount || 0)
      const vat = toNum(oi.vatAmount)

      if (!vatRates[rateKey]) {
        vatRates[rateKey] = {
          rate: toNum(oi.vatRate),
          label: `DDV ${toNum(oi.vatRate)}%`,
          code: toNum(oi.vatRate) >= 20 ? 'S' : toNum(oi.vatRate) > 0 ? 'R' : 'Z',
          baseAmount: 0,
          vatAmount: 0,
          totalAmount: 0,
          itemCount: 0,
          orderCount: 0,
          items: {},
        }
      }

      const vr = vatRates[rateKey]
      vr.baseAmount += base
      vr.vatAmount += vat
      vr.totalAmount += base + vat
      vr.itemCount += oi.quantity

      if (!processedOrders.has(`${rateKey}-${order.id}`)) {
        vr.orderCount += 1
        processedOrders.add(`${rateKey}-${order.id}`)
      }

      // Podrobno po artiklih
      const itemKey = oi.menuItemId
      if (!vr.items[itemKey]) {
        vr.items[itemKey] = {
          name: oi.menuItem?.name || 'Neznan',
          category: oi.menuItem?.category?.name || 'Ostalo',
          quantity: 0,
          base: 0,
          vat: 0,
        }
      }
      vr.items[itemKey].quantity += oi.quantity
      vr.items[itemKey].base += base
      vr.items[itemKey].vat += vat
    }
  }

  // Zaokroži zneske
  Object.values(vatRates).forEach(vr => {
    vr.baseAmount = round2(vr.baseAmount)
    vr.vatAmount = round2(vr.vatAmount)
    vr.totalAmount = round2(vr.totalAmount)
    Object.values(vr.items).forEach(item => {
      item.base = round2(item.base)
      item.vat = round2(item.vat)
    })
  })

  return vatRates
}
