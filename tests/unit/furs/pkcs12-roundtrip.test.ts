// ============================================
// FURS PKCS12 ROUNDTRIP — nalagalnik certifikatov z REALNO p12 datoteko
//
// V repu NE hranimo p12 (privatni ključi ne sodijo v git). Test ob zagonu
// GENERIRA p12 z openssl (enaka struktura kot FURS namensko potrdilo:
// RSA 2048, PKCS#12, geslo) in validira:
//   1. loadFromPKCS12 (OpenSSL CLI pot — primarna v produkciji)
//   2. tryNodeCryptoPKCS12 (Node crypto fallback)
//   3. extractCertIdentity — JWS subject/issuer/serial iz p12
//   4. Ključ je RSA in zmožen RS256 podpisa (potrebno za JWS)
// ============================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFileSync } from 'child_process'
import { loadFromPKCS12, tryNodeCryptoPKCS12 } from '../../../src/lib/furs/crypto/pkcs12-loader'
import { extractCertIdentity } from '../../../src/lib/furs/crypto/jws'

const PASSWORD = 'FursTestPass123!'
const SUBJECT = '/C=SI/O=state-institutions/OU=DavPotRacTEST/OU=99999862/CN=TESTNA OSEBA 1'

describe('FURS PKCS12 roundtrip (generiran p12 — struktura FURS certifikata)', () => {
  let tmpDir: string
  let p12Path: string
  let expectedKeyPem: string

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'furs-p12-'))

    // 1. RSA ključ + samopodpisan certifikat (enak DN format kot FURS test certi)
    const keyFile = path.join(tmpDir, 'key.pem')
    const certFile = path.join(tmpDir, 'cert.pem')
    execFileSync('openssl', ['req', '-new', '-x509', '-newkey', 'rsa:2048',
      '-keyout', keyFile, '-out', certFile, '-days', '365', '-nodes',
      '-subj', SUBJECT], { timeout: 30000 })
    expectedKeyPem = fs.readFileSync(keyFile, 'utf8')

    // 2. Zapakiraj v PKCS#12 z geslom (krajši MAC/SHA — kompatibilno z Node crypto)
    p12Path = path.join(tmpDir, 'furs-test.p12')
    execFileSync('openssl', ['pkcs12', '-export',
      '-in', certFile, '-inkey', keyFile, '-out', p12Path,
      '-passout', `pass:${PASSWORD}`, '-name', 'DavPotRacTEST-LOCAL',
      '-macalg', 'sha1', '-keypbe', 'AES-256-CBC', '-certpbe', 'AES-256-CBC'], { timeout: 30000 })
  })

  afterAll(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('p12 datoteka je veljaven PKCS#12 (openssl pkcs12 -info)', () => {
    const out = execFileSync('openssl', ['pkcs12', '-in', p12Path, '-info', '-nokeys',
      '-passin', `pass:${PASSWORD}`], { encoding: 'utf8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] })
    expect(out).toContain('BEGIN CERTIFICATE')
  })

  it('loadFromPKCS12 (OpenSSL CLI) izvleče privatni ključ, ki zmore RS256', () => {
    const key = loadFromPKCS12(p12Path, PASSWORD)
    expect(key).toBeTruthy()

    // Ključ je uporaben za RS256 podpis (JWS zahtevek FURS)
    const signer = crypto.createSign('RSA-SHA256')
    signer.update('header.payload')
    const signature = signer.sign(key!)
    expect(signature.length).toBeGreaterThan(0)

    // Javni ključ iz p12 preveri podpis (roundtrip)
    const certPem = execFileSync('openssl', ['pkcs12', '-in', p12Path, '-clcerts', '-nokeys',
      '-passin', `pass:${PASSWORD}`], { encoding: 'utf8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] })
    const publicKey = crypto.createPublicKey(certPem)
    const verifier = crypto.createVerify('RSA-SHA256')
    verifier.update('header.payload')
    expect(verifier.verify(publicKey, signature)).toBe(true)
  })

  it('loadFromPKCS12 z NAPAČNIM geslom vrne null (ne crash)', () => {
    const key = loadFromPKCS12(p12Path, 'napacno-geslo')
    // OpenSSL fallback veriga: CLI napaka → Node crypto fallback (ta prav tako
    // odpoveduje z napačnim geslom) → null
    expect(key).toBeNull()
  })

  it('tryNodeCryptoPKCS12 ne crasha (Node crypto ne bere modernih AES-256-CBC p12)', () => {
    // Node crypto.createPrivateKey NE podpira PKCS12 vsebnikov — fallback je
    // best-effort (vrne null na modernih p12; OpenSSL CLI je PRIMARNA pot in
    // je preverjena v testu zgoraj). Glavni namen: NE crash.
    const key = tryNodeCryptoPKCS12(p12Path, PASSWORD)
    if (key) {
      const keyObject = crypto.createPrivateKey({ key: key as string, format: 'pem' })
      expect(keyObject.asymmetricKeyType).toBe('rsa')
    } else {
      expect(key).toBeNull() // pričakovano na modernih p12 — OpenSSL CLI prevzame
    }
  })

  it('extractCertIdentity iz p12 vrne JWS identiteto (subject/issuer/serial)', () => {
    const identity = extractCertIdentity(p12Path, PASSWORD)
    expect(identity).not.toBeNull()
    expect(identity!.subjectName).toContain('CN=TESTNA OSEBA 1')
    expect(identity!.subjectName).toContain('OU=DavPotRacTEST')
    expect(identity!.subjectName).toContain('C=SI')
    expect(identity!.issuerName).toContain('CN=TESTNA OSEBA 1') // samopodpisan → issuer = subject
    expect(identity!.serial).toMatch(/^\d+$/)
  })

  it('extractCertIdentity z napačnim geslom vrne null', () => {
    expect(extractCertIdentity(p12Path, 'wrong')).toBeNull()
  })

  it('ekstrahirani ključ podpiše JWS, ki ga javni ključ preveri', async () => {
    const { buildFursJws } = await import('../../../src/lib/furs/crypto/jws')
    const key = loadFromPKCS12(p12Path, PASSWORD)
    const identity = extractCertIdentity(p12Path, PASSWORD)
    expect(key).toBeTruthy()
    expect(identity).not.toBeNull()

    const jwt = buildFursJws(identity!, key as string, { EchoRequest: 'test 1' })
    const [h, p, s] = jwt.split('.')

    const certPem = execFileSync('openssl', ['pkcs12', '-in', p12Path, '-clcerts', '-nokeys',
      '-passin', `pass:${PASSWORD}`], { encoding: 'utf8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] })
    const publicKey = crypto.createPublicKey(certPem)
    const verifier = crypto.createVerify('RSA-SHA256')
    verifier.update(`${h}.${p}`)
    const sigBuf = Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
    expect(verifier.verify(publicKey, sigBuf)).toBe(true)
  })
})
