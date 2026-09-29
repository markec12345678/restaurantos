// Časovna razdelitev po DDV stopnjah

import { toNum, round2 } from '@/lib/decimal'
import { ljubljanaDateTimeParts } from '@/lib/timezone-sl'
import type { TimeVatEntry } from './types'

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

    // R160 (P3-1): vedra po LJ stenskem času (prej getHours/getDay/getDate
    // po strežniškem TZ — plačilo ob LJ 00:30 je padlo v '22:00'/'Ned'/
    // fantovski '30'/'31' ključ prejšnjega meseca). Yearly (:41) je ŽE LJ.
    const lj = ljubljanaDateTimeParts(d.toISOString())
    if (period === 'daily') {
      periodKey = `${lj.time.slice(0, 2)}:00`
    } else if (period === 'weekly') {
      const dayNames = ['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned']
      // ponedeljkov indeks iz LJ YMD (getUTCDay na YMD polnoč — R159-b vzorec)
      const dow = new Date(`${lj.date}T00:00:00Z`).getUTCDay()
      periodKey = dayNames[(dow + 6) % 7]
    } else if (period === 'monthly') {
      periodKey = String(Number(lj.date.slice(8, 10)))
    } else {
      // R158-4 (R159-b): periodKey (letno) po LJ poslovnemu dnevu (prej UTC)
      periodKey = ljubljanaDateTimeParts(d.toISOString()).date
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
