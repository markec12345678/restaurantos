// ============================================
// NALOŽI CERTIFIKAT — PKCS12/PFX z OpenSSL + node:crypto
// Ekstrakcija certifikatov iz PKCS12
// ============================================

import fs from 'fs'
import { logger } from '../../logger'
import { loadFromPKCS12, getCachedPrivateKey, setCachedPrivateKey, clearPrivateKeyCache } from './pkcs12-loader'
import { loadFromPEM, detectCertType } from './pem-loader'

/**
 * Naloži privatni ključ iz p12/pfx certifikata za FURS podpisovanje
 *
 * Postopek:
 * 1. Preberi PKCS12 datoteko
 * 2. Uporabi OpenSSL za ekstrakcijo privatnega ključa v PEM format
 * 3. Ustvari crypto.KeyObject iz PEM podatkov
 *
 * Vrne PEM formatiran privatni ključ ali null ob napaki
 */
export function loadCertificatePrivateKey(
  certPath: string,
  password: string
): string | Buffer | null {
  // Preveri cache (veljaven 1 uro)
  const cached = getCachedPrivateKey()
  if (cached && cached.loadedAt > Date.now() - 3600000) {
    return cached.key
  }

  try {
    // Preveri, da datoteka obstaja
    if (!fs.existsSync(certPath)) {
      logger.error('FURS', `Datoteka certifikata ne obstaja: ${certPath}`)
      return null
    }

    const certType = detectCertType(certPath)

    if (certType === 'pkcs12') {
      return loadFromPKCS12(certPath, password)
    } else if (certType === 'pem') {
      const result = loadFromPEM(certPath)
      if (result) setCachedPrivateKey(result)
      return result
    } else {
      // Poskusi kot PKCS12
      logger.warn('FURS', `Nepoznana končnica, poskušam kot PKCS12`)
      return loadFromPKCS12(certPath, password)
    }
  } catch (err: unknown) {
    logger.error('FURS', 'Napaka pri nalaganju certifikata:', err)
    return null
  }
}

/**
 * Počisti cache certifikata (npr. ob spremembi nastavitev)
 */
export function clearCertificateCache(): void {
  clearPrivateKeyCache()
}

// Re-export
export { extractCertificateFromPKCS12 } from './pem-loader'
export { tryNodeCryptoPKCS12 } from './pkcs12-loader'
