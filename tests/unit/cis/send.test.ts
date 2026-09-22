// ============================================
// CIS SEND — Unit testi (runda 27)
//
// Pokritost:
// - parseRacunOdgovor (čista funkcija): uspeh z Jir, JIR velika, napaka s
//   SifraGreske/PorukaGreske, SOAP Fault 1.1/1.2, IdPoruke/Zki echo,
//   elementi z atributi, smeti → non-throwing
// - isValidJir: 17 števk spec
// - buildSignedRacunZahtjev: compose build+sign, validacija, UUID
// - sendRacunZahtjev (mock transport):
//   * uspeh → ok=true + jir + signedEnvelope z ds:Signature
//   * poslovna napaka (b001) → ok=false + serverErrorCode + PorukaGreske
//   * SOAP Fault → ok=false
//   * odgovor brez JIR → ok=false ("brez JIR")
//   * mrežna napaka → ok=false, non-throwing
//   * URL + CA per okolje (test=Demo CA, prod=Prod CA)
//   * nevalidni podatki → NOBEN klic na žico, validation errors
//
// FIXTURE: self-signed cert + ključ (openssl CLI, os.tmpdir) — enako kot
// xmlsig.test.ts: naključen throwaway material, NI skrivnost.
// ============================================

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const mocks = vi.hoisted(() => ({
  soapPost: vi.fn(),
  loggerWarn: vi.fn(),
}))

vi.mock('@/lib/cis/transport', () => ({
  soapPost: mocks.soapPost,
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: mocks.loggerWarn,
    error: vi.fn(),
  },
}))

import {
  parseRacunOdgovor,
  isValidJir,
  buildSignedRacunZahtjev,
  sendRacunZahtjev,
  CIS_URLS,
  CIS_TEST_CA_PEM,
  CIS_PROD_CA_PEM,
} from '@/lib/cis'
import type { CisRacunData } from '@/lib/cis'

// --------------------------------------------
// Fixture
// --------------------------------------------

const baseData: CisRacunData = {
  oib: '12345678901',
  usustPdv: true,
  datumVrijeme: '15.01.2024T13:00:00',
  oznSlijed: 'P',
  brOznRac: '1',
  oznPosPr: 'POS1',
  oznNapUr: '1',
  iznosUkupno: '15.00',
  nacinPlac: 'G',
  oibOper: '10987654321',
  nakDost: false,
}

let TMP_DIR = ''
let CERT_PEM = ''
let KEY_PEM = ''

beforeAll(() => {
  TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cis-send-'))
  const keyPath = path.join(TMP_DIR, 'key.pem')
  const certPath = path.join(TMP_DIR, 'cert.pem')
  execFileSync(
    'openssl',
    ['req', '-x509', '-newkey', 'rsa:2048', '-keyout', keyPath, '-out', certPath, '-days', '30', '-nodes',
     '-subj', '/CN=CIS-SEND-TEST/O=RestaurantOS Test/C=HR'],
    { timeout: 30_000, stdio: ['pipe', 'pipe', 'pipe'] }
  )
  CERT_PEM = fs.readFileSync(certPath, 'utf8')
  KEY_PEM = fs.readFileSync(keyPath, 'utf8')
})

afterAll(() => {
  try {
    fs.rmSync(TMP_DIR, { recursive: true, force: true })
  } catch {
    // čiščenje tmp ni kritično
  }
})

const pems = () => ({ certificatePem: CERT_PEM, privateKeyPem: KEY_PEM })

beforeEach(() => {
  vi.clearAllMocks()
})

// --------------------------------------------
// parseRacunOdgovor
// --------------------------------------------

describe('parseRacunOdgovor', () => {
  it('uspešen RacunOdgovor z <Jir> → jir izluščen, isFault=false', () => {
    const xml = [
      '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">',
      '  <soap:Body>',
      '    <tns:RacunOdgovor xmlns:tns="http://www.apis-it.hr/fin/2012/types/f73">',
      '      <tns:Zaglavlje>',
      '        <tns:IdPoruke>abc-uuid-1</tns:IdPoruke>',
      '        <tns:DatumVrijeme>15.01.2024T13:00:01</tns:DatumVrijeme>',
      '      </tns:Zaglavlje>',
      '      <tns:Jir>17012345678901234</tns:Jir>',
      '    </tns:RacunOdgovor>',
      '  </soap:Body>',
      '</soap:Envelope>',
    ].join('\n')

    const res = parseRacunOdgovor(xml)
    expect(res.jir).toBe('17012345678901234')
    expect(res.idPoruke).toBe('abc-uuid-1')
    expect(res.isFault).toBe(false)
    expect(res.sifraGreske).toBeUndefined()
  })

  it('varianta <JIR> (nekateri strežniki) je prav tako prepoznana', () => {
    expect(parseRacunOdgovor('<tns:JIR>17012345678901234</tns:JIR>').jir).toBe('17012345678901234')
  })

  it('element z atributi (Jir Id="...") se pravilno ujame', () => {
    const xml = '<tns:RacunOdgovor Id="x"><tns:Jir Id="y">17012345678901234</tns:Jir></tns:RacunOdgovor>'
    expect(parseRacunOdgovor(xml).jir).toBe('17012345678901234')
  })

  it('poslovna napaka: SifraGreske + PorukaGreske', () => {
    const xml = [
      '<soap:Envelope><soap:Body>',
      '<tns:RacunOdgovor>',
      '  <tns:Zaglavlje><tns:IdPoruke>abc-uuid-2</tns:IdPoruke></tns:Zaglavlje>',
      '  <tns:SifraGreske>b001</tns:SifraGreske>',
      '  <tns:PorukaGreske>Neispravan OIB</tns:PorukaGreske>',
      '</tns:RacunOdgovor>',
      '</soap:Body></soap:Envelope>',
    ].join('\n')

    const res = parseRacunOdgovor(xml)
    expect(res.jir).toBeUndefined()
    expect(res.sifraGreske).toBe('b001')
    expect(res.porukaGreske).toBe('Neispravan OIB')
    expect(res.idPoruke).toBe('abc-uuid-2')
  })

  it('SOAP 1.1 Fault z faultstring → besedilo preslikano v porukaGreske', () => {
    const xml = [
      '<soap:Envelope><soap:Body>',
      '<soap:Fault>',
      '  <faultcode>soap:Server</faultcode>',
      '  <faultstring>s006</faultstring>',
      '</soap:Fault>',
      '</soap:Body></soap:Envelope>',
    ].join('\n')

    const res = parseRacunOdgovor(xml)
    expect(res.isFault).toBe(true)
    expect(res.jir).toBeUndefined()
    expect(res.porukaGreske).toBe('s006')
    expect(res.sustavPoruka).toBeUndefined()
  })

  it('SOAP 1.2 Fault z Reason/Text + SustavPoruka v detail', () => {
    const xml = [
      '<soap:Envelope><soap:Body>',
      '<soap:Fault>',
      '  <soap:Reason><soap:Text xml:lang="hr">Sistemska pogreška</soap:Text></soap:Reason>',
      '  <soap:Detail><tns:SustavPoruka>s006</tns:SustavPoruka></soap:Detail>',
      '</soap:Fault>',
      '</soap:Body></soap:Envelope>',
    ].join('\n')

    const res = parseRacunOdgovor(xml)
    expect(res.isFault).toBe(true)
    expect(res.sustavPoruka).toBe('s006')
  })

  it('Zki echo iz odgovora', () => {
    const xml = '<tns:RacunOdgovor><tns:Jir>17012345678901234</tns:Jir><tns:Zki>abcdef1234</tns:Zki></tns:RacunOdgovor>'
    expect(parseRacunOdgovor(xml).zki).toBe('abcdef1234')
  })

  it('prazen/ne-SOAP odgovor → non-throwing, vse undefined', () => {
    const res = parseRacunOdgovor('<html><body>Gateway error</body></html>')
    expect(res.jir).toBeUndefined()
    expect(res.sifraGreske).toBeUndefined()
    expect(res.isFault).toBe(false)
  })

  it('whitespace okoli JIR vrednosti je odrezan', () => {
    expect(parseRacunOdgovor('<tns:Jir>\n  17012345678901234\n</tns:Jir>').jir).toBe('17012345678901234')
  })
})

// --------------------------------------------
// isValidJir
// --------------------------------------------

describe('isValidJir', () => {
  it('17 števk → true', () => {
    expect(isValidJir('17012345678901234')).toBe(true)
  })
  it('16 ali 18 števk → false', () => {
    expect(isValidJir('1701234567890123')).toBe(false)
    expect(isValidJir('170123456789012345')).toBe(false)
  })
  it('ne-številčni znaki → false', () => {
    expect(isValidJir('17a12345678901234')).toBe(false)
    expect(isValidJir('')).toBe(false)
  })
  it('undefined → false (type guard)', () => {
    expect(isValidJir(undefined)).toBe(false)
  })
})

// --------------------------------------------
// buildSignedRacunZahtjev
// --------------------------------------------

describe('buildSignedRacunZahtjev', () => {
  it('validni podatki → podpisan envelope z ds:Signature + UUID + ZKI', () => {
    const res = buildSignedRacunZahtjev(baseData, pems(), { now: new Date('2024-01-15T12:00:00Z') })
    expect(res.validation.valid).toBe(true)
    expect(res.envelope).toContain('<soap:Envelope')
    expect(res.envelope).toContain('ds:Signature')
    expect(res.zki).toMatch(/^[0-9a-f]{32}$/)
    expect(res.idPoruke).toMatch(/^[0-9a-f-]{36}$/)
    // ZastKod v envelope-u se ujema z zki v rezultatu
    expect(res.envelope).toContain(`<tns:ZastKod>${res.zki}</tns:ZastKod>`)
  })

  it('nevalidni podatki (kraji OIB) → envelope "", errors v validaciji', () => {
    const res = buildSignedRacunZahtjev({ ...baseData, oib: '123' }, pems())
    expect(res.envelope).toBe('')
    expect(res.validation.valid).toBe(false)
    expect(res.validation.errors.length).toBeGreaterThan(0)
    expect(res.idPoruke).toMatch(/^[0-9a-f-]{36}$/)
  })
})

// --------------------------------------------
// sendRacunZahtjev (mock transport)
// --------------------------------------------

function racunOdgovorXml(jir?: string, extra: Record<string, string> = {}): string {
  const parts = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">',
    '  <soap:Body>',
    '    <tns:RacunOdgovor xmlns:tns="http://www.apis-it.hr/fin/2012/types/f73">',
    '      <tns:Zaglavlje>',
    '        <tns:IdPoruke>odgovor-uuid</tns:IdPoruke>',
    '      </tns:Zaglavlje>',
  ]
  if (jir) parts.push(`      <tns:Jir>${jir}</tns:Jir>`)
  for (const [tag, val] of Object.entries(extra)) {
    parts.push(`      <tns:${tag}>${val}</tns:${tag}>`)
  }
  parts.push('    </tns:RacunOdgovor>', '  </soap:Body>', '</soap:Envelope>')
  return parts.join('\n')
}

describe('sendRacunZahtjev (mock transport)', () => {
  it('uspeh → ok=true, jir, idPoruke korelacija, signedEnvelope z ds:Signature', async () => {
    mocks.soapPost.mockResolvedValueOnce({ status: 200, body: racunOdgovorXml('17012345678901234') })

    const res = await sendRacunZahtjev('test', baseData, pems())

    expect(res.ok).toBe(true)
    expect(res.jir).toBe('17012345678901234')
    expect(res.idPoruke).toBe('odgovor-uuid')
    expect(res.httpStatus).toBe(200)
    expect(res.responseTime).toBeGreaterThanOrEqual(0)
    expect(res.signedEnvelope).toContain('ds:Signature')
    expect(res.signedEnvelope).toContain('RacunZahtjev')
    expect(res.error).toBeUndefined()
    expect(res.serverErrorCode).toBeUndefined()
  })

  it('poslovna napaka b001 → ok=false + serverErrorCode + PorukaGreske', async () => {
    mocks.soapPost.mockResolvedValueOnce({
      status: 200,
      body: racunOdgovorXml(undefined, { SifraGreske: 'b001', PorukaGreske: 'Neispravan OIB' }),
    })

    const res = await sendRacunZahtjev('test', baseData, pems())

    expect(res.ok).toBe(false)
    expect(res.jir).toBeUndefined()
    expect(res.serverErrorCode).toBe('b001')
    expect(res.errorMessage).toBe('Neispravan OIB')
    expect(res.idPoruke).toBe('odgovor-uuid')
    // envelope je vseeno prisoten (audit trail)
    expect(res.signedEnvelope).toContain('ds:Signature')
  })

  it('SOAP Fault → ok=false (sistemski odgovor)', async () => {
    mocks.soapPost.mockResolvedValueOnce({
      status: 500,
      body: '<soap:Envelope><soap:Body><soap:Fault><faultcode>soap:Server</faultcode><faultstring>Sistemska pogreška</faultstring></soap:Fault></soap:Body></soap:Envelope>',
    })

    const res = await sendRacunZahtjev('production', baseData, pems())

    expect(res.ok).toBe(false)
    expect(res.errorMessage).toBe('Sistemska pogreška')
    expect(res.httpStatus).toBe(500)
  })

  it('odgovor brez JIR in brez napake → ok=false ("brez JIR")', async () => {
    mocks.soapPost.mockResolvedValueOnce({ status: 200, body: racunOdgovorXml(undefined) })

    const res = await sendRacunZahtjev('test', baseData, pems())

    expect(res.ok).toBe(false)
    expect(res.errorMessage).toContain('brez JIR')
  })

  it('mrežna napaka → ok=false, non-throwing, error opisan', async () => {
    mocks.soapPost.mockRejectedValueOnce(new Error('ENOTFOUND cis.example.hr'))

    const res = await sendRacunZahtjev('test', baseData, pems())

    expect(res.ok).toBe(false)
    expect(res.error).toBe('ENOTFOUND cis.example.hr')
    expect(res.errorMessage).toBe('ENOTFOUND cis.example.hr')
    expect(res.jir).toBeUndefined()
  })

  it('s000 sistemska koda NE velja za napako (uspeh s JIR gre skozi)', async () => {
    mocks.soapPost.mockResolvedValueOnce({
      status: 200,
      body: racunOdgovorXml('17012345678901234', { SifraGreske: 's000' }),
    })

    const res = await sendRacunZahtjev('test', baseData, pems())
    expect(res.ok).toBe(true)
  })

  it('timeout override se prenes na transport', async () => {
    mocks.soapPost.mockResolvedValueOnce({ status: 200, body: racunOdgovorXml('17012345678901234') })

    await sendRacunZahtjev('test', baseData, pems(), { timeoutMs: 1234 })

    expect(mocks.soapPost).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('RacunZahtjev'),
      expect.objectContaining({ 'Content-Type': 'application/soap+xml; charset=utf-8' }),
      expect.objectContaining({ timeoutMs: 1234 })
    )
  })
})

describe('sendRacunZahtjev — okolja (URL + CA)', () => {
  it('test okolje → FiskalizacijaServiceTest URL + Fina Demo CA', async () => {
    mocks.soapPost.mockResolvedValueOnce({ status: 200, body: racunOdgovorXml('17012345678901234') })
    await sendRacunZahtjev('test', baseData, pems())

    expect(mocks.soapPost).toHaveBeenCalledWith(
      CIS_URLS.test,
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ ca: CIS_TEST_CA_PEM })
    )
  })

  it('production okolje → FiskalizacijaService URL + Prod CA', async () => {
    mocks.soapPost.mockResolvedValueOnce({ status: 200, body: racunOdgovorXml('17012345678901234') })
    await sendRacunZahtjev('production', baseData, pems())

    expect(mocks.soapPost).toHaveBeenCalledWith(
      CIS_URLS.production,
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ ca: CIS_PROD_CA_PEM })
    )
  })
})

describe('sendRacunZahtjev — validacija pred pošiljanjem', () => {
  it('nevalidni podatki → NOBEN klic na žico + validation errors', async () => {
    const res = await sendRacunZahtjev('test', { ...baseData, oib: '12' }, pems())

    expect(mocks.soapPost).not.toHaveBeenCalled()
    expect(res.ok).toBe(false)
    expect(res.validation?.valid).toBe(false)
    expect(res.validation?.errors.length).toBeGreaterThan(0)
    expect(res.idPoruke).toMatch(/^[0-9a-f-]{36}$/)
  })
})
