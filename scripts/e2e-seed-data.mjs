// ═════════════════════════════════════════════════════════════════════
// R94-b — ENA VIR RESNICE za E2E seed fixture-e (R92 MODEL A set)
// ═════════════════════════════════════════════════════════════════════
// Zgodovina: R92 je fixture set (MODEL A: test-admin PIN 1111, filiala-admin
// PIN 2222 @ loc-2, job-admin, tr-loc-*/vr-loc-*/mg-loc-*/sc-loc-*/do-loc-*,
// e2e-dinein-1/2 unikatni tipi, menu/menu-2, table-1/2, ...) podvajal v DVEH
// skriptah (seed-e2e-pglite.mjs za PGlite + e2e-seed.mjs za realni PG) —
// e2e-seed.mjs je zastarel (pred R92 prenovou) in mu je manjkalo večino
// MODEL A fixture-ov. R93 e2e CI run je poleg tega pokazal, da PGlite pod
// e2e obremenitvijo ustvari več WASM instanc na isti dataDir (single-instance-
// per-dataDir krši) → CI prehaja na REALNI PostgreSQL; PGlite ostane lokalna
// razvojna pot.
//
// Ta modul je EDIRNI vir fixture SQL-a: `seedE2eData(executor, ctx)` teče na
// OBEH bazi, ker je PGlite pravi postgres (isti raw SQL, pozicijski parametri
// $1..$n, standardni INSERT ... ON CONFLICT, NOW()). Brez PGlite-specifičnih
// razširitev ali dialekta. Dva izvajalca (tanek wrapper vsak):
//   - scripts/seed-e2e-pglite.mjs → PGlite (lokalno):  run = (sql, p) => pg.query(sql, p)
//   - scripts/e2e-seed.mjs        → realni PG (CI):    run = (sql, p) => db.$executeRawUnsafe(sql, ...p)
//
// Kontrakt:
//   executor = { run(sql, params?) }  — vsak stavek posebej; params = polje
//     pozicijskih parametrov ALI undefined (stavki z inline literali).
//     Vrne se Promise; INSERT stavki ne rabijo rezultata. VSI stavki so
//     INSERT ... ON CONFLICT (idempotentni) — $executeRawUnsafe-ov
//     affected-count je zadosten; modul ne vsebuje read-stavkov, zato so
//     vsote/vrstice vedno wrapper-lastne (pg.query oz. $queryRawUnsafe).
//   ctx = { nextAuthSecret } — PIN lookup = HMAC-SHA256(secret, pin) (kanon
//     obeh obstoječih skript); PIN hash = bcrypt rounds 10.
//
// Stavki so prenešeni 1:1 iz seed-e2e-pglite.mjs (isti SQL, isti vrstni red
// parametrov, isti ON CONFLICT cilji, isti id-ji). Fixture-i, unikatni za
// stari e2e-seed.mjs (Prisma-upsert zgodovinska datoteka), so PORTIRANI:
//   - tr-loc-1-Z / tr-loc-2-Z (koda 'Z', 0.0 %) — označeni spodaj.
//   - modifierja 'Ekstra sir' (1.5) na mg-loc-1-1 IN mg-loc-2-1 — iz
//     Prisma nested create (auto-cuid id) pretvorjena v eksplicitno
//     stabilna id-ja mod-loc-1-2 / mod-loc-2-2 (raw SQL ne generira cuid).
//   - NE-portirani: do-loc-*-takeout (tip 'takeout') — strukturno ne-portabilni:
//     @@unique([type, locationId]) jih trka z pinned do-2 ('takeout', loc-1)
//     iz MODEL A seta (na loc-1 si slot delita, oba id-ja ne moreta obstajati);
//     nič jih ne referencira (rg čez tests/ = prazno), vlogo je prevzel
//     R92 par z unikatnima tipoma e2e-dinein-1/2. Glej worklog R94-b.
// ═════════════════════════════════════════════════════════════════════
import bcrypt from 'bcryptjs'
import { createHmac, randomUUID } from 'crypto'

export async function seedE2eData(executor, ctx) {
  if (!ctx || !ctx.nextAuthSecret) {
    throw new Error('[seed] ctx.nextAuthSecret manjka — PIN lookup bi bil napačen (fail-closed)')
  }
  const NEXTAUTH_SECRET = ctx.nextAuthSecret
  const run = (sql, params) => executor.run(sql, params)

  // 1. Admin uporabnik z PIN 1111
  const pin = '1111'
  const pinHash = await bcrypt.hash(pin, 10)
  const pinLookup = createHmac('sha256', NEXTAUTH_SECRET).update(pin).digest('hex')

  await run(`
  INSERT INTO "Employee" (id, name, email, phone, role, status, "hireDate", pin, "pinLookup", "createdAt", "updatedAt")
  VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, NOW(), NOW())
  ON CONFLICT (email) DO UPDATE SET pin = $7, "pinLookup" = $8
`, ['test-admin', 'Test Admin', 'admin@e2e.test', '', 'admin', 'active', pinHash, pinLookup])
  console.log('[seed] ✅ Admin (PIN 1111) seedan')

  // 2. Job z admin dovoljenji
  await run(`
  INSERT INTO "Job" (id, name, code, "basePayRate", "overtimeRate", permissions, "isActive", "sortOrder", "createdAt", "updatedAt")
  VALUES ($1, $2, $3, 0, 0, $4, true, 0, NOW(), NOW())
  ON CONFLICT (name) DO NOTHING
`, ['job-admin', 'Administrator', 'ADMIN', JSON.stringify(['take_orders','void_item','apply_discounts','manage_cash','manage_inventory','manage_employees','view_reports','admin'])])

  await run(`
  INSERT INTO "EmployeeJob" (id, "employeeId", "jobId", "createdAt", "updatedAt")
  VALUES ($1, $2, $3, NOW(), NOW())
  ON CONFLICT DO NOTHING
`, ['ej-1', 'test-admin', 'job-admin'])
  console.log('[seed] ✅ Job + EmployeeJob seedan')

  // 3. RestaurantSettings
  await run(`
  INSERT INTO "RestaurantSettings" (id, name, address, "postCode", city, "businessId", "taxId", "registerNumber", "fursEnvironment", "isActive", "createdAt", "updatedAt")
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW(), NOW())
  ON CONFLICT DO NOTHING
`, ['rs-1', 'Test Restaurant', 'Testna 1', '1000', 'Ljubljana', '12345678', 'SI12345678', 'TEST01', 'test'])
  console.log('[seed] ✅ RestaurantSettings seedan')

  // 3b. Location (potreben za setup status check)
  //     P0-C4 loyalty/email polji prihajata iz shemskih defaultov (false/1/0.01/
  //     '[]'/false) — enako vrsticam kot prejšnji eksplicitni INSERT init-e2e-db.
  await run(`
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
  await run(`INSERT INTO "Menu" (id, name, icon, color, "sortOrder", "isActive", "locationId", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,0,true,$5,NOW(),NOW()) ON CONFLICT (id) DO UPDATE SET "locationId" = $5`, ['menu-1', 'Test Menu', '🍽️', '#f59e0b', 'loc-1'])
  await run(`INSERT INTO "Category" (id, name, icon, color, "sortOrder", "menuId", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,0,$5,NOW(),NOW()) ON CONFLICT (id) DO NOTHING`, ['cat-1', 'Test Kategorija', '🍽️', '#f59e0b', 'menu-1'])

  for (const [id, name, price, vat] of [
    ['mi-1', 'Test Kava', 1.50, 22.0],
    ['mi-2', 'Test Pizza', 8.90, 9.5],
    ['mi-3', 'Test Solata', 5.50, 9.5],
  ]) {
    await run(`INSERT INTO "MenuItem" (id, name, description, price, image, "isAvailable", "sortOrder", "vatRate", "categoryId", "createdAt", "updatedAt") VALUES ($1,$2,'',$3,'',true,0,$4,$5,NOW(),NOW()) ON CONFLICT (id) DO NOTHING`, [id, name, price, vat, 'cat-1'])
  }
  console.log('[seed] ✅ Menu, Category, 3 artikli seedani')

  // 6. Table
  // FIX P0-C3B: Table mora imeti locationId (mize so fizično na lokaciji)
  await run(`INSERT INTO "Table" (id, number, capacity, status, area, "posX", "posY", width, height, shape, rotation, "locationId", "createdAt", "updatedAt") VALUES ($1,1,4,'available','main',10,10,8,10,'round',0,$2,NOW(),NOW()) ON CONFLICT (id) DO UPDATE SET "locationId" = $2`, ['table-1', 'loc-1'])
  console.log('[seed] ✅ Miza 1 seedana')

  // 6b. E2E VARIANTE: druga lokacija + meni + miza + inventar z receptami
  //   (skladno z scripts/init-e2e-db.mjs — isti ID-ji)
  //   FIX: premisesId je UNIQUE z default '' — loc-2 MORA imeti svojega
  await run(`
  INSERT INTO "Location" (id, name, code, type, address, city, "postCode", country, phone, email, "businessId", "taxId", "registerNumber", "premisesId", "fursEnvironment", timezone, currency, locale, "isOpen", "isActive", "createdAt", "updatedAt")
  VALUES ($1, $2, $3, $4, $5, $6, $7, 'SI', $8, $9, $10, $11, $12, 'PREM-TEST02', 'test', 'Europe/Ljubljana', 'EUR', 'sl-SI', true, true, NOW(), NOW())
  ON CONFLICT (code) DO NOTHING
`, ['loc-2', 'Test Filiala', 'FIL2', 'restaurant', 'Filialna 2', 'Maribor', '2000', '+386 2 345 6789', 'filiala@test.si', '87654321', 'SI87654321', 'TEST02'])
  await run(`INSERT INTO "Menu" (id, name, icon, color, "sortOrder", "isActive", "locationId", "createdAt", "updatedAt") VALUES ($1,$2,'🍽️','#0ea5e9',0,true,$3,NOW(),NOW()) ON CONFLICT (id) DO UPDATE SET "locationId" = $3`, ['menu-2', 'Test Menu Filiala', 'loc-2'])
  await run(`INSERT INTO "Category" (id, name, icon, color, "sortOrder", "menuId", "createdAt", "updatedAt") VALUES ($1,$2,'🍽️','#0ea5e9',0,$3,NOW(),NOW()) ON CONFLICT (id) DO NOTHING`, ['cat-2', 'Test Kategorija Filiala', 'menu-2'])
  for (const [id, name, price, vat] of [
    ['mi-4', 'Test Kava Filiala', 1.70, 22.0],
    ['mi-5', 'Test Burger Filiala', 9.90, 9.5],
  ]) {
    await run(`INSERT INTO "MenuItem" (id, name, description, price, image, "isAvailable", "sortOrder", "vatRate", "categoryId", "createdAt", "updatedAt") VALUES ($1,$2,'',$3,'',true,0,$4,$5,NOW(),NOW()) ON CONFLICT (id) DO NOTHING`, [id, name, price, vat, 'cat-2'])
  }
  await run(`INSERT INTO "Table" (id, number, capacity, status, area, "posX", "posY", width, height, shape, rotation, "locationId", "createdAt", "updatedAt") VALUES ($1,1,4,'available','main',20,10,8,10,'square',0,$2,NOW(),NOW()) ON CONFLICT (id) DO UPDATE SET "locationId" = $2`, ['table-2', 'loc-2'])
  console.log('[seed] ✅ Lokacija 2 + menu-2 + miza 2 seedani (E2E dve lokaciji)')

  // R92 FIX: filiala-admin (PIN 2222, loc-2) — MODEL A E2E describe (multi-tenant-
  // security.spec.ts MODELA-*) prijavlja 'filiala-admin'/'2222'; seed je dotlej
  // manjal → beforeAll login fail → 13 testov 'did not run'. Employee.locationId
  // = session lokacija (tenant-scope kanon R85+).
  {
    const fpin = '2222'
    const fpinHash = await bcrypt.hash(fpin, 10)
    const fpinLookup = createHmac('sha256', NEXTAUTH_SECRET).update(fpin).digest('hex')
    await run(`
    INSERT INTO "Employee" (id, name, email, phone, role, status, "hireDate", pin, "pinLookup", "locationId", "createdAt", "updatedAt")
    VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, 'loc-2', NOW(), NOW())
    ON CONFLICT (email) DO UPDATE SET pin = $7, "pinLookup" = $8, "locationId" = 'loc-2'
  `, ['filiala-admin', 'Filiala Admin', 'filiala-admin@e2e.test', '', 'admin', 'active', fpinHash, fpinLookup])
    await run(`
    INSERT INTO "EmployeeJob" (id, "employeeId", "jobId", "createdAt", "updatedAt")
    VALUES ($1, $2, $3, NOW(), NOW())
    ON CONFLICT DO NOTHING
  `, ['ej-filiala', 'filiala-admin', 'job-admin'])
    console.log('[seed] ✅ filiala-admin (PIN 2222, loc-2) seedan')

  // ═══ R92 FIX: MODEL A E2E fixture ids (mg-loc-1/2-1, sc-loc-1/2-1,
  // do-loc-1/2-dinein) — MODELA-9..16 jih referencirajo; stari seed jih je
  // izgubil. Vse per-lokacijo (MODEL A NOT NULL locationId). ═══
  await run(`INSERT INTO "ModifierGroup" (id, name, "minSelect", "maxSelect", "sortOrder", "locationId", "createdAt", "updatedAt") VALUES ('mg-loc-1-1','E2E Priloge loc-1',0,2,0,'loc-1',NOW(),NOW()) ON CONFLICT (id) DO NOTHING`)
  await run(`INSERT INTO "ModifierGroup" (id, name, "minSelect", "maxSelect", "sortOrder", "locationId", "createdAt", "updatedAt") VALUES ('mg-loc-2-1','E2E Priloge loc-2',0,2,0,'loc-2',NOW(),NOW()) ON CONFLICT (id) DO NOTHING`)
  await run(`INSERT INTO "Modifier" (id, name, price, "isAvailable", "sortOrder", "modifierGroupId", "createdAt", "updatedAt") VALUES ('mod-loc-1-1','Ketchup',0.5,true,0,'mg-loc-1-1',NOW(),NOW()) ON CONFLICT (id) DO NOTHING`)
  // R94-b PORT (iz starega e2e-seed.mjs Prisma nested create): 'Ekstra sir' 1.5
  // na OBEH skupinah; iz auto-cuid → eksplicitna stabilna id-ja (idempotentno).
  await run(`INSERT INTO "Modifier" (id, name, price, "isAvailable", "sortOrder", "modifierGroupId", "createdAt", "updatedAt") VALUES ('mod-loc-1-2','Ekstra sir',1.5,true,0,'mg-loc-1-1',NOW(),NOW()) ON CONFLICT (id) DO NOTHING`)
  await run(`INSERT INTO "Modifier" (id, name, price, "isAvailable", "sortOrder", "modifierGroupId", "createdAt", "updatedAt") VALUES ('mod-loc-2-2','Ekstra sir',1.5,true,0,'mg-loc-2-1',NOW(),NOW()) ON CONFLICT (id) DO NOTHING`)
  console.log('[seed] ✅ MODEL A fixture: ModifierGroups (mg-loc-1/2-1) seedani')
  await run(`INSERT INTO "ServiceCharge" (id, name, type, amount, "isAutoApply", "isActive", "sortOrder", "locationId", "createdAt", "updatedAt") VALUES ('sc-loc-1-1','Servisna postavka loc-1','percentage',10,false,true,0,'loc-1',NOW(),NOW()) ON CONFLICT (id) DO NOTHING`)
  await run(`INSERT INTO "ServiceCharge" (id, name, type, amount, "isAutoApply", "isActive", "sortOrder", "locationId", "createdAt", "updatedAt") VALUES ('sc-loc-2-1','Servisna postavka loc-2','percentage',10,false,true,0,'loc-2',NOW(),NOW()) ON CONFLICT (id) DO NOTHING`)
  console.log('[seed] ✅ MODEL A fixture: ServiceCharges (sc-loc-1/2-1) seedani')
  await run(`INSERT INTO "DiningOption" (id, name, type, "prepTimeMinutes", "isActive", "sortOrder", "locationId", "createdAt", "updatedAt") VALUES ('do-loc-1-dinein','Na mestu HQ','e2e-dinein-1',15,true,0,'loc-1',NOW(),NOW()) ON CONFLICT (id) DO NOTHING`)
  await run(`INSERT INTO "DiningOption" (id, name, type, "prepTimeMinutes", "isActive", "sortOrder", "locationId", "createdAt", "updatedAt") VALUES ('do-loc-2-dinein','Na mestu Filiala','e2e-dinein-2',15,true,0,'loc-2',NOW(),NOW()) ON CONFLICT (id) DO NOTHING`)
  console.log('[seed] ✅ MODEL A fixture: DiningOptions (do-loc-1/2-dinein) seedani')

  // ═══ R92 FIX dopolnilo: per-lokacijski TaxRate + VoidReason fixture ids
  // (tr-loc-1/2-S, vr-loc-1/2-1) — MODELA-3 jih pin-a; spec je predpostavljal
  // bogatejši seed kot ga je init-e2e-db imel. Idempotentno. ═══
  // R94-b PORT: vrstici Z (Oproščeno 0 %) iz starega e2e-seed.mjs (spec MODELA-3
  // komentar: "loc-2 ima S/R/Z"); S/R imena ostanejo MODEL A (1:1 iz PGlite seta).
  for (const [tid, name, rate, code, loc] of [
    ['tr-loc-1-S', 'DDV 22 loc-1', 22.0, 'S', 'loc-1'],
    ['tr-loc-1-R', 'DDV 9.5 loc-1', 9.5, 'R', 'loc-1'],
    ['tr-loc-1-Z', 'Oproščeno 0%', 0.0, 'Z', 'loc-1'],
    ['tr-loc-2-S', 'DDV 22 loc-2', 22.0, 'S', 'loc-2'],
    ['tr-loc-2-R', 'DDV 9.5 loc-2', 9.5, 'R', 'loc-2'],
    ['tr-loc-2-Z', 'Oproščeno 0%', 0.0, 'Z', 'loc-2'],
  ]) {
    await run(`INSERT INTO "TaxRate" (id, name, rate, code, "isActive", "sortOrder", "locationId", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,true,0,$5,NOW(),NOW()) ON CONFLICT (id) DO NOTHING`, [tid, name, rate, code, loc])
  }
  await run(`INSERT INTO "VoidReason" (id, name, "isActive", "sortOrder", "locationId", "createdAt", "updatedAt") VALUES ('vr-loc-1-1','Test razlog loc-1',true,0,'loc-1',NOW(),NOW()) ON CONFLICT (id) DO NOTHING`)
  await run(`INSERT INTO "VoidReason" (id, name, "isActive", "sortOrder", "locationId", "createdAt", "updatedAt") VALUES ('vr-loc-2-1','Test razlog loc-2',true,0,'loc-2',NOW(),NOW()) ON CONFLICT (id) DO NOTHING`)
  console.log('[seed] ✅ MODEL A fixture: TaxRates (tr-loc-*) + VoidReasons (vr-loc-*) seedani')


  }

  // 6c. Inventar + recepte (E2E "verify inventory" — mi-1/mi-4 → inv-kava, mi-5 → inv-burger)
  await run(`
  INSERT INTO "InventoryItem" (id, name, description, unit, quantity, "minQuantity", "costPerUnit", supplier, category, "location", "servingsPerUnit", "costPerServing", "lastRestocked", "createdAt", "updatedAt")
  VALUES ($1, $2, 'E2E testna zaloga', 'kos', 100, 10, 5.0, 'E2E dobavitelj', 'general', 'main', 1, 5.0, NOW(), NOW(), NOW())
  ON CONFLICT (id) DO NOTHING
`, ['inv-kava', 'E2E Kava zrnje'])
  await run(`
  INSERT INTO "InventoryItem" (id, name, description, unit, quantity, "minQuantity", "costPerUnit", supplier, category, "location", "servingsPerUnit", "costPerServing", "lastRestocked", "createdAt", "updatedAt")
  VALUES ($1, $2, 'E2E testna zaloga', 'kos', 50, 5, 3.0, 'E2E dobavitelj', 'general', 'main', 1, 3.0, NOW(), NOW(), NOW())
  ON CONFLICT (id) DO NOTHING
`, ['inv-burger', 'E2E Burger meso'])
  await run(`INSERT INTO "RecipeItem" (id, "menuItemId", "inventoryItemId", "quantityPerServing", unit, "createdAt", "updatedAt") VALUES ($1,$2,$3,1,'kos',NOW(),NOW()) ON CONFLICT ("menuItemId", "inventoryItemId") DO NOTHING`, ['recipe-kava-1', 'mi-1', 'inv-kava'])
  await run(`INSERT INTO "RecipeItem" (id, "menuItemId", "inventoryItemId", "quantityPerServing", unit, "createdAt", "updatedAt") VALUES ($1,$2,$3,1,'kos',NOW(),NOW()) ON CONFLICT ("menuItemId", "inventoryItemId") DO NOTHING`, ['recipe-kava-4', 'mi-4', 'inv-kava'])
  await run(`INSERT INTO "RecipeItem" (id, "menuItemId", "inventoryItemId", "quantityPerServing", unit, "createdAt", "updatedAt") VALUES ($1,$2,$3,1,'kos',NOW(),NOW()) ON CONFLICT ("menuItemId", "inventoryItemId") DO NOTHING`, ['recipe-burger-5', 'mi-5', 'inv-burger'])
  console.log('[seed] ✅ Inventar + recepte seedani (E2E verify inventory)')

  // 7. Counters
  for (const [id, name] of [['c-rcpt', 'receiptNumber'], ['c-ord', 'orderNumber']]) {
    await run(`INSERT INTO "Counter" (id, name, value) VALUES ($1,$2,0) ON CONFLICT (name) DO NOTHING`, [id, name])
  }
  console.log('[seed] ✅ Counterji seedani')

  // 8. DiningOptions — R92 fix: MODEL A (per-lokacija, NOT NULL locationId;
  // @@unique([type]) je bil zamenjan z @@unique([type, locationId]) — ON
  // CONFLICT (type) ne obstaja več). Seedaj za loc-1, konflikt po (type, locationId).
  for (const [id, name, type] of [['do-1', 'Na mestu', 'dine-in'], ['do-2', 'Vzemi s seboj', 'takeout']]) {
    await run(`INSERT INTO "DiningOption" (id, name, type, "prepTimeMinutes", "isActive", "sortOrder", "locationId", "createdAt", "updatedAt") VALUES ($1,$2,$3,15,true,0,'loc-1',NOW(),NOW()) ON CONFLICT (type, "locationId") DO NOTHING`, [id, name, type])
  }
  console.log('[seed] ✅ DiningOptions seedani (loc-1, MODEL A)')

  // 9. VoidReason — R92 fix: locationId NOT NULL (MODEL A per-lokacija)
  await run(`INSERT INTO "VoidReason" (id, name, "isActive", "sortOrder", "locationId", "createdAt", "updatedAt") VALUES ($1,$2,true,0,'loc-1',NOW(),NOW()) ON CONFLICT DO NOTHING`, ['vr-1', 'Test razlog'])

  // 10. NoSaleReason — R92 fix: locationId NOT NULL (MODEL A per-lokacija)
  await run(`INSERT INTO "NoSaleReason" (id, name, "isActive", "sortOrder", "locationId", "createdAt", "updatedAt") VALUES ($1,$2,true,0,'loc-1',NOW(),NOW()) ON CONFLICT DO NOTHING`, ['nsr-1', 'Mali dvig'])

  // 11. PrepStation — R92 fix: locationId NOT NULL (MODEL A per-lokacija)
  await run(`INSERT INTO "PrepStation" (id, name, type, "avgPrepTime", "isActive", "sortOrder", "locationId", "createdAt", "updatedAt") VALUES ($1,$2,$3,15,true,0,'loc-1',NOW(),NOW()) ON CONFLICT DO NOTHING`, ['ps-1', 'Kuhinja', 'kitchen'])
  await run(`INSERT INTO "PrepStation" (id, name, type, "avgPrepTime", "isActive", "sortOrder", "locationId", "createdAt", "updatedAt") VALUES ($1,$2,$3,5,true,1,'loc-1',NOW(),NOW()) ON CONFLICT DO NOTHING`, ['ps-2', 'Bar', 'bar'])

  // 12. ChartOfAccount (SKM 2006) — id-ji generirani JS-side (crypto.randomUUID),
  //     idempotentno po (code) — prenosljivo na obe bazi brez pgcrypto razširitve.
  for (const [code, name, type] of [
    ['1010', 'Blagajna', 'asset'],
    ['1000', 'Banka', 'asset'],
    ['2600', 'DDV izhodni', 'liability'],
    ['7000', 'Promet — na mestu', 'revenue'],
    ['7010', 'Promet — s seboj', 'revenue'],
    ['7020', 'Promet — dostava', 'revenue'],
    ['7600', 'Stroški materiala', 'expense'],
  ]) {
    await run(`INSERT INTO "ChartOfAccount" (id, code, name, "accountType", "isActive", "sortOrder", description, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,true,0,'',NOW(),NOW()) ON CONFLICT (code) DO NOTHING`, [randomUUID(), code, name, type])
  }
  console.log('[seed] ✅ ChartOfAccount seedan (7 kontov)')
}
