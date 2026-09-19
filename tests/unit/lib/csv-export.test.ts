import { describe, it, expect } from 'vitest'
import {
  formatCsvNumber,
  csvEscapeCell,
  buildCsv,
  formatCsvTimestamp,
  giftCardHistoryCsv,
  giftCardCsvFilename,
  downloadCsv,
  GIFT_CARD_CSV_HEADERS,
  giftCardRegistryCsv,
  giftCardRegistryCsvFilename,
  GIFT_CARD_REGISTRY_CSV_HEADERS,
} from '@/lib/csv-export'
import { slPluralWord, slCount, NEAKTIVNA_KARTICA_FORMS, KARTICA_FORMS } from '@/lib/sl-plural'

describe('formatCsvNumber', () => {
  it('decimalna vejica privzeto (10 → "10,00")', () => {
    expect(formatCsvNumber(10)).toBe('10,00')
  })

  it('negativno število ohrani minus (-3.5 → "-3,50")', () => {
    expect(formatCsvNumber(-3.5)).toBe('-3,50')
  })

  it('ničla je "0,00" (ne "-0,00")', () => {
    expect(formatCsvNumber(0)).toBe('0,00')
    expect(formatCsvNumber(-0.001)).toBe('0,00')
  })

  it('zaokroži na 2 mesti (1234.567 → "1234,57")', () => {
    expect(formatCsvNumber(1234.567)).toBe('1234,57')
  })

  it('neštevilčne/neskončne vrednosti → prazna celica', () => {
    expect(formatCsvNumber(NaN)).toBe('')
    expect(formatCsvNumber(Infinity)).toBe('')
    expect(formatCsvNumber(undefined as unknown as number)).toBe('')
  })

  it('pike mode za domače/API porabnike', () => {
    expect(formatCsvNumber(10, { decimalComma: false })).toBe('10.00')
  })
})

describe('csvEscapeCell', () => {
  it('običajno besedilo ostane surovo', () => {
    expect(csvEscapeCell('Začetno nalaganje')).toBe('Začetno nalaganje')
  })

  it('ločilo v celici → ovij v navedke', () => {
    expect(csvEscapeCell('a;b')).toBe('"a;b"')
  })

  it('navedek se podvoji (RFC 4180)', () => {
    expect(csvEscapeCell('rekel je "zdravo"')).toBe('"rekel je ""zdravo"""')
  })

  it('prelomi vrstic → navedki + ohranjen prelom', () => {
    expect(csvEscapeCell('vrsta 1\nvrsta 2')).toBe('"vrsta 1\nvrsta 2"')
  })

  it('null/undefined → prazna celica', () => {
    expect(csvEscapeCell(null)).toBe('')
    expect(csvEscapeCell(undefined)).toBe('')
  })

  it('številke in booleani → String()', () => {
    expect(csvEscapeCell(42)).toBe('42')
    expect(csvEscapeCell(true)).toBe('true')
  })

  it('lastno ločilo se upošteva', () => {
    expect(csvEscapeCell('a,b', { delimiter: ',' })).toBe('"a,b"')
    expect(csvEscapeCell('a;b', { delimiter: ',' })).toBe('a;b')
  })
})

describe('buildCsv', () => {
  it('glava + vrstice, podpičje, CRLF, BOM', () => {
    const csv = buildCsv(['Datum', 'Znesek'], [['2026-09-19', '10,00']])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv.slice(1)).toBe('Datum;Znesek\r\n2026-09-19;10,00')
  })

  it('brez BOM ob bom:false', () => {
    const csv = buildCsv(['A'], [['b']], { bom: false })
    expect(csv.charCodeAt(0)).not.toBe(0xfeff)
    expect(csv).toBe('A\r\nb')
  })

  it('prazna množica vrstic → samo glava', () => {
    const csv = buildCsv(['X', 'Y'], [], { bom: false })
    expect(csv).toBe('X;Y')
  })

  it('LF konec vrstice ob izbiri', () => {
    const csv = buildCsv(['A'], [['1']], { bom: false, lineEnding: '\n' })
    expect(csv).toBe('A\n1')
  })
})

describe('formatCsvTimestamp (Europe/Ljubljana)', () => {
  it('poletni čas: 17:00Z → 19:00 (DST)', () => {
    // 2026-09-18 17:00 UTC = 19:00 LJ (CEST, UTC+2)
    expect(formatCsvTimestamp('2026-09-18T17:00:00.000Z')).toBe('18.09.2026 19:00')
  })

  it('zimski čas: 17:00Z → 18:00 (CET)', () => {
    expect(formatCsvTimestamp('2026-02-18T17:00:00.000Z')).toBe('18.02.2026 18:00')
  })

  it('sekunde so odrezane (23:59:59 → 23:59)', () => {
    expect(formatCsvTimestamp('2026-09-18T21:59:59.000Z')).toBe('18.09.2026 23:59')
  })

  it('sprejme Date objekt in epoch', () => {
    const d = new Date('2026-09-18T17:00:00.000Z')
    expect(formatCsvTimestamp(d)).toBe('18.09.2026 19:00')
    expect(formatCsvTimestamp(d.getTime())).toBe('18.09.2026 19:00')
  })

  it('neveljaven datum → prazna celica', () => {
    expect(formatCsvTimestamp('ni datum')).toBe('')
    expect(formatCsvTimestamp(NaN)).toBe('')
  })
})

describe('giftCardHistoryCsv', () => {
  const LABELS = { load: 'Naloženo', redeem: 'Unovčeno', transfer: 'Prenos', adjust: 'Prilagojeno' }
  const TXS = [
    {
      type: 'load',
      amount: 10,
      balanceAfter: 10,
      note: 'Začetno nalaganje',
      createdAt: '2026-09-18T10:48:00.000Z',
    },
    {
      type: 'redeem',
      amount: -4.5,
      balanceAfter: 5.5,
      note: 'Opomba z "navedki" in; podpičjem',
      createdAt: '2026-09-18T12:30:00.000Z',
    },
  ]

  it('glava je pričakovana (GIFT_CARD_CSV_HEADERS)', () => {
    const csv = giftCardHistoryCsv([], LABELS, { bom: false })
    expect(csv).toBe(GIFT_CARD_CSV_HEADERS.join(';'))
  })

  it('vrstica: LJ čas + prijazna vrsta + decimalna vejica (brez + predznaka)', () => {
    const csv = giftCardHistoryCsv([TXS[0]], LABELS, { bom: false })
    // 10:48 UTC poleti = 12:48 LJ (enako kot prikaz v UI: "18. 09. 2026, 12:48")
    expect(csv).toBe(
      'Datum in ura;Vrsta;Znesek (EUR);Stanje po (EUR);Opomba\r\n18.09.2026 12:48;Naloženo;10,00;10,00;Začetno nalaganje',
    )
  })

  it('poraba je negativna številka; opomba z navedki/ločilom je ubežana', () => {
    const csv = giftCardHistoryCsv([TXS[1]], LABELS, { bom: false })
    const [, row] = csv.split('\r\n')
    // 12:30 UTC poleti = 14:30 LJ
    expect(row).toBe(
      '18.09.2026 14:30;Unovčeno;-4,50;5,50;"Opomba z ""navedki"" in; podpičjem"',
    )
  })

  it('neznani tip → "Prilagojeno" (isti fallback kot UI)', () => {
    const csv = giftCardHistoryCsv(
      [{ type: 'martian', amount: 1, balanceAfter: 1, note: null, createdAt: '2026-09-18T10:00:00.000Z' }],
      LABELS,
      { bom: false },
    )
    expect(csv).toContain(';Prilagojeno;')
  })

  it('manjkajoča opomba → prazna celica (ne "undefined")', () => {
    const csv = giftCardHistoryCsv(
      [{ type: 'load', amount: 5, balanceAfter: 5, createdAt: '2026-09-18T10:00:00.000Z' }],
      LABELS,
      { bom: false },
    )
    expect(csv.split('\r\n')[1]).toBe('18.09.2026 12:00;Naloženo;5,00;5,00;')
  })
})

describe('giftCardCsvFilename', () => {
  it('vsebuje očiščeno številko kartice + današnji datum', () => {
    const name = giftCardCsvFilename('QA-R38-TEST-001', new Date(2026, 8, 19, 12, 0))
    expect(name).toBe('zgodovina-QA-R38-TEST-001-2026-09-19.csv')
  })

  it('nevarni znaki → pomišljaj, presledki odstranjeni', () => {
    const name = giftCardCsvFilename('GC 01/2026::test', new Date(2026, 8, 19))
    expect(name).toBe('zgodovina-GC-01-2026-test-2026-09-19.csv')
  })

  it('prazna številka → fallback "kartica"', () => {
    const name = giftCardCsvFilename('', new Date(2026, 8, 19))
    expect(name).toBe('zgodovina-kartica-2026-09-19.csv')
  })
})

describe('giftCardRegistryCsv (RUNDA 56 — drugi izvoz)', () => {
  const STATUS = { active: 'Aktivna', suspended: 'Suspendirana', expired: 'Potekla' }
  const CARDS = [
    {
      cardNumber: 'GC-0001',
      ownerName: 'Ana Novak',
      status: 'active',
      initialBalance: 50,
      balance: 32.5,
      purchasedAt: '2026-09-01T09:00:00.000Z',
      expiresAt: '2027-09-01T00:00:00.000Z',
    },
    {
      cardNumber: 'QA-R38-TEST-001',
      ownerName: 'QA probe',
      status: 'suspended',
      initialBalance: 10,
      balance: 10,
      purchasedAt: '2026-09-18T10:48:00.000Z',
      expiresAt: null,
    },
  ]

  it('glava registra je pričakovana', () => {
    const csv = giftCardRegistryCsv([], STATUS, { bom: false })
    expect(csv).toBe(GIFT_CARD_REGISTRY_CSV_HEADERS.join(';'))
  })

  it('vrstice: status oznaka, decimalna vejica, prazen datum poteka', () => {
    const csv = giftCardRegistryCsv(CARDS, STATUS, { bom: false })
    const rows = csv.split('\r\n')
    expect(rows[1]).toContain('GC-0001;Ana Novak;Aktivna;50,00;32,50;')
    expect(rows[1]).toContain('01.09.2026 11:00') // LJ poletni čas
    expect(rows[2]).toContain('QA-R38-TEST-001;QA probe;Suspendirana;10,00;10,00;')
    expect(rows[2].endsWith(';')).toBe(true) // expiresAt null → prazna celica
  })

  it('neznan status pade nazaj na surovi status', () => {
    const csv = giftCardRegistryCsv(
      [{ ...CARDS[0], status: 'martian' }],
      STATUS,
      { bom: false },
    )
    expect(csv).toContain(';martian;')
  })

  it('ime datoteke registra vsebuje datum', () => {
    expect(giftCardRegistryCsvFilename(new Date(2026, 8, 19))).toBe(
      'register-darilnih-kartic-2026-09-19.csv',
    )
  })
})

describe('downloadCsv (ne-brskalniška varnost)', () => {
  it('v jsdom/browser okolju vrne true (Blob pot podprta)', () => {
    // vitest jsdom: window obstaja, URL.createObjectURL tudi
    const ok = downloadCsv('test.csv', '\uFEFFA\r\nb')
    expect(ok).toBe(true)
  })
})

describe('NEAKTIVNA_KARTICA_FORMS (eliotska ženska oblika — R56 QA fix)', () => {
  it('1 → "neaktivna ali blokirana" (ednina)', () => {
    expect(slPluralWord(1, NEAKTIVNA_KARTICA_FORMS)).toBe('neaktivna ali blokirana')
  })

  it('2 → "neaktivni ali blokirani" (DVOJINA!)', () => {
    expect(slPluralWord(2, NEAKTIVNA_KARTICA_FORMS)).toBe('neaktivni ali blokirani')
  })

  it('3 in 4 → "neaktivne ali blokirane"', () => {
    expect(slPluralWord(3, NEAKTIVNA_KARTICA_FORMS)).toBe('neaktivne ali blokirane')
    expect(slPluralWord(4, NEAKTIVNA_KARTICA_FORMS)).toBe('neaktivne ali blokirane')
  })

  it('5+ → "neaktivnih ali blokiranih" (rodilnik)', () => {
    expect(slPluralWord(5, NEAKTIVNA_KARTICA_FORMS)).toBe('neaktivnih ali blokiranih')
    expect(slPluralWord(0, NEAKTIVNA_KARTICA_FORMS)).toBe('neaktivnih ali blokiranih')
  })

  it('izjema 11–14 vedno rodilnik; 21/22 sledita zadnji številki', () => {
    expect(slPluralWord(12, NEAKTIVNA_KARTICA_FORMS)).toBe('neaktivnih ali blokiranih')
    expect(slPluralWord(21, NEAKTIVNA_KARTICA_FORMS)).toBe('neaktivna ali blokirana')
    expect(slPluralWord(22, NEAKTIVNA_KARTICA_FORMS)).toBe('neaktivni ali blokirani')
  })
})

describe('KARTICA_FORMS (toast registra — RUNDA 56)', () => {
  it('1 kartica · 2 kartici (dvojina) · 5 kartic (rodilnik)', () => {
    expect(slCount(1, KARTICA_FORMS)).toBe('1 kartica')
    expect(slCount(2, KARTICA_FORMS)).toBe('2 kartici')
    expect(slCount(5, KARTICA_FORMS)).toBe('5 kartic')
    expect(slCount(0, KARTICA_FORMS)).toBe('0 kartic')
  })
})
