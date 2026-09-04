// ============================================
// SECURITY: Maske za občutljiva polja v API odgovorih
// ============================================
//
// Centralizirana pomožna funkcija za maskiranje gesel, certifikatov in
// drugih skrivnosti v API odgovorih. Uporablja se v:
//   - /api/locations (GET, POST, PUT)
//   - /api/locations/[id] (GET, PUT)
//   - /api/webhooks (GET)
//   - /api/webhooks/[id] (PUT)
//
// Načelo: skrivnosti NIKOLI ne zapustijo strežnika. Klient dobi samo
// indikator ali je skrivnost nastavljena (npr. '****' ali hasFursCert: true).
//

export interface LocationWithSecrets {
  fursCertPassword?: string | null
  fursCertPath?: string | null
  [key: string]: unknown
}

/**
 * Maskiraj FURS certifikat podatke v lokacijskem objektu.
 * - fursCertPassword → '****' (če je nastavljen)
 * - fursCertPath → '****' (če je nastavljen — pot do datoteke na strežniku
 *   je informacija, ki klientu ni potrebna; admin lahko vidi v .env ali DB)
 */
export function maskLocationSecrets<T extends LocationWithSecrets>(location: T): T {
  if (!location) return location
  const masked = { ...location }
  if (typeof masked.fursCertPassword === 'string' && masked.fursCertPassword) {
    masked.fursCertPassword = '****'
  }
  if (typeof masked.fursCertPath === 'string' && masked.fursCertPath) {
    masked.fursCertPath = '****'
  }
  return masked
}

export interface WebhookWithSecret {
  secret?: string | null
  [key: string]: unknown
}

/**
 * Maskiraj webhook signing secret.
 * - secret → '****' (če je nastavljen)
 *
 * Opomba: POST (kreiranje) še vedno vrne plain secret enkrat, da ga
 * uporabnik lahko kopira. Vsi nadaljnji GET/PUT klici ga maskirajo.
 */
export function maskWebhookSecret<T extends WebhookWithSecret>(webhook: T): T {
  if (!webhook) return webhook
  if (typeof webhook.secret === 'string' && webhook.secret) {
    return { ...webhook, secret: '****' }
  }
  return webhook
}
