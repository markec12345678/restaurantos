// PEM nalaganje in ekstrakcija certifikatov iz PKCS12

import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { logger } from '../../logger'

/**
 * Naloži privatni ključ iz PEM datoteke
 */
export function loadFromPEM(certPath: string): string | null {
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

    logger.info('FURS', 'Privatni ključ naložen iz PEM datoteke')
    return pemData
  } catch (err: unknown) {
    logger.error('FURS', 'Napaka pri branju PEM datoteke:', err)
    return null
  }
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

/**
 * Ugotovi vrsto certifikata in izbere pravilno nalaganje
 */
export function detectCertType(certPath: string): 'pkcs12' | 'pem' | 'unknown' {
  const certExt = path.extname(certPath).toLowerCase()
  if (certExt === '.p12' || certExt === '.pfx') return 'pkcs12'
  if (certExt === '.pem' || certExt === '.key') return 'pem'
  return 'unknown'
}
