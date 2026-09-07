# Demo Environment Deployment Guide

**Goal:** Deploy demo.restaurantos.app with pre-seeded data for sales demos

---

## Architecture

```
demo.restaurantos.app (Vercel)
        ↓
    Neon PostgreSQL (separate demo database)
        ↓
    Pre-seeded via scripts/seed-demo.mjs
```

---

## Step 1: Create Demo Database on Neon

1. Log into Neon dashboard: https://console.neon.tech
2. Create new project: `restaurantos-demo`
3. Select region: `eu-central-1` (Frankfurt — closest to Slovenia)
4. Copy connection string: `postgresql://user:pass@host/db?sslmode=require`

---

## Step 2: Deploy to Vercel (Preview/Demo Environment)

### Option A: Separate Vercel Project (recommended)

1. Go to https://vercel.com/new
2. Import `markec12345678/restaurantos` from GitHub
3. Project name: `restaurantos-demo`
4. Framework preset: Next.js
5. Environment variables:

```
DATABASE_URL=postgresql://...@demo-neon.neon.tech/demo?sslmode=require
NEXTAUTH_SECRET=<generate-new-secret>
NEXT_PUBLIC_APP_URL=https://demo.restaurantos.app
NODE_ENV=production
FURS_ENVIRONMENT=test
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
SENTRY_DSN=<optional>
```

6. Deploy
7. Add custom domain: `demo.restaurantos.app` (in Vercel → Settings → Domains)

### Option B: Vercel Preview Deployment (branch-based)

1. Create branch: `git checkout -b demo`
2. Push: `git push origin demo`
3. Vercel auto-deploys preview at `restaurantos-git-demo-...vercel.app`
4. Use this URL for demos

---

## Step 3: Run Migration + Seed

### Option A: Via /api/admin/migrate (recommended)

```bash
# After deployment is READY:
curl -X POST https://demo.restaurantos.app/api/setup/init \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "single",
    "adminName": "Demo Admin",
    "adminEmail": "admin@demo.restaurantos.app",
    "adminPin": "1234",
    "locationName": "Demo Restaurant",
    "locationCode": "DEMO01",
    "restaurantName": "RestaurantOS Demo"
  }'

# Then run migration packages:
curl -X POST "https://demo.restaurantos.app/api/admin/migrate?apply=true" \
  -H "Authorization: Bearer <admin-token>"
```

### Option B: Via seed-demo.mjs script

```bash
# Set DEMO_URL to your deployed instance
export DEMO_URL=https://demo.restaurantos.app

# Run seed script
node scripts/seed-demo.mjs

# Expected output:
# 1️⃣  Authenticating as admin...
# 2️⃣  Creating demo employees...
# 3️⃣  Creating demo tables...
# 4️⃣  Creating demo menu items...
# 5️⃣  Creating demo inventory items...
# ✅ Demo seed completed!
```

---

## Step 4: Configure Demo Features

### Stripe Test Mode
```env
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```
- Use test cards: `4242 4242 4242 4242` (Visa), `5555 5555 5555 4444` (Mastercard)
- No real charges — safe for demos

### FURS Test Mode
```env
FURS_ENVIRONMENT=test
# No certificate needed in test mode
# FURS returns test ZOI/EOR values
```

### Auto-Reset (cron job)
```bash
# Add to Vercel cron (vercel.json):
{
  "crons": [
    {
      "path": "/api/cron/reset-demo",
      "schedule": "0 3 * * *"  # Daily at 3 AM CET
    }
  ]
}
```

Create `/api/cron/reset-demo/route.ts`:
- Deletes all orders, payments, reservations from last 24h
- Re-seeds if needed
- Keeps employees, tables, menu items (permanent demo data)

---

## Step 5: Verify Demo Environment

### Checklist:
- [ ] `demo.restaurantos.app` resolves to Vercel
- [ ] Login with PIN `1234` works (admin)
- [ ] Login with PIN `2345` works (manager)
- [ ] Login with PIN `3456` works (waiter)
- [ ] Login with PIN `4567` works (cook)
- [ ] 15 tables visible in POS
- [ ] 20 menu items visible in menu
- [ ] Create test order → appears in KDS
- [ ] Process test payment → FURS test ZOI/EOR generated
- [ ] QR menu accessible at `/qr/table-1`
- [ ] Online ordering at `/order` works
- [ ] Stripe test payment completes
- [ ] Reports page shows demo data
- [ ] Auto-reset cron configured

---

## Demo Flow for Sales Calls

### 5-minute demo script:
1. **Login** (30s): Show PIN login — "Brez gesel, samo PIN"
2. **POS** (1 min): Create order at Table 5 — pizza + coke
3. **KDS** (1 min): Switch to cook view, mark items as preparing → ready
4. **Payment** (1 min): Split check, card payment with tip
5. **Reports** (1 min): Show EOD report with VAT breakdown
6. **QR ordering** (30s): Scan QR code, guest orders from phone

### Key talking points:
- "FURS compliant — ZOI/EOR avtomatsko"
- "Offline deluje — Service Worker"
- "Multi-tenant — več lokacij, en login"
- "5 jezikov — za turistične kraje"
- "Open source (AGPL) ali commercial license"

---

## Maintenance

### Weekly:
- Check demo database size (Neon free tier: 3GB limit)
- Verify auto-reset cron is running
- Update demo menu items if needed

### Monthly:
- Rotate DEMO database credentials
- Update Stripe test keys if expired
- Review demo analytics (Vercel Analytics)

### Quarterly:
- Refresh demo data (re-run seed-demo.mjs)
- Update video tutorials if features changed
- Collect demo feedback from sales team

---

## Troubleshooting

### Demo login fails
```bash
# Check if database is seeded
curl https://demo.restaurantos.app/api/health
# Should return: {"status":"ok","database":"connected"}

# Re-seed if needed
node scripts/seed-demo.mjs
```

### Stripe webhook fails
- Verify `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
- Check webhook endpoint: `https://demo.restaurantos.app/api/wallet-payment/webhook`
- Test with: `stripe trigger payment_intent.succeeded`

### FURS test mode errors
- `FURS_ENVIRONMENT` must be `test` (not `production`)
- Test mode doesn't require certificate
- If certificate errors appear, check that `FURS_ENVIRONMENT=test`

---

## Cost Estimate

### Neon (demo database):
- Free tier: 3GB storage, 100 compute hours/month
- Estimated: €0/month (demo data < 100MB)

### Vercel (demo hosting):
- Hobby plan: Free
- Estimated: €0/month

### Domain (demo.restaurantos.app):
- Already owned (restaurantos.app)
- Subdomain: Free

### Stripe (test mode):
- Test mode: Free
- No real charges

### **Total demo cost: €0/month**

---

*Demo Deployment Guide v1.0 — Created: 2026-09-06*
*Questions? Contact devops@restaurantos.app*
