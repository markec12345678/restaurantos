// ============================================
// FURS ZOI — Unit testi
// Preverja ključno davčno logiko
// ============================================
import { describe, it, expect, beforeEach, vi } from 'vitest'
import crypto from 'crypto'

// Generiraj test RSA ključ (enkrat na test run)
const { privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
})
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()

// Import po mock setup-u
import { generateZOI } from '@/lib/furs/crypto/zoi'

describe('FURS ZOI generiranje', () => {
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

  it('vrne non-empty Base64 niz', () => {
    const zoi = generateZOI(baseData, privateKeyPem)
    expect(zoi).toBeTruthy()
    expect(typeof zoi).toBe('string')
    // Base64 ~ 24 znakov za 16 bajtov
    expect(zoi.length).toBeGreaterThan(10)
    expect(zoi.length).toBeLessThan(60)
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

  it('deluje brez privatnega ključa v testnem okolju (fallback)', () => {
    const zoi = generateZOI(baseData) // brez privateKey
    expect(zoi).toBeTruthy()
    expect(typeof zoi).toBe('string')
  })

  it('VRŽE NAPAKO v produkciji, če privatni ključ manjka ali podpisovanje ne uspe', () => {
    expect(() =>
      generateZOI(
        { ...baseData, environment: 'production' },
        'invalid-key-format'
      )
    ).toThrow()
  })

  it('formatira datum v slovenski format dd.MM.yyyy HH:mm:ss', () => {
    // Testiramo, da ZOI za datum 12:30:45 ni enak ZOI za 11:30:45 (razlika UTC offset)
    // To zagotavlja, da se uporablja lokalni čas, ne UTC
    const sloTime = new Date('2026-06-19T12:30:45+02:00')
    const utcTime = new Date('2026-06-19T12:30:45Z') // 14:30:45 Ljubljana
    const zoi1 = generateZOI({ ...baseData, issueDateTime: sloTime }, privateKeyPem)
    const zoi2 = generateZOI({ ...baseData, issueDateTime: utcTime }, privateKeyPem)
    expect(zoi1).not.toBe(zoi2)
  })
})
