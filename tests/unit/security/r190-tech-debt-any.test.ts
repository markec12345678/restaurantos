// ============================================
// R190 — TECH DEBT gate: no-explicit-any v finančni jedri
// (epik #144 §22 korak 23 — selective technical debt)
//
// Korak 23: "Address selective technical debt that directly affects
// operation, maintenance or evidence." Največji merljiv maintenance/evidence
// debt je bil 90 × `@typescript-eslint/no-explicit-any` supresij, skoncentri-
// ranih v finančni jedri (FURS verify/storno, Z-report stats, VAT poročila) —
// `any` na denarnih poteh skriva realne oblike podatkov (Prisma Decimal,
// nullability, include oblike) in onemogoča tsc dokaz tipovne pravilnosti.
//
// Ta test uveljavlja:
//   1. 7 fajlov fiskalne + fiskalno-poročevalske jedre je ČISTIH (0 ×
//      'no-explicit-any' supresija + 0 × ': any'/'as any' uporaba)
//   2. kanonski domenski tipi so pinani (Receipt/RestaurantSettings/
//      FursConfig/VerifyOrder/DecimalLike/Awaited<ReturnType<typeof requireAuth>>)
//   3. RATCHET: skupno število no-explicit-any supresij v src/ je ≤ 31
//      (90 pred R190 − 40 R190 − 19 R191; prvotni nivo 50 znižan R191) —
//      trajno samo-padajoča omejitev: nova runda lahko število zniža,
//      višanja CI ne pusti skozi (aktivni pin tudi v r191 testu)
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

// ─── Fajli fiskalne + fiskalno-poročevalske jedre (R190 slice) ───
const FINANCIAL_CORE_FILES = [
  'src/app/api/furs/helpers/verify-invoice/validate-and-submit.ts',
  'src/app/api/furs/helpers/verify-invoice/post-verify.ts',
  'src/app/api/furs/helpers/storno-invoice/validate-and-submit.ts',
  'src/app/api/furs/helpers/storno-invoice/storno-transaction.ts',
  'src/app/api/z-report/_helpers/stats.ts',
  'src/app/api/reports/vat/_helpers/vat-breakdown.ts',
  'src/app/api/reports/vat/_helpers/time-distribution.ts',
]

describe('R190: finančna jedra — nič any supresij (epik #144 §22 korak 23)', () => {
  for (const rel of FINANCIAL_CORE_FILES) {
    it(`${rel.replace('src/app/api/', '')} je čist (0 supresij, 0 ': any'/'as any')`, () => {
      const src = read(...(rel.split('/') as [string, ...string[]]))
      expect(src.match(/no-explicit-any/g) ?? []).toEqual([])
      expect(src.match(/:\s*any\b/g) ?? []).toEqual([])
      expect(src.match(/\bas any\b/g) ?? []).toEqual([])
    })
  }

  it('FURS verify: kanonski domenski tipi pinani (Receipt/RestaurantSettings/FursConfig/VerifyOrder)', () => {
    const submit = read('src', 'app', 'api', 'furs', 'helpers', 'verify-invoice', 'validate-and-submit.ts')
    expect(submit).toContain('export type VerifyOrder = Prisma.OrderGetPayload<{ include: { orderItems: { include: { menuItem: true } } } }>')
    expect(submit).toContain('export type VerifyAuthResult = Awaited<ReturnType<typeof requireAuth>>')
    expect(submit).toContain('receipt: Receipt')
    expect(submit).toContain('settings: RestaurantSettings')
    expect(submit).toContain('config: FursConfig')

    const post = read('src', 'app', 'api', 'furs', 'helpers', 'verify-invoice', 'post-verify.ts')
    expect(post).toContain('receipt: Receipt')
    expect(post).toContain('order: VerifyOrder')
    // BUG-08 kontrakt: catch pot lahko dobi null receipt
    expect(post).toContain('receipt: Receipt | null')
  })

  it('FURS storno: kanonski domenski tipi pinani (Receipt/FursConfig/StornoAuthResult)', () => {
    const submit = read('src', 'app', 'api', 'furs', 'helpers', 'storno-invoice', 'validate-and-submit.ts')
    expect(submit).toContain('export type StornoAuthResult = Awaited<ReturnType<typeof requireAuth>>')
    expect(submit).toContain('receipt: Receipt')
    expect(submit).toContain('settings: RestaurantSettings')
    expect(submit).toContain('config: FursConfig')

    const tx = read('src', 'app', 'api', 'furs', 'helpers', 'storno-invoice', 'storno-transaction.ts')
    expect(tx).toContain('originalReceipt: Receipt')
    expect(tx).toContain('stornoReceipt: Receipt')
    expect(tx).toContain('config: FursConfig')
  })

  it('Z-report stats: strukturni domenski tipi pinani (StatsPaidOrder/StatsStornoOrder/DecimalLike)', () => {
    const stats = read('src', 'app', 'api', 'z-report', '_helpers', 'stats.ts')
    expect(stats).toContain('paidOrders: StatsPaidOrder[]')
    expect(stats).toContain('allOrders: StatsStornoOrder[]')
    expect(stats).toContain('export interface StatsOrderItem')
    expect(stats).toContain('export interface StatsPaidOrder')
    expect(stats).toContain('export interface StatsStornoOrder')
    expect(stats).toContain('price: DecimalLike')
  })

  it('VAT poročila: DecimalLike domenski tip pinan (brez any za cene/stopnje)', () => {
    const breakdown = read('src', 'app', 'api', 'reports', 'vat', '_helpers', 'vat-breakdown.ts')
    expect(breakdown).toContain('price: DecimalLike')
    expect(breakdown).toContain('vatRate: DecimalLike')
    expect(breakdown).toContain('vatAmount: DecimalLike')
    expect(breakdown).toContain('discountAmount: DecimalLike')
    const time = read('src', 'app', 'api', 'reports', 'vat', '_helpers', 'time-distribution.ts')
    expect(time).toContain('price: DecimalLike')
    expect(time).toContain('vatRate: DecimalLike')
    expect(time).toContain('vatAmount: DecimalLike')
  })
})

describe('R190: RATCHET — no-explicit-any v src/ samo padajoč', () => {
  it('skupno število supresij ≤ 31 (90 pred R190 − 40 R190 − 19 R191; znižano R191)', () => {
    const count = countAnySuppressions()
    expect(count, 'nova any supresija v src/ — ratchet prepoveduje višanje (R191 nivo = 31; znižaj in posodobi pina v r190+r191 testih)').toBeLessThanOrEqual(31)
    expect(count).toBeGreaterThanOrEqual(0)
  })
})
