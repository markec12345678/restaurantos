# 🚀 RestaurantOS — Vodič za Deployment in Nastavitev Naprav

**Cilj:** Deploy na Vercel → PWA na Chrome → KDS v kuhinji → Natakar na telefonu

---

## 📋 Pregled arhitekture po deployu

```
┌─────────────────────────────────────────────────────────────┐
│                    VERCEL (Cloud)                            │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ POS App     │  │ KDS Page    │  │ Waiter Page │         │
│  │ (blagajna)  │  │ (kuhinja)   │  │ (natakar)   │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                  │
│  ┌──────┴────────────────┴────────────────┴──────┐         │
│  │           Next.js API Routes (serverless)      │         │
│  │  - /api/orders, /api/payments, /api/furs...   │         │
│  └──────────────────────┬────────────────────────┘         │
│                         │                                    │
│  ┌──────────────────────┴────────────────────────┐         │
│  │           PostgreSQL (Vercel Postgres / Neon)  │         │
│  └───────────────────────────────────────────────┘         │
│                                                              │
│  ┌───────────────────────────────────────────────┐         │
│  │     WebSocket Service (Railway / Render)       │         │
│  │     (za real-time KDS — opcionalno)            │         │
│  └───────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
   ┌──────────┐        ┌──────────┐        ┌──────────┐
   │ Blagajna │        │  KDS     │        │ Natakar  │
   │ (PC/     │        │ (Tablet  │        │ (Telefon │
   │  Tablet) │        │  na steni│        │  Android/│
   │          │        │  v kuh.) │        │  iOS)    │
   └──────────┘        └──────────┘        └──────────┘
```

---

## 🟢 KORAK 1: Priprava baze (PostgreSQL)

Vercel ne podpira SQLite (ephemeral filesystem). Moraš preiti na PostgreSQL.

### Opcija A: Vercel Postgres (najenostavneje)

1. Pojdi na https://vercel.com/dashboard → tvoj projekt → **Storage** tab
2. Klikni **Create Database** → **Postgres**
3. Vercel ustvari `DATABASE_URL` avtomatsko

### Opcija B: Neon (free tier, hitro)

1. Pojdi na https://neon.tech → registriraj se
2. Ustvari nov projekt → kopiraj connection string
3. Format: `postgresql://user:pass@host/db?sslmode=require`

### Opcija C: Supabase (free tier)

1. Pojdi na https://supabase.com → registriraj se
2. Ustavi projekt → Settings → Database → Connection string
3. Format: `postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres`

### Sprememba schema.prisma

```prisma
datasource db {
  provider = "postgresql"  // Spremeni iz "sqlite"
  url      = env("DATABASE_URL")
}
```

Po spremembi poženi:
```bash
npx prisma db push    # Sinhroniziraj shemo z novo PostgreSQL bazo
npx prisma generate   # Generiraj Prisma klienta
```

---

## 🟢 KORAK 2: Deploy na Vercel

### 2.1 Push na GitHub (že opravljeno)

Tvoja koda je že na: `https://github.com/markec12345678/restaurantos`
Veja: `chore/professional-cleanup`

### 2.2 Ustvari Vercel projekt

1. Pojdi na https://vercel.com → **Login** z GitHub
2. Klikni **Add New** → **Project**
3. Importiraj `restaurantos` repozitorij
4. **Framework Preset:** Next.js (avtomatsko zaznano)
5. **Root Directory:** `./` (pusti prazno)
6. **Build Command:** `next build` (pusti privzeto)
7. **Output Directory:** pusti prazno (Next.js sam zazna)

### 2.3 Environment Variables (KLJUČNO!)

V Vercel projektu pojdite na **Settings → Environment Variables** in dodaj:

| Key | Value | Opomba |
|---|---|---|
| `DATABASE_URL` | `postgresql://...` | Iz Vercel Postgres / Neon / Supabase |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` | Generiraj naključni string |
| `RECEIPT_TOKEN_SECRET` | `openssl rand -base64 32` | Generiraj naključni string |
| `WEBHOOK_SECRET` | `openssl rand -base64 32` | Generiraj naključni string |
| `GEMINI_API_KEY` | `AIza...` | Iz Google AI Studio (za AI funkcije) |
| `FURS_ENV` | `production` | Ali `test` za testno okolje |
| `FURS_CERT_PATH` | `./certs/furs.p12` | Pot do certifikata |
| `FURS_CERT_PASSWORD` | `tvoje_geslo` | Geslo FURS certifikata |
| `FURS_TAX_NUMBER` | `SI12345678` | Davčna številka |
| `NEXT_PUBLIC_APP_URL` | `https://tvoj-projekt.vercel.app` | URL po deployu |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | `sl` | Slovenščina |
| `COUNTRY_CODE` | `SI` | Slovenija |
| `CORS_ORIGINS` | `https://tvoj-projekt.vercel.app` | Za WebSocket |
| `NODE_ENV` | `production` | Produkcija |

### 2.4 Build Settings

V **Settings → Build & Development Settings**:

| Setting | Value |
|---|---|
| Build Command | `npx prisma generate && next build` |
| Install Command | `npm install` (ali `bun install`) |
| Output Directory | (pusti prazno) |

**Pomembno:** `npx prisma generate` mora teči pred build, da Prisma Client obstaja.

### 2.5 Deploy

Klikni **Deploy**. Vercel bo:
1. Namestil odvisnosti
2. Generiral Prisma klienta
3. Zgradil Next.js aplikacijo
4. Deployal na `https://restaurantos.vercel.app` (ali podobno)

Po deployu pošlji `DATABASE_URL` v okolje in poženi:
```bash
npx prisma db push  # Ustvari tabele v PostgreSQL
```

To lahko narediš tudi lokalno z `DATABASE_URL` iz Vercela:
```bash
DATABASE_URL="postgresql://..." npx prisma db push
```

### 2.6 Seed baze

Po `db:push` poženi seed skripto lokalno z produkcijsko bazo:
```bash
DATABASE_URL="postgresql://..." node scripts/seed/e2e-seed.mjs
DATABASE_URL="postgresql://..." node scripts/seed/recipes-stations-seed.mjs
```

To ustvari: admin (PIN 1234), staff (PIN 0000), 12 miz, 8 artiklov, 2 postaji (kuhinja + bar), recepture.

---

## 🟢 KORAK 3: PWA namestitev na Chrome (Blagajna)

### 3.1 Odpri aplikacijo

1. Odpri Chrome na blagajnem računalniku/tabletu
2. Pojdi na `https://tvoj-projekt.vercel.app`
3. Prijavi se z admin PIN **1234**

### 3.2 Namesti kot PWA

1. V Chrome naslovni vrstici klikni **⊕ nameščeno** ikono (desno)
   - Ali: **⋮ menu → Install RestaurantOS / Namesti aplikacijo**
2. Klikni **Install**
3. Aplikacija se odpre v lastnem oknu (brez naslovne vrstice)

### 3.3 Nastavi za samodejni zagon

**Windows:**
1. Pritisni `Win + R` → `shell:startup`
2. Dodaj bližnjico do RestaurantOS PWA

**Android tablet:**
1. Settings → Apps → RestaurantOS → **Open by default**
2. Dodaj na domači zaslon (dolgo pritisni ikono)

**iPad:**
1. Safari → odpri URL → **Share → Add to Home Screen**
2. (Chrome na iOS ne podpira PWA — uporabi Safari)

### 3.4 Celozaslonski način

V POS aplikaciji:
1. Prijavi se kot admin
2. Klikni **Celozaslonski način** (ikona v zgornjem desnem kotu)
3. Ali pritisni **F11** (Windows)

---

## 🟢 KORAK 4: KDS v kuhinji

### 4.1 Hardverska nastavitev

**Priporočena oprema:**
- **Tablet** (10"+) na steni v kuhinji (iPad, Android tablet, ali namizni monitor z dotikom)
- **Bump bar** (namenska tipkovnica za hitre akcije — opcionalno)
- **Ethernet/WiFi** povezava (za real-time)

### 4.2 Programska nastavitev

1. Odpri Chrome/Safari na kuhinjskem tabletu
2. Pojdi na: `https://tvoj-projekt.vercel.app/kds`
3. Prijavi se z **kuhar PIN** (npr. 2222 — ustvari zaposlenega z tem PIN)
4. Klikni **Vstopi v kuhinjo**

### 4.3 KDS konfiguracija

Po prijavi:
1. **Station filter** — izberi postajo:
   - **kitchen** (vroča kuhinja — steak, burger, pizza)
   - **bar** (pijače — pivo, kava, koktajli)
   - **Vse** (prikaz vsega)
2. **Celozaslonski način** — klikni ikono za fullscreen
3. **Zvočna opozorila** — KDS predvaja zvok ob novem naročilu

### 4.4 PWA namestitev (za samodejni zagon)

1. Chrome → **⋮ → Install RestaurantOS** (kot PWA)
2. Ali Safari (iPad) → **Share → Add to Home Screen**
3. Nastavi za samodejni zagon ob vklopu tableta

### 4.5 Bump Bar (napredno)

Za hitro delo brez dotika:
1. Poveži USB Bump Bar (npr. Epson TM-88V s bump funkcijo)
2. KDS podpira tipke:
   - **Enter** = Bump (označi kot pripravljeno)
   - **Pfeffer dol** = naslednje naročilo
   - **Pfeffer gor** = prejšnje naročilo
   - **Esc** = recall (prikliči nazaj)

### 4.6 Real-time posodobitve

KDS ima dva načina:
- **WebSocket** (real-time, <100ms) — zahteva WS service (glej korak 6)
- **Polling** (5s) — deluje brez WS, dovolj za večino restavracij

---

## 🟢 KORAK 5: Natakar na telefonu

### 5.1 Android telefon

1. Odpri **Chrome** na telefonu
2. Pojdi na: `https://tvoj-projekt.vercel.app/waiter`
3. Prijavi se z **natakar PIN** (npr. 1111)
4. **Namesti kot PWA:**
   - Chrome → **⋮ → Add to Home screen / Dodaj na začetni zaslon**
   - Ikon se pojavi na domačem zaslonu
   - Odpri iz ikone (deluje kot native aplikacija)

### 5.2 iPhone (iOS)

1. Odpri **Safari** (NE Chrome — iOS ne podpira PWA v Chrome)
2. Pojdi na: `https://tvoj-projekt.vercel.app/waiter`
3. Prijavi se z natakar PIN
4. **Namesti kot PWA:**
   - **Share gumb → Add to Home Screen / Dodaj na začetni zaslon**
   - Ikon se pojavi na domačem zaslonu
   - Odpri iz ikone

### 5.3 Natakarjeve funkcije na telefonu

Po prijavi natakar vidi:
- **Moje mize** — mize ki so mu dodeljene
- **Aktivna naročila** — kaj je treba odnesti
- **Pripravljeno** — artikli ki čakajo na postrežbo (iz kuhinje)
- **Novo naročilo** — hitro dodajanje artiklov z mize
- **Kliči natakarja** — gost lahko pokliče natakar prek QR kode

### 5.4 Offline podpora

PWA deluje tudi brez interneta (Service Worker + IndexedDB):
- Naročila se shranijo lokalno
- Ob vzpostavitvi povezave se avtomatsko sinhronizirajo
- 2 trgovini v IndexedDB (`pendingOrders` za offline naročila, `pendingReceipts` za FURS 48h retry)

---

## 🟢 KORAK 6: WebSocket Service (za real-time KDS)

Vercel ne podpira custom server.js z WebSocket. Za real-time KDS:

### Opcija A: Polling (enostavno, dovolj za večino)

KDS že ima 5s polling fallback. Deluje brez WS. Za majhne restavracije je to dovolj.

### Opcija B: Railway WebSocket Service (za real-time)

1. Pojdi na https://railway.app → registriraj se
2. **New Project → Deploy from GitHub** → izberi `restaurantos`
3. Nastavi:
   - **Start command:** `node server.js`
   - **Port:** `3001` (Railway dodeli URL)
   - **Environment:** `NODE_ENV=production`, `NEXT_PUBLIC_APP_URL=https://tvoj-projekt.vercel.app`
4. Railway da URL: `https://restaurantos-ws.up.railway.app`
5. V Vercel env dodaj: `WS_URL=https://restaurantos-ws.up.railway.app`
6. V frontend kodi posodobi WS connection URL

### Opcija C: Render WebSocket Service

1. Pojdi na https://render.com → registriraj se
2. **New → Web Service** → izberi GitHub repo
3. **Build:** `npm install`
4. **Start:** `node server.js`
5. Render da URL: `https://restaurantos-ws.onrender.com`

### Opcija D: Vercel + Ably/Pusher (third-party WebSocket)

Za najbolj robustno rešitev:
1. Registriraj se na https://pusher.com ali https://ably.io
2. Zamenjaj `ws` z Pusher/Ably klientom v `src/lib/websocket-client/`
3. Dodaj API ključe v Vercel env

---

## 🟢 KORAK 7: QR kode za mize

### 7.1 Generiraj QR kode

1. Prijavi se v POS kot admin
2. Pojdi na: `https://tvoj-projekt.vercel.app/api/tables/qr-batch`
3. Vidiš JSON z QR URL-ji za vse mize:
   ```json
   {
     "tables": [
       {
         "tableNumber": 1,
         "qrUrl": "https://tvoj-projekt.vercel.app/qr/cmqi8cnyo...",
         "qrImageUrl": "https://tvoj-projekt.vercel.app/api/tables/cmqi8cnyo.../qr"
       }
     ]
   }
   ```

### 7.2 Natisni QR nalepke

Za vsako mizo:
1. Odpri `qrImageUrl` v brskalniku (npr. `https://tvoj-projekt.vercel.app/api/tables/{tableId}/qr`)
2. SHRANI sliko (PNG, 400x400px)
3. Natisni na nalepkah (priporočeno: 5x5cm vodoodbojne nalepke)
4. Prilepi na mizo

### 7.3 Test QR naročanja

1. Gost poslika QR kodo z telefonom
2. Odpre se PWA meni na `/qr/[tableId]`
3. Gost izbere artikle, odda naročilo
4. KDS v kuhinji prikaže naročilo z **modrim "QR" badge**
5. Miza na tlorisu se avtomatsko spremeni v **occupied**

---

## 🟢 KORAK 8: FURS certifikat

### 8.1 Pridobi certifikat

1. Pojdi na https://edavki.durs.si
2. **Vložitev zahteve → Davčna blagajna → Namensko digitalno potrdilo**
3. Prenesi `.p12` datoteko

### 8.2 Nastavi v aplikaciji

1. Prijavi se kot admin
2. Pojdi na **Konfiguracija → FURS**
3. Naloži `.p12` certifikat
4. Vnesi geslo
5. Vnesi davčno številko
6. Testiraj povezavo (FURS test okolje)

### 8.3 Za produkcijo

V `.env` nastavi:
```
FURS_ENV=production
FURS_CERT_PATH=./certs/furs.p12
FURS_CERT_PASSWORD=tvoje_geslo
FURS_TAX_NUMBER=SI12345678
```

**Opomba:** Na Vercel ne moreš shraniti `.p12` datoteke. Rešitve:
- **AWS S3 / Cloudinary** — shrani certifikat v cloud, preberi ob zagonu
- **Vercel Blob** — shrani kot blob
- **Base64 v env** — enkodiraj `.p12` kot base64 string v env var

---

## 📋 Checklist pred prvim dnem

- [ ] PostgreSQL baza ustvarjena (Vercel Postgres / Neon / Supabase)
- [ ] `schema.prisma` spremenjen iz `sqlite` v `postgresql`
- [ ] `prisma db push` uspešen na produkcijski bazi
- [ ] Seed skripte pognane (e2e-seed + recipes-stations-seed)
- [ ] Vercel projekt ustvarjen, vsi env vars nastavljeni
- [ ] Deploy uspešen, aplikacija dostopna na URL
- [ ] FURS certifikat naložen (test ali production)
- [ ] Blagajna: PWA nameščena na Chrome
- [ ] KDS: PWA nameščena na kuhinjskem tabletu
- [ ] Natakar: PWA nameščena na telefonu
- [ ] QR kode natisnjene in prilepljene na mize
- [ ] Zaposleni ustvarjeni (admin, kuhar, natakar — vsak z lastnim PIN)
- [ ] Opening hours nastavljene (da QR naročanje deluje)
- [ ] Test: popoln tok (naročilo → kuhinja → plačilo → račun)

---

## 🆘 Troubleshooting

### Problem: "Restavracija je zaprta"
**Rešitev:** Pojdi na POS → Opening Hours → dodaj urnik za vsak dan (ali 00:00-23:59 za 24/7)

### Problem: WebSocket ne deluje na Vercel
**Rešitev:** KDS ima 5s polling fallback — deluje brez WS. Za real-time glej korak 6 (Railway/Render).

### Problem: "Database connection failed"
**Rešitev:** Preveri `DATABASE_URL` format: `postgresql://user:pass@host:port/db?sslmode=require`

### Problem: Prisma Client ne najde se v produkciji
**Rešitev:** V Build Command dodaj `npx prisma generate &&` pred `next build`

### Problem: PWA se ne namesti
**Rešitev:** PWA zahteva HTTPS (Vercel ima avtomatsko). Preveri da `manifest.json` obstaja v `/public/`.

### Problem: KDS ne prikazuje naročil
**Rešitev:** Preveri da je natakar prijavljen z `take_orders` dovoljenjem. Preveri WebSocket/polling v console.

---

## 🏆 Končni rezultat

Po tem vodiču imaš:
- ✅ **Blagajna** — PWA na Chrome (PC ali tablet)
- ✅ **KDS** — PWA na kuhinjskem tabletu (real-time naročila)
- ✅ **Natakar** — PWA na telefonu (mize, naročila, postrežba)
- ✅ **QR naročanje** — gosti naročajo sami iz telefona
- ✅ **FURS** — davčno potrjevanje računov
- ✅ **Real-time** — KDS + natakar sinhronizirani
- ✅ **Offline** — PWA deluje brez interneta

Vse deluje v oblaku (Vercel) — brez lastnih strežnikov!
