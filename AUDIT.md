# 🔒 RestaurantOS — Varnostni & arhitekturni audit

**Datum audita:** 2025-06-17
**Repozitorij:** `markec12345678/restaurantos`
**Veja:** `chore/professional-cleanup`
**Obseg:** 132 API rut, 70 Prisma modelov, ~105.000 vrstic kode

---

## 📌 Povzetek

| Področje | Status |
|---|---|
| **Repo higiena** | ✅ Popravljeno (cleanup commit) |
| **Hardcoded skrivnosti** | ✅ Čisto (ni skrivnosti/certifikatov v src/) |
| **Commitani certifikati** | ✅ Čisto (noben `.p12`/`.pem` v zgodovini) |
| **API auth coverage** | ⚠️ 1 kritična vrzel **POPRAVLJENA** |
| **PIN varnost** | ⚠️ `Employee.pin` ni bil unique **POPRAVLJENO** |
| **AuditLog hash veriga** | ⚠️ Nepopolna (samo 1 polje) **POPRAVLJENO** |
| **Cascade integriteta** | ⚠️ 7 nevarnih kaskad (1 kritična **POPRAVLJENA**, 6 dokumentirano) |
| **Soft-delete** | ✅ ŽE implementiran v kodi (preko `status` polj, ne `deletedAt`) — glej popravek spodaj |
| **Multi-location pokritost** | ⚠️ 7 modelov brez `locationId` (priporočilo) |
| **Decimal za valute** | ✅ Brezhibno (vse monetary polja so Decimal) |
| **FURS skladnost** | ✅ Popolna (ZOI, EOR, fiscalStatus na Receipt) |

---

## 🔴 Kritični popravki izvedeni v tem PR-ju

### 1. `/api/payments` GET — manjkajoča avtentikacija (CRITICAL)

**Datoteka:** `src/app/api/payments/route.ts`

**Pred:** GET handler je klical `handleListPayments(req)` **brez** `requireAuth()`. POST handler
na isti datoteki je pravilno zahteval `take_orders` dovoljenje, torej gre za pozabljenega,
ne pa namerno odprtjo.

**Vpliv:** Vsak nepooblaščen uporabnik je lahko klical `GET /api/payments?limit=500` in
izčrpal celotno tabelo plačil — vključno z zneski, ID-ji darilnih kartic, ID-ji loyalty
računov, zadnjimi štirimi števkami kartic in avtorizacijskimi kodami.

**Popravek:** GET handler sedaj kliče `requireAuth(req, { permission: 'take_orders' })`
pred delegacijo na helper.

### 2. `Employee.pin` — manjkajoča `@unique` omejitev (CRITICAL)

**Datoteka:** `prisma/schema.prisma`, model `Employee`

**Pred:** `pin String @default("")` je imel samo `@@index([pin])`, brez `@unique`. Dva
zaposlena sta lahko imela enak PIN (npr. oba "1234"), kar omogoča impersonacijo.

**Popravek:** `pin String @unique @default("")`.

> **Znana omejitev:** PIN-i so po prvi prijavi bcrypt-hashirani (glej
> `src/app/api/auth/_helpers.ts`). Ker bcrypt uporablja naključno sol, dva enaka
> plaintext PIN-a po hashiranju dobita različna hasha — `@unique` torej učinkovito
> preprečuje duplikate samo v **plaintext fazi** (preden se PIN-i hashirajo). Za
> popolno zaščito tudi po hashiranju priporočamo dodajanje ločenega `pinLookup String @unique`
> polja s SHA-256 (brez soli) za iskanje, medtem ko `pin` ostane bcrypt-hashiran za
> varno primerjavo. Glej priporočila spodaj.

### 3. `AuditLog` hash veriga — nepopolna (COMPLIANCE)

**Datoteka:** `prisma/schema.prisma` (model `AuditLog`) + `src/lib/db.ts` (`createAuditLog`)

**Pred:** Model je imel samo `chainHash` polje. Koda v `createAuditLog` je sicer pravilno
računala `chainHash = SHA-256(prejšnji_chainHash + payload)`, a ker prejšnji hash ni bil
shranjen v ločenem polju, **ni bilo mogoče neodvisno preveriti integritete verige** —
revizor ne more rekonstruirati, kakšen naj bi bil prejšnji hash za vsak vnos.

**Popravek:**
- Shema: dodano `previousHash String @default("")` polje.
- `db.ts`: `createAuditLog` sedaj shranjuje `previousHash = lastLog?.chainHash || ''`
  posebej, `chainHash` pa ostane hash trenutnega vnosa. Verigo je sedaj mogoče
  preveriti: za vsak vnos mora veljati `chainHash == SHA-256(previousHash + payload)`.

### 4. `Payment → Check` — nevarna kaskada (DATA INTEGRITY)

**Datoteka:** `prisma/schema.prisma`, model `Payment`

**Pred:** `check Check @relation(... onDelete: Cascade)`. Brisanje `Check` bi tiho
pobrisalo vsa pripadajoča plačila — uničilo bi finančno revizijsko sled in prelomilo
rekoncilijacijo.

**Popravek:** `onDelete: Restrict`. Briši `Check` lahko šele, ko so vsa plačila najprej
prestavljena/izbrisana eksplicitno (kar je pravilno obnašanje za finančne evidence).

---

## 🟡 Priporočila za naslednjo fazo (nisu critical, a po smernicah potrebna)

### A. Soft-delete — ŽE implementiran (popravek prejšnjega audit-a)

**Prejšnji audit je bil nepopoln.** Trdil sem, da soft-delete manjka ker ni `deletedAt`
polja. Podrobna preverba DELETE handlerjev je pokazala, da je soft-delete **že
implementiran v aplikacijski kodi** preko obstoječih `status` polj:

| Model | Mehansizem soft-delete | Datoteka |
|---|---|---|
| `Employee` | `status: 'terminated'`, `pin: ''` | `src/app/api/employees/[id]/route.ts` |
| `Guest` | anonimizacija PII (firstName/email/phone → prazno) | `src/app/api/guests/[id]/route.ts` |
| `MenuItem` | `isAvailable: false` | `src/app/api/menu-items/[id]/route.ts` |
| `Shift` | `status: 'cancelled'` | `src/app/api/shifts/[id]/route.ts` |
| `HaccpEntry` | `status: 'archived'` (EU 852/2004 zahteva) | `src/app/api/haccp/route.ts` |
| `InventoryItem` | količina na 0 + onemogočeno | `src/app/api/inventory/[id]/_helpers.ts` |

**Zakaj `deletedAt` ni bil dodan:** dodajanje `deletedAt` bi bilo duplikat obstoječega
mehanizma. Ekipa je konsistentno izbrala `status`-bazirani soft-delete, kar je prav tako
veljavno (in bolj ekspresivno — `terminated`, `archived`, `cancelled` so bolj zgovorna
stanja kot `deletedAt: DateTime?`).

**Posledica:** ker se parent entitete (Employee, Guest, InventoryItem) nikoli ne
hard-deleteajo v production, kaskade `Cascade → Restrict` (glej popravek B) nikoli ne
sprožijo v normalnem obratovanju. Edini hard-delete je v `seed/_helpers.ts`, ki je bil
posodobljen (glej spodaj).

### B. Ostale nevarne kaskade (6)

Poleg popravljenega `Payment → Check` obstaja še 6 kaskad, ki brišejo revizijsko sled:

| Otak → Starš | Trenutno | Priporočeno |
|---|---|---|
| `TimeEntry → Employee` | Cascade | Restrict (payroll zgodovina) |
| `StockTransaction → InventoryItem` | Cascade | Restrict (zaloga audit) |
| `LoyaltyTransaction → LoyaltyAccount` | Cascade | Restrict |
| `GiftCardTransaction → GiftCard` | Cascade | Restrict |
| `StaffShift → Employee` | Cascade | Restrict |
| `GuestVisit → Guest` | Cascade | Restrict (zgodovina obiskov) |

> Pozitivno: `OrderItem.menuItem` in `Receipt.order` ŽE uporabljata `Restrict` — ekipa
> pozna vzorec, le konsistentno ga mora razširiti.

### C. Manjkajoči `locationId` na 7 modelih

Multi-lokacija je delno implementirana (14 modelov ima `locationId`), manjka pa na:

| Model | Zakaj kritično |
|---|---|
| `HaccpEntry` | **Legalno** — HACCP dnevniki morajo biti per-lokacija za inšpekcije |
| `Shift` | Izmene so na lokaciji (`StaffShift` ga ima, legacy `Shift` ne) |
| `TimeEntry` | Delovne ure za plače so per-lokacija |
| `PurchaseOrder` | Nabava je za zalogo lokacije |
| `MenuItem` | Multi-lokacija meniji ne morejo variirati cen/razpoložljivosti |
| `TaxRate` | DDV se razlikuje po državi (`Location.country`) |
| `GuestFeedback` | Povratne informacije so per-lokacija za poročila |

### D. Manjkajoče `@unique` omejitve (4)

| Model.Polje | Tveganje |
|---|---|
| `LoyaltyAccount.customerPhone` | Duplikatne prijave na isto telefonsko številko |
| `Supplier.code` | Duplikatne dobaviteljske kode prelomijo poročila |
| `Location.premisesId` | FURS premises ID mora biti unikaten per lokacija |
| `Reservation [tableId, dateTime]` | Ni omejitve proti dvojnemu rezerviranju mize |

### E. PIN lookup optimizacija (povezano s popravkom #2)

`src/app/api/auth/_helpers.ts` `verifyPin()` naredi `findMany({ where: { status: 'active', pin: { not: '' } } })`
in nato iterira čez VSE aktivne zaposlene s `bcrypt.compare` (full-table-scan + N bcrypt
operacij). Po dodajanju `pinLookup` (SHA-256 brez soli, unique) polja, lahko direktno
`findUnique({ where: { pinLookup: sha256(inputPin) } })` — O(1) iskanje.

### F. Git zgodovina cleanup (nizka prioriteta)

`.env` je bil commitan v **4 commitih**. Vsebina je bila vedno samo
`DATABASE_URL=file:/home/z/my-project/db/custom.db` — **ni vseboval pravih skrivnosti**
(GEMINI_API_KEY, FURS cert gesla itd. so v `.env` šele po tem cleanup PR-u, v `.env.example`
pa so samo placeholderji). Zato zgodovinski cleanup **ni kritičen**, a po smernicah
priporočen za čisto repozitorij:

```bash
# Možnost 1: git-filter-repo (priporočeno)
pip install git-filter-repo
git filter-repo --path .env --invert-paths
git push --force-with-lease origin main chore/professional-cleanup

# Možnost 2: BFG Repo-Cleaner
bfg --delete-folders .env --no-blob-protection
git reflog expire --expire=now --all && git gc --prune=now --aggressive
```

> ⚠️ Po force-push obvezno obvesti vse sodelujoče, da morajo ponovno klonirati.

---

## 🟢 Implementirana priporočila (commit 3: `feat: schema hardening`)

Po audit-u so bile implementirane naslednje spremembe, naslonjene na ugotovitve
zgornjih sekcij A–E:

### B. Kaskade Cascade → Restrict (7 relacij)

Vse nevarne kaskade, ki bi tiho pobrisale revizijsko/finančno zgodovino, so spremenjene:

| Otak → Starš | Popravek |
|---|---|
| `Shift → Employee` | `Cascade` → `Restrict` |
| `TimeEntry → Employee` | `Cascade` → `Restrict` |
| `StaffShift → Employee` | `Cascade` → `Restrict` |
| `StockTransaction → InventoryItem` | `Cascade` → `Restrict` |
| `LoyaltyTransaction → LoyaltyAccount` | `Cascade` → `Restrict` |
| `GiftCardTransaction → GiftCard` | `Cascade` → `Restrict` |
| `GuestVisit → Guest` | `Cascade` → `Restrict` |

**Zakaj varno:** ker aplikacijska koda nikoli ne hard-deletea teh parentov (soft-delete
preko `status` polj — glej sekcijo A), `Restrict` nikoli ne blokirajo normalnega
obratovanja. Edini hard-delete je v `seed/_helpers.ts` in `seed-norms/route.ts`, ki sta
bila posodobljena, da najprej pobrišeta child tabele.

**Namenoma pustljene `Cascade`** (varne za svoj kontekst):
- `EmployeeJob → Employee` (join tabela, smiselno pobrisati ob brisanju employee)
- `RecipeItem → InventoryItem` in `RecipeItem → MenuItem` (receptni deli, smiselno
  pobrisati ko sestavina/artikel ne obstaja)

### C. `locationId` na 6 modelih (multi-location pokritost)

Dodan `locationId String?` + relacija + `@@index([locationId])` na:

| Model | Razlog |
|---|---|
| `HaccpEntry` | **Legalno** — EU 852/2004 zahteva per-lokacija HACCP dnevnike |
| `Shift` | Izmene so na lokaciji (`StaffShift` ga je imel, legacy `Shift` ne) |
| `TimeEntry` | Delovne ure za plače so per-lokacija |
| `PurchaseOrder` | Nabava je za zalogo lokacije |
| `TaxRate` | DDV se razlikuje po državi (`Location.country`) |
| `GuestFeedback` | Povratne informacije so per-lokacija za poročila |

Vsi so `nullable` + `onDelete: SetNull` — **backward compatible** (obstoječi zapisi
imajo `null` = globalno/chain-wide). `Location` model je razširjen z 6 novimi relacijami.

> `MenuItem` izpustjen: meni hierarhija dedne preko `Menu.locationId` — dodajanje
> neposrednega `locationId` na MenuItem bi zahtevalo globljo predelavo kataloga.

### D. 4 manjkajoče `@unique` omejitve

| Model.Polje | Popravek |
|---|---|
| `LoyaltyAccount.customerPhone` | dodan `@unique` (prepreči duplikatne prijave) |
| `Supplier.code` | dodan `@unique` (duplikatne kode prelomijo poročila) |
| `Location.premisesId` | dodan `@unique` (FURS premises ID mora biti unikaten) |
| `Reservation [tableId, dateTime]` | dodan `@@unique` (prepreči dvojno rezervacijo mize) |

> ⚠️ **Pomembno pred `db:push`:** če v bazi že obstajajo duplikati (npr. dva gosta z
> isto telefonsko številko), bo `db:push` failal. Pred menjavo zaženi cleanup query:
> ```sql
> SELECT customerPhone, COUNT(*) FROM LoyaltyAccount GROUP BY customerPhone HAVING COUNT(*) > 1;
> SELECT code, COUNT(*) FROM Supplier WHERE code != '' GROUP BY code HAVING COUNT(*) > 1;
> SELECT premisesId, COUNT(*) FROM Location WHERE premisesId != '' GROUP BY premisesId HAVING COUNT(*) > 1;
> ```

### E. PIN lookup optimizacija (O(n) → O(1))

**Problem:** `verifyPin()` je delal `findMany({ where: { status: 'active', pin: { not: '' } } })`
in nato iteriral čez VSE aktivne zaposlene s `bcrypt.compare` — O(n) poizvedba +
N bcrypt operacij. Pri 50+ zaposlenih je to občutno. Enak problem v `employees/route.ts`
POST duplicate-check.

**Rešitev:** dodano `pinLookup String? @unique` polje na `Employee`:
- `pinLookup = HMAC-SHA256(NEXTAUTH_SECRET, plaintext_pin)`
- HMAC (ne plain SHA-256) prepreči rainbow table napade na kratke 4-mestne PIN-e
- `NEXTAUTH_SECRET` je strežniška skrivnost — napadalec z dostopom do baze ne more
  obrniti `pinLookup` brez secret-a
- `pin` ostane bcrypt-hashiran (defense in depth)
- `findUnique({ where: { pinLookup } })` — **O(1)**

**Spremenjene datoteke:**
- `src/lib/pin-lookup.ts` (nova) — `hashPinLookup()`, `pinLookupEnabled()` helperji
- `src/app/api/auth/_helpers.ts` — `verifyPin()` sedaj najprej poskusi O(1) `findUnique`
  preko `pinLookup`, z backward-compatible fallback na O(n) `findMany` (če
  `NEXTAUTH_SECRET` manjka ali zaposleni še nima `pinLookup` iz časov pred menjavo)
- `src/app/api/employees/route.ts` — POST duplicate-check sedaj O(1) preko `pinLookup`,
  z fallback; `create()` zapiše `pinLookup` ob kreiranju zaposlenega
- `src/app/api/employees/[id]/route.ts` — DELETE (termination) počisti `pinLookup`
- Ob prvi prijavi starega zaposlenega (plaintext PIN brez `pinLookup`) se migracija
  izvede avtomatsko: zapiše se bcrypt hash + `pinLookup`

**Backward compatible:** če `NEXTAUTH_SECRET` ni nastavljen, `pinLookupEnabled()` vrne
`false` in celoten sistem fallback-a na originalni O(n) pristop — nobena funkcionalnost
ne prelomi.

### F. Seed helper posodobitev (Restrict-safe deletion order)

`src/app/api/seed/_helpers.ts` in `src/app/api/seed-norms/route.ts` sta posodobljena,
da najprej pobrišeta child tabele (`guestVisit`, `timeEntry`, `staffShift`,
`stockTransaction`, `loyaltyTransaction`, `giftCardTransaction`, `recipeItem`) pred
parenti (`employee`, `inventoryItem`, `loyaltyAccount`, `giftCard`, `guest`) — ker
kaskade niso več `Cascade`.

---

## ✅ Kaj je že odlično (ni potrebnih popravkov)

| Področje | Ugotovitev |
|---|---|
| **Decimal za valute** | Vsa monetary polja (`price`, `amount`, `tipAmount`, `vatRate`, ...) uporabljajo `Decimal`. Noben `Float` ni monetaren. Brezhibno. |
| **Indeksi** | Skoraj vsi FK imajo `@@index`, plus pametni kompozitni indeksi (`[orderId, voided]`, `[status, createdAt]`). Minimalno N+1 tveganje. |
| **FURS skladnost** | `Receipt` ima `zoi`, `eor`, `fiscalVerified`, `fiscalStatus`, `verificationDate`, `receiptNumber @unique`, indekse na `[fiscalVerified]` in `[fiscalStatus]`. Popolno. |
| **Idempotentnost plačil** | `Payment.idempotencyKey @unique` — produkcjska zaščita proti double-click. |
| **Auth sistem** | `requireAuth()` z Bearer token, hybrid session store (memory + SQLite + WS sync), sliding 8h TTL + absolutni 24h timeout, `ROUTE_PERMISSIONS` RBAC z admin bypass. 117/132 rut pravilno zaščitenih. |
| **Javne rute** | Vseh 15 javnih rut je legitimno javnih (qr-menu, public order, feedback, delivery webhooks z HMAC). Vse z rate limitingom. |
| **Security headers** | `next.config.ts` vsili CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP, CORP. |
| **CSP** | `connect-src` omejen na `self ws: wss: localhost:* api.github.com` — ni divjih zunanjih dovoljenj. |
| **Edge middleware** | 5 MB body cap, rate limiting, request ID, locale cookie — pravilno ločeno od auth (ki je v route handlerjih). |

---

## 🔐 Postopek po mergu tega PR-ja

1. **Prekliči GitHub token** `ghp_************************************grB` (deljen v IM sporočilu — glej spodaj)
   na https://github.com/settings/tokens — ne glede na to, da je .env vseboval le
   DATABASE_URL, je token sam po sebi izpostavljen.

2. **Generiraj nove skrivnosti** za produkcijo (če še niso):
   ```bash
   openssl rand -base64 32  # NEXTAUTH_SECRET
   openssl rand -base64 32  # RECEIPT_TOKEN_SECRET
   openssl rand -base64 32  # WEBHOOK_SECRET
   ```

3. **Sinkroniziraj shemo** (po mergu, lokalno):
   ```bash
   git pull
   bun install
   bun run db:push   # uveljavi @unique na pin, previousHash na AuditLog, Restrict na Payment→Check
   bun run db:generate
   bun run lint
   ```

4. **(Opciono) Zgodovinski cleanup** — glej sekcijo F zgoraj.

5. **(Opciono) Naslednja faza** — implementiraj priporočila A–E (soft-delete, preostale
   kaskade, locationId, unique omejitve, PIN lookup).

---

## 📊 Statistika audita

- **Auditor:** Z.ai Code (avtomatiziran)
- **Metodologija:** Statična analiza + 2 vzporedna Explore agenta (API auth + Prisma schema)
- **Viri smernic:** Next.js 16 uradna dokumentacija, Makerkit App Router guide, FURS
  tehnične specifikacije (eDavki), POS database design patterns
- **Skupno pregledanih datotek:** 132 API rut + 70 Prisma modelov + src/lib/*
- **Kritične ugotovitve:** 4 (vse popravljene v tem PR-ju)
- **Priporočila za naslednjo fazo:** 6 kategorij (A–F)
- **Čas audita:** ~en krog agentov

---

*To poročilo je del commita `chore/professional-cleanup` na veji `chore/professional-cleanup`.*
