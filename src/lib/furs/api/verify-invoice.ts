// ============================================
// FURS API — Overitev računa
// Pošlji račun na FURS strežnik za overitev
//
// SPEC COMPLIANCE (Tehnična dokumentacija v3.2 — poglavje 8, 9.1):
//   1. Dvosmerna TLS (mTLS): odjemalški certifikat v TLS seji (od v1.3 spec)
//   2. Sporočilo: POST {"token": "<JWT>"} na /v1/cash_registers/invoices
//      JWT = JWS(RFC7515): header {alg, subject_name, issuer_name, serial}
//      + payload (InvoiceRequest) + RS256 podpis s certifikatnim ključem
//   3. Odgovor: {"token": "<JWT>"} z x5c (certifikat FURS) — preveri podpis
//      in izlušči EOR iz payloada
//
// Prej (NAPAČNO): OAuth2 client_credentials na izmišljenem /oauth/token
// endpointu + Bearer header + surova JSON telo — spec tega ne pozna.
// ============================================

import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { logger } from '../../logger'
import { METRICS, incCounter, observeHistogram } from '../../observability/metrics'
import type { FursConfig, FursInvoiceData, FursVerificationResult } from '../types'
import { FURS_URLS } from '../types'
import { generateSimulatedEOR } from '../helpers'
import { loadCertificatePrivateKey } from '../crypto'
import { extractCertIdentity, buildFursJws, verifyFursJws } from '../crypto/jws'
import { buildFursRequest } from './build-request'

// ============================================
// mTLS — dvosmerna TLS (spec poglavje 2, od v1.3)
// FURS strežnik ZAHTEVA odjemalški certifikat (TLS Request CERT —
// preverjeno živo na blagajne-test.fu.gov.si:9002).
// Node fetch (undici) podpira dispatcher Agent s cert/key.
// ============================================

/** Izvleči PEM certifikat (leaf) iz PKCS12 za TLS odjemalško stran. */
function extractClientCertPem(certPath: string, password: string): string | null {
  try {
    const pem = execFileSync('openssl', [
      'pkcs12', '-in', certPath, '-clcerts', '-nokeys',
      '-passin', `pass:${password}`,
    ], { encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] })
    return pem.includes('BEGIN CERTIFICATE') ? pem : null
  } catch {
    return null
  }
}

/** CA veriga za preverjanje FURS strežnika (SI-TRUST Root + SIGOV-CA). */
function loadServerCaBundle(): string[] {
  const caPaths = [
    path.join(process.cwd(), 'certs', 'furs-test', 'si-trust-root.crt'),
    path.join(process.cwd(), 'certs', 'furs-test', 'sigov-ca.crt'),
  ]
  const cas: string[] = []
  for (const p of caPaths) {
    try {
      if (fs.existsSync(p)) cas.push(fs.readFileSync(p, 'utf8'))
    } catch { /* brezpomembno — fallback na sistemske CA */ }
  }
  if (cas.length === 0) {
    logger.warn('FURS', 'CA veriga (certs/furs-test/*.crt) ni najdena — uporabljam sistemske CA (FURS: SIGOV-CA/SI-TRUST morda ni v sistemu)')
  }
  return cas
}

/** Pošlji POST prek undici fetch z mTLS agentom (ista instanca kot fetch!). */
async function fursFetch(url: string, body: string, certPem: string | null, keyPem: string | null, timeoutMs: number): Promise<Response> {
  // undici.fetch + Agent MORATA biti iz ISTE instance (npm undici ≠ interni
  // Node fetch — global fetch ne sprejema tujega dispatcherja).
  try {
    const undici = await import('undici')
    const cas = loadServerCaBundle()
    const agent = new undici.Agent({
      connect: {
        ...(certPem && keyPem ? { cert: certPem, key: keyPem } : {}),
        ...(cas.length > 0 ? { ca: cas } : {}),
        // FURS: TLS 1.2/1.3 (spec 2.x); rejectUnauthorized drži (NE izklopi!)
        rejectUnauthorized: true,
      },
    })
    return await undici.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body,
      dispatcher: agent,
      signal: AbortSignal.timeout(timeoutMs),
    }) as unknown as Response
  } catch (err: unknown) {
    logger.error('FURS', 'mTLS undici Agent ni na voljo — fallback na global fetch (strežnik bo zahteval odjemalški certifikat):', err)
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    })
  }
}

/**
 * Pošlji račun na FURS strežnik za overitev (JWS + mTLS).
 *
 * FURS API specifikacija (JSON oblika, poglavje 8):
 * - HTTP POST na /v1/cash_registers/invoices
 * - Telo: {"token": "<JWT>"} — JWT vsebuje CEL InvoiceRequest
 * - Dvosmerna TLS s certifikatom zavezanca
 * - Odgovor: {"token": "<JWT>"} — EOR v payloadu, x5c v headerju
 */
export async function verifyInvoiceWithFURS(
  config: FursConfig,
  invoiceData: FursInvoiceData,
  zoi: string,
): Promise<FursVerificationResult> {
  const now = new Date()

  // P1-observability: merjenje latence FURS klica (vključno s simulacijo —
  // služi kot baseline; pravi klic doda mTLS + network)
  const __fursStart = Date.now()
  const trackFursResult = (result: FursVerificationResult): FursVerificationResult => {
    observeHistogram(METRICS.FURS_LATENCY, Date.now() - __fursStart)
    if (result.success) {
      incCounter(METRICS.FURS_SUCCESS)
    } else if (!result.isSimulation) {
      // NE štejmo simulacije kot FURS napake (ni napaka strežnika —
      // pomanjkanje certifikata v testnem okolju je pričakovano)
      incCounter(METRICS.FURS_ERRORS, 1, true)
    }
    return result
  }

  // Če ni certifikata, dovoli simulacijo SAMO če je FURS_ALLOW_SIMULATION=true
  if (!config.certPath || !config.certPassword) {
    if (process.env.FURS_ALLOW_SIMULATION === 'true') {
      logger.info('FURS', 'Brez certifikata — uporabljam simulirano overitev (FURS_ALLOW_SIMULATION=true)')
      // FIX HIGH: Simulirana overitev VRNE success=false, da klicalec NE označi računa kot fiscalVerified=true
      // Per ZDDV-1: simulirani račun NI davčno overjen — fiscalVerified MORA ostati false
      return trackFursResult({
        success: false,
        zoi,
        eor: generateSimulatedEOR(zoi, now),
        environment: config.environment,
        verifiedAt: now,
        isSimulation: true,
        error: 'FURS simulacija — račun NI davčno overjen. Nastavite certifikat za produkcijo.',
      })
    }
    logger.error('FURS', 'Brez certifikata in FURS_ALLOW_SIMULATION ni omogočen — overitev ni uspela')
    return trackFursResult({
      success: false,
      zoi,
      eor: '',
      environment: config.environment,
      verifiedAt: now,
      isSimulation: true,
      error: 'Manjka certifikat za FURS overitev. Nastavite FURS_ALLOW_SIMULATION=true za testni način.',
    })
  }

  try {
    // Korak 1: Naloži privatni ključ + identiteto certifikata (subject/issuer/serial)
    const privateKey = loadCertificatePrivateKey(config.certPath!, config.certPassword!)
    const identity = extractCertIdentity(config.certPath!, config.certPassword!)
    if (!privateKey || !identity) {
      logger.warn('FURS', 'Ne morem naložiti certifikata (ključ/identiteta) — overitev ni uspela')
      return {
        success: false,
        zoi,
        eor: '',
        environment: config.environment,
        verifiedAt: now,
        isSimulation: true,
        error: 'FURS certifikat ni berljiv (ključ ali identiteta) — preverite pot/geslo certifikata',
      }
    }

    // Korak 2: Zgradi JWS token (header + InvoiceRequest payload + RS256)
    const fursRequest = buildFursRequest(config, invoiceData, zoi)
    const jwt = buildFursJws(identity, privateKey, fursRequest)

    // Korak 3: mTLS — odjemalški cert + ključ (dvosmerna TLS, spec od v1.3)
    const clientCertPem = extractClientCertPem(config.certPath!, config.certPassword!)
    const keyPem = typeof privateKey === 'string' ? privateKey : null

    // Korak 4: POST {"token": "<JWT>"} na uradni invoices endpoint (JWS + mTLS)
    const fursUrl = FURS_URLS[config.environment]
    const response = await fursFetch(fursUrl, JSON.stringify({ token: jwt }), clientCertPem, keyPem, 30000)

    if (!response.ok) {
      const errorBody = await response.text()
      logger.error('FURS', `Napaka od strežnika: ${response.status}`, errorBody)
      return {
        success: false,
        zoi,
        eor: '',
        environment: config.environment,
        verifiedAt: now,
        isSimulation: false,
        error: `FURS strežnik je vrnil napako ${response.status}: ${errorBody}`,
      }
    }

    // Korak 5: Odgovor {"token": "<JWT>"} — dekodiraj in preveri podpis (x5c)
    const raw = await response.json() as { token?: string; eor?: string; EOR?: string; error?: { code: string; message: string } }

    if (raw.error) {
      logger.error('FURS', 'Napaka v odgovoru', raw.error)
      return {
        success: false,
        zoi,
        eor: '',
        environment: config.environment,
        verifiedAt: now,
        isSimulation: false,
        error: `FURS napaka: ${raw.error.code} — ${raw.error.message}`,
      }
    }

    if (!raw.token) {
      logger.error('FURS', 'Odgovor brez tokena', JSON.stringify(raw).slice(0, 500))
      return {
        success: false,
        zoi,
        eor: '',
        environment: config.environment,
        verifiedAt: now,
        isSimulation: false,
        error: 'FURS odgovor ne vsebuje tokena (pričakovana oblika {"token":"JWT"})',
      }
    }

    // Preveri JWS podpis odgovora s certifikatom iz x5c (FURS-ov podpisni cert)
    const verified = verifyFursJws(raw.token)
    if (!verified.valid) {
      logger.error('FURS', 'Podpis odgovora NI veljaven:', verified.error)
      return {
        success: false,
        zoi,
        eor: '',
        environment: config.environment,
        verifiedAt: now,
        isSimulation: false,
        error: `FURS odgovor ima NEVELJAVEN podpis: ${verified.error ?? 'neznan vzrok'}`,
      }
    }

    // EOR je v payloadu odgovora (EchoResponse/InvoiceResponse struktura)
    const resp = verified.payload as {
      InvoiceResponse?: { EOR?: string; eor?: string }
      EOR?: string
      eor?: string
    }
    const eor = resp.InvoiceResponse?.EOR || resp.InvoiceResponse?.eor || resp.EOR || resp.eor || ''

    if (!eor) {
      logger.error('FURS', 'Odgovor brez EOR', JSON.stringify(verified.payload).slice(0, 500))
      return {
        success: false,
        zoi,
        eor: '',
        environment: config.environment,
        verifiedAt: now,
        isSimulation: false,
        error: 'FURS odgovor ne vsebuje EOR (Enotna oznaka računa)',
      }
    }

    return trackFursResult({
      success: true,
      zoi,
      eor,
      environment: config.environment,
      verifiedAt: now,
      isSimulation: false,
    })
  } catch (err: unknown) {
    logger.error('FURS', 'Napaka pri overjanju:', err)
    // FURS strežnik ni dosegljiv — vrni napako (ne tihe simulacije!)
    return trackFursResult({
      success: false,
      zoi,
      eor: '',
      environment: config.environment,
      verifiedAt: now,
      isSimulation: false, // FIX BUG-F9: Ni simulacija — strežnik je dejansko nedosegljiv
      error: `FURS strežnik ni dosegljiv: ${err instanceof Error ? err.message : String(err)}`,
    })
  }
}
