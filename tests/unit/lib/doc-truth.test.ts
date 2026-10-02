// ============================================
// DOC TRUTH drift-gate (issue #144 P0 korak 9, R179)
//
// Cross-dokumentna konsistenca javne dokumentacije:
//   1. README tests badge ≡ PRODUCT-STATUS testEvidence
//      (unit.tests / integration.tests / e2ePlaywright.passed)
//   2. README "Evidence-based status" vrstica nosi ciLastFileBasedProof
//      run id + attempt=1 + e2eSecurity številko
//   3. PRODUCTION-VALIDATION §2 header HEAD ≡ ciLastFileBasedProof HEAD
//   4. PRODUCTION-VALIDATION §2 številke ≡ PRODUCT-STATUS testEvidence
//   5. negativni pini: znane zastarele trditve se ne smejo vrniti
//
// Zgodovinska motivacija (najdene R179):
//   - README:7 badge je še kar trdil "3850 unit + 9 integracija + 210 E2E"
//     (R112-era), medtem ko je CI že tekel 5325/235/234
//   - README:511 je trdil "7180 testov (5231 + 1949)" — aditivna semantika,
//     ki jo je R177-d popravil v podmnožično (unit job VSEBUJE security)
//   - PRODUCTION-VALIDATION §2 je bil "osvežen R171" — 7 rund star
//   - README v1.5.0 zgodovinska vrstica je nosila 5251 (R172 sweep poplava;
//     v1.6.0 vrstica v isti tabeli prikazuje 1852 — očitna nekonsistentnost)
//
// Lekcija: "The documentation itself is part of product correctness."
// Dokumentacija brez drift-gate-a gni tiho — ta test uveljavlja, da
// public face (README) in evidence kanon (§2) plujeta z avtoritativnim virom
// (PRODUCT-STATUS §12), ne za njim.
// ============================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (...p: string[]): string => readFileSync(path.join(root, ...p), 'utf-8')

const statusSrc = read('docs', 'PRODUCT-STATUS.md')
const jsonMatch = statusSrc.match(/```json\n([\s\S]*?)\n```/)
const status = jsonMatch ? (JSON.parse(jsonMatch[1]) as Record<string, unknown>) : null
const te = status?.['testEvidence'] as Record<string, unknown> | undefined
const unit = te?.['unit'] as { files: number; tests: number } | undefined
const integration = te?.['integration'] as { files: number; tests: number } | undefined
const e2e = te?.['e2ePlaywright'] as { passed: number; skipped: number } | undefined
const e2eSec = te?.['e2eSecurity'] as number | undefined
const proof = String(te?.['ciLastFileBasedProof'] ?? '')

const readme = read('README.md')
const pval = read('docs', 'PRODUCTION-VALIDATION.md')

describe('DOC TRUTH gate (R179): README badge ≡ PRODUCT-STATUS testEvidence', () => {
  it('PRODUCT-STATUS je parsan in testEvidence polja obstajajo', () => {
    expect(status).not.toBeNull()
    expect(unit?.tests).toBeGreaterThan(0)
    expect(integration?.tests).toBeGreaterThan(0)
    expect(e2e?.passed).toBeGreaterThan(0)
    expect(e2eSec).toBeGreaterThan(0)
  })

  it('tests badge nosi trenutna unit/IT/E2E števila (URL-encoded)', () => {
    // badge format: tests-<unit>%20unit%20%2B%20<it>%20IT%20%2B%20<e2e>%20E2E
    expect(readme).toContain(`tests-${unit!.tests}%20unit`)
    expect(readme).toContain(`${integration!.tests}%20IT`)
    expect(readme).toContain(`${e2e!.passed}%20E2E`)
  })

  it('"Evidence-based status" vrstica nosi CI run id + attempt + E2E Security številko', () => {
    const runId = proof.match(/CI run (\d+)/)?.[1]
    expect(runId, 'ciLastFileBasedProof mora vsebovati "CI run <id>"').toBeTruthy()
    expect(readme).toContain(`run ${runId}`)
    expect(readme).toContain('attempt=1')
    expect(readme).toContain(`E2E Security ${e2eSec}`)
  })

  it('evidence vrstica uporablja podmnožično semantiko (NI aditivnega "X + Y" seštevka)', () => {
    // R177-d lekcija: "5231 unit + 1949 security = 7180" je dvojno štel
    expect(readme).toContain('podmnožica')
    expect(readme).not.toMatch(/\(5231 unit \+ 1949 security\)/)
  })

  it('Test napredek ima trenutno sidro (ni več zamrznjen na R112)', () => {
    expect(readme).toContain(`${unit!.tests} unit / ${unit!.files} datotek`)
    expect(readme).toContain('epik #144')
  })
})

describe('DOC TRUTH gate (R179): PRODUCTION-VALIDATION §2 ≡ ciLastFileBasedProof', () => {
  it('§2 header nosi isti HEAD kot ciLastFileBasedProof', () => {
    const sha = proof.match(/HEAD ([0-9a-f]{7,8})/)?.[1]
    expect(sha, 'ciLastFileBasedProof mora vsebovati "HEAD <sha>"').toBeTruthy()
    expect(pval).toContain(`HEAD \`${sha}`)
  })

  it('§2 E2E Security številka ≡ PRODUCT-STATUS e2eSecurity', () => {
    expect(pval).toContain(`E2E Security | **${e2eSec} passed**`)
  })

  it('§2 unit/integration/e2e številke ≡ ciLastFileBasedProof run loga (isti run)', () => {
    // §2 dokumentira TA run — številke morajo izhajati iz proof stringa, ne
    // iz testEvidence (ta opisuje trenutno drevo, ki je lahko +delta pred pushom)
    const runUnit = proof.match(/Unit (\d+)f\/(\d+)/)
    const runIt = proof.match(/Integration (\d+)f\/(\d+)/)
    const runE2e = proof.match(/E2E (\d+) passed\/(\d+) skipped/)
    expect(runUnit, 'proof mora navajati "Unit <f>f/<t>"').toBeTruthy()
    expect(runIt, 'proof mora navajati "Integration <f>f/<t>"').toBeTruthy()
    expect(runE2e, 'proof mora navajati "E2E <p> passed/<s> skipped"').toBeTruthy()
    expect(pval).toContain(`${runUnit![1]} fajlov / **${runUnit![2]}** testov`)
    expect(pval).toContain(`${runIt![1]} fajlov / **${runIt![2]}** testov`)
    expect(pval).toContain(`${runE2e![1]} passed / ${runE2e![2]} skipped`)
  })

  it('§2 je osvežen s trenutno rundi (ni več "osveženo R208" pri HEAD dokazu)', () => {
    const header = pval.split('## 2.')[1]?.split('## 3.')[0] ?? ''
    expect(header).toContain('osveženo R209')
    expect(header).not.toContain('osveženo R208')
    expect(header).not.toContain('osveženo R207')
    expect(header).not.toContain('osveženo R206')
  })
})

describe('DOC TRUTH gate (R179): negativni pini — zastarele trditve se ne vračajo', () => {
  it('README ne nosi več R112-era badge števil', () => {
    expect(readme).not.toContain('tests-3850')
    expect(readme).not.toContain('E2E_210')
    expect(readme).not.toContain('9%20integracija')
  })

  it('README ne nosi več "112 QA rund" badga (audit badge ≡ trenutna runda/epik)', () => {
    expect(readme).not.toContain('razvoj-112')
    // audit badge mora kazati na živi status vir, ne na zgodovinski dokument
    const auditBadge = readme.split('\n').find((l) => l.includes('badge/razvoj-'))
    expect(auditBadge).toBeDefined()
    expect(auditBadge!).toContain('PRODUCT-STATUS.md')
  })

  it('README intro ne trdi več "210 testov / 15 specov"', () => {
    expect(readme).not.toContain('210 testov / 15 specov')
  })

  it('v1.5.0 zgodovinska vrstica ne nosi več kasnejšega števca (R172 sweep poplava popravljena)', () => {
    const v15 = readme.split('Nove funkcije v v1.5.0')[1]?.split('Nove funkcije v v1.4.0')[0] ?? ''
    expect(v15.length).toBeGreaterThan(0)
    expect(v15).not.toContain('5251')
    // v1.6.0 vrstica v isti tabeli je era-zvesta (1852) — mora ostati
    const v16 = readme.split('Nove funkcije v v1.6.0')[1]?.split('Nove funkcije v v1.5.0')[0] ?? ''
    expect(v16).toContain('1852')
  })

  it('stari aditivni seštevek 7180 ne obstaja več v README evidence vrstici', () => {
    expect(readme).not.toContain('7180 testov')
  })

  it('P2 pravilo (§18/#141): javna fasada ne nosi konkurenčnih primerjav ali cenovnih trditev', () => {
    // R187 (P2 korak 20): "4x ceneje od Toast, 2x ceneje od Square" = nepodprta
    // primerjalna trditev — epik #144 §18 ("no competitor comparisons", "no
    // unsupported numbers") + issue #141 ("Do not show competitor pricing or
    // comparative claims"). Negativni pini: primerjave se ne smejo vrniti.
    expect(readme).not.toMatch(/ceneje od (Toast|Square|Clover|Lightspeed|TouchBistro)/i)
    expect(readme).not.toMatch(/cheaper than (Toast|Square|Clover|Lightspeed|TouchBistro)/i)
    expect(readme).not.toMatch(/v primerjavi z (Toast|Square|Clover|Lightspeed|TouchBistro)/i)
    // design badge label mora biti nevtralen (style=flat-square v URL-ju je CSS, ne konkurenca)
    expect(readme).not.toMatch(/badge\/design-(Toast|Square|Clover|Lightspeed|TouchBistro)/i)
  })
})
