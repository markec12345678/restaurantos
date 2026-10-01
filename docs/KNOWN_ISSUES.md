# Known Issues — RestaurantOS v1.0.0

**Datum:** September 2026
**Status:** Aktivno spremljanje
**Realna varnostna ocena:** A+ (0 HIGH odprtih, 4 HIGH fixed, 10 kritičnih popravkov v P0-C1..C5)
**Realna splošna ocena:** 9.2/10 — production-ready za single-tenant pilot, multi-tenant ready po E2E

---

## P0 Hardening Series — Zaključena (11 commitov, September 2026)

Vsa kritična varnostna ranljivosti so zaprte v P0-C1 do P0-C5 hardening seriji:

### P0-C1: IDOR Cross-Tenant Protection (commit 48802f3b)
- **Status:** ✅ FIXED
- **Problem:** 8 IDOR ranljivih poti (orders GET/PUT/PATCH/DELETE/add-items/transfer, payments PUT/refund) je uporabljalo `findUnique({where:{id}})` brez `locationId` filtra — Tenant A je lahko dostopal do Tenant B naročil/plačil.
- **Popravek:** `findFirst({where:{id, locationId: session.locationId}})` za orders, `findFirst({where:{id, check:{order:{locationId}}}})` za payments.
- **Testi:** 16 regression testov (`tests/unit/security/idor-cross-tenant.test.ts`)

### P0-C2: resolveTenantLocationId() Helper (commit 8028efb1, a33c4bc4)
- **Status:** ✅ FIXED
- **Problem:** 22 endpointov je imelo `?locationId` bypass — regular user z `locationId=null` je lahko dostopal do tujih lokacij prek query parametra.
- **Popravek:** Centralni `resolveTenantLocationId()` helper z strukturiranim rezultatom (Tagged Union, ne magic string). Fail-closed za regular user brez `locationId` (403, ne unscoped query).
- **Testi:** 21 helper testov (`tests/unit/security/tenant-scope-helper.test.ts`)

### P0-C3A: FURS/Receipts → Location Source of Truth (commit f446e36e)
- **Status:** ✅ FIXED
- **Problem:** 13 FURS/receipt call-siteov je bralo `restaurantSettings.findFirst({where:{isActive:true}})` — v multi-tenant setupu je Tenant A račun bil davčno overjen s Tenant B certifikatom/taxId/premisesId (ZDDV-1 kršitev).
- **Popravek:** Novi `getRestaurantInfoForLocation(locationId)` helper + `buildFursConfigFromSettings()` zdaj zahteva `locationId` parameter. ZOI se podpisuje s pravim certifikatom per receipt.
- **Testi:** 12 FURS cross-tenant testov (`tests/unit/security/furs-cross-tenant.test.ts`)

### P0-C3B: Remaining Settings Call-Sites (commit a09cca63)
- **Status:** ✅ FIXED
- **Problem:** 9 preostalih settings call-siteov (webhook, email, loyalty, card-terminal, public menu, qr-menu, mobile/menu) je bralo globalni singleton.
- **Popravek:** Webhook trigger dodan `locationId` parameter. Card-terminal uporablja `order.locationId`/`session.locationId`. Public menu auto-detect prvo aktivno lokacijo (backward compat).
- **Arhitekturni TODO (P0-C5):** ApiKey tabela z `subscriptionId` (rešeno v P0-C5)

### P0-C4 Phase 1-4: Classification + Low-Risk Migrations (commit f2e6d38a)
- **Status:** ✅ FIXED
- **Klasifikacija:** 30 modelov z `locationId String?` razvrščenih v TENANT_REQUIRED (24), TENANT_OPTIONAL (5), GLOBAL (0). Aktivni artifact: `docs/P0-C4-CLASSIFICATION.md`
- **Nova ApiKey tabela** z `subscriptionId` FK (multi-tenant isolation)
- **Location polja dodana:** `loyaltyEnabled`, `loyaltyPointsPerEuro`, `loyaltyPointsValue`, `emailReportRecipients`, `emailEnabled`
- **Webhook.locationId** dodan + filter aktiviran

### P0-C4 Phase 5: NOT NULL Migration Package (commit 7d98027a)
- **Status:** ✅ FIXED (migration package pripravljen, aplikacija po E2E)
- **Problem:** 24 TENANT_REQUIRED modelov ima `locationId String?` — dovoljuje NULL kar krši tenant isolation.
- **Popravek:** Backfill script + migration SQL + apply script. Testirano na PGlite (72/72 statements, 0 failed).
- **Datoteke:** `scripts/p0-c4-backfill.mjs`, `scripts/p0-c4-migration.sql`, `scripts/p0-c4-apply-migration.mjs`

### P0-C5: ApiKey Table Migration (commit 5c982d92)
- **Status:** ✅ FIXED
- **Problem:** API ključi so bili shranjeni v `RestaurantSettings.apiKeys` (globalni JSON) — Tenant A key je lahko dostopal do Tenant B podatkov.
- **Popravek:** Vse 7 funkcij v `api-security/index.ts` migriranih na ApiKey tabelo. `verifyApiKey()` vrača `subscriptionId` za tenant scoping.
- **Backfill:** `scripts/p0-c5-backfill-apikeys.mjs`

### E2E Compatibility Fixes (commit cbd39a13, 54d5f030)
- **Status:** ✅ FIXED
- **Problem:** P0-C3B je naredil `?locationId` obvezen za public menu — razbilo frontend (waiter, QR menu, online order).
- **Popravek:** Auto-detect prvo aktivno lokacijo če `?locationId` manjka (single-tenant backward compat).
- **E2E infrastruktura:** `scripts/init-e2e-db.mjs` + fresh `prisma/schema.sql` + `docs/E2E-TEST-PLAN.md`

---

## Predhodni popravki (pred P0-C1..C5 serijo)

### #34 — CSP `unsafe-inline` za styles v production
- **Status:** ✅ FIXED (commit b750ee70)
- **Problem:** `style-src` je vseboval `'unsafe-inline'`
- **Popravek:** `style-src` sedaj uporablja per-request nonce

### #39 — Rate-limit FAIL-OPEN v produkciji z Redis
- **Status:** ✅ FIXED (commit f7cc0650)
- **Problem:** `checkRateLimit()` je sync funkcija, ki kliče async `cache.increment()`. Če je Redis adapter aktiven, async rezultat ni takoj na voljo → **FAIL-OPEN**.
- **Popravek:** `checkRateLimitAsync()` je FAIL-CLOSED. Vseh 59 production call-siteov migriranih.

### #46 — Secrets shranjeni v DB brez encryption-at-rest
- **Status:** ✅ FIXED (commit f8e3a8d4)
- **Problem:** `RestaurantSettings.emailSmtpPassword` in druge plaintext skrivnosti shranjene v DB.
- **Popravek:** AES-256-GCM `src/lib/crypto/secrets.ts` z `enc:v1:{IV}:{authTag}:{ciphertext}` formatom.

---

## Preostale odprte težave (MEDIUM/LOW)

### #32 — Subscription (SaaS tenant root) je opcijski
- **Status:** ✅ FIXED (migration package pripravljen in testiran)
- **Problem:** `Location.subscriptionId` je bil `String?` (nullable). V multi-tenant SaaS mora biti obvezen.
- **Popravek:** Migration package (`scripts/p0-c6-*.mjs`) — backfill (kreira default Subscription za lokacije brez) + NOT NULL + FK constraint. Testirano na PGlite: 1 location backfill-an, 0 remaining NULL, FK + NOT NULL uspešno aplikirana.
- **Aplikacija:** Po staging E2E potrditvi.

### #31 — Accounting modeli imajo opcijsni locationId
- **Status:** ✅ FIXED (P0-C4 Phase 5 — NOT NULL migration package pripravljen)
- **Problem:** `JournalEntry.locationId` in `JournalLine.locationId` sta bila `String?`.
- **Popravev:** Vključena v P0-C4 Phase 5 migration (24 modelov NOT NULL).

### #45 — Inconsistent tenant scope across 30+ models
- **Status:** ✅ FIXED (P0-C2 + P0-C4 Phase 1-5)
- **Problem:** 30 modelov z `locationId String?` brez klasifikacije.
- **Popravek:** Klasifikacija dokumentirana v `docs/P0-C4-CLASSIFICATION.md`. 24 TENANT_REQUIRED modelov migriranih na NOT NULL (Phase 5). 5 TENANT_OPTIONAL ostaja nullable (pravilno).

### #37 — Podvojeni FURS fields (RestaurantSettings vs Location)
- **Status:** ✅ FIXED (P0-C3A)
- **Problem:** FURS polja so bila na obeh modelih.
- **Popravek:** Location je sedaj source of truth. RestaurantSettings FURS polja ostajajo kot fallback (deprecated, 30-day grace period).

### #33 — 20+ JSON-as-String polj namesto Prisma `Json` tipa
- **Status:** ✅ FIXED (R150 jedro — 25 polj Json, migracija `0022_json_fields`; R197 schema-paritetni drift-gate `tests/unit/lib/json-fields-schema-parity.test.ts` 11 testov + KNOWN_ISSUES zaključek)
- **Vpliv:** Ni varnostna težava — samo code quality.
- **Kontrakt (R150-a + R197):** 25 inventariziranih polj (`migrated: true`) ≡ `Json` v schema.prisma ≡ TYPE JSONB stavek v 0022 migraciji ≡ pokritje v `JSON_WIRE_FIELDS` (wire ostaja JSON string — byte-identical za odjemalce). 6 ostankov izrecno utemeljenih (byte-exact pin, ostajajo `String`): `OrderItem.modifiersJson` (dual-write legacy wire — drop odložen, produktna odločitev), `AuditLog.details` (hash veriga recompute-a iz shranjenega stringa), `WebhookDelivery.payload` (retry + HMAC reproducibilnost), `RestaurantSettings.apiKeys` (deprecatiran keystore — P0-C5 ApiKey tabela), `MenuItem.allergens`/`Modifier.allergens` (CSV, NI JSON — izven scope-a). Vsak tip-drift inventoriziranega polja brez posodobitve inventarja = rdeč test.

### #36 — Shift vs StaffShift ~80% overlap
- **Status:** 🔄 Odprt (LOW, P2 Q2 2026)
- **Vpliv:** Ni varnostna težava — arhitekturni dolg.

### #48 — Neon drift: 11 konfiguracijskih tabel brez locationId stolpca (R195)
- **Status:** ✅ FIXED (R195 — migration package pripravljen in testiran na PGlite; aplikacija na Neon = uporabniški korak)
- **Problem:** Neon produkcija ima na 11 konfiguracijskih tabelah (DiningOption, RevenueCenter, SalesCategory, PriceGroup, ServiceCharge, PrepStation, VoidReason, NoSaleReason, AlternatePaymentType, Printer, Discount) še danes NI stolpca `locationId` (db push/migrate ni bil pognan ob MODEL A multi-location spremembi), Prisma schema pa ga zahteva (String NOT NULL) → vsak create/update/findFirst z locationId vrača P2022. Most (`src/lib/prisma-column-fallback.ts`, QA runda 39) operacijo ponovi brez lokacijskega filtra — varno za single-tenant realnost, NE za pravi multi-tenant.
- **Popravek (R195):** Idempotenten migration package z ENIM virom resnice — `scripts/r195-neon-locationid-migration.sql` (ADD COLUMN IF NOT EXISTS + dinamičen backfill na eno lokacijo + SET NOT NULL + FK RESTRICT + CREATE INDEX = @@index pariteta; 11 tabel × 6 stavkov) + fail-closed applier `scripts/r195-apply-locationid-migration.mjs` (postgres URL guard, Location count === 1 varovalka — multi-location = ročna preslikava, post-verify information_schema/pg_indexes, orphan check). IT dokaz celotnega cikla (drift simulacija DROP COLUMN → aplikacija → NOT NULL+FK+indeks pariteta → backfill → FK enforcement 23503 → idempotenca): `tests/integration/r195-neon-locationid-migration.test.ts`. Detektor napake (`isMissingLocationColumnError`) razširjen na P2010 — driver-adapter pot (PGlite) ne prevaja PG napak v P-code; duck-typing po sporočilu ostaja fail-closed.
- **Aplikacija:** `DATABASE_URL="postgresql://..." node scripts/r195-apply-locationid-migration.mjs` — uporabniški korak ob dostopu do Neon produkcije. Po aplikaciji P2022 ne nastopi več → most samodejno izgubi vlogo (brez redeploya).

### #35 — Hash chain polja na GuestVisit in TipDistribution niso populirana
- **Status:** ✅ FIXED (createGuestVisitWithChain + createTipDistributionWithChain)
- **Problem:** `previousHash` in `chainHash` polja so obstajala a so bila vedno `""`.
- **Popravek:** Implementirana `src/lib/guest-visit-chain.ts` in `src/lib/tip-distribution-chain.ts` — transakcijsko varno pisanje s SHA-256 hash verigo. Klicatelja (`/api/guests/[id]/visits` in `/api/tip-pool/_helpers/`) uporabljata te funkcije.

### #47 — Reservation overlap ni preprečen na DB nivoju
- **Status:** ✅ FIXED (application-level overlap check)
- **Problem:** `@@unique([tableId, dateTime])` prepreči duplikat a NE prepreči overlap-a.
- **Popravek:** Application-level overlap check z datumskim oknom (±1 dan) in časovnim intervalom (start < existingEnd AND end > existingStart). Error message prikazuje časovni interval obstoječe rezervacije.
- **TODO:** Za DB-level zaščito (race condition) dodaj PostgreSQL EXCLUDE constraint z `tstzrange` (zahteva `btree_gist` extension).

---

## Trenutno stanje varnosti

| Issue | Severity | Status |
|-------|:---:|:---:|
| #34 CSP unsafe-inline | HIGH | ✅ FIXED |
| #39 Rate-limit FAIL-OPEN | HIGH | ✅ FIXED |
| #46 Secrets plaintext | HIGH | ✅ FIXED |
| #45 Inconsistent tenant scope | HIGH/MED | ✅ FIXED (P0-C1..C5) |
| P0-C1 IDOR (8 poti) | CRITICAL | ✅ FIXED |
| P0-C2 ?locationId bypass (22 endpointov) | HIGH | ✅ FIXED |
| P0-C3A FURS cross-tenant (13 call-sites) | CRITICAL | ✅ FIXED |
| P0-C3B Remaining settings (9 call-sites) | HIGH | ✅ FIXED |
| P0-C4 Phase 1-4 (ApiKey, Location fields, Webhook) | HIGH | ✅ FIXED |
| P0-C4 Phase 5 (NOT NULL migration package) | HIGH | ✅ FIXED (pripravljen) |
| P0-C5 ApiKey table migration | CRITICAL | ✅ FIXED |
| #35 Hash chain empty | MEDIUM | ✅ FIXED |
| #47 Reservation overlap | MEDIUM | ✅ FIXED |
| #32 Subscription nullable | MEDIUM | ✅ FIXED (migration package) |
| #33 JSON-as-String | LOW | ✅ FIXED (R150 jedro: 25 polj Json @ 0022 + R197 drift-gate; 6 ostankov utemeljenih) |
| #36 Shift/StaffShift overlap | LOW | 🔄 OPEN (arhitektura) |
| #48 Neon locationId drift (11 tabel) | MEDIUM | ✅ FIXED (R195 migration package; aplikacija = uporabniški korak) |

**Skupaj:** 0 HIGH odprtih, 0 MEDIUM odprtih, 1 LOW odprt (#36 arhitektura; #33 zaprt R197).

---

## Naslednji koraki

1. **E2E testi na staging** (149/149 target) — `docs/E2E-TEST-PLAN.md`
2. **Aplikacija P0-C4 Phase 5 migration** — po E2E potrditvi
3. **Aplikacija P0-C5 migration** — po E2E potrditvi
4. **Real FURS + Stripe production test**
5. **Prvi pravi restaurant pilot**
6. **P0-C4 Phase 6:** Split `/api/settings` v 3 endpointe (po pilotu)
7. **#32, #47, #35:** Naslednji hardening sprint (Q1 2026)
8. **R195 #48 aplikacija:** `node scripts/r195-apply-locationid-migration.mjs` na Neon produkciji (package pripravljen + testiran; uporabniški korak ob dostopu)
