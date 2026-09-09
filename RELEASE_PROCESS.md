# Release Process — RestaurantOS

> Ta dokument opisuje verzioniranje, checklist in rollback postopek za vsak
> release RestaurantOS-a. Vsak release MORA slediti tem pravilom — brez izjem.

---

## 1. Verzioniranje (Semantic Versioning)

Format: `vMAJOR.MINOR.PATCH` (npr. `v1.0.0`, `v1.0.1`, `v1.0.2`)

| Del | Kdaj se poveča | Primer |
|-----|----------------|--------|
| **MAJOR** | Breaking changes v API/shemi, ki zahtevajo stran dela klientov | `v1.0.0 → v2.0.0` |
| **MINOR** | Nova funkcionalnost (nazaj združljiva) | `v1.0.2 → v1.1.0` |
| **PATCH** | Popravki (bugfix, varnost, odvisnosti) | `v1.0.1 → v1.0.2` |

Pravila:
- **NIč lovečih verzij** — vsak merge v `main`, ki spreminja obnašanje, dobi
  svojo verzijo v CHANGELOG (patch ali minor)
- Verzija se pojavi na **SEDMIH mestih hkrati** (usklajenost je obvezna):
  1. `package.json` → `version`
  2. `README.md` → naslov (v1.x.y) + Version badge
  3. `SECURITY.md` → Supported Versions tabela + ocena
  4. `CHANGELOG.md` → `[vX.Y.Z]` vnos
  5. Git **tag** `vX.Y.Z` (annotated, na release commitu)
  6. GitHub **Release** (glej obvezna polja spodaj)
  7. `src/middleware.ts` / build meta kjer je verzija izpostavljena (če je)
- Pred release-jem preveri usklajenost: `git describe --tags --exact-match`
  + `rg "1\.1\.0" package.json README.md SECURITY.md CHANGELOG.md`

---

## 2. Release checklist (9 stopenj)

```text
[ ] 1. CI zelen na main (9 stopenj: quality → unit → integration → migration
        → build → security → e2e) — brez continue-on-error
[ ] 2. Verzija določena (semver) + bump package.json
[ ] 3. CHANGELOG.md vnos z VSA obvezna polja (glej §3)
[ ] 4. README/SECURITY usklajena (verzija + statusi)
[ ] 5. Lokalna potrditev: bun run typecheck && lint && test:unit
        && build && test:e2e (E2E flow 39/39)
[ ] 6. Commit release (format: "release: vX.Y.Z — <povzetek>")
[ ] 7. git tag -a vX.Y.Z -m "..." + git push origin main --tags
[ ] 8. GitHub Release objavljen (body = CHANGELOG vnos; glej §4)
[ ] 9. Po 30 min: preveri Actions + Vercel deployment + /api/health + alerte
```

---

## 3. Obvezna polja vsakega release-a

Vsak CHANGELOG vnos / GitHub Release vsebuje (v tabeli na vrhu vnosa):

| Polje | Vsebina |
|-------|---------|
| **Datum izdaje** | ISO datum (YYYY-MM-DD) |
| **Commit** | SHA release commit-a (`git rev-parse --short HEAD`) |
| **Migracije** | Seznam Prisma sheme sprememb; "NIHČE" če jih ni; ali `db push` teče (⚠️ smer baze!) |
| **Breaking changes** | Izrecno "NE" ali seznam + navodila za prehod |
| **Testni rezultati** | Enote/E2E/tsc/lint/build — natančne številke |
| **Znane težave** | Seznam odprtih vrzeli tega release-a (link Known Issues) |
| **Deployment navodila** | Koraki namestitve (ali link DEPLOYMENT.md) |
| **Rollback navodila** | Kako se povrati prejšnja verzija (glej §5) |

---

## 4. GitHub Release (primer telesa)

```text
## vX.Y.Z — <povzetek>

| Polje | Vrednost |
|-------|----------|
| Datum | 2026-09-09 |
| Commit | `78aae4ce` |
| Migracije | NONE |
| Breaking | NE |
| Testi | 1326/1326 unit · 39/39 E2E flow · tsc/lint/build ✅ |

### Kaj je novega
- ...

### Popravki
- ...

### Znane težave
- ...

### Deployment
bun install --frozen-lockfile && bun run build && bun start
(custom server z WebSocket: npm run start:ws)

### Rollback
git checkout v<PREJŠNJA> && bun install --frozen-lockfile && bun run build && redeploy
```

Objava prek API:
```bash
gh release create vX.Y.Z --title "vX.Y.Z — <povzetek>" --notes-file release-notes.md
# ali curl -X POST .../releases z PAT
```

---

## 5. Rollback postopek

### Brez migracij (pravi release-i)

```bash
# 1. Povrati kodo
git checkout v<PREJŠNJA_VERZIJA>
bun install --frozen-lockfile

# 2. Zgradi
bun run build

# 3. Ponovno postavi (Vercel: redeploy prejšnjega build-a iz dashboarda;
#    Docker: build + swap; custom server: pm2 restart)
pm2 restart restaurantos  # ali ekvivalent

# 4. Preveri
curl -fsS https://<host>/api/health | jq .
curl -fsS -H "Authorization: Bearer $TOKEN" https://<host>/api/monitoring/alerts
```

### Z migracijami (potrebna skrb)

⚠️ Prisma `db push` NE generira reverznih migracij — PREVERI:
1. Če je release DODAL stolpce/tabele (nedestruktivno) → rollback kode je
   VAREN (stari kode novega stolpca ne berejo)
2. Če je release SPREMENIL/odstranil stolpce → rollback zahteva ročno
   migracijo nazaj (to je razlog, da v RELEASE zapišeš natančne DDL spremembe)

### Rollback komunikacija

- Objavi v GitHub Release starejše verzije komentar "ROLLED BACK from vX.Y.Z: <vzrok>"
- E2E alerting (Sentry) — označi incident resolved

---

## 6. Branching & okna

- `main` = vedno releasable (CI 9 stopenj breaking — merge brez zelenih
  testov NI možen)
- Feature branchi: `feat/...`, `fix/...` → PR + CI + review
- Hrošči (hotfix): branch od tag-a → `hotfix/vX.Y.Z` → patch release
  z istim checklistom

---

## 7. Primer zgodovine

| Tag | Datum | Povzetek |
|-----|-------|----------|
| v1.0.0 | 2026-09-03 | Production Ready (prvi release) |
| v1.0.1 | 2026-09-06 | P0-C1..C5 Security Hardening |
| v1.1.0 | 2026-09-09 | E2E flow testi + observability + P2 dokumentacija (konsolidacija v1.0.2–v1.0.15: P1 security/quality revizija, CI 9 stopenj, Bun-only, dependency cleanup) |

> Opomba: vmesne verzije v1.0.2–v1.0.15 niso bile ločeno taggane (žepni razvoj
> med P1 revizijo) — njihova vsebina je konsolidirana v v1.1.0 CHANGELOG
> zgodovini. OD v1.1.0 naprej velja 1 : 1 preslikava verzija ↔ tag ↔ release.
