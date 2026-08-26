// PKCS12 ekstrakcija z OpenSSL CLI + Node.js crypto fallback

import crypto from 'crypto'
import fs from 'fs'
import { execFileSync } from 'child_process'
import { logger } from '../../logger'

// Cache naloženega ključa (da ne beremo certifikata pri vsakem klicu)
let cachedPrivateKey: { key: string | Buffer; loadedAt: number } | null = null

// Export za cache
export function getCachedPrivateKey() { return cachedPrivateKey }
export function setCachedPrivateKey(key: string | Buffer) { cachedPrivateKey = { key, loadedAt: Date.now() } }
export function clearPrivateKeyCache(): void { cachedPrivateKey = null }

/**
 * Ekstrahiraj privatni ključ iz PKCS12 datoteke z OpenSSL
 *
 * OpenSSL ukaz: openssl pkcs12 -in file.p12 -nocerts -nodes -passin pass:XXX
 * Vrne PEM formatiran privatni ključ
 */
export function loadFromPKCS12(certPath: string, password: string): string | null {
  try {
    // Metoda 1: OpenSSL CLI (najbolj zanesljiva za FURS certifikate)
    // FIX CRITICAL: Uporabi execFileSync namesto execSync — prepreči shell injection
    // execFileSync podaja argumente direktno procesu BREZ shell interpretacije
    const pemKey = execFileSync('openssl', [
      'pkcs12', '-in', certPath, '-nocerts', '-nodes',
      '-passin', `pass:${password}`,
    ], {
      encoding: 'utf8',
      timeout: 10000,
      maxBuffer: 1024 * 1024, // 1MB max
      stdio: ['pipe', 'pipe', 'pipe'], // stderr captured, not suppressed
    }).trim()

    if (!pemKey || !pemKey.includes('BEGIN')) {
      logger.error('FURS', 'OpenSSL ni vrnil veljavnega ključa')
      return tryNodeCryptoPKCS12(certPath, password)
    }

    // Preveri, da je ključ pravilen (poskusi ustvariti KeyObject)
    try {
      const keyObject = crypto.createPrivateKey({
        key: pemKey,
        format: 'pem',
      })
      // Preveri, da je RSA
      if (keyObject.asymmetricKeyType !== 'rsa') {
        logger.warn('FURS', `Ključ ni RSA (je ${keyObject.asymmetricKeyType}) — FURS zahteva RSA`)
      }
    } catch (verifyErr: unknown) {
      logger.error('FURS', 'Ključ iz OpenSSL ni veljaven:', verifyErr)
      return tryNodeCryptoPKCS12(certPath, password)
    }

    // Cache
    setCachedPrivateKey(pemKey)
    logger.info('FURS', 'Privatni ključ uspešno naložen iz PKCS12 (OpenSSL)')
    return pemKey
  } catch (err: unknown) {
    // OpenSSL ni na voljo ali je napaka — poskusi Node.js crypto
    logger.warn('FURS', 'OpenSSL napaka, poskušam Node.js crypto fallback:',
      err instanceof Error ? err.message : String(err))
    return tryNodeCryptoPKCS12(certPath, password)
  }
}

/**
 * Fallback: Poskusi naložiti PKCS12 z Node.js crypto.createPrivateKey
 * (Podprto v Node.js 17+ z --experimental-openssl-legacy-provider)
 */
export function tryNodeCryptoPKCS12(certPath: string, password: string): string | null {
  try {
    const p12Buffer = fs.readFileSync(certPath)

    // Node.js createPrivateKey z DER formatom iz PKCS12
    const keyObject = crypto.createPrivateKey({
      key: p12Buffer,
      format: 'der',
      type: 'pkcs8',
      passphrase: password,
    })

    const pemKey = keyObject.export({ type: 'pkcs8', format: 'pem' }) as string

    setCachedPrivateKey(pemKey)
    logger.info('FURS', 'Privatni ključ naložen iz PKCS12 (Node.js crypto)')
    return pemKey
  } catch (err: unknown) {
    logger.error('FURS', 'Node.js crypto PKCS12 fallback napaka:',
      err instanceof Error ? err.message : String(err))
    return null
  }
}
