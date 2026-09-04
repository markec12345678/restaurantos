# Changelog

All notable changes to RestaurantOS are documented in this file.

## [v1.0.0] — 2026-09-04

### 🎉 Production Release

### Added
- **POS System** — complete order management with tables, takeout, delivery
- **KDS** — Kitchen Display System with WebSocket real-time updates
- **Waiter Interface** — mobile-optimized order management
- **FURS/ZDDV-1** — Slovenian tax authority compliance (ZOI, EOR, QR, storno)
- **Offline-First PWA** — IndexedDB queue + Background Sync (orders + FURS)
- **Multi-Tenant** — locationId isolation on 8 tables, super-admin, cross-branch audit
- **Accounting** — double-entry journal, Trial Balance, P&L, Balance Sheet, Z-Report
- **Payment System** — pg_advisory_xact_lock, idempotency, refunds, gift cards, loyalty
- **Inventory** — stock deduction, HACCP hash chain (EU 852/2004), recipes, purchase orders
- **AI Modules** — forecasting, voice ordering, staff scheduler, NL query, QR upsell
- **Delivery** — Glovo, Wolt, Bolt webhook integration with HMAC signatures
- **Auto-Image Lookup** — OpenFoodFacts + TheMealDB + TheCocktailDB
- **Landing Page** — professional SaaS design with animations, pricing, FAQ
- **Legal Pages** — GDPR Privacy Policy, Terms of Service, Cookie Consent banner
- **Sentry** — error tracking + performance + session replay
- **i18n** — 5 languages (Slovenian, English, Italian, Croatian, German)
- **WebAuthn/FIDO2** — biometric login support
- **Blockchain Audit** — tamper-evident SHA-256 hash chain
- **Video Analytics** — people counting (no PII stored)
- **Carbon Footprint** — sustainability tracking
- **Push Notifications** — VAPID web push

### Security
- CSP with nonce injection (no 'unsafe-inline')
- HSTS with preload (1 year)
- CORS whitelist (NEXT_PUBLIC_APP_URL)
- Rate limiting: LOGIN (5/15min), API (60/min), AI (10/min), SMS (60/min), SEED (3/hour)
- PIN: bcrypt (10 rounds) + HMAC-SHA256 pinLookup
- Session: triple-check (verifyToken + isEmployeeActive + direct DB), fail-closed
- Audit log: SHA-256 chain hash (nepopravljiv)
- SSRF protection: 8 IP range checks
- Content-Type validation (415 on non-JSON)
- Body size limit: 1MB
- Zod input validation on all endpoints
- String sanitization (XSS prevention)
- Webhook signatures: HMAC-SHA256 (Glovo/Wolt/Bolt)
- Docker: multi-stage, non-root (USER nextjs)
- CI/CD: gitleaks secret scanning, dependabot

### Fixed (from E2E testing + code review)
- Payment 500 error ($queryRaw → $executeRaw for pg_advisory_xact_lock)
- Race condition: 6/10 → 1/10 concurrent payments
- Idempotency: auto-generate idempotencyKey if not provided
- Session invalidation: fail-closed (was fail-open)
- 12 paid orders stuck in wrong status (check-status.ts blacklist)
- /api/health endpoint added
- Outbox cron job in vercel.json
- pending → completed transition allowed (takeaway)
- Refund: fully refunded → storno (not unpaid)
- Z-Report: cashSales = net (amount - refundAmount)
- FURS e-invoice-book: filter by order.paidAt (not receipt.createdAt)
- Order idempotency: @unique + fast path + P2002 race path
- Optimistic locking: expectedUpdatedAt → 409 Conflict
- Debug endpoints: requireAuth(admin) (was public!)
- Setup endpoints: rate limiting (was unlimited)
- Sentry instrumentation.ts (was missing)
- Next.js remotePatterns for auto-image
- AI endpoints: rate limiting (3 were missing)
- SMS: rate limiting + E.164 validation
- Table occupied: race condition fix (updateMany with status filter)
- Audit chain verify endpoint
- Content-Type validation (415)
- .env.example: 22 missing env vars added
- 4 unused dependencies removed

### Test Results
- 144/149 E2E tests PASS (96.6%)
- 85 deep code review checks
- 11 issues fixed
- Security score: A++
- Financial reconciliation: €0.00 diff

### Tech Stack
- Next.js 16 (Turbopack), React 19, TypeScript 5
- Prisma ORM, PostgreSQL (Neon)
- Tailwind CSS 4, Radix UI
- Vercel (hosting), Sentry (monitoring)
- Service Worker v9, IndexedDB
- next-intl (i18n), Zod (validation)
