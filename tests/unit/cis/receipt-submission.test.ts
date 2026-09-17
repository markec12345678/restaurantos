// ============================================
// CIS RECEIPT SUBMISSION — produkcijska vezava (runda 29)
//
// Pokritost:
// - mapPaymentMethodToNacinPlac (G/K/T/O preslikava)
// - receiptNumberToBrOznRac (R-2026-000123 → 123)
// - buildCisRacunDataFromReceipt (čista funkcija: OIB, PDV blok, zneski)
// - submitReceiptToCis (orkestracija z injiciranimi deps — brez omrežja):
//   * idempotenza (already-submitted, brez pošiljanja)
//   * skip-i brez sledi (storno, predračun, no-settings, no-cert-config)
//   * P12 neberljiv → pending
//   * uspeh → submitted + JIR/ZKI/cisSubmittedAt persistiran
//   * poslovna napaka (b001) → pending + ZKI shranjen
//   * receipt-not-found → 404-style outcome
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: { receipt: {}, restaurantSettings: {} },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import {
  mapPaymentMethodToNacinPlac,
  receiptNumberToBrOznRac,
  buildCisRacunDataFromReceipt,
  submitReceiptToCis,
  type ReceiptForCis,
  type SettingsForCis,
  type CisSubmissionDeps,
} from '@/lib/cis/receipt-submission'

// ─── Fixture ───
const receiptFixture: ReceiptForCis = {
  id: 'rcpt-1',
  receiptNumber: 'R-2026-000123',
  taxId: 'SI12345678901',
  registerId: 'BLG-001',
  totalWithTip: 45.6,
  paymentMethod: 'kartica',
  vatBreakdown: JSON.stringify({
    '22': { base: 25.0, vat: 5.5, total: 30.5 },
    '9.5': { base: 10.0, vat: 0.95, total: 10.95 },
  }),
  isStorno: false,
  createdAt: new Date('2026-09-17T12:00:00Z'),
  cisStatus: 'none',
  cisJir: '',
}

const settingsFixture: SettingsForCis = {
  taxId: 'SI12345678901',
  cisEnvironment: 'test',
  cisCertPath: '/certs/fina-demo.p12',
  cisCertPassword: 'secret',
}

const pemsFixture = {
  certificatePem: '-----BEGIN CERTIFICATE-----\nX\n-----END CERTIFICATE-----',
  privateKeyPem: '-----BEGIN PRIVATE KEY-----\nY\n-----END PRIVATE KEY-----',
}

/** Zgradi deps z mock db + mock send/loadP12. */
function makeDeps(overrides?: {
  receipt?: Partial<ReceiptForCis> | null
  settings?: Partial<SettingsForCis> | null
  sendResult?: Record<string, unknown>
}): { deps: CisSubmissionDeps; updateMock: ReturnType<typeof vi.fn>; sendMock: ReturnType<typeof vi.fn>; loadP12Mock: ReturnType<typeof vi.fn> } {
  const receipt = overrides?.receipt === null ? null : { ...receiptFixture, ...(overrides?.receipt ?? {}) }
  const settings = overrides?.settings === null ? null : { ...settingsFixture, ...(overrides?.settings ?? {}) }
  const updateMock = vi.fn(async () => ({}))
  const findUniqueMock = vi.fn(async () => receipt)
  const settingsFindFirstMock = vi.fn(async () => settings)
  const sendMock = vi.fn(async () =>
    overrides?.sendResult ?? { ok: true, jir: '17012345678901234', zki: 'a'.repeat(32), idPoruke: 'u-1' }
  )
  const loadP12Mock = vi.fn(() => pemsFixture)
  return {
    deps: {
      dbClient: {
        receipt: {
          findUnique: findUniqueMock,
          update: updateMock,
        },
        restaurantSettings: {
          findFirst: settingsFindFirstMock,
        },
      } as unknown as CisSubmissionDeps['dbClient'],
      send: sendMock as unknown as CisSubmissionDeps['send'],
      loadP12: loadP12Mock as unknown as CisSubmissionDeps['loadP12'],
      now: new Date('2026-09-17T13:00:00Z'),
    },
    updateMock,
    sendMock,
    loadP12Mock,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('mapPaymentMethodToNacinPlac', () => {
  it('gotovina/cash → G', () => {
    expect(mapPaymentMethodToNacinPlac('gotovina')).toBe('G')
    expect(mapPaymentMethodToNacinPlac('cash')).toBe('G')
  })
  it('kartica/card/mobilno/mobile → K (e-instrumenti)', () => {
    expect(mapPaymentMethodToNacinPlac('kartica')).toBe('K')
    expect(mapPaymentMethodToNacinPlac('card')).toBe('K')
    expect(mapPaymentMethodToNacinPlac('mobilno')).toBe('K')
    expect(mapPaymentMethodToNacinPlac('mobile')).toBe('K')
  })
  it('cek/tantiema → T', () => {
    expect(mapPaymentMethodToNacinPlac('cek')).toBe('T')
    expect(mapPaymentMethodToNacinPlac('tantiema')).toBe('T')
  })
  it('neznano/null → O', () => {
    expect(mapPaymentMethodToNacinPlac('kriptovaluta')).toBe('O')
    expect(mapPaymentMethodToNacinPlac(null)).toBe('O')
    expect(mapPaymentMethodToNacinPlac(undefined)).toBe('O')
  })
})

describe('receiptNumberToBrOznRac', () => {
  it('R-2026-000123 → 123 (brez vodilnih ničel)', () => {
    expect(receiptNumberToBrOznRac('R-2026-000123')).toBe('123')
  })
  it('R-2026-000001 → 1', () => {
    expect(receiptNumberToBrOznRac('R-2026-000001')).toBe('1')
  })
  it('samo številke ostanejo', () => {
    expect(receiptNumberToBrOznRac('12')).toBe('12')
  })
  it('prazno/brez števk/ničle → 1 (fallback)', () => {
    expect(receiptNumberToBrOznRac('')).toBe('1')
    expect(receiptNumberToBrOznRac('abc')).toBe('1')
    expect(receiptNumberToBrOznRac('0000')).toBe('1')
  })
  it('odreže na 20 števk (CIS pattern limit)', () => {
    expect(receiptNumberToBrOznRac('1234567890123456789012345')).toHaveLength(20)
  })
})

describe('buildCisRacunDataFromReceipt', () => {
  it('preslika vsa polja (OIB iz taxId, PDV blok, znesek z napojnico)', () => {
    const data = buildCisRacunDataFromReceipt(receiptFixture, settingsFixture)
    expect(data.oib).toBe('12345678901')
    expect(data.oibOper).toBe('12345678901') // operater = izdajatelj (dokumentirano)
    expect(data.usustPdv).toBe(true)
    expect(data.datumVrijeme).toBe(receiptFixture.createdAt)
    expect(data.oznSlijed).toBe('P')
    expect(data.brOznRac).toBe('123')
    expect(data.oznPosPr).toBe('BLG-001')
    expect(data.oznNapUr).toBe('1')
    expect(data.pdv).toEqual([
      { stopa: '22.00', osnovica: '25.00', iznos: '5.50' },
      { stopa: '9.50', osnovica: '10.00', iznos: '0.95' },
    ])
    expect(data.iznosUkupno).toBe('45.60')
    expect(data.nacinPlac).toBe('K')
    expect(data.nakDost).toBe(false)
  })

  it('fallback OIB iz receipt.taxId, prazen vatBreakdown → brez pdv bloka', () => {
    const data = buildCisRacunDataFromReceipt(
      { ...receiptFixture, taxId: 'HR 44455566677', vatBreakdown: '{}' },
      { taxId: null },
    )
    expect(data.oib).toBe('44455566677')
    expect(data.pdv).toBeUndefined()
  })

  it('pokvarjen vatBreakdown JSON → brez pdv bloka (non-throwing)', () => {
    const data = buildCisRacunDataFromReceipt(
      { ...receiptFixture, vatBreakdown: '{neveljaven' },
      settingsFixture,
    )
    expect(data.pdv).toBeUndefined()
  })

  it('prazen registerId → POS1', () => {
    const data = buildCisRacunDataFromReceipt({ ...receiptFixture, registerId: '' }, settingsFixture)
    expect(data.oznPosPr).toBe('POS1')
  })
})

describe('submitReceiptToCis', () => {
  it('uspeh → submitted + JIR/ZKI/cisSubmittedAt persistiran', async () => {
    const { deps, updateMock, sendMock } = makeDeps()

    const outcome = await submitReceiptToCis('rcpt-1', deps)

    expect(outcome.ok).toBe(true)
    expect(outcome.skipped).toBe(false)
    expect(outcome.cisStatus).toBe('submitted')
    expect(outcome.jir).toBe('17012345678901234')
    expect(outcome.environment).toBe('test')

    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock.mock.calls[0][0]).toBe('test')
    expect(sendMock.mock.calls[0][1].brOznRac).toBe('123')

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'rcpt-1' },
      data: {
        cisStatus: 'submitted',
        cisZki: 'a'.repeat(32),
        cisJir: '17012345678901234',
        cisSubmittedAt: new Date('2026-09-17T13:00:00Z'),
      },
    })
  })

  it('idempotenza: že submitted račun → skip brez pošiljanja', async () => {
    const { deps, updateMock, sendMock } = makeDeps({
      receipt: { cisStatus: 'submitted', cisJir: '17012345678901234' },
    })

    const outcome = await submitReceiptToCis('rcpt-1', deps)

    expect(outcome.ok).toBe(true)
    expect(outcome.skipped).toBe(true)
    expect(outcome.reason).toBe('already-submitted')
    expect(outcome.jir).toBe('17012345678901234')
    expect(sendMock).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('storno → skip storno-unsupported', async () => {
    const { deps, sendMock } = makeDeps({ receipt: { isStorno: true } })
    const outcome = await submitReceiptToCis('rcpt-1', deps)
    expect(outcome.ok).toBe(false)
    expect(outcome.reason).toBe('storno-unsupported')
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('predračun (brez številke) → skip receipt-number-missing', async () => {
    const { deps, sendMock } = makeDeps({ receipt: { receiptNumber: '' } })
    const outcome = await submitReceiptToCis('rcpt-1', deps)
    expect(outcome.reason).toBe('receipt-number-missing')
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('brez nastavitev → skip no-settings', async () => {
    const { deps, sendMock } = makeDeps({ settings: null })
    const outcome = await submitReceiptToCis('rcpt-1', deps)
    expect(outcome.reason).toBe('no-settings')
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('brez cert konfiguracije → skip no-cert-config, status NE spremenjen', async () => {
    const { deps, updateMock, sendMock } = makeDeps({
      settings: { cisCertPath: '', cisCertPassword: '' },
    })
    const outcome = await submitReceiptToCis('rcpt-1', deps)
    expect(outcome.reason).toBe('no-cert-config')
    expect(sendMock).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('P12 neberljiv → pending (retry), brez pošiljanja', async () => {
    const { deps, updateMock, sendMock, loadP12Mock } = makeDeps({})
    loadP12Mock.mockReturnValue(null)

    const outcome = await submitReceiptToCis('rcpt-1', deps)

    expect(outcome.ok).toBe(false)
    expect(outcome.reason).toBe('p12-unreadable')
    expect(outcome.cisStatus).toBe('pending')
    expect(sendMock).not.toHaveBeenCalled()
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'rcpt-1' },
      data: { cisStatus: 'pending' },
    })
  })

  it('poslovna napaka FINA (b001) → pending + ZKI shranjen, ok=false', async () => {
    const { deps, updateMock } = makeDeps({
      sendResult: {
        ok: false, zki: 'b'.repeat(32), idPoruke: 'u-2',
        serverErrorCode: 'b001', errorMessage: 'Račun već poslan',
      },
    })

    const outcome = await submitReceiptToCis('rcpt-1', deps)

    expect(outcome.ok).toBe(false)
    expect(outcome.cisStatus).toBe('pending')
    expect(outcome.serverErrorCode).toBe('b001')
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'rcpt-1' },
      data: { cisStatus: 'pending', cisZki: 'b'.repeat(32) },
    })
  })

  it('receipt ne obstaja → receipt-not-found', async () => {
    const { deps, sendMock } = makeDeps({ receipt: null })
    const outcome = await submitReceiptToCis('rcpt-x', deps)
    expect(outcome.ok).toBe(false)
    expect(outcome.skipped).toBe(true)
    expect(outcome.reason).toBe('receipt-not-found')
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('produkcija okolje iz nastavitev se propagira', async () => {
    const { deps, sendMock } = makeDeps({ settings: { cisEnvironment: 'production' } })
    const outcome = await submitReceiptToCis('rcpt-1', deps)
    expect(sendMock.mock.calls[0][0]).toBe('production')
    expect(outcome.environment).toBe('production')
  })
})
