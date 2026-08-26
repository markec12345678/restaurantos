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
    console.error('[Journal] Napaka pri generiranju vnosa:', error)
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
