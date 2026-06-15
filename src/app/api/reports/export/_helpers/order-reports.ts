// CSV generiranje za naročila, artikle in DDV poročila

import { db } from '@/lib/db'
import { toNum, multiply } from '@/lib/decimal'
import { toCsvRow } from './csv-utils'

export async function generateOrdersCsv(dateFilter: Record<string, Date>): Promise<{ csv: string; filename: string }> {
  const orders = await db.order.findMany({
    where: {
      paymentStatus: 'paid',
      ...(Object.keys(dateFilter).length > 0 ? { paidAt: dateFilter } : {}),
    },
    include: {
      table: true,
      orderItems: { include: { menuItem: true } },
    },
    orderBy: { paidAt: 'desc' },
  })

  let csv = toCsvRow(['Št. naročila', 'Datum', 'Tip', 'Miza', 'Stranka', 'Status', 'Plačilo', 'Metoda', 'Vmesna vsota', 'DDV', 'Popust', 'Skupaj', 'Napitnina', 'Skupaj z napitnino', 'Artikli'])
  csv += '\n'

  for (const o of orders) {
    const items = o.orderItems.map(oi => `${oi.quantity}x ${oi.menuItem?.name || '?'}`).join(', ')
    csv += toCsvRow([
      o.orderNumber,
      new Date(o.createdAt).toLocaleString('sl-SI'),
      o.type,
      o.table?.number || '',
      o.customerName || '',
      o.status,
      o.paymentStatus,
      o.paymentMethod,
      toNum(o.subtotal).toFixed(2),
      toNum(o.tax).toFixed(2),
      toNum(o.discount).toFixed(2),
      toNum(o.total).toFixed(2),
      toNum(o.tip).toFixed(2),
      toNum(o.totalWithTip).toFixed(2),
      items,
    ])
    csv += '\n'
  }

  return { csv, filename: '' } // filename set by caller with dates
}

export async function generateItemsCsv(dateFilter: Record<string, Date>): Promise<{ csv: string; filename: string }> {
  const orders = await db.order.findMany({
    where: {
      paymentStatus: 'paid',
      ...(Object.keys(dateFilter).length > 0 ? { paidAt: dateFilter } : {}),
    },
    include: {
      orderItems: { include: { menuItem: { include: { category: { include: { menu: true } } } } } },
    },
  })

  const itemMap: Record<string, { name: string; category: string; menu: string; vatRate: number; quantity: number; revenue: number; vat: number }> = {}
  for (const o of orders) {
    for (const oi of o.orderItems) {
      if (oi.voided) continue
      const key = oi.menuItemId
      if (!itemMap[key]) {
        itemMap[key] = {
          name: oi.menuItem?.name || 'Neznan',
          category: oi.menuItem?.category?.name || 'Ostalo',
          menu: oi.menuItem?.category?.menu?.name || '',
          // FIX TYPE: oi.menuItem.category.menu.name je na voljo ker je vključen v query
          vatRate: toNum(oi.vatRate),
          quantity: 0,
          revenue: 0,
          vat: 0,
        }
      }
      itemMap[key].quantity += oi.quantity
      itemMap[key].revenue += toNum(multiply(oi.price, oi.quantity))
      itemMap[key].vat += toNum(oi.vatAmount)
    }
  }

  let csv = toCsvRow(['Artikel', 'Kategorija', 'Meni', 'DDV stopnja', 'Količina', 'Prihodek (brez DDV)', 'DDV', 'Skupaj'])
  csv += '\n'

  for (const item of Object.values(itemMap).sort((a, b) => b.revenue - a.revenue)) {
    csv += toCsvRow([
      item.name,
      item.category,
      item.menu,
      `${item.vatRate}%`,
      item.quantity,
      item.revenue.toFixed(2),
      item.vat.toFixed(2),
      (item.revenue + item.vat).toFixed(2),
    ])
    csv += '\n'
  }

  return { csv, filename: '' }
}

export async function generateVatCsv(dateFilter: Record<string, Date>): Promise<{ csv: string; filename: string }> {
  const orders = await db.order.findMany({
    where: {
      paymentStatus: 'paid',
      ...(Object.keys(dateFilter).length > 0 ? { paidAt: dateFilter } : {}),
    },
    include: { orderItems: true },
  })

  const vatMap: Record<string, { rate: number; base: number; vat: number; total: number }> = {}
  for (const o of orders) {
    for (const oi of o.orderItems) {
      if (oi.voided) continue
      const key = String(oi.vatRate)
      if (!vatMap[key]) {
        vatMap[key] = { rate: toNum(oi.vatRate), base: 0, vat: 0, total: 0 }
      }
      vatMap[key].base += toNum(oi.price) * oi.quantity
      vatMap[key].vat += toNum(oi.vatAmount)
      vatMap[key].total += toNum(oi.price) * oi.quantity + toNum(oi.vatAmount)
    }
  }

  let csv = toCsvRow(['DDV stopnja', 'Osnova', 'DDV', 'Skupaj'])
  csv += '\n'

  for (const vr of Object.values(vatMap).sort((a, b) => b.rate - a.rate)) {
    csv += toCsvRow([
      `${vr.rate}%`,
      vr.base.toFixed(2),
      vr.vat.toFixed(2),
      vr.total.toFixed(2),
    ])
    csv += '\n'
  }

  return { csv, filename: '' }
}
