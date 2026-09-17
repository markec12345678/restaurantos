// ============================================
// CIS XML-DSIG — Unit testi (Task 26-a)
//
// NEODVISNA-VERIFIKACIJA vzorec (kot zki/invoice testi): test sam računa
// pričakovane vrednosti z node:crypto (createHash/createVerify) in s TOMI
// pravili C14N, ki jih piše spec — BREZ naše implementacije:
//   - DigestValue = base64(sha256(kanonični RacunZahtjev BREZ ds:Signature))
//   - kanonična oblika = surovi builder fragment, SAMO z &quot;/&apos;
//     razpakiranima v besedilu (c14n v besedilu NE escape-ira " in ')
//   - SignatureValue = RSA-SHA256 nad kanoničnim SignedInfo (prazni elementi
//     razširjeni, xmlns:ds na vrhu fragmenta)
//   - podpis verificiramo z javnim ključem iz certifikata (createVerify)
//
// FIXTURE / P12 OPOMBA (odstopanje od izvirnega načrta, dokumentirano):
// Testni P12 + ključi se GENERIRAJO OB ZAGONU TESTA (openssl CLI + node:crypto)
// v os.tmpdir(), namesto da bi jih commitali. Razlog: .gitignore v tem repu
// izrecno prepoveduje commit P12/ključev ("P12/PFX z zasebnimi ključi ostanejo
// ignorirani ZA VEDNO"). openssl CLI je že odvisnost testne_suite (test-
// certificates.test.ts). Generirani material je NAKLJUČEN, samopodpisan,
// throwaway — NI skrivnost in NIČ ne podpisuje "zares". FINA demo/prod P12 ima
// isti format (PKCS#12 + RSA ključ).
//
// DEV-TIME cross-verifikacija (izven testa): mini-c14n je byte-po-byte
// primerjan s python lxml exclusive=True (libxml2) na polnem podpisanem
// envelope-u — digest IN SignedInfo sta identična; SignatureValue verificiran
// še z `openssl dgst -sha256 -verify` nad lxml kanonizacijo. (Verified OK)
// ============================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

import {
  buildRacunZahtjev,
  signRacunZahtjev,
  canonicalizeRacunZahtjev,
  canonicalizeFragment,
  locateRacunZahtjev,
  pemToBase64Der,
  loadCisP12,
  CIS_XMLDSIG_NS,
  CIS_ALG_CANONICALIZATION,
  CIS_ALG_ENVELOPED,
  CIS_ALG_RSA_SHA256,
  CIS_ALG_SHA256_DIGEST,
} from '@/lib/cis'
import type { CisRacunData } from '@/lib/cis'

// --------------------------------------------
// Throwaway testni certifikat + P12 (runtime generacija, glej glavo)
// --------------------------------------------
let TMP_DIR = ''
let CERT_PEM = ''
let KEY_PEM = ''
let P12_PATH = ''
const P12_PASSWORD = 'test-password' // javno dokumentiran testni throwaway, NI skrivnost

beforeAll(() => {
  TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cis-xmlsig-'))
  const keyPath = path.join(TMP_DIR, 'key.pem')
  const certPath = path.join(TMP_DIR, 'cert.pem')
  P12_PATH = path.join(TMP_DIR, 'test-signing.p12')

  // self-signed cert + ključ (enako kot FINA P12 po formatu, le self-signed)
  execFileSync(
    'openssl',
    ['req', '-x509', '-newkey', 'rsa:2048', '-keyout', keyPath, '-out', certPath, '-days', '30', '-nodes',
     '-subj', '/CN=CIS-XMLSIG-TEST/O=RestaurantOS Test/C=HR'],
    { timeout: 30_000, stdio: ['pipe', 'pipe', 'pipe'] }
  )
  execFileSync(
    'openssl',
    ['pkcs12', '-export', '-out', P12_PATH, '-inkey', keyPath, '-in', certPath,
     '-passout', `pass:${P12_PASSWORD}`, '-name', 'CIS xmlsig test (throwaway)'],
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

// Drugi (odprti) ključ par za negativne primave
const otherKey = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
const OTHER_KEY_PEM = otherKey.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
const PUBLIC_PEM = otherKey.publicKey.export({ type: 'spki', format: 'pem' }).toString()

// Generator neodvisnih RSA parov za teste, ki ne potrebujejo certifikata
function genKeyPem(): string {
  return crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
}

const FIXED_NOW = new Date('2024-01-15T12:00:00Z')

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

/** Zgradi (nepodpisan) envelope z generiranim ključem — podpisni testi so neodvisni od fixture certov. */
function buildUnsigned(data: Partial<CisRacunData> = {}, keyPem = genKeyPem()): { envelope: string; keyPem: string } {
  const res = buildRacunZahtjev({ ...baseData, ...data }, keyPem, { now: FIXED_NOW })
  if (!res.validation.valid) throw new Error(`build neveljaven: ${res.validation.errors.join('; ')}`)
  return { envelope: res.envelope, keyPem }
}

/** Izlušči surovi RacunZahtjev fragment iz envelope-a (brez naše kode). */
function rawFragment(xml: string): string {
  const start = xml.indexOf('<tns:RacunZahtjev')
  const close = xml.indexOf('</tns:RacunZahtjev>') + '</tns:RacunZahtjev>'.length
  return xml.slice(start, close)
}

/** C14N pravilo za besedilo: &quot;/&apos; se razpakirata, ostale entitete builderja so že c14n. */
function handCanonical(textQuoted: boolean, xml: string): string {
  const frag = rawFragment(xml)
  if (!textQuoted) return frag
  return frag.replace(/&quot;/g, '"').replace(/&apos;/g, "'")
}

describe('DigestValue (enveloped transform + sha256)', () => {
  it('NEODVISNA verifikacija: digest = sha256 nad surovim fragmentom (brez posebnih znakov)', () => {
    const { envelope, keyPem } = buildUnsigned()
    const res = buildRacunZahtjev(baseData, keyPem, { now: FIXED_NOW })
    const signed = signRacunZahtjev(res.envelope, { certificatePem: CERT_PEM, privateKeyPem: keyPem })
    expect(signed.validation.valid).toBe(true)

    const expectedDigest = crypto.createHash('sha256').update(handCanonical(false, res.envelope), 'utf8').digest('base64')
    expect(signed.digestValue).toBe(expectedDigest)
  })

  it('NEODVISNA verifikacija z posebnimi znaki: &quot; in &apos; sta v kanoničnem besedilu razpakirana', () => {
    const { envelope, keyPem } = buildUnsigned({ specNamj: ` posebna & "naročilo" <test> 'x'` })
    const expectedDigest = crypto.createHash('sha256').update(handCanonical(true, envelope), 'utf8').digest('base64')

    const signed = signRacunZahtjev(envelope, { certificatePem: CERT_PEM, privateKeyPem: keyPem })
    expect(signed.validation.valid).toBe(true)
    expect(signed.digestValue).toBe(expectedDigest)
    expect(signed.envelope).toContain('&quot;naročilo&quot;') // v DOKUMENTU ostane escape-irano
  })

  it('DigestValue element v dokumentu se ujema s poročanim', () => {
    const { envelope, keyPem } = buildUnsigned()
    const signed = signRacunZahtjev(envelope, { certificatePem: CERT_PEM, privateKeyPem: keyPem })
    const m = /<ds:DigestValue>([^<]+)<\/ds:DigestValue>/.exec(signed.envelope)
    expect(m?.[1]).toBe(signed.digestValue)
  })

  it('enveloped transform: kanonična oblika podpisanega == nepodpisanega (Signature izgine iz digest vhoda)', () => {
    const { envelope, keyPem } = buildUnsigned()
    const signed = signRacunZahtjev(envelope, { certificatePem: CERT_PEM, privateKeyPem: keyPem })
    expect(canonicalizeRacunZahtjev(envelope).equals(canonicalizeRacunZahtjev(signed.envelope))).toBe(true)
    expect(canonicalizeRacunZahtjev(signed.envelope).includes('ds:Signature')).toBe(false)
  })
})

describe('SignatureValue (RSA-SHA256 nad kanoničnim SignedInfo)', () => {
  it('NEODVISNA verifikacija: createVerify nad ročno zgrajenim kanoničnim SignedInfo', () => {
    // fixture par (KEY_PEM ↔ CERT_PEM) — javni ključ certifikata MORA verificirati
    const res = buildRacunZahtjev(baseData, KEY_PEM, { now: FIXED_NOW })
    const signed = signRacunZahtjev(res.envelope, { certificatePem: CERT_PEM, privateKeyPem: KEY_PEM })
    expect(signed.validation.valid).toBe(true)

    // ročno zgrajen kanonični SignedInfo po spec pravilih (prazni elementi
    // razširjeni, xmlns:ds na vrhu, whitespace kot v dokumentu, iBase=6)
    const id = locateRacunZahtjev(res.envelope).id
    const digest = signed.digestValue
    const expectedCanonical = [
      `<ds:SignedInfo xmlns:ds="${CIS_XMLDSIG_NS}">`,
      `        <ds:CanonicalizationMethod Algorithm="${CIS_ALG_CANONICALIZATION}"></ds:CanonicalizationMethod>`,
      `        <ds:SignatureMethod Algorithm="${CIS_ALG_RSA_SHA256}"></ds:SignatureMethod>`,
      `        <ds:Reference URI="#${id}">`,
      `          <ds:Transforms>`,
      `            <ds:Transform Algorithm="${CIS_ALG_ENVELOPED}"></ds:Transform>`,
      `            <ds:Transform Algorithm="${CIS_ALG_CANONICALIZATION}"></ds:Transform>`,
      `          </ds:Transforms>`,
      `          <ds:DigestMethod Algorithm="${CIS_ALG_SHA256_DIGEST}"></ds:DigestMethod>`,
      `          <ds:DigestValue>${digest}</ds:DigestValue>`,
      `        </ds:Reference>`,
      `      </ds:SignedInfo>`,
    ].join('\n')

    // naša poročana kanonična oblika == ročna pričakovana
    expect(signed.signedInfoCanonical).toBe(expectedCanonical)

    // NEODVISNA verifikacija podpisa z javnim ključem CERTIFIKATA (createVerify)
    const verifier = crypto.createVerify('RSA-SHA256')
    verifier.update(Buffer.from(expectedCanonical, 'utf8'))
    const sigBuf = Buffer.from(signed.signatureValue, 'base64')
    expect(verifier.verify(CERT_PEM, sigBuf)).toBe(true)
  })

  it('podpis je odvisen od ključa — drug ključ NE verificira', () => {
    const keyPem = genKeyPem()
    const res = buildRacunZahtjev(baseData, keyPem, { now: FIXED_NOW })
    const signed = signRacunZahtjev(res.envelope, { certificatePem: CERT_PEM, privateKeyPem: keyPem })

    const verifier = crypto.createVerify('RSA-SHA256')
    verifier.update(Buffer.from(signed.signedInfoCanonical, 'utf8'))
    expect(verifier.verify(OTHER_KEY_PEM, Buffer.from(signed.signatureValue, 'base64'))).toBe(false)
  })

  it('podpis je odvisen od vsebine — spremenjen digest (drugi račun) NE verificira', () => {
    const keyPem = genKeyPem()
    const a = buildRacunZahtjev(baseData, keyPem, { now: FIXED_NOW })
    const b = buildRacunZahtjev({ ...baseData, iznosUkupno: '16.00' }, keyPem, { now: FIXED_NOW })
    const signedA = signRacunZahtjev(a.envelope, { certificatePem: CERT_PEM, privateKeyPem: keyPem })

    const verifier = crypto.createVerify('RSA-SHA256')
    verifier.update(Buffer.from(signedA.signedInfoCanonical.replace(a.idPoruke, b.idPoruke), 'utf8'))
    expect(verifier.verify(keyPem, Buffer.from(signedA.signatureValue, 'base64'))).toBe(false)
  })

  it('determinizem: isti vhod + isti ključ → identičen podpis (RSA PKCS#1 v1.5 je determinističen); now ne vpliva', () => {
    const { envelope, keyPem } = buildUnsigned()
    const a = signRacunZahtjev(envelope, { certificatePem: CERT_PEM, privateKeyPem: keyPem })
    const b = signRacunZahtjev(envelope, { certificatePem: CERT_PEM, privateKeyPem: keyPem, now: new Date('2030-06-01T00:00:00Z') })
    expect(a.envelope).toBe(b.envelope)
    expect(a.signatureValue).toBe(b.signatureValue)
  })
})

describe('Struktura podpisanega envelope-a', () => {
  it('ds:Signature je ZADNJI otrok tns:RacunZahtjev (takoj pred zaključno značko)', () => {
    const { envelope, keyPem } = buildUnsigned()
    const signed = signRacunZahtjev(envelope, { certificatePem: CERT_PEM, privateKeyPem: keyPem })
    // zapiralna značka Signature je PRILEPLJENA na zaključno značko RacunZahtjev,
    // za njo pa sledita še zapiralni soap:Body in soap:Envelope
    expect(signed.envelope).toContain('</ds:Signature></tns:RacunZahtjev>')
    const idxSigClose = signed.envelope.indexOf('</ds:Signature>')
    const idxRacunClose = signed.envelope.indexOf('</tns:RacunZahtjev>')
    const idxBodyClose = signed.envelope.indexOf('</soap:Body>')
    expect(idxSigClose).toBeGreaterThan(-1)
    expect(idxRacunClose).toBeGreaterThan(idxSigClose)
    expect(idxBodyClose).toBeGreaterThan(idxRacunClose)
    // Signature je znotraj RacunZahtjev (po zadnjem </tns:Racun>)
    expect(signed.envelope.lastIndexOf('<ds:Signature')).toBeGreaterThan(signed.envelope.lastIndexOf('</tns:Racun>'))
  })

  it('vsi algorithm URI-ji so točni (exc-c14n, rsa-sha256, sha256, enveloped)', () => {
    const { envelope, keyPem } = buildUnsigned()
    const signed = signRacunZahtjev(envelope, { certificatePem: CERT_PEM, privateKeyPem: keyPem })
    expect(signed.envelope).toContain(`<ds:CanonicalizationMethod Algorithm="${CIS_ALG_CANONICALIZATION}"/>`)
    expect(signed.envelope).toContain(`<ds:SignatureMethod Algorithm="${CIS_ALG_RSA_SHA256}"/>`)
    expect(signed.envelope).toContain(`<ds:DigestMethod Algorithm="${CIS_ALG_SHA256_DIGEST}"/>`)
    expect(signed.envelope).toContain(`<ds:Transform Algorithm="${CIS_ALG_ENVELOPED}"/>`)
    expect(signed.envelope).toContain(`<ds:Transform Algorithm="${CIS_ALG_CANONICALIZATION}"/>`)
  })

  it('Reference URI = "#Id"; enveloped transform pride PRED exc-c14n', () => {
    const { envelope, keyPem } = buildUnsigned()
    const id = locateRacunZahtjev(envelope).id
    const signed = signRacunZahtjev(envelope, { certificatePem: CERT_PEM, privateKeyPem: keyPem })
    expect(signed.envelope).toContain(`<ds:Reference URI="#${id}">`)
    const idxEnv = signed.envelope.indexOf(CIS_ALG_ENVELOPED)
    const idxExc = signed.envelope.indexOf(CIS_ALG_CANONICALIZATION, idxEnv + 1)
    expect(idxEnv).toBeGreaterThan(0)
    expect(idxExc).toBeGreaterThan(idxEnv)
  })

  it('KeyInfo vsebuje base64 DER certifikata v eni vrstici (X509Certificate)', () => {
    const { envelope, keyPem } = buildUnsigned()
    const signed = signRacunZahtjev(envelope, { certificatePem: CERT_PEM, privateKeyPem: keyPem })
    const expectedB64 = CERT_PEM.replace(/-----(BEGIN|END) CERTIFICATE-----/g, '').replace(/\s+/g, '')
    expect(signed.envelope).toContain(`<ds:X509Certificate>${expectedB64}</ds:X509Certificate>`)
    // ena vrstica (brez whitespace znotraj base64)
    expect(signed.envelope).not.toMatch(/<ds:X509Certificate>[^<]*\n[^<]*<\/ds:X509Certificate>/)
  })

  it('xmlns:ds je deklariran na ds:Signature; SignedInfo/SignatureValue/KeyInfo v pravilnem redu', () => {
    const { envelope, keyPem } = buildUnsigned()
    const signed = signRacunZahtjev(envelope, { certificatePem: CERT_PEM, privateKeyPem: keyPem })
    expect(signed.envelope).toContain(`<ds:Signature xmlns:ds="${CIS_XMLDSIG_NS}">`)
    const sigStart = signed.envelope.indexOf('<ds:Signature')
    const order = ['<ds:SignedInfo>', '<ds:SignatureValue>', '<ds:KeyInfo>'].map((t) => signed.envelope.indexOf(t, sigStart))
    expect(order.every((i) => i > 0)).toBe(true)
    expect([...order].sort((x, y) => x - y)).toEqual(order)
  })

  it('Id atribut RacunZahtjev == vrednost v Reference URI ( isti UUID poruke)', () => {
    const { envelope, keyPem } = buildUnsigned()
    const id = locateRacunZahtjev(envelope).id
    const signed = signRacunZahtjev(envelope, { certificatePem: CERT_PEM, privateKeyPem: keyPem })
    expect(signed.envelope).toContain(`Id="${id}"`)
    expect(signed.envelope).toContain(`URI="#${id}"`)
  })

  it('podpisan envelope ostane WELL-FORMED XML (DOMParser): Signature = zadnji element otrok', () => {
    const { envelope, keyPem } = buildUnsigned({ pdv: [{ stopa: '25.00', osnovica: '10.00', iznos: '2.50' }] })
    const signed = signRacunZahtjev(envelope, { certificatePem: CERT_PEM, privateKeyPem: keyPem })

    const doc = new DOMParser().parseFromString(signed.envelope, 'application/xml')
    expect(doc.querySelector('parsererror')).toBeNull()

    const racun = doc.getElementsByTagName('tns:RacunZahtjev')[0]
    expect(racun).toBeDefined()
    const lastChild = racun.lastElementChild
    expect(lastChild?.tagName).toBe('ds:Signature')
    // Signature ima točno 3 otroke v shematskem redu
    expect(Array.from(lastChild!.children).map((c) => c.tagName)).toEqual(['ds:SignedInfo', 'ds:SignatureValue', 'ds:KeyInfo'])
    // vsebina računa se ni spremenila (število otrok Racun ostaja)
    const racunNode = doc.getElementsByTagName('tns:Racun')[0]
    expect(racunNode.getElementsByTagName('tns:Porez').length).toBe(1)
    expect(racunNode.getElementsByTagName('tns:IznosUkupno').length).toBe(1)
  })
})

describe('Idempotenca (re-podpisovanje)', () => {
  it('signRacunZahtjev nad že podpisanim envelope-om → identičen rezultat', () => {
    const { envelope, keyPem } = buildUnsigned()
    const a = signRacunZahtjev(envelope, { certificatePem: CERT_PEM, privateKeyPem: keyPem })
    const b = signRacunZahtjev(a.envelope, { certificatePem: CERT_PEM, privateKeyPem: keyPem })
    expect(b.validation.valid).toBe(true)
    expect(b.envelope).toBe(a.envelope)
    expect(b.digestValue).toBe(a.digestValue)
    expect(b.signatureValue).toBe(a.signatureValue)
  })

  it('stari podpis z DRUGIM ključem se zamenja (re-podpis z novim ključem verificira novi ključ)', () => {
    const keyA = genKeyPem()
    const keyB = genKeyPem()
    const { envelope } = buildUnsigned({}, keyA)
    const signedA = signRacunZahtjev(envelope, { certificatePem: CERT_PEM, privateKeyPem: keyA })
    const signedB = signRacunZahtjev(signedA.envelope, { certificatePem: CERT_PEM, privateKeyPem: keyB })
    expect(signedB.validation.valid).toBe(true)
    expect(signedB.signatureValue).not.toBe(signedA.signatureValue)
    // samo EN ds:Signature element (štejemo samo odpiralne značke Signature,
    // ne SignatureValue/SignatureMethod, ki imajo isti prefix)
    expect(signedB.envelope.match(/<ds:Signature[ >]/g)?.length).toBe(1)
  })
})

describe('Napake (non-throwing, stil modula)', () => {
  it('XML brez RacunZahtjev → valid=false, prazen envelope, razumljiva napaka', () => {
    const res = signRacunZahtjev('<xml/>', { certificatePem: CERT_PEM, privateKeyPem: KEY_PEM })
    expect(res.validation.valid).toBe(false)
    expect(res.envelope).toBe('')
    expect(res.validation.errors[0]).toMatch(/RacunZahtjev/)
  })

  it('prazen XML → valid=false', () => {
    const res = signRacunZahtjev('', { certificatePem: CERT_PEM, privateKeyPem: KEY_PEM })
    expect(res.validation.valid).toBe(false)
    expect(res.envelope).toBe('')
  })

  it('slab zasebni ključ → valid=false (brez tihega fallbacka)', () => {
    const { envelope } = buildUnsigned({}, genKeyPem())
    const res = signRacunZahtjev(envelope, { certificatePem: CERT_PEM, privateKeyPem: 'not-a-key' })
    expect(res.validation.valid).toBe(false)
    expect(res.envelope).toBe('')
    expect(res.validation.errors[0]).toMatch(/ključ/i)
  })

  it('javni ključ namesto zasebnega → valid=false', () => {
    const { envelope } = buildUnsigned({}, genKeyPem())
    const res = signRacunZahtjev(envelope, { certificatePem: CERT_PEM, privateKeyPem: PUBLIC_PEM })
    expect(res.validation.valid).toBe(false)
  })

  it('pokvarjen certifikat (PEM oblika, smeti v DER) → valid=false', () => {
    const { envelope, keyPem } = buildUnsigned()
    const fakeCert = '-----BEGIN CERTIFICATE-----\nZNNOTAREALCERT==\n-----END CERTIFICATE-----'
    const res = signRacunZahtjev(envelope, { certificatePem: fakeCert, privateKeyPem: keyPem })
    expect(res.validation.valid).toBe(false)
    expect(res.validation.errors[0]).toMatch(/DER|CERTIFICATE/i)
  })

  it('manjkajoč certifikat ali ključ → valid=false', () => {
    const { envelope, keyPem } = buildUnsigned()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r1 = signRacunZahtjev(envelope, { privateKeyPem: keyPem } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r2 = signRacunZahtjev(envelope, { certificatePem: CERT_PEM } as any)
    expect(r1.validation.valid).toBe(false)
    expect(r2.validation.valid).toBe(false)
  })
})

describe('P12 → PEM (loadCisP12) + round-trip', () => {
  it('odpre fixture P12 in vrne oba PEM-a; ključ res podpiše', () => {
    const pems = loadCisP12(P12_PATH, P12_PASSWORD)
    expect(pems).not.toBeNull()
    expect(pems!.privateKeyPem).toContain('PRIVATE KEY')
    expect(pems!.certificatePem).toContain('BEGIN CERTIFICATE')

    const { envelope } = buildUnsigned({}, pems!.privateKeyPem)
    const signed = signRacunZahtjev(envelope, { certificatePem: pems!.certificatePem, privateKeyPem: pems!.privateKeyPem })
    expect(signed.validation.valid).toBe(true)

    const verifier = crypto.createVerify('RSA-SHA256')
    verifier.update(Buffer.from(signed.signedInfoCanonical, 'utf8'))
    expect(verifier.verify(pems!.certificatePem, Buffer.from(signed.signatureValue, 'base64'))).toBe(true)
  })

  it('sprejme tudi Buffer (vsebina P12)', () => {
    const buf = fs.readFileSync(P12_PATH)
    const pems = loadCisP12(buf, P12_PASSWORD)
    expect(pems).not.toBeNull()
    expect(pems!.certificatePem).toContain('BEGIN CERTIFICATE')
  })

  it('napačno geslo → null (non-throwing)', () => {
    expect(loadCisP12(P12_PATH, 'wrong-password')).toBeNull()
  })

  it('neobstoječa datoteka → null (non-throwing)', () => {
    expect(loadCisP12('/nonexistent/does-not-exist.p12', P12_PASSWORD)).toBeNull()
  })

  it('polna pipeline: buildRacunZahtjev → loadCisP12 → signRacunZahtjev → struktura + digest neodvisno', () => {
    const pems = loadCisP12(P12_PATH, P12_PASSWORD)!
    const built = buildRacunZahtjev(
      { ...baseData, pdv: [{ stopa: '25.00', osnovica: '12.00', iznos: '3.00' }] },
      pems.privateKeyPem,
      { now: FIXED_NOW }
    )
    expect(built.validation.valid).toBe(true)

    const signed = signRacunZahtjev(built.envelope, { certificatePem: pems.certificatePem, privateKeyPem: pems.privateKeyPem })
    expect(signed.validation.valid).toBe(true)
    expect(signed.validation.errors).toEqual([])

    // digest neodvisno (surovi fragment nepodpisanega envelope-a)
    const expectedDigest = crypto.createHash('sha256').update(handCanonical(false, built.envelope), 'utf8').digest('base64')
    expect(signed.digestValue).toBe(expectedDigest)

    // certifikat v KeyInfo == fixture cert (neodvisen strip)
    const expectedB64 = CERT_PEM.replace(/-----(BEGIN|END) CERTIFICATE-----/g, '').replace(/\s+/g, '')
    expect(signed.envelope).toContain(`<ds:X509Certificate>${expectedB64}</ds:X509Certificate>`)

    // ZKI (ZastKod) se ni spremenil s podpisom
    expect(signed.envelope).toContain(`<tns:ZastKod>${built.zki}</tns:ZastKod>`)
  })
})

describe('canonicalizeFragment (mini exc-c14n primitiv — direktni enoti testi)', () => {
  it('prazni elementi se razširijo v <x></x>', () => {
    const out = canonicalizeFragment('<a><b/></a>').toString('utf8')
    expect(out).toBe('<a><b></b></a>')
  })

  it('komentarji in PI se izpustijo; whitespace se ohrani', () => {
    // 2+2+2 = 6 presledkov pred <b> (vsa besedilna vozlišča ostanejo, samo
    // komentar/PI vozlišči izgineta)
    const out = canonicalizeFragment('<a>  <!-- komentar -->  <?pi x?>  <b>x</b>  </a>').toString('utf8')
    expect(out).toBe('<a>      <b>x</b>  </a>')
  })

  it('atributi: namespace deklaracije prve (po prefixu), ostali po imenu; self-closing razširjen', () => {
    const out = canonicalizeFragment('<root b="2" xmlns:p="urn:x" p:x="9" a="1"><c/></root>').toString('utf8')
    expect(out).toBe('<root xmlns:p="urn:x" a="1" b="2" p:x="9"><c></c></root>')
  })

  it('izpitni namespacei (exc-c14n visibly-utilized): neuporabljen xmlns izpade iz fragmenta', () => {
    // p ni uporabljen nikjer → deklaracija izpade (enako exc-c14n)
    const out = canonicalizeFragment('<root xmlns:p="urn:x" xmlns:q="urn:y"><q:x/></root>').toString('utf8')
    expect(out).toBe('<root xmlns:q="urn:y"><q:x></q:x></root>')
  })

  it('rootNamespaces se vstavijo na koren, če so uporabljeni in še niso deklarirani', () => {
    const out = canonicalizeFragment('<ds:SignedInfo><ds:X/></ds:SignedInfo>', {
      rootNamespaces: { ds: 'http://www.w3.org/2000/09/xmldsig#' },
    }).toString('utf8')
    expect(out).toBe('<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:X></ds:X></ds:SignedInfo>')
  })

  it('besedilo: &quot; → ", &amp; ostane &amp;, &lt; ostane &lt; (c14n besedilna pravila)', () => {
    const out = canonicalizeFragment('<t>&quot;abc&quot; &amp; &lt;x&gt; &apos;y&apos;</t>').toString('utf8')
    expect(out).toBe('<t>"abc" &amp; &lt;x&gt; \'y\'</t>')
  })

  it('neznana entiteta → napaka (kontroliran niz)', () => {
    expect(() => canonicalizeFragment('<t>&nbsp;</t>')).toThrow(/entiteta/)
  })

  it('c14n escape atributa: & < " TAB/LF/CR', () => {
    const out = canonicalizeFragment('<a x="p&amp;q&lt;r&quot;s&#x9;u"/>').toString('utf8')
    expect(out).toBe('<a x="p&amp;q&lt;r&quot;s&#x9;u"></a>')
  })
})

describe('pemToBase64Der + locateRacunZahtjev', () => {
  it('pemToBase64Der: odstrani header/footer in whitespace; neodvisno preverjen', () => {
    const expected = CERT_PEM.split('\n').filter((l) => !l.includes('CERTIFICATE') && l.trim()).join('')
    expect(pemToBase64Der(CERT_PEM)).toBe(expected)
    expect(pemToBase64Der(CERT_PEM)).toMatch(/^[A-Za-z0-9+/=]+$/)
  })

  it('pemToBase64Der brez PEM bloka → napaka', () => {
    expect(() => pemToBase64Der('smeti')).toThrow(/PEM/)
  })

  it('locateRacunZahtjev: najde Id in lego; brez Id → napaka', () => {
    const { envelope } = buildUnsigned()
    const loc = locateRacunZahtjev(envelope)
    expect(loc.id).toMatch(/^[a-f0-9-]{36}$/)
    expect(envelope.slice(loc.openStart, loc.openStart + 17)).toBe('<tns:RacunZahtjev')
    expect(() => locateRacunZahtjev('<tns:RacunZahtjev xmlns:tns="u">x</tns:RacunZahtjev>')).toThrow(/Id/)
  })
})
