# Produkcijska validacija in forenzični audit

> Issue #124 — "R127 — Production validation + forensic audit po R126"
> Izvedeno v rundah R158-a (READ-ONLY audit) + R158-b (controlled fixes)
> HEAD ob auditu: `19303a53` (= origin/main) · FIX HEAD: glej git log

---

## 1. Namen in metodologija

Issue #124 je nastal med rundama R126/R127 kot opomnik: po Daily Close rundi je treba
dokazati, da je sistem notranje konsistenten (POS → orders → payments → refunds/voids →
cash shifts → Z-report → inventory/COGS → waste → reports → Daily Close → audit) in da
ostajajo varni tenant/location scope, avtorizacija, idempotencija, CAS, concurrency,
business-date/timezone in migracijska integriteta.

Metodologija:

- **R158-a**: READ-ONLY forenzični audit nad aktualnim main (issuejev izvirni HEAD
  `dfdd36ba` je zastarel — od takrat je bilo ~30 rund). Vse trditve podprte z dokazi
  (file:line, test imena, CI run/job ID-ji, API odgovori, ukazi + exit kode).
- **R158-b**: controlled fixes — SAMO dokazane P1 najdbe. Nič ni bilo "popravljeno
  po občutku".
- **Anti-overclaim pravilo** (issue sekcija 16, zavezujoče): nič ni PASS brez dokaza.
  Kjer dokaz ne obstaja, je stanje izrecno označeno (NOT PHYSICALLY VALIDATED /
  UNKNOWN / PARTIAL / backlog).

---

## 2. CI / repository evidence (HEAD `8153a048` — osveženo R220, dokaz na R219 pushed drevo)

| Dokaz | Vrednost |
| --- | --- |
| CI run | `37105862350` @ 8153a048 — **success**, 7/7 jobov attempt=1 (Security Audit 111154122444, Lint & Typecheck 111154122547, Integration 111154536791, Unit 111154536766, Build 111154536819, Migration 111154536788, E2E-sec 111154923207 — jobe enumeriral GitHub API ob R220) + Monitor ×2 success (37106133718/37106296454) |
| E2E run | `37105862439` @ 8153a048 — **success** attempt=1 — **249 passed / 4 skipped** (log L1073-1074, 3.5m; R219 push; ZERO delta ×13 zapored: R207–R218 runi in lokalna vrata dokumentirajo ISTA vrata — napovedi '249/4 ob pushu', '+1f/+5', '+4 G7 IT', 'doc-only ≡ ista vrata', '+1f/+6', '+2 G4 IT', '+1f/+11', '+3 G2 IT', 'doc-only ≡ ISTA vrata', '+1f/+11 unit + +2 G3 IT', 'doc-only ≡ ISTA vrata' vsakokrat točne do številke) |
| run_attempt | CI run 7/7 = attempt 1 (API verified ob R220); E2E run + Monitor ×2 success — NI re-runov, NI rerun-failed-jobs mehanike (playwright `retries: CI ? 2 : 0`) |
| Unit (CI log) | 314 fajlov / **5702** testov, 0 skipped — R219 push log (run 37105862350, job log L1024-1025, job-level API prenos; poštna opomba ostaja: job fajl zaporedje + vrstični offseti se spreminjajo med runi, premiki so bidirekcionalni — vedno glob/grep po vsebini, nikoli fiksen offset); `test:unit` vključuje security suite (110 fajlov / **2127** = podmnožica job-a; L1214-1215 — premik −1 vs R218 run L1215-1216; R177-d semantika, ne seštevek); R219 napoved ('doc-only ≡ ISTA vrata') TOČNA do številke — ZERO delta ×13; R220 drevo = R219 pushed drevo + funkcionalna runda G5/G6 (+1f/+13 unit NOV r220-g5-g6 fajl) — pričakovano ob pushu **315 fajlov / 5715** |
| Integration (CI log) | 27 fajlov / **294** testov, 0 skipped — R219 push log (run 37105862350, job log L755-756 — premik −1 vs R218 run L756-757, poštna opomba); R219 napoved ('doc-only ≡ ISTA vrata') TOČNA do številke; R220 drevo = funkcionalna runda G5/G6 (+2 IT drill) — pričakovano ob pushu **296** |
| E2E Security | **96 passed** (job log grep R219 push, L1285 — premik +1 vs R218 run L1284; enak kot R178–R219 runi — od takrat ni novih security specov) |
| Lokalna reprodukcija | vitest run 5715/5715 (315 fajlov) — R220 lokalna vrata: issue #152 korak 2 — G5 DELETE artikel + G6 reorder auto-prevzem na kanon pariteti @ R219 pushed drevo 8153a048 (G5: acquireInvStockLocks PRED tx-fresh re-readom + CAS updateMany equality + Serializable TX_OPTS + INVENTORY_DELETE audit + P2002/P2034 → 409; G6: acquireInvStockLocks za VSE validne artikle PRED prvim incrementom; NOV r220-g5-g6 unit 13, r209 drill +2 G5+G6 IT — drill 28/28; IT 27f/296 sveža PGlite); predhodna R219 lokalna vrata: doc-truth sync na R218 pushed run 37069657511 @ 1150fe41 (doc-only — produktovska koda nedotaknjena) — CI run 37105862350 @ 8153a048 potrjuje R219 drevo z ZERO delta ×13 |
| Production Build | job zelen — edini buildability dokaz (sandbox ne zna graditi) |

Skipped/todo sweep (re-verificirano R220, strižen vzorec `\.(skip|todo|only)\(`): 15 zadetkov v
tests/e2e/ (3 permanentni critical-path + 12 pogojnih data-guard: device-tab 1,
furs-financial 2, outbox-worker 3, payment-flow 6); 0 v unit+IT; R186–R208 niso dodali novih skipov
(R209 IT drill 15 testov 0 skipov).

> Zgodovina osvežitev §2: R220 @ 8153a048 (dokaz na R219 pushed runih 37105862350/37105862439 — re-enumerirani ob R220 z log-izpeljanimi številami, ZERO delta ×13 zapored R207→R219: Unit 314f/5702, IT 27f/294, E2E 249/4, E2E-sec 96 — R218 napovedi '+1f/+11' + '+2 G3 IT' točne do številke, R219 doc-only potrditev; vrstični premiki vs R218 run: Unit L1025→L1024 (−1), security L1215→L1214 (−1), Integration L756→L755 (−1), E2E L1075→L1073 (−2), E2E-sec L1284→L1285 (+1) — mikro-drifti bidirekcionalni (doc-only runda ne doda testov), poštna opomba ostaje; R220 lokalna vrata: G5 DELETE artikel + G6 reorder auto-prevzem na kanon pariteti #152 korak 2 — G5 acquireInvStockLocks PRED tx-fresh re-readom + CAS equality + Serializable + INVENTORY_DELETE audit + 409 kontrakt, G6 acquireInvStockLocks pred prvim incrementom; NOV r220-g5-g6 unit 13, r209 drill +2 G5+G6 IT — drill 28/28; +1f/+13 unit (315f/5715), IT 27f/296 +2; pričakovano ob pushu ISTA vrata (315f/5715 + 296 IT), potrditev v DOPOLNITVI; naslednja runda doc-truth sync na R220 pushed run). R219 @ 1150fe41 (dokaz na R218 pushed runih 37069657511/37069657459 — re-enumerirani ob R219 z log-izpeljanimi številami, ZERO delta ×12 zapored R207→R218: Unit 314f/5702, IT 27f/294, E2E 249/4, E2E-sec 96 — R218 napovedi '+1f/+11' + '+2 G3 IT' točne do številke; vrstični premiki vs R217 run: Unit L1021→L1025 (+4), security L1211→L1215 (+4), Integration L754→L756 (+2), E2E L1075-1076 stabilna, E2E-sec L1282→L1284 (+2) — premiki korelirajo z R218 dodanimi testi, poštna opomba ostaje; doc-only runda: PRODUCT-STATUS/README/PV + 2 pin testna fajla; naslednja funkcionalna runda #152 korak 2 nadaljevanje po prioriteti vrzel: G5/G6 nizka prioriteta — glej INVENTORY-CHAIN.md §5 register). R218 @ 41ec44f8 (lokalna vrata na R217 pushed drevo — G3 QR/online/Glovo/Wolt odvodni tokovi na kanon pariteti #152 korak 2: vsi 4 pisci acquireInvStockLocks (R182 vesolj, Read Committed kanon za sale path) + QR FEFO recordBatchConsumption (unbatched zaprto) + QR orderId (G2 pariteta) + glovo/wolt pre-fetch menuMap tx-fresh (N+1 odpravljen) + kiosk 5. pisec podeduje fix; r209 drill +2 G3 IT — drill 26/26 QR POST 201 StockTx orderId + FEFO LOT-G3-B izčrpana → LOT-G3-A + 409 roll-back; NOV r218-g3-sale-deduct 11; +1f/+11 unit (314f/5702), IT 27f/294 +2; pričakovano ob pushu ISTA vrata, potrditev v DOPOLNITVI; dokaz na R217 pushed runih 37061618533/37061618034 — re-enumerirani ob R218, ZERO delta ×11 zapored R207→R217; naslednja runda doc-truth sync + G5/G6 nizka prioriteta). R217 @ 574772bf (dokaz na R216 pushed runih 37057876153/37057876113 — re-enumerirani ob R217 z log-izpeljanimi številami, ZERO delta ×10 zapored R207→R216: Unit 313f/5691, IT 27f/292, E2E 249/4, E2E-sec 96 — R216 napovedi '+1f/+11' + '+3 G2 IT' točne do številke; Migration job potrdi 0026_stocktx_order_relation deploy na sveži bazi; vrstični premiki vs R215 run: Unit L1021 stabilen, security L1211 stabilen, Integration L754 stabilen, E2E L1072→L1074 (+2), E2E-sec L1286 stabilen — večina stabilna tokrat, poštna opomba ostaja; doc-only runda: PRODUCT-STATUS/README/PV + 2 pin testna fajla; naslednja funkcionalna runda #152 korak 2 nadaljevanje po prioriteti vrzel: G3/G5/G6 nizka prioriteta — glej INVENTORY-CHAIN.md §5 register). R216 @ 3b22ef45 (lokalna vrata na R215 pushed drevo — G2 business-day bucketiranje kanon pariteta #152 korak 2: NOVA relacija StockTransaction.order + 0026_stocktx_order_relation (sirote prečiščene, FK SetNull) + skupni helper sale-cogs-bucketing (veja A order.paidAt okno XOR veja B fallback createdAt — brez dvojnega štetja) + 4 konzumenta (financial/EOD/dashboard/journal-generator); r209 drill +3 G2 IT — drill 24/24 cross-midnight marža 100−16=84 koherentna, storno naslednji dan sledi prodajnemu dnevu, D1/D3 prazna okna; NOV r216-business-day-cogs 11; +1f/+11 unit (313f/5691), IT 27f/292 +3; pričakovano ob pushu ISTA vrata, potrditev v DOPOLNITVI; dokaz na R215 pushed runih 37051298700/37051298614 — re-enumerirani ob R216, ZERO delta ×9 zapored R207→R215; naslednja runda doc-truth sync + #152 korak 2 nadaljevanje po prioriteti: G3/G5/G6 nizka prioriteta). R215 @ 3db433d9 (dokaz na R214 pushed runih 37047402237/37047402213 — re-enumerirani ob R215 z log-izpeljanimi številami, ZERO delta ×8 zapored R207→R214: Unit 312f/5680, IT 27f/289, E2E 249/4, E2E-sec 96 — R214 napovedi '+1f/+6' + '+2 G4 IT' točni do številke; vrstični premiki: Unit L1021→L1022, security L1211→L1231, Integration L752→L753, E2E L1072→L1073, E2E-sec L1284→L1285; doc-only runda: PRODUCT-STATUS/README/PV + 2 pin testna fajla; naslednja funkcionalna runda #152 korak 2 nadaljevanje po prioriteti vrzel: G2 business-day bucketiranje paidAt vs createdAt — usklajeno z #148; G3/G5/G6 nizka prioriteta). R214 @ 32f60225 (dokaz na R213 pushed runih 37039477517/37039479653 — re-enumerirani ob R214 z log-izpeljanimi številami, ZERO delta ×7 zapored R207→R213: Unit 311f/5674, IT 27f/287, E2E 249/4, E2E-sec 96 — R213 napoved 'doc-only ≡ ista vrata' točna do številke; R214 lokalna vrata: +1f/+6 unit G4 batch-PUT adjust kanon pariteta #152 korak 2, IT 27f/289 +2 G4 drill 21/21; pričakovano ob pushu 312f/5680 + 289 IT, potrditev v DOPOLNITVI). R213 @ 81ee6250 (dokaz na R212 pushed runih 37034492703/37034492549 — re-enumerirani ob R213 z log-izpeljanimi številкami, ZERO delta ×6 zapored R207→R212: Unit 311f/5674, IT 27f/287, E2E 249/4, E2E-sec 96 — R212 napovedi '+1f/+5' + '+4 G7 IT' točne do številke; Migration job potrdi 0025_grn_idempotency deploy na sveži bazi; doc-only runda: PRODUCT-STATUS/README/PV + 2 pin testna fajla; naslednja funkcionalna runda #152 korak 2 nadaljevanje po prioriteti vrzel: G4 batch-PUT adjust izjema / G2 business-day bucketiranje). R212 @ e5d71dc7 (dokaz na R209 pushed runih 37019328965/37019329356 — R211 push runi 37028377343/37028377939 re-enumerirani ob R211 z log-izpeljanimi številkami, ZERO delta ×5; R212 lokalna vrata: +1f/+5 unit G7 receive idempotency #152 korak 2, IT 27f/287 +4 G7 drill; pričakovano ob pushu 311f/5674 + 287 IT, potrditev v DOPOLNITVI; migracija 0025_grn_idempotency — CI Migration job potrdi deploy na sveži bazi). R211 @ 0e5e0a49 (dokaz še vedno na R209 pushed runih 37019328965/37019329356 — R211 lokalna vrata: +1f/+9 unit G1 location scope #152 korak 2, IT 27f/283 nespremenjena; E2E lokalno r151 5/5 + danes-cockpit 10/10; pričakovano ob pushu 310f/5669, potrditev v DOPOLNITVI; lekcija: sandbox E2E dev strežnik spawnaj z nohup + disown — '(cmd &)' job je bil sredi spec runa recikliran → ERR_CONNECTION_REFUSED ×3). R210 @ db63d01a (run 37019328965, 7/7 jobov + E2E 37019329356 249/4 + Monitor ×2, vse attempt=1 — CI-verifikacija R209 pusha re-enumerirana ob R210; IT 27f/283 CI-potrjeno — R209 napoved '27f/283 ob pushu' točna do številke, ZERO delta ×3 zapored; doc-only + 2 pin testna fajla). R209 @ 7d42d856 (run 37009517474, 7/7 jobov + E2E 37009517286 249/4 + Monitor ×2, vse attempt=1 — CI-verifikacija R208 pusha re-enumerirana ob R209; lokalna vrata R209: +1f/+15 IT r209-inventory-chain-drill #152 korak 1, pričakovano 27f/283 ob pushu). R208 @ bc07e4f7 (run 37003511043, 7/7 jobov + E2E 37003510985 249/4 + Monitor ×2 — doc-truth sync na R207 drevo, ZERO delta, napoved '249/4 ob pushu' točna do številke). R171 @ bb7d422f (run 36630369663, 226/4, E2E-sec 88,
> 5231+1949 aditivna semantika — takrat še pravilna), R179 @ 6f38d77c (run
> 36736765685, 234/4, E2E-sec 96, podmnožična semantika po R177-d), R180 @ 0beb4a7
> (run 36742954518, 8/8 jobov, 234/4, E2E-sec 96 — ista drevesa +1 doc-truth gate), R181 @
> 7e228dc (run 36755371246, 7/7 jobov + Monitor ×2, 234/4, E2E-sec 96 — ista drevesa +1f/24
> R180 gate; R180-b2 security bump next 16.3.6 ujel GitHub advisory GHSA-vcvr-r3jv-pc5j).
> R182 @ 46150bc (run 36763362891, 7/7 jobov + Monitor ×2, 234/4, E2E-sec 96 — ista drevesa +1f/13 R181 CK-5 gate; A2 enoten zaloga lock kanon: acquireInvStockLocks čez prodajo/vračilo/prevzem).
> R183 @ a3b2cdc (run 36766358224, 7/7 jobov + Monitor ×2, 234/4, E2E-sec 96 — ista drevesa +1f/13 R182 A2 gate; A7 enoten reversal kanon plačilnega statusa: recalcCheckAndOrderStatusAfterReversal, refundAmount-zaveden netPaid → storno/partial/paid).
> R185 @ 75c9678 (run 36772182154, 7/7 jobov + Monitor ×2, 234/4, E2E-sec 96 — ista drevesa +1f/13 R183 A7 gate; A6 enoten zapiralni kanon smene: closeShiftCasIfOpen, CAS updateMany { id, status: 'open' } čez VSE tri rute — reports/eod closeShiftTransaction prej nepogojen update TOCTOU; Z-pisi ostajajo v R110 upsert kanonu).
> R186 @ b5c8c0ba (run 36778332454, 7/7 jobov + Monitor ×2, 234/4, E2E-sec 96 — ista drevesa, CI potrjuje enaka vrata kot lokalna R185 5419/298; čisto osvežitev dokaza — brez produkcijskih sprememb; P1 faza epika #144 ZAKLJUČENA).
> R187 @ ed8c2e43 (run 36821743289, 7/7 jobov + Monitor ×2, 234/4, E2E-sec 96 — ista drevesa; P2 korak 20 finalize product claims: konkurenčne primerjave iz javne fasade + +1 doc-truth gate test).
> R188 @ 5315e89e (run 36824838355, 7/7 jobov + Monitor ×2, 234/4, E2E-sec 96 — ista drevesa; P2 korak 21 finalize #141 product presentation/video: NOV docs/PRODUCT-VIDEO-STORYBOARD.md — realna zgodba preslikana na realne module/komponente/rute, priloga A = vseh 76 modulov, VIDEO-TUTORIALS zgodovinski + DEMO markacija, drift-gate +1f/+16).
> R189 @ c733414d (run 36829054559, 7/7 jobov + Monitor ×2, 234/4, E2E-sec 96 — ista drevesa, CI potrjuje enaka vrata kot lokalna R188 5436/299 z ZERO delta; P2 korak 22 release/support/runbook material: NOV .github/SUPPORT.md + docs/RELEASE-SUPPORT-INDEX.md inventar z register vrzeli (4 rešene R189), ZGODOVINSKI bannerja na PRODUCTION-CHECKLIST/LAUNCH-CHECKLIST, SECURITY.md Supported Versions ≡ package.json, drift-gate +1f/+14).
> R190 @ fa1aa6ee (run 36834490007, 7/7 jobov + Monitor ×2, 234/4, E2E-sec 96 — ista drevesa, CI potrjuje enaka vrata kot lokalna R189 5450/300 z ZERO delta; P2 korak 23 selective tech debt: 40 no-explicit-any supresij iz finančne jedre (FURS verify/storno + Z-report stats + VAT) → realni domenski tipi, ratchet drift-gate +1f/+12).
> R191 @ 5f10fceb (run 36838096925, 7/7 jobov + Monitor ×2, 234/4, E2E-sec 96 — ista drevesa, CI potrjuje enaka vrata kot lokalna R190 5462/301 z ZERO delta; P2 faza tech debt sweep: NOV kanonski EodReportData wire tip (src/app/api/reports/eod/types.ts) za 10 EOD komponent + 9 supresij iz FURS batch/Z-report/dashboard/receipts, ratchet znižan 50 → 31, drift-gate +1f/+29).
> R192 @ 7d742986 (run 36842754916, 7/7 jobov + Monitor ×2, 234/4, E2E-sec 96 — ista drevesa, CI potrjuje enaka vrata kot lokalna R191 5491/302 z ZERO delta; P2 faza FULL SWEEP: vseh 31 preostalih no-explicit-any supresij v 22 fajlih → ratchet 0 (fallback-create unchecked inputi, stale casti, DecimalLike, Prisma boundary tipi, strukturni kontrakti, seed orodja) + IT-flake fix (test-admin fixture default pin '' → '1111', r150 RUN_ID pin), drift-gate +1f/+36).
> R193 @ 99f14c86 (run 36850932502, 7/7 jobov + Monitor ×2, 234/4, E2E-sec 96 — ista drevesa, CI potrjuje enaka vrata kot lokalna R192 5527/303 z ZERO delta; epik #144 §22 closure review: NOV generiran docs/EPIC-144-CLOSURE-REVIEW.md — 32 postavk v 8 sekcijah × 103 fail-closed dokaznih sidr, 31/32 MET (pilot-gate or-veja readinessGate §16; pilot-findings izrecno N/A), anti-overclaim builder pogoj na pilotStatus.executed=false + physicalValidationStatus false, drift-gate +1f/+16).
> R194 @ 660a74bf (run 36855872713, 7/7 jobov + Monitor ×2, 234/4, E2E-sec 96 — ista drevesa, CI potrjuje enaka vrata kot lokalna R193 5543/304 z ZERO delta ŽE NA PUSHED DREVESU; čisto osvežitev dokaza po §22 closure review — brez produkcijskih sprememb, +0f/+0, pini doc-truth/product-status R193 → R194).
> R195 @ 8a67fef1 (run 36865220720, 7/7 jobov + Monitor ×2, 234/4, E2E-sec 96 — ista drevesa, CI potrjuje enaka vrata kot lokalna R194 5543/304 z ZERO delta ŽE NA PUSHED DREVESU; epik #144 KNOWN_ISSUES #48: Neon locationId drift-most trajna rešitev — NOV idempotenten migration package scripts/r195-neon-locationid-migration.sql (11 tabel × 6 stavkov: ADD COLUMN IF NOT EXISTS + dinamičen backfill + SET NOT NULL + FK RESTRICT + CREATE INDEX) + fail-closed applier + IT dokaz celotnega cikla (drift simulacija → detektor P2010 duck-typing → most run(false) → migracija → pariteta → backfill → FK 23503 → idempotenca) + unit drift-gate 18 testov; aplikacija na Neon = uporabniški korak; +1f/+18 unit + +1f/+13 IT).
> R196 @ 2addbb92 (run 36871730253, 7/7 jobov + Monitor ×2, 234/4, E2E-sec 96 — ista drevesa, CI potrjuje enaka vrata kot lokalna R195 5561/305 z ZERO delta ŽE NA PUSHED DREVESU; čisto osvežitev dokaza po R195 #48 Neon locationId migration package — brez produkcijskih sprememb, +0f/+0, pini doc-truth/product-status R195 → R196).
> R197 @ d03b1269 (run 36878858215, 7/7 jobov + Monitor ×2, 234/4, E2E-sec 96 — ista drevesa, CI potrjuje enaka vrata kot lokalna R196 5561/305 z ZERO delta ŽE NA PUSHED DREVESU; epik #144 KNOWN_ISSUES #33 zaključek: NOV schema-paritetni drift-gate tests/unit/lib/json-fields-schema-parity.test.ts 11 testov — 25 inventariziranih polj ≡ Json v shemi ≡ natanko 25 TYPE JSONB stavkov @ 0022_json_fields ≡ JSON_WIRE_FIELDS pokritje, 6 ostankov ≡ String byte-exact z izrecnimi utemeljitvami (modifiersJson dual-write, AuditLog.details hash veriga, WebhookDelivery.payload HMAC, apiKeys deprecatiran keystore, MenuItem/Modifier.allergens CSV); KNOWN_ISSUES #33 LOW → FIXED + closure generator usklajen + regen; +1f/+11 unit).
> R198 @ 35676c66 (run 36887095820, 7/7 jobov + Monitor ×2, 234/4, E2E-sec 96 — ista drevesa, CI potrjuje enaka vrata kot lokalna R197 5572/306 z ZERO delta ŽE NA PUSHED DREVESU; čisto osvežitev dokaza po R197 #33 zaključek — brez produkcijskih sprememb, +0f/+0, pini doc-truth/product-status R197 → R198).
> R199 @ 2d1faa3a (run 36896276358, 7/7 jobov + Monitor ×2, 234/4, E2E-sec 96 — ista drevesa, CI potrjuje enaka vrata kot lokalna R198 5572/306 z ZERO delta ŽE NA PUSHED DREVESU; čisto osvežitev dokaza po R198 refresh — brez produkcijskih sprememb, +0f/+0, pini doc-truth/product-status R198 → R199).
> R200 @ e3988670 (run 36899375722, 7/7 jobov + Monitor ×2, 234/4, E2E-sec 96 — ista drevesa, CI potrjuje enaka vrata kot lokalna R199 5572/306 z ZERO delta ŽE NA PUSHED DREVESU; čisto osvežitev dokaza po R199 refresh — brez produkcijskih sprememb, +0f/+0, pini doc-truth/product-status R199 → R200).
> R201 @ 614f4fb9 (run 36903754488, 7/7 jobov + Monitor ×2, 234/4, E2E-sec 96 — ista drevesa, CI potrjuje enaka vrata kot lokalna R200 5572/306 z ZERO delta ŽE NA PUSHED DREVESU; čisto osvežitev dokaza po R200 refresh — brez produkcijskih sprememb, +0f/+0, pini doc-truth/product-status R200 → R201).
> R202 @ 58201114 (run 36908280171, 7/7 jobov + Monitor ×2, 234/4, E2E-sec 96 — ista drevesa, CI potrjuje enaka vrata kot lokalna R201 5572/306 z ZERO delta ŽE NA PUSHED DREVESU; čisto osvežitev dokaza po R201 refresh — brez produkcijskih sprememb, +0f/+0, pini doc-truth/product-status R201 → R202).
> R203 @ 81aecc84 (run 36912047276, 7/7 jobov + Monitor ×2, 234/4, E2E-sec 96 — ista drevesa, CI potrjuje enaka vrata kot lokalna R202 5572/306 z ZERO delta ŽE NA PUSHED DREVESU; issue #148 korak 1: Danes cockpit state stroj — NOV src/lib/danes/cockpit-state.ts (LOADING/READY/EMPTY/ERROR/UNAUTHORIZED per 7 virov, capability matrica pariteta z auth-middleware, tipizirano ALERT_TARGET_MODULE usmerjanje nad 8 tipi) + predelava DanesCockpit.tsx (per-kartica ERROR stanja z retry, page-state UNAUTHORIZED/ERROR/PARTIAL/READY, capability vrata enabled:false) + NOV tests/unit/lib/danes-cockpit-state.test.ts 45 testov; KNOWN_ISSUES #49 dual-IndexedDB odkritje dokumentirano; lokalna R203 vrata 307f/5617 (2×), IT 24f/248 sveža, verify 30/30, regen 0-diff, skip sweep nespremenjen 15/0).
> R204 @ 7dfa731c (run 36920108112, 7/7 jobov + Monitor ×2, 234/4, E2E-sec 96 — ista drevesa, CI potrjuje enaka vrata kot lokalna R203 5617/307 z ZERO delta ŽE NA PUSHED DREVESU; issue #148 korak 2: TIMEZONE kanon — /api/operational-alerts 'danes' meja = ljubljanaDayBounds(ljubljanaTodayStr(now)) (prej strežniška polnoč: na UTC stroju preklici 00:00–02:00 LJ padli v prejšnji poslovni dan), DanesCockpit rezervacijski čas = ljubljanaDateTimeParts + glava = ljubljanaTodayStr prek UTC pina (browser TZ odstranjena), KPI testidi; NOV tests/unit/lib/timezone-sl.test.ts 19 testov (§7 gates: CET/CEST, DST prehoda 23h/25h, stiki meja, letna meja, 00:00–02:00 LJ rob, UTC→LJ rezervacija rollover + DST preskok; fs-pini: alerts kanon + negativen getFullYear pin, dashboard kanon, kokpit negativen toLocaleTimeString pin, enoten kanon) + NOV tests/e2e/danes-cockpit.spec.ts 10 browser negativnih/pozitivnih E2E (§16/§15: per-vir 500 → ERROR ≠ EMPTY, 403 → UNAUTHORIZED ≠ EMPTY, izolacija, EMPTY/READY kontrol; serviceWorkers block); lokalna R204 vrata 308f/5636 (2×), IT 24f/248 sveža, verify 30/30, regen 0-diff, skip sweep nespremenjen 15/0).
> R205 @ 37a10d69 (run 36925907149, 7/7 jobov + Monitor ×2 (36926486399/36926779047), E2E run 36925907040 success — API-enumerirano ob R205; issue #151 korak 1: finančna veriga — NOV tests/integration/r151-financial-chain-drill.test.ts 7 testov na realni PGlite (§4 klient NI avtoritativni vir zneskov: vbrizg total/subtotal/tax + item price 0.01 ignoriran, P1-8 DB-cene; §5 scenarij F: sprememba MenuItem.price + Modifier.price PO naročilu → zgodovinski snapshot NESPREMENJEN, novo naročilo zaračuna nove cene; §7/§8: Σ(completed payments) == Check.total == Order.total na cent, split → partial → paid + paidAt + 'split' method; §9: replay = ISTI payment, OVERPAYMENT 400 / ALREADY_PAID 409 brez efekta, ε=0.01 simetričen prag) + NOV tests/unit/lib/r151-financial-chain-pins.test.ts 15 drift-gate (createOrderSchema brez finančnih polj, P1-8 vrsticni pini, R181 Check.total formula, §18 ZNANA VRZEL pin: calculateCheckAmounts float — fix korak 2) + NOV docs/FINANCIAL-CHAIN.md (#151 §3: 16 finančnih dejstev × reconciliation pravila + register vrzeli); lokalna R205 vrata 309f/5651 (2×), IT 25f/255 sveža, verify 30/30, regen 0-diff, skip sweep nespremenjen 15/0).
> R206 @ 17914bc8 (run 36989664464, 7/7 jobov + Monitor ×2 (36990149646/36990456895), E2E run 36989664484 244 passed/4 skipped — API-enumerirano + log-izpeljano ob R206; doc-truth korekcija brez produkcijskih sprememb: E2E count 234→244 (R204 je dodal 10 kokpit E2E; prej skopano iz R203 zapisa — R204 run 36925907040 log L1076-1077 = 244/4), ciLastFileBasedProof → R205 pushed drevo, README badge 244 + 18 specov + evidence vrstica run 36989664464 @ 17914bc8, pini doc-truth/product-status R205 → R206; lokalna vrata na končnem drevesu: tsc 0, lint 0, unit 309f/5651 (2×), IT 25f/255 sveža, verify 30/30, regen 0-diff, skip sweep nespremenjen 15/0).
> R207 @ 95b9de5c (run 36992310970, 7/7 jobov + Monitor ×2 (36992705920/36993124128), E2E run 36992311101 244/4 log L1075-1076 — API-enumerirano + log-izpeljano ob R206 DOPOLNITVI; issue #151 korak 2: fiskalna veriga — NOV tests/integration/r207-fiscal-chain-drill.test.ts 13 testov (§26 checkpointi 1–8: Order → Payment Σ==total → Receipt na cent + §24.10 duplicate → ISTI račun → FURS meja: brez certifikata pending / retry z FURS_ALLOW_SIMULATION → SIMULACIJA ostane fiscalVerified=false + eor '' (fail-closed, R166 F5) / duplicate submit → EN efekt → shift open → close totals==Σpayments + §24.14 retry → EOD → Z finalized + §24.15 retry → EOD odraža znesek) + §18 Decimal migracija calculateCheckAmounts (Prisma.Decimal akumulacija; float↔Decimal parity dokaz + negativni pini) + NOV docs/FINANCIAL-CHAIN.md §4 §23 Failure/Recovery matrica 15 vrstic iz implementacije + vrzeli register: §11/§13/§15/§16/§28 ZAPRTO R207, §18 MIGRIRANO, FURS ostaja SIMULIRANO + NOV tests/e2e/r151-settlement-recovery.spec.ts 5 §28 browser evidence testov (receipt stran prikazuje avtoritativni total, reload po naselitvi → ISTI račun, retry POST → 200 ISTI račun, liveStats/EOD odražata transakcijo); lokalna R207 vrata 309f/5660 (2×), IT 26f/268 sveža, verify 30/30, regen 0-diff, skip sweep nespremenjen 15/0).
> R208 @ bc07e4f7 (run 37003511043, 7/7 jobov + Monitor ×2 (37004273943/37003977106), E2E run 37003510985 249 passed/4 skipped log L1080-1081 — API-enumerirano + log-izpeljano ob R208; ZERO-delta doc-truth sync brez produkcijskih sprememb: napoved iz R207 dokaza ('249/4 ob pushu, potrditev v DOPOLNITVI') točna do številke — nasprotje R206 defektu 234→244, številke iz lastnih run logov (Unit L1021-1022/L711-712 = 309f/5660, Integration L750-751/L331 = 26f/268, E2E-sec L1292 = 96); ciLastFileBasedProof → R207 pushed drevo, README tests badge 244→249 E2E + full-suite 249/19 specov + audit razvoj-208 + napredek segment R208 + evidence → run 37003511043, PRODUCT-STATUS headCommitAtStatus → bc07e4f7 + e2ePlaywright 249/4, pini doc-truth/product-status R207 → R208).

> Issuejeva številka "4152 testov" je zastarela (nanaša se na R126-era HEAD).

---

## 3. DailyClose × ZReport state matrica (issue sekcija 3–4)

| DailyClose \ ZReport | DRAFT | FINALIZED |
| --- | --- | --- |
| PENDING_APPROVAL | **VALID** (Z-draft upsert pot; nad pragom) | dosegljiva le prek **approve** poti (zakonita) |
| CLOSED | ~~dosegljiva prek finalize faila~~ → **REPAIRED (R158-1)**: replay preveri dejanski Z in izvede idempotenten re-finalize | **VALID** (kanon) |
| REOPENED | **VALID** (reopen de-finalizira Z v tx) | dosegljiva le prek re-close + approve (zakonita) |

Invarianti: `@@unique(locationId, businessDate)` + `@@unique(locationId, idempotencyKey)`
na DailyClose; CAS `updateMany` prehodi; zgodnji 409 `DAILY_CLOSE_ALREADY_CLOSED`.

**Kritično vprašanje issueja** ("DailyClose=CLOSED + ZReport=DRAFT po uspelem
commitu — možno?"): **DA, bilo je dosegljivo** — finalize teče izven tx. Fast-path replay
je maskiral (poročal `zReportFinalized` iz statusa DailyClose brez preverjanja Z) in ni
bilo samoozdravitvene poti. → **R158-1 [P1], popravljeno** (glej §8).

---

## 4. Business date / Ljubljana timezone (issue sekcija 5)

- Kanonski helper: `src/lib/timezone-sl.ts` (`ljubljanaDayBounds`, `ljubljanaTodayStr`,
  `ljubljanaDateTimeParts`) — 26 konzumentov; jedro finančnega zaključka (daily-close,
  z-report, end-of-day, cash-register) **čisto** na njem.
- Sweep: 78 zadetkov `toISOString().slice(0,10)` / `split('T')` ocenjenih posamično.
  - **Jedro: OK.**
  - **7 P2 rizik mest izven zaključne poti** (finančno-vidni prikazi, ne integriteta
    zaključka): `reports/sales:78`, dashboard comparison/weekly, `tax-report:89/107`,
    `furs e-invoice-book:109/136`, `labor-reports:149–387`, financial/eod privzeti
    datumi → **POPRAVLJENO (R159-b)** — vsa mesta (+ re-sweep bonus: vat route,
    vat time-distribution periodKey, export route) na LJ kanon prek
    `ljubljanaDayBounds`/`ljubljanaDateTimeParts`; meje ekskluzivna LJ polnoč (lt);
    `datumIzdaje` (zakonski datum) po LJ. Zero-migration.
  - P3 ostanki → **POPRAVLJENI (R160-b)**: vat time-distribution daily/weekly/
    monthly vedra, employees/popular/shifts/wallet-payment okna (+wallet stats
    branch r35-luknja), ai/forecast (day-key + YMD oznake), digest družina
    (daily-digest/digest-preview/digest-send/scheduled-emails create+process/
    email dup-check — kanonski reportDate = UTC polnoč LJ dneva, dup-check
    preklopljen v ISTEM editu), loyalty-automation idempotenčni ključi (lock,
    re-check okno, SMS outbox), cash-register webhook daily_report.ready,
    financial N1 time-distribution (tihi izpad mesečnih naročil odstranjen),
    tips heatmap, employees hourly, happy-hour/order-config open-closed,
    send-report-email okno, eDavki XML <Period> = mesec obdobja (ne
    generiranja). DEFER (dokumentirano): api/shifts write-path pariteta,
    tip-pool/actual-times-sync, privzeta okna expenses/staff-performance,
    statistična družina, klient-TZ razred, restaurant-checks toLocaleString-hack,
    e2e workflow startDate (test-infra).
  - Year-boundary testi: p2-ux-formatting.test.ts (letnica 2024→2025 + DST-konec
    2024-10-27 25 h) + trap-DB r159-utc-buckets.test.ts (meje/bucketi per ruta).
- DST/leap pokritost potrjena (p2-ux-formatting.test.ts: 23h/25h dnevi, 22:00 UTC
  začetek CEST dneva, 2024-02-29).

## 5. Financial source-of-truth (issue sekcija 6)

- **Z-report ≡ Daily Close: DOKAZANO isti vir** — oba skozi `upsertZReportForDay →
  calculateReportStats` (isti Ljubljana bounds; paymentStatus ∈ [paid, partial];
  plačila neto refundAmount; storno posebej; `expectedCash` = Σ
  CashRegisterShift.expectedCash = startingCash + cashSales + cashTips).
- COGS: R123 `yieldAdjustedLineCost` = ista RAW osnova kot dedukcija (rawFromUsable) —
  stale vir NI uporabljen.
- **R158-5 [P3], popravljeno (R161)**: `totalRefunds` snapshot v DailyClose je bil
  vedno 0 — `calculateReportStats` zdaj izpostavlja refund agregat (tx-fresh
  `payment.aggregate` na client parametru, Σ refundAmount po kanonu izmene
  `status in [completed, refunded]`, širši order paymentStatus
  `[paid, partial, storno]` — namerna deviacija, dokumentirana v stats.ts; iste
  LJ meje gte/lt; 0 migracij) → route :300 snapshot + export stolpec "Povračila"
  realen. Testi: 9 v r161-totalrefunds.test.ts (where-pin, LJ meje identity,
  tx-klient, S6 neto/bruto pariteta, CSV "12.50" format s piko).

## 6. Inventory / COGS regresija (issue sekcija 7)

Dokazni seznam: yield 20 testov (100/80/50 %); r122 batch (vzporedni complete = ENA
poraba); r120-batch-lot-fefo A1..F1; r106 A1..C4; concurrency-p19 (`inventoryDeducted`
atomic claim → retry ≠ second deduction); r124-soldout 12 testov; invarianta
`needed == deducted`. **R158-6 [P3], pokrito (R161)**: namenski test "sočasna
poraba zadnjih 2 enot" dodan — tests/unit/security/r161-last2-units.test.ts
(V1a: 2 vzporedni porabi po 1 enoti na 2 enotah → obe uspešni, končno točno 0;
V1b: tretja vzporedna na izčrpani zalogi → count=0, 'Premalo zaloge', 0 audit
vrstica, brez oversella; V2: 2 seriji × 1 enota FEFO → stale read + pogojni
guard gte, obe seriji EXHAUSTED). Trap DB pina DEJANSKE produkcije WHERE-pogoje
(gte/lte/inventoryDeducted false→true), ne mock vedenja.

## 7. StaffShift / FURS / izolacija / idempotencija / offline / backup (issue sekcije 8–13)

- **StaffShift (S8)**: `model Shift` ODSOTEN; /api/shifts compat layer (date alias,
  copy_week) z r125 testi; expected cash vir = CashRegisterShift (ne stari Shift).
- **FURS per-location (S9)**: `buildFursConfigFromSettings` (locationId obvezen,
  settings.furs* mrtva) + 14 r125 testov; settings PUT ignorira furs polja
  (:67/:154/:174-177); cert vezan na order.locationId v verify-invoice/storno-invoice.
- **Tenant/location izolacija (S10)**: 11/11 endpointov z guard + negativnim testom
  (99 security test fajlov; e2e MODELA-1..16 + IDEMPO-1..5); QR removed-by-design.
- **Idempotencija/concurrency (S11)**: 6/8 scenarijev s testi; CAS/constraint pattern
  dokazan; finalize retry toleranca + NOVA repair veja (R158-1).
- **Offline (S12)**: orders/cancel **OFFLINE-SAFE** (IndexedDB + ledger exactly-once +
  r128 IT + živi E2E); payment **OFFLINE-BLOCKED** (client guard + 422 — po zasnovi);
  DailyClose **OFFLINE-BLOCKED** de facto (zdaj tudi dokumentirano tu); FURS receipt
  sync — SW Background Sync veja **ODSTRANJENA (R170, R166-F7)**: veriga je bila
  mrtva na 3 neodvisnih členih (tag se ni nikoli registriral, IndexedDB queue se
  ni nikoli napolnila, POST bi bil 401 — requireAuth Bearer-only); pravi FURS
  retry = server-side outbox (processors/furs.ts, retry + dead_letter); batch
  auth/platformAdminGate kontrakt ostaja fail-closed po zasnovi.
- **Backup/restore (S13)**: **PHYSICALLY VALIDATED** v sandboxu (živi 6-fazni drill,
  RTO 22 s; r127 round-trip IT teče v CI) — omejitev: PGlite ≠ Neon.

## 7a. Module readiness matrix (issue sekcija 14) — povzetek

**21 complete** (vsak z route + test + živo/e2e dokazom) · **2 partial**: FURS (koda
complete; živi FURS NI fizično validiran — sim-mode), Offline (payments/DailyClose
blocked po zasnovi) · **1 removed/replaced**: QR (→ /api/public/menu).

---

## 8. Findings register (issue sekcija 15)

| ID | Sev. | Naslov | Status |
| --- | --- | --- | --- |
| R158-1 | P1 | DailyClose CLOSED + Z DRAFT dosegljiv ob finalize failu; fast-path replay maskiral dejansko Z stanje | **FIXAN** — replay preveri dejanski Z (po shranjenem businessDate) in ob napačnem stanju izvede idempotenten re-finalize (isti vzorec kot glavna pot; brez audita/draft upserta/tx); strukturirane napake fail-closed passthrough; `Z_REPORT_FINALIZED` toleriran; nove polji `zReportFinalized` (dejansko) + `zReportReFinalized` (marker, backwards-compatible). Testi: 4 v r126-daily-close.test.ts |
| R158-2 | P1 | Legacy POST /api/z-report (finalize=true) obide DailyClose admin odobritev na PENDING_APPROVAL/REOPENED danu | **FIXAN** — gate pred upsertom: 409 `DAILY_CLOSE_PENDING_APPROVAL` / `DAILY_CLOSE_REOPENED` / `DAILY_CLOSE_ALREADY_CLOSED`; brez DailyClose vrstice legacy 1:1; draft (finalize:false) pot odprta. Testi: 6 v r158-zreport-gate.test.ts |
| R158-3 | P2 | data-retention cron ni registriran v vercel.json | **FIXAN (R163)** — vercel.json vnos NAMERNO ni dodan (dokazan Hobby limit 2 crona — cron_jobs_limits_reached @ 398c24fb, 2/2 zasedena) → registracija prek GitHub Actions data-retention.yml (schedule 0 4 * * *, POST + Bearer CRON_SECRET, plan-neodvisno; issue #139); GET pini 27b/28b v r148 unit; predpogoj: secrets.CRON_SECRET + vars.PROD_URL; na Vercel Pro 1-vrstični vnos (route komentar) |
| R158-4 | P2 | 7 finančno-vidnih UTC-bucket mest (e-invoice-book datumIzdaja, tax-report, reports/sales, dashboard, labor, financial/eod privzeti) | **FIXAN (R159-b)** — 10 mest (7 + vat route/time-distribution/export re-sweep) na LJ kanon; year-boundary + trap-DB testi; **P3 ostanki FIXANI (R160-b)** — 17 mest (7 P3 + N1–N8 re-sweep, vključno tihi izpad mesečnih naročil v financial grafu + eDavki XML Period); DEFER seznam dokumentiran |
| R158-5 | P3 | DailyClose `totalRefunds` snapshot vedno 0 → export "Povračila" napačen | **FIXAN (R161)** — refund agregat v calculateReportStats (tx klient = R110 ZR-2, LJ meje, kanon izmene); 9 testov r161-totalrefunds.test.ts |
| R158-6 | P3 | Ni namenskega "sočasni zadnji 2 enoti" testa | **FIXAN (R161)** — r161-last2-units.test.ts (V1a/V1b/V2, DB-pogojni guard pini) |
| R163-S1 | P2 | scheduled-emails/process: registrirani Vercel cron (0 2) pošilja GET, GET pa je stats-only z requireAuth(admin)+platformAdminGate brez CRON_SECRET poti → cron dobi 401, email processing prek Vercel Crona verjetno NE teče | **FIXAN (R164)** — opcija 1 iz issue #140: ločen cron path `/api/cron/scheduled-emails-process` z GET===POST delegacijo na POST obdelavo (vzorec outbox :18-20); vercel.json vnos 0 2 PREUSMERJEN (ostane 2/2 Hobby cron mest); stats kontrakt GET /api/scheduled-emails/process nespremenjen (R85-4c + R160 pini nedotaknjeni); pini r164 unit: vercel.json registracija + maxDuration, 401 fail-closed, cron GET 200 + obdelava, lokacijski admin 403, GET===POST pariteta |
| R166-F1 | P2 | FURS batch: `instanceof Buffer` je zavrnil string PEM (primarna OpenSSL pot loaderja vrača string) → generateZOI brez ključa (prod: throw, test: neskladen SHA-256 fallback ZOI) + manjkajoč ensureDecrypted — latentno, izbruhne ob sim→real | **FIXAN (R166)** — union `string \| Buffer \| undefined` skozi configCache + processBatchReceipt (single-path pariteta verify-invoice :161-182) + ensureDecrypted na batch geslu; 3 passthrough pina (r166-batch-key) |
| R166-F2 | P2 | src/lib/env.ts mrtev sloj — superRefine "FURS_ALLOW_SIMULATION v produkciji" se nikoli ne izvede (0 importov v src/ in tests/) | **DOCUMENT (R166)** — fajl-header opomba (NI se zanašati na ta sloj); živi guardi: server.js:17-33 + boot-guard.ts (health detailed); priklop prek instrumentation = ločena odločitev |
| R166-F3 | P3 | health checkFurs bere FURS_ENVIRONMENT, koda/dokumentacija konfigurirata FURS_ENV → furs check skozi dokumentirano konfiguracijo vedno not_configured | **FIXAN (R166)** — tolerantno `FURS_ENV ?? FURS_ENVIRONMENT` + detail tekst; r96 regresija zelena (pina statusa, ne tekst) |
| R166-F4 | P3 | Storno sim asimetrija: FURS_ALLOW_SIMULATION=true → storno IZVEDEN, stornoReceipt fiscalVerified=true (namerna "Test 5.3" izjema) — nepinana | **PINAN (R166)** — T4/T5 v r166-sim-mode (z flagom: izveden + success=true; brez: 400 + FURS_STORNO_FAILED + zero transakcije); obnašanje nespremenjeno |
| R166-F5 | P3 | Sim EOR generiran a zavrnjen (failResponse eor:'', DB nikoli ne vidi vrednosti) + mrtva "(SIMULACIJA)" success veja | **RAZREŠEN (R166, 2. iteracija)** — propagacija eor-ja v odgovor je bila implementirana in **VRNJENA**: E2E kontrakt core-flow.spec.ts :288/:310 pina response.eor === DB/preview.eor ("V simulaciji EOR ostane prazen"); končno stanje = dokumentiran kontrakt (core.ts komentar) + sim EOR ostane result-internen; mrtva veja dokumentirana (obrambna) |
| R166-F6 | P3 | generateFursVerificationUrl hardkodira prod validator URL (tudi za test okolje), 0 klicalcev | DEFER — mrtvi helper; pri morebitnem brisanju/priklopu odločiti o URL strategiji |
| R166-F7 | P3 | sw.js FURS Background Sync POST brez Authorization headerja → 401/403 (sync funkcionalno mrtev) + hipotetično pobere celoten queue brez per-receipt preverjanja | **REŠEN (R170, CLEANUP)**: veriga mrtva na 3 neodvisnih členih — sw.js furs-receipt-sync veja + syncFursReceipts + 3 helperji (~100 v), registerFursBackgroundSync + celoten offline-furs modul (233 v) izbrisani; INDEXEDDB_STORES prenesen v offline-orders (zdaj 1 store); FIX (Bearer v SW) bi bil gradnja novega feature-a, ne popravilo buga |
| R166-F8 | P3 | FURS cert gesla se pišejo PLAINTEXT (ensureEncrypted 0 klicalcev; .env.example trditev o AES-256-GCM ne drži za FURS polja) | DEFER — pred sim→real: šifriranje write-path (locations POST/PUT) ALI popravek .env.example trditve |
| R166-F9 | P3 | Drobnarije: (a) .env.example FURS_ALLOW_SIMULATION komentar obrnjena formulacija, (c) zoi.ts hint "FURS_ENVIRONMENT=test" ne-obstoječa varjanta; (b) route.ts:92-94 URL duplikat, (d) checklist:31 brez cross-ref na README:532 | **FIXANI (R166): a + c; DEFER: b + d** |

---

## 9. Anti-overclaim izjava (issue sekcija 16)

- "Production-ready" NI trženo — zelen CI je dokaz konsistentnosti, ne produkcijske
  zrelosti; FURS ostaja sim-mode (NOT PHYSICALLY VALIDATED z realnim FURS okoljem).
- "Backup works" je trženo SAMO z restore dokazom (živi drill + CI round-trip).
- "Offline works" velja SAMO za orders/cancel (exactly-once dokazan); payment in
  Daily Close so po zasnovi offline-blokirana.
- Test count je preverjen iz CI logov (ne samo commit claim).

## 10. Definition of Done (issue sekcija 17)

HEAD audit ✅ · CI evidence ✅ · E2E evidence ✅ · dejanski test count ✅ · Daily Close
forenzika ✅ · state matrica ✅ · finalize failure scenarij (testiran + popravljen) ✅ ·
timezone audit ✅ · financial source-of-truth ✅ · R123/R124/R125 regresije (dokazane
z obstoječimi testi) ✅ · tenant/location izolacija ✅ · idempotencija ✅ ·
concurrency ✅ · offline/reconnect status ✅ (dokumentiran, ne PASS vse) ·
backup/restore status ✅ (physically validated v sandboxu) · module matrix ✅ ·
findings P0/P1/P2/P3 ✅ (P1 fixana) · naslednji task ✅ (R158-4).

**Zaklep epika (R162)**: evidence osvežena na HEAD `98925c08` (CI 7/7 + E2E + 2×
Monitor, vse attempt=1; unit 7164 iz CI logov; IT 235). R159 (R158-4), R160 (P3
ostanki + N1–N8) in R161 (R158-5 + R158-6) izvedeni — findings register (§8) zaprt
razen FURS fizične validacije (realno okolje, izven sandboxa). Epik #115
formalno zaprt v R162; parked scope je dokumentiran v zaključnem komentarju epika.
**Dodatek (R163)**: R158-3 FIXAN — registracija prek GitHub Actions data-retention.yml
(schedule 0 4 * * *, plan-neodvisno; vercel.json vnos zavrnjen zaradi dokazanega
Hobby limita 2 crona @ 398c24fb). NOV finding R163-S1 (scheduled-emails/process
GET stats-only → registrirani cron 0 2 verjetno ne procesira; issue #140, [ANALIZA]).
**Dodatek (R164)**: R163-S1 FIXAN — ločen cron path `/api/cron/scheduled-emails-process`
(GET===POST delegacija po outbox vzorcu), vercel.json vnos 0 2 preusmerjen (2/2 Hobby
mest ohranjena); dashboard stats kontrakt ostaja nespremenjen (issue #140 zaprt).
**Dodatek (R166)**: FURS sim-mode validacija poglobitev (forenzični audit R166-a, 9
findings). FIX: R166-F1 (batch ZOI ključ union + ensureDecrypted), R166-F3 (health
FURS_ENV tolerantno); R166-F5 RAZREŠEN v 2. iteraciji (propagacija VRNJENA na
E2E kontrakt dokaz core-flow :310 — dokumentacija namesto spremembe); PIN:
R166-F4 (storno sim asimetrija); DOCUMENT: R166-F2 (env.ts mrtev sloj),
R166-F9a/c; DEFER: R166-F6/F7/F8.
NOVI testi: r166-sim-mode (5), r166-batch-key (3), r166-timezone-dst (5). Anti-overclaim
ostaja: FURS je koda-complete + sim-mode strukturno validiran, **NOT PHYSICALLY
VALIDATED** z realnim FURS okoljem (mTLS/JWS/EOR — §7 točka 7).
**Dodatek (R167)**: balast forenzika (R167-a READ-ONLY audit, 5 kandidatov; register
issue #143). IZBRIS mrtev next-intl plast: messages/*.json (6 datotek / 3617 vrstic /
3260 ključev, incl. mrtev ar.json), i18n-consolidation.ts (288 v) + njegov test,
rtl.ts (112 v, 0 uvoznikov) — živi sistem je custom flat dict src/lib/i18n (README
stack klaim popravljen). REFUTACIJA: trditev "mrtvi 'kds' mapping" iz prejšnjih rund
je napačna — /kds app je ŽIVA; mrto je bilo samo kds.* i18n (25 vrstic, 0 referenc).
MIKRO-CLEANUP: webhook engine/test.ts + UI test-gumb (klical /api/webhooks/test —
ruta ne obstaja, 404 od prvega dne), generateFursVerificationUrl (R166-F6, 0
klicalcev, hardkodiran prod URL). #33 STANJE: jedro zaključeno (R150: 25 polj Json);
ostanki izrecno utemeljeni (modifiersJson dual-write drop odložen, AuditLog.details
hash veriga, WebhookDelivery.payload HMAC, apiKeys backfill TODO, allergens CSV
neodločena). DEFER: Sidebar IA tiering (75 modulov potrjeno, data-driven, 0 mrtvih —
produktna odločitev), R166-F7 sw.js auth, 165/371 neuporabljenih ključev živega i18n,
C4-a/b.
**Dodatek (R168)**: R166-F8 FIXAN — FURS gesla šifriranje at-rest (issue #143 P2).
Write-path: locations POST/PUT skozi ensureEncrypted (AES-256-GCM, secrets.ts;
idempotent, mask-keep vzorec ostane). Read-path: cert-status + build-config skozi
ensureDecrypted (bralni kanon config-resolver/batch/validate-and-submit; legacy
plaintext vrstice ostanejo berljive). Backfill: scripts/migrate-encrypt-secrets.ts
(obstajal je nedokumentiran, R168 wire-an kot `bun run db:encrypt-secrets` —
idempotenten, isEncrypted skip; pokriva 6 skrivnosti: Location.fursCertPassword,
RestaurantSettings furs/SMTP, Webhook.secret, Integration apiKey/apiSecret).
Aktivacija v produkciji zahteva ENCRYPTION_KEY v Vercel envs (uporabniški korak,
izven sandboxa; fail-closed brez njega). Novi pini: r168-furs-password-encryption
(11 testov: write round-trip, mask-keep, idempotencija, read decrypt, legacy
passthrough, source pini). Anti-overclaim: FURS ostaja NOT PHYSICALLY VALIDATED.
**Dodatek (R169)**: docs §2 CI evidence refresh na HEAD 8cf5f100 (unit 7175 =
5226+1949, IT 235, run IDs iz R168, vsi attempt=1, file-based preverjeno).
**Dodatek (R170)**: R166-F7 REŠEN kot CLEANUP — FURS SW Background Sync veriga
izbrisana (odločitev FIX vs CLEANUP: forenzika je pokazala mrtvo verigo na 3
neodvisnih členih — registerFursBackgroundSync 0 klicalcev → tag se nikoli
registrira; enqueueReceipt 0 klicalcev → queue se nikoli ne napolni; requireAuth
je Bearer-only → sw.js POST bi bil 401 kljub napačnemu "cookie auth" komentarju).
Izbrisano: sw.js furs-receipt-sync veja + syncFursReceipts + openFursQueueDB +
getFursPendingReceipts + removeFursReceipt (~100 v), offline-furs modul (233 v,
edini živi izvoz = INDEXEDDB_STORES konstante → prenesen v offline-orders,
store count 2 → 1), README:699 directory vnos. Živi mehanizmi nedotaknjeni:
orders/cancel Background Sync (sync-pending-orders/offline-order-sync), FURS
server-side retry = outbox processors/furs.ts. Re-target: verify-features
(INDEXEDDB pina) + indexeddb-stores.test (4 pini → 1 store + 5 novih R170
source pinov). ZDDV-1 48h obveza ostaja pokrita na strežniški strani.
**Dodatek (R171)**: docs §2 CI evidence refresh na HEAD bb7d422f (unit 7180 =
5231+1949, IT 235, run IDs iz R170, vsi attempt=1).
**Dodatek (R172)**: issue #144 P0 koraka 1–2 — re-audit baseline (v1.26.0 ✓,
75 nav modulov ✓, delovne površine ✓, module-registry.tsx osnova ✓) + NOVI
avtoritativni status vir docs/PRODUCT-STATUS.md (§12: machine-readable JSON,
verzija povezana na package.json z unit testom) + dokumentacijska resnica
(§11): ARCHITECTURE.md offline-furs vrstica odstranjena (modul brisan R170),
FINAL-SUMMARY.md + PRODUCTION-READINESS-CHECKLIST.md dobita ZGODOVINSKI baner
(stare "Production READY" ocene iz v1.0.2/v1.0.3 niso več evidence-backed),
CLIENT-ONBOARDING-GUIDE.md PIN-i označeni DEMO/TEST ONLY, README:508/511
zastareli test counts (54/1798) prevezani na 1949 security / 5251 unit
(290 fajlov; skupaj z CI-only security = 7200, CI-log potrjeno za ta HEAD). Nov test: product-status.test.ts
(15 pinov: verzija ↔ package.json, §12 polja, notranja konsistenca evidence,
ZGODOVINSKI banerji, offline-furs odsoten iz ARCHITECTURE, DEMO opozorilo,
brez 1798). BONUS (epic §19.17): 2 TZ-latentna testna buga popravljena —
r111 loyalty pina (347/392) UTC datum → ljubljanaTodayStr kanon (latentno
od R160 P3-5; padalo ob 00:00–02:00 LJ) in r135 kiosk IT seed dayOfWeek
new Date().getDay() → NOVI kanonski helper ljubljanaDayOfWeek()
(timezone-sl.ts; +5 pinov v p2-ux-formatting). Unit 290f/5250, IT 235.
