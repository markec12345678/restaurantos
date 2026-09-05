# E2E Test Plan — RestaurantOS

**Datum:** September 2026
**Status:** Aktivni artifact za 149/149 E2E target
**Cilj:** Preveriti da P0-C1 do P0-C4 spremembe niso razbile E2E testov in pripraviti strategijo za 149/149 na live staging.

## Trenutno stanje

### E2E test pokritost (lokalno)

| Datoteka | Št. testov | Fokus |
|----------|:---:|------|
| `setup.spec.ts` | 8 | Setup wizard, init flow |
| `critical-path.spec.ts` | 4 | Order → Payment → FURS → Receipt |
| `workflow.spec.ts` | 22 | Natakar + Kuhar + Lastnik workflow |
| `verify-features.spec.ts` | 12 | Feature verification |
| `outbox-worker.spec.ts` | 12 | Offline-first, outbox delivery |
| **Skupaj** | **58** | (target: 149) |

### P0-C1 do P0-C4 kompatibilnostna analiza

| Faza | Sprememba | E2E vpliv | Status |
|------|-----------|-----------|:---:|
| P0-C1 | IDOR fix (8 poti) | Admin (locationId=null) vidi vse — backward compat | ✅ Varno |
| P0-C2 | resolveTenantLocationId() helper | Admin brez filtra, regular user scoped | ✅ Varno |
| P0-C3A | FURS/receipts → Location | Receipt snapshot iz Location (fallback na settings) | ✅ Varno |
| P0-C3B | Public menu ?locationId | **Popravljeno**: auto-detect prvo aktivno lokacijo | ✅ Varno |
| P0-C4 P1-4 | ApiKey, Location fields, Webhook.locationId | Nova polja z defaulti, backward compat | ✅ Varno |

### Kritično popravljene regression (v tej seji)

1. **`/api/public/menu`** — P0-C3B je naredil `?locationId` obvezen, kar bi razbilo:
   - `/waiter` page (kiše brez parametra)
   - `/qr/[tableId]` (QR menu)
   - `/order` (online order)
   - **Fix**: auto-detect prvo aktivno lokacijo če `?locationId` manjka

2. **`/api/qr-menu`** — enaka popravitev

3. **`/api/mobile/menu`** — enaka popravitev (API key auth)

4. **Seed scripta** (`scripts/seed-e2e-pglite.mjs`):
   - `Menu` sedaj ima `locationId='loc-1'`
   - `Table` sedaj ima `locationId='loc-1'`
   - Brez tega bi `menu.findMany({where:{locationId}})` vrnil prazen seznam

## E2E Test Plan za live staging (149/149 target)

### Phase 1: Lokalni E2E testi (pred staging)

Zaženi lokalno s PGlite backend:

```bash
# 1. Reset PGlite bazo
rm -rf /home/z/my-project/pglite-dev-data

# 2. Seed testne podatke
node /home/z/my-project/scripts/seed-e2e-pglite.mjs

# 3. Zaženi dev server (v ozadju)
npm run dev &

# 4. Počakaj da server starta (cca 10s)
sleep 10

# 5. Zaženi E2E teste
npx playwright test --project=chromium

# 6. Preveri rezultat
# Target: 58/58 pass (lokalno)
```

### Phase 2: Staging E2E (149/149 target)

Za 149/149 potrebno dodati 91 novih testov. Predlog pokritosti:

#### Kritične poteze (40 testov) — P0 must-pass
- [ ] Login flow (PIN, WebAuthn, multi-employee)
- [ ] Order creation (dine-in, takeout, delivery)
- [ ] Order modification (add items, transfer table, void item)
- [ ] Payment flow (cash, card, split, loyalty, gift card)
- [ ] Receipt creation + FURS verify
- [ ] Receipt storno + FURS storno
- [ ] Z-Report generation + finalize
- [ ] Cash register shift (open, close, difference)

#### Multi-tenant isolation (20 testov) — P0-C1..C4 specifično
- [ ] IDOR: Tenant A ne more prebrati Tenant B orderja (GET /api/orders/[id])
- [ ] IDOR: Tenant A ne more posodobiti Tenant B orderja (PUT /api/orders/[id])
- [ ] IDOR: Tenant A ne mehr brisati Tenant B orderja (DELETE /api/orders/[id])
- [ ] IDOR: Tenant A ne more dodati artiklov Tenant B orderju (POST /api/orders/[id]/add-items)
- [ ] IDOR: Tenant A ne more prenesti Tenant B orderja (POST /api/orders/[id]/transfer)
- [ ] IDOR: Tenant A ne more posodobiti Tenant B plačila (PUT /api/payments/[id])
- [ ] IDOR: Tenant A ne mehr povrniti Tenant B plačila (POST /api/payments/[id]/refund)
- [ ] ?locationId bypass: regular user ne more dostopati do tujih lokacij
- [ ] Fail-closed: regular user brez locationId dobi 403
- [ ] FURS cross-tenant: Tenant A receipt se ne overi s Tenant B cert
- [ ] Webhook isolation: Tenant A webhook se ne sproži za Tenant B event
- [ ] Public menu: ?locationId auto-detect vrne prvo aktivno lokacijo
- [ ] Public menu: ?locationId=X vrne samo X-jev meni
- [ ] Admin global view: admin (locationId=null) vidi vse lokacije
- [ ] Admin cross-branch: admin lahko dostopa do specifične lokacije z ?locationId

#### FURS + finančna pravilnost (25 testov)
- [ ] ZOI generacija s pravim taxId (ne global settings)
- [ ] Receipt snapshot vsebuje pravo businessName/taxId/businessId
- [ ] QR content na digitalnem računu ustreza pravi lokaciji
- [ ] Print header vsebuje pravo ime restavracije
- [ ] E-invoice book: izdajatelj ustreza pravi lokaciji
- [ ] Batch FURS verify: per-receipt config (ne en global)
- [ ] Storno ZOI s pravim cert
- [ ] FURS cert status per-lokacija
- [ ] FURS config source: 'location' (ne 'restaurant-settings')
- [ ] Tax number v XML export ustreza pravi lokaciji

#### Offline-first / outbox (20 testov)
- [ ] Order creation offline → outbox queue → sync
- [ ] Payment offline → outbox → sync
- [ ] Conflict resolution (optimistic locking)
- [ ] Receipt queue offline → FURS verify when online
- [ ] Device registry tracking

#### Performance / load (15 testov)
- [ ] Dashboard load < 3s
- [ ] Orders list (1000+ orders) < 2s
- [ ] Concurrent order creation (race condition)
- [ ] Rate limiting (fail-closed ko Redis down)
- [ ] CSP nonce generation
- [ ] Secrets encryption at rest

#### Setup / admin (15 testov)
- [ ] First-run setup wizard
- [ ] Multi-tenant setup (subscription + locations)
- [ ] Employee management (create, terminate, role change)
- [ ] Location management (create, deactivate)
- [ ] API key management (create, revoke, rotate)

#### Edge cases (14 testov)
- [ ] Empty menu location
- [ ] Location brez FURS config
- [ ] Storno ne-overjenega računa v produkciji (zavrne)
- [ ] Cross-day shift (midnight rollover)
- [ ] Negative payment amount (validation)
- [ ] Duplicate idempotency key
- [ ] Expired API key
- [ ] Webhook SSRF (internal URL blocked)

### Phase 3: CI/CD integration

E2E testi naj se zaženejo v CI pred vsakim deploy:

```yaml
# .github/workflows/e2e.yml (predlagano)
name: E2E Tests
on: [pull_request, deployment]
jobs:
  e2e:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx prisma migrate deploy
      - run: node scripts/seed-e2e-pglite.mjs
      - run: npm run build
      - run: npm start &
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test --project=chromium
        env:
          PLAYWRIGHT_BASE_URL: http://localhost:3000
```

## KPI-ji za uspeh

- **58/58 lokalno** ( trenutno stanje — pred dodajanjem novih testov)
- **149/149 na staging** (target po dodatnih 91 testih)
- **0 cross-tenant leakage** v E2E (P0-C1..C4 specifično)
- **0 FURS config mismatch** v E2E (P0-C3A specifično)
- **0 regression** po P0-C4 Phase 5 (NOT NULL migration)

## Rollback procedura za E2E

Če E2E testi padejo po P0-C4 Phase 5 (NOT NULL migration):
1. Rollback migration: `prisma migrate resolve --rolled-back <migration>`
2. SQL revert: `ALTER TABLE "Model" ALTER COLUMN "locationId" DROP NOT NULL`
3. Re-run E2E: `npx playwright test`
4. Če E2E še vedno pada: `git revert <commit>` + re-deploy

## Naslednji koraki

1. **Takoj**: Zaženi lokalne E2E teste (58/58) da potrdim da moje spremembe niso razbile ničesar
2. **Potem**: Dodaj 91 novih E2E testov po zgornjem planu
3. **Nato**: Zaženi na staging serverju (149/149 target)
4. **Končno**: Nadaljuj s P0-C4 Phase 5 (NOT NULL migration) z E2E safety net-om
