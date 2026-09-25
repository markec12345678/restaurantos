// ============================================
// R127 / EPIC #115 P0-6 — BACKUP / RESTORE LIB JEDRO
// ============================================
// Pokritje:
//  • getBackupManifest: topološki red (Location < Menu < Category < MenuItem,
//    Order < Check < Payment), izključitev Session iz backupa + VKLJUČITEV v
//    TRUNCATE, ciklične grupe (RecipeItem, ChartOfAccount), chunk proračun
//  • canonicalStringify/computeChecksum: determinizem neodvisen od vrstnega
//    reda ključev, Decimal → string (EXACT round-trip), Date → ISO,
//    BigInt/bytes → tag + decodeRowValues inverz
//  • sortAuditLogRows: rekonstrukcija hash verige (genesis → A → B → C) iz
//    premešanih vrstic + orphan odpornost (warning, brez metanja)
//  • createBackup: findMany per model (orderBy id), AuditLog chain-sort,
//    manifest mode (counts-only, checksum ''), neznane tabele → MANIFEST
//  • applyRestore validacija (brez DB): FORMAT / VERSION / MANIFEST / CHECKSUM
//    / strict schemaStamp / verifyOnly (DB ni dotaknjen) / manifest-mode
//  • applyRestore polna pot (trap DB): EN TRUNCATE stavek (vse tabele vključno
//    s Session + CASCADE), insert v topološkem redu, chunking po manifestu,
//    dvopostopni cikel (RecipeItem: pass 1 null FK → pass 2 update), verify
//    count() vs counts, tiha izguba vrstic → BackupError DB, count mismatch →
//    matched:false + warning (brez metanja)
//  • detectBackupEngine + writeBackupHeartbeat (status oblika + odpornost)
//
// Trap DB (hišni stil R124/R121/R125/R126): Proxy klient, ki generično
// posreduje delegat (menu, menuItem, auditLog, …) nad skupnim stanjem;
// mockana meja je SAMO '@/lib/db'. Manifest/serijalizacija tečejo REALNO
// (generiran Prisma klient + DMMF).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { mkdtempSync, readFileSync, existsSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// ---------- Trap DB ----------

interface TrapRow extends Record<string, unknown> {
  id: string
}

interface TrapState {
  /** delegat ime → vrstice (insert red) */
  rows: Map<string, TrapRow[]>
  /** vrstni red createMany klicev (delegat ime, per klic št. vrstic) */
  insertOrder: Array<{ delegate: string; rows: number }>
  /** zajeti $executeRaw — tolerna ekstrakcija besedila (string | Sql objekt) */
  raw: string[]
  /** tx $transaction opcije (timeout/maxWait) */
  txOpts: Array<{ timeout?: number; maxWait?: number } | undefined>
  /** update klici (pass 2 cikli) */
  updates: Array<{ delegate: string; id: unknown; data: Record<string, unknown> }>
  /** findMany klici (delegat ime) */
  findManyCalls: string[]
  /** count() override (za mismatch test) */
  countOverride: Map<string, number>
  /** createMany simulira tiho izgubo (vrne count 0) */
  lossy: boolean
}

function rawText(q: unknown): string {
  if (typeof q === 'string') return q
  if (q && typeof q === 'object') {
    const rec = q as Record<string, unknown>
    return String(rec['sql'] ?? rec['text'] ?? JSON.stringify(rec))
  }
  return String(q)
}

function makeDelegate(name: string, state: TrapState, isTx: boolean) {
  const bucket = () => {
    if (!state.rows.has(name)) state.rows.set(name, [])
    return state.rows.get(name) as TrapRow[]
  }
  return {
    findMany(_args?: unknown) {
      if (isTx) return Promise.resolve([...bucket()])
      state.findManyCalls.push(name)
      return Promise.resolve([...bucket()])
    },
    count() {
      const override = state.countOverride.get(name)
      if (override !== undefined) return Promise.resolve(override)
      return Promise.resolve(bucket().length)
    },
    createMany(args: { data: TrapRow[] }) {
      if (isTx) {
        // samo tx pot zapisuje (createBackup bere, restore piše)
        bucket().push(...args.data)
        state.insertOrder.push({ delegate: name, rows: args.data.length })
        return Promise.resolve({ count: state.lossy ? 0 : args.data.length })
      }
      return Promise.resolve({ count: args.data.length })
    },
    update(args: { where: { id: string }; data: Record<string, unknown> }) {
      const row = bucket().find(r => r.id === args.where.id)
      if (row) Object.assign(row, args.data)
      state.updates.push({ delegate: name, id: args.where.id, data: args.data })
      return Promise.resolve(row)
    },
  }
}

function makeClient(state: TrapState, isTx: boolean): unknown {
  const txClient = new Proxy(
    {},
    {
      get(_t, prop) {
        if (typeof prop !== 'string') return undefined
        if (prop === '$executeRaw') {
          return (q: unknown) => {
            state.raw.push(rawText(q))
            return Promise.resolve(0)
          }
        }
        if (prop === '$executeRawUnsafe') {
          return (q: string) => {
            state.raw.push(q)
            return Promise.resolve(0)
          }
        }
        // delegati so camelCase (menuItem, auditLog, …); $-metode niso delegati
        if (prop.startsWith('$')) return undefined
        return makeDelegate(prop, state, isTx)
      },
    },
  )
  if (isTx) return txClient
  // db klient: $transaction poda tx klienta (opcije se zabeležijo)
  return new Proxy(
    {},
    {
      get(_t, prop) {
        if (typeof prop !== 'string') return undefined
        if (prop === '$transaction') {
          return (cb: (tx: unknown) => Promise<unknown>, opts?: Record<string, number>) => {
            state.txOpts.push(opts)
            return cb(makeClient(state, true))
          }
        }
        return (txClient as Record<string, unknown>)[prop]
      },
    },
  )
}

function createState(): TrapState {
  return {
    rows: new Map(),
    insertOrder: [],
    raw: [],
    txOpts: [],
    updates: [],
    findManyCalls: [],
    countOverride: new Map(),
    lossy: false,
  }
}

const ref = vi.hoisted(() => ({ current: null as unknown as ReturnType<typeof createState> }))
ref.current = createState()
vi.mock('@/lib/db', () => ({
  get db() {
    return makeClient(ref.current, false)
  },
  createAuditLog: vi.fn(async () => undefined),
}))

// ---------- Importi production kode (po vi.mock hoistingu) ----------
import {
  getBackupManifest,
  delegateFor,
  canonicalStringify,
  computeChecksum,
  sortAuditLogRows,
  decodeRowValues,
  encodeRowValues,
  createBackup,
  applyRestore,
  detectBackupEngine,
  writeBackupHeartbeat,
  BackupError,
  type BackupFile,
} from '@/lib/backup'

const manifest = getBackupManifest()

// ---------- Pomagalke ----------

/** Minimalna veljavna vrstica modela: id + vse obvezne skalarne brez defaulta. */
function minimalRow(model: string, id: string): TrapRow {
  const models = (
    Prisma as unknown as {
      dmmf: { datamodel: { models: Array<{ name: string; fields: Array<Record<string, unknown>> }> } }
    }
  ).dmmf.datamodel.models
  const dmmfModel = models.find(m => m.name === model)
  if (!dmmfModel) throw new Error(`model ${model} ni v DMMF`)
  const row: TrapRow = { id }
  for (const f of dmmfModel.fields) {
    if (f.kind !== 'scalar') continue
    if (!(f.isRequired === true) || f.hasDefaultValue || f.isUpdatedAt) continue
    const fname = String(f.name)
    switch (f.type) {
      case 'String': row[fname] = `${id}-${fname}`; break
      case 'Int':
      case 'Float': row[fname] = 1; break
      case 'Decimal': row[fname] = '1.00'; break
      case 'Boolean': row[fname] = true; break
      case 'DateTime': row[fname] = new Date('2026-09-25T10:00:00.000Z'); break
      case 'Json': row[fname] = {}; break
      default: row[fname] = `${id}-${fname}`
    }
  }
  return row
}

/** Sestavi veljaven BackupFile nad podanimi tabelami (trap vrstice). */
function buildBackup(tables: Record<string, TrapRow[]>): BackupFile {
  const counts: Record<string, number> = {}
  for (const [m, rows] of Object.entries(tables)) counts[m] = rows.length
  return {
    format: 'restaurantos-backup',
    version: 1,
    schemaStamp: computeChecksum(manifest.models.join(',')),
    createdAt: new Date().toISOString(),
    engine: 'pglite',
    counts,
    tables: tables as unknown as BackupFile['tables'],
    checksum: computeChecksum(tables),
    countsChecksum: computeChecksum(counts),
  }
}

const idx = (m: string) => manifest.models.indexOf(m)

// ---------- 1) MANIFEST ----------

describe('getBackupManifest (realna shema — DMMF)', () => {
  it('pokrije celoten DMMF, Session izključi iz backupa, vključi v TRUNCATE', () => {
    const dmmfCount = (
      Prisma as unknown as { dmmf: { datamodel: { models: unknown[] } } }
    ).dmmf.datamodel.models.length
    expect(manifest.models.length).toBeGreaterThan(90)
    expect(manifest.tableNames['Order']).toBe('Order')
    expect(manifest.excluded).toEqual(['Session'])
    expect(manifest.models).not.toContain('Session')
    expect(manifest.truncateModels).toContain('Session')
    expect(manifest.truncateModels.length).toBe(dmmfCount)
  })

  it('topološki red: Location < Menu < Category < MenuItem in Order < Check < Payment', () => {
    expect(idx('Location')).toBeLessThan(idx('Menu'))
    expect(idx('Menu')).toBeLessThan(idx('Category'))
    expect(idx('Category')).toBeLessThan(idx('MenuItem'))
    expect(idx('Order')).toBeLessThan(idx('Check'))
    expect(idx('Check')).toBeLessThan(idx('Payment'))
  })

  it('ciklične grupe: RecipeItem in ChartOfAccount sta samoreferenci (nullable)', () => {
    const flattened = manifest.cycles.flat()
    expect(flattened).toContain('RecipeItem')
    expect(flattened).toContain('ChartOfAccount')
  })

  it('chunk velikosti: vsaka med 1 in 500; MenuItem po proračunu 9000/16', () => {
    for (const size of Object.values(manifest.chunkSizes)) {
      expect(size).toBeGreaterThanOrEqual(1)
      expect(size).toBeLessThanOrEqual(500)
    }
    expect(manifest.chunkSizes['MenuItem']).toBe(Math.min(500, Math.floor(9000 / 16)))
  })

  it('delegateFor: prva črka malo (MenuItem → menuItem)', () => {
    expect(delegateFor('MenuItem')).toBe('menuItem')
    expect(delegateFor('Order')).toBe('order')
  })
})

// ---------- 2) SERIALIZACIJA ----------

describe('canonicalStringify / computeChecksum / decodeRowValues', () => {
  it('determinističen neodvisno od vrstnega reda ključev', () => {
    const a = canonicalStringify({ b: 1, a: { d: 2, c: [3, 1] } })
    const b = canonicalStringify({ a: { c: [3, 1], d: 2 }, b: 1 })
    expect(a).toBe(b)
  })

  it('Decimal → string (natančen round-trip, brez toNumber prikradanja)', () => {
    const dec = new Prisma.Decimal('12.30')
    // decimal.js toString() normalizira sledilne ničle ('12.30' → '12.3') —
    // vrednost ostane enaka: Postgres ob insertu v DECIMAL(12,2) vrne nazaj 12.30
    expect(canonicalStringify({ price: dec })).toBe('{"price":"12.3"}')
  })

  it('Date → ISO string', () => {
    expect(canonicalStringify({ t: new Date('2026-09-25T10:00:00.000Z') })).toBe(
      '{"t":"2026-09-25T10:00:00.000Z"}',
    )
  })

  it('BigInt tag: encode → decode round-trip', () => {
    const encoded = encodeRowValues({ n: BigInt('9007199254740993') })
    const decoded = decodeRowValues(encoded)
    expect((decoded['n'] as bigint).toString()).toBe('9007199254740993')
  })

  it('bytes tag: Uint8Array → base64 → Buffer round-trip', () => {
    const encoded = encodeRowValues({ b: new Uint8Array([1, 2, 254, 255]) })
    const decoded = decodeRowValues(encoded)
    expect(Buffer.from(decoded['b'] as Uint8Array)).toEqual(Buffer.from([1, 2, 254, 255]))
  })

  it('checksum stabilen čez JSON round-trip (disk → parse → isti checksum)', () => {
    const tables = { Menu: [minimalRow('Menu', 'm1')], Category: [minimalRow('Category', 'c1')] }
    const direct = computeChecksum(tables)
    const roundTrip = JSON.parse(JSON.stringify(tables))
    expect(computeChecksum(roundTrip)).toBe(direct)
  })
})

// ---------- 3) AUDIT VERIGA ----------

describe('sortAuditLogRows — rekonstrukcija hash verige', () => {
  const genesis = { id: 'a1', previousHash: '', chainHash: 'h1', action: 'X' }
  const second = { id: 'a2', previousHash: 'h1', chainHash: 'h2', action: 'X' }
  const third = { id: 'a3', previousHash: 'h2', chainHash: 'h3', action: 'X' }

  it('premešane vrstice → pravi vrstni red verige', () => {
    const res = sortAuditLogRows([third, genesis, second])
    expect(res.rows.map(r => r['id'])).toEqual(['a1', 'a2', 'a3'])
    expect(res.warnings).toEqual([])
  })

  it('orphan (prekinjena veriga) gre na konec + warning, brez metanja', () => {
    const orphan = { id: 'a9', previousHash: 'missing', chainHash: 'hx', action: 'X' }
    const res = sortAuditLogRows([orphan, third, genesis, second])
    expect(res.rows.map(r => r['id'])).toEqual(['a1', 'a2', 'a3', 'a9'])
    expect(res.warnings.length).toBe(1)
  })
})

// ---------- 4) createBackup (trap db) ----------

describe('createBackup (trap db)', () => {
  beforeEach(() => {
    ref.current = createState()
  })

  it('poln backup: findMany per model, counts, checksum nad tables', async () => {
    const state = ref.current
    state.rows.set('menu', [minimalRow('Menu', 'm1'), minimalRow('Menu', 'm2')])
    state.rows.set('category', [minimalRow('Category', 'c1')])

    const backup = await createBackup()
    expect(state.findManyCalls).toContain('menu')
    expect(backup.format).toBe('restaurantos-backup')
    expect(backup.version).toBe(1)
    expect(backup.counts['Menu']).toBe(2)
    expect(backup.counts['Category']).toBe(1)
    expect(backup.tables['Menu']).toHaveLength(2)
    expect(backup.checksum).not.toBe('')
    expect(backup.countsChecksum).toBe(computeChecksum(backup.counts))
    expect(backup.engine).toBe(detectBackupEngine())
  })

  it('AuditLog: premešana veriga v trapu → backup vrstice v vrstnem redu verige', async () => {
    const state = ref.current
    const mk = (id: string, prev: string, chain: string, ts: string) => ({
      id, previousHash: prev, chainHash: chain, action: id, entityType: 'Auth',
      details: '{}', ipAddress: '', timestamp: new Date(ts),
    })
    state.rows.set('auditLog', [
      mk('a3', 'h2', 'h3', '2026-09-25T10:02:00Z'),
      mk('a1', '', 'h1', '2026-09-25T10:00:00Z'),
      mk('a2', 'h1', 'h2', '2026-09-25T10:01:00Z'),
    ] as TrapRow[])

    const backup = await createBackup({ tables: ['AuditLog'] })
    expect(backup.tables['AuditLog'].map(r => r['id'])).toEqual(['a1', 'a2', 'a3'])
  })

  it('tabel filter: zahtevane v topološkem redu; neznana/prazna → MANIFEST', async () => {
    const state = ref.current
    state.rows.set('menu', [minimalRow('Menu', 'm1')])
    await createBackup({ tables: ['MenuItem', 'Menu'] })
    expect(state.findManyCalls.filter(c => c === 'menu').length).toBe(1)
    expect(state.findManyCalls.filter(c => c === 'menuItem').length).toBe(1)
    expect(state.findManyCalls.indexOf('menu')).toBeLessThan(state.findManyCalls.indexOf('menuItem'))

    await expect(createBackup({ tables: ['HackerTable'] })).rejects.toBeInstanceOf(BackupError)
    await expect(createBackup({ tables: [] })).rejects.toBeInstanceOf(BackupError)
  })

  it('manifest mode: counts-only, tables {}, checksum prazen, brez findMany', async () => {
    const state = ref.current
    state.rows.set('menu', [minimalRow('Menu', 'm1')])
    state.rows.set('category', [minimalRow('Category', 'c1'), minimalRow('Category', 'c2')])
    const backup = await createBackup({ includeRowData: false })
    expect(backup.tables).toEqual({})
    expect(backup.checksum).toBe('')
    expect(backup.counts['Menu']).toBe(1)
    expect(backup.counts['Category']).toBe(2)
    expect(state.findManyCalls).toHaveLength(0)
  })

  it('encodeRowValues: Date v trapu → ISO string v backupu (JSON-varno)', async () => {
    const state = ref.current
    const row0 = minimalRow('Menu', 'm1')
    row0['createdAt'] = new Date('2026-09-25T10:00:00.000Z')
    state.rows.set('menu', [row0])
    const backup = await createBackup({ tables: ['Menu'] })
    const row = backup.tables['Menu'][0] as Record<string, unknown>
    expect(row['createdAt']).toBe('2026-09-25T10:00:00.000Z')
  })
})

// ---------- 5) applyRestore — VALIDACIJA (brez DB) ----------

describe('applyRestore — validacija (DB ni dosežen)', () => {
  beforeEach(() => {
    ref.current = createState()
  })

  it('FORMAT: napačen format', async () => {
    await expect(applyRestore({ format: 'other', version: 1 })).rejects.toMatchObject({
      code: 'FORMAT',
      status: 400,
    })
  })

  it('VERSION: verzija 2 → VERSION 400', async () => {
    await expect(
      applyRestore({ format: 'restaurantos-backup', version: 2, counts: {}, tables: {} }),
    ).rejects.toMatchObject({ code: 'VERSION', status: 400 })
  })

  it('MANIFEST: neznana tabela → MANIFEST 400', async () => {
    await expect(
      applyRestore({
        format: 'restaurantos-backup',
        version: 1,
        counts: { Hacker: 1 },
        tables: { Hacker: [{ id: 'x' }] },
      }),
    ).rejects.toMatchObject({ code: 'MANIFEST', status: 400 })
  })

  it('CHECKSUM: pokvarjena vsebina → CHECKSUM 422', async () => {
    const tables = { Menu: [minimalRow('Menu', 'm1')] }
    const file = buildBackup(tables)
    const tampered = JSON.parse(JSON.stringify(file)) as BackupFile
    ;(tampered.tables['Menu'][0] as Record<string, unknown>)['name'] = 'TAMPERED'
    await expect(applyRestore(tampered)).rejects.toMatchObject({ code: 'CHECKSUM', status: 422 })
  })

  it('strict: schemaStamp drift → MANIFEST; sicer warning', async () => {
    const file = buildBackup({ Menu: [minimalRow('Menu', 'm1')] })
    file.schemaStamp = 'drifted-stamp'
    await expect(applyRestore(file, { verifyOnly: true, strict: true })).rejects.toMatchObject({
      code: 'MANIFEST',
    })
    const ok = await applyRestore(file, { verifyOnly: true })
    expect(ok.warnings.some(w => w.includes('Schema drift'))).toBe(true)
  })

  it('verifyOnly: struktura + counts, DB NI dotaknjen', async () => {
    const state = ref.current
    const tables = { Menu: [minimalRow('Menu', 'm1')], Category: [minimalRow('Category', 'c1')] }
    const res = await applyRestore(buildBackup(tables), { verifyOnly: true })
    expect(res.verifyOnly).toBe(true)
    expect(res.tables['Menu']).toMatchObject({ expected: 1, restored: 0, matched: false })
    expect(res.totalExpected).toBe(2)
    expect(state.raw).toHaveLength(0)
    expect(state.insertOrder).toHaveLength(0)
  })

  it('manifest-mode dumpa ni mogoče obnoviti (tables prazne) → FORMAT', async () => {
    await expect(
      applyRestore({
        format: 'restaurantos-backup',
        version: 1,
        schemaStamp: computeChecksum(manifest.models.join(',')),
        counts: { Menu: 0 },
        tables: {},
        checksum: '',
        countsChecksum: computeChecksum({ Menu: 0 }),
      }),
    ).rejects.toMatchObject({ code: 'FORMAT' })
  })
})

// ---------- 6) applyRestore — POLNA POT (trap tx) ----------

describe('applyRestore — polna pot (trap tx)', () => {
  beforeEach(() => {
    ref.current = createState()
  })

  it('happy path: advisory lock + EN TRUNCATE (vse tabele + Session + CASCADE) + insert topološko + verify matched', async () => {
    const state = ref.current
    const tables = {
      Menu: [minimalRow('Menu', 'm1')],
      Category: [minimalRow('Category', 'c1')],
      MenuItem: [minimalRow('MenuItem', 'i1')],
    }
    const res = await applyRestore(buildBackup(tables))

    expect(state.txOpts[0]).toMatchObject({ timeout: 120_000, maxWait: 15_000 })
    expect(state.raw.length).toBe(2) // advisory lock + TRUNCATE
    expect(state.raw[0]).toContain('pg_advisory_xact_lock')
    const truncate = state.raw[1]
    expect(truncate).toContain('CASCADE')
    expect(truncate).toContain('"Session"')
    expect(truncate).toContain('"Menu"')
    expect(truncate).toContain('"MenuItem"')

    expect(state.insertOrder.map(c => c.delegate)).toEqual(['menu', 'category', 'menuItem'])
    expect(res.verifyOnly).toBe(false)
    expect(res.matched).toBe(true)
    expect(res.tables['MenuItem']).toMatchObject({ expected: 1, restored: 1, matched: true })
  })

  it('chunking: 700 vrstic Menu → ⌈700 / chunkSize⌉ createMany klicev', async () => {
    const state = ref.current
    const rows: TrapRow[] = []
    for (let i = 0; i < 700; i++) rows.push(minimalRow('Menu', `m${i}`))
    const res = await applyRestore(buildBackup({ Menu: rows }))
    const chunkSize = manifest.chunkSizes['Menu']
    const expectedChunks = Math.ceil(700 / chunkSize)
    expect(state.insertOrder.filter(c => c.delegate === 'menu')).toHaveLength(expectedChunks)
    expect(res.tables['Menu']).toMatchObject({ expected: 700, restored: 700, matched: true })
  })

  it('dvopostopni cikel: RecipeItem pass 1 null FK → pass 2 update', async () => {
    const state = ref.current
    const r1 = minimalRow('RecipeItem', 'r1') // brez parenta
    const r2 = minimalRow('RecipeItem', 'r2')
    r2['parentRecipeItemId'] = 'r1'
    await applyRestore(buildBackup({ RecipeItem: [r1, r2] }))

    const createCalls = state.insertOrder.filter(c => c.delegate === 'recipeItem')
    expect(createCalls).toHaveLength(1) // obe vrstici skupaj v pass 1
    expect(createCalls[0].rows).toBe(2)
    expect(state.updates).toHaveLength(1)
    expect(state.updates[0]).toMatchObject({
      delegate: 'recipeItem',
      id: 'r2',
      data: { parentRecipeItemId: 'r1' },
    })
  })

  it('tiha izguba vrstic (createMany count < rows) → BackupError DB (tx rollback)', async () => {
    const state = ref.current
    state.lossy = true
    await expect(
      applyRestore(buildBackup({ Menu: [minimalRow('Menu', 'm1')] })),
    ).rejects.toMatchObject({ code: 'DB', status: 500 })
  })

  it('count mismatch po obnovitvi → matched:false + warning (NE meta)', async () => {
    const state = ref.current
    state.countOverride.set('menu', 99)
    const res = await applyRestore(buildBackup({ Menu: [minimalRow('Menu', 'm1')] }))
    expect(res.matched).toBe(false)
    expect(res.tables['Menu']).toMatchObject({ expected: 1, restored: 99, matched: false })
    expect(res.warnings.some(w => w.includes('Menu'))).toBe(true)
  })

  it('manjkajoče obvezno polje → FORMAT (pred transakcijo, DB ni dotaknjen)', async () => {
    const state = ref.current
    const bad = { id: 'x' } // Menu brez name + locationId
    await expect(applyRestore(buildBackup({ Menu: [bad as TrapRow] }))).rejects.toMatchObject({
      code: 'FORMAT',
    })
    expect(state.raw).toHaveLength(0)
    expect(state.insertOrder).toHaveLength(0)
  })

  it('Session ni obnovljiv (izključen iz manifesta) → MANIFEST', async () => {
    await expect(
      applyRestore(
        buildBackup({
          Session: [{ id: 's1', token: 't', expiresAt: new Date() } as unknown as TrapRow],
        }),
      ),
    ).rejects.toMatchObject({ code: 'MANIFEST' })
  })
})

// ---------- 7) ENGINE + HEARTBEAT ----------

describe('detectBackupEngine', () => {
  const OLD = process.env['DATABASE_URL']
  afterEach(() => {
    if (OLD === undefined) delete process.env['DATABASE_URL']
    else process.env['DATABASE_URL'] = OLD
  })

  it('postgres URL → postgresql; prazen → pglite', () => {
    process.env['DATABASE_URL'] = 'postgresql://u:p@host/db'
    expect(detectBackupEngine()).toBe('postgresql')
    process.env['DATABASE_URL'] = 'postgres://u:p@host/db'
    expect(detectBackupEngine()).toBe('postgresql')
    delete process.env['DATABASE_URL']
    delete process.env['POSTGRES_URL']
    expect(detectBackupEngine()).toBe('pglite')
  })
})

describe('writeBackupHeartbeat', () => {
  const OLD_PATH = process.env['BACKUP_STATUS_FILE']
  let dir = ''

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rs-heartbeat-'))
  })
  afterEach(() => {
    if (OLD_PATH === undefined) delete process.env['BACKUP_STATUS_FILE']
    else process.env['BACKUP_STATUS_FILE'] = OLD_PATH
    rmSync(dir, { recursive: true, force: true })
  })

  it('zapiše status obliko (lastSuccess/sizeBytes/note/host/updatedBy api/backup)', async () => {
    const path = join(dir, 'nested', 'status.json')
    process.env['BACKUP_STATUS_FILE'] = path
    const ok = await writeBackupHeartbeat({ sizeBytes: 1234, note: 'test', host: 'localhost' })
    expect(ok).toBe(true)
    expect(existsSync(path)).toBe(true)
    const status = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
    expect(status['updatedBy']).toBe('api/backup')
    expect(status['sizeBytes']).toBe(1234)
    expect(status['note']).toBe('test')
    expect(typeof status['lastSuccess']).toBe('string')
  })

  it('nezapisljiva pot (starš je datoteka) → false (backup NE pade)', async () => {
    const blocker = join(dir, 'blocker')
    writeFileSync(blocker, 'x') // starš je DATOTEKA → mkdir status.json pod njo neuspešen
    process.env['BACKUP_STATUS_FILE'] = join(blocker, 'status.json')
    const ok = await writeBackupHeartbeat({ note: 'x' })
    expect(ok).toBe(false)
  })
})
