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

export interface PaymentMethodRow {
  method: string
  count: number
  amount: number
}

export interface TopItemRow {
  name: string
  quantity: number
  revenue: number
}

export interface DailyDigestData {
  date: string // YYYY-MM-DD
  ordersCount: number
  revenue: number // Σ total (brez napitnin)
  tips: number
  tax: number
  avgTicket: number
  prevRevenue: number
  revenueChangePct: number | null // null če ni prejšnjega dne za primerjavo
  paymentMethods: PaymentMethodRow[]
  topItems: TopItemRow[]
  furs: { sent: number; failed: number }
}

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

// ============================================
// HTML BUILDER — email-safe: tabele + inline stili (nič zunanjih CSS-ov)
// ============================================

const C = {
  bg: '#f6f7f8',
  card: '#ffffff',
  border: '#e4e6e8',
  text: '#1c2430',
  muted: '#6b7480',
  accent: '#0f766e', // teal-700 — brez indigo/blue preferenc
  up: '#15803d',
  down: '#b91c1c',
} as const

function th(label: string): string {
  return `<th align="left" style="padding:8px 10px;border-bottom:2px solid ${C.border};font-size:12px;color:${C.muted};text-transform:uppercase;letter-spacing:.04em;">${label}</th>`
}

function td(value: string, opts: { strong?: boolean; color?: string; right?: boolean } = {}): string {
  const color = opts.color ?? C.text
  return `<td align="${opts.right ? 'right' : 'left'}" style="padding:8px 10px;border-bottom:1px solid ${C.border};font-size:14px;color:${color};${opts.strong ? 'font-weight:600;' : ''}">${value}</td>`
}

function changeBadge(pct: number | null): string {
  if (pct === null) return `<span style="color:${C.muted};font-size:12px;">(ni primerjave)</span>`
  const up = pct >= 0
  const color = up ? C.up : C.down
  const arrow = up ? '▲' : '▼'
  return `<span style="color:${color};font-weight:600;">${arrow} ${Math.abs(pct)}%</span>`
}

/** Zgradi HTML vsebino digesta (podatki NE morejo priti iz user inputa — številke + imena artiklov escape). */
export function buildDailyDigestHtml(data: DailyDigestData): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  // CTA mora biti ABSOLUTEN URL (email klienti ne razumejo relativnih povezav)
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')

  const paymentRows = data.paymentMethods.length
    ? data.paymentMethods
        .map(
          m => `<tr>${td(esc(m.method))}${td(String(m.count), { right: true })}${td(formatEUR(m.amount), { right: true, strong: true })}</tr>`
        )
        .join('')
    : `<tr><td colspan="3" style="padding:10px;color:${C.muted};font-size:13px;">Ni plačanih naročil.</td></tr>`

  const itemRows = data.topItems.length
    ? data.topItems
        .map(
          (it, i) =>
            `<tr>${td(String(i + 1))}${td(esc(it.name), { strong: true })}${td(String(it.quantity), { right: true })}${td(formatEUR(it.revenue), { right: true })}</tr>`
        )
        .join('')
    : `<tr><td colspan="4" style="padding:10px;color:${C.muted};font-size:13px;">Ni prodanih artiklov.</td></tr>`

  const fursBadge = data.furs.failed > 0
    ? `<span style="color:${C.down};font-weight:600;">⚠ ${data.furs.failed} neuspešnih</span>`
    : '<span style="color:' + C.up + ';">✓ brez napak</span>'

  return `<!DOCTYPE html>
<html lang="sl">
<body style="margin:0;padding:24px;background:${C.bg};font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:${C.text};">
  <div style="max-width:640px;margin:0 auto;">
    <h1 style="font-size:20px;margin:0 0 4px;">Dnevni povzetek — ${data.date}</h1>
    <p style="margin:0 0 20px;color:${C.muted};font-size:13px;">RestaurantOS — menedžerski dnevnik</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.card};border:1px solid ${C.border};border-radius:8px;margin-bottom:16px;">
      <tr>
        <td style="padding:16px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:12px;color:${C.muted};text-transform:uppercase;letter-spacing:.04em;padding-bottom:4px;">Skupni promet</td>
            </tr>
            <tr>
              <td style="font-size:28px;font-weight:700;color:${C.accent};">${formatEUR(data.revenue)}</td>
              <td align="right" valign="bottom" style="padding-bottom:6px;">${changeBadge(data.revenueChangePct)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.card};border:1px solid ${C.border};border-radius:8px;margin-bottom:16px;">
      <tr>
        <td style="padding:14px 20px;font-size:14px;">
          <strong>${data.ordersCount}</strong> naročil · povprečni račun <strong>${formatEUR(data.avgTicket)}</strong><br/>
          <span style="color:${C.muted};font-size:13px;">DDV ${formatEUR(data.tax)} · napitnine ${formatEUR(data.tips)}</span>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.card};border:1px solid ${C.border};border-radius:8px;margin-bottom:16px;">
      <tr><td style="padding:14px 20px 6px;font-size:14px;font-weight:600;">Metode plačila</td></tr>
      <tr><td style="padding:0 12px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>${th('Metoda')}${th('Št.', )}${th('Znesek')}</tr>
          ${paymentRows}
        </table>
      </td></tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.card};border:1px solid ${C.border};border-radius:8px;margin-bottom:16px;">
      <tr><td style="padding:14px 20px 6px;font-size:14px;font-weight:600;">Top 5 artiklov</td></tr>
      <tr><td style="padding:0 12px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>${th('#')}${th('Artikel')}${th('Količina')}${th('Prihodek')}</tr>
          ${itemRows}
        </table>
      </td></tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.card};border:1px solid ${C.border};border-radius:8px;margin-bottom:20px;">
      <tr><td style="padding:14px 20px;font-size:14px;">
        FURS fiskalizacija: <strong>${data.furs.sent}</strong> poslanih · ${fursBadge}
      </td></tr>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="background:${C.accent};border-radius:6px;">
          <a href="${appUrl}/reports" style="display:inline-block;padding:10px 20px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">Odpri Z-osnutek v aplikaciji</a>
        </td>
      </tr>
    </table>

    <p style="color:${C.muted};font-size:12px;margin:0;">Avtomatsko generirano sporočilo · RestaurantOS</p>
  </div>
</body>
</html>`
}

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
