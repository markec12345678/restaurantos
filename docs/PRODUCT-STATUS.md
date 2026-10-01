# PRODUCT STATUS — avtoritativni vir produktnega statusa

> **ISSUE #144 (§12 — One authoritative product status).** Ta datoteka je EDINI avtoritativni
> vir za odgovore na: trenutna verzija, commit, okolje, test evidence, znane omejitve,
> integracije, fizična validacija, pilot, blockerji. Ostali dokumenti (README, ARCHITECTURE,
> checkliste) SE NANAŠAJO sem in ne smejo duplirati teh trditev z zastarelimi števili.
>
> **Kanon:** Repository truth > assumptions · Evidence > claims · Green CI ≠ production validation.
> Podrobna CI/run dokazna veriga: [PRODUCTION-VALIDATION.md §2](./PRODUCTION-VALIDATION.md).

## Machine-readable status

```json
{
  "name": "restaurantos",
  "version": "1.26.0",
  "versionSource": "package.json",
  "statusDocVersion": 1,
  "statusUpdated": "2026-10-01",
  "statusUpdatedRound": "R196 (epik #144 — osvežitev dokaza @ R195 push run): ciLastFileBasedProof → CI run 36871730253 @ 2addbb92 (R195 pushed drevo) — 10/10 check-runov success (CI 7/7 jobov attempt=1: Security Audit, Lint & Typecheck, Migration, Unit 305f/5561 = vključno security podmnožica 110f/2127, Build, Integration 24f/248, E2E Security 96 + E2E run 36871730155 — 234 passed/4 skipped + Monitor ×2), številke iz CI logov — ZERO delta ŽE NA PUSHED DREVESU (najmočnejša oblika dokaza: CI ≡ lokalna vrata R195 popolnoma, brez delta-okna); R196 je čisto osvežitev dokaza — brez produkcijskih sprememb (+0f/+0; samo dokumentacijski pini: PRODUCTION-VALIDATION §2 'osveženo R196' @ 2addbb92 + zgodovina R196 + skip sweep re-verificiran 15 e2e / 0 unit+IT, nespremenjeno · README audit badge razvoj-196 + evidence vrstica run 36871730253 @ 2addbb92 + napredek segment R196; tests badge 5561 in napredek sidro 5561/305 nespremenjena · product-status pin R196+R195 · doc-truth round pin R196 — negativni R195/R194/R193). Gates: tsc 0 · lint 0 · unit 305f/5561/0 (2× čist) · security podmnožica 110f/2127 · IT 24f/248/0 (sveža IT DB) · verify 30/30 · chain+inventory+matrix+closure regen 0-diff. Živa verifikacija NI-aplikabilna (brez produkcijske kode — samo dokumentacijski pini; E2E na CI pokriva žive poti, 234/4 potrjen @ 2addbb92). Epik #144: §22 closure review 31/32 MET + KNOWN_ISSUES #48 zaprt (package — aplikacija na Neon = uporabniški korak); ostajata #33 (JSON-as-String) / #36 (Shift/StaffShift) — LOW, večji obseg; naslednja runda: #33 / #36 / nov scope po uporabnikovih prioritetah.",
  "headCommitAtStatus": "2addbb92",
  "stack": {
    "framework": "Next.js 16 App Router",
    "language": "TypeScript 5 (strict)",
    "orm": "Prisma 5.22",
    "runtime": "Bun 1.3.x",
    "react": "React 19"
  },
  "productShape": {
    "navigationModules": 76,
    "navigationModulesSource": "src/lib/i18n/navigation/*.ts (nav.* ključi, 5 jezikov sl/en/it/hr/de)",
    "workModes": ["POS", "waiter", "kds", "kiosk", "qr", "qr-menu", "driver", "online-ordering", "reservations"],
    "moduleRegistry": "src/app/components/module-registry.tsx (lazy-loaded component map)",
    "moduleRegistrySourceOfTruth": "src/lib/modules/registry.ts (76 modulov × §6 metadata: group/domain/access/priority/relatedModules/mobile/groupOrder/highlight — epic #144 P0 korak 3 R173 + IA runda R174 + R175 danes kokpit)",
    "moduleRegistryDriftGate": "tests/unit/lib/module-registry.test.ts (52 testov: register ≡ navItems ≡ moduleComponents ≡ i18n ×5 jezikov; canAccessModule pariteta 8 uporabniških likov × 76 modulov; R174: navItems/navGroups derivirana iz registerja, intra-group red element-wise, mobile/highlight sodbe, nav.group.* ×5; R175: danes kokpit pini — registry vrstica, analytics groupOrder 0, landing page.tsx logika, kompozicija 7 endpointov, prefetch + mrtvi /api/orders/stats odstranjen; R176: workspaces — 4 WORKSPACES path/landing pini, ROLE_TO_WORKSPACE ≡ prisma EmployeeRole enum dvosmerno, resolveWorkspaceForUser pariteta + fallback, landing po 8 likih, page.tsx + paleta fs-pini, workspace.* i18n ×5)",
    "moduleRegistryIA": "P0 korak 4 (R174): register POGONI navigacijo — navItems/navGroups derivirana (adapter NAV_ICONS), Sidebar skupinske glave t(labelKey) ×5, KioskBar tabi = register + i18n (moduleConfig divergenca odstranjena)",
    "moduleInventoryDoc": "docs/MODULE-INVENTORY.md (generirano prek 'bun run inventory' — ročno urejanje ni dovoljeno; R174: + Mobilno stolpec)",
    "validationMatrix": "docs/VALIDATION-MATRIX.md (generirano prek 'bun run matrix' — 17 zmožnosti: 9 iz epika §8 + 8 razširitev po realni kodi; vsak ✓ dokazni kanal = fs-verified sidro na realno testno datoteko; realni hardver/plačilo/zunanje storitve/pilot = ☐ ali N/A — anti-overclaim; brskalniški dokazi z rundnimi referencami P5/R172+; drift-gate: tests/unit/lib/validation-matrix.test.ts — commitana datoteka == buildMatrixDoc(), sidra fail-closed) — P0 korak 8 R178",
    "danesCockpit": "P0-01 (R175): modul 'danes' (analytics, groupOrder 0, view_reports, core) — operativni kokpit, ki odgovarja na 9 vprašanj iz P0-01: kompozicija 7 OBSTOJEČIH endpointov (operational-alerts, kitchen, dashboard, cash-register, reservations?upcoming, inventory/menu-stock, outbox) — brez nove API površine, brez izmišljenih metrik; priorite P0-01: ① aktivno stanje (KPI vrstica) ② izjeme z deep-linki (setActiveModule) ③ pregled (smena/rezervacije/zaloge/sistem); landing = 'danes' ob prvem vstopu za admin/manager/view_reports (page.tsx; R176: iz resolveWorkspaceForUser), operativni liki ostanejo na 'orders', kiosk/prodajni način se ne preusmerja",
    "roleWorkspaces": "P0-02 (R176): 4 workspaces (waiter/kitchen/manager/admin) v registry.ts — vir resnice WORKSPACES + ROLE_TO_WORKSPACE (dvosmerno ≡ prisma EmployeeRole enum: admin/manager/staff/chef/kitchen) + resolveWorkspaceForUser (permission fallback za nestandardne role); landing iz workspace.landing (page.tsx): admin/manager/view_reports → danes (P0-01 kanon), chef/kitchen → kitchen KDS (NOVO), staff → orders (no-op); CommandPalette: primarna pot (workspace.path) na vrhu Moduli skupine + glava z workspace labeo (workspace.* i18n ×5); path je SODEBNIK navigacije, dostop ostaja canAccessModule",
    "businessChain": "P0 korak 10 (R180): docs/BUSINESS-CHAIN.md (generirano prek 'bun run chain') — celotna podatkovna veriga menu → recipe → order → KDS → stock → waste → procurement → supplier → cost → finance/reporting razčlenjena na 14 dejstev (11 iz epika §10 tabela + cash-shift/stocktake/audit-infra razširitvi po realni kodi), vsako z source of truth → writers → readers → derived values → audit; VSAKA trditev fail-closed sidrana (Prisma modeli ≡ schema regex, route fajli ≡ existsSync, audit akcije ≡ src/ scan, moduli ≡ §6 register); arhitekturna tveganja A0–A9 VSA REŠENA: A1 (R180: R106 kanon createManualStockTransaction) + A8 (R180: createAuditLog hash veriga) + A3 (R181, CK-5) + A2 (R182: enoten inv-stock lock kanon acquireInvStockLocks) + A7 (R183: enoten reversal kanon recalcCheckAndOrderStatusAfterReversal — refundAmount-zaveden netPaid → storno/partial/paid, order agregacija čez VSE čeke, paidAt ⟺ paid; konsumatorja POST /refund + PUT payments) + A6 (R185: enoten zapiralni kanon smene closeShiftCasIfOpen — CAS updateMany {id, status:'open'} kot EDINA zapiralna vrata čez VSE tri pise: cash-register/[id] PUT (R104), end-of-day closeShift (R110), reports/eod closeShiftTransaction (prej NEPOGOJEN update z read-check TOCTOU double-close); Z-pisi ostajajo v R110 upsert kanonu z advisory ključavnico z-report:{locationId}:{date}); drift-gate: tests/unit/lib/business-chain.test.ts (26 testov: commitana datoteka == buildBusinessChainDoc(), fs-pini kanona + negativni pini starega stanja)"
  },
  "testEvidence": {
    "evidenceSource": "docs/PRODUCTION-VALIDATION.md §2 (CI-log-izpeljano, file-based)",
    "unit": { "files": 305, "tests": 5561 },
    "unitSecuritySuite": { "files": 110, "tests": 2127 },
    "unitTotalWithSecurity": 5561,
    "integration": { "files": 24, "tests": 248 },
    "e2ePlaywright": { "passed": 234, "skipped": 4 },
    "e2eSecurity": 96,
    "ciVerification": "lokalna vrata ×2 (R172) = vir unit/integration števil; CI run za trenutni HEAD potrdi enaka vrata ob pushu (vitest štetje je deterministično na istem drevesu)",
    "ciLastFileBasedProof": "HEAD 2addbb92 (R195) — CI run 36871730253: 7/7 jobov success attempt=1 (Unit 305f/5561 = vključno security podmnožica 110f/2127 po R177-d semantiki, Integration 24f/248, E2E Security 96, Lint&Typecheck, Build, Migration, Security Audit) + Monitor ×2 success + E2E run 36871730155 — E2E 234 passed/4 skipped (core-flow GOLDEN PATH §7 22/22 na realnem PG); številke iz CI logov; R195 (#48 Neon locationId migration package) CI-potrjena z ZERO delta ŽE NA PUSHED DREVESU (CI ≡ lokalna vrata R195 popolnoma, brez delta-okna); R196 (osvežitev dokaza) +0f/+0 — CI ob pushu potrdi enaka vrata na trenutnem drevesu; §2 tabelo dokumentira PRODUCTION-VALIDATION.md (osvežena R196)",
    "verifyFeatures": "30/30 (npx tsx scripts/verify-features.ts)"
  },
  "deployedEnvironment": {
    "platform": "Vercel",
    "demoUrl": "https://restaurantos-theta.vercel.app",
    "demoPinPolicy": "Seed/demo PIN-i (1234/5555/0000) SAMO za demo okolje — produkcija obvezno unikatni močni PIN-i (README)"
  },
  "externalIntegrations": {
    "furs": {
      "mode": "sim-mode (konfigurabilen; realno okolje zahteva certifikat)",
      "physicalValidation": "NOT PHYSICALLY VALIDATED — mTLS/JWS/EOR proti produkcijskemu FURS-u nikoli izvedeno",
      "retryMechanism": "server-side outbox (src/lib/outbox/processors/furs.ts, retry + dead_letter, 48h ZDDV-1)"
    },
    "stripe": "implementiran (test-mode keys; produkcijski keys = uporabniški korak)",
    "smtp": "implementiran (mailjet/SMTP env konfiguracija)",
    "websocket": "kds/waiter real-time (client + gateway)"
  },
  "physicalValidationStatus": {
    "fursProduction": false,
    "paymentTerminal": false,
    "printer": false,
    "kdsDevice": false,
    "note": "Sandbox validira kodo + sim-mode strukturo. Fizična validacija (hardver, realna plačila, realni FURS) je ločen obseg — NI pokrita z CI."
  },
  "pilotStatus": {
    "executed": false,
    "readinessGate": "issue #144 §16 (controlled pilot) — zahteva P0 temelje + realno restavracijo",
    "note": "Ni pilotnih podatkov. Ne trditi pilotne pripravljenosti brez izvedenega pilota."
  },
  "knownBlockers": [
    "FURS certifikat — pridobitev na eDavki portalu (uporabniški korak)",
    "Stripe production keys (uporabniški korak)",
    "FINA P12 certifikat (uporabniški korak)",
    "ENCRYPTION_KEY v Vercel envs + db:encrypt-secrets po deployu (R168, uporabniški korak — fail-closed brez njega)",
    "Neon locationId migration aplikacija (R195 package pripravljen + testiran — uporabniški korak ob dostopu do Neon produkcije)"
  ],
  "knownLimitations": [
    "FURS NI fizično validiran (sim-mode strukturna validacija ≠ produkcijska validacija)",
    "Sandbox ne more graditi produkcije — Buildability dokaz = zeleni CI Build (production) job",
    "IT teče na PGlite (embedded PG) ≠ Neon v produkciji (R127 round-trip IT v CI delno pokriva drift)",
    "i18n: 165/371 živih ključev brez referenc (C2-C, backlog)",
    "modifiersJson dual-write + apiKeys backfill ostanka (C4-a/b, backlog, utemeljena)"
  ],
  "goldenPath": {
    "status": "COMPLETE (E2E, sim-označeno) — P0 korak 7 (R177): tests/e2e/core-flow.spec.ts pokriva CELOTNO §7 verigo v ENEM serial toku (22 testov): Setup (setup/status) → Login (PIN; +401 avtorizacijska vrata na blagajni/Z-poročilu) → Open Shift (blagajniška izmena @ loc-1 prek gp-cashier seeda) → Table → Order + Modifier (modifiersJson 'Ekstra sir', strežniško avtoritativna cena = osnova + 1.5 iz DB) → Fire (firedAt) → KDS → Ready → Serve → Payment (+ Idempotency: replay z istim idempotencyKey = isti payment) → Receipt (ZDDV-1 predogled z modifierjem + tisk) → FURS ⚠️SIMULACIJA (račun ostane pending, fiscalVerified=false, EOR prazen, FURS_VERIFY_FAILED audit — NI produkcijska validacija) → Close (zaprtje izmene; cashDifference = 0; avtomatski Z-osnutek) → Z-report (finalizacija; OPEN_SHIFTS vrata) → Inventory (razknjižba + StockTransaction sale) → Report (EOD totalRevenue/paidOrders/isDayClosed konsistenca) → Audit (CREATE_PAYMENT/CREATE_ORDER). Ostali §7 vidiki po referenci: tenant izolacija = multi-tenant-security.spec, offline/reconnect = outbox-worker.spec, failure path = FURS sim audit. Lokalna vrata: tsc-split 0+0 · lint 0 · unit 291f/5303/0 · IT 23f/235/0 · živa API-interpretacija celotne verige 22/22 korakov (sandbox OOM kanon: polni playwright Lokalno omejen s PGlite/Turbopack pomnilnikom — kanonski e2e dokaz = CI na realnem PG)",
    "target": "issue #144 §7 (Setup→Login→Shift→Table→Order→Modifier→Fire→KDS→Ready→Serve→Payment→Receipt→FURS→Close→Z→Inventory→Report)"
  }
}
```

## Kako uporabljati ta dokument

1. **Verzija**: JSON `version` MORA biti enak `package.json` — to uveljavlja unit test
   `tests/unit/lib/product-status.test.ts` (dokumentacijska resnica je del produktne pravilnosti).
2. **Test evidence**: nikoli ne citiraj števil iz starejših dokumentov (FINAL-SUMMARY,
   PRODUCTION-READINESS-CHECKLIST so zgodovinski) — vedno iz tega JSON-a ali §2.
3. **Fizična validacija**: `physicalValidationStatus.*: false` pomeni — NE trditi "production
   validated" v nobenem materiálju, dokler ni izrecno fizično izvedeno in zabeleženo.
4. **Spremembe statusa**: posodobi JSON v istem commitu kot spremembo, ki jo je povzročila
   (verzija, test števila po gates, blockerji), in povečaj `statusDocVersion` pri strukturni spremembi.

## Zgodovinski dokumenti (NE citirati kot trenutno stanje)

| Dokument | Stanje | Zakaj |
| --- | --- | --- |
| `docs/FINAL-SUMMARY.md` | ZGODOVINSKI (v1.0.3, 2026-09-07) | "965 testov / Production READY" = zgodovinska trditev |
| `docs/PRODUCTION-READINESS-CHECKLIST.md` | ZGODOVINSKI (v1.0.2, 2026-09-06) | "Overall: A+ (Production Ready)" = zgodovinska ocena |
| `docs/PRODUCTION-VALIDATION.md` | ŽIV (evidence kanon) | §2 evidence table + findings register — posodablja se per-round |
| `docs/ARCHITECTURE.md` | ŽIV (struktura) | Modulna tabela mora odsevati dejansko kodo (offline-furs odstranjen R170) |
