# RestaurantOS — Production Operations Checklist

**Production URL:** https://restaurantos.vercel.app
**Last updated:** 2026-09-06
**Version:** v1.0.1 (A++ security, 1050 tests, CI 5/5 green)

---

## 🚀 Go-Live Checklist

### Phase 1: Initial Setup (✅ Done)

- [x] GitHub repository: https://github.com/markec12345678/restaurantos
- [x] Vercel project: `restaurantos` (auto-deploy from `main` branch)
- [x] Neon PostgreSQL: connected (DATABASE_URL configured in Vercel)
- [x] CI pipeline: 5/5 green (quality + build + security + unit-tests + e2e-security)
- [x] Security: A++ (0 HIGH, 0 MEDIUM, 2 LOW open)
- [x] Tests: 901 unit + 149 E2E = 1050 total
- [x] Release: v1.0.1 tagged on GitHub

### Phase 2: Production Configuration

#### Environment Variables (Vercel Dashboard → Settings → Environment Variables)

| Variable | Status | Required For |
|----------|:---:|-------------|
| `DATABASE_URL` | ✅ Set (Neon) | Database connection |
| `NEXTAUTH_SECRET` | ✅ Set | Session signing |
| `ENCRYPTION_KEY` | ✅ Set | AES-256-GCM secrets encryption |
| `ENCRYPTION_KEY_VERSION` | ✅ Set | Key rotation |
| `FURS_ALLOW_SIMULATION` | ✅ Set (`true`) | FURS test mode |
| `FURS_ENV` | ✅ Set (`test`) | FURS environment |
| `NEXT_PUBLIC_APP_URL` | ✅ Set | App URL |
| `NEXT_PUBLIC_SENTRY_DSN` | ✅ Set | Client error tracking |
| `SENTRY_ENVIRONMENT` | ✅ Set | Sentry env tag |
| `REDIS_URL` | ⚠️ Missing | Multi-replica rate limiting (CRITICAL for production) |
| `SENTRY_DSN` | ⚠️ Missing | Server error tracking |
| `SENTRY_AUTH_TOKEN` | ⚠️ Missing | Sentry source maps |
| `STRIPE_SECRET_KEY` | ⚠️ Missing | Payment processing |
| `STRIPE_WEBHOOK_SECRET` | ⚠️ Missing | Stripe webhook verification |
| `CRON_SECRET` | ⚠️ Missing | Vercel Cron authentication |
| `RECEIPT_TOKEN_SECRET` | ⚠️ Missing | Digital receipt tokens |
| `VAPID_PUBLIC_KEY` | ⚠️ Missing | Push notifications |
| `VAPID_PRIVATE_KEY` | ⚠️ Missing | Push notifications |

#### FURS Configuration

```bash
# 1. Pridobi FURS certifikat na eDavki portal (https://edavki.durs.si)
# 2. Naloži .p12 certifikat (potreben: FURS_CERT_PATH in FURS_CERT_PASSWORD)
# 3. Nastavi na Location nivoju (NE RestaurantSettings):
#    POST /api/locations/{id} z:
#    {
#      "fursCertPath": "/certs/production.p12",
#      "fursCertPassword": "encrypted-password",
#      "premisesId": "XXX",
#      "fursEnvironment": "production"
#    }
# 4. Preklopi FURS_ALLOW_SIMULATION na false
# 5. Preklopi FURS_ENV na production
```

#### Stripe Configuration

```bash
# 1. Kreiraj Stripe account (https://dashboard.stripe.com)
# 2. Pridobi production keys:
#    - STRIPE_SECRET_KEY (sk_live_...)
#    - STRIPE_WEBHOOK_SECRET (whsec_...)
# 3. Nastavi v Vercel env vars
# 4. Test plačilo:
#    curl -X POST -H "Authorization: Bearer $TOKEN" \
#      "$URL/api/payments" -d '{"orderId":"...","amount":10,"type":"card"}'
```

### Phase 3: Database Migration

```bash
# 1. Login z admin PIN na POS UI → pridobi token
TOKEN="your-admin-token"

# 2. Dry-run migration (preveri kaj se bo spremenilo)
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  "https://restaurantos.vercel.app/api/admin/migrate"

# 3. Apply migration (zaženi 3 pakete)
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  "https://restaurantos.vercel.app/api/admin/migrate?apply=true"

# Pričakovan odgovor:
# {
#   "mode": "APPLIED",
#   "results": [
#     {"phase": "P0-C4 Backfill", "status": "applied", ...},
#     {"phase": "P0-C4 NOT NULL + FK", "status": "applied", ...},
#     {"phase": "P0-C5 ApiKey backfill", "status": "applied/skipped", ...},
#     {"phase": "Issue #32 Subscription", "status": "applied", ...}
#   ]
# }
```

### Phase 4: Data Seeding

```bash
# Preko POS UI (admin login):
# 1. Setup → Settings → konfiguriraj restavracijo
# 2. Menu → dodaj kategorije (Hrana, Pijača, etc.)
# 3. Menu → dodaj artikle (cena, DDV, slika)
# 4. Tables → dodaj mize (številka, kapaciteta, cona)
# 5. Staff → dodaj zaposlene (ime, PIN, vloga, dovoljenja)
# 6. ali pa zaženi seed: POST /api/seed (admin only)
```

### Phase 5: Monitoring Setup

- [ ] **Sentry** — nastavi SENTRY_DSN v Vercel env
- [ ] **UptimeRobot** — monitor na `https://restaurantos.vercel.app/api/health` (vsakih 5 min)
- [ ] **Vercel Analytics** — omogoči v Vercel dashboard
- [ ] **GitHub Branch Protection** — `main` zahteva 3 status checks (CI green)
- [ ] **Log monitoring** — Sentry error alerts na email/Slack

### Phase 6: Smoke Test (Go-Live)

```bash
# 1. Health check
curl https://restaurantos.vercel.app/api/health
# Pričakovano: {"status":"ok","database":"connected"}

# 2. Login
curl -X POST https://restaurantos.vercel.app/api/auth \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"admin-id","pin":"real-pin"}'
# Pričakovano: {"success":true,"token":"..."}

# 3. Create order
curl -X POST https://restaurantos.vercel.app/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"dine-in","tableId":"table-1","orderItems":[...]}'

# 4. Payment + FURS
# (preko POS UI — klikni "Plačaj" in preveri da se račun ustvari z ZOI)

# 5. Verify receipt
curl https://restaurantos.vercel.app/api/receipts/$ORDER_ID \
  -H "Authorization: Bearer $TOKEN"
# Pričakovano: receipt z zoi in eor polji
```

### Phase 7: First 24h Monitoring

- [ ] Sentry: 0 new errors
- [ ] Vercel: response time < 3s
- [ ] Neon: connection pool not exhausted
- [ ] FURS: 0 unverified receipts older than 1h
- [ ] Audit log: normal activity patterns
- [ ] Rate limiting: 0 false positives
- [ ] Database: backup confirmed (Neon automatic)

---

## 📞 Incident Response

### SEV-1 (Production Down)
1. Vercel rollback: `vercel rollback <previous-deployment-url>`
2. Check `/api/health` for DB status
3. Check Neon dashboard for DB issues
4. Contact: #restaurantos-incidents (Slack)

### SEV-2 (Feature Broken)
1. Check Sentry for error stack traces
2. Check Vercel function logs
3. Fix on `main` branch → push → auto-deploy
4. Verify fix with smoke test

### SEV-3 (Minor Issue)
1. Create GitHub issue
2. Fix in next deployment cycle

---

## 🔄 Regular Operations

### Daily
- Check Sentry for errors
- Check FURS unverified receipts (`GET /api/furs/cert-status`)
- Check Z-Report for previous day

### Weekly
- Review audit logs for suspicious activity
- Check database size (Neon dashboard)
- Review rate limiting metrics

### Monthly
- Rotate ENCRYPTION_KEY (key rotation procedure)
- Review employee access (deactivate terminated)
- Update dependencies (`bun audit`)
- Review security advisories

---

## 📊 Key Metrics

| Metric | Target | Check |
|--------|:---:|-------|
| Uptime | 99.9% | UptimeRobot |
| Response time | < 3s | Vercel Analytics |
| Error rate | < 0.1% | Sentry |
| FURS unverified | 0 (>1h old) | `/api/furs/cert-status` |
| DB connections | < 5 concurrent | Neon dashboard |
| CI pass rate | 100% | GitHub Actions |

---

*Last updated: 2026-09-06*
*Maintained by: RestaurantOS ops team*
