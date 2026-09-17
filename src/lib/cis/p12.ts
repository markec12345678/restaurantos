// ============================================
// CIS P12 — ekstrakcija certifikata + ključa iz FINA PKCS#12 (Task 26-a)
// ============================================
// FINA P12 se uporablja IZKLJUČNO za XML-dsig podpis soap:Body (CIS nima
// mTLS — glej types.ts). Za podpis potrebujemo OBE PEM datoteki:
//   - privateKeyPem → RSA-SHA256 podpis kanoničnega SignedInfo
//   - certificatePem → base64 DER v ds:X509Certificate (KeyInfo)
//
// Zakaj NE ponovno uporabimo furs/crypto/pkcs12-loader.ts: ta vrača SAMO
// privatni ključ (brez certifikata) in drži modulski cache (FURS specifika).
// CIS potrebuje oba PEM-a ob vsakem podpisu — tu je majhna samostojna pomožnica
// z ISTIM pristopom (OpenSSL CLI prek execFileSync — brez shell, torej
// injection-varen; enako kot FURS loader, lekcija iz Task 1).
//
// Non-throwing: napaka (neobstoječa datoteka, napačno geslo, pokvarjen P12,
// manjkajoč openssl) → null (skladno s stilom modula).
// ============================================

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { logger } from '@/lib/logger'

/** PEM izhoda iz P12. */
export interface CisP12Pems {
  /** Leaf certifikat (PEM) — gre v ds:X509Certificate. */
  certificatePem: string
  /** Zasebni ključ (PEM, nešifriran) — podpisuje SignedInfo. */
  privateKeyPem: string
}

const PEM_PRIVATE_KEY_RE = /-----BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----/
const PEM_CERT_RE = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/

/**
 * Ekstrahiraj certifikat + zasebni ključ iz PKCS#12.
 *
 * @param p12 pot do .p12 datoteke ALI vsebina (Buffer)
 * @param password geslo P12
 * @returns oba PEM-a, ali null ob napaki (non-throwing)
 */
export function loadCisP12(p12: string | Buffer, password: string): CisP12Pems | null {
  let tmpDir: string | null = null
  try {
    let p12Path: string
    if (Buffer.isBuffer(p12)) {
      // openssl pkcs12 bere z datoteke — buffer zapišemo v varen tmp (0600)
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cis-p12-'))
      p12Path = path.join(tmpDir, 'cert.p12')
      fs.writeFileSync(p12Path, p12, { mode: 0o600 })
    } else {
      p12Path = p12
      if (!fs.existsSync(p12Path)) {
        logger.error('CIS', `P12 datoteka ne obstaja: ${p12Path}`)
        return null
      }
    }

    // geslo podamo kot argument ('pass:…') — execFileSync NE uporabi shell,
    // zaresti ni shell injection (argv je viden samo rootu/istemu uporabniku,
    // enako kot pri FURS pkcs12-loader)
    const runPkcs12 = (extraArgs: string[]): string =>
      execFileSync(
        'openssl',
        ['pkcs12', '-in', p12Path, '-passin', `pass:${password}`, ...extraArgs],
        { encoding: 'utf8', timeout: 10_000, maxBuffer: 2 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] }
      )

    // ključ: -nocerts -nodes (nešifriran PEM)
    const keyOut = runPkcs12(['-nocerts', '-nodes'])
    const privateKeyPem = PEM_PRIVATE_KEY_RE.exec(keyOut)?.[0]
    if (!privateKeyPem) {
      logger.error('CIS', 'OpenSSL ni vrnil zasebnega ključa iz P12 (napačno geslo ali pokvarjen PKCS#12)')
      return null
    }

    // leaf certifikat: -clcerts -nokeys (samo lastni cert, brez CA verige)
    const certOut = runPkcs12(['-clcerts', '-nokeys'])
    const certificatePem = PEM_CERT_RE.exec(certOut)?.[0]
    if (!certificatePem) {
      logger.error('CIS', 'OpenSSL ni vrnil certifikata iz P12 (manjka leaf certificate)')
      return null
    }

    return { certificatePem, privateKeyPem }
  } catch (err: unknown) {
    logger.error(
      'CIS',
      'Ekstrakcija P12 ni uspel:',
      err instanceof Error ? err.message : String(err)
    )
    return null
  } finally {
    if (tmpDir) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      } catch {
        // tmp čiščenje ni kritično (os.tmpdir se počisti ob rebootu)
      }
    }
  }
}
