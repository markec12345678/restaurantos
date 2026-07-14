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
- **WebAuthn/FIDO2** — biometrična prijava (Touch ID, Face ID, Windows Hello)
- **Rate limiting** na vseh javnih endpointih (login, qr-menu, feedback, webhooks)

### Podatkovna integriteta
- **AuditLog** z SHA-256 hash verigo (tamper-evident)
- **HMAC tokens** za digitalne račune (preprečuje enumeracijo)
- **Zod validacija** na strežniku in odjemalcu
- **Prisma `$transaction`** za atomicne operacije

### Spletne ranljivosti
- **Webhook signature verification** (HMAC-SHA256) za Glovo/Wolt
- **`timingSafeEqual`** za primerjavo podpisov (timing-attack odporno)
- **`execFileSync`** namesto `execSync` za OpenSSL CLI (preprečuje shell injection)
- **SSRF zaščita** v webhook delivery engine

### FURS skladnost
- **RSA-SHA256 podpisovanje** ZOI s pravim privatnim ključem
- **V produkciji ne pade tiho** na SHA256 fallback (ZDDV-1 skladnost)
- **Slovenski čas (CET/CEST)** izričen v ZOI (preprečuje server-time bug)

### Spremljanje
- **Gitleaks** v CI — preprečuje commit skrivnosti
- **bun audit** — pregled odvisnosti za znane CVE-je
- **AuditLog** — vsako administrativno dejanje je zabeleženo

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
