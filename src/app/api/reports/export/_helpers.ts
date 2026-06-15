// Pomožne funkcije za izvoz poročil v CSV
// GET /api/reports/export — pomožni modul za CSV generacijo

import { db } from '@/lib/db'
import { toNum, multiply } from '@/lib/decimal'

// ─── CSV pomožne funkcije ─────────────────────────────────────

export function escapeCsvField(field: unknown): string {
  let str = String(field ?? '')
  // FIX MEDIUM: CSV injection protection — prepreči formule v Excelu (=+@-)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes(';')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function toCsvRow(fields: unknown[]): string {
  return fields.map(escapeCsvField).join(';') // Slovenian Excel uses ;
}

// ─── Generiranje CSV po tipu poročila ─────────────────────────

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

export async function generateEmployeesCsv(dateFilter: Record<string, Date>): Promise<{ csv: string; filename: string }> {
  const orders = await db.order.findMany({
    where: {
      paymentStatus: 'paid',
      ...(Object.keys(dateFilter).length > 0 ? { paidAt: dateFilter } : {}),
    },
  })

  const employees = await db.employee.findMany()
  const empMap = new Map(employees.map(e => [e.id, e]))

  const stats: Record<string, { name: string; role: string; orders: number; revenue: number; tips: number }> = {}
  for (const o of orders) {
    const empId = o.employeeId || 'unknown'
    const emp = empMap.get(empId)
    if (!stats[empId]) {
      stats[empId] = { name: emp?.name || 'Nedoločen', role: emp?.role || '', orders: 0, revenue: 0, tips: 0 }
    }
    stats[empId].orders += 1
    stats[empId].revenue += toNum(o.total)
    stats[empId].tips += toNum(o.tip)
  }

  let csv = toCsvRow(['Zaposleni', 'Vloga', 'Št. naročil', 'Prihodek', 'Napitnine'])
  csv += '\n'

  for (const s of Object.values(stats).sort((a, b) => b.revenue - a.revenue)) {
    csv += toCsvRow([
      s.name,
      s.role,
      s.orders,
      s.revenue.toFixed(2),
      s.tips.toFixed(2),
    ])
    csv += '\n'
  }

  return { csv, filename: '' }
}

export async function generateShiftsCsv(dateFilter: Record<string, Date>): Promise<{ csv: string; filename: string }> {
  const shifts = await db.cashRegisterShift.findMany({
    where: Object.keys(dateFilter).length > 0 ? { openedAt: dateFilter } : {},
    orderBy: { openedAt: 'desc' },
  })

  let csv = toCsvRow(['Zaposleni', 'Odprto', 'Zaprto', 'Začetna gotovina', 'Končna gotovina', 'Gotovina', 'Kartice', 'Mobilno', 'Skupaj', 'Napitnine', 'Popusti', 'Poničeno', 'Razlika'])
  csv += '\n'

  for (const s of shifts) {
    const expected = toNum(s.startingCash) + toNum(s.cashSales)
    csv += toCsvRow([
      s.employeeName,
      new Date(s.openedAt).toLocaleString('sl-SI'),
      s.closedAt ? new Date(s.closedAt).toLocaleString('sl-SI') : 'Odprto',
      toNum(s.startingCash).toFixed(2),
      toNum(s.closingCash).toFixed(2),
      toNum(s.cashSales).toFixed(2),
      toNum(s.cardSales).toFixed(2),
      toNum(s.mobileSales).toFixed(2),
      toNum(s.totalSales).toFixed(2),
      toNum(s.totalTips).toFixed(2),
      toNum(s.totalDiscounts).toFixed(2),
      toNum(s.totalVoided).toFixed(2),
      (toNum(s.closingCash) - expected).toFixed(2),
    ])
    csv += '\n'
  }

  return { csv, filename: '' }
}

export async function generateInventoryCsv(): Promise<{ csv: string; filename: string }> {
  const items = await db.inventoryItem.findMany({
    include: { menuItem: { select: { name: true } } },
    orderBy: { name: 'asc' },
  })

  let csv = toCsvRow(['Artikel', 'Enota', 'Količina', 'Min. količina', 'Cena/enoto', 'Servisov/enoto', 'Cena/servis', 'Dobavitelj', 'Kategorija', 'Povezani meni artikel'])
  csv += '\n'

  for (const item of items) {
    csv += toCsvRow([
      item.name,
      item.unit,
      item.quantity,
      item.minQuantity,
      toNum(item.costPerUnit).toFixed(2),
      item.servingsPerUnit,
      toNum(item.costPerServing).toFixed(2),
      item.supplier,
      item.category,
      item.menuItem?.name || '',
    ])
    csv += '\n'
  }

  return { csv, filename: '' }
}

// ─── Mapa tipov → generatorjev ────────────────────────────────

export type ReportType = 'orders' | 'items' | 'vat' | 'employees' | 'shifts' | 'inventory'

export const ALLOWED_TYPES: ReportType[] = ['orders', 'items', 'vat', 'employees', 'shifts', 'inventory']

export function getFilename(type: ReportType, startDate: string | null, endDate: string | null): string {
  switch (type) {
    case 'orders': return `narocila_${startDate || 'vse'}_${endDate || 'vse'}.csv`
    case 'items': return `artikli_${startDate || 'vse'}_${endDate || 'vse'}.csv`
    case 'vat': return `ddv_${startDate || 'vse'}_${endDate || 'vse'}.csv`
    case 'employees': return `zaposleni_${startDate || 'vse'}_${endDate || 'vse'}.csv`
    case 'shifts': return `izmene_${startDate || 'vse'}_${endDate || 'vse'}.csv`
    case 'inventory': return `zaloga_${new Date().toISOString().split('T')[0]}.csv`
  }
}
