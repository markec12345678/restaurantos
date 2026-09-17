// ============================================
// CIS STATUS — čista pomožna funkcija za preslikavo
// odgovora GET /api/cis/echo v status + toast sporočilo
// ============================================
// Ločena datoteka (brez React/hook odvisnosti), da je preverljiva z
// enotskimi testi brez DOM nastavitve. Zrcali logiko testFursConnection
// v useSettingsManager.ts.
//
// Oblika odgovora /api/cis/echo (glej src/app/api/cis/echo/route.ts):
//   { environment, reachable, echoed, responseTime?, httpStatus?,
//     serverErrorCode?, error?, checkedAt }
//   - reachable=true + echoed=true  → polna Echo runda
//   - reachable=true + echoed=false → strežnik živ, ampak echo ni vračen
//     (typično sistemska napaka s006 za ne-podpisan zahtevek — pričakovano
//     dokler ni FINA P12 certifikat za XML-dsig)
//   - reachable=false → mrežna/TLS/timeout napaka (ali API error, npr. 429)
// ============================================

/** Odgovor GET /api/cis/echo (podmnožica polj, ki jih preslikava bere). */
export interface CisEchoResponse {
  environment?: string
  reachable: boolean
  echoed: boolean
  responseTime?: number
  httpStatus?: number
  serverErrorCode?: string
  error?: string
}

/** Rezultat preslikave: status povezave + sporočilo za toast. */
export interface CisEchoStatusResult {
  status: 'connected' | 'error'
  message: string
}

/** Oznaka okolja za sporočila (isti vzorec kot FURS: TESTNO / PRODUKCIJA). */
function environmentLabel(environment?: string): string {
  return environment === 'production' ? 'PRODUKCIJA' : 'TESTNO'
}

/**
 * Preslikaj odgovor CIS Echo klica v status povezave + toast sporočilo.
 * Čista funkcija — brez stranskih učinkov.
 */
export function mapCisEchoResponseToStatus(result: CisEchoResponse): CisEchoStatusResult {
  const envLabel = environmentLabel(result.environment)
  const responseTime = typeof result.responseTime === 'number' ? `, ${result.responseTime} ms` : ''

  if (result.reachable) {
    if (result.echoed) {
      // Polna runda — strežnik je vrnil naš echo niz
      return {
        status: 'connected',
        message: `CIS Echo uspešen (${envLabel}${responseTime})`,
      }
    }
    // Strežnik živ (SOAP odgovor), ampak echo ni vračen — npr. s006
    const serverCode = result.serverErrorCode ? `, ${result.serverErrorCode}` : ''
    return {
      status: 'connected',
      message: `CIS dosegljiv (strežnik živ, echo ni vračen${serverCode}) — ${envLabel}${responseTime}`,
    }
  }

  // Ni dosegljiv — mrežna/TLS napaka ali API error sporočilo
  return {
    status: 'error',
    message: `CIS povezava neuspešna${result.error ? `: ${result.error}` : ''}`,
  }
}
