'use client'

// ═══════════════════════════════════════════════════════════════
// P&L loadReport utility — AUD-06: uporablja /api/accounting/profit-loss
//
// Prej je ta modul gradil P&L client-side z hardcoded konstantami
// (COGS 30% / 25%, rent 1500, utilities 400, ...). To ni bilo točno.
// Sedaj kličemo accounting API, ki računa P&L iz knjigovodskih vnosov
// (double-entry journal entries). Ista PnLData interface ostaja, da
// ProfitLossReport.tsx komponenta deluje nespremenjena.
// ═══════════════════════════════════════════════════════════════

import { authFetch } from '@/components/pos/PinLogin'
import type { PnLData, PnLPeriod } from '../profit-loss/constants'
import { PERIOD_NAMES } from '../profit-loss/constants'

// ─── Pomožne funkcije ──────────────────────────────────────────

export function getPeriodDates(period: PnLPeriod, now: Date): { periodStart: Date; periodEnd: Date } {
  let periodStart: Date
  const periodEnd = now
  switch (period) {
    case 'today':
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      break
    case 'week':
      periodStart = new Date(now)
      periodStart.setDate(now.getDate() - 7)
      break
    case 'month':
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    case 'quarter': {
      const quarter = Math.floor(now.getMonth() / 3)
      periodStart = new Date(now.getFullYear(), quarter * 3, 1)
      break
    }
  }
  return { periodStart, periodEnd }
}

/** Varno pretvori unknown v number (default 0). */
function safeNum(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

// ─── Tipi za API response (/api/accounting/profit-loss) ───────

interface PnlAccount {
  code: string
  name: string
  type: string
  debit: number
  credit: number
  balance: number
}

interface PnlApiResponse {
  period: { from: string | null; to: string | null }
  revenue: { accounts: PnlAccount[]; total: number }
  expenses: { accounts: PnlAccount[]; total: number }
  netProfit: number
  margin: number
}

// ─── Mapping kontov → PnLData bucket ───────────────────────────
//
// Kontni načrt (glej src/lib/accounting/journal-generator.ts ACCOUNTS):
//   7000 Promet — na mestu        → revenue.food
//   7010 Promet — s seboj         → revenue.food
//   7020 Promet — dostava         → revenue.delivery
//   7600 Napitnine                → revenue.other (ne food)
//   Ostali revenue konti          → revenue.food (fallback)
//
// COGS: accounting še nima posebnih COGS kontov (ni inventory-journal
// expense mapping), zato je COGS = 0 dokler se to ne doda.
//
// Stroški: klasificiramo po imenu konta (labor, rent, utilities, ...).
// Neprepoznani stroški gredo v operatingExpenses.other.

interface RevenueSplit {
  food: number
  beverages: number
  delivery: number
  other: number
}

function classifyRevenueAccount(acc: PnlAccount): keyof RevenueSplit {
  const code = (acc.code || '').trim()
  const name = (acc.name || '').toLowerCase()
  if (code === '7020' || name.includes('dostava') || name.includes('delivery')) return 'delivery'
  if (code === '7600' || name.includes('napitnin') || name.includes('tip')) return 'other'
  // 7000 (dine-in) in 7010 (takeout) → food. Pijače trenutno niso
  // ločene v lastnem kontu — klasificirajo se kot food dokler se
  // ne doda kontni načrt za beverages.
  return 'food'
}

interface OperatingExpenseBuckets {
  labor: number
  rent: number
  utilities: number
  marketing: number
  supplies: number
  maintenance: number
  insurance: number
  other: number
  total: number
}

function classifyExpenseAccount(acc: PnlAccount): keyof Omit<OperatingExpenseBuckets, 'total'> {
  const name = (acc.name || '').toLowerCase()
  if (
    name.includes('plač') ||
    name.includes('delo') ||
    name.includes('labor') ||
    name.includes('labour') ||
    name.includes('salary') ||
    name.includes('wage') ||
    name.includes('bruto') ||
    name.includes('neto')
  ) {
    return 'labor'
  }
  if (name.includes('najem') || name.includes('rent')) return 'rent'
  if (
    name.includes('komunal') ||
    name.includes('energ') ||
    name.includes('electric') ||
    name.includes('utilities') ||
    name.includes('voda') ||
    name.includes('plin') ||
    name.includes('wasser') ||
    name.includes('strom')
  ) {
    return 'utilities'
  }
  if (name.includes('marketin') || name.includes('oglas') || name.includes('advert')) {
    return 'marketing'
  }
  if (
    name.includes('potroš') ||
    name.includes('material') ||
    name.includes('supplies') ||
    name.includes('consumable')
  ) {
    return 'supplies'
  }
  if (
    name.includes('vzdrž') ||
    name.includes('maintenance') ||
    name.includes('poprav') ||
    name.includes('repair')
  ) {
    return 'maintenance'
  }
  if (name.includes('zavar') || name.includes('insurance')) return 'insurance'
  return 'other'
}

// ─── Glavna funkcija ───────────────────────────────────────────

export async function loadPnlReport(period: PnLPeriod): Promise<PnLData> {
  const now = new Date()
  const { periodStart, periodEnd } = getPeriodDates(period, now)

  // ── Fetch P&L iz accounting API (server-side iz journal entries) ──
  const dateFrom = periodStart.toISOString().split('T')[0]
  const dateTo = periodEnd.toISOString().split('T')[0]
  const pnlRes = await authFetch(
    `/api/accounting/profit-loss?dateFrom=${dateFrom}&dateTo=${dateTo}`,
  )
  if (!pnlRes.ok) {
    throw new Error(`P&L API vrnil status ${pnlRes.status}`)
  }
  const pnl = (await pnlRes.json()) as PnlApiResponse

  // ── Razdeli revenue po bucketih glede na konto ──────────────────
  const revenueSplit: RevenueSplit = { food: 0, beverages: 0, delivery: 0, other: 0 }
  for (const acc of pnl?.revenue?.accounts || []) {
    const bucket = classifyRevenueAccount(acc)
    revenueSplit[bucket] += safeNum(acc.balance)
  }
  const totalRevenue = safeNum(pnl?.revenue?.total)

  // ── COGS: accounting še nima COGS kontov — gross profit = revenue ──
  const foodCOGS = 0
  const beverageCOGS = 0
  const totalCOGS = 0

  // ── Razdeli stroške po bucketih glede na ime konta ──────────────
  const operatingExpenses: OperatingExpenseBuckets = {
    labor: 0,
    rent: 0,
    utilities: 0,
    marketing: 0,
    supplies: 0,
    maintenance: 0,
    insurance: 0,
    other: 0,
    total: 0,
  }
  let otherExpensesFromApi = 0
  for (const acc of pnl?.expenses?.accounts || []) {
    const balance = safeNum(acc.balance)
    operatingExpenses.total += balance
    const bucket = classifyExpenseAccount(acc)
    operatingExpenses[bucket] += balance
    if (bucket === 'other') {
      otherExpensesFromApi += balance
    }
  }

  // ── Izračunaj margin in profit ──────────────────────────────────
  const grossProfit = totalRevenue - totalCOGS
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
  const operatingProfit = grossProfit - operatingExpenses.total
  const operatingMargin = totalRevenue > 0 ? (operatingProfit / totalRevenue) * 100 : 0
  const netProfit = safeNum(pnl?.netProfit)
  const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

  // ── covers + avgCheck: accounting API ne vrne števila naročil ──
  // Za covers/avgCheck naredimo lahek fetch /api/orders (paymentStatus=paid)
  // in preštejemo plačana naročila v obdobju. Non-critical — ob napaki
  // covers ostane 0.
  let covers = 0
  try {
    const ordersRes = await authFetch(`/api/orders?paymentStatus=paid&limit=500`)
    if (ordersRes.ok) {
      const ordersData = await ordersRes.json()
      // API vrača { orders: [...], total, ... } — pridobimo array
      const ordersArray: Array<{ createdAt?: string; completedAt?: string; paidAt?: string }> =
        Array.isArray(ordersData) ? ordersData : (ordersData?.orders || [])
      covers = ordersArray.filter((o) => {
        const d = o.paidAt ? new Date(o.paidAt) : (o.completedAt ? new Date(o.completedAt) : (o.createdAt ? new Date(o.createdAt) : null))
        if (!d) return false
        return d >= periodStart && d <= periodEnd
      }).length
    }
  } catch {
    // Non-critical — covers ostane 0
  }

  const avgCheck = covers > 0 ? totalRevenue / covers : 0

  return {
    period: PERIOD_NAMES[period],
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    revenue: {
      food: revenueSplit.food,
      beverages: revenueSplit.beverages,
      delivery: revenueSplit.delivery,
      other: revenueSplit.other,
      total: totalRevenue,
    },
    costOfGoods: { food: foodCOGS, beverages: beverageCOGS, total: totalCOGS },
    grossProfit,
    grossMargin,
    operatingExpenses,
    operatingProfit,
    operatingMargin,
    otherIncome: 0,
    otherExpenses: otherExpensesFromApi,
    netProfit,
    netMargin,
    covers,
    avgCheck,
  }
}
