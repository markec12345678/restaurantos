// TMP SEED (R176 živa verifikacija) — Marko (PIN 4444, kitchen + take_orders)
// P0-02 (epic #144, R176): kitchen workspace — chef/kitchen role → landing KDS.
// Kanon R174: EmployeeRole enum = admin/manager/staff/chef/kitchen ('server' NE obstaja);
// permissions živijo na Job (R150 jsonb) — Employee prek EmployeeJob.
// R173 lekcija: node NE bere .env → EKSPPLICITEN NEXTAUTH_SECRET OBAVEZEN (pinLookup HMAC drift).
import { createHmac } from 'node:crypto'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import bcrypt from 'bcryptjs'

const dataDir = process.env.PGLITE_DATA_DIR || '/tmp/pglite-data'
if (!process.env.NEXTAUTH_SECRET) {
  console.error('[seed-marko] FATAL: EKSPPLICITEN NEXTAUTH_SECRET OBAVEZEN (R173 lekcija — pinLookup HMAC drift)')
  process.exit(1)
}
const SECRET = process.env.NEXTAUTH_SECRET

const pg = new PGlite(dataDir)
const pin = '4444'
const pinHash = await bcrypt.hash(pin, 10)
const pinLookup = createHmac('sha256', SECRET).update(pin).digest('hex')

// Job s kuharskimi dovoljenji (permissions izključno take_orders — vrata do
// kitchen/kitchen-prep/kitchen-stations modulov; workspace je sodebnik, ne vrata)
const jobId = 'job-kuhar-r176'
await pg.query(`
  INSERT INTO "Job" (id, name, code, "basePayRate", "overtimeRate", permissions, "isActive", "sortOrder", "createdAt", "updatedAt")
  VALUES ($1, 'Kuhar', 'CHEF', 0, 0, $2::jsonb, true, 0, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET permissions = $2::jsonb
`, [jobId, JSON.stringify(['take_orders'])])

// Employee (role 'kitchen' — veljaven enum) + link
await pg.query(`
  INSERT INTO "Employee" (id, name, email, phone, role, status, "hireDate", pin, "pinLookup", "createdAt", "updatedAt")
  VALUES ('marko-r176', 'Marko', 'marko@e2e.test', '', 'kitchen', 'active', NOW(), $1, $2, NOW(), NOW())
  ON CONFLICT (email) DO UPDATE SET pin = $1, "pinLookup" = $2, role = 'kitchen', status = 'active'
`, [pinHash, pinLookup])

await pg.query(`
  INSERT INTO "EmployeeJob" (id, "employeeId", "jobId", "payRate", "isPrimary", "createdAt", "updatedAt")
  VALUES ($1, 'marko-r176', $2, 0, true, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING
`, [randomUUID(), jobId])

console.log('[seed-marko] ✅ Marko (PIN 4444, kitchen + take_orders) seedan')
await pg.close()
