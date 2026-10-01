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
  "statusUpdatedRound": "R192 (epik #144, P2 faza — FULL SWEEP tech debt zaključek: vseh 31 preostalih no-explicit-any supresij v 22 fajlih → RATCHET = 0 (90 pred R190 − 40 R190 − 19 R191 − 31 R192) — KATERAKOLI nova supresija v src/ zdaj prelomi CI: (A) fallback-create vzorec 7× (setup/init 5 + public/order 1 + online-order 1): data literal z locationId: withLoc ? locationId : undefined castan na UNCHECKED create-input (Prisma.DiningOption/VoidReason/NoSaleReason/PrepStationUncheckedCreateInput), vzorec dokumentiran v src/lib/prisma-column-fallback.ts (undefined = polje ni podano — Neon drift-most, run(false) veja NE sme podati locationId); (B) stale casti 5× odstranjeni (kot $transaction + tx.kotDocument ×2, fire-action tx.kotDocument, scheduledEmailLog v scheduled-emails + lib/email — generated client ima vse modele); (C) DecimalLike kontrakt 5× (payments reverseGiftCard/reverseLoyaltyPoints amount: number — reversalBase.amount = round2(...), stock PostCreationOrderData.total, qr-upsell price, cash-register netPaymentAmount strukturni { amount; refundAmount }); (D) Prisma boundary 4× (post-handler nested + course create BREZ casta — OrderItemData.modifiersJson: string, pravi kontrakt: schema stolpec je STRING + zod z.string(); order-mutations created = Prisma.OrderItemGetPayload include menuItem; put-handler deliveryInfo Json stolpec → { address: string } kontrakt, || '' ohranja staro runtime semantiko); (E) strukturni kontrakti 6× (configuration item: unknown, admin/migrate LocationBackfillDelegate — 27 modelov, Shift namerno v catch, redis-adapter eval v RedisClient interfacu — Lua [count, ttl], gift-cards Create/Update/LoadGiftCardVariables reakt-query kontravariantnost); (F) seed orodja 4× (InvItem Record<string, unknown>, CategoryRef/ModifierRef index unknown, seed/route menuItems = Prisma.MenuItem vrstica, demo-data param DecimalLike — prej 'number' prikrit s any[]); trajni drift-gate: NOV tests/unit/security/r192-any-zero.test.ts 36 testov (26 fajlov čistih 0 supresij + 0 psevdo-any, kanonski tipi/kontrakti pinani, GLOBALNI RATCHET = 0, + IT-flake varovalke); IT-flake FIX: test-admin fixture (r137/r140) create veja pustila default pin '' (@unique) → r150 employee.create (default '') P2002, ko je vitestov NE-determinističen vrstni red tekel r137/r140 PRED r150 (~50 % runov) — fixture zdaj reproducira seed (pin '1111'), r150 ima RUN_ID pin (#133 norm), 3 varovalke v r192 testu; pini r190+r191 usklajena na ≤ 0. LEKCIJA (R191 ponovitev): komentarji v slice fajlih NE citirajo supresijskih literalov — tudi PRE-OBSTOJEČ komentar v configuration/_helpers (citiral star dinamičen dostop) je moral čist; odkrito takoj po svojem lastnem cleanliness testu; druga lekcija: Omit+optional pomožni tip NI dodeljiv Prisma XOR Without<> uniji — direkten cast na Unchecked input je comparable in dodeljiv; tretja: OrderItemData.modifiersJson je STRING (JSON-encoded), ne InputJsonValue — Prisma napaka je razkrila pravi kontrakt. Doc-truth sync: PRODUCT-STATUS R192 (headCommitAtStatus 7d742986, testEvidence 303f/5527 + security podmnožica 109f/2109, unitTotalWithSecurity 5527 — R177-d invarianta; ciLastFileBasedProof → CI run 36842754916 @ 7d742986 (R191 drevo): 7/7 jobov + Monitor ×2 + E2E run 36842754861 — 234/4, številke iz CI logov: Unit 302f/5491 + subset 108f/2073, IT 23f/235, E2E-sec 96 — ZERO delta; R192 delta +1f/+36) · PRODUCTION-VALIDATION §2 @ 7d742986 + zgodovina R192 + skip sweep re-verificiran (15 e2e / 0 unit+IT, nespremenjeno) · README tests badge 5527 + audit badge razvoj-192 + evidence vrstica + napredek sidro 5527/303 · product-status pin R192+R191 · doc-truth round pin R192 (negativni R191/R190/R189). Gates: tsc 0 (2×) · lint 0 · unit 303f/5527/0 (2× čist) · IT 23f/235/0 (2× sveža IT DB — flake stabilnost potrjena) · verify 30/30 · chain+inventory+matrix regen 0-diff. Živa verifikacija: src refaktor TYPE-ONLY (runtime semantika 0 sprememb — tipi se izbrišejo ob kompilaciji; unit testi teknejo REALNE funkcije z novimi tipi, IT + E2E na CI pokrivajo žive rute vključno kot/KOT + payments/POS + gift-cards UI potjo). Epik #144: P0/P1/P2 (koraki 1–23) VSI OPRAVLJENI + sweep rundi + tech debt FULL SWEEP zaključen (ratchet 90 → 0); naslednja runda: proof refresh @ R192 push run + KNOWN_ISSUES #33/#36 / closure review / nov scope.",
  "headCommitAtStatus": "7d742986",
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
    "unit": { "files": 303, "tests": 5527 },
    "unitSecuritySuite": { "files": 109, "tests": 2109 },
    "unitTotalWithSecurity": 5527,
    "integration": { "files": 23, "tests": 235 },
    "e2ePlaywright": { "passed": 234, "skipped": 4 },
    "e2eSecurity": 96,
    "ciVerification": "lokalna vrata ×2 (R172) = vir unit/integration števil; CI run za trenutni HEAD potrdi enaka vrata ob pushu (vitest štetje je deterministično na istem drevesu)",
    "ciLastFileBasedProof": "HEAD 7d742986 (R191) — CI run 36842754916: 7/7 jobov success attempt=1 (Unit 302f/5491 = vključno security podmnožica 108f/2073 po R177-d semantiki, Integration 23f/235, E2E Security 96, Lint&Typecheck, Build, Migration, Security Audit) + Monitor ×2 success + E2E run 36842754861 — E2E 234 passed/4 skipped (core-flow GOLDEN PATH §7 22/22 na realnem PG); številke iz CI logov; R191 (P2 faza — tech debt sweep: kanonski EodReportData wire tip za 10 EOD komponent + 9 supresij iz FURS batch/Z-report/dashboard/receipts, ratchet ≤ 31) CI-potrjen z ZERO delta (CI ≡ lokalna vrata R191); R192 (FULL SWEEP: vseh 31 preostalih supresij → ratchet 0 + IT-flake pin fix) doda +1f/+36 testov → lokalna vrata 303f/5527 — CI ob pushu potrdi enaka vrata na trenutnem drevesu; §2 tabelo dokumentira PRODUCTION-VALIDATION.md (osvežena R192)",
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
    "ENCRYPTION_KEY v Vercel envs + db:encrypt-secrets po deployu (R168, uporabniški korak — fail-closed brez njega)"
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
