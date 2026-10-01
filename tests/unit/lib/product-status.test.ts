// ============================================
// PRODUCT STATUS — dokumentacijska resnica (issue #144 §11/§12)
//
// docs/PRODUCT-STATUS.md je avtoritativni vir produktnega statusa.
// Ta test uveljavlja sintronizacijo dokumentacije z repozitorijem:
//   1. verzija v statusu == package.json (brez version drifta)
//   2. zahtevana machine-readable polja obstajajo (§12 seznam)
//   3. zgodovinski dokumenti so označeni (stare "Production READY"
//      ocene iz v1.0.2/v1.0.3 niso več evidence-backed)
//   4. izbrisana arhitektura (offline-furs, R170) ne obstaja več
//      kot "živa" v ARCHITECTURE.md
//   5. demo PIN-i v strankinem onboarding vodi so označeni
//   6. README ne vsebuje več zastarelih test števil (54/1798)
//
// R172 (issue #144 P0 korak 2) — documentation truth kanon:
// "The documentation itself is part of product correctness."
// ============================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (...p: string[]): string => readFileSync(path.join(root, ...p), 'utf-8')
const statusSrc = read('docs', 'PRODUCT-STATUS.md')

// Izvleci JSON blok iz status dokumenta (prvi ```json ... ``` blok)
const jsonMatch = statusSrc.match(/```json\n([\s\S]*?)\n```/)
const status = jsonMatch ? (JSON.parse(jsonMatch[1]) as Record<string, unknown>) : null

describe('PRODUCT-STATUS.md — verzija brez drifta (#144 §12)', () => {
  it('vsebuje parsanen JSON blok', () => {
    expect(jsonMatch).not.toBeNull()
    expect(status).not.toBeNull()
  })

  it('status.version == package.json version (nič version drifta)', () => {
    const pkg = JSON.parse(read('package.json')) as { version: string }
    expect(status?.['version']).toBe(pkg.version)
    expect(status?.['versionSource']).toBe('package.json')
  })

  it('statusUpdatedRound navaja rundi izvora (R199: osvežitev dokaza @ 2d1faa3a; R198: osvežitev dokaza @ 35676c66)', () => {
    const round = String(status?.['statusUpdatedRound'])
    expect(round).toContain('R199')
    expect(round).toContain('R198')
  })
})

describe('PRODUCT-STATUS.md — zahtevana polja (#144 §12 seznam)', () => {
  it('pokriva vseh 10 §12 odgovorov', () => {
    const req = [
      'version', 'headCommitAtStatus', 'deployedEnvironment', 'testEvidence',
      'knownLimitations', 'externalIntegrations', 'physicalValidationStatus',
      'pilotStatus', 'knownBlockers', 'goldenPath',
    ] as const
    for (const k of req) expect(status, `manjka polje ${k}`).toHaveProperty(k)
  })

  it('physicalValidationStatus ima vse fizične kanale false (anti-overclaim)', () => {
    const pv = status?.['physicalValidationStatus'] as Record<string, unknown>
    expect(pv['fursProduction']).toBe(false)
    expect(pv['paymentTerminal']).toBe(false)
    expect(pv['printer']).toBe(false)
    expect(pv['kdsDevice']).toBe(false)
  })

  it('pilotStatus.executed je false (ni pilota — ne trditi pripravljenosti)', () => {
    const pilot = status?.['pilotStatus'] as Record<string, unknown>
    expect(pilot['executed']).toBe(false)
  })

  it('testEvidence je NOTRANJE konsistenten (unit job = total; security je podmnožica)', () => {
    const te = status?.['testEvidence'] as Record<string, unknown>
    const unit = te['unit'] as { files: number; tests: number }
    const sec = te['unitSecuritySuite'] as { files: number; tests: number }
    // R177-c semantika: `unit` = CI "Unit Tests" job (test:unit = VSE unit,
    // vključno s security suite) → total ≡ unit.tests; security je PODMNOŽICA
    // (100f/1949 znotraj 291f/5303), ne seštevek (prej 5251+1949=7200 je
    // dvojno štel — CI job danes izpiše eno številko: 291f/5303).
    expect(te['unitTotalWithSecurity']).toBe(unit.tests)
    expect(unit.files).toBeGreaterThan(sec.files)
    expect(unit.tests).toBeGreaterThan(sec.tests)
    expect(unit.tests).toBeGreaterThanOrEqual(5250) // monotoni kanon (R172 baseline; 5303 @ R177)
  })

  it('testEvidence ima CI dokazni kanon (file-based proof + verification politika)', () => {
    const te = status?.['testEvidence'] as Record<string, unknown>
    // R172-b lekcija: NE pinati konkretnega sha — polje opisuje HEAD status
    // commita in se spreminja z vsakim docs commitom (samoreferenčna past,
    // ki je podrla Unit na CI). Pinamo STRUKTURO dokaza, ne številko.
    expect(String(te['ciLastFileBasedProof'])).toContain('CI run ')
    // R180: proof struktura = CI run + E2E run + attempt=1 + E2E Security številka
    // (R179 run NI imel Monitor jobov — Monitor ×2 pin je bil specifičen za R178 run)
    expect(String(te['ciLastFileBasedProof'])).toContain('E2E run ')
    expect(String(te['ciLastFileBasedProof'])).toContain('attempt=1')
    expect(String(te['ciVerification'])).toContain('deterministično')
    expect(String(te['evidenceSource'])).toContain('PRODUCTION-VALIDATION.md')
  })

  it('goldenPath je COMPLETE s sim-oznako (R177 §7; FURS še vedno NE produkcijska validacija)', () => {
    const gp = status?.['goldenPath'] as Record<string, unknown>
    // R177 (P0 korak 7): celotna §7 veriga v enem e2e serial toku
    expect(String(gp['status'])).toContain('COMPLETE')
    // Anti-overclaim pin ostane: FURS segment je izrecno SIMULACIJA
    expect(String(gp['status'])).toContain('SIMULACIJA')
    expect(String(gp['status'])).toContain('NI produkcijska validacija')
    // §7 členi, ki jih je R177 dodal (prej PARTIAL): shift/modifier/idempotency/close/z/report
    for (const segment of ['Open Shift', 'Modifier', 'Idempotency', 'Close', 'Z-report', 'Inventory', 'Report']) {
      expect(String(gp['status'])).toContain(segment)
    }
  })
})

describe('Dokumentacijska resnica (#144 §11)', () => {
  it('ARCHITECTURE.md ne opisuje več izbrisane offline-furs kot žive arhitekture', () => {
    const arch = read('docs', 'ARCHITECTURE.md')
    expect(arch).not.toContain('offline-furs')
  })

  it('FINAL-SUMMARY.md ima ZGODOVINSKI baner (stara ocena ni več evidence-backed)', () => {
    const s = read('docs', 'FINAL-SUMMARY.md')
    expect(s).toContain('ZGODOVINSKI DOKUMENT')
    expect(s).toContain('PRODUCT-STATUS.md')
  })

  it('PRODUCTION-READINESS-CHECKLIST.md ima ZGODOVINSKI baner', () => {
    const s = read('docs', 'PRODUCTION-READINESS-CHECKLIST.md')
    expect(s).toContain('ZGODOVINSKI DOKUMENT')
    expect(s).toContain('PRODUCT-STATUS.md')
  })

  it('CLIENT-ONBOARDING-GUIDE.md označuje demo PIN-e (DEMO / TEST ONLY)', () => {
    const s = read('docs', 'CLIENT-ONBOARDING-GUIDE.md')
    expect(s).toContain('DEMO / TEST ONLY')
    expect(s).toContain('unikatne, močne PIN-e')
  })

  it('README ne vsebuje zastarelih test števil (54 security / 1798 unit)', () => {
    const readme = read('README.md')
    expect(readme).not.toContain('54 security testov')
    expect(readme).not.toContain('1798/1798')
    expect(readme).toContain('PRODUCT-STATUS.md')
  })

  it('README:699-style offline-furs directory vnos ne obstaja (R170)', () => {
    const readme = read('README.md')
    expect(readme).not.toContain('offline-furs')
  })
})
