<div align="center">

# 🍽️ RestaurantOS

### Profesionalni POS sistem za restavracije

**Najnaprednejši odprtokodni restavratorski POS sistem z evropsko standardizacijo**

[![Next.js](https://img.shields.io/badge/Next.js-16.1.3-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.x-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](./LICENSE)
[![Languages](https://img.shields.io/badge/i18n-5_languages-blue?style=flat-square)](./messages/)
[![FURS](https://img.shields.io/badge/FURS-Certified-red?style=flat-square)](./src/app/api/furs/)

</div>

---

## 📋 Pregled

RestaurantOS je celovit, profesionalni Point of Sale (POS) sistem, zasnovan posebej za evropske restavracije, s poudarkom na slovensko tržišče in FURS davčno potrjevanje. Združuje najboljše prakse svetovnih POS sistemov (Toast, TouchBistro, Square, Lightspeed, 7shifts, OpenTable) v enotno, sodobno spletno aplikacijo.

Sistem pokriva vse vidike restavratorskega poslovanja — od naročanja in plačevanja, preko kuhinjskega prikaza in zalog, do analitike, davčnega potrjevanja in upravljanja osebja. Deluje tudi brez internetne povezave zahvaljujoč Service Workerju in IndexedDB, kar je ključnega pomena za zanesljivo poslovanje v restavracijah.

### Ključne prednosti

- **🇸🇮 FURS certificirano** — Avtomatsko davčno potrjevanje računov (ZOI offline, EOR queued)
- **🌍 Večjezično** — 5 jezikov (Slovenščina, English, Italiano, Hrvatski, Deutsch)
- **📱 Offline-first** — Service Worker + Background Sync + IndexedDB (22 trgovin)
- **🔒 Varno** — Zod validacija, Prisma $transaction, `requireAuth()` + `ROUTE_PERMISSIONS`
- **🖨️ ESC/POS tiskanje** — Podpora za termične tiskalnike
- **📊 Napredna analitika** — WoW primerjava, toplotna karta, analitika gostov
- **🤖 AI zmogljivosti** — Gemini AI napovedi, priporočila, pomočnik
- **🏢 Multi-lokacija** — Več lokacij z ločenimi FURS certifikati
- **📱 PWA ready** — Namestljiv na namizje, deluje kot native aplikacija

---

## 🏗️ Arhitektura

| Tehnologija | Namen |
|---|---|
| **Next.js 16.1.x** | Full-stack framework (App Router, Server Components, API Routes) |
| **TypeScript** | Tipovno varna koda po vsem projektu |
| **Prisma ORM 5.x** | Dostop do baze (SQLite) s 70 modeli, Decimal za valute |
| **SQLite** | Lokalna baza (brez zunanjih odvisnosti) |
| **Tailwind CSS 4** | Sodobno oblikovanje z utility-first pristopom |
| **shadcn/ui** | UI komponente (Radix UI + Tailwind CSS) |
| **TanStack Query** | Upravljanje stanja strežniških podatkov in caching |
| **TanStack Table** | Napredne tabele s sortiranjem in filtriranjem |
| **Recharts** | Interaktivni grafikoni in vizualizacije |
| **next-intl** | Internacionalizacija (5 jezikov s polnimi prevodi) |
| **Zod** | Validacija podatkov na strežniku in odjemalcu |
| **Zustand** | Lahko globalno stanje za POS košarico in UI |
| **Service Worker** | Offline zmogljivost, predpomnjenje, sinhronizacija |
| **IndexedDB** | Lokalno shranjevanje (22 trgovin) za offline delovanje |
| **Framer Motion** | Tekoče animacije in prehodi |
| **date-fns** | Obdelava datumov in časov |
| **QRCode** | Generiranje QR kod za mize, račune, menije |
| **docx** | Generiranje Word dokumentov za poročila |
| **Sharp** | Obdelava slik na strežniku |
| **ws (WebSocket)** | Real-time komunikacija za KDS in obvestila |

### Arhitekturni diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      RestaurantOS                            │
├──────────────────────┬──────────────────────────────────────┤
│   FRONTEND (React)   │         BACKEND (Next.js)            │
│                      │                                      │
│  ┌──────────────┐   │   ┌──────────────────────────┐       │
│  │  POS App     │   │   │  API Routes (70+ modulov) │       │
│  │  (474 dat.)  │◄──┼──►│  - Auth + Permissions     │       │
│  │              │   │   │  - Zod Validation         │       │
│  │  ┌────────┐  │   │   │  - Prisma Transactions    │       │
│  │  │Zustand │  │   │   └──────────┬───────────────┘       │
│  │  │Store   │  │   │              │                       │
│  │  └────────┘  │   │   ┌──────────▼───────────────┐       │
│  │              │   │   │  Prisma ORM (70 modelov)  │       │
│  │  ┌────────┐  │   │   └──────────┬───────────────┘       │
│  │  │TanStack│  │   │              │                       │
│  │  │Query   │  │   │   ┌──────────▼───────────────┐       │
│  │  └────────┘  │   │   │  SQLite Database          │       │
│  └──────────────┘   │   │  (438 meni postavk, 70 modelov) │
│                      │   └──────────────────────────┘       │
│  ┌──────────────┐   │                                      │
│  │  Public Pages│   │   ┌──────────────────────────┐       │
│  │  - QR Menu   │   │   │  External Services        │       │
│  │  - Reserve   │   │   │  - FURS Davčna blagajna   │       │
│  │  - Order     │   │   │  - Gemini AI              │       │
│  │  - Receipt   │   │   │  - ESC/POS Printers       │       │
│  │  - Waiter    │   │   │  - WebSocket Server        │       │
│  └──────────────┘   │   └──────────────────────────┘       │
│                      │                                      │
│  ┌──────────────┐   │   ┌──────────────────────────┐       │
│  │  Service     │   │   │  Webhook System            │       │
│  │  Worker      │◄──┼──►│  - Glovo, Wolt, Bolt      │       │
│  │  + IndexedDB │   │   │  - Custom integrations     │       │
│  └──────────────┘   │   └──────────────────────────┘       │
└──────────────────────┴──────────────────────────────────────┘
```

---

## 📦 Projekt struktura

```
restaurantos/
├── prisma/
│   └── schema.prisma          # 70 Prisma modelov (1979 vrstic)
├── src/
│   ├── app/
│   │   ├── api/               # 70+ API modulov (132 rut)
│   │   │   ├── ai/            # AI napovedi in priporočila
│   │   │   ├── ai-assistant/  # AI klepet pomočnik
│   │   │   ├── audit/         # Revizijski dnevnik
│   │   │   ├── auth/          # Avtentikacija (PIN, seje)
│   │   │   ├── card-terminal/ # Bančni terminal
│   │   │   ├── cash-register/ # Blagajna (odpiranje/zapiranje)
│   │   │   ├── categories/    # Kategorije menija
│   │   │   ├── checks/        # Delitev računa
│   │   │   ├── configuration/ # Nastavitve restavracije
│   │   │   ├── courses/       # Course pacing
│   │   │   ├── daily-checklist/ # Dnevni seznam
│   │   │   ├── dashboard/     # Nadzorna plošča
│   │   │   ├── delivery/      # Dostave
│   │   │   ├── delivery-tracking/ # Sledenje dostav
│   │   │   ├── delivery-zones/ # Cone dostave
│   │   │   ├── digital-receipt/ # Digitalni račun
│   │   │   ├── discounts/     # Popusti
│   │   │   ├── employees/     # Zaposleni
│   │   │   ├── end-of-day/    # Zaključek dneva
│   │   │   ├── expenses/      # Stroški
│   │   │   ├── feedback-public/ # Javne ocene
│   │   │   ├── food-cost/     # Kalkulator stroškov
│   │   │   ├── furs/          # FURS davčno potrjevanje
│   │   │   ├── gift-cards/    # Darilne kartice
│   │   │   ├── guests/        # Upravljanje gostov
│   │   │   ├── haccp/         # HACCP dnevnik
│   │   │   ├── happy-hour/    # Happy hour akcije
│   │   │   ├── integrations/  # Zunanje integracije
│   │   │   ├── inventory/     # Zaloge
│   │   │   ├── kitchen/       # Kuhinja
│   │   │   ├── locations/     # Lokacije
│   │   │   ├── loyalty/       # Zvestoben program
│   │   │   ├── menu-items/    # Meni postavke
│   │   │   ├── menus/         # Meniji
│   │   │   ├── modifier-groups/ # Skupine prilagoditev
│   │   │   ├── notifications/ # Obvestila
│   │   │   ├── opening-hours/ # Odpiralni časi
│   │   │   ├── orders/        # Naročila
│   │   │   ├── payments/      # Plačila
│   │   │   ├── print/         # Tiskanje
│   │   │   ├── public/        # Javne API-ji (brez auth)
│   │   │   ├── purchase-orders/ # Nabavna naročila
│   │   │   ├── recipes/       # Recepti
│   │   │   ├── reports/       # Poročila
│   │   │   ├── reservations/  # Rezervacije
│   │   │   ├── seed/          # Sejanje baze
│   │   │   ├── settings/      # Nastavitve
│   │   │   ├── shifts/        # Izmene
│   │   │   ├── staff-performance/ # Učinkovitost osebja
│   │   │   ├── staff-shifts/  # Razpored zaposlenih
│   │   │   ├── stock/         # Zaloge
│   │   │   ├── subscription/  # Naročnine
│   │   │   ├── suppliers/     # Dobavitelji
│   │   │   ├── tables/        # Mize
│   │   │   ├── time-entries/  # Časovne evidence
│   │   │   ├── tip-pool/      # Napitnine
│   │   │   ├── waitlist/      # Čakalni seznam
│   │   │   ├── webhooks/      # Webhook integracije
│   │   │   ├── ws-broadcast/  # WebSocket broadcast
│   │   │   └── z-report/      # Z-poročilo
│   │   ├── [locale]/          # Internacionalizirane strani
│   │   │   ├── kds/           # Kitchen Display System
│   │   │   ├── order-status/  # Sledenje naročila za stranke
│   │   │   ├── pricing/       # Cenik strani
│   │   │   ├── qr-menu/       # QR meni za stranke
│   │   │   ├── qr/            # QR naročanje po mizi
│   │   │   ├── receipt/       # Digitalni račun
│   │   │   ├── reserve/       # Javna stran za rezervacije
│   │   │   └── waiter/        # Natakalni mobilni pogled
│   │   └── feedback/          # Javna stran za ocene
│   ├── components/
│   │   ├── pos/               # 474 POS datotek (komponente, hooki, tipi, konstante)
│   │   └── ui/                # shadcn/ui komponente
│   └── lib/
│       ├── auth-middleware.ts  # Avtentikacija in dovoljenja
│       ├── db.ts              # Prisma klient + audit log
│       ├── decimal.ts         # Decimal aritmetika (toNum, round2, add, subtract, ...)
│       ├── rate-limit.ts      # Rate limiting za javne API-je
│       ├── validations.ts     # Zod sheme (55+ shem, validateBody helper)
│       ├── i18n.ts            # 5-jezični prevodi
│       ├── store.ts           # Zustand globalno stanje
│       └── offline/           # IndexedDB + Service Worker
├── messages/                  # i18n prevodi (5 jezikov)
│   ├── sl.json               # Slovenščina (primarni)
│   ├── en.json               # English
│   ├── it.json               # Italiano
│   ├── hr.json               # Hrvatski
│   └── de.json               # Deutsch
├── db/
│   └── custom.db             # SQLite baza (438 meni postavk)
├── public/                    # Statične datoteke, slike
├── .env.example              # Predloga okoljskih spremenljivk
├── Dockerfile                # Docker za produkcijo
├── CONTRIBUTING.md           # Navodila za sodelovanje
├── LICENSE                   # MIT licenca
└── README.md                 # Ta datoteka
```

---

## 🚀 Namestitev in zagon

### Zahteve

- **Node.js** 18+ (priporočeno 20+)
- **npm** 9+ ali **bun** 1.0+
- **Operacijski sistem**: Linux, macOS ali Windows z WSL2

### Hitri začetek

```bash
# 1. Kloniraj repozitorij
git clone https://github.com/markec12345678/restaurantos.git
cd restaurantos

# 2. Namesti odvisnosti
npm install

# 3. Nastavi okoljske spremenljivke
cp .env.example .env
# Uredi .env in nastavi GEMINI_API_KEY (za AI funkcije)

# 4. Sinhroniziraj bazo in ustvari Prisma klienta
npx prisma db push
npx prisma generate

# 5. Zaženi razvojni strežnik
npm run dev

# 6. Odpri http://localhost:3000
```

### Začetni prijavni podatki

| Vloga | PIN | Dovoljenja |
|---|---|---|
| Admin | `1234` | Poln dostop (vse funkcije) |
| Staff | `0000` | Omejen dostop (naročila, mize, KDS) |

### Produkcijski zagon

```bash
# Build optimizirane aplikacije
npm run build

# Zaženi produkcijski strežnik
npm run start

# Ali z bun (hitrejši zagon)
bun .next/standalone/server.js
```

### Docker zagon

```bash
# Build Docker slike
docker build -t restaurantos .

# Zaženi kontejner
docker run -p 3000:3000 \
  -v $(pwd)/db:/app/db \
  -e DATABASE_URL=file:/app/db/custom.db \
  restaurantos
```

### PM2 zagon (produkcija z avtomatskim restartom)

```bash
# Namesti PM2
npm install -g pm2

# Zaženi z ecosystem konfiguracijo
pm2 start ecosystem.config.js

# Omogoči avtomatski zagon ob reboot
pm2 startup
pm2 save
```

---

## 🎯 Funkcionalnosti

### 💰 Blagajna in naročanje

| Funkcija | Opis |
|---|---|
| Naročilna plošča | Hitro naročanje s kategorijami, iskanjem, prilagoditvami |
| Vizualni tloris | Interaktivni tloris miz s statusom (prosto/zasedeno/rezervirano) |
| Delitev računa | Split check po osebah ali artiklih |
| Storno artiklov | Void z razlogom in avtorizacijo |
| Popusti | Odstotni in fiksni popusti z avtorizacijo |
| Davčne stopnje | Več DDV stopenj (22%, 9.5%, 5%, 0%) |
| Plačilne metode | Gotovina, kartica, kombinirano, darilna kartica |
| Blagajna | Odpiranje/zapiranje izmene, začetna gotovina, Z-poročilo |
| Samodejno napitnina | Konfigurabilna avtomatska napitnina za skupine |
| Bančni terminal | Integracija s kartičnim terminalom |

### 🍳 Kuhinja

| Funkcija | Opis |
|---|---|
| Kuhinjski zaslon (KDS) | Real-time prikaz naročil s statusi in časi |
| Kuhinja Pro | Napredni pripravljalni vrstni red s prednostmi, timerji, zvočnimi opozorili |
| Tempo jedi | Course pacing (predjedi → glavne jedi → sladice) |
| Časi priprave | Ocenjeni in dejanski časi za vsak artikel |
| Prioritetno sortiranje | Avtomatsko sortiranje po nujnosti in času čakanja |

### 📊 Analitika in poročila

| Funkcija | Opis |
|---|---|
| Nadzorna plošča | 6 KPI-jev, 7-dnevni graf, kategorije, urni pregled |
| WoW primerjava | Primerjava s prejšnjim tednom (prihodek, naročila, povprečje) |
| Toplotna karta | Vizualizacija prometa po dnevih in urah (4 tedne) |
| Analitika gostov | Skupno gostov, stopnja povratka, zvestoba, povratne informacije |
| Menu Engineering | BCG matrika (Zvezdniki, Konji, Zagonetke, Psi) |
| Učinkovitost zaposlenih | Napitnine, čas strežbe, upsell, obračun miz, ocena 0-100 |
| Obračun miz | Zasedenost, obračun, počasne mize, kapaciteta, priporočila |
| Poročila 2.0 | Prodaja, DDV, izmene, zaloge, dobavitelji, izvoz |
| AI napovedi | Napovedovanje prometa z Gemini AI |
| AI priporočila | Pametna priporočila za optimizacijo menija, cen, zalog |
| Stroški | Kategorizirani stroški, ponavljajoči se stroški, grafikoni |
| Dnevni seznam | Opening/closing checklist za osebje |

### 📅 Rezervacije in čakalni seznam

| Funkcija | Opis |
|---|---|
| Upravitelj rezervacij | CRUD rezervacije, statusi, dodeljevanje miz |
| Javna stran /reserve | Spletno naročanje za stranke s potrditvami |
| Čakalni seznam | Upravljanje čakajočih gostov s časom čakanja |
| Ocena čakanja | AI ocena čakalnega časa na podlagi zgodovine |

### 👥 Osebje

| Funkcija | Opis |
|---|---|
| Upravitelj zaposlenih | CRUD zaposlenih, PIN prijava, vloge, kontakti |
| Razpored zaposlenih | Tedenski vizualni razpored z izmenami (7shifts standard) |
| Izmene in ure | Časovne evidence, avtomatski izračun, tip-in/tip-out |
| Napitnine | Pool in point distribucija napitnin |
| Učinkovitost | KPI-ji po zaposlenem s priporočili |
| Dnevni seznam | Opening/closing checklist z avtorizacijo |

### 📦 Zaloga in dobava

| Funkcija | Opis |
|---|---|
| Upravitelj zalog | CRUD artiklov, minimalne količine, enote |
| Dobavitelji | Upravljanje dobaviteljev s kontakti in pogodbami |
| Nabavna naročila | Ustvarjanje in sledenje nabavnih naročil |
| Recepti | Recepti s normativi in kalkulacijo |
| Kalkulator stroškov jedi | Food cost %, prispevek k pokritju, primerjava cen |
| Sledenje zalog | Vnosi, izpisi, prenosi, inventura |
| Dashboard zalog | Vizualni pregled stanja zalog z opozorili |

### 🏥 HACCP in varnost hrane

| Funkcija | Opis |
|---|---|
| HACCP dnevnik | Temperature, čiščenje, CCP kontrole z opozorili |
| Matrika alergenov | EU 1169/2011 — 14 alergenov za vsak artikel |
| Revizijski dnevnik | SHA-256 hash-veriga za zaščito pred poseganjem |
| Preverjanje integritete | Avtomatsko preverjanje verige revizijskega dnevnika |

### 🚚 Dostava

| Funkcija | Opis |
|---|---|
| Upravitelj dostav | Naročila za dostavo s statusi in časom |
| Cone dostave | Zonsko oblikovanje cen (po poštnah/sosednjih občinah) |
| Integracije | Glovo, Wolt, Bolt Food webhook integracije |
| GPS sledenje | Sledenje voznikom v realnem času |
| Stanje dostave | Vizualni pregled aktivnih dostav na zemljevidu |

### 💳 Plačila in FURS

| Funkcija | Opis |
|---|---|
| FURS potrjevanje | Avtomatsko davčno potrjevanje računov (Slovenija) |
| ZOI offline | Generiranje zaščitnega označevalnika brez povezave |
| EOR čakalna vrsta | Čakalna vrsta za EOR ko FURS ni dosegljiv |
| Simulacijski način | Testno okolje brez pravega certifikata |
| Z-poročilo | Dnevno zaključno poročilo blagajne |
| Upravitelj certifikatov | Uvoz in upravljanje FURS certifikatov |

### 🎫 Zvestoba in darilne kartice

| Funkcija | Opis |
|---|---|
| Zvestoben program | Točke, nivoji (Bronza/Srebro/Zlato), nagrade |
| Darilne kartice | Prodaja, polnjenje, poraba, saldo, transakcije |
| Happy hour | Časovno omejene akcije in popusti z urnikom |

### 🔔 Obvestila

| Funkcija | Opis |
|---|---|
| Upravitelj obvestil | SMS, Email, Push obvestila s predlogami |
| Predloge | Pripravljene predloge za rezervacije, dostave, promocije |
| Množično pošiljanje | Batch pošiljanje do 100 obvestil |
| Zgodovina | Pregled poslanih obvestil s statistiko dostave |

### 📱 Javne strani

| Stran | URL | Opis |
|---|---|---|
| QR meni | `/qr-menu` | Digitalni meni za stranke z alergeni in slikami |
| QR naročanje | `/qr/[tableId]` | Naročanje na mizi z večjezičnim vmesnikom |
| Rezervacije | `/reserve` | Spletno rezerviranje miz |
| Sledenje naročila | `/order-status/[orderId]` | Domino's-style sledenje napredka naročila |
| Digitalni račun | `/receipt` | QR račun z DDV in FURS podatki |
| Natakar | `/waiter` | Mobilni pogled za natakarje |
| Cenik | `/pricing` | Javni cenik storitev |
| KDS | `/kds` | Samostojen kuhinjski zaslon za kuharje |
| Ocene | `/feedback` | Javna stran za ocene in povratne informacije |

### 🌍 Večjezičnost

Podprti jeziki s polnimi prevodi vseh modulov (vsak jezik 800+ ključev):

- 🇸🇮 **Slovenščina** (primarni jezik)
- 🇬🇧 **English**
- 🇮🇹 **Italiano**
- 🇭🇷 **Hrvatski**
- 🇩🇪 **Deutsch**

Preklapljanje jezikov je mogoče kadarkoli preko jezikovnega stikala v vrstici aplikacije.

### 🏢 Multi-lokacija

- Več lokacij z ločenimi FURS certifikati in davčnimi številkami
- Centralizirano upravljanje menijev in cenikov
- Lokacijski KDS, naročila, zaloge in zaposleni
- Naročnina s fakturiranjem in probnim obdobjem
- Dashboard za pregled vseh lokacij

---

## 🗃️ Podatkovni model (70 Prisma modelov)

```
Menu → Category → MenuItem → ModifierGroup → Modifier
                    ↓
              Order → OrderItem → Check → Payment
                ↓
              Table ← Location → DeliveryZone
                ↓
Employee → StaffShift / TimeEntry / Shift
Guest → GuestVisit / GuestFeedback / LoyaltyAccount
Reservation → Table
Supplier → PurchaseOrder → PurchaseOrderItem
InventoryItem → StockTransaction
HaccpEntry / AuditLog (SHA-256 hash chain)
Webhook → WebhookDelivery
Integration → IntegrationLog
Subscription → SubscriptionInvoice
ZReport / TipPool → TipDistribution
DeliveryInfo → DeliveryTracking
GiftCard → GiftCardTransaction
WaitlistEntry / Course / AIConversation
HappyHourSchedule / Receipt
RestaurantSettings / Counter / DailyChecklist
Expense / NotificationTemplate / StaffShift
```

---

## 🔐 Varnost

| Mehanizem | Opis |
|---|---|
| `requireAuth()` | Vse zaščitene API rute zahtevajo veljavno sejo |
| `ROUTE_PERMISSIONS` | Finoumna kontrola dostopa (admin, manager, staff, manage_cash, manage_inventory, view_reports, take_orders) |
| PIN prijava | 4-mestni PIN z bcrypt hash + timing-safe primerjavo |
| Seje | JWT žetoni s potekom (8h TTL, 24h absolutni timeout) |
| Zod validacija | Vsi vhodni podatki validirani na strežniku s shemami (`validateBody()`) |
| Prisma $transaction | Atomski operaciji za kritične transakcije (naročila, plačila, darilne kartice) |
| Audit log z hash verigo | SHA-256 veriga za zaščito pred poseganjem v evidence |
| Rate limiting | Omejitev zahteve na javnih API-jih (prijave, QR naročila, promo kode) |
| CORS zaščita | Konfigurirana za dovoljene izvore |
| XSS zaščita | Sanitizacija vseh uporabniških vnosov |
| Decimal preciznost | Vse valute shranjene kot Decimal (ne Float) — prepreči zaokroževalne napake |
| Idempotentna plačila | `idempotencyKey` prepreči duplikatna plačila ob double-click |
| XML escaping | PAX terminal integracija z `escapeXml()` — prepreči XML injection |
| Privilegijna zaščita | Samo admin lahko dodeli admin vlogo — prepreči privilege escalation |
| Capping zvestobe | Omejitev 50K točk na prilagoditev, 500K skupno — prepreči zlorabo |
| Promo koda varnost | Iskanje po `promoCode`, ne internem ID-ju — prepreči ID enumeracijo |
| Soft-delete | HACCP, gostje, artikli, izmene — ohranijo revizijsko sled |
| GDPR anonimizacija | Brisanje gosta anonimizira PII, ohrani poslovne evidence |
| Strežniške cene | Cene artiklov/modifikatorjev vedno iz baze — klient ne more tamperati |
| Generična napaka | Javni API-ji vračajo generična sporočila — interno stanje ni izpostavljeno |
| Datumsko omejitev | Poročila omejena na 366 dni — prepreči masiven izvoz podatkov |
| Združljiv export | CSV izvoz onemogoči formule (=+@-) — prepreči CSV injection |
| Javni ID-ji | Javni API-ji ne izpostavljajo internih DB ID-jev, koordinat, telefonskih številk |
| Inventory export | Izvoz zalog zahteva admin dovoljenje — vsebuje občutljive nabavne podatke |

---

## 📴 Offline zmogljivosti

RestaurantOS je zasnovan kot offline-first aplikacija, kar pomeni, da bistvene funkcije delujejo tudi brez internetne povezave:

- **Service Worker** — Predpomnjenje virov za offline delovanje (HTML, CSS, JS, slike)
- **IndexedDB** — 22 trgovin za lokalno shranjevanje podatkov (naročila, meni, mize)
- **Background Sync** — Avtomatska sinhronizacija ob ponovni povezavi z omrežjem
- **15+ custom hookov** — `useOfflineOrder`, `useSyncQueue`, `useOfflineMenu`, itd.
- **FURS ZOI offline** — Generiranje zaščitnega označevalnika brez povezave
- **EOR čakalna vrsta** — Računi se pošljejo FURS-u ob ponovni povezavi

---

## 🖨️ Tiskanje

- **ESC/POS protokol** — Podpora za večino termičnih tiskalnikov (Epson, Star, Bixolon)
- **Več tiskalnikov** — Kuhinja, bar, blagajna ločeno konfigurirani
- **Samodejno tiskanje** — Kuhinjski bon ob naročilu, račun ob plačilu
- **Konfiguracija** — URL naslovi tiskalnikov, širina papirja (58mm/80mm)
- **Formati** — Računi, boni, Z-poročila, HACCP izpisi

---

## 🤖 AI zmogljivosti

RestaurantOS vključuje več AI funkcij, ki jih poganja Google Gemini:

| Funkcija | Opis |
|---|---|
| **AI pomočnik** | Klepet z Gemini AI za podporo odločanju v realnem času |
| **AI napovedi** | Napovedovanje prometa na podlagi zgodovinskih podatkov in trendov |
| **AI priporočila** | Optimizacija menija, cen, zalog na podlagi analize |
| **AI upsell** | Pametno predlaganje dodatkov ob naročanju (priloge, pijača) |
| **AI ocena čakanja** | Napoved čakalnega časa na podlagi zgodovine in zasedenosti |
| **AI prehranska analiza** | Kalkulacija kalorij in hranilnih vrednosti jedi |

---

## 🔌 Integracije in Webhook-i

| Integracija | Opis |
|---|---|
| **Glovo** | Sprejemanje naročil iz Glovo platforme preko webhook-a |
| **Wolt** | Sprejemanje naročil iz Wolt platforme |
| **Bolt Food** | Sprejemanje naročil iz Bolt Food platforme |
| **Custom webhooks** | Poljubno konfigurirani webhook-i za zunanje sisteme |
| **Webhook zgodovina** | Dnevnik dostav z avtomatskim ponovnim pošiljanjem ob napaki |
| **API za integracije** | REST API za povezavo s KP-ji, računovodskimi programi |

---

## 📊 Statistika projekta

| Metrika | Vrednost |
|---|---|
| Vrstic kode | ~105.000+ |
| Izvornih datotek | 740 |
| POS datotek (komponente/hooki/tipi) | 474 |
| POS podmap (modulov) | 60 |
| API modulov | 70+ (132 rut) |
| Prisma modelov | 70 |
| Zod shem | 55+ |
| Javni strani | 12 |
| Jezikov | 5 |
| Meni postavk (seed) | 438 |
| Odvisnosti | 70+ |

### 🔄 Refaktoriranje komponent (24 krogi)

Projekt je bil deležen obsežnega refaktoriranja, pri katerem so bile velike monolitne komponente razdeljene v manjše, bolj obvladljive pod-komponente, namenske hooke in tipne datoteke.

| Krog | Razdeljene komponente | Nove datoteke | Največja pred | Največja po |
|---|---|---|---|---|
| 1–8 | 40+ monolitnih komponent | 120+ | 1200+ vrstic | <400 vrstic |
| 9 | ESLint popravki (22 napak → 0) | — | — | — |
| 10–13 | 30+ komponent v podmape | 80+ | 900+ vrstic | <400 vrstic |
| 14 | MenuBrowser, ConfigForm, OrderPanel, FursTab, OrderList | 14 novih | 585 vrstic | <400 vrstic |
| 15–16 | BookingExtractReport, KitchenStationManager, RecipeTab, ShiftManager, GlobalNotifications | 10 novih | 460 vrstic | <280 vrstic |
| 17 | BookingExtractReport, KitchenStationManager, RecipeTab, useIntegrationManager | 4 nove | 360 vrstic | <290 vrstic |
| 18 | ShiftManager, GlobalNotifications, AIRecommendations, WebhookManager | 4 nove | 345 vrstic | <275 vrstic |
| 19 | MenuManager, GiftCardTable, SplitCheckDialog, ReceiptDialog, MenuBrowser | 7 novih | 300 vrstic | <250 vrstic |
| 20 | DeliveryManager, DailyChecklist, useGiftCardManager, TableMap, ExtendedForms | 12 novih | 283 vrstic | <224 vrstic |
| 21 | SettingsManager, HappyHourTab, ShiftManager, ConfigCard, RecipeManager | 7 novih | 272 vrstic | <206 vrstic |
| 22 | PrinterManager, useOrderPanel, PinLogin, KitchenPrepQueue, StaffScheduler | 5 novih | 268 vrstic | <218 vrstic |
| 23 | WebhookManager, MultiLocationDashboard, KitchenOrderCard, ReceiptContent, useFloorPlanState | 9 novih | 261 vrstic | <223 vrstic |
| 24 | dashboard/constants, MenuManager, ComplianceDashboard, useInventoryState, ReportsView | 6 novih | 250 vrstic | <217 vrstic |

**Rezultat:** Vse POS datoteke so zdaj pod 220 vrstic. Vsaka komponenta sledi vzorcu:

- Pod-komponente ovite z `memo()` in z poimenovanimi izvozi
- Starševske komponente uporabljajo `next/dynamic` za leno nalaganje
- Vse poizvedbe/mutacije/handlerji ostanejo v starševski komponenti ali namenskem hooku
- `onOpenChange` vzorec (brez setState znotraj useEffect)
- `htmlFor` + `id` pari za label-input povezave (WCAG 2.1 AA)
- `aria-label` atributi na interaktivnih elementih
- Slovenski komentarji ohranjeni po celotni kodi
- React Query key factory vzorec (`queryKeys`)

---

## 🧪 Razvoj

### Razvojna okolje

```bash
# Razvojni strežnik z avtomatskim osveževanjem
npm run dev

# Tipovno preverjanje
npx tsc --noEmit

# Build
npm run build

# Prisma studio (vizualni urejevalnik baze)
npx prisma studio

# Reset baze (pobriše vse podatke!)
npx prisma db push --force-reset

# Generiraj Prisma klienta
npx prisma generate
```

### Sejanje baze

```bash
# Sej osnovne podatke (kategorije, meni, zaposleni)
curl http://localhost:3000/api/seed

# Sej hrano s normativi
curl http://localhost:3000/api/seed-norms
```

### Dodajanje novih funkcij

1. Ustvari Prisma model v `prisma/schema.prisma`
2. Zaženi `npx prisma db push`
3. Ustvari API route v `src/app/api/[modul]/route.ts`
4. Ustvari komponento v `src/components/pos/[Komponenta]/[Komponenta].tsx` (z podmapo za pod-komponente, hooki, tipi in konstantami)
5. Dodaj i18n ključe v vseh 5 jezikih (`messages/*.json`)
6. Registriraj komponento v `src/app/[locale]/pos/page.tsx` in Sidebar
7. Če komponenta preseže 400 vrstic, jo razdeli na pod-komponente (memo + named export), namenske hooke in konstante

---

## 🛣️ Načrt za prihodnje

### Kratkoročno (Q2 2026)
- [ ] Twilio SMS integracija za obvestila
- [ ] SendGrid email integracija
- [ ] Stripe plačilni prehod za spletne naročbine
- [ ] Real-time WebSocket posodobitve za vse module
- [ ] PWA namestitev z ikono na namizju

### Srednjeročno (Q3 2026)
- [ ] Mobilna aplikacija (React Native / Capacitor)
- [ ] Multi-tenant SaaS način z ločenimi podatki
- [ ] Napredna AI analitika (tfjs napovedi, sezonski vzorci)
- [ ] Avtentikacija z biometrijo (prstni odtis, Face ID)
- [ ] Integracija z računovodskimi programi (Pantheon, SAOP, Datalab)

### Dolgoročno (Q4 2026+)
- [ ] Spletna trgovina za naročanje hrane z lastno domeno
- [ ] Avtomatski backup v oblak (AWS S3, Google Cloud)
- [ ] Napredno upravljanje dobavne verige
- [ ] CRM za goste z avtomatskimi kampanjami
- [ ] Compliance z EU regulativami (GDPR, DSGVO)

---

## 🤝 Sodelovanje

Prispevki so dobrodošli! Prosimo, preberite [CONTRIBUTING.md](./CONTRIBUTING.md) za podrobnosti o:

- Postopku za oddajo pull requestov
- Standardih kodiranja
- Smernicah za commit sporočila
- Testiranju

---

## 📄 Licenca

MIT License — glej [LICENSE](./LICENSE) za podrobnosti.

Copyright (c) 2024-2026 RestaurantOS

---

<div align="center">

**Zgrajeno z ❤️ za slovenske in evropske restavracije**

[🌐 GitHub](https://github.com/markec12345678/restaurantos) · [📧 Povratne informacije](https://github.com/markec12345678/restaurantos/issues) · [📖 Dokumentacija](./CONTRIBUTING.md)

</div>
