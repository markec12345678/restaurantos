// Top-up za kiosk/display/driver e2e (R135 lekcija — shranjeno kot skripta,
// da se po resetu baze ne rekonstruiraga ad hoc SQL):
//   1. lokacija 'loc-1' (krši kiosk regex /^[a-z0-9]{5,50}$/ — vezaj) →
//      preimenovana v 'locKioskA' (UPDATE PK — FK cascade posodobi vse vrstice)
//   2. OpeningHours 7 dni (isRestaurantOpen fail-closed → 403 brez)
//   3. MenuItemModifierGroup veznik mi-1 → mg-loc-1-1 (Ketchup dialog na kiosku)
// Uporaba: PGLITE_DATA_DIR=/tmp/pglite-data node scripts/topup-kiosk-e2e.mjs
// Idempotenten (ON CONFLICT DO NOTHING / WHERE NOT EXISTS).
import { PGlite } from '@electric-sql/pglite'

const dataDir = process.env.PGLITE_DATA_DIR || '/tmp/pglite-data'
const pg = new PGlite(dataDir)

// 1. Preimenovanje lokacije (samo če stara obstaja, nova ne)
const old = await pg.query(`SELECT id FROM "Location" WHERE id = 'loc-1'`)
if (old.rows.length > 0) {
  const fresh = await pg.query(`SELECT id FROM "Location" WHERE id = 'locKioskA'`)
  if (fresh.rows.length === 0) {
    await pg.query(`UPDATE "Location" SET id = 'locKioskA' WHERE id = 'loc-1'`)
    console.log('[topup] Location loc-1 → locKioskA')
  }
}

// 2. OpeningHours 7 dni (08:00–22:00)
for (let day = 0; day <= 6; day++) {
  await pg.query(
    `INSERT INTO "OpeningHours" (id, "dayOfWeek", "openTime", "closeTime", "isClosed", "locationId", "createdAt", "updatedAt")
     SELECT 'oh-kiosk-' || $1, $1::int, '08:00', '22:00', false, 'locKioskA', NOW(), NOW()
     WHERE NOT EXISTS (SELECT 1 FROM "OpeningHours" WHERE "dayOfWeek" = $1::int AND "locationId" = 'locKioskA')`,
    [day],
  )
}
console.log('[topup] OpeningHours: 7 dni (locKioskA)')

// 3. Veznik artikel ↔ modifier skupina (Ketchup na Test Kava)
await pg.query(
  `INSERT INTO "MenuItemModifierGroup" (id, "menuItemId", "modifierGroupId")
   VALUES ('mimg-mi-1-mg-loc-1-1', 'mi-1', 'mg-loc-1-1') ON CONFLICT (id) DO NOTHING`,
)
console.log('[topup] MenuItemModifierGroup: mi-1 ↔ mg-loc-1-1')

const check = await pg.query(`
  SELECT
    (SELECT count(*) FROM "OpeningHours" WHERE "locationId" = 'locKioskA') AS hours,
    (SELECT count(*) FROM "MenuItemModifierGroup" WHERE "menuItemId" = 'mi-1') AS links,
    (SELECT count(*) FROM information_schema.columns WHERE table_name = 'DeliveryTracking'
      AND column_name IN ('driverEmployeeId', 'podNotes')) AS driver_cols
`)
console.log('[topup] Stanje:', check.rows[0])

await pg.close()
console.log('[topup] 🎉 Kiosk e2e top-up končan')
