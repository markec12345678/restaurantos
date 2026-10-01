# Release / Support / Runbook Index — RestaurantOS

**Epic:** #144 §22 korak 22 ("Prepare release/support/runbook material") · **Runda:** R189 · **Status:** AKTIVEN izvor resnice za inventar materiala

---

## 1. Namen

Enoten inventar vsega release/support/runbook materiala: kateri artefakt obstaja,
kakšen je njegov status in kateri dokument je izvor resnice za katero domeno.
Ta dokument **NE podvaja vsebin** — samo preslika (anti-overclaim; enoten vir
resnice je vedno referenciran dokument).

Statusne oznake:

- **AKTIVEN** — vzdrževan, odseva trenutni produkt
- **ZGODOVINSKI** — arhivska vrednost, označen z bannerjem, ni evidence-backed za trenutni HEAD
- **GENERIRAN** — programsko generiran (`bun run <script>`), ročno urejanje ni dovoljeno

---

## 2. Release material

| Dokument | Status | Vloga |
|----------|--------|-------|
| [RELEASE_PROCESS.md](../RELEASE_PROCESS.md) | AKTIVEN | verzioniranje (semver), release checklist, rollback pravila |
| [CHANGELOG.md](../CHANGELOG.md) | AKTIVEN | vsi pomembne spremembe (format po RELEASE_PROCESS.md) |
| [docs/PRODUCT-STATUS.md](./PRODUCT-STATUS.md) | AKTIVEN | avtoritativni produkt status (machine-readable JSON, versionSource: package.json) |
| [docs/PRODUCTION-VALIDATION.md](./PRODUCTION-VALIDATION.md) | AKTIVEN | CI/file-based evidence (§2 = ciLastFileBasedProof, iz CI logov) |
| [docs/RELEASE-v1.0.1.md](./RELEASE-v1.0.1.md) | ZGODOVINSKI | release notes v1.0.1 (5. september 2026) |
| [docs/CASE-STUDY-TEMPLATE.md](./CASE-STUDY-TEMPLATE.md) | AKTIVEN | predloga za strankine case studije |

## 3. Runbook material

| Dokument | Status | Vloga |
|----------|--------|-------|
| [docs/PRODUCTION-DEPLOYMENT-RUNBOOK.md](./PRODUCTION-DEPLOYMENT-RUNBOOK.md) | AKTIVEN | ops vodič za staging/production deployment (vključno `/api/setup/init` seed) |
| [docs/DISASTER-RECOVERY.md](./DISASTER-RECOVERY.md) | AKTIVEN | backup/restore kanon + orodja (`scripts/backup.sh`, `scripts/dr-restore-test.sh`; epik #115 P0-6) |
| [docs/SLA.md](./SLA.md) | AKTIVEN | SLA §8 = DR cilji (RPO/RTO), §5 = vzdrževanje |
| [docs/STAGING_DEPLOYMENT.md](./STAGING_DEPLOYMENT.md) | AKTIVEN | staging deployment (§5.2 ročni pg_dump preskus) |
| [DEPLOYMENT.md](../DEPLOYMENT.md) | AKTIVEN | deployment osnove |
| [docs/DEMO-DEPLOYMENT-GUIDE.md](./DEMO-DEPLOYMENT-GUIDE.md) | AKTIVEN | demo deployment vodič |
| [docs/PRODUCTION-LAUNCH-CHECKLIST.md](./PRODUCTION-LAUNCH-CHECKLIST.md) | ZGODOVINSKI | launch checklist iz 2026-09-02 — banner R189; operativni naslednik za go-live: PRODUCT-STATUS + PRODUCTION-VALIDATION + PRODUCTION-DEPLOYMENT-RUNBOOK |
| [docs/PRODUCTION-CHECKLIST.md](./PRODUCTION-CHECKLIST.md) | ZGODOVINSKI | ops checklist iz v1.0.1 (2026-09-06) — banner R189; naslednik enako kot zgoraj |
| [docs/PRODUCTION-READINESS-CHECKLIST.md](./PRODUCTION-READINESS-CHECKLIST.md) | ZGODOVINSKI | readiness ocena iz v1.0.2 (banner že od prej) |

## 4. Support material

| Dokument | Status | Vloga |
|----------|--------|-------|
| [.github/SUPPORT.md](../.github/SUPPORT.md) | AKTIVEN | izhodiščna točka podpore (R189 — prej manjkal; preslika potrebe → kanal → izvor resnice) |
| [docs/SLA.md](./SLA.md) | AKTIVEN | tier-ji, odzivni časi (§2), support kanali (§6) — EDINI vir za številke |
| [SECURITY.md](../SECURITY.md) | AKTIVEN | varnostna politika; Supported Versions ≡ package.json (drift-gate R189) |
| [docs/KNOWN_ISSUES.md](./KNOWN_ISSUES.md) | AKTIVEN | znane težave (preveri PRED prijavo) |
| [docs/CLIENT-ONBOARDING-GUIDE.md](./CLIENT-ONBOARDING-GUIDE.md) | AKTIVEN | navodila za stranko (onboarding) |
| [docs/ONBOARDING-GUIDE.md](./ONBOARDING-GUIDE.md) | AKTIVEN | razvijalski/ops onboarding |
| [docs/E2E-TEST-PLAN.md](./E2E-TEST-PLAN.md) | AKTIVEN | E2E testni načrt |
| [docs/PRIVACY-POLICY.md](./PRIVACY-POLICY.md) | AKTIVEN | politika zasebnosti |
| [docs/TERMS-OF-SERVICE.md](./TERMS-OF-SERVICE.md) | AKTIVEN | pogoji uporabe |
| [docs/PRODUCT-VIDEO-STORYBOARD.md](./PRODUCT-VIDEO-STORYBOARD.md) | AKTIVEN | produktni video storyboard (#141 smernice; R188) |
| [docs/VIDEO-TUTORIALS.md](./VIDEO-TUTORIALS.md) | ZGODOVINSKI | star tehnični načrt videov (banner R188) — naslednik: storyboard |

## 5. Generirani artefakti (ročno urejanje ni dovoljeno)

| Dokument | Status | Generator | Drift-gate |
|----------|--------|-----------|------------|
| [docs/MODULE-INVENTORY.md](./MODULE-INVENTORY.md) | GENERIRAN | `bun run inventory` | tests/unit/lib/module-registry.test.ts |
| [docs/VALIDATION-MATRIX.md](./VALIDATION-MATRIX.md) | GENERIRAN | `bun run matrix` | tests/unit/lib/validation-matrix.test.ts |
| [docs/BUSINESS-CHAIN.md](./BUSINESS-CHAIN.md) | GENERIRAN | `bun run chain` | tests/unit/lib/business-chain.test.ts |

## 6. Skupnostne datoteke (.github)

| Artefakt | Status | Vloga |
|----------|--------|-------|
| [.github/SUPPORT.md](../.github/SUPPORT.md) | AKTIVEN (R189) | podpora (GitHub community standard — prej manjkal) |
| [SECURITY.md](../SECURITY.md) | AKTIVEN | varnostna politika |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | AKTIVEN | prispevanje |
| [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) | AKTIVEN | pravila občestva |
| [.github/ISSUE_TEMPLATE/](../.github/ISSUE_TEMPLATE) | AKTIVEN | 5 template-ov (bug_report, feature_request, config, security_report, security_vulnerability) |
| [.github/PULL_REQUEST_TEMPLATE.md](../.github/PULL_REQUEST_TEMPLATE.md) | AKTIVEN | PR predloga |
| [.github/CODEOWNERS](../.github/CODEOWNERS) | AKTIVEN | lastniki kode |
| [.github/dependabot.yml](../.github/dependabot.yml) | AKTIVEN | odvisnosti |

## 7. Register vrzeli (korak 22 audit — R189)

| Vrzel | Zaznana | Resolucija |
|-------|---------|------------|
| `SUPPORT.md` ne obstaja (GitHub community standard za podporo) | R189 | **REŠENO R189** — nov `.github/SUPPORT.md` (preslika potrebe → kanal → izvor resnice; brez podvajanja števil) |
| `docs/PRODUCTION-CHECKLIST.md` nosi v1.0.1 trditve ("1050 testov, CI 5/5 green") v aktivnem glasu brez zgodovinske markacije | R189 | **REŠENO R189** — ZGODOVINSKI banner pred trditvami (vsebina arhivska, nedotaknjena) |
| `docs/PRODUCTION-LAUNCH-CHECKLIST.md` nosi "READY" oznake iz 2026-09-02 brez markacije | R189 | **REŠENO R189** — ZGODOVINSKI banner pred trditvami |
| `SECURITY.md` Supported Versions tabela zastarela (v1.3.x "Active", dejanska verzija v1.26.0) | R189 | **REŠENO R189** — tabela ≡ package.json + trajen drift-gate (test zahteva Active vrstico ≡ package.json major.minor) |
| Produkcija ob sprostitvi Vercel kvote: seed prek `/api/setup/init` + produkcija PIN-i = unikatni močni (demoPinPolicy) | R189 | **ODPRTO — vezano na produkcijo** (NI repozitorijska vrzel; postopka dokumentirana v PRODUCTION-DEPLOYMENT-RUNBOOK) |

---

## 8. Drift-gate

Trajen gate: `tests/unit/security/r189-release-support.test.ts` (14 testov):
fs-verifikacija vseh referenciranih poti (index + SUPPORT.md), statusni pini
(AKTIVEN / ZGODOVINSKI / GENERIRAN po tabelah zgoraj), register vrzeli
(4× REŠENO R189 + ločena ODPRTO produkcija postavka), ZGODOVINSKI banner
pred zastarelimi trditvami (red prvi pojavljanj), SECURITY.md Supported
Versions ≡ package.json, SUPPORT.md brez izmišljenih absolutnih odzivnih
časov (SLA.md ostane edini vir števil).
