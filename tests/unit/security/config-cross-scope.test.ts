// ============================================
// MODEL A #8/#9 — CROSS-SCOPE VALIDACIJA KONFIGURACIJSKIH REFERENC
//
// validateConfigRefs (configuration/_helpers.ts):
//   • dining-options: serviceChargeId + taxRateId morata pripadati ISTI lokaciji
//     (cross-tenant servisna postavka / DDV override = napačen fiskalni račun)
//   • printers: printRules (JSON) — oblika + prepStationId iz ISTE lokacije
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  serviceChargeFindFirst: vi.fn(),
  taxRateFindFirst: vi.fn(),
  prepStationFindFirst: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    serviceCharge: { findFirst: mocks.serviceChargeFindFirst },
    taxRate: { findFirst: mocks.taxRateFindFirst },
    prepStation: { findFirst: mocks.prepStationFindFirst },
  },
}))

import { validateConfigRefs, coerceFieldTypes, allowedFields } from '../../../src/app/api/configuration/_helpers'

const LOC_A = 'loc-a'
const LOC_B = 'loc-b'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MODEL A #8: DiningOption cross-scope reference (serviceChargeId/taxRateId)', () => {
  it('serviceChargeId iz ISTE lokacije → OK', async () => {
    mocks.serviceChargeFindFirst.mockResolvedValueOnce({ id: 'sc-1' })
    const res = await validateConfigRefs('dining-options', { serviceChargeId: 'sc-1' }, LOC_A)
    expect(res.ok).toBe(true)
    expect(mocks.serviceChargeFindFirst).toHaveBeenCalledWith({
      where: { id: 'sc-1', locationId: LOC_A },
      select: { id: true },
    })
  })

  it('serviceChargeId iz TUJE lokacije → ZAVRNJENO (ista lokacija = 400)', async () => {
    mocks.serviceChargeFindFirst.mockResolvedValueOnce(null) // loc-a iskanje → ni najdeno
    const res = await validateConfigRefs('dining-options', { serviceChargeId: 'sc-foreign' }, LOC_A)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('Servisna postavka')
  })

  it('taxRateId iz TUJE lokacije → ZAVRNJENO (DDV override prek meje!)', async () => {
    mocks.taxRateFindFirst.mockResolvedValueOnce(null)
    const res = await validateConfigRefs('dining-options', { taxRateId: 'tr-foreign' }, LOC_A)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('Davčna stopnja')
  })

  it('taxRateId iz ISTE lokacije → OK', async () => {
    mocks.taxRateFindFirst.mockResolvedValueOnce({ id: 'tr-1' })
    const res = await validateConfigRefs('dining-options', { taxRateId: 'tr-1' }, LOC_A)
    expect(res.ok).toBe(true)
  })

  it('prazen string FK (čist klient) → normaliziran na null, brez poizvedbe', async () => {
    const data = coerceFieldTypes({ serviceChargeId: '', taxRateId: '' })
    expect(data.serviceChargeId).toBeNull()
    expect(data.taxRateId).toBeNull()
    const res = await validateConfigRefs('dining-options', data, LOC_A)
    expect(res.ok).toBe(true)
    expect(mocks.serviceChargeFindFirst).not.toHaveBeenCalled()
    expect(mocks.taxRateFindFirst).not.toHaveBeenCalled()
  })

  it('allowedFields: dining-options vključuje taxRateId (F5-7 DDV override je sedaj nastavljiv)', () => {
    expect(allowedFields['dining-options']).toContain('taxRateId')
    expect(allowedFields['dining-options']).toContain('serviceChargeId')
    // locationId NIKOLI v allowedFields (anti-forgery — izpelje se iz seje)
    expect(allowedFields['dining-options']).not.toContain('locationId')
  })
})

describe('MODEL A #9: Printer.printRules validacija (oblika + prepStation scope)', () => {
  it('veljaven printRules JSON (splošno pravilo) → OK + kanonična serializacija', async () => {
    const data = { printRules: '[{"type":"receipt"}]' }
    const res = await validateConfigRefs('printers', data, LOC_A)
    expect(res.ok).toBe(true)
    expect(data.printRules).toBe('[{"type":"receipt"}]')
  })

  it('NEVELJAVEN JSON → zavrnjeno', async () => {
    const res = await validateConfigRefs('printers', { printRules: '{nicht json' }, LOC_A)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('printRules')
  })

  it('ni array → zavrnjeno', async () => {
    const res = await validateConfigRefs('printers', { printRules: '{"type":"receipt"}' }, LOC_A)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('array')
  })

  it('pravilo brez type → zavrnjeno', async () => {
    const res = await validateConfigRefs('printers', { printRules: '[{"prepStationId":"ps-1"}]' }, LOC_A)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('type')
  })

  it('prepStationId iz ISTE lokacije → OK', async () => {
    mocks.prepStationFindFirst.mockResolvedValueOnce({ id: 'ps-1' })
    const res = await validateConfigRefs('printers', { printRules: '[{"type":"prepStationOrder","prepStationId":"ps-1"}]' }, LOC_A)
    expect(res.ok).toBe(true)
    expect(mocks.prepStationFindFirst).toHaveBeenCalledWith({
      where: { id: 'ps-1', locationId: LOC_A },
      select: { id: true },
    })
  })

  it('prepStationId iz TUJE lokacije → ZAVRNJENO', async () => {
    mocks.prepStationFindFirst.mockResolvedValueOnce(null)
    const res = await validateConfigRefs('printers', { printRules: '[{"type":"prepStationOrder","prepStationId":"ps-foreign"}]' }, LOC_A)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('Postaja priprave')
  })

  it('neveljaven port → zavrnjen', async () => {
    const res = await validateConfigRefs('printers', { printRules: '[{"type":"receipt","port":99999}]' }, LOC_A)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('port')
  })

  it('več kot 50 pravil → zavrnjeno (DoS varovalka)', async () => {
    const rules = JSON.stringify(Array.from({ length: 51 }, () => ({ type: 'receipt' })))
    const res = await validateConfigRefs('printers', { printRules: rules }, LOC_A)
    expect(res.ok).toBe(false)
  })
})

describe('MODEL A: drugi modeli brez FK referenc → vedno OK', () => {
  it('tax-rates brez referenc', async () => {
    const res = await validateConfigRefs('tax-rates', { name: 'DDV 22%', rate: 22 }, LOC_A)
    expect(res.ok).toBe(true)
  })
})
