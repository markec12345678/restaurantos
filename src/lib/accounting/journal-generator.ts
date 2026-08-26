import { logger } from "@/lib/logger"
// ============================================
// JOURNAL ENTRY GENERATOR — avtomatsko knjiženje iz poslovnih dogodkov
// Double-entry: vsako plačilo generira 2+ vrstici (debet == kredit)
// ============================================

import { db } from '@/lib/db'
import { toNum } from '@/lib/decimal'

// Slovenski kontni načrt (poenostavljen za restavracije)
export const ACCOUNTS = {
  // Sredstva (Assets)
  CASH: { code: '1010', name: 'Blagajna', type: 'asset' },
  BANK: { code: '1000', name: 'Banka', type: 'asset' },
  // Obveznosti (Liabilities)
  VAT_OUTPUT: { code: '2600', name: 'DDV izhodni', type: 'liability' },
  // Prihodki (Revenue)
  SALES_DINEIN: { code: '7000', name: 'Promet — na mestu', type: 'revenue' },
  SALES_TAKEOUT: { code: '7010', name: 'Promet — s seboj', type: 'revenue' },
  SALES_DELIVERY: { code: '7020', name: 'Promet — dostava', type: 'revenue' },
  TIPS: { code: '7600', name: 'Napitnine', type: 'revenue' },
} as const

type AccountKey = keyof typeof ACCOUNTS

/** Ustvari knjigovodski vnos za plačilo (avtomatsko iz Order + Payment) */
export async function generateJournalForPayment(
  orderId: string,
  paymentId: string,
  employeeId?: string
): Promise<string | null> {
  try {
    const payment = await db.payment.findUnique({
      where: { id: paymentId },
      include: {
        check: { include: { order: true } },
      },
    })
    if (!payment) return null

    const order = payment.check?.order
    if (!order) return null

    // Določi konto prometa glede na tip naročila
    const salesAccount = order.type === 'delivery'
      ? ACCOUNTS.SALES_DELIVERY
      : order.type === 'takeout'
      ? ACCOUNTS.SALES_TAKEOUT
      : ACCOUNTS.SALES_DINEIN

    const paymentAccount = payment.type === 'cash' ? ACCOUNTS.CASH : ACCOUNTS.BANK
    const total = toNum(payment.amount)
    const tip = toNum(payment.tipAmount)
    const netSales = total - tip

    // Številka vnosa: JE-YYYY-NNNNNN
    const year = new Date().getFullYear()
    const count = await db.journalEntry.count({ where: { entryNumber: { startsWith: `JE-${year}-` } } })
    const entryNumber = `JE-${year}-${String(count + 1).padStart(6, '0')}`

    // Ustvari knjigovodski vnos z vrsticami (double-entry)
    const entry = await db.journalEntry.create({
      data: {
        entryNumber,
        date: new Date(),
        reference: paymentId,
        referenceType: 'payment',
        description: `Plačilo #${order.orderNumber} — ${order.customerName || 'Gost'} (${payment.type})`,
        source: 'auto-payment',
        status: 'posted',
        postedAt: new Date(),
        postedBy: employeeId || null,
        // FIX issue #31: nastavi locationId iz povezanega naročila za multi-location accounting
        locationId: order.locationId || null,
        lines: {
          create: [
            // Debet: banka/blagajna (prejmemo denar)
            {
              accountCode: paymentAccount.code,
              accountName: paymentAccount.name,
              accountType: paymentAccount.type,
              debit: total,
              credit: 0,
              description: `Prejem ${payment.type} — plačilo #${order.orderNumber}`,
            },
            // Kredit: promet (brez napitnine)
            {
              accountCode: salesAccount.code,
              accountName: salesAccount.name,
              accountType: salesAccount.type,
              debit: 0,
              credit: netSales,
              description: `Promet ${order.type} — naročilo #${order.orderNumber}`,
            },
            // Kredit: napitnine (če > 0)
            ...(tip > 0 ? [{
              accountCode: ACCOUNTS.TIPS.code,
              accountName: ACCOUNTS.TIPS.name,
              accountType: ACCOUNTS.TIPS.type,
              debit: 0,
              credit: tip,
              description: `Napitnina — naročilo #${order.orderNumber}`,
            }] : []),
          ],
        },
      },
      include: { lines: true },
    })

    return entry.id
  } catch (error) {
    logger.error("CONSOLE", '[Journal] Napaka pri generiranju vnosa:', error)
    return null
  }
}

/** Trial Balance — seštevek debet/kredit po kontih za obdobje */
export async function generateTrialBalance(dateFrom?: Date, dateTo?: Date) {
  const where: Record<string, unknown> = { status: 'posted' }
  if (dateFrom || dateTo) {
    const dateFilter: Record<string, Date> = {}
    if (dateFrom) dateFilter.gte = dateFrom
    if (dateTo) dateFilter.lte = dateTo
    where.date = dateFilter
  }

  const lines = await db.journalLine.findMany({
    where: { journalEntry: where },
    select: { accountCode: true, accountName: true, accountType: true, debit: true, credit: true },
  })

  const accountMap: Record<string, { code: string; name: string; type: string; debit: number; credit: number }> = {}
  for (const line of lines) {
    const key = line.accountCode
    if (!accountMap[key]) {
      accountMap[key] = { code: line.accountCode, name: line.accountName, type: line.accountType, debit: 0, credit: 0 }
    }
    accountMap[key].debit += toNum(line.debit)
    accountMap[key].credit += toNum(line.credit)
  }

  const accounts = Object.values(accountMap).map(a => ({
    ...a,
    balance: a.debit - a.credit,
  }))

  const totalDebit = accounts.reduce((s, a) => s + a.debit, 0)
  const totalCredit = accounts.reduce((s, a) => s + a.credit, 0)

  return {
    accounts: accounts.sort((a, b) => a.code.localeCompare(b.code)),
    totalDebit,
    totalCredit,
    isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
  }
}

// ============================================
// P&L (Profit & Loss / Income Statement) — POSR/URY-style
// Prihodki - Stroški = Čisti dobiček
// ============================================

export async function generateProfitLoss(dateFrom?: Date, dateTo?: Date) {
  const where: Record<string, unknown> = { status: 'posted' }
  if (dateFrom || dateTo) {
    const dateFilter: Record<string, Date> = {}
    if (dateFrom) dateFilter.gte = dateFrom
    if (dateTo) dateFilter.lte = dateTo
    where.date = dateFilter
  }

  const lines = await db.journalLine.findMany({
    where: { journalEntry: where },
    select: { accountCode: true, accountName: true, accountType: true, debit: true, credit: true },
  })

  // Razdeli po tipu konta
  type AccountEntry = { code: string; name: string; type: string; debit: number; credit: number; balance: number }
  const sections: {
    revenue: { accounts: AccountEntry[]; total: number }
    expense: { accounts: AccountEntry[]; total: number }
  } = {
    revenue: { accounts: [], total: 0 },
    expense: { accounts: [], total: 0 },
  }

  const accountMap: Record<string, { code: string; name: string; type: string; debit: number; credit: number }> = {}
  for (const line of lines) {
    const key = line.accountCode
    if (!accountMap[key]) {
      accountMap[key] = { code: line.accountCode, name: line.accountName, type: line.accountType, debit: 0, credit: 0 }
    }
    accountMap[key].debit += toNum(line.debit)
    accountMap[key].credit += toNum(line.credit)
  }

  for (const acc of Object.values(accountMap)) {
    const balance = acc.type === 'revenue' ? acc.credit - acc.debit : acc.debit - acc.credit
    const entry = { ...acc, balance }
    if (acc.type === 'revenue') {
      sections.revenue.accounts.push(entry)
      sections.revenue.total += balance
    } else if (acc.type === 'expense') {
      sections.expense.accounts.push(entry)
      sections.expense.total += balance
    }
  }

  const netProfit = sections.revenue.total - sections.expense.total

  return {
    period: { from: dateFrom?.toISOString() || null, to: dateTo?.toISOString() || null },
    revenue: sections.revenue,
    expenses: sections.expense,
    netProfit,
    margin: sections.revenue.total > 0 ? (netProfit / sections.revenue.total) * 100 : 0,
  }
}

// ============================================
// BALANCE SHEET — POSR/URY-style
// Aktiva = Obveze + Kapital
// ============================================

export async function generateBalanceSheet(dateTo?: Date) {
  const where: Record<string, unknown> = { status: 'posted' }
  if (dateTo) {
    where.date = { lte: dateTo }
  }

  const lines = await db.journalLine.findMany({
    where: { journalEntry: where },
    select: { accountCode: true, accountName: true, accountType: true, debit: true, credit: true },
  })

  const sections: {
    assets: { accounts: Array<{ code: string; name: string; type: string; debit: number; credit: number; balance: number }>; total: number }
    liabilities: { accounts: Array<{ code: string; name: string; type: string; debit: number; credit: number; balance: number }>; total: number }
    equity: { accounts: Array<{ code: string; name: string; type: string; debit: number; credit: number; balance: number }>; total: number }
  } = {
    assets: { accounts: [], total: 0 },
    liabilities: { accounts: [], total: 0 },
    equity: { accounts: [], total: 0 },
  }

  const accountMap: Record<string, { code: string; name: string; type: string; debit: number; credit: number }> = {}
  for (const line of lines) {
    const key = line.accountCode
    if (!accountMap[key]) {
      accountMap[key] = { code: line.accountCode, name: line.accountName, type: line.accountType, debit: 0, credit: 0 }
    }
    accountMap[key].debit += toNum(line.debit)
    accountMap[key].credit += toNum(line.credit)
  }

  for (const acc of Object.values(accountMap)) {
    const entry = { ...acc, balance: acc.debit - acc.credit }
    if (acc.type === 'asset') {
      sections.assets.accounts.push(entry)
      sections.assets.total += entry.balance
    } else if (acc.type === 'liability') {
      sections.liabilities.accounts.push(entry)
      sections.liabilities.total += Math.abs(entry.balance)
    } else if (acc.type === 'equity') {
      sections.equity.accounts.push(entry)
      sections.equity.total += Math.abs(entry.balance)
    }
  }

  const totalLiabilitiesAndEquity = sections.liabilities.total + sections.equity.total

  return {
    asOf: dateTo?.toISOString() || new Date().toISOString(),
    assets: sections.assets,
    liabilities: sections.liabilities,
    equity: sections.equity,
    totalAssets: sections.assets.total,
    totalLiabilitiesAndEquity,
    isBalanced: Math.abs(sections.assets.total - totalLiabilitiesAndEquity) < 0.01,
  }
}

// ============================================
// GENERAL LEDGER — POSR-style
// Vse transakcije po kontih z datumom in opisom
// ============================================

export async function generateGeneralLedger(dateFrom?: Date, dateTo?: Date) {
  const where: Record<string, unknown> = { status: 'posted' }
  if (dateFrom || dateTo) {
    const dateFilter: Record<string, Date> = {}
    if (dateFrom) dateFilter.gte = dateFrom
    if (dateTo) dateFilter.lte = dateTo
    where.date = dateFilter
  }

  const entries = await db.journalEntry.findMany({
    where,
    include: {
      lines: {
        orderBy: { accountCode: 'asc' },
      },
    },
    orderBy: { date: 'asc' },
  })

  // Združi po kontih
  const ledgerMap: Record<string, {
    accountCode: string
    accountName: string
    accountType: string
    entries: Array<Record<string, unknown>>
    totalDebit: number
    totalCredit: number
    balance: number
  }> = {}

  for (const entry of entries) {
    for (const line of entry.lines) {
      const key = line.accountCode
      if (!ledgerMap[key]) {
        ledgerMap[key] = {
          accountCode: line.accountCode,
          accountName: line.accountName,
          accountType: line.accountType,
          entries: [],
          totalDebit: 0,
          totalCredit: 0,
          balance: 0,
        }
      }
      ledgerMap[key].entries.push({
        date: entry.date,
        entryNumber: entry.entryNumber,
        reference: entry.reference,
        referenceType: entry.referenceType,
        description: entry.description,
        debit: toNum(line.debit),
        credit: toNum(line.credit),
      })
      ledgerMap[key].totalDebit += toNum(line.debit)
      ledgerMap[key].totalCredit += toNum(line.credit)
      ledgerMap[key].balance = ledgerMap[key].totalDebit - ledgerMap[key].totalCredit
    }
  }

  const accounts = Object.values(ledgerMap).sort((a, b) => a.accountCode.localeCompare(b.accountCode))
  const totalDebit = accounts.reduce((s, a) => s + a.totalDebit, 0)
  const totalCredit = accounts.reduce((s, a) => s + a.totalCredit, 0)

  return {
    period: { from: dateFrom?.toISOString() || null, to: dateTo?.toISOString() || null },
    accounts,
    totalDebit,
    totalCredit,
    isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
  }
}
