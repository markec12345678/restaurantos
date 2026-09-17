// ============================================
// CIS — Hrvaška fiskalizacija (FINA / Porezna uprava)
// Barrel file — re-exports vse iz podmodulov
// ============================================
// STATUS (runda 27): Fiskalizacija KONČNA end-to-end — Echo/povezljivost
// (Task 23) + ZKI in RacunZahtjev gradnja (Task 24-b) + XML-dsig enveloped
// podpis s FINA P12 (Task 26-a) + POŠILJANJE + RacunOdgovor/JIR parsing
// (runda 27, send.ts). Za produkcijski promet manjka samo FINA P12
// certifikat (demo: digicert.finastre.hr). Glej docs/ in worklog Task 23/24/26/27.
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
export type { CisSendResult, CisRacunOdgovor, CisSignedRequest } from './send'
export {
  sendRacunZahtjev,
  buildSignedRacunZahtjev,
  parseRacunOdgovor,
  isValidJir,
} from './send'
// Runda 29: produkcijska vezava — Receipt → CIS (FINA)
export type {
  ReceiptForCis,
  SettingsForCis,
  CisSkipReason,
  CisSubmissionOutcome,
  CisSubmissionDeps,
} from './receipt-submission'
export {
  mapPaymentMethodToNacinPlac,
  receiptNumberToBrOznRac,
  buildCisRacunDataFromReceipt,
  submitReceiptToCis,
} from './receipt-submission'
