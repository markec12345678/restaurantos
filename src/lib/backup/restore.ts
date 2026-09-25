// ============================================
// BACKUP / RESTORE — APLIKACIJA BACKUPA NA BAZO (P0-6)
// ============================================
// applyRestore(backup, opts) — validacija PRED vsakim DB zapisom, nato ENA
// interaktivna transakcija:
//   1. advisory lock (pg_advisory_xact_lock) — prepreči vzporedna restore-a
//   2. EN TRUNCATE TABLE <vse 103 tabele, vključno s Session> CASCADE —
//      seje invalide (security canon: vsi uporabniki odjavljeni po restore)
//   3. insert per model v topološkem redu (chunked createMany); ciklične
//      grupe (RecipeItem, ChartOfAccount) DVOPOSTOPNO: pass 1 vsi inserti z
//      null FK znotraj iste grupe → po pass 1 obstaja VSAKA vrstica grupe →
//      pass 2 update FK v poljubnem vrstnem redu (starš že obstaja)
//   4. verify: count() vs backup.counts per model — odstopanja = warning +
//      matched:false (POTICNO poročanje), tiha izguba vrstic (createMany count
//      < podanih vrstic) pa BackupError DB
//
// AuditLog: vrstice so v backupu ŽE v vrstnem redu verige (createBackup je
// chain-sortiral) — vstavljajo se AS-IS, brez preurejanja (createMany ohrani
// vrstni red polja → chainHash/previousHash zaporedje ostane skladno).
//
// POZOR KONTRAKT (R127-c): audit log o restore akciji piše KALLATELJ (route)
// PO commitu transakcije — applyRestore ga NAMERNO ne piše (createAuditLog bi
// hotel lastno transakcijo; znotraj restore tx je hash veriga drugačna srenja).
//
// verifyOnly=true: samo validacija + counts iz backupa — DB NI dotaknjen.

import 'server-only'

import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { BackupError } from './errors'
import { fkEdgesFor, getBackupManifest, resolveDelegate, type DmmfFieldInfo, type DmmfModelInfo } from './manifest'
import { computeChecksum, decodeRowValues } from './serialize'

export interface RestoreTableResult {
  expected: number
  restored: number
  matched: boolean
}

export interface RestoreResult {
  verifyOnly: boolean
  tables: Record<string, RestoreTableResult>
  totalExpected: number
  totalRestored: number
  matched: boolean
  warnings: string[]
  durationMs: number
}

// ---------- Konstante ----------

const ADVISORY_LOCK_KEY = 918273645
const TX_OPTS = { timeout: 120_000, maxWait: 15_000 } as const
// Obrambna meja velikosti tables (route ima svojo zgodnejšo mejo na body)
const MAX_TABLES_JSON_CHARS = 2_000_000_000

// ---------- Strukturni tipi tx klienta ----------

interface TxDelegate {
  createMany: (args: { data: Array<Record<string, unknown>> }) => Promise<{ count: number }>
  count: (args?: Record<string, unknown>) => Promise<number>
  update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>
}

type TxLike = {
  $executeRaw: (query: unknown, ...values: unknown[]) => Promise<number>
} & Record<string, unknown>

// ---------- DMMF skalarne informacije per model (cache) ----------

interface ScalarFieldInfo {
  name: string
  type: string
  isRequired: boolean
  hasDefault: boolean
  isUpdatedAt: boolean
}

const scalarFieldsCache = new Map<string, ScalarFieldInfo[]>()

function scalarFieldsFor(model: string): ScalarFieldInfo[] {
  const cached = scalarFieldsCache.get(model)
  if (cached) return cached
  const dmmf = (Prisma as unknown as { dmmf?: { datamodel?: { models?: unknown } } }).dmmf
  const models = (dmmf?.datamodel?.models ?? []) as unknown as DmmfModelInfo[]
  const dmmfModel = models.find(m => m.name === model)
  if (!dmmfModel) {
    throw new BackupError('MANIFEST', `Model ${model} ni v DMMF`)
  }
  const info = dmmfModel.fields
    .filter((f: DmmfFieldInfo) => f.kind === 'scalar')
    .map((f: DmmfFieldInfo) => ({
      name: f.name,
      type: f.type,
      isRequired: f.isRequired === true,
      hasDefault: Boolean(f.hasDefaultValue),
      isUpdatedAt: Boolean(f.isUpdatedAt),
    }))
  scalarFieldsCache.set(model, info)
  return info
}

// ---------- Sanitizacija vrstic ----------

/**
 * Očisti vrstice modela pred vstavljanjem: neznani ključi (niso DMMF skalarna
 * polja) → odstranjeni (agregiran warning), tagi (bigint/bytes) dekodirani,
 * ISO stringi za DateTime polja → Date objekti. Manjkajoče OBVEZNO polje brez
 * privzete vrednosti → BackupError FORMAT (model + indeks vrstice).
 */
function sanitizeRows(
  model: string,
  rows: Array<Record<string, unknown>>,
  warnings: string[],
): Array<Record<string, unknown>> {
  const fields = scalarFieldsFor(model)
  const known = new Set(fields.map(f => f.name))
  const out: Array<Record<string, unknown>> = []
  let stripped = 0

  rows.forEach((row, index) => {
    const clean: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(row)) {
      if (known.has(key)) clean[key] = value
      else stripped++
    }
    const decoded = decodeRowValues(clean)
    // DateTime koercija: ISO string → Date (Prisma sprejme oboje, Date je
    // varnejši prek driver adapterja; pokvarjen string pusti — javi bo DB)
    for (const f of fields) {
      if (f.type === 'DateTime' && typeof decoded[f.name] === 'string') {
        const d = new Date(decoded[f.name] as string)
        if (!Number.isNaN(d.getTime())) decoded[f.name] = d
      }
    }
    // Obvezna polja brez privzete vrednosti morajo biti prisotna
    for (const f of fields) {
      if (f.isRequired && !f.hasDefault && !f.isUpdatedAt && !(f.name in decoded)) {
        throw new BackupError(
          'FORMAT',
          `Tabela ${model} vrstica ${index}: manjka obvezno polje '${f.name}'`,
        )
      }
    }
    out.push(decoded)
  })

  if (stripped > 0) {
    warnings.push(`Tabela ${model}: odstranjenih ${stripped} neznanih ključev (niso DMMF skalarna polja)`)
  }
  return out
}

// ---------- Glavna funkcija ----------

/**
 * Aplikiraj backup na bazo (ali samo verificiraj z verifyOnly=true).
 * Vse napake so BackupError (code/status za route). Audit log o akciji piše
 * klicatelj PO commitu (glej kontrakt v headerju).
 */
export async function applyRestore(
  backup: unknown,
  opts?: { verifyOnly?: boolean; strict?: boolean },
): Promise<RestoreResult> {
  const started = Date.now()
  const verifyOnly = opts?.verifyOnly === true
  const strict = opts?.strict === true
  const warnings: string[] = []

  // ---------- VALIDACIJA (pred vsakim DB zapisom) ----------

  if (backup === null || typeof backup !== 'object' || Array.isArray(backup)) {
    throw new BackupError('FORMAT', 'Backup mora biti JSON objekt')
  }
  const file = backup as Record<string, unknown>

  if (file.format !== 'restaurantos-backup') {
    throw new BackupError('FORMAT', `Nepoznan format: ${String(file.format)} — pričakovano 'restaurantos-backup'`)
  }
  if (file.version !== 1) {
    throw new BackupError('VERSION', `Nepodprta verzija backupa: ${String(file.version)} — pričakovana 1`)
  }

  const manifest = getBackupManifest()

  if (file.counts === null || typeof file.counts !== 'object' || Array.isArray(file.counts)) {
    throw new BackupError('FORMAT', 'Backup.counts mora biti objekt { model: število vrstic }')
  }
  if (file.tables === null || typeof file.tables !== 'object' || Array.isArray(file.tables)) {
    throw new BackupError('FORMAT', 'Backup.tables mora biti objekt { model: vrstice[] }')
  }
  const counts = file.counts as Record<string, unknown>
  const tables = file.tables as Record<string, unknown>

  // MANIFEST — neznane tabele (tables IN counts)
  const unknownTables = [
    ...new Set([...Object.keys(tables), ...Object.keys(counts)]),
  ].filter(m => !manifest.models.includes(m))
  if (unknownTables.length > 0) {
    throw new BackupError('MANIFEST', `Backup vsebuje neznane tabele: ${unknownTables.join(', ')}`)
  }

  const tableKeys = Object.keys(tables)
  // counts pokriva vse tables (manjkajoči vnosi = warning, pričakovano 0)
  for (const m of tableKeys) {
    if (!(m in counts)) warnings.push(`Tabela ${m}: manjka pričakovana številka vrstic v backup.counts`)
  }
  // Vrstice: ne-null, ne-array objekti
  for (const m of tableKeys) {
    const rows = tables[m]
    if (!Array.isArray(rows)) {
      throw new BackupError('FORMAT', `Tabela ${m}: vrstice morajo biti seznam`)
    }
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      if (r === null || typeof r !== 'object' || Array.isArray(r)) {
        throw new BackupError('FORMAT', `Tabela ${m} vrstica ${i}: vrstica mora biti objekt`)
      }
    }
  }

  // SIZE guard (defenzivno, pred dragim checksum računanjem)
  let tablesJsonChars = 0
  try {
    tablesJsonChars = JSON.stringify(tables).length
  } catch {
    throw new BackupError('FORMAT', 'Backup.tables ni JSON-serializabilen')
  }
  if (tablesJsonChars > MAX_TABLES_JSON_CHARS) {
    throw new BackupError('SIZE', `Backup tables presega mejo (${tablesJsonChars} > ${MAX_TABLES_JSON_CHARS} znakov)`)
  }

  // CHECKSUM — nad PARSED tables/counts (encodeRowValues proizvaja JSON-varne
  // vrednosti, zato je kanonična oblika stabilna čez disk round-trip)
  if (typeof file.checksum === 'string' && file.checksum !== '') {
    const got = computeChecksum(tables)
    if (got !== file.checksum) {
      throw new BackupError(
        'CHECKSUM',
        `Checksum tables se ne ujema — pričakovano ${file.checksum}, izračunano ${got}`,
      )
    }
  }
  if (typeof file.countsChecksum === 'string' && file.countsChecksum !== '') {
    const gotCounts = computeChecksum(counts)
    if (gotCounts !== file.countsChecksum) {
      throw new BackupError(
        'CHECKSUM',
        `Checksum counts se ne ujema — pričakovano ${file.countsChecksum}, izračunano ${gotCounts}`,
      )
    }
  }

  // SCHEMA STAMP — drift detector (strict → napaka, sicer warning)
  const currentStamp = computeChecksum(manifest.models.join(','))
  if (file.schemaStamp !== currentStamp) {
    const msg = `Schema drift: backup schemaStamp ${String(file.schemaStamp)} ≠ trenutni manifest ${currentStamp}`
    if (strict) {
      throw new BackupError('MANIFEST', msg)
    }
    warnings.push(msg)
  }

  // ---------- verifyOnly — struktura + checksum, DB NI dotaknjen ----------

  if (verifyOnly) {
    warnings.push('verifyOnly — ni zapisov')
    const resultTables: Record<string, RestoreTableResult> = {}
    let totalExpected = 0
    const keys = [...new Set([...tableKeys, ...Object.keys(counts)])]
    for (const m of keys) {
      const expected = typeof counts[m] === 'number' ? (counts[m] as number) : 0
      totalExpected += expected
      resultTables[m] = { expected, restored: 0, matched: false }
    }
    return {
      verifyOnly: true,
      tables: resultTables,
      totalExpected,
      totalRestored: 0,
      matched: false,
      warnings,
      durationMs: Date.now() - started,
    }
  }

  // ---------- RESTORE ----------

  // Manifest-mode backup (brez tables) ni obnovljiv — TRUNCATE brez insertov
  // bi pomenil uničenje podatkov brez nadomestila.
  if (tableKeys.length === 0) {
    throw new BackupError(
      'FORMAT',
      'Backup ne vsebuje tabel za obnovitev (tables je prazen — manifest-mode dumpa ni mogoče obnoviti)',
    )
  }

  // Sanitizacija PRED transakcijo (validacija ne sme metati sredi tx)
  const sanitized: Record<string, Array<Record<string, unknown>>> = {}
  for (const m of tableKeys) {
    sanitized[m] = sanitizeRows(m, tables[m] as Array<Record<string, unknown>>, warnings)
  }

  // Načrt inserta v topološkem redu; ciklične grupe dobita seznam FK kolon,
  // ki kažejo znotraj iste grupe (pass 1 null, pass 2 update).
  const cycleGroupOf = new Map<string, string[]>()
  for (const group of manifest.cycles) {
    for (const m of group) cycleGroupOf.set(m, group)
  }
  const insertPlan = manifest.models
    .filter(m => m in sanitized)
    .map(m => {
      const group = cycleGroupOf.get(m)
      if (!group) return { model: m, cycleColumns: null as string[] | null }
      const edges = fkEdgesFor(m).filter(e => group.includes(e.target))
      for (const edge of edges) {
        if (edge.isRequired) {
          // Manifest bi to že ujel ob gradnji — defenziva za direktno uporabo
          throw new BackupError(
            'CYCLE',
            `Ciklična grupa [${group.join(', ')}] vsebuje obvezno FK povezavo ${m} → ${edge.target}`,
          )
        }
      }
      const columns = [...new Set(edges.flatMap(e => e.columns))]
      return { model: m, cycleColumns: columns.length > 0 ? columns : null }
    })

  let txOutcome: { resultTables: Record<string, RestoreTableResult>; matchedAll: boolean }

  try {
    txOutcome = await db.$transaction(async (prismaTx) => {
      const tx = prismaTx as unknown as TxLike

      // 1) Advisory lock — samo en restore na proces/instanco
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})`

      // 2) TRUNCATE — EN stavek z VSEMI tabelami + CASCADE (vključno s Session:
      //    seje invalide → vsi uporabniki odjavljeni po restore = security canon)
      const quoted = manifest.truncateModels.map(t => Prisma.sql`"${Prisma.raw(t)}"`)
      await tx.$executeRaw(Prisma.sql`TRUNCATE TABLE ${Prisma.join(quoted)} CASCADE`)

      // 3) Insert per model — topološki red; AuditLog vrstice gredo AS-IS v
      //    vrstnem redu datoteke (veriga je že sortirana ob createBackup —
      //    preurejanje bi pokvarilo chainHash zaporedje).
      for (const step of insertPlan) {
        const delegate = resolveDelegate(step.model, tx) as TxDelegate
        const rows = sanitized[step.model] as Array<Record<string, unknown>>
        if (rows.length === 0) continue

        let pass1Rows = rows
        const pendingFkRestores: Array<{ id: unknown; data: Record<string, unknown> }> = []

        if (step.cycleColumns) {
          // Dvopostopni insert za ciklično grupo: pass 1 null znotraj-grupe FK
          pass1Rows = rows.map(row => {
            const clone: Record<string, unknown> = { ...row }
            const fkData: Record<string, unknown> = {}
            for (const col of step.cycleColumns as string[]) {
              if (clone[col] !== null && clone[col] !== undefined) {
                fkData[col] = clone[col]
                clone[col] = null
              }
            }
            if (Object.keys(fkData).length > 0) pendingFkRestores.push({ id: clone.id, data: fkData })
            return clone
          })
        }

        // Chunked createMany (velikost iz manifesta — proračun bind parametrov)
        const chunkSize = manifest.chunkSizes[step.model] ?? 500
        let created = 0
        for (let i = 0; i < pass1Rows.length; i += chunkSize) {
          const chunk = pass1Rows.slice(i, i + chunkSize)
          const res = await delegate.createMany({ data: chunk })
          created += typeof res?.count === 'number' ? res.count : chunk.length
        }
        if (created < pass1Rows.length) {
          // Tiha izguba vrstic = katastrofa pri restore → prekini (tx rollback)
          throw new BackupError(
            'DB',
            `Tabela ${step.model}: createMany je vstavil ${created}/${pass1Rows.length} vrstic — tiha izguba, prekinjam transakcijo`,
          )
        }

        if (step.cycleColumns && pendingFkRestores.length > 0) {
          // pass 2: povrni realne FK vrednosti. Po pass 1 obstaja VSAKA vrstica
          // grupe (vse vstavljene z null FK) → updatei delujejo v POLJUBNEM
          // vrstnem redu (starš vrstica že obstaja; njegov lastni FK lahko še
          // čaka na svoj update — polje je nullable po CYCLE politiki).
          for (const pending of pendingFkRestores) {
            if (pending.id === undefined || pending.id === null) {
              throw new BackupError(
                'FORMAT',
                `Tabela ${step.model}: vrstica s ciklično FK povezavo mora imeti 'id' (za dvopostopni update)`,
              )
            }
            await delegate.update({
              where: { id: pending.id as string },
              data: pending.data,
            })
          }
        }
      }

      // 4) Verify per model — count() vs backup.counts (tudi za modele iz
      //    counts brez tables: po truncate bodo imeli 0 → odstopanje = warning)
      const resultTables: Record<string, RestoreTableResult> = {}
      let matchedAll = true
      const verifyModels = manifest.models.filter(m => m in sanitized || m in counts)
      for (const m of verifyModels) {
        const delegate = resolveDelegate(m, tx) as TxDelegate
        const expected = typeof counts[m] === 'number' ? (counts[m] as number) : 0
        const actual = await delegate.count()
        const matched = expected === actual
        if (!matched) {
          matchedAll = false
          warnings.push(`Tabela ${m}: pričakovano ${expected}, dejansko ${actual} po obnovitvi`)
        }
        resultTables[m] = { expected, restored: actual, matched }
      }
      return { resultTables, matchedAll }
    }, TX_OPTS)
  } catch (err: unknown) {
    if (err instanceof BackupError) throw err
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      throw new BackupError('DB', `Restore DB napaka [${err.code}]: ${err.message}`)
    }
    throw new BackupError('DB', `Restore ni uspel: ${err instanceof Error ? err.message : String(err)}`)
  }

  const resultTables = txOutcome.resultTables
  let totalExpected = 0
  let totalRestored = 0
  for (const t of Object.values(resultTables)) {
    totalExpected += t.expected
    totalRestored += t.restored
  }
  if (!txOutcome.matchedAll) {
    logger.warn('BACKUP', `Restore zaključen z odstopanji (${warnings.length} opozoril)`)
  }

  return {
    verifyOnly: false,
    tables: resultTables,
    totalExpected,
    totalRestored,
    matched: txOutcome.matchedAll,
    warnings,
    durationMs: Date.now() - started,
  }
}
