-- 0003_tenant_model_a — MULTI-TENANT MODEL A (tenant scope audit 2026-09-09)
--
-- ODLOČITEV (uporabnikova točka 7): sprejet je MODEL A — katalog in konfiguracija
-- so PO LOKACIJI (NOT NULL). Prejšnja mešanica globalnih in location-scoped
-- virov je bila najnevarnejša možnost:
--   • DiningOption je imel GLOBALNI @@unique([type]) — en "dine-in" za VSE najemnike;
--   • Menu/Table/TaxRate so dovoljevali NULL locationId (implicitno "globalno");
--   • RevenueCenter/SalesCategory/PriceGroup/ServiceCharge/PrepStation/Printer/
--     VoidReason/NoSaleReason/PackagingConfig/AlternatePaymentType/Discount so bili
--     popolnoma globalni (GET /api/configuration je izpisal vse najemnike).
--
-- Deljenje vsebin med lokacijami je odslej IZKLJUČNO eksplicitno (kopija prek
-- /api/locations/sync). "Shared catalog" (model B) NI izbran.
--
-- FAIL-CLOSED varovalke: obstoječe vrstice brez znane lokacije BLOKIRAJO
-- migracijo (isti vzorec kot 0002_p1_hardening). Razreši jih ROČNO
-- (dodelitev, uvoz, MIGRATION_REVIEW ali legacy oznaka) — NIKOLI samodejno
-- dodeljevanje "prvi aktivni lokaciji".

-- ── 1. Odstrani stare SetNull FK-je (nezdružljivi z NOT NULL) ──
ALTER TABLE "Menu" DROP CONSTRAINT "Menu_locationId_fkey";
ALTER TABLE "Table" DROP CONSTRAINT "Table_locationId_fkey";
ALTER TABLE "TaxRate" DROP CONSTRAINT "TaxRate_locationId_fkey";

-- ── 2. Počisti zastarele indekse ──
-- Drift: index iz 0002, ki ga schema ne deklarira več.
DROP INDEX "Counter_name_idx";
-- GLOBALNI unique na DiningOption.type — večlokatcijska napaka: en "dine-in"
-- za vse najemnike (druga lokacija ni mogla imeti svojega). Nadomeščen z
-- unique(type, locationId) spodaj.
DROP INDEX "DiningOption_type_key";
-- MODEL A: delni unique iz 0002 za "globalne" TaxRate vrstice (locationId IS NULL)
-- — teh vrstic odslej ni več. Odvečen mrtvi indeks.
DROP INDEX IF EXISTS "TaxRate_code_global_key";

-- ── 3. NOT NULL + varovalke: obstoječi katalog/konfiguracija brez lokacije ──
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "Menu" WHERE "locationId" IS NULL) > 0 THEN
    RAISE EXCEPTION 'Cannot apply NOT NULL migration: unresolved menus without locationId (%) — razreši ROČNO (dodeli pravo lokacijo ali MIGRATION_REVIEW); NIKOLI samodejno prvi lokaciji', (SELECT COUNT(*) FROM "Menu" WHERE "locationId" IS NULL);
  END IF;
  ALTER TABLE "Menu" ALTER COLUMN "locationId" SET NOT NULL;
END $$;

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "Table" WHERE "locationId" IS NULL) > 0 THEN
    RAISE EXCEPTION 'Cannot apply NOT NULL migration: unresolved tables without locationId (%) — razreši ROČNO; NIKOLI samodejno prvi lokaciji', (SELECT COUNT(*) FROM "Table" WHERE "locationId" IS NULL);
  END IF;
  ALTER TABLE "Table" ALTER COLUMN "locationId" SET NOT NULL;
END $$;

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "TaxRate" WHERE "locationId" IS NULL) > 0 THEN
    RAISE EXCEPTION 'Cannot apply NOT NULL migration: unresolved tax rates without locationId (%) — razreši ROČNO (podvoji globalne stopnje PO lokacijah); NIKOLI samodejno prvi lokaciji', (SELECT COUNT(*) FROM "TaxRate" WHERE "locationId" IS NULL);
  END IF;
  ALTER TABLE "TaxRate" ALTER COLUMN "locationId" SET NOT NULL;
END $$;

-- Novi stolpci: vrstice PRED migracijo ne morejo imeti lokacije (stolpca še ni) —
-- če tabela NI prazna, je edina varna pot ROČNA razrešitev pred migracijo.
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "DiningOption") > 0 THEN
    RAISE EXCEPTION 'Cannot apply NOT NULL migration: unresolved dining options without locationId (%) — obstoječe vrstice nimajo lokacije; razreši ROČNO (dodeli/uporabi /api/locations/sync), NIKOLI samodejno', (SELECT COUNT(*) FROM "DiningOption");
  END IF;
  ALTER TABLE "DiningOption" ADD COLUMN "locationId" TEXT NOT NULL;
END $$;

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "RevenueCenter") > 0 THEN
    RAISE EXCEPTION 'Cannot apply NOT NULL migration: unresolved revenue centers without locationId (%) — razreši ROČNO, NIKOLI samodejno', (SELECT COUNT(*) FROM "RevenueCenter");
  END IF;
  ALTER TABLE "RevenueCenter" ADD COLUMN "locationId" TEXT NOT NULL;
END $$;

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "ServiceCharge") > 0 THEN
    RAISE EXCEPTION 'Cannot apply NOT NULL migration: unresolved service charges without locationId (%) — razreši ROČNO, NIKOLI samodejno', (SELECT COUNT(*) FROM "ServiceCharge");
  END IF;
  ALTER TABLE "ServiceCharge" ADD COLUMN "locationId" TEXT NOT NULL;
END $$;

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "SalesCategory") > 0 THEN
    RAISE EXCEPTION 'Cannot apply NOT NULL migration: unresolved sales categories without locationId (%) — razreši ROČNO, NIKOLI samodejno', (SELECT COUNT(*) FROM "SalesCategory");
  END IF;
  ALTER TABLE "SalesCategory" ADD COLUMN "locationId" TEXT NOT NULL;
END $$;

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "PriceGroup") > 0 THEN
    RAISE EXCEPTION 'Cannot apply NOT NULL migration: unresolved price groups without locationId (%) — razreši ROČNO, NIKOLI samodejno', (SELECT COUNT(*) FROM "PriceGroup");
  END IF;
  ALTER TABLE "PriceGroup" ADD COLUMN "locationId" TEXT NOT NULL;
END $$;

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "PrepStation") > 0 THEN
    RAISE EXCEPTION 'Cannot apply NOT NULL migration: unresolved prep stations without locationId (%) — razreši ROČNO, NIKOLI samodejno', (SELECT COUNT(*) FROM "PrepStation");
  END IF;
  ALTER TABLE "PrepStation" ADD COLUMN "locationId" TEXT NOT NULL;
END $$;

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "Printer") > 0 THEN
    RAISE EXCEPTION 'Cannot apply NOT NULL migration: unresolved printers without locationId (%) — razreši ROČNO, NIKOLI samodejno', (SELECT COUNT(*) FROM "Printer");
  END IF;
  ALTER TABLE "Printer" ADD COLUMN "locationId" TEXT NOT NULL;
END $$;

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "PackagingConfig") > 0 THEN
    RAISE EXCEPTION 'Cannot apply NOT NULL migration: unresolved packaging configs without locationId (%) — razreši ROČNO, NIKOLI samodejno', (SELECT COUNT(*) FROM "PackagingConfig");
  END IF;
  ALTER TABLE "PackagingConfig" ADD COLUMN "locationId" TEXT NOT NULL;
END $$;

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "VoidReason") > 0 THEN
    RAISE EXCEPTION 'Cannot apply NOT NULL migration: unresolved void reasons without locationId (%) — razreši ROČNO, NIKOLI samodejno', (SELECT COUNT(*) FROM "VoidReason");
  END IF;
  ALTER TABLE "VoidReason" ADD COLUMN "locationId" TEXT NOT NULL;
END $$;

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "NoSaleReason") > 0 THEN
    RAISE EXCEPTION 'Cannot apply NOT NULL migration: unresolved no-sale reasons without locationId (%) — razreši ROČNO, NIKOLI samodejno', (SELECT COUNT(*) FROM "NoSaleReason");
  END IF;
  ALTER TABLE "NoSaleReason" ADD COLUMN "locationId" TEXT NOT NULL;
END $$;

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "AlternatePaymentType") > 0 THEN
    RAISE EXCEPTION 'Cannot apply NOT NULL migration: unresolved alternate payment types without locationId (%) — razreši ROČNO, NIKOLI samodejno', (SELECT COUNT(*) FROM "AlternatePaymentType");
  END IF;
  ALTER TABLE "AlternatePaymentType" ADD COLUMN "locationId" TEXT NOT NULL;
END $$;

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "Discount") > 0 THEN
    RAISE EXCEPTION 'Cannot apply NOT NULL migration: unresolved discounts without locationId (%) — razreši ROČNO, NIKOLI samodejno', (SELECT COUNT(*) FROM "Discount");
  END IF;
  ALTER TABLE "Discount" ADD COLUMN "locationId" TEXT NOT NULL;
END $$;

-- ── 4. Indeksi za scoped poizvedbe ──
CREATE INDEX "AlternatePaymentType_locationId_idx" ON "AlternatePaymentType"("locationId");
CREATE INDEX "DiningOption_locationId_idx" ON "DiningOption"("locationId");
CREATE UNIQUE INDEX "DiningOption_type_locationId_key" ON "DiningOption"("type", "locationId");
CREATE INDEX "Discount_locationId_idx" ON "Discount"("locationId");
CREATE INDEX "NoSaleReason_locationId_idx" ON "NoSaleReason"("locationId");
CREATE INDEX "PackagingConfig_locationId_idx" ON "PackagingConfig"("locationId");
CREATE INDEX "PrepStation_locationId_idx" ON "PrepStation"("locationId");
CREATE INDEX "PriceGroup_locationId_idx" ON "PriceGroup"("locationId");
CREATE INDEX "Printer_locationId_idx" ON "Printer"("locationId");
CREATE INDEX "RevenueCenter_locationId_idx" ON "RevenueCenter"("locationId");
CREATE INDEX "SalesCategory_locationId_idx" ON "SalesCategory"("locationId");
CREATE INDEX "ServiceCharge_locationId_idx" ON "ServiceCharge"("locationId");
CREATE INDEX "VoidReason_locationId_idx" ON "VoidReason"("locationId");

-- ── 5. FK-ji z ON DELETE CASCADE (lokacija JE lastnik svojega kataloga) ──
ALTER TABLE "Menu" ADD CONSTRAINT "Menu_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaxRate" ADD CONSTRAINT "TaxRate_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiningOption" ADD CONSTRAINT "DiningOption_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevenueCenter" ADD CONSTRAINT "RevenueCenter_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceCharge" ADD CONSTRAINT "ServiceCharge_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesCategory" ADD CONSTRAINT "SalesCategory_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PriceGroup" ADD CONSTRAINT "PriceGroup_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrepStation" ADD CONSTRAINT "PrepStation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlternatePaymentType" ADD CONSTRAINT "AlternatePaymentType_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VoidReason" ADD CONSTRAINT "VoidReason_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NoSaleReason" ADD CONSTRAINT "NoSaleReason_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Printer" ADD CONSTRAINT "Printer_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PackagingConfig" ADD CONSTRAINT "PackagingConfig_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Table" ADD CONSTRAINT "Table_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
