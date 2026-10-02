-- 0025_grn_idempotency — R212 (epik #144, issue #152 korak 2: vrzel G7)
--
-- VRZEL G7 (docs/INVENTORY-CHAIN.md §5): PO receive je imel SAMO terminalni
-- status guard + cap-check — dup prevzem z ISTIMI količinami po statusu
-- `partial` (retry omrežja/klienta) je po oblikovanju lahko prišteval zalogo
-- DVAKRAT (vsak klic = nov GRN + nova StockTx + nova price-history vrstica).
--
-- FIX (R116 idempotency kanon — pariteta waste/batch-prep/stocktakes):
--   GoodsReceipt.idempotencyKey — klientov opcijski ključ. Replay ISTEGA
--   zahtevka (isti PO + isti ključ) vrne ISTI GRN dokument (EN efekt).
--
-- ZAKAJ (purchaseOrderId, idempotencyKey) IN NE (locationId, idempotencyKey):
--   PO/GRN lokacija je NULLABLE (nabavni grozd — pariteta PO.locationId
--   String?) — v PG velja NULL ≠ NULL, zato bi (locationId, key) unique
--   pustil luknjo za globalne PO-je. (purchaseOrderId, key) je NON-NULL z
--   obeh strani in leži POD obstoječim per-PO advisory lockom
--   (pg_advisory_xact_lock(hashtext(poId))) — replay-check je zato airtight
--   za retry ISTEGA naročila (edini G7 grožnji model). NULL ključ (legacy
--   prevzemi brez ključa) se v unique indeksu NE kolizira (PG NULL ≠ NULL).
--
-- IDEMPOTENTNO: IF NOT EXISTS guardi (pariteta 0018/0024 vzorca).
ALTER TABLE "GoodsReceipt" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

CREATE INDEX IF NOT EXISTS "GoodsReceipt_idempotencyKey_idx"
  ON "GoodsReceipt"("idempotencyKey");

CREATE UNIQUE INDEX IF NOT EXISTS "GoodsReceipt_purchaseOrderId_idempotencyKey_key"
  ON "GoodsReceipt"("purchaseOrderId", "idempotencyKey");
