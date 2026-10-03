// ============================================
// R229 — FURS 2D KODA (QR): 60 NUMERIČNIH MEST + EOR LOWERCASE
// Katalog napak A3 + A4 (ZDDV-1 spec compliance):
//   A3: prej izmišljen pipe-format — spec predpisuje točno 60 numeričnih
//       mest: ZOI hex→decimal (39) + davčna (8) + LLMMDDUUMMSS (12) +
//       kontrolni znak = vsota 59 števk mod 10 (1).
//   A4: simulirani EOR prej UPPERCASE — spec/uradni primer je lowercase
//       UUID (56dcaf93-933a-497d-b864-40ba1e8f4fa2).
// ============================================
import { describe, it, expect } from 'vitest'
import crypto from 'crypto'
import { generateFursQRContent, generateSimulatedEOR } from '@/lib/furs/helpers/qr-eor'

// Uradni primer ZOI iz FURS dokumentacije (32 malih hex)
const ZOI_HEX = '8402f0a963e37b2258e034fc8ae7ffc1'

const baseData = {
  zoi: ZOI_HEX,
  totalAmount: 21.59,
  issueDateTime: new Date('2026-06-19T12:30:45+02:00'), // Ljubljana čas
  taxId: 'SI12345678',
  businessId: '12345678',
  registerId: 'BLAGAJNA1',
  premisesId: 'PP999',
}

describe('FURS QR vsebina — 60 numeričnih mest (spec ZDDV-1)', () => {
  it('vrne točno 60 števk (0-9)', () => {
    const qr = generateFursQRContent(baseData)
    expect(qr).toMatch(/^\d{60}$/)
  })

  it('prvih 39 mest = ZOI (hex 32) pretvorjen v decimalno, levo zapolnjen z ničlami', () => {
    const expectedDecimal = BigInt(`0x${ZOI_HEX}`).toString().padStart(39, '0')
    const qr = generateFursQRContent(baseData)
    expect(qr.slice(0, 39)).toBe(expectedDecimal)
    // 128-bit vrednost ima pričakovano 39 mest (zeropad zares deluje)
    expect(qr.slice(0, 39)).toHaveLength(39)
  })

  it('mesta 40-47 = davčna številka brez "SI" predpone', () => {
    const qr = generateFursQRContent(baseData)
    expect(qr.slice(39, 47)).toBe('12345678')
  })

  it('mesta 48-59 = datum in čas v obliki LLMMDDUUMMSS (lokalni čas)', () => {
    const qr = generateFursQRContent(baseData)
    // 19.06.2026 12:30:45 Ljubljana → 26 06 19 12 30 45
    expect(qr.slice(47, 59)).toBe('260619123045')
  })

  it('60. mesto = kontrolni znak (vsota prvih 59 števk po modulu 10)', () => {
    const qr = generateFursQRContent(baseData)
    const digitSum = qr
      .slice(0, 59)
      .split('')
      .reduce((sum, d) => sum + Number(d), 0)
    expect(Number(qr[59])).toBe(digitSum % 10)
  })

  it('kontrolni znak se spremeni, če se spremeni ZOI (ni vedno enak)', () => {
    const qr1 = generateFursQRContent(baseData)
    const qr2 = generateFursQRContent({ ...baseData, zoi: '00000000000000000000000000000000' })
    expect(qr1).not.toBe(qr2)
  })

  it('sprejme UPPERCASE hex ZOI (generateZOIPlaceholder kompatibilnost)', () => {
    const qr = generateFursQRContent({
      ...baseData,
      zoi: ZOI_HEX.toUpperCase(),
    })
    expect(qr).toBe(generateFursQRContent(baseData))
  })

  it('LEGACY KOMPAT: sprejme base64 16-bajtni ZOI (starejši zapisi v bazi)', () => {
    const legacyBase64 = crypto.randomBytes(16).toString('base64')
    const qr = generateFursQRContent({ ...baseData, zoi: legacyBase64 })
    expect(qr).toMatch(/^\d{60}$/)
    // isti bajti → isti decimalni zapis kot hex pot
    const hex = Buffer.from(legacyBase64, 'base64').toString('hex')
    const expectedDecimal = BigInt(`0x${hex}`).toString().padStart(39, '0')
    expect(qr.slice(0, 39)).toBe(expectedDecimal)
  })

  it('VRŽE NAPAKO za ZOI-jem, ki ni 32-hex niti 16-bajtni base64', () => {
    expect(() =>
      generateFursQRContent({ ...baseData, zoi: 'to-ni-zoi' })
    ).toThrow(/ZOI/)
  })

  it('VRŽE NAPAKO, če davčna številka nima 8 števk', () => {
    expect(() =>
      generateFursQRContent({ ...baseData, taxId: 'SI123' })
    ).toThrow(/8 števk/)
  })
})

describe('Simuliran EOR — lowercase UUID (katalog A4)', () => {
  it('je 36-znakovni UUID v lowercase hex', () => {
    const eor = generateSimulatedEOR(ZOI_HEX, new Date('2026-06-19T12:30:45Z'))
    expect(eor).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(eor).toBe(eor.toLowerCase())
  })

  it('je determinističen (isti ZOI + datum → isti EOR)', () => {
    const d = new Date('2026-06-19T12:30:45Z')
    expect(generateSimulatedEOR(ZOI_HEX, d)).toBe(generateSimulatedEOR(ZOI_HEX, d))
  })
})
