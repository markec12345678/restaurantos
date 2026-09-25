# Disaster Recovery (DR) — Backup & Restore

**Epic:** #115 (zanesljivost) — **P0-6** · **Status:** kanon + orodja (`scripts/backup.sh`, `scripts/dr-restore-test.sh`)
**Sorodni dokumenti:** [SLA.md](./SLA.md) §8 (cilji), [STAGING_DEPLOYMENT.md](./STAGING_DEPLOYMENT.md) §5.2 (ročni pg_dump preskus)

---

## 1. Namen + kanon

Ta dokument je edini vir resnice za varnostne kopije in obnovo RestaurantOS. Kanon iz epica #115 (P0-6), dobesedno:

> Backup ni končan samo zato, ker obstaja backup command. Dokazati je treba: backup → clean environment → restore → login → menu → order → inventory → payment/receipt → reports. Dokumentiraj: RPO, RTO, retention, frequency, restore procedure, security, failure handling, periodični restore test.

"Končan" torej pomeni: **dokazano obnovljivo**. Dokaz je periodični restore preskus (§7) — backup, ki ga nihče ni nikoli povrnil, ni backup.

---

## 2. Arhitektura backupa

Obstajata **dve poti**, izberi glede na velikost baze in cilj obnove:

### Pot (a): JSON API backup/restore (privzeta, engine-agnostic)

Deluje na PGlite **in** na zunanji Postgres (Neon), ker gre skozi Prismo — ne prek datotečnega formata baze.

| Klic | Avtorizacija | Kaj naredi |
|---|---|---|
| `GET /api/backup?mode=full` | `Authorization: Bearer $CRON_SECRET` **ALI** admin seja | Celoten backup (format v1, spodaj). Glave: `X-Backup-Checksum`, `X-Backup-Mode`, `Content-Disposition: attachment`. Uspešen klic samodejno posodobi backup heartbeat (`updatedBy: 'api/backup'`). |
| `GET /api/backup?mode=manifest[&tables=Model1,Model2]` | kot zgoraj | Samo števci (`counts`) — brez vsebin (`tables: {}`, `checksum: ''`). Za poceni preverjanje stanja (drill faza 2). |
| `POST /api/backup/restore?confirm=true` | **IZKLJUČNO admin seja (PIN)** — `CRON_SECRET` je namenoma ZAVRNJEN | Uničujoč: `TRUNCATE` vseh tabel + ponovni vnos. Body = backup JSON. |
| `POST /api/backup/restore?confirm=true&verifyOnly=true` | kot zgoraj | Ne-uničujoč: samo preveri strukturo + checksum + števce proti obstoječemu stanju. |

**Format v1** (`format: 'restaurantos-backup'`):

| Polje | Pomen |
|---|---|
| `format` | konstantno `restaurantos-backup` (diskriminator) |
| `version` | `1` (začetna verzija formata) |
| `schemaStamp` | pečat sheme — restore opozori pri drift-u (backup starejše/novejše sheme) |
| `createdAt` | ISO čas nastanka |
| `engine` | `pglite` ali `postgres` (izvor backupa) |
| `counts` | `{ Model: števec }` — številčno vzporedilo vsebin |
| `tables` | `{ Model: vrstice[] }` — vsebine po modelih |
| `checksum` | sha256 nad **kanoničnim JSON** `tables` (kanonično = sortirani ključi, deterministična serializacija) |
| `countsChecksum` | isti princip nad `counts` |

Vsebinska pravila:

* **Decimal vrednosti se serializirajo kot STRING** — EXACT round-trip brez plavajoče vejice (finančni zapis se ne sme zamakniti za 0,01 €).
* **AuditLog se ohranja v hash-chain vrstnem redu** — tamper-evidentna veriga (preverja `verifyChain`, alert `audit_chain_mismatch`) mora po restoreu ostati veljavna.
* **Session NI v backupu** (vsebine sej se nikoli ne prenesejo), pri restoreu pa je `TRUNCATE` **brez izjem**: vse tabele, tudi `Session` → **vsak uporabnik je po restoreu odjavljen** in se ponovno prijavi s PIN.

### Pot (b): pg_dump/pg_restore (velike zunanje produkcije)

Za Neon Postgres, ko je JSON pot nepraktična (prag: **> ~500 MB JSON** ali vidno počasna serializacija):

```bash
docker compose exec db pg_dump -U restaurantos -Fc restaurantos > backup-$(date +%F-%H%M).dump
cat backup-*.dump | docker compose exec -T db pg_restore -U restaurantos -d restaurantos --clean --if-exists
```

Poln preskus + primerjava ključnih vsot: [STAGING_DEPLOYMENT.md §5.2](./STAGING_DEPLOYMENT.md). Kdaj katero: JSON pot je privzeta (prenosljiva med okolji, berljiva, ima lasten checksum); preklopi na pg_dump pri velikih bazah ali ko postane backup okno (CURL_TIMEOUT) kritično.

Orodja: `scripts/backup.sh` (pot a, cron) in `scripts/dr-restore-test.sh` (restore drill — dokaz obnovitve).

---

## 3. RPO / RTO / retention / frequency

| Parameter | Vrednost | Kje kontrolirano |
|---|---|---|
| **Frekvenca** | dnevni cron **03:00** + priporočeno dodatni poskus pred dnevnim zaključkom (~15:30) | cron vrstica v glavi `scripts/backup.sh` |
| **RPO** | **≤ 24 h** s privzeto frekvenco. Cilj 5 min iz [SLA.md §8.2](./SLA.md) pokriva **Neon PITR/WAL** (prva obrambna linija, 30-dnevna zgodovina); JSON backup je **druga obrambna linija** + prenosljivost med okolji (zaščita pred izgubo same platforme) | cron + `BACKUP_EXPECTED_INTERVAL_HOURS` |
| **RTO** | cilj **< 1 h** (SLA.md §8.2: RTO 1 h; kritična izguba 4 h). Meri se z drillom: clean env ~2 min, restore odvisen od velikosti baze | `scripts/dr-restore-test.sh` (faza 6) |
| **Retention** | **14 dni** privzeto (`RETENTION_DAYS`) — vsak zagon počisti `restaurantos-backup-*.json*` starejše od praga | `scripts/backup.sh` |
| **Lokacija** | `BACKUP_DIR` (privzeto `/var/backups/restaurantos`) + **priporočeno offsite kopijo** (rclone → S3) | env |
| **Pravice datotek** | **0600** (skripta nastavi `umask 077`) — backup vsebuje **PII + PIN bcrypt hash-e** | `scripts/backup.sh` |
| **Šifriranje at-rest** | priporočeno: disk-level LUKS ali `gpg` pred offsite prenosom | operater |

Pomni: alertiranje ni opcijsko. Ko heartbeat poteče (`BACKUP_EXPECTED_INTERVAL_HOURS`, privzeto 24 h), `/api/monitoring/alerts` javi `backup_overdue` (pri 2× pragu `critical`).

---

## 4. Varnost

* **Fail-closed avtorizacija:** brez `CRON_SECRET` ni `GET /api/backup` (in heartbeat ni dostopen); brez admin seje ni restore. Manjkajoč secret = zavrnjena zahteva, nikoli odprt dostop.
* **Delitev poškodbenih moči:** `CRON_SECRET` sme SAMO ne-uničujoče (`GET /api/backup`, heartbeat, `/api/setup/db` DDL init). **Restore sprejema izključno admin sejo (PIN)** — cron secret je pri restoreu namenoma zavrnjen.
* **Dvostopenjska zaščita pred nenamernim wipe:** restore zahteva admin sejo **in** `?confirm=true`; brez potrditvenega parametra route ne izvede TRUNCATE.
* **Audit:** vsak restore zapiše revizijski zapis z action **`BACKUP_RESTORE`** (kdo, kdaj, kateri backup) — povratno sledljivo skozi audit chain.
* **Session nikoli v backupu** — tat backupa ne dobi veljavnih sej; uporabniške seje živijo izključno v bazi in umrejo z njo.
* **Dvojna integriteta:** `checksum` (vsebine tabel) + `countsChecksum` (števci) + ločen `sha256` cele datoteke (`.sha256` sidecar za storage-level tamper detection).
* **schemaStamp drift:** restore opozori, kadar je backup narejen na drugi shemi (strict način zavrže nezdružljiv backup).
* **Rate limiting:** backup/restore endpointi so vključeni v hišni rate-limit kanon (kot ostale authenticated rute) — zaščita pred zlorabo/ponavljanjem.

---

## 5. Postopek obnove (runbook)

Izvedi po vrsti. Koraka 2 in 3 sta odvisna od engine-ja.

1. **Umiri app** — zaustavi strežnik. Pri PGlite je to OBVEZNO tudi med korakom 2 (multiproces dostop = korupcija, lekcija R126); migracije/restore vedno na ugasnjenem strežniku.
2. **Sveža baza:**
   * PGlite: `rm -rf "$PGLITE_DATA_DIR"` (privzeto `/tmp/pglite-data`) + `node scripts/init-pglite.mjs` (DDL iz `prisma/schema.prisma`).
   * Neon/Postgres: `createdb restaurantos-restored` + `pg_restore -d restaurantos-restored backup.dump` (pot b).
3. **Zaženi app** in počakaj `GET /api/health` → 200.
4. **BOOTSTRAP admin (samo čista baza):** prazna baza NIMA uporabnikov → prijava je nemogoča, restore pa zahteva admin sejo. Zato poženi setup wizard enkrat: `POST /api/setup/init` `{ restaurantName, adminName, adminEmail, adminPin, locationName, locationCode, catalogMode: "empty" }` → začasni admin + lokacija. **Restore nato TRUNCATE-a tudi te bootstrap vrstice** in vstavi popolno vsebino backupa — bootstrap je torej samo ključ, ki odpre vrata, ne podatkov. Na okolju, kjer admin že obstaja, ta korak preskoči (setup/init vrne napako → tolerantno).
5. **PIN admin prijava** (dvostopenjska: `GET /api/auth/employees?locationId=…` → `POST /api/auth { employeeId, pin }` → `token`). Prijava gre na bootstrap admina (korak 4) ALI na obstoječega admina (--skip-clean varianta).
6. **Restore:** `POST /api/backup/restore?confirm=true` z backup JSON kot body, `Authorization: Bearer <token>`.
7. **Preveri odgovor:** `matched: true`, `totalRestored == totalExpected` in per-model `restored == expected`. Pri neujemanju → §6.
8. **Brskalniški smoke (zlata pot):** prijava → meni → naročilo → plačilo/račun → poročila. Isti tok, ki ga avtomatizirano pokriva E2E regresija (glej [E2E-TEST-PLAN.md](./E2E-TEST-PLAN.md); P0-02 dokaz živega toka: worklog R126-final).
9. **Monitoring:** preveri `GET /api/monitoring/alerts` — po prvem uspešnem backupu na obnovljenem okolju se heartbeat posodobi in `backup_overdue` izzveni sam.
10. **Dokumentiraj izid:** datum, commit, izmerjeni **RTO**, rezultat, izvedel — vrstica v tabeli §7.

Avtomatizirana varianta korakov 1–7 (lokalna PGlite): `scripts/dr-restore-test.sh` — faza 3 vključuje tudi bootstrap korak 4.

---

## 6. Failure handling

| Scenarij | Kaj se zgodi | Kaj narediti |
|---|---|---|
| **Checksum mismatch** (datoteka pokvarjena/spremenjena) | Validacija artefakta (in-file `checksum`/`countsChecksum` ali sha256 sidecar) pade | Artefakta NE uporabljaj (niti "popravljanja"). Vzemi prejšnji backup; preveri disk in offsite kopijo. Forenzika: pokvarjen artefakt ostane shranjen (`scripts/backup.sh` ga namenoma ne briše, exit 3) |
| **Restore transakcija pade** | Restore teče v Prisma `$transaction` — **ATOMARNO**: baza ostane v stanju PRED restoreom | Ponovi restore (npr. začasna omrežna napaka) ali uporabi starejši backup. Ne "ročno dopolnjuj" pol-obnovljene baze |
| **Backup prevelik za pomnilnik** | JSON pot drži backup v pomnilniku (O(n)); pridelek > ~500 MB ali CURL_TIMEOUT zadetek | Preklopi na **pg_dump pot** (§2b); povečaj `CURL_TIMEOUT` samo kot začasen most |
| **`backup_overdue` alert** | Heartbeat starejši od `BACKUP_EXPECTED_INTERVAL_HOURS` (privzeto 24 h); `critical` pri 2× | Preveri zadnji cron zagon (`/var/log/restaurantos-backup.log`), dosegljivost app in CRON_SECRET. Po uspešnem backupu alert izzveni sam (stalnost) |
| **PGlite multiproces** | Dostop do iste data mape iz več procesov (strežnik + migracija/restore) = WASM abort/korupcija (R126) | Migracije/restore/init SAMO z ugasnjenim strežnikom; drill to vsili (fail, če app teče brez `APP_STOP_CMD`) |
| **Kaj restore NE povrne** | Seje (`Session` truncate → vsi se ponovno prijavijo); zunanji procesi/queue (npr. Stripe/Glovo dogodki NIMAJJO replaya); datoteke na disku (FURS certi, `.env` — glej §8) | Pričakuj val ponovnih prijav; zunanje integracije preveri ročno; datoteke obnovi iz njihovega ločenega backupa |

---

## 7. Periodični restore test

### (a) Avtomatsko — CI

Integracijski test **backup → restore round-trip** (prava baza, `tests/integration`) teče na vsak PR: backup na bazi s pripravljenimi podatki → restore v čisto bazo → primerjava števcev + checksum. Regresija formata/restore logike se torej ujame pred merge-om, ne ob nesreči.

### (b) Ročno — `scripts/dr-restore-test.sh`

**Priporočeni urnik: MESAČNO + po vsaki večji shematski spremembi** (nova migracija, sprememba formata backupa, zamenjava engine-ja).

```bash
CRON_SECRET="..." ADMIN_PIN="..." LOCATION_ID="..." ./scripts/dr-restore-test.sh
# --skip-clean: preskoči brisanje PGlite mape (preverjanje proti živemu okolju)
```

Drill izvede in logira PASS/FAIL: backup → clean environment (rm + re-init) → manifest == 0 → PIN prijava → restore (`matched=true`, števci) → sveža prijava → meni/inventar/Z-poročila/naročila berljivi → `verifyOnly` integriteta → **izmerjeni RTO** vs. cilj 3600 s. Artefakti ostanejo v `$WORKDIR` za forenziko; skripta na koncu izpiše pripravljeno vrstico za spodnjo tabelo.

### Zgodovina drill-ov (podpis)

| Datum | Commit | RTO (meritev) | Rezultat | Izvedel |
|---|---|---|---|---|
| 2026-09-25 | R127 (implementacija P0-6) | 22 s (celoten drill: backup 1 s + clean 13 s + restore 2 s + verify 6 s) | PASS (6/6 faz) | avtomatizirano (agent, živi E2E) |
|  |  |  |  |  |

---

## 8. Omejitve in znana tveganja

Iskreno, da DR ne zaspa na optimizmu:

* **JSON backup gre skozi pomnilnik (O(n))** — ni primeren za zelo velike baze (prag ~500 MB → pg_dump pot).
* **Ni point-in-time obnove** — JSON backup je snapshot ob času klica (RPO po frekvenci cron-a); point-in-time pokriva le Neon PITR (pot: SLA.md §8.1).
* **Pokritost = samo podatkovna baza.** Datoteke NE gredo v backup — ročno varnostno kopiraj ločeno: **FURS certifikati** (`Location.fursCertPath`/geslo), **`.env`** (CRON_SECRET, NEXTAUTH_SECRET, Stripe/Glovo/FURS ključi), cert poti, morebitni shranjeni uploadi. Izguba `.env`-ja = izguba runtime konfiguracije, tudi če je baza cela.
* **Restore zahteva kompatibilno shemo** — backup stare sheme na novi bazi lahko vrže schemaStamp drift warning (strict način: zavrže); zato drill po vsaki migraciji.
* **Zunanje integracije nimajo replay-a** — Stripe/Glovo dogodkov po točki restore-a ni mogoče ponovno prevzeti; morebitne izgube posameznih webhook klicev rešuješ ročno prek dashboardov ponudnikov.
* **Restore je uničujoč po zasnovi** (TRUNCATE vsega) — zato dvostopenjska zaščita (§4) in (za vajo) `--skip-clean` način drila.

---

## Povezave

* Orodja: [scripts/backup.sh](../scripts/backup.sh) (cron backup) · [scripts/dr-restore-test.sh](../scripts/dr-restore-test.sh) (periodični drill) · [scripts/init-pglite.mjs](../scripts/init-pglite.mjs) (re-init PGlite)
* Cilji in kontekst: [SLA.md §8](./SLA.md) (RPO/RTO/PITR) · [STAGING_DEPLOYMENT.md §5.2](./STAGING_DEPLOYMENT.md) (ročni pg_dump preskus)
* Monitoring: `GET /api/monitoring/backup-heartbeat` (status) · `GET /api/monitoring/alerts` (`backup_overdue`)
