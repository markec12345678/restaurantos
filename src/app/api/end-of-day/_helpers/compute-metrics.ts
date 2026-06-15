// Pomožne funkcije za End-of-Day API — Izračunaj vse EOD metrike

import { toNum, sumBy, round2, subtract, multiply, type DecimalLike } from '@/lib/decimal'
import type { fetchEodData } from './fetch-eod'

// ─── Izračunaj vse EOD metrike ──────────────────────────────

export function computeEodMetrics(data: Awaited<ReturnType<typeof fetchEodData>>) {
  const { orders, periodPayments, fursStats, reservationStats, expenseEntries, existingEOD } = data

  // ── Naročila ──────────────────────────────────────────────
  // FIX HIGH: Uporabi paidAt + paymentStatus='paid' za finančna poročila, NE createdAt
  const completedOrders = orders
  const totalRevenue = toNum(sumBy(completedOrders, o => o.total))
  const totalOrders = orders.length
  const avgOrderValue = completedOrders.length > 0 ? round2(totalRevenue / completedOrders.length) : 0

  // ── Plačila po metodi ─────────────────────────────────────
  const paymentsByMethod: Record<string, { count: number; total: number; tips: number }> = {}
  for (const p of periodPayments) {
    const method = p.type || 'unknown'
    if (!paymentsByMethod[method]) paymentsByMethod[method] = { count: 0, total: 0, tips: 0 }
    paymentsByMethod[method].count++
    paymentsByMethod[method].total += toNum(p.amount)
    paymentsByMethod[method].tips += toNum(p.tipAmount)
  }

  const totalTips = toNum(sumBy(periodPayments, p => p.tipAmount))

  // ── DDV po stopnjah ───────────────────────────────────────
  const vatBreakdown: Record<string, { base: number; vat: number }> = {}
  for (const order of completedOrders) {
    for (const oi of order.orderItems) {
      if (oi.voided) continue
      const rate = oi.vatRate?.toString() || '22'
      if (!vatBreakdown[rate]) vatBreakdown[rate] = { base: 0, vat: 0 }
      const itemBase = toNum(oi.price) * (oi.quantity || 1) - toNum(oi.discountAmount)
      vatBreakdown[rate].base += itemBase
      vatBreakdown[rate].vat += toNum(oi.vatAmount)
    }
  }

  // ── FURS status ───────────────────────────────────────────
  const fursVerified = fursStats.find(g => g.action === 'FURS_INVOICE_VERIFIED')?._count?.action ?? 0
  const fursQueued = fursStats.find(g => g.action === 'FURS_INVOICE_QUEUED')?._count?.action ?? 0
  const fursFailed = fursStats.find(g => g.action === 'FURS_INVOICE_FAILED')?._count?.action ?? 0

  // ── Rezervacije ───────────────────────────────────────────
  const totalReservations = reservationStats.reduce((sum, g) => sum + (g._count?.status ?? 0), 0)
  const confirmedReservations = reservationStats
    .filter(g => g.status === 'confirmed' || g.status === 'completed')
    .reduce((sum, g) => sum + (g._count?.status ?? 0), 0)
  const noShowReservations = reservationStats.find(g => g.status === 'no_show')?._count?.status ?? 0

  // ── Stroški ───────────────────────────────────────────────
  const parseDetails = (d: unknown): Record<string, unknown> => {
    if (typeof d === 'string') { try { return JSON.parse(d) } catch { return {} } }
    return (d as Record<string, unknown>) || {}
  }

  const totalExpenses = expenseEntries.reduce((sum, e) => {
    const details = parseDetails(e.details)
    return sum + toNum(details.amount as DecimalLike)
  }, 0)

  // ── Neto dobiček ──────────────────────────────────────────
  const netProfit = round2(subtract(totalRevenue, totalExpenses))

  // ── Najbolj prodajani artikli ─────────────────────────────
  const itemSalesMap: Record<string, { name: string; quantity: number; revenue: number }> = {}
  for (const order of completedOrders) {
    for (const oi of order.orderItems) {
      const name = oi.menuItemName || 'Artikel'
      if (!itemSalesMap[name]) itemSalesMap[name] = { name, quantity: 0, revenue: 0 }
      itemSalesMap[name].quantity += oi.quantity || 1
      itemSalesMap[name].revenue += round2(multiply(oi.price || 0, oi.quantity || 1))
    }
  }
  const topItems = Object.values(itemSalesMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10)

  const eodCompleted = !!existingEOD

  return {
    totalRevenue, totalOrders, avgOrderValue, completedOrders,
    paymentsByMethod, totalTips, vatBreakdown,
    fursVerified, fursQueued, fursFailed,
    totalReservations, confirmedReservations, noShowReservations,
    totalExpenses, netProfit, topItems, eodCompleted,
  }
}

