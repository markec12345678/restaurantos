# Known Issues — RestaurantOS v1.0.0

**Datum:** September 2026  
**Status:** Aktivno spremljanje  
**Realna varnostna ocena:** A- (ne A+ ali A+++)  
**Realna splošna ocena:** 8.6/10 — pilot-ready with known risks

---

## ⚠️ Pomembno

README je bil prej označen z "A+++", kar je bilo **pretirano**. Po globokem pregledu dejanske kode (ne samo povzetka) je realna ocena **A-** z 3 HIGH odprtimi težavami in 6 MEDIUM odprtimi težavami, ter dodatnimi arhitekturnimi vprašanji.

---

## HIGH severity (3 odprte, 1 fixed)

### #34 — CSP `unsafe-inline` za styles v production
- **Status:** ✅ FIXED (commit b750ee70)
- **Problem:** `style-src` je vseboval `'unsafe-inline'`
- **Popravek:** `style-src` sedaj uporablja per-request nonce

### #39 — Rate-limit FAIL-OPEN v produkciji z Redis
- **Status:** 🔴 NI REŠEN (prej napačno označen kot FIXED)
- **Problem:** `checkRateLimit()` je sync funkcija, ki kliče async `cache.increment()`. Če je Redis adapter aktiven, async rezultat ni takoj na voljo → **FAIL-OPEN** (dovoli request brez rate limit). To je varnostna napaka.
- **Koda:** `src/lib/rate-limit/core.ts` vrstica 108: `return { allowed: true }` ko Redis ne odgovori
- **Popravek (P1, Q1 2026):**
  1. Migriraj vse 52 sync call-site-e na `checkRateLimitAsync()` z `await`
  2. Odstrani sync `checkRateLimit()` ali označi kot `@deprecated`
  3. MemoryCacheAdapter naj implementira async interface
  4. Preveri da noben production path ne fail-open
- **Tveganje:** Brez pravilnega rate limit-a so brute-force in DDoS napadi možni

### #32 — Subscription (SaaS tenant root) je opcijski
- **Status:** 🔴 Odprt (P1, Q1 2026)
- **Problem:** `Location.subscriptionId` je `String?` (nullable). V multi-tenant SaaS mora biti obvezen.
- **Načrt:** Migration + backfill + API validacija

### #46 — Secrets shranjeni v DB brez encryption-at-rest (NOVO)
- **Status:** 🔴 Odprt (P1, Q1 2026)
- **Problem:** `RestaurantSettings.emailSmtpPassword` je plaintext `String`. Schema komentira "naj bo encrypted v produkciji" ampak to ni implementirano. Enako za `apiKeys` (JSON string z hashed API ključi, a sam JSON je plaintext).
- **Prizadeti secreti:**
  - `RestaurantSettings.emailSmtpPassword` — plaintext SMTP geslo
  - `RestaurantSettings.apiKeys` — JSON z API ključi
  - `Location.fursCertPassword` — plaintext FURS cert geslo
- **Načrt:**
  1. Implementiraj `encrypt()` / `decrypt()` z AES-256-GCM
  2. Encryption key iz environment variable (ENCRYPTION_KEY)
  3. Migration: encrypt obstoječe plaintext secret-e
  4. Application layer: vedno `decrypt()` pred uporabo
- **Tveganje:** Kompromis baze = izpostavljeni SMTP, FURS, API credentials

---

## MEDIUM severity (6 odprtih)

### #31 — Accounting modeli imajo opcijsni locationId
- **Status:** 🔄 Odprt (P1, Q1 2026)
- **Problem:** `JournalEntry.locationId` in `JournalLine.locationId` sta `String?`. Možen inconsistency: `JournalLine.locationId != JournalEntry.locationId`.
- **Rešitev:** Ali (A) odstrani JournalLine.locationId in JOIN na JournalEntry, ali (B) NOT NULL + application invariant

### #33 — 20+ JSON-as-String polj namesto Prisma `Json` tipa
- **Status:** 🔄 Odprt (P2, Q2 2026)

### #45 — Inconsistent tenant scope across 30+ location-linked models (NOVO)
- **Status:** 🔄 Odprt (HIGH/MEDIUM, P1 Q1 2026)
- **Problem:** README pravi "8 tabel z locationId", a dejansko je **30 modelov** z `locationId String?`. Nekateri so pravilno nullable (globalni kontni plan), drugi bi morali biti obvezni. Ni jasno definirano kateri modeli so tenant-scoped in kateri globalni.
- **Načrt:**
  1. Sistematičen audit vseh 30 modelov z locationId
  2. Klasificiraj: obvezni tenant-scoped vs. globalni vs. opcijski
  3. Za obvezne: migration NOT NULL + API validacija
  4. Dokumentiraj tenant scope v ARCHITECTURE.md

### #37 — Podvojeni FURS fields (RestaurantSettings vs Location)
- **Status:** 🔄 Odprt (P2, Q2 2026)

### #36 — Shift vs StaffShift ~80% overlap
- **Status:** 🔄 Odprt (P2, Q2 2026)

### #35 — Hash chain polja na GuestVisit in TipDistribution niso populirana
- **Status:** 🔄 Odprt (P1, Q1 2026)
- **Problem:** `previousHash` in `chainHash` polja obstajajo a so vedno `""`.
- **Pravna referenca popravljena:** Prej je dokumentacija napačno sklicevala na "EU 852/2004" (uredba o higieni živil). To NI pravna podlaga za hash chain. Pravilno: "tamper-evident audit trail" brez specifične pravne reference.

---

## REZERVACIJE — Overlap problem (NOVO)

### #47 — Reservation overlap ni preprečen na DB nivoju (NOVO)
- **Status:** 🔄 Odprt (MEDIUM, P1 Q1 2026)
- **Problem:** `Reservation` ima `@@unique([tableId, dateTime])` ki prepreči duplikat (ista miza, isti čas), a NE prepreči **overlap-a**:
  - Rezervacija 1: Miza 5, 19:00, trajanje 120 min (19:00-21:00)
  - Rezervacija 2: Miza 5, 20:00, trajanje 120 min (20:00-22:00)
  - Obe sta unikatni (različen dateTime), a se prekrivata!
- **Popravek:**
  1. Application-level: `handleCreateReservation()` naj preveri overlap (mora že delati, a ni garantiran)
  2. DB-level: PostgreSQL `EXCLUDE` constraint z `tsrange` za preprečevanje overlap-a
  3. Race condition: transaction + `SELECT ... FOR UPDATE` ali `SERIALIZABLE` isolation
- **Tveganje:** Dvojna rezervacija mize v produkciji

---

## DOKUMENTACIJSKE NESKLADNOSTI

### README competitive table — A+++ → A+ (FIXED)
- **Status:** ✅ FIXED v tem commit-u

### KDS paradoks (FIXED)
- **Status:** ✅ FIXED — KDS je implementiran, README posodobljen

### Security Audit PDF — A++ (zastarelo)
- **Status:** 📝 PDF označi kot "Historical audit — superseded by current security review"
- README link še vedno pravi "A++ security score" — posodobiti opis

### PWA vs Offline zmeda
- **Status:** 📝 README pravi "Offline ✅" in "PWA ⏳" — to je lahko zavajujoče
- Pojasnilo: Offline infrastruktura (IndexedDB, SW cache) deluje, a popoln PWA (installable, push notifications) še ni produkcijsko-ready

### Admin PIN objavljen v README (FIXED)
- **Status:** ✅ FIXED — PIN-i sedaj opozorijo da so samo za demo

---

## Priporočeni Hardening Sprint (P0)

**Cilj:** 0 HIGH odprtih, 149/149 E2E PASS, tenant isolation audit.

1. **P0-1:** #39 Rate-limit → async-only (1 teden)
2. **P0-2:** #46 Secrets encryption (3 dni)
3. **P0-3:** #32 Subscription obvezen (2 dni)
4. **P0-4:** #31 Accounting locationId invariant (3 dni)
5. **P0-5:** #45 Tenant scope audit (1 teden)
6. **P0-6:** #47 Reservation overlap (2 dni)
7. **P0-7:** #35 Hash chain populacija (1 teden)

**Skupni napor:** ~5 tednov z 1 FTE za vse P0 popravke.

Po P0: Security re-audit → če 0 HIGH → E2E 149/149 → tenant isolation audit → REAL pilot.
