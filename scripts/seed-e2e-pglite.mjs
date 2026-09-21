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

// 4. TaxRate — R92: per-lokacijski fixture ids tr-loc-1/2-* (MODEL A, spec
// MODELA-3) se seedajo NIZJE v MODEL A fixture bloku; tukaj nič (unique(
// locationId, code) — stari tax-22/-l2 id-ji so bili v konfliktu s tr-loc-*).

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

// 6b. E2E VARIANTE: druga lokacija + meni + miza + inventar z receptami
//   (skladno z scripts/init-e2e-db.mjs — isti ID-ji)
//   FIX: premisesId je UNIQUE z default '' — loc-2 MORA imeti svojega
await pg.query(`
  INSERT INTO "Location" (id, name, code, type, address, city, "postCode", country, phone, email, "businessId", "taxId", "registerNumber", "premisesId", "fursEnvironment", timezone, currency, locale, "isOpen", "isActive", "createdAt", "updatedAt")
  VALUES ($1, $2, $3, $4, $5, $6, $7, 'SI', $8, $9, $10, $11, $12, 'PREM-TEST02', 'test', 'Europe/Ljubljana', 'EUR', 'sl-SI', true, true, NOW(), NOW())
  ON CONFLICT (code) DO NOTHING
`, ['loc-2', 'Test Filiala', 'FIL2', 'restaurant', 'Filialna 2', 'Maribor', '2000', '+386 2 345 6789', 'filiala@test.si', '87654321', 'SI87654321', 'TEST02'])
await pg.query(`INSERT INTO "Menu" (id, name, icon, color, "sortOrder", "isActive", "locationId", "createdAt", "updatedAt") VALUES ($1,$2,'🍽️','#0ea5e9',0,true,$3,NOW(),NOW()) ON CONFLICT (id) DO UPDATE SET "locationId" = $3`, ['menu-2', 'Test Menu Filiala', 'loc-2'])
await pg.query(`INSERT INTO "Category" (id, name, icon, color, "sortOrder", "menuId", "createdAt", "updatedAt") VALUES ($1,$2,'🍽️','#0ea5e9',0,$3,NOW(),NOW()) ON CONFLICT (id) DO NOTHING`, ['cat-2', 'Test Kategorija Filiala', 'menu-2'])
for (const [id, name, price, vat] of [
  ['mi-4', 'Test Kava Filiala', 1.70, 22.0],
  ['mi-5', 'Test Burger Filiala', 9.90, 9.5],
]) {
  await pg.query(`INSERT INTO "MenuItem" (id, name, description, price, image, "isAvailable", "sortOrder", "vatRate", "categoryId", "createdAt", "updatedAt") VALUES ($1,$2,'',$3,'',true,0,$4,$5,NOW(),NOW()) ON CONFLICT (id) DO NOTHING`, [id, name, price, vat, 'cat-2'])
}
await pg.query(`INSERT INTO "Table" (id, number, capacity, status, area, "posX", "posY", width, height, shape, rotation, "locationId", "createdAt", "updatedAt") VALUES ($1,1,4,'available','main',20,10,8,10,'square',0,$2,NOW(),NOW()) ON CONFLICT (id) DO UPDATE SET "locationId" = $2`, ['table-2', 'loc-2'])
console.log('[seed] ✅ Lokacija 2 + menu-2 + miza 2 seedani (E2E dve lokaciji)')

// R92 FIX: filiala-admin (PIN 2222, loc-2) — MODEL A E2E describe (multi-tenant-
// security.spec.ts MODELA-*) prijavlja 'filiala-admin'/'2222'; seed je dotlej
// manjal → beforeAll login fail → 13 testov 'did not run'. Employee.locationId
// = session lokacija (tenant-scope kanon R85+).
{
  const fpin = '2222'
  const fpinHash = await bcrypt.hash(fpin, 10)
  const fpinLookup = createHmac('sha256', NEXTAUTH_SECRET).update(fpin).digest('hex')
  await pg.query(`
    INSERT INTO "Employee" (id, name, email, phone, role, status, "hireDate", pin, "pinLookup", "locationId", "createdAt", "updatedAt")
    VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, 'loc-2', NOW(), NOW())
    ON CONFLICT (email) DO UPDATE SET pin = $7, "pinLookup" = $8, "locationId" = 'loc-2'
  `, ['filiala-admin', 'Filiala Admin', 'filiala-admin@e2e.test', '', 'admin', 'active', fpinHash, fpinLookup])
  await pg.query(`
    INSERT INTO "EmployeeJob" (id, "employeeId", "jobId", "createdAt", "updatedAt")
    VALUES ($1, $2, $3, NOW(), NOW())
    ON CONFLICT DO NOTHING
  `, ['ej-filiala', 'filiala-admin', 'job-admin'])
  console.log('[seed] ✅ filiala-admin (PIN 2222, loc-2) seedan')

// ═══ R92 FIX: MODEL A E2E fixture ids (mg-loc-1/2-1, sc-loc-1/2-1,
// do-loc-1/2-dinein) — MODELA-9..16 jih referencirajo; stari seed jih je
// izgubil. Vse per-lokacijo (MODEL A NOT NULL locationId). ═══
await pg.query(`INSERT INTO "ModifierGroup" (id, name, "minSelect", "maxSelect", "sortOrder", "locationId", "createdAt", "updatedAt") VALUES ('mg-loc-1-1','E2E Priloge loc-1',0,2,0,'loc-1',NOW(),NOW()) ON CONFLICT (id) DO NOTHING`)
await pg.query(`INSERT INTO "ModifierGroup" (id, name, "minSelect", "maxSelect", "sortOrder", "locationId", "createdAt", "updatedAt") VALUES ('mg-loc-2-1','E2E Priloge loc-2',0,2,0,'loc-2',NOW(),NOW()) ON CONFLICT (id) DO NOTHING`)
await pg.query(`INSERT INTO "Modifier" (id, name, price, "isAvailable", "sortOrder", "modifierGroupId", "createdAt", "updatedAt") VALUES ('mod-loc-1-1','Ketchup',0.5,true,0,'mg-loc-1-1',NOW(),NOW()) ON CONFLICT (id) DO NOTHING`)
console.log('[seed] ✅ MODEL A fixture: ModifierGroups (mg-loc-1/2-1) seedani')
await pg.query(`INSERT INTO "ServiceCharge" (id, name, type, amount, "isAutoApply", "isActive", "sortOrder", "locationId", "createdAt", "updatedAt") VALUES ('sc-loc-1-1','Servisna postavka loc-1','percentage',10,false,true,0,'loc-1',NOW(),NOW()) ON CONFLICT (id) DO NOTHING`)
await pg.query(`INSERT INTO "ServiceCharge" (id, name, type, amount, "isAutoApply", "isActive", "sortOrder", "locationId", "createdAt", "updatedAt") VALUES ('sc-loc-2-1','Servisna postavka loc-2','percentage',10,false,true,0,'loc-2',NOW(),NOW()) ON CONFLICT (id) DO NOTHING`)
console.log('[seed] ✅ MODEL A fixture: ServiceCharges (sc-loc-1/2-1) seedani')
await pg.query(`INSERT INTO "DiningOption" (id, name, type, "prepTimeMinutes", "isActive", "sortOrder", "locationId", "createdAt", "updatedAt") VALUES ('do-loc-1-dinein','Na mestu HQ','e2e-dinein-1',15,true,0,'loc-1',NOW(),NOW()) ON CONFLICT (id) DO NOTHING`)
await pg.query(`INSERT INTO "DiningOption" (id, name, type, "prepTimeMinutes", "isActive", "sortOrder", "locationId", "createdAt", "updatedAt") VALUES ('do-loc-2-dinein','Na mestu Filiala','e2e-dinein-2',15,true,0,'loc-2',NOW(),NOW()) ON CONFLICT (id) DO NOTHING`)
console.log('[seed] ✅ MODEL A fixture: DiningOptions (do-loc-1/2-dinein) seedani')

// ═══ R92 FIX dopolnilo: per-lokacijski TaxRate + VoidReason fixture ids
// (tr-loc-1/2-S, vr-loc-1/2-1) — MODELA-3 jih pin-a; spec je predpostavljal
// bogatejši seed kot ga je init-e2e-db imel. Idempotentno. ═══
for (const [tid, name, rate, code, loc] of [
  ['tr-loc-1-S', 'DDV 22 loc-1', 22.0, 'S', 'loc-1'],
  ['tr-loc-1-R', 'DDV 9.5 loc-1', 9.5, 'R', 'loc-1'],
  ['tr-loc-2-S', 'DDV 22 loc-2', 22.0, 'S', 'loc-2'],
  ['tr-loc-2-R', 'DDV 9.5 loc-2', 9.5, 'R', 'loc-2'],
]) {
  await pg.query(`INSERT INTO "TaxRate" (id, name, rate, code, "isActive", "sortOrder", "locationId", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,true,0,$5,NOW(),NOW()) ON CONFLICT (id) DO NOTHING`, [tid, name, rate, code, loc])
}
await pg.query(`INSERT INTO "VoidReason" (id, name, "isActive", "sortOrder", "locationId", "createdAt", "updatedAt") VALUES ('vr-loc-1-1','Test razlog loc-1',true,0,'loc-1',NOW(),NOW()) ON CONFLICT (id) DO NOTHING`)
await pg.query(`INSERT INTO "VoidReason" (id, name, "isActive", "sortOrder", "locationId", "createdAt", "updatedAt") VALUES ('vr-loc-2-1','Test razlog loc-2',true,0,'loc-2',NOW(),NOW()) ON CONFLICT (id) DO NOTHING`)
console.log('[init] ✅ MODEL A fixture: TaxRates (tr-loc-*) + VoidReasons (vr-loc-*) seedani')


}


// 6c. Inventar + recepte (E2E "verify inventory" — mi-1/mi-4 → inv-kava, mi-5 → inv-burger)
await pg.query(`
  INSERT INTO "InventoryItem" (id, name, description, unit, quantity, "minQuantity", "costPerUnit", supplier, category, "location", "servingsPerUnit", "costPerServing", "lastRestocked", "createdAt", "updatedAt")
  VALUES ($1, $2, 'E2E testna zaloga', 'kos', 100, 10, 5.0, 'E2E dobavitelj', 'general', 'main', 1, 5.0, NOW(), NOW(), NOW())
  ON CONFLICT (id) DO NOTHING
`, ['inv-kava', 'E2E Kava zrnje'])
await pg.query(`
  INSERT INTO "InventoryItem" (id, name, description, unit, quantity, "minQuantity", "costPerUnit", supplier, category, "location", "servingsPerUnit", "costPerServing", "lastRestocked", "createdAt", "updatedAt")
  VALUES ($1, $2, 'E2E testna zaloga', 'kos', 50, 5, 3.0, 'E2E dobavitelj', 'general', 'main', 1, 3.0, NOW(), NOW(), NOW())
  ON CONFLICT (id) DO NOTHING
`, ['inv-burger', 'E2E Burger meso'])
await pg.query(`INSERT INTO "RecipeItem" (id, "menuItemId", "inventoryItemId", "quantityPerServing", unit, "createdAt", "updatedAt") VALUES ($1,$2,$3,1,'kos',NOW(),NOW()) ON CONFLICT ("menuItemId", "inventoryItemId") DO NOTHING`, ['recipe-kava-1', 'mi-1', 'inv-kava'])
await pg.query(`INSERT INTO "RecipeItem" (id, "menuItemId", "inventoryItemId", "quantityPerServing", unit, "createdAt", "updatedAt") VALUES ($1,$2,$3,1,'kos',NOW(),NOW()) ON CONFLICT ("menuItemId", "inventoryItemId") DO NOTHING`, ['recipe-kava-4', 'mi-4', 'inv-kava'])
await pg.query(`INSERT INTO "RecipeItem" (id, "menuItemId", "inventoryItemId", "quantityPerServing", unit, "createdAt", "updatedAt") VALUES ($1,$2,$3,1,'kos',NOW(),NOW()) ON CONFLICT ("menuItemId", "inventoryItemId") DO NOTHING`, ['recipe-burger-5', 'mi-5', 'inv-burger'])
console.log('[seed] ✅ Inventar + recepte seedani (E2E verify inventory)')

// 7. Counters
for (const [id, name] of [['c-rcpt', 'receiptNumber'], ['c-ord', 'orderNumber']]) {
  await pg.query(`INSERT INTO "Counter" (id, name, value) VALUES ($1,$2,0) ON CONFLICT (name) DO NOTHING`, [id, name])
}
console.log('[seed] ✅ Counterji seedani')

// 8. DiningOptions — R92 fix: MODEL A (per-lokacija, NOT NULL locationId;
// @@unique([type]) je bil zamenjan z @@unique([type, locationId]) — ON
// CONFLICT (type) ne obstaja več). Seedaj za loc-1, konflikt po (type, locationId).
for (const [id, name, type] of [['do-1', 'Na mestu', 'dine-in'], ['do-2', 'Vzemi s seboj', 'takeout']]) {
  await pg.query(`INSERT INTO "DiningOption" (id, name, type, "prepTimeMinutes", "isActive", "sortOrder", "locationId", "createdAt", "updatedAt") VALUES ($1,$2,$3,15,true,0,'loc-1',NOW(),NOW()) ON CONFLICT (type, "locationId") DO NOTHING`, [id, name, type])
}
console.log('[seed] ✅ DiningOptions seedani (loc-1, MODEL A)')

// 9. VoidReason — R92 fix: locationId NOT NULL (MODEL A per-lokacija)
await pg.query(`INSERT INTO "VoidReason" (id, name, "isActive", "sortOrder", "locationId", "createdAt", "updatedAt") VALUES ($1,$2,true,0,'loc-1',NOW(),NOW()) ON CONFLICT DO NOTHING`, ['vr-1', 'Test razlog'])

// 10. NoSaleReason — R92 fix: locationId NOT NULL (MODEL A per-lokacija)
await pg.query(`INSERT INTO "NoSaleReason" (id, name, "isActive", "sortOrder", "locationId", "createdAt", "updatedAt") VALUES ($1,$2,true,0,'loc-1',NOW(),NOW()) ON CONFLICT DO NOTHING`, ['nsr-1', 'Mali dvig'])

// 11. PrepStation — R92 fix: locationId NOT NULL (MODEL A per-lokacija)
await pg.query(`INSERT INTO "PrepStation" (id, name, type, "avgPrepTime", "isActive", "sortOrder", "locationId", "createdAt", "updatedAt") VALUES ($1,$2,$3,15,true,0,'loc-1',NOW(),NOW()) ON CONFLICT DO NOTHING`, ['ps-1', 'Kuhinja', 'kitchen'])
await pg.query(`INSERT INTO "PrepStation" (id, name, type, "avgPrepTime", "isActive", "sortOrder", "locationId", "createdAt", "updatedAt") VALUES ($1,$2,$3,5,true,1,'loc-1',NOW(),NOW()) ON CONFLICT DO NOTHING`, ['ps-2', 'Bar', 'bar'])

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
