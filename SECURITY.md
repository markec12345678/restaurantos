# Security Policy

## 🛡️ Supported Versions

| Version | Supported |
|---------|-----------|
| v1.0.x  | ✅ Active |
| < v1.0  | ❌ EOL    |

## 🔒 Security Score: A+

RestaurantOS v1.0.0 je pregledan z 85+ globokimi preverjanji + P0-C1..C5 hardening serijo (11 commitov, September 2026).

**Realna ocena: A+** — 0 HIGH odprtih težav. Vse kritične varnostne ranljivosti (IDOR, ?locationId bypass, FURS cross-tenant, API key cross-tenant) so zaprte.

Glej [Known Issues](docs/KNOWN_ISSUES.md) za celoten pregled in [P0-C4 Classification](docs/P0-C4-CLASSIFICATION.md) za tenant scope klasifikacijo.

### P0 Hardening Series (September 2026)

| Faza | Kaj | Testi |
|------|-----|:---:|
| P0-C1 | IDOR cross-tenant (8 poti) | 16 |
| P0-C2 | resolveTenantLocationId() helper (22 endpointov) | 21 |
| P0-C3A | FURS/receipts → Location source (13 call-sites) | 12 |
| P0-C3B | Remaining settings call-sites (9 files) | — |
| P0-C4 P1-4 | Classification + ApiKey + Location fields + Webhook.locationId | — |
| P0-C4 P5 | NOT NULL migration package (24 modelov) | — |
| P0-C5 | ApiKey table migration (subscriptionId) | — |

**Skupno:** 49 security testov, 888 unit testov, 0 typecheck errors, 0 lint errors.

### Security Measures

- **CSP** z nonce injection (XSS prevention)
- **HSTS** z preload (HTTPS enforcement)
- **Rate limiting**: Auth (5/15min), API (60/min), AI (10/min), SMS (60/min), Public (20/min) — FAIL-CLOSED
- **PIN hashiranje**: bcrypt (10 rounds) + HMAC-SHA256 pinLookup
- **Session**: triple-check (verifyToken + isEmployeeActive + direct DB), fail-closed
- **Audit log**: SHA-256 chain hash (nepopravljiv) + verify endpoint
- **Multi-tenant isolation**:
  - `resolveTenantLocationId()` helper — fail-closed za regular user brez locationId
  - 24 TENANT_REQUIRED modelov z NOT NULL constraint (P0-C4 Phase 5)
  - IDOR protection: `findFirst({where:{id, locationId}})` za vse user-controlled ID-je
  - FURS config per-receipt (ne globalni singleton)
  - API keys z `subscriptionId` FK (ApiKey tabela, ne RestaurantSettings JSON)
- **Secrets encryption**: AES-256-GCM (`enc:v1:{IV}:{authTag}:{ciphertext}` format)
- **Idempotency**: Orders + Payments (idempotencyKey @unique)
- **Optimistic locking**: expectedUpdatedAt → 409 Conflict
- **SSRF protection**: 8 IP range checks
- **Webhook signatures**: HMAC-SHA256 (Glovo/Wolt/Bolt) + per-location filter
- **Content-Type validation**: 415 on non-JSON
- **Body size limit**: 1MB
- **Zod input validation**: all endpoints
- **String sanitization**: XSS prevention
- **Docker**: multi-stage, non-root (USER nextjs)
- **CI/CD**: gitleaks secret scanning + dependabot + unit-tests job

### OWASP Top 10 Status

| # | Vulnerability | Status |
|---|--------------|--------|
| A01 | Broken Access Control | ✅ RBAC + locationId + IDOR protection (P0-C1) + tenant scope helper (P0-C2) |
| A02 | Cryptographic Failures | ✅ bcrypt + HMAC-SHA256 + AES-256-GCM secrets encryption |
| A03 | Injection | ✅ Prisma ORM (parameterized) |
| A04 | Insecure Design | ✅ Fail-closed patterns + structured tenant scope result |
| A05 | Security Misconfiguration | ✅ CSP nonce, HSTS, CORS whitelist |
| A06 | Vulnerable Components | ✅ Dependabot + 4 unused removed |
| A07 | Auth Failures | ✅ Rate limit (FAIL-CLOSED) + triple-check + API key subscriptionId |
| A08 | Data Integrity Failures | ✅ SHA-256 chain hash + FURS per-receipt config |
| A09 | Logging Failures | ✅ Audit log + Sentry + webhook delivery logging |
| A10 | SSRF | ✅ 8 IP range checks + webhook URL validation |

## 🐛 Reporting a Vulnerability

### Critical Vulnerabilities
**NE odpri GitHub issue za critical ranljivosti!**

Pošlji email na: **security@restaurantos.app**

Vključi:
1. Opis ranljivosti
2. Koraki za reprodukcijo
3. Possible impact
4. Suggested fix (če imaš)

Odgovorili bomo v **48 urah**.

### Non-Critical Issues
Uporabi GitHub Issue Template: [🔒 Security Report](https://github.com/markec12345678/restaurantos/issues/new?template=security_report.yml)

## 🏆 Bug Bounty

Trenutno ne ponujamo bug bounty programa. Prispevali bomo v `CONTRIBUTORS.md`.

## 📋 Security Checklist (for deployments)

- [ ] NEXTAUTH_SECRET nastavljen (long random string)
- [ ] ENCRYPTION_KEY nastavljen (za secrets encryption — AES-256-GCM)
- [ ] FURS_ALLOW_SIMULATION=false v produkciji
- [ ] CRON_SECRET nastavljen
- [ ] SENTRY_DSN nastavljen
- [ ] DATABASE_URL iz Neon (ne localhost)
- [ ] Vercel Bot Protection omogočen
- [ ] UptimeRobot monitor na /api/health
- [ ] GitHub PAT in Vercel token preklicana (če sta bila uporabljena v komunikaciji)
- [ ] P0-C4 Phase 5 migration aplikacija (po E2E potrditvi)
- [ ] P0-C5 ApiKey backfill aplikacija (po E2E potrditvi)
- [ ] FURS certifikat naložen na Location nivoju (ne RestaurantSettings)

## 🔐 Responsible Disclosure

Cenimo odgovorno razkritje. Po objavi popravka bomo priznali prispevale (če želijo).

---

*Last updated: 2026-09-05*
*Security review: 85+ checks + P0-C1..C5 hardening series (11 commits), A+ score*
*Active artifacts: [P0-C4 Classification](docs/P0-C4-CLASSIFICATION.md), [E2E Test Plan](docs/E2E-TEST-PLAN.md), [Known Issues](docs/KNOWN_ISSUES.md)*
