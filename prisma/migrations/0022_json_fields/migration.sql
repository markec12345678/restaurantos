-- 0022_json_fields — R150-b (repo issue #33 "JSON-as-String", PRVA migracijska runda)
--
-- ZAWRTJE:
--   (1) 25 JSON-as-String stolpcev (TEXT @default '[]'/'{}'/'[1,2,3,4,5]') → JSONB
--       (Prisma Json @default("[]") — validirano: generira DEFAULT '[]' na jsonb)
--   (2) NOVA tabela OrderItemModifier — normalizirane join vrstice modifikatorjev
--       (HIGH del issue-a: FK integriteta + queryability + snapshot cene)
--   (3) Backfill OrderItemModifier iz legacy OrderItem.modifiersJson stringov
--
-- NE SPREMENI (byte-exact pin, kontrakt R150-a):
--   AuditLog.details           (hash-veriga recompute-a iz SHRANJENEGA stringa —
--                               src/lib/db.ts:207-217 + /api/audit/verify-chain :96/:113)
--   WebhookDelivery.payload    (retry pošlje shranjen payload + shranjen HMAC)
--   RestaurantSettings.apiKeys (deprecatiran keystore, drop planiran)
--   MenuItem.allergens / Modifier.allergens (CSV "1,3,7", NISTA JSON)
--   OrderItem.modifiersJson    (LEGACY wire stolpec ostane String — dual-write;
--                               drop odložen na cleanup rundi)
--
-- SEMANTIKA pretvorbe (fail-closed):
--   prazen string / samo whitespace → stolpčni default ('[]' oz. '{}')
--   malformed JSON → cast ERROR = migracija abortira (namen: tiho okvarjeno
--   branje se nikoli ne zapiše kot okvarjen jsonb; pariteta R148 CAP kanona)
--   VSI obstoječi default-i so veljavni JSON literali.
--
-- IDEMPOTENTNOST: CREATE TABLE/INDEX imajo IF NOT EXISTS; ALTER ... TYPE je na
-- sveži bazi idempotentno-varen (stolpci so TEXT), VENDAR ponovni zagon na ŽE
-- pretvorjeni bazi NEUSPEŠNO legne (btrim(jsonb) ne obstaja) — NEŠKODLJIVO,
-- ker je stanje že želeno. Backfill z NOT EXISTS zaščito (brez duplikatov).

-- ─────────────────────────────────────────────────────────────────
-- (1a) ARRAY-tiped stolpci, default '[]'
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE "Printer" ALTER COLUMN "printRules" DROP DEFAULT;
ALTER TABLE "Printer" ALTER COLUMN "printRules" TYPE JSONB USING COALESCE(NULLIF(btrim("printRules"), '')::jsonb, '[]'::jsonb);
ALTER TABLE "Printer" ALTER COLUMN "printRules" SET DEFAULT '[]';

ALTER TABLE "Job" ALTER COLUMN "permissions" DROP DEFAULT;
ALTER TABLE "Job" ALTER COLUMN "permissions" TYPE JSONB USING COALESCE(NULLIF(btrim("permissions"), '')::jsonb, '[]'::jsonb);
ALTER TABLE "Job" ALTER COLUMN "permissions" SET DEFAULT '[]';

ALTER TABLE "RestaurantSettings" ALTER COLUMN "emailReportRecipients" DROP DEFAULT;
ALTER TABLE "RestaurantSettings" ALTER COLUMN "emailReportRecipients" TYPE JSONB USING COALESCE(NULLIF(btrim("emailReportRecipients"), '')::jsonb, '[]'::jsonb);
ALTER TABLE "RestaurantSettings" ALTER COLUMN "emailReportRecipients" SET DEFAULT '[]';

ALTER TABLE "Location" ALTER COLUMN "emailReportRecipients" DROP DEFAULT;
ALTER TABLE "Location" ALTER COLUMN "emailReportRecipients" TYPE JSONB USING COALESCE(NULLIF(btrim("emailReportRecipients"), '')::jsonb, '[]'::jsonb);
ALTER TABLE "Location" ALTER COLUMN "emailReportRecipients" SET DEFAULT '[]';

ALTER TABLE "DeliveryZone" ALTER COLUMN "postCodes" DROP DEFAULT;
ALTER TABLE "DeliveryZone" ALTER COLUMN "postCodes" TYPE JSONB USING COALESCE(NULLIF(btrim("postCodes"), '')::jsonb, '[]'::jsonb);
ALTER TABLE "DeliveryZone" ALTER COLUMN "postCodes" SET DEFAULT '[]';

ALTER TABLE "DeliveryZone" ALTER COLUMN "cities" DROP DEFAULT;
ALTER TABLE "DeliveryZone" ALTER COLUMN "cities" TYPE JSONB USING COALESCE(NULLIF(btrim("cities"), '')::jsonb, '[]'::jsonb);
ALTER TABLE "DeliveryZone" ALTER COLUMN "cities" SET DEFAULT '[]';

ALTER TABLE "Webhook" ALTER COLUMN "events" DROP DEFAULT;
ALTER TABLE "Webhook" ALTER COLUMN "events" TYPE JSONB USING COALESCE(NULLIF(btrim("events"), '')::jsonb, '[]'::jsonb);
ALTER TABLE "Webhook" ALTER COLUMN "events" SET DEFAULT '[]';

ALTER TABLE "Guest" ALTER COLUMN "allergens" DROP DEFAULT;
ALTER TABLE "Guest" ALTER COLUMN "allergens" TYPE JSONB USING COALESCE(NULLIF(btrim("allergens"), '')::jsonb, '[]'::jsonb);
ALTER TABLE "Guest" ALTER COLUMN "allergens" SET DEFAULT '[]';

ALTER TABLE "Guest" ALTER COLUMN "dietaryPrefs" DROP DEFAULT;
ALTER TABLE "Guest" ALTER COLUMN "dietaryPrefs" TYPE JSONB USING COALESCE(NULLIF(btrim("dietaryPrefs"), '')::jsonb, '[]'::jsonb);
ALTER TABLE "Guest" ALTER COLUMN "dietaryPrefs" SET DEFAULT '[]';

ALTER TABLE "Guest" ALTER COLUMN "dislikes" DROP DEFAULT;
ALTER TABLE "Guest" ALTER COLUMN "dislikes" TYPE JSONB USING COALESCE(NULLIF(btrim("dislikes"), '')::jsonb, '[]'::jsonb);
ALTER TABLE "Guest" ALTER COLUMN "dislikes" SET DEFAULT '[]';

ALTER TABLE "Guest" ALTER COLUMN "favoriteItems" DROP DEFAULT;
ALTER TABLE "Guest" ALTER COLUMN "favoriteItems" TYPE JSONB USING COALESCE(NULLIF(btrim("favoriteItems"), '')::jsonb, '[]'::jsonb);
ALTER TABLE "Guest" ALTER COLUMN "favoriteItems" SET DEFAULT '[]';

ALTER TABLE "Supplier" ALTER COLUMN "deliveryDays" DROP DEFAULT;
ALTER TABLE "Supplier" ALTER COLUMN "deliveryDays" TYPE JSONB USING COALESCE(NULLIF(btrim("deliveryDays"), '')::jsonb, '[]'::jsonb);
ALTER TABLE "Supplier" ALTER COLUMN "deliveryDays" SET DEFAULT '[]';

ALTER TABLE "HappyHourSchedule" ALTER COLUMN "appliesToIds" DROP DEFAULT;
ALTER TABLE "HappyHourSchedule" ALTER COLUMN "appliesToIds" TYPE JSONB USING COALESCE(NULLIF(btrim("appliesToIds"), '')::jsonb, '[]'::jsonb);
ALTER TABLE "HappyHourSchedule" ALTER COLUMN "appliesToIds" SET DEFAULT '[]';

ALTER TABLE "Integration" ALTER COLUMN "events" DROP DEFAULT;
ALTER TABLE "Integration" ALTER COLUMN "events" TYPE JSONB USING COALESCE(NULLIF(btrim("events"), '')::jsonb, '[]'::jsonb);
ALTER TABLE "Integration" ALTER COLUMN "events" SET DEFAULT '[]';

ALTER TABLE "GuestFeedback" ALTER COLUMN "tags" DROP DEFAULT;
ALTER TABLE "GuestFeedback" ALTER COLUMN "tags" TYPE JSONB USING COALESCE(NULLIF(btrim("tags"), '')::jsonb, '[]'::jsonb);
ALTER TABLE "GuestFeedback" ALTER COLUMN "tags" SET DEFAULT '[]';

ALTER TABLE "Session" ALTER COLUMN "permissions" DROP DEFAULT;
ALTER TABLE "Session" ALTER COLUMN "permissions" TYPE JSONB USING COALESCE(NULLIF(btrim("permissions"), '')::jsonb, '[]'::jsonb);
ALTER TABLE "Session" ALTER COLUMN "permissions" SET DEFAULT '[]';

ALTER TABLE "BiometricCredential" ALTER COLUMN "transports" DROP DEFAULT;
ALTER TABLE "BiometricCredential" ALTER COLUMN "transports" TYPE JSONB USING COALESCE(NULLIF(btrim("transports"), '')::jsonb, '[]'::jsonb);
ALTER TABLE "BiometricCredential" ALTER COLUMN "transports" SET DEFAULT '[]';

ALTER TABLE "KotDocument" ALTER COLUMN "itemsJson" DROP DEFAULT;
ALTER TABLE "KotDocument" ALTER COLUMN "itemsJson" TYPE JSONB USING COALESCE(NULLIF(btrim("itemsJson"), '')::jsonb, '[]'::jsonb);
ALTER TABLE "KotDocument" ALTER COLUMN "itemsJson" SET DEFAULT '[]';

ALTER TABLE "ApiKey" ALTER COLUMN "scopes" DROP DEFAULT;
ALTER TABLE "ApiKey" ALTER COLUMN "scopes" TYPE JSONB USING COALESCE(NULLIF(btrim("scopes"), '')::jsonb, '[]'::jsonb);
ALTER TABLE "ApiKey" ALTER COLUMN "scopes" SET DEFAULT '[]';

-- ─────────────────────────────────────────────────────────────────
-- (1b) ARRAY-tiped stolpci, default '[1,2,3,4,5]'
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE "MealtimeRule" ALTER COLUMN "daysOfWeek" DROP DEFAULT;
ALTER TABLE "MealtimeRule" ALTER COLUMN "daysOfWeek" TYPE JSONB USING COALESCE(NULLIF(btrim("daysOfWeek"), '')::jsonb, '[1,2,3,4,5]'::jsonb);
ALTER TABLE "MealtimeRule" ALTER COLUMN "daysOfWeek" SET DEFAULT '[1,2,3,4,5]';

ALTER TABLE "HappyHourSchedule" ALTER COLUMN "daysOfWeek" DROP DEFAULT;
ALTER TABLE "HappyHourSchedule" ALTER COLUMN "daysOfWeek" TYPE JSONB USING COALESCE(NULLIF(btrim("daysOfWeek"), '')::jsonb, '[1,2,3,4,5]'::jsonb);
ALTER TABLE "HappyHourSchedule" ALTER COLUMN "daysOfWeek" SET DEFAULT '[1,2,3,4,5]';

-- ─────────────────────────────────────────────────────────────────
-- (1c) OBJECT-tiped stolpci, default '{}'
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE "Receipt" ALTER COLUMN "vatBreakdown" DROP DEFAULT;
ALTER TABLE "Receipt" ALTER COLUMN "vatBreakdown" TYPE JSONB USING COALESCE(NULLIF(btrim("vatBreakdown"), '')::jsonb, '{}'::jsonb);
ALTER TABLE "Receipt" ALTER COLUMN "vatBreakdown" SET DEFAULT '{}';

ALTER TABLE "Integration" ALTER COLUMN "config" DROP DEFAULT;
ALTER TABLE "Integration" ALTER COLUMN "config" TYPE JSONB USING COALESCE(NULLIF(btrim("config"), '')::jsonb, '{}'::jsonb);
ALTER TABLE "Integration" ALTER COLUMN "config" SET DEFAULT '{}';

ALTER TABLE "IntegrationLog" ALTER COLUMN "requestData" DROP DEFAULT;
ALTER TABLE "IntegrationLog" ALTER COLUMN "requestData" TYPE JSONB USING COALESCE(NULLIF(btrim("requestData"), '')::jsonb, '{}'::jsonb);
ALTER TABLE "IntegrationLog" ALTER COLUMN "requestData" SET DEFAULT '{}';

ALTER TABLE "IntegrationLog" ALTER COLUMN "responseData" DROP DEFAULT;
ALTER TABLE "IntegrationLog" ALTER COLUMN "responseData" TYPE JSONB USING COALESCE(NULLIF(btrim("responseData"), '')::jsonb, '{}'::jsonb);
ALTER TABLE "IntegrationLog" ALTER COLUMN "responseData" SET DEFAULT '{}';

-- ─────────────────────────────────────────────────────────────────
-- (2) NOVA tabela OrderItemModifier (HIGH del issue #33)
--     DDL pariteten z `prisma migrate diff --from-empty` iznosom.
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "OrderItemModifier" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER,
    "modifierGroupId" TEXT,
    "modifierGroupName" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderItemModifier_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OrderItemModifier_orderItemId_fkey'
  ) THEN
    ALTER TABLE "OrderItemModifier" ADD CONSTRAINT "OrderItemModifier_orderItemId_fkey"
      FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OrderItemModifier_modifierGroupId_fkey'
  ) THEN
    ALTER TABLE "OrderItemModifier" ADD CONSTRAINT "OrderItemModifier_modifierGroupId_fkey"
      FOREIGN KEY ("modifierGroupId") REFERENCES "ModifierGroup"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "OrderItemModifier_orderItemId_idx" ON "OrderItemModifier"("orderItemId");
CREATE INDEX IF NOT EXISTS "OrderItemModifier_modifierGroupId_idx" ON "OrderItemModifier"("modifierGroupId");

-- ─────────────────────────────────────────────────────────────────
-- (3) BACKFILL: legacy OrderItem.modifiersJson → join vrstice
--     Wire shape elementa (src/lib/validations/orders.ts orderItemModifierSchema,
--     zapisovalci: useOrderPanelMutations / kiosk / online-order):
--       { name, price, quantity?, modifierGroupId?, modifierGroupName? }
--     Guard: samo array-shaped, ne-prazni stringi; manjkajoča/ničelna polja →
--     tolerantni snapshot (price 0, quantity NULL, group NULL/'').
--     modifierGroupId je nastavljen SAMO, če ModifierGroup obstaja (sicer NULL,
--     SetNull semantika); ime skupine: DB ime > wire modifierGroupName > ''.
-- ─────────────────────────────────────────────────────────────────

INSERT INTO "OrderItemModifier"
  ("id", "orderItemId", "name", "price", "quantity",
   "modifierGroupId", "modifierGroupName", "sortOrder", "createdAt", "updatedAt")
SELECT
  'oim_' || md5(oi."id" || ':' || (m.ord - 1)::text),
  oi."id",
  COALESCE(m.el->>'name', ''),
  COALESCE((m.el->>'price')::decimal(12,2), 0),
  CASE WHEN m.el ? 'quantity'
        AND jsonb_typeof(m.el->'quantity') = 'number'
       THEN (m.el->>'quantity')::int END,
  mg."id",
  COALESCE(mg."name", NULLIF(m.el->>'modifierGroupName', ''), ''),
  (m.ord - 1),
  NOW(),
  NOW()
FROM "OrderItem" oi
CROSS JOIN LATERAL jsonb_array_elements(oi."modifiersJson"::jsonb)
  WITH ORDINALITY AS m(el, ord)
LEFT JOIN "ModifierGroup" mg
  ON mg."id" = (m.el->>'modifierGroupId')
WHERE oi."modifiersJson" IS NOT NULL
  AND btrim(oi."modifiersJson") NOT IN ('', '[]')
  AND jsonb_typeof(oi."modifiersJson"::jsonb) = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM "OrderItemModifier" oim WHERE oim."orderItemId" = oi."id"
  );
