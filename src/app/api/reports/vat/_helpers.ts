// Pomožne funkcije za DDV poročilo
// GET /api/reports/vat — pomožni modul za izračune DDV razčlenitve in časovne razdelitve

import { toNum, round2 } from '@/lib/decimal'

// ─── Tipi ───
export interface VatRateEntry {
  rate: number
  label: string
  code: string // FURS koda: S=standard, R=znižana, Z=oproščeno
  baseAmount: number
  vatAmount: number
  totalAmount: number
  itemCount: number
  orderCount: number
  items: Record<string, { name: string; category: string; quantity: number; base: number; vat: number }>
}

export interface TimeVatEntry {
  period: string
  base22: number
  vat22: number
  base95: number
  vat95: number
  base0: number
  vat0: number
  totalBase: number
  totalVat: number
}

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

// ─── Izračunaj časovno razdelitev po DDV stopnjah ───
export function computeTimeVatDistribution(
  orders: Array<{
    paidAt: Date | null
    createdAt: Date
    orderItems: Array<{
      voided: boolean
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      price: any
      quantity: number
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vatRate: any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vatAmount: any
    }>
  }>,
  period: string,
): TimeVatEntry[] {
  const timeVatDistribution: Record<string, TimeVatEntry> = {}

  for (const order of orders) {
    let periodKey: string
    // FIX MEDIUM: Uporabi paidAt (datum plačila) namesto createdAt za časovno razdelitev
    const d = new Date(order.paidAt || order.createdAt)

    if (period === 'daily') {
      periodKey = `${String(d.getHours()).padStart(2, '0')}:00`
    } else if (period === 'weekly') {
      const dayNames = ['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned']
      periodKey = dayNames[(d.getDay() + 6) % 7]
    } else if (period === 'monthly') {
      periodKey = String(d.getDate())
    } else {
      periodKey = d.toISOString().split('T')[0]
    }

    if (!timeVatDistribution[periodKey]) {
      timeVatDistribution[periodKey] = {
        period: periodKey,
        base22: 0, vat22: 0,
        base95: 0, vat95: 0,
        base0: 0, vat0: 0,
        totalBase: 0, totalVat: 0,
      }
    }

    for (const oi of order.orderItems) {
      if (oi.voided) continue
      const base = toNum(oi.price) * oi.quantity
      const vat = toNum(oi.vatAmount)
      const entry = timeVatDistribution[periodKey]

      if (toNum(oi.vatRate) >= 20) {
        entry.base22 += base
        entry.vat22 += vat
      } else if (toNum(oi.vatRate) > 0) {
        entry.base95 += base
        entry.vat95 += vat
      } else {
        entry.base0 += base
        entry.vat0 += vat
      }
      entry.totalBase += base
      entry.totalVat += vat
    }
  }

  // Zaokroži
  Object.values(timeVatDistribution).forEach(e => {
    e.base22 = round2(e.base22)
    e.vat22 = round2(e.vat22)
    e.base95 = round2(e.base95)
    e.vat95 = round2(e.vat95)
    e.base0 = round2(e.base0)
    e.vat0 = round2(e.vat0)
    e.totalBase = round2(e.totalBase)
    e.totalVat = round2(e.totalVat)
  })

  return Object.values(timeVatDistribution)
}
