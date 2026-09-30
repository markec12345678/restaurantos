// ============================================
// BUSINESS CHAIN — drift-gate (epic #144 §10 + §22 korak 10, R180)
// ============================================
//
// docs/BUSINESS-CHAIN.md je generiran register poslovne verige
// (scripts/generate-business-chain.ts). Ta test uveljavlja:
//   1. struktura: 11 vrstic epika §10 + 3 razširitve po realni kodi (14 skupaj)
//   2. fail-closed: vsako dejstvo ima vsaj 1 model + 1 writer + 1 reader
//      (celotna fail-closed validacija — modeli/poti/§6 moduli/audit akcije —
//      teče znotraj buildBusinessChainDoc(), ki jo determinizem-test pokliče;
//      kakršen koli "duh" sidro = rdeče)
//   3. R180 fs-pini novega stanja: R106 kanon za transactions POST
//      (createManualStockTransaction) + A8 rešitev (createAuditLog kanon
//      namesto direktnega db.auditLog.create) + POP status enum komentar
//   4. anti-overclaim: strukturna verifikacija ≠ produkcijska validacija,
//      audit brez akcij je izrecno zabeležen, ledger princip
//   5. determinizem: commitana datoteka == buildBusinessChainDoc()
//      (stale doc = rdeče), čista funkcija (2 klica = identičen izhod)
//
// "Business-chain verification" (§22 korak 10): ta datoteka JE vrata —
// vsak premik pisalne poti / audit akcije zahteva regeneracijo + nov dokaz.
// Test je čist fs + import generatorja: BREZ DB / network odvisnosti.
// ============================================

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { FACTS, buildBusinessChainDoc } from '../../../scripts/generate-business-chain'
import { MODULE_REGISTRY } from '../../../src/lib/modules/registry'

const root = process.cwd()
const committedDoc = readFileSync(path.join(root, 'docs', 'BUSINESS-CHAIN.md'), 'utf-8')

// 11 vrstic iz epika #144 §10 (natančen seznam — vrstni red ni pomemben, množica je)
const EPIC10_IDS = [
  'menu-item',
  'price',
  'recipe',
  'stock',
  'waste',
  'purchase',
  'supplier',
  'order',
  'payment',
  'receipt',
  'customer',
]

// 3 razširitve po realni kodi (natančen vrstni red)
const EXPANSION_IDS = ['cash-shift', 'stocktake', 'audit-infra']

/** Odstrani // vrstične in /* bločne komentarje (za pina, ki ne smejo zadeti opomb). */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

describe('BUSINESS-CHAIN — struktura (epic #144 §10)', () => {
  it('vsebuje točno 11 vrstic epika §10 (natančna množica id-jev)', () => {
    const epic10 = FACTS.filter((f) => f.epic10).map((f) => f.id).sort()
    expect(epic10).toEqual([...EPIC10_IDS].sort())
  })

  it('razširitve po realni kodi obstajajo (3, natančen vrstni red)', () => {
    const expansions = FACTS.filter((f) => !f.epic10)
    expect(expansions.map((f) => f.id)).toEqual(EXPANSION_IDS)
  })

  it('epic10 pokritost: vsaj 11 dejstev z epic10:true, skupno ≥ 14', () => {
    expect(FACTS.filter((f) => f.epic10).length).toBeGreaterThanOrEqual(11)
    expect(FACTS.length).toBeGreaterThanOrEqual(14)
  })

  it('id-ji so unikatni (veriga brez dvojnih vrstic)', () => {
    const ids = FACTS.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('BUSINESS-CHAIN — fail-closed (brez "duh" dejstev)', () => {
  it('VSAKO dejstvo ima vsaj 1 model + 1 writer + 1 reader (fail-closed pin)', () => {
    for (const f of FACTS) {
      expect(f.models.length, `${f.id}: vsaj 1 Prisma model`).toBeGreaterThanOrEqual(1)
      expect(f.writers.length, `${f.id}: vsaj 1 writer pot`).toBeGreaterThanOrEqual(1)
      expect(f.readers.length, `${f.id}: vsaj 1 reader pot`).toBeGreaterThanOrEqual(1)
    }
  })

  it('vsak Prisma model obstaja v schema.prisma (^model, fail-closed)', () => {
    const schema = readFileSync(path.join(root, 'prisma', 'schema.prisma'), 'utf-8')
    const missing: string[] = []
    for (const f of FACTS) {
      for (const model of f.models) {
        if (!new RegExp(`^model ${model}\\b`, 'm').test(schema)) missing.push(`${f.id}: ${model}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('vsaka writer/reader pot je realna datoteka na disku (fail-closed)', () => {
    const missing: string[] = []
    for (const f of FACTS) {
      for (const w of f.writers) {
        if (!existsSync(path.join(root, w))) missing.push(`${f.id} writer: ${w}`)
      }
      for (const r of f.readers) {
        if (!existsSync(path.join(root, r))) missing.push(`${f.id} reader: ${r}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('vsak moduleId obstaja v §6 MODULE_REGISTRY (presek z registerjem)', () => {
    const registryIds = new Set(MODULE_REGISTRY.map((m) => m.id))
    const unknown: string[] = []
    for (const f of FACTS) {
      for (const mid of f.modules) {
        if (!registryIds.has(mid)) unknown.push(`${f.id}: ${mid}`)
      }
    }
    expect(unknown).toEqual([])
  })

  it('dejstva z moduli so dejansko povezana (11/11 epik vrstic ima §6 presek)', () => {
    for (const id of EPIC10_IDS) {
      const f = FACTS.find((x) => x.id === id)!
      expect(f.modules.length, `${id} naj bi bil povezan na §6 module`).toBeGreaterThan(0)
    }
  })
})

describe('BUSINESS-CHAIN — R180 fs-pini (novo stanje kanona)', () => {
  const txRoute = readFileSync(
    path.join(root, 'src/app/api/inventory/transactions/route.ts'),
    'utf-8',
  )
  const stockMutations = readFileSync(
    path.join(root, 'src/app/api/inventory/_helpers/stock-mutations.ts'),
    'utf-8',
  )
  const paymentsPut = stripComments(
    readFileSync(path.join(root, 'src/app/api/payments/[id]/route.ts'), 'utf-8'),
  )
  const qrPayConfirm = stripComments(
    readFileSync(path.join(root, 'src/app/api/qr-pay/confirm/route.ts'), 'utf-8'),
  )
  const schema = readFileSync(path.join(root, 'prisma', 'schema.prisma'), 'utf-8')
  const dbLib = readFileSync(path.join(root, 'src/lib/db.ts'), 'utf-8')

  it('A1: transactions POST je na R106 kanonu (createManualStockTransaction + structuredErrorResponse)', () => {
    expect(txRoute).toContain('createManualStockTransaction')
    expect(txRoute).toContain('structuredErrorResponse')
  })

  it('A1: transactions POST NE vsebuje starega clamp-a in NE inline tx mutacij (kanon = helper)', () => {
    expect(txRoute).not.toContain('newQty < 0 ? 0 : newQty')
    expect(txRoute).not.toContain('db.$transaction')
  })

  it('A1: helper izvozi createManualStockTransaction s skupnim lock ključem + FEFO porabo', () => {
    expect(stockMutations).toContain('export async function createManualStockTransaction')
    expect(stockMutations).toContain('inventoryStockLockKey(inventoryItemId)')
    expect(stockMutations).toContain('recordBatchConsumption')
  })

  it('A8: PUT /api/payments/[id] piše audit prek createAuditLog kanona (brez direktnega pisanja)', () => {
    expect(paymentsPut).toContain('createAuditLog(')
    expect(paymentsPut).not.toContain('db.auditLog.create')
  })

  it('A8: qr-pay/confirm piše audit prek createAuditLog kanona (brez direktnega pisanja)', () => {
    expect(qrPayConfirm).toContain('createAuditLog(')
    expect(qrPayConfirm).not.toContain('db.auditLog.create')
  })

  it('POP status enum komentar je usklajen (R180: draft, submitted, approved, partial, received, cancelled)', () => {
    expect(schema).toContain('draft, submitted, approved, partial, received, cancelled')
    expect(schema).not.toContain('draft, sent, confirmed')
  })

  it('A9: src/lib/db.ts izvozi createAuditLog (EDINI pisalni kanon za audit)', () => {
    expect(dbLib).toContain('export async function createAuditLog')
  })
})

describe('BUSINESS-CHAIN — anti-overclaim (epic #144 kanon)', () => {
  it('dokument je označen kot generiran (NE urejati ročno)', () => {
    expect(committedDoc).toContain('GENERIRANO z `scripts/generate-business-chain.ts`')
    expect(committedDoc).toContain('NE urejati ročno')
  })

  it('dokument nosi celotno verigo epika §10 (kontinuiteta menu → … → finance/reporting)', () => {
    expect(committedDoc).toContain(
      'menu → recipe → order → KDS → stock → waste → procurement → supplier → cost → finance/reporting',
    )
  })

  it('A1 je dokumentiran kot REŠENO R180 (drift-gate na rešitev, ne na težavo)', () => {
    expect(committedDoc).toContain('A1')
    expect(committedDoc).toContain('REŠENO R180')
  })

  it('A3 ostaja dokumentirano odprto arhitekturno tveganje (P1 kandidat)', () => {
    expect(committedDoc).toContain('A3')
    expect(committedDoc).toContain('recalculateAffectedChecks')
    expect(committedDoc).toContain('P1 kandidat')
  })

  it('dokument je strukturna verifikacija, NE produkcijska validacija', () => {
    expect(committedDoc).toContain('NE produkcijska validacija')
    expect(committedDoc).not.toContain('produkcijsko validiran')
  })

  it('audit brez akcij je izrecno zabeležen (ne tiho) — menu-item in price imata Opombo', () => {
    expect(committedDoc).toContain('- **Audit**: — (brez namenskih AuditLog akcij)')
    expect(committedDoc).toContain('NI AuditLog akcij za meni CRUD (izrecno zabeleženo)')
  })
})

describe('BUSINESS-CHAIN — determinizem (stale doc gate)', () => {
  it('commitana datoteka == buildBusinessChainDoc() (regeneracija je brez diff-a)', () => {
    expect(committedDoc).toBe(buildBusinessChainDoc())
  })

  it('buildBusinessChainDoc() je čista funkcija (dva klica = identičen izhod)', () => {
    expect(buildBusinessChainDoc()).toBe(buildBusinessChainDoc())
  })
})
