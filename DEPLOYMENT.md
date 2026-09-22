# DEPLOYMENT — WebSocket in produkcjska postavitev

> DEPLOYMENT AUDIT 2026-09-09 — dokumentirana odločitev po uporabniškem zahtevku
> (točka 3): **"Ne predpostavljaj, da bo server.js samodejno deloval kot trajni
> WebSocket server v serverless okolju."** — potrjeno: na Vercelu NE deluje.

## Trenutno stanje (2026-09-09)

| Komponenta | Vercel (trenutna produkcija) | Custom server (`node server.js`) |
|---|---|---|
| Next.js app | ✅ serverless funkcije | ✅ en Node proces |
| REST API | ✅ | ✅ |
| **WebSocket (`/ws`)** | ❌ **ne deluje** (serverless nima trajnega procesa) | ✅ deluje v istem procesu |
| `globalThis.__wsBroadcast` | `undefined` → eventi tiho preskočeni | ✅ aktiven |
| KDS real-time | degradirano na **polling (5s)** | ✅ real-time push |
| Cron (outbox, emails) | ✅ Vercel crons | ⚠️ potreben zunanji cron |

Klienti so odporni: `useWSConnect` izbere `ws://` ali `wss://` glede na protokol
strani; ob napaki WS povezava KDS samodejno osvežuje prek React-Query
`refetchInterval: 5000`. Aplikacija NIKOLI ne pade zaradi nedelovančega WS.

---

## Možnost A — en Node proces (self-hosted Docker/VPS)

**Za koga:** popoln real-time (KDS push, waiter call, live order flow) brez
dodatnih servisov.

```
[Docker/VPS]
  └─ node server.js        ← Next.js + WebSocket v ISTEM procesu
       ├─ PostgreSQL (Neon ali lokalni)
       ├─ Redis (opcijsko — cache; WS še vedno en proces)
       └─ reverse proxy (nginx/Caddy) ← TLS terminacija + WS upgrade
```

Pripravljeno infrastrukture: `Dockerfile` (custom server — Next.js +
WebSocket v enem procesu, glej opombo spodaj), `docker-compose.yml`
(postgres + redis + app, db/redis SAMO interna omrežja, Redis Z geslom),
`migrate` servis (enkratne migracije), `start:ws` skripta,
`scripts/deploy-test.mjs`.

### Deployment vrstni red (deploy audit 2026-09-09 — OBVEZNO)

Build NIKOLI NE spreminja baze (ad-hoc DDL mehanizem `scripts/db-sync.mjs`
je POPOLNOMA ODSTRANJEN — njegova lastna dokumentacija je trdila "samo
nedestruktivne spremembe", izvajal pa je DROP CONSTRAINT / ALTER TYPE /
UPDATE / SET NOT NULL. Nadomestil so ga verzionirane Prisma migracije). Vrstni red:

```bash
bun install --frozen-lockfile   # 1. odvisnosti (en PM, bun.lock)
bun run db:generate             # 2. Prisma client (postinstall)
bun run db:migrate:deploy       # 3. PRAVE migracije (transakcijske, fail-closed)
bun run db:verify               # 4. fail-closed preverba invariant (izhod 1 = STOP)
bun run build                   # 5. produkcjski build (brez DB dostopa)
bun run start                   # 6. zagon (custom server: app + WS)
```

Migracija, ki ne uspe, MORA ustaviti deployment — to zagotavlja:
transakcijskost (delna napaka = ROLLBACK cele migracije) + `db:verify`
(14 invariant: NOT NULL, unique indeksi, 0 nerazrešenih vrstic).

**Docker ekvivalent**: `docker compose build` (brez DB) →
`docker compose run --rm migrate` (koraka 3+4) → `docker compose up -d`.

**Obstoječe (pre-migracijske) baze** (Neon, ki je bila usklajevana z
`db push` ali ad-hoc DDL): pred prvim `migrate deploy` označi baseline:
`bunx prisma migrate resolve --applied 0001_init` — nato se 0002_
p1_hardening izvede varno nad obstoječo shemo (idempotentne izjave).

**MODEL A (0003_tenant_model_a)**: če obstoječa baza vsebuje GLOBALNE
konfiguracijske vrstice (TaxRate/DiningOption/… brez locationId), migracija
**ZAVRNE** z `Cannot apply NOT NULL migration: unresolved … without
locationId`. Razreši ROČNO (dodeli pravo lokacijo prek SQL, podvoji po
lokacijah ali izbisi/označi legacy) — NIKOLI samodejno "prvi aktivni
lokaciji". Odločitev je dokumentirana v `docs/adr/0001-tenant-model-a.md`.

### ⚠️ POZOR — DOLGOLETNA NAPAKA KONČNO ZAPRTA (2026-09-09, v1.3.0)

Prej je `Dockerfile` CMD zagnal **Next standalone** strežnik
(`.next/standalone/server.js` je prepisal custom `server.js`) — v Dockerju
WS NI deloval. V1.3.0 runner kopira **custom server** (`server.js` +
`server-ws-core.js` + FULL `.next` + produkcijski `node_modules`) in poganja
`node server.js` — Next.js + WebSocket v ENEM procesu. Zagon potrdita
`docker compose run --rm app node scripts/deploy-test.mjs` in healthcheck
(`wget /api/health`) v compose. Za WS prek HTTPS glej nginx odsek spodaj.

### Časovni pas (TZ) — poslovni dnevi

EOD, Z-poročila in dnevne meje računajo poslovni dan po **Europe/Ljubljana**
prek `src/lib/timezone-sl.ts` (pravilen CET/CEST preklop, neodvisno od TZ
procesa). Kljub temu priporočamo, da na strežniku nastavite tudi procesni TZ
(`TZ=Europe/Ljubljana` v `docker-compose.yml` / systemd / ecosystem.config.js),
saj ostali deli knjižnic (npr. `date-fns format`) sledijo lokalnemu času
procesa — na UTC strežniku bi videli 1–2 h zamaknjene časovne žige v dnevnikih
in nekaterih pogledih.

### Reverse proxy zahteve (nginx)

```nginx
location /ws {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;      # ⬅ obvezno za WS handshake
    proxy_set_header Connection "upgrade";        # ⬅ obvezno za WS handshake
    proxy_set_header Host $host;
    proxy_read_timeout 3600s;                     # ⬅ WS povezave so dolgožive
}

location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;   # ⬅ HTTPS → wss odkrivanje
}
```

HTTPS → wss: klient SAM izbere protokol (`https` stran → `wss://` povezava);
TLS terminira na proxy-ju. Ni aplikacijske konfiguracije.

### Skaliranje (2+ instance, prihodnost)

`connectedClients` (Set) + `wsSessions` (Map) so **per-proces** — z več
inštancami uporabniki padejo na različne procese in broadcast ne prečka
meje. Rešitev (dokumentirana, še ni implementirana): **Redis Pub/Sub**
(dogodki → kanal → vse instance broadcastajo svojim klientom) ali NATS.
Ena instanca na lokacijo trenutno zadostuje (POS obremenitve so nizke).

---

## Možnost B — Vercel + ločen WebSocket servis

**Za koga:** ohrani Vercel (zero-ops, trenutna produkcija) + dodaj real-time.

```
[Vercel]                      [WS servis (Railway/Fly/Render/VPS)]
  └─ Next.js + REST API          └─ node server.js (samo /ws + auth)
       │                              ▲
       └─ REST spremembe ────────────┘  broadcast prek:
            (a) Redis Pub/Sub skupni kanal, ali
            (b) interno HTTP pot na WS servis (Avtorizacija: skupni secret)
```

Klient poveže na `wss://ws.example.com` (WS_BASE_URL env). REST ostane na
Vercelu; cron ostane na Vercelu.

---

## Deployment test (obvezen pred vsakim WS-relevantnim deployom)

```bash
bun run build                 # 1. produkcjski build
bun run test:deploy           # 2. node scripts/deploy-test.mjs
# Docker: docker compose run --rm app node scripts/deploy-test.mjs
```

Skripta preverja (11 preverjanj, izhod 1 = neveljavno za deploy):

1. ✅ custom server uporablja **pravilen** build (`GET /` → 200, production)
2. ✅ health check (`GET /api/health` → 200, db connected)
3. ✅ WebSocket se poveže (`CONNECTED`, authRequired)
4. ✅ neavtenticirana sporočila → `AUTH_REQUIRED`
5. ✅ token v URL-ju → handshake zavrnjen (HTTP 401)
6. ✅ oversize sporočilo (>16KB) → povezava zaprta
7. ✅ graceful shutdown (SIGTERM → exit 0)
8. ✅ restart procesa ne pokvari podatkov (health spet OK)
9. ✅ WS reconnect po restartu deluje
10. ✅ FURS boot guard: produkcija + simulation mode → zagon zavrnjen
11. ✅ build obstaja (BUILD_ID)

Proxy-specificne preverjanja (Upgrade header, HTTPS→wss) so v praksi
pokrita s konfiguracijo nginx zgoraj; lokalno ju ne moremo testirati brez
reverse proxy-ja v testnem krogu.

---

## Checklist pred produkcijskim zagonom (FURS)

| Pogoj | Kje preverjen | Obnašanje ob napaki |
|---|---|---|
| `NODE_ENV=production` + `FURS_ALLOW_SIMULATION=true` | boot guard (server.js + health) | **zagon zavrnjen** (exit 1) |
| FURS certifikat konfiguriran (per-location) | `getFursConfig()` ob vsaki fiskalizaciji | 503, račun ostane pending |
| Certifikat potekel | `cert-status` route (730d) + `getFursToken` | overitev pade, NE simulira |
| Obvezni podatki podjetja | `validateFursConfig()` pred oddajo | zahtevek zavrnjen |
| Simulacija oglašuje uspeh | `verifyInvoiceWithFURS` | `success: false` — račun NIKOLI ni označen overjen |

FURS statusi: trenutni model `none / pending / verified / failed` (poševna
preslikava: PENDING→pending, CONFIRMED→verified, FAILED_RETRYABLE/FAILED_FINAL→failed).
Bolj granularni statusi (SUBMITTING/SUBMITTED/CANCELLED) — dokumentirano kot
prihodnja shema-sprememba, glej worklog.
