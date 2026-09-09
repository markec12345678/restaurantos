-- ══════════════════════════════════════════════════════════════════════
-- 0002_p1_hardening — P1-6/7/8 trditve, ki jih schema.prisma NE more
-- izraziti (delni unique indeksi) + FAIL-CLOSED varovalka za obstoječe
-- baze + cleanup legacy globalnih constraintov.
--
-- NADOMESTI scripts/db-sync.mjs DDL (ki je bil del "build" skripte —
-- arhitekturno nevaren: build je lahko delno migriral produkcjsko bazo
-- in napake tiho ignoriral). Migracija je transakcijska: DELNA NAPAKA
-- POVRNE CELO migracijo — deployment se ustavi (ne "warn + nadaljuj").
--
-- VAROVKA (uporabniška zahteva, P1-6): vrstice brez locationId se
-- NIKOLI ne dodelijo "prvi aktivni lokaciji" (pokvarila bi promet,
-- Z-report, FURS, računovodstvo, statistiko, zalogo, revizijsko sled).
-- Namesto tega migracija OBDVOLI in zahteva ROČNO razrešitev:
-- klasifikacija, uvoz iz starega vira, MIGRATION_REVIEW ali izrecna
-- legacy/globalna oznaka.
--
-- Za obstoječe (pre-migracijske) baze:
--   prisma migrate resolve --applied 0001_init   (baseline označitev)
--   nato se TA migracija izvede varno (idempotentne izjave).
-- ══════════════════════════════════════════════════════════════════════

-- ── 1) IZPELJAVA (ne arbitrarna dodelitev!) ──────────────────────────
-- Receipt podeduje lokacijo NAROČILA (fiskalna veriga Order→Receipt).
-- To je podatkovna izpeljava, ne ugibanje. Na svežih bazah (0001 je že
-- NOT NULL) je UPDATE no-op; na legacy bazah počisti ostanke.
UPDATE "Receipt"
SET "locationId" = "o"."locationId"
FROM "Order" "o"
WHERE "Receipt"."orderId" = "o"."id"
  AND "Receipt"."locationId" IS NULL
  AND "o"."locationId" IS NOT NULL;

-- ── 2) FAIL-CLOSED VAROVKA ───────────────────────────────────────────
-- Nerazrešene vrstice BREZ lokacije OBVOLIJO migracijo. NIKOLI
-- samodejna dodelitev prvi lokaciji!
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "Order" WHERE "locationId" IS NULL) > 0 THEN
    RAISE EXCEPTION 'Cannot apply NOT NULL migration: unresolved orders without locationId (%) — razreši ROČNO (klasifikacija / uvoz / MIGRATION_REVIEW / izrecna legacy oznaka); NIKOLI samodejna dodelitev prvi lokaciji',
      (SELECT COUNT(*) FROM "Order" WHERE "locationId" IS NULL);
  END IF;
  IF (SELECT COUNT(*) FROM "Receipt" WHERE "locationId" IS NULL) > 0 THEN
    RAISE EXCEPTION 'Cannot apply NOT NULL migration: unresolved receipts without locationId (%) — razreši ROČNO (klasifikacija / uvoz / MIGRATION_REVIEW / izrecna legacy oznaka); NIKOLI samodejna dodelitev prvi lokaciji',
      (SELECT COUNT(*) FROM "Receipt" WHERE "locationId" IS NULL);
  END IF;
END $$;

-- ── 3) NOT NULL trditve ──────────────────────────────────────────────
-- Na svežih bazah (0001) že veljajo — no-op. Na legacy bazah se ZDAJ
-- (po prehojeni varovalki) utrdijo.
ALTER TABLE "Order" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "Receipt" ALTER COLUMN "locationId" SET NOT NULL;

-- ── 4) Legacy globalni unique constrainti ────────────────────────────
-- P1-7: številčenje je PO LOKACIJI/poslovnem prostoru, ne globalno.
-- Na svežih bazah nikoli niso obstajali (IF EXISTS = no-op); na legacy
-- bazah se odstranijo pred delnimi indeksi.
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_orderNumber_key";
ALTER TABLE "Receipt" DROP CONSTRAINT IF EXISTS "Receipt_receiptNumber_key";
ALTER TABLE "TaxRate" DROP CONSTRAINT IF EXISTS "TaxRate_code_key";
ALTER TABLE "InventoryItem" DROP CONSTRAINT IF EXISTS "InventoryItem_menuItemId_key";
ALTER TABLE "LoyaltyAccount" DROP CONSTRAINT IF EXISTS "LoyaltyAccount_customerPhone_key";

-- ── 5) Delni unique indeksi (Prisma schema jih NE more izraziti) ─────
-- TaxRate: globalne stopnje (locationId NULL) so unikatne MED SABO —
-- schema @@unique([locationId, code]) tega NE pokriva (NULL ≠ NULL v PG)!
CREATE UNIQUE INDEX IF NOT EXISTS "TaxRate_code_global_key"
  ON "TaxRate"("code") WHERE "locationId" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "TaxRate_location_code_key"
  ON "TaxRate"("locationId", "code") WHERE "locationId" IS NOT NULL;
-- InventoryItem: zaloga artikla PO LOKACIJAH (globalne: menuItemId NULL)
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryItem_menuItem_location_key"
  ON "InventoryItem"("menuItemId", "locationId") WHERE "menuItemId" IS NOT NULL;
-- LoyaltyAccount: gost je unikaten PO LOKACIJI (prazni telefoni izpuščeni)
CREATE UNIQUE INDEX IF NOT EXISTS "LoyaltyAccount_phone_location_key"
  ON "LoyaltyAccount"("customerPhone", "locationId")
  WHERE "customerPhone" <> '' AND "locationId" IS NOT NULL;
-- Counter: per-lokacijski števci — indeks za scoped poizvedbe
CREATE INDEX IF NOT EXISTS "Counter_name_idx" ON "Counter"("name");
