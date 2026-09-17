// ============================================
// CIS ZKI — Unit testi (Task 24-b)
//
// Preverjamo:
// - formatCisAmount: normalizacija (15 → "15.00", "15.0" → "15.00"),
//   STROGOST (vejica zavrnjena, preveč decimalk zavrnjene)
// - formatCisDateTime: Europe/Zagreb CET (pozimi UTC+1) in CEST (poleti UTC+2),
//   obe obliki (xml z "T", zki s presledkom)
// - zkiInputString: točen vhodni niz (brez lojtr, T → presledek, iznos s piko)
// - computeZki: 32 malih hex znakov, determinističen, NEODVISNA verifikacija
//   (test sam podpiše z createSign + md5 in primerja), občutljiv na ključ
//   in podatke
// - CIS_FIELD_PATTERNS: zastKod/uuid vzorca
// ============================================

import { describe, it, expect } from 'vitest'
import crypto from 'node:crypto'

// Testni RSA ključi (enkrat na test run) — ZKI formula je enaka za kateregakoli
// RSA ključa; FINA cert pa ima zasebni ključ istega formata (PKCS#8 PEM)
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
const privateKeyPem2 = crypto
  .generateKeyPairSync('rsa', { modulusLength: 2048 })
  .privateKey.export({ type: 'pkcs8', format: 'pem' })
  .toString()

import {
  computeZki,
  formatCisAmount,
  formatCisDateTime,
  zkiInputString,
  CIS_FIELD_PATTERNS,
} from '@/lib/cis'

const baseInput = {
  oib: '12345678901',
  datVrijeme: '15.01.2024T13:00:00',
  brOznRac: '1',
  oznPosPr: 'POS1',
  oznNapUr: '1',
  iznosUkupno: '15.00',
}

describe('formatCisAmount', () => {
  it('številka → pika + natanko 2 decimalki', () => {
    expect(formatCisAmount(15)).toBe('15.00')
    expect(formatCisAmount(0.5)).toBe('0.50')
    expect(formatCisAmount(1234.5)).toBe('1234.50')
    expect(formatCisAmount(-12.5)).toBe('-12.50')
    expect(formatCisAmount(0)).toBe('0.00')
  })

  it('niz z manj decimalkami → izgubljeno dopolni ("15.0" → "15.00", "15" → "15.00")', () => {
    expect(formatCisAmount('15.0')).toBe('15.00')
    expect(formatCisAmount('15')).toBe('15.00')
    expect(formatCisAmount('15.00')).toBe('15.00')
    expect(formatCisAmount('0.5')).toBe('0.50')
  })

  it('VEJICA je strogo zavrnjena (dokumentirano: XML/ZKI zahtevata piko)', () => {
    expect(() => formatCisAmount('15,5')).toThrow(/vejica/i)
    expect(() => formatCisAmount('15,50')).toThrow(/vejica/i)
  })

  it('preveč decimalk v nizu → napaka (brez tihega zaokroževanja podpisa)', () => {
    expect(() => formatCisAmount('15.123')).toThrow()
    expect(() => formatCisAmount('0.001')).toThrow()
  })

  it('neveljavni nizi → napaka', () => {
    expect(() => formatCisAmount('abc')).toThrow()
    expect(() => formatCisAmount('')).toThrow()
    expect(() => formatCisAmount('1e2')).toThrow()
    expect(() => formatCisAmount('12.3.4')).toThrow()
  })

  it('nekončne številke → napaka', () => {
    expect(() => formatCisAmount(Number.NaN)).toThrow()
    expect(() => formatCisAmount(Number.POSITIVE_INFINITY)).toThrow()
  })

  it('prevelike številke (1e21) → napaka (toFixed vrne eksponentni zapis)', () => {
    expect(() => formatCisAmount(1e21)).toThrow()
  })
})

describe('formatCisDateTime (Europe/Zagreb)', () => {
  it('zima = CET (UTC+1): 2024-01-15T12:00:00Z → 13:00 po Zagrebu', () => {
    const res = formatCisDateTime(new Date('2024-01-15T12:00:00Z'))
    expect(res.xml).toBe('15.01.2024T13:00:00')
    expect(res.zki).toBe('15.01.2024 13:00:00')
  })

  it('poletje = CEST (UTC+2): 2024-07-15T12:00:00Z → 14:00 po Zagrebu', () => {
    const res = formatCisDateTime(new Date('2024-07-15T12:00:00Z'))
    expect(res.xml).toBe('15.07.2024T14:00:00')
    expect(res.zki).toBe('15.07.2024 14:00:00')
  })

  it('polnoč je "00" (h23, ne "24") + prelom datuma', () => {
    const res = formatCisDateTime(new Date('2024-01-15T23:30:00Z'))
    expect(res.xml).toBe('16.01.2024T00:30:00')
  })

  it('zki oblika = xml oblika z presledkom namesto T', () => {
    const res = formatCisDateTime(new Date('2024-03-31T23:00:00Z'))
    expect(res.zki).toBe(res.xml.replace('T', ' '))
  })
})

describe('zkiInputString', () => {
  it('zlepi brez lojtr; T v času → presledek; iznos ostane "15.00"', () => {
    expect(zkiInputString(baseInput)).toBe('1234567890115.01.2024 13:00:001POS1115.00')
  })

  it('sprejme tudi že presledkovno obliko datuma (normalizacija je idempotentna)', () => {
    expect(zkiInputString({ ...baseInput, datVrijeme: '15.01.2024 13:00:00' })).toBe(
      '1234567890115.01.2024 13:00:001POS1115.00'
    )
  })

  it('številski iznos normalizira na 2 decimalki (15 → "15.00")', () => {
    expect(zkiInputString({ ...baseInput, iznosUkupno: 15 })).toBe(
      '1234567890115.01.2024 13:00:001POS1115.00'
    )
  })

  it('različen znesek → različen vhodni niz (občutljivost)', () => {
    expect(zkiInputString({ ...baseInput, iznosUkupno: '15.01' })).not.toBe(zkiInputString(baseInput))
  })
})

describe('computeZki', () => {
  it('vrne 32 malih hex znakov (vzorec zastKod)', () => {
    const zki = computeZki(baseInput, privateKeyPem)
    expect(zki).toMatch(CIS_FIELD_PATTERNS.zastKod)
    expect(zki).toHaveLength(32)
  })

  it('je determinističen — isti vhod + isti ključ → isti ZKI', () => {
    expect(computeZki(baseInput, privateKeyPem)).toBe(computeZki(baseInput, privateKeyPem))
  })

  it('NEODVISNA verifikacija: ZKI = md5(surovi RSA-SHA256 podpis vhodnega niza)', () => {
    // Test sam izvede formulo z node:crypto (brez naše kode) in primerja
    const inputString = zkiInputString(baseInput)
    const signer = crypto.createSign('RSA-SHA256')
    signer.update(inputString, 'utf8')
    const signature = signer.sign(privateKeyPem)
    const expected = crypto.createHash('md5').update(signature).digest('hex')

    expect(computeZki(baseInput, privateKeyPem)).toBe(expected)
  })

  it('drugi ključ → drug podpis → drug ZKI', () => {
    expect(computeZki(baseInput, privateKeyPem2)).not.toBe(computeZki(baseInput, privateKeyPem))
  })

  it('sprejme PEM kot Buffer (enak rezultat kot niz)', () => {
    expect(computeZki(baseInput, Buffer.from(privateKeyPem))).toBe(
      computeZki(baseInput, privateKeyPem)
    )
  })

  it('občutljiv na vsa polja (oib, čas, št. računa, prostor, naprava, znesek)', () => {
    const base = computeZki(baseInput, privateKeyPem)
    expect(computeZki({ ...baseInput, oib: '12345678902' }, privateKeyPem)).not.toBe(base)
    expect(computeZki({ ...baseInput, datVrijeme: '15.01.2024T13:00:01' }, privateKeyPem)).not.toBe(base)
    expect(computeZki({ ...baseInput, brOznRac: '2' }, privateKeyPem)).not.toBe(base)
    expect(computeZki({ ...baseInput, oznPosPr: 'POS2' }, privateKeyPem)).not.toBe(base)
    expect(computeZki({ ...baseInput, oznNapUr: '2' }, privateKeyPem)).not.toBe(base)
    expect(computeZki({ ...baseInput, iznosUkupno: '15.01' }, privateKeyPem)).not.toBe(base)
  })

  it('neveljaven ključ → vrže napako (brez tihega fallbacka)', () => {
    expect(() => computeZki(baseInput, 'not-a-key')).toThrow()
  })

  it('javni ključ NI dovolj za podpis (private key required)', () => {
    const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
    expect(() => computeZki(baseInput, publicPem)).toThrow()
  })
})

describe('CIS_FIELD_PATTERNS (omejitve polj)', () => {
  it('uuid vzorec zahteva MALE črke', () => {
    const lower = crypto.randomUUID()
    expect(lower).toMatch(CIS_FIELD_PATTERNS.uuid)
    expect(lower.toUpperCase()).not.toMatch(CIS_FIELD_PATTERNS.uuid)
  })

  it('datumVrijeme vzorec: dd.MM.yyyyTHH:mm:ss', () => {
    expect('15.01.2024T13:00:00').toMatch(CIS_FIELD_PATTERNS.datumVrijeme)
    expect('15.01.2024 13:00:00').not.toMatch(CIS_FIELD_PATTERNS.datumVrijeme) // presledek → ZKI oblika
    expect('15.01.2024T13:00').not.toMatch(CIS_FIELD_PATTERNS.datumVrijeme)
  })

  it('iznos vzorec: pika + 2 decimalki, vejica zavrnjena', () => {
    expect('15.00').toMatch(CIS_FIELD_PATTERNS.iznos)
    expect('-15.00').toMatch(CIS_FIELD_PATTERNS.iznos)
    expect('15,00').not.toMatch(CIS_FIELD_PATTERNS.iznos)
    expect('15.0').not.toMatch(CIS_FIELD_PATTERNS.iznos)
    expect('1234567890123456.00').not.toMatch(CIS_FIELD_PATTERNS.iznos) // > 15 števk
  })

  it('stopa vzorec: npr. "25.00"', () => {
    expect('25.00').toMatch(CIS_FIELD_PATTERNS.stopa)
    expect('9.50').toMatch(CIS_FIELD_PATTERNS.stopa)
    expect('125.00').toMatch(CIS_FIELD_PATTERNS.stopa)
    expect('1250.00').not.toMatch(CIS_FIELD_PATTERNS.stopa) // > 3 števke
  })

  it('oznPosPr dovoljuje alfanumerično + pomišljaj, ne pa posebnih znakov', () => {
    expect('POS1').toMatch(CIS_FIELD_PATTERNS.oznPosPr)
    expect('POS-1').toMatch(CIS_FIELD_PATTERNS.oznPosPr)
    expect('POS#1').not.toMatch(CIS_FIELD_PATTERNS.oznPosPr)
    expect('POS 1').not.toMatch(CIS_FIELD_PATTERNS.oznPosPr)
  })
})
