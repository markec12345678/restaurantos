# 🚀 RestaurantOS — Migration Guide (v0.9.x → v1.0.0-ready)

Ta vodič popisuje korake za nadgradnjo na najnovejšo različico z vsemi varnostnimi popravki.

## 📋 Pred nadgradnjo

### Backup
```bash
# 1. Backup PGlite (dev)
cp -r /home/z/my-project/pglite-data ~/pglite-backup-$(date +%Y%m%d)

# 2. Backup PostgreSQL (prod)
pg_dump $DATABASE_URL > ~/restaurantos-backup-$(date +%Y%m%d).sql
```

### Preveri trenutno stanje
```bash
git fetch origin
git checkout main
git pull origin main
git log --oneline -5  # trenutno stanje
```

---

## 🔧 Nadgradnja

### 1. Pull nove kode
```bash
git fetch origin
git checkout feature/webauthn-csp-security
git pull origin feature/webauthn-csp-security

# ALI po merge-u v main:
git checkout main
git pull origin main
```

### 2. Install dependencies
```bash
npm install
# Nove dependency-ji:
#   - @simplewebauthn/server (WebAuthn)
#   - @simplewebauthn/browser (WebAuthn frontend)
#   - ioredis (optional — za multi-replica cache)
```

### 3. Posodobi environment variables
```bash
cp .env.example .env
# Uredi .env s svojimi vrednostmi
```

**Ključne spremembe v .env:**

```bash
# ❌ STARO (neveljavno — schema je postgresql):
# DATABASE_URL="file:./db/custom.db"

# ✅ NOVO (pravilno):
# DEV — prazno (uporabi PGlite):
DATABASE_URL=""

# PROD — zunanji PostgreSQL:
DATABASE_URL="postgresql://user:pass@host:5432/dbname"

# WebAuthn (omogoči v dev; prod samodejno če HTTPS):
WEBAUTHN_ENABLED="true"  # za dev/test

# Multi-replica production (Vercel/Render):
REDIS_URL="redis://user:pass@redis-host:6379"
```

### 4. Migracija baze
```bash
# DEV (PGlite) — reinicializiraj bazo z novo schemo:
rm -rf /home/z/my-project/pglite-data
node scripts/init-pglite.mjs

# PROD (PostgreSQL) — prilepi migration:
npx prisma migrate deploy
# ALI če uporabljaš db push:
npx prisma db push
```

### 5. Generiraj Prisma client
```bash
npx prisma generate
```

### 6. Preveri type + tests
```bash
npx tsc --noEmit       # 0 errors
npx vitest run         # 824/824 PASS
```

### 7. Build
```bash
npm run build
```

---

## ✅ Post-nadgradnja verification

### Testiraj WebAuthn
```bash
# 1. Prijavi se s PIN kot admin
# 2. Pojdi v Zaposleni → Biometrične poverilnice
# 3. Klikni "Dodaj" → browser prikaže Touch ID/Face ID prompt
# 4. Po registraciji → odjavi se
# 5. Na login screenu se pojavi "Biometrična prijava" gumb
# 6. Klikni → uspešna prijava
```

### Preveri CSP z nonce
```bash
# V brskalniku (DevTools → Network → kateri koli dokument → Headers):
# Content-Security-Policy: ...; script-src 'self' 'nonce-XXXXXXX=='; ...
# Ne sme vsebovati 'unsafe-inline' (razen v style-src)
```

### Preveri DB health
```bash
curl -X GET http://localhost:3000/api/system/db-health \
  -H "Authorization: Bearer $TOKEN"
# Vrne: { "valid": true, "usesPglite": true, ... }
```

### Preveri FURS config source
```bash
curl -X GET "http://localhost:3000/api/furs/config-source?locationId=$LOC_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# Vrne: { "source": "location", "configured": true, ... }
```

### Preveri GuestVisit integrity
```bash
curl -X GET http://localhost:3000/api/audit/guest-visit-integrity \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# Vrne: { "ok": true, "message": "..." }
```

---

## 🔄 Rollback (v sili)

```bash
# 1. Vrni na prejšnji commit
git checkout main
git reset --hard <previous-commit-sha>

# 2. Obnovi backup baze
rm -rf /home/z/my-project/pglite-data
cp -r ~/pglite-backup-YYYYMMDD /home/z/my-project/pglite-data

# 3. Restart
npm run dev
```

---

## 📋 Nova features v tej nadgradnji

### WebAuthn/FIDO2 biometric login
- Touch ID, Face ID, Windows Hello, YubiKey
- @simplewebauthn/server z ES256/RS256/EdDSA
- FIDO2 §6.1 counter zaščita proti kloniranju

### Multi-tenant SaaS
- Subscription → Location hierarhija
- Per-location FURS cert + accounting
- Subscription context helper za API rute

### Multi-replica cache (Redis)
- MemoryCacheAdapter (default, dev)
- RedisCacheAdapter (prod, multi-replica)
- WebAuthn challenge + rate limit sinhronizirana

### Type safety improvements
- 14 TS enum const objects (OrderStatus, PaymentStatus, itd.)
- 14 type-guards (isOrderStatus, itd.) — catch typo-je
- 25 JSON typed parsers (parseOrderItemModifiers, itd.)

### Audit dashboard endpoints
- `/api/system/db-health` — DB config validator
- `/api/furs/config-source` — FURS config diagnostic
- `/api/audit/guest-visit-integrity` — hash chain verify

---

## 🆘 Troubleshooting

### "WebAuthn biometric login je onemogočen"
- Preveri `WEBAUTHN_ENABLED="true"` v `.env`
- Restart server
- V prod: `NEXTAUTH_URL` mora biti HTTPS

### "FURS certifikat ni konfiguriran"
- Preveri Location model: `premisesId`, `fursCertPath`, `fursCertPassword`
- Kliči `GET /api/furs/config-source` za diagnostic

### "Rate limit preveč agresiven"
- V multi-replica: set `REDIS_URL` za shared state
- V single-instance: MemoryCacheAdapter je dovolj

### "TypeScript errorji po upgrade"
- Počisti cache: `rm -rf node_modules .next`
- Reinstall: `npm install`
- Regenerate: `npx prisma generate`

---

## 📞 Support

Za vprašanja glede migracije glej:
- `PULL_REQUEST.md` — full PR opis
- `AUDIT-REPORT.md` — varnostni audit
- `SECURITY.md` — varnostne značilnosti
- `DEPLOYMENT-GUIDE.md` — deployment guide
