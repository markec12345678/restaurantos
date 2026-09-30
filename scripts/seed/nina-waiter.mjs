// TMP SEED (R175 živa verifikacija) — Nina (PIN 3333, staff + take_orders)
// Kanon R174: EmployeeRole enum = admin/manager/staff/chef/kitchen ('server' NE obstaja);
// permissions živijo na Job (R150 jsonb) — Employee prek EmployeeJob.
// R173 lekcija: node NE bere .env → EKSPPLICITEN NEXTAUTH_SECRET OBAVEZEN (pinLookup HMAC drift).
import { createHmac } from 'node:crypto'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import bcrypt from 'bcryptjs'

const dataDir = process.env.PGLITE_DATA_DIR || '/tmp/pglite-data'
if (!process.env.NEXTAUTH_SECRET) {
  console.error('[seed-nina] FATAL: EKSPPLICITEN NEXTAUTH_SECRET OBAVEZEN (R173 lekcija — pinLookup HMAC drift)')
  process.exit(1)
}
const SECRET = process.env.NEXTAUTH_SECRET

const pg = new PGlite(dataDir)
const pin = '3333'
const pinHash = await bcrypt.hash(pin, 10)
const pinLookup = createHmac('sha256', SECRET).update(pin).digest('hex')

// Job z natakarjevimi dovoljenji (permissions izključno take_orders)
const jobId = 'job-natakar-r175'
await pg.query(`
  INSERT INTO "Job" (id, name, code, "basePayRate", "overtimeRate", permissions, "isActive", "sortOrder", "createdAt", "updatedAt")
  VALUES ($1, 'Natakar', 'WAITER', 0, 0, $2::jsonb, true, 0, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET permissions = $2::jsonb
`, [jobId, JSON.stringify(['take_orders'])])

// Employee (role 'staff' — veljaven enum) + link
await pg.query(`
  INSERT INTO "Employee" (id, name, email, phone, role, status, "hireDate", pin, "pinLookup", "createdAt", "updatedAt")
  VALUES ('nina-r175', 'Nina', 'nina@e2e.test', '', 'staff', 'active', NOW(), $1, $2, NOW(), NOW())
  ON CONFLICT (email) DO UPDATE SET pin = $1, "pinLookup" = $2, role = 'staff', status = 'active'
`, [pinHash, pinLookup])

await pg.query(`
  INSERT INTO "EmployeeJob" (id, "employeeId", "jobId", "payRate", "isPrimary", "createdAt", "updatedAt")
  VALUES ($1, 'nina-r175', $2, 0, true, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING
`, [randomUUID(), jobId])

console.log('[seed-nina] ✅ Nina (PIN 3333, staff + take_orders) seedana')
await pg.close()
