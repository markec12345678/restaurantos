// Skripta za dodajanje novih tabel (StaffAvailability, TimeOffRequest) na obstoječi PGlite
import { PGlite } from '@electric-sql/pglite'
import { execSync } from 'child_process'

const dataDir = process.env.PGLITE_DATA_DIR || '/home/z/my-project/pglite-test-data'
console.log(`[migrate] PGlite data dir: ${dataDir}`)

const pg = new PGlite(dataDir)

// 1. Pridobi obstoječe tabele
const existing = await pg.query(`
  SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('StaffAvailability', 'TimeOffRequest')
`)
const existingNames = existing.rows.map((r) => r.tablename)
console.log(`[migrate] Obstoječe tabele: ${existingNames.length ? existingNames.join(', ') : 'nobena'}`)

// 2. Generiraj SQL za migracijo (diff od trenutne sheme baze do nove schema.prisma)
// Enostavnejši approach: izvedi direktno CREATE TABLE IF NOT EXISTS
const sqlStatements = [
  // StaffAvailability
  `CREATE TABLE IF NOT EXISTS "StaffAvailability" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isPreferred" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StaffAvailability_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "StaffAvailability_employeeId_dayOfWeek_startTime_endTime_key"
    ON "StaffAvailability"("employeeId", "dayOfWeek", "startTime", "endTime")`,
  `CREATE INDEX IF NOT EXISTS "StaffAvailability_employeeId_idx" ON "StaffAvailability"("employeeId")`,
  `CREATE INDEX IF NOT EXISTS "StaffAvailability_dayOfWeek_idx" ON "StaffAvailability"("dayOfWeek")`,

  // TimeOffRequest
  `CREATE TABLE IF NOT EXISTS "TimeOffRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'vacation',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT NOT NULL DEFAULT '',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TimeOffRequest_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "TimeOffRequest_employeeId_idx" ON "TimeOffRequest"("employeeId")`,
  `CREATE INDEX IF NOT EXISTS "TimeOffRequest_startDate_endDate_idx" ON "TimeOffRequest"("startDate", "endDate")`,
  `CREATE INDEX IF NOT EXISTS "TimeOffRequest_status_idx" ON "TimeOffRequest"("status")`,

  // Foreign keys
  `ALTER TABLE "StaffAvailability" ADD CONSTRAINT "StaffAvailability_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "TimeOffRequest" ADD CONSTRAINT "TimeOffRequest_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE CASCADE ON UPDATE CASCADE`,
]

let applied = 0
let skipped = 0
for (const sql of sqlStatements) {
  try {
    await pg.exec(sql)
    applied++
  } catch (err) {
    // Ignoriraj "already exists" napake
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('already exists') || msg.includes('duplicate')) {
      skipped++
    } else {
      console.error(`[migrate] Napaka pri SQL: ${msg}`)
      console.error(`[migrate] SQL: ${sql.substring(0, 100)}...`)
    }
  }
}

console.log(`[migrate] ✅ Applied: ${applied}, Skipped: ${skipped}`)

// 3. Verificiraj
const tables = await pg.query(`
  SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('StaffAvailability', 'TimeOffRequest')
`)
console.log(`[migrate] Tabele sedaj: ${tables.rows.map((r) => r.tablename).join(', ')}`)

await pg.close()
console.log('[migrate] PGlite zaprt.')
