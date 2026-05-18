# 🍽️ RestaurantOS — Profesionalni POS sistem za restavracije

<p align="center">
  <strong>Najnaprednejši odprtokodni restavratorski POS sistem z evropsko standardizacijo</strong>
</p>

---

## 📋 Pregled

RestaurantOS je celovit, profesionalni Point of Sale (POS) sistem, zasnovan posebej za evropske restavracije, s poudarkom na slovensko tržišče in FURS davčno potrjevanje. Združuje najboljše prakse svetovnih POS sistemov (Toast, TouchBistro, Square, Lightspeed, 7shifts, OpenTable) v enotno, sodobno spletno aplikacijo.

### Ključne prednosti
- **🇸🇮 FURS certificirano** — Avtomatsko davčno potrjevanje računov (ZOI offline, EOR queued)
- **🌍 Večjezično** — 5 jezikov (Slovenščina, English, Italiano, Hrvatski, Deutsch)
- **📱 Offline-first** — Service Worker + Background Sync + IndexedDB (22 trgovin)
- **🔒 Varno** — Zod validacija, Prisma $transaction, `requireAuth()` + `ROUTE_PERMISSIONS`
- **🖨️ ESC/POS tiskanje** — Podpora za termične tiskalnike
- **📊 Napredna analitika** — WoW primerjava, toplotna karta, analitika gostov

---

## 🏗️ Arhitektura

| Tehnologija | Namen |
|---|---|
| **Next.js 16.1.3** | Full-stack framework (App Router, Server Components) |
| **TypeScript** | Tipovno varna koda |
| **Prisma ORM** | Dostop do baze (SQLite) s 70 modeli |
| **SQLite** | Lokalna baza (brez zunanjih odvisnosti) |
| **Tailwind CSS 4** | Sodobno oblikovanje |
| **shadcn/ui** | UI komponente (Radix + Tailwind) |
| **TanStack Query** | Upravljanje stanja strežniških podatkov |
| **Recharts** | Interaktivni grafikoni |
| **next-intl** | Internacionalizacija (5 jezikov) |
| **Zod** | Validacija podatkov |
| **Service Worker** | Offline zmogljivost in sinhronizacija |

---

## 📦 Projekt struktura

```
restaurantos/
├── prisma/
│   └── schema.prisma          # 70 Prisma modelov (1868 vrstic)
├── src/
│   ├── app/
│   │   ├── api/               # 91 API ruta (59 glavnih + 32 [id])
│   │   │   ├── ai-assistant/
│   │   │   ├── auth/
│   │   │   ├── categories/
│   │   │   ├── checks/
│   │   │   ├── daily-checklist/
│   │   │   ├── dashboard/
│   │   │   ├── delivery/
│   │   │   ├── employees/
│   │   │   ├── expenses/
│   │   │   ├── food-cost/
│   │   │   ├── furs/
│   │   │   ├── gift-cards/
│   │   │   ├── inventory/
│   │   │   ├── loyalty/
│   │   │   ├── menu-engineering/
│   │   │   ├── notifications/
│   │   │   ├── orders/
│   │   │   ├── payments/
│   │   │   ├── public/        # Javne API-ji (brez auth)
│   │   │   ├── recipes/
│   │   │   ├── reports/
│   │   │   ├── reservations/
│   │   │   ├── staff-performance/
│   │   │   ├── staff-shifts/
│   │   │   ├── stock/
│   │   │   ├── suppliers/
│   │   │   ├── tables/
│   │   │   └── webhooks/
│   │   ├── kds/               # Kitchen Display System
│   │   ├── order-status/      # Sledenje naročila za stranke
│   │   ├── pricing/           # Cenik strani
│   │   ├── qr-menu/           # QR meni za stranke
│   │   ├── qr/                # QR naročanje po mizi
│   │   ├── receipt/           # Digitalni račun
│   │   ├── reserve/           # Javna stran za rezervacije
│   │   └── waiter/            # Natakalni mobilni pogled
│   ├── components/
│   │   ├── pos/               # 63 POS komponent
│   │   └── ui/                # shadcn/ui komponente
│   └── lib/
│       ├── auth-middleware.ts  # Avtentikacija in dovoljenja
│       ├── db.ts              # Prisma klient + audit log
│       ├── i18n.ts            # 5-jezični prevodi
│       ├── store.ts           # Zustand globalno stanje
│       └── validations.ts     # Zod sheme
└── db/
    └── custom.db              # SQLite baza (438 meni postavk)
```

---

## 🚀 Namestitev

```bash
# Kloniraj repozitorij
git clone https://github.com/markec12345678/restaurantos.git
cd restaurantos

# Namesti odvisnosti
npm install

# Kopiraj okoljske spremenljivke
cp .env.example .env

# Sinhroniziraj bazo
npx prisma db push

# Zaženi razvojni strežnik
npm run dev

# Odpri http://localhost:3000
```

### Začetni prijavni podatki
- PIN: `1234` (admin) ali `0000` (staff)
- Dovoljenja so vezana na vlogo (admin, manager, staff)

---

## 🎯 Funkcionalnosti

### 💰 Blagajna in naročanje
| Funkcija | Opis |
|---|---|
| Naročilna plošča | Hitro naročanje s kategorijami, iskanjem, prilagoditvami |
| Mize in tloris | Vizualni tloris miz s statusom (prosto/zasedeno/rezervirano) |
| Delitev računa | Split check po osebah ali artiklih |
| Storno artiklov | Void z razlogom in avtorizacijo |
| Popusti | Odstotni in fiksni popusti z avtorizacijo |
| Davčne stopnje | Več DDV stopenj (22%, 9.5%, 5%, 0%) |
| Plačilne metode | Gotovina, kartica, kombinirano, darilna kartica |
| Blagajna | Odpiranje/zapiranje izmene, začetna gotovina, Z-poročilo |

### 🍳 Kuhinja
| Funkcija | Opis |
|---|---|
| Kuhinjski zaslon (KDS) | Real-time prikaz naročil s statusi |
| Kuhinja Pro | Napredni pripravljalni vrstni red s prednostmi in časi |
| Tempo jedi | Course pacing (predjedi → glavne jedi → sladice) |
| Časi priprave | Ocenjeni in dejanski časi za vsak artikel |

### 📊 Analitika in poročila
| Funkcija | Opis |
|---|---|
| Nadzorna plošča | 6 KPI-jev, 7-dnevni graf, kategorije, urni pregled |
| WoW primerjava | Primerjava s prejšnjim tednom (prihodek, naročila, povprečje) |
| Toplotna karta | Vizualizacija prometa po dnevih in urah (4 tedne) |
| Analitika gostov | Skupno gostov, stopnja povratka, zvestoba |
| Menu Engineering | BCG matrika (Zvezdniki, Konji, Zagonetke, Psi) |
| Učinkovitost zaposlenih | Napitnine, čas strežbe, upsell, obračun miz, ocena 0-100 |
| Obračun miz | Zasedenost, obračun, počasne mize, kapaciteta |
| Poročila 2.0 | Prodaja, DDV, izmene, zaloge, dobavitelji |
| AI napovedi | Napovedovanje prometa z Gemini AI |
| AI priporočila | Pametna priporočila za optimizacijo |

### 📅 Rezervacije in čakalni seznam
| Funkcija | Opis |
|---|---|
| Upravitelj rezervacij | CRUD rezervacije, statusi, dodeljevanje miz |
| Javna stran /reserve | Spletno naročanje za stranke |
| Čakalni seznam | Upravljanje čakajočih gostov s časom čakanja |
| Ocena čakanja | AI ocena čakalnega časa |

### 👥 Osebje
| Funkcija | Opis |
|---|---|
| Upravitelj zaposlenih | CRUD zaposlenih, PIN prijava, vloge |
| Razpored zaposlenih | Tedenski vizualni razpored z izmenami (7shifts standard) |
| Izmene in ure | Časovne evidence, avtomatski izračun |
| Napitnine | Pool in point distribucija napitnin |
| Učinkovitost | KPI-ji po zaposlenem s priporočili |

### 📦 Zaloga in dobava
| Funkcija | Opis |
|---|---|
| Upravitelj zalog | CRUD artiklov, minimalne količine, enote |
| Dobavitelji | Upravljanje dobaviteljev s kontakti |
| Nabavna naročila | Ustvarjanje in sledenje nabavnih naročil |
| Recepti | Recepti s normativi in kalkulacijo |
| Kalkulator stroškov jedi | Food cost %, prispevek k pokritju |
| Sledenje zalog | Vnosi, izpisi, prenosi, inventura |

### 🏥 HACCP in varnost
| Funkcija | Opis |
|---|---|
| HACCP dnevnik | Temperature, čiščenje, CCP kontrole |
| Matrika alergenov | EU 1169/2011 — 14 alergenov za vsak artikel |
| Revizijski dnevnik | Hash-veriga za zaščito pred poseganjem |

### 🚚 Dostava
| Funkcija | Opis |
|---|---|
| Upravitelj dostav | Naročila za dostavo s statusi |
| Cone dostave | Zonsko oblikovanje cen (po poštnah) |
| Integracije | Glovo, Wolt, Bolt Food webhook integracije |
| GPS sledenje | Sledenje voznikom v realnem času |
| Stanje dostave | Vizualni pregled aktivnih dostav |

### 💳 Plačila in FURS
| Funkcija | Opis |
|---|---|
| FURS potrjevanje | Avtomatsko davčno potrjevanje računov |
| ZOI offline | Generiranje zaščitnega označevalnika brez povezave |
| EOR čakalna vrsta | Čakalna vrsta za EOR ko FURS ni dosegljiv |
| Simulacijski način | Testno okolje brez pravega certifikata |
| Z-poročilo | Dnevno zaključno poročilo blagajne |

### 🎫 Zvestoba in darilne kartice
| Funkcija | Opis |
|---|---|
| Zvestoben program | Točke, nivoji, nagrade |
| Darilne kartice | Prodaja, polnjenje, poraba, saldo |
| Happy hour | Časovno omejene akcije in popusti |

### 🔔 Obvestila
| Funkcija | Opis |
|---|---|
| Upravitelj obvestil | SMS, Email, Push obvestila |
| Predloge | Pripravljene predloge za rezervacije, dostave, promocije |
| Množično pošiljanje | Batch pošiljanje do 100 obvestil |
| Zgodovina | Pregled poslanih obvestil s statistiko |

### 📱 Javne strani
| stran | URL | Opis |
|---|---|---|
| QR meni | `/qr-menu` | Digitalni meni za stranke |
| QR naročanje | `/qr/[tableId]` | Naročanje na mizi |
| Rezervacije | `/reserve` | Spletno rezerviranje |
| Sledenje naročila | `/order-status/[orderId]` | Domino's-style tracker |
| Digitalni račun | `/receipt` | QR račun z DDV |
| Natakalni pogled | `/waiter` | Mobilni pogled za natakarje |
| Cenik | `/pricing` | Javni cenik |
| KDS | `/kds` | Samostojen kuhinjski zaslon |

### 🌍 Večjezičnost
Podprti jeziki s polnimi prevodi vseh modulov:
- 🇸🇮 **Slovenščina** (primarni)
- 🇬🇧 **English**
- 🇮🇹 **Italiano**
- 🇭🇷 **Hrvatski**
- 🇩🇪 **Deutsch**

### 🏢 Multi-lokacija
- Več lokacij z ločenimi FURS certifikati
- Centralizirano upravljanje menijev
- Lokacijski KDS, naročila, zaloge
- Naročnina s fakturiranjem

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
HaccpEntry / AuditLog (hash chain)
Webhook → WebhookDelivery
Integration → IntegrationLog
Subscription → SubscriptionInvoice
ZReport / TipPool → TipDistribution
DeliveryInfo → DeliveryTracking
GiftCard → GiftCardTransaction
WaitlistEntry / Course / AIConversation
HappyHourSchedule / Receipt
RestaurantSettings / Counter
```

---

## 🔐 Varnost

| Mehanizem | Opis |
|---|---|
| `requireAuth()` | Vse API rute zahtevajo avtentikacijo |
| `ROUTE_PERMISSIONS` | Finoumna kontrola dostopa (admin, manager, staff) |
| PIN prijava | 4-mestni PIN za hitro prijavo v POS |
| Seje | Žetoni s potekom (8h TTL, 24h absolutni) |
| Zod validacija | Vsi vhodni podatki validirani na strežniku |
| Prisma $transaction | Atomski operaciji za kritične transakcije |
| Audit log z hash verigo | SHA-256 veriga za zaščito pred poseganjem |
| Rate limiting | Omejitev zahteve na javnih API-jih |

---

## 📴 Offline zmogljivost

- **Service Worker** — Predpomnjenje virov za offline delovanje
- **IndexedDB** — 22 trgovin za lokalno shranjevanje podatkov
- **Background Sync** — Avtomatska sinhronizacija ob ponovni povezavi
- **15+ custom hookov** — `useOfflineOrder`, `useSyncQueue`, itd.

---

## 🖨️ Tiskanje

- **ESC/POS protokol** — Podpora za večino termičnih tiskalnikov
- **Več tiskalnikov** — Kuhinja, bar, blagajna ločeno
- **Samodejno tiskanje** — Kuhinjski bon ob naročilu
- **Konfiguracija** — URL naslovi tiskalnikov, širina papirja

---

## 🤖 AI zmogljivosti

- **AI pomočnik** — Klepet z Gemini AI za podporo odločanju
- **AI napovedi** — Napovedovanje prometa na podlagi zgodovine
- **AI priporočila** — Optimizacija menija, cen, zalog
- **AI upsell** — Pametno predlaganje dodatkov ob naročanju

---

## 🧪 Razvoj

```bash
# Razvojni strežnik
npm run dev

# Tipovno preverjanje
npx tsc --noEmit

# Build
npm run build

# Prisma studio (vizualni urejevalnik baze)
npx prisma studio

# Reset baze
npx prisma db push --force-reset
```

---

## 📊 Statistika projekta

| Metrika | Vrednost |
|---|---|
| Vrstic kode | ~78.000+ |
| Izvornih datotek | 280+ |
| POS komponent | 63 |
| API rut | 91 |
| Prisma modelov | 70 |
| Javni strani | 10 |
| Jezikov | 5 |
| Meni postavk (seed) | 438 |
| Odvisnosti | 71 |

---

## 🛣️ Načrt za prihodnje

- [ ] Twilio SMS integracija za obvestila
- [ ] SendGrid email integracija
- [ ] Stripe plačilni prehod
- [ ] Real-time WebSocket posodobitve
- [ ] Mobilna aplikacija (React Native / Capacitor)
- [ ] Multi-tenant SaaS način
- [ ] Napredna AI analitika (tfjs napovedi)
- [ ] Avtentikacija z biometrijo
- [ ] PWA namestitev z ikono na namizju
- [ ] Integracija z računovodskimi programi (Pantheon, SAOP)
- [ ] Avtomatsko backup v oblak
- [ ] Spletna trgovina za naročanje hrane

---

## 📄 Licenca

MIT License — glej [LICENSE](LICENSE) za podrobnosti.

---

<p align="center">
  Zgrajeno z ❤️ za slovenske in evropske restavracije
</p>
