// ============================================
// JSON FIELDS — schema-paritetni drift-gate (R197, KNOWN_ISSUES #33 zaprtje)
//
// Kontrakt (R150 #33 Phase 3 + R197 zaprtje):
//   25 inventariziranih polj (migrated: true) ≡ Json  v prisma/schema.prisma
//                                             ≡ TYPE JSONB stavek v prisma/migrations/0022_json_fields
//    6 ostankov (brez migrated flag)          ≡ String v shemi (byte-exact pin, R150-a kontrakt):
//       - OrderItem.modifiersJson          (dual-write legacy wire — drop odložen, produktna odločitev)
//       - AuditLog.details                 (hash veriga recompute-a iz shranjenega stringa)
//       - WebhookDelivery.payload          (retry + HMAC reproducibilnost)
//       - RestaurantSettings.apiKeys       (deprecatiran keystore — P0-C5 ApiKey tabela)
//       - MenuItem.allergens, Modifier.allergens (CSV, NI JSON — izven scope-a #33)
//
// Zakaj: json-fields.test.ts (100 testov) pinira parserje in inventar, ampak NE
// shemsko pariteto — tip-drift (Json → String ali obratno) brez posodobitve
// inventarja bi šel skozi CI nezaznan. Ta vrata zapirajo to vrzel:
//   vsaka sprememba tipa inventoriziranega polja = RDEČ test,
//   vsako nesoglasje inventar ≡ shema ≡ migracija = RDEČ test.
//
// Lekcija (parser): model bloki se parsajo VRSTIČNO — regex `model X {([^}]*)}`
// je pokvarjen, ker se ustavi na `}` znotraj `@default("{}")` vrednosti.
// ============================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { JSON_FIELDS, JSON_WIRE_FIELDS } from '@/lib/json-fields'

const root = process.cwd()

const schemaSrc = readFileSync(path.join(root, 'prisma', 'schema.prisma'), 'utf-8')
const migrationSrc = readFileSync(
  path.join(root, 'prisma', 'migrations', '0022_json_fields', 'migration.sql'),
  'utf-8',
)

interface SchemaField {
  type: string
}

/** Vrstični parser model blokov — odporen na `}` znotraj `@default("{}")`. */
function parseSchemaModels(src: string): Map<string, Map<string, SchemaField>> {
  const models = new Map<string, Map<string, SchemaField>>()
  let current: string | null = null
  for (const line of src.split('\n')) {
    const start = line.match(/^model (\w+) \{\s*$/)
    if (start) {
      current = start[1]
      models.set(current, new Map())
      continue
    }
    if (current === null) continue
    if (/^\}/.test(line)) {
      current = null
      continue
    }
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('@@') || trimmed === '') continue
    const field = line.match(/^\s{2}(\w+)\s+([\w[\]?]+)/)
    if (field) {
      models.get(current)!.set(field[1], { type: field[2].replace(/\?$/, '') })
    }
  }
  return models
}

/** Iz 0022 migracije izvleči množico "Model.kolona" TYPE JSONB stavkov. */
function parseMigrationJsonbColumns(src: string): Set<string> {
  const out = new Set<string>()
  const re = /ALTER TABLE "(\w+)" ALTER COLUMN "(\w+)" TYPE JSONB/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) out.add(`${m[1]}.${m[2]}`)
  return out
}

const schemaModels = parseSchemaModels(schemaSrc)
const migratedEntries = JSON_FIELDS.filter((f) => f.migrated)
const deferEntries = JSON_FIELDS.filter((f) => !f.migrated)
const jsonbColumns = parseMigrationJsonbColumns(migrationSrc)

function expectSchemaType(
  entries: typeof JSON_FIELDS,
  expectedType: 'Json' | 'String',
  label: string,
): void {
  const problems: string[] = []
  for (const entry of entries) {
    const model = schemaModels.get(entry.model)
    if (!model) {
      problems.push(`${entry.model}.${entry.field}: model NE OBSTAJA v schema.prisma`)
      continue
    }
    const field = model.get(entry.field)
    if (!field) {
      problems.push(`${entry.model}.${entry.field}: polje NE OBSTAJA v modelu`)
      continue
    }
    if (field.type !== expectedType) {
      problems.push(`${entry.model}.${entry.field}: je ${field.type}, kontrakt zahteva ${expectedType}`)
    }
  }
  expect(problems, label).toEqual([])
}

describe('JSON FIELDS schema-paritetni drift-gate (R197, #33) — inventar ≡ schema', () => {
  it('schema.prisma je parsan in vsi inventarni modeli obstajajo', () => {
    expect(schemaModels.size).toBeGreaterThan(50)
    const missing = [...new Set(JSON_FIELDS.map((f) => f.model))].filter(
      (m) => !schemaModels.has(m),
    )
    expect(missing, 'manjkajoči modeli').toEqual([])
  })

  it('inventar je popoln: 31 postavk (25 migriranih + 6 ostankov)', () => {
    expect(JSON_FIELDS.length).toBe(31)
    expect(migratedEntries.length).toBe(25)
    expect(deferEntries.length).toBe(6)
  })

  it('25 migriranih polj ≡ Json v schema.prisma (R150 0022_json_fields kontrakt)', () => {
    expectSchemaType(migratedEntries, 'Json', 'migrirana polja morajo biti Json')
  })

  it('6 ostankov ≡ String v schema.prisma (byte-exact pin, R150-a kontrakt)', () => {
    expectSchemaType(deferEntries, 'String', 'ostanki morajo ostati String')
  })

  it('ostanki imajo izrecno utemeljitev v inventarju (nič tiho)', () => {
    for (const entry of deferEntries) {
      const justified =
        entry.description.includes('DEFER') ||
        entry.description.includes('LEGACY wire') ||
        entry.description.includes('CSV')
      expect(justified, `${entry.model}.${entry.field}: manjka utemeljitev`).toBe(true)
    }
    // konkretni razlogi po postavkah
    const byKey = new Map(deferEntries.map((f) => [`${f.model}.${f.field}`, f.description]))
    expect(byKey.get('AuditLog.details')).toContain('hash veriga')
    expect(byKey.get('WebhookDelivery.payload')).toContain('HMAC')
    expect(byKey.get('RestaurantSettings.apiKeys')).toContain('deprecatiran keystore')
    expect(byKey.get('OrderItem.modifiersJson')).toContain('dual-write')
    expect(byKey.get('MenuItem.allergens')).toContain('CSV')
    expect(byKey.get('Modifier.allergens')).toContain('CSV')
  })
})

describe('JSON FIELDS schema-paritetni drift-gate (R197, #33) — inventar ≡ 0022 migracija', () => {
  it('0022_json_fields ima natanko 25 TYPE JSONB stavkov (1:1 z migriranim inventarjem)', () => {
    expect(jsonbColumns.size).toBe(25)
    expect(jsonbColumns.size).toBe(migratedEntries.length)
  })

  it('vsako migrirano polje ima svoj TYPE JSONB stavek v 0022 migraciji', () => {
    const missing = migratedEntries
      .map((f) => `${f.model}.${f.field}`)
      .filter((k) => !jsonbColumns.has(k))
    expect(missing, 'migrirana polja brez TYPE JSONB stavka').toEqual([])
  })

  it('0022 migracija ne vsebuje TYPE JSONB stavkov za ostanke (String byte-exact)', () => {
    const leaked = deferEntries
      .map((f) => `${f.model}.${f.field}`)
      .filter((k) => jsonbColumns.has(k))
    expect(leaked, 'ostanki, ki jih migracija vseeno spreminja').toEqual([])
  })
})

describe('JSON FIELDS schema-paritetni drift-gate (R197, #33) — wire mapper konsistenca', () => {
  it('vsako migrirano (JSONB) polje je pokrito v JSON_WIRE_FIELDS (wire ostane JSON string)', () => {
    const uncovered = migratedEntries
      .map((f) => f.field)
      .filter((name) => !JSON_WIRE_FIELDS.has(name))
    expect(uncovered, 'JSONB stolpci brez wire preslikave').toEqual([])
  })

  it('vsak JSON_WIRE_FIELDS vnos korespondira vsaj enemu inventarnemu polju (brez mrtvih imen)', () => {
    const inventoryNames = new Set(JSON_FIELDS.map((f) => f.field))
    const dead = [...JSON_WIRE_FIELDS].filter((name) => !inventoryNames.has(name))
    expect(dead, 'wire imena brez inventarne postavke').toEqual([])
  })

  it('pravi String ostanki NISO v JSON_WIRE_FIELDS (se ne re-serializirajo)', () => {
    // allergens je namenoma v wire setu (Guest.allergens je JSONB) — mapper je
    // field-name based in String vrednosti (CSV) pušča nedotaknjene.
    const stringOnly = ['modifiersJson', 'details', 'payload', 'apiKeys']
    const leaked = stringOnly.filter((name) => JSON_WIRE_FIELDS.has(name))
    expect(leaked, 'String polja v wire setu').toEqual([])
  })
})
