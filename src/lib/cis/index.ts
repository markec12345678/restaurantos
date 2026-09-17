// ============================================
// CIS — Hrvaška fiskalizacija (FINA / Porezna uprava)
// Barrel file — re-exports vse iz podmodulov
// ============================================
// STATUS (Task 26-a): Echo/povezljivost ŽIVA (Task 23) + ZKI in RacunZahtjev
// gradnja (Task 24-b) + XML-dsig enveloped podpis s FINA P12 (canonicalize
// + signRacunZahtjev + loadCisP12). Za polno oddajo računa še: POŠILJANJE
// podpisanega envelope-a prek transport.ts + parsing RacunOdgovor (JIR).
// Glej docs/ in worklog Task 23/24/26.
// ============================================

export type { CisEnvironment, CisConnectivityResult, CisConfigValidation } from './types'
export {
  CIS_URLS,
  CIS_SOAP_NS,
  CIS_NS,
  CIS_CONNECTIVITY_TIMEOUT_MS,
  CIS_TEST_RESPONSE_CERT_PIN,
  CIS_XMLDSIG_NS,
  CIS_ALG_CANONICALIZATION,
  CIS_ALG_ENVELOPED,
  CIS_ALG_RSA_SHA256,
  CIS_ALG_SHA256_DIGEST,
} from './constants'
export { CIS_FIELD_PATTERNS, CIS_OZNA_SLIJED_VALUES, CIS_NACIN_PLACANJA_VALUES } from './fields'
export { CIS_TEST_CA_PEM } from './demo-ca'
export { CIS_PROD_CA_PEM } from './prod-ca'
export { checkCisConnectivity, buildCisEchoEnvelope, extractCisErrorCode } from './echo'
export type { ZkiInput } from './zki'
export { computeZki, formatCisAmount, formatCisDateTime, zkiInputString } from './zki'
export type {
  CisAmount,
  CisPorezStopa,
  CisOstaliPorez,
  CisNaknada,
  CisRacunData,
  CisInvoiceRequestResult,
} from './invoice'
export { validateRacunData, buildRacunZahtjev } from './invoice'
export type { CisP12Pems } from './p12'
export { loadCisP12 } from './p12'
export type { CisSignatureResult, CisSignOptions, RacunZahtjevLocation } from './xmlsig'
export {
  signRacunZahtjev,
  canonicalizeRacunZahtjev,
  canonicalizeFragment,
  locateRacunZahtjev,
  pemToBase64Der,
} from './xmlsig'
