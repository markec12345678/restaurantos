-- 0026_stocktx_order_relation — R216 (epik #144 + #152 korak 2: vrzel G2)
--
-- VSEBINA:
--   (1) PREČISTITEV sirot: StockTransaction."orderId" je bil od 0001_init gol
--       stolpec BREZ FK relacije (pisatelji nastavijo orderId v isti tx, ampak
--       referenčne integritete ni bilo nič dobrilo — edini hard-delete poti do
--       sirot je seed /api/seed deleteMany). Pred ADD CONSTRAINT sirote NULL-amo
--       (retroaktivni SetNull — idempotentno, read-only guard), da migracija ne
--       abortira na poljubnem produkcijskem stanju.
--   (2) ADD CONSTRAINT "StockTransaction_orderId_fkey" → "Order"("id"),
--       ON DELETE SET NULL ON UPDATE CASCADE — DO-$$ pg_constraint NOT EXISTS
--       guard (vzorec 0022/0023). onDelete SetNull: seed order.deleteMany()
--       ostane delujoč (sirote nastane po pravilu, ne po nesreči).
--   (3) Indeks "StockTransaction_orderId_idx" že obstaja (0001_init, @@index([orderId]))
--       — NI novega indeksa.
--
-- ZAKAJ (G2 kanon pariteta): sale-chain COGS ('sale' + 'return') se po fixu
-- bucketira na LJ poslovni dan prodaje (order.paidAt — ISTI kanon kot
-- prihodki) namesto na čas ognja (StockTransaction.createdAt). Naročilo ob
-- 23:50 / plačilo ob 00:10 ne meša več dnevov v bruto marži. Konzumenti:
-- reports/financial, reports/eod, dashboard furs-shift-cogs, accounting
-- journal-generator (P&L COGS fallback).
--
-- IDEMPOTENTNOST: UPDATE ima WHERE NOT EXISTS (ponovni zagon = no-op);
-- constraint prek pg_constraint NOT EXISTS guard (vzorec 0023).

-- ─────────────────────────────────────────────────────────────────
-- (1) Sirote → NULL (retroaktivni SetNull; NIKOLI ne ugibamo pripadnosti)
-- ─────────────────────────────────────────────────────────────────

UPDATE "StockTransaction" t
SET "orderId" = NULL
WHERE t."orderId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Order" o WHERE o."id" = t."orderId");

-- ─────────────────────────────────────────────────────────────────
-- (2) ADD CONSTRAINT (DO-$$ pg_constraint NOT EXISTS, vzorec 0022/0023)
-- ─────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StockTransaction_orderId_fkey'
  ) THEN
    ALTER TABLE "StockTransaction" ADD CONSTRAINT "StockTransaction_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
