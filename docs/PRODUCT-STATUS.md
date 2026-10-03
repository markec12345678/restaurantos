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
  "statusUpdatedRound": "R224 (epik #157 korak 2 — metadata store + migracijska veriga v1→v2 + več-zavihkova koordinacija synca, @ R223 pushed run 37122170266 drevo aec9bd5b): Funkcionalna runda — preostanek KNOWN_ISSUES #49 'Ostaja' (korak 1 R222 je zaprl dual-DB defekt; korak 2 zapira strukturro+koordinacijski preostanek): (1) syncMetadata store — canonical baza 'restaurantos-offline-queue' verzija 1→2 z migracijsko verigo (onupgradeneeded doda store obstoječim v1 bazam — pendingOrders podatki nedotaknjeni; sveže v2 = oba store-a), KV zapisnik keyPath 'key': META_LAST_SYNC_RESULT ('lastSyncResult' — izid synca: succeeded/conflicts/authExpired/processed/at) + META_LEGACY_MIGRATION ('legacySwMigration' — revizijski zapis migrateLegacySwDb: migrated/archived/at); (2) koordinacija — runCoordinatedSync: EDINA vstopna točka za samodejne sprožilce (polling 5s, 'online' event, SW TRIGGER_ORDER_SYNC — prej: N odprtih zavihkov = N vzporednih syncAllOfflineOps, dvojni toasti/POST-i in PROCESSING po vseh): Web Locks (navigator.locks, SYNC_LOCK_NAME, ifAvailable) drži izvajanje na TOČNO ENEM zavihku — ostale dobijo skipped:true brez HTTP klicev; brez Web Locks podpore tiha degradacija (direkten sync — idempotencyKey ostaja strežniško varovalo); izid se zapiše v syncMetadata + BroadcastChannel (SYNC_BROADCAST_CHANNEL, SYNC_BROADCAST_COMPLETED 'OFFLINE_SYNC_COMPLETED') obvesti ostale zavihke — useOrderPanelMutations subscribeSyncBroadcast → invalidateQueries orders (brez toastov — izvorna zavihka že obvesti); handleOnline → runCoordinatedSync s skipped guard (tiho predaja); ročni retry (syncSingleOrder) ostaja neposreden (uporabnikova akcija na enem vnosu); (3) sw.js NIKOLI spremenjen (kanon koraka 1 intact — paritetni pini r222 zeleni); testi: NOV tests/unit/offline/r224-sync-coordination.test.ts 17 (VERSIONIRAN fake IndexedDB z per-name izolacijo + onupgradeneeded/createObjectStore po spec-obliki — lekcija R222 uporabljena: minimalni fake deli store ČREZ imena; upgrade veriga: sveža v2 = oba store-a + indeksi, v1→v2 = meta store dodan + živi PENDING vnos OHRANJEN, toleranca v2-brez-meta = getMeta null/setMeta false brez tihe kreacije; koordinacija: lock prost = sync enkrat + zapisnik + broadcast, lock zaseden = skipped true + zero-result + BREZ HTTP/BREZ meta zapisa, brez lockov = direkten sync, celoten tok = PENDING→SYNCED + serverAck + broadcast succeeded=1, subscribe normalizacija/dostava, BC odsoten = no-op degradacija); pini posodobljeni: indexeddb-stores (COUNT 1→2), r222 (verzija 1→2, store array, hook pin runCoordinatedSync — syncAllOfflineOps ostaja notranji izvajalec znotraj koordinatorja), verify-features (store matrika 2); funkcionalna LEKCIJA: FakeRequest mora sprožiti onsuccess TUDI za manjkajoči ključ (result null — spec IndexedDB), sicer branje META obstane; test-seeding vrstni red: freshModule() čisti fake-registry → seed ŠELE potem (prvi tek je ulovil 4 napake, korektirano pred commitom). Gates: tsc 0 · lint 0 · unit 317f/5752/0 (2× čist, +1f/+17) · IT 27f/296/0 (sveža PGlite; drill 28/28) · verify 30/30 · chain+inventory+matrix+closure regen 0-diff · skip sweep 15 e2e / 0 unit+IT (nespremenjeno). Prejšnja runda R223 (doc-truth sync na R222 pushed run 37119106732 @ ad990666 — ZERO delta ×16): brez produkcijskih sprememb — dokumentacija + 2 pin testna fajla usklajena s CI-verificiranim runom; log-izpeljane številke: Unit L1025-1026 = 316f/5735 (R222 napoved '+1f/+20' TOČNA), security L1215-1216 = 110f/2127, Integration L754-755 = 27f/296, E2E L1072-1073 = 249/4, E2E-sec L1284 = 96 — ZERO delta ×16 zapored R207→R222.",
  "headCommitAtStatus": "aec9bd5b8daa26658eaaa4cba5ef055ce6353b34",
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
      "files": 317,
      "tests": 5752
    },
    "unitSecuritySuite": {
      "files": 110,
      "tests": 2127
    },
    "unitTotalWithSecurity": 5752,
    "integration": {
      "files": 27,
      "tests": 296
    },
    "e2ePlaywright": {
      "passed": 249,
      "skipped": 4
    },
    "e2eSecurity": 96,
    "ciVerification": "lokalna vrata ×2 (R172) = vir unit/integration števil; CI run za trenutni HEAD potrdi enaka vrata ob pushu (vitest štetje je deterministično na istem drevesu); e2ePlaywright = zadnji CI-verificiran run (R222 push, 249/4, run 37119106732/37119106731 — R210 push re-enumeriran ob R210 ZERO delta ×4; R211 push re-enumeriran ob R211 ZERO delta ×5; R212 push re-enumeriran ob R213 ZERO delta ×6; R213 push re-enumeriran ob R214 ZERO delta ×7; R214 push re-enumeriran ob R215 ZERO delta ×8; R215 push re-enumeriran ob R216 z log-izpeljanimi številkami — ZERO delta ×9: Unit 312f/5680, IT 27f/289, E2E 249/4, E2E-sec 96 — R215 napoved 'doc-only ≡ ista vrata' TOČNA do številke; R216 push re-enumeriran ob R217 z log-izpeljanimi številkami — ZERO delta ×10: Unit 313f/5691, IT 27f/292, E2E 249/4, E2E-sec 96 — R216 napovedi ('+1f/+11' unit + '+3 G2 IT') TOČNE do številke; R217 push re-enumeriran ob R218 z log-izpeljanimi številkami — ZERO delta ×11: Unit 313f/5691, IT 27f/292, E2E 249/4, E2E-sec 96 — R217 napoved 'doc-only ≡ ISTA vrata' TOČNA do številke; R218 push re-enumeriran ob R219 z log-izpeljanimi številkami — ZERO delta ×12: Unit 314f/5702, IT 27f/294, E2E 249/4, E2E-sec 96 — R218 napovedi ('+1f/+11' unit + '+2 G3 IT') TOČNE do številke; R219 push re-enumeriran ob R220 z log-izpeljanimi številkami — ZERO delta ×13: Unit 314f/5702, IT 27f/294, E2E 249/4, E2E-sec 96 — R219 napoved 'doc-only ≡ ISTA vrata' TOČNA do številke; R220 push re-enumeriran ob R221 z log-izpeljanimi številkami — ZERO delta ×14: Unit 315f/5715, IT 27f/296, E2E 249/4, E2E-sec 96 — R220 napovedi ('+1f/+13' unit + '+2 G5+G6 IT') TOČNE do številke; R221 push re-enumeriran ob R222 z log-izpeljanimi številkami — ZERO delta ×15: Unit 315f/5715, IT 27f/296, E2E 249/4, E2E-sec 96 — R221 napoved 'doc-only ≡ ISTA vrata' TOČNA do številke; R222 push re-enumeriran ob R223 z log-izpeljanimi številkami — ZERO delta ×16: Unit 316f/5735, IT 27f/296, E2E 249/4, E2E-sec 96 — R222 napoved '+1f/+20' TOČNA do številke; R223 push re-enumeriran ob R224 z log-izpeljanimi številkami — ZERO delta ×17: Unit 316f/5735, IT 27f/296, E2E 249/4, E2E-sec 96 — R223 napoved 'doc-only ≡ ISTA vrata' TOČNA do številke); R224 lokalna vrata: funkcionalna runda #157 korak 2 (+1f/+17 unit — NOV r224-sync-coordination 17; IT/E2E/E2E-sec nespremenjeni) — ob pushu pričakovano Unit 317f/5752, IT 27f/296, E2E 249/4, E2E-sec 96, potrditev v DOPOLNITVI",
    "ciLastFileBasedProof": "HEAD aec9bd5b (R223) — CI run 37122170266: 7/7 jobov success attempt=1 (Lint & Typecheck 111200285398, Security Audit 111200285533, Unit 111200704719, Integration 111200704663, Migration 111200704673, Build 111200704630, E2E-sec 111201044379 — neodvisno enumeriral GitHub API ob R224) + E2E run 37122170292 success attempt=1 (249 passed/4 skipped, log L1074-1075, 3.6m; job 111200285443) + Monitor ×2 (37122436556/37122602264); log-izpeljane številke iz run 37122170266/37122170292 (ZERO delta ×17 z R207–R222 runi in lokalnimi vrati): Unit 316f/5735 (job log L1025-1026, job-level API prenos — poštna opomba: job fajl zaporedje + vrstični offseti se spreminjajo med runi, premiki tudi bidirekcionalni — vedno glob/grep po vsebini, nikoli fiksen offset), security 110f/2127 (L1215-1216), Integration 27f/296 (L756-757), E2E 249 passed/4 skipped (L1074-1075), E2E-sec 96 (L1285); §2 tabelo dokumentira PRODUCTION-VALIDATION.md (osvežena R224)",
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
