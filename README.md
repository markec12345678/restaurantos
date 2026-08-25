<div align="center">

# 🍽️ RestaurantOS

### Profesionalni POS sistem za restavracije

**Odprtokodni restavratorski POS sistem s FURS podporo in AI integracijo**

[![Next.js](https://img.shields.io/badge/Next.js-16.1.x-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.x-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](./LICENSE)
[![Languages](https://img.shields.io/badge/i18n-5_languages-blue?style=flat-square)](./messages/)
[![FURS](https://img.shields.io/badge/FURS-Certified-red?style=flat-square)](./src/app/api/furs/)
[![Tests](https://img.shields.io/badge/E2E_Tests-96_pass-brightgreen?style=flat-square)](./E2E-TEST-REPORT.md)
[![Security Audit](https://img.shields.io/badge/Security_Audit-Complete-success?style=flat-square)](./AUDIT-REPORT.md)

</div>

---

## 📋 Pregled

RestaurantOS je celovit, profesionalni Point of Sale (POS) sistem, zasnovan posebej za evropske restavracije, s poudarkom na slovensko tržišče in FURS davčno potrjevanje. Združuje najboljše prakse svetovnih POS sistemov (Toast, TouchBistro, Square, Lightspeed, 7shifts, OpenTable) v enotno, sodobno spletno aplikacijo.

Sistem pokriva vse vidike restavratorskega poslovanja — od naročanja in plačevanja, preko kuhinjskega prikaza in zalog, do analitike, davčnega potrjevanja in upravljanja osebja. Deluje tudi brez internetne povezave zahvaljujoč Service Workerju in IndexedDB (2 trgovini: `pendingOrders` in `pendingReceipts`), kar je ključnega pomena za zanesljivo poslovanje v restavracijah.

### Ključne prednosti

- **🇸🇮 FURS podpora** — Avtomatsko davčno potrjevanje računov (ZOI offline, EOR queued, 48h bulk)
- **🤖 AI zmogljivosti** — Gemini AI napovedi, priporočila, pomočnik, **AI Voice Ordering**
- **📱 Offline-first** — Service Worker + Background Sync + IndexedDB (2 trgovini)
- **🔒 Varno** — Zod validacija (98+ shem), Prisma $transaction, `requireAuth()` + RBAC, SHA-256 audit hash chain, session invalidation ob terminaciji
- **📋 Double-entry accounting** — Avtomatsko knjiženje (JournalEntry + Trial Balance)
- **📄 EU e-invoicing** — UBL 2.1 / PEPPOL BIS 3.0 (EU 2026 mandat) + eDavki XML
- **📡 IoT podpora** — Bluetooth temperaturni senzorji z avtomatskim HACCP dnevnikom (zahteva `IOT_API_KEY`)
- **🎙️ AI Voice Ordering** — Glasovno naročanje z Gemini AI
- **🔐 Biometric login** — ⚠️ WebAuthn/FIDO2 EKSPERIMENTALNO (preverjanje podpisa še ni implementirano; glej [AUDIT-REPORT.md](./AUDIT-REPORT.md))
- **🍽️ QR naročanje na mizi** — Gost poslika QR kodo, naroči iz telefona
- **🏢 Multi-lokacija** — Več lokacij z ločenimi FURS certifikati
- **🌍 Večjezično** — 5 jezikov (Slovenščina, English, Italiano, Hrvatski, Deutsch)
- **📊 Napredna analitika** — WoW primerjava, toplotna karta, COGS, menu engineering
- **🖨️ ESC/POS tiskanje** — Podpora za termične tiskalnike

---

## 🏗️ Arhitektura

| Tehnologija | Namen |
|---|---|
| **Next.js 16.1.x** | Full-stack framework (App Router, Server Components, API Routes) |
| **TypeScript 5** | Tipovno varna koda po vsem projektu (strict mode) |
| **Prisma ORM 5.x** | Dostop do baze s **75 modeli**, Decimal za valute |
| **SQLite / PostgreSQL** | Lokalna baza (dev) / PostgreSQL (produkcija — Vercel/Neon) |
| **Tailwind CSS 4** | Sodobno oblikovanje z utility-first pristopom |
| **shadcn/ui** | UI komponente (Radix UI + Tailwind CSS) |
| **TanStack Query** | Upravljanje stanja strežniških podatkov in caching |
| **TanStack Table** | Napredne tabele s sortiranjem in filtriranjem |
| **Recharts** | Interaktivni grafikoni in vizualizacije |
| **next-intl** | Internacionalizacija (5 jezikov s polnimi prevodi) |
| **Zod** | Validacija podatkov na strežniku in odjemalcu |
| **Zustand** | Lahko globalno stanje za POS košarico in UI |
| **Service Worker** | Offline zmogljivost, predpomnjenje, sinhronizacija |
| **IndexedDB** | Lokalno shranjevanje (2 trgovini: `pendingOrders`, `pendingReceipts`) za offline delovanje |
| **Framer Motion** | Tekoče animacije in prehodi |
| **date-fns** | Obdelava datumov in časov |
| **QRCode** | Generiranje QR kod za mize, račune, menije |
| **pdfkit** | Generiranje PDF poročil za knjigovodstvo |
| **exceljs** | Generiranje Excel (.xlsx) poročil |
| **nodemailer** | Pošiljanje email poročil (Z-report ob zaključku) |
| **z-ai-web-dev-sdk** | Gemini AI (napovedi, priporočila, voice ordering, asistent) |
| **ws (WebSocket)** | Real-time komunikacija za KDS in obvestila |
| **bcryptjs** | PIN hashing (bcrypt + HMAC-SHA256 za O(1) lookup) |

### Statistika projekta

| Metrika | Vrednost |
|---|---|
| Vrstic kode | ~125.000 |
| Prisma modelov | 75 |
| API rut | 152 |
| POS modulov | 61 (lazy-loaded) |
| React komponent | 645 |
| Zod shem | 98+ |
| Jezikov | 5 (sl, en, it, hr, de) |
| E2E testov | 96 (100% pass) |
| Unit testov | 41+ (SSRF, PIN lookup, sanitize, webhook signing, FURS, itd.) |
| Odvisnosti | 75+ |

> **Opomba:** Prejšnja verzija README je trdila "95% skladnost s profesionalno specifikacijo" in "22 IndexedDB trgovin" — oboje je bilo popravljeno po varnostnem auditu (glej [AUDIT-REPORT.md](./AUDIT-REPORT.md)).

---

## 🚀 Namestitev in zagon

### Zahteve

- **Node.js** 18+ (priporočeno 20+)
- **npm** 9+ ali **bun** 1.0+
- **PostgreSQL** (za produkcijo) ali **SQLite** (za razvoj)

### Hitri začetek (razvoj)

```bash
# 1. Kloniraj repozitorij
git clone https://github.com/markec12345678/restaurantos.git
cd restaurantos

# 2. Namesti odvisnosti
npm install

# 3. Nastavi okoljske spremenljivke
cp .env.example .env
# Uredi .env — nastavi vsaj:
#   NEXTAUTH_SECRET        — skrivnost za seje (openssl rand -base64 32)
#   RECEIPT_TOKEN_SECRET   — skrivnost za digitalne račune (ločena od NEXTAUTH_SECRET)
#   GEMINI_API_KEY         — za AI funkcije
#   FURS_*                 — za davčno potrjevanje
#   IOT_API_KEY            — če uporabljaš IoT senzorje (openssl rand -hex 32)
#   FURS_ALLOW_SIMULATION=true  — za dev/test brez pravega certifikata

# 4. Sinhroniziraj bazo in ustvari Prisma klienta
npx prisma db push
npx prisma generate

# 5. Seed baze (admin PIN 1234, staff PIN 0000, 12 miz, 8 artiklov)
node scripts/seed/e2e-seed.mjs
node scripts/seed/recipes-stations-seed.mjs

# 6. Zaženi razvojni strežnik
npm run dev

# 7. Odpri http://localhost:3000
```

> ⚠️ **Pomembno:** `FURS_ALLOW_SIMULATION` je privzeto `false`. Za razvoj brez pravega FURS certifikata ga eksplicitno nastavi na `true` v `.env`.

### Začetni prijavni podatki

| Vloga | PIN | Dovoljenja |
|---|---|---|
| Admin | `1234` | Poln dostop (vse funkcije) |
| Staff | `0000` | Omejen dostop (naročila, mize, KDS) |

### Produkcija (Vercel)

Glej **[DEPLOYMENT-GUIDE.md](./DEPLOYMENT-GUIDE.md)** za celovit vodič:

1. Ustvari PostgreSQL bazo (Vercel Postgres / Neon / Supabase)
2. Spremeni `prisma/schema.prisma`: `provider = "postgresql"`
3. Importiraj repo na Vercel, nastavi env vars
4. Build command: `npx prisma generate && next build`
5. Po deployu: `prisma db push` + seed
6. Namesti PWA na blagajno, KDS, natakar telefon
7. Natisni QR kode za mize

---

## 🎯 Funkcionalnosti

### 💰 Blagajna in naročanje

| Funkcija | Opis |
|---|---|
| Naročilna plošča | Hitro naročanje s kategorijami, iskanjem, prilagoditvami |
| Vizualni tloris | Interaktivni tloris miz s statusi (prosto/zasedeno/rezervirano) |
| **Table Merge/Transfer** | Prenos in združevanje miz z avtomatskim knjiženjem |
| Delitev računa | Split check po artiklih (itemized) ali znesku (value-based z DDV rounding) |
| Storno artiklov | Void z razlogom in avtorizacijo, audit log |
| Popusti | Odstotni in fiksni popusti z avtorizacijo |
| Davčne stopnje | Več DDV stopenj (22%, 9.5%, 5%, 0%) + DDV po lokaciji konzumacije |
| Plačilne metode | Gotovina, kartica, mobilno, darilna kartica, loyalty, alternativno |
| **Kombinirana plačila** | Več metod v enem računu (cash + card + gift card) |
| **Partial refunds** | Delna vračila z audit log |
| Blagajna | Odpiranje/zapiranje izmene, začetna gotovina, cash reconciliation |
| **Idempotentna plačila** | `idempotencyKey` prepreči duplikatna plačila |
| Z-poročilo | Dnevni zaključek z zaklepom obdobja |
| Bančni terminal | Integracija s PAX, Nexgo, SumUp, Square terminali |

### 🍳 Kuhinja (KDS)

| Funkcija | Opis |
|---|---|
| Kuhinjski zaslon (KDS) | Real-time prikaz naročil (WebSocket + 5s polling fallback) |
| **PrepStation routing** | DB-driven usmerjanje (kuhinja, bar, pekara) po `menuItem.prepStationId` |
| **KDS Matrix Aggregation** | Skupni seštevek artiklov per postaja (npr. "14× pleskavica na žaru") |
| **KDS alergeni** | Rdeči badge z EU alergeni (1-14) na vsakem naročilu |
| **QR badge** | Modra oznaka za spletna (QR) naročila |
| Tempo jedi | Course pacing (predjedi → glavne jedi → sladice) |
| Item state engine | PENDING → FIRED → PREPARING → READY → SERVED |
| Bump mehanizem | Označevanje pripravljenih artiklov z enojnim klikom |
| Urgency timer | 10/20 min threshold z barvno kodiranjem + zvočnim opozorilom |
| Kuhinja Pro | Napredni pripravljalni vrstni red s prednostmi |

### 📱 QR Naročanje na Mizi

| Funkcija | Opis |
|---|---|
| **QR generator** | `GET /api/tables/[id]/qr` — generira PNG QR kodo za vsako mizo |
| **QR batch** | `GET /api/tables/qr-batch` — QR URL-ji za vse mize (za print nalepk) |
| **PWA meni** | `/qr/[tableId]` — ultra hitri frontend za goste |
| **Table auto-occupied** | Miza se avtomatsko zasede ob QR naročilu |
| **KDS integracija** | QR naročila prikazana z modrim "QR" badge na KDS |
| **Stock deduction** | Zaloga se avtomatsko zmanjša ob QR naročilu |
| **Rate limiting** | PUBLIC_ORDER_LIMIT preprečuje zlorabe |

### 🤖 AI Zmogljivosti

| Funkcija | Opis |
|---|---|
| **AI Voice Ordering** | Glasovno naročanje z Gemini AI (transkript → strukturirano naročilo) |
| AI pomočnik | Klepet z Gemini AI za podporo odločanju v realnem času |
| AI napovedi | Napovedovanje prometa na podlagi zgodovinskih podatkov in trendov |
| AI priporočila | Optimizacija menija, cen, zalog na podlagi analize |
| AI upsell | Pametno predlaganje dodatkov ob naročanju (priloge, pijača) |
| AI ocena čakanja | Napoved čakalnega časa na podlagi zgodovine in zasedenosti |
| AI prehranska analiza | Kalkulacija kalorij in hranilnih vrednosti jedi |

### 📋 Knjigovodstvo in Finance

| Funkcija | Opis |
|---|---|
| **Double-entry accounting** | Avtomatsko knjiženje iz vsakega plačila (JournalEntry + JournalLine) |
| **Trial Balance** | Bruto bilanca z `isBalanced` validacijo (debet = kredit) |
| **Slovenski kontni načrt** | 1010 Blagajna, 1000 Banka, 2600 DDV, 7000-7020 Promet, 7600 Napitnine |
| **COGS** | Strošek prodanega blaga iz receptur (real-time) |
| **PDF/Excel/XML export** | Porčila v 4 formatih: CSV, PDF, Excel (.xlsx), eDavki XML |
| **UBL/PEPPOL** | EU 2026 e-invoicing mandat (Belgija, Nemčija, Hrvaška) |
| **QuickBooks integracija** | Avtomatska sinhronizacija JournalEntry → QuickBooks Online |
| **Xero integracija** | Avtomatska sinhronizacija JournalEntry → Xero ManualJournals |
| **Accounts Payable** | Obveznosti do dobaviteljev z aging report (0-30/31-60/61-90/90+) |
| **Accounts Receivable** | Terjatve strank z aging report |
| **Auto-AP iz PO** | Obveznost avtomatsko kreirana ob prejemu nabavnega naročila |
| **Auto Z-report email** | PDF Z-poročilo avtomatsko poslano knjigovodji ob zaključku |
| **Partial refunds** | Delna vračila plačil z audit log |

### 📦 Zaloge in Nabava

| Funkcija | Opis |
|---|---|
| Inventar | CRUD z min/max količinami, ceno, dobavitelji |
| **Multi-level recepture** | Sub-recepti (npr. "pica testo" uporabljen v "margherita") |
| Stock transactions | 5 tipov: procurement, sale, write-off, adjustment, return |
| **Waste management** | Sledenje odpadkom in kalu z stroškovnimi razlogi |
| Food cost kalkulator | Menu engineering (Star/Plowhorse/Puzzle/Dog) |
| Nabavna naročila | PO state machine (draft → submitted → approved → received) |
| **PO email dobavitelju** | Avtomatsko email obvestilo ob SUBMITTED statusu |
| Smart reorder | AI forecast, 30-dnevna zgodovina, urgency levels |
| Dobavitelji | CRUD z ocenami, plačilnimi pogoji, kontaktnimi podatki |
| **Aging reports** | AP/AR starostna analiza dolgov (current/30/60/90/over90) |

### 🇸🇮 FURS Davčno Potrjevanje

| Funkcija | Opis |
|---|---|
| ZOI generiranje | SHA-256 RSA podpis (OpenSSL + Node crypto fallback) |
| EOR prejem | Sinhroni HTTP TLS REST klic na FURS strežnik |
| **Offline FURS queue** | IndexedDB queue + 48h bulk retry (ZDDV-1 skladnost) |
| PKCS12 certifikati | Podpora .p12/.pfx z geslom |
| Storno računi | ReferenceInvoice + reason code |
| FURS batch | Množično potrjevanje neoverjenih računov |
| Multi-lokacija | Ločeni FURS certifikati per lokacija |

### 🏥 HACCP in Skladnost

| Funkcija | Opis |
|---|---|
| **HACCP z hash chain** | `previousHash + chainHash` (SHA-256) — EU 852/2004 nepopravljive evidence |
| **IoT senzorji** | Bluetooth temperaturni senzorji z avtomatskim HACCP (ok/warning/critical) |
| Temperature logging | Hladilniki, zamrzovalniki, vroča hrana |
| Kontrolni seznami | Čiščenje, dostave, hlajenje, izobraževanje |
| Per-lokacija | HACCP evidence ločena po lokacijah |
| **Audit hash chain** | SHA-256 veriga za vse operacije (PCI DSS) |

### 📡 Integracije

| Integracija | Status | Opis |
|---|---|---|
| **Glovo** | ✅ Implementirano | Webhook integracija z HMAC-SHA256 podpisovanjem |
| **Wolt** | ✅ Implementirano | Webhook integracija z HMAC-SHA256 podpisovanjem |
| **QuickBooks Online** | ✅ Implementirano | Avtomatska sinhronizacija JournalEntry |
| **Xero** | ✅ Implementirano | Avtomatska sinhronizacija ManualJournals |
| **e-Računi** | ✅ Implementirano | Slovensko računovodstvo (UBL 2.1) |
| **Datalab Pantheon** | ✅ Implementirano | Slovenski ERP |
| Custom webhooks | ✅ Implementirano | Poljubno konfigurirani webhook-i z HMAC podpisovanjem |
| **Deliverect** | ⚠️ Načrtovano | Uber Eats / DoorDash / Grubhub / Deliveroo aggregator — še ni implementirano |
| **Bolt Food** | ⚠️ Načrtovano | Webhook integracija — še ni implementirano |
| **7shifts** | ⚠️ Načrtovano | Labor scheduling + payroll + tip management — še ni implementirano |

### 🔐 Varnost

| Mehanizem | Opis |
|---|---|
| `requireAuth()` | Vse zaščitene API rute zahtevajo veljavno sejo |
| `ROUTE_PERMISSIONS` | RBAC z 8 dovoljenji (admin, manager, staff, manage_cash, itd.) |
| PIN prijava | bcrypt hash + **HMAC-SHA256 pinLookup** za O(1) iskanje |
| **WebAuthn/FIDO2** | ⚠️ EKSPERIMENTALNO — preverjanje podpisa še ni implementirano (glej [AUDIT-REPORT.md](./AUDIT-REPORT.md)) |
| Seje | Bearer token, 8h sliding TTL + 24h absolutni timeout + **status check** (terminiran zaposleni izgubi dostop v 60s) |
| Zod validacija | 98+ shem na strežniku + client-side validacija za javne forme |
| Prisma $transaction | Atomski operaciji za kritične transakcije (53+ call sites) |
| **Audit hash chain** | SHA-256 veriga (previousHash + chainHash) za PCI DSS — transakcijsko varna |
| **HACCP hash chain** | SHA-256 veriga za EU 852/2004 — transakcijsko varna |
| **TipDistribution hash chain** | SHA-256 veriga za napitnine |
| Rate limiting | Login (5/15min), public API (10+/min), kiosk (10/h), IoT (60/min), WS broadcast |
| CSP + HSTS | Content-Security-Policy, HSTS preload, X-Frame-Options SAMEORIGIN, COOP/CORP |
| **Secrets masking** | pin, pinLookup, fursCertPassword, fursCertPath, emailSmtpPassword, webhook secret, integration apiKey/apiSecret — vsi maskirani v API odgovorih |
| Decimal valute | Vse valute shranjene kot Decimal (ne Float) |
| Idempotentna plačila | `idempotencyKey` prepreči duplikate (fast-path + P2002 race-path) |
| **SSRF zaščita** | Outbound webhooks zavračajo interne/metadata naslove (127.x, 169.254.x, RFC1918) |
| **FURS ZOI fail-fast** | V produkciji vrže napako če certifikat manjka (ne tiho fallback na SHA-256) |
| **IoT API key** | `X-IoT-Api-Key` header obvezen za IoT readings (fail-closed) |
| **Receipt token** | HMAC-SHA256 (ne DJB2) — token obvezen za dostop do digitalnega računa |

### 🖥️ Self-Service Kiosk

| Funkcija | Opis |
|---|---|
| **Kiosk ordering** | `POST /api/public/kiosk` — brez auth, rate-limited |
| Kiosk meni | `GET /api/public/kiosk` — aktivni artikli z alergeni |
| Auto-totals | Subtotal + DDV + total izračun na strežniku |
| Dine-in / Takeout | Podpora za oboje |
| Rate limited | 10 naročil na uro (KIOSK_LIMIT) |

### 📊 Analitika in Poročila

| Funkcija | Opis |
|---|---|
| Dashboard | 30+ polj: revenue, COGS, grossProfit, FURS status, WoW, heatmap |
| Sales reports | Daily/weekly/monthly/yearly z period-over-period |
| VAT report | DDV razčlenitev po stopnjah (22%, 9.5%, 0%) z FURS kodami |
| Financial report | P&L z revenue/COGS/grossProfit/margin |
| EOD report | End-of-day z cash reconciliation |
| Popular items | Best sellers z revenue in quantity |
| Labor report | Shifts, time entries, performance |
| Export | CSV (UTF-8 BOM), PDF, Excel (.xlsx), eDavki XML, UBL 2.1 |

### 👥 Osebje in CRM

| Funkcija | Opis |
|---|---|
| Zaposleni | CRUD z vlogami, PIN, jobs, dovoljenji |
| Time tracking | Clock-in/out z odmori, plačne postavke |
| Staff performance | Revenue, tips, service time, table turnover, upsell rate |
| Shift scheduling | Tedenski razpored z pokritostjo |
| Gostje CRM | Alergeni, preference, VIP, zgodovina obiskov |
| Loyalty program | Točke, nivoji (bronze/silver/gold/platinum), earning/spending |
| Darilne kartice | Kreiranje, polnjenje, trošljenje, zgodovina |
| Rezervacije | Z mizami, časovi, statusi, source tracking |
| Čakalna vrsta | Waitlist z estimated wait time |

---

## 📦 Projekt struktura

```
restaurantos/
├── prisma/
│   └── schema.prisma          # 75 Prisma modelov
├── src/
│   ├── app/
│   │   ├── api/               # 150 API rut v 70+ modulih
│   │   │   ├── accounting/     # Double-entry (journal-entries, trial-balance)
│   │   │   ├── ai/             # AI Voice Ordering, forecast, upsell
│   │   │   ├── auth/           # PIN login, WebAuthn biometric
│   │   │   ├── furs/           # FURS davčno potrjevanje + batch
│   │   │   ├── iot/            # IoT senzorji + auto HACCP
│   │   │   ├── public/         # Javni API (kiosk, order, menu)
│   │   │   ├── reports/        # CSV/PDF/Excel/XML/UBL export
│   │   │   ├── tables/         # CRUD + transfer + merge + QR generator
│   │   │   └── ...             # 60+ ostalih modulov
│   │   ├── [locale]/          # Internacionalizirane javne strani
│   │   │   ├── kds/           # Kitchen Display System
│   │   │   ├── qr-menu/       # QR meni za stranke
│   │   │   ├── qr/[tableId]/  # QR naročanje na mizi
│   │   │   ├── waiter/        # Natakar mobilni pogled
│   │   │   └── ...
│   │   └── feedback/          # Javna stran za ocene
│   ├── components/
│   │   ├── pos/               # 644 POS komponent (55+ modulov)
│   │   └── ui/                # shadcn/ui komponente
│   └── lib/                   # auth, db, furs/, escpos/, email/, webauthn/,
│       │                      # offline-furs/, accounting/, integrations/
│       └── ...
├── data/                      # Referenčni podatki (menus, search, API dumps)
├── scripts/                   # Seed, image generation, ops
│   └── seed/
│       ├── e2e-seed.mjs       # Osnovni seed (admin, mize, meni)
│       └── recipes-stations-seed.mjs  # Recepture + PrepStations
├── messages/                  # i18n prevodi (5 jezikov)
├── public/                    # Statične datoteke, sw.js (Service Worker)
├── certs/                     # FURS certifikati (gitignored)
├── server.js                  # Custom Next.js + WebSocket (za Railway/Render)
├── .env.example               # Predloga okoljskih spremenljivk
├── Dockerfile                 # Docker za produkcijo
├── DEPLOYMENT-GUIDE.md        # Vodič za Vercel deploy + naprave
└── README.md                  # Ta datoteka
```

---

## 📚 Dokumentacija

| Dokument | Vsebina |
|---|---|
| **[AUDIT-REPORT.md](./AUDIT-REPORT.md)** | 🆕 Celoviti varnostni audit (40 findingov, 40 popravkov, PR #30–#55) |
| **[SECURITY.md](./SECURITY.md)** | Varnostna politika + implementirani varnostni ukrepi |
| **[DEPLOYMENT-GUIDE.md](./DEPLOYMENT-GUIDE.md)** | Vercel deploy + PWA/KDS/natakar nastavitev |
| **[AUDIT.md](./AUDIT.md)** | Varnostni in arhitekturni audit (zgodnji) |
| **[FEATURES-AUDIT.md](./FEATURES-AUDIT.md)** | Revizija funkcij vs profesionalni POS |
| **[COMPETITIVE-ANALYSIS.md](./COMPETITIVE-ANALYSIS.md)** | Primerjava s 12 POS sistemov |
| **[ADVANCED-FEATURES-COMPARISON.md](./ADVANCED-FEATURES-COMPARISON.md)** | 10 cutting-edge funkcij konkurence |
| **[E2E-TEST-REPORT.md](./E2E-TEST-REPORT.md)** | 96 E2E testov (100% pass) |
| **[CHANGELOG.md](./CHANGELOG.md)** | Zgodovina sprememb |

---

## 🔄 Refaktoriranje in razvoj (18 commitov)

| Faza | Commiti | Vsebina |
|---|---|---|
| Cleanup | 1 | Profesionalni cleanup (repo higiena, struktura) |
| Security | 2 | 4 kritični varnostni popravki + schema hardening |
| Runtime | 1 | Session BigInt + auth payRate popravki |
| Testi | 2 | E2E test report + konkurenčna analiza |
| Faza 1 | 1 | PDF/Excel/XML export, double-entry, partial refunds, KDS alergeni |
| Faza 2 | 1 | QuickBooks/Xero, real-time KDS WS, DB-driven PrepStation |
| Faza 3 | 1 | AP/AR, scheduled emails, bulk import |
| E2E fix | 1 | 6 vrzeli (stock deduction, COGS, KDS permissions, dashboard) |
| Faza 4 | 1 | Table Merge/Transfer, KDS Matrix, Offline FURS Queue |
| Faza 5 | 1 | Multi-level recipes, auto-AP, Z-report email, DDV by location, HACCP crypto |
| Faza 6 | 1 | UBL/PEPPOL, AI Voice, IoT, Deliverect, WebAuthn, Kiosk, 7shifts |
| QR | 1 | QR naročanje na mizi (generator, auto-occupied, KDS badge) |
| Docs | 3 | Spec compliance, advanced features, deployment guide |

---

## 🛡️ Varnostne značilnosti

- **PIN z bcrypt + HMAC O(1)** — `pinLookup` polje za hitro iskanje, `pin` ostane bcrypt-hashiran
- **WebAuthn/FIDO2** — ⚠️ EKSPERIMENTALNO (preverjanje podpisa ni implementirano; onemogočeno privzeto)
- **SHA-256 audit hash chain** — `previousHash + chainHash` v transakciji (race-safe)
- **HACCP hash chain** — EU 852/2004 nepopravljive evidence (transakcijsko varna)
- **TipDistribution hash chain** — SHA-256 veriga za napitnine
- **Session invalidation** — terminiran zaposleni izgubi dostop v 60s (ne 8h)
- **Rate limiting** — login (5/15min), public API, kiosk (10/h), IoT (60/min), WS broadcast
- **CSP + HSTS** — Content-Security-Policy, HSTS preload, X-Frame-Options SAMEORIGIN, COOP/CORP
- **Zod validacija** — 98+ shem za vse API vhode + client-side za javne forme
- **Decimal valute** — vse monetarne vrednosti kot Decimal (ne Float)
- **Idempotentna plačila** — `idempotencyKey` prepreči duplikate
- **Secrets masking** — vsi gesli/ključi maskirani v API odgovorih
- **SSRF zaščita** — outbound webhooks zavračajo interne naslove
- **FURS ZOI fail-fast** — produkcija vrže napako če certifikat manjka

> 📋 Glej [AUDIT-REPORT.md](./AUDIT-REPORT.md) za celovito poročilo o varnostnem auditu (40 findingov, 40 popravkov).

---

## 🌍 Javne strani

| Stran | URL | Opis |
|---|---|---|
| POS (blagajna) | `/` | Glavna POS aplikacija (PIN login) |
| KDS | `/kds` | Kuhinjski zaslon (kuhar login) |
| Natakar | `/waiter` | Natakarjeva tablica (mobilni pogled) |
| QR meni | `/qr-menu` | Javni meni za stranke |
| QR naročanje | `/qr/[tableId]` | Naročanje z mize prek QR kode |
| Rezervacije | `/reserve` | Javna stran za rezervacije |
| Račun | `/receipt` | Digitalni račun |
| Sledenje naročila | `/order-status/[orderId]` | Sledenje za stranke |
| Cenik | `/pricing` | Cenik strani |
| Povratne informacije | `/feedback` | Javne ocene |

---

## 📄 Licenca

MIT License — glej [LICENSE](./LICENSE)

---

## 🤝 Prispevanje

Glej [CONTRIBUTING.md](./CONTRIBUTING.md)

---

<div align="center">

**RestaurantOS** — Odprtokodni POS za restavracije s FURS podporo

[🌐 GitHub](https://github.com/markec12345678/restaurantos) · [🛡️ Audit Report](./AUDIT-REPORT.md) · [🔒 Security](./SECURITY.md) · [🚀 Deployment](./DEPLOYMENT-GUIDE.md) · [📊 E2E Tests](./E2E-TEST-REPORT.md)

</div>

<!-- build trigger: 1781806341 -->

<!-- build trigger: force fresh Vercel deploy 1781875784 -->
