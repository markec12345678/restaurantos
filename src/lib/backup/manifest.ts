// ============================================
// BACKUP — MANIFEST (P0-6): DMMF je edini vir resnice
// ============================================
// Manifest je izpeljan iz Prisma.dmmf.datamodel.models (generiran klient) in
// določa: kateri modeli/tabele obstajajo, topološki INSERT red (FK odvisnosti),
// obseg TRUNCATE stavka, ciklične grupe (self-reference/SCC) in velikosti
// chunkov za createMany. Izračuna se ENKRAT (modul cache) — DMMF med procesom
// ne pride.
//
// Pomembno:
//  • excluded = ['Session'] — sej se NE varnostno kopira (security: tokeni),
//    a se VSEENO TRUNCATE-ajo → po restore so vsi uporabniki odjavljeni.
//  • Cikli (RecipeItem.parentRecipeItem, ChartOfAccount.parent — obe
//    nullable self-referenci) se rešujejo DVOPOSTOPNO ob restore: pass 1
//    insert z null FK znotraj iste ciklične grupe, pass 2 update FK.
//    Če cikel vsebuje OBVEZNO (non-nullable) FK povezavo → BackupError CYCLE
//    (tak restore ni mogoč; dandanes se ne zgodi — obe sta nullable).
//  • chunkSizes: max(1, floor(9000 / št. skalarnih polj)), strop 500 —
//    pokritje parameter limite (Postgres max bind params ~65535, varnostno).

import { Prisma } from '@prisma/client'
import { BackupError } from './errors'

export interface BackupManifest {
  /** Topološki INSERT red — vsi DMMF modeli RAZEN excluded. */
  models: string[]
  /** model → fizična tabela (dbName ?? name). */
  tableNames: Record<string, string>
  /** Modeli izključeni iz backup vsebine (a NE iz TRUNCATE). */
  excluded: string[]
  /** Fizične tabele za EN TRUNCATE ... CASCADE stavek (vključno z excluded). */
  truncateModels: string[]
  /** SCC komponente (Tarjan) z >1 članom ALI samoreferenco. */
  cycles: string[][]
  /** Max vrstic na createMany chunk (per model). */
  chunkSizes: Record<string, number>
}

/** Minimalna strukturna tipa čez DMMF (ločena od notranjih Prisma tipov). */
export interface DmmfFieldInfo {
  name: string
  kind: string
  type: string
  isRequired: boolean
  hasDefaultValue?: unknown
  isUpdatedAt?: boolean
  relationFromFields?: string[]
}

export interface DmmfModelInfo {
  name: string
  dbName?: string
  fields: DmmfFieldInfo[]
}

/** FK povezava modela: kolone, ki kažejo na target model. */
export interface FkEdge {
  fromModel: string
  target: string
  columns: string[]
  isRequired: boolean
}

// Identifikatorji tabel so interpolirani kot Prisma.raw v TRUNCATE stavek —
// obvezna validacija oblike (drugače SQL injection prek dbName).
const IDENTIFIER_RE = /^[A-Za-z][A-Za-z0-9_]*$/

const EXCLUDED_MODELS = ['Session']

const CHUNK_PARAM_BUDGET = 9000
const CHUNK_MAX = 500

function readDmmfModels(): DmmfModelInfo[] {
  const raw = (Prisma as unknown as { dmmf?: { datamodel?: { models?: unknown } } }).dmmf
  const models = raw?.datamodel?.models
  if (!Array.isArray(models) || models.length === 0) {
    throw new BackupError('MANIFEST', 'Prisma DMMF ni na voljo — generiraj klienta (@prisma/client)')
  }
  return models as unknown as DmmfModelInfo[]
}

// ---------- FK grafi ----------

/**
 * FK povezave modela (samo lastniška stran relacije — relationFromFields
 * ne-prazna). Vključuje samoreference. Cache per model.
 */
const fkEdgesCache = new Map<string, FkEdge[]>()
export function fkEdgesFor(model: string): FkEdge[] {
  const cached = fkEdgesCache.get(model)
  if (cached) return cached
  const dmmfModel = readDmmfModels().find(m => m.name === model)
  if (!dmmfModel) {
    throw new BackupError('MANIFEST', `Model ${model} ni v DMMF`)
  }
  const edges: FkEdge[] = []
  for (const f of dmmfModel.fields) {
    if (f.kind !== 'object') continue
    const columns = f.relationFromFields
    if (!Array.isArray(columns) || columns.length === 0) continue // back-relation brez FK kolone
    edges.push({
      fromModel: model,
      target: f.type,
      columns: [...columns],
      isRequired: f.isRequired === true,
    })
  }
  fkEdgesCache.set(model, edges)
  return edges
}

/**
 * Kahn topološki sort nad grafom odvisnosti (povezave NA SEBE so izključene,
 * sicer vozlišče nikoli ne doseže in-degree 0). Izid: target modeli pred
 * modeli, ki nanje kažejo; izenačene pripadnosti po abecedi (deterministično).
 */
function topoSort(prereqs: Map<string, Set<string>>): string[] {
  const remaining = new Map(prereqs)
  const ready = [...prereqs.keys()].filter(m => (prereqs.get(m) as Set<string>).size === 0).sort()
  const order: string[] = []
  while (ready.length > 0) {
    ready.sort()
    const m = ready.shift() as string
    order.push(m)
    for (const [dependent, deps] of remaining) {
      if (dependent === m || !deps.has(m)) continue
      deps.delete(m)
      if (deps.size === 0) ready.push(dependent)
    }
  }
  // Defenziva: veččlanske SCC komponente Kahn ne uredi — pripni na konec
  // (urejene po abecedi); ob restore jih pokrije dvopostopni mehanizem.
  const ordered = new Set(order)
  const leftovers = [...prereqs.keys()].filter(m => !ordered.has(m)).sort()
  order.push(...leftovers)
  return order
}

/**
 * Tarjan SCC nad grafom, ki VKLJUČUJE samoreference → ciklične grupe so
 * komponente z >1 članom ALI vozlišče s samopovezavo.
 */
function tarjanCycles(graph: Map<string, Set<string>>): string[][] {
  let counter = 0
  const index = new Map<string, number>()
  const low = new Map<string, number>()
  const onStack = new Set<string>()
  const stack: string[] = []
  const sccs: string[][] = []

  const strongconnect = (v: string): void => {
    index.set(v, counter)
    low.set(v, counter)
    counter++
    stack.push(v)
    onStack.add(v)
    for (const w of graph.get(v) as Set<string>) {
      if (!index.has(w)) {
        strongconnect(w)
        low.set(v, Math.min(low.get(v) as number, low.get(w) as number))
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v) as number, index.get(w) as number))
      }
    }
    if (low.get(v) === index.get(v)) {
      const comp: string[] = []
      let w: string
      do {
        w = stack.pop() as string
        onStack.delete(w)
        comp.push(w)
      } while (w !== v)
      sccs.push(comp)
    }
  }

  for (const v of graph.keys()) {
    if (!index.has(v)) strongconnect(v)
  }
  return sccs
}

// ---------- Delegate resolver ----------

/**
 * Ime delegata na Prisma klientu = ime modela z malo prvo črko (MenuItem →
 * menuItem). ČISTA funkcija — brez klienta (manifest ostane pure).
 */
export function delegateFor(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1)
}

const delegateCache = new Map<string, string>()

/**
 * Poišči delegata na PODANEM klientu (db ALI tx). Primarno `delegateFor`,
 * fallback: case-insensitive pregled lastnih ključev klienta. Rezultat imena
 * se cache-ira po prvem uspešnem checku (oblika klienta se med procesom ne
 * spremeni). Če delegata ni → BackupError DB 500.
 */
export function resolveDelegate(model: string, client: unknown): unknown {
  if (client === null || typeof client !== 'object') {
    throw new BackupError('DB', `Neveljaven db klient za model ${model}`)
  }
  const rec = client as Record<string, unknown>
  const lookup = (name: string): unknown => {
    const value = rec[name]
    if (value !== null && typeof value === 'object') return value
    return undefined
  }

  const cached = delegateCache.get(model)
  if (cached) {
    const viaCache = lookup(cached)
    if (viaCache !== undefined) return viaCache
  }

  const primary = delegateFor(model)
  const viaPrimary = lookup(primary)
  if (viaPrimary !== undefined) {
    delegateCache.set(model, primary)
    return viaPrimary
  }

  const lower = model.toLowerCase()
  for (const key of Object.keys(rec)) {
    if (key.toLowerCase() === lower) {
      const viaScan = lookup(key)
      if (viaScan !== undefined) {
        delegateCache.set(model, key)
        return viaScan
      }
    }
  }
  throw new BackupError('DB', `Delegat za model ${model} ne obstaja na db klientu (pričakovano '${primary}')`)
}

// ---------- Manifest ----------

let cachedManifest: BackupManifest | null = null

/**
 * Zgradi (in cache-iraj) backup manifest iz DMMF. Mete BackupError MANIFEST
 * (neveljavno ime tabele / manjkajoč DMMF) ali CYCLE (cikel z obvezno FK).
 */
export function getBackupManifest(): BackupManifest {
  if (cachedManifest) return cachedManifest

  const dmmfModels = readDmmfModels()

  // 1) Fizična imena tabel + validacija identifikatorjev
  const tableNames: Record<string, string> = {}
  for (const m of dmmfModels) {
    const table = m.dbName ?? m.name
    if (!IDENTIFIER_RE.test(table)) {
      throw new BackupError(
        'MANIFEST',
        `Neveljavno ime fizične tabele '${table}' (model ${m.name}) — pričakovano /^[A-Za-z][A-Za-z0-9_]*$/`,
      )
    }
    tableNames[m.name] = table
  }

  // 2) Graf odvisnosti: povezava target → model (target se vstavi prej).
  //    Za Kahn brez samopovezav, za Tarjan z njimi.
  const prereqNoSelf = new Map<string, Set<string>>()
  const prereqWithSelf = new Map<string, Set<string>>()
  for (const m of dmmfModels) {
    prereqNoSelf.set(m.name, new Set())
    prereqWithSelf.set(m.name, new Set())
  }
  for (const m of dmmfModels) {
    for (const edge of fkEdgesFor(m.name)) {
      const targetSet = prereqWithSelf.get(m.name) as Set<string>
      targetSet.add(edge.target)
      if (edge.target !== m.name && prereqNoSelf.has(edge.target)) {
        ;(prereqNoSelf.get(m.name) as Set<string>).add(edge.target)
      }
    }
  }

  // 3) Topološki red + ciklične grupe
  const topo = topoSort(prereqNoSelf)
  const sccs = tarjanCycles(prereqWithSelf)
  const cycles: string[][] = []
  for (const comp of sccs) {
    const isSelfLoop = comp.length === 1 && (prereqWithSelf.get(comp[0] as string) as Set<string>).has(comp[0] as string)
    if (comp.length > 1 || isSelfLoop) cycles.push([...comp].sort())
  }
  cycles.sort((a, b) => a[0].localeCompare(b[0]))

  // 4) CYCLE POLICY: obvezna FK povezava ZNOTRAJ ciklične grupe → ni obnovljivo
  for (const group of cycles) {
    for (const member of group) {
      for (const edge of fkEdgesFor(member)) {
        if (group.includes(edge.target) && edge.isRequired) {
          throw new BackupError(
            'CYCLE',
            `Ciklična grupa [${group.join(', ')}] vsebuje OBVEZNO FK povezavo ` +
              `${member} → ${edge.target} (${edge.columns.join(', ')}) — dvopostopni restore ni mogoč`,
          )
        }
      }
    }
  }

  // 5) Excluded (security: seje se ne kopirajo) + obseg TRUNCATE (VSE tabele)
  const excluded = EXCLUDED_MODELS.filter(m => m in tableNames)
  const models = topo.filter(m => !excluded.includes(m))
  const truncateModels = topo.map(m => tableNames[m] as string)

  // 6) Chunk velikosti: proračun bind parametrov (strop 500, minimum 1)
  const chunkSizes: Record<string, number> = {}
  for (const m of dmmfModels) {
    const scalarCount = Math.max(1, m.fields.filter(f => f.kind === 'scalar').length)
    chunkSizes[m.name] = Math.min(CHUNK_MAX, Math.max(1, Math.floor(CHUNK_PARAM_BUDGET / scalarCount)))
  }

  cachedManifest = { models, tableNames, excluded, truncateModels, cycles, chunkSizes }
  return cachedManifest
}
