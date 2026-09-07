# Onboarding Guide — RestaurantOS Setup za stranko

**RestaurantOS v1.0.2 — Complete Self-Service Setup**
**Datum: 7. september 2026**

---

## Pregled

RestaurantOS ima **8 zavihkov v nastavitvah** ki omogočajo stranki, da sama
konfigurira celoten sistem brez tehnične pomoči. Ta dokument opisuje vsak
korak od inicializacije do produkcijskega delovanja.

---

## Faza 1: Inicializacija (enkratno)

### 1.1 Setup Wizard (`/setup`)

Ko stranka prvič odpre RestaurantOS, se prikaže setup wizard z naslednjimi
koraki:

1. **Admin račun** — ime, email, 4-mestni PIN
2. **Restavracija** — ime, naslov, telefon
3. **Lokacija** — ime, koda (npr. HQ), naslov
4. **Poslovni podatki** — matična številka, davčna številka, številka blagajne
5. **FURS okolje** — test (priporočeno za začetek) ali produkcija

Po inicializaciji se stranka prijavi s PIN-om in dostopa do nastavitev.

---

## Faza 2: Nastavitve (8 zavihkov)

Dostop: **Sidebar → Nastavitve** (ikona zobnika)

### 2.1 🌍 Država

**Kaj:** Izbor države poslovanja.

| Država | Davčna oblast | DDV stopnje |
|--------|-------------|-------------|
| Slovenija | FURS | 22%, 9.5%, 5% |
| Hrvaška | Porezna uprava | 25%, 13%, 5% |
| Italija | Agenzia delle Entrate | 22%, 10%, 4% |
| Avstrija | Finanzamt | 20%, 10%, 13% |
| Nemčija | Finanzamt | 19%, 7% |

**Status:** ✅ Deluje

---

### 2.2 🏢 Podjetje

**Kaj:** Osnovni podatki o podjetju za račune in poročila.

- Ime podjetja
- Naslov (ulica, hišna številka)
- Mesto, poštna številka
- Telefon, email, spletna stran
- Matična številka
- Davčna številka (SIxxxxxxxxx)
- Številka blagajne (BLG-001)

**Status:** ✅ Deluje

---

### 2.3 % Davki

**Kaj:** DDV stopnje, valuta, jezik.

- Standardna DDV stopnja (22% za SI)
- Nižja DDV stopnja (9.5% za SI)
- Valuta (EUR, HRK, ITL, ATS, DEM)
- Jezik vmesnika (sl, en, it, hr, de)
- Bulk sprememba DDV (spremeni vse artikle na novo stopnjo)

**Status:** ✅ Deluje

---

### 2.4 🛡️ FURS / Fiskalizacija

**Kaj:** FURS certifikat in konfiguracija za slovensko fiskalizacijo.

**Test način (brez certifikata):**
- FURS okolje: `test`
- ZOI se generira s SHA-256 fallback (ni za produkcijo)
- EOR se ne zahteva od FURS strežnika
- Primerno za demo in testiranje

**Produkcijski način (z certifikatom):**
1. Pridobi certifikat na [eDavki portalu](https://edavki.durs.si)
2. Upload `.p12` datoteko v FURS zavihek
3. Vnesi geslo certifikata
4. Spremeni okolje na `production`
5. Testiraj povezavo (gumb "Test povezave")
6. Batch verifikacija čakajočih računov

**Trenutni status na produkciji:** ✅ Test mode aktiven

---

### 2.5 🧾 Račun

**Kaj:** Format in vsebina računa.

- Glava računa (ime, naslov, davčna številka)
- Noga računa (hvala za obisk, QR koda za digitalni račun)
- Format papirja (58mm, 80mm, A4)
- QR koda na računu (povezava do digitalnega računa)
- Avtomatsko tiskanje ob plačilu

**Status:** ✅ Deluje

---

### 2.6 ✨ AI (NOVO)

**Kaj:** Nastavitve umetne inteligence.

#### Gemini API ključ
- Brezplačni ključ na [Google AI Studio](https://aistudio.google.com/app/apikey)
- Brez ključa so AI funkcije onemogočene
- Status badge: ✅ Aktiven / ❌ Manjka

#### AI napovedi prodaje
- Napove dnevno prodajo glede na zgodovino, dan v tednu, vreme
- Priporoča optimalno zalogo in število zaposlenih
- Toggle: Omogoči / Onemogoči

#### AI asistent (NL query)
- Naravno jezikovni vmesnik
- Primer: "Koliko smo prodali pice včeraj?"
- Toggle: Omogoči / Onemogoči

#### AI glasovno naročanje (beta)
- Gost lahko naroči z govorom preko mikrofona
- AI pretvori govor v naročilo
- Toggle: Omogoči / Onemogoči

**Status:** ✅ UI končan, backend podprt

---

### 2.7 🔌 Integracije (NOVO)

**Kaj:** Zunanje integracije za plačila, SMS, dostavo in računovodstvo.

#### Stripe plačila
- Publishable key (`pk_test_...` ali `pk_live_...`)
- Secret key (`sk_test_...` ali `sk_live_...`)
- Show/hide toggle za secret key
- Test/production mode badge
- Pridobi ključe na [Stripe Dashboard](https://dashboard.stripe.com/apikeys)

#### Twilio SMS
- Account SID (`AC...`)
- Auth Token (show/hide)
- Telefonska številka (`+386...`)
- Pridobi na [Twilio Console](https://console.twilio.com)
- Brezplačni trial: $15 kredita

#### Glovo dostava
- Webhook Secret
- Webhook URL: `/api/delivery/webhook/glovo`
- Pridobi na [Glovo Partners](https://partners.glovoapp.com)

#### Wolt dostava
- Webhook Secret
- Webhook URL: `/api/delivery/webhook/wolt`
- Pridobi na [Wolt Partner Portal](https://partner.wolt.com)

#### e-Računi (računovodstvo)
- API žeton (token)
- API URL (opcijsko, privzeto `https://www.eracuni.com/api/v1`)
- Samodejno pošiljanje računov v računovodstvo

#### Webhooks (outbound)
- Gumb "Upravljaj webhook-e" → odpre `/api/webhooks`
- Konfiguracija outbound eventov (order.created, order.paid, itd.)
- HMAC-SHA256 podpisovanje

**Status:** ✅ UI končan, backend podprt (shranjuje v apiKeys JSON)

---

### 2.8 📧 Email (NOVO)

**Kaj:** SMTP konfiguracija za pošiljanje e-pošte.

#### SMTP strežnik
- Host (npr. `smtp.gmail.com`)
- Port (587 = TLS, 465 = SSL)
- Uporabniško ime (email)
- Geslo / App password (show/hide)
- SSL/TLS badge glede na port

#### Pošiljatelj
- From e-pošta (npr. `reports@restavracija.si`)

#### Prejemniki poročil
- Vejica ločeni e-poštni naslovi
- Prejemajo dnevna Z-report poročila
- Primer: `vodja@restavracija.si, racunovodstvo@restavracija.si`

#### Test e-pošte
- Gumb "Pošlji test e-pošto"
- Success/error feedback

**Gmail App Password navodila:**
1. Omogoči 2FA na Google računu
2. Pojdi na [Google Account → Security → App passwords](https://myaccount.google.com/apppasswords)
3. Ustvari app password za "RestaurantOS"
4. Kopiraj 16-mestno kodo v SMTP geslo polje

**Status:** ✅ UI končan, backend podprt

---

## Faza 3: Konfiguracija (ločeno od nastavitev)

Dostop: **Sidebar → Konfiguracija**

### 3.1 Prodajne nastavitve
- Načini strežbe (dine-in, takeout, delivery)
- Razlogi za storno
- Popusti (odstotek, fiksni znesek)
- Servisne postavke (avto-gratuiteta)
- Cenovne skupine

### 3.2 Kuhinja
- Kuhinjske postaje (vroča, hladna, pijače)
- Pripravni časi
- KDS nastavitve (timer thresholds)

### 3.3 Delovni čas
- Dnevni delovni čas
- Happy hour (časi, popusti)
- Prazniki

### 3.4 Loyalty program
- Vklop/izklop
- Točke na EUR (1 točka na 1 EUR)
- Vrednost točke (0.01 EUR)
- Nagrade

---

## Faza 4: Uporabniki in dovoljenja

### 4.1 Zaposleni
- Dodaj zaposlene (ime, email, PIN, vloga)
- Vloge: admin, manager, waiter, cook, cashier
- Dovoljenja po vlogah (8 nivojev)
- Soft-delete (status=terminated)

### 4.2 Dovoljenja
| Dovoljenje | Admin | Manager | Waiter | Cook |
|-----------|:---:|:---:|:---:|:---:|
| take_orders | ✓ | ✓ | ✓ | |
| void_item | ✓ | ✓ | ✓ | |
| apply_discounts | ✓ | ✓ | | |
| manage_cash | ✓ | ✓ | | |
| manage_inventory | ✓ | | | |
| manage_employees | ✓ | | | |
| view_reports | ✓ | ✓ | | |
| admin | ✓ | | | |

---

## Faza 5: Produkcija (Go-Live Checklist)

### 5.1 Pred go-live
- [ ] FURS certifikat pridobljen in uploadan
- [ ] FURS okolje spremenjeno na `production`
- [ ] Test povezave uspešen
- [ ] Stripe production ključi nastavljeni
- [ ] Email SMTP konfiguriran in testiran
- [ ] AI API ključ nastavljen (opcijsko)
- [ ] Zaposleni dodani s pravilnimi vlogami
- [ ] Meni artikli dodani s pravilnimi DDV stopnjami
- [ ] Mize dodane s pravilnimi kapacitetami

### 5.2 Dan go-live
- [ ] Health check: `/api/health?detailed=true`
- [ ] Test naročilo: ustvari → KDS → plačaj → račun
- [ ] FURS: preveri ZOI/EOR na računu
- [ ] Stripe: test plačilo s produkcijsko kartico
- [ ] Email: preveri dnevno Z-report poročilo

### 5.3 Po go-live
- [ ] Monitor Sentry za napake (24h)
- [ ] Monitor FURS za nefiskalizirane račune
- [ ] Zberi povratne informacije od osebja
- [ ] Začni case study dokumentacijo

---

## Podpora

| Kanal | Kontakt | Ura |
|-------|---------|-----|
| Email | support@restaurantos.app | Pon-Pet 8-20h |
| Slack | #restaurantos-support | Pon-Pet 8-20h |
| Telefon | +386 X XXX XX XX | 24/7 za P1 (Enterprise) |
| Dokumentacija | docs.restaurantos.app | 24/7 |
| Status | status.restaurantos.app | 24/7 |

---

*Onboarding Guide v1.0 — 7. september 2026*
*RestaurantOS v1.0.2 — 8 settings zavihkov — Self-service konfiguracija*
