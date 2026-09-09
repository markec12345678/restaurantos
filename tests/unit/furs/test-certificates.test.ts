// ============================================
// FURS TESTNI CERTIFIKATI — javni ključi uradnega testnega okolja
//
// Validira:
//   1. Vse .cer/.crt datoteke v certs/furs-test/ se parsajo (openssl + node)
//   2. CA veriga: SIGOV-CA ← SI-TRUST Root; oba lista certifikata veljata
//   3. Fingerprint PIN (SHA-256) — zazna rotacijo certifikatov FURS
//   4. Certifikati so trenutno veljavni (opomnik za obnovo ob poteku)
//
// Pin assertioni se NAMERNO lomijo ob rotaciji — takrat sledi
// certs/furs-test/README.md (razdelek "Obnova").
// ============================================

import { describe, it, expect } from 'vitest'
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const CERTS_DIR = path.join(process.cwd(), 'certs', 'furs-test')

function certPath(name: string): string {
  return path.join(CERTS_DIR, name)
}

function opensslInfo(file: string): { subject: string; issuer: string; notBefore: Date; notAfter: Date; fingerprint: string } {
  const out = execFileSync('openssl', ['x509', '-in', file, '-noout', '-subject', '-issuer', '-dates', '-fingerprint', '-sha256'], {
    encoding: 'utf8',
    timeout: 10000,
  })
  // openssl 3.0 (CI runner) izpiše "CN = ime", 3.5 (lokalno) "CN=ime" —
  // normaliziraj presledke okoli "=" za stabilne asserte
  const normalize = (dn: string) => dn.replace(/\s*=\s*/g, '=').trim()
  const subject = normalize(/subject=(.*)/.exec(out)?.[1] ?? '')
  const issuer = normalize(/issuer=(.*)/.exec(out)?.[1] ?? '')
  const notBefore = /notBefore=(.*)/.exec(out)?.[1]?.trim() ?? ''
  const notAfter = /notAfter=(.*)/.exec(out)?.[1]?.trim() ?? ''
  const fingerprint = /Fingerprint=([0-9A-F:]+)/.exec(out)?.[1]?.trim() ?? ''
  return { subject, issuer, notBefore: new Date(notBefore), notAfter: new Date(notAfter), fingerprint }
}

describe('FURS testni certifikati (javni ključi uradnega testnega okolja)', () => {
  it('vse datoteke obstajajo', () => {
    for (const f of ['blagajne-test.fu.gov.si.cer', 'DavPotRacTEST.cer', 'si-trust-root.crt', 'sigov-ca.crt']) {
      expect(fs.existsSync(certPath(f)), `${f} manjka v certs/furs-test/`).toBe(true)
    }
  })

  it('TLS strežniški certifikat testnega okolja — PIN + subject + veljavnost', () => {
    const info = opensslInfo(certPath('blagajne-test.fu.gov.si.cer'))
    // PIN (SHA-256) — uradna vrednost prenesena 2026-09-09 (rotation detector!)
    expect(info.fingerprint).toBe(
      '2F:35:6F:02:44:6C:90:44:B6:C5:4E:C0:F6:D1:85:C7:A2:CD:B2:BD:05:0D:6F:22:5F:CC:F5:AC:52:DC:46:45',
    )
    expect(info.subject).toContain('CN=blagajne-test.fu.gov.si')
    expect(info.issuer).toContain('CN=SIGOV-CA')
    expect(info.notBefore.getTime()).toBeLessThan(Date.now())
    expect(info.notAfter.getTime()).toBeGreaterThan(Date.now())
  })

  it('certifikat za podpis odgovorov (DavPotRacTEST) — PIN + subject + veljavnost', () => {
    const info = opensslInfo(certPath('DavPotRacTEST.cer'))
    expect(info.fingerprint).toBe(
      '8A:60:65:24:4E:85:14:E8:72:DF:2D:C5:88:20:12:4A:D5:DD:B6:22:66:AB:49:07:4F:86:91:BF:4F:08:B7:3A',
    )
    expect(info.subject).toContain('CN=DavPotRacTEST')
    expect(info.issuer).toContain('CN=SIGOV-CA')
    expect(info.notBefore.getTime()).toBeLessThan(Date.now())
    expect(info.notAfter.getTime()).toBeGreaterThan(Date.now())
  })

  it('CA veriga velja: SIGOV-CA ← SI-TRUST Root; list certifikata prek verige', () => {
    // SIGOV-CA izda oba lista certifikata; SI-TRUST Root je koren
    const root = opensslInfo(certPath('si-trust-root.crt'))
    const intermediate = opensslInfo(certPath('sigov-ca.crt'))
    expect(root.subject).toContain('CN=SI-TRUST Root')
    expect(root.subject).toBe(root.issuer) // samopodpisan koren
    expect(intermediate.subject).toContain('CN=SIGOV-CA')
    expect(intermediate.issuer).toContain('CN=SI-TRUST Root')

    // Openssl verify: list → intermediate (-untrusted) → root (-CAfile)
    const verify = (leaf: string) =>
      execFileSync('openssl', [
        'verify', '-CAfile', certPath('si-trust-root.crt'),
        '-untrusted', certPath('sigov-ca.crt'), certPath(leaf),
      ], { encoding: 'utf8', timeout: 10000 }).trim()
    expect(verify('blagajne-test.fu.gov.si.cer')).toMatch(/: OK$/)
    expect(verify('DavPotRacTEST.cer')).toMatch(/: OK$/)
  })

  it('korensko potrdilo je dolgo veljavno (2037) — CA bundle za mTLS', () => {
    const root = opensslInfo(certPath('si-trust-root.crt'))
    expect(root.notAfter.getFullYear()).toBeGreaterThanOrEqual(2035)
  })
})

describe('FURS uradni testni vektorji (Tehnična dokumentacija v3.2)', () => {
  it('uradni endpointi — brez izmišljenega /cash_payments', async () => {
    const { FURS_URLS, FURS_ECHO_URLS } = await import('../../../src/lib/furs/types')
    // Spec 6.1: JSON oblika sprejemanja računov
    expect(FURS_URLS.test).toBe('https://blagajne-test.fu.gov.si:9002/v1/cash_registers/invoices')
    expect(FURS_URLS.production).toBe('https://blagajne.fu.gov.si:9003/v1/cash_registers/invoices')
    // Echo servis za dosegljivost
    expect(FURS_ECHO_URLS.test).toBe('https://blagajne-test.fu.gov.si:9002/v1/cash_registers/echo')
    // Stari (NAPAČNI) endpointi ne smejo preživeti
    expect(JSON.stringify(FURS_URLS)).not.toContain('cash_payments')
    expect(JSON.stringify(FURS_URLS)).not.toContain('oauth')
  })
})
