// ============================================
// FURS BOOT GUARD — produkcjska varovalka ob zagonu
// ============================================
// FURS AUDIT 2026-09-09 (uporabniško zahtevek točke 4):
// "V produkciji mora aplikacija zavrniti zagon, če:
//    - manjka FURS certifikat,
//    - je vključen simulation mode,
//    - manjka FURS endpoint,
//    - je certifikat potekel,
//    - manjkajo obvezni podatki podjetja."
//
// Kaj je preverljivo OB ZAGONU (brez baze):
//   1. NODE_ENV=production + FURS_ALLOW_SIMULATION=true → ZAVRNI zagon
//      (simulacija v produkciji je prepovedana konfiguracija)
//   2. FURS endpoint — FURS_URLS so hardkodirane v types.ts (vedno prisotne),
//      a varovalka eksplicitno preveri, da URL obstaja (fail-closed)
//
// Kaj NI preverljivo ob zagonu (per-location, živi v DB):
//   - certifikat (.p12 pot + geslo) — pridobivanje ob vsaki fiskalizaciji
//     prek getFursConfig(); manjkajoč certifikat → 503, račun OSTANE pending
//   - potek certifikata — cert-status route (730 dni monitoring) + JWS podpis (v1.3.2)
//     vrže napako ob podpisu s poteklim ključem → overitev pade, ne simulira
//   - obvezni podatki podjetja — validateFursConfig() pred vsako oddajo
//
// Pommbno: tudi ČE varovalka pade (npr. Vercel brez procesa, ki bi "zavrgel
// zagon"), posamezen račun NIKOLI ne more biti označen kot fiskaliziran iz
// simulacije — verifyInvoiceWithFURS vrača success=false za simulacijo.
// ============================================

import { FURS_URLS } from './types'

export interface FursBootCheckResult {
  /** true, če je konfiguracija varna za zagon */
  ok: boolean
  /** razlog zavrnitve (če ok=false) */
  reason?: string
  /** katera preverjena varovalka je sprožila */
  check: 'simulation-in-production' | 'missing-endpoint' | 'none'
}

/**
 * Preveri FURS produkcjsko pripravljenost ob zagonu procesa.
 *
 * Uporaba:
 *   - server.js (custom server) — ob zagonu, process.exit(1) ob zavrnitvi
 *   - /api/health?detailed=true — poroča stanje (degraded + razlog)
 *
 * V razvoju (NODE_ENV !== 'production') je vedno ok=true.
 */
export function checkFursBootReadiness(): FursBootCheckResult {
  const isProduction = process.env.NODE_ENV === 'production'

  if (!isProduction) {
    return { ok: true, check: 'none' }
  }

  // 1. Simulation mode v produkciji → ZAVRNI
  // (edina dovoljena vrednost v produkciji je 'false' ali unset)
  if (process.env.FURS_ALLOW_SIMULATION === 'true') {
    return {
      ok: false,
      check: 'simulation-in-production',
      reason:
        'FURS_ALLOW_SIMULATION=true v produkciji je PREPOVEDAN — simulirana overitev ' +
        'nikoli ne označi računa kot fiskaliziranega, zato tak setup tiho proizvaja ' +
        'ne-overjene račune. Nastavite FURS_ALLOW_SIMULATION=false in konfigurirajte ' +
        'certifikat (Location.fursCertPath ali FURS_CERT_PATH).',
    }
  }

  // 2. Endpoint (hardkodiran — fail-closed varovalka za prihodnje override)
  const productionUrl = FURS_URLS.production
  if (!productionUrl || !productionUrl.startsWith('https://')) {
    return {
      ok: false,
      check: 'missing-endpoint',
      reason: 'Manjka FURS produkcjski endpoint — preverite FURS_URLS konfiguracijo.',
    }
  }

  return { ok: true, check: 'none' }
}

/**
 * Strožja različica za custom server (server.js): vrže napako ob zavrnitvi.
 * Klicatelj (server.js) ulovi napako in konča proces z exit code 1.
 */
export function assertFursBootReadiness(): void {
  const result = checkFursBootReadiness()
  if (!result.ok) {
    throw new Error(`[FURS BOOT GUARD] Zagon ZAVRNJEN: ${result.reason}`)
  }
}
