// R88 migracija: Integration.locationId (per-location delivery webhook tenant binding) + BACKFILL
// Podoben konvenciji _migrate-r87-guest-location.mjs — surovi SQL proti PGlite dev bazi.
// Za produkcijo (Neon) poskrbi `prisma db push` / `prisma migrate deploy`.
//
// Context (R87-FINAL backlog → R88 wave 2):
//   - Delivery webhooki (wolt/glovo/bolt) so prej poznali SAMO globalni
//     integration.findFirst({ provider, isActive }) — brez tenant atribucije —
//     in žigali naročilo na GLOBALNO prvo aktivno lokacijo KATEREGA KOLI
//     tenanta (resolveDefaultLocationId).
//   - locationId je NULLABLE: integracija brez nastavljene lokacije → webhook
//     vrne 503 'Ni nastavljene lokacije' (platforma retry-a) — fail-closed,
//     naročilo nikoli tiho žigano na tujo lokacijo.
//
// Backfill derivacija (IDEMPOTENTNO — samo vrstice z locationId IS NULL):
//   vsaka obstoječa integracija dobi PRVO aktivno lokacijo (createdAt ASC) —
//   to ohranja OBNAŠANJE resolveDefaultLocationId (prva aktivna lokacija),
//   tako da se po migraciji nič ne premakne, dokler admin lokacijo izrecno
//   ne prerazporedi prek PUT /api/integrations/[id].
//
// Uporaba:
//   node scripts/_migrate-r88-integration-location.mjs  → migracija + backfill + census
import { PGlite } from '@electric-sql/pglite'

const dataDir = process.env.PGLITE_DATA_DIR || '/tmp/pglite-data'
console.log(`[migrate-r88] PGlite data dir: ${dataDir}`)

const pg = new PGlite(dataDir)

const statements = [
  // --- Integration.locationId (R88: webhook tenant binding) ---
  `ALTER TABLE "Integration" ADD COLUMN IF NOT EXISTS "locationId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "Integration_locationId_idx" ON "Integration"("locationId")`,
  // FK (SetNull) — pariteta s prisma shemo (location Location? onDelete: SetNull)
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'Integration_locationId_fkey'
    ) THEN
      ALTER TABLE "Integration" ADD CONSTRAINT "Integration_locationId_fkey"
        FOREIGN KEY ("locationId") REFERENCES "Location"("id")
        ON DELETE SET NULL ON UPDATE SET NULL;
    END IF;
  END $$;`,
]

// --- Backfill: prva aktivna lokacija (createdAt ASC) ---
// Isti kandidat, ki ga je resolveDefaultLocationId() izbrala — ohrani vedenje.
const BACKFILL = `UPDATE "Integration" i
  SET "locationId" = l."id"
  FROM "Location" l
  WHERE i."locationId" IS NULL
    AND l."isActive" = true
    AND l."id" = (
      SELECT l2."id" FROM "Location" l2
      WHERE l2."isActive" = true
      ORDER BY l2."createdAt" ASC
      LIMIT 1
    )`

try {
  // --- CENSUS PRED (samo če stolpec že obstaja — ponovni zagon) ---
  const colExists = await pg.query(`SELECT COUNT(*)::int AS n
    FROM information_schema.columns
    WHERE table_name = 'Integration' AND column_name = 'locationId'`)
  if (colExists.rows[0].n > 0) {
    const before = await pg.query(`SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE "locationId" IS NULL)::int AS null_count
      FROM "Integration"`)
    console.log(`[migrate-r88] CENSUS PRED: ${before.rows[0].total} integracij, ${before.rows[0].null_count} brez lokacije`)
  } else {
    console.log('[migrate-r88] CENSUS PRED: stolpec še ne obstaja (prvi zagon)')
  }
  const activeLoc = await pg.query(`SELECT COUNT(*)::int AS n
    FROM "Location" WHERE "isActive" = true`).catch(() => ({ rows: [{ n: 0 }] }))
  console.log(`[migrate-r88] aktivnih lokacij (backfill kandidat): ${activeLoc.rows[0].n}`)

  // --- DDL ---
  for (const stmt of statements) {
    await pg.exec(stmt)
    console.log('[migrate-r88] OK:', stmt.split('\n')[0].slice(0, 72))
  }

  // --- BACKFILL (idempotenten: samo locationId IS NULL vrstice; brez aktivne
  //     lokacije ostanejo NULL = webhook fail-closed 503) ---
  const bf = await pg.query(BACKFILL)
  console.log(`[migrate-r88] BACKFILL: ${bf.rowCount ?? 0} integracij žiganih na prvo aktivno lokacijo`)

  // --- CENSUS PO ---
  const after = await pg.query(`SELECT
    COUNT(*) FILTER (WHERE "locationId" IS NULL)::int AS null_count
    FROM "Integration"`)
  console.log(`[migrate-r88] CENSUS PO: ${after.rows[0].null_count} integracij še brez lokacije (webhook 503 do admin nastavitve — fail-closed)`)

  console.log('[migrate-r88] Migracija uspešno zaključena.')
} catch (err) {
  console.error('[migrate-r88] NAPAKA:', err)
  process.exitCode = 1
} finally {
  // R88: zapri PGlite, da se proces čisto zaključi (R87 skripta je visela brez tega)
  await pg.close().catch(() => {})
}
