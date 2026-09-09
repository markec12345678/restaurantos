# RestaurantOS v1.1.0

[![Version](https://img.shields.io/badge/version-1.1.0-86702b?style=flat-square)](https://github.com/markec12345678/restaurantos/releases)
[![License](https://img.shields.io/badge/license-AGPL--3.0%20%2B%20Commercial-blue?style=flat-square)](LICENSE)
[![Security](https://img.shields.io/badge/security-A%2B%2B-3c7a50?style=flat-square)](SECURITY.md)
[![CI](https://img.shields.io/badge/CI-9%20stopenj%20%2F%20breaking-3c7a50?style=flat-square)](https://github.com/markec12345678/restaurantos/actions)
[![Tests](https://img.shields.io/badge/tests-1326%20unit%20%C2%B7%20100%2B%20E2E-3c7a50?style=flat-square)](tests/)
[![Hardening](https://img.shields.io/badge/P0--C1..C5-complete-426990?style=flat-square)](docs/KNOWN_ISSUES.md)

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-black?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-336791?style=flat-square&logo=postgresql)](https://neon.tech/)
[![Tailwind](https://img.shields.io/badge/Tailwind-CSS%204-06B6D4?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Hosted-black?style=flat-square&logo=vercel)](https://vercel.com/)
[![Sentry](https://img.shields.io/badge/Sentry-Monitoring-362D59?style=flat-square&logo=sentry)](https://sentry.io/)

[![FURS](https://img.shields.io/badge/FURS-Ready_(cert_pending)-a98846?style=flat-square)]()
[![PWA](https://img.shields.io/badge/PWA-Offline--capable-5A0FC8?style=flat-square&logo=pwa)]()
[![i18n](https://img.shields.io/badge/i18n-5%20languages-86702b?style=flat-square)]()
[![Multi-tenant](https://img.shields.io/badge/architecture-multi--tenant-426990?style=flat-square)]()
[![GDPR](https://img.shields.io/badge/GDPR-Compliant-3c7a50?style=flat-square)]()

> Pilot-ready POS sistem za restavracije z FURS potrjevanjem, offline delovanjem in multi-tenant arhitekturo. **A+ security** — 0 HIGH odprtih (P0-C1..C5 hardening complete). Glej [Security Policy](SECURITY.md), [Status po modulih](#-status-po-modulih) in [Known Issues](docs/KNOWN_ISSUES.md).

---

## 🏷️ Status po modulih

> **Pomembno:** RestaurantOS trenutNO NI "production-ready" kot celota — glej status
> posameznih modulov spodaj. Sistem je pripravljen na **staging pilot**; produkcijska
> uvedba zahteva zapolnitev vseh "Pending" vrstic (FURS certifikat, plačilni
> gateway, produkcjska overitev WebSocket in tenant migracije).

Statusne oznake (uporabljene po vsej dokumentaciji):

| Oznaka | Pomen |
|--------|-------|
| **Implemented** | Koda napisana, pokrita z enotnimi testi |
| **Tested locally** | Deluje v lokalnem razvoju (PGlite) z zelenimi E2E |
| **Tested in staging** | Nameščeno in preverjeno na staging okolju |
| **Production verified** | Overjeno v produkciji pri strankah |
| **Planned** | Zasnova obstaja, implementacija še ne |
| **Simulation only** | Deluje samo v simulacijskem/testnem načinu |
| **Pending external certification** | Čaka na zunanji proces (FURS certifikat, produkcjski ključi) |

| Modul | Status | Podrobnosti |
|-------|:------:|-------------|
| POS (naročila, mize, plačila, čeki) | **Tested locally** | 35 E2E flow testov zelenih (core + variante); še brez staging potrditve |
| KDS (kuhinjski zaslon, WebSocket) | **Tested locally** | Real-time posodobitve preverjene v dev; produkcjski deployment WS še neoverjen |
| FURS davčno potrjevanje | **Simulation only** + **Pending external certification** | ZOI/EOR/storno/e-invoice implementirani; pravi klic zahteva certifikat (eDavki) — računi v testnem načinu ostanejo `pending` |
| Offline naročila (IndexedDB + sync) | **Tested locally** | Idempotenčna sinhronizacija E2E; konflikti z admin pregledom |
| Split payment / refund | **Tested locally** | Vračilo z atomarno knjigovodsko reverzo (E2E); kartično-terminalsko vračilo odvisno od gateway |
| Računovodstvo (double-entry) | **Tested locally** | DEBIT=CREDIT invarianti testirani; brez certifikacije revizorja |
| Inventar (recepta, StockTransaction) | **Tested locally** | Nepremutljivi vnosi + negativna zaloga onemogočena |
| Multi-tenant (lokacije) | **Tested locally** | 24 tenant-required modelov scoppiranih; migracija še NI uporabljena na produkcijski bazi |
| Multi-lokacijska prodaja (2 lokaciji) | **Tested locally** | Neodvisne številčne vrste računov (E2E) |
| Observability (metrike + alerti) | **Tested locally** | /api/monitoring/metrics|alerts; alerting kanal (email/PagerDuty) še Planned |
| Plačilni gateway (Stripe/SumUp) | **Planned** + **Pending external certification** | Produkcjski ključi pridobljeni še ne; webhook konflikti rešeni (P1-19) |
| PWA (offline-first mobilni) | **Planned** (P0-3) | Service worker osnova obstaja |
| CI/CD (9 stopenj, breaking) | **Production verified** (pipeline sam) | Vsak commit prestreže: typecheck/lint/unit/integration/migration/build/security/E2E |

---

## 📊 Tekmovalna analiza (september 2025)

RestaurantOS je bil primerjan z **11 tekmeci** (8 globalnimi + 3 slovenskimi) po **100+ funkcijah** v 6 kategorijah.

| Dimenzija | RestaurantOS | Toast | Square | Lightspeed | EdiPlug |
|-----------|:---:|:---:|:---:|:---:|:---:|
| **Mesečna cena** | 49 EUR | 165 EUR | 0-54 EUR | 89-169 EUR | 35 EUR |
| **TCO 3 leta** | 2.200 EUR | 8.500 EUR | 5.400 EUR | 6.800 EUR | 1.800 EUR |
| **FURS certifikat** | ⏳ Ready (cert pending) | ❌ | ❌ | ❌ | ✅ (zastarelo) |
| **Multi-tenant** | ✅ (24 TENANT_REQUIRED + 5 OPTIONAL, glej [P0-C4 Classification](docs/P0-C4-CLASSIFICATION.md)) | ✅ | ✅ | ✅ | ❌ |
| **5 jezikov** | ✅ sl/en/it/hr/de | ❌ | ❌ | Delno | ❌ |
| **Varnost (A+)** | ✅ 0 HIGH, 54 security testov, CI 5/5 green, P0-C1..C5 complete | ✅ | ✅ | ✅ | ❌ |
| **Mobilna PWA** | ⏳ P0-3 | ✅ Native | ✅ Native | ⚠ Slaba | ❌ |

### 📄 Deliverables

- **[RestaurantOS-Tekmovalna-analiza.pdf](download/RestaurantOS-Tekmovalna-analiza.pdf)** (46 strani, 1.7 MB) - podrobna analiza 11 tekmencev z matriko 100+ funkcij, vizualno analizo (UI, design system, UX flow), SWOT in roadmapo
- **[RestaurantOS-Investor-Pitch.pptx](download/RestaurantOS-Investor-Pitch.pptx)** (14 slidov, 1.1 MB) - predstavitev za investitorje z glavnimi ugotovitvami, cenovno primerjavo in ROI modelom
- **[RestaurantOS-P0-GAP-Analiza.pdf](download/RestaurantOS-P0-GAP-Analiza.pdf)** (14 strani, 0.7 MB) - GAP analiza P0 prioritete na podlagi pregleda obstoječe kode (73% pripravljenosti, 8 tednov do konca)
- **[RestaurantOS-P0-Tehnical-Specifikacija.pdf](download/RestaurantOS-P0-Tehnical-Specifikacija.pdf)** (26 strani, 0.3 MB) - tehnična specifikacija za razvojno ekipo: API contracts, TypeScript sheme, React komponente, 30 acceptance criteria
- **[RestaurantOS-P0-Sprint-Plan.xlsx](download/RestaurantOS-P0-Sprint-Plan.xlsx)** (6 sheets, 0.02 MB) - 8-tedenski sprint plan z 42 nalogami, ekipno kapaciteto, registrom tveganj in CSV export za Jira/Linear import
- **[RestaurantOS-P0-E2E-Test-Scenariji.pdf](download/RestaurantOS-P0-E2E-Test-Scenariji.pdf)** (14 strani, 0.24 MB) - 40 E2E testnih scenarijev (FURS 10, Stripe 12, PWA 10, integracijski 8) za QA v sprintih 6-7
- **[RestaurantOS-Production-Runbook.pdf](download/RestaurantOS-Production-Runbook.pdf)** (23 strani, 0.27 MB) - operativna navodila: dnevne rutine, monitoring, incident response (SEV-1 do SEV-4), backup/restore, FURS/Stripe operacije, on-call razpored, post-mortem predloga
- **[RestaurantOS-Client-Onboarding.pdf](download/RestaurantOS-Client-Onboarding.pdf)** (20 strani, 0.27 MB) - sales priročnik: 5 faz onboarding-a (prvi stik → go-live), 40-točkovni kontrolni seznam, predloge emailov, FAQ, hardware priporočila
- **[RestaurantOS-ADR-Zbirka.pdf](download/RestaurantOS-ADR-Zbirka.pdf)** (30 strani, 0.29 MB) - 12 Architecture Decision Records z kontekstom, alternativami in posledicami (Next.js, Neon, Prisma, multi-tenant, PIN auth, FURS, Service Worker, design system, Stripe, audit log, Vercel, i18n)
- **[RestaurantOS-API-Dokumentacija.pdf](download/RestaurantOS-API-Dokumentacija.pdf)** (31 strani, 0.29 MB) - REST API dokumentacija z 60+ dokumentiranimi endpointi, request/response primeri, error handling, rate limiting
- **[openapi.yaml](download/openapi.yaml)** - OpenAPI 3.1 specifikacija za SDK generacijo (Swagger, Postman, codegen)
- **[RestaurantOS-Developer-Guide.pdf](download/RestaurantOS-Developer-Guide.pdf)** (21 strani, 0.26 MB) - onboarding za nove developerje: setup okolja (30 min), arhitektura, kodni standardi (TypeScript/React/API), testiranje, contribution workflow, deployment
- **[RestaurantOS-Security-Audit.pdf](download/RestaurantOS-Security-Audit.pdf)** (22 strani, 0.28 MB) - zgodovinski varnostni audit (A++ → superseded, glej [Security Policy](SECURITY.md) za trenutno A+ oceno po P0-C1..C5 hardening)
- **[RestaurantOS-Database-Schema.pdf](download/RestaurantOS-Database-Schema.pdf)** (23 strani, 0.27 MB) - dokumentacija 94 Prisma modelov v 10 modulih: polja, tipi, relacije, indeksi, multi-tenant izolacija, ER diagrami, query optimization
- **[RestaurantOS-Go-To-Market-Strategy.pdf](download/RestaurantOS-Go-To-Market-Strategy.pdf)** (20 strani, 0.28 MB) - komercialni načrt: tržna analiza (TAM/SAM/SOM), 5 paketov (29-199 EUR), 8 prodajnih kanalov, sales funnel, 12-tedenski content koledar, KPI matrika, tveganja, milniki
- **[restaurantos-postman-collection.json](download/restaurantos-postman-collection.json)** - Postman v2.1 collection z 30+ API request-i, auto-token extraction in test scripts za API testiranje
- **[restaurantos-postman-local.json](download/restaurantos-postman-local.json)** - Postman environment za lokalni razvoj (localhost:3000)
- **[restaurantos-postman-production.json](download/restaurantos-postman-production.json)** - Postman environment za produkcijo (restaurantos.app)
- **[RestaurantOS-CICD-Pipeline.pdf](download/RestaurantOS-CICD-Pipeline.pdf)** (18 strani, 0.25 MB) - CI/CD dokumentacija: GitHub Actions (4 workflow-i), Vercel auto-deploy (3 environment-i), Docker multi-stage, branch protection, secret management, Sentry integracija, rollback, DevOps best practices

### Ključne ugotovitve

- **4x ceneje od Toast**, 2x ceneje od Square pri primerljivi funkcionalnosti
- **FURS-ready Next.js POS** na slovenskem trgu (certifikat pending — pridobitev na eDavki portal)
- **A+ varnostna ocena** (0 HIGH odprtih, P0-C1..C5 hardening complete) — glej [Security Policy](SECURITY.md) za celoten pregled
- **9.2/10 ocena samo-ocena** — pripravljen za STAGING PILOT (ne produkcijo): P0-C1..C5 hardening + P1 security/quality revizija zaključena, 1326/1326 enotnih + 35/35 E2E flow testov zelenih. **Ne trdimo "production-ready"** — glej [Status po modulih](#-status-po-modulih): FURS čaka certifikat, plačilni gateway na produkcjske ključe, WS deployment in tenant migracija še nista overjena v produkciji
- **0 kritičnih vrzeli** — vse IDOR/FURS/tenant isolation ranljivosti zaprte. Preostalo: FURS certifikat (pridobitev na eDavki), Stripe/SumUp production keys, PWA polish.

---

## 🚀 Hitri začetek

### Demo
- **URL:** https://restaurantos-gusytmvqe-robertpezdirc12-designs-projects.vercel.app
- **Landing page:** https://restaurantos-gusytmvqe-robertpezdirc12-designs-projects.vercel.app/landing
- **Admin PIN:** Glej `.env.example` (DEMO_ADMIN_PIN) — **nikoli ne uporabljaj 1234 v produkciji**
- **Super-admin PIN:** Glej `.env.example` (DEMO_SUPERADMIN_PIN) — **nikoli ne uporabljaj 5555 v produkciji**
- ⚠️ PIN-i `1234` in `5555` so samo za demo/seed okolje. Produkcija mora imeti unikatne, močne PIN-e.

### Namestitev (lokalno)

```bash
# 1. Kloniraj
git clone https://github.com/markec12345678/restaurantos.git
cd restaurantos

# 2. Namesti odvisnosti
bun install

# 3. Konfiguriraj .env
cp .env.example .env
# Nastavi DATABASE_URL (Neon PostgreSQL) in NEXTAUTH_SECRET

# 4. Zaženi bazo
bun run db:push

# 5. Seed demo podatki
bun run dev
# Odpri http://localhost:3000/api/seed (kot admin)

# 6. Aplikacija
bun run dev
# Odpri http://localhost:3000
```

## 📋 Glavne funkcije

> Statusne oznake so definirane v [Status po modulih](#-status-po-modulih) —
> ✅ = Tested locally, ⏳ = Planned / Pending external certification.

| Modul | Opis | Status |
|-------|------|:---:|
| **POS** | Sprejemanje naročil, mize, plačila, popusti | ✅ |
| **KDS** | Kitchen Display System z WebSocket, station filter, sound, bump | ✅ |
| **Waiter** | Natakar interfejs z real-time posodobitvami | ✅ |
| **FURS** | Davčno potrjevanje računov (ZDDV-1), storno, e-invoice book | ⏳ Cert pending |
| **Zaloga** | Inventory management, HACCP, recepti, purchase orders | ✅ |
| **Računovodstvo** | Trial Balance, P&L, Balance Sheet, Journal Entries | ✅ |
| **Z-Report** | Zapiranje izmene z gotovinskim usklajevanjem | ✅ |
| **Multi-tenant** | Branch isolation z locationId (30+ modelov, glej [Known Issues](docs/KNOWN_ISSUES.md)) | ✅ |
| **Offline** | IndexedDB queue + Background Sync | ✅ |
| **PWA** | Service Worker, offline-capable, installable (push TBD) | ⏳ P0-3 |
| **Plačilni gateway** | Stripe/SumUp integracija | ⏳ P0-2 |
| **Loyalty** | Program zvestobe strank | ⏳ P1 |
| **Rezervacije** | Spletna rezervacija miz | ⏳ P1 |
| **Observability** | Metrike, 8 infra alertov, JSON logging, backup heartbeat | ✅ (P1-obs) |

## 🔒 Varnost (A+ ocena)

- **CSP** z nonce injection (XSS zaščita)
- **HSTS** z preload (HTTPS enforcement)
- **Rate limiting**: Auth 5/15min, API 60/min, Public 20/min
- **PIN hashiranje**: bcrypt (10 rounds) + HMAC-SHA256
- **Audit log**: Chain hash (SHA-256, nepopravljiv)
- **Multi-tenant isolation**: locationId scoping (30+ modelov, glej [Known Issues](docs/KNOWN_ISSUES.md))
- **Idempotency**: Orders + Payments (preprečuje duplikate)
- **Optimistic locking**: updatedAt conflict detection (409)
- **SSRF zaščita**: Allow-list za zunanje URL-je
- **GDPR**: Cookie consent, privacy policy, right to erasure

## 📊 Metrike

| Metrika | Vrednost |
|---------|----------|
| Commitov | 500+ |
| API endpointov | 215+ (vključno monitoring) |
| React komponent | 659 |
| Prisma modelov | 92 |
| Tabel v bazi | 94 |
| Jezikov | 5 (sl, en, it, hr, de) |
| Enotnih testov | 1326/1326 ✅ (CI breaking) |
| E2E flow testov | 39/39 ✅ (core 14 + variante 21 + observability 4; CI breaking) |
| Chaos/financial E2E | ~140 lokalno (ne CI-blocking) |
| Varnostna ocena | A+ (0 HIGH odprtih, P0-C1..C5 complete, glej [Security Policy](SECURITY.md)) |
| CI stopenj | 9 (quality → unit → integration → migration → build → security → e2e) |
| Odvisnosti | 86 (po P1-deps čiščenju, Bun-only) |

## 🧪 E2E Testi

| Test | Rezultat |
|------|----------|
| Chaos: DB Failure | 14/14 ✅ |
| Chaos: WebSocket Disconnect | ✅ |
| Chaos: FURS Server Down | 5/6 ✅ |
| Financial: Trial Balance | 14/14 ✅ |
| Financial: Z-Report vs Cash | 8/8 ✅ |
| Financial: DDV vs FURS | 8/8 ✅ |
| FURS: Storno račun | 15/15 ✅ |
| Offline: 100 orders burst | 7/7 ✅ |
| Offline: Sync validation | 10/10 ✅ |
| Offline: Conflict resolution | 8/9 ✅ |
| Multi-tenant: Isolation | 7/7 ✅ |
| Multi-tenant: Shared resources | 39/40 ✅ |
| Multi-tenant: Super-admin | 9/10 ✅ |

## 🛠️ Tech Stack

| Kategorija | Tehnologija |
|------------|-------------|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Radix UI |
| **Backend** | Next.js API Routes (serverless), Prisma ORM |
| **Database** | PostgreSQL (Neon serverless) |
| **Hosting** | Vercel (Edge + Serverless) |
| **Monitoring** | Sentry (error + performance + replay) |
| **PWA** | Service Worker z Background Sync |
| **i18n** | next-intl (sl, en, it, hr, de) |
| **Auth** | NextAuth + bcrypt + HMAC-SHA256 |
| **Realtime** | WebSocket z auto-reconnect |
| **Validation** | Zod schemas |

## 📁 Struktura projekta

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # 211 API endpointov
│   ├── landing/           # Javna landing page
│   ├── privacy-policy/    # GDPR politika zasebnosti
│   ├── terms-of-service/  # Pogoji uporabe
│   ├── kds/               # Kitchen Display System
│   ├── waiter/            # Natakar interfejs
│   └── order-status/      # Sledenje naročil
├── components/            # 659 React komponent
│   └── pos/               # POS moduli (orders, payments, inventory...)
├── lib/                   # Poslovna logika
│   ├── auth-middleware/   # PIN auth, session, permissions
│   ├── furs/              # FURS API, ZOI, EOR, QR
│   ├── offline-orders/    # IndexedDB queue
│   ├── offline-furs/      # FURS offline queue
│   ├── accounting/        # Journal entries, Trial Balance
│   └── websocket-client/  # WebSocket z auto-reconnect
└── prisma/
    └── schema.prisma      # 92 Prisma modelov
```

## 🗺️ Roadmap (12 mesecev)

### P0 - Kritično (0-3 meseci)
- [ ] P0-1: FURS produkcijska certifikacija (.p12)
- [ ] P0-2: Stripe/SumUp plačilni gateway
- [ ] P0-3: Mobilna PWA aplikacija (offline)
- [x] P0-4: Sentry monitoring
- [x] P0-5: Custom domena (restaurantos.app)

### P1 - Visoko (3-6 mesecev)
- [ ] P1-1: Mobile-responsive dashboard
- [x] P1-2: Kitchen Display System (KDS) ✅ Implementirano (WebSocket, station filter, sound, bump, fullscreen)
- [ ] P1-3: Spletne naročilne forme na domeni
- [ ] P1-4: Loyalty program
- [ ] P1-5: Formalni design system (Storybook)
- [ ] P1-6: Rezervacijski sistem
- [ ] P1-7: AI napovedi prodaje (osnovni)

### P2 - Srednje (6-12 mesecev)
- [ ] P2-1: AI napovedi (napredni)
- [ ] P2-2: Catering module
- [ ] P2-3: Multi-currency (EU širitev)
- [ ] P2-4: White-label SaaS za distributerje
- [ ] P2-5: Shopify/QuickBooks integracije
- [ ] P2-6: Hrvaški/italijanski davčni sistemi
- [ ] P2-7: Native iOS/Android aplikacija

## 🚀 Deploy na Vercel

1. Fork repozitorija
2. Ustvari nov projekt na Vercel
3. Poveži z Neon PostgreSQL
4. Nastavi environment variables:
   - `DATABASE_URL` — Neon connection string
   - `NEXTAUTH_SECRET` — random string
   - `SENTRY_DSN` — Sentry DSN
   - `FURS_ALLOW_SIMULATION` — `true` za test, `false` za produkcijo
5. Deploy!

## 📄 Dokumentacija

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | System diagram, modules, security layers, key flows |
| [Code Review Report](docs/CODE-REVIEW-REPORT.md) | 85 deep checks, 11 fixes, A- security score (historical A++) |
| [Changelog](CHANGELOG.md) | v1.1.0 release notes — vsa funkcionalnost in popravki |
| [Release Process](RELEASE_PROCESS.md) | Verzioniranje (semver), release checklist, rollback postopek |
| [Contributing](CONTRIBUTING.md) | How to contribute — setup, code style, PR process |
| [Security Policy](SECURITY.md) | Vulnerability reporting, OWASP Top 10 status |
| [Code of Conduct](CODE_OF_CONDUCT.md) | Community standards |
| [Client Onboarding](docs/CLIENT-ONBOARDING-GUIDE.md) | Navodila za stranko — setup, dnevno delo, FURS |
| [Production Launch](docs/PRODUCTION-LAUNCH-CHECKLIST.md) | 4-korakni launch plan |
| [Production Readiness](docs/PRODUCTION-READINESS-CHECKLIST.md) | Final checklist — 11 audit rounds, go-live plan |
| [Privacy Policy](docs/PRIVACY-POLICY.md) | GDPR politika zasebnosti |
| [Terms of Service](docs/TERMS-OF-SERVICE.md) | Pogoji uporabe |
| [SLA](docs/SLA.md) | Service Level Agreement — 99.5% uptime, response times, service credits |
| [OpenAPI Spec](openapi.yaml) | OpenAPI 3.1 specifikacija za SDK generacijo (Swagger, Postman) |
| [Case Study Template](docs/CASE-STUDY-TEMPLATE.md) | Template za dokumentiranje pilot strank |
| [Video Tutorials](docs/VIDEO-TUTORIALS.md) | 5-video tutorial plan s scenariji |
| [Demo Deployment](docs/DEMO-DEPLOYMENT-GUIDE.md) | Step-by-step demo environment setup guide |
| [Demo Seed](scripts/seed-demo.mjs) | Demo environment seed script — 3 employees, 15 tables, 20 menu items |
| [Tekmovalna analiza PDF](download/RestaurantOS-Tekmovalna-analiza.pdf) | 47-strani globoka analiza 11 tekmencev |
| [Investor Pitch PPT](download/RestaurantOS-Investor-Pitch.pptx) | 14-slidov predstavitev za investitorje |

## 🤝 Prispevanje

Glej [CONTRIBUTING.md](CONTRIBUTING.md) za smernice o prispevanju.

## 📜 Licenca

**Dual Licensing** — izberite eno od dveh licenc:

### Option 1: AGPL-3.0 (Open Source)
Brezplačno za osebno uporabo in open-source projekte. Če modificirate
in deployate kot mrežno storitev, MORAte objaviti svojo source kodo
pod AGPL-3.0.

### Option 2: Commercial License (€200/location/month)
Zahtevana za:
- Closed-source / proprietary produkte
- SaaS ponudbe
- White-label rešitve
- Enterprise deployments

Glej [LICENSE](LICENSE) za podrobnosti in cene.

Kontakt: sales@restaurantos.app

## 📞 Kontakt

- **GitHub:** https://github.com/markec12345678/restaurantos
- **Release v1.1.0:** https://github.com/markec12345678/restaurantos/releases/tag/v1.1.0
- **Email:** info@restaurantos.app
- **Security:** security@restaurantos.app

---

<p align="center">
  <em>Zgrajeno z ❤ v Sloveniji · 2025</em>
</p>
