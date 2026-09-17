// ============================================
// DNEVNI MENEDŽERSKI DIGEST — HTML email z povzetkom prejšnjega dne
// ============================================
// Task 20 (worklog runda 20): reportType 'daily_summary' je obstajal v
// ScheduledReportType enumu, a ga NIKOLI nihče ni ustvaril in je process
// route pošiljal kot Z-report PDF. Ta modul implementira pravi digest:
//   - promet + primerjava s prejšnjim dnem
//   - št. naročil + povprečni račun + napitnine
//   - metode plačila breakdown
//   - top 5 artiklov
//   - FURS outbox status (sent/failed)
//   - link na Z-osnutek v aplikaciji
//
// Self-heal: cron /api/scheduled-emails/process ob 2:00 UTC pokliče
// ensureDailySummaryLog(yesterday) — digest pride tudi, če EOD ni bil narejen.
// ============================================

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { formatEUR } from '@/lib/safe-format'
import { sendEmail, createScheduledEmailLog, type CreateScheduledEmailResult } from '@/lib/email'
// Task 21: HTML builder izluščen v client-safe modul (brez db) — enak HTML
// uporablja produkcija (email) IN predogled v Email zavihku (client).
import { buildDailyDigestHtml, type DailyDigestData, type PaymentMethodRow, type TopItemRow } from '@/lib/email/digest-html'

// Back-compat re-exporti (testi + obstoječi klicatelji importajo iz tu)
export {
  buildDailyDigestHtml,
  type DailyDigestData,
  type PaymentMethodRow,
  type TopItemRow,
} from '@/lib/email/digest-html'

/** Dan (00:00:00–23:59:59) za podaten Date — lokalno (server TZ). */
function dayBounds(date: Date): { gte: Date; lte: Date } {
  return {
    gte: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0),
    lte: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59),
  }
}

function dateKey(date: Date): string {
  return date.toISOString().split('T')[0]
}

function toNum(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  return Number(v) || 0
}

/**
 * Zbere podatke za dnevni digest (en dan, po createdAt — konsistentno z
 * Z-report semantiko: paymentStatus='paid').
 */
export async function fetchDailyDigestData(date: Date): Promise<DailyDigestData> {
  const bounds = dayBounds(date)
  const prevBounds = dayBounds(new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1))

  const orderWhere = {
    paymentStatus: 'paid',
    createdAt: bounds,
  } as const

  // 1) Dnešni aggregate + prejšnji dan (vzporedno)
  const [todayAgg, prevAgg, paymentGroups, orderItems, fursGroups] = await Promise.all([
    db.order.aggregate({
      where: orderWhere,
      _count: { _all: true },
      _sum: { total: true, tax: true, tip: true },
    }),
    db.order.aggregate({
      where: { paymentStatus: 'paid', createdAt: prevBounds },
      _sum: { total: true },
    }),
    // 2) Metode plačila (Order-level, konsistentno z Z-quick-view)
    db.order.groupBy({
      by: ['paymentMethod'],
      where: orderWhere,
      _count: { _all: true },
      _sum: { total: true },
    }),
    // 3) Top artikli — groupBy ne zna price*qty, zato minimal fetch + JS agregacija
    db.orderItem.findMany({
      where: { voided: false, order: orderWhere },
      select: { menuItemName: true, quantity: true, price: true },
    }),
    // 4) FURS outbox status za ta dan
    db.outboxEvent.groupBy({
      by: ['status'],
      where: { target: 'furs', createdAt: bounds, status: { in: ['sent', 'failed', 'dead_letter'] } },
      _count: { _all: true },
    }),
  ])

  const ordersCount = todayAgg._count._all
  const revenue = toNum(todayAgg._sum.total)
  const prevRevenue = toNum(prevAgg._sum.total)

  const topMap = new Map<string, TopItemRow>()
  for (const item of orderItems) {
    const name = item.menuItemName || '(neimenovan artikel)'
    const qty = item.quantity ?? 1
    const row = topMap.get(name) ?? { name, quantity: 0, revenue: 0 }
    row.quantity += qty
    row.revenue += toNum(item.price) * qty
    topMap.set(name, row)
  }
  const topItems = [...topMap.values()]
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    .slice(0, 5)

  const furs: DailyDigestData['furs'] = { sent: 0, failed: 0 }
  for (const g of fursGroups) {
    if (g.status === 'sent') furs.sent += g._count._all
    if (g.status === 'failed' || g.status === 'dead_letter') furs.failed += g._count._all
  }

  const paymentMethods: PaymentMethodRow[] = paymentGroups
    .map(g => ({
      method: g.paymentMethod || 'neznano',
      count: g._count._all,
      amount: toNum(g._sum.total),
    }))
    .sort((a, b) => b.amount - a.amount)

  return {
    date: dateKey(date),
    ordersCount,
    revenue,
    tips: toNum(todayAgg._sum.tip),
    tax: toNum(todayAgg._sum.tax),
    avgTicket: ordersCount > 0 ? revenue / ordersCount : 0,
    prevRevenue,
    revenueChangePct: prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 1000) / 10 : null,
    paymentMethods,
    topItems,
    furs,
  }
}

// (HTML builder prenesen v @/lib/email/digest-html — client-safe modul, Task 21)

/** Pošlji digest email enemu prejemniku (log je per-recipient). */
export async function sendDailyDigestEmail(
  recipient: string,
  data: DailyDigestData
): Promise<{ success: boolean; error?: string }> {
  const html = buildDailyDigestHtml(data)
  const text = `Dnevni povzetek ${data.date}
Promet: ${formatEUR(data.revenue)} (${data.revenueChangePct === null ? 'ni primerjave' : `${data.revenueChangePct > 0 ? '+' : ''}${data.revenueChangePct}%`})
Naročila: ${data.ordersCount} · povprečni račun: ${formatEUR(data.avgTicket)}
DDV: ${formatEUR(data.tax)} · napitnine: ${formatEUR(data.tips)}
FURS: ${data.furs.sent} poslanih, ${data.furs.failed} neuspešnih

RestaurantOS — avtomatsko generirano sporočilo`

  return sendEmail({
    to: recipient,
    subject: `Dnevni povzetek ${data.date} — RestaurantOS`,
    text,
    html,
  })
}

/**
 * Self-heal: zagotovi, da obstaja daily_summary ScheduledEmailLog za podan
 * datum. Idempotentno — createScheduledEmailLog sam preveri duplikate.
 * Cron process route to pokliče PRED procesiranjem, tako da digest pride
 * tudi, če EOD closeShift ni sprožil pošiljanja.
 */
export async function ensureDailySummaryLog(reportDate: Date = new Date()): Promise<CreateScheduledEmailResult> {
  const result = await createScheduledEmailLog('daily_summary', reportDate)
  if (result.skipped) {
    logger.info('EMAIL', `Dnevni digest za ${result.reportDate} že obstaja (${result.reason})`)
  }
  return result
}
