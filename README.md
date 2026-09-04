# RestaurantOS v1.0.0

[![MIT License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Security: A++](https://img.shields.io/badge/Security-A%2B%2B-brightgreen)](SECURITY.md)
[![E2E: 96.6%](https://img.shields.io/badge/E2E_Tests-96.6%25-blue)](docs/CODE-REVIEW-REPORT.md)
[![Code Review: 85 checks](https://img.shields.io/badge/Code_Review-85_checks-success)](docs/CODE-REVIEW-REPORT.md)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-blue)](https://prisma.io)
[![Vercel](https://img.shields.io/badge/Vercel-Deployed-black)](https://vercel.com)

Production-ready POS sistem za restavracije z FURS potrjevanjem, offline delovanjem in multi-tenant arhitekturo.

## 🚀 Hitri začetek

### Demo
- **URL:** https://restaurantos-gusytmvqe-robertpezdirc12-designs-projects.vercel.app
- **Landing page:** https://restaurantos-gusytmvqe-robertpezdirc12-designs-projects.vercel.app/landing
- **Admin PIN:** `1234`
- **Super-admin PIN:** `5555`

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

| Modul | Opis |
|-------|------|
| **POS** | Sprejemanje naročil, mize, plačila, popusti |
| **KDS** | Kitchen Display System z WebSocket |
| **Waiter** | Natakar interfejs z real-time posodobitvami |
| **FURS** | Davčno potrjevanje računov (ZDDV-1), storno, e-invoice book |
| **Zaloga** | Inventory management, HACCP, recepti, purchase orders |
| **Računovodstvo** | Trial Balance, P&L, Balance Sheet, Journal Entries |
| **Z-Report** | Zapiranje izmene z gotovinskim usklajevanjem |
| **Multi-tenant** | Branch isolation z locationId (8 tabel) |
| **Offline** | IndexedDB queue + Background Sync |
| **PWA** | Service Worker, offline-first, installable |

## 🔒 Varnost

- **CSP** z nonce injection (XSS zaščita)
- **HSTS** z preload (HTTPS enforcement)
- **Rate limiting**: Auth 5/15min, API 60/min, Public 20/min
- **PIN hashiranje**: bcrypt (10 rounds) + HMAC-SHA256
- **Audit log**: Chain hash (SHA-256, nepopravljiv)
- **Multi-tenant isolation**: locationId scoping (8 tabel)
- **Idempotency**: Orders + Payments (preprečuje duplikate)
- **Optimistic locking**: updatedAt conflict detection (409)

## 📊 Metrike

- **410+** commitov
- **152** API endpointov
- **644** React komponent
- **92** Prisma modelov
- **94** tabel v bazi
- **5** jezikov (sl, en, it, hr, de)
- **144/149** E2E testov PASS (96.6%)

## 🧪 E2E Testi

| Test | Rezultat |
|------|----------|
| Chaos: DB Failure | 14/14 PASS |
| Chaos: WebSocket Disconnect | PASS |
| Chaos: FURS Server Down | 5/6 PASS |
| Financial: Trial Balance | 14/14 PASS |
| Financial: Z-Report vs Cash | 8/8 PASS |
| Financial: DDV vs FURS | 8/8 PASS |
| FURS: Storno račun | 15/15 PASS |
| Offline: 100 orders burst | 7/7 PASS |
| Offline: Sync validation | 10/10 PASS |
| Offline: Conflict resolution | 8/9 PASS |
| Multi-tenant: Isolation | 7/7 PASS |
| Multi-tenant: Shared resources | 39/40 PASS |
| Multi-tenant: Super-admin | 9/10 PASS |

## 🛠️ Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Radix UI
- **Backend:** Next.js API Routes (serverless), Prisma ORM
- **Database:** PostgreSQL (Neon)
- **Hosting:** Vercel
- **Monitoring:** Sentry (error + performance + replay)
- **PWA:** Service Worker z Background Sync
- **i18n:** next-intl (sl, en, it, hr, de)

## 📁 Struktura projekta

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # 152 API endpointov
│   ├── landing/           # Javna landing page
│   ├── privacy-policy/    # GDPR politika zasebnosti
│   ├── terms-of-service/  # Pogoji uporabe
│   ├── kds/               # Kitchen Display System
│   ├── waiter/            # Natakar interfejs
│   └── order-status/      # Sledenje naročil
├── components/            # 644 React komponent
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
| [Code Review Report](docs/CODE-REVIEW-REPORT.md) | 85 deep checks, 11 fixes, A++ security score |
| [Changelog](CHANGELOG.md) | v1.0.0 release notes — all features and fixes |
| [Contributing](CONTRIBUTING.md) | How to contribute — setup, code style, PR process |
| [Security Policy](SECURITY.md) | Vulnerability reporting, OWASP Top 10 status |
| [Code of Conduct](CODE_OF_CONDUCT.md) | Community standards |
| [Client Onboarding](docs/CLIENT-ONBOARDING-GUIDE.md) | Navodila za stranko — setup, dnevno delo, FURS |
| [Production Launch](docs/PRODUCTION-LAUNCH-CHECKLIST.md) | 4-korakni launch plan |
| [Privacy Policy](docs/PRIVACY-POLICY.md) | GDPR politika zasebnosti |
| [Terms of Service](docs/TERMS-OF-SERVICE.md) | Pogoji uporabe |

## 📜 Licenca

MIT License — prosto uporabljajte, spreminjajte in distribuirajte.

## 📞 Kontakt

- **GitHub:** https://github.com/markec12345678/restaurantos
- **Release v1.0.0:** https://github.com/markec12345678/restaurantos/releases/tag/v1.0.0
- **Email:** info@restaurantos.app
- **Security:** security@restaurantos.app
