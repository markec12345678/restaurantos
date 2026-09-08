#!/usr/bin/env node
/**
 * db-sync.mjs — idempotentna DDL sinhronizacija baze med buildom.
 *
 * Namen: Vercel build dobi dešifriran DATABASE_URL (ki runtime API ne more
 * izdati) in zato build EXAKTNO TU lahko varno aplikira manjkajoče
 * primerjave sheme (schema drift) pred zagonom nove kode.
 *
 * Načela:
 *  - SAMO dodatne, nedestruktivne spremembe (ADD COLUMN IF NOT EXISTS,
 *    CREATE INDEX IF NOT EXISTS, pogojni FK) — NIKOLI drop/alter tipov.
 *  - Best-effort: napaka NE sme prelomiti builda (warn + exit 0).
 *  - Lokalni razvoj (brez DATABASE_URL / PGlite način): nemoten preskok.
 *
 * Uporaba: node scripts/db-sync.mjs  (zagnano iz "build" skripte)
 */
import { PrismaClient } from '@prisma/client'

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || ''
const isExternalPostgres =
  dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')

if (!isExternalPostgres) {
  console.log(
    '[db-sync] DATABASE_URL ni nastavljen ali ni zunanji PostgreSQL — preskakujem (PGlite/lokalni način).'
  )
  process.exit(0)
}

// Idempotentni DDL — vsak stavek je VAREN za večkratno izvajanje.
const statements = [
  // ── FIX IDOR-AUDIT (runda 12): WaitlistEntry tenant scope ──
  'ALTER TABLE "WaitlistEntry" ADD COLUMN IF NOT EXISTS "locationId" TEXT',
  'CREATE INDEX IF NOT EXISTS "WaitlistEntry_locationId_idx" ON "WaitlistEntry"("locationId")',
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WaitlistEntry_locationId_fkey') THEN
       ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_locationId_fkey"
       FOREIGN KEY ("locationId") REFERENCES "Location"("id")
       ON DELETE SET NULL ON UPDATE SET NULL;
     END IF;
   END $$;`,
  // ── FIX AUDIT: OutboxEvent.response — ločeno polje za odziv procesorja ──
  'ALTER TABLE "OutboxEvent" ADD COLUMN IF NOT EXISTS "response" JSONB',
  // ── P0-C4 Phase 3: Location loyalty + email config (per-lokacija) ──
  // Shema (schema.prisma/schema.sql) te stolpce že ima; ta DDL zagotavlja, da
  // jih ima TUDI produkcjska Neon baza (admin/migrate je ročen — db-sync je
  // avtomatska varovalka proti shema-drift ob vsakem deployu).
  'ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "loyaltyEnabled" BOOLEAN DEFAULT false',
  'ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "loyaltyPointsPerEuro" INTEGER DEFAULT 1',
  'ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "loyaltyPointsValue" DECIMAL(65,30) DEFAULT 0.01',
  'ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "emailReportRecipients" TEXT DEFAULT \'[]\'',
  'ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "emailEnabled" BOOLEAN DEFAULT false',
  // ── P0-C4 Phase 4: Webhook.locationId (tenant isolation filter) ──
  // Webhook engine že filtrira po locationId — če stolpec manjka, BI vsak
  // trigger padel ob zagonu (Prisma client ga pričakuje po generate).
  'ALTER TABLE "Webhook" ADD COLUMN IF NOT EXISTS "locationId" TEXT',
  'CREATE INDEX IF NOT EXISTS "Webhook_locationId_idx" ON "Webhook"("locationId")',
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Webhook_locationId_fkey') THEN
       ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_locationId_fkey"
       FOREIGN KEY ("locationId") REFERENCES "Location"("id")
       ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
   END $$;`,
]

// Neon serverless: ena povezava, kratek timeout (enak vzorcu kot src/lib/db.ts)
let optimizedUrl = dbUrl
if (!dbUrl.includes('connection_limit')) {
  const sep = dbUrl.includes('?') ? '&' : '?'
  optimizedUrl = `${dbUrl}${sep}connection_limit=1&connection_timeout=10&pool_timeout=10`
}

const prisma = new PrismaClient({
  datasources: { db: { url: optimizedUrl } },
  log: ['error'],
})

console.log('[db-sync] Zunanji PostgreSQL zaznan — apliciram idempotentni DDL …')

try {
  let applied = 0
  for (const stmt of statements) {
    const label = stmt.split('\n')[0].slice(0, 90)
    try {
      await prisma.$executeRawUnsafe(stmt)
      applied++
      console.log(`[db-sync] OK: ${label}`)
    } catch (err) {
      const msg = (err && err.message ? err.message : String(err)).slice(0, 160)
      console.warn(`[db-sync] SKIP/opozorilo: ${label} — ${msg}`)
    }
  }
  console.log(`[db-sync] Dokončano: ${applied}/${statements.length} stavkov apliciranih.`)
} catch (err) {
  // NIKOLI ne prelomimo builda — sinhronizacija je best-effort.
  const msg = (err && err.message ? err.message : String(err)).slice(0, 200)
  console.warn(`[db-sync] Zunanja napaka (build se nadaljuje): ${msg}`)
} finally {
  try {
    await prisma.$disconnect()
  } catch {}
}

process.exit(0)
