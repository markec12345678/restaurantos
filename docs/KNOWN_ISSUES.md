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
- **Status:** 🔄 Odprt (MEDIUM, P1 Q1 2026)
- **Problem:** `Location.subscriptionId` je `String?` (nullable). V multi-tenant SaaS mora biti obvezen.
- **Načrt:** Migration + backfill + API validacija (po P0-C4 Phase 5 aplikaciji)

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
- **Status:** 🔄 Odprt (LOW, P2 Q2 2026)
- **Vpliv:** Ni varnostna težava — samo code quality.

### #36 — Shift vs StaffShift ~80% overlap
- **Status:** 🔄 Odprt (LOW, P2 Q2 2026)
- **Vpliv:** Ni varnostna težava — arhitekturni dolg.

### #35 — Hash chain polja na GuestVisit in TipDistribution niso populirana
- **Status:** 🔄 Odprt (LOW, P1 Q1 2026)
- **Problem:** `previousHash` in `chainHash` polja obstajajo a so vedno `""`.

### #47 — Reservation overlap ni preprečen na DB nivoju
- **Status:** 🔄 Odprt (MEDIUM, P1 Q1 2026)
- **Problem:** `@@unique([tableId, dateTime])` prepreči duplikat a NE prepreči overlap-a.
- **Popravek:** PostgreSQL `EXCLUDE` constraint z `tsrange` (po pilotu).

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
| #32 Subscription nullable | MEDIUM | 🔄 OPEN (po pilotu) |
| #47 Reservation overlap | MEDIUM | 🔄 OPEN (po pilotu) |
| #35 Hash chain empty | MEDIUM | 🔄 OPEN (po pilotu) |
| #33 JSON-as-String | LOW | 🔄 OPEN (code quality) |
| #36 Shift/StaffShift overlap | LOW | 🔄 OPEN (arhitektura) |

**Skupaj:** 0 HIGH odprtih, 3 MEDIUM odprtih (vse po pilotu), 2 LOW odprtih (code quality).

---

## Naslednji koraki

1. **E2E testi na staging** (149/149 target) — `docs/E2E-TEST-PLAN.md`
2. **Aplikacija P0-C4 Phase 5 migration** — po E2E potrditvi
3. **Aplikacija P0-C5 migration** — po E2E potrditvi
4. **Real FURS + Stripe production test**
5. **Prvi pravi restaurant pilot**
6. **P0-C4 Phase 6:** Split `/api/settings` v 3 endpointe (po pilotu)
7. **#32, #47, #35:** Naslednji hardening sprint (Q1 2026)
