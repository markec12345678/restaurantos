# 🔒 Security Policy

## Supported Versions

RestaurantOS je v aktivnem razvoju. Varnostne popravke sprejemamo za najnovejjo
vejo `main`. Za starejše različice ne zagotavljamo backportov.

| Version | Supported          |
|---------|--------------------|
| main    | ✅                  |
| drugo   | ❌                  |

## 📣 Reporting a Vulnerability

**Hvala, da pomagaš ohranjati RestaurantOS varen.** Če odkriješ varnostno
ranljivost, **prosimo, da je ne objaviš javno** (GitHub Issues, social media) dokler
je ne pregledamo in popravimo.

### Postopek prijave

1. **Pošlji e-mail na:** `security@restaurantos.example` *(nadomesti s pravim kontaktom)*
2. **V sporočilu vključi:**
   - Opis ranljivosti in njen vpliv
   - Korake za reprodukcijo (PoC, če ga imaš)
   - Affected version (commit SHA ali tag)
   - Morebitne predloge za popravilo
3. **Odzivni čas:** odgovorili bomo v **48 urah** s potrditvijo prejema.
4. **Čas do popravka:** kritične ranljivosti popravimo v **7 dneh**, ostale v **30 dneh**.
5. Po popravku te bomo kreditirali v `SECURITY.md` (če želiš ostati anonimen, povej).

### Kar prosimo, da NE storiš

- ❌ Ne objavljaj ranljivosti v GitHub Issues pred popravkom
- ❌ Ne izkoriščaj ranljivosti na produkcijskih namestitvah drugih uporabnikov
- ❌ Ne zahtevaj finančne kompenzacije — projekt je odprtokodni in prostovoljni

### Kar je dobrodošlo

- ✅ Poizkusi reproducirati na lastni namestitvi (test environment)
- ✅ Predlagaj mitigacijo ali popravek (PR dobrodošel po prior poročilu)
- ✅ Pošlji PGP-šifrirano sporočilo, če vsebuje občutljive podatke

## 🛡️ Security Measures Implemented

RestaurantOS uporablja večplastno varnostno arhitekturo:

### Avtentikacija & Avtorizacija
- **PIN-based auth** z bcrypt + HMAC-SHA256 za O(1) lookup
- **RBAC** — `requireAuth(req, { permission: 'admin' })` na 132/152 API-jih
- **WebAuthn/FIDO2** — ⚠️ EKSPERIMENTALNO/ONEMOGOČENO (preverjanje podpisa ni implementirano; glej PR #30)
- **Rate limiting** na vseh javnih endpointih (login, qr-menu, feedback, webhooks)
- **Session invalidation** ob terminaciji zaposlenega (verifyToken preverja status, 60s cache; glej PR #53)

### Podatkovna integriteta
- **AuditLog** z SHA-256 hash verigo (tamper-evident, transakcijsko varen)
- **HACCP hash chain** — transakcijsko varen (prejšnja implementacija je bila racy; glej PR #30)
- **TipDistribution hash chain** — implementiran (glej PR #45)
- **HMAC-SHA256 tokens** za digitalne račune (prejšnja DJB2 implementacija je bila brute-forceable; glej PR #30)
- **Zod validacija** na strežniku (98+ shem) in odjemalcu (reserve, order forme; glej PR #48, #49)
- **Prisma `$transaction`** za atomicne operacije (53+ call sites)

### Spletne ranljivosti
- **Webhook signature verification** (HMAC-SHA256) za Glovo/Wolt
- **`timingSafeEqual`** za primerjavo podpisov (timing-attack odporno)
- **`execFileSync`** namesto `execSync` za OpenSSL CLI (preprečuje shell injection)
- **SSRF zaščita** v webhook delivery engine (zavrača 127.x, 169.254.x, RFC1918, .local/.internal/.test TLD; glej test tests/unit/webhook/ssrf.test.ts)
- **CSP** z `unsafe-inline` za scripts (nonce-based CSP je TODO — issue #34)
- **HSTS** preload, X-Frame-Options SAMEORIGIN, COOP/CORP same-origin

### Secrets masking (API odgovori)
- **pin / pinLookup** — maskirano v vseh employees API odgovorih (PR #48, #50)
- **fursCertPassword / fursCertPath** — maskirano v locations + settings (PR #45, #50, #51)
- **emailSmtpPassword** — maskirano v settings (PR #51)
- **webhook secret** — maskirano v vseh webhooks API odgovorih (PR #45, #50)
- **integration apiKey / apiSecret** — maskirano v vseh integrations API odgovorih (PR #51)
- **receipt token** — pravi HMAC-SHA256 (ne DJB2; PR #30)

### FURS skladnost
- **RSA-SHA256 podpisovanje** ZOI s pravim privatnim ključem
- **V produkciji ne pade tiho** na SHA256 fallback (fail-fast; glej PR #30)
- **Slovenski čas (CET/CEST)** izričen v ZOI (preprečuje server-time bug)
- **FURS_ALLOW_SIMULATION** default `false` (prej `true` — glej PR #45)

### IoT & HACCP
- **IoT readings** zahtevajo `X-IoT-Api-Key` header (prej brez auth; glej PR #30)
- **HACCP entries** se kreirajo znotraj `$transaction` (prej race-prone; glej PR #30)

### Spremljanje
- **Gitleaks** v CI — preprečuje commit skrivnosti
- **bun audit** — pregled odvisnosti za znane CVE-je
- **AuditLog** — vsako administrativno dejanje je zabeleženo

### Race condition fixes
- **Counter-based number generation** za orderNumber, apNumber, arNumber (prej `count+1`; glej PR #30)
- **Idempotent payments** z `idempotencyKey` (fast-path + P2002 race-path + DB unique)

### Audit & Diagnostic API endpoints (admin-only)

Ti endpoint-i so dodani za varnostni monitoring in diagnosticiranje:

| Endpoint | Opis | PR |
|---|---|---|
| `GET /api/system/db-health` | Preveri veljavnost DATABASE_URL konfiguracije (provider mismatch detection) | #66 |
| `GET /api/furs/config-source?locationId=xxx` | Diagnostika odkod FURS certifikat prihaja (Location/Settings/env) | #62 |
| `GET /api/audit/guest-visit-integrity` | Preveri integriteto GuestVisit hash verige (EU 852/2004) | #59 |
| `GET /api/auth/webauthn/credentials` | Seznam registriranih biometričnih poverilnic | #55 |

### Multi-tenant SaaS izolacija (PR #60, #58)

- **Subscription → Location hierarhija** — `Location.subscriptionId` FK
- **`getSubscriptionContext()`** helper za tenant-aware poizvedbe
- **`canAccessLocation()`** preveri lastništvo lokacije
- **Accounting multi-tenant** — `locationId` na JournalLine, AP, AR + report filterji
- **FURS per-location** — vsaka lokacija ima svoj certifikat + premisesId

### Type safety layer (PR #68, #69, #61, #64)

- **14 TS enumov** (OrderStatus, PaymentStatus, AccountType, itd.) z 14 type-guards
- **25 JSON typed parserjev** za JSON-as-String polja (parseOrderItemModifiers, itd.)
- **ChartOfAccount FK** na JournalLine z `resolveAccountCode()` validacijo
- **4 nova Employee FK** (cancelledById, createdById, requestedById, approvedById) z `resolveEmployeeRef()` migracijskim helperjem

## 🔐 Credential Hygiene

- `.env` je v `.gitignore` (lokacije: `.env`, `.env*.local`, `.env.production.local`)
- Certifikati so ignorirani: `*.pem`, `*.key`, `*.cert`, `*.p12`, `*.pfx`
- SQLite baze so ignorirane: `*.db`, `*.sqlite`, `*.sqlite3`
- `.env.example` vsebuje samo placeholdre (NIKOLI realne vrednosti)

### Če si commit-al skrivnost

1. **Takoj prekliči skrivnost** (rotate token/password)
2. Ne rabiš brisati iz zgodovine, ČE je bila skrivnost rotirana — zgodovina je nepopravljiva
3. Če želiš vseeno počistiti: uporabi `scripts/clean-history.sh` (git-filter-repo)

## 📜 License

RestaurantOS je licenciran pod MIT. Varnostni prispevki so dobrodošli pod enako
licenco.

---

**Hvala vsem raziskovalcem, ki poročajo odgovorno.** 🙏
