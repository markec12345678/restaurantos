// ============================================
// CIS SEND STATUS — čista pomožna funkcija za preslikavo
// odgovora POST /api/cis/test-invoice v status + toast sporočilo
// ============================================
// Zrcali cis-status.ts (Echo mapper) — ločena datoteka brez React
// odvisnosti, da je preverljiva z enotskimi testi brez DOM nastavitve.
//
// Oblika odgovora /api/cis/test-invoice (glej route.ts):
//   200: { ok, jir?, zki?, idPoruke?, httpStatus?, responseTime?,
//          serverErrorCode?, errorMessage?, signedEnvelope?, environment }
//   400: { error }  (konfiguracija: P12 manjka / ne berljiv)
// ============================================

import type { CisConfigValidation } from '@/lib/cis'

/** Odgovor POST /api/cis/test-invoice (polja, ki jih preslikava bere). */
export interface CisSendResponse {
  ok?: boolean
  jir?: string
  zki?: string
  idPoruke?: string
  httpStatus?: number
  responseTime?: number
  serverErrorCode?: string
  errorMessage?: string
  /** Podpisan SOAP envelope (XML predogled v UI — javni podatki: cert veriga + podpis). */
  signedEnvelope?: string
  /** Server-side validacijske napake vhodnih podatkov (ni šlo na žico). */
  validation?: CisConfigValidation
  environment?: string
  /** 400 konfiguracijska napaka (route vrne { error }) */
  error?: string
}

/** Rezultat preslikave: status + toast sporočilo (+ JIR za panel). */
export interface CisSendStatusResult {
  status: 'connected' | 'error'
  message: string
  jir?: string
}

/** Oznaka okolja za sporočila (isti vzorec kot FURS/CIS Echo). */
function environmentLabel(environment?: string): string {
  return environment === 'production' ? 'PRODUKCIJA' : 'TESTNO'
}

/**
 * Preslikaj odgovor testne oddaje v status + toast sporočilo.
 * Čista funkcija — brez stranskih učinkov.
 *
 * Prioriteta preslikave:
 *   1. error (400 konfiguracija) → 'error'
 *   2. ok=true + JIR             → 'connected' + JIR
 *   3. serverErrorCode (b/r/s)   → 'error' + PorukaGreske
 *   4. validation errors         → 'error' + prva napaka
 *   5. transport napaka          → 'error' + sporočilo
 */
export function mapCisSendResponseToStatus(result: CisSendResponse): CisSendStatusResult {
  const envLabel = environmentLabel(result.environment)

  // 1. Konfiguracijska napaka (400)
  if (result.error) {
    return { status: 'error', message: result.error }
  }

  // 2. Uspeh — JIR od Porezne uprave
  if (result.ok && result.jir) {
    const responseTime = typeof result.responseTime === 'number' ? `, ${result.responseTime} ms` : ''
    return {
      status: 'connected',
      message: `Testni račun fiskaliziran — JIR: ${result.jir} (${envLabel}${responseTime})`,
      jir: result.jir,
    }
  }

  // 3. Strežnik je zavrnil (poslovna napaka b001/r001 ali sistemska s00x)
  if (result.serverErrorCode) {
    const msg = result.errorMessage ? `: ${result.errorMessage}` : ''
    return {
      status: 'error',
      message: `Porezna uprava zavrnila (${result.serverErrorCode})${msg} — ${envLabel}`,
    }
  }

  // 4. Validacija vhodnih podatkov — sploh ni šlo na žico
  const validationErrors = result.validation?.errors ?? []
  if (validationErrors.length > 0) {
    return {
      status: 'error',
      message: `Zahteva ni veljavna: ${validationErrors[0]}${validationErrors.length > 1 ? ` (+${validationErrors.length - 1})` : ''}`,
    }
  }

  // 5. Transport/mrežna napaka (ali ok=false brez kode)
  if (result.errorMessage || !result.ok) {
    const msg = result.errorMessage || 'Neznana napaka pri oddaji'
    return {
      status: 'error',
      message: `Oddaja neuspešna: ${msg} — ${envLabel}`,
    }
  }

  // Defenzivni povratni primer (ok=true brez JIR-a bi bil spec kršitev)
  return { status: 'error', message: `Nepričakovan odgovor strežnika — ${envLabel}` }
}
