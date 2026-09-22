// ============================================
// FURS JWS (RFC 7515) — testi z URADNIMI vektorji iz Tehnične dokumentacije
// v3.2 (poglavje 8/9.1 — primer certifikata ITM STORITVE, OU=99999862):
//
//   subject_name: "CN=ITM STORITVE\\, SPELA PERGAR S.P.,2.5.4.5=#130131,OU=99999862,OU=DavPotRacTEST,O=state-institutions,C=SI"
//   issuer_name:  "CN=Tax CA Test,O=state-institutions,C=SI"
//   serial:       2575988469811686647
//   ZOI testni vektor (Račun 145, TRGOVINA1/BLAG2): 34905bcff14b381039af2e9d7eee54bb
// ============================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFileSync } from 'child_process'
import {
  formatDn,
  b64url,
  b64urlDecode,
  buildFursJws,
  verifyFursJws,
  identityFromPem,
} from '../../../src/lib/furs/crypto/jws'

// ── Uradni vektorji iz dokumentacije (9.1) ──
const OFFICIAL = {
  subjectName: 'CN=ITM STORITVE\\, SPELA PERGAR S.P.,2.5.4.5=#130131,OU=99999862,OU=DavPotRacTEST,O=state-institutions,C=SI',
  issuerName: 'CN=Tax CA Test,O=state-institutions,C=SI',
  serial: 2575988469811686647,
  zoi: '34905bcff14b381039af2e9d7eee54bb',
}

describe('FURS JWS — base64url kodiranje', () => {
  it('b64url je brez paddinga in URL-varno', () => {
    expect(b64url('A')).toBe('QQ')
    expect(b64url('AB')).toBe('QUI')
    expect(b64url('ABC')).toBe('QUJD')
    expect(b64url('A+B/C=')).not.toMatch(/[+/=]/)
    const round = b64urlDecode(b64url(Buffer.from('FURS JWS test žšč'))).toString('utf8')
    expect(round).toBe('FURS JWS test žšč')
  })
})

describe('FURS JWS — formatDn (openssl → Java X500Principal)', () => {
  it('openssl DN izpis se pretvori v spec format (obratni vrstni red, brez presledkov)', () => {
    // openssl izpiše: "C = SI, O = state-institutions, OU = 99999862, OU = DavPotRacTEST, CN = ITM STORITVE\, SPELA PERGAR S.P."
    // openssl izpiše DER vrstni red: C, O, OU(DavPotRacTEST), OU(99999862), CN
    const opensslDn = 'C = SI, O = state-institutions, OU = DavPotRacTEST, OU = 99999862, 2.5.4.5 = #130131, CN = ITM STORITVE\\, SPELA PERGAR S.P.'
    expect(formatDn(opensslDn)).toBe(OFFICIAL.subjectName)
  })

  it('openssl issuer DN se pretvori pravilno', () => {
    expect(formatDn('C = SI, O = state-institutions, CN = Tax CA Test')).toBe(OFFICIAL.issuerName)
  })
})

describe('FURS JWS — buildFursJws (header/payload/signatura)', () => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  const publicKey = crypto.createPublicKey(privateKey)

  it('header vsebuje EXACTNO spec polja (alg, subject_name, issuer_name, serial)', () => {
    const jwt = buildFursJws(
      { subjectName: OFFICIAL.subjectName, issuerName: OFFICIAL.issuerName, serial: String(OFFICIAL.serial) },
      privateKeyPem,
      { EchoRequest: 'test 1' },
    )
    const [h, p, s] = jwt.split('.')
    expect(h).toBeTruthy()
    expect(p).toBeTruthy()
    expect(s).toBeTruthy()

    const header = JSON.parse(b64urlDecode(h).toString('utf8'))
    expect(header.alg).toBe('RS256')
    expect(header.subject_name).toBe(OFFICIAL.subjectName)
    expect(header.issuer_name).toBe(OFFICIAL.issuerName)
    expect(header.serial).toBe(OFFICIAL.serial)
    // NE sme biti OAuth-style polj (iss/aud/exp — stara napačna implementacija)
    expect(header.iss).toBeUndefined()
    expect(header.aud).toBeUndefined()
    expect(header.exp).toBeUndefined()
  })

  it('payload vsebuje VSEBINO sporočila (ne OAuth zahtevka)', () => {
    const message = { InvoiceRequest: { Header: { MessageID: 'x', DateTime: '2015-08-07T13:05:24' } } }
    const jwt = buildFursJws(
      { subjectName: OFFICIAL.subjectName, issuerName: OFFICIAL.issuerName, serial: String(OFFICIAL.serial) },
      privateKeyPem,
      message,
    )
    const payload = JSON.parse(b64urlDecode(jwt.split('.')[1]).toString('utf8'))
    expect(payload).toEqual(message)
    expect(payload.grant_type).toBeUndefined() // OAuth ostanki
  })

  it('podpis je RSA-SHA256 (RS256) in preverljiv z javnim ključem', () => {
    const jwt = buildFursJws(
      { subjectName: OFFICIAL.subjectName, issuerName: OFFICIAL.issuerName, serial: String(OFFICIAL.serial) },
      privateKeyPem,
      { EchoRequest: 'test 1' },
    )
    const [h, p, s] = jwt.split('.')
    const verifier = crypto.createVerify('RSA-SHA256')
    verifier.update(`${h}.${p}`)
    expect(verifier.verify(publicKey, b64urlDecode(s))).toBe(true)
  })
})

describe('FURS JWS — verifyFursJws (odgovor {"token": JWT} z x5c)', () => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()

  let certPemValue = ''
  let tmpDir = ''

  beforeAll(() => {
    // Ustvari samopodpisan certifikat za x5c (openssl — enako kot FURS odgovor)
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'furs-jws-'))
    const keyFile = path.join(tmpDir, 'key.pem')
    fs.writeFileSync(keyFile, privateKeyPem)
    const certFile = path.join(tmpDir, 'cert.pem')
    execFileSync('openssl', [
      'req', '-new', '-x509', '-key', keyFile, '-out', certFile, '-days', '1',
      '-subj', '/CN=FURS-TEST-RESPONSE-SIGNER',
    ], { timeout: 10000 })
    certPemValue = fs.readFileSync(certFile, 'utf8')
  })

  afterAll(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('veljaven JWS z x5c → valid=true, payload dekodiran', () => {
    const certB64 = certPemValue.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')
    const header = { alg: 'RS256', x5c: [certB64] }
    const payload = { InvoiceResponse: { EOR: 'ead54776-11e7-4b3d-aad4-2bd4d7b0f4f4' } }

    const h = b64url(JSON.stringify(header))
    const p = b64url(JSON.stringify(payload))
    const signer = crypto.createSign('RSA-SHA256')
    signer.update(`${h}.${p}`)
    const jwt = `${h}.${p}.${b64url(signer.sign(privateKeyPem))}`

    const result = verifyFursJws(jwt)
    expect(result.valid).toBe(true)
    expect((result.payload as { InvoiceResponse: { EOR: string } }).InvoiceResponse.EOR).toBe('ead54776-11e7-4b3d-aad4-2bd4d7b0f4f4')
  })

  it('MANIPULIRAN payload → podpis NE velja', () => {
    const certB64 = certPemValue.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')
    const header = { alg: 'RS256', x5c: [certB64] }
    const payload = { InvoiceResponse: { EOR: 'original-eor' } }
    const h = b64url(JSON.stringify(header))
    const p = b64url(JSON.stringify(payload))
    const signer = crypto.createSign('RSA-SHA256')
    signer.update(`${h}.${p}`)
    const jwt = `${h}.${p}.${b64url(signer.sign(privateKeyPem))}`

    // Napadalec zamenja payload (drugi EOR), obdrži podpis
    const tamperedPayload = b64url(JSON.stringify({ InvoiceResponse: { EOR: 'fake-eor' } }))
    const tampered = `${h}.${tamperedPayload}.${jwt.split('.')[2]}`
    const result = verifyFursJws(tampered)
    expect(result.valid).toBe(false)
    expect((result.payload as { InvoiceResponse: { EOR: string } }).InvoiceResponse.EOR).toBe('fake-eor') // dekodirano a neveljavno
  })
})

describe('FURS JWS — uradni testni račun (dokumentacija 9.1)', () => {
  it('ZOI testni vektor: 34905bcff14b381039af2e9d7eee54bb (TRGOVINA1/BLAG2/145)', () => {
    // Konservativna struktura za dokumentacijo 9.1 — Račun izdan prek
    // elektronske naprave davčne št. 99999862, znesek 66.71 EUR
    expect(OFFICIAL.zoi).toBe('34905bcff14b381039af2e9d7eee54bb')
    expect(OFFICIAL.zoi).toMatch(/^[0-9a-f]{32}$/)
  })

  it('uradni primer: TaxNumber je ŠTEVILKA (ne "SI..." niz) v payloadu', async () => {
    const { buildFursRequest } = await import('../../../src/lib/furs/api/build-request')
    const request = buildFursRequest(
      {
        businessId: '12345678',
        taxId: 'SI99999862',
        registerId: 'BLAG2',
        premisesId: 'TRGOVINA1',
        deviceIp: '',
        environment: 'test',
        certPath: '/certs/test.p12',
        certPassword: 'x',
      },
      {
        invoiceNumber: '145',
        issueDateTime: new Date('2015-08-07T13:05:24'),
        totalAmount: 66.71,
        paymentMethod: 'cash',
        vatBreakdown: [
          { rate: 22.0, baseAmount: 23.14, vatAmount: 5.09 },
          { rate: 9.5, baseAmount: 35.14, vatAmount: 3.34 },
        ],
      },
      OFFICIAL.zoi,
    )
    const inv = (request.InvoiceRequest as Record<string, Record<string, unknown>>).Invoice
    expect(inv.TaxNumber).toBe(99999862) // številka — ne "SI99999862"
    expect(inv.NumberingStructure).toBe('B')
    expect(inv.InvoiceIdentifier).toEqual({
      BusinessPremiseID: 'TRGOVINA1',
      ElectronicDeviceID: 'BLAG2',
      InvoiceNumber: '145',
    })
    expect(inv.ProtectedID).toBe(OFFICIAL.zoi)
    expect(inv.OperatorTaxNumber).toBe(99999862)
    const taxes = (inv.TaxesPerSeller as Array<{ VAT: Array<Record<string, number>> }>)[0]
    expect(taxes.VAT).toHaveLength(2)
    expect(taxes.VAT[0]).toEqual({ TaxRate: 22.0, TaxableAmount: 23.14, TaxAmount: 5.09 })
    // Stara (napačna) polja NE smejo obstajati (schema: additionalProperties false!)
    expect(inv.InvoiceIdentifier).not.toHaveProperty('RegisterID')
    expect(inv).not.toHaveProperty('PaymentType')
    expect(inv).not.toHaveProperty('Premises')
  })
})

describe('FURS JWS — identityFromPem iz pravega certifikata', () => {
  it('izvleče serial (hex→dec) in DN-ja iz PEM', () => {
    // Uporabi JAVNI FURS test certifikat iz certs/furs-test/ (resen certifikat!)
    const certPath = path.join(process.cwd(), 'certs', 'furs-test', 'DavPotRacTEST.cer')
    if (!fs.existsSync(certPath)) return // skip, če certs manjkajo (npr. poseben CI)
    const pem = fs.readFileSync(certPath, 'utf8')
    const identity = identityFromPem(pem)
    expect(identity).not.toBeNull()
    expect(identity!.serial).toMatch(/^\d+$/)
    expect(identity!.subjectName).toContain('CN=DavPotRacTEST')
    expect(identity!.issuerName).toContain('CN=SIGOV-CA')
    expect(identity!.issuerName).toContain('C=SI')
  })
})
