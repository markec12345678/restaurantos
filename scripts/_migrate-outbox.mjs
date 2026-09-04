// Migracija za Offline Outbox tabele
import { PGlite } from '@electric-sql/pglite'

const dataDir = process.env.PGLITE_DATA_DIR || '/home/z/my-project/pglite-test-data'
console.log(`[migrate-outbox] PGlite data dir: ${dataDir}`)

const pg = new PGlite(dataDir)

const statements = [
  `CREATE TABLE IF NOT EXISTS "OutboxEvent" (
    "id" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "target" TEXT NOT NULL,
    "targetEndpoint" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lastError" TEXT NOT NULL DEFAULT '',
    "idempotencyKey" TEXT NOT NULL,
    "nextRetryAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "OutboxEvent_idempotencyKey_key" ON "OutboxEvent"("idempotencyKey")`,
  `CREATE INDEX IF NOT EXISTS "OutboxEvent_status_nextRetryAt_idx" ON "OutboxEvent"("status", "nextRetryAt")`,
  `CREATE INDEX IF NOT EXISTS "OutboxEvent_target_status_idx" ON "OutboxEvent"("target", "status")`,
  `CREATE INDEX IF NOT EXISTS "OutboxEvent_aggregateType_aggregateId_idx" ON "OutboxEvent"("aggregateType", "aggregateId")`,
  `CREATE INDEX IF NOT EXISTS "OutboxEvent_createdAt_idx" ON "OutboxEvent"("createdAt")`,

  `CREATE TABLE IF NOT EXISTS "SyncState" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "syncVersion" INTEGER NOT NULL DEFAULT 0,
    "conflictStatus" TEXT NOT NULL DEFAULT 'none',
    "conflictData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "SyncState_entityType_entityId_key" ON "SyncState"("entityType", "entityId")`,
  `CREATE INDEX IF NOT EXISTS "SyncState_lastSyncedAt_idx" ON "SyncState"("lastSyncedAt")`,
  `CREATE INDEX IF NOT EXISTS "SyncState_conflictStatus_idx" ON "SyncState"("conflictStatus")`,

  `CREATE TABLE IF NOT EXISTS "DeviceRegistry" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locationId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'pos',
    "status" TEXT NOT NULL DEFAULT 'offline',
    "lastSeenAt" TIMESTAMP(3),
    "appVersion" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeviceRegistry_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "DeviceRegistry_deviceId_key" ON "DeviceRegistry"("deviceId")`,
  `CREATE INDEX IF NOT EXISTS "DeviceRegistry_locationId_idx" ON "DeviceRegistry"("locationId")`,
  `CREATE INDEX IF NOT EXISTS "DeviceRegistry_status_idx" ON "DeviceRegistry"("status")`,
  `ALTER TABLE "DeviceRegistry" ADD CONSTRAINT "DeviceRegistry_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "Location"("id")
    ON DELETE SET NULL ON UPDATE CASCADE`,
]

let applied = 0
let skipped = 0
for (const sql of statements) {
  try {
    await pg.exec(sql)
    applied++
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('already exists') || msg.includes('duplicate')) {
      skipped++
    } else {
      console.error(`[migrate-outbox] Napaka: ${msg}`)
      console.error(`[migrate-outbox] SQL: ${sql.substring(0, 100)}...`)
    }
  }
}

console.log(`[migrate-outbox] ✅ Applied: ${applied}, Skipped: ${skipped}`)

const tables = await pg.query(`
  SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  AND tablename IN ('OutboxEvent', 'SyncState', 'DeviceRegistry')
`)
console.log(`[migrate-outbox] Tabele: ${tables.rows.map(r => r.tablename).join(', ')}`)

await pg.close()
console.log('[migrate-outbox] PGlite zaprt.')
