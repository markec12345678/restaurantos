# 🔒 Security & Architecture Hardening — 11 Audit Issues Resolved

## 📋 Povzetek

Ta PR zapira **vseh 11 odprtih issuejev** iz `AUDIT-REPORT.md` (Issues #31–#44). Vsaka sprememba je bila implementirana s phased pristopom — ohranja backward compatibility, dodaja typed layer nad obstoječo kodo, in postavlja temelje za v1.0.0 release.

| Metrika | Vrednost |
|---|---|
| Commits | 15 |
| Novih testov | 287 (537 → 824, **+53%**) |
| TypeScript napak | 0 |
| Zaprte težave | 11/11 (100%) |
| Novih datotek | 18 |
| Spremenjenih datotek | 14 |
| Vrstic nove kode | ~3.500 |
| Dependencies | +3 (`@simplewebauthn/server`, `@simplewebauthn/browser`, `ioredis`) |

---

## 🎯 Zaprte težave (11 od 11)

### HIGH Priority (3/3)

#### ✅ #31 — Multi-tenant accounting (`locationId`)
- `JournalLine.locationId` denormalizirano (hitre poizvedbe brez JOIN)
- `AccountsPayable.locationId` + Location relation + `@@index`
- `AccountsReceivable.locationId` + Location relation + `@@index`
- 4 API report rute (Trial Balance, P&L, Balance Sheet, General Ledger) sprejemajo `?locationId=`
- 9 novih testov

#### ✅ #32 — SaaS tenant root (Subscription)
- `Location.subscriptionId` + `Subscription.locations[]` relacija
- `getSubscriptionContext()` helper z avto-detection aktivne subscription
- `canAccessLocation()` za lastništvo
- `getLocationIdsForSubscription()` za bulk filter
- 12 novih testov

#### ✅ #33 — JSON-as-String normalization
- 25 inventariziranih JSON polj v `JSON_FIELDS` array
- 11 typed parserjev (`parseOrderItemModifiers`, `parsePermissions`, `parseAllergens`, `parseDeliveryDays`, `parseVatBreakdown`, itd.)
- 2 type-guards (`isOrderItemModifier`, `isPermission`)
- `safeJsonParse(json, fallback)` — never throws
- `getJsonFieldStats()` migracijski dashboard
- 48 novih testov

#### ✅ #34 — CSP nonce-based (`unsafe-inline` removed)
- `generateCspNonce()` — 18 bajtov (144-bit entropy) per-request
- Next.js avtomatsko injektira nonce v `<script>` tag-e
- `unsafe-inline` odstranjen iz `script-src` (prod)
- `unsafe-eval` ostaja samo v dev (HMR)
- 18 novih testov

### MEDIUM Priority (5/5)

#### ✅ #35 — GuestVisit hash chain
- 14 unit testov za existing `createGuestVisitWithChain`
- Nov admin endpoint `GET /api/audit/guest-visit-integrity`
- Audit log `GUEST_VISIT_INTEGRITY_CHECK`

#### ✅ #36 — Shift/StaffShift merge (unified)
- `getUnifiedShifts(filter)` — paralelna query oba modela, merge v `UnifiedShift`
- `getShiftSourceStats()` — migracijski dashboard (0-100%)
- @deprecated komentar na Shift model
- 15 novih testov

#### ✅ #37 — FURS config resolver
- `getFursConfig(locationId?)` — 4-stopnjški fallback:
  1. Location z locationId (multi-tenant)
  2. Prva aktivna Location (auto-detect)
  3. RestaurantSettings (deprecated)
  4. env spremenljivke (FURS_CERT_PATH, itd.)
- `isFursConfigured()`, `getFursConfigSource()`
- Nov admin endpoint `GET /api/furs/config-source`
- @deprecated na RestaurantSettings FURS poljih
- 13 novih testov

#### ✅ #38 — ChartOfAccount FK na JournalLine
- `JournalLine.chartOfAccountCode` optional FK na `ChartOfAccount.code`
- `resolveAccountCode()` helper z validacijo + backward compat
- `validateAccountCodes()` bulk validacija
- `generateJournalForPayment` posodobljen z FK setup
- 12 novih testov

#### ✅ #39 — CacheAdapter (multi-replica)
- `MemoryCacheAdapter` (default, single-instance)
- `RedisCacheAdapter` (multi-replica, ioredis lazy-loaded)
- Factory `getCacheAdapter()` izbere glede na `REDIS_URL`
- WebAuthn challenge store + rate limit uporabljata adapter
- `checkRateLimitAsync()` + sync `checkRateLimit()` wrapper (52 call sites ohranjena)
- 20 novih testov

### LOW Priority (4/4)

#### ✅ #40 — Prisma provider mismatch
- `validateDatabaseConfig()` z `detectProvider` + `maskDatabaseUrl`
- Nov admin endpoint `GET /api/system/db-health`
- `.env.example` popravljen (SQLite path odstranjen, PGlite/postgresql dokumentirana)
- 18 novih testov

#### ✅ #41 — Centralized TS enums
- 14 TS const objects (OrderStatus, OrderType, PaymentStatus, ShiftStatus, AccountType, SubscriptionPlan, FursEnvironment, itd.)
- 14 type-guards (`isOrderStatus`, `isPaymentStatus`, itd.) — catch typo-je
- `ORDER_STATUS_LABELS` (slovenski UI prevodi)
- `enumValues()` helper + `getEnumStats()` dashboard
- 39 novih testov

#### ✅ #42 — IndexedDB store count
- `INDEXEDDB_STORES = ['pendingOrders', 'pendingReceipts']` as const
- `INDEXEDDB_STORE_COUNT = 2` (code-locked, ne more drift-at)
- 4 novi testi

#### ✅ #43 — Soft ref String → FK do Employee
- 4 nova FK polja: `Order.cancelledById`, `StaffShift.createdById`, `PurchaseOrder.requestedById`, `PurchaseOrder.approvedById`
- 4 named Employee back-relations
- `resolveEmployeeRef(softRef)` — prepozna employeeId/email/PIN/ime
- `syncEmployeeRef()` — sinhronizira soft ref + FK
- `getEmployeeRefStats()` migracijski dashboard
- @deprecated komentarji na soft ref poljih
- 13 novih testov

### INFO Priority (1/1)

#### ✅ #44 — i18n consolidation
- `tTranslate(key, locale)` centralni proxy z 3-stopenjskim fallback:
  1. next-intl messages (`messages/*.json`, dotted lookup)
  2. src/lib/i18n (legacy flat keys)
  3. key sam (placeholder)
- `getNextIntlTranslation()` + `getLegacyI18nTranslation()` helpers
- `getI18nStats()` migracijski dashboard z recommendations
- 21 novih testov

---

## 📦 Spremembe po kategorijah

### Ssecurity (Critical)
- WebAuthn/FIDO2 z @simplewebauthn/server (ES256/RS256/EdDSA)
- CSP nonce-based (unsafe-inline odstranjen)
- Soft ref → FK (Employee relations)
- Hash chain audit endpoints (GuestVisit)

### Multi-tenant Architecture
- Subscription → Location (SaaS tenant root)
- Accounting multi-tenant (locationId na AP/AR/JournalLine)
- FURS per-location config resolver

### Type Safety
- 14 TS enum const objects + 14 type-guards
- 25 JSON-as-String fields z typed parserji
- ChartOfAccount FK na JournalLine

### Performance / Scalability
- CacheAdapter pattern (Memory + Redis)
- Multi-replica rate limit (atomic INCR na Redis)
- WebAuthn challenge store z Redis fallback

### Developer Experience
- 11 migracijski dashboard-i (getStats funkcije)
- 5 novi admin diagnostic API endpoints
- @deprecated komentarji z migracijskimi nasveti

---

## 🧪 Testiranje

```bash
# TypeCheck (0 errors)
npx tsc --noEmit

# Test suite (824/824 PASS)
npx vitest run

# Build (successful)
npm run build
```

### Test coverage by feature

| Feature | Testov | Status |
|---|---|---|
| WebAuthn/FIDO2 | 31 | ✅ |
| CSP nonce | 18 | ✅ |
| CacheAdapter (Memory + Redis) | 20 | ✅ |
| Multi-tenant accounting | 9 | ✅ |
| GuestVisit hash chain | 14 | ✅ |
| Subscription context | 12 | ✅ |
| ChartOfAccount FK | 12 | ✅ |
| FURS config resolver | 13 | ✅ |
| Unified Shifts | 15 | ✅ |
| Employee ref resolver | 13 | ✅ |
| i18n consolidation | 21 | ✅ |
| DB config validator | 18 | ✅ |
| IndexedDB stores | 4 | ✅ |
| TS enums | 39 | ✅ |
| JSON fields helpers | 48 | ✅ |
| **Total new tests** | **287** | ✅ |

---

## 🚀 Migracijska pot za production deployment

### Pred merge

1. **Backup trenutne baze** (PGlite ali PostgreSQL)
2. **Review @deprecated komentarje** — pripravi se na Phase 2 migracije
3. **Set environment variables**:
   ```bash
   # Multi-replica production (Vercel/Render/ECS):
   REDIS_URL="redis://user:pass@redis-host:6379"
   DATABASE_URL="postgresql://user:pass@db-host:5432/restaurantos"
   WEBAUTHN_ENABLED="true"  # ali HTTPS origin (auto-enabled)
   NEXTAUTH_URL="https://pos.example.com"
   ```

### Po merge

1. **Zaženi `npm install`** — instalira @simplewebauthn/server, @simplewebauthn/browser, ioredis
2. **Zaženi `npx prisma generate`** — generira nov BiometricCredential model + 4 FK polja
3. **Zaženi `node scripts/init-pglite.mjs`** (dev) ali `npx prisma migrate deploy` (prod)
4. **Zaženi `npm test`** — preveri 824 testov
5. **Zaženi `npm run build`** — preveri produkcijo build

### Post-deploy verification

```bash
# WebAuthn deluje?
curl -X GET https://pos.example.com/api/auth/webauthn -H "Authorization: Bearer $TOKEN"

# CSP z nonce-jem?
curl -I https://pos.example.com | grep -i "content-security-policy"

# DB config valid?
curl -X GET https://pos.example.com/api/system/db-health -H "Authorization: Bearer $ADMIN_TOKEN"

# FURS config source?
curl -X GET "https://pos.example.com/api/furs/config-source?locationId=$LOC_ID" -H "Authorization: Bearer $ADMIN_TOKEN"

# GuestVisit integrity?
curl -X GET https://pos.example.com/api/audit/guest-visit-integrity -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## 🔄 Phased migracijski načrt (za prihodnost)

### Phase 2 (Q1 2027) — Code migration

- [ ] Migriraj vse `checkRateLimit()` sync callerje (52) na `checkRateLimitAsync()`
- [ ] Migriraj vse `cancelledBy`/`approvedBy`/`requestedBy`/`createdBy` soft ref callerje na FK
- [ ] Migriraj vse `t()` (legacy) callerje na `tTranslate()` ali next-intl direktno
- [ ] Migriraj vse `JSON.parse()` callerje na typed `parseXxx()` helperje
- [ ] Uporabi type-guards (`isOrderStatus`, itd.) v API input validaciji

### Phase 3 (v1.0.0) — Schema migration

- [ ] Prisma `enum` tip za statuse (OrderStatus, PaymentStatus, itd.)
- [ ] Prisma `Json` type za JSON-as-String polja (ali FK modeli)
- [ ] Izbriši `Shift` model (po Phase 2 migraciji)
- [ ] Izbriši `src/lib/i18n/` direktorij (po Phase 2)
- [ ] Izbriši RestaurantSettings FURS polja (po potrditvi Location-only)
- [ ] Izbriši `Order.cancelledBy` soft ref (po preveritvi FK coverage)

---

## 📚 Dokumentacija

### Spremenjene datoteke

- `AUDIT-REPORT.md` — vsi 11 issuejev označeni ✅ FIXED s PR referencami
- `README.md` — WebAuthn/CSP status posodobljen (⚠️ → ✅)
- `SECURITY.md` — WebAuthn + CSP nonce sekciji dodani
- `.env.example` — REDIS_URL, WEBAUTHN_ENABLED, DATABASE_URL dokumentacija

### Nove datoteke

- `src/lib/webauthn/` (3 datoteke) — WebAuthn lib
- `src/lib/cache/` (4 datoteke) — CacheAdapter
- `src/lib/enums/` (1 datoteka) — TS enums
- `src/lib/json-fields/` (1 datoteka) — JSON typed helpers
- `src/lib/subscription-context.ts` — SaaS tenant context
- `src/lib/scheduling/unified-shifts.ts` — Shift merger
- `src/lib/accounting/chart-of-accounts.ts` — FK resolver
- `src/lib/auth-middleware/employee-ref-resolver.ts` — Employee ref resolver
- `src/lib/db-config-validator.ts` — DB config validator
- `src/lib/furs/config-resolver.ts` — FURS config resolver
- `src/lib/i18n/i18n-consolidation.ts` — i18n proxy
- `src/lib/middleware/csp-nonce.ts` — CSP nonce generator

### Nove API rute

- `GET /api/auth/webauthn` — WebAuthn challenge (login)
- `POST /api/auth/webauthn` — WebAuthn assertion verify
- `GET/POST /api/auth/webauthn/register` — Biometric registration
- `GET /api/auth/webauthn/credentials` — List credentials
- `DELETE /api/auth/webauthn/credentials/[id]` — Delete credential
- `GET /api/audit/guest-visit-integrity` — Hash chain verify
- `GET /api/furs/config-source` — FURS config diagnostic
- `GET /api/system/db-health` — DB config validator

---

## ⚠️ Breaking changes

**NI breaking changes** — vse spremembe so backward compatible:

- Vsi novi Prisma polja so nullable (FK optional)
- Vsi novi helperji so dodatki (stara koda še deluje)
- @deprecated polja so še vedno prisotna in delujoča
- Sync `checkRateLimit()` wrapper ohranja 52 obstoječih call sites

---

## 🔗 Povezave

- **Branch:** `feature/webauthn-csp-security`
- **Base branch:** `main`
- **Commits:** 15
- **GitHub URL:** https://github.com/markec12345678/restaurantos/tree/feature/webauthn-csp-security

### Predlagani merge strategija

**Squash and merge** — vse 15 commitov postane 1 čist commit na `main`:

```
feat: security & architecture hardening — 11 audit issues resolved (#31-#44)

- WebAuthn/FIDO2 z @simplewebauthn/server (Critical #1 from AUDIT-REPORT)
- CSP nonce-based (unsafe-inline odstranjen)
- Multi-tenant accounting (locationId na AP/AR + reports)
- SaaS tenant root (Subscription → Location)
- CacheAdapter (Memory + Redis) za multi-replica
- Centralni TS enums (14) + JSON typed helpers (25 fields)
- Hash chain audit endpoint (GuestVisit)
- FURS config resolver (per-location)
- 11/11 audit issues resolved, 287 novih testov (537 → 824), 0 TS errors
```

---

## ✅ Checklist pred merge

- [x] Vsi 11 issuejev zaprti v AUDIT-REPORT.md
- [x] 824/824 testov PASS
- [x] 0 TypeScript napak
- [x] Build successful
- [x] Backward compatible (no breaking changes)
- [x] @deprecated komentarji za vse legacy polja
- [x] Migracijski dashboard-i za phased Phase 2
- [x] .env.example posodobljen
- [x] README posodobljen
- [x] SECURITY.md posodobljen

---

## 🙏 Hvala

Ta PR zaključuje večmesečno audit zgodbo — vsi odprti finding-i iz `AUDIT-REPORT.md` so sedaj zaprti. Project je ready za v1.0.0 release po Phase 2 migraciji.
