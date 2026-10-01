// ============================================
// R189 — RELEASE / SUPPORT / RUNBOOK gate (epik #144 §22 korak 22)
//
// docs/RELEASE-SUPPORT-INDEX.md je izvor resnice za inventar
// release/support/runbook materiala. Ta test uveljavlja:
//   1. inventar obstaja in vsi referencirani dokumenti res obstajajo (fs)
//   2. statusne oznake (AKTIVEN / ZGODOVINSKI / GENERIRAN) so pinane
//   3. register vrzeli: 4 vrzeli rešene R189 + produkcija postavka ločena
//   4. .github/SUPPORT.md obstaja (GitHub community standard), kaže na
//      obstoječe dokumente in NE izmišljuje odzivnih časov (SLA.md je
//      edini vir števil)
//   5. zastarela "production READY" ocena (v1.0.1 iz 2026-09-06 in launch
//      checklist iz 2026-09-02) ima ZGODOVINSKI banner PRED trditvami
//   6. SECURITY.md Supported Versions ≡ package.json (brez version drifta
//      v support fasadi)
//
// Konvencija (lekcija R188): pravila in pini NE citirajo prepovedanih
// fraz — red "banner pred trditvami" je index-order pin, ne besedilo.
// ============================================

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (...p: string[]): string => readFileSync(path.join(root, ...p), 'utf-8')

const indexSrc = read('docs', 'RELEASE-SUPPORT-INDEX.md')
const supportSrc = read('.github', 'SUPPORT.md')
const securitySrc = read('SECURITY.md')
const pkg = JSON.parse(read('package.json')) as { version: string }

/** Vse relativne markdown povezave iz dokumenta (brez anchor-ov). */
function links(src: string): string[] {
  const out: string[] = []
  for (const m of src.matchAll(/\]\((\.\.?\/[^)#\s]+)\)/g)) out.push(m[1])
  return out
}

/** Razreši pot iz index dokumenta (docs/ → './x' = docs/x, '../x' = koren). */
function resolveIndexLink(link: string): string {
  if (link.startsWith('./')) return path.join(root, 'docs', link.slice(2))
  if (link.startsWith('../')) return path.join(root, link.slice(3))
  return path.join(root, link)
}

/** Najdi vrstico, ki vsebuje oba niza (statusni pin v tabeli). */
function lineWith(src: string, a: string, b: string): string | undefined {
  return src.split('\n').find((l) => l.includes(a) && l.includes(b))
}

describe('R189: RELEASE-SUPPORT-INDEX.md — inventar (epik #144 §22 korak 22)', () => {
  it('obstaja in nosi korak 22 oznako + statusno konvencijo', () => {
    expect(indexSrc).toContain('# Release / Support / Runbook Index')
    expect(indexSrc).toContain('#144 §22 korak 22')
    expect(indexSrc).toContain('AKTIVEN')
    expect(indexSrc).toContain('ZGODOVINSKI')
    expect(indexSrc).toContain('GENERIRAN')
  })

  it('vsi referencirani dokumenti res obstajajo na fs (ni mrtvih povezav)', () => {
    const ls = links(indexSrc)
    expect(ls.length).toBeGreaterThanOrEqual(20)
    const missing = ls.filter((l) => !existsSync(resolveIndexLink(l)))
    expect(missing, 'mrtve povezave v inventarju').toEqual([])
  })

  it('statusni pini AKTIVEN — release/runbook/support kanoni', () => {
    for (const doc of [
      'RELEASE_PROCESS.md',
      'CHANGELOG.md',
      'PRODUCT-STATUS.md',
      'PRODUCTION-VALIDATION.md',
      'PRODUCTION-DEPLOYMENT-RUNBOOK.md',
      'DISASTER-RECOVERY.md',
      'SLA.md',
      'SUPPORT.md',
      'SECURITY.md',
      'PRODUCT-VIDEO-STORYBOARD.md',
    ]) {
      const line = lineWith(indexSrc, doc, 'AKTIVEN')
      expect(line, `${doc} mora biti AKTIVEN v inventarju`).toBeTruthy()
    }
  })

  it('statusni pini ZGODOVINSKI — zastareli checklisti in star video načrt', () => {
    for (const doc of [
      'PRODUCTION-CHECKLIST.md',
      'PRODUCTION-LAUNCH-CHECKLIST.md',
      'PRODUCTION-READINESS-CHECKLIST.md',
      'RELEASE-v1.0.1.md',
      'VIDEO-TUTORIALS.md',
    ]) {
      const line = lineWith(indexSrc, doc, 'ZGODOVINSKI')
      expect(line, `${doc} mora biti ZGODOVINSKI v inventarju`).toBeTruthy()
    }
  })

  it('statusni pini GENERIRAN — generirani artefakti z generatorji', () => {
    for (const doc of ['MODULE-INVENTORY.md', 'VALIDATION-MATRIX.md', 'BUSINESS-CHAIN.md']) {
      const line = lineWith(indexSrc, doc, 'GENERIRAN')
      expect(line, `${doc} mora biti GENERIRAN v inventarju`).toBeTruthy()
    }
    // generator preslikava obstaja (ročno urejanje ni dovoljeno)
    expect(indexSrc).toContain('bun run inventory')
    expect(indexSrc).toContain('bun run matrix')
    expect(indexSrc).toContain('bun run chain')
  })

  it('register vrzeli: 4 vrzeli REŠENE R189 + produkcija postavka izrecno ločena', () => {
    expect(indexSrc).toContain('Register vrzeli')
    const resolved = indexSrc.match(/REŠENO R189/g)?.length ?? 0
    expect(resolved).toBeGreaterThanOrEqual(4)
    expect(lineWith(indexSrc, 'ODPRTO', 'produkcij')).toBeTruthy()
  })
})

describe('R189: .github/SUPPORT.md — GitHub community standard', () => {
  it('obstaja na pričakovani poti (prej je manjkal)', () => {
    expect(existsSync(path.join(root, '.github', 'SUPPORT.md'))).toBe(true)
    expect(supportSrc).toContain('# Podpora — RestaurantOS')
  })

  it('vse relativne povezave kažejo na obstoječe dokumente (fs-verifikacija)', () => {
    const ls = links(supportSrc)
    expect(ls.length).toBeGreaterThanOrEqual(6)
    const missing = ls.filter((l) => !existsSync(path.join(root, l.replace(/^\.\.\//, ''))))
    expect(missing, 'mrtve povezave v SUPPORT.md').toEqual([])
  })

  it('SLA.md je izvor resnice za odzivne čase in tier-je (§2 + §6)', () => {
    expect(supportSrc).toContain('docs/SLA.md')
    expect(supportSrc).toContain('§2')
    expect(supportSrc).toContain('§6')
    expect(supportSrc).toContain('NE ponavlja')
  })

  it('brez izmišljenih absolutnih odzivnih časov + DEMO kultura kredenc', () => {
    // SLA.md je edini vir števil — SUPPORT.md ne sme podvajati
    expect(supportSrc.match(/\b\d+\s*(minut|ur|dni)\b/g) ?? []).toEqual([])
    expect(supportSrc).toContain('DEMO / TEST ONLY')
    expect(supportSrc).toContain('docs/KNOWN_ISSUES.md')
    expect(supportSrc).toContain('SECURITY.md')
  })
})

describe('R189: zastareli "production READY" dokumenti — banner pred trditvami', () => {
  it('PRODUCTION-CHECKLIST.md ima ZGODOVINSKI banner PRED v1.0.1 trditvami + kaže na PRODUCT-STATUS', () => {
    const src = read('docs', 'PRODUCTION-CHECKLIST.md')
    const banner = src.indexOf('ZGODOVINSKI')
    const stale = src.indexOf('CI 5/5')
    expect(banner).toBeGreaterThanOrEqual(0)
    expect(stale).toBeGreaterThan(banner)
    expect(src).toContain('docs/PRODUCT-STATUS.md')
    expect(src).toContain('docs/RELEASE-SUPPORT-INDEX.md')
  })

  it('PRODUCTION-LAUNCH-CHECKLIST.md ima ZGODOVINSKI banner PRED "READY" vrsticami + kaže na PRODUCT-STATUS', () => {
    const src = read('docs', 'PRODUCTION-LAUNCH-CHECKLIST.md')
    const banner = src.indexOf('ZGODOVINSKI')
    const ready = src.indexOf('READY')
    expect(banner).toBeGreaterThanOrEqual(0)
    expect(ready).toBeGreaterThan(banner)
    expect(src).toContain('docs/PRODUCT-STATUS.md')
  })
})

describe('R189: SECURITY.md — Supported Versions brez version drifta', () => {
  it('Active vrstica ≡ package.json major.minor (trajno drift-proof)', () => {
    const [maj, min] = pkg.version.split('.')
    const expectRow = `v${maj}.${min}.x`
    const activeLine = lineWith(securitySrc, expectRow, 'Active')
    expect(activeLine, `SECURITY.md mora imeti "${expectRow}" kot Active (package.json = ${pkg.version})`).toBeTruthy()
  })

  it('kaže na PRODUCT-STATUS za trenutni HEAD + drift-gate referenco', () => {
    expect(securitySrc).toContain('docs/PRODUCT-STATUS.md')
    expect(securitySrc).toContain('r189-release-support.test.ts')
  })
})
