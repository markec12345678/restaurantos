// ============================================
// R191 — TECH DEBT gate: EOD wire tip + FURS/reporting API tipi
// (epik #144 P2 faza — nadaljevanje koraka 23 / ratchet znižanje)
//
// R190 je očistil finančno jedro (40 supresij). R191 nadaljuje z:
//   A. 10 EOD komponent (src/components/pos/cash-register/) — vse so imele
//      lokalni `type EodData = any` → kanonski WIRE tip EodReportData
//      (src/app/api/reports/eod/types.ts)
//   B. 6 API fajlov (FURS batch, Z-report build-report, dashboard
//      furs-shift-cogs, EOD data-fetch, receipts route-helpers) → realni
//      domenski tipi (Prisma modeli / DecimalLike / strukturni like-tipi)
//
// Ta test uveljavlja:
//   1. 16 fajlov slice-a je ČISTIH (0 × supresija + 0 × ': any'/'as any')
//   2. kanonski tipi so pinani (EodReportData + pod-tipi, BatchReceiptLike,
//      BatchSettingsLike, BatchReceipt payload, CashRegisterShift, DecimalLike)
//   3. route ↔ wire-tip pariteta: GET /api/reports/eod vrača VSE top-level
//      ključe EodReportData (drift ene strani pade na CI)
//   4. r166 združljivostni varovalka: strukturni like-tipi so OBVEZNI (polni
//      Prisma modeli bi podrl r166-batch-key testne literale — R190 lekcija)
//   5. RATCHET: no-explicit-any v src/ ≤ 31 (90 pred R190 − 40 R190 − 19 R191)
//      — trajno samo-padajoča omejitev: znižanje dobrodošlo, višanja CI ne
//      pusti skozi (aktivni ratchet; r190 test nosi usklajen pin)
// ============================================

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (...p: string[]): string => readFileSync(path.join(root, ...p), 'utf-8')

/** Poišči vse .ts/.tsx datoteke pod dir (rekurzivno). */
function walkTs(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walkTs(full))
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full)
  }
  return out
}

/** Števi 'no-explicit-any' supresije v vseh src fajlih. */
function countAnySuppressions(): number {
  const srcDir = path.join(root, 'src')
  let count = 0
  for (const file of walkTs(srcDir)) count += (readFileSync(file, 'utf-8').match(/no-explicit-any/g) ?? []).length
  return count
}

// ─── Slice fajli (R191) ───
const EOD_COMPONENT_FILES = [
  'src/components/pos/cash-register/EodDialog.tsx',
  'src/components/pos/cash-register/EodCloseForm.tsx',
  'src/components/pos/cash-register/EodPendingWarning.tsx',
  'src/components/pos/cash-register/EodSummaryStats.tsx',
  'src/components/pos/cash-register/EodVatBreakdown.tsx',
  'src/components/pos/cash-register/EodPaymentMethods.tsx',
  'src/components/pos/cash-register/EodCostAnalysis.tsx',
  'src/components/pos/cash-register/EodEmployeeBreakdown.tsx',
  'src/components/pos/cash-register/eod-summary-sections.tsx',
  'src/components/pos/cash-register/eod-close-section.tsx',
]

const EOD_API_FILES = [
  'src/app/api/furs/batch/_helpers.ts',
  'src/app/api/furs/batch/route.ts',
  'src/app/api/z-report/_helpers/build-report.ts',
  'src/app/api/dashboard/_helpers/furs-shift-cogs.ts',
  'src/app/api/reports/eod/_helpers/data-fetch.ts',
  'src/app/api/receipts/[id]/_route-helpers.ts',
]

describe('R191: slice fajli — nič any supresij (epik #144 P2, tech debt sweep)', () => {
  for (const rel of EOD_COMPONENT_FILES) {
    it(`${rel.replace('src/components/pos/cash-register/', '')} je čist (0 supresij, 0 ': any'/'as any')`, () => {
      const src = read(...(rel.split('/') as [string, ...string[]]))
      expect(src.match(/no-explicit-any/g) ?? []).toEqual([])
      expect(src.match(/:\s*any\b/g) ?? []).toEqual([])
      expect(src.match(/\bas any\b/g) ?? []).toEqual([])
    })
  }

  for (const rel of EOD_API_FILES) {
    it(`${rel.replace('src/app/api/', '')} je čist (0 supresij, 0 ': any'/'as any')`, () => {
      const src = read(...(rel.split('/') as [string, ...string[]]))
      expect(src.match(/no-explicit-any/g) ?? []).toEqual([])
      expect(src.match(/:\s*any\b/g) ?? []).toEqual([])
      expect(src.match(/\bas any\b/g) ?? []).toEqual([])
    })
  }
})

describe('R191: kanonski WIRE tip EodReportData (vir resnice za EOD komponente)', () => {
  const typesPath = ['src', 'app', 'api', 'reports', 'eod', 'types.ts'] as const

  it('types.ts izvoza EodReportData + vse pod-tipe', () => {
    const src = read(...typesPath)
    expect(src).toContain('export interface EodReportData')
    expect(src).toContain('export interface EodSummaryData')
    expect(src).toContain('export interface EodVatRow')
    expect(src).toContain('export interface EodPaymentMethodRow')
    expect(src).toContain('export interface EodEmployeeRow')
    expect(src).toContain('export interface EodHourlyRow')
    expect(src).toContain('export interface EodCategoryRow')
    expect(src).toContain('export interface EodVoidedItemRow')
    expect(src).toContain('export interface EodCostsData')
    expect(src).toContain('export interface EodActiveShiftData')
  })

  it('EodReportData top-level oblika pinana (route odziv, wire format)', () => {
    const src = read(...typesPath)
    expect(src).toContain('summary: EodSummaryData')
    expect(src).toContain('vatBreakdown: EodVatRow[]')
    expect(src).toContain('paymentMethods: EodPaymentMethodRow[]')
    expect(src).toContain('employeeBreakdown: EodEmployeeRow[]')
    expect(src).toContain('hourlyBreakdown: EodHourlyRow[]')
    expect(src).toContain('categoryBreakdown: EodCategoryRow[]')
    expect(src).toContain('costs: EodCostsData')
    expect(src).toContain('voidedItems: EodVoidedItemRow[]')
    expect(src).toContain('activeShift: EodActiveShiftData | null')
    expect(src).toContain('isDayClosed: boolean')
  })

  it('wire semantika: denarna polja number (deepToNumbers), Date polja string', () => {
    const src = read(...typesPath)
    // summary — vse številsko (Decimal prek deepToNumbers → number)
    expect(src).toContain('totalRevenue: number')
    expect(src).toContain('avgOrderValue: number')
    expect(src).toContain('cancelledRevenue: number')
    // activeShift — Decimal → number, DateTime → string
    expect(src).toContain('startingCash: number')
    expect(src).toContain('openedAt: string')
    expect(src).toContain('closedAt: string | null')
    // employeeBreakdown — enrichEmployeeNames vrača array z neobveznim imenom
    expect(src).toContain('employeeName?: string')
  })

  it('vseh 10 EOD komponent uvaža EodReportData (lokalni alias odstranjen)', () => {
    for (const rel of EOD_COMPONENT_FILES) {
      const src = read(...(rel.split('/') as [string, ...string[]]))
      expect(
        src.includes("import type { EodReportData } from '@/app/api/reports/eod/types'"),
        `${rel} mora uvažati kanonski EodReportData`,
      ).toBe(true)
    }
  })

  it('EodDialog: eodData je union z null/undefined (useQuery), otroci čisti EodReportData', () => {
    const dialog = read('src', 'components', 'pos', 'cash-register', 'EodDialog.tsx')
    expect(dialog).toContain('eodData: EodReportData | null | undefined')
    // otroci (listani v dialogu) imajo negboxljiv eodData: EodReportData
    for (const child of ['EodCloseForm.tsx', 'EodPendingWarning.tsx', 'EodSummaryStats.tsx', 'EodVatBreakdown.tsx', 'EodPaymentMethods.tsx', 'EodCostAnalysis.tsx', 'EodEmployeeBreakdown.tsx', 'eod-summary-sections.tsx', 'eod-close-section.tsx']) {
      expect(
        read('src', 'components', 'pos', 'cash-register', child).includes('eodData: EodReportData\n'),
        `${child} mora imeti ne-null eodData: EodReportData`,
      ).toBe(true)
    }
  })

  it('route ↔ wire-tip pariteta: GET /api/reports/eod vrača vse top-level ključe', () => {
    const route = read('src', 'app', 'api', 'reports', 'eod', 'route.ts')
    const keys = [
      'date', 'summary', 'vatBreakdown', 'paymentMethods', 'categoryBreakdown',
      'employeeBreakdown', 'hourlyBreakdown', 'costs', 'voidedItems',
      'activeShift', 'isDayClosed',
    ]
    for (const k of keys) {
      expect(
        new RegExp(`\\b${k}\\b\\s*[:,]`).test(route),
        `route mora vračati ključ "${k}" (pariteta z EodReportData)`,
      ).toBe(true)
    }
  })
})

describe('R191: API domenski tipi (FURS batch / Z-report / dashboard / receipts)', () => {
  it('FURS batch: strukturni like-tipi + payload tip pinani', () => {
    const helpers = read('src', 'app', 'api', 'furs', 'batch', '_helpers.ts')
    expect(helpers).toContain('export interface BatchReceiptLike')
    expect(helpers).toContain('export interface BatchSettingsLike')
    expect(helpers).toContain('total: DecimalLike')
    expect(helpers).toContain('receipt: BatchReceiptLike')
    expect(helpers).toContain('settings: BatchSettingsLike')
    expect(helpers).toContain('export type BatchReceipt = Prisma.ReceiptGetPayload<{ include: { order: { select: { locationId: true } } } }>')

    const route = read('src', 'app', 'api', 'furs', 'batch', 'route.ts')
    expect(route).toContain('const unverifiedReceipts: BatchReceipt[]')
    // prej: cast prek supresije — zdaj neposreden dostop
    expect(route).toContain('receipt.order?.locationId ?? null')
  })

  it('r166 združljivostni varovalka: minimalni testni literali so razlog za like-tipe', () => {
    // R190 lekcija: polni Prisma modeli bi podrl r166 testne literale
    // (SETTINGS = { taxId, registerNumber }). Če kdo zategne like-tipe na
    // polne modele, r166 pade na tsc — ta pin dokumentira ZAKAJ.
    const r166 = read('tests', 'unit', 'furs', 'r166-batch-key.test.ts')
    expect(r166).toContain('const SETTINGS = { taxId: \'SI12345678\', registerNumber: \'BLG-001\' }')
    expect(r166).toContain('processBatchReceipt(RECEIPT, SETTINGS, CONFIG, key)')
  })

  it('Z-report build-report: CashRegisterShift[] (Prisma model) pinan', () => {
    const src = read('src', 'app', 'api', 'z-report', '_helpers', 'build-report.ts')
    expect(src).toContain('cashShifts: CashRegisterShift[]')
  })

  it('dashboard furs-shift-cogs: CashRegisterShift | null + DecimalLike pinana', () => {
    const src = read('src', 'app', 'api', 'dashboard', '_helpers', 'furs-shift-cogs.ts')
    expect(src).toContain('let activeShift: CashRegisterShift | null = null')
    expect(src).toContain('let stockMovements: Array<{ totalCost: DecimalLike }> = []')
  })

  it('EOD data-fetch: PaymentGroup._count je number (groupBy števec)', () => {
    const src = read('src', 'app', 'api', 'reports', 'eod', '_helpers', 'data-fetch.ts')
    expect(src).toContain('_count: number')
    expect(src.match(/_count:\s*any/g) ?? []).toEqual([])
  })

  it('receipts route-helpers: discount/tip DecimalLike (toNum kontrakt)', () => {
    const src = read('src', 'app', 'api', 'receipts', '[id]', '_route-helpers.ts')
    expect(src).toContain('discount: DecimalLike')
    expect(src).toContain('tip: DecimalLike')
  })
})

describe('R191: RATCHET — no-explicit-any v src/ samo padajoč', () => {
  it('skupno število supresij ≤ 31 (90 pred R190 − 40 R190 − 19 R191)', () => {
    const count = countAnySuppressions()
    expect(count, 'nova any supresija v src/ — ratchet prepoveduje višanje (R191 nivo = 31; znižaj in posodobi pina v r190+r191 testih)').toBeLessThanOrEqual(31)
    expect(count).toBeGreaterThanOrEqual(0)
  })
})
