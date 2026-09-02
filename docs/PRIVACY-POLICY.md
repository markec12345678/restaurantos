# Politika zasebnosti (GDPR)

**Velja od:** 1. september 2026  
**Podjetje:** RestaurantOS  
**Naslov:** Podčetrtk 97, 3254 Podčetrtk, Slovenija  
**Davčna številka:** SI12345678  

---

## 1. Uvod

Ta politika zasebnosti opisuje kako RestaurantOS (v nadaljevanju "mi", "nas" ali "naše") zbira, uporablja in varuje vaše osebne podatke v skladu z Uredbo o splošni varnosti podatkov (GDPR - Uredba (EU) 2016/679) in Zakonom o varstvu osebnih podatkov (ZVOP-1).

## 2. Kateri osebni podatki se zbirajo

### 2.1 Podatki strank (gostov)
- **Ime in priimek** (pri rezervacijah in naročilih)
- **Telefonska številka** (za potrditve rezervacij)
- **E-pošta** (za račune in povratne informacije)
- **Zgodovina naročil** (katere artikle ste naročili)
- **Podatki o zvestobi** (točke zvestobe)

### 2.2 Podatki zaposlenih
- **Ime in priimek**
- **E-pošta**
- **PIN koda** (bcrypt hashirana, HMAC-SHA256 za iskanje)
- **Vloga in dovoljenja**
- **Zgodovina izmen** in ur dela
- **IP naslov** (za audit log)

### 2.3 Avtomatsko zbrani podatki
- **IP naslov** (za varnost in audit log)
- **Vrsta brskalnika in naprave**
- **Čas in datum dostopa**

## 3. Namembnost uporabe podatkov

| Podatek | Namen | Pravna osnova |
|---------|-------|---------------|
| Ime, telefon, e-pošta | Izvedba naročila/rezervacije | Pogodba (Art. 6(1)(b)) |
| Zgodovina naročil | Izvedba storitve + analitika | Pogodba + legitimni interes |
| PIN zaposlenih | Avtentikacija in varnost | Legitimni interes (Art. 6(1)(f)) |
| IP naslov | Varnost, audit log | Legitimni interes (Art. 6(1)(f)) |
| FURS podatki | Davčno potrjevanje računov | Zakonska obveznost (Art. 6(1)(c)) |
| Podatki o zvestobi | Program zvestobe | Privolitev (Art. 6(1)(a)) |

## 4. Čas hrambe podatkov

| Vrsta podatka | Čas hrambe | Razlog |
|---------------|------------|--------|
| Računi in FURS podatki | 10 let | ZDDV-1 |
| Audit log (chain hash) | 10 let | PCI DSS + FURS |
| Zgodovina naročil | 2 leti | Analitika |
| Podatki zaposlenih | 5 let po prekinitvi | ZDR |
| Session podatki | 8 ur (TTL) | Varnost |

## 5. Delitev podatkov s tretjimi osebami

### 5.1 FURS (Davčna uprava RS)
- **Kaj:** ZOI, EOR, zneski računov, DDV
- **Zakaj:** Zakonska obveznost (ZDDV-1)
- **Kdaj:** Ob vsakem izdanem računu

### 5.2 Neon (PostgreSQL) — EU (Frankfurt)
### 5.3 Vercel (Hosting) — EU (Frankfurt)
### 5.4 Sentry (Error tracking) — EU (Deutschland)

## 6. Vaše pravice (GDPR)

1. **Pravica do dostopa** (Art. 15)
2. **Pravica do popravka** (Art. 16)
3. **Pravica do izbrisa** (Art. 17) — z omejitvami za FURS podatke
4. **Pravica do omejitve** (Art. 18)
5. **Pravica do prenosljivosti** (Art. 20)
6. **Pravica do ugovora** (Art. 21)
7. **Pravica do preklica privolitve** (Art. 7(3))

### Kontakt za uveljavljanje pravic:
- **E-pošta:** privacy@restaurantos.app
- **Pošta:** RestaurantOS, Podčetrtk 97, 3254 Podčetrtk, Slovenija

Odgovor v 30 dneh (GDPR).

## 7. Varnost podatkov

- **Šifriranje v tranzitu:** TLS 1.3 (HTTPS)
- **Šifriranje v mirovanju:** Neon PostgreSQL encryption
- **PIN hashiranje:** bcrypt (10 rounds) + HMAC-SHA256
- **Rate limiting:** 5 poskusov PIN / 15 min
- **CSP headers:** Content-Security-Policy z nonce
- **HSTS:** Strict-Transport-Security (1 leto)
- **Audit log:** Chain hash (SHA-256) — nepopravljiv
- **Multi-tenant isolation:** locationId scoping (8 tabel)

## 8. Piškotki (Cookies)

### Nujni piškotki (brez privolitve)
- `NEXT_LOCALE` — jezikovna nastavitev (session)
- `pos_auth_token` — avtentikacijski token (session, 8h)

### Analitski piškotki (s privolitvom)
- Sentry Session Replay — 1% vzorec (anonimizirano)
- Vercel Analytics — anonimni metapodatki

Piškotki se ne uporabljajo za marketing.

## 9. Mednarodni prenosi podatkov

Vsi podatki se obdelujejo znotraj EU (Frankfurt, Deutschland). Ni prenosov izven EU/EEA.

## 10. Kontakt

- **E-pošta:** privacy@restaurantos.app
- **DPO:** dpo@restaurantos.app

---

*GDPR (Uredba (EU) 2016/679) + ZVOP-1 skladno.*
