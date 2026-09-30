// ============================================
// VALIDATION MATRIX — drift-gate (epic #144 §8 + §22 korak 8, R178)
// ============================================
//
// docs/VALIDATION-MATRIX.md je generiran dokazni register produkcijske
// validacije (scripts/generate-validation-matrix.ts). Ta test uveljavlja:
//   1. struktura: 9 vrstic epika §8 + razširitve po realni kodi (17 skupaj)
//   2. vsako dokazno sidro obstaja na disku (fail-closed — brez "duh" dokazov)
//   3. anti-overclaim: realni kanali (hardver/plačilo/zunanje) = ☐ ali N/A,
//      pilot VEDNO ☐, FURS opomba "NOT PHYSICALLY VALIDATED"
//   4. kritično pravilo epika: "Zelen CI NI isto kot produkcijska validacija"
//   5. determinizem: commitana datoteka == buildMatrixDoc() (stale doc = rdeče)
//   6. §6 presek: vsak moduleId iz vrstice obstaja v MODULE_REGISTRY
//   7. §12 presek: PRODUCT-STATUS navaja validationMatrix vir
//
// "Add/repair regression gates" (§22 korak 8): ta datoteka JE vrata —
// vsak nov ✓ v matrici zahteva NOV dokaz, vsak izbris dokaza je rdeč.
// ============================================

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import {
  CAPABILITIES,
  buildMatrixDoc,
} from '../../../scripts/generate-validation-matrix'
import { MODULE_REGISTRY } from '../../../src/lib/modules/registry'

const root = process.cwd()
const committedDoc = readFileSync(path.join(root, 'docs', 'VALIDATION-MATRIX.md'), 'utf-8')

// 9 vrstic iz epika #144 §8 (natančen seznam — vrstni red ni pomemben, množica je)
const EPIC8_IDS = [
  'pos',
  'kds',
  'offline',
  'payment',
  'receipt',
  'furs',
  'printer',
  'stock',
  'daily-close',
]

describe('VALIDATION-MATRIX — struktura (epic #144 §8)', () => {
  it('vsebuje točno 9 vrstic epika §8 (natančna množica id-jev)', () => {
    const epic8 = CAPABILITIES.filter((c) => c.epic8).map((c) => c.id).sort()
    expect(epic8).toEqual([...EPIC8_IDS].sort())
  })

  it('razširitve po realni kodi obstajajo (§8: "expand according to the real codebase")', () => {
    const expansions = CAPABILITIES.filter((c) => !c.epic8)
    // Sodba R178: 8 razširitev — vsak poprimek (dodan/izbrisan) = premišljen dokazni korak
    expect(expansions.length).toBe(8)
    expect(expansions.map((c) => c.id)).toEqual([
      'auth-access',
      'tenant-security',
      'reservations-guest',
      'audit-compliance',
      'reporting-eod',
      'backup-recovery',
      'danes-cockpit',
      'workspaces-ia',
    ])
  })

  it('id-ji so unikatni (matrika brez dvojnih vrstic)', () => {
    const ids = CAPABILITIES.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('vsaka zmožnost ima vsaj eno dokazno sidro (brez trditev brez dokaza)', () => {
    for (const cap of CAPABILITIES) {
      const total = cap.anchors.unit.length + cap.anchors.integration.length + cap.anchors.e2e.length
      expect(total, `${cap.id} mora imeti vsaj eno sidro`).toBeGreaterThanOrEqual(1)
    }
  })

  it('sidra živijo v pravih direktorijih po kanalu (unit/IT/e2e)', () => {
    const prefixes: Record<'unit' | 'integration' | 'e2e', string> = {
      unit: 'tests/unit/',
      integration: 'tests/integration/',
      e2e: 'tests/e2e/',
    }
    for (const cap of CAPABILITIES) {
      for (const kind of ['unit', 'integration', 'e2e'] as const) {
        for (const anchor of cap.anchors[kind]) {
          expect(anchor.startsWith(prefixes[kind]), `${cap.id}: ${anchor} ni ${prefixes[kind]}*`).toBe(true)
        }
      }
    }
  })
})

describe('VALIDATION-MATRIX — sidra obstajajo (fail-closed)', () => {
  it('VSAKO sidro je realna datoteka na disku (brez "duh" dokazov)', () => {
    const missing: string[] = []
    for (const cap of CAPABILITIES) {
      for (const anchor of [...cap.anchors.unit, ...cap.anchors.integration, ...cap.anchors.e2e]) {
        if (!existsSync(path.join(root, anchor))) missing.push(`${cap.id}: ${anchor}`)
      }
    }
    expect(missing).toEqual([])
  })
})

describe('VALIDATION-MATRIX — anti-overclaim (epic #144 kanon)', () => {
  it('pilot je VEDNO ☐ (pilotStatus.executed = false — ni pilotnih trditev)', () => {
    for (const cap of CAPABILITIES) expect(cap.pilot, cap.id).toBe('☐')
  })

  it('realni kanali so VEDNO ☐ ali N/A (nikoli ✅) — fizična validacija ni izvedena', () => {
    for (const cap of CAPABILITIES) {
      for (const [channel, value] of [
        ['realHardware', cap.realHardware],
        ['realPayment', cap.realPayment],
        ['realExternal', cap.realExternal],
      ] as const) {
        expect(['N/A', '☐'], `${cap.id}.${channel} = ${value}`).toContain(value)
      }
    }
  })

  it('FURS vrstica nosi NOT PHYSICALLY VALIDATED opombo (sim-mode ≠ produkcija)', () => {
    const furs = CAPABILITIES.find((c) => c.id === 'furs')
    expect(furs).toBeDefined()
    expect(furs!.note).toContain('NOT PHYSICALLY VALIDATED')
    expect(furs!.realExternal).toBe('☐')
    expect(furs!.browserShort).toContain('SIM')
  })

  it('plačilni terminal ostaja ne-validiran (realPayment ☐)', () => {
    const payment = CAPABILITIES.find((c) => c.id === 'payment')
    expect(payment!.realPayment).toBe('☐')
  })

  it('dokument vsebuje kritično pravilo epika §8 (Green CI ≠ produkcija)', () => {
    expect(committedDoc).toContain('Green CI is not the same thing as production validation')
    expect(committedDoc).toContain('Zelen CI NI isto kot produkcijska validacija')
  })

  it('dokument vsebuje anti-overclaim blok', () => {
    expect(committedDoc).toContain('## Anti-overclaim')
    expect(committedDoc).toContain('NOT PHYSICALLY VALIDATED')
  })
})

describe('VALIDATION-MATRIX — determinizem (stale doc gate)', () => {
  it('commitana datoteka == buildMatrixDoc() (regeneracija je brez diff-a)', () => {
    expect(committedDoc).toBe(buildMatrixDoc())
  })

  it('buildMatrixDoc() je čista funkcija (dva klica = identičen izhod)', () => {
    expect(buildMatrixDoc()).toBe(buildMatrixDoc())
  })

  it('dokument je označen kot generiran (NE urejati ročno)', () => {
    expect(committedDoc).toContain('GENERIRANO z `scripts/generate-validation-matrix.ts`')
    expect(committedDoc).toContain('NE urejati ročno')
  })
})

describe('VALIDATION-MATRIX — §6 presek (register je vir id-jev)', () => {
  it('vsak moduleId iz matrice obstaja v MODULE_REGISTRY (76)', () => {
    const registryIds = new Set(MODULE_REGISTRY.map((m) => m.id))
    const unknown: string[] = []
    for (const cap of CAPABILITIES) {
      for (const mid of cap.moduleIds) {
        if (!registryIds.has(mid)) unknown.push(`${cap.id}: ${mid}`)
      }
    }
    expect(unknown).toEqual([])
  })

  it('zmožnosti z moduli so dejansko povezane (9/9 epik vrstic ima §6 presek)', () => {
    for (const id of EPIC8_IDS) {
      const cap = CAPABILITIES.find((c) => c.id === id)!
      expect(cap.moduleIds.length, `${id} naj bi bil povezan na §6 module`).toBeGreaterThan(0)
    }
  })
})

describe('VALIDATION-MATRIX — brskalniški dokazi nosijo rundno referenco', () => {
  it('vsak ✅/⚠️ brskalniški dokaz citira rundno poročilo (P5 ali R###)', () => {
    for (const cap of CAPABILITIES) {
      if (cap.browserShort === '—') continue
      expect(
        cap.browserShort,
        `${cap.id}: brskalniški dokaz brez rundne reference ("${cap.browserShort}")`,
      ).toMatch(/P5|R\d+/)
    }
  })

  it('detajl živega dokaza je sinonimen s kratkim žetonom (brez praznih ✅)', () => {
    for (const cap of CAPABILITIES) {
      if (cap.browserShort === '—') {
        // '—' + (neobvezna) razlaga, zakaj brskalniški dokaz ne obstaja — nikoli prazna trditev
        expect(cap.browserDetail.startsWith('—'), cap.id).toBe(true)
      } else {
        expect(cap.browserDetail.length, cap.id).toBeGreaterThan(20)
      }
    }
  })
})

describe('VALIDATION-MATRIX — §12 presek (PRODUCT-STATUS)', () => {
  const statusSrc = readFileSync(path.join(root, 'docs', 'PRODUCT-STATUS.md'), 'utf-8')
  const jsonMatch = statusSrc.match(/```json\n([\s\S]*?)\n```/)
  const status = jsonMatch ? (JSON.parse(jsonMatch[1]) as Record<string, unknown>) : null

  it('PRODUCT-STATUS JSON je parsan', () => {
    expect(status).not.toBeNull()
  })

  it('PRODUCT-STATUS navaja validationMatrix vir (§8 dokazni register)', () => {
    const shape = status?.['productShape'] as Record<string, unknown> | undefined
    expect(String(shape?.['validationMatrix'])).toContain('docs/VALIDATION-MATRIX.md')
    expect(String(shape?.['validationMatrix'])).toContain('validation-matrix.test')
  })

  it('PRODUCT-STATUS številka zmožnosti je sinhronizirana z matrico (17)', () => {
    const shape = status?.['productShape'] as Record<string, unknown> | undefined
    expect(String(shape?.['validationMatrix'])).toContain(String(CAPABILITIES.length))
  })
})
