-- 0004_modifier_group_scope — MODEL A dopolnitev (#9 tenant scope audit 2026-09-09)
--
-- ModifierGroup je bil ZADNJI globalni katalog: GET /api/modifier-groups je
-- izpisal skupine VSEH lokacij/najemnikov, skupino lokacije A je bilo mogoče
-- pripeti artiklu lokacije B (MenuItemModifierGroup brez preverjanja), cene
-- dodatkov (Modifier.price) pa so operativni podatek lokacije.
--
-- MODEL A: skupine modifikatorjev so PO LOKACIJI (NOT NULL). Modifier dedni
-- scope prek modifierGroupId — isti vzorec kot PackagingItem → PackagingConfig.
-- Deljenje med lokacijami je izključno eksplicitno (/api/locations/sync kopija).
--
-- IZPELJAVA LOKACIJE ZA OBSTOJEČE VRSTICE (varnejša od 0003, ker ima ta tabela
-- že povezave): lokacija se izpelje iz pripetih artiklov
-- (MenuItemModifierGroup → MenuItem → Category → Menu → locationId).
--   • vsi pripeti artikli na ENO lokacijo → skupina podeduje to lokacijo;
--   • 0 pripetih artiklov ALI artikli VEČ lokacij → FAIL-CLOSED (ročna
--     razrešitev: podvoji skupino po lokacijah), NIKOLI samodejno prvi lokaciji.

-- ── 1. Dodaj stolpec (NULL začasno, dokler ne razrešimo obstoječih vrstic) ──
ALTER TABLE "ModifierGroup" ADD COLUMN "locationId" TEXT;

-- ── 2. Izpelji lokacijo iz pripetih artiklov (samo enolične lokacije) ──
UPDATE "ModifierGroup" mg
SET "locationId" = sub.loc
FROM (
  SELECT
    img."modifierGroupId" AS gid,
    MIN(m."locationId")  AS loc,
    COUNT(DISTINCT m."locationId") AS distinct_locations
  FROM "MenuItemModifierGroup" img
  JOIN "MenuItem" mi ON mi.id = img."menuItemId"
  JOIN "Category"  c  ON c.id  = mi."categoryId"
  JOIN "Menu"      m  ON m.id  = c."menuId"
  GROUP BY img."modifierGroupId"
) sub
WHERE mg.id = sub.gid AND sub.distinct_locations = 1;

-- ── 3. FAIL-CLOSED: nerazrešene vrstice blokirajo migracijo ──
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "ModifierGroup" WHERE "locationId" IS NULL) > 0 THEN
    RAISE EXCEPTION 'Cannot apply NOT NULL migration: unresolved modifier groups without locationId (%) — skupine brez pripetih artiklov ali pripete artiklom VEČ lokacij: razreši ROČNO (podvoji skupino po lokacijah ali /api/locations/sync), NIKOLI samodejno prvi lokaciji', (SELECT COUNT(*) FROM "ModifierGroup" WHERE "locationId" IS NULL);
  END IF;
  ALTER TABLE "ModifierGroup" ALTER COLUMN "locationId" SET NOT NULL;
END $$;

-- ── 4. FK + indeks ──
ALTER TABLE "ModifierGroup" ADD CONSTRAINT "ModifierGroup_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ModifierGroup_locationId_idx" ON "ModifierGroup"("locationId");

-- ── 5. Konsistentnost: odstrani povezave, ki kršijo invarianto iste lokacije ──
-- Odvečen no-op na čistih podatkih (korak 3 zagotavlja enoličnost).
DELETE FROM "MenuItemModifierGroup" img
USING "ModifierGroup" mg, "MenuItem" mi, "Category" c, "Menu" m
WHERE img."modifierGroupId" = mg.id
  AND img."menuItemId" = mi.id
  AND mi."categoryId" = c.id
  AND c."menuId" = m.id
  AND m."locationId" <> mg."locationId";
