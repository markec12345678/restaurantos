// ============================================
// CIS — Hrvaška fiskalizacija (FINA / Porezna uprava)
// Barrel file — re-exports vse iz podmodulov
// ============================================
// STATUS (Task 23): SKELET — povezljivost (Echo) je ŽIVA; polna fiskalizacija
// (ZKI/JIR, XML-dsig s FINA P12) je TODO ob pridobitvi FINA certifikata
// (demo: FINA DigiCert portal; prod: FINA). Glej docs/ in worklog Task 23.
// ============================================

export type { CisEnvironment, CisConnectivityResult, CisConfigValidation } from './types'
export { CIS_URLS, CIS_SOAP_NS, CIS_NS, CIS_CONNECTIVITY_TIMEOUT_MS, CIS_TEST_RESPONSE_CERT_PIN } from './constants'
export { CIS_TEST_CA_PEM } from './demo-ca'
export { CIS_PROD_CA_PEM } from './prod-ca'
export { checkCisConnectivity, buildCisEchoEnvelope, extractCisErrorCode } from './echo'
