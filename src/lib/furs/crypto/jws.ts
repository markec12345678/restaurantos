// ============================================
// FURS JWS TOKEN — RFC 7515 (poglavje 8 tehnične dokumentacije v3.2)
//
// Uradni JSON API FURS NE uporablja OAuth2 tokengrant endpointa!
// Sporočilo se pošlje kot { "token": "<JWT>" }, kjer je JWT:
//   BASE64URL(JWS Protected Header) || '.' ||
//   BASE64URL(JWS Payload)          || '.' ||
//   BASE64URL(JWS Signature)
//
// JWS Protected Header (EXACTNO per spec):
//   { "alg": "RS256",
//     "subject_name": <DN nosilca certifikata — Java X500Principal format>,
//     "issuer_name":  <DN izdajatelja certifikata>,
//     "serial":       <serijska številka certifikata> }
//
// JWS Payload = VSEBINA sporočila (InvoiceRequest / EchoRequest / ...).
// Podpis = RSA PKCS#1 v1.5 s SHA-256 nad "header.payload".
//
// Reference (testni certifikat ITM STORITVE, OU=99999862):
//   subject_name: "CN=ITM STORITVE\\, SPELA PERGAR S.P.,2.5.4.5=#130131,OU=99999862,OU=DavPotRacTEST,O=state-institutions,C=SI"
//   issuer_name:  "CN=Tax CA Test,O=state-institutions,C=SI"
//   serial:       2575988469811686647
// ============================================

import crypto from 'crypto'
import { execFileSync } from 'child_process'
import fs from 'fs'
import { logger } from '../../logger'

export interface CertIdentity {
  /** DN nosilca (Java X500Principal format — obraten vrstni red RDN, brez presledkov) */
  subjectName: string
  /** DN izdajatelja */
  issuerName: string
  /** Serijska številka certifikata (decimalno) */
  serial: string
}

/**
 * Izlušči identiteto certifikata iz PKCS12 (subject/issuer/serial) z OpenSSL.
 *
 * Openssl izpis:  subject=C = SI, O = state-institutions, OU = 99999862, CN = ...
 * Spec zahteva:   CN=...,OU=99999862,O=state-institutions,C=SI (obratno, brez presledkov)
 */
export function extractCertIdentity(certPath: string, password: string): CertIdentity | null {
  try {
    if (!fs.existsSync(certPath)) {
      logger.error('FURS', `Datoteka certifikata ne obstaja: ${certPath}`)
      return null
    }
    // 1. Izvleči PEM certifikat iz PKCS12 (samo leaf cert, brez ključa)
    const certPem = execFileSync('openssl', [
      'pkcs12', '-in', certPath, '-clcerts', '-nokeys',
      '-passin', `pass:${password}`,
    ], { encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] })

    if (!certPem.includes('BEGIN CERTIFICATE')) {
      // Morda je vhod že PEM — poskusi neposredno
      if (certPath.endsWith('.pem') || certPath.endsWith('.crt') || certPath.endsWith('.cer')) {
        return identityFromPem(fs.readFileSync(certPath, 'utf8'))
      }
      logger.error('FURS', 'OpenSSL ni vrnil certifikata iz PKCS12')
      return null
    }
    return identityFromPem(certPem)
  } catch (err: unknown) {
    logger.error('FURS', 'Napaka pri ekstrakciji identitete certifikata:', err)
    return null
  }
}

/** Iz PEM certifikata izlušči DN-je + serial in jih formatiraj per spec. */
export function identityFromPem(certPem: string): CertIdentity | null {
  try {
    // Podaj PEM prek stdin (prepreči injection poti/arg.)
    const out = execFileSync('openssl', ['x509', '-noout', '-subject', '-issuer', '-serial'], {
      input: certPem,
      encoding: 'utf8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const subjectMatch = out.match(/^subject=(.*)$/m)
    const issuerMatch = out.match(/^issuer=(.*)$/m)
    const serialMatch = out.match(/^serial=([0-9A-Fa-f]+)$/m)
    if (!subjectMatch || !issuerMatch || !serialMatch) {
      logger.error('FURS', 'OpenSSL x509 ni vrnil subject/issuer/serial')
      return null
    }
    return {
      subjectName: formatDn(subjectMatch[1]),
      issuerName: formatDn(issuerMatch[1]),
      // serijska v hexadecimalu → decimalno (spec primer je decimalen)
      serial: BigInt('0x' + serialMatch[1]).toString(),
    }
  } catch (err: unknown) {
    logger.error('FURS', 'Napaka pri branju identitete certifikata:', err)
    return null
  }
}

/**
 * Pretvori openssl DN izpis ("C = SI, O = state-institutions, OU = 99999862, CN = X\, Y")
 * v Java X500Principal format spec ("CN=X\,Y,OU=99999862,O=state-institutions,C=SI"):
 *   1. obrni vrstni red RDN-jev,
 *   2. odstrani presledke okoli ločil "=" in ",",
 *   3. ohrani escaping vejic znotraj vrednosti (openssl izpiše "CN = X\, Y" ...).
 */
export function formatDn(opensslDn: string): string {
  // Split po vejicah, ki NISO escape-ane z backslash
  const rdns: string[] = []
  let current = ''
  for (let i = 0; i < opensslDn.length; i++) {
    const ch = opensslDn[i]
    if (ch === '\\' && i + 1 < opensslDn.length) {
      current += ch + opensslDn[i + 1]
      i++
      continue
    }
    if (ch === ',') {
      rdns.push(current)
      current = ''
      continue
    }
    current += ch
  }
  rdns.push(current)

  const clean = rdns
    .map(rdn => {
      const eq = rdn.indexOf('=')
      if (eq < 0) return rdn.trim()
      const key = rdn.slice(0, eq).trim()
      //(odstrani presledke znotraj vrednosti le ob robovih, NE v sredini imen)
      const value = rdn.slice(eq + 1).trim()
      return `${key}=${value}`
    })
    .filter(rdn => rdn.length > 0)

  return clean.reverse().join(',')
}

/** Base64URL kodiranje (RFC 7515) brez paddinga. */
export function b64url(input: Buffer | string): string {
  return Buffer.from(input as never).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Base64URL dekodiranje. */
export function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4))
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

/**
 * Zgradi JWS token ({"alg":"RS256",...} + payload + RS256 podpis).
 *
 * @param identity  identiteta certifikata (subject_name/issuer_name/serial)
 * @param privateKeyPem  privatni ključ certifikata (PEM)
 * @param payload   VSEBINA sporočila (objekt — JSON.stringify)
 * @returns JWT string (header.payload.signature)
 */
export function buildFursJws(
  identity: CertIdentity,
  privateKeyPem: string | Buffer,
  payload: Record<string, unknown>,
): string {
  const header = {
    alg: 'RS256',
    subject_name: identity.subjectName,
    issuer_name: identity.issuerName,
    serial: Number(identity.serial), // spec primer: številka (ne niz)
  }

  const headerB64 = b64url(JSON.stringify(header))
  // Pomembno: payload se serializira BREZ presledkov? Ne — spec primer ima
  // pretty-printed JSON (\n + 2 presledki). FURS sprejme poljuben veljaven JSON;
  // podpis pokriva točno poslane bajte, zato je format prost.
  const payloadB64 = b64url(JSON.stringify(payload))
  const signingInput = `${headerB64}.${payloadB64}`

  const signer = crypto.createSign('RSA-SHA256')
  signer.update(signingInput)
  const signature = signer.sign(privateKeyPem)
  const signatureB64 = b64url(signature)

  return `${headerB64}.${payloadB64}.${signatureB64}`
}

/**
 * Preveri in dekodiraj odgovor FURS {"token": "<JWT>"}.
 * Vrne { header, payload, valid } — valid=true, če podpis velja javnemu
 * ključu iz header.x5c (certifikat FURS za podpisovanje odgovorov).
 */
export function verifyFursJws(token: string): {
  header: { alg?: string; x5c?: string[]; [k: string]: unknown }
  payload: Record<string, unknown>
  valid: boolean
  error?: string
} {
  const parts = token.split('.')
  if (parts.length !== 3) {
    return { header: {}, payload: {}, valid: false, error: 'JWT nima treh delov' }
  }
  let header: Record<string, unknown>
  let payload: Record<string, unknown>
  try {
    header = JSON.parse(b64urlDecode(parts[0]).toString('utf8'))
    payload = JSON.parse(b64urlDecode(parts[1]).toString('utf8'))
  } catch (err: unknown) {
    return { header: {}, payload: {}, valid: false, error: `JWT dekodiranje: ${err instanceof Error ? err.message : String(err)}` }
  }

  // Podpis preveri z javnim ključem iz x5c (FURS prilaga svoj certifikat)
  const x5c = Array.isArray(header.x5c) ? (header.x5c as string[]) : null
  if (!x5c || x5c.length === 0) {
    return { header, payload, valid: false, error: 'Odgovor brez x5c certifikata' }
  }
  try {
    const certDer = Buffer.from(x5c[0], 'base64')
    const certPem = `-----BEGIN CERTIFICATE-----\n${certDer.toString('base64').replace(/(.{64})/g, '$1\n')}\n-----END CERTIFICATE-----\n`
    const publicKey = crypto.createPublicKey(certPem)
    const verifier = crypto.createVerify('RSA-SHA256')
    verifier.update(`${parts[0]}.${parts[1]}`)
    const valid = verifier.verify(publicKey, b64urlDecode(parts[2]))
    return { header, payload, valid }
  } catch (err: unknown) {
    return { header, payload, valid: false, error: `Preverjanje podpisa: ${err instanceof Error ? err.message : String(err)}` }
  }
}
