// ============================================
// DNEVNI DIGEST — HTML BUILDER (client-safe, BREZ db importov)
// ============================================
// Task 21: izluščeno iz daily-digest.ts, da lahko ENAK HTML uporablja:
//   - produkcija (email pošiljanje, server)
//   - predogled v Email zavihku (client — db import bi bil crash)
//
// Email-safe: tabele + inline stili, nič zunanjih CSS-ov.
// Podatki NE pridejo iz user inputa — številke + escaped imena artiklov.
// ============================================

import { formatEUR } from '@/lib/safe-format'
import { summarizeHourly, type HourlyPoint } from '@/lib/digest-hours' // R77: urna razporeditev — digest-hours je čist lib (brez db importov) → digest-html ostane client-safe

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
  // R65: polna dnevna primerjava (OPTIONAL — stari klicatelji/testni
  // fixture-i brez teh polj ostanejo veljavni; UI/email graciozno izpustita)
  prevOrdersCount?: number
  ordersChangePct?: number | null
  prevTips?: number
  tipsChangePct?: number | null
  prevAvgTicket?: number
  avgTicketChangePct?: number | null
  paymentMethods: PaymentMethodRow[]
  topItems: TopItemRow[]
  furs: { sent: number; failed: number }
  // R76/R77: urna razporeditev prometa (OPTIONAL — stari klicatelji/testni
  // fixture-i brez tega polja ostanejo veljavni; UI in email HTML sekcijo
  // graciozno izpustita, ko polje manjka ali je brez prometa)
  hourly?: HourlyPoint[]
}

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

function th(label: string, opts: { right?: boolean } = {}): string {
  return `<th align="${opts.right ? 'right' : 'left'}" style="padding:8px 10px;border-bottom:2px solid ${C.border};font-size:12px;color:${C.muted};text-transform:uppercase;letter-spacing:.04em;">${label}</th>`
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

// R65: primerjavna kartica v emailu — enaka semantika kot tiskana stran
// (Primerjava s prejšnjim dnem). Prikaže se SAMO, če ima dan včerajšnjo
// bazo (prejšnji dan je imel vsa eno naročilo), sicer je kartica izpuščena
// (email ostane čist, brez praznih obljub).
function comparisonCard(data: DailyDigestData): string {
  if (typeof data.prevOrdersCount !== 'number' || data.prevOrdersCount <= 0) return ''
  const rows: Array<{ label: string; today: string; yesterday: string; pct: number | null | undefined }> = [
    { label: 'Promet', today: formatEUR(data.revenue), yesterday: formatEUR(data.prevRevenue), pct: data.revenueChangePct },
    { label: 'Naročila', today: String(data.ordersCount), yesterday: String(data.prevOrdersCount), pct: data.ordersChangePct },
    { label: 'Povp. račun', today: formatEUR(data.avgTicket), yesterday: formatEUR(data.prevAvgTicket ?? 0), pct: data.avgTicketChangePct },
    { label: 'Napitnine', today: formatEUR(data.tips), yesterday: formatEUR(data.prevTips ?? 0), pct: data.tipsChangePct },
  ]
  const trs = rows
    .map(
      r => `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid ${C.border};font-size:13px;color:${C.muted};">${r.label}</td>
        <td align="right" style="padding:6px 10px;border-bottom:1px solid ${C.border};font-size:13px;font-weight:600;">${r.today}</td>
        <td align="right" style="padding:6px 10px;border-bottom:1px solid ${C.border};font-size:13px;color:${C.muted};">včeraj ${r.yesterday}</td>
        <td align="right" style="padding:6px 10px;border-bottom:1px solid ${C.border};font-size:13px;">${changeBadge(r.pct ?? null)}</td>
      </tr>`
    )
    .join('')
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.card};border:1px solid ${C.border};border-radius:8px;margin-bottom:16px;">
      <tr><td style="padding:14px 20px 6px;font-size:14px;font-weight:600;">Primerjava s prejšnjim dnem</td></tr>
      <tr><td style="padding:0 12px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>${th('Kazalnik')}${th('Danes', { right: true })}${th('Včeraj', { right: true })}${th('Sprememba', { right: true })}</tr>
          ${trs}
        </table>
      </td></tr>
    </table>`
}

// R77: urna razporeditev v emailu — email-safe različica UI sekcije
// "Promet po urah" (R76). Omejitve email klientov: samo tabele + inline
// stili (Gmail trda odstrani <style>, Outlook Word engine brez flex/% višin),
// zato so stolpci div-i s fiksnimi px višinami znotraj td-jev (vertical-align
// bottom = baseline), vrh amber, okno samo kot čip (pasica za stolpci v
// emailu ni izvedljiva zanesljivo).
// Prikaže se SAMO, če hourly obstaja in ima promet (vzorec R65/R76 — brez
// praznih obljub; dan brez naročil ne obljublja grafa).
function hourlyCard(data: DailyDigestData): string {
  const points = data.hourly
  if (!Array.isArray(points) || points.length === 0) return ''
  const summary = summarizeHourly(points)
  if (!summary || summary.totalRevenue <= 0) return ''

  const BAR_MAX_PX = 80
  const peakColor = '#f59e0b' // amber-500 — vrh urnika (isti poudarek kot UI)
  const barColor = '#14b8a6' // teal-500 — redna ura (accent družina)

  const bars = points
    .map(p => {
      const h = p.revenue > 0 ? Math.max(3, Math.round((p.heightPct / 100) * BAR_MAX_PX)) : 0
      const bar = h > 0 ? `<div style="height:${h}px;background:${p.isPeak ? peakColor : barColor};font-size:0;line-height:0;">&nbsp;</div>` : ''
      const tip = `${p.hour}. ura: ${formatEUR(p.revenue)} (${p.orders} ${p.orders === 1 ? 'naročilo' : 'naročil'})${p.isPeak ? ' — vrh dneva' : ''}`
      return `<td style="width:4.166%;height:${BAR_MAX_PX}px;vertical-align:bottom;padding:0 1px;border-bottom:1px solid ${C.border};" title="${tip}">${bar}</td>`
    })
    .join('')

  const labels = points
    .map(
      p =>
        `<td style="font-size:9px;color:${C.muted};text-align:center;padding-top:4px;">${p.showLabel ? p.hour : '&nbsp;'}</td>`
    )
    .join('')

  const two = (n: number) => String(n).padStart(2, '0')
  const peakChip =
    summary.peakHour !== null
      ? `<span style="font-size:12px;font-weight:600;color:#92400e;background:#fef3c7;border-radius:4px;padding:3px 8px;display:inline-block;">★ vrh: ${summary.peakHour}. ura (${formatEUR(summary.peakRevenue)})</span>`
      : ''
  const windowChip = summary.busyWindow
    ? `<span style="font-size:12px;font-weight:600;color:${C.accent};background:#ccfbf1;border-radius:4px;padding:3px 8px;display:inline-block;">▦ najboljše okno ${two(summary.busyWindow.startHour)}–${two(summary.busyWindow.endHour + 1)} h (${formatEUR(summary.busyWindow.revenue)})</span>`
    : ''

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.card};border:1px solid ${C.border};border-radius:8px;margin-bottom:16px;">
      <tr><td style="padding:14px 20px 6px;font-size:14px;font-weight:600;">Promet po urah</td></tr>
      <tr><td style="padding:0 20px 10px;"><table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td>${peakChip}</td><td align="right">${windowChip}</td></tr></table></td></tr>
      <tr><td style="padding:0 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" aria-label="Promet po urah dneva, od polnoči do polnoči">
          <tr>${bars}</tr>
          <tr>${labels}</tr>
        </table>
      </td></tr>
      <tr><td style="padding:8px 20px 12px;font-size:11px;color:${C.muted};">
        <span style="color:${barColor};">■</span> promet · <span style="color:${peakColor};">■</span> vrh urnika · oznake: vsaka 3. ura · zasedenih ${summary.activeHours} ur
      </td></tr>
    </table>`
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

    ${comparisonCard(data)}

    ${hourlyCard(data)}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.card};border:1px solid ${C.border};border-radius:8px;margin-bottom:16px;">
      <tr><td style="padding:14px 20px 6px;font-size:14px;font-weight:600;">Metode plačila</td></tr>
      <tr><td style="padding:0 12px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>${th('Metoda')}${th('Št.')}${th('Znesek')}</tr>
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
