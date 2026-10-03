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
  "statusUpdated": "2026-10-03",
  "statusUpdatedRound": "R220 (epik #144 + issue #152 korak 2 — G5 DELETE artikel + G6 reorder auto-prevzem na kanon pariteti @ R219 pushed drevo 8153a048): FIX G5 (INVENTORY-CHAIN.md §5) — DELETE /api/inventory/[id] (soft-delete, quantity → 0 + write-off StockTx) je bil 6. zalogovni pisec mimo R182 kanona: BREZ advisory ključavnice, stale pre-tx quantity na previousQty (sočasna prodaja med readom in tx = prekinjena §21 ledger kontinuiteta) in BREZ audit vnosa. FIX: acquireInvStockLocks PRED tx-fresh re-readom in mutacijo (entitetni kontekst — scoped read + menu/recipe varovalki — izveden pred tx, ključavnica list lock grafa, deadlock nemogoč), tx-fresh scoped re-read (previousQty = dejanska vrednost ob mutaciji — prej stale pre-tx read), CAS updateMany equality nad tx-fresh vrednostjo (0 vrstic → strukturirani 409 — nikoli tiho prepisovanje), Serializable TX_OPTS (redka operacija — brez P2034 tveganja na vroči poti), INVENTORY_DELETE audit (createAuditLog, tx-fresh details, isti shape kot INVENTORY_ADJUST, PCI hash veriga), P2002/P2034 → 409 error kontrakt (pariteta s stockRaceErrorResponse PUT/PATCH). FIX G6 — reorder create-order (avto-prevzem) 7. pisec mimo kanona: acquireInvStockLocks za VSE validne artikle PRED prvim incrementom (sort+dedup+null-skip v helperju; entitetni kontekst — scoped pre-check findMany — pred tx); increment kvantiteto BIT-FOR-BIT varen (negativna zaloga nemogoča), ključavnica serializira update+create per artikel → revizijski vrstici dveh sočasnih prevzemov ISTEGA artikla se ne moreta več preplesti (§21 veriga); previousQty ostane odveden iz post-vrednosti − delta (aritmetično točen). Testi: NOV tests/unit/api/r220-g5-g6-delete-reorder.test.ts 13 (fs-pini: G5 locks import + red ključavnica→tx-fresh→CAS, CAS equality + 409, Serializable TX_OPTS, INVENTORY_DELETE + P2002/P2034 kontrakt; G6 locks pred prvim incrementom; runtime: G5 uspeh lock→re-read→CAS→write-off z tx-fresh previousQty→audit + Serializable opts, CAS 0 vrstic → 409 brez StockTx/audita, tx-fresh 404, menu varovalka 400 pred tx brez ključavnic; G6 uspeh locks (input order, sortiranje v realnem helperju) + procurement 2→5 + scope fail-closed izključitev iz vesolja, canonical REALNI acquireInvStockLocks sortira+dedupira+preskoči null z inv-stock: ključi); r209 drill +2 G5+G6 IT (G5 DELETE 200 → soft-delete vrstica ohranjena + write-off 5→0 totalCost 15.00 + INVENTORY_DELETE audit z previousHash/chainHash; G6 reorder mešan vnos → 201 results+errors fail-closed (tuji artikel 'ni najden') + zaloga 2+3=5 + procurement StockTx 2→5 'Samodejno naročilo') — drill 28/28. INVENTORY-CHAIN.md: G5+G6 ODPRTA → ZAPRTA R220 + §3c vrstici 18/20 + §4 živi dokazi R220 (drill 28). Log-derived dokaz R219 pushed run (ob R220, job-level API): CI 37105862350 7/7 jobov success attempt=1 (Security Audit 111154122444, Lint & Typecheck 111154122547, Unit 111154536766, Migration 111154536788, Integration 111154536791, Build 111154536819, E2E-sec 111154923207) + E2E 37105862439 success attempt=1 (249 passed/4 skipped, log L1073-1074, 3.5m; job 111154123046) + Monitor ×2 (37106133718/37106296454) — NI re-runov; Unit L1024-1025 = 314f/5702, security L1214-1215 = 110f/2127, Integration L755-756 = 27f/294, E2E-sec L1285 = 96 — ZERO delta ×13 zapored R207→R219 (R218 napovedi '+1f/+11' + '+2 G3 IT' TOČNE do številke); vrstični premiki vs R218 run (37069657511): Unit L1025→L1024 (−1), security L1215→L1214 (−1), Integration L756→L755 (−1), E2E L1075→L1073 (−2), E2E-sec L1284→L1285 (+1) — mikro-drifti bidirekcionalni (doc-only runda ne doda testov), poštna opomba (grep po vsebini, nikoli fiksen offset) ostaja. Korekcije: PRODUCT-STATUS R220 (statusUpdatedRound G5/G6 forenzika + R219 ohranjena kot 'Prejšnja runda', headCommitAtStatus → 8153a048, unit 315f/5715, unitTotalWithSecurity 5715, integration 27f/296, ciVerification z R219 push re-enumeracijo ZERO delta ×13 + R220 lokalna vrata (+1f/+13 unit, +2 G5+G6 IT) pričakovana ob pushu, ciLastFileBasedProof → R219 pushed drevo z log-izpeljanimi vrsticnimi referencami vseh 7 jobov), README (badge razvoj-220 + tests 5715/296 + napredek segment R220 + evidence vrstica → CI @ HEAD 8153a048 run 37105862350 ZERO delta ×13), PRODUCTION-VALIDATION §2 osveženo R220 (glava HEAD 8153a048, tabela na R219 push runih 37105862350/37105862439 z job ID-ji + premiki opombe, sweep re-verificirano R220, zgodovina + R220 vrstica); pini: doc-truth.test (§2 'osveženo R220', negativni R219/R218/R217) + product-status.test (R220+R219). Gates: tsc 0 · lint 0 · unit 315f/5715/0 (2× čist na končnem drevesu, +1f/+13) · IT 27f/296/0 (sveža PGlite prek PGLITE_DATA_DIR=/tmp/pglite-data-it node scripts/init-pglite.mjs, en tek; drill 28/28) · verify 30/30 · chain+inventory+matrix+closure regen 0-diff · skip sweep 15 e2e / 0 unit+IT (nespremenjeno). Epik #144 VAL 1: #152 korak 2 G5 R220 + G6 R220 ZAPRTA (G1 R211 + G7 R212 + G4 R214 + G2 R216 + G3 R218 + G5/G6 R220); naslednja runda doc-truth sync na R220 pushed run (napoved: unit 315f/5715 — lokalna vrata točno, IT 27f/296, E2E 249/4, E2E-sec 96); INVENTORY-CHAIN register preostanek: G1 ODPRTA (kozmetična, kandidat), G9/G10 deklarirane ne-implementirane; ostajata #36 + #49 (fix = #157); #141 FURS produkcija = uporabniški korak (certifikat). Prejšnja runda R219 (doc-truth sync na R218 pushed drevo 1150fe41 — ZERO delta ×12): brez produkcijskih sprememb — dokumentacija + 2 pin testna fajla usklajena s CI-verificiranim runom 37069657511 @ 1150fe41 (7/7 jobov success attempt=1 + E2E 37069657459 249/4 + Monitor ×2 — NI re-runov); log-izpeljane številke: Unit L1025-1026 = 314f/5702, security L1215-1216 = 110f/2127, Integration L756-757 = 27f/294, E2E-sec L1284 = 96; SANDBOX LEKCIJA R219: /home/z/restaurantos clone + /tmp + vse ne-kommitane izdaje umrejo na meji sporočil — canon: klon → izdaje → gates → commit → PUSH v enem odgovoru (push = edini trajni medij); IT lekcija: db:init-pglite brez PGLITE_DATA_DIR inicializira DEV dir → IT 42P01 fail vseh fajlov; pravi init z env var = čisto. Gates R219: tsc 0 · lint 0 · unit 314f/5702/0 (2×) · IT 27f/294/0 · verify 30/30 · regen 0-diff · sweep 15/0.",
  "headCommitAtStatus": "8153a048c6fbaa2b39ed5dd2321fdfd3193e0ed2",
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
      "files": 315,
      "tests": 5715
    },
    "unitSecuritySuite": {
      "files": 110,
      "tests": 2127
    },
    "unitTotalWithSecurity": 5715,
    "integration": {
      "files": 27,
      "tests": 296
    },
    "e2ePlaywright": {
      "passed": 249,
      "skipped": 4
    },
    "e2eSecurity": 96,
    "ciVerification": "lokalna vrata ×2 (R172) = vir unit/integration števil; CI run za trenutni HEAD potrdi enaka vrata ob pushu (vitest štetje je deterministično na istem drevesu); e2ePlaywright = zadnji CI-verificiran run (R218 push, 249/4, run 37069657511/37069657459 — R210 push re-enumeriran ob R210 ZERO delta ×4; R211 push re-enumeriran ob R211 ZERO delta ×5; R212 push re-enumeriran ob R213 ZERO delta ×6; R213 push re-enumeriran ob R214 ZERO delta ×7; R214 push re-enumeriran ob R215 ZERO delta ×8; R215 push re-enumeriran ob R216 z log-izpeljanimi številkami — ZERO delta ×9: Unit 312f/5680, IT 27f/289, E2E 249/4, E2E-sec 96 — R215 napoved 'doc-only ≡ ista vrata' TOČNA do številke; R216 push re-enumeriran ob R217 z log-izpeljanimi številkami — ZERO delta ×10: Unit 313f/5691, IT 27f/292, E2E 249/4, E2E-sec 96 — R216 napovedi ('+1f/+11' unit + '+3 G2 IT') TOČNE do številke; R217 push re-enumeriran ob R218 z log-izpeljanimi številkami — ZERO delta ×11: Unit 313f/5691, IT 27f/292, E2E 249/4, E2E-sec 96 — R217 napoved 'doc-only ≡ ISTA vrata' TOČNA do številke; R218 push re-enumeriran ob R219 z log-izpeljanimi številkami — ZERO delta ×12: Unit 314f/5702, IT 27f/294, E2E 249/4, E2E-sec 96 — R218 napovedi ('+1f/+11' unit + '+2 G3 IT') TOČNE do številke; R219 push re-enumeriran ob R220 z log-izpeljanimi številkami — ZERO delta ×13: Unit 314f/5702, IT 27f/294, E2E 249/4, E2E-sec 96 — R219 napoved 'doc-only ≡ ISTA vrata' TOČNA do številke); R220 lokalna vrata: unit 315f/5715 (+1f/+13 NOV r220-g5-g6 unit fajl), IT 27f/296 (+2 G5+G6 IT) — pričakovana ob pushu (R221 doc-truth jih bo re-enumeriral)",
    "ciLastFileBasedProof": "HEAD 8153a048 (R219) — CI run 37105862350: 7/7 jobov success attempt=1 (Security Audit 111154122444, Lint & Typecheck 111154122547, Integration 111154536791, Unit 111154536766, Build 111154536819, Migration 111154536788, E2E-sec 111154923207 — neodvisno enumeriral GitHub API ob R220) + E2E run 37105862439 success attempt=1 (249 passed/4 skipped, log L1073-1074, 3.5m; job 111154123046) + Monitor ×2 (37106133718/37106296454); log-izpeljane številke iz run 37105862350/37105862439 (ZERO delta ×13 z R207–R218 runi in lokalnimi vrati): Unit 314f/5702 (job log L1024-1025, job-level API prenos — poštna opomba: job fajl zaporedje + vrstični offseti se spreminjajo med runi, premiki tudi bidirekcionalni — vedno glob/grep po vsebini, nikoli fiksen offset), security 110f/2127 (L1214-1215), Integration 27f/294 (L755-756), E2E 249 passed/4 skipped (L1073-1074), E2E-sec 96 (L1285); §2 tabelo dokumentira PRODUCTION-VALIDATION.md (osvežena R220)",
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
    "Dual-IndexedDB: SW Background Sync bere drugo bazo (restaurantos-offline v2) kot page (restaurantos-offline-queue v1) — Background Sync end-to-end mrtev, dejanski motor page polling 5s (#49, R203 odkritje; fix = issue #157; KNOWN_ISSUES)"
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
