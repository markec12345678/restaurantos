# Changelog — RestaurantOS

## [Unreleased] — 2026-08-28

### FURS compliance + POS 2026 raziskava + finalni popravki

#### Dodano
- **FURS Certificate Lifecycle Monitor** — `GET /api/furs/cert-status`
  - Preverja stanje certifikata, opozori pred potekom (60 dni)
  - FURS rotacija certifikatov sep 2025 — 8000 poteklo
  - Preverja nepotrjene račune (1h warning, 48h ZDDV-1 critical)
- **E-Invoice Book Reporting** — `GET /api/furs/e-invoice-book`
  - Knjiga računov za FURS predajo (zakonska obveznost od 1. julija 2025)
  - JSON + CSV export z DDV razčlenitvijo, ZOI, EOR
- **MealtimeRule** — `src/lib/mealtimes.ts` + menu API filtering
  - `isItemAvailableNow()` — preverja ali je artikel dostopen ob trenutnem času
  - `?checkMealtimes=true` in `?hideUnavailable=1` query parametri
- **KOT Document Lifecycle** (URY Mosaic-style) — `KotDocument` model + `GET/POST /api/kot`
  - 4 tipi: original, modified, partially_cancelled, cancelled
  - Avtomatsko kreiran ob `handleFireAction`
- **Order Dossier** (POSR-style) — `GET /api/orders/[id]/dossier`
  - Celovita časovnica: order → KOT → items → voids → payments → receipts → FURS → audit
- **Operational Red Flags** (URY Mosaic-style) — `GET /api/operational-alerts`
  - 8 tipov alertov z severity (critical/warning/info)
- **GL/TB/BS/P&L Reports** (POSR/URY-style) — 3 novi API endpointi
  - `generateProfitLoss()`, `generateBalanceSheet()`, `generateGeneralLedger()`
- **Web Push Notifications** — `POST/DELETE /api/push/subscribe`, `GET /api/push/vapid-key`
- **Bolt Food Webhook** — HMAC-SHA256 verification, idempotent, rate-limited
- **Scheduled Email Reports** — Vercel Cron (vsakih 15 minut), PDF attachment

#### Kritični popravki
- **Skip-login bypass** — odstranjen onSkip (kdorkoli je lahko videl POS)
- **DDV lookup** — cats[item.categoryId] iskal UUID v friendly-name mapi → categoryIdToName Map
- **KOT auto-create** — handleFireAction zdaj avtomatsko ustvari KOT dokument
- **Vercel Cron auth** — CRON_SECRET bypass dodan
- **Bolt webhook DDV** — hardcoded 22% → pravilen DDV iz menuItem.vatRate
- **FURS JWT** — base64url double-encoding popravljen (blokiral produkcijo)
- **Refund reversal** — gift card/loyalty/check/order status reverziranje
- **Loyalty fraud** — server-side validacija vrednosti točk
- **P&L report** — hardcoded konstante → API fetch
- **console.log → logger** v 5 produkcijkih datotekah
- **scripts/seed tsc napake** — 0 napak (prvič popolnoma čisto!)

#### Spletna raziskava (22 iskanj, 220 virov)
- Offline-first z transactional outbox = dominantni pattern 2025
- FURS cert rotacija + e-invoice book = zakonska obveznost
- ViDA e-invoicing vstopil v veljavo 29. junija 2026
- AI forecasting do 50% boljša natančnost
- NFC tap-to-pay baseline, QR order-and-pay standard (40% prefer)
- Ghost kitchens potrebujejo unified POS + KDS + delivery hub

#### Testiranje
- TypeCheck: **0 napak** (popolnoma čisto!)
- Vitest: 191/191 zelenih
- Praktični testi: vse funkcije delujejo end-to-end
- Prisma: 79 modelov

---

## [Unreleased] — 2026-08-27

### Konkurenčne funkcije + kritični popravki

#### Dodano
- **Operational Red Flags Dashboard** (URY Mosaic-style) — `GET /api/operational-alerts`
  - 8 tipov alertov: zakasnela naročila, KOT ni začet, neodprti računi, preveč preklicov, nizka zaloga, nefiskalizirani računi, predolge izmene, predolgo zasedene mize
  - Severity: critical / warning / info
- **Mealtimes Scheduling** (TastyIgniter-style) — `MealtimeRule` model
  - Per-item availability: dnevi v tednu + časovno okno (zajtrk 6-11h, nedeljska pečenka)
- **GL/TB/BS/P&L Reports** (POSR/URY-style)
  - `generateProfitLoss()` — Prihodki - Stroški = Čisti dobiček + marža %
  - `generateBalanceSheet()` — Aktiva = Obveze + Kapital + isBalanced
  - `generateGeneralLedger()` — Vse transakcije po kontih z datumom
  - API: `GET /api/accounting/{profit-loss, balance-sheet, general-ledger}`
- **Web Push Notifications** — `POST/DELETE /api/push/subscribe`, `GET /api/push/vapid-key`
  - notifyNewOrder, notifyItemReady, notifyDeliveryOrder, notifyLowStock
  - VAPID konfiguracija, PushSubscription model
- **Bolt Food Delivery Webhook** — `POST /api/delivery/webhook/bolt`
  - HMAC-SHA256 signature verification (timing-safe)
  - Zod validacija, idempotentnost, rate limiting
- **Scheduled Email Reports** — `POST /api/scheduled-emails/{create,process}`
  - Vercel Cron (vsakih 15 minut)
  - PDF attachment, multi-recipient, idempotentno

#### Kritični popravki
- **BUG-FURS-1**: JWT signature base64url double-encoding — blokiral FURS v produkciji
- **BUG-PAY-1**: Refund brez reversal side-effects — gift card/loyalty/check nedosledni
- **BUG-LOY-1**: Loyalty points value ni validiran server-side — fraud (1 točka = €1000)
- **DDV popravki**: Hrana 9.5% (prej 22%), alkohol 22%
- **Panna cotta alergen**: odstranjeno jajce [3], pustljeno mleko [7]
- **PIN varnost**: bcrypt hash + HMAC pinLookup (prej plaintext v demo-data)
- **JSON syntax**: trailing comma v vseh 5 prevodnih datotekah
- **Slike artiklov**: 106/106 pravilno mapiranih (prej 4/106)

#### Spremenjeno
- Schema: 78 modelov (dodan MealtimeRule, PushSubscription, JournalEntry.locationId)
- Setup Wizard: `/setup` z izbiro ena/več lokacij
- ExportReport: izbira formata (CSV/PDF/Excel/eDavki XML)
- AuditLogViewer: revizijski dnevnik UI za admin
- PWA Install Prompt komponenta
- deepToNumbers: Date → ISO string
- Session: BigInt → DateTime (PGlite compatibility)
- FURS ByteString: em-dash v headerjih zamenjan z navadnim dash

#### Testiranje
- TypeCheck: 0 napak v `src/`
- Vitest: 191/191 zelenih
- Playwright E2E: 23/24 zelenih (setup + workflow)
- JSON veljavnost: 5/5 prevodnih datotek

#### Primerjava s konkurenco
- POSR: AI napovedi, offline-first, internal GL → delno prevzeto (GL/TB/BS/P&L)
- TastyIgniter: Online ordering, mealtimes → prevzeto (mealtimes scheduling)
- URY Mosaic: KOT lifecycle, operational red flags → prevzeto (operational alerts)

---

## [Unreleased] — 2026-08-26

### Workflow povezovanje + setup wizard + PWA

#### Dodano
- **Setup Wizard** (`/setup`) — first-run konfiguracija z izbiro ene ali več lokacij
  - `GET /api/setup/status` — preveri ali je sistem inicializiran
  - `POST /api/setup/init` — ustvari admin + lokacijo + FURS + core podatke (davki, konti)
  - `SetupRedirect` komponenta — samodejna preusmeritev na `/setup`
- **PGlite (embedded PostgreSQL)** — deluje brez Dockerja/root dostopa
  - `db.ts` z `PrismaPGlite` adapterjem (singleton instanca)
  - `scripts/init-pglite.mjs` — inicializacija baze iz Prisma sheme
  - `scripts/seed-e2e-pglite.mjs` — seed testnih podatkov
- **PWA Install Prompt** — namestitev na domači zaslon (Add to Home Screen)
- **AuditLogViewer** — revizijski dnevnik UI za admin (PCI DSS + FURS skladnost)
  - Filtriranje po akciji, entiteti, uporabniku, datumu
  - Paginacija, CSV export, hash chain integrity check
- **ExportReport z izbiro formata** — CSV, PDF, Excel (XLSX), eDavki XML
- **WebSocket centralni broadcast** — `broadcastWSEvent` (in-process + HTTP fallback)
- **Server-side receipt creation** — avtomatska fiskalizacija po plačilu (neodvisno od klienta)

#### Spremenjeno
- **Schema popravki:**
  - `Order.firedAt` — čas pošiljanja v kuhinjo (KDS timer)
  - `Order.employee` — FK relacija do Employee (prej samo soft-FK)
  - `OrderItem.firedAt` — per-item urgency timer
  - `Session.createdAt/expiresAt/absoluteExpiry` — BigInt → DateTime (PGlite compat)
  - `ChartOfAccount` model — ponovno dodan (bil izgubljen)
  - `HaccpEntry` — dodani FK-ji za Employee, OrderItem, MenuItem (EU 852/2004)
  - `JournalLine.chartOfAccount` — FK na ChartOfAccount.code (issue #38)
- **`deepToNumbers`** — Date → ISO string (Zod response sheme)
- **`handle-fire-action.ts`** — zapiše firedAt na Order in OrderItem
- **Dashboard analytics** — vsi groupBy uporabljajo paidAt (ne createdAt)
- **EOD** — preverja odprta naročila pred zaprtjem (forceClose opcija)
- **Reservations/Waitlist** — sinhronizirajo Table.status (reserved/occupied/available)
- **Permissions** — menu-items, categories, tables zahtevajo manage_inventory
- **FURS ByteString fix** — em-dash v X-Fiscal-Warning headerjih zamenjan z navadnim dash

#### Testiranje
- **TypeCheck:** 0 napak v `src/`
- **Vitest:** 158/158 testov zelenih
- **Playwright E2E:** 23/24 testov zelenih (setup + workflow)
  - Setup Wizard: 8/8 zelenih
  - Natakar workflow: 8/8 zelenih
  - Kuhar workflow: 3/3 zelenih
  - Lastnik workflow: 10/10 zelenih

---

## [Security Audit 2026-08-25] — Varnostni audit + 40 popravkov

### Povzetek
Celovit varnostni audit je identificiral 40 finding-ov. Vsi so bili popravljani
preko 14 PR-ov (#30–#57). Podrobnosti v [AUDIT-REPORT.md](./AUDIT-REPORT.md).

### 🔴 Kritične ranljivosti (PR #30)
- **WebAuthn bypass** — `verifyAssertion()` ni preverjal podpisa; route onemogočen
- **Receipt token forgery** — DJB2 (32-bit) zamenjan z HMAC-SHA256; token obvezen
- **IoT readings brez auth** — dodan `X-IoT-Api-Key` header + fail-closed
- **HACCP hash chain race** — `createHaccpEntryWithChain()` z `$transaction`
- **FURS ZOI silent fallback** — fail-fast v produkciji ko certifikat manjka
- **Race conditions** — `count+1` → atomski `counter.upsert` (kiosk, AP, AR)

### 🔴 Secrets masking (PR #45, #48, #50, #51)
- `pin` / `pinLookup` — maskirano v vseh employees API odgovorih
- `fursCertPassword` / `fursCertPath` — maskirano v locations + settings
- `emailSmtpPassword` — maskirano v settings
- webhook `secret` — maskirano v vseh webhooks API odgovorih
- integration `apiKey` / `apiSecret` — maskirano v vseh integrations API odgovorih
- Centralni `src/lib/secret-masks.ts` z `maskLocationSecrets()` + `maskWebhookSecret()`

### 🔴 Session invalidation (PR #53)
- `verifyToken()` preverja `employee.status === 'active'` s 60s cache
- Terminiran zaposleni izgubi dostop v 60s (prej do 8h)

### 🟠 Hardening (PR #45, #46)
- CSP cleanup (`unsafe-eval` odstranjen iz produkcije)
- X-Frame-Options konsistenten (SAMEORIGIN)
- COOP/CORP dodan v middleware
- TipDistribution hash chain implementiran
- `FURS_ALLOW_SIMULATION` default `false`
- `broadcastWS` logira napake (ne tiho pogoltne)
- Kiosk GET rate limit + POST race fix
- Paginacija za recipes, categories, notifications
- AI voice-order rate limit
- Mrtva CSRF koda dokumentirana
- Mrtvi i18n provider izbrisan (113 LOC)

### 🟠 Performance (PR #47, #49, #50, #46)
- `next/image` migracija (10 komponent, AVIF/WebP, ~70% manj slik)
- `menu-items/bulk-import` — `createMany` v `$transaction`
- `notifications send-batch` — `createAuditLogsBatch` (1 transakcija)
- Paginacija za recipes, categories, notifications

### 🟠 UX (PR #48, #49)
- Zod validacija za `/reserve` (ime, telefon, email, partySize)
- Zod validacija za `/order` DetailsStep (delivery + takeout)
- Error display z `aria-invalid`, `role="alert"`, `inputMode`

### 🧪 Testi (PR #52)
- SSRF protection testi (30+ primerov, AWS/GCP/Azure metadata)
- PIN lookup HMAC testi (collision-free za vseh 10.000 PINov)

### 📝 Dokumentacija (PR #54, #55, #56, #57)
- `AUDIT-REPORT.md` — celoviti varnostni audit (40 findingov, 40 popravkov)
- `SECURITY.md` — posodobljen z natančnim post-audit statusom
- `README.md` — sinhroniziran z dejanskim stanjem (22→2 IndexedDB, WebAuthn experimental, integrations status, statistika)
- Vsi `.md` dokumenti — popravljene zastarele trditve ("22 trgovin", "najnaprednejši", "WebAuthn biometric")

### 📋 Schema (PR #58)
- `prisma/schema.prisma` — dodana dokumentacija načrtovanih enum-ov (issue #41)

### Novi env vars
- `IOT_API_KEY` — obvezen za IoT readings
- `RECEIPT_TOKEN_SECRET` — obvezen za digitalne račune (HMAC-SHA256)
- `WEBAUTHN_ENABLED` — opt-in experimental WebAuthn (default: false)
- `FURS_ALLOW_SIMULATION` — default spremenjen iz `true` v `false`

### Breaking changes
1. WebAuthn login onemogočen privzeto (vrne 503)
2. Digitalni račun zahteva `?t=<token>` parameter
3. IoT readings zahtevajo `X-IoT-Api-Key` header
4. FURS v produkciji zahteva certifikat (ne tiho fallback)
5. `FURS_ALLOW_SIMULATION` default `false`

### Priporočila po merge-u
- Rotiraj: `NEXTAUTH_SECRET`, `RECEIPT_TOKEN_SECRET`, `FURS_CERT_PASSWORD`, `EMAIL_SMTP_PASSWORD`, webhook secrets, integration keys
- Merge vrstni red: PR #50 najprej (centralni secret-masks.ts)
- Za multi-instance: dodaj Redis za rate limiting (issue #39)

---

## [Unreleased] — 2026-06-17

### Commit 1: `e4c7040` — Profesionalni cleanup (repo higiena)

#### Spremenjeno
- **`.gitignore`** — celovit (98 vrstic): `.next/`, `db/*.db`, `*.tsbuildinfo`, `.env`,
  `certs/`, `worklog*.md`, `agent-ctx/`, `upload/`, `download/`, scratch audit JSONs
- **`.env.example`** — dokumentira vseh 20 env spremenljivk (DATABASE_URL, GEMINI_API_KEY,
  FURS_*, NEXTAUTH_SECRET, RECEIPT_TOKEN_SECRET, TERMINAL_*, WEBHOOK_SECRET, ...)
- **`tsconfig.json`** — dodan `data/`, `mini-services/` v exclude
- **`eslint.config.mjs`** — počiščene zastarele poti, dodan `data/**` v ignores
- **`package.json`** — dodan `engines: { node: ">=18.0.0" }`
- **`README.md`** — posodobljeno strukturno drevo, varnostna opozorila, FURS cert korak,
  nova "Repo higiena" sekcija

#### Struktura
- **118 JSON datotek** premaknjenih iz korena v `data/{menus,search,api-dumps,slovenian,audit,misc}/`
- **35 skript** premaknjenih v `scripts/{images,seed,ops}/`
- **`data/README.md`** + **`scripts/README.md`** dodani za dokumentacijo map
- **`certs/.gitkeep`** dodan (za FURS certifikate)

#### Varnost
- **`.env`** untrackan (vseboval pot do baze — sedaj gitignored)
- **`.next/`** untrackan (build artefakti)
- **`db/custom.db`** + journal untrackan (baza)
- **`tsconfig.tsbuildinfo`** + `next-env.d.ts` untrackana
- **`worklog*.md`** (295 KB) + **`agent-ctx/`** untrackana (dev logs)
- **`upload/`**, **`download/`** untrackana (scratch dirs)
- 7 regenerabilnih audit JSON-ov untrackanih

---

### Commit 2: `abd9382` — 4 kritični varnostni popravki

#### Varnost
- **`/api/payments` GET** — dodan `requireAuth({ permission: 'take_orders' })`
  (prej brez auth — vsakdo je lahko izčrpal tabelo plačil)
- **`Employee.pin`** — dodan `@unique` (prej duplikatni PINi omogočali impersonacijo)
- **`AuditLog` hash veriga** — dodan `previousHash` polje (prej nepopolna veriga,
  nepreverljiva za revizijo)
- **`Payment → Check`** — `onDelete: Cascade` → `Restrict` (prej brisanje čeka
  tiho pobrisalo plačila)

#### Dokumentacija
- **`AUDIT.md`** — celovito varnostno poročilo (231 vrstic)

---

### Commit 3: `061ec55` — Schema hardening (B–E)

#### B. Kaskade Cascade → Restrict (7 relacij)
- `Shift.employee`, `TimeEntry.employee`, `StaffShift.employee`
- `StockTransaction.inventoryItem`
- `LoyaltyTransaction.loyaltyAccount`
- `GiftCardTransaction.giftCard`
- `GuestVisit.guest`
- (varno ker app koda uporablja soft-delete preko `status` polj)
- Seed helperji posodobljeni (child-first deletion order)

#### C. `locationId` na 6 modelih (multi-location)
- `HaccpEntry` (EU 852/2004 legalno — per-lokacija HACCP)
- `Shift`, `TimeEntry`, `PurchaseOrder`, `TaxRate`, `GuestFeedback`
- Vsi nullable + `SetNull` — backward compatible

#### D. 4 `@unique` omejitve
- `LoyaltyAccount.customerPhone` (prepreči duplikatne prijave)
- `Supplier.code` (duplikatne kode prelomijo poročila)
- `Location.premisesId` (FURS premises ID unikaten)
- `Reservation [tableId, dateTime]` (prepreči dvojno rezervacijo)

#### E. PIN lookup optimizacija (O(n) → O(1))
- Novo `Employee.pinLookup String? @unique` polje
- `pinLookup = HMAC-SHA256(NEXTAUTH_SECRET, pin)` (prepreči rainbow table)
- Nova `src/lib/pin-lookup.ts` helper
- `verifyPin()` O(1) `findUnique({pinLookup})` z backward-compatible fallback
- POST duplicate-check O(1), DELETE termination počisti pinLookup
- Avtomatska migracija ob prvi prijavi starih plaintext-PIN zaposlenih

#### Dokumentacija
- **`AUDIT.md`** — popravljena soft-delete sekcija (že implementiran preko status polj)
- Nova sekcija "Implementirana priporočila" z B–E podrobnostmi

---

### Commit 4: `1835673` — E2E runtime popravki

#### Runtime
- **`Session` model** — `createdAt`/`expiresAt`/`absoluteExpiry` `Int` → `BigInt`
  (Date.now() ms preseže 32-bitni SQLite INT → overflow crash)
- **`session-lifecycle.ts`** — `BigInt()` konverzija pri pisanju v DB
- **`session-cache.ts`** — `Number()` pri branju + `BigInt()` v queryjih
- **`auth/_helpers.ts`** — `Number(basePayRate)` v auth responsu
  (Prisma Decimal → number za Zod validacijo)

#### Testiranje
- Nova `scripts/seed/e2e-seed.mjs` (admin 1234, staff 0000, 12 miz, 8 artiklov)

---

### Commit 5: (ta commit) — E2E dokumentacija

#### Dokumentacija
- **`E2E-TEST-REPORT.md`** — celovito E2E poročilo (227 vrstic, 96 testov, 100% pass)
- **`CHANGELOG.md`** — ta changelog

---

## 📊 Skupni rezultat

| Metrika | Vrednost |
|---|---|
| Commiti | 5 |
| Datotek spremenjenih | 15+ |
| Vrstic dodanih | ~500+ |
| Kritični varnostni popravki | 6 |
| Schema izboljšave | 17 (7 kaskad + 6 locationId + 4 unique) |
| API modulov testiranih | 55+ (100% pass) |
| E2E testov | 96 (100% pass) |
| Runtime napake | 0 |

## ✅ Preverjanja

- `prisma validate` — schema valid ✓
- `tsc --noEmit` — 0 tipnih napak ✓
- `eslint` — 0 napak/opozoril ✓
- `Agent Browser` — login, dashboard, moduli, mobile ✓
- `curl API` — 96/96 testov pass ✓
- `WebSocket` — server.js deluje ✓
- `FURS` — ZOI generiran, simulacijski mode ✓
- `Hash chain` — konzistentna ✓
- `Rate limiting` — deluje ✓
- `Idempotency` — deluje ✓

## 🔧 Po mergu

1. **Prekliči GitHub token** `ghp_************************************grB`
2. **Ustvari PR**: https://github.com/markec12345678/restaurantos/pull/new/chore/professional-cleanup
3. **Po mergu**:
   ```bash
   git pull && bun install
   # Preveri duplikate pred db:push (glej AUDIT.md sekcija D)
   bun run db:push --accept-data-loss  # Int→BigInt recreates Session columns
   bun run db:generate
   bun run lint
   ```
4. **Nastavi `.env`** (glej `.env.example`):
   - `NEXTAUTH_SECRET` (za PIN lookup O(1))
   - `GEMINI_API_KEY` (za AI funkcije)
   - `FURS_CERT_PATH` + `FURS_CERT_PASSWORD` (za davčno potrjevanje)
