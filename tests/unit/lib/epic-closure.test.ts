// ============================================
// EPIC #144 §22 CLOSURE REVIEW — drift-gate (R193)
// ============================================
//
// docs/EPIC-144-CLOSURE-REVIEW.md je generirana preslikava §22 checkliste
// epika #144 na repository truth (scripts/generate-epic-closure.ts). Ta test
// uveljavlja:
//   1. struktura: 32 postavk v 8 sekcijah (verbatim §22 razporeditev:
//      6/3/4/4/4/5/3/3) z unikatnimi id-ji
//   2. statusna disciplina: SAMO pilot-findings = N/A-IZRECNO, SAMO
//      pilot-gate = MET-OR — vsaka nova "siva" postavka = rdeče (anti-overclaim)
//   3. fail-closed: vsaka postavka ima vsaj 1 dokazno pot; celotna validacija
//      (poti ≡ existsSync, statusi, anti-overclaim pilot/physicalValidation)
//      teče znotraj buildEpicClosureDoc(), ki jo determinizem-test pokliče
//   4. anti-overclaim pini: dokument NIKAJI ne trdi produkcijske validacije
//      (FURS/hardver/pilot ostajajo neizvedeni) in vsebuje zaključne fine
//      (31/32 MET, ratchet 0, odluka o zaprtju pripada lastniku)
//   5. determinizem: commitana datoteka == buildEpicClosureDoc()
//      (stale doc = rdeče), čista funkcija (2 klica = identičen izhod)
//
// Ta datoteka JE vrata §22 closure review-a: vsak premik dokaznih sidr /
// statusa postavke zahteva regeneracijo + nov dokaz. Test je čist fs +
// import generatorja: BREZ DB / network odvisnosti.
// ============================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  ITEMS,
  SECTION_ORDER,
  SECTION_COUNTS,
  buildEpicClosureDoc,
} from '../../../scripts/generate-epic-closure'

const root = process.cwd()
const committedDoc = readFileSync(
  path.join(root, 'docs', 'EPIC-144-CLOSURE-REVIEW.md'),
  'utf-8',
)

describe('EPIC-144-CLOSURE — struktura (§22 verbatim)', () => {
  it('vsebuje točno 32 postavk v 8 sekcijah', () => {
    expect(SECTION_ORDER).toHaveLength(8)
    expect(ITEMS).toHaveLength(32)
    expect(Object.values(SECTION_COUNTS).reduce((a, b) => a + b, 0)).toBe(32)
  })

  it('razporeditev po sekcijah je verbatim §22 (6/3/4/4/4/5/3/3)', () => {
    expect(SECTION_COUNTS).toEqual({
      'Product structure': 6,
      'Core operation': 3,
      'Data integrity': 4,
      'Offline / recovery': 4,
      'Production validation': 4,
      Documentation: 5,
      Pilot: 3,
      Security: 3,
    })
  })

  it('id-ji so unikatni in sekcije ujemajo SECTION_ORDER', () => {
    const ids = ITEMS.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const item of ITEMS) {
      expect(SECTION_ORDER).toContain(item.section)
    }
  })

  it('§22 checklist besedila so verbatim iz issue telesa (vzorčni pini)', () => {
    const texts = ITEMS.map((i) => i.text)
    expect(texts).toContain('Golden Path is executable end-to-end.')
    expect(texts).toContain('No critical business fact has unexplained competing sources of truth.')
    expect(texts).toContain('Customer-facing docs contain no ambiguous test credentials.')
    expect(texts).toContain('A real controlled pilot has been executed or a concrete pilot-readiness gate is documented.')
    expect(texts).toContain('Independent security validation is tracked separately.')
  })
})

describe('EPIC-144-CLOSURE — statusna disciplina (anti-overclaim)', () => {
  it('SAMO pilot-findings je N/A-IZRECNO (nikoli tiho, nikoli razširjeno)', () => {
    const na = ITEMS.filter((i) => i.status === 'N/A-IZRECNO')
    expect(na.map((i) => i.id)).toEqual(['pilot-findings'])
  })

  it('SAMO pilot-gate je MET-OR (or-veja: readiness gate dokumentiran, pilot neizveden)', () => {
    const metOr = ITEMS.filter((i) => i.status === 'MET-OR')
    expect(metOr.map((i) => i.id)).toEqual(['pilot-gate'])
    expect(metOr[0]!.note).toContain('NI izveden')
    expect(metOr[0]!.note).toContain('§16')
  })

  it('pilot-findings razlaga je izrecna (ni pretvarjanja "met")', () => {
    const item = ITEMS.find((i) => i.id === 'pilot-findings')!
    expect(item.note).toContain('OBJEKTIVNO NI')
    expect(item.note).toContain('KNOWN_ISSUES.md')
  })

  it('vsaka postavka ima vsaj 1 dokazno pot in smiselno razlago', () => {
    for (const item of ITEMS) {
      expect(item.paths.length, item.id).toBeGreaterThanOrEqual(1)
      expect(item.note.length, item.id).toBeGreaterThanOrEqual(20)
    }
  })

  it('skupni statusni seštevek = 30 MET + 1 MET-OR + 1 N/A', () => {
    const counts = {
      MET: ITEMS.filter((i) => i.status === 'MET').length,
      'MET-OR': ITEMS.filter((i) => i.status === 'MET-OR').length,
      'N/A-IZRECNO': ITEMS.filter((i) => i.status === 'N/A-IZRECNO').length,
    }
    expect(counts).toEqual({ MET: 30, 'MET-OR': 1, 'N/A-IZRECNO': 1 })
  })
})

describe('EPIC-144-CLOSURE — fail-closed dokazna sidra (fs)', () => {
  it('ključna sidra iz vsake sekcije obstajajo na disku', () => {
    const mustExist = [
      // Product structure
      'src/lib/modules/registry.ts',
      'docs/MODULE-INVENTORY.md',
      // Core operation
      'tests/e2e/core-flow.spec.ts',
      'src/components/pos/danes/DanesCockpit.tsx',
      // Data integrity
      'docs/BUSINESS-CHAIN.md',
      'tests/unit/security/r185-shift-close-canon.test.ts',
      // Offline
      'tests/integration/r128-offline-exactly-once.test.ts',
      'src/lib/offline-orders/index.ts',
      // Production validation
      'docs/VALIDATION-MATRIX.md',
      // Documentation
      'docs/RELEASE-SUPPORT-INDEX.md',
      'tests/unit/lib/doc-truth.test.ts',
      // Pilot
      'docs/KNOWN_ISSUES.md',
      // Security
      'tests/unit/security/permission-matrix.test.ts',
      'tests/e2e/multi-tenant-security.spec.ts',
      'SECURITY.md',
    ]
    for (const p of mustExist) {
      expect(() => readFileSync(path.join(root, p)), p).not.toThrow()
    }
  })

  it('vse poti iz ITEMS obstajajo (duplikat fs-checka preslikave — brez izjem)', () => {
    const seen = new Set<string>()
    for (const item of ITEMS) {
      for (const p of item.paths) {
        expect(seen.has(p) || readFileSync(path.join(root, p), 'utf-8').length > 0, `${item.id}: ${p}`).toBe(true)
        seen.add(p)
      }
    }
  })
})

describe('EPIC-144-CLOSURE — determinizem + anti-overclaim dokumenta', () => {
  it('commitana datoteka == buildEpicClosureDoc() (stale doc = rdeče)', () => {
    // buildEpicClosureDoc() znotraj izvaja celotno fail-closed validacijo
    // (fs poti, statusi, anti-overclaim pilot/physicalValidation iz PRODUCT-STATUS)
    expect(committedDoc).toBe(buildEpicClosureDoc())
  })

  it('buildEpicClosureDoc() je čista funkcija (2 klica = identičen izhod)', () => {
    const a = buildEpicClosureDoc()
    const b = buildEpicClosureDoc()
    expect(a).toBe(b)
  })

  it('dokument ne trdi produkcijske validacije (anti-overclaim pini)', () => {
    expect(committedDoc).toContain('pilotStatus.executed false')
    expect(committedDoc).toContain('NE-izvedeni')
    expect(committedDoc).toContain('0 trditev produkcijske validacije')
    expect(committedDoc).toContain('**Odluka o zaprtju issue #144 pripada lastniku**')
    expect(committedDoc).toContain('checkboxi v issue telesu se programsko NE odklikavajo')
  })

  it('dokument nosi zaključne fine closure review-a (R193)', () => {
    expect(committedDoc).toContain('31/32 postavk MET')
    expect(committedDoc).toContain('ratchet 90 (R189) → 50 (R190) → 31 (R191) → **0 (R192)**')
    expect(committedDoc).toContain('GENERIRANO z `scripts/generate-epic-closure.ts`')
    expect(committedDoc).toContain('bun run closure')
  })

  it('dokument ne omenja konkurenc (P2 pravilo #141)', () => {
    expect(committedDoc).not.toMatch(/\b(toast|square|clover|lightspeed|touchbistro)\b/i)
  })
})
