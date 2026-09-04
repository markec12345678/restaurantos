# Security Policy

## 🛡️ Supported Versions

| Version | Supported |
|---------|-----------|
| v1.0.x  | ✅ Active |
| < v1.0  | ❌ EOL    |

## 🔒 Security Score: A-

RestaurantOS v1.0.0 je pregledan z 85 globokimi preverjanji.  
**Realna ocena: A-** — 3 HIGH odprte težave (rate-limit fail-open, subscriptionId nullable, plaintext secrets).  
Glej [Known Issues](docs/KNOWN_ISSUES.md) za celoten pregled in načrt reševanja.

### Security Measures

- **CSP** z nonce injection (XSS prevention)
- **HSTS** z preload (HTTPS enforcement)
- **Rate limiting**: Auth (5/15min), API (60/min), AI (10/min), SMS (60/min), Public (20/min)
- **PIN hashiranje**: bcrypt (10 rounds) + HMAC-SHA256 pinLookup
- **Session**: triple-check (verifyToken + isEmployeeActive + direct DB), fail-closed
- **Audit log**: SHA-256 chain hash (nepopravljiv) + verify endpoint
- **Multi-tenant isolation**: locationId scoping na 30+ modelih (glej [Known Issues](docs/KNOWN_ISSUES.md) za seznam)
- **Idempotency**: Orders + Payments (idempotencyKey @unique)
- **Optimistic locking**: expectedUpdatedAt → 409 Conflict
- **SSRF protection**: 8 IP range checks
- **Webhook signatures**: HMAC-SHA256 (Glovo/Wolt/Bolt)
- **Content-Type validation**: 415 on non-JSON
- **Body size limit**: 1MB
- **Zod input validation**: all endpoints
- **String sanitization**: XSS prevention
- **Docker**: multi-stage, non-root (USER nextjs)
- **CI/CD**: gitleaks secret scanning + dependabot

### OWASP Top 10 Status

| # | Vulnerability | Status |
|---|--------------|--------|
| A01 | Broken Access Control | ✅ RBAC + locationId |
| A02 | Cryptographic Failures | ✅ bcrypt + HMAC-SHA256 |
| A03 | Injection | ✅ Prisma ORM (parameterized) |
| A04 | Insecure Design | ✅ Fail-closed patterns |
| A05 | Security Misconfiguration | ✅ CSP, HSTS, CORS whitelist |
| A06 | Vulnerable Components | ✅ Dependabot + 4 unused removed |
| A07 | Auth Failures | ✅ Rate limit + triple-check |
| A08 | Data Integrity Failures | ✅ SHA-256 chain hash |
| A09 | Logging Failures | ✅ Audit log + Sentry |
| A10 | SSRF | ✅ 8 IP range checks |

## 🐛 Reporting a Vulnerness

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
- [ ] FURS_ALLOW_SIMULATION=false v produkciji
- [ ] CRON_SECRET nastavljen
- [ ] SENTRY_DSN nastavljen
- [ ] DATABASE_URL iz Neon (ne localhost)
- [ ] Vercel Bot Protection omogočen
- [ ] UptimeRobot monitor na /api/health
- [ ] GitHub PAT in Vercel token preklicana (če sta bila uporabljena v komunikaciji)

## 🔐 Responsible Disclosure

Cenimo odgovorno razkritje. Po objavi popravka bomo priznali prispevale (če želijo).

---

*Last updated: 2026-09-05*  
*Security review: 85 checks, A- score — current review (see [Known Issues](docs/KNOWN_ISSUES.md))*
