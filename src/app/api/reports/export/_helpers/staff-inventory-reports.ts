// CSV generiranje za zaposlene, izmene in zalogo

import { db } from '@/lib/db'
import { toNum } from '@/lib/decimal'
import { toCsvRow } from './csv-utils'

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
