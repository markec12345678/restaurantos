# Pogoji uporabe (Terms of Service)

**Velja od:** 1. september 2026  
**Podjetje:** RestaurantOS  
**Naslov:** Podčetrtk 97, 3254 Podčetrtk, Slovenija  
**Davčna številka:** SI12345678  

---

## 1. Definicije

- **RestaurantOS** — programska oprema (SaaS) za upravljanje restavracij, vključno s POS, KDS, FURS, zalogo in računovodstvom
- **Uporabnik** — pravna ali fizična oseba, ki uporablja RestaurantOS
- **Stranka** — gost restavracije, ki uporablja RestaurantOS uporabnika
- **FURS** — Davčna uprava Republike Slovenije

## 2. Predmet pogodbe

RestaurantOS uporabniku omogoča dostop do spletne aplikacije za:
- Sprejemanje in upravljanje naročil
- Davčno potrjevanje računov (FURS/ZDDV-1)
- Upravljanje zalog in receptov
- Računovodska poročila (Trial Balance, P&L, Z-Report)
- Multi-lokacijsko upravljanje (multi-tenant)
- Offline delovanje z IndexedDB queue

## 3. Registracija in dostop

### 3.1 Avtentikacija
- Uporabnik se prijavi z osebnim PIN-om (4-8 mest)
- PIN je bcrypt-hashiran in zaščiten z HMAC-SHA256
- Seja poteče po 8 urah neaktivnosti (24h absolutni maksimum)
- Po 5 neuspelih poskusih PIN-a je dostop blokiran za 15 minut

### 3.2 Dostop do sistema
- Uporabnik je odgovoren za varnost svojega PIN-a
- Deljenje PIN-a med zaposlenimi je prepovedano
- Vsako dejanje (order, payment, void, storno) se zabeleži v audit log (chain hash)

## 4. Pravice in obveznosti

### 4.1 RestaurantOS obveznosti
- Zagotavlja 99.5% uptime (razen načrtovanega vzdrževanja)
- Zagotavlja varnost podatkov v skladu z GDPR
- Zagotavlja dnevne backup-e (Neon PostgreSQL)
- Zagotavlja error tracking (Sentry) in monitoring

### 4.2 Uporabnikove obveznosti
- Pravilno konfigurira FURS certifikat in premises ID
- Vzdržuje točne podatke o artiklih, cenah in DDV stopnjah
- Redno zapira izmene (Z-Report)
- Ne zlorablja sistema za nezakonite namene
- Poskrbi za fizično varnost naprav (tablet, terminalov)

## 5. FURS skladnost (ZDDV-1)

### 5.1 Davčno potrjevanje
- RestaurantOS avtomatsko pošlje račun FURS-u ob plačilu
- Če FURS ni dosegljiv, se račun shrani v offline queue (IndexedDB)
- Offline računi se pošljejo v 48 urah (ZDDV-1 rok)
- Po 48 urah se neoverjeni računi označijo kot "expired"

### 5.2 Odgovornost
- Uporabnik je odgovoren za pravilnost FURS podatkov (poslovni prostor, DDV)
- RestaurantOS ni odgovoren za kazni zaradi nepravilne konfiguracije
- Storno računi se avtomatsko pošljejo FURS-u z referenco na original

## 6. Plačila in cenik

### 6.1 Naročnina
- **Starter:** €0/mesec (Hobby plan, 10s timeout, daily cron)
- **Pro:** €20/mesec (1-min cron, 60s timeout, Edge Functions)
- **Enterprise:** Po dogovoru (custom SLA, dedicated support)

### 6.2 Fakturiranje
- Mesečno fakturiranje vnaprej
- 14-dnevni rok plačila
- Nepplačana naročnina → začasna deaktivacija (podatki ohranjeni 30 dni)

## 7. Podatki in lastnina

### 7.1 Lastnina podatkov
- Vsi poslovni podatki (naročila, računi, stranke) so last uporabnika
- RestaurantOS ima pravico do anonimnih agregiranih metrik
- Uporabnik lahko kadarkoli izvozi podatke (JSON/CSV)

### 7.2 Brišanje podatkov
- Po prekinitvi naročnine se podatki hranijo 30 dni
- Po 30 dneh se podatki trajno izbrišejo (razen FURS podatkov — 10 let po ZDDV-1)

## 8. Omejitev odgovornosti

RestaurantOS ni odgovoren za:
- Izgubo dobička zaradi nedelovanja sistema
- Kazni FURS zaradi nepravilne konfiguracije
- Izgubo podatkov zaradi sile višje (naravne nesreče, napadi)
- Nepravilno delovanje tretjih oseb (Stripe, delivery partnerji)

Največja odgovornost RestaurantOS je omejena na znesek zadnje mesečne naročnine.

## 9. Prekinitev

- Uporabnik lahko prekine kadarkoli (30-dnevni notice)
- RestaurantOS lahko prekine pri kršitvi pogojev (7-dnevni notice)
- Po prekinitvi: 30-dnevni grace period za izvoz podatkov

## 10. Spremembe pogojev

RestaurantOS lahko posodobi pogoje s 30-dnevnim notice-om. O bistvenih spremembah bomo obvestili po e-pošti.

## 11. Pravo in pristojnost

- Slovensko pravo
- Pristojno sodišče: Okrožno sodišče v Ljubljani
- Alternativno reševanje sporov: Gospodarska zbornica Slovenije

## 12. Kontakt

- **E-pošta:** legal@restaurantos.app
- **Telefon:** +386 1 234 5678
- **Pošta:** RestaurantOS, Podčetrtk 97, 3254 Podčetrtk, Slovenija

---

*Skladno z Zakonom o varstvu potrošnikov (ZVPot) in ZDDV-1.*
