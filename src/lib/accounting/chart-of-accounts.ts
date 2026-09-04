// ============================================
// CHART OF ACCOUNTS — Helper za validacijo + lookup
//
// ISSUE #38: prej je bil JournalLine.accountCode prosto-besedilen String —
// koda je lahko bila "7000" ali "FOO" ali karkoli. Sedaj imamo FK na ChartOfAccount,
// ampak backward-compat dovoljuje prosto-besedilne kode (chartOfAccountCode je nullable).
//
// Ta modul ponuja:
//   - validateAccountCode(code) — preveri ali koda obstaja v ChartOfAccount
//   - lookupAccount(code) — vrne ChartOfAccount z denormaliziranimi polji (name, type)
//   - resolveAccountCode(code) — validira + vrne pripravljen accountCode + chartOfAccountCode
//
// Uporaba v generateJournalForPayment ipd.:
//   const { accountCode, chartOfAccountCode, accountName, accountType } =
//     await resolveAccountCode('7000')
// ============================================

import { db } from '@/lib/db'

export interface ResolvedAccount {
  /** Originalna koda (lahko fallback v prosto-besedilo) */
  accountCode: string
  /** FK na ChartOfAccount.code — null če koda ne obstaja (legacy) */
  chartOfAccountCode: string | null
  /** Ime konta (iz ChartOfAccount če obstaja) */
  accountName: string
  /** Tip konta (asset/liability/equity/revenue/expense) — iz ChartOfAccount */
  accountType: string
  /** Ali je bila koda najdena v ChartOfAccount */
  isValid: boolean
}

/**
 * Preveri ali accountCode obstaja v ChartOfAccount.
 */
export async function validateAccountCode(code: string): Promise<boolean> {
  const account = await db.chartOfAccount.findUnique({
    where: { code },
    select: { code: true },
  })
  return account !== null
}

/**
 * Lookup ChartOfAccount z denormaliziranimi polji.
 *
 * @returns null če koda ne obstaja
 */
export async function lookupAccount(code: string): Promise<{
  code: string
  name: string
  accountType: string
  isActive: boolean
} | null> {
  const account = await db.chartOfAccount.findUnique({
    where: { code },
    select: { code: true, name: true, accountType: true, isActive: true },
  })
  return account
}

/**
 * Resolve accountCode — validira + vrne pripravljena polja za JournalLine.
 *
 * Če koda obstaja v ChartOfAccount:
 *   - chartOfAccountCode = code (FK vzpostavljen)
 *   - accountName + accountType iz ChartOfAccount
 *
 * Če koda NE obstaja:
 *   - chartOfAccountCode = null (FK ni vzpostavljen — backward compat)
 *   - accountName = code (placeholder)
 *   - accountType = 'unknown'
 *   - isValid = false (warning za admin)
 */
export async function resolveAccountCode(code: string): Promise<ResolvedAccount> {
  const account = await lookupAccount(code)

  if (account) {
    return {
      accountCode: account.code,
      chartOfAccountCode: account.code,
      accountName: account.name,
      accountType: account.accountType,
      isValid: true,
    }
  }

  // Legacy mode — koda ne obstaja v ChartOfAccount
  // Ohranimo podatke da ne prelomimo obstoječih zapisov
  return {
    accountCode: code,
    chartOfAccountCode: null,
    accountName: code, // placeholder — admin naj doda v ChartOfAccount
    accountType: 'unknown',
    isValid: false,
  }
}

/**
 * Bulk validacija za več kod hkrati (npr. pri batch importu).
 */
export async function validateAccountCodes(codes: string[]): Promise<{
  valid: string[]
  invalid: string[]
}> {
  if (codes.length === 0) return { valid: [], invalid: [] }

  const uniqueCodes = [...new Set(codes)]
  const accounts = await db.chartOfAccount.findMany({
    where: { code: { in: uniqueCodes } },
    select: { code: true },
  })

  const validSet = new Set(accounts.map((a) => a.code))
  return {
    valid: uniqueCodes.filter((c) => validSet.has(c)),
    invalid: uniqueCodes.filter((c) => !validSet.has(c)),
  }
}
