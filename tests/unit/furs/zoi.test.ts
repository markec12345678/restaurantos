// ============================================
// FURS ZOI — Unit testi PO SPECIFIKACIJI (ZDDV-1)
// FIX (R229, katalog napak D3): prej so testi pin-ali implementacijo
// (generic length > 10 && < 60) — napaki A1 (base64 izhod) in A2 (lojtr v
// vhodu) sta bili "zeleni". Zdaj testi preverjajo specifikacijo:
//   - izhod: točno 32 znakov malih hex (0-9, a-f)
//   - vhod: zlepljen BREZ lojtr (neodvisno preverjen prek zoiInputString)
//   - formula: ZOI = MD5(RSA-SHA256(zlepljeni podatki)) kot lowercase hex
//     (vzorec pravilnega HR ZKI: src/lib/cis/zki.ts)
// ============================================
import { describe, it, expect, beforeEach, vi } from 'vitest'
import crypto from 'crypto'

// Generiraj test RSA ključ (enkrat na test run)
const { privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
})
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()

// Import po mock setup-u
import { generateZOI, zoiInputString } from '@/lib/furs/crypto/zoi'

describe('FURS ZOI generiranje (spec ZDDV-1)', () => {
  const baseData = {
    taxId: 'SI12345678',
    invoiceNumber: '1',
    issueDateTime: new Date('2026-06-19T12:30:45+02:00'), // Ljubljana čas
    totalAmount: 12.50,
    premisesId: 'PREMISES1',
    registerId: 'BLAGAJNA1',
    environment: 'test' as const,
  }

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // ── SPEC: vhod podpisa — zlepljanje BREZ lojtr (katalog A2) ──
  it('zoiInputString zlepi podatke BREZ lojtr v predpisanem vrstnem redu', () => {
    // TaxNumber + IssueDateTime + InvoiceNumber + PremisesId + DeviceId + TotalAmount
    expect(zoiInputString(baseData)).toBe(
      'SI1234567819.06.2026 12:30:451PREMISES1BLAGAJNA112.50'
    )
  })

  it('zoiInputString ne vsebuje ločila "|" (katalog A2 — prej join(\'|\'))', () => {
    expect(zoiInputString(baseData)).not.toContain('|')
  })

  // ── SPEC: izhod — točno 32 znakov malih hex (katalog A1) ──
  it('vrne TOČNO 32 znakov malih hex (0-9, a-f) — uradni format ZOI', () => {
    const zoi = generateZOI(baseData, privateKeyPem)
    expect(zoi).toMatch(/^[0-9a-f]{32}$/)
  })

  // ── SPEC: formula — ZOI = MD5(podpis) nad zlepljenimi podatki ──
  it('ZOI = MD5(RSA-SHA256 podpis zlepljenih podatkov) kot lowercase hex', () => {
    const input = zoiInputString(baseData)
    const signer = crypto.createSign('RSA-SHA256')
    signer.update(input, 'utf8')
    const signature = signer.sign(privateKeyPem)
    const expected = crypto.createHash('md5').update(signature).digest('hex')
    expect(generateZOI(baseData, privateKeyPem)).toBe(expected)
  })

  it('je determinističen — isti podatki → isti ZOI', () => {
    const zoi1 = generateZOI(baseData, privateKeyPem)
    const zoi2 = generateZOI(baseData, privateKeyPem)
    expect(zoi1).toBe(zoi2)
  })

  it('se spremeni, če se spremeni znesek', () => {
    const zoi1 = generateZOI(baseData, privateKeyPem)
    const zoi2 = generateZOI({ ...baseData, totalAmount: 12.51 }, privateKeyPem)
    expect(zoi1).not.toBe(zoi2)
  })

  it('se spremeni, če se spremeni številka računa', () => {
    const zoi1 = generateZOI(baseData, privateKeyPem)
    const zoi2 = generateZOI({ ...baseData, invoiceNumber: '2' }, privateKeyPem)
    expect(zoi1).not.toBe(zoi2)
  })

  it('se spremeni, če se spremeni davčna številka', () => {
    const zoi1 = generateZOI(baseData, privateKeyPem)
    const zoi2 = generateZOI({ ...baseData, taxId: 'SI87654321' }, privateKeyPem)
    expect(zoi1).not.toBe(zoi2)
  })

  it('fallback brez ključa v testnem okolju je TUDI 32 malih hex (formatna pariteta)', () => {
    const zoi = generateZOI(baseData) // brez privateKey
    expect(zoi).toMatch(/^[0-9a-f]{32}$/)
  })

  it('VRŽE NAPAKO v produkciji, če privatni ključ manjka ali podpisovanje ne uspe', () => {
    expect(() =>
      generateZOI(
        { ...baseData, environment: 'production' },
        'invalid-key-format'
      )
    ).toThrow()
  })

  it('formatira datum v slovenski format dd.MM.yyyy HH:mm:ss (lokalni čas, ne UTC)', () => {
    // Testiramo, da ZOI za datum 12:30:45 ni enak ZOI za 14:30:45 (razlika UTC offset)
    // To zagotavlja, da se uporablja lokalni čas, ne UTC
    const sloTime = new Date('2026-06-19T12:30:45+02:00')
    const utcTime = new Date('2026-06-19T12:30:45Z') // 14:30:45 Ljubljana
    const zoi1 = generateZOI({ ...baseData, issueDateTime: sloTime }, privateKeyPem)
    const zoi2 = generateZOI({ ...baseData, issueDateTime: utcTime }, privateKeyPem)
    expect(zoi1).not.toBe(zoi2)
    // Eksplicitno: vhod za sloTime vsebuje 12:30:45, vhod za utcTime 14:30:45
    expect(zoiInputString({ ...baseData, issueDateTime: sloTime })).toContain('12:30:45')
    expect(zoiInputString({ ...baseData, issueDateTime: utcTime })).toContain('14:30:45')
  })
})
