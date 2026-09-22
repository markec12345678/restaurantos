// R87 migracija: Guest.locationId (per-location CRM tenant binding) + BACKFILL
// Podoben konvenciji _migrate-r84-location.mjs — surovi SQL proti PGlite dev bazi.
// Za produkcijo (Neon) poskrbi `prisma db push` / `prisma migrate deploy`.
//
// Context (R87 schema round):
//   - Guest je bil prej BREZ tenant stolpca — izolacija je bila dvokoračna
//     (list: orders.some.locationId izpeljava; guests/[id] PUT/DELETE NEscopčana
//     do R87 — čakala je na ta stolpec, glej R86-FINAL backlog).
//   - locationId je NULLABLE: legacy vrstice brez varno izpeljive lokacije
//     ostanejo NULL = vidne SAMO super-adminu (fail-closed, ni leak-a).
//
// Backfill derivacija (IDEMPOTENTNO — samo vrstice z locationId IS NULL):
//   1. prvo naročilo gosta (Order.locationId NOT NULL, createdAt ASC) —
//      "lokacija, pod katero je gost prvič kupoval" (schema komentar).
//   2. ostalo → OSTANE NULL (super-admin-only, fail-closed).
//
// Uporaba:
//   node scripts/_migrate-r87-guest-location.mjs            → migracija + backfill + census
import { PGlite } from '@electric-sql/pglite'

const dataDir = process.env.PGLITE_DATA_DIR || '/tmp/pglite-data'
console.log(`[migrate-r87] PGlite data dir: ${dataDir}`)

const pg = new PGlite(dataDir)

const statements = [
  // --- Guest.locationId (R87: per-location CRM tenant binding) ---
  `ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "locationId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "Guest_locationId_idx" ON "Guest"("locationId")`,
  // FK (SetNull) — pariteta s prisma shemo (location Location? onDelete: SetNull)
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'Guest_locationId_fkey'
    ) THEN
      ALTER TABLE "Guest" ADD CONSTRAINT "Guest_locationId_fkey"
        FOREIGN KEY ("locationId") REFERENCES "Location"("id")
        ON DELETE SET NULL ON UPDATE SET NULL;
    END IF;
  END $$;`,
]

// --- Backfill: prvo naročilo gosta (createdAt ASC) ---
// DISTINCT ON po guestId z ORDER BY createdAt ASC — prva lokacija obiska.
const BACKFILL = `UPDATE "Guest" g
  SET "locationId" = o."locationId"
  FROM (
    SELECT DISTINCT ON ("guestId") "guestId", "locationId"
    FROM "Order"
    WHERE "guestId" IS NOT NULL AND "locationId" IS NOT NULL
    ORDER BY "guestId", "createdAt" ASC
  ) o
  WHERE g."id" = o."guestId" AND g."locationId" IS NULL`

try {
  // --- CENSUS PRED (samo če stolpec že obstaja — ponovni zagon) ---
  const colExists = await pg.query(`SELECT COUNT(*)::int AS n
    FROM information_schema.columns
    WHERE table_name = 'Guest' AND column_name = 'locationId'`)
  if (colExists.rows[0].n > 0) {
    const before = await pg.query(`SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE "locationId" IS NULL)::int AS null_count
      FROM "Guest"`)
    console.log(`[migrate-r87] CENSUS PRED: ${before.rows[0].total} gostov, ${before.rows[0].null_count} brez lokacije`)
  } else {
    console.log('[migrate-r87] CENSUS PRED: stolpec še ne obstaja (prvi zagon)')
  }
  const derivable = await pg.query(`SELECT COUNT(DISTINCT g."id")::int AS n
    FROM "Guest" g
    JOIN "Order" o ON o."guestId" = g."id" AND o."locationId" IS NOT NULL
    WHERE g."locationId" IS NULL`).catch(() => ({ rows: [{ n: '?' }] }))
  if (typeof derivable.rows[0].n === 'number') {
    console.log(`[migrate-r87] izpeljivih iz prvega naročila: ${derivable.rows[0].n}`)
  }

  // --- DDL ---
  for (const stmt of statements) {
    await pg.exec(stmt)
    console.log('[migrate-r87] OK:', stmt.split('\n')[0].slice(0, 72))
  }

  // --- BACKFILL ---
  const bf = await pg.query(BACKFILL)
  console.log(`[migrate-r87] BACKFILL: ${bf.rowCount ?? 0} gostov žiganih na lokacijo prvega naročila`)

  // --- CENSUS PO ---
  const after = await pg.query(`SELECT
    COUNT(*) FILTER (WHERE "locationId" IS NULL)::int AS null_count
    FROM "Guest"`)
  console.log(`[migrate-r87] CENSUS PO: ${after.rows[0].null_count} gostov še brez lokacije (samo super-admin vidi — fail-closed)`)

  console.log('[migrate-r87] Migracija uspešno zaključena.')
} catch (err) {
  console.error('[migrate-r87] NAPAKA:', err)
  process.exit(1)
}
