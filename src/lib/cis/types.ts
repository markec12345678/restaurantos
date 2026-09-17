// ============================================
// CIS TYPES — Hrvaška fiskalizacija (FINA / Porezna uprava)
// ============================================
// Task 23: skelet modula za HR fiskalizacijo — zrcali src/lib/furs/types.ts.
//
// KLJUČNA RAZLIKA FURS vs CIS (glej scripts/cis-test-connection.sh):
//   - FURS: odjemalski P12 na TLS nivoju (mTLS) + JWS podpis
//   - CIS: TLS BREZ odjemalskega certifikata; P12 (FINA demo/prod) se uporablja
//     IZKLJUČNO za XML-dsig podpis soap:Body sporočil
//   → zato je Echo/povezljivost implementirljiva BREZ certifikata,
//     polna fiskalizacija (ZKI/JIR) pa zahteva FINA cert (demo: FINA DigiCert
//     portal; produkcija: sd.fu@gov.si za SI / FINA za HR).
// ============================================

export type CisEnvironment = 'test' | 'production'

/** Rezultat Echo/povezljivostnega klica na CIS strežnik. */
export interface CisConnectivityResult {
  /** Strežnik je dosegljiv in odgovarja s SOAP/XML (tudi s006 = živ). */
  reachable: boolean
  /** true, če je strežnik odgovoril z našim echo nizom (polna runda). */
  echoed: boolean
  /** Odzivni čas v ms (reachable/echoed). */
  responseTime?: number
  /** HTTP status odgovora (če je prišel do odgovora). */
  httpStatus?: number
  /** Sistemska napaka CIS-a iz odgovora (npr. s006 za prazen/napačen envelope). */
  serverErrorCode?: string
  /** Človeku berljiva napaka (mreža/TLS/timeout). */
  error?: string
}

/** Rezultat validacije CIS konfiguracije. */
export interface CisConfigValidation {
  valid: boolean
  errors: string[]
  warnings: string[]
}
