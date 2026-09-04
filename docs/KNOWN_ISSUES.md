# Known Issues — RestaurantOS v1.0.0

**Datum:** September 2025  
**Status:** Aktivno spremljanje  
**Realna varnostna ocena:** A+ (ne A+++)

---

## ⚠️ Pomembno

README in Security Audit sta bila prej označena z "A+++", kar je bilo **pretirano**. GitHub Issue tracker kaže 4 HIGH in 4 MEDIUM odprte težave, ki jih je treba urediti pred pravo produkcijsko uporabo. Realna ocena je **A+** (dobra, a ne popolna).

---

## HIGH severity (4 odprte)

### #34 — CSP `unsafe-inline` za styles v production
- **Status:** ✅ FIXED (commit v tem PR)
- **Problem:** `style-src` je vseboval `'unsafe-inline'`, kar omogoča XSS preko inline stilov
- **Popravek:** `style-src` sedaj uporablja per-request nonce (enako kot `script-src`). Popolnoma odstranjen `'unsafe-inline'` iz vseh CSP direktiv (middleware + next.config.ts fallback)
- **Datotke:** `src/lib/middleware/security-headers.ts`, `next.config.ts`

### #32 — Subscription (SaaS tenant root) je opcijski
- **Status:** 🔄 Načrtovano (P1, Q1 2026)
- **Problem:** `Location.subscriptionId` je `String?` (opcijsko). V multi-tenant SaaS mora biti obvezen — vsaka lokacija mora imeti subscription
- **Načrt:** 
  1. Dodaj migration: `subscriptionId String` (obvezno)
  2. Backfill: ustvari "default" subscription za obstoječe lokacije
  3. Posodobi API: pri ustvarjanju Location zahtevaj subscriptionId
- **Tveganje:** Brez obveznega subscriptionId ne moremo zaračunavati po lokacijah

### #31 — Accounting modeli imajo opcijski locationId
- **Status:** 🔄 Načrtovano (P1, Q1 2026)
- **Problem:** `JournalEntry.locationId` in `JournalLine.locationId` sta `String?` (opcijsko). Multi-tenant računovodstvo ne deluje pravilno — nekatere transakcije "plavajo" brez lokacije
- **Načrt:**
  1. Dodaj migration: `locationId String` (obvezno) na JournalEntry in JournalLine
  2. Backfill: assign obstoječe vnose na prvo aktivno lokacijo
  3. API: pri ustvarjanju JournalEntry zahtevaj locationId
  4. ChartOfAccount ostaja brez locationId (globalni kontni plan — pravilno)
- **Tveganje:** Brez obveznega locationId so poročila po lokacijah nepopolna

### #33 — 20+ JSON-as-String polj namesto Prisma `Json` tipa
- **Status:** 🔄 Načrtovano (P2, Q2 2026)
- **Problem:** Polja kot `OrderItem.modifiersJson`, `MenuItem.allergens`, `Guest.dietaryPrefs` itd. uporabljajo `String @default("[]")` namesto `Json` tipa. To pomeni:
  - Ni type safety (JSON parse errorji ob runtime)
  - Ni DB-level validacije
  - Težje query-anje (WHERE na JSON vsebini)
- **Prizadeta polja (20+):**
  - `OrderItem.modifiersJson`, `KotDocument.itemsJson`
  - `MealtimeRule.daysOfWeek`, `HappyHourSchedule.daysOfWeek`
  - `MenuItem.allergens`, `MenuItem.dietaryPrefs`
  - `Guest.allergens`, `Guest.dietaryPrefs`, `Guest.dislikes`, `Guest.favoriteItems`
  - `DeliveryZone.postCodes`, `DeliveryZone.cities`
  - `Webhook.events`, `IntegrationLog.details`
  - `Supplier.deliveryDays`, `Discount.appliesToIds`
  - `RestaurantSettings.apiKeys`, `RestaurantSettings.emailReportRecipients`
- **Načrt:**
  1. Migration: spremeni `String @default("[]")` → `Json @default("[]")` 
  2. Data migration: parse obstoječe JSON stringe v pravi Json
  3. Posodobi vse read/write call site-e (odstrani `JSON.parse()` / `JSON.stringify()`)
  4. Dodaj Zod validacijo za JSON strukturo

---

## MEDIUM severity (4 odprte)

### #39 — In-memory rate-limit in WebAuthn challenge storage
- **Status:** 🔄 Načrtovano (P1, Q1 2026)
- **Problem:** `rate-limit/core.ts` uporablja `new Map()` za shranjevanje. Na Vercel (serverless) je vsak API klic v novi funkciji — Map je vedno prazen. Enako za `session-cache.ts` in WebAuthn challenge storage.
- **Posledica:** Rate limiting ne deluje pravilno v produkciji (vsak klic začne s prazno Map). WebAuthn challenge-i se izgubijo med klici.
- **Načrt:**
  1. Implementiraj Redis adapter (Upstash Redis — free tier, serverless-friendly)
  2. Zamenjaj `MemoryCacheAdapter` z `RedisCacheAdapter` v rate-limit
  3. WebAuthn challenge-i shranjuj v Redis z 5-minutno TTL
  4. Session cache: ohrani DB-backed (že delno implementirano v `session-lifecycle.ts`)
- **Workaround (trenutno):** DB-backed session check (že implementirano), FURS rate limit se zanaša na audit log

### #37 — Podvojeni FURS fields (RestaurantSettings vs Location)
- **Status:** 🔄 Načrtovano (P2, Q2 2026)
- **Problem:** `RestaurantSettings` ima `fursCertPath`, `fursCertPassword`, `fursEnvironment` — duplikat `Location` polj. Config resolver (`config-resolver.ts`) obstaja z 4-nivojskim fallback, a polja so še vedno podvojena.
- **Načrt:**
  1. Označi RestaurantSettings FURS polja kot `@deprecated`
  2. Migration: kopiraj vrednosti iz RestaurantSettings → Location (za single-tenant deploy)
  3. Odstrani FURS polja iz RestaurantSettings (breaking change — major version bump)
  4. Posodobi config-resolver: odstrani RestaurantSettings fallback
- **Workaround (trenutno):** Config resolver uporablja Location first, RestaurantSettings samo kot fallback

### #36 — Shift vs StaffShift ~80% overlap
- **Status:** 🔄 Načrtovano (P2, Q2 2026)
- **Problem:** `Shift` in `StaffShift` modela imata ~80% enakih polj (employeeId, date, startTime, endTime, status, locationId, notes). To povzroča zmedo in duplikacijo logike.
- **Načrt:**
  1. Izberi `StaffShift` kot primarni (ima več funkcij: shiftType, role, confirmedAt)
  2. Migration: premakni podatke iz Shift → StaffShift
  3. Odstrani `Shift` model
  4. Posodobi vse API-je in UI, ki referencirajo Shift
  5. `getUnifiedShifts()` helper lahko odstranimo
- **Workaround (trenutno):** `getUnifiedShifts()` helper združi oba modela v skupen format

### #35 — Hash chain polja na GuestVisit in TipDistribution niso populirana
- **Status:** 🔄 Načrtovano (P1, Q1 2026)
- **Problem:** `GuestVisit` in `TipDistribution` imata `previousHash` in `chainHash` polja (za kriptografsko zaščito po EU 852/2004), a se nikoli ne polnita (default `""`).
- **Načrt:**
  1. Ustvari utility `computeChainHash()` v `src/lib/audit/chain-hash.ts`
  2. Pri ustvarjanju GuestVisit/TipDistribution: izračunaj chainHash iz prejšnjega vnosa
  3. Backfill: izračunaj chainHash za obstoječe zapise
  4. Dodaj verify endpoint (podobno kot audit log)
- **Tveganje:** Brez chain hash so GuestVisit/TipDistribution podatki lahko nepopravljeni (brez detekcije)

---

## LOW severity (3 odprte, dokumentirane)

### #43 — 9+ soft reference String polj bi morala biti FK do Employee
- **Status:** 📝 Dokumentirano (P3)
- **Problem:** Polja kot `JournalEntry.postedBy` so `String?` namesto FK do Employee
- **Popravek:** `postedById String?` + FK relacija (že delno implementirano za JournalEntry)

### #41 — 0 enumov, 20+ status/type polj so free-text String
- **Status:** 📝 Dokumentirano (P3)
- **Problem:** Polja kot `Order.status`, `Payment.status` so `String` namesto enum
- **Popravek:** Prisma `enum` tip (ali `as const` union tipi v TypeScript)

### #44 — 3 vzporedni i18n sistemi — konsolidiraj v next-intl
- **Status:** 📝 Dokumentirano (P3)
- **Problem:** next-intl + custom JSON translations + hardcoded slovenščina
- **Popravek:** Migracija vsega na next-intl (glej ADR-012)

---

## Zaključek

RestaurantOS v1.0.0 je **produkciji-pripravljen za pilot stranke** (1-3 lokacije, single-tenant). Za pravi multi-tenant SaaS (10+ strank, več lokacij) morajo biti rešene HIGH težave (#32, #31) in MEDIUM #39 (Redis rate-limit).

**Priporočeni vrstni red popravkov:**
1. ✅ #34 CSP (FIXED v tem commit-u)
2. P1: #35 Hash chain (1 teden)
3. P1: #39 Redis rate-limit (1 teden)
4. P1: #32 Subscription obvezen (3 dni)
5. P1: #31 Accounting locationId obvezen (3 dni)
6. P2: #33 JSON-as-string → Json (2 tedna)
7. P2: #37 FURS duplikati (3 dni)
8. P2: #36 Shift merge (1 teden)

**Skupni napor:** ~6 tednov z 1 FTE za vse HIGH + MEDIUM popravke.
