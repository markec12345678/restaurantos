// ============================================
// Z-POROČILO TISKALNI MODEL (runda 74)
// ============================================
// Čista knjižnica: pretvori ZReportData (API odgovor / GET /api/z-report)
// v struktuiran tiskalni model za fiskalno oblikovan dokument
// (zreport/ZPrintDocument.tsx → .print-area → window.print()).
//
// Vzorec R71–R73: čista lib + testi, fail-safe vhodi, deljeno
// oblikovanje z lib/safe-format (ročna SL številka — NE toLocaleString,
// small-ICU past), datumi brez Intl (R71/72 lekcija — range-check!).
//
// Pomembno (fiskalni kontekst): tiskani Z-poročilo NI uradni fiskalni
// dokument (FURS/FINA fiskalizacija poteka prek računov) — footer
// nosi disklejmer. Model je namenjen notranji uporabi / knjigovodstvu.

import { formatEUR, formatNumberSl } from '@/lib/safe-format'

// ─── Vhodni tip ─────────────────────────────────────────────────
// Strukturni podnabor ZReportData (components/pos/zreport/constants) —
// vse polje opcijsko-tolerantno (fail-safe: manjkajoče/NaN → 0).

export interface ZReportPrintInput {
  reportDate?: string | null
  openedAt?: string | null
  closedAt?: string | null
  status?: string | null
  totalSales?: number | null
  totalNetSales?: number | null
  totalTax?: number | null
  totalOrders?: number | null
  totalGuests?: number | null
  avgOrderValue?: number | null
  cashSales?: number | null
  cardSales?: number | null
  mobileSales?: number | null
  alternateSales?: number | null
  dineInSales?: number | null
  takeoutSales?: number | null
  deliverySales?: number | null
  vatStandard?: number | null
  vatStandardAmount?: number | null
  vatReduced?: number | null
  vatReducedAmount?: number | null
  vatZero?: number | null
  startingCash?: number | null
  expectedCash?: number | null
  actualCash?: number | null
  cashDifference?: number | null
  totalDiscounts?: number | null
  totalTips?: number | null
  totalVoided?: number | null
  totalStorno?: number | null
  totalCost?: number | null
  grossProfit?: number | null
  grossMargin?: number | null
  notes?: string | null
}

// ─── Izhodni tipi ───────────────────────────────────────────────

export interface ZPrintMetaRow {
  label: string
  value: string
}

export interface ZPrintAmountRow {
  label: string
  amount: string
  sharePct: number | null // % od totalSales — null ko ni osnove
  tone: 'default' | 'muted'
}

export interface ZPrintVatRow {
  label: string
  base: string
  amount: string
}

export interface ZPrintCashRow {
  label: string
  amount: string
  tone: 'default' | 'ok' | 'bad'
}

export interface ZPrintModel {
  statusLabel: 'OSNUTEK' | 'ZAKLJUČENO'
  statusTone: 'draft' | 'finalized'
  dateLabel: string // "19. september 2026"
  metaRows: ZPrintMetaRow[] // odprto / zaprto / generirano
  summaryRows: ZPrintMetaRow[] // promet, neto, DDV, računi, povp., gostje
  vatRows: ZPrintVatRow[] // samo stopnje z osnovo > 0
  paymentRows: ZPrintAmountRow[] // samo ne-ničelne metode + delež %
  channelRows: ZPrintAmountRow[] // samo ne-ničelni kanali + delež %
  cashRows: ZPrintCashRow[] // začetno / pričakovano / ugotovljeno / razlika
  cashDifference: { value: string; kind: 'even' | 'surplus' | 'missing' } | null
  extraRows: ZPrintMetaRow[] // popusti / napitnine / storno — samo ne-ničelne
  profitRow: ZPrintMetaRow | null // bruto dobiček + marža — samo ko osnova > 0
  notes: string | null
  footer: string
}

// ─── Notranji pomožniki (fail-safe, vzorec computeTrendComparison R73) ──

function num(v: unknown): number {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : 0
}

function eur(v: unknown): string {
  return formatEUR(num(v))
}

// Deljež % — zaokroži na 1 decimalko, null ko osnova ≤ 0 (brez goljufanja)
function sharePct(part: unknown, base: unknown): number | null {
  const b = num(base)
  if (b <= 0) return null
  const p = num(part)
  if (p <= 0) return 0
  return Math.round((p / b) * 1000) / 10
}

const SL_MONTHS = [
  'januar', 'februar', 'marec', 'april', 'maj', 'junij',
  'julij', 'avgust', 'september', 'oktober', 'november', 'december',
] as const

/**
 * "2026-09-19T..." → "19. september 2026" — BREZ Intl (R71 lekcija:
 * small-ICU + toLocaleString pasti), z OBSEG-validacijo (R72 lekcija:
 * Date.UTC tiho normalizira '2026-02-30' → parsing poteka po delih
 * STRINGA, ne prek Date konstrukcije — neprestopno po definiciji).
 */
export function slFullDateLabel(iso: string | null | undefined): string {
  if (!iso || typeof iso !== 'string') return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return '—'
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (month < 1 || month > 12) return '—'
  const maxDay = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
  if (day < 1 || day > maxDay) return '—'
  return `${day}. ${SL_MONTHS[month - 1]} ${year}`
}

/** "2026-09-19T18:40:15.000Z" → "19. 09. 2026 18:40" (string parsing, neprestopno) */
export function slShortDateTime(iso: string | null | undefined): string {
  if (!iso || typeof iso !== 'string') return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso)
  if (!m) return '—'
  return `${m[3]}. ${m[2]}. ${m[1]} ${m[4]}:${m[5]}`
}

// ─── Glavna funkcija ────────────────────────────────────────────

export function buildZPrintModel(report: ZReportPrintInput | null | undefined): ZPrintModel {
  if (!report || typeof report !== 'object') {
    // Fail-safe: klicatelj nima poročila → prazen OSNUTEK model (nikoli crash)
    report = {}
  }
  const r: ZReportPrintInput = report

  const finalized = r.status === 'finalized'
  const totalSales = num(r.totalSales)

  // Meta vrstice: odprto/zaprto blagajniško obdobje
  const metaRows: ZPrintMetaRow[] = []
  const opened = slShortDateTime(r.openedAt)
  if (opened !== '—') metaRows.push({ label: 'Odprto', value: opened })
  const closed = slShortDateTime(r.closedAt)
  metaRows.push({ label: 'Zaprto', value: closed !== '—' ? closed : 'ni še zaključeno' })

  // Povzetek dneva
  const summaryRows: ZPrintMetaRow[] = [
    { label: 'Promet (z DDV)', value: eur(totalSales) },
    { label: 'Neto promet', value: eur(r.totalNetSales) },
    { label: 'DDV skupaj', value: eur(r.totalTax) },
    { label: 'Št. računov', value: formatNumberSl(num(r.totalOrders), 0) },
    { label: 'Povprečni račun', value: eur(r.avgOrderValue) },
  ]
  const guests = num(r.totalGuests)
  if (guests > 0) summaryRows.push({ label: 'Gostje', value: formatNumberSl(guests, 0) })

  // DDV po stopnjah — samo vrstice z osnovo > 0 (prazne stopnje zmedejo)
  const vatRows: ZPrintVatRow[] = []
  if (num(r.vatStandard) > 0) {
    vatRows.push({ label: 'Obvezna stopnja', base: eur(r.vatStandard), amount: eur(r.vatStandardAmount) })
  }
  if (num(r.vatReduced) > 0) {
    vatRows.push({ label: 'Zmanjšana stopnja', base: eur(r.vatReduced), amount: eur(r.vatReducedAmount) })
  }
  if (num(r.vatZero) > 0) {
    vatRows.push({ label: 'Ničelna stopnja', base: eur(r.vatZero), amount: eur(0) })
  }

  // Metode plačila — samo ne-ničelne, z deležem prometa
  const paymentRows: ZPrintAmountRow[] = []
  const payments: Array<[string, number | null | undefined]> = [
    ['Gotovina', r.cashSales],
    ['Kartica', r.cardSales],
    ['Mobilno', r.mobileSales],
    ['Drugo', r.alternateSales],
  ]
  for (const [label, raw] of payments) {
    const v = num(raw)
    if (v === 0) continue
    paymentRows.push({
      label,
      amount: eur(v),
      sharePct: sharePct(v, totalSales),
      tone: 'default',
    })
  }

  // Prodajni kanali — ista logika
  const channelRows: ZPrintAmountRow[] = []
  const channels: Array<[string, number | null | undefined]> = [
    ['V lokalu', r.dineInSales],
    ['Seznami', r.takeoutSales],
    ['Dostava', r.deliverySales],
  ]
  for (const [label, raw] of channels) {
    const v = num(raw)
    if (v === 0) continue
    channelRows.push({ label, amount: eur(v), sharePct: sharePct(v, totalSales), tone: 'muted' })
  }

  // Blagajna — reconciliacija
  const cashRows: ZPrintCashRow[] = [
    { label: 'Začetno stanje', amount: eur(r.startingCash), tone: 'default' },
    { label: 'Pričakovano', amount: eur(r.expectedCash), tone: 'default' },
  ]
  if (r.actualCash != null) cashRows.push({ label: 'Ugotovljeno', amount: eur(r.actualCash), tone: 'default' })

  // Razlika: |delta| < 0,005 € → even (zaokrožitveni šum, brez znaka), sicer surplus/missing
  const diff = num(r.cashDifference)
  const isEven = Math.abs(diff) < 0.005
  const cashDifference =
    r.actualCash == null && r.expectedCash == null
      ? null
      : {
          value: `${diff > 0 && !isEven ? '+' : ''}${formatNumberSl(diff)}`,
          kind: (isEven ? 'even' : diff > 0 ? 'surplus' : 'missing') as 'even' | 'surplus' | 'missing',
        }

  // Dodatki — samo ne-ničelne (prazne vrstice zmedejo na papirju)
  const extraRows: ZPrintMetaRow[] = []
  if (num(r.totalDiscounts) > 0) extraRows.push({ label: 'Popusti', value: `−${eur(r.totalDiscounts)}` })
  if (num(r.totalTips) > 0) extraRows.push({ label: 'Napitnine', value: eur(r.totalTips) })
  const cancellations = num(r.totalStorno) + num(r.totalVoided)
  if (cancellations > 0) extraRows.push({ label: 'Preklici / storno', value: eur(cancellations) })

  // Bruto dobiček — samo ko ima smisel (osnova > 0)
  const grossProfit = num(r.grossProfit)
  const grossMargin = num(r.grossMargin)
  const profitRow =
    num(r.totalNetSales) > 0 && (grossProfit !== 0 || grossMargin !== 0)
      ? { label: 'Bruto dobiček', value: `${eur(grossProfit)} (${formatNumberSl(grossMargin, 1)} % marže)` }
      : null

  // Opombe — samo če res obstajajo
  const notes =
    typeof r.notes === 'string' && r.notes.trim() !== '' ? r.notes.trim() : null

  return {
    statusLabel: finalized ? 'ZAKLJUČENO' : 'OSNUTEK',
    statusTone: finalized ? 'finalized' : 'draft',
    dateLabel: slFullDateLabel(r.reportDate),
    metaRows,
    summaryRows,
    vatRows,
    paymentRows,
    channelRows,
    cashRows,
    cashDifference,
    extraRows,
    profitRow,
    notes,
    footer: 'Ni vir uradnega fiskalnega dokumenta (FURS/FINA) — namenjeno notranji uporabi.',
  }
}
