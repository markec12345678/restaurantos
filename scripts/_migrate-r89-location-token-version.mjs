// R89 migracija: Location.tokenVersion — per-location ordering token revokacija
// Idempotenten vzorec _migrate-r88-integration-location.mjs — surovi SQL proti
// PGlite dev bazi. Za produkcijo (Neon) poskrbi `prisma db push` /
// `prisma migrate deploy`.
//
// Context (R88-FINAL backlog → R89 wave 1):
//   - R88 ordering tokeni so stateless HMAC vezani na locationId; edina
//     revokacija je bila rotacija GLOBALNE skrivnosti (ORDERING_TOKEN_SECRET) —
//     to ubije tokene VSEH lokacij VSEH tenantov hkrati.
//   - tokenVersion INTEGER NOT NULL DEFAULT 0: izdaja vgradi verzijo v token
//     (`v1:<version>:<hmac64>`, HMAC kontekst vključuje verzijo), javna ruta pa
//     preverja token proti TRENUTNI verziji lokacije. Rotacija ene lokacije =
//     `UPDATE "Location" SET "tokenVersion" = "tokenVersion" + 1` → njeni stari
//     tokeni so instant neveljavni; druge lokacije/tenanti ostanejo nedotaknjeni.
//
// NO BACKFILL: default 0 pomeni, da vsi obstoječi R88 tokeni (kovani brez
// verzije = implicitno verzija 0) po migraciji OSTANEJO veljavni — zero-downtime,
// nič ne dega. Prva rotacija posamezne lokacije jo posodobi na 1.
//
// Uporaba:
//   node scripts/_migrate-r89-location-token-version.mjs
//   PGLITE_DATA_DIR=/tmp/pglite-data-it node scripts/_migrate-r89-location-token-version.mjs
import { PGlite } from '@electric-sql/pglite'

const dataDir = process.env.PGLITE_DATA_DIR || '/tmp/pglite-data'
console.log(`[migrate-r89] PGlite data dir: ${dataDir}`)

const pg = new PGlite(dataDir)

try {
  // --- CENSUS PRED (samo če stolpec že obstaja — ponovni zagon) ---
  const colExists = await pg.query(`SELECT COUNT(*)::int AS n
    FROM information_schema.columns
    WHERE table_name = 'Location' AND column_name = 'tokenVersion'`)
  if (colExists.rows[0].n > 0) {
    const before = await pg.query(`SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE "tokenVersion" = 0)::int AS v0,
      MAX("tokenVersion")::int AS max_v
      FROM "Location"`)
    console.log(`[migrate-r89] CENSUS PRED: ${before.rows[0].total} lokacij, ${before.rows[0].v0} z tokenVersion=0, max verzija=${before.rows[0].max_v}`)
  } else {
    console.log('[migrate-r89] CENSUS PRED: stolpec še ne obstaja (prvi zagon)')
  }

  // --- DDL (idempotenten) ---
  await pg.exec(`ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0`)
  console.log('[migrate-r89] OK: ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0')

  // --- NO BACKFILL (glej header): default 0 ohrani obstoječe tokene ---

  // --- CENSUS PO ---
  const after = await pg.query(`SELECT
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE "tokenVersion" = 0)::int AS v0
    FROM "Location"`)
  console.log(`[migrate-r89] CENSUS PO: ${after.rows[0].total} lokacij, ${after.rows[0].v0} z tokenVersion=0 (obstoječi R88 tokeni ostajajo veljavni)`)

  console.log('[migrate-r89] Migracija uspešno zaključena.')
} catch (err) {
  console.error('[migrate-r89] NAPAKA:', err)
  process.exitCode = 1
} finally {
  // R88 lekcija: zapri PGlite, da se proces čisto zaključi (proces visi brez tega)
  await pg.close().catch(() => {})
}
