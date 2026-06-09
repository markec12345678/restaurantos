# Analiza Projekta RestaurantOS

## 1. Tehnični Pregled Arhitekture

Projekt RestaurantOS je zasnovan kot sodobna full-stack spletna aplikacija, ki uporablja najnovejše tehnologije v ekosistemu React/Next.js.

### Tehnološki Sklad
- **Framework:** Next.js 16.1.3 z App Routerjem in Turbopackom.
- **Jezik:** TypeScript za popolno tipovno varnost.
- **Baza podatkov:** SQLite prek Prisma ORM. Uporaba SQLite omogoča enostavno lokalno namestitev (brez zunanjih odvisnosti), medtem ko **WAL (Write-Ahead Logging)** način omogoča visoko konkurentnost, ki je nujna za POS sisteme z več terminali.
- **Oblikovanje:** Tailwind CSS 4 s shadcn/ui komponentami.
- **Upravljanje stanja:** Zustand (za košarico in UI stanje) ter TanStack Query (za strežniške podatke).
- **Real-time:** WebSockets prek po meri zgrajenega strežnika (`server.js`) za Kitchen Display System (KDS) in takojšnja obvestila.

### Arhitekturni vzorci
- **Offline-First:** Uporaba Service Workerja (`public/sw.js`) za predpomnjenje virov in IndexedDB za lokalno shranjevanje naročil.
- **Atomarnost:** Kritični API delovni tokovi (npr. kreacija naročila, plačilo, storno) uporabljajo Prisma transakcije (`$transaction`), kar preprečuje parcialne posodobitve podatkov.
- **Atomic Counters:** Uporaba atomarnih števcev za številke naročil in računov, kar preprečuje podvojene številke ob sočasnih zahtevkih.

---

## 2. Varnostna Analiza

Varnost je v RestaurantOS na nivoju profesionalnih podjetniških sistemov.

- **Avtentikacija:** Implementiran `auth-middleware.ts` s podporo za Bearer tokene in 4-mestni PIN za hitro prijavo v restavracijskem okolju.
- **Hashiranje:** PIN-i in gesla so shranjeni s pomočjo **bcryptjs**, kar preprečuje krajo podatkov v primeru vdora v bazo.
- **Dovoljenja (RBAC):** Finoumna kontrola dostopa (`ROUTE_PERMISSIONS`) ločuje vloge (admin, manager, staff, kitchen).
- **Revizijski dnevnik (Audit Log):** Vsaka kritična operacija (naročilo, plačilo, storno) se zabeleži. Sistem uporablja **SHA-256 hash verigo**, kjer vsak vnos vsebuje hash prejšnjega vnosa, kar onemogoča neopaženo manipulacijo z evidencami.
- **Validacija:** Vsi vhodi v API so validirani z **Zod** shemami, kar preprečuje SQL injection in vnos neveljavnih podatkov.

---

## 3. Skladnost s Slovensko Zakonodajo (FURS)

Sistem je v celoti pripravljen za uporabo na slovenskem trgu:

- **ZOI (Zaščitni Oznak Izdajatelja):** Implementirano digitalno podpisovanje po specifikacijah FURS (RSA-SHA256).
- **EOR (Enotna Oznaka Računa):** Avtomatska povezava s FURS API strežnikom za pridobitev EOR kode.
- **Offline način:** V primeru izgube povezave sistem generira ZOI, račune pa shrani v vrsto za kasnejše davčno potrjevanje.
- **Storno:** Implementiran storno postopek z negativnimi zneski in vsemi zahtevanimi metapodatki.
- **Skladnost z ZDDV-1:** Računi vsebujejo DDV razčlenitev po stopnjah (22%, 9.5%, 0%), podatke o podjetju in QR kodo za preverjanje.

---

## 4. Funkcionalna Primerjava (Toast/Square standardi)

RestaurantOS dosega visoko stopnjo funkcionalne paritete z vodilnimi svetovnimi POS sistemi:

| Funkcija | RestaurantOS | Status |
|---|---|---|
| Split Payment | Podprto (po artiklih ali znesku) | ✅ |
| Modifier Groups | Podprto (npr. stopnja pečenja, priloge) | ✅ |
| Inventory Tracking | Avtomatsko razknjiževanje ob naročilu | ✅ |
| Multi-location | Centralizirano upravljanje več enot | ✅ |
| CRM | Profili gostov, preference, alergije | ✅ |
| Loyalty Program | Točkovni sistem, nivoji (bronza, srebro...) | ✅ |
| Online Ordering | Spletna stran za naročanje z dostavo/prevzemom | ✅ |
| KDS | Real-time kuhinjski zaslon | ✅ |

---

## 5. Izvedeni Popravki in Izboljšave

Med analizo so bili preverjeni in potrjeni naslednji kritični popravki:

1. **Varnost API-jev:** Dodana `requireAuth()` zaščita na vse občutljive rute.
2. **Validacija cen:** Cene se zdaj berejo iz baze (server-side), kar preprečuje manipulacijo s strani klienta.
3. **DDV izračuni:** Popravljeno proporcionalno razporejanje popustov po DDV stopnjah, kar zagotavlja finančno natančnost.
4. **Zaloge:** Implementirana atomarna dedukcija zaloge takoj ob oddaji naročila ("fire").
5. **Blagajna:** Zapiranje izmene zdaj uporablja dejanske podatke o plačilih iz transakcij namesto splošnih metod na naročilu.

---

## 6. Priporočila za Prihodnost

1. **Integracija s terminali:** Razširitev neposredne integracije z bančnimi terminali (npr. Stripe Terminal ali Adyen).
2. **PWA Native Features:** Izboljšava Service Workerja za boljšo izkušnjo na mobilnih napravah (Push API, Biometry Auth).
3. **AI Analitika:** Uporaba Gemini AI za napredno napovedovanje prometa na podlagi praznikov in vremenskih vplivov v Sloveniji.

---

**Zaključek:** Projekt RestaurantOS je tehnično izredno dovršen, varen in popolnoma prilagojen lokalnemu trgu. Trenutna arhitektura omogoča stabilno delovanje in enostavno nadgradnjo.
