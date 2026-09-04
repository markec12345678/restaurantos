# RestaurantOS — Architecture

**Version:** v1.0.0  
**Updated:** 2026-09-04

---

## 🏗️ System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    RestaurantOS v1.0.0                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │  POS App │  │   KDS    │  │  Waiter  │  │ Landing │ │
│  │  (Tablet)│  │ (Kitchen)│  │ (Mobile) │  │ (Public)│ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬────┘ │
│       │              │              │              │      │
│       └──────────────┴──────────────┴──────────────┘      │
│                          │                               │
│                   ┌──────┴──────┐                        │
│                   │  Middleware  │                        │
│                   │  (Security)  │                        │
│                   └──────┬──────┘                        │
│                          │                               │
│  ┌───────────────────────┴───────────────────────┐       │
│  │            Next.js API Routes (211)            │       │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐│       │
│  │  │Orders│ │Payments│ │ FURS │ │Invntry│ │Acctng││       │
│  │  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘│       │
│  └───────────────────────┬───────────────────────┘       │
│                          │                               │
│  ┌───────────────────────┴───────────────────────┐       │
│  │              Business Logic (lib/)             │       │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐         │       │
│  │  │Auth MW  │ │  FURS   │ │Offline  │         │       │
│  │  │Triple   │ │ZDDV-1   │ │IndexedDB│         │       │
│  │  │Check    │ │Storno   │ │BgSync   │         │       │
│  │  └─────────┘ └─────────┘ └─────────┘         │       │
│  └───────────────────────┬───────────────────────┘       │
│                          │                               │
│  ┌───────────────────────┴───────────────────────┐       │
│  │            Prisma ORM (92 models)              │       │
│  └───────────────────────┬───────────────────────┘       │
│                          │                               │
│  ┌───────────────────────┴───────────────────────┐       │
│  │         Neon PostgreSQL (94 tables)            │       │
│  │         Connection pool: PgBouncer             │       │
│  └───────────────────────────────────────────────┘       │
│                                                          │
└─────────────────────────────────────────────────────────┘
         │                    │                    │
    ┌────┴────┐         ┌────┴────┐         ┌────┴────┐
    │ Vercel  │         │  Neon   │         │ Sentry  │
    │ Hosting │         │  DB     │         │Monitor  │
    │ (EU)    │         │ (EU)    │         │ (EU)    │
    └─────────┘         └─────────┘         └─────────┘
```

---

## 📦 Core Modules (src/lib/)

| Module | Purpose | Key Features |
|--------|---------|-------------|
| `auth-middleware/` | PIN authentication | Triple-check, fail-closed, 8h+24h TTL, RBAC |
| `furs/` | FURS/ZDDV-1 compliance | ZOI, EOR, QR, storno, offline queue |
| `offline-orders/` | Offline order queue | IndexedDB, Background Sync, idempotencyKey |
| `offline-furs/` | Offline FURS queue | IndexedDB, 48h TTL, 5 retries |
| `accounting/` | Double-entry bookkeeping | Journal entries, Trial Balance, P&L |
| `decimal/` | Financial arithmetic | Prisma.Decimal, ROUND_HALF_UP, /0 throw |
| `rate-limit/` | API rate limiting | Memory + Redis adapter, per-endpoint config |
| `websocket-client/` | Real-time KDS/Waiter | Exponential backoff, heartbeat, AUTH message |
| `blockchain-audit/` | Tamper-evident audit | SHA-256 chain hash, mining |
| `stock-deduction/` | Inventory management | Atomic decrement, recipe-based, transactional |
| `outbox/` | Transactional outbox | At-least-once delivery, exponential backoff |
| `webhook-engine/` | Webhook delivery | HMAC signatures, SSRF protection, retries |
| `push/` | Web Push notifications | VAPID, subscription management |
| `forecast/` | AI demand forecasting | Linear regression, moving average, ensemble |
| `fraud-detection/` | Fraud prevention | Pattern matching, velocity checks |
| `loyalty-automation/` | Loyalty campaigns | Birthday, win-back, tier upgrade SMS |
| `i18n/` | Internationalization | 5 languages (sl, en, it, hr, de) |

---

## 🔒 Security Architecture

```
Request Flow:
┌─────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌─────────┐
│ Client  │────▶│ Vercel   │────▶│Middleware│────▶│API Route │────▶│ Prisma  │
│         │     │ (HTTPS)  │     │          │     │ Handler  │     │  (DB)   │
└─────────┘     └──────────┘     └──────────┘     └──────────┘     └─────────┘
                     │                │                │
                HSTS preload    CSP nonce       requireAuth()
                TLS 1.3         CORS whitelist   + isEmployeeActive()
                Bot Protection  Rate limiting    + hasPermission()
                                SSRF filter      + locationId scope
```

### Security Layers

1. **Infrastructure:** Vercel HTTPS, HSTS, TLS 1.3, Bot Protection
2. **Middleware:** CSP nonce, CORS whitelist, rate limiting, body size limit (1MB)
3. **Auth:** Bearer token, triple-check (verifyToken + isEmployeeActive + direct DB)
4. **Auth:** Fail-closed (DB error → 500, not 200)
5. **RBAC:** 8 permissions, admin bypass, .some() OR logic
6. **Multi-tenant:** locationId scoping on 8 tables
7. **Audit:** SHA-256 chain hash (nepopravljiv), CROSS_BRANCH_ACCESS logging
8. **Input:** Zod validation, string sanitization, Content-Type check (415)
9. **Financial:** pg_advisory_xact_lock, idempotencyKey, optimistic locking
10. **SSRF:** 8 IP range checks (localhost, RFC1918, IPv6, link-local)

---

## 🗄️ Database Schema (94 tables, 92 models)

### Core Tables
- **Order** — naročila (idempotencyKey @unique, locationId)
- **OrderItem** — postavke naročila (vatRate, quantity max 99)
- **Check** — čeki (paymentStatus, @@unique([orderId, checkNumber]))
- **Payment** — plačila (idempotencyKey @unique, refundAmount)
- **Receipt** — računi (zoi, eor, fiscalStatus, locationId)
- **MenuItem** — artikli (price, vatRate, allergens, image)
- **Table** — mize (number, capacity, status, locationId)
- **Employee** — zaposleni (pin bcrypt, pinLookup HMAC, locationId)

### Financial Tables
- **JournalEntry** — knjigovodski vnosi (entryNumber, source, status)
- **JournalLine** — postavke (debit, credit, accountCode)
- **ChartOfAccount** — kontni načrt (code, type, parent)
- **CashRegisterShift** — izmene (startingCash, closingCash, expectedCash)
- **ZReport** — dnevna poročila

### Compliance Tables
- **AuditLog** — revizijski dnevnik (chainHash, previousHash — SHA-256)
- **HaccpEntry** — HACCP (chainHash — EU 852/2004)
- **OutboxEvent** — transactional outbox (status, attempts, idempotencyKey)

### Delete Policies
- **Cascade (30):** Order→OrderItems, Menu→Categories, etc.
- **Restrict (13):** Payment→Check, JournalLine→JournalEntry, etc.
- **SetNull (65):** Optional relations (locationId, employeeId, etc.)

---

## 🔄 Key Flows

### Order Creation Flow
```
Client → POST /api/orders (idempotencyKey)
  → requireAuth (triple-check)
  → validateRequest (Zod + sanitize + 1MB limit)
  → findExistingOrderByIdempotencyKey (fast path)
  → getNextCounter (atomic upsert)
  → db.$transaction:
      → tx.order.create (idempotencyKey, locationId)
      → tx.table.updateMany (status: 'occupied')
      → tx.orderItem.create (vatRate from DB)
  → handleStockDeduction (inventoryDeducted flag)
  → handlePostCreationEffects (webhooks, audit)
  → return 201
```

### Payment Flow
```
Client → POST /api/payments (idempotencyKey)
  → requireAuth (manage_cash)
  → findExistingPaymentByIdempotencyKey (fast path)
  → db.$transaction (Serializable, 8s timeout):
      → tx.$executeRaw pg_advisory_xact_lock(hashtext(checkId))
      → tx.check.findUnique (paymentStatus, total)
      → if paid → ALREADY_PAID (409)
      → tx.payment.aggregate (paidSoFar)
      → if overpay → OVERPAYMENT (400)
      → tx.payment.create (idempotencyKey)
      → updateCheckAndOrderStatus (paid → completed)
  → postPaymentProcessing (audit, webhooks)
  → generateJournalForPayment (non-blocking)
  → return 201
```

### Offline Sync Flow
```
1. Client offline → enqueueOrder (IndexedDB)
2. registerOrderBackgroundSync (SW tag: 'offline-order-sync')
3. Online → SW 'sync' event → syncPendingOrders
4. POST /api/orders (idempotencyKey)
5. Server: fast path dedup OR P2002 race path
6. Success → dequeueOrder (remove from IndexedDB)
7. Failure → markOrderFailed (retry, max 5)
```

---

## 🚀 Deployment

```
GitHub (main push)
  → Vercel auto-deploy (Production)
  → CI: Lint + Typecheck + Security Audit + Gitleaks
  → Build: Turbopack (Next.js 16)
  → Deploy: EU (Frankfurt)
  → Post-install: prisma generate
  → Runtime: Neon PostgreSQL (PgBouncer)
  → Monitoring: Sentry (error + perf + replay)
```

---

## 📊 Scale

| Metric | Value |
|--------|-------|
| API routes | 211 |
| React components | 659 |
| Prisma models | 92 |
| DB tables | 94 |
| i18n languages | 5 |
| Dependencies | 99 |
| Test coverage | 144/149 E2E (96.6%) |
| Code review | 85 checks (A++) |
| Lines of code | 63,389 |
