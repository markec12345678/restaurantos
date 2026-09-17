// ============================================
// CIS ECHO — povezljivostni klic (brez odjemalskega certifikata)
// ============================================
// Zrcali furs/helpers/validation.ts checkFursConnectivity(), ampak z ŽIVIM
// SOAP POST-om (CIS odgovarja brez mTLS — podpis je v XML Body, ne na TLS).
//
// TLS: testno okolje uporablja PRIVATNO Fina Demo CA (bundle inlined v
// demo-ca.ts — javni certifikati); produkcija ima javno CA verigo.
// Transport (bun ↔ Node) rešuje src/lib/cis/transport.ts.
//
// Strategija klasifikacije odgovora:
//   1. echoed=true  → odgovor vsebuje naš echo niz (polna runda)
//   2. reachable=true → katerikoli SOAP/XML odgovor (tudi s006 sistemska
//      napaka — strežnik je ŽIV in podpisuje)
//   3. reachable=false → mrežna napaka / timeout / ne-SOAP odgovor
// ============================================

import { logger } from '@/lib/logger'
import type { CisConnectivityResult, CisEnvironment } from './types'
import { CIS_URLS, CIS_SOAP_NS, CIS_NS, CIS_CONNECTIVITY_TIMEOUT_MS } from './constants'
import { CIS_TEST_CA_PEM } from './demo-ca'
import { CIS_PROD_CA_PEM } from './prod-ca'
import { soapPost } from './transport'

/** Zgradi EchoRequest envelope (plain string echo po klasični APIS-IT spec). */
export function buildCisEchoEnvelope(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${CIS_SOAP_NS}" xmlns:fu="${CIS_NS}">
  <soapenv:Body>
    <fu:EchoRequest>${message}</fu:EchoRequest>
  </soapenv:Body>
</soapenv:Envelope>`
}

/** Izlušči sistemsko napako s00x iz CIS odgovora (če obstaja). */
export function extractCisErrorCode(xml: string): string | undefined {
  const match = /\bs(\d{3})\b/.exec(xml)
  return match ? `s${match[1]}` : undefined
}

/**
 * Preveri povezljivost s CIS strežnikom (Echo round-trip, brez certifikata).
 * Non-throwing — vedno vrne rezultat.
 */
export async function checkCisConnectivity(
  environment: CisEnvironment,
  options: { timeoutMs?: number } = {}
): Promise<CisConnectivityResult> {
  const url = CIS_URLS[environment]
  const echoMessage = `restaurantos-ping-${Date.now()}`
  const start = Date.now()

  try {
    // TLS trust anchor per okolje: test = Fina Demo CA bundle (privatna demo
    // hierarhija); produkcija = Fina RDC 2020 intermediate (prod strežnik NE
    // pošilja intermediate-a v handshake → verify code 21 brez njega).
    const ca = environment === 'test' ? CIS_TEST_CA_PEM : CIS_PROD_CA_PEM
    const { status, body } = await soapPost(
      url,
      buildCisEchoEnvelope(echoMessage),
      { 'Content-Type': 'application/soap+xml; charset=utf-8' },
      {
        ca,
        timeoutMs: options.timeoutMs ?? CIS_CONNECTIVITY_TIMEOUT_MS,
      }
    )

    const responseTime = Date.now() - start
    const echoed = body.includes(echoMessage)
    const serverErrorCode = extractCisErrorCode(body)

    // SOAP odgovor (tudi s006) = strežnik živ; ne-SOAP (npr. HTML) = neveljaven
    const looksLikeSoap =
      body.includes('soap') || body.includes('Envelope') || serverErrorCode !== undefined

    return {
      reachable: looksLikeSoap,
      echoed,
      responseTime,
      httpStatus: status,
      serverErrorCode,
      error: looksLikeSoap
        ? undefined
        : `Nepričakovan odgovor (HTTP ${status}, ${body.length} B)`,
    }
  } catch (err: unknown) {
    logger.warn(
      'CIS',
      `Echo klic neuspešen (${environment}):`,
      err instanceof Error ? err.message : String(err)
    )
    return {
      reachable: false,
      echoed: false,
      error: err instanceof Error ? err.message : 'Neznana napaka',
    }
  }
}
