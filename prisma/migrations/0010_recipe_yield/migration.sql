-- 0010_recipe_yield — yield / preparation loss
-- (epic #115 P0-05, runda 123)
--
-- Kanon P0-05: raw quantity → preparation loss → usable quantity →
-- recipe quantity → sale. RecipeItem.yieldPercent je deklarirani yield
-- sestavine v receptu (združi trimming / kuhanje / čiščenje / evaporacijo
-- v en deklariran procent); quantityPerServing ostane USABLE količina.
--
-- Prodaja porabi RAW: usable / (yield/100) (isti kanon kot doslej pri
-- yield=100 — back-compat brez backfilla). Food cost = raw × nabavna
-- cena / porcijo. Batch priprava (P0-04, R122) že nosi svoj cost basis.
--
-- Migracija je čisto ADDITIVNA (1 stolpec s default 100) — non-breaking,
-- brez backfilla. Zahteva prisma generate.

ALTER TABLE "RecipeItem" ADD COLUMN "yieldPercent" DECIMAL(5,2) NOT NULL DEFAULT 100;
