-- 0023_employee_fk_backfill — R155-b (repo issue #43 zaključek: FK + backfill + dual-write)
--
-- VSEBINA:
--   (1) 2 NOVA FK stolpca: StockTransaction."employeeId", ZReport."finalizedById"
--       (soft-ref polja employeeName/finalizedBy ostanejo snapshot — NIKOLI se ne
--       spreminjajo; dual-write piše oba, glej R155-b Group A/B)
--   (2) BACKFILL 8 parov soft-ref → FK. Pravilo (enako za vse pare):
--         id-match PRVI: softref je dejanski Employee.id (EXISTS guard) → SET = softref
--         name-match SAMO če ima ime točno 1 zaposlenega (DISTINCT guard —
--           dvoumno ime ostane NULL, ne ugibamo), sicer NULL (fail-closed)
--       JournalEntry.postedBy / StaffShift.createdBy so nullable → dodatni
--       IS NOT NULL guard (<> '' pri NULL vrednosti je v PG NULL → vrstico
--       sicer tudi izpusti, IS NOT NULL je ekspliciten za berljivost).
--   (3) 4 FK constraint-i: 2 nova stolpca (StockTransaction/ZReport) + 2
--       obstoječa stolpca brez relacije (GuestVisit.employeeId — SetNull,
--       TipDistribution.employeeId — RESTRICT, ker je required scalar in
--       Employee je soft-delete-only → fizični delete jo zavrže (varovalka)).
--   (4) 7 indeksov: 2 nova FK + 5 retro za obstoječe FK stolpce brez indeksa
--       (Order.cancelledById, StaffShift.createdById, PurchaseOrder.requestedById,
--       PurchaseOrder.approvedById, JournalEntry.postedById).
--
-- ⚠️ HASH-CHAIN KONTRAKT (#43): employeeName se v tej migraciji NIKOLI ne
-- spreminja — GuestVisit.chainHash / TipDistribution.chainHash hashirajo
-- vsebino employeeName (EU 852/2004 veriga zanesljivosti). Historijske
-- GuestVisit vrstice ostanejo z cuid v employeeName (R155-b dual-write bonus
-- piše DEJANSKO ime samo za NOVE zapise — vsebina se sme spremeniti za nove,
-- kontinuiteta verige se ohranja, ker se hashira vsak zapis ob zapisu).
--
-- ⚠️ FAIL-CLOSED za TipDistribution: stolpec employeeId je NOT NULL (required
-- relacija ne dovoli NULL). Sirota (employeeId brez Employee vrstice) je
-- PODATKOVNA NAPAKA → RAISE EXCEPTION (migracija abortira, ročni pregled),
-- ne tihe popravke. Pri GuestVisit (nullable) so sirote NEPOMENSKE (zaposleni
-- fizično izbrisan pred SetNull dobo) → NULL-out (SetNull semantika).
--
-- VRSTNI RED: stolpci → backfill → TipDistribution guard → constraint-i →
-- indexi. Backfill PRED constraint-i, ker ADD CONSTRAINT validira obstoječe
-- vrstice (GuestVisit sirote morajo biti NULL-ed prej; backfill vrednosti
-- e.id so vedno FK-varne).
--
-- IDEMPOTENTNOST: ADD COLUMN IF NOT EXISTS; constraint-i prek pg_constraint
-- NOT EXISTS guardov (vzorec 0022_json_fields); CREATE INDEX IF NOT EXISTS;
-- backfill ima WHERE fk IS NULL (ponovni zagon = no-op). Guard je read-only.

-- ─────────────────────────────────────────────────────────────────
-- (1) NOVA stolpca
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE "StockTransaction" ADD COLUMN IF NOT EXISTS "employeeId" TEXT;
ALTER TABLE "ZReport" ADD COLUMN IF NOT EXISTS "finalizedById" TEXT;

-- ─────────────────────────────────────────────────────────────────
-- (2) BACKFILL — 8 parov soft-ref → FK
--     (a) id-match: EXISTS (SELECT 1 FROM "Employee" e WHERE e.id = t.<softref>)
--     (b) name-match: vrednost = e.name AND count(*) = 1 (DISTINCT guard)
-- ─────────────────────────────────────────────────────────────────

-- 2a. Order.cancelledById ← cancelledBy (NOT NULL, mešani id/ime)
UPDATE "Order" t
SET "cancelledById" = t."cancelledBy"
WHERE t."cancelledById" IS NULL
  AND t."cancelledBy" <> ''
  AND EXISTS (SELECT 1 FROM "Employee" e WHERE e.id = t."cancelledBy");

UPDATE "Order" t
SET "cancelledById" = e.id
FROM "Employee" e
WHERE t."cancelledById" IS NULL
  AND t."cancelledBy" <> ''
  AND e.name = t."cancelledBy"
  AND (SELECT count(*) FROM "Employee" WHERE name = t."cancelledBy") = 1;

-- 2b. PurchaseOrder.requestedById ← requestedBy (NOT NULL)
UPDATE "PurchaseOrder" t
SET "requestedById" = t."requestedBy"
WHERE t."requestedById" IS NULL
  AND t."requestedBy" <> ''
  AND EXISTS (SELECT 1 FROM "Employee" e WHERE e.id = t."requestedBy");

UPDATE "PurchaseOrder" t
SET "requestedById" = e.id
FROM "Employee" e
WHERE t."requestedById" IS NULL
  AND t."requestedBy" <> ''
  AND e.name = t."requestedBy"
  AND (SELECT count(*) FROM "Employee" WHERE name = t."requestedBy") = 1;

-- 2c. PurchaseOrder.approvedById ← approvedBy (NOT NULL)
UPDATE "PurchaseOrder" t
SET "approvedById" = t."approvedBy"
WHERE t."approvedById" IS NULL
  AND t."approvedBy" <> ''
  AND EXISTS (SELECT 1 FROM "Employee" e WHERE e.id = t."approvedBy");

UPDATE "PurchaseOrder" t
SET "approvedById" = e.id
FROM "Employee" e
WHERE t."approvedById" IS NULL
  AND t."approvedBy" <> ''
  AND e.name = t."approvedBy"
  AND (SELECT count(*) FROM "Employee" WHERE name = t."approvedBy") = 1;

-- 2d. StaffShift.createdById ← createdBy (nullable → IS NOT NULL guard)
UPDATE "StaffShift" t
SET "createdById" = t."createdBy"
WHERE t."createdById" IS NULL
  AND t."createdBy" IS NOT NULL
  AND t."createdBy" <> ''
  AND EXISTS (SELECT 1 FROM "Employee" e WHERE e.id = t."createdBy");

UPDATE "StaffShift" t
SET "createdById" = e.id
FROM "Employee" e
WHERE t."createdById" IS NULL
  AND t."createdBy" IS NOT NULL
  AND t."createdBy" <> ''
  AND e.name = t."createdBy"
  AND (SELECT count(*) FROM "Employee" WHERE name = t."createdBy") = 1;

-- 2e. JournalEntry.postedById ← postedBy (nullable → IS NOT NULL guard)
UPDATE "JournalEntry" t
SET "postedById" = t."postedBy"
WHERE t."postedById" IS NULL
  AND t."postedBy" IS NOT NULL
  AND t."postedBy" <> ''
  AND EXISTS (SELECT 1 FROM "Employee" e WHERE e.id = t."postedBy");

UPDATE "JournalEntry" t
SET "postedById" = e.id
FROM "Employee" e
WHERE t."postedById" IS NULL
  AND t."postedBy" IS NOT NULL
  AND t."postedBy" <> ''
  AND e.name = t."postedBy"
  AND (SELECT count(*) FROM "Employee" WHERE name = t."postedBy") = 1;

-- 2f. GuestVisit.employeeId ← (že drži id — dual-write je bil obstoj);
--     samo sirote → NULL (SetNull semantika, constraint-ready).
--     employeeName se NE dotikamo (hash-chain; historija ostane cuid).
UPDATE "GuestVisit" t
SET "employeeId" = NULL
WHERE t."employeeId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Employee" e WHERE e.id = t."employeeId");

-- 2g. StockTransaction.employeeId ← employeeName (NOT NULL; vrednost je id ALI ime)
UPDATE "StockTransaction" t
SET "employeeId" = t."employeeName"
WHERE t."employeeId" IS NULL
  AND t."employeeName" <> ''
  AND EXISTS (SELECT 1 FROM "Employee" e WHERE e.id = t."employeeName");

UPDATE "StockTransaction" t
SET "employeeId" = e.id
FROM "Employee" e
WHERE t."employeeId" IS NULL
  AND t."employeeName" <> ''
  AND e.name = t."employeeName"
  AND (SELECT count(*) FROM "Employee" WHERE name = t."employeeName") = 1;

-- 2h. ZReport.finalizedById ← finalizedBy (NOT NULL; vrednost je id ALI ime)
UPDATE "ZReport" t
SET "finalizedById" = t."finalizedBy"
WHERE t."finalizedById" IS NULL
  AND t."finalizedBy" <> ''
  AND EXISTS (SELECT 1 FROM "Employee" e WHERE e.id = t."finalizedBy");

UPDATE "ZReport" t
SET "finalizedById" = e.id
FROM "Employee" e
WHERE t."finalizedById" IS NULL
  AND t."finalizedBy" <> ''
  AND e.name = t."finalizedBy"
  AND (SELECT count(*) FROM "Employee" WHERE name = t."finalizedBy") = 1;

-- ─────────────────────────────────────────────────────────────────
-- (3a) TipDistribution sirote-preverba (fail-closed, PRED ADD CONSTRAINT —
--      required relacija ne dovoli NULL, tiho izpuščen FK = lažna varnost)
-- ─────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM "TipDistribution" td
    LEFT JOIN "Employee" e ON e.id = td."employeeId"
    WHERE e.id IS NULL
  ) > 0 THEN
    RAISE EXCEPTION 'TipDistribution: sirote employeeId (napaka podatkov, ročni pregled)';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- (3b) 4× ADD CONSTRAINT (DO-$$ pg_constraint NOT EXISTS, vzorec 0022)
-- ─────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StockTransaction_employeeId_fkey'
  ) THEN
    ALTER TABLE "StockTransaction" ADD CONSTRAINT "StockTransaction_employeeId_fkey"
      FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ZReport_finalizedById_fkey'
  ) THEN
    ALTER TABLE "ZReport" ADD CONSTRAINT "ZReport_finalizedById_fkey"
      FOREIGN KEY ("finalizedById") REFERENCES "Employee"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GuestVisit_employeeId_fkey'
  ) THEN
    ALTER TABLE "GuestVisit" ADD CONSTRAINT "GuestVisit_employeeId_fkey"
      FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TipDistribution_employeeId_fkey'
  ) THEN
    ALTER TABLE "TipDistribution" ADD CONSTRAINT "TipDistribution_employeeId_fkey"
      FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- (4) 7× CREATE INDEX IF NOT EXISTS (2 nova FK + 5 retro)
-- ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "StockTransaction_employeeId_idx" ON "StockTransaction"("employeeId");
CREATE INDEX IF NOT EXISTS "ZReport_finalizedById_idx" ON "ZReport"("finalizedById");
CREATE INDEX IF NOT EXISTS "Order_cancelledById_idx" ON "Order"("cancelledById");
CREATE INDEX IF NOT EXISTS "StaffShift_createdById_idx" ON "StaffShift"("createdById");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_requestedById_idx" ON "PurchaseOrder"("requestedById");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_approvedById_idx" ON "PurchaseOrder"("approvedById");
CREATE INDEX IF NOT EXISTS "JournalEntry_postedById_idx" ON "JournalEntry"("postedById");
