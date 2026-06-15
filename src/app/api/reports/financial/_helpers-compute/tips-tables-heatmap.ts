// Pomožne funkcije za finančno poročanje — Napitnine, mize, toplotna karta, DDV

import { db } from '@/lib/db'
import { toNum, round2, abs, type DecimalLike } from '@/lib/decimal'
import type { PaidOrder, StockCostGroup, OrderItemRow } from './types'

export async function computeTips(
  currentPaidOrders: PaidOrder[],
  totalRevenue: number,
): Promise<{
  totalTips: number
  avgTipPerOrder: number
  tipPercentage: number
  tipsByEmployee: Array<{ employeeId: string; employeeName: string; tips: number; orderCount: number; avgTip: number }>
}> {
  const allPayments = currentPaidOrders.flatMap(o => o.checks?.flatMap(c => c.payments || []) || [])
  const totalTips = allPayments.reduce((sum, p) => sum + toNum(p.tipAmount), 0)
  const avgTipPerOrder = currentPaidOrders.length > 0 ? totalTips / currentPaidOrders.length : 0
  const tipPercentage = totalRevenue > 0 ? (totalTips / totalRevenue) * 100 : 0

  const tipsByEmployeeMap: Record<string, { employeeId: string; employeeName: string; tips: number; orderCount: number; avgTip: number }> = {}
  for (const order of currentPaidOrders) {
    const empId = order.employeeId || 'unknown'
    if (!tipsByEmployeeMap[empId]) tipsByEmployeeMap[empId] = { employeeId: empId, employeeName: '', tips: 0, orderCount: 0, avgTip: 0 }
    const orderTips = (order.checks || []).flatMap(c => c.payments || []).reduce((sum, p) => sum + toNum(p.tipAmount), 0)
    tipsByEmployeeMap[empId].tips += orderTips
    tipsByEmployeeMap[empId].orderCount += 1
  }
  const empIds = Object.keys(tipsByEmployeeMap).filter(id => id !== 'unknown')
  if (empIds.length > 0) {
    const employees = await db.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, name: true } })
    for (const emp of employees) { if (tipsByEmployeeMap[emp.id]) tipsByEmployeeMap[emp.id].employeeName = emp.name }
  }
  if (tipsByEmployeeMap['unknown']) tipsByEmployeeMap['unknown'].employeeName = 'Nedoločen'
  for (const t of Object.values(tipsByEmployeeMap)) { t.avgTip = t.orderCount > 0 ? round2(t.tips / t.orderCount) : 0; t.tips = round2(t.tips) }

  return {
    totalTips: round2(totalTips),
    avgTipPerOrder: round2(avgTipPerOrder),
    tipPercentage: round2(tipPercentage),
    tipsByEmployee: Object.values(tipsByEmployeeMap).sort((a, b) => b.tips - a.tips),
  }
}

export function computeTableRevenue(
  currentPaidOrders: PaidOrder[],
): Array<{ tableNumber: number; area: string; revenue: number; orderCount: number; avgOrder: number; tips: number; guests: number }> {
  const tableRevenue: Record<string, { tableNumber: number; area: string; revenue: number; orderCount: number; avgOrder: number; tips: number; guests: number }> = {}
  for (const order of currentPaidOrders) {
    if (order.type === 'dine-in' && order.tableId) {
      if (!tableRevenue[order.tableId]) {
        tableRevenue[order.tableId] = { tableNumber: order.table?.number || 0, area: order.table?.area || 'main', revenue: 0, orderCount: 0, avgOrder: 0, tips: 0, guests: 0 }
      }
      tableRevenue[order.tableId].revenue += toNum(order.total)
      tableRevenue[order.tableId].orderCount += 1
      tableRevenue[order.tableId].tips += toNum(order.tip)
    }
  }
  for (const t of Object.values(tableRevenue)) { t.avgOrder = t.orderCount > 0 ? round2(t.revenue / t.orderCount) : 0; t.revenue = round2(t.revenue); t.tips = round2(t.tips) }
  return Object.values(tableRevenue).sort((a, b) => b.revenue - a.revenue)
}

export function computeHourlyHeatmap(
  completedOrdersLight: Array<{ paidAt: Date | null; createdAt: Date; total: DecimalLike }>,
): Array<{ hour: number; label: string; revenue: number; orders: number; intensity: number }> {
  const hourlyHeatmap: Array<{ hour: number; label: string; revenue: number; orders: number; intensity: number }> = []
  let maxHourlyRevenue = 0
  const hourlyBuckets: Record<number, { revenue: number; orders: number }> = {}
  for (let h = 0; h < 24; h++) { hourlyBuckets[h] = { revenue: 0, orders: 0 } }
  for (const order of completedOrdersLight) {
    const hour = new Date(order.paidAt || order.createdAt).getHours()
    hourlyBuckets[hour].revenue += toNum(order.total)
    hourlyBuckets[hour].orders += 1
    if (hourlyBuckets[hour].revenue > maxHourlyRevenue) maxHourlyRevenue = hourlyBuckets[hour].revenue
  }
  for (let h = 0; h < 24; h++) {
    const label = h < 6 ? 'Noč' : h < 10 ? 'Jutro' : h < 14 ? 'Kosilo' : h < 17 ? 'Popoldne' : h < 21 ? 'Večerja' : 'Po večerji'
    hourlyHeatmap.push({ hour: h, label, revenue: round2(hourlyBuckets[h].revenue), orders: hourlyBuckets[h].orders, intensity: maxHourlyRevenue > 0 ? Math.round((hourlyBuckets[h].revenue / maxHourlyRevenue) * 100) : 0 })
  }
  return hourlyHeatmap
}

export function computeVatBreakdown(
  orderItems: OrderItemRow[],
): Array<{ rate: number; label: string; code: string; baseAmount: number; vatAmount: number; totalAmount: number }> {
  const vatBreakdown: Record<string, { rate: number; label: string; code: string; baseAmount: number; vatAmount: number; totalAmount: number }> = {}
  for (const oi of orderItems) {
    const rateKey = String(oi.vatRate)
    if (!vatBreakdown[rateKey]) {
      vatBreakdown[rateKey] = {
        rate: toNum(oi.vatRate),
        label: toNum(oi.vatRate) >= 20 ? 'DDV 22% (Standardna)' : toNum(oi.vatRate) > 0 ? 'DDV 9.5% (Znižana)' : 'DDV 0% (Oproščeno)',
        code: toNum(oi.vatRate) >= 20 ? 'S' : toNum(oi.vatRate) > 0 ? 'R' : 'Z',
        baseAmount: 0, vatAmount: 0, totalAmount: 0,
      }
    }
    const base = toNum(oi.price) * oi.quantity; const vat = toNum(oi.vatAmount)
    vatBreakdown[rateKey].baseAmount += base; vatBreakdown[rateKey].vatAmount += vat; vatBreakdown[rateKey].totalAmount += base + vat
  }
  for (const vr of Object.values(vatBreakdown)) { vr.baseAmount = round2(vr.baseAmount); vr.vatAmount = round2(vr.vatAmount); vr.totalAmount = round2(vr.totalAmount) }
  return Object.values(vatBreakdown).sort((a, b) => b.rate - a.rate)
}

export function computeStockCosts(
  stockCostGroups: StockCostGroup[],
  totalRevenue: number,
): { procurementCost: number; writeOffCost: number; cogs: number; grossProfit: number; grossMargin: number } {
  const stockCostByType = new Map(stockCostGroups.map(g => [g.type, g._sum.totalCost as DecimalLike | null]))
  const procurementCost = toNum(stockCostByType.get('procurement') ?? 0)
  const writeOffCost = toNum(abs(stockCostByType.get('write-off') ?? 0)) + toNum(abs(stockCostByType.get('return') ?? 0))
  const cogs = toNum(abs(stockCostByType.get('sale') ?? 0))
  const grossProfit = totalRevenue - cogs
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
  return { procurementCost, writeOffCost, cogs, grossProfit, grossMargin }
}
