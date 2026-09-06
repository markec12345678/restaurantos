-- ============================================
-- Issue #32 — Subscription NOT NULL Migration
-- ============================================
-- Location.subscriptionId je String? (nullable). V multi-tenant SaaS mora biti obvezen.
--
-- PRED POGOJI:
--   1. Zaženi scripts/p0-c4-backfill.mjs --apply (zapolni NULL locationId vrednosti)
--   2. Zaženi to migration SQL (zapolni NULL subscriptionId + NOT NULL + FK)
--
-- ROLLBACK:
--   ALTER TABLE "Location" ALTER COLUMN "subscriptionId" DROP NOT NULL;
--   ALTER TABLE "Location" DROP CONSTRAINT IF EXISTS "Location_subscriptionId_fkey";
-- ============================================

-- 1. Backfill: kreiraj default Subscription za lokacije brez subscriptionId
INSERT INTO "Subscription" (id, "companyName", email, phone, "taxId", "businessId", plan, status, "monthlyPrice", "locationCount", currency, "createdAt", "updatedAt")
SELECT
  'sub-default-' || l.id,
  l.name,
  l.email,
  l.phone,
  l."taxId",
  l."businessId",
  'professional',
  'active',
  0,
  1,
  l.currency,
  NOW(),
  NOW()
FROM "Location" l
WHERE l."subscriptionId" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "Subscription" s WHERE s.id = 'sub-default-' || l.id)
ON CONFLICT DO NOTHING;

-- 2. Posodobi Location.subscriptionId z default subscription
UPDATE "Location" l
SET "subscriptionId" = 'sub-default-' || l.id
WHERE l."subscriptionId" IS NULL;

-- 3. Dodaj FK constraint (idempotent)
ALTER TABLE "Location" DROP CONSTRAINT IF EXISTS "Location_subscriptionId_fkey";
ALTER TABLE "Location" ADD CONSTRAINT "Location_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Nastavi NOT NULL
ALTER TABLE "Location" ALTER COLUMN "subscriptionId" SET NOT NULL;

-- 5. Verifikacija
-- SELECT count(*) FROM "Location" WHERE "subscriptionId" IS NULL; -- mora biti 0
