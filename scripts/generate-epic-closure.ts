// ============================================
// GENERATOR: docs/EPIC-144-CLOSURE-REVIEW.md (§22 closure review, epik #144, R193)
// ============================================
//
// Epik #144 §22 "Recommended execution order" je po rundah R170–R192 izveden
// (P0 koraki 1–9, P1 koraki 10–19, P2 koraki 20–23 + tech debt sweep R190–R192
// do ratchet 0). Ta generator IZVAJA closure review §22 checkliste: vsako od 32
// postavk (Product structure 6 · Core operation 3 · Data integrity 4 ·
// Offline/recovery 4 · Production validation 4 · Documentation 5 · Pilot 3 ·
// Security 3) preslika na REPO DOKAZE — datoteke/teste/dokumente, ki MORAJO
// obstajati (fail-closed ob generaciji).
//
// NAČELA (fail-closed, kanon #144):
//  - Vsak dokazni sidro je preverjen ob generaciji: neobstoječa pot = generator
//    PADÉ z izpisom VSEH napak (brez "duh" sidr).
//  - Statusi so SUROVI: MET (dokazano izpolnjena), MET-OR (izpolnjena po
//    "or" veji druge alternative), N/A-IZRECNO (neizpolnjena, ampak pogoj
//    objektivno ne more obstajati — izrecno zabeleženo, nikoli tiho).
//  - ANTI-OVERCLAIM: closure review = preslikava repository truth; NI trditev
//    produkcijske validacije (FURS certifikat, realno plačilo, hardver, pilot
//    ostajajo izrecno NE-izvedeni — glej VALIDATION-MATRIX §8 + PRODUCT-STATUS).
//  - DETERMINISTIČNO: brez timestampov / naključja — regeneracija na istem
//    drevesu je BITNIČNO ENAKA (gate: `bun run closure && git diff --exit-code
//    docs/EPIC-144-CLOSURE-REVIEW.md` + unit drift-gate, ki primerja commitano
//    datoteko z buildEpicClosureDoc()).
//
// Dokumenta NE urejati ročno — spremeni ITEMS in regeneriraj.
//
// Zaženi: bun run closure   (= npx tsx scripts/generate-epic-closure.ts)
// ============================================

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { MODULE_REGISTRY } from '../src/lib/modules/registry'

// ── Tipi ────────────────────────────────────────────────────────────

/** Status postavke §22 checkliste (surovi, anti-overclaim). */
export type ClosureStatus = 'MET' | 'MET-OR' | 'N/A-IZRECNO'

/** Posamezna postavka §22 checkliste epika #144. */
export interface ClosureItem {
  id: string
  /** Sekcija §22 (natančen naslov kot v issue telesu). */
  section: string
  /** Originalno angleško besedilo postavke (verbatim iz issue #144 §22). */
  text: string
  status: ClosureStatus
  /** Dokazne poti v repozitoriju — MORAJO obstajati na disku (fail-closed). */
  paths: string[]
  /** Razlaga dokaza z rundnimi referencami (R170–R193). */
  note: string
}

// ── Sekcije §22 ─────────────────────────────────────────────────────

export const SECTION_ORDER = [
  'Product structure',
  'Core operation',
  'Data integrity',
  'Offline / recovery',
  'Production validation',
  'Documentation',
  'Pilot',
  'Security',
] as const

// ── 32 postavk §22 checkliste preslikanih na repo dokaze ────────────

export const ITEMS: ClosureItem[] = [
  // ══ Product structure (§22 P0 koraki 1–4; R173–R176) ══
  {
    id: 'ps-inventory',
    section: 'Product structure',
    text: 'All existing 75 modules are inventoried.',
    status: 'MET',
    paths: [
      'src/lib/modules/registry.ts',
      'docs/MODULE-INVENTORY.md',
      'scripts/generate-module-inventory.ts',
      'tests/unit/lib/module-registry.test.ts',
    ],
    note:
      'Ob pisanju epika je obstajalo 75 modulov; danes jih MODULE_REGISTRY šteje DINAMIČNO (validacija: > 0 + invarianta ≡ navItems ≡ moduleComponents ≡ i18n ×5). Inventar je GENERIRAN prek `bun run inventory` (ročno urejanje ni dovoljeno), drift-gate 52 testov (R173 P0 korak 3).',
  },
  {
    id: 'ps-no-loss',
    section: 'Product structure',
    text: 'No implemented capability is silently lost.',
    status: 'MET',
    paths: [
      'docs/PRODUCT-VIDEO-STORYBOARD.md',
      'tests/unit/security/r188-video-storyboard.test.ts',
      'docs/MODULE-INVENTORY.md',
    ],
    note:
      'R188 (P2 korak 21): priloga A storyboard-a je popolna preslikava VSEH registry modulov (53 Da + 2 izbirno + 21 Ne z razlogom — programsko generirana, nič tiho izpuščeno); drift-gate test preverja pokritost 76/76 modulov (natančen backtick-id match). Inventar (+ bez razlogom) pokriva isto lastnost na strani registerja.',
  },
  {
    id: 'ps-nav-hierarchy',
    section: 'Product structure',
    text: 'Main navigation follows a coherent business hierarchy.',
    status: 'MET',
    paths: [
      'src/lib/modules/registry.ts',
      'docs/MODULE-INVENTORY.md',
      'tests/unit/lib/module-registry.test.ts',
    ],
    note:
      'R174 (P0 korak 4): register POGONI navigacijo — navItems/navGroups derivirana iz §6 metadata (group/domain/groupOrder/highlight), sidebar skupinske glave t(labelKey) ×5 jezikov; intra-group red element-wise pinan. Kandidat je bil WIP 75-modulni flat seznam — zdaj hierarchy-by-construction.',
  },
  {
    id: 'ps-work-modes',
    section: 'Product structure',
    text: 'Special work modes remain easy to enter.',
    status: 'MET',
    paths: [
      'src/lib/modules/registry.ts',
      'src/components/pos/KioskBar.tsx',
      'tests/unit/lib/module-registry.test.ts',
    ],
    note:
      'Work modes (POS, waiter, kds, kiosk, qr, qr-menu, driver, online-ordering, reservations) ostajajo prvo-razredni v registerju; R174: KioskBar tabi = register + i18n (moduleConfig divergenca odstranjena) — način vnosa je deriviran iz istega vira resnice kot navigacija.',
  },
  {
    id: 'ps-role-workflows',
    section: 'Product structure',
    text: 'Role-specific workflows are obvious.',
    status: 'MET',
    paths: [
      'src/lib/modules/registry.ts',
      'src/app/page.tsx',
      'tests/unit/lib/module-registry.test.ts',
    ],
    note:
      'R176 (P0 korak 6): 4 workspaces (waiter/kitchen/manager/admin) — WORKSPACES + ROLE_TO_WORKSPACE dvosmerno ≡ prisma EmployeeRole enum + resolveWorkspaceForUser (permission fallback); landing po vlogi (page.tsx): admin/manager/view_reports → danes, chef/kitchen → kitchen KDS, staff → orders.',
  },
  {
    id: 'ps-palette-consistency',
    section: 'Product structure',
    text: 'Command palette / sidebar / module inventory are consistent.',
    status: 'MET',
    paths: [
      'src/components/pos/command-palette/CommandPalette.tsx',
      'src/lib/modules/registry.ts',
      'tests/unit/lib/module-registry.test.ts',
    ],
    note:
      'R176: CommandPalette primarna pot (workspace.path) na vrhu Moduli skupine + glava z workspace labeo; R174: navItems/navGroups derivirana iz registerja — palette, sidebar in inventar so vsi derivirani iz ISTEGA §6 vira (drift-gate 52 testov uveljavlja pariteto register ≡ navItems ≡ moduleComponents ≡ i18n ×5).',
  },

  // ══ Core operation (§22 P0 korak 5–7 + P1; R175, R177) ══
  {
    id: 'co-golden-path',
    section: 'Core operation',
    text: 'Golden Path is executable end-to-end.',
    status: 'MET',
    paths: [
      'tests/e2e/core-flow.spec.ts',
      'docs/PRODUCT-STATUS.md',
      'playwright.config.ts',
    ],
    note:
      'R177 (P0 korak 7): celotna §7 veriga Setup → Login → Open Shift → Table → Order → Modifier → Fire → KDS → Ready → Serve → Payment → Receipt → FURS → Close → Z-report → Inventory → Report je EN serial E2E dokaz (22/22 na realnem PG); FURS segment je izrecno SIMULACIJA (NI produkcijska validacija — anti-overclaim pin ostaja).',
  },
  {
    id: 'co-chain-verified',
    section: 'Core operation',
    text: 'Table → order → kitchen → payment → receipt → close is verified.',
    status: 'MET',
    paths: [
      'tests/e2e/core-flow.spec.ts',
      'tests/e2e/flow-variants.spec.ts',
      'tests/e2e/observability.spec.ts',
    ],
    note:
      'CI run 36850932388 @ 99f14c86 (R192 drevo): Playwright 234 passed / 4 skipped (core-flow + flow-variants + observability + multi-tenant-security); kuhinjska/plačilna/račun/zapiralna pot je pokrita tudi na IT nivoju (tests/integration/ — 23 fajlov / 235 testov, realna PGlite DB).',
  },
  {
    id: 'co-layers-connect',
    section: 'Core operation',
    text: 'Operational and management layers connect to the same business data.',
    status: 'MET',
    paths: [
      'src/components/pos/danes/DanesCockpit.tsx',
      'src/lib/modules/registry.ts',
      'docs/BUSINESS-CHAIN.md',
    ],
    note:
      'R175 (P0 korak 5): kokpit `danes` odgovarja na 9 vprašanj P0-01 s kompozicijo 7 OBSTOJEČIH endpointov (operational-alerts, kitchen, dashboard, cash-register, reservations?upcoming, inventory/menu-stock, outbox) — brez nove API površine in brez izmišljenih metrik; R180 business-chain dokazuje, da operativne in poročevalske plasti berejo ISTE Prisma vire (14 dejstev fail-closed).',
  },

  // ══ Data integrity (§22 P0 korak 10 + P1 koraki 11–14; R180–R185) ══
  {
    id: 'di-relationships',
    section: 'Data integrity',
    text: 'Menu / recipe / stock / order / payment / receipt / procurement/reporting relationships are verified.',
    status: 'MET',
    paths: [
      'docs/BUSINESS-CHAIN.md',
      'scripts/generate-business-chain.ts',
      'tests/unit/lib/business-chain.test.ts',
    ],
    note:
      'R180 (P0 korak 10): BUSINESS-CHAIN.md = generiran register 14 dejstev (11 iz epika §10 + 3 razširitve po realni kodi), vsako z verigo source of truth → writers → readers → derived values → audit, VSAKA trditev fail-closed sidrana (Prisma modeli ≡ schema regex, poti ≡ existsSync, audit akcije ≡ src scan).',
  },
  {
    id: 'di-no-competing-sot',
    section: 'Data integrity',
    text: 'No critical business fact has unexplained competing sources of truth.',
    status: 'MET',
    paths: [
      'docs/BUSINESS-CHAIN.md',
      'tests/unit/security/r182-stock-lock-canon.test.ts',
      'tests/unit/security/r183-payment-status-canon.test.ts',
      'tests/unit/security/r185-shift-close-canon.test.ts',
    ],
    note:
      'Register arhitekturnih tveganj A0–A9 v BUSINESS-CHAIN.md — VSA rešena: A1 R180 (transactions POST na R106 kanon), A2 R182 (enoten inv-stock lock kanon), A3 R181 (CK-5 checks kanon), A6 R185 (enoten zapiralni kanon smene closeShiftCasIfOpen), A7 R183 (enoten reversal kanon plačilnega statusa), A8 R180 (createAuditLog hash-verižni kanon); A0/A4/A5/A9 deklarirano rešeni po zasnovi.',
  },
  {
    id: 'di-audit-evidence',
    section: 'Data integrity',
    text: 'Audit evidence exists for critical changes.',
    status: 'MET',
    paths: [
      'src/lib/db.ts',
      'src/app/api/audit/verify-chain/route.ts',
      'tests/integration/r148-audit-retention.test.ts',
    ],
    note:
      'createAuditLog = EDINI pisalni kanon od R180 (2 direktni izjemi migrirani — A8) s SHA-256 hash verigo (previousHash|action|entityType|entityId|userId|details → chainHash); verifiakcija verige živi na /api/audit/verify-chain; ledger princip izrecno dokumentiran (StockTransaction/LoyaltyTransaction/GiftCardTransaction vrstice = revizijska sled).',
  },
  {
    id: 'di-concurrency',
    section: 'Data integrity',
    text: 'Concurrency and duplicate-submit cases are tested.',
    status: 'MET',
    paths: [
      'tests/unit/security/concurrency-p19.test.ts',
      'tests/unit/security/r106-inventory-stock-concurrency.test.ts',
      'tests/unit/security/r109-checks-payments-concurrency.test.ts',
      'tests/unit/security/r110-eod-zreport-concurrency.test.ts',
      'tests/integration/r128-offline-exactly-once.test.ts',
    ],
    note:
      'Concurrenci serija r102–r112 (gift-cards, qr-pay/cash-shift, PO receive, inventory, timeoff, orders/tables, checks/payments, EOD/Z, KOT/FURS/loyalty, webhook) + P19; advisory ključavnice (R106 inv-stock ključ, z-report advisory, paymentCheckLockKey) + CAS updateMany + idempotencyKey @unique (offline exactly-once); duplicate-submit = idempotency + P2002 varovalke (IT-flake fix R192).',
  },

  // ══ Offline / recovery (§22 P1 korak 10; R128 + P5) ══
  {
    id: 'off-supported-doc',
    section: 'Offline / recovery',
    text: 'Supported offline operations are documented and verified.',
    status: 'MET',
    paths: [
      'src/lib/offline-orders/index.ts',
      'src/app/api/orders/_helpers/offline-ledger.ts',
      'tests/unit/offline/r128-offline-cancel-ops.test.ts',
      'docs/PRODUCTION-VALIDATION.md',
    ],
    note:
      'Obseg po zasnovi dokumentiran (VALIDATION-MATRIX `offline` vrstica + PRODUCTION-VALIDATION §7 S12): orders/cancel offline-safe (IndexedDB + ledger exactly-once); verifikacija = 3 unit fajla (tests/unit/offline/) + IT exactly-once + chaos test offline-burst.',
  },
  {
    id: 'off-blocked',
    section: 'Offline / recovery',
    text: 'Offline-blocked operations are clearly identified.',
    status: 'MET',
    paths: [
      'docs/VALIDATION-MATRIX.md',
      'docs/PRODUCTION-VALIDATION.md',
      'tests/unit/lib/validation-matrix.test.ts',
    ],
    note:
      'VALIDATION-MATRIX offline vrstica izrecno: "payment in Daily Close offline-BLOCKED (PRODUCTION-VALIDATION.md §7 S12)"; matrika je generirana (bun run matrix) z drift-gate testom — blokade ne more tiho izginiti.',
  },
  {
    id: 'off-reconnect',
    section: 'Offline / recovery',
    text: 'Reconnect does not create duplicate business events.',
    status: 'MET',
    paths: [
      'tests/integration/r128-offline-exactly-once.test.ts',
      'src/lib/offline-orders/index.ts',
      'src/app/api/orders/_helpers/offline-ledger.ts',
    ],
    note:
      'R128: IT dokaz exactly-once semantike na realni DB — Order.idempotencyKey @unique je server-side dedup ključ; offline ledger + review queue (tests/unit/offline/offline-review-queue.test.ts) zagotavljata, da reconnect/sync NE ustvari duplikatov poslovnih dogodkov.',
  },
  {
    id: 'off-restart',
    section: 'Offline / recovery',
    text: 'Restart/refresh recovery is tested.',
    status: 'MET',
    paths: [
      'tests/unit/lib/indexeddb-stores.test.ts',
      'tests/unit/websocket/ws-reconnect-p21.test.ts',
      'tests/integration/r127-backup-restore-roundtrip.test.ts',
    ],
    note:
      'IndexedDB store persistenca (offline queue preživi refresh/restart brskalnika) + WebSocket reconnect testi (P1-21) + backup/restore roundtrip na realni DB (R127 — disaster-recovery kanal); chaos test 6.1 offline-burst preverja obnašanje pod strezijo.',
  },

  // ══ Production validation (§22 P0 korak 8 + §8; R178) ══
  {
    id: 'pv-separated',
    section: 'Production validation',
    text: 'Software-test evidence is separated from physical/production evidence.',
    status: 'MET',
    paths: [
      'docs/VALIDATION-MATRIX.md',
      'docs/PRODUCTION-VALIDATION.md',
      'docs/PRODUCT-STATUS.md',
      'tests/unit/lib/validation-matrix.test.ts',
    ],
    note:
      'R178 (P0 korak 8): VALIDATION-MATRIX §8 = živ dokazni register 17 zmožnosti — vsak ✓ dokazni kanal = fs-verified sidro; realni hardver/plačilo/zunanje storitve/pilot = ☐ ali N/A (anti-overclaim); PRODUCT-STATUS physicalValidationStatus ima VSE fizične kanale false (drift-gated).',
  },
  {
    id: 'pv-furs-limits',
    section: 'Production validation',
    text: 'FURS limitations are explicitly documented.',
    status: 'MET',
    paths: [
      'docs/PRODUCT-STATUS.md',
      'docs/PRODUCTION-VALIDATION.md',
      'docs/PRODUCT-VIDEO-STORYBOARD.md',
    ],
    note:
      'FURS certifikacija = izrecno knownBlockers postavka (pridobitev na eDavki portalu — uporabniški korak); goldenPath status nosi SIMULACIJA pin za FURS segment; video storyboard (R188) izrecno ne trdi certifikacije; R190–R192 tipizacija FURS jedre = dokaz tipovne pravilnosti, NE produkcijska validacija.',
  },
  {
    id: 'pv-real-payment',
    section: 'Production validation',
    text: 'Real payment/hardware/printer validation is independently tracked.',
    status: 'MET',
    paths: [
      'docs/VALIDATION-MATRIX.md',
      'docs/PRODUCT-STATUS.md',
    ],
    note:
      'Realno plačilo (Stripe production keys), tiskalnik, KDS device = ☐ kanali v VALIDATION-MATRIX + fizični kanali false v PRODUCT-STATUS physicalValidationStatus + Stripe production keys v knownBlockers — vse ločeno od software-test evidence (R178 anti-overclaim pravilo "Green CI ≠ production validation").',
  },
  {
    id: 'pv-pilot-tracked',
    section: 'Production validation',
    text: 'Pilot validation is separately tracked.',
    status: 'MET',
    paths: [
      'docs/PRODUCT-STATUS.md',
      'docs/VALIDATION-MATRIX.md',
    ],
    note:
      'PRODUCT-STATUS pilotStatus = ločena machine-readable sekcija (executed: false, readinessGate: §16 controlled pilot — zahteva P0 temelje + realno restavracijo; izrecno: "Ne trditi pilotne pripravljenosti brez izvedenega pilota"); VALIDATION-MATRIX pilot stolpec ločen.',
  },

  // ══ Documentation (§22 P0 koraki 2, 9 + P2 koraki 20–22; R172, R179, R187–R189) ══
  {
    id: 'doc-agree',
    section: 'Documentation',
    text: 'README and architecture docs agree with the code.',
    status: 'MET',
    paths: [
      'tests/unit/lib/doc-truth.test.ts',
      'tests/unit/lib/product-status.test.ts',
      'README.md',
      'docs/ARCHITECTURE.md',
    ],
    note:
      'R179 (P0 korak 9): doc-truth drift-gate — README badge ≡ PRODUCT-STATUS testEvidence ≡ PRODUCTION-VALIDATION §2 (isti CI run); PRODUCT-STATUS §12 = EDINI avtoritativni vir statusa; vsaka runda osveži dokazno verigo iz CI logov (runda-odporna konvencija).',
  },
  {
    id: 'doc-historical',
    section: 'Documentation',
    text: 'Historical documents are labeled historical.',
    status: 'MET',
    paths: [
      'docs/RELEASE-SUPPORT-INDEX.md',
      'tests/unit/security/r189-release-support.test.ts',
      'docs/FINAL-SUMMARY.md',
    ],
    note:
      'R189 (P2 korak 22): enoten inventar z statusi AKTIVEN/ZGODOVINSKI/GENERIRAN po vrsticah + drift-gate test statusnih pinov; R188/R189 forenzika: ZGODOVINSKI banneri na FINAL-SUMMARY, PRODUCTION-READINESS-CHECKLIST, PRODUCTION-CHECKLIST, PRODUCTION-LAUNCH-CHECKLIST, VIDEO-TUTORIALS (vsebina arhivska nedotaknjena, kazalci na žive vire).',
  },
  {
    id: 'doc-removed-paths',
    section: 'Documentation',
    text: 'Removed architecture paths are removed from current docs.',
    status: 'MET',
    paths: [
      'tests/unit/lib/product-status.test.ts',
      'docs/ARCHITECTURE.md',
      'README.md',
    ],
    note:
      'R170: izbrisana offline-furs arhitektura — negativni pini v product-status testu uveljavljajo, da ARCHITECTURE.md in README ne opisujeta več izbrisanih poti kot živih; doc-truth gate blokira vračanje zastarelih trditev.',
  },
  {
    id: 'doc-creds',
    section: 'Documentation',
    text: 'Customer-facing docs contain no ambiguous test credentials.',
    status: 'MET',
    paths: [
      'docs/CLIENT-ONBOARDING-GUIDE.md',
      'tests/unit/lib/product-status.test.ts',
      'docs/PRODUCT-VIDEO-STORYBOARD.md',
      '.github/SUPPORT.md',
    ],
    note:
      'R188: VIDEO-TUTORIALS (stari "PIN: 1234 (admin)" brez markacije) → ZGODOVINSKI + DEMO / TEST ONLY opozorilo; storyboard demo kredence izrecno DEMO / TEST ONLY + demoPinPolicy; R189: SUPPORT.md demo kredenca kultura; CLIENT-ONBOARDING-GUIDE označuje demo PIN-e + navaja unikatne, močne PIN-e za produkcijo (drift-gated).',
  },
  {
    id: 'doc-version-backed',
    section: 'Documentation',
    text: 'Version/status claims are evidence-backed.',
    status: 'MET',
    paths: [
      'docs/PRODUCT-STATUS.md',
      'SECURITY.md',
      'tests/unit/lib/product-status.test.ts',
      'tests/unit/security/r189-release-support.test.ts',
    ],
    note:
      'PRODUCT-STATUS: versionSource = package.json (version drift test), statusUpdated/headCommitAtStatus/testEvidence/ciLastFileBasedProof = vse iz CI logov; R189: SECURITY.md Supported Versions ≡ package.json major.minor (trajno drift-proof ob naslednjem bumpu); checkliste z starimi "READY/CI 5/5" trditvami = ZGODOVINSKI banner.',
  },

  // ══ Pilot (§22 P1 korak 18 + §16; readiness gate) ══
  {
    id: 'pilot-gate',
    section: 'Pilot',
    text: 'A real controlled pilot has been executed or a concrete pilot-readiness gate is documented.',
    status: 'MET-OR',
    paths: [
      'docs/PRODUCT-STATUS.md',
      'docs/VALIDATION-MATRIX.md',
    ],
    note:
      'Izpolnjena po DRUGI veji "or": realen pilot NI izveden (pilotStatus.executed = false — izrecno, drift-gated), konkretna pilot-readiness vrata pa SO dokumentirana (readinessGate = issue #144 §16 controlled pilot: zahteva P0 temelje + realno restavracijo; produkcija postavka seed/PIN-i ločeno sledena). Prva veja ostaja odprta za lastnika produkta.',
  },
  {
    id: 'pilot-findings',
    section: 'Pilot',
    text: 'Pilot findings are converted into actionable repository issues/tests.',
    status: 'N/A-IZRECNO',
    paths: [
      'docs/KNOWN_ISSUES.md',
      'docs/PRODUCT-STATUS.md',
    ],
    note:
      'Pilot NI izveden → pilotnih ugotovitev OBJEKTIVNO NI (ničesar za konvertirati) — postavka ni "met" in se ne pretvarja. Kanal za konverzijo obstaja in je definiran: KNOWN_ISSUES.md register (delujoč tok: #33/#36 shema-dolg, #32/#37/#45/#47 …) + GitHub issue tracker + test-dokazna praksa rund; akcijsko postane takoj ob izvedbi pilota (pilot-gate vrata §16).',
  },
  {
    id: 'pilot-workflows-evidence',
    section: 'Pilot',
    text: 'Common restaurant workflows have measurable evidence.',
    status: 'MET',
    paths: [
      'tests/e2e/core-flow.spec.ts',
      'tests/e2e/flow-variants.spec.ts',
      'docs/VALIDATION-MATRIX.md',
    ],
    note:
      'Merljivost = CI številke na vsakem pushu: Unit 303f/5527 + IT 23f/235 (realna DB) + E2E 234 passed / 4 skipped + E2E-sec 96 (run 36850932502 @ 99f14c86); zlati pot + variante + multidomenski IT drills (kiosk, display, driver, loyalty, gift-cards, tips, accounting-export...) = najpogostejši restavracijski tokovi z izmerjenim dokazom.',
  },

  // ══ Security (§22 P1 korak 19 + P0-C serija; R80+ — R192) ══
  {
    id: 'sec-rbac-tenant',
    section: 'Security',
    text: 'Critical auth/RBAC/tenant-isolation paths are regression tested.',
    status: 'MET',
    paths: [
      'tests/unit/security/idor-cross-tenant.test.ts',
      'tests/unit/security/permission-matrix.test.ts',
      'tests/e2e/multi-tenant-security.spec.ts',
      'tests/unit/security/concurrency-p19.test.ts',
    ],
    note:
      'Security suite = 109 fajlov / 2109 testov (podmnožica unit joba, CI log run 36850932502) + E2E-sec 96: P0-C1 IDOR cross-tenant, P0-C2 resolveTenantLocationId, P0-C3 FURS location source of truth, P0-C4 klasifikacija + migracije, P0-C5 ApiKey; permission-matrix pariteta likov × modulov; rate-limit, webhook dedup scope, idempotency tenant boundary.',
  },
  {
    id: 'sec-external-boundaries',
    section: 'Security',
    text: 'External integration boundaries are verified.',
    status: 'MET',
    paths: [
      'src/lib/furs/types.ts',
      'tests/unit/security/furs-cross-tenant.test.ts',
      'tests/unit/security/r117-webhook-dedup-scope.test.ts',
      'tests/unit/security/r116-idempotency-tenant-boundary.test.ts',
    ],
    note:
      'FURS integracijska jedra (verify/storno/Z/batch) tipizirana z realnimi domenskimi tipi (R190–R192 — tsc dokaz tipovne pravilnosti čez celotno aplikacijo, ratchet 0); furs-cross-tenant + webhook-dedup-scope + idempotency-tenant-boundary testi pokrivajo meje; ANTI-OVERCLAIM: tipizacija + testi ≠ produkcijska validacija z realnim FURS strežnikom (certifikacija = knownBlockers).',
  },
  {
    id: 'sec-independent',
    section: 'Security',
    text: 'Independent security validation is tracked separately.',
    status: 'MET',
    paths: [
      'SECURITY.md',
      'docs/KNOWN_ISSUES.md',
      'docs/PRODUCT-STATUS.md',
    ],
    note:
      'Ločeno sledenje obstaja: SECURITY.md (Supported Versions ≡ package.json, reporting kanal), KNOWN_ISSUES.md register (MEDIUM/LOW odprte težave z statusi — #32/#31/#45/#37/#33/#36), PRODUCT-STATUS knownBlockers. NEVEDNOST se ne skriva: neodvisna zunanja validacija (pentest) NI izvedena — to je ločen proces zunaj repozitorija, sledenje pa je repo-truth odgovornost, ki jo ta postavka zahteva.',
  },
]

// ── Validacija (fail-closed) ────────────────────────────────────────

const REPO = process.cwd()

/** Pričakovano število postavk po sekciji (§22 checkliste, verbatim). */
export const SECTION_COUNTS: Record<string, number> = {
  'Product structure': 6,
  'Core operation': 3,
  'Data integrity': 4,
  'Offline / recovery': 4,
  'Production validation': 4,
  Documentation: 5,
  Pilot: 3,
  Security: 3,
}

function validateItems(): void {
  const errors: string[] = []

  // 1. vsaka pot obstaja na disku
  for (const item of ITEMS) {
    if (item.paths.length === 0) {
      errors.push(`${item.id}: fail-closed — vsaj 1 dokazna pot je obvezna`)
    }
    for (const p of item.paths) {
      if (!existsSync(join(REPO, p))) {
        errors.push(`${item.id}: dokazna pot NE OBSTAJA: ${p}`)
      }
    }
    if (item.note.trim().length < 20) {
      errors.push(`${item.id}: note je prekratka za dokazno trditev`)
    }
  }

  // 2. sekcije ≡ pričakovane številke (§22 verbatim struktura)
  const counts: Record<string, number> = {}
  for (const item of ITEMS) counts[item.section] = (counts[item.section] ?? 0) + 1
  for (const s of SECTION_ORDER) {
    if ((counts[s] ?? 0) !== SECTION_COUNTS[s]) {
      errors.push(`sekcija "${s}": ${counts[s] ?? 0} postavk, pričakovano ${SECTION_COUNTS[s]}`)
    }
  }
  for (const s of Object.keys(counts)) {
    if (!SECTION_ORDER.includes(s as (typeof SECTION_ORDER)[number])) {
      errors.push(`nepričakovana sekcija: ${s}`)
    }
  }

  // 3. unikatni id-ji
  const ids = new Set<string>()
  for (const item of ITEMS) {
    if (ids.has(item.id)) errors.push(`duplikat id: ${item.id}`)
    ids.add(item.id)
  }

  // 4. anti-overclaim struktura: N/A postavke so IZRECNE in omejene
  const naItems = ITEMS.filter((i) => i.status === 'N/A-IZRECNO')
  const naAllowed = new Set(['pilot-findings'])
  for (const i of naItems) {
    if (!naAllowed.has(i.id)) {
      errors.push(`N/A-IZRECNO status je dovoljen SAMO za pilot-findings (najden: ${i.id})`)
    }
  }
  const metOrItems = ITEMS.filter((i) => i.status === 'MET-OR')
  const metOrAllowed = new Set(['pilot-gate'])
  for (const i of metOrItems) {
    if (!metOrAllowed.has(i.id)) {
      errors.push(`MET-OR status je dovoljen SAMO za pilot-gate (najden: ${i.id})`)
    }
  }

  // 5. register modulov obstaja in ni prazen (ps sidra so smiselna)
  if (MODULE_REGISTRY.length === 0) {
    errors.push('MODULE_REGISTRY je prazen — preslikava Product structure ni smiselna')
  }

  // 6. anti-overclaim: pilot ni izveden (odčitano iz PRODUCT-STATUS JSON)
  const statusSrc = existsSync(join(REPO, 'docs', 'PRODUCT-STATUS.md'))
    ? readFileSync(join(REPO, 'docs', 'PRODUCT-STATUS.md'), 'utf-8')
    : ''
  const jsonMatch = statusSrc.match(/```json\n([\s\S]*?)\n```/)
  if (!jsonMatch) {
    errors.push('PRODUCT-STATUS.md ne vsebuje parsanega JSON bloka')
  } else {
    const status = JSON.parse(jsonMatch[1]) as Record<string, unknown>
    const pilot = status['pilotStatus'] as Record<string, unknown> | undefined
    if (pilot?.['executed'] !== false) {
      errors.push(
        'pilotStatus.executed NI false — closure review ne sme nastati ob trditvi izvedenega pilota',
      )
    }
    const pv = status['physicalValidationStatus'] as Record<string, unknown> | undefined
    for (const k of ['fursProduction', 'paymentTerminal', 'printer', 'kdsDevice']) {
      if (pv?.[k] !== false) {
        errors.push(`physicalValidationStatus.${k} NI false — anti-overclaim kršitev`)
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`EPIC-144-CLOSURE sidra niso veljavna:\n${errors.join('\n')}`)
  }
}

// ── Dokument ────────────────────────────────────────────────────────

/** Escapa markdown tabelno celico (pipe + nove vrstice). */
const cell = (s: string): string => s.replace(/\|/g, '\\|').replace(/\n/g, ' ')

const STATUS_BADGE: Record<ClosureStatus, string> = {
  MET: '✅ MET',
  'MET-OR': '✅ MET (or-veja)',
  'N/A-IZRECNO': '⬜ N/A (izrecno)',
}

export function buildEpicClosureDoc(): string {
  validateItems()

  const lines: string[] = []

  lines.push('# EPIC #144 — §22 CLOSURE REVIEW')
  lines.push('')
  lines.push(
    '> ⚙️ GENERIRANO z `scripts/generate-epic-closure.ts` (bun run closure, epik #144 §22, R193) — **NE urejati ročno**.',
  )
  lines.push(
    '> Preslikava §22 checkliste (31 checkboxov v 8 sekcijah → 32 postavk po verbatim strukturi) na repository truth: vsaka postavka = status + fail-closed dokazne poti + razlaga z rundnimi referencami.',
  )
  lines.push(
    '> Načelo (kanon #144): **Repository truth > assumptions · Evidence > claims · Green CI ≠ production validation.**',
  )
  lines.push('')

  const met = ITEMS.filter((i) => i.status === 'MET').length
  const metOr = ITEMS.filter((i) => i.status === 'MET-OR').length
  const na = ITEMS.filter((i) => i.status === 'N/A-IZRECNO').length

  lines.push(
    `**${ITEMS.length} postavk**: ${met} MET · ${metOr} MET (or-veja) · ${na} N/A (izrecno) · ` +
      `${ITEMS.reduce((a, i) => a + i.paths.length, 0)} fail-closed dokaznih sidr · ` +
      `0 trditev produkcijske validacije`,
  )
  lines.push('')

  lines.push('| Sekcija §22 | Postavk | MET | MET (or) | N/A |')
  lines.push('|---|---|---|---|---|')
  for (const s of SECTION_ORDER) {
    const inSection = ITEMS.filter((i) => i.section === s)
    lines.push(
      `| ${cell(s)} | ${inSection.length} | ${inSection.filter((i) => i.status === 'MET').length} | ` +
        `${inSection.filter((i) => i.status === 'MET-OR').length} | ${inSection.filter((i) => i.status === 'N/A-IZRECNO').length} |`,
    )
  }
  lines.push('')

  lines.push('## Postavke po sekcijah (vsaka = fail-closed preverjena ob generaciji)')
  lines.push('')
  for (const s of SECTION_ORDER) {
    const inSection = ITEMS.filter((i) => i.section === s)
    lines.push(`### ${s} (${inSection.length})`)
    lines.push('')
    for (const item of inSection) {
      lines.push(`#### \`${item.id}\` — ${STATUS_BADGE[item.status]}`)
      lines.push('')
      lines.push(`> "${cell(item.text)}"`)
      lines.push('')
      lines.push('- **Dokazne poti** (' + item.paths.length + ', vse obstajajo — fail-closed): ' + item.paths.map((p) => `\`${p}\``).join(', '))
      lines.push(`- **Razlaga**: ${cell(item.note)}`)
      lines.push('')
    }
  }

  lines.push('## Zaključek closure review-a (R193)')
  lines.push('')
  lines.push(
    '- **§22 checkliste je po vsebini izpolnjena**: 31/32 postavk MET (od tega pilot-gate po dokumentirani "or" veji readinessGate §16) + 1 izrecna N/A (pilot-findings — pilot ni izveden, pilotnih ugotovitev objektivno ni; kanal za konverzijo je definiran in akcijski ob izvedbi pilota).',
  )
  lines.push(
    '- **Izvedbeni red §22 je zaključen**: P0 (koraki 1–9: baseline, status, registry, IA, kokpit, workspaces, Golden Path, regresijska vrata, doc truth) + P1 (koraki 10–19: offline, business-chain, plačilna/zalogovna/nabavna veriga, naprave, health, hitrost, pilot-gate, neodvisna varnostna sled) + P2 (koraki 20–23: claims/evidence R187, video R188, release/support/runbook R189, selective tech debt R190–R192 do ratchet 0).',
  )
  lines.push(
    '- **Tech debt dimenzija ZAKLJUČENA**: no-explicit-any ratchet 90 (R189) → 50 (R190) → 31 (R191) → **0 (R192)** — src/ 100 % brez psevdo-any tipov; tsc je dokaz tipovne pravilnosti čez celotno aplikacijo; katerakoli nova supresija prelomi CI (r192-any-zero globalni ratchet).',
  )
  lines.push(
    '- **NI produkcijske validacije** (anti-overclaim): FURS certifikacija, Stripe production keys, realni hardver/tiskalnik/KDS in izveden pilot ostajajo NE-izvedeni (physicalValidationStatus vse false, pilotStatus.executed false — drift-gated). Epik closure = zaključek REPOZITORIJSKE produktnizacije, ne produkcijske pripravljenosti.',
  )
  lines.push(
    '- **Odprte sledljive postavke**: KNOWN_ISSUES #33/#36 (shema-migracije, LOW, P2 Q2 2026), produkcija postavka (seed /api/setup/init + unikatni močni PIN-i ob sprostitvi — blokirana na Vercel kvoto), i18n C2-C, modifiersJson dual-write ostanki (utemeljeni) — vse izrecno registrirane, nič tiho.',
  )
  lines.push(
    '- **Odluka o zaprtju issue #144 pripada lastniku**: ta dokument je preslikava repository truth; checkboxi v issue telesu se programsko NE odklikavajo.',
  )
  lines.push('')
  lines.push('## Legenda / Anti-overclaim')
  lines.push('')
  lines.push(
    '- **MET** = postavka izpolnjena z repo dokazom (vsaka pot obstaja; brisanje/preimenovanje sidra = fail-closed napaka ob generaciji + rdeč drift-gate).',
  )
  lines.push(
    '- **MET (or-veja)** = checklist postavka ima "or" alternativi; izpolnjena po drugi (dokumentirana readinessGate), prva izrecno neizpolnjena.',
  )
  lines.push(
    '- **N/A (izrecno)** = postavka NI izpolnjena in NI pretvarjana; pogoj objektivno ne more obstajati pred izpolnitvijo odvisne postavke (pilot-findings zahteva izveden pilot).',
  )
  lines.push(
    '- Ta dokument preslikava **repository truth** — NE produkcjske validacije; dokazni kanali za fizično/produkcijsko validacijo = VALIDATION-MATRIX §8 (☐ kanali ostajajo ☐).',
  )
  lines.push('')

  return lines.join('\n')
}

// ── Pisanje (samo pri direktnem zagonu, ne pri importu iz testov) ───

const OUT = join(REPO, 'docs', 'EPIC-144-CLOSURE-REVIEW.md')
const isDirectRun =
  typeof process !== 'undefined' &&
  typeof process.argv[1] === 'string' &&
  process.argv[1].replace(/\\/g, '/').includes('generate-epic-closure')

if (isDirectRun) {
  writeFileSync(OUT, buildEpicClosureDoc(), 'utf-8')
  console.log(
    `[epic-closure] docs/EPIC-144-CLOSURE-REVIEW.md regeneriran (${ITEMS.length} postavk, ${ITEMS.reduce((a, i) => a + i.paths.length, 0)} sidr).`,
  )
}
