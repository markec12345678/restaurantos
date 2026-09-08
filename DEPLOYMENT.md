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

Pripravljeno infrastrukture: `Dockerfile`, `docker-compose.yml`
(postgres + redis + app), `start:ws` skripta, `scripts/deploy-test.mjs`.

⚠️ **POZOR (Docker)**: `Dockerfile` CMD zažene **Next standalone** strežnik
(`.next/standalone/server.js` prepiše custom `server.js`) — v Dockerju WS
TRENUTNO ne teče. Za WS v Dockerju spremeni runner stage: skopiraj
`server.js` + `server-ws-core.js` + polne `node_modules/` namesto standalone
izhoda (ali zaženi `node server.js` iz repozitorija na VPS).

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
