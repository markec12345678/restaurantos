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
  "statusUpdated": "2026-10-02",
  "statusUpdatedRound": "R215 (doc-truth sync na R214 pushed drevo 3db433d9 — ZERO delta ×8): brez produkcijskih sprememb — dokumentacija + 2 pin testna fajla usklajena s CI-verificiranim runom 37047402237 @ 3db433d9 (7/7 jobov success attempt=1: Lint & Typecheck 110972117245, Security Audit 110972117398, Unit 110973113260, Build 110973113276, Migration 110973113299, Integration 110973113398, E2E-sec 110974120301) + E2E run 37047402213 success attempt=1 (249 passed/4 skipped, log L1073-1074, 2.9m) + Monitor ×2 (37047881669/37048388763); log-izpeljane številke: Unit L1022-1023 = 312f/5680, security L1231-1232 = 110f/2127, Integration L753-754 = 27f/289, E2E-sec L1285 = 96 — R214 napovedi ('+1f/+6' unit + '+2 G4' IT pričakovano ob pushu) TOČNE do številke. Prejšnja runda R214 (epik #144 + issue #152 korak 2 — G4 batch-PUT adjust kanon pariteta @ R213 pushed drevo 32f60225): FIX G4 (docs/INVENTORY-CHAIN.md §5, vrzel zaprta) — batch-PUT razknjižba (PUT /api/inventory/adjust) je bila dokumentirana izjema kanonu (P3 era): lastna tx na default izolaciji, BREZ advisory ključavnic (sočasni pisalci ISTEGA artikla niso bili serializirani — lost-update okno okrog CAS), BREZ FEFO batch razknjižbe (serije ostale inconsistentne z zalogo po batch odpisu), BREZ AuditLog, re-read po raw id, brez P2002/P2034 kontrakta. FIX: kanon pariteta — acquireInvStockLocks :166 (R182 vesolj: sort+dedup+null-skip, receive-kanon vzorec — vse ključavnice PRED prvo mutacijo = deadlock-free ordering), Serializable TX_OPTS :19-22 (pariteta s POST kanonom, 10 s timeout), recordBatchConsumption :267 per uspešen odpis (R120 sale-safety: napaka alokacije ne podre odpisa; alokacija = negativen quantity po kanonski konvenciji), createAuditLogsBatch :283 (INVENTORY_ADJUST per uspešen odpis — tx-fresh previousQty/newQty/itemName, isti details shape kot POST :92-105, PCI hash veriga; skip artikli se NE revidirajo kot odpis — poskus viden v StockTx POSKUS vrstici :214), scoped re-read :235 (prej findUnique po raw id), P2002/P2034 → 409 :305-313 (pariteta s POST); P3 atomarni vzorec (updateMany gte :198) OSTANE ključni CAS, skipped semantika BIT-FOR-BIT nespremenjena. Testi: r209 drill +2 G4 IT (batch write-off 4 → zaloga 8→4, StockTx −4 totalCost 8.00, FEFO LOT-G4-B −3 EXHAUSTED + LOT-G4-A −1, alokacije na ISTI StockTx, INVENTORY_ADJUST audit tx-fresh; mixed batch — skip 999>20 → attempt qty 0 + 'Premalo zaloge', skip BREZ alokacije in audita) — drill 21/21; NOV tests/unit/api/r214-batch-adjust.test.ts 6 (lock dedup sorted pin, TX_OPTS Serializable pin, recordBatchConsumption call-arg, audit per-success + skip→ni audita, scoped re-read pin, P2034→409); inventory-adjust P3 (4) mocki posodobljeni + re-read findUnique→findFirst pin. INVENTORY-CHAIN.md: G4 ODPRTA → ZAPRTA R214 + §2 vrstica 51 + §3c pisalec 17 + §4 živi dokazi R214 G4 + §7 (drill 21, r214 unit). Gates: tsc 0 · lint 0 · unit 312f/5680/0 (2× čist, +1f/+6) · IT 27f/289/0 (sveža PGlite, drill 21/21) · verify 30/30 · regen 0-diff · sweep 15/0 · E2E dim r151 5/5 (39.6 s; 1. tek na sveži e2e bazi flakal S28-2 na warm-up kompilaciji — lekcija R207/R212, topla baza = čisto). Epik #144 VAL 1: #152 korak 2 G4 ZAPRTA (G1 R211 + G7 R212 + G4 R214); naslednja runda #152 korak 2 nadaljevanje po prioriteti vrzel (G2 business-day bucketiranje — usklajeno z #148; G3/G5/G6 nizka prioriteta); ostajata #36 + #49 (fix = #157).",
  "headCommitAtStatus": "3db433d96a7aaf7ed33f6260ecbf730fb0d070af",
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
      "files": 312,
      "tests": 5680
    },
    "unitSecuritySuite": {
      "files": 110,
      "tests": 2127
    },
    "unitTotalWithSecurity": 5680,
    "integration": {
      "files": 27,
      "tests": 289
    },
    "e2ePlaywright": {
      "passed": 249,
      "skipped": 4
    },
    "e2eSecurity": 96,
    "ciVerification": "lokalna vrata ×2 (R172) = vir unit/integration števil; CI run za trenutni HEAD potrdi enaka vrata ob pushu (vitest štetje je deterministično na istem drevesu); e2ePlaywright = zadnji CI-verificiran run (R213 push, 249/4, run 37039477517/37039479653 — R210 push re-enumeriran ob R210 ZERO delta ×4; R211 push re-enumeriran ob R211 ZERO delta ×5; R212 push re-enumeriran ob R213 ZERO delta ×6; R213 push re-enumeriran ob R214 z log-izpeljanimi številami — ZERO delta ×7: Unit 311f/5674, IT 27f/287, E2E 249/4, E2E-sec 96 — R213 napoved 'doc-only ≡ ista vrata' TOČNA do številke; R214 push re-enumeriran ob R215 z log-izpeljanimi številami — ZERO delta ×8: Unit 312f/5680, IT 27f/289, E2E 249/4, E2E-sec 96 — R214 napovedi '+1f/+6' + '+2 G4 IT' TOČNI do številke); R215 lokalna vrata ≡ R214 CI vrata (doc-only) — pričakovano ob pushu ISTA vrata",
    "ciLastFileBasedProof": "HEAD 3db433d9 (R214) — CI run 37047402237: 7/7 jobov success attempt=1 (Lint & Typecheck 110972117245, Security Audit 110972117398, Unit 110973113260, Build 110973113276, Migration 110973113299, Integration 110973113398, E2E-sec 110974120301 — neodvisno enumeriral GitHub API ob R215) + E2E run 37047402213 success attempt=1 (249 passed/4 skipped, log L1073-1074) + Monitor ×2 (37047881669/37048388763); log-izpeljane številke iz run 37047402237/37047402213 (ZERO delta ×8 z R207–R213 runi in lokalnimi vrati): Unit 312f/5680 (job log L1022-1023, job-level API prenos — poštna opomba: job fajl zaporedje + vrstični offseti se spreminjajo med runi — vedno glob/grep po vsebini, nikoli fiksen offset), security 110f/2127 (L1231-1232 — prestavljeno vs R213 L1211-1212: unit job log zrasel za r214 test), Integration 27f/289 (L753-754 — prestavljeno vs R213 L752-753), E2E 249 passed/4 skipped (L1073-1074 — prestavljeno vs R213 L1072-1073), E2E-sec 96 (L1285 — prestavljeno vs R213 L1284); §2 tabelo dokumentira PRODUCTION-VALIDATION.md (osvežena R215)",
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
