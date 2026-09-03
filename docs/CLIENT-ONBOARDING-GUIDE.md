# 📋 Navodila za stranko — RestaurantOS Onboarding

**Datum:** September 2026  
**Verzija:** v1.0.0

---

## 1. Dostop do sistema

### Produkcija (Vercel)
```
URL: https://restaurantos-oqa3h4ru3-robertpezdirc12-designs-projects.vercel.app
```

### PIN kode
| Vloga | PIN | Dostop |
|-------|-----|--------|
| Admin | `1234` | Vsi moduli, konfiguracija, poročila |
| Super-admin | `5555` | Vse lokacije, cross-branch audit |
| Natakar | `0000` | Naročila, plačila, mize |

---

## 2. Prvi koraki po prijavi

### Korak 1: Konfiguracija restavracija
1. Prijavi se z admin PIN `1234`
2. Pojdi v **Configuration → Restaurant Settings**
3. Izpolni:
   - **Ime restavracije**
   - **Naslov, poštna številka, mesto**
   - **Matična številka**
   - **Davčna številka (DDV ID)**
   - **Blagajna (register number)**
   - **Premises ID** (FURS poslovni prostor)

### Korak 2: FURS certifikat
1. Pridobi FURS certifikat (.p12) na https://edavki.durs.si
2. Pojdi v **Configuration → FURS**
3. Naloži .p12 datoteko
4. Vnesi geslo certifikata
5. Nastavi **Environment: Production**
6. Klikni **Testiraj povezavo**
7. Po uspehu nastavi `FURS_ALLOW_SIMULATION=false` na Vercel

### Korak 3: DDV stopnje
1. Pojdi v **Configuration → Tax Rates**
2. Preveri stopnje:
   - 22% (standardna — jedi, pijače)
   - 9.5% (znižana — if applicable)
   - 0% (oproščeno — if applicable)
3. Vsak artikel mora imeti nastavljeno pravilno DDV stopnjo

### Korak 4: Jedilnik
1. Pojdi v **Menu → Items**
2. Preveri/uredi artikle:
   - Ime, cena, kategorija
   - DDV stopnja (22%, 9.5%, 0%)
   - Alergeni
   - Slika (optional)
3. Dodaj kategorije (Predjedi, Glavne jedi, Pijače, itd.)

### Korak 5: Mize
1. Pojdi v **Tables**
2. Dodaj/uredi mize:
   - Številka mize
   - Kapaciteta
   - Lokacija (if multi-tenant)

---

## 3. Dnevno delo

### Odprtje izmene
1. Prijavi se z admin PIN
2. Pojdi v **Cash Register**
3. Vnesi **začetno stanje gotovine** (npr. €200)
4. Klikni **Odpri izmeno**

### Sprejemanje naročil
1. Pojdi v **Orders** (POS modul)
2. Izberi mizo (ali Takeout/Delivery)
3. Dodaj artikle v košarico
4. Klikni **Naroči**
5. Naročilo gre v KDS (kuhinja)

### Plačevanje
1. Klikni **Plačaj** na naročilu
2. Izberi način plačila (Gotovina, Kartica, Mobilno)
3. Vnesi znesek
4. Potrdi plačilo
5. Račun se samodejno pošlje FURS-u
6. Natisni račun (če je tiskalnik priklopljen)

### Zapiranje izmene (Z-Report)
1. Pojdi v **Cash Register**
2. Preštej fizično gotovino
3. Vnesi **dejansko stanje**
4. Klikni **Zapri izmeno**
5. Preveri **cashDifference** (mora biti €0.00)
6. Z-Report je shranjen

---

## 4. Offline delovanje

### Kaj se zgodi ko internet pade?
- Naročila se shranijo v **IndexedDB** (lokalno v browserju)
- Prikazan je indikator "Brez povezave"
- KDS in Waiter nadaljujejo delo z lokalnimi podatki

### Kaj se zgodi ko internet pride nazaj?
- Samodejna sinhronizacija (Background Sync)
- Vsa naročila se pošljo na server
- **Ni duplikatov** (idempotency key)
- Toast obvestilo: "X naročil sinhroniziranih"

### FURS offline
- Računi se shranijo kot `pending`
- Po reconnectu se avtomatsko pošljejo FURS-u
- Rok: 48 ur (ZDDV-1)

---

## 5. Storno računa

### Kdaj uporabiti?
- Napačen znesek na računu
- Naročilo preklicano po plačilu
- Davčna napaka

### Postopek
1. Najdi plačano naročilo v **Orders**
2. Klikni **Storno**
3. Vnesi razlog storno
4. Potrdi
5. Sistem ustvari storno račun z negativnim zneskom
6. FURS prejme storno z referenco na original

---

## 6. Poročila

### Trial Balance
- **Pothod:** Reports → Accounting → Trial Balance
- Prikazuje stanje po kontih (Cash, Bank, Revenue, VAT, Tips)
- **Debiti morajo biti enaki kreditom** (€0.00 diff)

### DDV poročilo
- **Pothod:** Reports → VAT Report
- Prikazuje prodajo po DDV stopnjah (22%, 9.5%, 0%)
- Mora se ujemati z FURS e-invoice book

### Z-Report
- **Pothod:** Cash Register → Zadnje izmene
- Prikazuje: začetno stanje, prodajo, vračila, napitnine, končno stanje

### P&L (Profit & Loss)
- **Pothod:** Reports → Financial → P&L
- Prihodki, stroški, čisti dobiček

---

## 7. Multi-tenant (več lokacij)

### Dodajanje nove lokacije
1. Pojdi v **Configuration → Locations**
2. Klikni **Dodaj lokacijo**
3. Izpolni podatke (ime, naslov, FURS premises ID)
4. Dodeli zaposlene lokaciji

### Preklop med lokacijami
- Natakar vidi samo svojo lokacijo
- Admin/Super-admin lahko preklopi z `?locationId=X`
- Cross-branch access se zabeleži v **audit log**

---

## 8. Vzdrževanje

### Sentry monitoring
- Error tracking: samodejno
- Performance: 10% sample
- Session Replay: 1% (ob napaki 100%)

### Backup
- Neon PostgreSQL: dnevni snapshots (na paid plan-u)
- Audit log: chain hash (nepopravljiv, 10 let hrambe)

### Posodobitve
- `git pull origin main` → Vercel samodejno deploya
- Preveri `/api/health?deep=true` po posodobitvi

---

## 9. Podpora

### Kontakt
- **Email:** info@restaurantos.app
- **GitHub Issues:** https://github.com/markec12345678/restaurantos/issues
- **Dokumentacija:** https://github.com/markec12345678/restaurantos/wiki

### Ping-PIN reševanje
1. Po 5 neuspelih poskusih je dostop blokiran 15 minut
2. Po 15 minutah poskusi znova
3. Če PIN pozabljen: admin ga lahko resetira v **Configuration → Employees**

---

## 10. Varnostna priporočila

- 🔴 **PREKLIČI** vse token-e ki so bili uporabljeni v komunikaciji
- 🔄 Redno menjavaj PIN-e (vsakih 6 mesecev)
- 💻 Ne delite PIN-a med zaposlenimi
- 📱 Poskrbi za fizično varnost naprav (tablet, terminalov)
- 🔒 Uporabljajte HTTPS (samodejno na Vercel)
- 📊 Redno preverjajte audit log za sumljive aktivnosti

---

*RestaurantOS v1.0.0 — Production Ready*  
*© 2026 MIT License*
