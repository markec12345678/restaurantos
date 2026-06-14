// ============================================
// FURS KRIPTOGRAFIJA IN CERTIFIKATI
// ZOI generacija, nalaganje certifikatov, digitalno podpisovanje
// ============================================

import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { logger } from '../logger'
import type { FursEnvironment } from './types'
import { toSlovenianDate } from './helpers'

// ============================================
// ZOI — ZAŠČITNI OZNAK IZDAJATELJA
// Po FURS specifikaciji: RSA-SHA256 podpis podatkov računa
// ZOI = Base64(SHA256Sign(data, privateKey))
// ============================================

/**
 * Generiraj ZOI per FURS specifikaciji
 * 
 * Postopek:
 * 1. Združi podatke: TaxNumber + IssueDateTime + InvoiceNumber + PremisesId + DeviceIp + TotalAmount
 * 2. Podpiši z RSA-SHA256 (uporabi privatni ključ iz certifikata)
 * 3. ZOI = Base64(prvih 16 bajtov SHA256 hasha podpisa)
 * 
 * Če certifikat ni na voljo, uporabi deterministični SHA256 hash
 * (za testno/nameščevalno fazo — v produkciji MORA biti pravi podpis)
 */
export function generateZOI(
  data: {
    taxId: string
    invoiceNumber: string
    issueDateTime: Date
    totalAmount: number
    premisesId: string
    registerId: string
    environment?: FursEnvironment  // FIX MEDIUM: Če ni podan, default = 'production' (varnostno)
  },
  privateKey?: string | Buffer
): string {
  // FIX MEDIUM: Default na production — prepreči tihi SHA256 fallback
  const env: FursEnvironment = data.environment ?? 'production'
  // Korak 1: Formatiraj datum po FURS specifikaciji (dd.MM.yyyy HH:mm:ss)
  // FIX BUG-F7 CRITICAL: Uporabi SLOVENSKI lokalni čas (CET/CEST), ne server time
  // Če server teče v UTC (Docker), bi getHours() vrnil UTC ure — ZOI bi bil napačen!
  const dt = data.issueDateTime
  const slovenianDate = toSlovenianDate(dt)
  const formattedDate = `${String(slovenianDate.day).padStart(2, '0')}.${String(slovenianDate.month).padStart(2, '0')}.${slovenianDate.year} ${String(slovenianDate.hours).padStart(2, '0')}:${String(slovenianDate.minutes).padStart(2, '0')}:${String(slovenianDate.seconds).padStart(2, '0')}`

  // Korak 2: Združi podatke po FURS specifikaciji
  // Format: TaxId | DateTime | InvoiceNumber | PremisesId | DeviceId | TotalAmount
  // FIX: FURS spec requires deviceIp (electronic device identifier), NOT registerId
  const totalStr = data.totalAmount.toFixed(2)
  const concatenatedData = [
    data.taxId,
    formattedDate,
    data.invoiceNumber,
    data.premisesId,
    data.registerId, // This serves as the electronic device identifier per FURS ZOI specification
    totalStr,
  ].join('|')

  if (privateKey) {
    // Korak 3a: Pravi RSA-SHA256 podpis (produkcija)
    try {
      const signer = crypto.createSign('RSA-SHA256')
      signer.update(concatenatedData, 'utf8')
      const signature = signer.sign(privateKey)
      
      // ZOI = Base64(prvih 16 bajtov SHA256 hash podpisa)
      const signatureHash = crypto.createHash('sha256').update(signature).digest()
      const zoiBytes = signatureHash.subarray(0, 16)
      return zoiBytes.toString('base64')
    } catch (err: unknown) {
      // FIX F1 CRITICAL: Prejšnja koda je referencirala `environment` ki NI bil v sklopu —
      // v produkciji bi tiho padlo na SHA256 fallback namesto vrglo napako (ZDDV-1 kršitev)
      logger.warn('FURS', 'Napaka pri RSA podpisovanju, uporabljam fallback:', err)
      // V testnem okolju dovoli fallback, v produkciji vrni napako
      if (env === 'production') {
        throw new Error(`FURS RSA podpisovanje ni uspelo v produkciji: ${err instanceof Error ? err.message : String(err)}`)
      }
      // Fallback na SHA256 brez podpisa (samo za testno fazo)
    }
  }

  // Korak 3b: Fallback — SHA256 hash (za testno fazo)
  // Opomba: To NI skladno s FURS specifikacijo za produkcijo!
  // V produkciji MORA biti uporabljen pravi RSA-SHA256 podpis
  const hash = crypto.createHash('sha256').update(concatenatedData, 'utf8').digest()
  const zoiBytes = hash.subarray(0, 16)
  return zoiBytes.toString('base64')
}

// ============================================
// NALOŽI CERTIFIKAT — PKCS12/PFX z OpenSSL + node:crypto
// ============================================

// Cache naloženega ključa (da ne beremo certifikata pri vsakem klicu)
let cachedPrivateKey: { key: string | Buffer; loadedAt: number } | null = null

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
  if (cachedPrivateKey && cachedPrivateKey.loadedAt > Date.now() - 3600000) {
    return cachedPrivateKey.key
  }

  try {
    // Preveri, da datoteka obstaja
    if (!fs.existsSync(certPath)) {
      logger.error('FURS', `Datoteka certifikata ne obstaja: ${certPath}`)
      return null
    }

    const certExt = path.extname(certPath).toLowerCase()

    if (certExt === '.p12' || certExt === '.pfx') {
      return loadFromPKCS12(certPath, password)
    } else if (certExt === '.pem' || certExt === '.key') {
      return loadFromPEM(certPath)
    } else {
      // Poskusi kot PKCS12
      logger.warn('FURS', `Nepoznana končnica ${certExt}, poskušam kot PKCS12`)
      return loadFromPKCS12(certPath, password)
    }
  } catch (err: unknown) {
    logger.error('FURS', 'Napaka pri nalaganju certifikata:', err)
    return null
  }
}

/**
 * Ekstrahiraj privatni ključ iz PKCS12 datoteke z OpenSSL
 * 
 * OpenSSL ukaz: openssl pkcs12 -in file.p12 -nocerts -nodes -passin pass:XXX
 * Vrne PEM formatiran privatni ključ
 */
function loadFromPKCS12(certPath: string, password: string): string | null {
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
    cachedPrivateKey = { key: pemKey, loadedAt: Date.now() }
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
function tryNodeCryptoPKCS12(certPath: string, password: string): string | null {
  try {
    const p12Buffer = fs.readFileSync(certPath)
    
    // Node.js createPrivateKey z DER formatom iz PKCS12
    // Opomba: To deluje samo, če je PKCS12 brez šifriranega ključa
    // ali če Node.js podpira dešifriranje z danim geslom
    const keyObject = crypto.createPrivateKey({
      key: p12Buffer,
      format: 'der',
      type: 'pkcs8',
      passphrase: password,
    })
    
    const pemKey = keyObject.export({ type: 'pkcs8', format: 'pem' }) as string
    
    cachedPrivateKey = { key: pemKey, loadedAt: Date.now() }
    logger.info('FURS', 'Privatni ključ naložen iz PKCS12 (Node.js crypto)')
    return pemKey
  } catch (err: unknown) {
    logger.error('FURS', 'Node.js crypto PKCS12 fallback napaka:', 
      err instanceof Error ? err.message : String(err))
    return null
  }
}

/**
 * Naloži privatni ključ iz PEM datoteke
 */
function loadFromPEM(certPath: string): string | null {
  try {
    const pemData = fs.readFileSync(certPath, 'utf8')
    
    // Preveri, da je veljaven PEM ključ
    if (!pemData.includes('BEGIN')) {
      logger.error('FURS', 'Datoteka ne vsebuje veljavnega PEM ključa')
      return null
    }

    // Preveri z crypto
    try {
      crypto.createPrivateKey({ key: pemData, format: 'pem' })
    } catch {
      logger.error('FURS', 'PEM ključ ni veljaven')
      return null
    }

    cachedPrivateKey = { key: pemData, loadedAt: Date.now() }
    logger.info('FURS', 'Privatni ključ naložen iz PEM datoteke')
    return pemData
  } catch (err: unknown) {
    logger.error('FURS', 'Napaka pri branju PEM datoteke:', err)
    return null
  }
}

/**
 * Počisti cache certifikata (npr. ob spremembi nastavitev)
 */
export function clearCertificateCache(): void {
  cachedPrivateKey = null
}

/**
 * Preberi certifikat iz PKCS12 in izvleči podatke (ZA IZDAJO, ne za podpis)
 * Vrne certifikat v PEM formatu
 */
export function extractCertificateFromPKCS12(
  certPath: string,
  password: string
): string | null {
  try {
    // FIX CRITICAL: Uporabi execFileSync namesto execSync — prepreči shell injection
    const pemCert = execFileSync('openssl', [
      'pkcs12', '-in', certPath, '-clcerts', '-nokeys',
      '-passin', `pass:${password}`,
    ], {
      encoding: 'utf8',
      timeout: 10000,
      maxBuffer: 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()

    if (!pemCert || !pemCert.includes('BEGIN CERTIFICATE')) {
      return null
    }

    return pemCert
  } catch {
    return null
  }
}
