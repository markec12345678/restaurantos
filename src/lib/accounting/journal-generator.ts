import { logger } from "@/lib/logger"
// ============================================
// JOURNAL ENTRY GENERATOR — avtomatsko knjiženje iz poslovnih dogodkov
// Double-entry: vsako plačilo generira 2+ vrstici (debet == kredit)
// ============================================

import { db } from '@/lib/db'
import { toNum } from '@/lib/decimal'
import { resolveAccountCode } from './chart-of-accounts'
import { Prisma } from '@prisma/client'

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

/** Prisma transakcijski klient (interaktivni callback parameter) */
type PrismaTx = Parameters<Parameters<typeof db.$transaction>[0]>[0]

type DbOrTx = typeof db | PrismaTx

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

/**
 * P1-19 (concurrency): številka vnosa z retry na P2002 (unique collision).
 *
 * Prej: `count + 1` — dva sočasno generirana vnosa (npr. dve plačili) sta
 * oba prebrala isti count → isto entryNumber → P2002 → JE TIHO manjkal
 * (catch → null). Sedaj: ob unikatnem konfliktu ponovno preberemo count
 * (medtem je zmagovalec zapisal svoj vnos) in poskusimo znova.
 */
async function nextJournalEntryNumber(client: DbOrTx): Promise<string> {
  const year = new Date().getFullYear()
  const count = await client.journalEntry.count({
    where: { entryNumber: { startsWith: `JE-${year}-` } },
  })
  return `JE-${year}-${String(count + 1).padStart(6, '0')}`
}

/**
 * Ustvari JE z retryjem na P2002 (entryNumber kolizija). createFn dobi
 * (entryNumber) in mora izvesti sam create.
 */
async function createEntryWithNumberRetry<T extends { id: string }>(
  client: DbOrTx,
  createFn: (entryNumber: string) => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const entryNumber = await nextJournalEntryNumber(client)
    try {
      return await createFn(entryNumber)
    } catch (err) {
      if (isUniqueViolation(err) && attempt < maxAttempts - 1) {
        // Kolizija na entryNumber — zmagovalni klic je že zapisal svoj vnos;
        // ponovno preberemo count in poskusimo z naslednjo številko.
        continue
      }
      // Kolizija na DRUGEM unique polju (npr. reference idempotenca) — ne retry
      if (isUniqueViolation(err)) {
        // Zadnji poskus — lahko je tudi idempotenčna kolizija; vrni original
        // napako, klicnik (refund) jo obravnava.
      }
      lastError = err
      if (!isUniqueViolation(err)) throw err
    }
  }
  throw lastError ?? new Error('JOURNAL_ENTRY_NUMBER_RETRY_EXHAUSTED')
}

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

    // P1-accounting: idempotenca — duplikat (retry klica) preskočimo
    const existing = await db.journalEntry.findFirst({
      where: { reference: paymentId, referenceType: 'payment' },
      select: { id: true },
    })
    if (existing) return existing.id

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

    // P1-accounting (DDV): razdeli bruto znesek na NETO prihodek + DDV.
    // Prej je celoten netSales (vključno z DDV!) šel na konto prihodka —
    // prihodek bil napihnjen, DDV izhodni (2600) pa se nikoli ni knjižil.
    // DDV delež: proporcionalno po deležu plačila na čeku (check.tax × ratio).
    const check = payment.check
    const checkTotal = toNum(check?.total)
    const checkTax = toNum(check?.tax)
    const ratio = checkTotal > 0 ? Math.min(total / checkTotal, 1) : 0
    const vatPortion = Math.max(0, Math.round(checkTax * ratio * 100) / 100)
    const netRevenue = Math.max(0, Math.round((netSales - vatPortion) * 100) / 100)

    // ISSUE #38: Resolve ChartOfAccount FK za vsako vrstico (validacija + denormalizacija)
    const [resolvedSales, resolvedPayment, resolvedTips, resolvedVat] = await Promise.all([
      resolveAccountCode(salesAccount.code),
      resolveAccountCode(paymentAccount.code),
      tip > 0 ? resolveAccountCode(ACCOUNTS.TIPS.code) : Promise.resolve(null),
      vatPortion > 0 ? resolveAccountCode(ACCOUNTS.VAT_OUTPUT.code) : Promise.resolve(null),
    ])

    // Ustvari knjigovodski vnos z vrsticami (double-entry, DDV razdeljen)
    // Debet: plačilno sredstvo (total)
    // Kredit: prihodek (neto brez DDV) + DDV izhodni + napitnine
    const entry = await createEntryWithNumberRetry(db, (entryNumber) =>
      db.journalEntry.create({
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
                accountCode: resolvedPayment.accountCode,
                chartOfAccountCode: resolvedPayment.chartOfAccountCode,
                accountName: resolvedPayment.accountName,
                accountType: resolvedPayment.accountType,
                debit: total,
                credit: 0,
                description: `Prejem ${payment.type} — plačilo #${order.orderNumber}`,
                // ISSUE #31: denormalizirano na JournalLine za hitre poizvedbe
                locationId: order.locationId || null,
              },
              // Kredit: promet NETO (brez DDV, brez napitnine)
              {
                accountCode: resolvedSales.accountCode,
                chartOfAccountCode: resolvedSales.chartOfAccountCode,
                accountName: resolvedSales.accountName,
                accountType: resolvedSales.accountType,
                debit: 0,
                credit: netRevenue,
                description: `Promet ${order.type} (neto) — naročilo #${order.orderNumber}`,
                locationId: order.locationId || null,
              },
              // Kredit: DDV izhodni (2600) — obveznost do države
              ...(vatPortion > 0 && resolvedVat ? [{
                accountCode: resolvedVat.accountCode,
                chartOfAccountCode: resolvedVat.chartOfAccountCode,
                accountName: resolvedVat.accountName,
                accountType: resolvedVat.accountType,
                debit: 0,
                credit: vatPortion,
                description: `DDV izhodni — plačilo #${order.orderNumber}`,
                locationId: order.locationId || null,
              }] : []),
              // Kredit: napitnine (če > 0)
              ...(tip > 0 && resolvedTips ? [{
                accountCode: resolvedTips.accountCode,
                chartOfAccountCode: resolvedTips.chartOfAccountCode,
                accountName: resolvedTips.accountName,
                accountType: resolvedTips.accountType,
                debit: 0,
                credit: tip,
                description: `Napitnina — naročilo #${order.orderNumber}`,
                locationId: order.locationId || null,
              }] : []),
            ],
          },
        },
        include: { lines: true },
      }),
    )

    return entry.id
  } catch (error) {
    logger.error("CONSOLE", '[Journal] Napaka pri generiranju vnosa:', error)
    return null
  }
}

/** Prisma transakcijski klient (interaktivni callback parameter) — podedovano zgoraj */

/** Vhod za generateJournalForRefund — vrednosti priskrbi refund transakcija. */
export interface RefundJournalInput {
  paymentId: string
  /** Znesek TEGA vračila (ne kumulativ!) */
  refundAmount: number
  /** Kumulativen refund znesek PO tem vračilu (idempotenčni ključ) */
  cumulativeRefundAmount: number
  /** Delež napitnine tega vračila (refundRatio × payment.tipAmount) */
  tipPortion: number
  /** P1-accounting: delež DDV tega vračila (izračuna klicatelj iz check.tax) */
  vatPortion: number
  orderType: string
  orderNumber: number | string
  customerName: string
  paymentType: string
  locationId: string | null
  employeeId?: string | null
  reason?: string
}

/**
 * P1-18: Knjigovodska reverza (storno vnos) ob vračilu plačila.
 *
 * KLICATI ZNOTRAJ refund $transaction — tako so "refund in accounting
 * reversal" ATOMARNA (specifikacija P1-18: "Če jedna operacija uspije,
 * druga pa pade, ne smije ostati napol zapisan poslovni proces").
 *
 * Double-entry reverza (obrnjene strani glede na plačilni vnos):
 *   Debet:  promet  (razveljavimo prihodek za refundani del)
 *   Debet:  napitnine (če je tip del vračila)
 *   Kredit: banka/blagajna (izplačamo denar nazaj)
 *
 * Idempotenca: reference = `refund:{paymentId}:{cumulative}` — advisory
 * lock na refundu serializira kumulativni znesek → enoličen za vsak
 * refund dogodek; duplikat klic preskoči create in vrne obstoječi ID.
 */
export async function generateJournalForRefund(
  tx: PrismaTx,
  input: RefundJournalInput,
): Promise<string | null> {
  try {
    const reference = `refund:${input.paymentId}:${input.cumulativeRefundAmount.toFixed(2)}`

    // Idempotenca — duplikat (retry) preskočimo
    const existing = await tx.journalEntry.findFirst({
      where: { reference, referenceType: 'refund' },
      select: { id: true },
    })
    if (existing) return existing.id

    // P1-accounting (DDV): neto reverza = vračilo − napitnina − DDV delež.
    // DDV reverza gre na DEBET konta 2600 (razveljavitev obveznosti do države).
    const tipPortion = Math.max(0, Math.min(input.tipPortion, input.refundAmount))
    const vatPortion = Math.max(0, Math.min(input.vatPortion || 0, input.refundAmount - tipPortion))
    const netRefund = Math.max(input.refundAmount - tipPortion - vatPortion, 0)

    const salesAccount = input.orderType === 'delivery'
      ? ACCOUNTS.SALES_DELIVERY
      : input.orderType === 'takeout'
      ? ACCOUNTS.SALES_TAKEOUT
      : ACCOUNTS.SALES_DINEIN
    const paymentAccount = input.paymentType === 'cash' ? ACCOUNTS.CASH : ACCOUNTS.BANK

    // FIX (deadlock, E2E debug 2026-09-09): resolveAccountCode kliči prek `tx`!
    // Prej je potekala prek GLOBALNEGA db klienta znotraj interaktivne
    // transakcije — na single-connection adapterjih (PGlite) DEADLOCK.
    const [resolvedSales, resolvedPayment, resolvedTips, resolvedVat] = await Promise.all([
      resolveAccountCode(salesAccount.code, tx),
      resolveAccountCode(paymentAccount.code, tx),
      tipPortion > 0 ? resolveAccountCode(ACCOUNTS.TIPS.code, tx) : Promise.resolve(null),
      vatPortion > 0 ? resolveAccountCode(ACCOUNTS.VAT_OUTPUT.code, tx) : Promise.resolve(null),
    ])

    const entry = await createEntryWithNumberRetry(tx, (entryNumber) =>
      tx.journalEntry.create({
        data: {
          entryNumber,
          date: new Date(),
          reference,
          referenceType: 'refund',
          description: `Reverza vračila #${input.orderNumber} — ${input.customerName || 'Gost'} (${input.paymentType})${input.reason ? `: ${input.reason}` : ''}`,
          source: 'auto-refund',
          status: 'posted',
          postedAt: new Date(),
          postedBy: input.employeeId || null,
          locationId: input.locationId || null,
          lines: {
            create: [
              // Debet: promet NETO (razveljavimo prihodek brez DDV)
              {
                accountCode: resolvedSales.accountCode,
                chartOfAccountCode: resolvedSales.chartOfAccountCode,
                accountName: resolvedSales.accountName,
                accountType: resolvedSales.accountType,
                debit: netRefund,
                credit: 0,
                description: `Reverza prometa ${input.orderType} (neto) — vračilo #${input.orderNumber}`,
                locationId: input.locationId || null,
              },
              // Debet: DDV izhodni (razveljavitev obveznosti do države)
              ...(vatPortion > 0 && resolvedVat ? [{
                accountCode: resolvedVat.accountCode,
                chartOfAccountCode: resolvedVat.chartOfAccountCode,
                accountName: resolvedVat.accountName,
                accountType: resolvedVat.accountType,
                debit: vatPortion,
                credit: 0,
                description: `Reverza DDV — vračilo #${input.orderNumber}`,
                locationId: input.locationId || null,
              }] : []),
              // Debet: napitnine (če je del vračila)
              ...(tipPortion > 0 && resolvedTips ? [{
                accountCode: resolvedTips.accountCode,
                chartOfAccountCode: resolvedTips.chartOfAccountCode,
                accountName: resolvedTips.accountName,
                accountType: resolvedTips.accountType,
                debit: tipPortion,
                credit: 0,
                description: `Reverza napitnine — vračilo #${input.orderNumber}`,
                locationId: input.locationId || null,
              }] : []),
              // Kredit: banka/blagajna (vrnimo denar)
              {
                accountCode: resolvedPayment.accountCode,
                chartOfAccountCode: resolvedPayment.chartOfAccountCode,
                accountName: resolvedPayment.accountName,
                accountType: resolvedPayment.accountType,
                debit: 0,
                credit: input.refundAmount,
                description: `Izplačilo vračila (${input.paymentType}) — vračilo #${input.orderNumber}`,
                locationId: input.locationId || null,
              },
            ],
          },
        },
        include: { lines: true },
      }),
    )

    return entry.id
  } catch (error) {
    // Napaka journal-a NE sme ponesreči refunda denarja — logiramo in
    // nadaljujemo (knjigovodska vrzel je vidna v reviziji; vračilo denarja
    // je poslovno kritičnejše). Vrna null — klicnik ve da JE ni nastal.
    logger.error('JOURNAL', 'Reverza vračila ni bila ustvarjena:', error)
    return null
  }
}

/**
 * P1-accounting (G11): Knjigovodska reverza ob STORNU računa.
 *
 * Prej: storno je označil plačila kot refunded in vrnil zalogo, a NI
 * ustvaril knjigovodske reverze — prihodek iz originalnega plačilnega
 * vnosa je ostal knjižen (napihnjen promet + napihnjen DDV).
 *
 * KLICATI ZNOTRAJ executeStornoTransaction ($transaction) — storno in
 * accounting reversal sta atomarna (isti vzorec kot refund).
 *
 * Double-entry reverza (zrcalna slika plačilnega vnosa):
 *   Debet:  promet NETO (subtotal − popust)
 *   Debet:  DDV izhodni (razveljavitev obveznosti)
 *   Debet:  napitnine (če > 0)
 *   Kredit: plačilna sredstva po vrsti (gotovina → 1010, ostalo → 1000)
 *
 * Idempotenca: reference = `storno:{orderId}` — duplikat preskoči create.
 */
export interface StornoJournalInput {
  orderId: string
  orderNumber: number | string
  orderType: string
  customerName: string
  /** Neto prihodek (subtotal − popust) */
  netRevenue: number
  /** DDV znesek originalnega računa */
  vatAmount: number
  /** Napitnina */
  tipAmount: number
  /** Zneski po plačilnem sredstvu — Kredit strani (cash → 1010, ostalo → 1000) */
  paymentSplits: Array<{ paymentType: string; amount: number }>
  locationId: string | null
  employeeId?: string | null
  reason?: string
}

export async function generateJournalForStorno(
  tx: PrismaTx,
  input: StornoJournalInput,
): Promise<string | null> {
  try {
    const reference = `storno:${input.orderId}`

    // Idempotenca — duplikat (retry) preskočimo
    const existing = await tx.journalEntry.findFirst({
      where: { reference, referenceType: 'storno' },
      select: { id: true },
    })
    if (existing) return existing.id

    const salesAccount = input.orderType === 'delivery'
      ? ACCOUNTS.SALES_DELIVERY
      : input.orderType === 'takeout'
      ? ACCOUNTS.SALES_TAKEOUT
      : ACCOUNTS.SALES_DINEIN

    // FIX (deadlock, E2E debug 2026-09-09): isti vzorec kot refund — prek `tx`
    const [resolvedSales, resolvedVat, resolvedTips] = await Promise.all([
      resolveAccountCode(salesAccount.code, tx),
      input.vatAmount > 0 ? resolveAccountCode(ACCOUNTS.VAT_OUTPUT.code, tx) : Promise.resolve(null),
      input.tipAmount > 0 ? resolveAccountCode(ACCOUNTS.TIPS.code, tx) : Promise.resolve(null),
    ])

    // Kredit strani: ena vrstica po plačilnem sredstvu (1010 za gotovino, 1000 ostalo)
    const creditLines: Array<{
      accountCode: string
      chartOfAccountCode: string | null
      accountName: string
      accountType: string
      debit: number
      credit: number
      description: string
      locationId: string | null
    }> = []
    for (const split of input.paymentSplits) {
      if (split.amount <= 0) continue
      const paymentAccount = split.paymentType === 'cash' ? ACCOUNTS.CASH : ACCOUNTS.BANK
      const resolvedPayment = await resolveAccountCode(paymentAccount.code, tx)
      creditLines.push({
        accountCode: resolvedPayment.accountCode,
        chartOfAccountCode: resolvedPayment.chartOfAccountCode,
        accountName: resolvedPayment.accountName,
        accountType: resolvedPayment.accountType,
        debit: 0,
        credit: split.amount,
        description: `Vračilo ${split.paymentType} ob stornu — naročilo #${input.orderNumber}`,
        locationId: input.locationId || null,
      })
    }

    // Vsaj ena kredit vrstica (fallback: če splits manjkajo, knjižimo na BANK)
    if (creditLines.length === 0) {
      const resolvedPayment = await resolveAccountCode(ACCOUNTS.BANK.code)
      const fallbackAmount = Math.max(0, input.netRevenue + input.vatAmount + input.tipAmount)
      creditLines.push({
        accountCode: resolvedPayment.accountCode,
        chartOfAccountCode: resolvedPayment.chartOfAccountCode,
        accountName: resolvedPayment.accountName,
        accountType: resolvedPayment.accountType,
        debit: 0,
        credit: fallbackAmount,
        description: `Vračilo ob stornu — naročilo #${input.orderNumber}`,
        locationId: input.locationId || null,
      })
    }

    const entry = await createEntryWithNumberRetry(tx, (entryNumber) =>
      tx.journalEntry.create({
        data: {
          entryNumber,
          date: new Date(),
          reference,
          referenceType: 'storno',
          description: `Storno reverza #${input.orderNumber} — ${input.customerName || 'Gost'}${input.reason ? `: ${input.reason}` : ''}`,
          source: 'auto-storno',
          status: 'posted',
          postedAt: new Date(),
          postedBy: input.employeeId || null,
          locationId: input.locationId || null,
          lines: {
            create: [
              // Debet: promet NETO (razveljavimo prihodek)
              {
                accountCode: resolvedSales.accountCode,
                chartOfAccountCode: resolvedSales.chartOfAccountCode,
                accountName: resolvedSales.accountName,
                accountType: resolvedSales.accountType,
                debit: input.netRevenue,
                credit: 0,
                description: `Storno prometa ${input.orderType} (neto) — naročilo #${input.orderNumber}`,
                locationId: input.locationId || null,
              },
              // Debet: DDV izhodni (razveljavitev obveznosti do države)
              ...(input.vatAmount > 0 && resolvedVat ? [{
                accountCode: resolvedVat.accountCode,
                chartOfAccountCode: resolvedVat.chartOfAccountCode,
                accountName: resolvedVat.accountName,
                accountType: resolvedVat.accountType,
                debit: input.vatAmount,
                credit: 0,
                description: `Storno DDV — naročilo #${input.orderNumber}`,
                locationId: input.locationId || null,
              }] : []),
              // Debet: napitnine (če > 0)
              ...(input.tipAmount > 0 && resolvedTips ? [{
                accountCode: resolvedTips.accountCode,
                chartOfAccountCode: resolvedTips.chartOfAccountCode,
                accountName: resolvedTips.accountName,
                accountType: resolvedTips.accountType,
                debit: input.tipAmount,
                credit: 0,
                description: `Storno napitnine — naročilo #${input.orderNumber}`,
                locationId: input.locationId || null,
              }] : []),
              // Kredit: plačilna sredstva (vračilo denarja)
              ...creditLines,
            ],
          },
        },
        include: { lines: true },
      }),
    )

    return entry.id
  } catch (error) {
    // Napaka journal-a NE sme ponesreči fiskalnega storna (račun je že
    // poslan na FURS) — logiramo in vrnemo null (vrzel vidna v reviziji).
    logger.error('JOURNAL', 'Storno reverza ni bila ustvarjena:', error)
    return null
  }
}

/** Trial Balance — seštevek debet/kredit po kontih za obdobje */
export async function generateTrialBalance(dateFrom?: Date, dateTo?: Date, locationId?: string) {
  const where: Record<string, unknown> = { status: 'posted' }
  if (dateFrom || dateTo) {
    const dateFilter: Record<string, Date> = {}
    if (dateFrom) dateFilter.gte = dateFrom
    if (dateTo) dateFilter.lte = dateTo
    where.date = dateFilter
  }
  // ISSUE #31: opcijsko filtriranje po lokaciji (multi-tenant accounting)
  if (locationId) where.locationId = locationId

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

export async function generateProfitLoss(dateFrom?: Date, dateTo?: Date, locationId?: string) {
  const where: Record<string, unknown> = { status: 'posted' }
  if (dateFrom || dateTo) {
    const dateFilter: Record<string, Date> = {}
    if (dateFrom) dateFilter.gte = dateFrom
    if (dateTo) dateFilter.lte = dateTo
    where.date = dateFilter
  }
  // ISSUE #31: opcijsko filtriranje po lokaciji (multi-tenant accounting)
  if (locationId) where.locationId = locationId

  const lines = await db.journalLine.findMany({
    where: { journalEntry: where },
    select: { accountCode: true, accountName: true, accountType: true, debit: true, credit: true },
  })

  // Razdeli po tipu konta
  type AccountEntry = { code: string; name: string; type: string; debit: number; credit: number; balance: number }
  const sections: {
    revenue: { accounts: AccountEntry[]; total: number }
    expense: { accounts: AccountEntry[]; total: number }
    cogs: { accounts: AccountEntry[]; total: number }
  } = {
    revenue: { accounts: [], total: 0 },
    expense: { accounts: [], total: 0 },
    cogs: { accounts: [], total: 0 },
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
    } else if (acc.type === 'cogs' || acc.type === 'cost_of_goods' || acc.code?.startsWith('5')) {
      sections.cogs.accounts.push(entry)
      sections.cogs.total += balance
    }
  }

  // FIX: Pridobi COGS iz StockTransaction (type='sale') če journal entries ne vsebujejo COGS
  // To je fallback — avtomatska razknjižba zaloge ob prodaji ustvari StockTransaction z
  // totalCost poljem, ampak ne ustvari vedno journal entry. Zato direktno agregiramo.
  if (sections.cogs.total === 0) {
    const stockWhere: Record<string, unknown> = { type: 'sale' }
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, Date> = {}
      if (dateFrom) dateFilter.gte = dateFrom
      if (dateTo) dateFilter.lte = dateTo
      stockWhere.createdAt = dateFilter
    }

    const cogsResult = await db.stockTransaction.aggregate({
      where: stockWhere,
      _sum: { totalCost: true },
      _count: true,
    })

    const cogsTotal = toNum(cogsResult._sum.totalCost)
    if (cogsTotal > 0) {
      sections.cogs.accounts.push({
        code: '5000',
        name: 'COGS — Stroški prodane robe',
        type: 'cogs',
        debit: cogsTotal,
        credit: 0,
        balance: cogsTotal,
      })
      sections.cogs.total = cogsTotal
    }
  }

  const totalExpenses = sections.expense.total + sections.cogs.total
  const netProfit = sections.revenue.total - totalExpenses

  return {
    period: { from: dateFrom?.toISOString() || null, to: dateTo?.toISOString() || null },
    revenue: sections.revenue,
    cogs: sections.cogs,
    expenses: sections.expense,
    totalExpenses,
    netProfit,
    margin: sections.revenue.total > 0 ? (netProfit / sections.revenue.total) * 100 : 0,
  }
}

// ============================================
// BALANCE SHEET — POSR/URY-style
// Aktiva = Obveze + Kapital
// ============================================

export async function generateBalanceSheet(dateTo?: Date, locationId?: string) {
  const where: Record<string, unknown> = { status: 'posted' }
  if (dateTo) {
    where.date = { lte: dateTo }
  }
  // ISSUE #31: opcijsko filtriranje po lokaciji (multi-tenant accounting)
  if (locationId) where.locationId = locationId

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

export async function generateGeneralLedger(dateFrom?: Date, dateTo?: Date, locationId?: string) {
  const where: Record<string, unknown> = { status: 'posted' }
  if (dateFrom || dateTo) {
    const dateFilter: Record<string, Date> = {}
    if (dateFrom) dateFilter.gte = dateFrom
    if (dateTo) dateFilter.lte = dateTo
    where.date = dateFilter
  }
  // ISSUE #31: opcijsko filtriranje po lokaciji (multi-tenant accounting)
  if (locationId) where.locationId = locationId

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
