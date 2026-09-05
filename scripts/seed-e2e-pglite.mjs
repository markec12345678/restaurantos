// Skripta za seed testnih podatkov v PGlite
import { PGlite } from '@electric-sql/pglite'
import bcrypt from 'bcryptjs'
import crypto, { randomUUID } from 'crypto'

const dataDir = process.env.PGLITE_DATA_DIR || '/home/z/my-project/pglite-dev-data'
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'dev-secret-32-hex-chars-min'

console.log(`[seed] Povezujem se na PGlite: ${dataDir}`)
const pg = new PGlite(dataDir)

// 1. Admin uporabnik z PIN 1111
const pin = '1111'
const pinHash = await bcrypt.hash(pin, 10)
const pinLookup = crypto.createHmac('sha256', NEXTAUTH_SECRET).update(pin).digest('hex')

await pg.query(`
  INSERT INTO "Employee" (id, name, email, phone, role, status, "hireDate", pin, "pinLookup", "createdAt", "updatedAt")
  VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, NOW(), NOW())
  ON CONFLICT (email) DO UPDATE SET pin = $7, "pinLookup" = $8
`, ['test-admin', 'Test Admin', 'admin@e2e.test', '', 'admin', 'active', pinHash, pinLookup])
console.log('[seed] ✅ Admin (PIN 1111) seedan')

// 2. Job z admin dovoljenji
await pg.query(`
  INSERT INTO "Job" (id, name, code, "basePayRate", "overtimeRate", permissions, "isActive", "sortOrder", "createdAt", "updatedAt")
  VALUES ($1, $2, $3, 0, 0, $4, true, 0, NOW(), NOW())
  ON CONFLICT (name) DO NOTHING
`, ['job-admin', 'Administrator', 'ADMIN', JSON.stringify(['take_orders','void_item','apply_discounts','manage_cash','manage_inventory','manage_employees','view_reports','admin'])])

await pg.query(`
  INSERT INTO "EmployeeJob" (id, "employeeId", "jobId", "createdAt", "updatedAt")
  VALUES ($1, $2, $3, NOW(), NOW())
  ON CONFLICT DO NOTHING
`, ['ej-1', 'test-admin', 'job-admin'])
console.log('[seed] ✅ Job + EmployeeJob seedan')

// 3. RestaurantSettings
await pg.query(`
  INSERT INTO "RestaurantSettings" (id, name, address, "postCode", city, "businessId", "taxId", "registerNumber", "fursEnvironment", "isActive", "createdAt", "updatedAt")
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW(), NOW())
  ON CONFLICT DO NOTHING
`, ['rs-1', 'Test Restaurant', 'Testna 1', '1000', 'Ljubljana', '12345678', 'SI12345678', 'TEST01', 'test'])
console.log('[seed] ✅ RestaurantSettings seedan')

// 3b. Location (potreben za setup status check)
await pg.query(`
  INSERT INTO "Location" (id, name, code, type, address, city, "postCode", country, phone, email, "businessId", "taxId", "registerNumber", "fursEnvironment", timezone, currency, locale, "isOpen", "isActive", "createdAt", "updatedAt")
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, true, true, NOW(), NOW())
  ON CONFLICT (code) DO NOTHING
`, ['loc-1', 'Test Restavracija', 'HQ', 'restaurant', 'Testna 1', 'Ljubljana', '1000', 'SI', '+386 1 234 5678', 'test@test.si', '12345678', 'SI12345678', 'TEST01', 'test', 'Europe/Ljubljana', 'EUR', 'sl-SI'])
console.log('[seed] ✅ Location seedan')

// 4. TaxRate (22%, 9.5%, 0%)
for (const [id, name, rate, code] of [
  ['tax-22', 'Standard DDV 22%', 22.0, 'S'],
  ['tax-95', 'Znižana DDV 9.5%', 9.5, 'R'],
  ['tax-0', 'Oproščeno 0%', 0.0, 'Z'],
]) {
  await pg.query(`INSERT INTO "TaxRate" (id, name, rate, code, "isActive", "sortOrder", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,true,0,NOW(),NOW()) ON CONFLICT (code) DO NOTHING`, [id, name, rate, code])
}
console.log('[seed] ✅ TaxRates seedan')

// 5. Menu + Category + MenuItems
// FIX P0-C3B: Menu mora imeti locationId (per-lokacija) za pravilen multi-tenant prikaz
await pg.query(`INSERT INTO "Menu" (id, name, icon, color, "sortOrder", "isActive", "locationId", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,0,true,$5,NOW(),NOW()) ON CONFLICT (id) DO UPDATE SET "locationId" = $5`, ['menu-1', 'Test Menu', '🍽️', '#f59e0b', 'loc-1'])
await pg.query(`INSERT INTO "Category" (id, name, icon, color, "sortOrder", "menuId", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,0,$5,NOW(),NOW()) ON CONFLICT (id) DO NOTHING`, ['cat-1', 'Test Kategorija', '🍽️', '#f59e0b', 'menu-1'])

for (const [id, name, price, vat] of [
  ['mi-1', 'Test Kava', 1.50, 22.0],
  ['mi-2', 'Test Pizza', 8.90, 9.5],
  ['mi-3', 'Test Solata', 5.50, 9.5],
]) {
  await pg.query(`INSERT INTO "MenuItem" (id, name, description, price, image, "isAvailable", "sortOrder", "vatRate", "categoryId", "createdAt", "updatedAt") VALUES ($1,$2,'',$3,'',true,0,$4,$5,NOW(),NOW()) ON CONFLICT (id) DO NOTHING`, [id, name, price, vat, 'cat-1'])
}
console.log('[seed] ✅ Menu, Category, 3 artikli seedani')

// 6. Table
// FIX P0-C3B: Table mora imeti locationId (mize so fizično na lokaciji)
await pg.query(`INSERT INTO "Table" (id, number, capacity, status, area, "posX", "posY", width, height, shape, rotation, "locationId", "createdAt", "updatedAt") VALUES ($1,1,4,'available','main',10,10,8,10,'round',0,$2,NOW(),NOW()) ON CONFLICT (id) DO UPDATE SET "locationId" = $2`, ['table-1', 'loc-1'])
console.log('[seed] ✅ Miza 1 seedana')

// 7. Counters
for (const [id, name] of [['c-rcpt', 'receiptNumber'], ['c-ord', 'orderNumber']]) {
  await pg.query(`INSERT INTO "Counter" (id, name, value) VALUES ($1,$2,0) ON CONFLICT (name) DO NOTHING`, [id, name])
}
console.log('[seed] ✅ Counterji seedani')

// 8. DiningOptions
for (const [id, name, type] of [['do-1', 'Na mestu', 'dine-in'], ['do-2', 'Vzemi s seboj', 'takeout']]) {
  await pg.query(`INSERT INTO "DiningOption" (id, name, type, "prepTimeMinutes", "isActive", "sortOrder", "createdAt", "updatedAt") VALUES ($1,$2,$3,15,true,0,NOW(),NOW()) ON CONFLICT (type) DO NOTHING`, [id, name, type])
}
console.log('[seed] ✅ DiningOptions seedani')

// 9. VoidReason
await pg.query(`INSERT INTO "VoidReason" (id, name, "isActive", "sortOrder", "createdAt", "updatedAt") VALUES ($1,$2,true,0,NOW(),NOW()) ON CONFLICT DO NOTHING`, ['vr-1', 'Test razlog'])

// 10. NoSaleReason
await pg.query(`INSERT INTO "NoSaleReason" (id, name, "isActive", "sortOrder", "createdAt", "updatedAt") VALUES ($1,$2,true,0,NOW(),NOW()) ON CONFLICT DO NOTHING`, ['nsr-1', 'Mali dvig'])

// 11. PrepStation
await pg.query(`INSERT INTO "PrepStation" (id, name, type, "avgPrepTime", "isActive", "sortOrder", "createdAt", "updatedAt") VALUES ($1,$2,$3,15,true,0,NOW(),NOW()) ON CONFLICT DO NOTHING`, ['ps-1', 'Kuhinja', 'kitchen'])
await pg.query(`INSERT INTO "PrepStation" (id, name, type, "avgPrepTime", "isActive", "sortOrder", "createdAt", "updatedAt") VALUES ($1,$2,$3,5,true,1,NOW(),NOW()) ON CONFLICT DO NOTHING`, ['ps-2', 'Bar', 'bar'])

// 12. ChartOfAccount (SKM 2006)
for (const [code, name, type] of [
  ['1010', 'Blagajna', 'asset'],
  ['1000', 'Banka', 'asset'],
  ['2600', 'DDV izhodni', 'liability'],
  ['7000', 'Promet — na mestu', 'revenue'],
  ['7010', 'Promet — s seboj', 'revenue'],
  ['7020', 'Promet — dostava', 'revenue'],
  ['7600', 'Stroški materiala', 'expense'],
]) {
  await pg.query(`INSERT INTO "ChartOfAccount" (id, code, name, "accountType", "isActive", "sortOrder", description, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,true,0,'',NOW(),NOW()) ON CONFLICT (code) DO NOTHING`, [randomUUID(), code, name, type])
}
console.log('[seed] ✅ ChartOfAccount seedan (7 kontov)')

// Preveri stanje
const counts = await pg.query(`
  SELECT
    (SELECT count(*) FROM "Employee") AS employees,
    (SELECT count(*) FROM "MenuItem") AS menuItems,
    (SELECT count(*) FROM "Table") AS tables,
    (SELECT count(*) FROM "TaxRate") AS taxRates,
    (SELECT count(*) FROM "Location") AS locations
`)
console.log('[seed] 📊 Stanje:', counts.rows[0])

await pg.close()
console.log('[seed] 🎉 Seed končan')
