# VALIDATION-MATRIX (§8)

> ⚙️ GENERIRANO z `scripts/generate-validation-matrix.ts` (bun run matrix) — **NE urejati ročno**.
> Kritično pravilo epika #144 §8: **"Green CI is not the same thing as production validation."**
> **Zelen CI NI isto kot produkcijska validacija.** Vsak ✓ je sidran na konkretno testno
> datoteko (fail-closed preverjeno ob generaciji); "realni" kanali ostajajo NE-validirani.

**17 zmožnosti** (9 iz epika §8 + 8 razširitev po realni kodi) · 41 unit sidrov · 11 IT · 21 E2E · 0 pilotnih trditev

| Zmožnost | Implementirano | Unit | Integracija | E2E | Brskalnik (živo) | Realni hardver | Realno plačilo | Realna zunanja storitev | Pilot |
|---|---|---|---|---|---|---|---|---|---|
| `pos` POS / naročila (`orders`, `tables`) | ✅ koda | ✅ 3 | ✅ 1 | ✅ 3 | ✅ P5 | N/A | ☐ | N/A | ☐ |
| `kds` KDS (kuhinja) (`kitchen`) | ✅ koda | ✅ 2 | ✅ 1 | ✅ 2 | ✅ P5 | ☐ | N/A | N/A | ☐ |
| `offline` Offline / reconnect (`offline-queue`, `outbox`) | ✅ koda | ✅ 3 | ✅ 1 | ✅ 1 | — | N/A | N/A | N/A | ☐ |
| `payment` Plačila (`orders`, `cash-register`) | ✅ koda | ✅ 2 | ✅ 2 | ✅ 2 | ✅ P5 | N/A | ☐ | ☐ | ☐ |
| `receipt` Računi (ZDDV-1) (`printers`) | ✅ koda | ✅ 3 | — | ✅ 1 | ✅ P5 | N/A | N/A | ☐ | ☐ |
| `furs` FURS (SI fiskalizacija) (`furs`) | ✅ koda | ✅ 5 | — | ✅ 2 | ⚠️ SIM (P5) | N/A | N/A | ☐ | ☐ |
| `printer` Tiskalniki (`printers`) | ✅ koda | ✅ 1 | — | ✅ 1 | ✅ P5 | ☐ | N/A | N/A | ☐ |
| `stock` Zaloge / COGS (`inventory`, `recipes`) | ✅ koda | ✅ 5 | ✅ 1 | ✅ 1 | ✅ P5 | N/A | N/A | N/A | ☐ |
| `daily-close` Smena / Z-poročilo / EOD (`cash-register`, `z-report`, `end-of-day`) | ✅ koda | ✅ 3 | ✅ 1 | ✅ 1 | ✅ R177 | N/A | ☐ | N/A | ☐ |
| `auth-access` PIN / WebAuthn / dostop | ✅ koda | ✅ 3 | — | ✅ 2 | ✅ R172+ | ☐ | N/A | N/A | ☐ |
| `tenant-security` Tenant / lokacijska izolacija | ✅ koda | ✅ 3 | — | ✅ 1 | — | N/A | N/A | N/A | ☐ |
| `reservations-guest` Rezervacije & gostje (`reservations`, `waitlist`, `guests`, `feedback`, `table-reservation-sync`) | ✅ koda | ✅ 1 | ✅ 2 | ✅ 1 | ✅ R175 | N/A | N/A | N/A | ☐ |
| `audit-compliance` Audit & skladnost (`audit-log`, `compliance`) | ✅ koda | ✅ 3 | — | ✅ 1 | ✅ R177 | N/A | N/A | N/A | ☐ |
| `reporting-eod` Poročila & analitika (`reports`, `dashboard`, `end-of-day`) | ✅ koda | ✅ 2 | ✅ 1 | ✅ 2 | ✅ R175 | N/A | N/A | N/A | ☐ |
| `backup-recovery` Backup / recovery | ✅ koda | — | ✅ 1 | — | — | N/A | N/A | N/A | ☐ |
| `danes-cockpit` Danes kokpit (P0-01) (`danes`) | ✅ koda | ✅ 1 | — | — | ✅ R175 | N/A | N/A | N/A | ☐ |
| `workspaces-ia` Workspaces & IA (§6/P0-02) | ✅ koda | ✅ 1 | — | — | ✅ R176 | N/A | N/A | N/A | ☐ |

## Dokazna sidra (vsako sidro = fs-verified testna datoteka)

### `pos` — POS / naročila · §6 moduli: `orders`, `tables`

- **Unit**: `tests/unit/orders/p1-data-model.test.ts`, `tests/unit/security/r112-orders-kds-concurrency.test.ts`, `tests/unit/lib/r129-reorder-canon.test.ts`
- **Integracija (realna DB)**: `tests/integration/r135-kiosk-order.test.ts`
- **E2E (realni PG, CI)**: `tests/e2e/core-flow.spec.ts`, `tests/e2e/critical-path.spec.ts`, `tests/e2e/workflow.spec.ts`
- **Brskalnik (živo, sandbox)**: P5 (zlati tok): POS mreža (Toast-stil, živa zaloga) → košarica + DDV razčlenitev → oddaja naročila → plačilni dialog — živo v sandboxu.

### `kds` — KDS (kuhinja) · §6 moduli: `kitchen`

- **Unit**: `tests/unit/lib/kds-sound-prefs.test.ts`, `tests/unit/lib/r156-enums.test.ts`
- **Integracija (realna DB)**: `tests/integration/r133-kds-metrics-drill.test.ts`
- **E2E (realni PG, CI)**: `tests/e2e/kds-timer.spec.ts`, `tests/e2e/core-flow.spec.ts`
- **Brskalnik (živo, sandbox)**: P5: KDS modul živo (fire → ticket); R176: kitchen workspace landing na Marko 4444 (KDS "Kuhinja je prosta" — P0-02 dokaz).
- **Opomba**: Realni KDS device ni fizično validiran (physicalValidationStatus.kdsDevice = false).

### `offline` — Offline / reconnect · §6 moduli: `offline-queue`, `outbox`

- **Unit**: `tests/unit/offline/r128-offline-cancel-ops.test.ts`, `tests/unit/lib/indexeddb-stores.test.ts`, `tests/unit/outbox.test.ts`
- **Integracija (realna DB)**: `tests/integration/r128-offline-exactly-once.test.ts`
- **E2E (realni PG, CI)**: `tests/e2e/outbox-worker.spec.ts`
- **Brskalnik (živo, sandbox)**: — (exactly-once dokaz = IT + e2e outbox; brez namenskega brskalniškega streza)
- **Opomba**: Obseg po zasnovi: orders/cancel offline-safe (exactly-once); payment in Daily Close offline-BLOCKED (PRODUCTION-VALIDATION.md §7 S12).

### `payment` — Plačila · §6 moduli: `orders`, `cash-register`

- **Unit**: `tests/unit/payments/payment-tenant-guard.test.ts`, `tests/unit/security/r116-idempotency-tenant-boundary.test.ts`
- **Integracija (realna DB)**: `tests/integration/r144-gift-cards.test.ts`, `tests/integration/r128-offline-exactly-once.test.ts`
- **E2E (realni PG, CI)**: `tests/e2e/payment-flow.spec.ts`, `tests/e2e/core-flow.spec.ts`
- **Brskalnik (živo, sandbox)**: P5: gotovina 50 € → plačilo 201; deljeno / po artiklih / napitnina dialog živo. Idempotency replay (isti key = isti payment) = core-flow FLOW-9b.
- **Opomba**: Plačilni terminal NOT PHYSICALLY VALIDATED; Stripe v test-mode keys (produkcijski keys = uporabniški korak).

### `receipt` — Računi (ZDDV-1) · §6 moduli: `printers`

- **Unit**: `tests/unit/cis/receipt-submission.test.ts`, `tests/unit/cis/invoice.test.ts`, `tests/unit/api/r132-invoice-match.test.ts`
- **E2E (realni PG, CI)**: `tests/e2e/core-flow.spec.ts`
- **Brskalnik (živo, sandbox)**: P5: račun R-2026-000001 izdan; digitalni račun (Davčno overi, e-pošta, SMS dialog) živo.
- **Opomba**: "Davčno overi" = FURS sim-mode (glej vrstico furs) — realna zunanja overitev NI izvedena.

### `furs` — FURS (SI fiskalizacija) · §6 moduli: `furs`

- **Unit**: `tests/unit/furs/r166-sim-mode.test.ts`, `tests/unit/furs/zoi.test.ts`, `tests/unit/furs/jws.test.ts`, `tests/unit/furs/pkcs12-roundtrip.test.ts`, `tests/unit/api/r125-furs-location-only.test.ts`
- **E2E (realni PG, CI)**: `tests/e2e/furs-financial.spec.ts`, `tests/e2e/core-flow.spec.ts`
- **Brskalnik (živo, sandbox)**: P5: "Davčno overi" dialog živo — SIMULACIJA (račun ostane pending, EOR prazen, FURS_VERIFY_FAILED audit v failure path = core-flow FLOW-10).
- **Opomba**: NOT PHYSICALLY VALIDATED — mTLS/JWS/EOR proti produkcijskemu FURS okolju nikoli izvedeno; certifikat = uporabniški korak (eDavki). Sim-mode = strukturna validacija, NE produkcijska.

### `printer` — Tiskalniki · §6 moduli: `printers`

- **Unit**: `tests/unit/lib/z-report-print.test.ts`
- **E2E (realni PG, CI)**: `tests/e2e/core-flow.spec.ts`
- **Brskalnik (živo, sandbox)**: P5: tisk endpoint 200 (živo); Z-report print unit kanon (z-report-print).
- **Opomba**: Realni tiskalnik ni fizično validiran (physicalValidationStatus.printer = false); tiskalniške failure poti (§9 Printing) = P1 obseg.

### `stock` — Zaloge / COGS · §6 moduli: `inventory`, `recipes`

- **Unit**: `tests/unit/lib/yield.test.ts`, `tests/unit/api/r124-soldout-enforcement.test.ts`, `tests/unit/api/r121-stocktake.test.ts`, `tests/unit/security/r161-last2-units.test.ts`, `tests/unit/security/r120-batch-lot-fefo.test.ts`
- **Integracija (realna DB)**: `tests/integration/r135-kiosk-order.test.ts`
- **E2E (realni PG, CI)**: `tests/e2e/core-flow.spec.ts`
- **Brskalnik (živo, sandbox)**: P5: živa zaloga v POS mreži; razknjižba + StockTransaction(type=sale) = core-flow FLOW-13 (§7 Inventory).

### `daily-close` — Smena / Z-poročilo / EOD · §6 moduli: `cash-register`, `z-report`, `end-of-day`

- **Unit**: `tests/unit/api/r126-daily-close.test.ts`, `tests/unit/api/r158-zreport-gate.test.ts`, `tests/unit/security/r110-eod-zreport-concurrency.test.ts`
- **Integracija (realna DB)**: `tests/integration/r132-recon-drill.test.ts`
- **E2E (realni PG, CI)**: `tests/e2e/core-flow.spec.ts`
- **Brskalnik (živo, sandbox)**: R177: celotna §7 veriga 22/22 korakov (curl checkpoint runner — Open Shift → Close cashDifference 0 → Z finalize → EOD konsistenca); brskalniški kos (plačilo → račun) P5.
- **Opomba**: Realno plačilo relevantno prek blagajniške izmene (gotovina); terminal NI fizično validiran.

### `auth-access` — PIN / WebAuthn / dostop (razširitev)

- **Unit**: `tests/unit/security/r99-webauthn-gate.test.ts`, `tests/unit/security/session-revocation.test.ts`, `tests/unit/security/session-token-hash.test.ts`
- **E2E (realni PG, CI)**: `tests/e2e/pin-login-webauthn.spec.ts`, `tests/e2e/two-step-login.spec.ts`
- **Brskalnik (živo, sandbox)**: PIN prijava (2-stopnjska, 401 na napačen PIN) živo v vsaki rundi R172–R177; FIDO2 ceremony = e2e virtual authenticator (R99 kanon).
- **Opomba**: WebAuthn = device attestation; realna biometrična naprava ni fizično validirana (e2e virtual authenticator).

### `tenant-security` — Tenant / lokacijska izolacija (razširitev)

- **Unit**: `tests/unit/security/r81-audit-tenant-model.test.ts`, `tests/unit/security/r84-reports-scope.test.ts`, `tests/unit/security/r85-dashboard-tracking-scope.test.ts`
- **E2E (realni PG, CI)**: `tests/e2e/multi-tenant-security.spec.ts`
- **Brskalnik (živo, sandbox)**: — (dokaz = 99 security test fajlov + e2e MODELA-1..16 + IDEMPO-1..5)

### `reservations-guest` — Rezervacije & gostje (razširitev) · §6 moduli: `reservations`, `waitlist`, `guests`, `feedback`, `table-reservation-sync`

- **Unit**: `tests/unit/lib/reservation-overlap.test.ts`
- **Integracija (realna DB)**: `tests/integration/r140-feedback.test.ts`, `tests/integration/r143-loyalty.test.ts`
- **E2E (realni PG, CI)**: `tests/e2e/workflow.spec.ts`
- **Brskalnik (živo, sandbox)**: R175: rezervacije sekcija v Danes kokpitu (upcoming) živo; Table.status reserved flip = R102 CAS kanon.

### `audit-compliance` — Audit & skladnost (razširitev) · §6 moduli: `audit-log`, `compliance`

- **Unit**: `tests/unit/db/audit-log.test.ts`, `tests/unit/api/r148-audit-retention.test.ts`, `tests/unit/components/r148-audit-viewer.test.ts`
- **E2E (realni PG, CI)**: `tests/e2e/core-flow.spec.ts`
- **Brskalnik (živo, sandbox)**: R177: audit vrstice CREATE_ORDER/CREATE_PAYMENT preverjene v §7 verigi (FLOW-14); viewer živo R173 ("FURS" iskanje v paleti → compliance/furs moduli).

### `reporting-eod` — Poročila & analitika (razširitev) · §6 moduli: `reports`, `dashboard`, `end-of-day`

- **Unit**: `tests/unit/labor-reports.test.ts`, `tests/unit/security/r80-aggregate-scope-a2-reports-shifts.test.ts`
- **Integracija (realna DB)**: `tests/integration/r146-accounting-export.test.ts`
- **E2E (realni PG, CI)**: `tests/e2e/dashboard-reports-edge.spec.ts`, `tests/e2e/core-flow.spec.ts`
- **Brskalnik (živo, sandbox)**: R175: deep-link "Prodano danes" (Danes kokpit) → Poročila modul živo; EOD konsistenca = core-flow FLOW-18.

### `backup-recovery` — Backup / recovery (razširitev)

- **Integracija (realna DB)**: `tests/integration/r127-backup-restore-roundtrip.test.ts`
- **Brskalnik (živo, sandbox)**: — (dokaz = round-trip IT v CI + živi drill)
- **Opomba**: PHYSICALLY VALIDATED živi 6-fazni drill v sandboxu (R158, RTO 22 s) — omejitev: PGlite ≠ Neon produkcijska baza.

### `danes-cockpit` — Danes kokpit (P0-01) (razširitev) · §6 moduli: `danes`

- **Unit**: `tests/unit/lib/module-registry.test.ts`
- **Brskalnik (živo, sandbox)**: R175: landing = Danes (admin 1111), 9/9 sekcij živo (KPI / izjeme / pregled / sistem), deep-link živ, EN preklop (Today/Sold today...) — glavni i18n dokaz.
- **Opomba**: Prikazna plast nad obstoječimi endpointi (7 virov) — brez lastne API površine; e2e pokritost NI namenska (dokaz = unit pini + živa verifikacija).

### `workspaces-ia` — Workspaces & IA (§6/P0-02) (razširitev)

- **Unit**: `tests/unit/lib/module-registry.test.ts`
- **Brskalnik (živo, sandbox)**: R176: 3 like živo (admin → Skrbnik path; Nina → Natakar path, Blagajna pravilno odsotna; Marko → Kuhinja landing KDS); paleta vrata (Nina "furs" → 0 zadetkov) = §6 regresija živa.
- **Opomba**: Navigacijski model (52-testni drift-gate: register ≡ navItems ≡ moduleComponents ≡ i18n ×5); dostopna vrata ostajajo canAccessModule.

## Legenda

- **Implementirano ✅ koda** = funkcionalnost obstaja v kodi; NE pomeni produkcijske validacije (glej kritično pravilo zgoraj).
- **Unit / Integracija / E2E** = število fs-verified dokaznih datotek (sidra spodaj). Integracija teče na realni PostgreSQL v CI; E2E = Playwright na realnem PG.
- **Brskalnik (živo)** = sandbox živa verifikacija iz rund (P5 = zlati tok; R### = poročila na issue #144). Ni produktivni ekvivalent realne naprave.
- **N/A** = kanal za to zmožnost ni relevanten. **☐** = kanal je relevanten, a NI validiran (fizična validacija je ločen obseg — `physicalValidationStatus` v PRODUCT-STATUS.md).
- **Pilot ☐** = ni pilotnih podatkov (`pilotStatus.executed = false`). Ne trditi pilotne pripravljenosti brez izvedenega pilota (epik §16).

## Anti-overclaim

- FURS je koda-complete + sim-mode strukturno validiran — **NOT PHYSICALLY VALIDATED** z realnim FURS okoljem (mTLS/JWS/EOR).
- Plačilni terminal, tiskalnik, KDS device in realne zunanje storitve niso fizično validirani v tem repozitoriju.
- Vsak nadaljnji ✓ v tabeli zahteva NOV dokaz (test datoteka / živa verifikacija z rundno referenco) — ne sodbo.
