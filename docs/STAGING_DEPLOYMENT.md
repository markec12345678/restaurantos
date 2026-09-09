# STAGING DEPLOYMENT — vodnik za preizkusno namestitev

> Namen tega vodnika: zapreti zadnja DVA odprta kriterija iz seznamna
> "Končni kriteriji za produkcijo" (12 točk), ki ju v peskovniku NI MOGOČE
> preveriti:
>
> - **#7 WebSocket deluje na pravi infrastrukturi** (avtorizacija WS
>   povezav + upgrade prek reverse proxy-ja)
> - **#9 Backup/restore je bil dejansko testiran** (ne samo alarmiranje)
>
> Staging je ZADNJA vrata pred pilotom v pravi restavraciji. Ni namenjen
> razvoju — je preskusna kopija produkcijskega scenarija (korak 16/17 iz
> priporočenega vrstnega reda popravljanja).

---

## 1. Predpostavke in zahteve

| Postavka | Zahteva |
|---|---|
| Strežnik | VPS/dedicated (2 vCPU, 4 GB RAM, 40 GB disk), Docker Engine + compose v2 |
| OS | Linux x86_64 (alpine/amd64 slike so v compose) |
| Omrežje | 1 javna IP; vhodna vrata 80/443 (reverse proxy), 3000 po želji |
| DNS | `staging.<domena>` → javni IP (za TLS prek Caddy/nginx) |
| Certifikati | FURS **test** (.p12) — za staging NE uporabljaj produkcijskih! |
| RSS | `git clone` dostop do repozitorija (namestitveni stroj ali CI runner) |
| Čas | ~30 min prvi zagon + 1 h preskusi |

**Varnostno pravilo**: staging MORA biti ločen od produkcijske baze.
Nikoli ne usmerjuj `DATABASE_URL` staginga na Neon produkcijsko bazo —
staging izvaja tudi integracijske preskuse, ki pišejo v bazo.

---

## 2. Arhitektura (kaj je javno, kaj interno)

```
                   Internet
                      │ :80/:443 (TLS)
              ┌───────▼────────┐
              │ reverse proxy  │  Caddy ali nginx — TLS + WS upgrade
              │ (nginx/Caddy)  │  (glej §6 + DEPLOYMENT.md)
              └───────┬────────┘
                      │ :3000 (HTTP)
┌─────────────────────▼──────────────────────────┐
│  Docker omrežje (restaurantos_default)         │
│                                                 │
│  ┌───────────┐   ┌────────┐   ┌─────────────┐  │
│  │    app    │──▶│   db   │   │    redis    │  │
│  │ node      │   │ postgres│  │ requirepass │  │
│  │ server.js │   │ :5432  │   │   :6379     │  │
│  │ (Next+WS) │   └────────┘   └─────────────┘  │
│  └───────────┘    EXPOSE samo — NI javnih vrat │
└─────────────────────────────────────────────────┘
```

**Ključne varnostne lastnosti (v1.3.0):**

- `db` in `redis` nimata `ports` — dostop IMAMO samo znotraj Docker
  omrežja po imenu storitve (`db:5432`, `redis:6379`). Lokalni dostop
  (psql, redis-cli) po potrebi odkomentiraš `127.0.0.1:5432:5432` —
  nikoli `"5432:5432"` (0.0.0.0 = vsa omrežja hosta!).
- Redis ZAHTEVA geslo (`--requirepass`, fail-closed `${VAR:?}`) — prej je
  tekel brez gesla na javnih vratih.
- `DB_PASSWORD`/`NEXTAUTH_SECRET` nimata več `changeme` fallbackov —
  compose se brez njih NE zažene.

---

## 3. Priprava skrivnosti (.env)

```bash
git clone https://github.com/markec12345678/restaurantos.git
cd restaurantos
git checkout v1.3.0            # vedno deployaj TAG, ne veje!
cp .env.example .env
nano .env                      # ali priljubljeni urejevalnik
```

Izpolni (vse generiraj sveže — NE kopiraj iz razvoja!):

```bash
# v .env:
DB_PASSWORD=$(openssl rand -hex 16)          # URL-varni znaki
REDIS_PASSWORD=$(openssl rand -hex 16)       # brez @ : / ? # !
NEXTAUTH_SECRET=$(openssl rand -base64 32)
RECEIPT_TOKEN_SECRET=$(openssl rand -base64 32)

NEXTAUTH_URL=https://staging.domena.si
NEXT_PUBLIC_APP_URL=https://staging.domena.si
FURS_ALLOW_SIMULATION=false
FURS_ENVIRONMENT=test
FURS_CERT_PATH=/app/certs/furs-test.p12      # mountaj, NE peči v sliko
FURS_CERT_PASSWORD=...
FURS_TAX_NUMBER=...                          # davčna št. podjetja
TZ=Europe/Ljubljana
```

⚠️ `.env` NIKOLI ne commitaj (je v .gitignore). Vars HTTPS: pri TLS
proxy-ju nastavi `NEXTAUTH_URL`/`NEXT_PUBLIC_APP_URL` na https — drugače
piškoti ne bodo delovali.

---

## 4. Prvi zagon (TOČEN vrstni red)

```bash
# 1. Build BREZ dostopa do baze (build nikoli ne spreminja baze!)
docker compose build

# 2. Migracije + preverba (fail-closed: izhod 1 = STOP)
docker compose run --rm migrate
#   → npx prisma migrate deploy   (prave, transakcijske migracije)
#   → node scripts/verify-db.mjs  (14 invariant; izpis OK/FAIL po vrstici)

# 3. Zagon
docker compose up -d

# 4. Health (počakaj ~45 s start_period)
curl -s http://localhost:3000/api/health | head -1
```

**Kaj se je ZDAJ drugače (deploy audit v1.3.0):** prej je `build`
poganjal `scripts/db-sync.mjs` — ad-hoc DDL z best-effort napakami, ki je
lahko pustil DELNO migrirano bazo in vseeno uspel. Sdaj migracije poganja
IZKLJUČNO `migrate` servis (Prisma migracije so transakcijske — delna
napaka povrne CELO migracijo in deployment se ustavi).

### Obstoječa (pre-migracijska) baza

Če migracijo poganjaš nad bazo, ki je bila usklajevana z `db push` /
db-sync (npr. stari Neon), pred prvim `migrate deploy` Označi baseline:

```bash
DATABASE_URL="postgresql://..." bunx prisma migrate resolve --applied 0001_init
DATABASE_URL="postgresql://..." bun run db:migrate:deploy
DATABASE_URL="postgresql://..." bun run db:verify
```

Če baza vsebuje vrstice `Order`/`Receipt` z NULL `locationId`,
migracija **ZAVRNE** z
`Cannot apply NOT NULL migration: unresolved orders without locationId`.
To je NAMENJENO: podatke razreši ROČNO (klasifikacija, uvoz iz starega
vira, MIGRATION_REVIEW zapis ali izrecna legacy oznaka). NIKOLI jih ne
pripisuj "prvi aktivni lokaciji" — pokvarilo bi promet, Z-report, FURS
podatke, računovodstvo, statistiko, zalogo in revizijsko sled.

---

## 5. Preskusi pred sprejemom (STAGING GATES)

### 5.1 WebSocket na pravi infrastrukturi (kriterij #7)

```bash
# a) Deploy-test skripta (11 preverjanj — vključno WS + boot guard):
docker compose run --rm app node scripts/deploy-test.mjs

# b) Ročni WS preskus SKOZI PROXY (ključno — preverja upgrade glave!):
#    v brskalniku odpri aplikacijo prek https://staging.domena.si,
#    prijava → KDS zaslon → naročilo mora priti v <1 s (push, ne 5 s polling).
#    V konzoli: nobenih wss:// napak.

# c) Avtorizacija WS (regresija P1): token v URL → 401; brez tokena
#    sporočilo → AUTH_REQUIRED (deploy-test pokriva).
```

Sprejem: KDS push dela prek TLS (wss) + deploy-test 11/11.

### 5.2 Backup/restore preskus (kriterij #9)

```bash
# 1. Ustvari testne podatke (naročilo + plačilo skozi UI).

# 2. BACKUP (zunaj containerja, datumski pečat):
docker compose exec db pg_dump -U restaurantos -Fc restaurantos \
  > backup-$(date +%F-%H%M).dump
cp backup-*.dump /var/backups/restaurantos/     # ali S3 rclone sync

# 3. RESTORE v SVEŽO bazo (dokaz, da backup NI le datoteka):
docker compose exec db psql -U restaurantos -d postgres \
  -c "CREATE DATABASE restore_test"
cat backup-*.dump | docker compose exec -T db \
  pg_restore -U restaurantos -d restore_test --clean --if-exists
# primerjaj ključne vsote:
docker compose exec db psql -U restaurantos -d restore_test \
  -c 'SELECT COUNT(*), COALESCE(SUM("total"),0) FROM "Order"'
docker compose exec db psql -U restaurantos -d restaurantos \
  -c 'SELECT COUNT(*), COALESCE(SUM("total"),0) FROM "Order"'

# 4. Dokončni preskus: zaustavi app, zamenjaj bazo z restore_test
#    (preimenuj), zaženi — aplikacija MORA delovati s ponovljenimi
#    podatki. Po preskusu povrni prvotno bazo.
```

Sprejem: števila se ujemajo + app deluje na ponovljeni bazi. Dokumentiraj
datum preskusa (RELEASE_PROCESS.md polje "Testni rezultati").

### 5.3 Operacijski preskusi

| Preskus | Ukaz | Sprejem |
|---|---|---|
| Restart odpornost | `docker compose restart app` | health spet OK; KDS ponovno poveže |
| FURS boot guard | `FURS_ALLOW_SIMULATION=true docker compose up app` | zagon ZAVRNJEN (exit 1) |
| Seed fail-closed | `curl -X POST .../api/seed` | 403 (tudi z admin sejo) |
| Cron (outbox/emails) | cron v host: `0 3 * * * curl -s https://staging…/api/cron/outbox` | 200 + izpraznjen outbox |
| Izpisi upravljanja | `docker compose logs app --since 10m \| rg '"level":"error"'` | brez sistematičnih napak |

---

## 6. TLS — reverse proxy (obvezno pred prijavo uporabnikov)

Najhitrejša pot Caddy (samodejni Let's Encrypt):

```bash
# Caddyfile.staging:
staging.domena.si {
    reverse_proxy 127.0.0.1:3000
    # WS upgrade Caddy naredi SAMO (razlikovni reverse_proxy ravno zato)
}
```

V compose lahko dodatec caddy storitev (porti 80/443) ali systemd caddy
na hostu. Za nginx konfiguracijo (WS glave!) glej DEPLOYMENT.md §"Reverse
proxy zahteve" — `proxy_set_header Upgrade/Connection` sta OBVEZNA za
`/ws`.

Nasvet: v produkciji `app` vrata veži samo na localhost
(`"127.0.0.1:3000:3000"` v compose) — javni edini vstop je proxy.

---

## 7. Vsakodnevne operacije

```bash
# Dnevni backup (cron na hostu):
0 4 * * * cd /opt/restaurantos && docker compose exec -T db \
  pg_dump -U restaurantos -Fc restaurantos > /var/backups/restaurantos/$(date +\%F).dump

# Logi (structured JSON — LOG_FORMAT=json):
docker compose logs -f app | python3 -m json.tool 2>/dev/null || docker compose logs -f app

# Posodobitev na novo verzijo:
cd /opt/restaurantos
git fetch --tags && git checkout v1.3.1          # vedno TAG
docker compose build                             # brez DB
docker compose run --rm migrate                  # migracije + verify (fail-closed)
docker compose up -d                             # zamenjava app containerja
curl -s localhost:3000/api/health | head -1
```

### Rollback

```bash
git checkout v1.3.0
docker compose build && docker compose up -d
# PRISILA: če je nova verzija pripelala migracijo, ki jo želiš
# povrniti, migracije se NE povrnejo samodejno — Prisma migracije so
# enosmerne. Poglej RELEASE_PROCESS.md polje "Rollback" za izdajo.
```

---

## 8. Sprejemni checklist (12/12 kriterijev)

| # | Kriterij | Kje dokazan | Status |
|---|---|---|---|
| 1 | Ni cross-tenant dostopa | unit + integration testi (CI) | ✅ CI |
| 2 | Finančni tokovi transakcijsko | unit + E2E (CI) | ✅ CI |
| 3 | Dvojna zahteva ≠ dvojno plačilo | E2E race (CI) | ✅ CI |
| 4 | Offline sync idempotent | E2E replay (CI) | ✅ CI |
| 5 | FURS retry ne podvoji | unit + E2E (CI); produkcijska certifikacija = zunanji proces | ✅ CI / ⏳ FURS |
| 6 | Payment webhook fail-closed | unit (CI) | ✅ CI |
| 7 | **WebSocket na pravi infrastrukturi** | **§5.1 tukaj** | ⏳ staging |
| 8 | Seed/simulacija izklopljena | fail-closed guard (CI) | ✅ CI |
| 9 | **Backup/restore testiran** | **§5.2 tukaj** | ⏳ staging |
| 10 | Vsi CI testi zeleni | GitHub Actions (7/7 jobov) | ✅ CI |
| 11 | Build reproduktibilen | CI build vsak push | ✅ CI |
| 12 | Dokumentacija usklajena | README statusi + ta vodnik | ✅ repo |

Ko sta §5.1 in §5.2 podpisana (datum + izvedel), so VSI kriteriji zaprti
— razen FURS produkcijske certifikacije (zunanji proces pri davčni
upravi). Sledi pilot: ena lokacija, 1–2 blagajni, 2 tedna vzporednega
delovanja, nato polni preklop.
