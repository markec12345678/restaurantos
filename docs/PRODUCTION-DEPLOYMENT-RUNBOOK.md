# Production Deployment Runbook — RestaurantOS

**Datum:** September 2026
**Status:** Aktivni artifact za staging/production deployment
**Cilj:** Vodi ops ekipo skozi deployment P0-C1..C5 hardening serije na staging in production

---

## Predpogoji

Pred začetkom deploymenta preveri:

```bash
# 1. Code je na main branch
git checkout main
git pull origin main
git log --oneline -5  # zadnji commit mora biti P0-C5 (5c982d92)

# 2. Typecheck + lint + tests zeleni
npx tsc --noEmit                    # 0 errors
npx eslint src/ --max-warnings=0    # 0 errors
npx vitest run tests/unit/security/ # 49/49 pass
npx vitest run                      # 888+/896 pass (8 pre-existing failures OK)

# 3. Prisma client generiran
npx prisma generate

# 4. Schema.sql je aktualen
wc -l prisma/schema.sql  # mora biti 3400+ vrstic
```

---

## Phase 1: Staging Deployment

### 1.1 Database Setup

```bash
# Na staging serverju (8GB+ RAM):
export PGLITE_DATA_DIR=/tmp/pglite-data
export NEXTAUTH_SECRET=<your-secret>
export DATABASE_URL=""  # prazno = uporabi PGlite
export FURS_ALLOW_SIMULATION=true

# Inicializiraj bazo s fresh schema + seed
node scripts/init-e2e-db.mjs
# Pričakovan output: "✅ Končano. Baza pripravljena za E2E teste."
```

### 1.2 Start Dev Server

```bash
# Start server (background)
nohup npm run dev > /tmp/dev-server.log 2>&1 &
disown

# Wait for ready (max 60s)
for i in $(seq 1 30); do
  sleep 2
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/setup/status 2>/dev/null)
  if [ "$STATUS" = "200" ]; then
    echo "✅ Server ready"
    break
  fi
done
```

### 1.3 Smoke Test

```bash
# Test auth
curl -s -X POST http://localhost:3000/api/auth \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"test-admin","pin":"1111"}' | jq .

# Pričakovan: { success: true, token: "...", employee: {...} }
```

---

## Phase 2: E2E Testi (149/149 target)

### 2.1 Run Existing E2E (58 tests)

```bash
# Install Playwright browsers (first time only)
npx playwright install --with-deps chromium

# Run E2E
npx playwright test --project=chromium

# Pričakovan: 58/58 pass
# Če faila: preveri /tmp/dev-server.log za napake
```

### 2.2 Add New E2E Tests (91 tests toward 149)

Glej `docs/E2E-TEST-PLAN.md` za predlagane teste:
- 40 kritične poteze (order/payment/FURS/receipt)
- 20 multi-tenant isolation (P0-C1..C5 specifično)
- 25 FURS + finančna pravilnost
- 20 offline-first / outbox
- 15 performance / load
- 15 setup / admin
- 14 edge cases

### 2.3 Multi-Tenant E2E Tests (critical for P0-C1..C5)

```typescript
// tests/e2e/multi-tenant.spec.ts (predlagano)
test('IDOR: Tenant A ne more prebrati Tenant B orderja', async ({ request }) => {
  // 1. Login kot Tenant A user
  // 2. Pridobi order ID iz Tenant B
  // 3. GET /api/orders/[tenant-b-order-id]
  // 4. Pričakovan: 404 (ne 200)
})

test('FURS: Tenant A receipt se ne overi s Tenant B cert', async () => {
  // 1. Ustvari order na Tenant A
  // 2. Plačaj + verify FURS
  // 3. Preveri da receipt.taxId == Tenant A taxId (ne Tenant B)
})
```

---

## Phase 3: P0-C4 Phase 5 Migration (NOT NULL)

**Predpogoj:** E2E testi 149/149 pass.

### 3.1 Backfill NULL locationId

```bash
# Dry-run first (preveri koliko NULL records obstaja)
node scripts/p0-c4-backfill.mjs

# Pričakovan output:
# "✅ All NULL records backfilled — safe to apply NOT NULL constraint."

# Če so NULL records:
node scripts/p0-c4-backfill.mjs --apply

# Verify again (mora biti 0 remaining)
node scripts/p0-c4-backfill.mjs
```

### 3.2 Apply NOT NULL + FK Migration

```bash
# Dry-run verify
node scripts/p0-c4-apply-migration.mjs

# Pričakovan: "✅ Dry-run passed — all 24 models have 0 NULL records"

# Apply migration
node scripts/p0-c4-apply-migration.mjs --apply

# Pričakovan: "✅ Migration complete — all 24 models now have NOT NULL on locationId"
# 72 statements applied, 0 failed
```

### 3.3 Update Prisma Schema

Po uspešni migration, posodobi `prisma/schema.prisma` — spremeni `locationId String?` v `locationId String` za 24 TENANT_REQUIRED modelov:

```bash
# Modeli za posodobitev (24):
# Receipt, JournalEntry, JournalLine, Menu, Table, Shift, TimeEntry,
# CashRegisterShift, InventoryItem, DeliveryZone, OpeningHours, HaccpEntry,
# StaffShift, Reservation, PurchaseOrder, GuestFeedback, ZReport, TipPool,
# DeliveryTracking, AccountsPayable, AccountsReceivable, SustainabilityReport,
# DeviceRegistry, VideoAnalyticsSession

# Za vsak model: locationId String? → locationId String
# Potem: npx prisma generate
```

### 3.4 Verify Migration

```bash
# Typecheck
npx tsc --noEmit  # 0 errors

# Security tests
npx vitest run tests/unit/security/  # 49/49 pass

# E2E tests (ponovno)
npx playwright test --project=chromium  # 149/149 pass

# Rollback če faila:
# node scripts/p0-c4-rollback.mjs (če obstaja)
# ali manual: ALTER TABLE "Model" ALTER COLUMN "locationId" DROP NOT NULL;
```

---

## Phase 4: P0-C5 ApiKey Migration

**Predpogoj:** Phase 3 končana, E2E 149/149 pass.

### 4.1 Backfill API Keys

```bash
# Dry-run
node scripts/p0-c5-backfill-apikeys.mjs

# Pričakovan: "API keys in JSON: N" (N > 0 če obstoječi ključi)

# Apply
node scripts/p0-c5-backfill-apikeys.mjs --apply

# Pričakovan: "✅ Backfill complete — ApiKey table now contains all keys"
```

### 4.2 Verify ApiKey Migration

```bash
# Preveri da ApiKey tabela vsebuje ključe
node -e "
const { PGlite } = require('@electric-sql/pglite');
const pg = new PGlite('/tmp/pglite-data');
pg.query('SELECT count(*) FROM \"ApiKey\"').then(r => {
  console.log('ApiKey count:', r.rows[0].count);
  pg.close();
});
"

# Test verifyApiKey() z obstoječim ključem
curl -s http://localhost:3000/api/mobile/menu \
  -H "Authorization: Bearer posr_xxx" | jq .
# Pričakovan: 200 (ne 401)
```

### 4.3 Grace Period Cleanup (po 30 dneh)

```sql
-- Po 30 dneh, ko so vsi klienti migrirani na ApiKey tabelo:
ALTER TABLE "RestaurantSettings" DROP COLUMN "apiKeys";
```

---

## Phase 5: Production Deployment

**Predpogoj:** Staging E2E 149/149 pass + Phase 3 + Phase 4 končana.

### 5.1 Production Environment Variables

```bash
# .env.production
NEXTAUTH_SECRET=<long-random-string>
ENCRYPTION_KEY=<32-byte-hex-for-AES-256-GCM>
DATABASE_URL=postgresql://...@neon.tech/restaurantos?schema=public
FURS_ALLOW_SIMULATION=false  # PRODUCTION!
FURS_CERT_PATH=/path/to/production-cert.p12
FURS_CERT_PASSWORD=<encrypted-password>
FURS_ENV=production
CRON_SECRET=<random>
SENTRY_DSN=<sentry-dsn>
PGLITE_DATA_DIR=  # prazno (uporabi Neon)
```

### 5.2 FURS Production Setup

```bash
# 1. Pridobi FURS certifikat iz eDavki portal
# 2. Naloži na Location nivoju (NE RestaurantSettings):
#    POST /api/locations/[id] z fursCertPath, fursCertPassword, premisesId
# 3. Preveri status:
curl -s http://localhost:3000/api/furs/cert-status \
  -H "Authorization: Bearer <admin-token>" | jq .
# Pričakovan: certificate.status = "valid"
```

### 5.3 Stripe Production Setup

```bash
# 1. Nastavi Stripe keys v env (ne v DB)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# 2. Test payment flow na production:
# - Ustvari order
# - Plačaj s testno kartico (4242 4242 4242 4242)
# - Preveri da Payment.status = "completed"
# - Preveri da Receipt.fiscalVerified = true
```

### 5.4 Deploy to Vercel

```bash
# 1. Push to main
git push origin main

# 2. Vercel auto-deploy (CI/CD)
# 3. Preveri CI status:
#    https://github.com/markec12345678/restaurantos/actions
# 4. Vsi 4 job-i morajo biti green:
#    - quality (lint + typecheck + prisma validate)
#    - build (PostgreSQL 16 + Next.js build)
#    - security (gitleaks + bun audit)
#    - unit-tests (Vitest, 888+ tests)

# 5. Production URL: https://restaurantos.vercel.app
```

---

## Phase 6: Post-Deployment Verification

### 6.1 Health Checks

```bash
# 1. API health
curl -s https://restaurantos.vercel.app/api/health | jq .
# Pričakovan: { status: "ok", database: "connected", ... }

# 2. Setup status
curl -s https://restaurantos.vercel.app/api/setup/status | jq .
# Pričakovan: { isInitialized: true, hasEmployees: true, hasLocations: true, ... }

# 3. FURS status
curl -s https://restaurantos.vercel.app/api/furs/cert-status \
  -H "Authorization: Bearer <admin-token>" | jq .
# Pričakovan: certificate.status = "valid", fiscalization.unfiscalizedOlderThan48h = 0
```

### 6.2 Smoke Test Production

```bash
# 1. Login
TOKEN=$(curl -s -X POST https://restaurantos.vercel.app/api/auth \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"admin","pin":"<production-pin>"}' | jq -r .token)

# 2. Create order
ORDER=$(curl -s -X POST https://restaurantos.vercel.app/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"dine-in","tableId":"<table-id>","orderItems":[...]}')

# 3. Pay + verify FURS
# 4. Check receipt has ZOI + EOR
```

### 6.3 Monitor First 24h

- [ ] Sentry: 0 new errors
- [ ] Vercel: response time < 2s
- [ ] Database: 0 connection pool exhaustion
- [ ] FURS: 0 unverified receipts older than 1h
- [ ] Audit log: normal activity patterns
- [ ] Rate limiting: 0 false positives

---

## Rollback Procedure

### Če E2E testi failajo po Phase 3 (NOT NULL migration):

```bash
# 1. Rollback migration
node scripts/p0-c4-apply-migration.mjs --rollback  # (če implementirano)
# ali manual SQL:
# ALTER TABLE "Receipt" ALTER COLUMN "locationId" DROP NOT NULL;
# (ponovi za vse 24 modelov)

# 2. Revert code
git revert <phase-3-commit>
git push origin main

# 3. Re-run E2E
npx playwright test --project=chromium
```

### Če production pade po deploy:

```bash
# 1. Vercel rollback (instant)
vercel rollback <previous-deployment-url>

# 2. Preveri logs
vercel logs <deployment-url>

# 3. Fix + redeploy
git revert <bad-commit>
git push origin main
```

---

## Kontakti

- **Security issues:** security@restaurantos.app
- **Production incidents:** Slack #restaurantos-incidents
- **Deployment questions:** Slack #restaurantos-deploy

---

## Checklist (print this)

```
□ Phase 1: Staging database initialized (init-e2e-db.mjs)
□ Phase 1: Dev server running, smoke test pass
□ Phase 2: E2E 58/58 existing tests pass
□ Phase 2: E2E 149/149 target tests pass (91 new added)
□ Phase 3.1: Backfill NULL locationId (--apply)
□ Phase 3.2: Apply NOT NULL + FK migration (--apply)
□ Phase 3.3: Update schema.prisma (String? → String)
□ Phase 3.4: E2E 149/149 pass after migration
□ Phase 4.1: Backfill API keys (--apply)
□ Phase 4.2: verifyApiKey() test pass
□ Phase 5.1: Production env vars set
□ Phase 5.2: FURS production cert loaded on Location
□ Phase 5.3: Stripe production test pass
□ Phase 5.4: Deployed to Vercel, CI 4/4 green
□ Phase 6.1: Health checks pass
□ Phase 6.2: Production smoke test pass
□ Phase 6.3: 24h monitoring — no incidents
```
