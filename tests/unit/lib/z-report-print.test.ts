import { describe, expect, it } from 'vitest'
import { buildZPrintModel, slFullDateLabel, slShortDateTime } from '@/lib/z-report-print'

// R74: Z-poročilo tiskalni model. Lib je ČIST (vzorec R71–R73:
// computeTrendComparison / computeDigestTrend) — testi pokrivajo
// sekcije, deleže %, DDV vrstice samo z osnovo, reconciliacijo
// blagajne (razlika kind), fail-safe vhode in slovenske datume.

// Polno poročilo — realističen zaključen dan
const FULL = {
  reportDate: '2026-09-18T00:00:00.000Z',
  openedAt: '2026-09-18T06:30:00.000Z',
  closedAt: '2026-09-18T23:15:00.000Z',
  status: 'finalized',
  totalSales: 1000,
  totalNetSales: 819.67,
  totalTax: 180.33,
  totalOrders: 40,
  totalGuests: 95,
  avgOrderValue: 25,
  cashSales: 600,
  cardSales: 350,
  mobileSales: 50,
  alternateSales: 0,
  dineInSales: 800,
  takeoutSales: 150,
  deliverySales: 50,
  vatStandard: 700,
  vatStandardAmount: 154,
  vatReduced: 119.67,
  vatReducedAmount: 26.33,
  vatZero: 0,
  startingCash: 100,
  expectedCash: 700,
  actualCash: 697.5,
  cashDifference: -2.5,
  totalDiscounts: 30,
  totalTips: 25,
  totalStorno: 10,
  totalVoided: 5,
  totalCost: 400,
  grossProfit: 419.67,
  grossMargin: 51.2,
  notes: '  Testne opombe za zaključek.  ',
}

describe('slFullDateLabel', () => {
  it('slovenski polni datum brez Intl', () => {
    expect(slFullDateLabel('2026-09-18T00:00:00.000Z')).toBe('18. september 2026')
    expect(slFullDateLabel('2026-01-01')).toBe('1. januar 2026')
    expect(slFullDateLabel('2026-12-31T23:59:59Z')).toBe('31. december 2026')
  })

  it('fail-safe: prazno/neveljavno/izven obsega → črtica (R72 lekcija: brez Date.UTC normalizacije)', () => {
    expect(slFullDateLabel(null)).toBe('—')
    expect(slFullDateLabel('')).toBe('—')
    expect(slFullDateLabel('ni-datum')).toBe('—')
    // '2026-02-30' NE sme postati marec (Date.UTC bi utišal normaliziral!)
    expect(slFullDateLabel('2026-02-30')).toBe('—')
    expect(slFullDateLabel('2026-13-01')).toBe('—')
    expect(slFullDateLabel('2026-00-10')).toBe('—')
  })
})

describe('slShortDateTime', () => {
  it('krajsi datum+čas iz ISO stringa', () => {
    expect(slShortDateTime('2026-09-18T06:30:00.000Z')).toBe('18. 09. 2026 06:30')
  })

  it('fail-safe → črtica', () => {
    expect(slShortDateTime(null)).toBe('—')
    expect(slShortDateTime('ni-čas')).toBe('—')
    expect(slShortDateTime('2026-09-18')) // brez T dela → črtica
    expect(slShortDateTime('2026-09-18')).toBe('—')
  })
})

describe('buildZPrintModel — osnovne sekcije', () => {
  it('polno poročilo: status, datum, meta in povzetek', () => {
    const m = buildZPrintModel(FULL)
    expect(m.statusLabel).toBe('ZAKLJUČENO')
    expect(m.statusTone).toBe('finalized')
    expect(m.dateLabel).toBe('18. september 2026')
    // meta: odprto + zaprto (obstajata)
    expect(m.metaRows).toHaveLength(2)
    expect(m.metaRows[0]).toEqual({ label: 'Odprto', value: '18. 09. 2026 06:30' })
    // povzetek: promet, neto, DDV, računi, povp., gostje
    expect(m.summaryRows.map(r => r.label)).toEqual([
      'Promet (z DDV)', 'Neto promet', 'DDV skupaj', 'Št. računov', 'Povprečni račun', 'Gostje',
    ])
    expect(m.summaryRows[0].value).toBe('1.000,00 €')
    expect(m.summaryRows[3].value).toBe('40')
  })

  it('draft status → OSNUTEK žig', () => {
    const m = buildZPrintModel({ ...FULL, status: 'draft' })
    expect(m.statusLabel).toBe('OSNUTEK')
    expect(m.statusTone).toBe('draft')
  })
})

describe('buildZPrintModel — DDV vrstice', () => {
  it('samo stopnje z osnovo > 0 (prazne zmedejo na papirju)', () => {
    const m = buildZPrintModel(FULL)
    expect(m.vatRows).toHaveLength(2) // ničelna izpuščena
    expect(m.vatRows[0]).toEqual({ label: 'Obvezna stopnja', base: '700,00 €', amount: '154,00 €' })
    expect(m.vatRows[1].label).toBe('Zmanjšana stopnja')
  })

  it('ničelna stopnja se pojavi šele ko ima osnovo (brez DDV zneska)', () => {
    const m = buildZPrintModel({ ...FULL, vatZero: 42 })
    const zero = m.vatRows.find(r => r.label === 'Ničelna stopnja')
    expect(zero).toEqual({ label: 'Ničelna stopnja', base: '42,00 €', amount: '0,00 €' })
  })
})

describe('buildZPrintModel — metode in kanali (deleži %)', () => {
  it('ne-ničelne metode z deležem, ničelne izpuščene', () => {
    const m = buildZPrintModel(FULL)
    expect(m.paymentRows.map(r => r.label)).toEqual(['Gotovina', 'Kartica', 'Mobilno'])
    expect(m.paymentRows[0].amount).toBe('600,00 €')
    expect(m.paymentRows[0].sharePct).toBe(60) // 600/1000
    expect(m.paymentRows[1].sharePct).toBe(35)
    expect(m.paymentRows[2].sharePct).toBe(5)
  })

  it('delež zaokrožen na 1 decimalko', () => {
    const m = buildZPrintModel({ ...FULL, cashSales: 333, totalSales: 999 })
    expect(m.paymentRows[0].sharePct).toBe(33.3)
  })

  it('kanali: samo ne-ničelni', () => {
    const m = buildZPrintModel(FULL)
    expect(m.channelRows.map(r => r.label)).toEqual(['V lokalu', 'Seznami', 'Dostava'])
    expect(m.channelRows[0].sharePct).toBe(80)
  })
})

describe('buildZPrintModel — blagajna (reconciliacija)', () => {
  it('razlika: manjkajoč denar → rose (missing) z znakom', () => {
    const m = buildZPrintModel(FULL)
    expect(m.cashDifference).toEqual({ value: '-2,50', kind: 'missing' })
    expect(m.cashRows.map(r => r.label)).toEqual(['Začetno stanje', 'Pričakovano', 'Ugotovljeno'])
  })

  it('razlika: višek → surplus z +', () => {
    const m = buildZPrintModel({ ...FULL, cashDifference: 5 })
    expect(m.cashDifference).toEqual({ value: '+5,00', kind: 'surplus' })
  })

  it('razlika: zaokrožitveni šum → uravnoteženo', () => {
    const m = buildZPrintModel({ ...FULL, cashDifference: 0.003 })
    expect(m.cashDifference).toEqual({ value: '0,00', kind: 'even' })
  })

  it('brez blagajniških podatkov → razlika null', () => {
    const m = buildZPrintModel({ status: 'draft', actualCash: null, expectedCash: null, cashDifference: null })
    expect(m.cashDifference).toBeNull()
  })
})

describe('buildZPrintModel — dodatki, dobiček, opombe', () => {
  it('ne-ničelni dodatki: popusti z −, storno+voided seštejeta', () => {
    const m = buildZPrintModel(FULL)
    expect(m.extraRows.map(r => r.label)).toEqual(['Popusti', 'Napitnine', 'Preklici / storno'])
    expect(m.extraRows[0].value).toBe('−30,00 €')
    expect(m.extraRows[2].value).toBe('15,00 €')
  })

  it('dobiček vrstica z maržo samo ko ima osnovo', () => {
    const m = buildZPrintModel(FULL)
    expect(m.profitRow).toEqual({ label: 'Bruto dobiček', value: '419,67 € (51,2 % marže)' })
  })

  it('brez dobička (neto 0) → profitRow null', () => {
    const m = buildZPrintModel({ ...FULL, totalNetSales: 0, grossProfit: 0, grossMargin: 0 })
    expect(m.profitRow).toBeNull()
  })

  it('opombe obrezane; prazne → null', () => {
    expect(buildZPrintModel(FULL).notes).toBe('Testne opombe za zaključek.')
    expect(buildZPrintModel({ ...FULL, notes: '   ' }).notes).toBeNull()
    expect(buildZPrintModel({ ...FULL, notes: null }).notes).toBeNull()
  })

  it('vse dodatki na 0 → extraRows prazen', () => {
    const m = buildZPrintModel({ ...FULL, totalDiscounts: 0, totalTips: 0, totalStorno: 0, totalVoided: 0 })
    expect(m.extraRows).toHaveLength(0)
  })
})

describe('buildZPrintModel — fail-safe (vzorec R73)', () => {
  it('null/undefined → prazen OSNUTEK model, nikoli crash', () => {
    for (const input of [null, undefined]) {
      const m = buildZPrintModel(input)
      expect(m.statusLabel).toBe('OSNUTEK')
      expect(m.dateLabel).toBe('—')
      expect(m.summaryRows[0].value).toBe('0,00 €')
      expect(m.paymentRows).toHaveLength(0)
      expect(m.vatRows).toHaveLength(0)
    }
  })

  it('NaN/Infinity/negativni vhodi → 0 ali vidna anomalija, brez crasha', () => {
    const m = buildZPrintModel({
      status: 'finalized',
      totalSales: NaN,
      totalTax: Infinity,
      totalOrders: -5,
      cashSales: -5, // negativna anomalija ostane vidna, ampak brez deljenja z 0
    })
    expect(m.summaryRows[0].value).toBe('0,00 €')
    expect(m.summaryRows[2].value).toBe('0,00 €')
    // nemogoče št. računov ostane VIDEN (anomalija na papirju, ne tiha 0)
    expect(m.summaryRows[3].value).toBe('-5')
    // osnova (totalSales) = 0 → delež null (brez goljufivega %), ne NaN
    expect(m.paymentRows[0].label).toBe('Gotovina')
    expect(m.paymentRows[0].sharePct).toBeNull()
  })

  it('footer nosi fiskalni disklejmer', () => {
    const m = buildZPrintModel(FULL)
    expect(m.footer).toContain('FURS/FINA')
    expect(m.footer).toContain('notranji uporabi')
  })
})
