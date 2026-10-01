// ============================================
// R195 — NEON locationId DRIFT-MOST: TRAJNA REŠITEV (integration test)
//
// Dokumenta REALNO bazo skozi celoten življenjski cikel drift-mostu:
//   1. DRIFT simulacija: DROP COLUMN locationId na vseh 11 konfiguracijskih
//      tabelah ≡ Neon produkcija (runda 39 stanje) — realna "column does not
//      exist" napaka na raw INSERT, isMissingLocationColumnError detektor se
//      sproži na REALNI napaki (P2010 duck-typing — driver adapter ne prevaja
//      PG napak v P-code; glej prisma-column-fallback.ts R195 fix), most
//      (withLocationColumnFallback) izvede run(false) → vrstica ostane brez
//      lokacije. DRIFT faza uporablja IZKLJUČNO raw SQL (model-API create bi
//      pripravil INSERT-plan brez locationId, ki bi po ADD COLUMN sprožil
//      0A000 "cached plan must not change result type").
//   2. MIGRACIJA: aplicira scripts/r195-neon-locationid-migration.sql
//      (EN vir resnice — ista datoteka, ki jo na Neonu izvaja
//      scripts/r195-apply-locationid-migration.mjs) stavek-po-stavek.
//   3. POST-VERIFY: stolpec TEXT NOT NULL + FK + @@index([locationId])
//      pariteta na vseh 11 tabelah; backfill "globalnih" vrstic na
//      eno lokacijo; Prisma model create z locationId deluje BREZ padov
//      (prvi model query šele PO DDL — svež prepare); FK enforcement
//      (23503); idempotenca (drugi tek brez napak).
//
// Lekcija R78/R127: datoteka teče ZAPOREDNO (fileParallelism: false) —
// DDL nad 11 tabelami je varen, afterAll garantira zdravo končno stanje
// (best-effort re-apply) za kasnejše datoteke.
// ============================================

import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Prisma } from '@prisma/client'

// KLJUČNO: tests/setup.ts globalno mock-ira @/lib/db — ta datoteka potrebuje
// PRAVEGA klienta (PGlite): DDL + realne P2022/23503 napake (vzorec db-invariants).
vi.unmock('@/lib/db')

import { db } from '@/lib/db'
import {
  isMissingLocationColumnError,
  withLocationColumnFallback,
} from '@/lib/prisma-column-fallback'

// 11 konfiguracijskih tabel ≡ prisma-column-fallback.ts (empirično runda 39)
const TABLES = [
  'DiningOption', 'RevenueCenter', 'SalesCategory', 'PriceGroup', 'ServiceCharge',
  'PrepStation', 'VoidReason', 'NoSaleReason', 'AlternatePaymentType', 'Printer', 'Discount',
] as const

/** Naloži stavke iz enega vira resnice (isti format kot apply skripta). */
function loadMigrationStatements(): string[] {
  const sql = readFileSync(
    path.join(process.cwd(), 'scripts', 'r195-neon-locationid-migration.sql'),
    'utf-8',
  )
  return sql
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('--'))
    .map((l) => (l.endsWith(';') ? l.slice(0, -1) : l))
}

async function applyMigration(): Promise<void> {
  const statements = loadMigrationStatements()
  expect(statements.length).toBe(66) // 11 tabel × 6 stavkov (ADD COLUMN/UPDATE backfill/SET NOT NULL/DROP FK/ADD FK/CREATE INDEX)
  for (const stmt of statements) {
    await db.$executeRawUnsafe(stmt)
  }
}

async function columnMeta(table: string): Promise<{ dataType: string; nullable: string } | null> {
  const rows = (await db.$queryRawUnsafe<Array<{ data_type: string; is_nullable: string }>>(
    `SELECT data_type, is_nullable FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1 AND column_name='locationId'`,
    table,
  )) as Array<{ data_type: string; is_nullable: string }>
  if (rows.length !== 1) return null
  return { dataType: rows[0].data_type, nullable: rows[0].is_nullable }
}

describe('R195: Neon locationId drift-most — trajna rešitev (migration package)', () => {
  const RUN_ID = `r195-${Date.now()}`

  beforeAll(async () => {
    // Backfill guard realnosti: na Neonu apply skripta zahteva TOČNO ENO lokacijo.
    // Sveža IT DB je prazna — brez lokacije bi backfill subquery vrnil NULL →
    // 23502 (identično varovalki v r195-apply-locationid-migration.mjs).
    const n = await db.location.count()
    if (n === 0) {
      await db.location.create({
        data: { name: 'R195 Test Lokacija', code: `R195-${Date.now()}` },
      })
    }
  })

  afterAll(async () => {
    // Varnostna mreža za kasnejše IT datoteke: garantiraj zdravo stanje
    // (paket je idempotenten — best-effort re-apply).
    try {
      await applyMigration()
    } finally {
      await db.$disconnect()
    }
  })

  it('predpogoj: vseh 11 tabel IMA locationId (sveža IT DB iz Prisma sheme)', async () => {
    for (const t of TABLES) {
      const meta = await columnMeta(t)
      expect(meta, `${t} naj bi imel locationId iz sheme`).not.toBeNull()
      expect(meta!.dataType).toBe('text')
      expect(meta!.nullable).toBe('NO')
    }
  })

  it('DRIFT simulacija: DROP COLUMN na vseh 11 tabelah ≡ Neon produkcija', async () => {
    for (const t of TABLES) {
      await db.$executeRawUnsafe(`ALTER TABLE "${t}" DROP COLUMN IF EXISTS "locationId"`)
    }
    for (const t of TABLES) {
      expect(await columnMeta(t), `${t} naj bi sedaj BREZ stolpca`).toBeNull()
    }
  })

  it('drift-era vrstica: raw INSERT brez locationId uspe (Neon realnost)', async () => {
    // updatedAt je NOT NULL brez DB defaulta (@updatedAt je client-side) —
    // raw INSERT ga mora podati. isActive/sortOrder/createdAt imajo defaulte.
    await db.$executeRawUnsafe(
      `INSERT INTO "VoidReason" ("id", "name", "updatedAt") VALUES ($1, $2, NOW())`,
      `${RUN_ID}-vr-drift`,
      'R195 drift vrstica (globalna)',
    )
  })

  it('drift napaka: raw INSERT z locationId pade, detektor prepozna REALNO napako (P2010 duck-typing)', async () => {
    let caught: unknown = null
    try {
      await db.$executeRawUnsafe(
        `INSERT INTO "VoidReason" ("id", "name", "locationId", "updatedAt") VALUES ($1, $2, $3, NOW())`,
        `${RUN_ID}-p2022`,
        'P2022 test',
        'r195-ne-obstojeca-lokacija',
      )
    } catch (e) {
      caught = e
    }
    expect(caught).not.toBeNull()
    // Driver-adapter (PGlite) NE prevaja PG napak v P-code — prihaja kot P2010
    // ("Raw query failed. Code: `42703`...") z originalnim sporočilom. Realni
    // engine (Neon) vrača P2022/P1054 — detektor prepozna VSE tri kode pod
    // istim sporočilnim regexom (duck-typing, glej prisma-column-fallback.ts).
    expect(isMissingLocationColumnError(caught)).toBe(true)
  })

  it('most v driftu: withLocationColumnFallback izvede run(false) → vrstica ostane brez lokacije', async () => {
    // R195 lekcija: v drift fazi uporabimo RAW SQL run funkcije (ne model API) —
    // uspešno pripravljen INSERT-plan brez locationId bi po ADD COLUMN sprožil
    // 0A000 "cached plan must not change result type". Most je DB-agnostičen —
    // logika run(true)/run(false) se testira na REALNI drift napaki.
    const bridgeId = `${RUN_ID}-bridge`
    await withLocationColumnFallback('r195-it:bridge', async (withLoc) => {
      if (withLoc) {
        // pade z missing-column napako (detektor jo ujame → retry)
        await db.$executeRawUnsafe(
          `INSERT INTO "VoidReason" ("id", "name", "locationId", "updatedAt") VALUES ($1, $2, $3, NOW())`,
          bridgeId,
          'R195 bridge vrstica',
          'r195-ne-obstojeca-lokacija',
        )
      }
      await db.$executeRawUnsafe(
        `INSERT INTO "VoidReason" ("id", "name", "updatedAt") VALUES ($1, $2, NOW())`,
        bridgeId,
        'R195 bridge vrstica',
      )
      return bridgeId
    })

    // Vrstica obstaja (brez reference na locationId — ta stolpec v driftu NE obstaja)
    const rows = (await db.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM "VoidReason" WHERE "id" = $1`,
      bridgeId,
    )) as Array<{ id: string }>
    expect(rows).toHaveLength(1)
  })

  it('MIGRACIJA: aplikira scripts/r195-neon-locationid-migration.sql (en vir resnice)', async () => {
    await applyMigration()
  })

  it('post-verify: vseh 11 tabel — locationId TEXT NOT NULL + FK + indeks (shemska pariteta)', async () => {
    for (const t of TABLES) {
      const meta = await columnMeta(t)
      expect(meta, `${t}: stolpec naj bi obstajal`).not.toBeNull()
      expect(meta!.dataType).toBe('text')
      expect(meta!.nullable).toBe('NO')

      const fk = (await db.$queryRawUnsafe<Array<unknown>>(
        `SELECT 1 FROM information_schema.table_constraints
         WHERE table_schema='public' AND table_name=$1
         AND constraint_name='${t}_locationId_fkey' AND constraint_type='FOREIGN KEY'`,
        t,
      )) as Array<unknown>
      expect(fk, `${t}: FK naj bi obstajal`).toHaveLength(1)

      const idx = (await db.$queryRawUnsafe<Array<unknown>>(
        `SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename=$1 AND indexname='${t}_locationId_idx'`,
        t,
      )) as Array<unknown>
      expect(idx, `${t}: @@index([locationId]) pariteta naj bi obstajala`).toHaveLength(1)
    }
  })

  it('backfill: drift-era "globalni" vrstici dobita enotno lokacijo (prva po createdAt)', async () => {
    const expected = (
      (await db.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT "id" FROM "Location" ORDER BY "createdAt" ASC LIMIT 1`,
      )) as Array<{ id: string }>
    )[0]!.id

    for (const id of [`${RUN_ID}-vr-drift`, `${RUN_ID}-bridge`]) {
      const rows = (await db.$queryRawUnsafe<Array<{ locationId: string }>>(
        `SELECT "locationId" FROM "VoidReason" WHERE "id" = $1`,
        id,
      )) as Array<{ locationId: string }>
      expect(rows, `backfill za ${id}`).toHaveLength(1)
      expect(rows[0].locationId).toBe(expected)
    }
  })

  it('po migraciji: Prisma create z locationId deluje direktno (P2022 ne nastopi več)', async () => {
    const locId = (
      (await db.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT "id" FROM "Location" ORDER BY "createdAt" ASC LIMIT 1`,
      )) as Array<{ id: string }>
    )[0]!.id

    const vr = await db.voidReason.create({
      data: { id: `${RUN_ID}-post-vr`, name: 'R195 post-migracija', isActive: true, locationId: locId },
    })
    expect(vr.locationId).toBe(locId)

    const disc = await db.discount.create({
      data: {
        id: `${RUN_ID}-post-disc`,
        name: 'R195 popust',
        type: 'percentage',
        amount: 10,
        isActive: true,
        locationId: locId,
      },
    })
    expect(disc.locationId).toBe(locId)
  })

  it('most po migraciji: run(true) pot — vrstica NOSI locationId (most brez vloge)', async () => {
    const locId = (
      (await db.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT "id" FROM "Location" ORDER BY "createdAt" ASC LIMIT 1`,
      )) as Array<{ id: string }>
    )[0]!.id

    const created = await withLocationColumnFallback('r195-it:post-bridge', async (withLoc) =>
      withLoc
        ? db.voidReason.create({
            data: { id: `${RUN_ID}-post-bridge`, name: 'R195 post bridge', isActive: true, locationId: locId },
          })
        : db.voidReason.create({
            data: { id: `${RUN_ID}-post-bridge`, name: 'R195 post bridge', isActive: true } as unknown as Prisma.VoidReasonUncheckedCreateInput,
          }),
    )
    expect(created.locationId).toBe(locId)
  })

  it('FK enforcement: INSERT z neobstoječo lokacijo → 23503 (RESTRICT)', async () => {
    await expect(
      db.$executeRawUnsafe(
        `INSERT INTO "VoidReason" ("id", "name", "locationId", "updatedAt") VALUES ($1, $2, $3, NOW())`,
        `${RUN_ID}-fk-bad`,
        'FK test',
        'r195-ne-obstojeca-lokacija',
      ),
    ).rejects.toThrow(/foreign key/i)
  })

  it('idempotenca: drugi tek migracije brez napak, stanje nespremenjeno', async () => {
    await applyMigration()
    for (const t of TABLES) {
      const meta = await columnMeta(t)
      expect(meta).not.toBeNull()
      expect(meta!.nullable).toBe('NO')
    }
  })

  it('detektor: negativni primeri ne sprožijo lažnega pozitivnega', () => {
    expect(isMissingLocationColumnError(new Error('connection refused'))).toBe(false)
    expect(isMissingLocationColumnError(new Error('P2002 unique constraint'))).toBe(false)
    expect(isMissingLocationColumnError({ code: 'P2022', message: 'column `foo` does not exist' })).toBe(false)
    expect(isMissingLocationColumnError({ code: 'P2010', message: 'Raw query failed. Code: `23505`.' })).toBe(false)
    expect(isMissingLocationColumnError(null)).toBe(false)
    expect(isMissingLocationColumnError('string error')).toBe(false)
  })
})
