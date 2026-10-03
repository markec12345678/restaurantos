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
  "statusUpdated": "2026-10-04",
  "statusUpdatedRound": "R230 (doc-truth sync — ZERO delta na R229 pushed runih 37149906574/37149906459 @ 3dbf89da): doc-only runda — PRODUCT-STATUS headCommitAtStatus → 3dbf89da + ciVerification (R229 push re-enumeracija: 4/4 runs success attempt=1 — CI 37149906574 7/7 + E2E 37149906459 SUCCESS 253/4 4.6m + Monitor ×2 37150371049/37150298057) z log-izpeljanimi številkami: Unit L1028-1029 = 318f/5767, security L1218-1219 = 110f/2127, Integration L754-755 = 27f/296, E2E L1088-1089 = 253 passed/4 skipped, E2E-sec L1287 = 97 — R229 napoved 'ob pushu pričakovano unit 318f/5767, IT 27f/296, E2E 253/4, E2E-sec 97' TOČNA do številke; unit ZERO delta obnovljena (R229 +15f je bila namerna funkcionalna prekinitev verige), security/IT/E2E-sec ZERO delta ×24 zapored R207→R229; README badge razvoj-230 + evidence vrstica → run 37149906574 @ 3dbf89da + napredek segment R230; PV §2 osveženo R230 (glava HEAD 3dbf89da, tabela na R229 pushed runih, premiki vs R228 run: Integration L750-751→L754-755 (+4), E2E-sec L1284→L1287 (+3), E2E L1087-1088→L1088-1089 (+1) — mikro-drifti bidirekcionalni, sweep re-verificirano R230); pini: doc-truth (osveženo R230, negativni R229..R226) + product-status (R230+R229). Prejšnja runda R229 (FURS spec compliance — zunanji 'Katalog napak' A1–A5 + B1–B5 + C4/C5 + D3 @ R228 pushed run 37147109611 drevo 774ce11d): funkcionalna runda — 33 trditev preverjenih trditev-po-trditev na pushed drevesu (29 TRUE / 4 partial; merjenje, ne verjetje), 11 popravljenih: (A1) ZOI izhod Base64 → 32 znakov malih hex (ZDDV-1; enaka formula kot pravilni HR ZKI computeZki — md5(podpis).digest('hex')); (A2) vhod podpisa zlepljan z '|' → BREZ lojtr (NOV izvoz zoiInputString za neodvisno preverjanje — vzorec cis/zki.ts zkiInputString); (A3) QR vsebina izmišljen pipe-format → TOČNO 60 numeričnih mest (ZOI hex→dec 39 + davčna 8 + LLMMDDUUMMSS 12 + kontrolni znak vsota mod 10 = 1) z legacy kompatibilnostjo base64 16-bajtnih ZOI zapisov v bazi; (A4) simulirani EOR uppercase → lowercase UUID (r166 pin strict); (A5) Dockerfile runner + openssl (FURS/CIS execFileSync('openssl') — pkcs12 + JWS identiteta); (B1) daemon.js prej vsiljen NODE_ENV 'development' (FURS boot guard se nikoli ne sproži) → ohrani klicateljevo okolje, privzeto production; (B2) engines node >=18 → >=22 (CI pin 22, devcontainer 24, Docker node:26); (B3) download/openapi.yaml drift → byte-identen mirror root openapi.yaml; (B4) devcontainer npm install → Bun-only (oven/bun feature + bun install --frozen-lockfile + bun run); (B5) PM2 max_memory_restart 512M → 1536M; (C4) docker-compose PG/Redis vrata → 127.0.0.1 loopback; (C5) seed-admin.mjs SANDBOX-ONLY banner; (D3) FURS testi prej pin-ali implementacijo (length 10–60) → po specifikaciji: zoi.test.ts 8→11 (hex32 regex, točen zlepljen niz brez lojtr, MD5-podpis re-izračun, fallback formatna pariteta, lokalni čas vsebinsko) + NOV r229-furs-qr60-spec.test.ts 12 (60 števk, decimalni zeropad 39, LLMMDDUUMMSS, kontrolni znak, legacy base64, UPPERCASE kompat, napake, EOR lowercase UUID). Preskočene trditve z utemeljitvijo (potrjene, a izven obsega runde): A6/D4 realna validacija = uporabniški korak (certifikat/procesor #141), B6/C2/C3/C6/C7/C8 arhitekturne/poslovne odločitve (boot guard + CI vrata obstojeta), C1 history rewrite, D1/D2 E2E unskip = ločena test-infra runda (lekcija R226–R228), E1–E8 repo higiena. +15f unit (318f/5767 — +3 zoi spec + +12 NOV r229 fajl), IT 27f/296 nespremenjeno, E2E-sec 97, E2E 253 passed/4 skipped (CI-verificirano ob R230: R229 push run 37149906459 SUCCESS 253/4 — R229 napoved točna do številke).",
  "headCommitAtStatus": "3dbf89dab990104c8f1be105f6f41a3a958ee6b8",
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
    "workModes": [
      "POS",
      "waiter",
      "kds",
      "kiosk",
      "qr",
      "qr-menu",
      "driver",
      "online-ordering",
      "reservations"
    ],
    "moduleRegistry": "src/app/components/module-registry.tsx (lazy-loaded component map)",
    "moduleRegistrySourceOfTruth": "src/lib/modules/registry.ts (76 modulov × §6 metadata: group/domain/access/priority/relatedModules/mobile/groupOrder/highlight — epic #144 P0 korak 3 R173 + IA runda R174 + R175 danes kokpit)",
    "moduleRegistryDriftGate": "tests/unit/lib/module-registry.test.ts (52 testov: register ≡ navItems ≡ moduleComponents ≡ i18n ×5 jezikov; canAccessModule pariteta 8 uporabniških likov × 76 modulov; R174: navItems/navGroups derivirana iz registerja, intra-group red element-wise, mobile/highlight sodbe, nav.group.* ×5; R175: danes kokpit pini — registry vrstica, analytics groupOrder 0, landing page.tsx logika, kompozicija 7 endpointov, prefetch + mrtvi /api/orders/stats odstranjen; R176: workspaces — 4 WORKSPACES path/landing pini, ROLE_TO_WORKSPACE ≡ prisma EmployeeRole enum dvosmerno, resolveWorkspaceForUser pariteta + fallback, landing po 8 likih, page.tsx + paleta fs-pini, workspace.* i18n ×5)",
    "moduleRegistryIA": "P0 korak 4 (R174): register POGONI navigacijo — navItems/navGroups derivirana (adapter NAV_ICONS), Sidebar skupinske glave t(labelKey) ×5, KioskBar tabi = register + i18n (moduleConfig divergenca odstranjena)",
    "moduleInventoryDoc": "docs/MODULE-INVENTORY.md (generirano prek 'bun run inventory' — ročno urejanje ni dovoljeno; R174: + Mobilno stolpec)",
    "validationMatrix": "docs/VALIDATION-MATRIX.md (generirano prek 'bun run matrix' — 17 zmožnosti: 9 iz epika §8 + 8 razširitev po realni kodi; vsak ✓ dokazni kanal = fs-verified sidro na realno testno datoteko; realni hardver/plačilo/zunanje storitve/pilot = ☐ ali N/A — anti-overclaim; brskalniški dokazi z rundnimi referencami P5/R172+; drift-gate: tests/unit/lib/validation-matrix.test.ts — commitana datoteka == buildMatrixDoc(), sidra fail-closed) — P0 korak 8 R178",
    "danesCockpit": "P0-01 (R175) + #148 korak 1 (R203) + korak 2 (R204): modul 'danes' (analytics, groupOrder 0, view_reports, core) — operativni kokpit, ki odgovarja na 9 vprašanj iz P0-01: kompozicija 7 OBSTOJEČIH endpointov (operational-alerts, kitchen, dashboard, cash-register, reservations?upcoming, inventory/menu-stock, outbox) — brez nove API površine, brez izmišljenih metrik; R203 pravilnost: state stroj per vir (src/lib/danes/cockpit-state.ts — LOADING/READY/EMPTY/ERROR/UNAUTHORIZED, ERROR ≠ EMPTY ≠ UNAUTHORIZED), capability matrica (resolveDanesCapabilities, pariteta z auth-middleware — viri brez dovoljenj se ne kličejo), tipizirano ALERT_TARGET_MODULE usmerjanje nad 8 tipi (hevristika odstranjena), page-state UNAUTHORIZED/ERROR/PARTIAL/READY, per-kartica ERROR stanja z retry, drift-gate tests/unit/lib/danes-cockpit-state.test.ts (45 testov); R204 business time: 'danes' meja v alerts = ljubljanaDayBounds kanon (strežniška TZ odstranjena), rezervacijski čas + glava LJ-pinned (ljubljanaDateTimeParts/ljubljanaTodayStr; browser TZ odstranjena), timezone test gates 19 testov (CET/CEST/DST×2/letna meja/00–02h rob/UTC→LJ) + negativni browser E2E tests/e2e/danes-cockpit.spec.ts (10 testov: 500×7 → ERROR ≠ EMPTY, 403 → UNAUTHORIZED ≠ EMPTY, izolacija virov, EMPTY/READY kontrol); priorite P0-01: ① aktivno stanje (KPI vrstica) ② izjeme z deep-linki (setActiveModule) ③ pregled (smena/rezervacije/zaloge/sistem); landing = 'danes' ob prvem vstopu za admin/manager/view_reports (page.tsx; R176: iz resolveWorkspaceForUser), operativni liki ostanejo na 'orders', kiosk/prodajni način se ne preusmerja",
    "roleWorkspaces": "P0-02 (R176): 4 workspaces (waiter/kitchen/manager/admin) v registry.ts — vir resnice WORKSPACES + ROLE_TO_WORKSPACE (dvosmerno ≡ prisma EmployeeRole enum: admin/manager/staff/chef/kitchen) + resolveWorkspaceForUser (permission fallback za nestandardne role); landing iz workspace.landing (page.tsx): admin/manager/view_reports → danes (P0-01 kanon), chef/kitchen → kitchen KDS (NOVO), staff → orders (no-op); CommandPalette: primarna pot (workspace.path) na vrhu Moduli skupine + glava z workspace labeo (workspace.* i18n ×5); path je SODEBNIK navigacije, dostop ostaja canAccessModule",
    "businessChain": "P0 korak 10 (R180): docs/BUSINESS-CHAIN.md (generirano prek 'bun run chain') — celotna podatkovna veriga menu → recipe → order → KDS → stock → waste → procurement → supplier → cost → finance/reporting razčlenjena na 14 dejstev (11 iz epika §10 tabela + cash-shift/stocktake/audit-infra razširitvi po realni kodi), vsako z source of truth → writers → readers → derived values → audit; VSAKA trditev fail-closed sidrana (Prisma modeli ≡ schema regex, route fajli ≡ existsSync, audit akcije ≡ src/ scan, moduli ≡ §6 register); arhitekturna tveganja A0–A9 VSA REŠENA: A1 (R180: R106 kanon createManualStockTransaction) + A8 (R180: createAuditLog hash veriga) + A3 (R181, CK-5) + A2 (R182: enoten inv-stock lock kanon acquireInvStockLocks) + A7 (R183: enoten reversal kanon recalcCheckAndOrderStatusAfterReversal — refundAmount-zaveden netPaid → storno/partial/paid, order agregacija čez VSE čeke, paidAt ⟺ paid; konsumatorja POST /refund + PUT payments) + A6 (R185: enoten zapiralni kanon smene closeShiftCasIfOpen — CAS updateMany {id, status:'open'} kot EDINA zapiralna vrata čez VSE tri pise: cash-register/[id] PUT (R104), end-of-day closeShift (R110), reports/eod closeShiftTransaction (prej NEPOGOJEN update z read-check TOCTOU double-close); Z-pisi ostajajo v R110 upsert kanonu z advisory ključavnico z-report:{locationId}:{date}); drift-gate: tests/unit/lib/business-chain.test.ts (26 testov: commitana datoteka == buildBusinessChainDoc(), fs-pini kanona + negativni pini starega stanja)"
  },
  "testEvidence": {
    "evidenceSource": "docs/PRODUCTION-VALIDATION.md §2 (CI-log-izpeljano, file-based)",
    "unit": {
      "files": 318,
      "tests": 5767
    },
    "unitSecuritySuite": {
      "files": 110,
      "tests": 2127
    },
    "unitTotalWithSecurity": 5767,
    "integration": {
      "files": 27,
      "tests": 296
    },
    "e2ePlaywright": {
      "passed": 253,
      "skipped": 4
    },
    "e2eSecurity": 97,
    "ciVerification": "R229 push re-enumeriran ob R230 z log-izpeljanimi številkami — napoved POTRJENA (ZERO delta zapis): CI run 37149906574 7/7 success attempt=1 + E2E run 37149906459 SUCCESS attempt=1 (253 passed/4 skipped, 4.6m — R229 napoved 'ob pushu pričakovano unit 318f/5767, IT 27f/296, E2E 253 passed/4 skipped, E2E-sec 97' točna do številke; DOPOLNITEV potrjena) + Monitor ×2 (37150371049/37150298057); produkcijske suite številke ZERO delta ×24 zapored R207→R229: Unit 318f/5767 (unit ZERO delta obnovljena — R229 +15f je bila namerna funkcionalna prekinitev verige ×23, nova raven), IT 27f/296, E2E-sec 97; R230 lokalna vrata: doc-only runda (doc-truth sync) — ob pushu pričakovano IDENTNA vrata unit 318f/5767, IT 27f/296, E2E 253 passed/4 skipped, E2E-sec 97 — potrditev v DOPOLNITVI (R231); lokalna vrata ×2 (R172) = vir unit/integration števil; CI run za trenutni HEAD potrdi enaka vrata ob pushu (vitest štetje je deterministično na istem drevesu); e2ePlaywright = zadnji ZELEN CI-verificiran run (R229 push, 253/4, run 37149906459)",
    "ciLastFileBasedProof": "HEAD 3dbf89da (R229) — CI run 37149906574: 7/7 jobov success attempt=1 (Lint & Typecheck 111281344570, Security Audit 111281344788, Unit 111281697742, Integration 111281697717, Migration 111281697756, Build 111281697683, E2E-sec 111282201632 — neodvisno enumeriral GitHub API ob R230) + E2E run 37149906459 SUCCESS attempt=1 (job 111281344268; 4.6m — E2E 253 passed/4 skipped, log L1088-1089 — R229 napoved 'unit 318f/5767, IT 27f/296, E2E 253/4, E2E-sec 97' POTRJENA) + Monitor ×2 (37150371049/37150298057); log-izpeljane številke iz run 37149906574/37149906459 (ZERO delta ×24 za unit/security/IT/E2E-sec z R207–R229 runi in lokalnimi vrati; R229 +15f = namerna funkcionalna prekinitev ×23, veriga se nadaljuje na novi ravni 318f/5767): Unit 318f/5767 (job log L1028-1029, job-level API prenos — poštna opomba: job fajl zaporedje + vrstični offseti se spreminjajo med runi, premiki tudi bidirekcionalni — vedno glob/grep po vsebini, nikoli fiksen offset; job 'Unit Tests (1300+)' požene OBA suite-a — L1028-1029 = unit 318f/5767 + L1218-1219 = security 110f/2127; job 'Security Audit' je npm-audit pregled brez test suite-a), Integration 27f/296 (job log L754-755 — premik +4 vs R228 run L750-751), E2E-sec 97 (L1287 — premik +3 vs R228 run L1284), E2E 253 passed/4 skipped (L1088-1089 — premik +1 vs R228 run L1087-1088); §2 tabelo dokumentira PRODUCTION-VALIDATION.md (osvežena R230)",
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
    "modifiersJson dual-write + apiKeys backfill ostanka (C4-a/b, backlog, utemeljena)",
    "Offline sync browser E2E pokritost: scenariji #150 (restart/mount-sync + multi-tab koordinacija + syncMetadata zapisnik) pokriti R226 (epik #157 korak 3 — tests/e2e/r226.setup.ts + r226-offline-sync.spec.ts A/B/C; setup projekt + chromium dependency; page-side poti — SW 'sync' eventa ni mogoče deterministično sprožiti v Playwright); epik #157 zaključen (R222 korak 1 SW=sprožilec/page=izvajalec + R224 korak 2 metadata store/Web Locks/BroadcastChannel + R226 korak 3 browser E2E); ostaja LOW #36 arhitektura"
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
