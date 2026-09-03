// Legal documents content — loaded from docs/ at build time

export const PRIVACY_POLICY_MD = `# Politika zasebnosti (GDPR)

**Velja od:** 1. september 2026
**Podjetje:** RestaurantOS
**Naslov:** Podčetrtk 97, 3254 Podčetrtk, Slovenija
**Davčna številka:** SI12345678

---

## 1. Uvod

Ta politika zasebnosti opisuje kako RestaurantOS zbira, uporablja in varuje vaše osebne podatke v skladu z GDPR (Uredba (EU) 2016/679) in ZVOP-1.

## 2. Osebni podatki

### Stranke (gosti)
- Ime in priimek (pri rezervacijah)
- Telefonska številka (potrditve)
- E-pošta (računi, povratne informacije)
- Zgodovina naročil
- Podatki o zvestobi

### Zaposleni
- Ime in priimek, e-pošta
- PIN koda (bcrypt hashirana)
- Vloga in dovoljenja
- Zgodovina izmen, IP naslov

## 3. Namembnost in pravna osnova

- Izvedba naročila: Pogodba (Art. 6(1)(b))
- Varnost in audit: Legitimni interes (Art. 6(1)(f))
- FURS davčno potrjevanje: Zakonska obveznost (Art. 6(1)(c))
- Program zvestobe: Privolitev (Art. 6(1)(a))

## 4. Čas hrambe

- Računi in FURS: 10 let (ZDDV-1)
- Audit log: 10 let (PCI DSS)
- Zgodovina naročil: 2 leti
- Podatki zaposlenih: 5 let po prekinitvi
- Session: 8 ur

## 5. Delitev s tretjimi osebami

- FURS (ZDDV-1 obveznost)
- Neon PostgreSQL (EU Frankfurt)
- Vercel (EU Frankfurt)
- Sentry (EU Deutschland)

## 6. Vaše pravice (GDPR)

1. Dostop (Art. 15)
2. Popravek (Art. 16)
3. Izbris (Art. 17) — z omejitvami za FURS
4. Omejitev (Art. 18)
5. Prenosljivost (Art. 20)
6. Ugovor (Art. 21)
7. Preklic privolitve (Art. 7(3))

Kontakt: privacy@restaurantos.app

## 7. Varnost

- TLS 1.3, bcrypt, HMAC-SHA256
- Rate limiting, CSP, HSTS
- Chain hash audit log
- Multi-tenant isolation

## 8. Piškotki

- Nujni: NEXT_LOCALE, pos_auth_token (brez privolitve)
- Analitski: Sentry Replay (1%), Vercel Analytics (s privolitvom)

## 9. Mednarodni prenosi

Vsi podatki znotraj EU (Frankfurt). Ni prenosov izven EU/EEA.

## 10. Kontakt

E-pošta: privacy@restaurantos.app
DPO: dpo@restaurantos.app
`

export const TERMS_OF_SERVICE_MD = `# Pogoji uporabe (Terms of Service)

**Velja od:** 1. september 2026
**Podjetje:** RestaurantOS
**Naslov:** Podčetrtk 97, 3254 Podčetrtk, Slovenija
**Davčna številka:** SI12345678

---

## 1. Definicije

- RestaurantOS — SaaS za upravljanje restavracij (POS, KDS, FURS, zaloga)
- Uporabnik — pravna ali fizična oseba, ki uporablja RestaurantOS
- FURS — Davčna uprava RS

## 2. Predmet pogodbe

RestaurantOS omogoča: sprejemanje naročil, FURS potrjevanje, upravljanje zalog, računovodska poročila, multi-lokacijsko upravljanje, offline delovanje.

## 3. Registracija in dostop

- Prijava z osebnim PIN-om (bcrypt + HMAC-SHA256)
- Seja poteče po 8 urah (24h absolutni maksimum)
- 5 neuspelih poskusov → 15 min blokada
- Audit log zabeleži vsako dejanje (chain hash)

## 4. Pravice in obveznosti

### RestaurantOS
- 99.5% uptime (razen načrtovanega vzdrževanja)
- GDPR varnost podatkov
- Dnevni backup-i (Neon)
- Sentry monitoring

### Uporabnik
- Pravilna FURS konfiguracija
- Točni podatki o artiklih in cenah
- Redno zapiranje izmen (Z-Report)
- Fizična varnost naprav

## 5. FURS skladnost (ZDDV-1)

- Avtomatsko pošiljanje računov FURS-u
- Offline queue (IndexedDB) z 48h rokom
- Storno z referenco na original

## 6. Plačila

- Starter: €0/mesec (Hobby)
- Pro: €20/mesec (1-min cron, 60s timeout)
- Enterprise: po dogovoru

## 7. Podatki in lastnina

- Poslovni podatki so last uporabnika
- Anonimne agregirane metrike dovoljene
- Izvoz podatkov (JSON/CSV) kadarkoli
- Po prekinitvi: 30-dnevni grace period

## 8. Omejitev odgovornosti

RestaurantOS ni odgovoren za:
- Izgubo dobička
- Kazni FURS zaradi nepravilne konfiguracije
- Izgubo podatkov zaradi sile višje

Največja odgovornost: znesek zadnje mesečne naročnine.

## 9. Prekinitev

- Uporabnik: 30-dnevni notice
- RestaurantOS: 7-dnevni notice pri kršitvi
- 30-dnevni grace period za izvoz podatkov

## 10. Pravo

Slovensko pravo, Okrožno sodišče Ljubljana.

## 11. Kontakt

E-pošta: legal@restaurantos.app
`
