// ============================================
// CIS — Hrvaška fiskalizacija (FINA / Porezna uprava)
// Barrel file — re-exports vse iz podmodulov
// ============================================
// STATUS (Task 24-b): Echo/povezljivost ŽIVA (Task 23) + ZKI in RacunZahtjev
// gradnja (validateRacunData/buildRacunZahtjev). Za polno oddajo računa še:
// XML-dsig podpis soap:Body s FINA P12 certifikatom + Pošlji (transport) +
// parsing RacunOdgovor (JIR). Glej docs/ in worklog Task 23/24.
// ============================================

export type { CisEnvironment, CisConnectivityResult, CisConfigValidation } from './types'
export { CIS_URLS, CIS_SOAP_NS, CIS_NS, CIS_CONNECTIVITY_TIMEOUT_MS, CIS_TEST_RESPONSE_CERT_PIN } from './constants'
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
