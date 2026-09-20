// R84 migracija: WalletPayment.locationId + OutboxEvent.locationId (tenant binding)
// Podoben konvenciji _migrate-outbox.mjs — surovi SQL proti PGlite dev bazi.
// Za produkcijo (Neon) poskrbi `prisma db push` / `prisma migrate deploy`.
import { PGlite } from '@electric-sql/pglite'

const dataDir = process.env.PGLITE_DATA_DIR || '/tmp/pglite-data'
console.log(`[migrate-r84] PGlite data dir: ${dataDir}`)

const pg = new PGlite(dataDir)

const statements = [
  // --- WalletPayment.locationId (R84: tenant binding) ---
  `ALTER TABLE "WalletPayment" ADD COLUMN IF NOT EXISTS "locationId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "WalletPayment_locationId_idx" ON "WalletPayment"("locationId")`,
  // FK (SetNull) — pariteta s prisma shemo (location Location? onDelete: SetNull)
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'WalletPayment_locationId_fkey'
    ) THEN
      ALTER TABLE "WalletPayment" ADD CONSTRAINT "WalletPayment_locationId_fkey"
        FOREIGN KEY ("locationId") REFERENCES "Location"("id")
        ON DELETE SET NULL ON UPDATE SET NULL;
    END IF;
  END $$;`,

  // --- OutboxEvent.locationId (R84: internal replay tenant binding) ---
  // BREZ FK — event log je namerno ločen od agregatov (glej schema komentar)
  `ALTER TABLE "OutboxEvent" ADD COLUMN IF NOT EXISTS "locationId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "OutboxEvent_locationId_idx" ON "OutboxEvent"("locationId")`,
]

try {
  for (const stmt of statements) {
    await pg.exec(stmt)
    console.log('[migrate-r84] OK:', stmt.split('\n')[0].slice(0, 72))
  }
  console.log('[migrate-r84] Migracija uspešno zaključena.')
} catch (err) {
  console.error('[migrate-r84] NAPAKA:', err)
  process.exit(1)
} finally {
  await pg.close()
}
