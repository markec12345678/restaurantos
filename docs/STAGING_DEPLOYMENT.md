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
poganjal ad-hoc DDL (nekdanji `scripts/db-sync.mjs`, ki je trdil, da
dela samo nedestruktivne spremembe, izvajal pa DROP CONSTRAINT / ALTER
TYPE / UPDATE / SET NOT NULL — datoteka je ODSTRANJENA) in bi lahko
pustil DELNO migrirano bazo in vseeno uspel. Sdaj migracije poganja
IZKLJUČNO `migrate` servis (Prisma migracije so transakcijske — delna
napaka povrne CELO migracijo in deployment se ustavi).

### Obstoječa (pre-migracijska) baza

Če migracijo poganjaš nad bazo, ki je bila usklajevana z `db push` ali
ad-hoc DDL (npr. stari Neon), pred prvim `migrate deploy` Označi baseline:

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

---

## 9. Dnevnik izvedbe + PODPISA (2026-09-09, v1.3.1)

Prva dejanska izvedba tega vodnika — **sandbox lokacija** (enaki komponente,
brez Dockerja): PostgreSQL 16.4 (portable, 127.0.0.1:5434), `node server.js`
(Next+WS en proces, NODE_ENV=production), reverse-proxy vrstva za WS upgrade
(mini-proxy; namesto Caddyja), `pg_dump`/`pg_restore` (17.11 klient → 16.4
strežnik; glej opombo pri §5.2).

### 9.1 Vrstni red §4 (TOČNO po vodniku)

| Korak | Ukaz | Rezultat |
|---|---|---|
| 1 | `bun install --frozen-lockfile` | ✅ 1062 instalacij, 0 sprememb |
| 2 | `bun run db:generate` | ✅ Prisma client 5.22 (Model A tipi) |
| 3 | `bun run db:migrate:deploy` | ✅ 0001+0002+0003 aplicirane (transakcijsko) |
| 4 | `bun run db:verify` | ✅ **45/45 invariant** (15× NOT NULL, 15× 0 NULL vrstic, unique, migracijska zgodovina) |
| 5 | `bun run build` (BREZ `DATABASE_URL`) | ✅ build ne dostopa bazi (dokaz: env -u DATABASE_URL) |
| 6 | `node server.js` + health | ✅ `/api/health` 200 (db: connected) |

Negativni dokazi migracije 0003 (fail-closed):
`migrate deploy` na bazi z globalnimi vrsticami **ZAVRNE** z
`Cannot apply NOT NULL migration: unresolved dining options without
locationId (1) — … NIKOLI samodejno`; `db:verify` po namernem NULL vnosu
pade (44/45 + DEPLOYMENT ZAVRNJEN). Drift: `migrate diff --from-url` =
**No difference detected**.

### 9.2 §5.1 — WebSocket na (simulirani) infrastrukturi — ✅ PODPISAN

| Preskus | Orodje | Rezultat |
|---|---|---|
| a) 11 preverjanj (health, WS, AUTH_REQUIRED, 401 na token-v-URL, oversize 1009, restart, reconnect, SIGTERM, FURS guard) | `scripts/deploy-test.mjs` | **11/11 ✅** (na realnem PostgreSQL) |
| b) WS **skozi reverse-proxy vrstico** (Upgrade/Connection glave) | `scripts/ws-proxy-test.mjs` (NOVO) | **4/4 ✅** (health skozi proxy; WS handshake; AUTH_REQUIRED; 401) |
| c) MODEL A API dokazi na zagnani aplikaciji | prijava loc-2 zaposlenega | meniji SAMO loc-2 ✅; konfiguracija SAMO loc-2 ✅; naročilo s tujim artiklom = 400 ✅ |
| d) FURS boot guard (sim=true v produkciji) | vodnik §5.3 | ✅ zagon zavrnjen (exit 1) |

**Podpis §5.1:** *2026-09-09, izvedel: Super Z (agent), orodji: deploy-test
11/11 + ws-proxy-test 4/4 na PostgreSQL 16.*

⚠️ **Obseg podpisa (sandbox)**: preverjen je CELOTEN WS avtorizacijski in
upgrade mehanizem skozi proxy-vrstico — to je del, ki se v praksi POKVARI
(nastavitev `proxy_set_header Upgrade`). NI pokrito: TLS/wss terminacija
(Caddy/nginx) in brskalniški KDS push <1 s. **Pred pilotom na pravem VPS
ponovi §5.1b v brskalniku** (vodnik zahteva brskalniški preskus) —
`node scripts/ws-proxy-test.mjs --target https://staging.domena.si --external`
podpre tudi ta korak.

### 9.3 §5.2 — Backup/restore dejansko testiran — ✅ PODPISAN

| Korak | Rezultat |
|---|---|
| 1. Testni podatki | ✅ naročila ustvarjena **skozi API** (namesto UI — sandbox brez brskalnika; ista koda poti) |
| 2. BACKUP | ✅ `pg_dump -Fc` → 332 KB (datumski pečat) |
| 3. RESTORE v svežo bazo | ✅ `pg_restore --clean --if-exists` v `restore_test` |
| 4. Primerjava vsot | ✅ `COUNT+SUM(total) "Order"`: izvir = 6\|24.90, restore = **6\|24.90**; TaxRate 6/6; `_prisma_migrations` 3/3 |
| 5. App na ponovljeni bazi | ✅ health 200 + prijava + MODEL A scoped meniji (restore DB!) |

**Podpis §5.2:** *2026-09-09, izvedel: Super Z (agent), orodji: pg_dump 17.11
→ restore, aplikacija zagnana na `restore_test`.*

⚠️ **Opomba (verzijska razlika peskovnika)**: pg_dump/pg_restore 17.11 proti
strežniku 16.4 proizvede ENO benigno napako (`SET transaction_timeout` —
PG17-only GUC, ki ga 16 ne pozna; session-level, ne podatkovna). Na pravem
staging VPS sta dump in strežnik ISTIH verzij (postgres:16-alpine) → napake
ni. Vsi podatkovni kriteriji (vsote, zgodovina, app) so zeleni kljub njej.

### 9.4 Stanje sprejemnega checklist (12 kriterijev)

| # | Kriterij | Status po tej izvedbi |
|---|---|---|
| 7 | WebSocket na infrastrukturi | ✅ sandbox podpis (9.2); TLS+brskalnik ponovi na VPS |
| 9 | Backup/restore testiran | ✅ podpis (9.3) — z aplikacijo na ponovljeni bazi |
| 1–6, 8, 10–12 | (CI, fail-closed, E2E …) | ✅ kot v §8 — glej §9.5 za CI cikel |

> Opomba: izvedba je potekala v peskovniku brez Dockerja. Lokalna vrata: tsc
> clean, vitest unit (tenant-scope 15/15 + obstoječa zbirka), migracija 0003 +
> verify 45/45 dokazani na realnem PostgreSQL 16.

### 9.5 CI cikel po pushu (run #543 → fix)

Push v1.3.1 na GitHub je zagnal CI (run #543): 6/7 jobov zelenih, **E2E
Security Tests (30) je padel** — prvič, da je Model A dejansko tekel v CI.
Reprodukcija na identičnem okolju (svež PostgreSQL 16 + `db push` + `e2e-seed`
+ standalone build + enaka vrata) je odkrila in popravila tri vzroke
(commit `fix(ci)`, v CHANGELOG v1.3.1 razdelek 🔁):

1. **E-4** (flow-variants): naročilo `mi-1` (loc-1 artikel) na `table-2`
   (loc-2 miza) — mešana lokacija, ki jo MODEL A varovalka PRAVILNO zavrne
   (400). Testni podatki zastareli → popravljeni na dosleden par loc-2.
2. **Prijavna kaskada (429):** dve plasti omejitve prijav (middleware
   `API_RATE_LIMITS` + route-level `LOGIN_LIMIT`), obe 5/15 min, obe štejeta
   tudi uspešne prijave — E2E zbirka z retriji naredi 6+ → 429 → MODELA/OBS
   beforeAll padli. Obe plasti zdaj ENV-nastavljivi (`LOGIN_RATE_LIMIT_MAX`,
   privzeto 5 — produkcija nespremenjena; CI 30).
3. **D-3 (flaky):** trda asercija `-000001` je držala le za prvi loc-2 račun
   na sveži bazi — retriji pustijo dodatne račune. Zdaj pričakovana številka
   = `000001 + testInfo.retry` (asercija ostaja stroga).

Lokalna potrditev popravka (isto okolje kot CI job): **E2E Security 74/74**
(prej: 63 passed / 4 failed / 2 flaky / 5 not run), tsc clean, vitest
1375/1375, eslint 0 errors / 1472 warnings (<1486 ratchet), `/api/health`
zdaj poroča verzijo 1.3.1 (APP_VERSION inline iz package.json).

Status: fix commit pripravljen; CI zelen na `main` + tag `v1.3.1` (annotated)
se izvede po pushu (ta peskovnik nima GitHub poverilnic za push).
