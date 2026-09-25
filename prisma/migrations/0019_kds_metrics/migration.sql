-- 0019_kds_metrics — R133 (epic #115 P1-09): KDS production intelligence — metrike
--
-- Kanon P1-09: KDS bump postane MERLJIV in AVTORSKI NAD obstoječim tokom
-- (workflow NESPREMENJEN — isti CAS/lock/guardi, samo enrichment data v istem
-- update-u):
--   OrderItem.readyAt     — strežniški čas ZADNJEGA prehoda v 'ready' (bump);
--                           ponovni vstop ready→preparing→ready OVERWRITE
--                           ("čas zadnje priprave"); prehod v 'served' NE
--                           spreminja; non-ready statusi NE pišejo readyAt
--   OrderItem.readyById   — kdo je bumpal (FK Employee, SetNull + snapshot
--                           imena — pariteta GoodsReceipt.receivedBy R132)
--   OrderItem.readyByName — ime snapshot (izbris zaposlenega ne sme izgubiti
--                           forenzike)
-- Legacy vrstice (readyAt NULL — vse pred 0019) so iz prep-time metrik
-- izključene — NIKOLI izmišljen čas. Base time prep statistike =
-- firedAt ?? createdAt (ISTA semantika kot KDS display fallback R114).
--
-- Aditivna migracija (pariteta 0016/0017/0018): 3 stolpci + indeks + FK.
-- BREZ data loss, brez ALTER obstoječih stolpcev, brez backfill.

-- OrderItem += KDS bump forenzika (merljivost nad obstoječim tokom)
ALTER TABLE "OrderItem" ADD COLUMN "readyAt" TIMESTAMP(3),
  ADD COLUMN "readyById" TEXT,
  ADD COLUMN "readyByName" TEXT NOT NULL DEFAULT '';

-- R133: metrike okno po readyAt (throughput / prep-time vzorec, cap 20.000)
CREATE INDEX "OrderItem_readyAt_idx" ON "OrderItem"("readyAt");

-- Zaposleni: SetNull — izbris zaposlenega ne sme izgubiti bump forenzike (snapshot imena ostane)
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_readyById_fkey" FOREIGN KEY ("readyById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
