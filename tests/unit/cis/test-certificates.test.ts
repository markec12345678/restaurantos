// ============================================
// CIS (FINA / Porezna uprava, HR) TESTNI CERTIFIKATI — javni ključi
//
// Zrcalna struktura FURS test-certificates.test.ts:
//   1. Vse .pem datoteke v certs/cis-test/ se parsajo (openssl)
//   2. TEST veriga: fiskalcistest/cistest ← Fina Demo CA 2020 ← Fina Demo Root CA
//   3. PROD veriga: fiskalcis/cis-server ← Fina RDC 2020 ← Fina Root CA
//   4. Fingerprint PIN (SHA-256) — zazna rotacijo CIS certifikatov
//   5. Certifikati so trenutno veljavni (opomnik za obnovo ob poteku)
//
// Pin assertioni se NAMERNO lomijo ob rotaciji — takrat sledi
// certs/cis-test/README.md (razdelek "Obnova").
//
// Zgodovina rotacij: Fiskalcistest zamenjan 9. 7. 2026 (stari je potekel
// sredi julija 2026); produkcijski fiskalcis zamenjan 31. 8. 2026.
// ============================================

import { describe, it, expect } from 'vitest'
import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

const CERTS_DIR = path.join(process.cwd(), 'certs', 'cis-test')

function certPath(name: string): string {
  return path.join(CERTS_DIR, name)
}

function opensslInfo(file: string): { subject: string; issuer: string; notBefore: Date; notAfter: Date; fingerprint: string } {
  const out = execFileSync('openssl', ['x509', '-in', file, '-noout', '-subject', '-issuer', '-dates', '-fingerprint', '-sha256'], {
    encoding: 'utf8',
    timeout: 10000,
  })
  // openssl 3.0 (CI runner) izpiše "CN = ime", 3.5 (lokalno) "CN=ime" —
  // normaliziraj presledke okoli "=" za stabilne asserte (izkušnja iz FURS testov)
  const normalize = (dn: string) => dn.replace(/\s*=\s*/g, '=').trim()
  const subject = normalize(/subject=(.*)/.exec(out)?.[1] ?? '')
  const issuer = normalize(/issuer=(.*)/.exec(out)?.[1] ?? '')
  const notBefore = /notBefore=(.*)/.exec(out)?.[1]?.trim() ?? ''
  const notAfter = /notAfter=(.*)/.exec(out)?.[1]?.trim() ?? ''
  const fingerprint = /Fingerprint=([0-9A-F:]+)/.exec(out)?.[1]?.trim() ?? ''
  return { subject, issuer, notBefore: new Date(notBefore), notAfter: new Date(notAfter), fingerprint }
}

/** Izlušči prvi (list) certifikat iz multi-PEM verige (tmp v os.tmpdir, ne v certs/). */
function leafOf(chainFile: string): string {
  const pem = fs.readFileSync(chainFile, 'utf8')
  const m = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/)
  if (!m) throw new Error(`${chainFile}: ni certifikatnih blokov`)
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cis-cert-')), 'leaf.pem')
  fs.writeFileSync(tmp, m[0])
  return tmp
}

describe('CIS (HR) testni certifikati — datoteke in verige', () => {
  it('vse datoteke obstajajo', () => {
    for (const f of [
      'cistest.apis-it.hr.pem',
      'fiskalcistest-chain.pem',
      'demo2020_sub_ca.pem',
      'demo2014_root_ca.pem',
      'prod-fiskalcis.pem',
      'prod-FinaRDCCA2020.pem',
      'prod-FinaRootCA.pem',
      'prod-cis-server.pem',
    ]) {
      expect(fs.existsSync(certPath(f)), `${f} manjka v certs/cis-test/`).toBe(true)
    }
  })

  it('TLS strežniški certifikat testnega okolja (cistest.apis-it.hr) — PIN + subject + veljavnost', () => {
    const info = opensslInfo(certPath('cistest.apis-it.hr.pem'))
    // PIN (SHA-256) — živo preverjeno 2026-09-10 (rotation detector!)
    expect(info.fingerprint).toBe(
      '0A:AB:10:E5:3A:2E:D8:BF:10:FF:F2:E7:5C:F7:C1:BD:AC:12:6E:88:88:09:84:A0:32:26:34:B7:20:0F:9C:22',
    )
    expect(info.subject).toContain('CN=cistest.apis-it.hr')
    expect(info.issuer).toContain('CN=Fina Demo CA 2020')
    expect(info.notBefore.getTime()).toBeLessThan(Date.now())
    expect(info.notAfter.getTime()).toBeGreaterThan(Date.now())
  })

  it('certifikat za podpis odgovorov (fiskalcistest) — PIN + subject + veljavnost', () => {
    // NOVI certifikat po rotaciji 9. 7. 2026 (stari je potekel)
    const info = opensslInfo(leafOf(certPath('fiskalcistest-chain.pem')))
    expect(info.fingerprint).toBe(
      '9E:4F:51:3F:07:A8:6F:EE:13:E2:6E:08:EF:70:41:15:23:3B:82:82:B3:B1:7F:EB:0C:CE:F7:51:B0:76:1B:46',
    )
    expect(info.subject).toContain('CN=fiskalcistest')
    // OIB 02994650199 = uradni demo OIB (organizationIdentifier)
    expect(info.subject).toContain('HR02994650199')
    expect(info.issuer).toContain('CN=Fina Demo CA 2020')
    expect(info.notBefore.getTime()).toBeLessThan(Date.now())
    expect(info.notAfter.getTime()).toBeGreaterThan(Date.now())
  })

  it('DEMO CA veriga velja: Fina Demo CA 2020 ← Fina Demo Root CA; lista prek verige', () => {
    const root = opensslInfo(certPath('demo2014_root_ca.pem'))
    const intermediate = opensslInfo(certPath('demo2020_sub_ca.pem'))
    expect(root.subject).toContain('CN=Fina Demo Root CA')
    expect(root.subject).toBe(root.issuer) // samopodpisan koren
    expect(intermediate.subject).toContain('CN=Fina Demo CA 2020')
    expect(intermediate.issuer).toContain('CN=Fina Demo Root CA')

    // Openssl verify: list → intermediate (-untrusted) → root (-CAfile)
    const verify = (leaf: string) =>
      execFileSync('openssl', [
        'verify', '-CAfile', certPath('demo2014_root_ca.pem'),
        '-untrusted', certPath('demo2020_sub_ca.pem'), leaf,
      ], { encoding: 'utf8', timeout: 10000 }).trim()
    expect(verify(certPath('cistest.apis-it.hr.pem'))).toMatch(/: OK$/)
    expect(verify(leafOf(certPath('fiskalcistest-chain.pem')))).toMatch(/: OK$/)
  })

  it('fiskalcistest-chain.pem vsebuje CELO verigo (list + intermediate + root)', () => {
    const pem = fs.readFileSync(certPath('fiskalcistest-chain.pem'), 'utf8')
    expect((pem.match(/-----BEGIN CERTIFICATE-----/g) || []).length).toBe(3)
    // veriga se mora končati s korenom (samopodpisanim)
    const blocks = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) ?? []
    const last = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cis-cert-')), 'last.pem')
    fs.writeFileSync(last, blocks[blocks.length - 1])
    const rootInfo = opensslInfo(last)
    expect(rootInfo.subject).toBe(rootInfo.issuer) // samopodpisan koren na koncu
    expect(rootInfo.subject).toContain('CN=Fina Demo Root CA')
  })
})

describe('CIS (HR) produkcijski certifikati (za primerjavo / prihodnjo HR podporo)', () => {
  it('fiskalcis (podpis odgovorov v produkciji) — PIN + veriga', () => {
    const info = opensslInfo(certPath('prod-fiskalcis.pem'))
    // PIN preverjen proti uradnemu zip-u Porezne uprave (fiskalcis.zip, 31.8.2026)
    expect(info.fingerprint).toBe(
      '21:53:AA:9A:D1:30:E5:18:CA:5D:4D:0E:87:F3:27:A9:FF:A2:53:0B:1A:76:56:B6:B9:8B:BE:C6:AD:B8:F2:2E',
    )
    expect(info.subject).toContain('CN=fiskalcis')
    expect(info.subject).toContain('HR18683136487') // OIB MinFin
    expect(info.issuer).toContain('CN=Fina RDC 2020')

    const verify = execFileSync('openssl', [
      'verify', '-CAfile', certPath('prod-FinaRootCA.pem'),
      '-untrusted', certPath('prod-FinaRDCCA2020.pem'), certPath('prod-fiskalcis.pem'),
    ], { encoding: 'utf8', timeout: 10000 }).trim()
    expect(verify).toMatch(/: OK$/)
  })

  it('cis.porezna-uprava.hr (TLS strežnik v produkciji) — PIN + veriga', () => {
    const info = opensslInfo(certPath('prod-cis-server.pem'))
    expect(info.fingerprint).toBe(
      '76:4B:8E:56:50:3E:7F:05:0A:67:EC:69:54:C8:5B:55:B7:84:CB:C0:8A:BC:41:41:37:76:C3:DD:50:65:5E:80',
    )
    expect(info.subject).toContain('CN=cis.porezna-uprava.hr')
    expect(info.issuer).toContain('CN=Fina RDC 2020')

    const verify = execFileSync('openssl', [
      'verify', '-CAfile', certPath('prod-FinaRootCA.pem'),
      '-untrusted', certPath('prod-FinaRDCCA2020.pem'), certPath('prod-cis-server.pem'),
    ], { encoding: 'utf8', timeout: 10000 }).trim()
    expect(verify).toMatch(/: OK$/)
  })

  it('korenski potrdili sta dolgo veljavni (2034/2035) — CA bundle za TLS', () => {
    const demoRoot = opensslInfo(certPath('demo2014_root_ca.pem'))
    const prodRoot = opensslInfo(certPath('prod-FinaRootCA.pem'))
    expect(demoRoot.notAfter.getFullYear()).toBeGreaterThanOrEqual(2033)
    expect(prodRoot.notAfter.getFullYear()).toBeGreaterThanOrEqual(2034)
  })
})

describe('CIS endpointi (tehnička specifikacija v2.7)', () => {
  it('testni in produkcijski URL sta skladni s specifikacijo', async () => {
    // Konstante iz fiskalhrgo (skladne s CIS tehničko specifikacijo v2.7):
    //   production: https://cis.porezna-uprava.hr:8449/FiskalizacijaService
    //   test:       https://cistest.apis-it.hr:8449/FiskalizacijaServiceTest
    const TEST_URL = 'https://cistest.apis-it.hr:8449/FiskalizacijaServiceTest'
    const PROD_URL = 'https://cis.porezna-uprava.hr:8449/FiskalizacijaService'

    expect(new URL(TEST_URL).hostname).toBe('cistest.apis-it.hr')
    expect(new URL(TEST_URL).port).toBe('8449')
    expect(new URL(TEST_URL).pathname).toBe('/FiskalizacijaServiceTest')
    expect(new URL(PROD_URL).hostname).toBe('cis.porezna-uprava.hr')
    expect(new URL(PROD_URL).pathname).toBe('/FiskalizacijaService')

    // Izmišljeni/napačni endpointi ne smejo preživeti
    // (cistest.porezna-uprava.hr NE obstaja v DNS — pogosta napaka)
    expect(TEST_URL).not.toContain('cistest.porezna-uprava.hr')
    expect(TEST_URL).not.toContain('fina.hr')
  })
})
